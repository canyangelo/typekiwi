// Finds proper names that Google wrote in Cyrillic letters (Корьянжело ← koryangelo).
// Transliterates the word back to Latin and checks its phonetic similarity to words in the source text.
(function (root) {
  const CYR = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'j', з: 'z', и: 'i', й: 'i',
    к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
    х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'i', ь: '', э: 'e', ю: 'iu', я: 'ia',
    і: 'i', ї: 'i', є: 'e', ґ: 'g',
  };
  const MIN_LEN = 4;
  const MIN_SIM = 0.7;

  function skeletonCyr(word) {
    return [...word.toLowerCase()].map(ch => CYR[ch] ?? ch).join('')
      .replace(/dj/g, 'j').replace(/(.)\1+/g, '$1');
  }

  function skeletonLat(word) {
    return word.toLocaleLowerCase('tr')
      .replace(/ç/g, 'ch').replace(/ş/g, 'sh').replace(/ğ/g, '').replace(/ı/g, 'i')
      .replace(/ö/g, 'o').replace(/ü/g, 'u')
      .replace(/g(?=[ei])/g, 'j').replace(/[cq]/g, 'k').replace(/w/g, 'v').replace(/x/g, 'ks').replace(/y/g, 'i')
      .replace(/(.)\1+/g, '$1');
  }

  function levenshtein(a, b) {
    const row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let prev = row[0];
      row[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const tmp = row[j];
        row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = tmp;
      }
    }
    return row[b.length];
  }

  function similarity(a, b) {
    if (!a || !b) return 0;
    return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
  }

  // The garbled form a source Latin word takes in the translation: in Cyrillic (Корьянжело) or
  // misspelled Latin (Koryagelo). Returned pair: { latin, word, cyrillic }.
  function findTransliterated(source, translated) {
    const latins = [...source.matchAll(/[A-Za-zÇĞİÖŞÜçğıöşü]+(?:['’][\p{L}]+)?/gu)]
      .map(m => m[0].split(/['’]/)[0])
      .filter(w => w.length >= MIN_LEN && !translated.toLowerCase().includes(w.toLowerCase()));
    const srcLower = source.toLocaleLowerCase('tr');
    const candidates = [
      ...[...new Set(translated.match(/[Ѐ-ӿ]{3,}/g) || [])].map(w => ({ word: w, cyrillic: true, sk: skeletonCyr(w) })),
      ...[...new Set(translated.match(/[A-Za-z]{3,}/g) || [])]
        .filter(w => !srcLower.includes(w.toLowerCase()))
        .map(w => ({ word: w, cyrillic: false, sk: skeletonLat(w) })),
    ];
    const pairs = [];
    const seen = new Set();
    for (const latin of latins) {
      if (seen.has(latin.toLowerCase())) continue;
      const lat = skeletonLat(latin);
      let best = null;
      let bestSim = 0;
      for (const c of candidates) {
        // Also try forms with the last 1-2 letters trimmed, for Russian case endings.
        const sim = Math.max(similarity(lat, c.sk), similarity(lat, c.sk.slice(0, -1)), similarity(lat, c.sk.slice(0, -2)));
        if (sim > bestSim) { bestSim = sim; best = c; }
      }
      if (best && bestSim >= MIN_SIM) {
        seen.add(latin.toLowerCase());
        pairs.push({ latin, word: best.word, cyrillic: best.cyrillic });
      }
    }
    return pairs;
  }

  function replaceWords(text, pairs) {
    let out = text;
    for (const { latin, word } of pairs) {
      out = out.replace(new RegExp('(?<![\\p{L}])' + word + '(?![\\p{L}])', 'gu'), () => latin);
    }
    return out;
  }

  const api = { findTransliterated, replaceWords, similarity, skeletonCyr, skeletonLat };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CC = Object.assign(root.CC || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this);
