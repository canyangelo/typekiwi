const test = require('node:test');
const assert = require('node:assert');
const { wrongLanguage } = require('../src/langcheck.js');

test('English output for a Turkish target is rejected (MyMemory: "очко ставлю" → "point I bet")', () => {
  assert.strictEqual(wrongLanguage('point I bet', 'tr'), true);
  assert.strictEqual(wrongLanguage('Can you send it to me please', 'tr'), true);
});

test('real Turkish output is accepted, even without Turkish letters', () => {
  assert.strictEqual(wrongLanguage('Merhaba, Siparişimin ödemesini yaptım', 'tr'), false);
  assert.strictEqual(wrongLanguage('sağol abi', 'tr'), false);
  assert.strictEqual(wrongLanguage('tamam bekle', 'tr'), false);
  assert.strictEqual(wrongLanguage('on dakika sonra', 'tr'), false);
});

test('names and short words do not trigger the English check', () => {
  assert.strictEqual(wrongLanguage('IVAN1KI', 'tr'), false);
  assert.strictEqual(wrongLanguage('ok', 'tr'), false);
});

test('Cyrillic target must contain Cyrillic letters', () => {
  assert.strictEqual(wrongLanguage('point I bet', 'ru'), true);
  assert.strictEqual(wrongLanguage('Привет, koryangelo', 'ru'), false);
  assert.strictEqual(wrongLanguage('koryangelo', 'ru'), false); // only a name: nothing to judge
});

test('Arabic and Chinese targets need their script', () => {
  assert.strictEqual(wrongLanguage('hello friend', 'ar'), true);
  assert.strictEqual(wrongLanguage('مرحبا', 'ar'), false);
  assert.strictEqual(wrongLanguage('hello friend', 'zh-CN'), true);
  assert.strictEqual(wrongLanguage('你好', 'zh-CN'), false);
});

test('English target and other Latin targets are not judged', () => {
  assert.strictEqual(wrongLanguage('point I bet', 'en'), false);
  assert.strictEqual(wrongLanguage('point I bet', 'de'), false);
});
