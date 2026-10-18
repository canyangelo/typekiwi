// Gemini as the translator when the user has pasted their own API key (Google AI Studio, free tier).
// A language model reads chat the way people write it: slang, typos, missing punctuation, gaming and trading talk,
// and the lines before it. Pure helpers here (tested in node); the network calls live in background.js.
(function (root) {
  const API = 'https://generativelanguage.googleapis.com/v1beta';

  // Model ids change every few months ("gemini-2.5-flash", "gemini-3.8-flash", ...), so the best ones are picked from
  // the key's own model list: the newest stable Flash for quality, the newest Flash-Lite for volume (it has the
  // larger free quota). Previews only when no stable one exists.
  function pickModels(models) {
    const found = { flash: [], lite: [] };
    for (const m of models || []) {
      const id = String(m.name || '').replace(/^models\//, '');
      if (m.supportedGenerationMethods && !m.supportedGenerationMethods.includes('generateContent')) continue;
      const g = id.match(/^gemini-(\d+(?:\.\d+)?)-flash(-lite)?(-preview(?:-[\d-]+)?)?$/);
      if (!g) continue;
      found[g[2] ? 'lite' : 'flash'].push({ id, version: parseFloat(g[1]), preview: !!g[3] });
    }
    const best = list => list.sort((a, b) => (a.preview - b.preview) || (b.version - a.version))[0]?.id || '';
    const flash = best(found.flash);
    const lite = best(found.lite);
    return { flash: flash || lite, lite: lite || flash };
  }

  // Thinking makes answers slower and isn't needed to translate a chat line.
  function thinkingFor(model) {
    const v = parseFloat((model.match(/^gemini-(\d+(?:\.\d+)?)/) || [])[1]);
    if (!v) return null;
    if (v >= 3) return { thinkingLevel: /lite/.test(model) ? 'minimal' : 'low' };
    if (v >= 2.5 && !/lite/.test(model)) return { thinkingBudget: 0 };
    return null;
  }

  const SYSTEM = [
    'You translate chat messages between people who don\'t share a language.',
    'Translate the MESSAGE into {LANG}. It comes from an online chat (often gaming, trading or marketplace chats):',
    'understand slang, abbreviations, typos, missing punctuation and gamer talk, and write it the way a native speaker',
    'would type it in a chat: natural, the same tone and roughly the same length; casual stays casual.',
    'Keep placeholders like __0__ exactly as they are. Keep usernames, links, numbers and emoji.',
    'Only translate: never answer, comment or explain.',
    'The CONTEXT lines are earlier messages of the same chat, for meaning only; do not translate them.',
    'If the message is already in {LANG}, return it unchanged.',
    'Reply with JSON: {"src": "<ISO 639-1 code of the message\'s language>", "text": "<the translation>"}.',
  ].join(' ');

  // context: earlier lines of the chat, oldest first, as { me: bool, text } (at most a few, each cut short).
  function buildRequest(text, langName, context, model) {
    const lines = (context || []).slice(-4).map(c => (c.me ? 'me: ' : 'them: ') + String(c.text).slice(0, 300));
    const prompt = (lines.length ? 'CONTEXT:\n' + lines.join('\n') + '\n\n' : '') + 'MESSAGE:\n' + text;
    const generationConfig = {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: { src: { type: 'STRING' }, text: { type: 'STRING' } },
        required: ['src', 'text'],
      },
    };
    const thinking = thinkingFor(model || '');
    if (thinking) generationConfig.thinkingConfig = thinking;
    return {
      systemInstruction: { parts: [{ text: SYSTEM.replace(/\{LANG\}/g, langName) }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig,
    };
  }

  // Returns { text, src } or throws. Thought parts are skipped; a JSON reply wrapped in ``` fences is accepted.
  function parseResponse(json) {
    const cand = json && json.candidates && json.candidates[0];
    const raw = ((cand && cand.content && cand.content.parts) || []).filter(p => !p.thought).map(p => p.text || '').join('');
    if (!raw) throw new Error('gemini: empty answer' + (cand && cand.finishReason ? ' (' + cand.finishReason + ')' : ''));
    let obj;
    try { obj = JSON.parse(raw.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, '')); } catch (_) { throw new Error('gemini: not JSON'); }
    const text = String(obj.text || '').trim();
    if (!text) throw new Error('gemini: no text');
    return { text, src: String(obj.src || '').toLowerCase().split(/[-_]/)[0] };
  }

  const api = { GEMINI_API: API, pickModels, thinkingFor, buildRequest, parseResponse };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CC = Object.assign(root.CC || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this);
