/** Number formatting for the UI: decimal comma in both languages, exact values first. */
import * as R from '../core/rational';
import type { Rational } from '../core/rational';

const comma = (s: string): string => s.replace('.', ',').replace(/^-/, '−');

/** Number with `dec` decimals, trailing zeros removed. */
export function fmtN(x: number, dec = 3): string {
  if (!Number.isFinite(x)) return '—';
  let s = x.toFixed(dec);
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return comma(s === '-0' ? '0' : s);
}

/** Exact value: "12", "2,5", or "40/3 ≈ 13,333" for a non-terminating fraction. */
export function fmtR(r: Rational, dec = 3): string {
  if (R.isInteger(r)) return comma(r.n.toString());
  let d = r.d;
  while (d % 2n === 0n) d /= 2n;
  while (d % 5n === 0n) d /= 5n;
  const approx = fmtN(R.toNumber(r), dec);
  if (d === 1n && R.eq(R.round(r, dec), r)) return approx;
  return `${comma(R.toString(r))} ≈ ${approx}`;
}

/** Percent of a fraction: 9/10 → "90 %". */
export const fmtPct = (r: Rational | number, dec = 2): string => `${fmtN(100 * (typeof r === 'number' ? r : R.toNumber(r)), dec)} %`;

/** Grader strings ("40/3 min", "90.00 %") for display: decimal comma and the decimal value of fractions. */
export function showGraded(s: string | undefined): string {
  if (s === undefined) return '';
  return s
    .replace(/(-?\d+)\/(\d+)/g, (m, a: string, b: string) => {
      const r = R.q(BigInt(a), BigInt(b));
      return R.isInteger(r) ? m : `${m} ≈ ${fmtN(R.toNumber(r), 3)}`;
    })
    .replace(/(\d)\.(\d)/g, '$1,$2');
}
