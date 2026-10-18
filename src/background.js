// Sends translation requests from here instead of the page (avoids CORS).
// The cache is persistent (the same text is never requested again, even after a page reload or service worker sleep).
// If Google rate-limits or is unreachable, falls back to the free MyMemory for a while.
importScripts('langcheck.js', 'gemini.js'); // resolved next to this file: src/
const GOOGLE = 'https://translate.googleapis.com/translate_a/single';
const MYMEMORY = 'https://api.mymemory.translated.net/get';
const MYMEMORY_MAX_CHARS = 500;
const CACHE_MAX = 2000;
const CACHE_KEY = 'tcache';

const blockedUntil = { google: 0, mymemory: 0, gemini: 0 };
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

// ---------------- Gemini (the user's own API key) ----------------

const langName = (() => {
  try { const dn = new Intl.DisplayNames(['en'], { type: 'language' }); return c => dn.of(c) || c; } catch (_) { return c => c; }
})();
const modelBlockedUntil = {};   // model id -> time; a model over its free quota is skipped for a while
let models = null;              // { flash, lite } picked from the key's model list

async function geminiKey() {
  const s = await chrome.storage.local.get({ geminiKey: '' });
  return s.geminiKey;
}

async function listModels(key) {
  let res;
  try {
    res = await fetch(CC.GEMINI_API + '/models?pageSize=1000', { headers: { 'x-goog-api-key': key } });
  } catch (_) { throw new Blocked('gemini unreachable'); }
  if (res.status === 400 || res.status === 401 || res.status === 403) throw new Error('bad-key');
  if (!res.ok) throw new Blocked('gemini ' + res.status);
  const picked = CC.pickModels((await res.json()).models);
  if (!picked.flash) throw new Error('no-model');
  return picked;
}

async function geminiModels(key) {
  if (models) return models;
  const s = await chrome.storage.local.get({ geminiModels: null });
  // Re-read the list once a week: Google renames and retires models every few months.
  if (s.geminiModels && Date.now() - s.geminiModels.at < 7 * 864e5) return (models = s.geminiModels);
  models = { ...(await listModels(key)), at: Date.now() };
  chrome.storage.local.set({ geminiModels: models });
  return models;
}

function retryDelayMs(body) {
  const d = (body?.error?.details || []).find(x => x.retryDelay)?.retryDelay;
  const s = parseFloat(d);
  return Number.isFinite(s) ? Math.min(Math.max(s, 5), 3600) * 1000 : 60000;
}

// opts.tier: 'flash' (what the user sends, "better translation" clicks) or 'lite' (incoming messages: many of them);
// the other model is tried when the first one is over its quota. opts.context: earlier chat lines.
async function gemini(text, tl, opts = {}) {
  const key = await geminiKey();
  if (!key) throw new Error('no-key');
  const picked = await geminiModels(key);
  const order = opts.tier === 'lite' ? [picked.lite, picked.flash] : [picked.flash, picked.lite];
  let lastErr = new Blocked('gemini busy');
  for (const model of [...new Set(order)]) {
    if (Date.now() < (modelBlockedUntil[model] || 0)) continue;
    let body = CC.buildRequest(text, langName(tl), opts.context, model);
    for (let attempt = 0; attempt < 2; attempt++) {
      let res, j;
      try {
        res = await fetch(CC.GEMINI_API + '/models/' + model + ':generateContent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify(body),
        });
        j = await res.json().catch(() => null);
      } catch (_) { throw new Blocked('gemini unreachable'); }
      if (res.ok) {
        const out = CC.parseResponse(j);
        return { text: out.text, src: out.src || 'auto', engine: 'gemini', tier: model === picked.flash ? 'flash' : 'lite' };
      }
      // A model that rejects the thinking setting: once more without it.
      if (res.status === 400 && attempt === 0 && body.generationConfig.thinkingConfig && /think/i.test(j?.error?.message || '')) {
        delete body.generationConfig.thinkingConfig;
        continue;
      }
      if (res.status === 404) { models = null; chrome.storage.local.remove('geminiModels'); lastErr = new Blocked('gemini model gone'); break; }
      if (res.status === 401 || res.status === 403 || (res.status === 400 && /api key/i.test(j?.error?.message || ''))) {
        chrome.storage.local.set({ geminiStatus: 'bad-key' });
        throw new Blocked('gemini bad key');
      }
      if (res.status === 429) { modelBlockedUntil[model] = Date.now() + retryDelayMs(j); lastErr = new Blocked('gemini quota'); break; }
      lastErr = res.status >= 500 ? new Blocked('gemini ' + res.status) : new Error('gemini HTTP ' + res.status);
      break;
    }
  }
  throw lastErr;
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

const ENGINES = { gemini, google, mymemory };

// engines: which online engines may answer, in order. The page asks for Gemini (when the user has a key) and Google
// first, and only falls back to MyMemory after Chrome's on-device translator, because MyMemory's answers for casual
// chat are often nonsense ("через меня заходите" -> "içimden gel", "всё" -> "hiçbirşey").
async function translate(text, tl, engines = ['google', 'mymemory'], opts = {}) {
  const key = tl + '\n' + text;
  const c = await loadCache();
  const hit = c.get(key);
  // With Gemini on, an older Google/MyMemory answer in the cache doesn't stand in for it.
  // A Lite answer doesn't stand in for a Flash request ("better translation" clicks, what the user sends).
  const hitOk = hit && (engines[0] === 'gemini' && Date.now() >= blockedUntil.gemini
    ? hit.engine === 'gemini' && (hit.tier === 'flash' || opts.tier === 'lite') : engines.includes(hit.engine || 'google'));
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
      if (name === 'gemini') {
        // Quota is handled per model inside gemini(); here only a key or network problem pauses it.
        if (/no-key|bad key|unreachable/.test(e.message)) blockedUntil.gemini = Date.now() + (/no-key/.test(e.message) ? 0 : 5 * 60000);
      } else if (e instanceof Blocked) {
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

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'translate') {
    const context = Array.isArray(msg.context)
      ? msg.context.slice(-4).map(c => ({ me: !!c.me, text: String(c.text || '').slice(0, 300) })) : [];
    translate(String(msg.text || ''), String(msg.tl || 'ru'), Array.isArray(msg.engines) ? msg.engines.map(String) : undefined,
      { tier: msg.tier === 'lite' ? 'lite' : 'flash', context })
      .then(r => sendResponse({ ok: true, text: r.text, src: r.src, engine: r.engine }))
      .catch(e => sendResponse({ ok: false, error: String(e?.message || e) }));
    return true;
  }
  // From the popup only: check a pasted key against the model list, then store it (never synced across devices).
  if (msg?.type === 'gemini-key' && sender.id === chrome.runtime.id && !sender.tab) {
    const key = String(msg.key || '').trim();
    if (!key) {
      models = null;
      chrome.storage.local.remove(['geminiKey', 'geminiModels', 'geminiStatus']);
      chrome.storage.local.set({ geminiOn: false }, () => sendResponse({ ok: true, off: true }));
      return true;
    }
    listModels(key).then(picked => {
      models = { ...picked, at: Date.now() };
      blockedUntil.gemini = 0;
      chrome.storage.local.set({ geminiKey: key, geminiModels: models, geminiStatus: 'ok', geminiOn: true },
        () => sendResponse({ ok: true, model: picked.flash, lite: picked.lite }));
    }, e => sendResponse({ ok: false, error: e.message }));
    return true;
  }
  return false;
});
