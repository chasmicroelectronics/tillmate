import { CURRENCIES } from './currency.js';

// Difficult mode rejects tenders that overpay by more than this (minor units).
const MAX_OVERPAYMENT = 5000;

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** One transaction: { price, tender, change }. */
export function nextRound(code, difficulty) {
  const price = difficulty === 'simple'
    ? (1 + Math.floor(Math.random() * 399)) * 25      // .00/.25/.50/.75 under 100
    : 1 + Math.floor(Math.random() * 15000);
  const tender = difficulty === 'simple'
    ? simpleTender(code, price)
    : randomTender(code, price);
  return { price, tender, change: tender - price };
}

// One common note just above the price, or stacked notes if the price is above them all.
function simpleTender(code, price) {
  const notes = CURRENCIES[code].notes;
  const candidates = notes.filter((n) => n > price).slice(0, 2);
  if (candidates.length) return pick(candidates);
  const largest = notes[notes.length - 1];
  let total = largest;
  while (total <= price) total += largest;
  return total;
}

// Random notes and coins until the price is covered, with overpayment capped.
function randomTender(code, price) {
  const denominations = CURRENCIES[code].denominations;
  for (let attempt = 0; attempt < 50; attempt++) {
    let total = 0;
    while (total <= price) total += pick(denominations);
    if (total - price <= MAX_OVERPAYMENT) return total;
  }
  return simpleTender(code, price);
}
