// Denominations and notes in minor units (pence, cents), descending for denominations.
export const MINOR_UNIT = 100;

export const CURRENCIES = {
  GBP: {
    label: 'Pound sterling (GBP)',
    denominations: [5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1],
    notes: [500, 1000, 2000, 5000],
  },
  EUR: {
    label: 'Euro (EUR)',
    denominations: [20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1],
    notes: [500, 1000, 2000, 5000, 10000, 20000],
  },
  USD: {
    label: 'US dollar (USD)',
    denominations: [10000, 5000, 2000, 1000, 500, 100, 50, 25, 10, 5, 1],
    notes: [500, 1000, 2000, 5000, 10000],
  },
};

const EURO_COUNTRIES = ['DE', 'FR', 'ES', 'IT', 'NL', 'IE', 'PT', 'BE', 'AT', 'FI', 'GR'];

/** Picks a default currency from the browser's language tag, e.g. "en-GB". */
export function defaultCurrency() {
  const country = (navigator.language || '').split('-')[1]?.toUpperCase();
  if (country === 'US') return 'USD';
  if (EURO_COUNTRIES.includes(country)) return 'EUR';
  return 'GBP';
}
