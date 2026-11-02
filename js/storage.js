// Everything is kept in localStorage on this device/browser.

function read(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export const loadSettings = () => read('tm.settings', {});
export const saveSettings = (s) => write('tm.settings', {
  currency: s.currency,
  difficulty: s.difficulty,
  inputStyle: s.inputStyle,
});

export const getAttempts = () => read('tm.attempts', []);
export function addAttempt(attempt) {
  const list = getAttempts();
  list.push(attempt);
  write('tm.attempts', list);
}
export const clearAttempts = () => localStorage.removeItem('tm.attempts');

export function getMenu() {
  return read('tm.menu', []).sort((a, b) => a.name.localeCompare(b.name));
}
export function saveMenuItem(item) {
  const list = read('tm.menu', []).filter((i) => i.id !== item.id);
  list.push(item);
  write('tm.menu', list);
}
export function deleteMenuItem(id) {
  write('tm.menu', read('tm.menu', []).filter((i) => i.id !== id));
}
