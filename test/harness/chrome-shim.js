// chrome.* stand-in for trying the extension in a browser without installing it. Translation goes straight to Google.
// Query flags: ?fake=1 (offline fake translator), ?fake=error (every request fails), ?fake=hang (no reply at all),
// ?orphan=1 (extension context lost after 3 s), ?list=0 (empty keep list).
// ?fake=1 is for browser panes that can't reach the Google endpoint: "merhaba" → "RU[merhaba]".
// Warning: name fixing and incoming-message logic were written against real language detection; with the fake translator only check the flow.
function fakeTranslate(msg) {
  if (/^[A-Z]{2}\[.*\]$/s.test(msg.text)) return { ok: true, text: msg.text, src: msg.tl };
  return { ok: true, text: msg.tl.toUpperCase() + '[' + msg.text + ']', src: /[Ѐ-ӿ]/.test(msg.text) ? 'ru' : 'tr' };
}
window.chrome = {
  runtime: {
    id: 'test-harness', // deleted by ?orphan=1: as if the extension had been reloaded
    lastError: null,
    sendMessage(msg, cb) {
      if (/fake=1/.test(location.search)) { setTimeout(() => cb(fakeTranslate(msg)), 150); return; }
      // ?fake=hang: the service never replies (tests the timeout and a stuck translation)
      if (/fake=hang/.test(location.search)) return;
      // ?fake=error: every request fails, as if the service were rate-limiting
      if (/fake=error/.test(location.search)) { setTimeout(() => cb({ ok: false, error: 'rate-limited' }), 150); return; }
      fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&dt=t&tl=' + msg.tl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: 'q=' + encodeURIComponent(msg.text),
      }).then(r => r.json())
        .then(j => cb({ ok: true, text: j[0].filter(s => s && s[0]).map(s => s[0]).join(''), src: String(j[2] || '') }))
        .catch(e => cb({ ok: false, error: String(e.message) }));
    },
  },
  storage: {
    // ?list=0 starts with an empty do-not-translate list (to try automatic name detection).
    sync: { get(d, cb) { cb(Object.assign({}, d, { keepList: /list=0/.test(location.search) ? [] : ['koryangelo', 'tekrocan'] })); } },
    local: {
      _d: {},
      get(d, cb) { cb(Object.assign({}, d, this._d)); },
      set(o) { Object.assign(this._d, o); window.__learned = this._d.learnedNames; },
    },
    onChanged: { addListener() {} },
  },
};
// ?orphan=1: the context is lost 3 s after the page opens (like an old script left in an open tab after ↻).
if (/orphan=1/.test(location.search)) {
  setTimeout(() => {
    delete window.chrome.runtime.id;
    window.chrome.runtime.sendMessage = () => { throw new Error('Extension context invalidated.'); };
  }, 3000);
}
