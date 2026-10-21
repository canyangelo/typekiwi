// Chat abbreviations spelled out before translation ("ща" -> "сейчас", "tmm" -> "tamam", "idk" -> "I don't know").
// Translators, especially Chrome's small on-device model, don't know chat slang and produce nonsense
// ("ща" came out as "irade"). Only the text sent to the translator changes; what people wrote stays on screen.
//
// One list per language, because the same letters mean different things ("np": no problem in English,
// "for example" in Polish; "pq": porque in Spanish, pourquoi in French). The chat's language is tried first,
// then English (its chat abbreviations are used everywhere), and Cyrillic words fall back to the Russian list.
// Sources: language-learning guides on texting abbreviations (2025-2026) for de/fr/es/pt/pl/ru/zh/tr/en;
// for Arabic, Kazakh and Azerbaijani little is documented, so only safe spelling variants are listed.
// Whole words only (a word is a run of one script, so "这个yyds" still finds "yyds"); the first letter's case is kept.
(function (root) {
  const SLANG = {
    ru: {
      'ща': 'сейчас', 'щас': 'сейчас', 'щя': 'сейчас', 'щяс': 'сейчас', 'сча': 'сейчас', 'счас': 'сейчас',
      'спс': 'спасибо', 'пасиб': 'спасибо', 'пасибо': 'спасибо', 'сяб': 'спасибо', 'спасиб': 'спасибо',
      'пж': 'пожалуйста', 'пжл': 'пожалуйста', 'плз': 'пожалуйста', 'пожалста': 'пожалуйста',
      'норм': 'нормально', 'оч': 'очень', 'хз': 'не знаю', 'мб': 'может быть', 'кст': 'кстати',
      'чё': 'что', 'че': 'что', 'чо': 'что', 'ничё': 'ничего', 'ниче': 'ничего', 'нзч': 'не за что',
      'прив': 'привет', 'ку': 'привет', 'пок': 'пока', 'ясн': 'ясно', 'лан': 'ладно', 'тя': 'тебя',
      'чел': 'человек', 'всм': 'в смысле', 'имхо': 'по-моему', 'кмк': 'как мне кажется', 'лс': 'личные сообщения',
      'оки': 'хорошо', 'ок': 'хорошо', 'седня': 'сегодня', 'сёдня': 'сегодня', 'тока': 'только',
      'чтоль': 'что ли', 'щаз': 'сейчас', 'збс': 'отлично', 'нз': 'не знаю',
    },
    uk: {
      'дяк': 'дякую', 'дякс': 'дякую', 'пж': 'будь ласка', 'щас': 'зараз', 'ща': 'зараз', 'шо': 'що',
      'прив': 'привіт', 'норм': 'нормально', 'хз': 'не знаю', 'мб': 'може бути', 'лан': 'гаразд', 'оч': 'дуже',
    },
    tr: {
      'tmm': 'tamam', 'tmmdır': 'tamamdır', 'slm': 'selam', 'mrb': 'merhaba', 'mrhb': 'merhaba', 'nbr': 'naber',
      'knk': 'kanka', 'tşk': 'teşekkür', 'tsk': 'teşekkür', 'tşkler': 'teşekkürler', 'tskler': 'teşekkürler',
      'saol': 'sağ ol', 'sğol': 'sağ ol', 'kib': 'kendine iyi bak', 'tbr': 'tebrikler', 'grşz': 'görüşürüz',
      'grsz': 'görüşürüz', 'bi': 'bir', 'bşy': 'bir şey', 'bsy': 'bir şey', 'şmdi': 'şimdi', 'snra': 'sonra',
      'cnm': 'canım', 'kdşm': 'kardeşim', 'hrşy': 'her şey', 'olr': 'olur', 'nasılsn': 'nasılsın',
      'nrdsn': 'neredesin', 'napıyon': 'ne yapıyorsun', 'naptın': 'ne yaptın', 'hyr': 'hayır', 'evt': 'evet',
      'blm': 'bilmiyorum', 'bilmiom': 'bilmiyorum', 'gclr': 'geceler',
    },
    en: {
      'u': 'you', 'ur': 'your', 'r': 'are', 'ya': 'you', 'pls': 'please', 'plz': 'please', 'thx': 'thanks',
      'ty': 'thank you', 'tysm': 'thank you so much', 'np': 'no problem', 'idk': "I don't know", 'rn': 'right now',
      'brb': 'be right back', 'omw': 'on my way', 'lmk': 'let me know', 'wdym': 'what do you mean', 'btw': 'by the way',
      'imo': 'in my opinion', 'tbh': 'to be honest', 'wyd': 'what are you doing', 'hbu': 'how about you',
      'wbu': 'what about you', 'nvm': 'never mind', 'cuz': 'because', 'bc': 'because', 'ngl': 'not gonna lie',
      'smh': 'shaking my head', 'ikr': 'I know right', 'fr': 'for real', 'ofc': 'of course', 'afk': 'away from keyboard',
      'irl': 'in real life', 'ttyl': 'talk to you later', 'gn': 'good night', 'gm': 'good morning', 'sry': 'sorry',
      'ppl': 'people', 'msg': 'message', 'jk': 'just kidding', 'asap': 'as soon as possible', 'dm': 'direct message',
      'mb': 'my bad', 'tho': 'though', 'k': 'okay', 'kk': 'okay', 'pic': 'picture', 'w8': 'wait', 'gr8': 'great',
    },
    de: {
      'vllt': 'vielleicht', 'vlt': 'vielleicht', 'evtl': 'eventuell', 'ka': 'keine Ahnung', 'kp': 'kein Problem',
      'lg': 'liebe Grüße', 'vlg': 'viele liebe Grüße', 'mfg': 'mit freundlichen Grüßen', 'hdl': 'hab dich lieb',
      'bzw': 'beziehungsweise', 'mmn': 'meiner Meinung nach', 'bb': 'bis bald', 'gn': 'gute Nacht', 'nix': 'nichts',
      'grad': 'gerade', 'wg': 'wegen', 'sry': 'sorry',
    },
    fr: {
      'slt': 'salut', 'bjr': 'bonjour', 'bsr': 'bonsoir', 'stp': "s'il te plaît", 'svp': "s'il vous plaît",
      'pk': 'pourquoi', 'pq': 'pourquoi', 'jsp': 'je ne sais pas', 'mdr': 'mort de rire', 'ptdr': 'pété de rire',
      'cc': 'coucou', 'tkt': "t'inquiète", 'tqt': "t'inquiète", 'pcq': 'parce que', 'pck': 'parce que', 'dsl': 'désolé',
      'jtm': "je t'aime", 'bcp': 'beaucoup', 'qd': 'quand', 'tjrs': 'toujours', 'auj': "aujourd'hui",
      'mtn': 'maintenant', 'vrm': 'vraiment', 'rdv': 'rendez-vous', 'jpp': "j'en peux plus", 'oklm': 'au calme',
    },
    es: {
      'q': 'que', 'k': 'que', 'xq': 'porque', 'pq': 'porque', 'xk': 'porque', 'tqm': 'te quiero mucho',
      'tb': 'también', 'tmb': 'también', 'tmp': 'tampoco', 'ntp': 'no te preocupes', 'xfa': 'por favor',
      'porfa': 'por favor', 'pf': 'por favor', 'npn': 'no pasa nada', 'cdt': 'cuídate', 'grax': 'gracias',
      'dnd': 'dónde', 'bss': 'besos', 'msj': 'mensaje', 'nd': 'nada', 'tmbn': 'también',
    },
    pt: {
      'vc': 'você', 'vcs': 'vocês', 'pq': 'porque', 'tb': 'também', 'tbm': 'também', 'blz': 'beleza', 'vlw': 'valeu',
      'obg': 'obrigado', 'msm': 'mesmo', 'q': 'que', 'n': 'não', 'td': 'tudo', 'tds': 'todos', 'bjs': 'beijos',
      'fds': 'fim de semana', 'cmg': 'comigo', 'ctz': 'certeza', 'hj': 'hoje', 'qnd': 'quando', 'qq': 'qualquer',
      'sdds': 'saudades', 'agr': 'agora', 'mt': 'muito', 'mto': 'muito', 'kd': 'cadê', 'pfv': 'por favor',
      'pf': 'por favor', 'tmj': 'tamo junto', 'gnt': 'gente', 'dps': 'depois',
    },
    pl: {
      'nwm': 'nie wiem', 'np': 'na przykład', 'pzdr': 'pozdrawiam', 'tz': 'to znaczy', 'tzn': 'to znaczy',
      'dzk': 'dziękuję', 'dzięks': 'dzięki', 'nmzc': 'nie ma za co', 'cb': 'ciebie', 'wgl': 'w ogóle',
      'zw': 'zaraz wracam', 'jbc': 'jakby co', 'tb': 'tobie', 'pls': 'proszę',
    },
    'zh': {
      'yyds': '永远的神', 'xswl': '笑死我了', 'awsl': '啊我死了', 'nb': '牛', 'zqsg': '真情实感', 'u1s1': '有一说一',
      'xs': '笑死', 'bhys': '不好意思', 'dbq': '对不起', 'nsdd': '你说得对', 'bdjw': '不懂就问', 'plmm': '漂亮妹妹',
      'ssfd': '瑟瑟发抖', '666': '厉害', '88': '拜拜', '886': '拜拜了', '520': '我爱你', '233': '哈哈哈', '3q': '谢谢',
    },
    ar: {
      'انشالله': 'إن شاء الله', 'انشاءالله': 'إن شاء الله', 'إنشاءالله': 'إن شاء الله', 'مشالله': 'ما شاء الله',
      'ماشالله': 'ما شاء الله', 'ماشاءالله': 'ما شاء الله', 'الحمدلله': 'الحمد لله', 'جزاكالله': 'جزاك الله',
    },
    az: { 'slm': 'salam', 'tşk': 'təşəkkür', 'tsk': 'təşəkkür' },
  };
  const DEFAULT_ORDER = ['ru', 'tr', 'en'];   // no chat language known

  // Abbreviations whose meaning depends on the words around them. "др" is "друг/друзья" in gamer chat
  // ("кинь др" = send a friend request) but "день рождения" in "с др" / "у меня др". Without a clear context
  // the word is left as it is: a wrong guess ("send a birthday") is worse than none.
  const W = '(?<![\\p{L}\\p{N}])';   // word start for any script (\b only knows Latin)
  const E = '(?![\\p{L}\\p{N}])';    // word end
  //
  // "кинуть" is both "to send" and slang for "to scam": a lone "кинул" after "add me" came out as "dolandırdı"
  // (scammed). It is read as "sent" when it has something sent after it (др, заявку, ссылку…) or stands alone with
  // only filler words ("уже кинул", "кинул тебе)"). With a victim ("меня кинули", "кинул меня") it stays as written.
  const SEND = {
    'кинь': 'отправь', 'кинь-ка': 'отправь', 'скинь': 'отправь', 'кидай': 'отправляй', 'скидывай': 'отправляй',
    'кинуть': 'отправить', 'скинуть': 'отправить', 'кинешь': 'отправишь', 'скинешь': 'отправишь', 'кину': 'отправлю',
    'скину': 'отправлю', 'кинул': 'отправил', 'скинул': 'отправил', 'кинула': 'отправила', 'скинула': 'отправила',
    'кинули': 'отправили', 'скинули': 'отправили',
  };
  const SEND_VERBS = Object.keys(SEND).join('|');
  const sendVerb = verb => {
    const to = SEND[verb.toLowerCase()];
    if (!to) return verb;
    return verb[0] !== verb[0].toLowerCase() ? to[0].toUpperCase() + to.slice(1) : to;
  };
  const SENT_THINGS = 'заявку|заявочку|запрос|инвайт|инв|приглашение|приглос|ссылку|ссылочку|трейд|обмен|скрин|скриншот|' +
    'аккаунт|акк|данные|код|почту|логин|пароль|ник|предмет|предметы|айди|id';
  const FILLER = '(?:я|уже|ну|вот|всё|все|ок|да|только\\s+что|тебе|вам|те)';
  const PHRASES = {
    ru: [
      [new RegExp(W + '(' + SEND_VERBS + '|отправь|отправить|отправлю|отправил|отправила|прими|принять|прийми|прими-ка)\\s+(тебе\\s+|вам\\s+)?(в\\s+)?др' + E, 'giu'),
        (m, verb, who) => sendVerb(verb) + ' ' + (who || '') + 'запрос в друзья'],
      [new RegExp(W + '(' + SEND_VERBS + ')(\\s+(?:тебе|вам|те)\\s+|\\s+)(' + SENT_THINGS + ')' + E, 'giu'),
        (m, verb, gap, thing) => sendVerb(verb) + gap + thing],
      [new RegExp('^(\\s*(?:' + FILLER + '[\\s,]+)*)(' + SEND_VERBS + ')((?:[\\s,]+' + FILLER + ')*\\s*[.!?)(]*\\s*)$', 'iu'),
        (m, pre, verb, post) => pre + sendVerb(verb) + post],
      [new RegExp(W + '(добавь|добавить|добавлю|добавил|добавила|добавишь|кинь|скинь)\\s+(меня\\s+|тебя\\s+)?в\\s+др' + E, 'giu'),
        (m, verb, who) => verb + ' ' + (who || '') + 'в друзья'],
      [new RegExp(W + 'в\\s+др' + E, 'giu'), 'в друзья'],
      [new RegExp(W + 'из\\s+др' + E, 'giu'), 'из друзей'],
      [new RegExp(W + '(с|со)\\s+др' + E, 'giu'), (m, s) => (s[0] === 'С' ? 'С' : 'с') + ' днём рождения'],
      [new RegExp(W + '(у\\s+(?:меня|тебя|него|неё|нее|нас|вас|них)|мой|моё|твой|его|её|ее|на|до|после|днюха)\\s+др' + E, 'giu'),
        (m, pre) => pre + ' день рождения'],
      // "всё" alone closes a deal or a topic ("that's it / done"); translators read it as "everything" or "nothing".
      [/^(\s*)(ну\s+)?вс[её](\s*[.!)]*\s*)$/iu, (m, a, nu, z) => a + (nu || '') + (/^В/.test(m.trim().replace(/^ну\s+/i, '')) ? 'Это всё' : 'это всё') + z],
    ],
  };

  function expandPhrases(text, base) {
    for (const [re, to] of PHRASES[base] || []) text = text.replace(re, to);
    return text;
  }

  // English chat abbreviations are used in every language, except the short ones that are ordinary words
  // elsewhere ("ya" in Turkish/Spanish, "ty" and "u" in Polish): those only count in English chats.
  const EN_ONLY = new Set(['u', 'ur', 'r', 'ya', 'k', 'kk', 'ty', 'np', 'fr', 'mb', 'gn', 'gm', 'dm', 'pic', 'tho', 'bc']);
  const EN_EVERYWHERE = Object.fromEntries(Object.entries(SLANG.en).filter(([k]) => !EN_ONLY.has(k)));

  // A word is a run of one script (digits stick to Latin words like "u1s1"); pure numbers are their own token.
  const TOKEN = /\p{Script=Latin}[\p{Script=Latin}\p{N}]*|\p{N}+|\p{Script=Cyrillic}+|\p{Script=Arabic}+/gu;
  const own = (obj, k) => Object.prototype.hasOwnProperty.call(obj, k);

  function listsFor(lang) {
    const base = String(lang || '').toLowerCase().split('-')[0];
    if (!base) return DEFAULT_ORDER.map(l => SLANG[l]);
    if (base === 'en') return [SLANG.en, SLANG.ru];
    return [SLANG[base], EN_EVERYWHERE, SLANG.ru].filter(Boolean);
  }

  function expandSlang(text, lang) {
    const lists = listsFor(lang);
    const base = String(lang || '').toLowerCase().split('-')[0];
    // Russian phrase rules only match Cyrillic, and Cyrillic words use the Russian list in any chat.
    let out = expandPhrases(String(text || ''), base === 'uk' ? 'uk' : 'ru');
    if (base && base !== 'ru') out = expandPhrases(out, base);
    return out.replace(TOKEN, word => {
      const lower = word.toLocaleLowerCase();
      const list = lists.find(l => own(l, lower));
      if (!list) return word;
      // Pure number codes ("88") only count in the chat language's own list.
      if (/^\p{N}+$/u.test(word) && list !== lists[0]) return word;
      const full = list[lower];
      // Keep a capital first letter ("Ща" -> "Сейчас", "Tmm" -> "Tamam").
      return word[0] !== word[0].toLocaleLowerCase() ? full[0].toLocaleUpperCase() + full.slice(1) : full;
    });
  }

  const api = { expandSlang };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CC = Object.assign(root.CC || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this);
