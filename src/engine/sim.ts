import { expo, mulberry32, sampleDist } from "./rng";
import { ci95, quantile, type Stat } from "./stats";
import type { Dist } from "./types";

export interface SimInput {
  lambda: number[];
  vets: number[];
  urgentShare: number;
  serviceUrgencia: Dist;
  serviceConsulta: Dist;
  patienceMin: number;
  patienceKind: "exp" | "fixed";
  seed: number;
  replications: number;
}

export interface DayResult {
  arrivalsU: number;
  arrivalsC: number;
  abandoned: number;
  unserved: number;
  waitsU: number[];
  waitsC: number[];
  slotWaitSum: number[];
  slotServed: number[];
  slotAbandoned: number[];
}

export interface SimSummary {
  replications: number;
  seed: number;
  waitU: Stat;
  waitC: Stat;
  abandoned: Stat;
  abandonRate: Stat;
  arrivals: Stat;
  p90: number;
  p90U: number;
  p90C: number;
  slotWait: number[];
  slotAbandoned: number[];
  unserved: number;
}

// Tipos de evento; el número también es la prioridad ante empates de tiempo.
// Salidas y cambios de franja (que inician servicios) van antes que llegadas,
// y el vencimiento de paciencia va al final: si un inicio de servicio y una
// expiración coinciden en el mismo instante, se procesa primero el inicio.
const DEP = 0;
const SLOT = 1;
const ARR = 2;
const ABANDON = 3;

interface Ev {
  t: number;
  kind: number;
  seq: number;
  pid: number;
}

function less(x: Ev, y: Ev): boolean {
  if (x.t !== y.t) return x.t < y.t;
  if (x.kind !== y.kind) return x.kind < y.kind;
  return x.seq < y.seq;
}

export class EventHeap {
  private a: Ev[] = [];
  get size() {
    return this.a.length;
  }
  push(e: Ev) {
    const a = this.a;
    a.push(e);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!less(a[i], a[p])) break;
      [a[i], a[p]] = [a[p], a[i]];
      i = p;
    }
  }
  pop(): Ev | undefined {
    const a = this.a;
    if (!a.length) return undefined;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && less(a[l], a[m])) m = l;
        if (r < a.length && less(a[r], a[m])) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top;
  }
}

interface Patient {
  arr: number;
  urgent: boolean;
  start: number;
  gone: boolean;
  slot: number;
}

/** Simula un día de 24 h (minutos). Urgencias primero, sin expulsión; consultas abandonan. */
export function simulateDay(input: SimInput, seed: number): DayResult {
  const r = mulberry32(seed);
  const P: Patient[] = [];
  const heap = new EventHeap();
  let seq = 0;
  const push = (t: number, kind: number, pid = -1) => heap.push({ t, kind, seq: seq++, pid });

  for (let h = 0; h < 24; h++) {
    const rate = Math.max(0, input.lambda[h] ?? 0) / 60;
    if (rate <= 0) continue;
    let t = h * 60;
    for (;;) {
      t += expo(r, 1 / rate);
      if (t >= (h + 1) * 60) break;
      P.push({ arr: t, urgent: r() < input.urgentShare, start: -1, gone: false, slot: h });
      push(t, ARR, P.length - 1);
    }
  }
  for (let h = 1; h < 48; h++) push(h * 60, SLOT);

  const qU: number[] = [];
  const qC: number[] = [];
  let hu = 0;
  let hc = 0;
  let busy = 0;
  let abandoned = 0;
  const slotAbandoned = new Array(24).fill(0);
  const cap = (t: number) => Math.max(0, Math.floor(input.vets[Math.floor(t / 60) % 24] ?? 0));

  const nextFrom = (q: number[], head: number): [number, number] => {
    while (head < q.length) {
      const x = q[head++];
      if (!P[x].gone) return [x, head];
    }
    return [-1, head];
  };

  const tryStart = (t: number) => {
    const c = cap(t);
    while (busy < c) {
      let pid: number;
      [pid, hu] = nextFrom(qU, hu);
      if (pid < 0) [pid, hc] = nextFrom(qC, hc);
      if (pid < 0) return;
      const p = P[pid];
      p.start = t;
      busy++;
      push(t + sampleDist(r, p.urgent ? input.serviceUrgencia : input.serviceConsulta), DEP, pid);
    }
  };

  for (let e = heap.pop(); e; e = heap.pop()) {
    if (e.kind === DEP) {
      busy--;
      tryStart(e.t);
    } else if (e.kind === SLOT) {
      tryStart(e.t);
    } else if (e.kind === ARR) {
      const p = P[e.pid];
      if (p.urgent) qU.push(e.pid);
      else {
        qC.push(e.pid);
        const pat = input.patienceKind === "fixed" ? input.patienceMin : expo(r, input.patienceMin);
        push(p.arr + pat, ABANDON, e.pid);
      }
      tryStart(e.t);
    } else {
      const p = P[e.pid];
      if (p.start < 0 && !p.gone) {
        p.gone = true;
        abandoned++;
        slotAbandoned[p.slot]++;
      }
    }
  }

  const res: DayResult = {
    arrivalsU: 0,
    arrivalsC: 0,
    abandoned,
    unserved: 0,
    waitsU: [],
    waitsC: [],
    slotWaitSum: new Array(24).fill(0),
    slotServed: new Array(24).fill(0),
    slotAbandoned,
  };
  for (const p of P) {
    if (p.urgent) res.arrivalsU++;
    else res.arrivalsC++;
    if (p.start < 0) {
      if (!p.gone) res.unserved++;
      continue;
    }
    const w = p.start - p.arr;
    (p.urgent ? res.waitsU : res.waitsC).push(w);
    res.slotWaitSum[p.slot] += w;
    res.slotServed[p.slot]++;
  }
  return res;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

/** Corre réplicas independientes y resume con IC 95 %. */
export function simulateShifts(input: SimInput): SimSummary {
  const R = Math.max(1, Math.floor(input.replications));
  const days: DayResult[] = [];
  for (let i = 0; i < R; i++) days.push(simulateDay(input, (input.seed + i * 7919) >>> 0));
  const all: number[] = [];
  const allU: number[] = [];
  const allC: number[] = [];
  const slotSum = new Array(24).fill(0);
  const slotN = new Array(24).fill(0);
  const slotAb = new Array(24).fill(0);
  for (const d of days) {
    for (const w of d.waitsU) (all.push(w), allU.push(w));
    for (const w of d.waitsC) (all.push(w), allC.push(w));
    for (let h = 0; h < 24; h++) {
      slotSum[h] += d.slotWaitSum[h];
      slotN[h] += d.slotServed[h];
      slotAb[h] += d.slotAbandoned[h];
    }
  }
  return {
    replications: R,
    seed: input.seed,
    waitU: ci95(days.map((d) => avg(d.waitsU))),
    waitC: ci95(days.map((d) => avg(d.waitsC))),
    abandoned: ci95(days.map((d) => d.abandoned)),
    abandonRate: ci95(days.map((d) => (d.arrivalsC ? d.abandoned / d.arrivalsC : 0))),
    arrivals: ci95(days.map((d) => d.arrivalsU + d.arrivalsC)),
    p90: quantile(all, 0.9),
    p90U: quantile(allU, 0.9),
    p90C: quantile(allC, 0.9),
    slotWait: slotSum.map((s, h) => (slotN[h] ? s / slotN[h] : 0)),
    slotAbandoned: slotAb.map((s) => s / R),
    unserved: days.reduce((s, d) => s + d.unserved, 0) / R,
  };
}
