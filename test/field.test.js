const test = require('node:test');
const assert = require('node:assert');
const { isTextField, siteKey, isSiteOff, editableText, normText, sameText } = require('../src/field.js');

// ---------------- isTextField ----------------

test('textarea and plain input are translated', () => {
  assert.strictEqual(isTextField({ tag: 'textarea' }), true);
  assert.strictEqual(isTextField({ tag: 'input', type: 'text' }), true);
  assert.strictEqual(isTextField({ tag: 'input', type: '' }), true);
  assert.strictEqual(isTextField({ tag: 'div', editable: true }), true);
});

test('password, email, search, number types are not translated', () => {
  for (const type of ['password', 'email', 'search', 'tel', 'url', 'number', 'checkbox', 'date']) {
    assert.strictEqual(isTextField({ tag: 'input', type }), false, type);
  }
});

test('non-editable div and locked field are not translated', () => {
  assert.strictEqual(isTextField({ tag: 'div' }), false);
  assert.strictEqual(isTextField({ tag: 'textarea', readOnly: true }), false);
  assert.strictEqual(isTextField({ tag: 'input', type: 'text', disabled: true }), false);
});

test('autocomplete excludes login/email/card fields', () => {
  for (const ac of ['username', 'email', 'current-password', 'one-time-code', 'cc-number', 'section-x email', 'tel']) {
    assert.strictEqual(isTextField({ tag: 'input', type: 'text', autocomplete: ac }), false, ac);
  }
  assert.strictEqual(isTextField({ tag: 'input', type: 'text', autocomplete: 'off' }), true);
});

test('search role and inputmode are excluded', () => {
  assert.strictEqual(isTextField({ tag: 'div', editable: true, role: 'searchbox' }), false);
  assert.strictEqual(isTextField({ tag: 'input', type: 'text', inputMode: 'search' }), false);
  assert.strictEqual(isTextField({ tag: 'input', type: 'text', inputMode: 'email' }), false);
});

test('not translated when name/placeholder/label says search or login', () => {
  const no = [
    { placeholder: 'Search' }, { placeholder: 'Поиск' }, { placeholder: 'Sohbetlerde ara' }, { placeholder: 'Ara' },
    { ariaLabel: 'Search' }, { name: 'q' }, { name: 'login' }, { id: 'email' }, { placeholder: 'E-posta adresin' },
    { placeholder: 'Şifre' }, { placeholder: 'Пароль' }, { className: 'input-search-input' }, { name: 'captcha' },
  ];
  for (const extra of no) assert.strictEqual(isTextField({ tag: 'input', type: 'text', ...extra }), false, JSON.stringify(extra));
});

test('chat fields pass (the word "ara" inside another word does not count)', () => {
  const yes = [
    { ariaLabel: 'Message #genel', role: 'textbox' }, { placeholder: 'Mesaj yaz…' }, { placeholder: 'Karakter adını yaz' },
    { placeholder: 'Сообщение' }, { className: 'input-message-input' }, { name: 'content' }, { placeholder: 'Paragraf' },
  ];
  for (const extra of yes) assert.strictEqual(isTextField({ tag: 'div', editable: true, ...extra }), true, JSON.stringify(extra));
});

// ---------------- siteKey / isSiteOff ----------------

test('siteKey strips www and uppercase', () => {
  assert.strictEqual(siteKey('WWW.Discord.com'), 'discord.com');
  assert.strictEqual(siteKey('web.telegram.org'), 'web.telegram.org');
  assert.strictEqual(siteKey(''), '');
});

test('isSiteOff also disables subdomains', () => {
  assert.strictEqual(isSiteOff('discord.com', ['discord.com']), true);
  assert.strictEqual(isSiteOff('ptb.discord.com', ['discord.com']), true);
  assert.strictEqual(isSiteOff('notdiscord.com', ['discord.com']), false);
  assert.strictEqual(isSiteOff('www.funpay.com', ['funpay.com']), true);
  assert.strictEqual(isSiteOff('funpay.com', []), false);
  assert.strictEqual(isSiteOff('funpay.com', undefined), false);
});

// ---------------- editableText ----------------

const T = s => ({ nodeType: 3, nodeValue: s });
const E = (name, attrs, ...kids) => ({
  nodeType: 1, nodeName: name.toUpperCase(), childNodes: kids,
  getAttribute: k => (attrs && k in attrs ? attrs[k] : null),
});

test('plain text and line break', () => {
  assert.strictEqual(editableText(E('div', null, T('merhaba'), E('br'), T('nasılsın'))), 'merhaba\nnasılsın');
});

test('block elements become separate lines, trailing empty line is dropped', () => {
  const root = E('div', null,
    E('div', null, E('span', null, T('bir'))),
    E('div', null, E('span', null, T('iki'))),
    E('div', null, E('br')));
  assert.strictEqual(editableText(root), 'bir\niki');
});

