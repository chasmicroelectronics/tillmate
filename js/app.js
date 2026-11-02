import { CURRENCIES, defaultCurrency } from './currency.js';
import { format, plain, parse, breakdown } from './money.js';
import { nextRound } from './rounds.js';
import { rollingAccuracy, sessionScores } from './stats.js';
import * as store from './storage.js';

const SESSION_LENGTH = 10;

const settings = {
  currency: defaultCurrency(),
  difficulty: 'simple',
  inputStyle: 'countBack',
  ...store.loadSettings(),
};

const state = {
  tab: 'register',
  overlay: null,        // null | 'payment' | 'progress' | 'menuPicker' | 'menuManager' | 'menuForm'
  entry: 0,             // keypad amount on the register, minor units
  lastPrice: 0,
  basket: [],           // { uid, name?, unitPrice, quantity }
  received: 0,          // amount received on the payment screen
  session: null,        // current practise session
  editingId: null,      // menu item being edited
};

// Helpers

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const sumOf = (arr) => arr.reduce((a, b) => a + b, 0);
const total = () => sumOf(state.basket.map((l) => l.unitPrice * l.quantity));
const newLine = (unitPrice, name) => ({ uid: uid(), unitPrice, name, quantity: 1 });

function chip(amount, code, stacked = false) {
  const note = CURRENCIES[code].notes.includes(amount);
  return `<span class="chip ${stacked ? 'stacked' : ''}">
    <span class="icon">${note ? '💵' : '🪙'}</span>
    <span>${format(amount, code)}</span>
  </span>`;
}

function breakdownHtml(amount, code) {
  return breakdown(amount, code)
    .map(([d, n]) => `<div class="brk">${chip(d, code)}<span class="muted">× ${n}</span></div>`)
    .join('');
}

function keypad(pad) {
  const key = (label, action, value = '') =>
    `<button class="key" data-action="${action}" data-pad="${pad}" data-value="${value}">${label}</button>`;
  return `<div class="keypad">
    ${[[7, 8, 9], [4, 5, 6], [1, 2, 3]].map((row) => row.map((d) => key(d, 'key', d)).join('')).join('')}
    ${key('C', 'clear')}${key(0, 'key', 0)}${key('⌫', 'back')}
  </div>`;
}

function getPad(pad) { return pad === 'received' ? state.received : state.entry; }
function setPad(pad, value) {
  if (pad === 'received') state.received = value;
  else state.entry = value;
}

function findLine(id) { return state.basket.find((l) => l.uid === id); }

// Practise session

function startQuestion(s) {
  s.round = nextRound(s.code, s.difficulty);
  s.taps = [];
  s.feedback = null;
  s.startedAt = Date.now();
}

function ensureSession() {
  if (!state.session) {
    state.session = {
      id: uid(),
      code: settings.currency,
      difficulty: settings.difficulty,
      inputStyle: settings.inputStyle,
      number: 1,
      correct: 0,
      finished: false,
      round: null,
      taps: [],
      feedback: null,
      startedAt: 0,
    };
    startQuestion(state.session);
  }
  return state.session;
}

function submitAnswer(given, taps = []) {
  const s = state.session;
  if (!s || s.feedback) return;
  const correct = given === s.round.change;

  store.addAttempt({
    date: Date.now(),
    currency: s.code,
    difficulty: s.difficulty,
    inputStyle: s.inputStyle,
    price: s.round.price,
    tender: s.round.tender,
    answer: given,
    correct,
    responseMs: Date.now() - s.startedAt,
    sessionId: s.id,
  });

  if (correct) s.correct++;
  s.feedback = { correct, expected: s.round.change, given, taps };
  if (navigator.vibrate) navigator.vibrate(correct ? 30 : [60, 40, 60]);
}

// Settings

function saveSettings() {
  store.saveSettings(settings);
  state.session = null; // a settings change starts a fresh session
}

// Views

