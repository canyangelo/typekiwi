// Which text fields to work in, the site key, and reading an editable's text. Pure functions.
(function (root) {
  const TEXT_TYPES = new Set(['', 'text']);
  const BAD_AUTOCOMPLETE = /\b(username|email|current-password|new-password|one-time-code|cc-[\w-]+|tel[\w-]*|url)\b/i;
  const BAD_INPUTMODE = new Set(['search', 'email', 'tel', 'url', 'numeric', 'decimal']);
  // Search, login, email, password, verification code fields. "ara" only counts as a standalone word (not karakter, paragraf).
  const BAD_HINT = /search|поиск|найти|(^|[^\p{L}])ara([^\p{L}]|$)|e-?mail|e-?posta|почт|passw|şifre|parol|пароль|login|giriş|логин|username|kullanıcı adı|captcha|otp\b|2fa|doğrulama kodu/iu;
  const BAD_NAMES = new Set(['q', 'query', 'search', 's']);

  // info: { tag, type, editable, readOnly, disabled, autocomplete, role, inputMode, name, id, placeholder, ariaLabel, className }
  function isTextField(info) {
    const tag = String(info.tag || '').toLowerCase();
    let ok;
    if (tag === 'textarea') ok = true;
    else if (tag === 'input') ok = TEXT_TYPES.has(String(info.type || '').toLowerCase());
    else ok = !!info.editable;
    if (!ok || info.readOnly || info.disabled) return false;
    if (info.autocomplete && BAD_AUTOCOMPLETE.test(info.autocomplete)) return false;
    if (String(info.role || '').toLowerCase() === 'searchbox') return false;
    if (BAD_INPUTMODE.has(String(info.inputMode || '').toLowerCase())) return false;
    if (BAD_NAMES.has(String(info.name || '').toLowerCase())) return false;
    const hints = [info.name, info.id, info.placeholder, info.ariaLabel, info.className].filter(Boolean).join(' ');
    return !BAD_HINT.test(hints);
  }

  function siteKey(hostname) {
    return String(hostname || '').toLowerCase().replace(/^www\./, '');
  }

  // A disabled site also covers its subdomains (discord.com → ptb.discord.com).
  function isSiteOff(hostname, offList) {
    const host = siteKey(hostname);
    return (offList || []).some(s => {
      const k = siteKey(s);
      return k && (host === k || host.endsWith('.' + k));
    });
  }

  // Which site adapter incoming-message translation runs with.
  function incomingSite(hostname, pathname) {
    const host = siteKey(hostname);
    const path = String(pathname || '');
    if (host === 'funpay.com' || host.endsWith('.funpay.com')) return 'funpay';
    if (host === 'discord.com' || host.endsWith('.discord.com')) return 'discord';
    if (host === 'web.telegram.org') {
      if (path.startsWith('/k')) return 'tg-k';
      if (path.startsWith('/a')) return 'tg-a';
    }
    return null;
  }

  // ---- Chrome's on-device Translator API ----
  // Our language codes (Google style) -> the BCP 47 codes Chrome's Translator expects.
  function chromeLang(code) {
    if (code === 'zh-CN') return 'zh';
    if (code === 'zh-TW') return 'zh-Hant';
    return code;
  }

  const baseLang = code => String(code || '').toLowerCase().split('-')[0];
  function sameLang(a, b) {
    return !!a && baseLang(a) === baseLang(b);
  }

  // Source language for a translation: the detector's top guess when it is confident, otherwise the hint
  // (the language this text is most likely in, e.g. the user's own language for what they type).
  // Short messages ("выдаю?", "спс") often get a neighbouring language on top (be 0.51 / ru 0.45), and that pair
  // isn't on the device. When the hint (the chat's language) is also among the guesses with a fair share of the
  // top score, it wins.
  const MIN_CONFIDENCE = 0.5;
  const HINT_MIN = 0.2;
  function pickSource(detections, hint) {
    const top = detections && detections[0];
    const hinted = hint && (detections || []).find(d => sameLang(d.detectedLanguage, hint));
    if (top && hinted && hinted.confidence >= HINT_MIN && hinted.confidence >= top.confidence * 0.5) return baseLang(hint);
    if (top && top.detectedLanguage !== 'und' && top.confidence >= MIN_CONFIDENCE) return baseLang(top.detectedLanguage);
    return hint || '';
  }

  const BLOCK = new Set(['DIV', 'P', 'LI', 'UL', 'OL', 'BLOCKQUOTE', 'PRE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'SECTION', 'ARTICLE']);

  function normText(s) {
    return String(s).replace(/\r\n?/g, '\n').replace(/ /g, ' ').replace(/[​﻿]/g, '').replace(/\s+$/, '');
  }

  // The text the user sees in a contenteditable root: placeholders (contenteditable=false) are skipped,
  // <br> and blocks become line breaks, emoji images are read via their alt text.
  function editableText(rootNode) {
    let out = '';
    const newline = () => { if (out && !out.endsWith('\n')) out += '\n'; };
    (function walk(node) {
      for (const n of node.childNodes || []) {
        if (n.nodeType === 3) { out += n.nodeValue; continue; }
        if (n.nodeType !== 1) continue;
        if (n.getAttribute('contenteditable') === 'false' || n.getAttribute('data-slate-placeholder') != null) continue;
        const name = n.nodeName;
        if (name === 'BR') { out += '\n'; continue; }
        if (name === 'IMG') { out += n.getAttribute('alt') || ''; continue; }
        if (name === 'STYLE' || name === 'SCRIPT') continue;
        const block = BLOCK.has(name);
        if (block) newline();
        walk(n);
        if (block) newline();
      }
    })(rootNode);
    return normText(out);
  }

  function sameText(a, b) {
    const squash = s => normText(s).replace(/\s+/g, ' ').trim();
    return squash(a) === squash(b);
  }

  const api = { isTextField, siteKey, isSiteOff, incomingSite, chromeLang, sameLang, pickSource, editableText, normText, sameText };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CC = Object.assign(root.CC || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this);