test('placeholder and contenteditable=false are skipped, zero-width is removed', () => {
  const root = E('div', null,
    E('div', { 'data-slate-node': 'element' },
      E('span', { 'data-slate-placeholder': 'true', contenteditable: 'false' }, T('Message #genel')),
      E('span', { 'data-slate-zero-width': 'n' }, T('﻿'))));
  assert.strictEqual(editableText(root), '');
});

test('emoji image is read via its alt text, nbsp becomes a space', () => {
  const root = E('div', null, T('selam '), E('img', { alt: '😀' }), T(' dostum'));
  assert.strictEqual(editableText(root), 'selam 😀 dostum');
});

// ---------------- normText / sameText ----------------

test('normText', () => {
  assert.strictEqual(normText('a b​﻿\n\n'), 'a b');
  assert.strictEqual(normText('a\r\nb'), 'a\nb');
});

test('sameText ignores whitespace differences', () => {
  assert.strictEqual(sameText('Привет,  как дела? ', 'Привет, как дела?'), true);
  assert.strictEqual(sameText('Привет', 'merhaba'), false);
  assert.strictEqual(sameText('a\nb', 'a b'), true);
});

const { incomingSite } = require('../src/field.js');

test('incomingSite picks the incoming-message adapter', () => {
  assert.strictEqual(incomingSite('funpay.com', '/chat/'), 'funpay');
  assert.strictEqual(incomingSite('discord.com', '/channels/@me/1'), 'discord');
  assert.strictEqual(incomingSite('ptb.discord.com', '/channels/1/2'), 'discord');
  assert.strictEqual(incomingSite('web.telegram.org', '/k/'), 'tg-k');
  assert.strictEqual(incomingSite('web.telegram.org', '/a/'), 'tg-a');
  assert.strictEqual(incomingSite('web.telegram.org', '/'), null);
  assert.strictEqual(incomingSite('example.com', '/'), null);
  assert.strictEqual(incomingSite('notdiscord.com', '/channels/1'), null);
});

const { chromeLang, sameLang, pickSource } = require('../src/field.js');

test('chromeLang maps our codes to the ones Chrome\'s Translator expects', () => {
  assert.strictEqual(chromeLang('zh-CN'), 'zh');
  assert.strictEqual(chromeLang('zh-TW'), 'zh-Hant');
  assert.strictEqual(chromeLang('ru'), 'ru');
});

test('sameLang compares base languages', () => {
  assert.strictEqual(sameLang('zh', 'zh-CN'), true);
  assert.strictEqual(sameLang('ar-Latn', 'ar'), true);
  assert.strictEqual(sameLang('tr', 'ru'), false);
});

test('pickSource trusts a confident detection, otherwise falls back to the hint', () => {
  assert.strictEqual(pickSource([{ detectedLanguage: 'tr', confidence: 0.75 }], 'en'), 'tr');
  assert.strictEqual(pickSource([{ detectedLanguage: 'en', confidence: 0.38 }], 'tr'), 'tr');
  assert.strictEqual(pickSource([{ detectedLanguage: 'und', confidence: 0.9 }], 'tr'), 'tr');
  assert.strictEqual(pickSource([{ detectedLanguage: 'ar-Latn', confidence: 0.8 }], 'tr'), 'ar');
  assert.strictEqual(pickSource(null, 'ru'), 'ru');
  assert.strictEqual(pickSource([], ''), '');
});

test('pickSource prefers the chat language when the detector also considers it (short messages)', () => {
  // Real detector output for short Russian replies (Chrome 155).
  assert.strictEqual(pickSource([{ detectedLanguage: 'be', confidence: 0.51 }, { detectedLanguage: 'ru', confidence: 0.45 }], 'ru'), 'ru'); // выдаю?
  assert.strictEqual(pickSource([{ detectedLanguage: 'bg', confidence: 0.41 }, { detectedLanguage: 'ru', confidence: 0.25 }], 'ru'), 'ru'); // спс
  assert.strictEqual(pickSource([{ detectedLanguage: 'sr', confidence: 0.38 }, { detectedLanguage: 'bg', confidence: 0.16 }], 'ru'), 'ru'); // да
});

test('pickSource keeps a clear detection over the hint', () => {
  assert.strictEqual(pickSource([{ detectedLanguage: 'en', confidence: 0.95 }, { detectedLanguage: 'ru', confidence: 0.03 }], 'ru'), 'en');
  assert.strictEqual(pickSource([{ detectedLanguage: 'tr', confidence: 0.75 }, { detectedLanguage: 'ru', confidence: 0.2 }], 'ru'), 'tr');
});
