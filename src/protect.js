// Protects proper names from translation: replaces them with an __N__ placeholder before translating,
// and puts the original Latin form back afterwards.
(function (root) {
  const TOKEN_RE = /https?:\/\/[^\s]+|[\p{L}\p{N}_@.+\-]+(?:['’][\p{L}]+)?/gu;

  function shouldProtect(base, keep) {
    if (/^https?:\/\//i.test(base)) return true;
    if (keep.has(base.toLowerCase()) || keep.has(base.toLocaleLowerCase('tr'))) return true;
    if (/^[^@\s]+@[^@\s]+\.\p{L}{2,}$/u.test(base)) return true;       // email
    if (/^[\p{L}\d-]+\.[a-z]{2,}$/iu.test(base)) return true;           // domain name
    if (base.startsWith('@') || base.includes('_')) return true;
    if (/\p{L}/u.test(base) && /\d/.test(base)) return true;            // abc9, MM2
    if (/\p{Ll}/u.test(base) && /\p{Lu}/u.test(base.slice(1))) return true; // KorYangelo
    return false;
  }

  function protect(text, keepList) {
    const keep = new Set((keepList || []).map(w => String(w).trim().toLowerCase()).filter(Boolean));
    const parts = [];
    const out = text.replace(TOKEN_RE, (match) => {
      if (/^https?:\/\//i.test(match)) {
        const url = match.replace(/[.,!?)]+$/, '');
        parts.push(url);
        return '__' + (parts.length - 1) + '__' + match.slice(url.length);
      }
      const core = match.replace(/[.\-+]+$/, '');
      const trailing = match.slice(core.length);
      const m = core.match(/^(.+?)['’](\p{L}+)$/u);
      const base = m ? m[1] : core;
      if (!base || !shouldProtect(base, keep)) return match;
      parts.push(base);
      return '__' + (parts.length - 1) + '__' + trailing; // the Turkish suffix after the apostrophe is dropped
    });
    return { text: out, parts };
  }

  function restore(translated, parts) {
    let out = translated;
    const missing = [];
    parts.forEach((part, i) => {
      const re = new RegExp('_\\s*_\\s*' + i + '\\s*_\\s*_');
      if (re.test(out)) out = out.replace(re, () => part);
      else missing.push(part);
    });
    if (missing.length) {
      if (typeof console !== 'undefined') console.warn('[typekiwi] placeholder lost:', missing);
      out = out.replace(/\s+$/, '') + ' ' + missing.join(' ');
    }
    return out;
  }

  const api = { protect, restore };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CC = Object.assign(root.CC || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this);
