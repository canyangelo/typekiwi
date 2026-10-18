// Text boxes on every site: translates into the target language once you stop typing. On FunPay it also adds translations under incoming messages.
(() => {
  const CC = globalThis.CC;
  const DEFAULTS = { enabled: true, incoming: true, targetLang: 'ru', readLang: 'tr', keepList: [], offSites: [] };
  const IDLE_MS = 700;
  const SENT_CHECK_MS = 400;
  const ENTER_SETTLE_MS = 60;     // after Enter, wait for the editor to render the last keystroke into the DOM
  const RECENT_INPUT_MS = 150;   // Enter in an editable box changed this recently is held until the DOM settles
  const TRANSLATE_TIMEOUT_MS = 10000; // if the service doesn't answer, "translating" must not last forever
  // __ccFunpay lets the test page act like FunPay; on the real site page scripts can't reach this world.
  const IS_FUNPAY = /(^|\.)funpay\.com$/i.test(location.hostname) || globalThis.__ccFunpay === true;
  const FP_INPUT_SEL = 'form.chat-form textarea, .chat-form-input textarea, textarea[name="content"]';
  const MSG_SEL = '.chat-message-list .chat-msg-item';

  let settings = { ...DEFAULTS };
  const states = new WeakMap();   // field → state
  const live = new Set();         // open states (to reset on disable and to position badges)
  const eligibleCache = new WeakMap();
  let synthetic = false;          // don't intercept the Enter we generate ourselves

  // When the extension is reloaded (↻) Chrome doesn't inject the new script into open tabs; the old one keeps
  // listening, but translate requests fail with "Extension context invalidated" and every Enter got blocked as "not translated".
  // A script whose connection is gone disables itself completely: the tab works as if there were no extension.
  let orphan = false;
  function alive() {
    if (orphan) return false;
    let ok = false;
    try { ok = !!chrome.runtime?.id; } catch (_) { /* context invalidated */ }
    if (!ok) {
      orphan = true;
      for (const st of live) { clearTimeout(st.timer); st.observer?.disconnect(); st.badge.remove(); }
      live.clear();
    }
    return ok;
  }

  const active = () => alive() && settings.enabled && !CC.isSiteOff(location.hostname, settings.offSites);

  // ---------------- Translation engines ----------------
  // 1) Chrome's on-device Translator API (Chrome 138+): no network, no rate limit, nothing leaves the computer.
  //    A language pair's model has to be downloaded once, and Chrome only allows that during a user gesture,
  //    so a missing pair is remembered and downloaded on the next keystroke or click on the page.
  // 2) Network engines in the background (Google, then MyMemory) while a pair isn't on the device yet, or on
  //    browsers without the API. Those are the ones that get rate-limited.
  // Some builds never settle these promises (seen in an embedded Chromium): every step is time-boxed and
  // a timeout simply means "use the network engines".
  const LOCAL_STEP_MS = 1500;
  const timeBoxed = p => Promise.race([p, new Promise((_, reject) => setTimeout(() => reject(new Error('local timeout')), LOCAL_STEP_MS))]);

  // The API lives on the page's window and Chrome does not expose it to content scripts, so it is reached
  // through src/page-bridge.js (MAIN world) with DOM events. If this world ever has it directly, that is used.
  const direct = typeof self.Translator === 'function' && typeof self.LanguageDetector === 'function';
  const bridgeUp = () => document.documentElement?.dataset.typekiwiBridge === '1';
  const hasLocal = () => direct || bridgeUp();
  let bridgeSeq = 0;
  const bridgeWaiting = new Map();
  document.addEventListener('typekiwi:res', e => {
    let r;
    try { r = JSON.parse(e.detail); } catch (_) { return; }
    const w = bridgeWaiting.get(r.id);
    if (!w) return;
    bridgeWaiting.delete(r.id);
    if (r.ok) w.resolve(r.value); else w.reject(new Error(r.error));
  });
  function bridge(op, args, timeoutMs = LOCAL_STEP_MS * 2) {
    return new Promise((resolve, reject) => {
      const id = ++bridgeSeq;
      bridgeWaiting.set(id, { resolve, reject });
      setTimeout(() => { if (bridgeWaiting.delete(id)) reject(new Error('bridge timeout')); }, timeoutMs);
      document.dispatchEvent(new CustomEvent('typekiwi:req', { detail: JSON.stringify({ id, op, ...args }) }));
    });
  }

  const directTranslators = new Map();
  function directTranslator(src, tl) {
    const key = src + '>' + tl;
    if (!directTranslators.has(key)) {
      const p = Translator.create({ sourceLanguage: src, targetLanguage: tl });
      p.catch(() => directTranslators.delete(key));
      directTranslators.set(key, p);
    }
    return directTranslators.get(key);
  }
  let directDetector = null;
  const local = direct ? {
    detectorAvailability: () => LanguageDetector.availability(),
    detect: async text => (await (directDetector ||= LanguageDetector.create())).detect(text),
    availability: (src, tl) => Translator.availability({ sourceLanguage: src, targetLanguage: tl }),
    download: (src, tl) => directTranslator(src, tl),
    translate: async (src, tl, text) => (await directTranslator(src, tl)).translate(text),
  } : {
    detectorAvailability: () => bridge('detectorAvailability'),
    detect: text => bridge('detect', { text }),
    availability: (src, tl) => bridge('availability', { src, tl }),
    download: (src, tl) => bridge('download', { src, tl }, PACK_TIMEOUT_MS),  // resolves when the pack is in
    translate: (src, tl, text) => bridge('translate', { src, tl, text }),
  };

  let detectorOk = null;          // Promise<boolean>

  // Language packs: Chrome downloads a pair only during a user gesture. Missing pairs wait in this queue; the next
  // keystroke or click starts one (one per gesture). When a pack arrives, translations that failed meanwhile run again.
  const PACK_TIMEOUT_MS = 10 * 60 * 1000;
  const pendingPairs = new Map();   // "src>target" -> { src, target }
  const downloading = new Set();    // "src>target" being downloaded
  const failedNodes = new Set();    // incoming messages that couldn't be translated yet
  const langName = (() => {
    try { const dn = new Intl.DisplayNames(['en'], { type: 'language' }); return c => dn.of(c) || c; } catch (_) { return c => c; }
  })();

  async function detectLocal(text) {
    if (!hasLocal()) return null;
    if (!detectorOk) detectorOk = timeBoxed(local.detectorAvailability()).then(a => a === 'available', () => false);
    if (!(await detectorOk)) { detectorOk = null; return null; }
    try { return await timeBoxed(local.detect(text)); } catch (_) { return null; }
  }

  async function pairState(src, target) {
    try { return await timeBoxed(local.availability(src, target)); } catch (_) { return 'unknown'; }
  }

  function queuePair(src, target) {
    const key = src + '>' + target;
    if (!downloading.has(key)) pendingPairs.set(key, { src, target });
  }

  async function translateLocal(text, tl, hint) {
    if (!hasLocal()) return null;
    const target = CC.chromeLang(tl);
    const src = CC.pickSource(await detectLocal(text), hint && CC.chromeLang(hint), text);
    if (!src) return null;
    if (CC.sameLang(src, target)) return { ok: true, text, src: tl, engine: 'chrome' };
    const state = await pairState(src, target);
    if (state === 'downloadable' || state === 'downloading') {
      if (state === 'downloadable') queuePair(src, target);
      return { ok: false, error: 'pack', pack: `${langName(src)} → ${langName(target)}` };
    }
    if (state !== 'available') return null;
    try {
      return { ok: true, text: await timeBoxed(local.translate(src, target, text)), src, engine: 'chrome' };
    } catch (_) { return null; }
  }

  // Called on trusted keystrokes and clicks: one pack download per gesture (Chrome's rule). The bridge call is
  // dispatched synchronously, so the page-side Translator.create still runs inside the gesture.
  function downloadPending() {
    if (!pendingPairs.size || !navigator.userActivation?.isActive || !hasLocal()) return;
    const [key, { src, target }] = pendingPairs.entries().next().value;
    pendingPairs.delete(key);
    downloading.add(key);
    let p;
    try { p = local.download(src, target); } catch (_) { downloading.delete(key); return; }
    Promise.resolve(p).then(
      () => { downloading.delete(key); packReady(); },
      () => { downloading.delete(key); },
    );
  }

  // Before anything is typed: if this chat's language pair isn't on the device yet, queue it so the very first
  // keystroke in the box fetches it.
  async function prefetchPairs() {
    if (!hasLocal()) return;
    const a = CC.chromeLang(settings.readLang), b = CC.chromeLang(settings.targetLang);
    if (CC.sameLang(a, b)) return;
    for (const [from, to] of [[a, b], [b, a]]) if ((await pairState(from, to)) === 'downloadable') queuePair(from, to);
  }

  // A pack arrived: redo what failed while it was missing.
  function packReady() {
    for (const st of live) {
      if (!st.inflight && !st.paused && st.failedText && read(st) === st.failedText) { st.failedText = ''; run(st); }
    }
    for (const item of failedNodes) if (item.isConnected) delete item.dataset.ccText;
    failedNodes.clear();
    scanMessages();
  }

  // Which language a text is most likely written in when no detection is possible: for what the user types,
  // their own language; for what they read, the other side's.
  const hintFor = tl => (tl === settings.targetLang ? settings.readLang : settings.targetLang);

  // Which engine goes first depends on what the text is for:
  //  'local'   incoming messages: on-device first (fast, unlimited; there are many of them), network as fallback.
  //  'network' what the user sends, and "better translation" clicks: Google first because it reads more naturally,
  //            on-device as fallback when Google is busy. Few messages a day, so Google's limits are rarely hit.
  //  'networkOnly' for an explicit "better translation" request: no point answering with the on-device text again.
  // MyMemory comes last everywhere except 'networkOnly': its casual-chat answers are worse than the on-device model's.
  // TypeKiwi's own server (official DeepL / Microsoft / Google APIs) goes first for everything, incoming too.
  const NETWORK_FIRST_TIMEOUT_MS = 5000;
  async function translate(text, tl, hint, mode = 'local', context) {
    const first = mode === 'local' ? ['server'] : mode === 'networkOnly' ? ['server', 'google', 'mymemory'] : ['server', 'google'];
    const net1 = await translateNetwork(text, tl, NETWORK_FIRST_TIMEOUT_MS, first, context);
    if (net1.ok || mode === 'networkOnly') return net1;
    const loc = await translateLocal(text, tl, hint);
    if (loc && loc.ok) return loc;
    const net = await translateNetwork(text, tl, TRANSLATE_TIMEOUT_MS, mode === 'local' ? undefined : ['mymemory']);
    if (net.ok || !loc) return net;
    return loc;   // "the language pack is on its way" says more than a network failure
  }

  function translateNetwork(text, tl, timeoutMs = TRANSLATE_TIMEOUT_MS, engines, context) {
    return new Promise(resolve => {
      const timer = setTimeout(() => resolve({ ok: false, error: 'timeout' }), timeoutMs);
      const done = r => { clearTimeout(timer); resolve(r); };
      try {
        chrome.runtime.sendMessage({ type: 'translate', text, tl, engines, context }, res => {
          if (chrome.runtime.lastError || !res) done({ ok: false, error: chrome.runtime.lastError?.message || 'no response' });
          else done(res);
        });
      } catch (e) {
        alive();
        done({ ok: false, error: String(e?.message || e) });
      }
    });
  }

  // Short reason shown when hovering the badge (so the user can see why it happened).
  function reason(error) {
    if (error === 'pack') return 'Chrome translates this pair on your computer once its language pack is downloaded (one time). The download starts with your next keystroke or click; this message is translated as soon as it is in.';
    if (error === 'rate-limited') return 'The online translation services rate-limited this IP. TypeKiwi switches to Chrome\'s on-device translator once its language pack is downloaded (open the TypeKiwi menu to download it now).';
    if (error === 'timeout') return 'The translation service didn\'t respond within 10 s.';
    if (/context invalidated|Receiving end/i.test(error || '')) return 'The extension was reloaded; refresh the page.';
    return 'Couldn\'t reach the translation service (' + (error || 'connection') + ').';
  }

  // My own name, the other party's name in the chat (FunPay) and automatically learned names are kept as is.
  let learnedNames = [];
  function keepList() {
    const names = IS_FUNPAY
      ? [...document.querySelectorAll('.user-link-name, .chat-header .media-user-name a, .chat-msg-author-link')]
        .map(el => el.textContent.trim()).filter(n => n && !/\s/.test(n))
      : [];
    return [...(settings.keepList || []), ...learnedNames, ...names];
  }

  async function translateProtected(text, tl, mode = 'local', context) {
    // Turkish personal names (necati, adım X, X abi…) are protected up front; Google wrote them in Cyrillic (Некати).
    const personNames = CC.findTurkishNames(text);
    // Chat abbreviations spelled out first ("ща" -> "сейчас"); the translator doesn't know them.
    // The slang list of the language the text is most likely in: the user's own for what they type, the other side's for replies.
    const masked = CC.protect(CC.expandSlang(text, hintFor(tl)), [...keepList(), ...personNames]);
    const res = await translate(masked.text, tl, hintFor(tl), mode, context);
    if (!res.ok) return res;
    let out = CC.restore(res.text, masked.parts);
    if (CYRILLIC.has(tl) && res.src !== tl) out = await fixNames(text, out, res.src);
    if (res.src !== tl) out = CC.capitalizeNames(out, personNames);
    return { ok: true, src: res.src, text: out, engine: res.engine || 'network' };
  }

  // Google writes names it doesn't know in Cyrillic letters (koryangelo → Корьянжело).
  // For similar pairs it asks about the source word alone: if the language isn't Turkish/English/the sentence's language,
  // it counts as a name (koryangelo → tl, tekrocan → hi; sistem → tr, problem → en), is restored to Latin and learned.
  const CYRILLIC = new Set(['ru', 'uk', 'kk', 'be', 'bg', 'sr', 'mk', 'ky', 'tg', 'mn']);
  async function fixNames(source, translated, srcLang) {
    const pairs = CC.findTransliterated(source, translated);
    if (!pairs.length) return translated;
    // A word left in Latin but misspelled in the Russian text (Koryagelo) is already a name; no need to ask.
    const checks = await Promise.all(pairs.map(p => (p.cyrillic ? detectWord(p.latin) : null)));
    const names = pairs.filter((p, i) => {
      if (!p.cyrillic) return true;
      const d = checks[i];
      return d.ok && d.src && !['tr', 'en', srcLang].includes(d.src);
    });
    if (names.length) learn(names.map(p => p.latin));
    return CC.replaceWords(translated, names);
  }

  // Language of a single word, for telling names from real words: the on-device detector's top guess
  // (even when unsure, a made-up name lands on some unrelated language), otherwise the network engine.
  async function detectWord(word) {
    const local = await detectLocal(word);
    if (local && local[0] && local[0].detectedLanguage !== 'und') return { ok: true, src: local[0].detectedLanguage.split('-')[0] };
    return translateNetwork(word, 'en');
  }

  function learn(words) {
    const known = new Set(learnedNames.map(w => w.toLowerCase()));
    const fresh = words.filter(w => !known.has(w.toLowerCase()));
    if (!fresh.length) return;
    learnedNames = [...learnedNames, ...fresh];
    try { chrome.storage.local.set({ learnedNames }); } catch (_) { /* extension was reloaded */ }
  }

  // ---------------- Field adapters ----------------
  // (a) textarea / input: native value setter + input event (React boxes see it too).
  // (b) contenteditable: reads the text as the user sees it. When writing it selects the field, waits briefly so the
  //     editor picks up the selection, then dispatches a paste event. Editors with their own model (Slate/Discord, Lexical, ProseMirror…)
  //     handle the paste themselves, so their model is updated correctly. If nobody handled it, it's a plain contenteditable
  //     (Telegram): the DOM itself is the text, and execCommand insertText writes it. execCommand is NEVER used on a
  //     model editor: in Chrome it doesn't fire beforeinput, so the DOM looks Russian but the model stays Turkish and Turkish gets sent.

  const valueSetters = {
    TEXTAREA: Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set,
    INPUT: Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set,
  };
  const MODEL_EDITOR_SEL = '[data-slate-editor], [data-lexical-editor], .ProseMirror, .ql-editor, .public-DraftEditor-content, .cm-content, .ck-editor__editable';
  const SELECT_SETTLE_MS = 150;   // Slate picks up the selection via selectionchange with a ~100 ms delay
  const RENDER_WAIT_MS = 400;     // React-based editors update the DOM on the next render

  const wait = ms => new Promise(r => setTimeout(r, ms));

  function selectAll(el) {
    el.focus();
    const doc = el.ownerDocument;
    const range = doc.createRange();
    range.selectNodeContents(el);
    const sel = doc.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  async function settled(el, v) {
    for (let t = 0; t <= RENDER_WAIT_MS; t += 40) {
      if (CC.sameText(CC.editableText(el), v)) return true;
      await wait(40);
    }
    return false;
  }

  function makeAdapter(el) {
    const setter = valueSetters[el.tagName];
    if (setter) {
      return {
        read: () => el.value,
        async write(v) {
          setter.call(el, v);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          try { el.selectionStart = el.selectionEnd = v.length; } catch (_) { /* box without selection support */ }
          return el.value === v;
        },
      };
    }
    return {
      read: () => CC.editableText(el),
      async write(v, valid) {
        selectAll(el);
        await wait(SELECT_SETTLE_MS);
        if (!valid()) return false;   // meanwhile Enter went through or the box was reset
        selectAll(el);
        const dt = new DataTransfer();
        dt.setData('text/plain', v);
        const paste = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
        el.dispatchEvent(paste);
        if (!paste.defaultPrevented) {
          if (el.matches(MODEL_EDITOR_SEL)) return false;   // the model editor didn't take the paste; writing to the DOM by hand is dangerous
          selectAll(el);
          el.ownerDocument.execCommand('insertText', false, v);
        }
        return settled(el, v);
      },
    };
  }

  function describe(el) {
    return {
      tag: el.tagName, type: el.getAttribute('type') || '', editable: el.isContentEditable,
      readOnly: el.readOnly, disabled: el.disabled, autocomplete: el.getAttribute('autocomplete'),
      role: el.getAttribute('role'), inputMode: el.getAttribute('inputmode'), name: el.getAttribute('name'),
      id: el.id, placeholder: el.getAttribute('placeholder') || el.getAttribute('aria-placeholder') || el.getAttribute('data-placeholder'),
      ariaLabel: el.getAttribute('aria-label'), className: typeof el.className === 'string' ? el.className : '',
    };
  }

  // Finds the field to translate from the event's node: a textarea/input or the outermost editable root.
  function fieldFrom(node) {
    let el = node && node.nodeType === 1 ? node : node?.parentElement;
    if (!el) return null;
    if (el.tagName !== 'TEXTAREA' && el.tagName !== 'INPUT') {
      if (!el.isContentEditable) return null;
      while (el.parentElement && el.parentElement.isContentEditable) el = el.parentElement;
    }
    // A page can opt a box out with data-typekiwi="off" on it or an ancestor (e.g. our own site's live demo,
    // which translates by itself and would otherwise be translated twice).
    if (!eligibleCache.has(el)) eligibleCache.set(el, !el.closest('[data-typekiwi="off"]') && CC.isTextField(describe(el)));
    return eligibleCache.get(el) ? el : null;
  }

  // ---------------- Badge ----------------
  // On FunPay it sits in the page flow above the form; on other sites it floats above the box (stays out of the site's DOM tree).

  function makeBadge(st) {
    const b = document.createElement('div');
    b.hidden = true;
    b.title = 'Click or Esc: turn translation off/on for this message';
    b.addEventListener('mousedown', e => { e.preventDefault(); togglePause(st); });
    const fpAnchor = IS_FUNPAY && st.el.matches(FP_INPUT_SEL)
      ? (st.el.closest('form') || st.el.closest('.chat-form-input') || st.el.parentElement) : null;
    if (fpAnchor?.parentElement) {
      fpAnchor.parentElement.insertBefore(b, fpAnchor);
    } else {
      st.floating = true;
      (document.body || document.documentElement).appendChild(b);
    }
    return b;
  }

  function badge(st, text, kind, why) {
    st.badgeText = text;
    st.badge.textContent = text;
    st.badge.title = why || 'Click or Esc: turn translation off/on for this message';
    st.badge.className = 'cc-badge' + (st.floating ? ' cc-float' : '') + (kind ? ' cc-' + kind : '');
    place(st);
  }

  // Page content sits under the floating badge; to stay readable it takes the background color of the box (or its first opaque ancestor).
  function opaqueBg(el) {
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const m = getComputedStyle(n).backgroundColor.match(/rgba?\(([^)]+)\)/);
      if (!m) continue;
      const alpha = m[1].split(/[,/\s]+/).filter(Boolean)[3];
      if (alpha === undefined || parseFloat(alpha) > 0.5) return getComputedStyle(n).backgroundColor;
    }
    return matchMedia('(prefers-color-scheme: dark)').matches ? '#1e1f22' : '#ffffff';
  }

  function place(st) {
    const b = st.badge;
    if (!st.floating) { b.hidden = !st.badgeText; return; }
    const show = !!st.badgeText && st.focused && st.el.isConnected;
    b.hidden = !show;
    if (!show) return;
    const r = st.el.getBoundingClientRect();
    const box = (st.el.closest('form') || st.el.parentElement || st.el).getBoundingClientRect();
    const left = Math.max(4, Math.min(box.left, r.left));
    const width = Math.max(220, Math.min(Math.max(box.width, r.width), innerWidth - left - 8));
    b.style.left = left + 'px';
    b.style.width = width + 'px';
    b.style.color = getComputedStyle(st.el).color;
    b.style.backgroundColor = opaqueBg(st.el);
    if (r.top > 90) { b.style.top = ''; b.style.bottom = (innerHeight - r.top + 6) + 'px'; }
    else { b.style.bottom = ''; b.style.top = (r.bottom + 6) + 'px'; }
  }

  let placeQueued = false;
  function placeAll() {
    if (placeQueued || !live.size) return;
    placeQueued = true;
    requestAnimationFrame(() => { placeQueued = false; for (const st of live) if (st.floating) place(st); });
  }

  // ---------------- Outgoing message ----------------

  function ensure(el) {
    let st = states.get(el);
    if (st) return st;
    st = { el, adapter: makeAdapter(el), source: '', lastApplied: '', srcLang: '', timer: null, seq: 0,
      inflight: false, paused: false, sendAfter: false, writing: false, floating: false, badgeText: '', failedText: '', blockedText: null, lastInputAt: 0,
      focused: el.contains(document.activeElement), mode: IS_FUNPAY && el.closest('form') ? 'form' : 'enter' };
    st.badge = makeBadge(st);
    // Editable editors (Slate) often render the DOM on the next frame without firing an input event: watch the DOM for changes.
    if (!valueSetters[el.tagName]) {
      st.observer = new MutationObserver(() => onInput(st));
      st.observer.observe(el, { childList: true, subtree: true, characterData: true });
    }
    states.set(el, st);
    for (const old of live) {
      if (old.el.isConnected) continue;
      old.observer?.disconnect();
      clearTimeout(old.timer);
      old.badge.remove();
      live.delete(old);
    }
    live.add(st);
    return st;
  }

  const read = st => st.adapter.read();
  // While writing, the box passes through intermediate states (empty, partial); changes during that time are ours and don't count.
  async function setText(st, value) {
    st.writing = true;
    const seq = st.seq;
    try { return await st.adapter.write(value, () => st.seq === seq); } finally { st.writing = false; }
  }

  function resetState(st) {
    clearTimeout(st.timer);
    st.timer = null;
    st.source = '';
    st.lastApplied = '';
    st.srcLang = '';
    st.paused = false;
    st.sendAfter = false;
    st.seq++;
    st.inflight = false;
    st.failedText = '';
    st.blockedText = null;
    badge(st, '');
  }

  function showSource(st) {
    if (!st.source.trim()) return badge(st, '');
    const lang = (st.srcLang || 'source').toUpperCase();
    badge(st, lang + ': ' + st.source, 'ok');
  }

  function onInput(st) {
    if (st.writing) return;
    st.lastInputAt = Date.now();
    if (!read(st).trim()) { resetState(st); return; }
    if (st.paused || !active()) return;
    clearTimeout(st.timer);
    st.timer = setTimeout(() => { st.timer = null; run(st); }, st.sendAfter ? ENTER_SETTLE_MS : IDLE_MS);
  }

  function needsWork(st) {
    if (st.timer || st.inflight) return true;
    return CC.nextSource({ field: read(st), lastApplied: st.lastApplied, source: st.source }).changed;
  }

  async function run(st) {
    const field = read(st);
    const next = CC.nextSource({ field, lastApplied: st.lastApplied, source: st.source });
    if (!next.changed) { if (st.sendAfter) send(st); return; }
    if (!next.source.trim()) { resetState(st); return; }

    const seq = ++st.seq;
    st.inflight = true;
    badge(st, st.sendAfter ? 'Translating — Enter: send as is' : 'Translating…', 'busy');
    // A message that is only chat shorthand ("tşk", "eyv knk", "ty") gets the other language's shorthand ("спс бро"),
    // not a translator's long form; everything else: what the other side reads, best quality.
    const short = CC.shortReply(next.source, settings.readLang, settings.targetLang);
    const res = short ? { ok: true, src: short.src, text: short.text, engine: 'shorthand' }
      : await translateProtected(next.source, settings.targetLang, 'network', chatContext(null));
    if (seq !== st.seq) return;          // a newer translation has started
    if (read(st) !== field) { st.inflight = false; return; } // user kept typing meanwhile; the timer will run again

    if (!res.ok) {
      // Let the user send the message anyway: Enter pressed without changing the box hands the text to the site as is.
      st.inflight = false;
      st.failedText = field;
      if (res.error === 'pack') badge(st, `Getting the ${res.pack} language pack — Enter: send as is`, 'busy', reason('pack'));
      else badge(st, 'Not translated — Enter: send as is', 'err', reason(res.error));
      st.sendAfter = false;
      return;
    }
    if (res.src === settings.targetLang) {
      st.lastApplied = field;            // already in the target language, leave the box alone
    } else {
      const ok = await setText(st, res.text);
      if (seq !== st.seq) return;
      if (!ok) {
        // We don't send on our own; if the user sees the box and presses Enter, whatever is in it gets sent.
        st.inflight = false;
        st.source = '';
        st.lastApplied = '';
        st.failedText = read(st);
        badge(st, 'Couldn\'t write to the box — Enter: send as is', 'err',
          'The site didn\'t accept the translation or reformatted it; Enter sends whatever you see in the box.');
        st.sendAfter = false;
        return;
      }
      st.lastApplied = read(st);
    }
    st.inflight = false;
    st.source = next.source;
    st.srcLang = res.src;
    showSource(st);
    if (st.sendAfter) send(st);
  }

  function enterEvent(type) {
    const ev = new KeyboardEvent(type, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true, composed: true });
    // Older editors look at keyCode/which; the constructor doesn't always set them.
    for (const k of ['keyCode', 'which']) if (ev[k] !== 13) Object.defineProperty(ev, k, { get: () => 13 });
    return ev;
  }

  async function send(st) {
    st.sendAfter = false;
    if (st.mode === 'form') {
      const form = st.el.closest('form');
      // Query one at a time: a selector list returns the first match in document order, which is the image upload button.
      const btn = form?.querySelector('button[type="submit"]') || form?.querySelector('input[type="submit"]');
      resetState(st);
      if (btn) btn.click();
      else form?.requestSubmit();
      return;
    }
    // Let the site's own Enter handler send it; if the box emptied, it was sent.
    const before = read(st);
    synthetic = true;
    try {
      st.el.focus();
      for (const type of ['keydown', 'keypress', 'keyup']) st.el.dispatchEvent(enterEvent(type));
    } finally {
      synthetic = false;
    }
    const seq = st.seq;
    await wait(SENT_CHECK_MS);
    if (seq !== st.seq) return;
    const now = read(st);
    if (!now.trim()) { resetState(st); return; }
    if (now !== before) st.lastApplied = now; // if the site turned Enter into a line break
    badge(st, 'Translated — Enter: send', 'ok', 'The site didn\'t send on our Enter; press Enter once more.');
  }

  async function togglePause(st) {
    if (!st.source.trim() && !st.paused && !st.badgeText) return;
    if (st.paused) {
      st.paused = false;
      st.source = '';
      st.lastApplied = '';   // treat the whole text in the box as the original again
      run(st);
      return;
    }
    st.seq++;
    st.inflight = false;
    st.sendAfter = false;
    clearTimeout(st.timer);
    st.timer = null;
    st.paused = true;
    const original = st.source || read(st);
    if (original !== read(st)) await setText(st, original);
    st.lastApplied = read(st);
    badge(st, 'Translation off — Esc: turn on', 'off');
  }

  function onKeyDown(st, e) {
    if (e.key === 'Escape' && (st.source.trim() || st.paused || st.badgeText)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      togglePause(st);
      return;
    }
    if (!isSendEnter(e)) return;
    if (!active() || st.paused) { resetState(st); return; }
    // A model editor (Slate) renders the latest change on the next frame: if it just changed, don't trust the DOM, wait.
    const justChanged = !valueSetters[st.el.tagName] && Date.now() - st.lastInputAt < RECENT_INPUT_MS;
    if (!justChanged) {
      if (st.failedText && read(st) === st.failedText) { resetState(st); return; } // deliberate, after the "not translated" warning
      if (!read(st).trim() || !needsWork(st)) { resetState(st); return; } // let the site send normally
    }
    e.preventDefault();
    e.stopImmediatePropagation();
    block(st);
    st.sendAfter = true;
    clearTimeout(st.timer);
    st.timer = null;
    if (st.inflight) { badge(st, 'Translating — Enter: send as is', 'busy'); return; } // sends by itself when done
    // A model editor (Slate) renders the last keystroke on the next frame; reading right away would translate partial text
    // and send the trailing Turkish fragment. Wait briefly (needsWork stays true while the timer is pending).
    st.timer = setTimeout(() => { st.timer = null; run(st); }, ENTER_SETTLE_MS);
  }

  const isSendEnter = e => e.key === 'Enter' && !e.shiftKey && !e.isComposing;

  // What the box held when we blocked Enter: if the user presses again without changing the box, Enter goes to the site.
  function block(st) {
    if (st.blockedText === null) st.blockedText = read(st);
  }

  // Second Enter: if the box still holds what it had when we blocked, or the translation we wrote (the user
  // didn't change it), any ongoing translation/write is dropped; whatever is in the box at that moment gets sent.
  function isSecondEnter(st) {
    if (st.blockedText === null) return false;
    const now = read(st);
    return now === st.blockedText || (!!st.lastApplied && now === st.lastApplied);
  }

  // Listened on window in the capture phase: ours runs before the site's own Enter handler.
  const pathTarget = e => (e.composedPath ? e.composedPath()[0] : e.target);

  window.addEventListener('input', e => {
    if (!active()) return;
    const el = fieldFrom(pathTarget(e));
    if (el) onInput(ensure(el));
  }, true);

  window.addEventListener('focusin', e => {
    if (!active()) return;
    const el = fieldFrom(pathTarget(e));
    if (el) { ensure(el); prefetchPairs(); }
  }, true);

  window.addEventListener('pointerdown', e => { if (e.isTrusted && pendingPairs.size) downloadPending(); }, true);

  window.addEventListener('keydown', e => {
    if (e.isTrusted && pendingPairs.size) downloadPending();
    if (synthetic || !e.isTrusted || !alive()) return;
    const el = fieldFrom(pathTarget(e));
    const st = el && states.get(el);
    if (!st) return;
    if (isSendEnter(e) && isSecondEnter(st)) { resetState(st); return; } // hand it to the site
    if (st.writing) {
      // While the translation is being written the whole box is selected: a keypress would wipe the text. Swallow it; apply Enter once writing is done.
      e.preventDefault();
      e.stopImmediatePropagation();
      if (isSendEnter(e)) { block(st); st.sendAfter = true; }
      return;
    }
    onKeyDown(st, e);
  }, true);

  for (const [type, focused] of [['focusin', true], ['focusout', false]]) {
    window.addEventListener(type, e => {
      const el = fieldFrom(pathTarget(e));
      const st = el && states.get(el);
      if (st) { st.focused = focused; place(st); }
    }, true);
  }

  window.addEventListener('scroll', placeAll, true);
  window.addEventListener('resize', placeAll);

  // ---------------- Incoming message ----------------
  // Site adapters: find the message nodes, message id, text element, and own/system messages.
  // Selectors verified on the real pages (17.10.2026).
  // FunPay: the last 15 messages right when the chat opens, older ones once visible. Discord/Telegram: visible messages only
  // (server channels carry a lot of traffic). Translations are cached by message id + text: even if virtual scrolling
  // re-renders the node the request isn't repeated; if a message is edited the old translation is removed and a new one comes.

  function selfId() {
    try { return String(JSON.parse(document.body.dataset.appData || '{}').userId || ''); } catch (_) { return ''; }
  }

  function authorId(item) {
    // A message without a header belongs to the author of the first headed message above it.
    // If the header has no link (FunPay notification) the author counts as "system".
    for (let el = item; el; el = el.previousElementSibling) {
      if (!el.classList?.contains('chat-msg-with-head')) continue;
      const m = el.querySelector('.chat-msg-author-link')?.getAttribute('href')?.match(/\/users\/(\d+)/);
      return m ? m[1] : 'system';
    }
    return '';
  }

  const SITE = CC.incomingSite(location.hostname, location.pathname) || (IS_FUNPAY ? 'funpay' : null);
  const MAX_PARALLEL = 2;
  const MAX_BACKLOG = 15;
  const MAX_CACHE = 1000;
  const MAX_RETRIES = 2;
  const SHORT_INCOMING = 30;   // characters
  const RETRY_MS = 30000;
  const failedTries = new WeakMap();  // message node -> failed attempts
  // Skipped when reading text: time, the "edited" marker, reactions, our own translation.
  const TEXT_SKIP = '.cc-incoming, time, .time, .MessageMeta, .clearfix, [class*="timestamp"], [class*="edited"], .reactions, .Reactions';

  // My own id on Discord: from the avatar URL in the user panel at the bottom left.
  const discordSelf = () => (document.querySelector('[class*="panels"] img[class*="avatar"]:not([class*="Decoration"])')
    ?.src.match(/\/avatars\/(\d+)\//) || [])[1] || '';
  function discordAuthor(li) {
    // A continuation message has no avatar: the author is that of the first group-start message above it.
    for (let el = li; el; el = el.previousElementSibling) {
      if (el.tagName !== 'LI' || !el.firstElementChild?.className.includes('groupStart')) continue;
      return (el.querySelector('img[class*="avatar"]')?.src.match(/\/avatars\/(\d+)\//) || [])[1] || '';
    }
    return '';
  }

  const ADAPTERS = {
    funpay: {
      chat: () => location.pathname + location.search,
      items: () => document.querySelectorAll(MSG_SEL),
      id: item => item.id || '',
      textEl: item => item.querySelector('.chat-msg-text'),
      skip: item => { const me = selfId(); return !!me && authorId(item) === me; },
      eager: true,
    },
    discord: {
      chat: () => location.pathname,
      items: () => document.querySelectorAll('li[id^="chat-messages-"]'),
      id: li => li.id.split('-').pop(),
      // A reply also contains the quoted content; the actual content is selected by id.
      textEl: li => li.querySelector('#message-content-' + CSS.escape(li.id.split('-').pop())),
      skip: li => { const me = discordSelf(); return !!me && discordAuthor(li) === me; },
    },
    'tg-k': {
      chat: () => location.hash,
      items: () => document.querySelectorAll('.bubble[data-mid]'),
      id: b => b.dataset.mid,
      textEl: b => b.querySelector('.message'),
      skip: b => b.classList.contains('is-out') || b.classList.contains('service'),
    },
    'tg-a': {
      chat: () => location.hash,
      items: () => document.querySelectorAll('.Message[id^="message-"]'),
      id: m => m.id.slice(8),
      textEl: m => [...m.querySelectorAll('.text-content')].find(t => !t.closest('.EmbeddedMessage')) || null,
      skip: m => m.classList.contains('own'),
    },
  };
  const adapter = SITE && ADAPTERS[SITE];

  function textOf(el) {
    let out = '';
    (function walk(node) {
      for (const n of node.childNodes) {
        if (n.nodeType === 3) out += n.nodeValue;
        else if (n.nodeType === 1) {
          if (n.matches(TEXT_SKIP)) continue;
          if (n.tagName === 'BR') out += '\n';
          else if (n.tagName === 'IMG') out += n.getAttribute('alt') || '';
          else walk(n);
        }
      }
    })(el);
    return out.replace(/\s+/g, ' ').trim();
  }

  const queue = [];
  let activeJobs = 0;
  let chatKey = '';
  const cache = new Map();   // chat + id + text → translation (null: nothing to translate)
  const watched = new WeakSet();

  const cacheKey = (id, text) => chatKey + '\n' + id + '\n' + text;

  function render(item, textEl, text, translated) {
    item.querySelectorAll(':scope .cc-incoming').forEach(l => l.remove());
    item.dataset.ccText = text;
    if (!translated) return;
    const line = document.createElement('div');
    line.className = 'cc-incoming';
    const tag = document.createElement('span');
    tag.className = 'cc-tag';
    tag.title = settings.readLang.toUpperCase();
    const flag = flagElement(settings.readLang);
    if (flag) tag.append(flag);
    else tag.textContent = settings.readLang.toUpperCase();
    const body = document.createTextNode(' ' + translated);
    line.append(tag, body);
    line.title = 'Click for a better translation';
    line.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); improve(line, body, text, item); });
    textEl.after(line);
  }

  // A reader who finds an incoming translation odd clicks it: ask Google (the on-device model is weaker on short,
  // casual lines). Only on request, so incoming messages don't burn the online engines' limits.
  async function improve(line, body, text, item) {
    if (line.dataset.ccBusy || line.dataset.ccImproved) return;
    line.dataset.ccBusy = '1';
    line.classList.add('cc-improving');
    const res = await translateProtected(text, settings.readLang, 'networkOnly', chatContext(item));
    delete line.dataset.ccBusy;
    line.classList.remove('cc-improving');
    if (res.ok && res.src !== settings.readLang && res.text.trim()) {
      body.nodeValue = ' ' + res.text;
      line.dataset.ccImproved = '1';
      line.title = 'Translated online for better quality';
      for (const [k] of cache) if (k.endsWith('\n' + text)) cache.set(k, res.text);
    } else {
      line.title = 'The online translator is busy right now; try again in a few minutes';
    }
  }

  // Earlier lines of this chat, sent along for meaning only: up to 4 before `item`, or the last 4 when item is null
  // (what the user is typing answers those). Only on the chat sites TypeKiwi knows.
  function chatContext(item) {
    if (!adapter) return undefined;
    const all = [...adapter.items()];
    const end = item ? all.indexOf(item) : all.length;
    const out = [];
    for (let i = end - 1; i >= 0 && out.length < 4; i--) {
      const el = adapter.textEl(all[i]);
      const text = el ? textOf(el) : '';
      if (text) out.unshift({ me: !!adapter.skip(all[i]), text });
    }
    return out;
  }

  // Flag of the reading language (SVG from flags.js). Windows doesn't render flag emoji (shows the letters "TR").
  // The SVG is built element by element, without innerHTML, so sites' HTML injection restrictions (Trusted Types) don't block it.
  const SVG_NS = 'http://www.w3.org/2000/svg';
  function flagElement(code) {
    if (!CC.flagSvg) return null;
    const markup = CC.flagSvg(code);
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 30 20');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'width:16px;height:11px;vertical-align:-1px;border-radius:2px;display:inline-block';
    for (const [, name, attrs] of markup.replace(/^<svg[^>]*>|<\/svg>$/g, '').matchAll(/<(\w+)([^>]*?)\/?>/g)) {
      const el = document.createElementNS(SVG_NS, name);
      for (const [, k, v] of attrs.matchAll(/([\w:-]+)="([^"]*)"/g)) el.setAttribute(k, v);
      svg.append(el);
    }
    return svg;
  }

  // Current state of the node: null if there's no text to translate.
  function inspect(item) {
    const textEl = adapter.textEl(item);
    if (!textEl || adapter.skip(item)) return null;
    const text = textOf(textEl);
    if (!text || !/\p{L}{2,}/u.test(text)) return null;
    return { item, textEl, text, id: String(adapter.id(item)) };
  }

  function scanMessages() {
    if (!adapter || !document.body) return;
    if (!settings.incoming || !alive() || CC.isSiteOff(location.hostname, settings.offSites)) return;
    const key = adapter.chat();
    if (key !== chatKey) { chatKey = key; queue.length = 0; }   // chat changed: the old queue shouldn't send wasted requests
    const fresh = [];
    [...adapter.items()].forEach(item => {
      const m = inspect(item);
      if (!m) { if (item.dataset.ccText) render(item, null, '', null); return; }
      if (item.dataset.ccText === m.text) return;            // this text was already handled
      const k = cacheKey(m.id, m.text);
      if (cache.has(k)) { render(item, m.textEl, m.text, cache.get(k)); return; }
      if (item.dataset.ccText) render(item, m.textEl, m.text, null); // edited: drop the old translation
      fresh.push(m);
    });
    // FunPay: the last 15 right away; other sites and older messages only once visible.
    const now = adapter.eager ? fresh.slice(-MAX_BACKLOG) : [];
    for (const m of fresh) {
      if (now.includes(m)) enqueue(m);
      else if (!watched.has(m.item)) { watched.add(m.item); visibleObserver.observe(m.item); }
    }
    pump();
  }

  const visibleObserver = new IntersectionObserver(entries => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      visibleObserver.unobserve(en.target);
      watched.delete(en.target);
      const m = settings.incoming && inspect(en.target);
      if (m && en.target.dataset.ccText !== m.text) enqueue(m);
    }
    pump();
  });

  function enqueue(m) {
    // Skip without a request: a message that looks Turkish or a single short Latin word (on Discord "gun", "nova" were taken for English).
    const probe = CC.expandSlang(m.text, settings.targetLang);   // "thx", "idk" are real messages, not stray short words
    const shortLatin = !/[Ѐ-ӿ]/.test(probe) && /^\p{L}{1,4}$/u.test(probe);
    if (settings.readLang === 'tr' && (shortLatin || CC.likelyTurkish(m.text))) {
      cache.set(cacheKey(m.id, m.text), null);
      m.item.dataset.ccText = m.text;
      return;
    }
    if (queue.some(j => j.id === m.id && j.text === m.text)) return;
    m.item.dataset.ccText = m.text;   // don't queue the same text a second time
    queue.push({ ...m, chat: chatKey });
  }

  function pump() {
    while (activeJobs < MAX_PARALLEL && queue.length) {
      const job = queue.shift();
      if (job.chat !== chatKey) continue;
      activeJobs++;
      // Short replies ("ща", "заходи") are where the on-device model is weakest: Google first for those.
      const mode = job.text.length <= SHORT_INCOMING ? 'network' : 'local';
      translateProtected(job.text, settings.readLang, mode, chatContext(job.item)).then(res => {
        activeJobs--;
        const ok = res.ok && res.src !== settings.readLang && res.text.trim() && res.text.trim() !== job.text;
        if (res.ok) {
          if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
          cache.set(job.chat + '\n' + job.id + '\n' + job.text, ok ? res.text : null);
        } else {
          // Failed (engines busy or the language pack not on the device yet): try again after 30 s, then 60 s.
          failedNodes.add(job.item);
          const tries = (failedTries.get(job.item) || 0) + 1;
          failedTries.set(job.item, tries);
          if (tries <= MAX_RETRIES) {
            setTimeout(() => {
              if (job.item.dataset.ccText === job.text) delete job.item.dataset.ccText;
              scanMessages();
            }, RETRY_MS * tries);
          }
        }
        // If the node was re-rendered meanwhile (virtual scrolling) it comes from the cache on the next scan.
        if (ok && job.item.isConnected && job.chat === chatKey && textOf(job.textEl) === job.text) {
          render(job.item, job.textEl, job.text, res.text);
        }
        pump();
      });
    }
  }

  // ---------------- Settings ----------------

  function applySettings() {
    if (!active()) for (const st of live) resetState(st);
    scanMessages();
  }

  if (adapter) {
    let scanTimer;
    new MutationObserver(() => {
      if (scanTimer) return;   // under heavy traffic (Discord) scan at most every 300 ms, not on every change
      scanTimer = setTimeout(() => { scanTimer = null; scanMessages(); }, 300);
    }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  }

  chrome.storage.local.get({ learnedNames: [] }, s => { learnedNames = s.learnedNames || []; });
  chrome.storage.sync.get(DEFAULTS, s => { settings = s; applySettings(); });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.learnedNames) { learnedNames = changes.learnedNames.newValue || []; return; }
    if (area !== 'sync') return;
    for (const [k, v] of Object.entries(changes)) settings[k] = v.newValue;
    applySettings();
  });
})();
