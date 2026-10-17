const test = require('node:test');
const assert = require('node:assert');
const { expandSlang } = require('../src/slang.js');

test('Russian chat slang is spelled out for the translator', () => {
  assert.strictEqual(expandSlang('ща'), 'сейчас');
  assert.strictEqual(expandSlang('щас приду'), 'сейчас приду');
  assert.strictEqual(expandSlang('спс бро'), 'спасибо бро');
  assert.strictEqual(expandSlang('хз, мб завтра'), 'не знаю, может быть завтра');
  assert.strictEqual(expandSlang('чё как?'), 'что как?');
  assert.strictEqual(expandSlang('норм'), 'нормально');
  assert.strictEqual(expandSlang('пж скинь'), 'пожалуйста скинь');
});

test('Turkish chat abbreviations', () => {
  assert.strictEqual(expandSlang('tmm knk'), 'tamam kanka');
  assert.strictEqual(expandSlang('slm nbr'), 'selam naber');
  assert.strictEqual(expandSlang('tşk ederim'), 'teşekkür ederim');
  assert.strictEqual(expandSlang('mrb, kib'), 'merhaba, kendine iyi bak');
});

test('English chat abbreviations', () => {
  assert.strictEqual(expandSlang('thx u'), 'thanks you');
  assert.strictEqual(expandSlang('idk rn, brb'), "I don't know right now, be right back");
  assert.strictEqual(expandSlang('pls lmk'), 'please let me know');
});

test('case is kept for the first letter and words inside other words are untouched', () => {
  assert.strictEqual(expandSlang('Ща'), 'Сейчас');
  assert.strictEqual(expandSlang('Tmm'), 'Tamam');
  assert.strictEqual(expandSlang('щавель'), 'щавель');       // not "ща"
  assert.strictEqual(expandSlang('university'), 'university'); // not "u"
  assert.strictEqual(expandSlang('normal text'), 'normal text');
});

test('placeholders and names are left alone', () => {
  assert.strictEqual(expandSlang('__0__ ща'), '__0__ сейчас');
  assert.strictEqual(expandSlang(''), '');
});

test('per-language dictionaries: the same letters mean different things', () => {
  assert.strictEqual(expandSlang('np jutro', 'pl'), 'na przykład jutro');
  assert.strictEqual(expandSlang('np', 'en'), 'no problem');
  assert.strictEqual(expandSlang('pq?', 'fr'), 'pourquoi?');
  assert.strictEqual(expandSlang('pq no', 'es'), 'porque no');
  assert.strictEqual(expandSlang('щас', 'uk'), 'зараз');
  assert.strictEqual(expandSlang('щас', 'ru'), 'сейчас');
});

test('German, French, Spanish, Portuguese, Polish, Ukrainian', () => {
  assert.strictEqual(expandSlang('vllt morgen, ka', 'de'), 'vielleicht morgen, keine Ahnung');
  assert.strictEqual(expandSlang('slt, jsp tkt', 'fr'), "salut, je ne sais pas t'inquiète");
  assert.strictEqual(expandSlang('ntp, tqm', 'es'), 'no te preocupes, te quiero mucho');
  assert.strictEqual(expandSlang('vc vem hj? vlw', 'pt'), 'você vem hoje? valeu');
  assert.strictEqual(expandSlang('nwm, pzdr', 'pl'), 'nie wiem, pozdrawiam');
  assert.strictEqual(expandSlang('дяк, шо там', 'uk'), 'дякую, що там');
});

test('Chinese pinyin abbreviations and number codes, also next to Han characters', () => {
  assert.strictEqual(expandSlang('yyds', 'zh-CN'), '永远的神');
  assert.strictEqual(expandSlang('xswl 666', 'zh-CN'), '笑死我了 厉害');
  assert.strictEqual(expandSlang('这个yyds', 'zh-CN'), '这个永远的神');
  assert.strictEqual(expandSlang('88', 'zh-CN'), '拜拜');
  assert.strictEqual(expandSlang('88', 'en'), '88');          // number codes only for Chinese
});

test('English chat abbreviations work alongside any language, the chat language wins on conflicts', () => {
  assert.strictEqual(expandSlang('thx, idk', 'de'), "thanks, I don't know");
  assert.strictEqual(expandSlang('ngl ikr fr', 'en'), 'not gonna lie I know right for real');
  assert.strictEqual(expandSlang('спс', 'tr'), 'спасибо');   // Cyrillic words still use the Russian list
});

test('"др" is read from its context: friend request vs birthday, otherwise left alone', () => {
  assert.strictEqual(expandSlang('Кинь др и заходи на меня'), 'Кинь запрос в друзья и заходи на меня');
  assert.strictEqual(expandSlang('скинь в др', 'ru'), 'скинь запрос в друзья');
  assert.strictEqual(expandSlang('прими др плз', 'tr'), 'прими запрос в друзья пожалуйста');
  assert.strictEqual(expandSlang('добавь меня в др', 'ru'), 'добавь меня в друзья');
  assert.strictEqual(expandSlang('удалил из др', 'ru'), 'удалил из друзей');
  assert.strictEqual(expandSlang('С др!', 'ru'), 'С днём рождения!');
  assert.strictEqual(expandSlang('у меня завтра др', 'ru'), 'у меня завтра др');   // no clear context: untouched
  assert.strictEqual(expandSlang('у меня др завтра', 'ru'), 'у меня день рождения завтра');
  assert.strictEqual(expandSlang('др', 'ru'), 'др');
  assert.strictEqual(expandSlang('кадр', 'ru'), 'кадр');                             // inside a word
});

test('Arabic spelling variants', () => {
  assert.strictEqual(expandSlang('انشالله', 'ar'), 'إن شاء الله');
  assert.strictEqual(expandSlang('مشالله', 'ar'), 'ما شاء الله');
});

test('short English abbreviations that are real words elsewhere only apply in English chats', () => {
  assert.strictEqual(expandSlang('evet ya', 'tr'), 'evet ya');      // Turkish "ya", not "you"
  assert.strictEqual(expandSlang('ya está', 'es'), 'ya está');      // Spanish "ya" = already
  assert.strictEqual(expandSlang('a ty?', 'pl'), 'a ty?');          // Polish "ty" = you
  assert.strictEqual(expandSlang('u mnie', 'pl'), 'u mnie');        // Polish "u" = at
  assert.strictEqual(expandSlang('u ok?', 'en'), 'you ok?');
  assert.strictEqual(expandSlang('thx', 'tr'), 'thanks');           // distinctive ones still work everywhere
});
