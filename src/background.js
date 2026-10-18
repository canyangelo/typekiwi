// Sends translation requests from here instead of the page (avoids CORS).
// The cache is persistent (the same text is never requested again, even after a page reload or service worker sleep).
// If Google rate-limits or is unreachable, falls back to the free MyMemory for a while.
importScripts('langcheck.js', 'server-config.js'); // resolved next to this file: src/
// TypeKiwi's own translation API (a Cloudflare Worker): official DeepL / Microsoft / Google Cloud with TypeKiwi's
// keys. Tried first; the free engines below are the fallback. Its address comes from src/server-config.js, which is
// empty in the public source: builds from source simply use the free engines.
const SERVER = self.TYPEKIWI_SERVER ? self.TYPEKIWI_SERVER.replace(/\/+$/, '') + '/translate' : '';
const GOOGLE = 'https://translate.googleapis.com/translate_a/single';
const MYMEMORY = 'https://api.mymemory.translated.net/get';
const MYMEMORY_MAX_CHARS = 500;
const CACHE_MAX = 2000;
const CACHE_KEY = 'tcache';

const blockedUntil = { server: 0, google: 0, mymemory: 0 };
let googleFailures = 0;

// ---------------- Persistent cache ----------------

let cache = null; // Map, loaded from storage.local on first use
let saveTimer = null;

async function loadCache() {
  if (cache) return cache;
  const s = await chrome.storage.local.get({ [CACHE_KEY]: [] });
  cache = new Map(s[CACHE_KEY]);
  return cache;
}

function saveCacheSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const entries = [...cache.entries()].slice(-CACHE_MAX);
    chrome.storage.local.set({ [CACHE_KEY]: entries });
  }, 1500);
}

// ---------------- Engines ----------------

class Blocked extends Error {}

async function google(text, tl) {
  let res;
  try {
    res = await fetch(GOOGLE + '?client=gtx&sl=auto&dt=t&tl=' + encodeURIComponent(tl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: 'q=' + encodeURIComponent(text),
      // When rate-limiting, Google redirects to google.com/sorry (the robot page). If the redirect is followed, Chrome
      // raises a CORS error and shows it as an extension error in chrome://extensions; we don't follow it and treat it as a limit.
      redirect: 'manual',
    });
  } catch (e) {
    throw new Blocked('google unreachable');
  }
  if (res.type === 'opaqueredirect') throw new Blocked('google sorry');
  if (res.status === 429 || res.status >= 500) throw new Blocked('google ' + res.status);
  if (!res.ok) throw new Error('google HTTP ' + res.status);
  const j = await res.json();
  return {
    text: (j[0] || []).filter(seg => seg && seg[0]).map(seg => seg[0]).join(''),
    src: String(j[2] || ''),
    engine: 'google',
  };
}

// context: earlier chat lines (oldest first) that help with meaning; DeepL reads them without translating them.
async function server(text, tl, opts = {}) {
  if (!SERVER) throw new Error('no server configured');
  const context = (opts.context || []).map(c => c.text).join('\n').slice(-600);
  let res;
  try {
    res = await fetch(SERVER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text, tl, context }),
    });
  } catch (_) { throw new Blocked('server unreachable'); }
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.ok) throw new Blocked('server ' + (j?.error || res.status));
  return { text: j.text, src: j.src || 'auto', engine: 'server', via: j.engine };
}

async function mymemory(text, tl) {
  if (text.length > MYMEMORY_MAX_CHARS) throw new Error('too-long');
  const url = MYMEMORY + '?q=' + encodeURIComponent(text) + '&langpair=' + encodeURIComponent('autodetect|' + tl);
  let j;
  try {
    const res = await fetch(url, { redirect: 'manual' });
    if (res.type === 'opaqueredirect' || res.status === 429) throw new Blocked('mymemory limit');
    j = await res.json();
  } catch (e) {
    throw new Blocked('mymemory unreachable');
  }
  const status = Number(j.responseStatus);
  // If the source is already in the target language, MyMemory returns 403 "PLEASE SELECT TWO DISTINCT LANGUAGES".
  if (status === 403 && /DISTINCT LANGUAGES/i.test(j.responseData?.translatedText || '')) {
    return { text, src: tl, engine: 'mymemory' };
  }
  if (status === 429) throw new Blocked('mymemory quota');
  if (status !== 200) throw new Error('mymemory ' + status);
  const out = String(j.responseData?.translatedText || '');
  const src = String(j.responseData?.detectedLanguage || '').toLowerCase().split('-')[0];
  // MyMemory sometimes answers in English whatever the target is; never show or cache that.
  if (src !== tl && globalThis.CC.wrongLanguage(out, tl)) throw new Error('wrong-language');
  return { text: out, src, engine: 'mymemory' };
}

const ENGINES = { server, google, mymemory };

// engines: which online engines may answer, in order. The page asks for Google alone first and only falls back to
// MyMemory after Chrome's on-device translator, because MyMemory's answers for casual chat are often nonsense
// ("через меня заходите" -> "içimden gel", "всё" -> "hiçbirşey").
async function translate(text, tl, engines = ['google', 'mymemory'], opts = {}) {
  const key = tl + '\n' + text;
  const c = await loadCache();
  const hit = c.get(key);
  // While our server answers, an older free-engine answer in the cache doesn't stand in for it.
  const hitOk = hit && (engines[0] === 'server' && SERVER && Date.now() >= blockedUntil.server
    ? hit.engine === 'server' : engines.includes(hit.engine || 'google'));
  if (hitOk) return hit;

  let out = null;
  let lastErr = null;
  for (const name of engines) {
    const fn = ENGINES[name];
    if (!fn || Date.now() < blockedUntil[name]) continue;
    try {
      out = await fn(text, tl, opts);
      if (name === 'google') googleFailures = 0;
      break;
    } catch (e) {
      lastErr = e;
      if (e instanceof Blocked) {
        if (name === 'server') {
          // No keys yet, quota used up or offline: the free engines carry on for a couple of minutes.
          blockedUntil.server = Date.now() + 2 * 60000;
        } else if (name === 'google') {
          googleFailures++;
          // Skip Google entirely for 1 min, 2 min, 4 min ... at most 15 min.
          blockedUntil.google = Date.now() + Math.min(60000 * 2 ** (googleFailures - 1), 15 * 60000);
        } else {
          blockedUntil.mymemory = Date.now() + 60 * 60000;
        }
      }
    }
  }
  if (!out) throw new Error(lastErr instanceof Blocked || !lastErr ? 'rate-limited' : String(lastErr.message));

  c.delete(key);
  c.set(key, out);
  saveCacheSoon();
  return out;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== 'translate') return false;
  const context = Array.isArray(msg.context)
    ? msg.context.slice(-4).map(c => ({ me: !!c.me, text: String(c.text || '').slice(0, 300) })) : [];
  translate(String(msg.text || ''), String(msg.tl || 'ru'), Array.isArray(msg.engines) ? msg.engines.map(String) : undefined, { context })
    .then(r => sendResponse({ ok: true, text: r.text, src: r.src, engine: r.engine }))
    .catch(e => sendResponse({ ok: false, error: String(e?.message || e) }));
  return true;
});
