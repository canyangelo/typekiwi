const DEFAULTS = { enabled: true, incoming: true, targetLang: 'ru', readLang: 'tr', keepList: [], offSites: [] };
const LANGS = [
  ['ru', 'Russian'], ['en', 'English'], ['tr', 'Turkish'], ['uk', 'Ukrainian'], ['de', 'German'],
  ['fr', 'French'], ['es', 'Spanish'], ['pt', 'Portuguese'], ['pl', 'Polish'], ['ar', 'Arabic'],
  ['zh-CN', 'Chinese'], ['kk', 'Kazakh'], ['az', 'Azerbaijani'],
];
const NAME = Object.fromEntries(LANGS);

const $ = id => document.getElementById(id);
for (const id of ['targetLang', 'readLang']) {
  for (const [code, name] of LANGS) $(id).add(new Option(name, code));
}

function parseList(s) {
  return s.split(/[,\n]/).map(w => w.trim()).filter(Boolean);
}

function showCodes() {
  $('targetCode').textContent = $('targetLang').value.split('-')[0].toUpperCase();
  $('readCode').textContent = $('readLang').value.split('-')[0].toUpperCase();
  const read = NAME[$('readLang').value] || $('readLang').value;
  const target = NAME[$('targetLang').value] || $('targetLang').value;
  const note = $('pairNote');
  note.replaceChildren(
    'Their messages are translated into ', bold(read), ',', document.createElement('br'),
    'yours into ', bold(target), '.');
  for (const p of document.querySelectorAll('.picker')) renderPicker(p);
}

function bold(text) {
  const b = document.createElement('b');
  b.textContent = text;
  return b;
}

// Flag language picker: drives the hidden <select>'s value (settings are saved via the select).
const CHEV = '<svg class="chev" viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';

function renderPicker(picker) {
  const select = $(picker.dataset.for);
  const code = select.value;
  picker.innerHTML =
    `<button type="button" class="langbtn" aria-haspopup="listbox" aria-expanded="false">${CC.flagSvg(code)}<span></span>${CHEV}</button>` +
    '<div class="menu" role="listbox" hidden></div>';
  picker.querySelector('.langbtn span').textContent = NAME[code] || code;
  const menu = picker.querySelector('.menu');
  for (const [c, name] of LANGS) {
    const item = document.createElement('button');
    item.type = 'button';
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', String(c === code));
    item.innerHTML = CC.flagSvg(c);
    item.append(name);
    item.addEventListener('click', () => {
      closeMenus();
      if (select.value === c) return;
      select.value = c;
      select.dispatchEvent(new Event('change'));
      downloadPairNow();   // this click is a user gesture: Chrome lets the language pack download start now
    });
    menu.append(item);
  }
  picker.querySelector('.langbtn').addEventListener('click', e => {
    e.stopPropagation();
    const open = menu.hidden;
    closeMenus();
    if (open) {
      menu.hidden = false;
      e.currentTarget.setAttribute('aria-expanded', 'true');
      (menu.querySelector('[aria-selected="true"]') || menu.firstElementChild).focus();
    }
  });
}

function closeMenus() {
  for (const m of document.querySelectorAll('.menu')) m.hidden = true;
  for (const b of document.querySelectorAll('.langbtn')) b.setAttribute('aria-expanded', 'false');
}
document.addEventListener('click', closeMenus);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeMenus();
  if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && e.target.closest?.('.menu')) {
    e.preventDefault();
    const sib = e.key === 'ArrowDown' ? e.target.nextElementSibling : e.target.previousElementSibling;
    sib?.focus();
  }
});

let savedTimer;
function flash() {
  $('saved').classList.add('on');
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => $('saved').classList.remove('on'), 1200);
}

function save() {
  showCodes();
  checkOffline();
  chrome.storage.sync.set({
    enabled: $('enabled').checked,
    incoming: $('incoming').checked,
    targetLang: $('targetLang').value,
    readLang: $('readLang').value,
    keepList: parseList($('keepList').value),
  }, flash);
}

function showLearned() {
  chrome.storage.local.get({ learnedNames: [] }, s => {
    const box = $('learned');
    box.replaceChildren(...s.learnedNames.map(n => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = n;
      return chip;
    }));
    box.style.display = 'contents';
    $('learnedRow').hidden = !s.learnedNames.length;
  });
}
showLearned();
$('clearLearned').addEventListener('click', () => chrome.storage.local.set({ learnedNames: [] }, showLearned));

// Current site: when switched off, nothing runs on that domain or its subdomains.
function setupSite(offSites) {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    let host = '';
    try {
      const u = new URL(tabs?.[0]?.url || '');
      if (/^https?:$/.test(u.protocol)) host = CC.siteKey(u.hostname);
    } catch (_) { /* chrome:// etc. */ }
    if (!host) return;
    $('siteName').textContent = host;
    $('siteSub').textContent = host;
    $('siteOn').checked = !CC.isSiteOff(host, offSites);
    $('siteRow').hidden = false;
    $('siteOn').addEventListener('change', () => {
      chrome.storage.sync.get({ offSites: [] }, s => {
        const rest = s.offSites.filter(k => !CC.isSiteOff(host, [k]) && !CC.isSiteOff(k, [host]));
        chrome.storage.sync.set({ offSites: $('siteOn').checked ? rest : [...rest, host] }, flash);
      });
    });
  });
}

// Chrome's on-device translator (Chrome 138+): no limits, nothing leaves the computer. Shows whether both
// directions of the chosen pair are downloaded and downloads a missing one (Chrome allows one download per click).
const chromeLang = c => (c === 'zh-CN' ? 'zh' : c === 'zh-TW' ? 'zh-Hant' : c);

