const test = require('node:test');
const assert = require('node:assert');
const { pickModels, thinkingFor, buildRequest, parseResponse } = require('../src/gemini.js');

const m = (id, methods = ['generateContent']) => ({ name: 'models/' + id, supportedGenerationMethods: methods });

test('pickModels takes the newest stable Flash and Flash-Lite', () => {
  const list = [m('gemini-2.5-flash'), m('gemini-3.8-flash'), m('gemini-3.6-flash'), m('gemini-3.5-flash-lite'),
    m('gemini-2.5-flash-lite'), m('gemini-3.1-pro-preview'), m('gemini-3.1-flash-image'), m('gemini-3.9-flash-preview'),
    m('text-embedding-004', ['embedContent'])];
  assert.deepStrictEqual(pickModels(list), { flash: 'gemini-3.8-flash', lite: 'gemini-3.5-flash-lite' });
});

test('pickModels falls back to previews, and to the other tier when one is missing', () => {
  assert.deepStrictEqual(pickModels([m('gemini-3-flash-preview')]), { flash: 'gemini-3-flash-preview', lite: 'gemini-3-flash-preview' });
  assert.deepStrictEqual(pickModels([m('gemini-2.5-flash-lite')]), { flash: 'gemini-2.5-flash-lite', lite: 'gemini-2.5-flash-lite' });
  assert.deepStrictEqual(pickModels([]), { flash: '', lite: '' });
});

test('thinking is kept to the minimum each generation allows', () => {
  assert.deepStrictEqual(thinkingFor('gemini-3.8-flash'), { thinkingLevel: 'low' });
  assert.deepStrictEqual(thinkingFor('gemini-3.5-flash-lite'), { thinkingLevel: 'minimal' });
  assert.deepStrictEqual(thinkingFor('gemini-2.5-flash'), { thinkingBudget: 0 });
  assert.strictEqual(thinkingFor('gemini-2.5-flash-lite'), null);
});

test('buildRequest puts the context before the message and asks for JSON', () => {
  const body = buildRequest('через меня заходите', 'Turkish',
    [{ me: true, text: 'kanka hangi sunucu' }, { me: false, text: 'сервер 3' }], 'gemini-3.8-flash');
  assert.match(body.systemInstruction.parts[0].text, /into Turkish/);
  assert.strictEqual(body.contents[0].parts[0].text, 'CONTEXT:\nme: kanka hangi sunucu\nthem: сервер 3\n\nMESSAGE:\nчерез меня заходите');
  assert.strictEqual(body.generationConfig.responseMimeType, 'application/json');
  assert.deepStrictEqual(body.generationConfig.thinkingConfig, { thinkingLevel: 'low' });
  assert.strictEqual(buildRequest('hi', 'Russian', [], 'gemini-2.5-flash-lite').contents[0].parts[0].text, 'MESSAGE:\nhi');
});

test('parseResponse reads the JSON answer and skips thought parts', () => {
  const r = { candidates: [{ content: { parts: [{ thought: true, text: 'hmm' }, { text: '{"src":"ru","text":"Benim üzerimden girin"}' }] } }] };
  assert.deepStrictEqual(parseResponse(r), { text: 'Benim üzerimden girin', src: 'ru' });
  const fenced = { candidates: [{ content: { parts: [{ text: '```json\n{"src":"pt-BR","text":"ok"}\n```' }] } }] };
  assert.deepStrictEqual(parseResponse(fenced), { text: 'ok', src: 'pt' });
  assert.throws(() => parseResponse({ candidates: [{ finishReason: 'SAFETY' }] }), /SAFETY/);
  assert.throws(() => parseResponse({ candidates: [{ content: { parts: [{ text: 'not json' }] } }] }), /not JSON/);
});
