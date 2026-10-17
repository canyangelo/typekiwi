const test = require('node:test');
const assert = require('node:assert');
const { nextSource } = require('../src/diff.js');

test('first input: the whole field is the source text', () => {
  assert.deepStrictEqual(nextSource({ field: 'merhaba', lastApplied: '', source: '' }), { source: 'merhaba', changed: true });
});

test('field equals the last translation: no change', () => {
  assert.deepStrictEqual(nextSource({ field: 'Привет', lastApplied: 'Привет', source: 'merhaba' }), { source: 'merhaba', changed: false });
});

test('a new part appended at the end is appended to the source text', () => {
  assert.deepStrictEqual(
    nextSource({ field: 'Привет nasılsın', lastApplied: 'Привет', source: 'merhaba' }),
    { source: 'merhaba nasılsın', changed: true });
});

test('field cleared: state resets', () => {
  assert.deepStrictEqual(nextSource({ field: '  ', lastApplied: 'Привет', source: 'merhaba' }), { source: '', changed: true });
});

test('empty field, empty state: no change', () => {
  assert.deepStrictEqual(nextSource({ field: '', lastApplied: '', source: '' }), { source: '', changed: false });
});

test('edit in the middle: the whole field becomes the new source text', () => {
  assert.deepStrictEqual(
    nextSource({ field: 'Прет', lastApplied: 'Привет', source: 'merhaba' }),
    { source: 'Прет', changed: true });
});
