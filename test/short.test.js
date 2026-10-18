const test = require('node:test');
const assert = require('node:assert');
const { shortReply } = require('../src/short.js');

const t = (text, from, to) => (shortReply(text, from, to) || {}).text;

test('Turkish shorthand becomes the other language\'s shorthand', () => {
  assert.strictEqual(t('tşk', 'tr', 'ru'), 'спс');
  assert.strictEqual(t('eyv', 'tr', 'ru'), 'спс');
  assert.strictEqual(t('eyv knk', 'tr', 'ru'), 'спс бро');
  assert.strictEqual(t('tmm', 'tr', 'en'), 'ok');
  assert.strictEqual(t('slm', 'tr', 'de'), 'hi');
  assert.strictEqual(t('tşk', 'tr', 'fr'), 'merci');
  assert.strictEqual(t('tmm tşk', 'tr', 'pt'), 'blz vlw');
  assert.strictEqual(t('sağ ol', 'tr', 'ru'), 'спс');
  assert.strictEqual(t('bi sn', 'tr', 'ru'), 'сек');
});

test('English chat shorthand typed by anyone', () => {
  assert.strictEqual(t('ty', 'tr', 'ru'), 'спс');
  assert.strictEqual(t('ty', 'tr', 'de'), 'danke');
  assert.strictEqual(t('idk', 'tr', 'ru'), 'хз');
  assert.strictEqual(t('np', 'tr', 'ru'), 'нзч');
  assert.strictEqual(t('brb', 'tr', 'es'), 'ya vuelvo');
});

test('punctuation, emoji and capitals are kept', () => {
  assert.strictEqual(t('Tşk!', 'tr', 'ru'), 'Спс!');
  assert.strictEqual(t('tşk knk 🙏', 'tr', 'ru'), 'спс бро 🙏');
  assert.strictEqual(t('ok, tşk', 'tr', 'ru'), 'ок, спс');
});

test('laughter at any length', () => {
  assert.strictEqual(t('ahahahah', 'tr', 'ru'), 'ахах');
  assert.strictEqual(t('ахахаха', 'ru', 'pt'), 'kkk');
  assert.strictEqual(t('kkkkk', 'pt', 'fr'), 'mdr');
});

test('already the other language\'s shorthand: the box is left alone', () => {
  assert.deepStrictEqual(shortReply('спс', 'tr', 'ru'), { text: 'спс', src: 'ru' });
  assert.deepStrictEqual(shortReply('ok', 'tr', 'de'), { text: 'ok', src: 'de' });
});

test('anything that is not only shorthand goes to the translator', () => {
  assert.strictEqual(shortReply('tşk ederim', 'tr', 'ru'), null);
  assert.strictEqual(shortReply('tmm yarın gelirim', 'tr', 'ru'), null);
  assert.strictEqual(shortReply('teşekkürler', 'tr', 'ru'), null);
  assert.strictEqual(shortReply('ne demek?', 'tr', 'ru'), null);
  assert.strictEqual(shortReply('', 'tr', 'ru'), null);
});

test('short words that mean something else in another language are not taken from it', () => {
  assert.strictEqual(shortReply('as', 'en', 'ru'), null);      // English "as", not Turkish "aleyküm selam"
  assert.strictEqual(shortReply('git', 'en', 'ru'), null);     // not Polish "git" (= ok)
  assert.strictEqual(t('as', 'tr', 'ru'), 'прив');             // a Turkish writer's "as" is a greeting
});
