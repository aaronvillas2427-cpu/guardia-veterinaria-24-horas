import { erlangB, erlangC, minCages, recommendVets, type ErlangCResult } from "./erlang";
import { DEFAULT_SEED } from "./rng";
import type { SimInput } from "./sim";
import { SPECIES, type DayType, type Params, type Species } from "./types";

export function defaultParams(): Params {
  return {
    seed: DEFAULT_SEED,
    replications: 30,
    lambdaWeekday: [
      1.4, 1.1, 0.9, 0.8, 0.8, 1.0, 1.6, 2.6, 3.8, 4.8, 5.4, 5.6, 5.2, 4.6, 4.4, 4.6, 5.0, 5.6, 6.0, 5.8,
      4.8, 3.6, 2.6, 1.9,
    ],
    weekendMult: 1.3,
    vetsWeekday: [2, 2, 1, 1, 1, 1, 2, 2, 3, 3, 4, 4, 4, 3, 3, 3, 3, 4, 4, 4, 3, 3, 2, 2],
    vetsWeekend: [2, 2, 2, 1, 1, 1, 2, 2, 3, 4, 4, 4, 4, 4, 3, 3, 4, 4, 5, 5, 4, 3, 3, 2],
    urgentShare: 0.25,
    serviceUrgencia: { kind: "lognormal", mean: 35, cv: 0.6 },
    serviceConsulta: { kind: "exp", mean: 20, cv: 1 },
    patienceMin: 45,
    patienceKind: "exp",
    cages: { perro: 16, gato: 10, exotico: 6 },
    admissionsPerDay: { perro: 10, gato: 6, exotico: 2 },
    meanStayDays: { perro: 1.2, gato: 1.4, exotico: 2.0 },
    targetServiceLevel: 0.8,
    targetMinutes: 20,
    targetBlocking: 0.05,
  };
}

export const round2 = (x: number) => Math.round(x * 100) / 100;

export function dayTypeOf(d: Date): DayType {
  const g = d.getDay();
  return g === 0 || g === 6 ? "weekend" : "weekday";
}

export function lambdaFor(p: Params, day: DayType): number[] {
  return p.lambdaWeekday.map((l) => (day === "weekend" ? l * p.weekendMult : l));
}

export function vetsFor(p: Params, day: DayType): number[] {
  return day === "weekend" ? p.vetsWeekend : p.vetsWeekday;
}

/** Tiempo medio de servicio combinado (min). */
export function meanServiceMin(p: Params): number {
  return p.urgentShare * p.serviceUrgencia.mean + (1 - p.urgentShare) * p.serviceConsulta.mean;
}

export function muPerHour(p: Params): number {
  const m = meanServiceMin(p);
  return m > 0 ? 60 / m : 0;
}

export function simInputFor(p: Params, day: DayType): SimInput {
  return {
    lambda: lambdaFor(p, day),
    vets: vetsFor(p, day),
    urgentShare: p.urgentShare,
    serviceUrgencia: p.serviceUrgencia,
    serviceConsulta: p.serviceConsulta,
    patienceMin: p.patienceMin,
    patienceKind: p.patienceKind,
    seed: p.seed,
    replications: p.replications,
  };
}

export interface ErlangRow extends ErlangCResult {
  hour: number;
  recommended: number;
}

export function erlangTable(p: Params, day: DayType): ErlangRow[] {
  const mu = muPerHour(p);
  const lam = lambdaFor(p, day);
  const vets = vetsFor(p, day);
  return lam.map((l, hour) => ({
    hour,
    ...erlangC(vets[hour], l, mu, p.targetMinutes),
    recommended: recommendVets(l, mu, p.targetMinutes, p.targetServiceLevel),
  }));
}

export interface CageRow {
  species: Species;
  a: number;
  cages: number;
  blocking: number;
  minCages: number;
}

export function cageAnalysis(p: Params): CageRow[] {
  return SPECIES.map((s) => {
    const a = p.admissionsPerDay[s] * p.meanStayDays[s];
    return { species: s, a, cages: p.cages[s], blocking: erlangB(p.cages[s], a), minCages: minCages(a, p.targetBlocking) };
  });
}

export function hourLabel(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}
