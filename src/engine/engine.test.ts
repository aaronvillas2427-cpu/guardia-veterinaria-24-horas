import { describe, expect, it } from "vitest";
import { erlangB, erlangC, minCages, recommendVets } from "./erlang";
import { mulberry32, sampleDist, expo, DEFAULT_SEED } from "./rng";
import { ci95, quantile, tCrit95, mean, sd } from "./stats";
import { simulateDay, simulateShifts, EventHeap, type SimInput } from "./sim";
import { simulateStays, validateBlocking } from "./cages";
import { cageAnalysis, dayTypeOf, defaultParams, erlangTable, hourLabel, lambdaFor, muPerHour, round2, simInputFor, vetsFor, meanServiceMin } from "./params";
import { csvCell, neutralize, toCSV } from "./csv";
import { describeEvent, nextFreeCage, replay, type AppEvent } from "./events";
import { generateSample, SAMPLE_HOSPS, SAMPLE_VISITS } from "./sample";
import { ExportSchema, parseEvents, parseHosps, parseVisits, ParamsSchema } from "./validate";

const base = (o: Partial<SimInput> = {}): SimInput => ({
  lambda: new Array(24).fill(0),
  vets: new Array(24).fill(1),
  urgentShare: 0,
  serviceUrgencia: { kind: "fixed", mean: 10, cv: 0 },
  serviceConsulta: { kind: "fixed", mean: 10, cv: 0 },
  patienceMin: 45,
  patienceKind: "fixed",
  seed: 1,
  replications: 3,
  ...o,
});

