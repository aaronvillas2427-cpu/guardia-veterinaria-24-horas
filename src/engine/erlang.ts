/** Erlang B por la recurrencia estable B(0)=1, B(k)=a·B(k−1)/(k+a·B(k−1)). */
export function erlangB(c: number, a: number): number {
  if (a <= 0) return 0;
  let b = 1;
  for (let k = 1; k <= c; k++) b = (a * b) / (k + a * b);
  return b;
}

export interface ErlangCResult {
  c: number;
  lambda: number;
  mu: number;
  a: number;
  rho: number;
  /** Probabilidad de esperar. */
  pw: number;
  /** Espera media en cola, minutos; null si ρ ≥ 1 (insuficiente). */
  wqMin: number | null;
  /** Fracción atendida en ≤ t minutos; null si ρ ≥ 1. */
  ns: number | null;
  stable: boolean;
}

/**
 * Erlang C (M/M/c) a partir de Erlang B.
 * @param lambda llegadas por hora  @param mu servicios por hora por médico  @param tMin umbral en minutos
 */
export function erlangC(c: number, lambda: number, mu: number, tMin: number): ErlangCResult {
  const a = mu > 0 ? lambda / mu : Infinity;
  const rho = c > 0 ? a / c : Infinity;
  if (lambda <= 0) return { c, lambda, mu, a: 0, rho: 0, pw: 0, wqMin: 0, ns: 1, stable: true };
  if (!(rho < 1)) return { c, lambda, mu, a, rho, pw: 1, wqMin: null, ns: null, stable: false };
  const B = erlangB(c, a);
  const C = B / (1 - rho * (1 - B));
  const gap = c * mu - lambda; // por hora
  const wq = C / gap; // horas
  const ns = 1 - C * Math.exp(-gap * (tMin / 60));
  return { c, lambda, mu, a, rho, pw: C, wqMin: wq * 60, ns, stable: true };
}

/** Mínimo de médicos (≥1) que cumple NS(t) ≥ objetivo. */
export function recommendVets(lambda: number, mu: number, tMin: number, target: number, max = 60): number {
  for (let c = 1; c <= max; c++) {
    const r = erlangC(c, lambda, mu, tMin);
    if (r.stable && (r.ns ?? 0) >= target) return c;
  }
  return max;
}

/** Mínimo de jaulas con bloqueo ≤ objetivo. */
export function minCages(a: number, target: number, max = 1000): number {
  if (a <= 0) return 0;
  for (let c = 1; c <= max; c++) if (erlangB(c, a) <= target) return c;
  return max;
}
