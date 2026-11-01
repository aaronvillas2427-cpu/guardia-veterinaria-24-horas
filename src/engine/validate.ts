import { z } from "zod";
import type { AppEvent } from "./events";
import type { Hosp, Visit } from "./types";

const species = z.enum(["perro", "gato", "exotico"]);
const num = z.number().finite();
const nonNeg = num.min(0);
const slots = z.array(nonNeg).length(24);
const dist = z.object({ kind: z.enum(["exp", "lognormal", "fixed"]), mean: nonNeg, cv: nonNeg });
const perSpecies = z.object({ perro: nonNeg, gato: nonNeg, exotico: nonNeg });

export const ParamsSchema = z.object({
  seed: z.number().int().min(0).max(4294967295),
  replications: z.number().int().min(1).max(500),
  lambdaWeekday: slots,
  weekendMult: nonNeg,
  vetsWeekday: z.array(z.number().int().min(0).max(100)).length(24),
  vetsWeekend: z.array(z.number().int().min(0).max(100)).length(24),
  urgentShare: num.min(0).max(1),
  serviceUrgencia: dist,
  serviceConsulta: dist,
  patienceMin: nonNeg,
  patienceKind: z.enum(["exp", "fixed"]),
  cages: z.object({ perro: z.number().int().min(0).max(500), gato: z.number().int().min(0).max(500), exotico: z.number().int().min(0).max(500) }),
  admissionsPerDay: perSpecies,
  meanStayDays: perSpecies,
  targetServiceLevel: num.min(0).max(1),
  targetMinutes: nonNeg,
  targetBlocking: num.min(0).max(1),
});

const base = { id: z.string().min(1).max(100), ts: num, tab: z.string().max(100) };
const stat = z.object({ mean: num, sd: num, lo: num, hi: num, n: num });
const summary = z.object({
  replications: num, seed: num, waitU: stat, waitC: stat, abandoned: stat, abandonRate: stat, arrivals: stat,
  p90: num, p90U: num, p90C: num, slotWait: z.array(num), slotAbandoned: z.array(num), unserved: num,
});

export const EventSchema = z.discriminatedUnion("kind", [
  z.object({ ...base, kind: z.literal("params/set"), payload: z.object({ patch: ParamsSchema.partial(), label: z.string().max(300), sample: z.boolean().optional() }) }),
  z.object({ ...base, kind: z.literal("admit"), payload: z.object({ admissionId: z.string().min(1).max(100), species, cage: z.number().int(), patient: z.string().max(200), sample: z.boolean().optional() }) }),
  z.object({ ...base, kind: z.literal("discharge"), payload: z.object({ admissionId: z.string().min(1).max(100), sample: z.boolean().optional() }) }),
  z.object({ ...base, kind: z.literal("undo"), payload: z.object({ target: z.string().min(1) }) }),
  z.object({ ...base, kind: z.literal("redo"), payload: z.object({ target: z.string().min(1) }) }),
  z.object({ ...base, kind: z.literal("sim/run"), payload: z.object({ dayType: z.enum(["weekday", "weekend"]), summary }) }),
]);

export const VisitSchema = z.object({
  id: z.number().int(), ts: num, type: z.enum(["urgencia", "consulta"]), species,
  patient: z.string().max(200), waitMin: nonNeg, serviceMin: nonNeg, abandoned: z.boolean(),
});
export const HospSchema = z.object({
  id: z.number().int(), admitTs: num, dischargeTs: num, species, cage: z.number().int().min(-1),
  patient: z.string().max(200), referred: z.boolean(),
});

function filterValid<T>(raw: unknown, schema: z.ZodType<T>): { valid: T[]; dropped: number } {
  if (!Array.isArray(raw)) return { valid: [], dropped: raw == null ? 0 : 1 };
  const valid: T[] = [];
  let dropped = 0;
  for (const x of raw) {
    const r = schema.safeParse(x);
    if (r.success) valid.push(r.data);
    else dropped++;
  }
  return { valid, dropped };
}

export const parseEvents = (raw: unknown) => filterValid(raw, EventSchema as unknown as z.ZodType<AppEvent>);
export const parseVisits = (raw: unknown) => filterValid(raw, VisitSchema as z.ZodType<Visit>);
export const parseHosps = (raw: unknown) => filterValid(raw, HospSchema as z.ZodType<Hosp>);

export const ExportSchema = z.object({
  format: z.literal("guardia-vet-24h"),
  version: z.literal(1),
  exportedAt: num,
  events: z.array(EventSchema),
  visits: z.array(VisitSchema).optional(),
  hosps: z.array(HospSchema).optional(),
});
export type ExportData = z.infer<typeof ExportSchema>;
