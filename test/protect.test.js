const test = require('node:test');
const assert = require('node:assert');
const { protect, restore } = require('../src/protect.js');

test('a listed word is protected case-insensitively', () => {
  const r = protect('merhaba benim adım Koryangelo', ['koryangelo']);
  assert.strictEqual(r.text, 'merhaba benim adım __0__');
  assert.deepStrictEqual(r.parts, ['Koryangelo']);
});

test('part of a word is not protected, a whole word is required', () => {
  const r = protect('tekrocanlar geldi', ['tekrocan']);
  assert.strictEqual(r.text, 'tekrocanlar geldi');
});

test('automatic rules: digit, underscore, @, mixed case, url, email', () => {
  const r = protect('user_123 @ali KorYangelo abc9 https://funpay.com/x a@b.com selam', []);
  assert.strictEqual(r.text, '__0__ __1__ __2__ __3__ __4__ __5__ selam');
  assert.deepStrictEqual(r.parts, ['user_123', '@ali', 'KorYangelo', 'abc9', 'https://funpay.com/x', 'a@b.com']);
});

test('plain words and a capitalized word are not protected', () => {
  const r = protect('Merhaba nasılsın Ahmet', []);
  assert.strictEqual(r.text, 'Merhaba nasılsın Ahmet');
  assert.deepStrictEqual(r.parts, []);
});

test('a Turkish suffix attached to a protected word is dropped', () => {
  const r = protect("koryangelo'ya yaz", ['koryangelo']);
  assert.strictEqual(r.text, '__0__ yaz');
  assert.deepStrictEqual(r.parts, ['koryangelo']);
});

test('a digits-only number is not protected (translation does not break it)', () => {
  const r = protect('5 tane al', []);
  assert.strictEqual(r.text, '5 tane al');
});

test('restore: normal and spaced placeholders', () => {
  assert.strictEqual(restore('Меня зовут __0__ и __1__', ['koryangelo', 'x_1']), 'Меня зовут koryangelo и x_1');
  assert.strictEqual(restore('Меня зовут __ 0 __', ['koryangelo']), 'Меня зовут koryangelo');
});

test('restore: a lost part is appended at the end', () => {
  assert.strictEqual(restore('Привет', ['koryangelo']), 'Привет koryangelo');
});

test('restore: with no parts the text is returned unchanged', () => {
  assert.strictEqual(restore('Привет', []), 'Привет');
});