describe("rng", () => {
  it("mulberry32 is deterministic and in [0,1)", () => {
    const a = mulberry32(DEFAULT_SEED), b = mulberry32(72000);
    for (let i = 0; i < 1000; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
  it("distributions have the right mean", () => {
    const r = mulberry32(5);
    const n = 20000;
    const m = (f: () => number) => { let s = 0; for (let i = 0; i < n; i++) s += f(); return s / n; };
    expect(m(() => expo(r, 10))).toBeCloseTo(10, 0);
    expect(m(() => sampleDist(r, { kind: "lognormal", mean: 20, cv: 0.5 }))).toBeCloseTo(20, -0.5);
    expect(sampleDist(r, { kind: "fixed", mean: 7, cv: 0 })).toBe(7);
    expect(sampleDist(r, { kind: "exp", mean: 0, cv: 0 })).toBe(0);
  });
});

describe("stats", () => {
  it("ci95, quantile", () => {
    expect(mean([])).toBe(0);
    expect(sd([1])).toBe(0);
    const s = ci95([1, 2, 3, 4, 5]);
    expect(s.mean).toBe(3);
    expect(s.hi - s.mean).toBeCloseTo((2.776 * Math.sqrt(2.5)) / Math.sqrt(5), 3);
    expect(tCrit95(0)).toBe(0);
    expect(tCrit95(100)).toBe(1.96);
    expect(quantile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9)).toBeCloseTo(9.1);
    expect(quantile([], 0.5)).toBe(0);
  });
});

describe("erlang", () => {
  it("Erlang B recurrence known values", () => {
    expect(erlangB(0, 5)).toBe(1);
    expect(erlangB(1, 1)).toBeCloseTo(0.5);
    expect(erlangB(10, 5)).toBeCloseTo(0.01838, 4);
    expect(erlangB(3, 0)).toBe(0);
  });
  it("Erlang C from B, Wq and NS", () => {
    // M/M/1, λ=1, μ=2: C=ρ=0.5, Wq=ρ/(μ-λ)=0.5 h
    const r = erlangC(1, 1, 2, 0);
    expect(r.pw).toBeCloseTo(0.5);
    expect(r.wqMin).toBeCloseTo(30);
    expect(r.ns).toBeCloseTo(0.5);
    const r2 = erlangC(2, 3, 2, 20);
    const B = erlangB(2, 1.5);
    const C = B / (1 - 0.75 * (1 - B));
    expect(r2.pw).toBeCloseTo(C);
    expect(r2.ns).toBeCloseTo(1 - C * Math.exp(-(4 - 3) * (20 / 60)));
  });
  it("ρ ≥ 1 is insufficient", () => {
    const r = erlangC(2, 4, 2, 20);
    expect(r.stable).toBe(false);
    expect(r.wqMin).toBeNull();
    expect(erlangC(0, 1, 2, 20).stable).toBe(false);
    expect(erlangC(1, 0, 2, 20).wqMin).toBe(0);
  });
  it("recommendations", () => {
    expect(recommendVets(0, 3, 20, 0.8)).toBe(1);
    const c = recommendVets(6, 2.5, 20, 0.8);
    expect(erlangC(c, 6, 2.5, 20).ns!).toBeGreaterThanOrEqual(0.8);
    expect(erlangC(c - 1, 6, 2.5, 20).ns ?? 0).toBeLessThan(0.8);
    expect(minCages(0, 0.05)).toBe(0);
    const k = minCages(12, 0.05);
    expect(erlangB(k, 12)).toBeLessThanOrEqual(0.05);
    expect(erlangB(k - 1, 12)).toBeGreaterThan(0.05);
  });
});

describe("shift simulation", () => {
  it("heap pops by time then priority", () => {
    const h = new EventHeap();
    h.push({ t: 5, kind: 3, seq: 0, pid: 0 });
    h.push({ t: 5, kind: 0, seq: 1, pid: 0 });
    h.push({ t: 1, kind: 2, seq: 2, pid: 0 });
    expect(h.pop()!.t).toBe(1);
    expect(h.pop()!.kind).toBe(0);
    expect(h.pop()!.kind).toBe(3);
    expect(h.pop()).toBeUndefined();
  });
  it("service start beats patience expiry at the same instant", () => {
    // Single vet, fixed service 10, fixed patience 10. A patient waiting exactly 10 min must be served.
    const lambda = new Array(24).fill(0);
    lambda[0] = 30;
    const d = simulateDay(base({ lambda, patienceMin: 10, vets: new Array(24).fill(1) }), 3);
    for (const w of d.waitsC) expect(w).toBeLessThanOrEqual(10 + 1e-9);
    expect(d.abandoned).toBeGreaterThan(0);
  });
  it("urgencias never abandon and wait less than consultas", () => {
    const lambda = new Array(24).fill(5);
    const s = simulateShifts(base({ lambda, urgentShare: 0.3, vets: new Array(24).fill(1), serviceConsulta: { kind: "exp", mean: 10, cv: 1 }, serviceUrgencia: { kind: "exp", mean: 10, cv: 1 }, patienceKind: "exp" }));
    expect(s.waitU.mean).toBeLessThan(s.waitC.mean);
    expect(s.abandoned.mean).toBeGreaterThan(0);
    expect(s.waitU.lo).toBeLessThanOrEqual(s.waitU.mean);
    expect(s.p90).toBeGreaterThan(0);
    const d = simulateDay(base({ lambda, urgentShare: 1 }), 1);
    expect(d.abandoned).toBe(0);
  });
  it("no vets leaves urgencias unserved; deterministic by seed", () => {
    const lambda = new Array(24).fill(2);
    const d = simulateDay(base({ lambda, urgentShare: 1, vets: new Array(24).fill(0) }), 9);
    expect(d.unserved).toBe(d.arrivalsU);
    const a = simulateShifts(base({ lambda }));
    const b = simulateShifts(base({ lambda }));
    expect(a).toEqual(b);
  });
  it("simulation is close to Erlang C when patience is huge", () => {
    const lambda = new Array(24).fill(4);
    const s = simulateShifts(base({ lambda, vets: new Array(24).fill(3), patienceMin: 1e9, serviceConsulta: { kind: "exp", mean: 30, cv: 1 }, replications: 40, seed: 11 }));
    const e = erlangC(3, 4, 2, 20);
    expect(Math.abs(s.waitC.mean - e.wqMin!)).toBeLessThan(e.wqMin! * 0.6 + 2);
  });
});

describe("cages", () => {
  it("stay simulation matches Erlang B", () => {
    const v = validateBlocking({ admissionsPerDay: 10, meanStayDays: 1, cages: 12 }, 72000, 6, 1500);
    const b = erlangB(12, 10);
    expect(Math.abs(v.mean - b)).toBeLessThan(0.02);
    const z = simulateStays({ admissionsPerDay: 0, meanStayDays: 1, cages: 1, horizonDays: 10, seed: 1 });
    expect(z.arrivals).toBe(0);
    const none = simulateStays({ admissionsPerDay: 5, meanStayDays: 1, cages: 0, horizonDays: 10, seed: 1 });
    expect(none.blocking).toBe(1);
    expect(none.stays.length).toBe(0);
  });
});

describe("params", () => {
  it("weekend multiplier, rounding and tables", () => {
    const p = defaultParams();
    expect(lambdaFor(p, "weekend")[10]).toBeCloseTo(5.4 * 1.3);
    expect(round2(7.0199999)).toBe(7.02);
    expect(vetsFor(p, "weekend")).toBe(p.vetsWeekend);
    expect(meanServiceMin(p)).toBeCloseTo(0.25 * 35 + 0.75 * 20);
    expect(muPerHour({ ...p, serviceConsulta: { ...p.serviceConsulta, mean: 0 }, urgentShare: 0 })).toBe(0);
    expect(erlangTable(p, "weekday")).toHaveLength(24);
    expect(cageAnalysis(p)).toHaveLength(3);
    expect(simInputFor(p, "weekday").seed).toBe(72000);
    expect(dayTypeOf(new Date(2026, 10, 1))).toBe("weekend");
    expect(dayTypeOf(new Date(2026, 10, 2))).toBe("weekday");
    expect(hourLabel(7)).toBe("07:00");
  });
});

describe("csv", () => {
  it("neutralizes formulas and quotes", () => {
    expect(neutralize("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(neutralize("+1")).toBe("'+1");
    expect(neutralize("-2")).toBe("'-2");
    expect(neutralize("@x")).toBe("'@x");
    expect(neutralize("ok")).toBe("ok");
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell(null)).toBe("");
    expect(toCSV([{ a: "=1" }], [{ header: "A", value: (r) => r.a }])).toBe("A\r\n'=1");
  });
});

const ev = (id: string, ts: number, kind: AppEvent["kind"], payload: unknown, tab = "t1") => ({ id, ts, tab, kind, payload }) as AppEvent;

describe("event store", () => {
  const d = defaultParams();
  it("params patches and undo/redo as compensating events (≥50 steps)", () => {
    const events: AppEvent[] = [];
    for (let i = 0; i < 60; i++) events.push(ev(`p${String(i).padStart(3, "0")}`, i + 1, "params/set", { patch: { weekendMult: 1 + i / 100 }, label: "x" }));
    let s = replay(events, d);
    expect(s.params.weekendMult).toBeCloseTo(1.59);
    let ts = 100;
    for (let i = 0; i < 55; i++) {
      events.push(ev(`u${i}`, ts++, "undo", { target: s.undoStack.at(-1)! }));
      s = replay(events, d);
    }
    expect(s.params.weekendMult).toBeCloseTo(1.04);
    expect(s.redoStack).toHaveLength(55);
    events.push(ev("r0", ts++, "redo", { target: s.redoStack.at(-1)! }));
    s = replay(events, d);
    expect(s.params.weekendMult).toBeCloseTo(1.05);
    events.push(ev("n0", ts++, "params/set", { patch: { weekendMult: 2 }, label: "x" }));
    s = replay(events, d);
    expect(s.redoStack).toHaveLength(0);
    // undo of unknown target is ignored
    expect(replay([...events, ev("zz", ts++, "undo", { target: "nope" })], d).params.weekendMult).toBe(2);
    expect(replay([...events, ev("zy", ts++, "redo", { target: "nope" })], d).params.weekendMult).toBe(2);
  });
  it("earlier timestamp wins a cage conflict and the loser gets the next free cage", () => {
    const a = ev("a", 2000, "admit", { admissionId: "A", species: "gato", cage: 0, patient: "Michi (ejemplo)" }, "tabA");
    const b = ev("b", 1000, "admit", { admissionId: "B", species: "gato", cage: 0, patient: "Luna (ejemplo)" }, "tabB");
    const s = replay([a, b], d);
    expect(s.occupancy.gato[0]?.admissionId).toBe("B");
    expect(s.rejections).toHaveLength(1);
    expect(s.rejections[0]!.eventId).toBe("a");
    expect(s.rejections[0]!.suggestion).toBe(1);
    const dis = replay([a, b, ev("c", 3000, "discharge", { admissionId: "B" })], d);
    expect(dis.occupancy.gato[0]).toBeNull();
    expect(replay([ev("x", 1, "admit", { admissionId: "X", species: "gato", cage: 999, patient: "p" })], d).rejections).toHaveLength(1);
  });
  it("state at a past instant", () => {
    const evs = [
      ev("a", 10, "admit", { admissionId: "A", species: "perro", cage: 2, patient: "p" }),
      ev("b", 20, "discharge", { admissionId: "A" }),
      ev("s", 30, "sim/run", { dayType: "weekday", summary: {} }),
    ];
    expect(replay(evs, d, 15).occupancy.perro[2]?.admissionId).toBe("A");
    expect(replay(evs, d, 25).occupancy.perro[2]).toBeNull();
    expect(replay(evs, d).lastSim?.dayType).toBe("weekday");
    expect(nextFreeCage([null], 0)).toBe(0);
    expect(nextFreeCage([{} as never], 0)).toBeNull();
    for (const e of evs) expect(describeEvent(e)).toBeTypeOf("string");
    expect(describeEvent(ev("u", 1, "undo", { target: "abc" }))).toContain("Deshacer");
    expect(describeEvent(ev("r", 1, "redo", { target: "abc" }))).toContain("Rehacer");
    expect(describeEvent(ev("p", 1, "params/set", { patch: {}, label: "L" }))).toBe("L");
  });
});

describe("sample data + validation", () => {
  const now = Date.UTC(2026, 10, 1);
  const s = generateSample(72000, now);
  it("generates 41,000 visits and 7,000 hospitalizations marked as sample", () => {
    expect(s.visits).toHaveLength(SAMPLE_VISITS);
    expect(s.hosps).toHaveLength(SAMPLE_HOSPS);
    expect(s.visits.every((v) => v.patient.includes("(ejemplo)"))).toBe(true);
    expect(s.hosps.every((h) => h.patient.includes("(ejemplo)"))).toBe(true);
    expect(generateSample(72000, now).visits[100]).toEqual(s.visits[100]);
    const st = replay(s.events, defaultParams(), now);
    expect(st.rejections).toHaveLength(0);
    expect(st.undoStack).toHaveLength(0);
  });
  it("validates storage and import", () => {
    expect(parseVisits(s.visits.slice(0, 50)).valid).toHaveLength(50);
    expect(parseHosps([...s.hosps.slice(0, 5), { bad: 1 }]).dropped).toBe(1);
    expect(parseEvents("x").dropped).toBe(1);
    expect(parseEvents(null).dropped).toBe(0);
    expect(parseEvents(s.events).dropped).toBe(0);
    expect(ParamsSchema.safeParse({ ...s.params, lambdaWeekday: [1] }).success).toBe(false);
    expect(ExportSchema.safeParse({ format: "guardia-vet-24h", version: 1, exportedAt: 1, events: s.events.slice(0, 3) }).success).toBe(true);
    expect(ExportSchema.safeParse({ format: "otro", version: 1, exportedAt: 1, events: [] }).success).toBe(false);
  });
});