function registerView() {
  const cur = settings.currency;
  const shown = state.entry > 0 ? state.entry : state.lastPrice;

  const lines = state.basket.length
    ? state.basket.map((l) => `
        <li>
          <div class="line-main">
            <strong>${esc(l.name ?? format(l.unitPrice, cur))}</strong>
            <span class="muted">${l.quantity} × ${format(l.unitPrice, cur)}</span>
          </div>
          <div class="line-end">
            <span>${format(l.unitPrice * l.quantity, cur)}</span>
            <button data-action="dec" data-id="${l.uid}" aria-label="Decrease">−</button>
            <button data-action="inc" data-id="${l.uid}" aria-label="Increase">+</button>
            <button data-action="remove" data-id="${l.uid}" aria-label="Remove">✕</button>
          </div>
        </li>`).join('')
    : '<li class="empty">No items yet. Enter a price and tap Add, or pick from the menu.</li>';

  return `
    <section class="register">
      <ul class="lines">${lines}</ul>
      <div class="total"><span>Total</span><strong>${format(total(), cur)}</strong></div>
      <div class="pad-panel">
        <div class="display ${state.entry > 0 ? '' : 'muted'}">${format(shown, cur)}</div>
        ${keypad('entry')}
        <div class="row2">
          <button data-action="add" ${shown > 0 ? '' : 'disabled'}>Add item</button>
          <button class="primary" data-action="openPayment" ${state.basket.length ? '' : 'disabled'}>Take payment</button>
        </div>
      </div>
    </section>`;
}

function paymentView() {
  const cur = settings.currency;
  const due = total();
  const received = state.received;
  const change = received - due;
  const complete = '<button class="primary wide" data-action="completeSale">Complete sale</button>';

  let result;
  if (received < due) {
    result = `<p class="big-msg">Still to pay ${format(due - received, cur)}</p>`;
  } else if (change === 0) {
    result = `<p class="big-msg">Exact payment, no change due</p>${complete}`;
  } else {
    result = `
      <p class="muted center">Change due</p>
      <p class="big">${format(change, cur)}</p>
      ${breakdownHtml(change, cur)}
      <div style="margin-top:12px">${complete}</div>`;
  }

  const notes = [...CURRENCIES[cur].notes].reverse()
    .map((n) => `<button class="coin" data-action="addNote" data-value="${n}">${chip(n, cur, true)}</button>`)
    .join('');

  return `
    <section>
      <div class="amounts">
        <div><span class="muted">Total due</span><strong>${format(due, cur)}</strong></div>
        <div><span class="muted">Received</span><strong>${format(received, cur)}</strong></div>
      </div>
      ${result}
      <div class="quick">
        <button class="primary" data-action="exact">Exact</button>
        ${notes}
        <button data-action="clearReceived">Clear</button>
      </div>
      ${keypad('received')}
    </section>`;
}

function practiseView() {
  const s = ensureSession();
  if (s.finished) {
    return `
      <section class="center">
        <h2>Session complete</h2>
        <p class="big-msg">${s.correct} of ${SESSION_LENGTH} correct</p>
        <button class="primary" data-action="newSession">Start another session</button>
      </section>`;
  }

  const cur = s.code;
  const head = `
    <p class="muted center">Question ${s.number} of ${SESSION_LENGTH}</p>
    <p class="muted center">Price</p>
    <p class="price">${format(s.round.price, cur)}</p>
    <p class="center">Customer gives ${format(s.round.tender, cur)}</p>
    <hr>`;

  let body;
  if (s.feedback) {
    body = feedbackHtml(s) + `
      <button class="primary wide" data-action="nextQ">
        ${s.number >= SESSION_LENGTH ? 'See results' : 'Next'}
      </button>`;
  } else if (s.inputStyle === 'countBack') {
    body = countBackHtml(s);
  } else {
    body = `
      <p class="center muted">Change due</p>
      <input id="answer" class="answer" inputmode="decimal" placeholder="0.00" autocomplete="off">
      <p id="answerError" class="error"></p>
      <button class="primary wide" data-action="checkAnswer">Check</button>`;
  }

  return `<section>${head}${body}</section>`;
}

function countBackHtml(s) {
  const cur = s.code;
  const counted = s.round.price + sumOf(s.taps);
  const coins = CURRENCIES[cur].denominations
    .map((d) => `<button class="coin" data-action="tap" data-value="${d}" ${counted + d > s.round.tender ? 'disabled' : ''}>${chip(d, cur, true)}</button>`)
    .join('');

  return `
    <p class="center">Count up from ${format(s.round.price, cur)}</p>
    <p class="big">${format(counted, cur)}</p>
    <div class="coins">${coins}</div>
    <div class="row2">
      <button data-action="undo" ${s.taps.length ? '' : 'disabled'}>Undo</button>
      <button class="primary" data-action="doneCount" ${s.taps.length ? '' : 'disabled'}>Done</button>
    </div>`;
}

function feedbackHtml(s) {
  const f = s.feedback;
  const cur = s.code;
  const counted = f.taps.length
    ? `<p class="muted small">You counted</p>
       <div class="brk">${[...f.taps].sort((a, b) => b - a).map((t) => chip(t, cur)).join('')}</div>`
    : '';
  return `
    <div class="feedback ${f.correct ? 'ok' : 'bad'}">
      <p class="fb-title">${f.correct ? '✔ Correct' : '✖ Not quite'}</p>
      ${counted}
      ${f.correct ? '' : `<p>You entered ${format(f.given, cur)}</p>`}
      <p>Change due ${format(f.expected, cur)}</p>
      <p class="muted small">Made up of</p>
      ${breakdownHtml(f.expected, cur)}
    </div>`;
}

