import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { NumField, PageHeader, Panel, Ready } from "@/components/app/kit";
import { useStore } from "@/lib/store";
import { pageHead } from "@/lib/head";
import { cageAnalysis } from "@/engine/params";
import { validateBlocking } from "@/engine/cages";
import { SPECIES, SPECIES_LABEL, SPECIES_SINGULAR, type Params, type Species } from "@/engine/types";
import { fmt, pct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { nextFreeCage } from "@/engine/events";

export const Route = createFileRoute("/jaulas")({
  head: pageHead("Jaulas por especie", "Carga, bloqueo Erlang B, jaulas mínimas para el objetivo y ocupación en vivo para perros, gatos y exóticos."),
  component: Jaulas,
});

function Jaulas() {
  const { state, dispatch } = useStore();
  const p = state.params;
  const rows = cageAnalysis(p);
  const [selected, setSelected] = useState<{ s: Species; i: number } | null>(null);
  const [counter, setCounter] = useState(1);

  const setSp = (key: "cages" | "admissionsPerDay" | "meanStayDays", s: Species, v: number, label: string) => {
    const val = key === "cages" ? Math.round(v) : v;
    void dispatch({ kind: "params/set", payload: { patch: { [key]: { ...p[key], [s]: val } } as Partial<Params>, label: `${label} ${SPECIES_LABEL[s].toLowerCase()}: ${p[key][s]} → ${val}` } });
  };

  const admit = (s: Species, i: number) => {
    if (state.occupancy[s][i]) return;
    const patient = `${SPECIES_SINGULAR[s]} de ejemplo ${counter} (ejemplo)`;
    setCounter((c) => c + 1);
    void dispatch({ kind: "admit", payload: { admissionId: crypto.randomUUID(), species: s, cage: i, patient } });
    toast.success(`${patient} ingresado a ${SPECIES_SINGULAR[s]} ${i + 1}`);
    setSelected(null);
  };
  const discharge = (s: Species, i: number) => {
    const a = state.occupancy[s][i];
    if (!a) return;
    void dispatch({ kind: "discharge", payload: { admissionId: a.admissionId } });
    toast.success(`Alta de ${a.patient}`);
    setSelected(null);
  };

  return (
    <div>
      <PageHeader title="Jaulas por especie" subtitle={`Hospitalización separada. Objetivo de bloqueo: ≤ ${pct(p.targetBlocking)} de pacientes referidos por falta de jaula.`} />
      <Ready>
        <div className="grid gap-4 lg:grid-cols-3">
          {rows.map((r) => (
            <SpeciesCard key={r.species} r={r} p={p} setSp={setSp} />
          ))}
        </div>

        <h2 className="mb-2 mt-6 font-display text-lg font-semibold">Ocupación en vivo</h2>
        <p className="mb-3 text-sm text-muted-foreground">Toque una jaula libre para ingresar un paciente de ejemplo, o una ocupada para dar de alta.</p>
        <div className="space-y-4">
          {SPECIES.map((s) => (
            <Panel key={s} title={`${SPECIES_LABEL[s]} · ${state.occupancy[s].filter(Boolean).length}/${p.cages[s]} ocupadas`}>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                {state.occupancy[s].map((a, i) => (
                  <button
                    key={i}
                    onClick={() => setSelected({ s, i })}
                    aria-label={`${SPECIES_SINGULAR[s]} ${i + 1} ${a ? "ocupada" : "libre"}`}
                    className={cn("flex h-14 flex-col items-center justify-center rounded-lg border text-sm font-semibold transition", a ? "border-primary bg-primary text-primary-foreground" : "border-dashed border-border bg-card text-muted-foreground hover:border-primary", selected?.s === s && selected.i === i && "ring-2 ring-ring ring-offset-2")}
                  >
                    {i + 1}
                    <span className="text-[10px] font-normal">{a ? "ocupada" : "libre"}</span>
                  </button>
                ))}
              </div>
              {selected?.s === s && (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-muted p-3 text-sm">
                  {state.occupancy[s][selected.i] ? (
                    <>
                      <span className="flex-1">Jaula {selected.i + 1}: <b>{state.occupancy[s][selected.i]!.patient}</b></span>
                      <button onClick={() => discharge(s, selected.i)} className="h-11 rounded-lg bg-foreground px-4 font-semibold text-background">Dar de alta</button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1">Jaula {selected.i + 1} libre</span>
                      <button onClick={() => admit(s, selected.i)} className="h-11 rounded-lg bg-primary px-4 font-semibold text-primary-foreground">Ingresar paciente</button>
                    </>
                  )}
                  <button onClick={() => setSelected(null)} className="h-11 rounded-lg border border-border bg-card px-3">Cancelar</button>
                </div>
              )}
              {nextFreeCage(state.occupancy[s]) == null && p.cages[s] > 0 && <p className="mt-2 text-sm font-medium text-destructive">Sin jaulas libres: el siguiente paciente se referiría a otro hospital.</p>}
            </Panel>
          ))}
        </div>
      </Ready>
    </div>
  );
}

function SpeciesCard({ r, p, setSp }: { r: ReturnType<typeof cageAnalysis>[number]; p: Params; setSp: (k: "cages" | "admissionsPerDay" | "meanStayDays", s: Species, v: number, l: string) => void }) {
  const s = r.species;
  const [check, setCheck] = useState<{ key: string; mean: number; lo: number; hi: number } | null>(null);
  const key = `${p.admissionsPerDay[s]}|${p.meanStayDays[s]}|${p.cages[s]}|${p.seed}`;
  const current = check?.key === key ? check : null;
  const diff = r.minCages - r.cages;
  const validate = () => {
    const v = validateBlocking({ admissionsPerDay: p.admissionsPerDay[s], meanStayDays: p.meanStayDays[s], cages: p.cages[s] }, p.seed, 10, 730);
    setCheck({ key, mean: v.mean, lo: v.lo, hi: v.hi });
  };
  const tone = r.blocking > p.targetBlocking;
  return (
    <Panel title={SPECIES_LABEL[s]}>
      <div className="grid grid-cols-3 gap-2">
        <NumField label="Ingresos/día" step={0.5} max={1000} value={p.admissionsPerDay[s]} onCommit={(v) => setSp("admissionsPerDay", s, v, "Ingresos/día")} />
        <NumField label="Estancia" suffix="d" step={0.1} max={365} value={p.meanStayDays[s]} onCommit={(v) => setSp("meanStayDays", s, v, "Estancia media")} />
        <NumField label="Jaulas" max={500} value={p.cages[s]} onCommit={(v) => setSp("cages", s, v, "Jaulas")} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Carga a</dt>
        <dd className="text-right font-mono">{fmt(r.a, 2)} Erl</dd>
        <dt className="text-muted-foreground">Bloqueo (Erlang B)</dt>
        <dd className={cn("text-right font-mono font-semibold", tone ? "text-destructive" : "text-primary")}>{pct(r.blocking, 2)}</dd>
        <dt className="text-muted-foreground">Mínimo para ≤ {pct(p.targetBlocking, 1)}</dt>
        <dd className="text-right font-mono">{r.minCages} jaulas</dd>
        <dt className="text-muted-foreground">Referidos estimados</dt>
        <dd className="text-right font-mono">{fmt(p.admissionsPerDay[s] * r.blocking * 30, 0)} /mes</dd>
      </dl>
      <p className={cn("mt-3 rounded-lg px-3 py-2 text-sm font-medium", diff > 0 ? "bg-destructive/10 text-destructive" : "bg-accent text-accent-foreground")}>
        {diff > 0 ? `Agregar ${diff} jaula${diff > 1 ? "s" : ""} (total ${r.minCages}).` : diff < 0 ? `Cumple el objetivo; sobran ${-diff} jaula${-diff > 1 ? "s" : ""} respecto al mínimo.` : "Cumple el objetivo exactamente."}
      </p>
      <div className="mt-3 flex items-center gap-2">
        <button onClick={validate} className="h-11 rounded-lg border border-border bg-card px-3 text-sm font-medium hover:border-primary">Validar con simulación</button>
        {current && <span className="text-xs text-muted-foreground">Sim.: {pct(current.mean, 2)} (IC {pct(Math.max(0, current.lo), 1)}–{pct(current.hi, 1)})</span>}
      </div>
    </Panel>
  );
}

