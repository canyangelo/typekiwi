// Chat shorthand answered with the other language's shorthand: "tşk" to a Russian becomes "спс", "eyv knk" becomes
// "спс бро", "ty" to a German becomes "danke". A translator would write the long form ("спасибо", "thank you") or get
// it wrong, and a chat reply that short should stay short.
// Used only when the whole message is shorthand (plus spaces and punctuation); anything else goes to the translator.
(function (root) {
  // concept -> { language: [forms people type] }. The first form is what we write in that language.
  // Forms are lowercase; laughter has patterns because people type it at any length ("ahahah", "kkkkk", "jajaja").
  const CONCEPTS = {
    thanks: {
      en: ['ty', 'thx', 'tnx', 'thnx', 'tysm', 'tyvm'], ru: ['спс', 'пасиб', 'сяб', 'спасиб', 'пасибо', 'спасибки'],
      uk: ['дяк', 'дякс'], tr: ['tşk', 'tsk', 'tşkler', 'tskler', 'eyv', 'eyw', 'eyvl', 'saol', 'sğol', 'sağol', 'sağ ol', 'eyvallah'],
      de: ['danke', 'dankö', 'thx'], fr: ['merci', 'mrc', 'mci'], es: ['grax', 'grx', 'grcs'], pt: ['vlw', 'obg', 'obgd'],
      pl: ['dzk', 'dzięks', 'dzieki', 'dzięki', 'dzk'], it: ['grz', 'grazie'], zh: ['谢谢', '3q'], ja: ['ありがと'],
      ko: ['ㄱㅅ', 'ㄳ'], ar: ['شكرا'], az: ['tşk', 'tsk', 'sağol'], kk: ['рахмет', 'рахмед'],
    },
    ok: {
      en: ['ok', 'k', 'kk', 'okie', 'oki'], ru: ['ок', 'оки', 'окей', 'окс'], uk: ['ок', 'оки'], tr: ['tmm', 'tmmdır', 'ok', 'oki'],
      de: ['ok', 'oki'], fr: ['ok', 'oké', 'dac', "d'acc"], es: ['ok', 'oki', 'vale', 'dale'], pt: ['blz', 'ok', 'fechou'],
      pl: ['ok', 'okej', 'oki', 'git'], it: ['ok', 'okk'], zh: ['好的', 'ok'], ja: ['おけ', 'ok'], ko: ['ㅇㅋ', 'ok'],
      ar: ['تمام', 'اوكي'], az: ['ok', 'oldu'], kk: ['ок', 'жарайды'],
    },
    hi: {
      en: ['hi', 'hey', 'hii', 'heyy', 'yo', 'sup'], ru: ['прив', 'ку', 'хай', 'приветики', 'здаров', 'дарова'], uk: ['прив', 'хай'],
      tr: ['slm', 'mrb', 'mrhb', 'sa', 'as', 'selam'], de: ['hi', 'hey', 'moin', 'servus'], fr: ['slt', 'cc', 'bjr', 'coucou'],
      es: ['hola', 'ola', 'holi', 'buenas'], pt: ['oi', 'oii', 'eae', 'opa'], pl: ['siema', 'hej', 'cze', 'elo'],
      it: ['ciao', 'ehi'], zh: ['嗨', '你好'], ja: ['やあ', 'おっす'], ko: ['ㅎㅇ'], ar: ['هلا', 'هلو'], az: ['slm', 'salam'],
      kk: ['сәлем', 'салем'],
    },
    bye: {
      en: ['cya', 'bye', 'bb', 'ttyl', 'byee'], ru: ['пок', 'пока', 'покеда', 'бб'], uk: ['бувай', 'бб', 'па'],
      tr: ['grşz', 'grsz', 'bb', 'bay'], de: ['bb', 'tschüss', 'ciao', 'cu'], fr: ['a+', 'bye', 'tchao', 'ciao'],
      es: ['chao', 'bye', 'nos vemos'], pt: ['flw', 'xau', 'tchau'], pl: ['nara', 'pa', 'papa', 'na razie'],
      it: ['ciao', 'ci vediamo'], zh: ['88', '拜拜'], ja: ['じゃね', 'またね'], ko: ['ㅂㅂ', 'ㅂㅇ'], ar: ['باي'],
      az: ['görüşərik', 'sağ ol'], kk: ['сау бол'],
    },
    idk: {
      en: ['idk', 'dunno', 'idek'], ru: ['хз', 'нз', 'хзх'], uk: ['хз'], tr: ['bilmiyom', 'bilmiom', 'blm', 'bilmem'],
      de: ['ka'], fr: ['jsp', 'jsais pas', 'chais pas'], es: ['ni idea', 'nidea', 'nse'], pt: ['sla', 'sei la', 'sei lá'],
      pl: ['nwm', 'nie wiem'], it: ['boh', 'bho'], zh: ['不知道'], ja: ['わからん'], ko: ['ㅁㄹ'], ar: ['مدري'],
      az: ['bilmirəm'], kk: ['білмеймін', 'хз'],
    },
    np: {
      en: ['np', 'yw', 'no prob', 'nps'], ru: ['нзч', 'не за что', 'незачто'], uk: ['нзщ', 'нема за що'],
      tr: ['rica ederim', 'önemli değil'], de: ['kp', 'gern', 'gerne'], fr: ['de rien', 'pas de souci', 'pdp'],
      es: ['de nada', 'npn'], pt: ['dnd', 'de nada', 'magina'], pl: ['nmzc', 'nie ma za co', 'spoko'], it: ['figurati', 'prego'],
      zh: ['不客气'], ja: ['いいよ'], ko: ['ㄱㅊ'], ar: ['العفو'], az: ['dəyməz'], kk: ['оқасы жоқ'],
    },
    pls: {
      en: ['pls', 'plz', 'plss', 'plox'], ru: ['пж', 'плз', 'пжл', 'пжлст', 'пожалуйста'], uk: ['пж', 'будь ласка'],
      tr: ['lütfen', 'ltf', 'pls'], de: ['bitte', 'bidde', 'pls'], fr: ['stp', 'svp'], es: ['porfa', 'xfa', 'pf', 'porfis'],
      pt: ['pfv', 'pf', 'pfvr', 'plmds'], pl: ['pls', 'plz', 'prosze', 'proszę'], it: ['pls', 'per favore'], zh: ['拜托'],
      ja: ['おねがい'], ko: ['ㅈㅂ'], ar: ['لو سمحت'], az: ['zəhmət olmasa'], kk: ['өтінем', 'пж'],
    },
    wait: {
      en: ['sec', '1 sec', 'one sec', 'wait', 'w8', 'hold on', 'secc'], ru: ['сек', 'ща', 'щас', 'секу', 'секунду', 'погоди'],
      uk: ['сек', 'зачекай'], tr: ['bi sn', '1 sn', 'bir sn', 'bi saniye', 'bekle'], de: ['sek', 'moment', 'warte', 'sekunde'],
      fr: ['2 sec', '2sec', 'attends', 'deux sec'], es: ['un seg', '1 seg', 'espera', 'espérate'], pt: ['pera', 'pera ai', 'pera aí', 'peraí'],
      pl: ['sek', 'chwila', 'czekaj', 'moment'], it: ['un sec', 'aspetta'], zh: ['等下', '等一下'], ja: ['ちょっと待って'],
      ko: ['ㄱㄷ', 'ㅈㄱㄷ'], ar: ['لحظة'], az: ['bir saniyə', 'gözlə'], kk: ['сек', 'күте тұр'],
    },
    brb: {
      en: ['brb'], ru: ['ща вернусь', 'щас вернусь', 'скоро вернусь'], uk: ['зараз повернусь'], tr: ['hemen geliyorum', 'geliyorum hemen'],
      de: ['bin gleich zurück', 'bin gleich wieder da'], fr: ['jreviens', 'je reviens'], es: ['ya vuelvo', 'ahora vuelvo'],
      pt: ['ja volto', 'já volto'], pl: ['zaraz wracam', 'zw'], it: ['torno subito'], zh: ['马上回来'], ja: ['すぐ戻る'],
      ko: ['금방 올게'], ar: ['راجع'], az: ['indi gəlirəm'], kk: ['қазір келем'],
    },
    sorry: {
      en: ['sry', 'srry', 'soz', 'sorry', 'mb'], ru: ['сорян', 'сори', 'сорри', 'извини', 'звиняй'], uk: ['сорі', 'вибач'],
      tr: ['kusura bakma', 'pardon', 'kb', 'kusra bakma'], de: ['sry', 'sorry', 'sorri', 'tut mir leid'], fr: ['dsl', 'désolé', 'desole'],
      es: ['perdón', 'perdon', 'srry', 'lo siento'], pt: ['foi mal', 'desculpa', 'mals', 'dsclp'], pl: ['sorki', 'sry', 'sorka', 'sorry'],
      it: ['scusa', 'scs'], zh: ['抱歉', 'dbq', '对不起'], ja: ['ごめん'], ko: ['ㅈㅅ', 'ㅈㅅㅈㅅ'], ar: ['آسف', 'اسف'],
      az: ['bağışla', 'üzr istəyirəm'], kk: ['кешір', 'сорян'],
    },
    bro: {
      en: ['bro', 'bruh', 'dude'], ru: ['бро', 'братан', 'брат', 'братишка'], uk: ['бро', 'брат'], tr: ['knk', 'kanka', 'kanki', 'kardo', 'kardeşim', 'kdşm'],
      de: ['bro', 'digga', 'diggi', 'alter'], fr: ['frr', 'frérot', 'frero', 'mon frère'], es: ['bro', 'tío', 'tio', 'wey', 'güey'],
      pt: ['mano', 'bro', 'parça'], pl: ['ziom', 'ziomek', 'stary', 'bro'], it: ['bro', 'fra', 'zio'], zh: ['兄弟'],
      ko: ['형'], ar: ['خوي', 'اخوي'], az: ['qardaş', 'brat'], kk: ['бро', 'брат', 'бауырым'],
    },
    lol: {
      en: ['lol', 'lmao', 'xd', 'haha'], ru: ['ахах', 'лол', 'хаха', 'ахаха', 'хд'], uk: ['ахах', 'лол'], tr: ['ahah', 'sjsj', 'jsjs', 'asdfg', 'xd'],
      de: ['haha', 'lol', 'xd'], fr: ['mdr', 'ptdr', 'lol'], es: ['jaja', 'jsjs', 'xd'], pt: ['kkk', 'rsrs', 'kkkk'],
      pl: ['xd', 'haha'], it: ['ahah', 'ahahah'], zh: ['哈哈', '233', 'hhh'], ja: ['www', 'ｗｗ', '笑'], ko: ['ㅋㅋ', 'ㅋㅋㅋ', 'ㅎㅎ'],
      ar: ['ههه', 'هههه'], az: ['haha'], kk: ['ахах'],
    },
  };
  // Laughter typed at any length.
  const LAUGH = [
    /^(?:a?h+a+)+h*$|^(?:a?h+e+)+h*$|^l+o+l+$|^l+m+f*a+o+$|^x+d+$|^h+i+h+i+$/u,   // haha, ahahah, hehe, lool, lmfao, xDD
    /^(?:а?х+а+)+х*$|^(?:х+е+)+х*$|^л+о+л+$|^х+д+$/u,                         // ахаха, хахах, хехе, лооол
    /^(?:j+a+)+j*$|^(?:j+e+)+j*$|^(?:j+s+)+j*$|^(?:s+j+)+s*$/u,               // jajaja, jejeje, jsjsjs, sjsjsj
    /^k{3,}$|^(?:rs){2,}$|^(?:hu)+e*$/u,                                       // kkkk, rsrsrs, huehue
    /^[ㅋㅎ]{2,}$|^h{3,}$|^w{2,}$|^ｗ{2,}$|^ه{3,}$/u,                            // ㅋㅋㅋ, hhh, www, ههههه
    /^m+d+r+$|^p+t+d+r+$/u,                                                    // mdrrr, ptdrrr
  ];

  // Languages whose forms are read when the writer's language is `from`: their own first, English chat shorthand next
  // (used everywhere), and any language's forms after that, so a Turkish writer's "спс" or "ty" is still understood.
  const LANGS = Object.keys(CONCEPTS.thanks);
  const base = l => String(l || '').toLowerCase().split('-')[0];

  // form -> concept, per language. Multi-word forms ("bi sn", "nie wiem") are matched before single words.
  const FORMS = {};
  for (const [concept, byLang] of Object.entries(CONCEPTS)) {
    for (const [lang, forms] of Object.entries(byLang)) {
      FORMS[lang] = FORMS[lang] || new Map();
      for (const f of forms) if (!FORMS[lang].has(f)) FORMS[lang].set(f, concept);
    }
  }
  // Short forms that are ordinary words in other languages only count for their own language or for English writers:
  // Turkish "as" is English "as", "sa" is Spanish/Portuguese "sa", Polish "pa"/"git"/"stary" are real words elsewhere.
  const OWN_ONLY = new Set(['as', 'sa', 'pa', 'git', 'stary', 'spoko', 'moment', 'alter', 'zio', 'fra', 'tio', 'ola', 'opa',
    'oldu', 'bay', 'mb', 'kb', 'dac', 'ka', 'pf', 'dnd', 'ok', 'k', 'kk', 'yo', 'bb', 'cu', 'zw', 'sec', 'wait', 'pardon', 'sorry',
    'ciao', 'bye', 'hey', 'hi', 'bro', 'lol', 'xd', 'haha', 'danke', 'merci', 'bitte', 'mano', 'hola', 'grazie', 'prego', 'vale',
    'dale', 'brat', 'брат', 'ща', 'щас', 'ку', 'нз']);

  const SEP = /^[\s.,!?…)(:;\p{Extended_Pictographic}\u{FE0F}\u{200D}]+$/u;   // spaces, punctuation, emoji
  const UNIT = /[\p{L}\p{N}ㄱ-ㅎ'+]+/gu;

  function conceptOf(phrase, lang, from) {
    const p = phrase.toLocaleLowerCase();
    const m = FORMS[lang] && FORMS[lang].get(p);
    if (m && (lang === from || lang === 'en' || !OWN_ONLY.has(p))) return m;
    return null;
  }
  function laugh(word) { return LAUGH.some(re => re.test(word.toLocaleLowerCase())) ? 'lol' : null; }

  // Split the message into shorthand units. Returns [{concept, lang}] and the separators between them, or null when
  // any word isn't shorthand. Tries two- and three-word forms first ("bi sn", "nie ma za co").
  function parse(text, from) {
    const words = [...text.matchAll(UNIT)];
    if (!words.length || words.length > 6) return null;
    const order = [from, 'en', ...LANGS.filter(l => l !== from && l !== 'en')];
    const units = [];
    let i = 0;
    let gapStart = 0;
    const gaps = [];
    while (i < words.length) {
      let hit = null;
      for (let n = Math.min(3, words.length - i); n >= 1 && !hit; n--) {
        const start = words[i].index;
        const last = words[i + n - 1];
        const phrase = text.slice(start, last.index + last[0].length).replace(/\s+/g, ' ');
        if (n > 1 && !/^[\p{L}\p{N}'+ ]+$/u.test(phrase)) continue;
        for (const lang of order) {
          const c = conceptOf(phrase, lang, from);
          if (c) { hit = { concept: c, lang, n, start, end: last.index + last[0].length }; break; }
        }
        if (!hit && n === 1) {
          const c = laugh(phrase);
          if (c) hit = { concept: c, lang: from, n, start, end: last.index + last[0].length };
        }
      }
      if (!hit) return null;
      gaps.push(text.slice(gapStart, hit.start));
      units.push(hit);
      gapStart = hit.end;
      i += hit.n;
    }
    gaps.push(text.slice(gapStart));
    if (!gaps.every((g, k) => g === '' ? k === 0 || k === gaps.length - 1 : SEP.test(g))) return null;
    return { units, gaps };
  }

  // text: what the user typed; from: their language; to: the other side's language.
  // Returns { text, src } or null. src is `to` when every unit is already the target language's own shorthand.
  function shortReply(text, from, to) {
    const f = base(from);
    const t = base(to);
    const src = String(text || '').trim();
    if (!src || !CONCEPTS.thanks[t] || src.length > 40) return null;
    const parsed = parse(src, f);
    if (!parsed) return null;
    const { units, gaps } = parsed;
    if (units.every(u => u.lang === t || (FORMS[t] && FORMS[t].get(src.slice(u.start, u.end).toLocaleLowerCase()) === u.concept))) {
      return { text: src, src: t };
    }
    let out = gaps[0];
    units.forEach((u, k) => {
      const word = CONCEPTS[u.concept][t][0];
      const typed = src.slice(u.start, u.end);
      const cap = typed[0] !== typed[0].toLocaleLowerCase() && word[0] !== word[0].toLocaleUpperCase() ? word[0].toLocaleUpperCase() + word.slice(1) : word;
      out += cap + gaps[k + 1];
    });
    return { text: out, src: f };
  }

  const api = { shortReply };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CC = Object.assign(root.CC || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this);