function progressView() {
  const attempts = store.getAttempts();
  if (attempts.length < 5) {
    return '<p class="center muted">Not enough answers yet. Complete a session to see your trend.</p>';
  }
  return `
    <div class="progress">
      <h3>Accuracy, last 20 answers</h3>
      ${lineSvg(rollingAccuracy(attempts))}
      <h3>Score per session</h3>
      ${barSvg(sessionScores(attempts))}
    </div>`;
}

function lineSvg(values) {
  const W = 640, H = 260, P = 40;
  const x = (i) => P + (values.length === 1 ? 0 : (i / (values.length - 1)) * (W - 2 * P));
  const y = (v) => H - P - (v / 100) * (H - 2 * P);
  const grid = [0, 50, 100]
    .map((g) => `<line class="grid" x1="${P}" x2="${W - P}" y1="${y(g)}" y2="${y(g)}"/>
                 <text class="axis" x="4" y="${y(g) + 6}">${g}%</text>`)
    .join('');
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Accuracy trend">
    ${grid}<polyline class="line" points="${points}"/>
  </svg>`;
}

function barSvg(sessions) {
  const W = 640, H = 220, P = 40;
  const slot = (W - 2 * P) / Math.max(sessions.length, 1);
  const barWidth = Math.min(28, slot * 0.6);
  const y = (v) => H - P - (v / 100) * (H - 2 * P);
  const grid = [0, 50, 100]
    .map((g) => `<line class="grid" x1="${P}" x2="${W - P}" y1="${y(g)}" y2="${y(g)}"/>
                 <text class="axis" x="4" y="${y(g) + 6}">${g}%</text>`)
    .join('');
  const bars = sessions.map((s, i) => {
    const cx = P + slot * i + slot / 2;
    return `<rect class="bar" x="${(cx - barWidth / 2).toFixed(1)}" y="${y(s.percent).toFixed(1)}"
              width="${barWidth.toFixed(1)}" height="${(H - P - y(s.percent)).toFixed(1)}" rx="4"/>`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Score per session">${grid}${bars}</svg>`;
}

function menuPickerView() {
  const items = store.getMenu();
  if (!items.length) {
    return '<p class="center muted">No menu items yet. Add them under Settings, Manage menu.</p>';
  }
  return `<ul class="lines">${items.map((i) => `
      <li><button class="menu-item" data-action="pickMenu" data-id="${i.id}">
        <span>${esc(i.name)}</span><span>${format(i.price, settings.currency)}</span>
      </button></li>`).join('')}
    </ul>`;
}

function menuManagerView() {
  const items = store.getMenu();
  const rows = items.length
    ? items.map((i) => `
        <li>
          <div class="line-main"><strong>${esc(i.name)}</strong></div>
          <div class="line-end">
            <span>${format(i.price, settings.currency)}</span>
            <button data-action="editMenuItem" data-id="${i.id}">Edit</button>
            <button data-action="deleteMenuItem" data-id="${i.id}" aria-label="Delete">✕</button>
          </div>
        </li>`).join('')
    : '<li class="empty">No menu items yet.</li>';
  return `<ul class="lines">${rows}</ul>
    <button class="primary wide" data-action="newMenuItem">+ Add item</button>`;
}

function menuFormView() {
  const existing = state.editingId ? store.getMenu().find((i) => i.id === state.editingId) : null;
  return `
    <label>Name
      <input id="m-name" maxlength="40" value="${esc(existing?.name ?? '')}">
    </label>
    <label>Price
      <input id="m-price" inputmode="decimal" placeholder="4.75" value="${existing ? plain(existing.price) : ''}">
    </label>
    <p id="m-error" class="error"></p>
    <div class="row2">
      <button data-action="closeOverlay">Cancel</button>
      <button class="primary" data-action="saveMenuItem">Save</button>
    </div>`;
}

