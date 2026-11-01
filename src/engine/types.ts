export const SPECIES = ["perro", "gato", "exotico"] as const;
export type Species = (typeof SPECIES)[number];
export const SPECIES_LABEL: Record<Species, string> = {
  perro: "Perros",
  gato: "Gatos",
  exotico: "Exóticos",
};
export const SPECIES_SINGULAR: Record<Species, string> = {
  perro: "Perro",
  gato: "Gato",
  exotico: "Exótico",
};

export type DistKind = "exp" | "lognormal" | "fixed";
/** Distribución de tiempo en minutos (o días para estancias). */
export interface Dist {
  kind: DistKind;
  mean: number;
  cv: number;
}

export type DayType = "weekday" | "weekend";
export type CareType = "urgencia" | "consulta";

export interface Params {
  seed: number;
  replications: number;
  /** Llegadas por hora, 24 franjas, día entre semana. */
  lambdaWeekday: number[];
  weekendMult: number;
  vetsWeekday: number[];
  vetsWeekend: number[];
  /** Proporción de urgencias (0–1). */
  urgentShare: number;
  serviceUrgencia: Dist;
  serviceConsulta: Dist;
  patienceMin: number;
  patienceKind: "exp" | "fixed";
  cages: Record<Species, number>;
  admissionsPerDay: Record<Species, number>;
  meanStayDays: Record<Species, number>;
  /** Nivel de servicio objetivo: fracción atendida en ≤ targetMinutes. */
  targetServiceLevel: number;
  targetMinutes: number;
  /** Bloqueo máximo aceptable de jaulas (0–1). */
  targetBlocking: number;
}

export interface Visit {
  id: number;
  ts: number;
  type: CareType;
  species: Species;
  patient: string;
  waitMin: number;
  serviceMin: number;
  abandoned: boolean;
}

export interface Hosp {
  id: number;
  admitTs: number;
  dischargeTs: number;
  species: Species;
  /** Índice de jaula (0-based) o -1 si fue referido. */
  cage: number;
  patient: string;
  referred: boolean;
}
