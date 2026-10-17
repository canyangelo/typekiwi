// Runs in the page's MAIN world. Chrome's on-device Translator and LanguageDetector exist on the page's window but
// are not exposed to extension content scripts (isolated world), so content.js asks through DOM events.
// Requests and replies are JSON strings: objects don't cross between worlds.
// The page can see these events, but it only ever sees text that is already in its own boxes and messages.
(() => {
  if (window.__typekiwiBridge) return;
  window.__typekiwiBridge = true;
  if (typeof self.Translator !== 'function' || typeof self.LanguageDetector !== 'function') return;

  const translators = new Map();   // "src>tl" -> Promise<Translator>
  let detectorP = null;

  function translator(src, tl) {
    const key = src + '>' + tl;
    if (!translators.has(key)) {
      const p = Translator.create({ sourceLanguage: src, targetLanguage: tl });
      p.catch(() => translators.delete(key));
      translators.set(key, p);
    }
    return translators.get(key);
  }

  async function handle(req) {
    switch (req.op) {
      case 'detectorAvailability':
        return LanguageDetector.availability();
      case 'detect':
        if (!detectorP) {
          detectorP = LanguageDetector.create();
          detectorP.catch(() => { detectorP = null; });
        }
        return (await (await detectorP).detect(req.text)).slice(0, 3)
          .map(r => ({ detectedLanguage: r.detectedLanguage, confidence: r.confidence }));
      case 'availability':
        return Translator.availability({ sourceLanguage: req.src, targetLanguage: req.tl });
      case 'download': {
        // Dispatched synchronously from a keystroke/click handler, so the user gesture is still active when
        // Translator.create runs (before the first await). Resolves once the pack is downloaded.
        const p = translator(req.src, req.tl);
        await p;
        return true;
      }
      case 'translate':
        return (await translator(req.src, req.tl)).translate(req.text);
      default:
        throw new Error('unknown op');
    }
  }

  document.addEventListener('typekiwi:req', e => {
    let req;
    try { req = JSON.parse(e.detail); } catch (_) { return; }
    const reply = body => document.dispatchEvent(new CustomEvent('typekiwi:res', { detail: JSON.stringify({ id: req.id, ...body }) }));
    handle(req).then(value => reply({ ok: true, value }), err => reply({ ok: false, error: String(err?.message || err) }));
  });
  // A DOM attribute both worlds can read: tells content.js the bridge is listening.
  document.documentElement.dataset.typekiwiBridge = '1';
})();