function settingsView() {
  const seg = (action, options, current) => `
    <div class="seg">${Object.entries(options).map(([value, label]) =>
      `<button class="${value === current ? 'on' : ''}" data-action="${action}" data-value="${value}">${label}</button>`
    ).join('')}</div>`;

  const currencyOptions = Object.entries(CURRENCIES)
    .map(([code, c]) => `<option value="${code}" ${code === settings.currency ? 'selected' : ''}>${c.label}</option>`)
    .join('');

  return `
    <section class="settings">
      <h3>Currency</h3>
      <select data-setting="currency">${currencyOptions}</select>

      <h3>Difficulty</h3>
      ${seg('setDifficulty', { simple: 'Simple', difficult: 'Difficult' }, settings.difficulty)}

      <h3>Answer entry</h3>
      ${seg('setInput', { countBack: 'Count back', decimalPad: 'Decimal pad' }, settings.inputStyle)}

      <h3>Menu</h3>
      <button class="wide" data-action="openMenuManager">Manage menu</button>
      <div class="row2">
        <button data-action="exportMenu">Export menu</button>
        <button data-action="importMenu">Import menu</button>
      </div>
      <input type="file" id="menu-file" accept=".json,application/json" hidden>
      <p class="muted small">Export saves your menu as a file to keep or move to another device.
        Import adds new items and updates any with the same name.</p>

      <h3>Progress</h3>
      <button class="danger wide" data-action="askReset">Reset progress</button>
      <p class="muted small">Progress and the menu are stored on this device only.</p>
    </section>`;
}

// Overlays

function overlayTitle() {
  return {
    payment: 'Payment',
    progress: 'Progress',
    menuPicker: 'Menu',
    menuManager: 'Manage menu',
    menuForm: state.editingId ? 'Edit menu item' : 'New menu item',
  }[state.overlay] ?? '';
}

function overlayBody() {
  switch (state.overlay) {
    case 'payment': return paymentView();
    case 'progress': return progressView();
    case 'menuPicker': return menuPickerView();
    case 'menuManager': return menuManagerView();
    case 'menuForm': return menuFormView();
    default: return '';
  }
}

// Menu export and import

