import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Metric, PageHeader, Panel, Ready, Segmented } from "@/components/app/kit";
import { useStore } from "@/lib/store";
import { pageHead } from "@/lib/head";
import { simulateStays } from "@/engine/cages";
import { SPECIES, SPECIES_LABEL, SPECIES_SINGULAR, type Species } from "@/engine/types";

export const Route = createFileRoute("/hospitalizacion")({
  head: pageHead("Hospitalización simulada", "Calendario de ocupación por jaula con ingresos, altas y pacientes referidos por falta de jaula."),
  component: Hosp,
});

function Hosp() {
  const { state } = useStore();
  const p = state.params;
  const [s, setS] = useState<Species>("perro");
  const [days, setDays] = useState<"7" | "14">("7");
  const D = Number(days);
  const res = useMemo(
    () => simulateStays({ admissionsPerDay: p.admissionsPerDay[s], meanStayDays: p.meanStayDays[s], cages: p.cages[s], horizonDays: D, seed: p.seed + SPECIES.indexOf(s) }),
    [p.admissionsPerDay, p.meanStayDays, p.cages, p.seed, s, D],
  );
  const discharges = res.stays.filter((x) => x.discharge <= D).length;
  const W = D * 64;

  return (
    <div>
      <PageHeader title="Hospitalización simulada" subtitle="Simulación de estancias con los parámetros actuales; se asigna la jaula libre de menor número." />
      <Ready>
        <div className="mb-4 flex flex-wrap gap-3">
          <Segmented value={s} onChange={setS} options={SPECIES.map((x) => ({ value: x, label: SPECIES_LABEL[x] }))} />
          <Segmented value={days} onChange={setDays} options={[{ value: "7", label: "7 días" }, { value: "14", label: "14 días" }]} />
        </div>
        <div className="mb-4 grid grid-cols-3 gap-3">
          <Metric label="Ingresos" value={String(res.stays.length)} />
          <Metric label="Altas" value={String(discharges)} />
          <Metric label="Referidos" value={String(res.referred.length)} tone={res.referred.length ? "bad" : undefined} hint="por falta de jaula" />
        </div>
        <Panel className="p-0">
          {p.cages[s] === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No hay jaulas configuradas para {SPECIES_LABEL[s].toLowerCase()}: todos los pacientes se referirían.</p>
          ) : (
            <div className="overflow-x-auto p-3">
              <div style={{ width: W + 64 }}>
                <div className="flex pl-16 font-mono text-[10px] text-muted-foreground">
                  {Array.from({ length: D }, (_, d) => <div key={d} style={{ width: 64 }} className="border-l border-border pl-1">Día {d + 1}</div>)}
                </div>
                {Array.from({ length: p.cages[s] }, (_, c) => (
                  <div key={c} className="flex items-center border-t border-border/60">
                    <div className="w-16 shrink-0 py-1.5 text-xs font-medium">{SPECIES_SINGULAR[s]} {c + 1}</div>
                    <div className="relative h-7" style={{ width: W }}>
                      {res.stays.filter((x) => x.cage === c).map((x) => (
                        <div key={x.pid} title={`Paciente ${x.pid + 1}: día ${(x.admit + 1).toFixed(1)} → ${(x.discharge + 1).toFixed(1)}`} className="absolute top-1 h-5 rounded border border-card bg-primary/80" style={{ left: (x.admit / D) * W, width: Math.max(3, ((Math.min(D, x.discharge) - x.admit) / D) * W) }} />
                      ))}
                    </div>
                  </div>
                ))}
                <div className="flex items-center border-t border-border">
                  <div className="w-16 shrink-0 py-1.5 text-xs font-semibold text-destructive">Referidos</div>
                  <div className="relative h-7" style={{ width: W }}>
                    {res.referred.map((x) => (
                      <div key={x.pid} title={`Referido día ${(x.t + 1).toFixed(1)}`} className="absolute top-1.5 h-4 w-1.5 rounded-sm bg-destructive" style={{ left: (x.t / D) * W }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </Panel>
        <p className="mt-3 text-xs text-muted-foreground">Barra = estancia (ingreso a alta). Marca roja = paciente referido. Deslice horizontalmente en el teléfono.</p>
      </Ready>
    </div>
  );
}
