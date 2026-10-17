// Derives the original (source) text to translate from the text in the field.
// field: text in the field, lastApplied: the translation the extension last wrote into the field,
// source: the original text of that translation.
(function (root) {
  function nextSource({ field, lastApplied, source }) {
    if (!field.trim()) return { source: '', changed: source !== '' || lastApplied !== '' };
    if (field === lastApplied) return { source, changed: false };
    if (lastApplied && field.startsWith(lastApplied)) {
      return { source: source + field.slice(lastApplied.length), changed: true };
    }
    return { source: field, changed: true };
  }

  const api = { nextSource };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CC = Object.assign(root.CC || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this);
