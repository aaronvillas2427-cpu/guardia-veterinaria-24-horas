export interface Stat {
  mean: number;
  sd: number;
  lo: number;
  hi: number;
  n: number;
}

const T95 = [
  0, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16,
  2.145, 2.131, 2.12, 2.11, 2.101, 2.093, 2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052,
  2.048, 2.045,
];

export function tCrit95(df: number): number {
  if (df <= 0) return 0;
  return df < T95.length ? T95[df] : 1.96;
}

export function mean(xs: readonly number[]): number {
  if (!xs.length) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

export function sd(xs: readonly number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  let s = 0;
  for (const x of xs) s += (x - m) ** 2;
  return Math.sqrt(s / (xs.length - 1));
}

/** Media con intervalo de confianza del 95 % (t de Student). */
export function ci95(xs: readonly number[]): Stat {
  const m = mean(xs);
  const s = sd(xs);
  const half = xs.length > 1 ? (tCrit95(xs.length - 1) * s) / Math.sqrt(xs.length) : 0;
  return { mean: m, sd: s, lo: m - half, hi: m + half, n: xs.length };
}

/** Cuantil por interpolación lineal. */
export function quantile(xs: readonly number[], q: number): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * Math.min(1, Math.max(0, q));
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}
