import type { Dist } from "./types";

export type Rng = () => number;
export const DEFAULT_SEED = 72000;

/** Generador mulberry32: determinista, rápido, 32 bits. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function expo(r: Rng, mean: number): number {
  return -Math.log(1 - r()) * mean;
}

export function normal(r: Rng): number {
  const u = 1 - r();
  const v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function sampleDist(r: Rng, d: Dist): number {
  if (d.mean <= 0) return 0;
  if (d.kind === "fixed") return d.mean;
  if (d.kind === "exp") return expo(r, d.mean);
  const cv = Math.max(d.cv, 1e-6);
  const s2 = Math.log(1 + cv * cv);
  const mu = Math.log(d.mean) - s2 / 2;
  return Math.exp(mu + Math.sqrt(s2) * normal(r));
}

export function pick<T>(r: Rng, arr: readonly T[]): T {
  return arr[Math.floor(r() * arr.length) % arr.length]!;
}
