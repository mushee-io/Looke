/**
 * Utilities for sorting fictional preview-market data.
 * This module does not fetch prices, verify liquidity, or compute on-chain values.
 */
export function parseCompactNumber(input) {
  const cleaned = String(input).trim().toLowerCase().replace(/[$,]/g, "");
  const match = /^(\d+(?:\.\d+)?)([kmb])?$/.exec(cleaned);
  if (!match) return Number.NaN;
  const scale = { k: 1_000, m: 1_000_000, b: 1_000_000_000 };
  return Number(match[1]) * (scale[match[2]] ?? 1);
}
export function parseAgeHours(input) {
  const match = /^(\d+(?:\.\d+)?)(m|h|d|w)$/.exec(String(input).trim().toLowerCase());
  if (!match) return Number.NaN;
  const hours = { m: 1 / 60, h: 1, d: 24, w: 168 };
  return Number(match[1]) * hours[match[2]];
}
