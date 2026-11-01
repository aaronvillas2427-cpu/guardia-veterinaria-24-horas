import { simulateStays } from "./cages";
import type { AppEvent } from "./events";
import { defaultParams } from "./params";
import { expo, mulberry32, pick } from "./rng";
import { SPECIES, type Hosp, type Params, type Species, type Visit } from "./types";

export const SAMPLE_VISITS = 41000;
export const SAMPLE_HOSPS = 7000;
const DAY = 86_400_000;

const NAMES = [
  "Firulais", "Michi", "Rocky", "Luna", "Canela", "Kiwi", "Max", "Nala", "Coco", "Pelusa",
  "Toby", "Mango", "Chispa", "Frijol", "Lola", "Pirata", "Tamal", "Nube", "Bruno", "Mora",
];

export const sampleName = (r: () => number, id: number) => `${pick(r, NAMES)} #${id} (ejemplo)`;

export interface SampleData {
  params: Params;
  visits: Visit[];
  hosps: Hosp[];
  events: AppEvent[];
}

/** Genera datos de ejemplo deterministas. Todos los nombres están marcados como «(ejemplo)». */
export function generateSample(seed: number, now: number): SampleData {
  const params = { ...defaultParams(), seed };
  const r = mulberry32(seed);
  const spanDays = 400;
  const start = now - spanDays * DAY;

  const profile = params.lambdaWeekday;
  const total = profile.reduce((s, x) => s + x, 0);
  const cum = profile.map(((s) => (x: number) => (s += x / total))(0));
  const speciesW: [Species, number][] = [["perro", 0.58], ["gato", 0.32], ["exotico", 0.1]];
  const pickSpecies = () => {
    let u = r();
    for (const [s, w] of speciesW) if ((u -= w) < 0) return s;
    return "perro" as Species;
  };

  const visits: Visit[] = [];
  for (let i = 0; i < SAMPLE_VISITS; i++) {
    const day = Math.floor(r() * spanDays);
    const u = r();
    const hour = Math.max(0, cum.findIndex((c) => u <= c));
    const ts = Math.floor(start + day * DAY + hour * 3_600_000 + r() * 3_600_000);
    const urgent = r() < params.urgentShare;
    let wait = expo(r, urgent ? 5 : 16);
    let abandoned = false;
    if (!urgent) {
      const pat = expo(r, params.patienceMin);
      if (wait > pat) {
        abandoned = true;
        wait = pat;
      }
    }
    const service = abandoned ? 0 : expo(r, urgent ? params.serviceUrgencia.mean : params.serviceConsulta.mean);
    visits.push({
      id: 0,
      ts,
      type: urgent ? "urgencia" : "consulta",
      species: pickSpecies(),
      patient: "",
      waitMin: Math.round(wait * 10) / 10,
      serviceMin: Math.round(service * 10) / 10,
      abandoned,
    });
  }
  visits.sort((a, b) => a.ts - b.ts);
  visits.forEach((v, i) => {
    v.id = i + 1;
    v.patient = sampleName(r, v.id);
  });

  const hosps: Hosp[] = [];
  SPECIES.forEach((s, k) => {
    const res = simulateStays({
      admissionsPerDay: params.admissionsPerDay[s],
      meanStayDays: params.meanStayDays[s],
      cages: params.cages[s],
      horizonDays: spanDays,
      seed: (seed + 31 * (k + 1)) >>> 0,
    });
    for (const st of res.stays)
      hosps.push({ id: 0, admitTs: Math.floor(start + st.admit * DAY), dischargeTs: Math.floor(start + st.discharge * DAY), species: s, cage: st.cage, patient: "", referred: false });
    for (const rf of res.referred) {
      const t = Math.floor(start + rf.t * DAY);
      hosps.push({ id: 0, admitTs: t, dischargeTs: t, species: s, cage: -1, patient: "", referred: true });
    }
  });
  hosps.sort((a, b) => a.admitTs - b.admitTs);
  const trimmed = hosps.slice(-SAMPLE_HOSPS);
  trimmed.forEach((h, i) => {
    h.id = i + 1;
    h.patient = sampleName(r, 100000 + h.id);
  });

  const events: AppEvent[] = [
    { id: "sample-000000", ts: start, tab: "ejemplo", kind: "params/set", payload: { patch: params, label: "Parámetros de ejemplo", sample: true } },
  ];
  let n = 1;
  for (const h of trimmed) {
    if (h.referred || h.dischargeTs <= now - 2 * DAY) continue;
    const admissionId = `hosp-${h.id}`;
    events.push({ id: `sample-${String(n++).padStart(6, "0")}`, ts: h.admitTs, tab: "ejemplo", kind: "admit", payload: { admissionId, species: h.species, cage: h.cage, patient: h.patient, sample: true } });
    if (h.dischargeTs <= now)
      events.push({ id: `sample-${String(n++).padStart(6, "0")}`, ts: h.dischargeTs, tab: "ejemplo", kind: "discharge", payload: { admissionId, sample: true } });
  }
  return { params, visits, hosps: trimmed, events };
}
