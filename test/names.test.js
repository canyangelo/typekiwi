const test = require('node:test');
const assert = require('node:assert');
const { findTransliterated, replaceWords, similarity, skeletonCyr, skeletonLat } = require('../src/names.js');

test('Cyrillic skeleton is close to the Latin skeleton', () => {
  assert.ok(similarity(skeletonLat('tekrocan'), skeletonCyr('Текрокан')) >= 0.9);
  assert.ok(similarity(skeletonLat('koryangelo'), skeletonCyr('Корьянжело')) >= 0.8);
  assert.ok(similarity(skeletonLat('koryangelo'), skeletonCyr('Коранджело')) >= 0.8);
});

test('transliterated names are found', () => {
  const pairs = findTransliterated(
    'merhaba benim adım tekrocan, kullanıcı adım koryangelo',
    'Здравствуйте, меня зовут Текрокан, мое имя пользователя — Корьянжело.');
  assert.deepStrictEqual(pairs, [
    { latin: 'tekrocan', word: 'Текрокан', cyrillic: true },
    { latin: 'koryangelo', word: 'Корьянжело', cyrillic: true },
  ]);
});

test('genuinely translated words do not match', () => {
  assert.deepStrictEqual(findTransliterated('siparişini şimdi gönderiyorum teşekkürler', 'Я отправляю ваш заказ сейчас, спасибо'), []);
});

test('a name with a Russian case ending is found too, the Turkish suffix after the apostrophe is dropped', () => {
  assert.deepStrictEqual(findTransliterated("tekrocan'a yaz", 'Напиши Текрокану'), [{ latin: 'tekrocan', word: 'Текрокану', cyrillic: true }]);
});

test('a word that already stayed Latin in the translation is not a candidate', () => {
  assert.deepStrictEqual(findTransliterated('kullanıcı adım koryangelo', 'мое имя пользователя koryangelo'), []);
});

test('replaceWords replaces whole words only', () => {
  assert.strictEqual(
    replaceWords('Меня зовут Текрокан, Текрокан!', [{ latin: 'tekrocan', word: 'Текрокан' }]),
    'Меня зовут tekrocan, tekrocan!');
  assert.strictEqual(replaceWords('Текроканы', [{ latin: 'tekrocan', word: 'Текрокан' }]), 'Текроканы');
});

test('a misspelled Latin name is found too', () => {
  const pairs = findTransliterated('benim adım tekrocan, kullanıcı adım koryangelo, sistemde problem yok',
    'меня зовут Tecrocan, мое имя пользователя Koryagelo, в системе проблем нет.');
  assert.deepStrictEqual(pairs.filter(p => !p.cyrillic),
    [{ latin: 'tekrocan', word: 'Tecrocan', cyrillic: false }, { latin: 'koryangelo', word: 'Koryagelo', cyrillic: false }]);
});

test('real cognate words are only Cyrillic candidates (the language check filters them), a Latin word appearing verbatim in the source is not a candidate', () => {
  const pairs = findTransliterated('Roblox hesabında sistem problemi var', 'В аккаунте Roblox проблема с системой');
  assert.ok(pairs.every(p => p.cyrillic));
  assert.deepStrictEqual(pairs.map(p => p.latin).sort(), ['problemi', 'sistem']);
});