async function packStates() {
  const read = $('readLang').value, target = $('targetLang').value;
  return Promise.all([[read, target], [target, read]].map(async ([from, to]) => ({
    from, to,
    state: await Translator.availability({ sourceLanguage: chromeLang(from), targetLanguage: chromeLang(to) }).catch(() => 'unavailable'),
  })));
}

async function checkOffline() {
  const row = $('offlineRow'), sub = $('offlineSub'), btn = $('offlineBtn');
  if (typeof self.Translator !== 'function' || $('readLang').value === $('targetLang').value) { row.hidden = true; return; }
  row.hidden = false;
  const states = await packStates();
  btn.hidden = !states.some(x => x.state === 'downloadable');
  // states[0]: what you write (your language -> theirs); states[1]: their messages (theirs -> yours).
  // Chrome downloads one direction per click, so say plainly which one is still missing.
  const [mine, theirs] = states.map(x => x.state === 'available');
  if (states.some(x => x.state === 'unavailable')) sub.textContent = 'Not offered for this pair; online services are used';
  else if (mine && theirs) sub.textContent = 'Ready: no limits, works without internet';
  else if (states.some(x => x.state === 'downloading')) sub.textContent = 'Downloading the language pack…';
  else if (mine) sub.textContent = 'Ready for what you write. One more Download for their messages.';
  else if (theirs) sub.textContent = 'Ready for their messages. One more Download for what you write.';
  else sub.textContent = 'Download once per direction for unlimited, offline translation.';
}

// Starts the language pack for the chosen pair right away. Must run synchronously inside a click (no await before
// Translator.create). If the pair is already on the device this just returns a ready translator.
function downloadPairNow() {
  if (typeof self.Translator !== 'function') return;
  const from = chromeLang($('readLang').value), to = chromeLang($('targetLang').value);
  if (from === to) return;
  Translator.create({
    sourceLanguage: from, targetLanguage: to,
    monitor(m) { m.addEventListener('downloadprogress', e => { $('offlineSub').textContent = `Downloading the language pack… ${Math.round(e.loaded * 100)}%`; }); },
  }).then(checkOffline, checkOffline);
}

$('offlineBtn').addEventListener('click', async () => {
  const btn = $('offlineBtn');
  const next = (await packStates()).find(x => x.state === 'downloadable');
  if (!next) { checkOffline(); return; }
  btn.disabled = true;
  btn.textContent = '0%';
  try {
    await Translator.create({
      sourceLanguage: chromeLang(next.from), targetLanguage: chromeLang(next.to),
      monitor(m) { m.addEventListener('downloadprogress', e => { btn.textContent = Math.round(e.loaded * 100) + '%'; }); },
    });
  } catch (e) {
    $('offlineSub').textContent = 'Download didn\'t start: ' + e.message;
  }
  btn.disabled = false;
  btn.textContent = 'Download';
  checkOffline();
});

// Gemini key: checked by the background against Google's model list, kept only on this computer (storage.local).
// The key itself is never shown again after saving, only its last four characters.
function showGemini() {
  chrome.storage.local.get({ geminiKey: '', geminiModels: null, geminiStatus: '' }, s => {
    const state = $('geminiState'), input = $('geminiKey'), btn = $('geminiBtn');
    const on = !!s.geminiKey;
    state.className = 'state ' + (on ? (s.geminiStatus === 'bad-key' ? 'bad' : 'on') : '');
    state.textContent = !on ? '' : s.geminiStatus === 'bad-key' ? '· key not accepted' : '· on (' + (s.geminiModels?.flash || 'Gemini') + ')';
    input.hidden = on;
    input.value = '';
    btn.textContent = on ? 'Remove key ••' + s.geminiKey.slice(-4) : 'Save';
    btn.disabled = false;
  });
}

$('geminiBtn').addEventListener('click', () => {
  const btn = $('geminiBtn'), input = $('geminiKey');
  const key = input.hidden ? '' : input.value.trim();
  if (!input.hidden && !key) { input.focus(); return; }
  btn.disabled = true;
  btn.textContent = key ? 'Checking…' : 'Removing…';
  chrome.runtime.sendMessage({ type: 'gemini-key', key }, res => {
    if (chrome.runtime.lastError || !res?.ok) {
      const err = res?.error || chrome.runtime.lastError?.message || '';
      $('geminiState').className = 'state bad';
      $('geminiState').textContent = err === 'bad-key' ? '· key not accepted' : err === 'no-model' ? '· no Gemini Flash model for this key'
        : '· couldn\'t reach Gemini, try again';
      btn.disabled = false;
      btn.textContent = 'Save';
      return;
    }
    flash();
    showGemini();
  });
});
$('geminiKey').addEventListener('keydown', e => { if (e.key === 'Enter') $('geminiBtn').click(); });
showGemini();

chrome.storage.sync.get(DEFAULTS, s => {
  setupSite(s.offSites);
  $('enabled').checked = s.enabled;
  $('incoming').checked = s.incoming;
  $('targetLang').value = s.targetLang;
  $('readLang').value = s.readLang;
  $('keepList').value = s.keepList.join(', ');
  showCodes();
  checkOffline();
  for (const id of ['enabled', 'incoming', 'targetLang', 'readLang']) $(id).addEventListener('change', save);
  $('keepList').addEventListener('input', () => { clearTimeout(save.t); save.t = setTimeout(save, 400); });
  requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.add('ready')));
});
