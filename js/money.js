import { CURRENCIES } from './currency.js';

// All arithmetic uses integer minor units. Division only happens for display.

export function format(minor, code) {
  const locale = navigator.language || 'en-GB';
  return new Intl.NumberFormat(locale, { style: 'currency', currency: code }).format(minor / 100);
}

/** A bare number such as "4.75", for pre-filling an input. */
export function plain(minor) {
  return `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, '0')}`;
}

/** Parses typed input into minor units. Accepts '.' or ',' and at most two decimals. */
export function parse(text) {
  const normalised = String(text).trim().replace(',', '.');
  const match = normalised.match(/^(\d*)(?:\.(\d{0,2}))?$/);
  if (!match) return null;
  const whole = match[1] || '';
  const frac = match[2] || '';
  if (!whole && !frac) return null;
  return parseInt(whole || '0', 10) * 100 + parseInt(frac.padEnd(2, '0'), 10);
}

/** Greedy split of an amount into [denomination, count] pairs, largest first. */
export function breakdown(amount, code) {
  let remaining = amount;
  const parts = [];
  for (const d of CURRENCIES[code].denominations) {
    if (remaining < d) continue;
    const count = Math.floor(remaining / d);
    remaining -= count * d;
    parts.push([d, count]);
  }
  return parts;
}
