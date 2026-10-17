const test = require('node:test');
const assert = require('node:assert');
const { findTurkishNames, capitalizeNames } = require('../src/tr-names.js');

test('a common name is found in lowercase too', () => {
  assert.deepStrictEqual(findTurkishNames('merhaba dostum benim adım necati'), ['necati']);
  assert.deepStrictEqual(findTurkishNames('mehmet ve ayşe geldi'), ['mehmet', 'ayşe']);
});

test('a name written in uppercase and with dotted capital I', () => {
  assert.deepStrictEqual(findTurkishNames('İbrahim abiye sor'), ['İbrahim']);
  assert.deepStrictEqual(findTurkishNames('NECATİ burada'), ['NECATİ']);
});

test('names that are also ordinary words are not found from the list', () => {
  assert.deepStrictEqual(findTurkishNames('deniz kenarında umut var, barış olsun'), []);
  assert.deepStrictEqual(findTurkishNames('bu metin uzun'), []);
});

test('any word after adım/ismim is a name', () => {
  assert.deepStrictEqual(findTurkishNames('benim adım deniz'), ['deniz']);
  assert.deepStrictEqual(findTurkishNames('ismim Umut, memnun oldum'), ['Umut']);
  assert.deepStrictEqual(findTurkishNames('kardeşimin adı barış'), ['barış']);
});

test('the word before bey/hanım/abi/abla is a name', () => {
  assert.deepStrictEqual(findTurkishNames('deniz hanım yarın gelir'), ['deniz']);
  assert.deepStrictEqual(findTurkishNames('umut abi selam'), ['umut']);
  assert.deepStrictEqual(findTurkishNames('sayın metin yılmaz'), ['metin', 'yılmaz']);
});

test('a word with an apostrophe is a proper name (suffix dropped)', () => {
  assert.deepStrictEqual(findTurkishNames("deniz'e söyle"), ['deniz']);
  assert.deepStrictEqual(findTurkishNames('Kaan’ın hesabı'), ['Kaan']);
  assert.deepStrictEqual(findTurkishNames("n'aber"), []);
});

test('a repeated name is returned once', () => {
  assert.deepStrictEqual(findTurkishNames('necati necati Necati'), ['necati']);
});

test('empty text and text without names', () => {
  assert.deepStrictEqual(findTurkishNames(''), []);
  assert.deepStrictEqual(findTurkishNames('nasılsın iyi misin'), []);
});

test('capitalizeNames capitalizes the name in the translation', () => {
  assert.strictEqual(capitalizeNames('меня зовут necati', ['necati']), 'меня зовут Necati');
  assert.strictEqual(capitalizeNames('ibrahim и ırmak', ['ibrahim', 'ırmak']), 'İbrahim и Irmak');
  assert.strictEqual(capitalizeNames('necatiye', ['necati']), 'necatiye'); // untouched inside a word
  assert.strictEqual(capitalizeNames('Necati', ['necati']), 'Necati');
});

const { likelyTurkish } = require('../src/tr-names.js');

test('likelyTurkish: Turkish messages (skipped without a request)', () => {
  for (const t of ['ben bi idmana gidip gelicem', 'geliyorum', 'abi selam', 'ışık', 'naber nasılsın', 'Hadi rol @everyone', 'ben orda hep yanlızdım'])
    assert.strictEqual(likelyTurkish(t), true, t);
});

test('likelyTurkish: Russian/English are translated', () => {
  for (const t of ['привет как дела', 'can you refund please', 'Game: Valorant Region: North America', 'thanks', 'то у тя все мобилки и пк заберут'])
    assert.strictEqual(likelyTurkish(t), false, t);
});

test('English contractions are not names (didn\'t, I\'m, it\'s, you\'re, we\'ve, I\'ll, I\'d)', () => {
  assert.deepStrictEqual(findTurkishNames("I'm sorry, I didn't see it, it's fine, you're right, we've got it, I'll go, I'd say"), []);
  assert.deepStrictEqual(findTurkishNames("don’t worry"), []);
  assert.deepStrictEqual(findTurkishNames("Necati'ye söyle, Kaan'ın hesabı"), ['Necati', 'Kaan']);
});