function exportMenu() {
  const items = store.getMenu();
  if (!items.length) {
    alert('There are no menu items to export yet.');
    return;
  }
  const payload = {
    app: 'till-mate',
    version: 1,
    currency: settings.currency,      // prices are stored in minor units of this currency
    exportedAt: new Date().toISOString(),
    items,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `till-mate-menu-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function importMenuFile(file) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    alert('That file is not valid JSON.');
    return;
  }
  if (!data || data.app !== 'till-mate' || !Array.isArray(data.items)) {
    alert('This does not look like a Till Mate menu file.');
    return;
  }
  if (data.currency && data.currency !== settings.currency) {
    const proceed = confirm(
      `These prices are in ${data.currency}, but your currency is ${settings.currency}. Import anyway?`
    );
    if (!proceed) return;
  }

  const existing = store.getMenu();
  let added = 0, updated = 0, skipped = 0;

  for (const raw of data.items) {
    const name = typeof raw?.name === 'string' ? raw.name.trim().slice(0, 40) : '';
    const price = Number.isInteger(raw?.price) && raw.price > 0 ? raw.price : null;
    if (!name || price === null) {
      skipped++;
      continue;
    }
    // Match by id (same device) or by name (another device), so re-importing never duplicates.
    const match = existing.find((i) => i.id === raw.id || i.name.toLowerCase() === name.toLowerCase());
    if (match) {
      store.saveMenuItem({ id: match.id, name, price });
      updated++;
    } else {
      const item = { id: uid(), name, price };
      store.saveMenuItem(item);
      existing.push(item);
      added++;
    }
  }

  alert(`Menu imported: ${added} added, ${updated} updated, ${skipped} skipped.`);
}

// Rendering and events

function render() {
  document.querySelectorAll('[data-tab]').forEach((b) =>
    b.classList.toggle('active', b.dataset.tab === state.tab));

  $('#title').textContent = { register: 'Register', practise: 'Practise', settings: 'Settings' }[state.tab];
  $('#topActions').innerHTML =
    state.tab === 'register' ? '<button data-action="openMenuPicker">Menu</button>'
    : state.tab === 'practise' ? '<button data-action="openProgress">Progress</button>'
    : '';

  $('#view').innerHTML =
    state.tab === 'register' ? registerView()
    : state.tab === 'practise' ? practiseView()
    : settingsView();

  const overlay = $('#overlay');
  if (state.overlay) {
    overlay.hidden = false;
    overlay.innerHTML = `
      <div class="sheet">
        <header><h2>${overlayTitle()}</h2><button data-action="closeOverlay">Close</button></header>
        <div class="sheet-body">${overlayBody()}</div>
      </div>`;
  } else {
    overlay.hidden = true;
    overlay.innerHTML = '';
  }

  const answer = document.getElementById('answer');
  if (answer) {
    answer.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') act('checkAnswer', {});
    });
  }
}

// Returns false when no re-render is needed (e.g. validation errors).
function handle(action, d) {
  switch (action) {
    case 'key': {
      const v = getPad(d.pad);
      if (v < 100000000) setPad(d.pad, v * 10 + Number(d.value));
      break;
    }
    case 'back': setPad(d.pad, Math.floor(getPad(d.pad) / 10)); break;
    case 'clear': setPad(d.pad, 0); break;

    case 'add': {
      const price = state.entry > 0 ? state.entry : state.lastPrice;
      if (price <= 0) break;
      state.basket.push(newLine(price));
      state.lastPrice = price;
      state.entry = 0;
      break;
    }
    case 'inc': { const l = findLine(d.id); if (l) l.quantity++; break; }
    case 'dec': {
      const l = findLine(d.id);
      if (!l) break;
      if (l.quantity > 1) l.quantity--;
      else state.basket = state.basket.filter((x) => x.uid !== d.id);
      break;
    }
    case 'remove': state.basket = state.basket.filter((x) => x.uid !== d.id); break;

    case 'openMenuPicker': state.overlay = 'menuPicker'; break;
    case 'pickMenu': {
      const item = store.getMenu().find((i) => i.id === d.id);
      if (item) state.basket.push(newLine(item.price, item.name));
      break;
    }

    case 'openPayment': state.received = 0; state.overlay = 'payment'; break;
    case 'exact': state.received = total(); break;
    case 'addNote': state.received += Number(d.value); break;
    case 'clearReceived': state.received = 0; break;
    case 'completeSale':
      state.basket = [];
      state.received = 0;
      state.entry = 0;
      state.overlay = null;
      break;

    case 'openProgress': state.overlay = 'progress'; break;
    case 'closeOverlay':
      state.overlay = state.overlay === 'menuForm' ? 'menuManager' : null;
      break;

    case 'newSession': state.session = null; break;
    case 'nextQ': {
      const s = state.session;
      if (!s) break;
      if (s.number >= SESSION_LENGTH) s.finished = true;
      else { s.number++; startQuestion(s); }
      break;
    }
    case 'tap': {
      const s = ensureSession();
      const v = Number(d.value);
      if (s.round.price + sumOf(s.taps) + v <= s.round.tender) s.taps.push(v);
      break;
    }
    case 'undo': state.session?.taps.pop(); break;
    case 'doneCount': {
      const s = state.session;
      if (s) submitAnswer(sumOf(s.taps), [...s.taps]);
      break;
    }
    case 'checkAnswer': {
      const minor = parse(document.getElementById('answer').value);
      if (minor === null) {
        document.getElementById('answerError').textContent = 'Enter an amount such as 4.75';
        return false;
      }
      submitAnswer(minor);
      break;
    }

    case 'setDifficulty': settings.difficulty = d.value; saveSettings(); break;
    case 'setInput': settings.inputStyle = d.value; saveSettings(); break;

    case 'openMenuManager': state.overlay = 'menuManager'; break;
    case 'newMenuItem': state.editingId = null; state.overlay = 'menuForm'; break;
    case 'editMenuItem': state.editingId = d.id; state.overlay = 'menuForm'; break;
    case 'saveMenuItem': {
      const name = document.getElementById('m-name').value.trim();
      const price = parse(document.getElementById('m-price').value);
      if (!name || !price) {
        document.getElementById('m-error').textContent = 'Enter a name and a price such as 4.75.';
        return false;
      }
      store.saveMenuItem({ id: state.editingId ?? uid(), name, price });
      state.overlay = 'menuManager';
      break;
    }
    case 'deleteMenuItem': store.deleteMenuItem(d.id); break;

    case 'exportMenu': exportMenu(); return false;
    case 'importMenu': document.getElementById('menu-file').click(); return false;

    case 'askReset':
      if (confirm('Reset all progress? This cannot be undone.')) store.clearAttempts();
      break;
  }
}

function act(action, data) {
  if (handle(action, data) !== false) render();
}

document.addEventListener('click', (e) => {
  const tab = e.target.closest('[data-tab]');
  if (tab) {
    state.tab = tab.dataset.tab;
    state.overlay = null;
    render();
    return;
  }
  const button = e.target.closest('[data-action]');
  if (button) act(button.dataset.action, button.dataset);
});

document.addEventListener('change', async (e) => {
  if (e.target.id === 'menu-file') {
    const file = e.target.files[0];
    e.target.value = '';   // allow choosing the same file again later
    if (file) await importMenuFile(file);
    render();
    return;
  }
  if (e.target.dataset.setting === 'currency') {
    settings.currency = e.target.value;
    saveSettings();
    render();
  }
});

render();
