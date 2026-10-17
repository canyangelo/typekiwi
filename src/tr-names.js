// Finds person names in Turkish text (so they are protected from translation). Pure functions.
// Three ways: a list of common names; context (adım X, X bey/hanım/abi/abla, sayın X); a word with an apostrophe (Necati'ye).
// The list deliberately LEAVES OUT names that are also ordinary words (deniz, umut, barış, metin…): those are found only by context.
(function (root) {
  const NAMES = new Set(`
    abdullah abdulkadir adem adnan ahmet akif alaattin ali alican alper alpay alparslan altan anıl arda arif
    atakan atilla ayhan aykut aytaç bahadır batuhan baran bekir berk berkan berkay berke bilal
    burak burhan bülent caner cavit celal cem cemal cemil cengiz cenk cevat cevdet cihat cüneyt çağatay çağlar
    davut doğukan ebubekir efe emirhan emrah emre emrullah enes ercan erdal erdoğan eren erhan
    erkan erol eray ersin ertan ertuğrul esat eyüp fahri faruk fatih ferhat ferit fevzi fikret fuat furkan
    gökay gökhan gürkan gürsel hakan halil halit hamdi hamza harun hasan haydar hayri hilmi hulusi
    hüsamettin hüseyin hüsnü ibrahim idris ihsan ilhan ilhami ilker ilyas irfan isa ismail kaan kadir kazım
    kemal kenan kerem kerim koray kubilay kutay levent lütfi lütfü macit mahmut mazhar mecit mehmet melih
    metehan mevlüt mithat muammer muhammed muhammet muharrem muhittin murat musa mustafa muzaffer mücahit
    mümin münir naci namık nazım necati necdet necip necmettin necmi nedim nejat nevzat nihat niyazi nuh
    numan nuri nurettin nurullah nusret oğuz oğuzhan okan oktay orçun orhan osman ömer polat rahmi
    ramazan rasim rauf recai recep refik remzi reşat rıdvan rıfat rüstem rüştü sabahattin sabri sadettin
    sadri saffet salih sami sebahattin sedat selahattin selçuk selim semih serdar serkan sertaç sezer sezgin
    sinan soner suat süleyman şaban şakir şefik şemsettin şenol şevket şükrü tahir tahsin talat tamer taner
    tarık taylan tekin tevfik timur tolga tuğrul tuncay tuncer turan turgut utku vahit vedat volkan vural
    yahya yakup yalçın yasin yaşar yılmaz yunus yusuf yücel zekeriya zihni zübeyir
    ayşe ayşegül aysel ayten azra berna betül beyza birsen buse burcu büşra cansu ceren dilara ebru ece eda
    elif emine esma esra fadime fatma feride figen gülay gülşen gülten hacer handan hande hatice havva
    ilayda ilknur kevser kübra leyla melike merve meryem müge nalan nermin nesrin neslihan nihal nilay
    nisa perihan rabia reyhan sevil sevim sibel sinem songül sümeyye şerife şeyma şule tuba tuğba tuğçe
    tülay yeliz zehra zerrin zeynep zübeyde
  `.trim().split(/\s+/));

  const AFTER = new Set(['adım', 'ismim', 'adı', 'ismi', 'adın', 'ismin', 'sayın']);       // the next word is a name
  const BEFORE = new Set(['bey', 'beyle', 'beye', 'beyin', 'hanım', 'hanıma', 'hanımla', 'hanımın',
    'abi', 'abiye', 'abim', 'abla', 'ablaya', 'ablam', 'hoca', 'hocam', 'usta']);          // the previous word is a name
  const NOT_NAME = new Set(['ne', 'nedir', 'neydi', 've', 'bu', 'şu', 'o', 'de', 'da', 'mi', 'mı', 'ile', 'bir', 'benim', 'senin']);

  const lower = w => w.toLocaleLowerCase('tr');
  const EN_CONTRACTION = new Set(['t', 's', 'm', 're', 've', 'll', 'd']);  // no Turkish suffix is spelled like these
  const WORD_RE = /\p{L}+(?:['’]\p{L}+)?/gu;

  function findTurkishNames(text) {
    const words = [...String(text || '').matchAll(WORD_RE)].map(m => m[0]);
    const found = [];
    const seen = new Set();
    const add = w => {
      const k = lower(w);
      if (w.length < 2 || NOT_NAME.has(k) || seen.has(k)) return;
      seen.add(k);
      found.push(w);
    };
    words.forEach((raw, i) => {
      const parts = raw.split(/['’]/);
      const base = parts[0];
      // In Turkish an apostrophe only follows a proper name; English contractions (didn't, it's, we've) are not names.
      if (parts.length > 1) { if (base.length >= 3 && !EN_CONTRACTION.has(lower(parts[1]))) add(base); return; }
      const k = lower(base);
      if (NAMES.has(k)) add(base);
      else if (i > 0 && AFTER.has(lower(words[i - 1]))) add(base);
      else if (i + 1 < words.length && BEFORE.has(lower(words[i + 1]))) add(base);
    });
    // "sayın metin yılmaz": the second word after sayın is a name too (the surname).
    words.forEach((w, i) => { if (i > 1 && lower(words[i - 2]) === 'sayın' && !BEFORE.has(lower(w))) add(w.split(/['’]/)[0]); });
    return found;
  }

  // Capitalizes names that stayed Latin in the translation (necati → Necati).
  function capitalizeNames(text, names) {
    let out = String(text);
    for (const n of names || []) {
      const cap = n.charAt(0).toLocaleUpperCase('tr') + n.slice(1);
      const esc = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      out = out.replace(new RegExp('(?<!\\p{L})' + esc + '(?!\\p{L})', 'gu'), cap);
    }
    return out;
  }

  // When the reading language is Turkish, send no request to the translation service for incoming messages that look Turkish
  // (so Turkish Discord servers don't burn the request budget). Crude but cheap: a ğ/ş/ı letter, a common word, or a verb suffix.
  const COMMON_TR = new Set(('ben sen biz siz bi bir ve bu şu ne mi mı mu mü abi abla kanka kardeş selam naber hadi ' +
    'evet hayır tamam yok var gel git için ama çok daha hep orda burda şimdi sonra nasıl neden niye olur olmaz değil ' +
    'de da ki gibi kadar ile misin mısın musun iyi güzel sağol eyv aynen lan oğlum yani bence galiba belki hemen artık').split(' '));
  const TR_SUFFIX = /(iyor|ıyor|uyor|üyor)(um|sun|uz|sunuz|lar)?$|(acak|ecek)(sın|sin|ım|im|ız|iz)?$|(ıcam|icem|ucam|ücem|cem|cam)$|(dım|dim|dum|düm|tım|tim|tum|tüm)$/;

  function likelyTurkish(text) {
    const t = String(text || '');
    if (/[Ѐ-ӿ]/.test(t)) return false;
    if (/[ğşıİĞŞ]/.test(t)) return true;
    return (t.toLocaleLowerCase('tr').match(/\p{L}+/gu) || []).some(w => COMMON_TR.has(w) || (w.length > 4 && TR_SUFFIX.test(w)));
  }

  const api = { findTurkishNames, capitalizeNames, likelyTurkish };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CC = Object.assign(root.CC || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this);
