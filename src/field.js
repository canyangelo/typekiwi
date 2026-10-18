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
  //
  // Cyrillic languages are also told apart by their letters, which beats the detector on short chat lines:
  // "Еще раз простите за долгое ожидание" was taken for Ukrainian ("прості" = simple) and came out as
  // "Here are the simple ones for the longest". Ukrainian always has і/ї/є/ґ somewhere in a sentence, Russian never.
  const CYRILLIC_LANGS = new Set(['ru', 'uk', 'be', 'bg', 'sr', 'mk', 'kk', 'ky', 'tg', 'mn']);
  // Everyday Ukrainian words without і/ї/є/ґ that Russian doesn't have.
  const UK_WORDS = new Set(['дякую', 'дяк', 'що', 'добре', 'ласка', 'зараз', 'чому', 'якщо', 'вже', 'дуже', 'гаразд',
    'чекаю', 'бажаю', 'звичайно', 'тобто', 'ще', 'немає', 'вибач', 'вибачте', 'перепрошую', 'хлопці']);   // not "шо", "нема", "будь", "прошу": Russian chat uses them too
  function letterRule(text) {
    const t = String(text || '').toLowerCase().replace(/https?:\/\/\S+/g, '');
    const cyr = (t.match(/[Ѐ-ӿ]/g) || []).length;
    const lat = (t.match(/[a-z]/g) || []).length;
    if (cyr < 2 || cyr < lat) return null;          // mostly Latin (a name, a link): no rule
    const has = re => re.test(t);
    if (has(/[әғқңөұүһ]/)) return { only: 'kk' };
    if (has(/[ђјљњћџ]/)) return { only: 'sr' };
    if (has(/[ѓќѕ]/)) return { only: 'mk' };
    if (has(/ў/)) return { only: 'be' };
    if (has(/[їєґ]/)) return { only: 'uk' };
    const words = t.match(/[Ѐ-ӿ]+/g) || [];
    if (words.some(w => UK_WORDS.has(w))) return { only: 'uk' };
    const not = new Set();
    if (has(/і/)) not.add('ru');
    // A short Ukrainian line can lack і ("Дякую, все добре"); from four words on it practically never does.
    else if (words.length >= 4 || has(/[ыэёъ]/)) { not.add('uk'); not.add('be'); }
    if (has(/[ыэё]/)) { not.add('uk'); not.add('bg'); not.add('sr'); not.add('mk'); }
    return { not };
  }

  function pickSource(detections, hint, text) {
    const rule = letterRule(text);
    if (rule && rule.only) return rule.only;
    if (rule) {
      detections = (detections || []).filter(d => !rule.not.has(baseLang(d.detectedLanguage)));
      const hintOk = !!hint && CYRILLIC_LANGS.has(baseLang(hint)) && !rule.not.has(baseLang(hint));
      if (!detections.length || !CYRILLIC_LANGS.has(baseLang(detections[0].detectedLanguage))) {
        // The detector's guesses are ruled out by the letters (or aren't Cyrillic at all): the chat's language if it
        // fits, otherwise Russian, by far the most common Cyrillic chat language.
        return hintOk ? baseLang(hint) : (rule.not.has('ru') ? 'uk' : 'ru');
      }
      // Text this Cyrillic is never the non-Cyrillic hint: the best remaining Cyrillic guess, or the hint among them.
      const hinted = hintOk && detections.find(d => sameLang(d.detectedLanguage, hint));
      return baseLang((hinted && hinted.confidence >= detections[0].confidence * 0.5 ? hinted : detections[0]).detectedLanguage);
    }
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
