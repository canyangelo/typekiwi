// Rejects a translation that came back in the wrong language.
// MyMemory sometimes answers in English whatever the target is ("очко ставлю" → "point I bet" for ru|tr).
// Non-Latin targets must contain their own script; Turkic targets must not read as English.
(function (root) {
  const SCRIPT = {
    ru: /[Ѐ-ӿ]/, uk: /[Ѐ-ӿ]/, kk: /[Ѐ-ӿ]/, be: /[Ѐ-ӿ]/,
    bg: /[Ѐ-ӿ]/, sr: /[Ѐ-ӿ]/, mk: /[Ѐ-ӿ]/, ky: /[Ѐ-ӿ]/,
    ar: /[؀-ۿ]/, fa: /[؀-ۿ]/, 'zh-CN': /[一-鿿]/, zh: /[一-鿿]/,
    ja: /[぀-ヿ一-鿿]/, ko: /[가-힯]/,
  };
  const TURKIC = new Set(['tr', 'az']);
  const TURKIC_LETTERS = /[çğıöşüəÇĞİÖŞÜƏ]/;
  const ENGLISH = new Set(('i you he she we they it me my your our their the a an is are was were be been am ' +
    'to of and or but for with in at by from this that these those what when where why how who ' +
    'please thanks thank bet will would can could do does did not no yes have has had get got just').split(' '));

  function wrongLanguage(text, tl) {
    const letters = text.replace(/[^\p{L}\s]/gu, ' ');
    const words = letters.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) return false;

    const script = SCRIPT[tl];
    if (script) {
      // Only a name or a handle (one Latin word): nothing to judge.
      if (words.length < 2) return false;
      return !script.test(text);
    }
    if (TURKIC.has(tl)) {
      if (TURKIC_LETTERS.test(text) || words.length < 2) return false;
      const english = words.filter(w => ENGLISH.has(w)).length;
      return english >= 2 || english / words.length >= 0.5;
    }
    return false;
  }

  const api = { wrongLanguage };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CC = Object.assign(root.CC || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this);
