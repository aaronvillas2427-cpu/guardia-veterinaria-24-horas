import { expo, mulberry32 } from "./rng";
import { ci95, type Stat } from "./stats";

export interface StayInput {
  admissionsPerDay: number;
  meanStayDays: number;
  cages: number;
  horizonDays: number;
  seed: number;
  /** Días iniciales excluidos del cálculo de bloqueo. */
  warmupDays?: number;
}

export interface Stay {
  pid: number;
  cage: number;
  admit: number;
  discharge: number;
}

export interface StayResult {
  stays: Stay[];
  referred: { pid: number; t: number }[];
  arrivals: number;
  blocking: number;
}

/** Sistema de pérdida M/G/c/c: si no hay jaula libre, el paciente se refiere. Se asigna la jaula libre de menor número. */
export function simulateStays(input: StayInput): StayResult {
  const r = mulberry32(input.seed);
  const free = new Array(Math.max(0, Math.floor(input.cages))).fill(0);
  const stays: Stay[] = [];
  const referred: { pid: number; t: number }[] = [];
  const warm = input.warmupDays ?? 0;
  let counted = 0;
  let blocked = 0;
  let pid = 0;
  if (input.admissionsPerDay <= 0) return { stays, referred, arrivals: 0, blocking: 0 };
  for (let t = expo(r, 1 / input.admissionsPerDay); t < input.horizonDays; t += expo(r, 1 / input.admissionsPerDay)) {
    const stay = expo(r, input.meanStayDays);
    const id = pid++;
    let cage = -1;
    for (let i = 0; i < free.length; i++)
      if (free[i] <= t) {
        cage = i;
        break;
      }
    if (t >= warm) counted++;
    if (cage < 0) {
      referred.push({ pid: id, t });
      if (t >= warm) blocked++;
    } else {
      free[cage] = t + stay;
      stays.push({ pid: id, cage, admit: t, discharge: t + stay });
    }
  }
  return { stays, referred, arrivals: pid, blocking: counted ? blocked / counted : 0 };
}

/** Valida Erlang B con réplicas de la simulación de estancias. */
export function validateBlocking(
  base: Omit<StayInput, "seed" | "horizonDays" | "warmupDays">,
  seed: number,
  reps = 10,
  horizonDays = 730,
): Stat {
  const warmupDays = Math.max(5, base.meanStayDays * 10);
  const xs: number[] = [];
  for (let i = 0; i < reps; i++)
    xs.push(simulateStays({ ...base, seed: (seed + i * 104729) >>> 0, horizonDays: horizonDays + warmupDays, warmupDays }).blocking);
  return ci95(xs);
}
