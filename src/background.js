// Sends translation requests from here instead of the page (avoids CORS).
// The cache is persistent (the same text is never requested again, even after a page reload or service worker sleep).
// If Google rate-limits or is unreachable, falls back to the free MyMemory for a while.
importScripts('langcheck.js'); // resolved next to this file: src/langcheck.js
const GOOGLE = 'https://translate.googleapis.com/translate_a/single';
const MYMEMORY = 'https://api.mymemory.translated.net/get';
const MYMEMORY_MAX_CHARS = 500;
const CACHE_MAX = 2000;
const CACHE_KEY = 'tcache';

const blockedUntil = { google: 0, mymemory: 0 };
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

async function translate(text, tl) {
  const key = tl + '\n' + text;
  const c = await loadCache();
  if (c.has(key)) return c.get(key);

  let out = null;
  let lastErr = null;
  for (const [name, fn] of [['google', google], ['mymemory', mymemory]]) {
    if (Date.now() < blockedUntil[name]) continue;
    try {
      out = await fn(text, tl);
      if (name === 'google') googleFailures = 0;
      break;
    } catch (e) {
      lastErr = e;
      if (e instanceof Blocked) {
        if (name === 'google') {
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
  translate(String(msg.text || ''), String(msg.tl || 'ru'))
    .then(r => sendResponse({ ok: true, text: r.text, src: r.src, engine: r.engine }))
    .catch(e => sendResponse({ ok: false, error: String(e?.message || e) }));
  return true;
});
