import type { SimSummary } from "./sim";
import { SPECIES, type DayType, type Params, type Species } from "./types";

export interface ParamsSetPayload {
  patch: Partial<Params>;
  label: string;
  sample?: boolean;
}
export interface AdmitPayload {
  admissionId: string;
  species: Species;
  cage: number;
  patient: string;
  sample?: boolean;
}
export interface DischargePayload {
  admissionId: string;
  sample?: boolean;
}
export interface TargetPayload {
  target: string;
}
export interface SimRunPayload {
  dayType: DayType;
  summary: SimSummary;
}

export type AppEvent =
  | { id: string; ts: number; tab: string; kind: "params/set"; payload: ParamsSetPayload }
  | { id: string; ts: number; tab: string; kind: "admit"; payload: AdmitPayload }
  | { id: string; ts: number; tab: string; kind: "discharge"; payload: DischargePayload }
  | { id: string; ts: number; tab: string; kind: "undo"; payload: TargetPayload }
  | { id: string; ts: number; tab: string; kind: "redo"; payload: TargetPayload }
  | { id: string; ts: number; tab: string; kind: "sim/run"; payload: SimRunPayload };

export type EventKind = AppEvent["kind"];

export interface Admission {
  admissionId: string;
  eventId: string;
  species: Species;
  cage: number;
  patient: string;
  since: number;
}

export interface Rejection {
  eventId: string;
  tab: string;
  ts: number;
  species: Species;
  cage: number;
  patient: string;
  winnerEventId: string;
  suggestion: number | null;
}

export interface AppState {
  params: Params;
  occupancy: Record<Species, (Admission | null)[]>;
  rejections: Rejection[];
  undone: Set<string>;
  undoStack: string[];
  redoStack: string[];
  lastSim: (SimRunPayload & { ts: number }) | null;
  applied: number;
}

export function isUndoable(e: AppEvent): boolean {
  return (e.kind === "params/set" || e.kind === "admit" || e.kind === "discharge") && !e.payload.sample;
}

export function sortEvents(events: readonly AppEvent[]): AppEvent[] {
  return [...events].sort((a, b) => a.ts - b.ts || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function nextFreeCage(occ: (Admission | null)[], from = 0): number | null {
  for (let i = 0; i < occ.length; i++) {
    const k = (from + i) % occ.length;
    if (!occ[k]) return k;
  }
  return null;
}

/**
 * Reconstruye el estado reproduciendo eventos ordenados por (ts, id).
 * Deshacer/rehacer son eventos compensatorios que activan o desactivan su objetivo.
 * Dos ingresos a la misma jaula: gana el de marca de tiempo menor; el otro se rechaza.
 */
export function replay(events: readonly AppEvent[], defaults: Params, until?: number): AppState {
  const list = sortEvents(until == null ? events : events.filter((e) => e.ts <= until));
  const undone = new Set<string>();
  let undoStack: string[] = [];
  let redoStack: string[] = [];
  for (const e of list) {
    if (isUndoable(e)) {
      undoStack.push(e.id);
      redoStack = [];
    } else if (e.kind === "undo") {
      if (undoStack.includes(e.payload.target)) {
        undoStack = undoStack.filter((x) => x !== e.payload.target);
        redoStack.push(e.payload.target);
        undone.add(e.payload.target);
      }
    } else if (e.kind === "redo") {
      if (redoStack.includes(e.payload.target)) {
        redoStack = redoStack.filter((x) => x !== e.payload.target);
        undoStack.push(e.payload.target);
        undone.delete(e.payload.target);
      }
    }
  }

  let params: Params = structuredClone(defaults);
  const active = new Map<string, Admission>();
  const byCage = new Map<string, Admission>();
  const rejections: Rejection[] = [];
  let lastSim: AppState["lastSim"] = null;
  let applied = 0;
  for (const e of list) {
    if (undone.has(e.id)) continue;
    if (e.kind === "params/set") {
      params = { ...params, ...structuredClone(e.payload.patch) };
      applied++;
    } else if (e.kind === "admit") {
      const { species, cage, admissionId, patient } = e.payload;
      const key = `${species}:${cage}`;
      const holder = byCage.get(key);
      if (holder || cage < 0 || cage >= params.cages[species] || active.has(admissionId)) {
        rejections.push({
          eventId: e.id,
          tab: e.tab,
          ts: e.ts,
          species,
          cage,
          patient,
          winnerEventId: holder?.eventId ?? "",
          suggestion: null,
        });
        continue;
      }
      const adm: Admission = { admissionId, eventId: e.id, species, cage, patient, since: e.ts };
      active.set(admissionId, adm);
      byCage.set(key, adm);
      applied++;
    } else if (e.kind === "discharge") {
      const adm = active.get(e.payload.admissionId);
      if (adm) {
        active.delete(adm.admissionId);
        byCage.delete(`${adm.species}:${adm.cage}`);
        applied++;
      }
    } else if (e.kind === "sim/run") {
      lastSim = { ...e.payload, ts: e.ts };
    }
  }

  const occupancy = {} as AppState["occupancy"];
  for (const s of SPECIES) {
    const arr: (Admission | null)[] = new Array(Math.max(0, params.cages[s])).fill(null);
    for (const a of active.values()) if (a.species === s && a.cage < arr.length) arr[a.cage] = a;
    occupancy[s] = arr;
  }
  for (const rj of rejections) rj.suggestion = nextFreeCage(occupancy[rj.species], rj.cage + 1);

  return { params, occupancy, rejections, undone, undoStack, redoStack, lastSim, applied };
}

export function describeEvent(e: AppEvent): string {
  switch (e.kind) {
    case "params/set":
      return e.payload.label;
    case "admit":
      return `Ingreso de ${e.payload.patient} a jaula ${e.payload.cage + 1} (${e.payload.species})`;
    case "discharge":
      return `Alta de ingreso ${e.payload.admissionId.slice(0, 8)}`;
    case "undo":
      return `Deshacer ${e.payload.target.slice(0, 10)}`;
    case "redo":
      return `Rehacer ${e.payload.target.slice(0, 10)}`;
    case "sim/run":
      return `Simulación ${e.payload.dayType === "weekend" ? "fin de semana" : "entre semana"} (${e.payload.summary.replications} réplicas)`;
  }
}
