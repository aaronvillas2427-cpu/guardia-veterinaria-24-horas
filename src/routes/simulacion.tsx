import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, Metric, NumField, PageHeader, Panel, Ready, Segmented, SlotBars } from "@/components/app/kit";
import { useStore } from "@/lib/store";
import { pageHead } from "@/lib/head";
import { runSimulation } from "@/lib/sim-runner";
import { simInputFor, vetsFor } from "@/engine/params";
import type { DayType } from "@/engine/types";
import { fmt, fmtDate, pct } from "@/lib/format";
import type { Stat } from "@/engine/stats";

export const Route = createFileRoute("/simulacion")({
  head: pageHead("Simulación de turnos", "Simulación de eventos discretos de 24 h con prioridades, abandono, percentil 90 e intervalos de confianza."),
  component: Simulacion,
});

const ci = (s: Stat, d = 1) => `IC 95 %: ${fmt(s.lo, d)} – ${fmt(s.hi, d)}`;

function Simulacion() {
  const { state, dispatch } = useStore();
  const [day, setDay] = useState<DayType>("weekday");
  const [running, setRunning] = useState(false);
  const p = state.params;
  const sim = state.lastSim;

  const run = async () => {
    setRunning(true);
    try {
      const summary = await runSimulation(simInputFor(p, day));
      await dispatch({ kind: "sim/run", payload: { dayType: day, summary } });
    } catch (e) {
      toast.error(`La simulación falló: ${e instanceof Error ? e.message : e}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div>
      <PageHeader title="Simulación de turnos" subtitle="Se ejecuta en segundo plano (Web Worker). Misma semilla = mismos resultados." />
      <Ready>
        <Panel className="mb-4">
          <div className="flex flex-wrap items-end gap-3">
            <Segmented value={day} onChange={setDay} options={[{ value: "weekday", label: "Entre semana" }, { value: "weekend", label: "Fin de semana" }]} />
            <NumField className="w-32" label="Semilla" max={4294967295} value={p.seed} onCommit={(v) => void dispatch({ kind: "params/set", payload: { patch: { seed: Math.floor(v) }, label: `Semilla ${p.seed} → ${Math.floor(v)}` } })} />
            <NumField className="w-28" label="Réplicas" min={1} max={500} value={p.replications} onCommit={(v) => void dispatch({ kind: "params/set", payload: { patch: { replications: Math.max(1, Math.floor(v)) }, label: `Réplicas ${p.replications} → ${Math.floor(v)}` } })} />
            <button onClick={run} disabled={running} className="flex h-11 items-center gap-2 rounded-lg bg-primary px-5 font-semibold text-primary-foreground disabled:opacity-60">
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} {running ? "Simulando…" : "Simular"}
            </button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Médicos por franja: {vetsFor(p, day).join(" · ")} — <Link to="/turnos" className="text-primary">editar en Turnos</Link>
          </p>
        </Panel>

        {!sim ? (
          <EmptyState title="Aún no hay simulación">Pulse «Simular» para ver esperas, abandonos e intervalos de confianza.</EmptyState>
        ) : (
          <>
            <p className="mb-3 text-sm text-muted-foreground">
              Resultado: {sim.dayType === "weekend" ? "fin de semana" : "entre semana"} · {sim.summary.replications} réplicas · semilla {sim.summary.seed} · {fmtDate(sim.ts)}
            </p>
            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Metric label="Espera media urgencia" value={fmt(sim.summary.waitU.mean)} unit="min" hint={ci(sim.summary.waitU)} />
              <Metric label="Espera media consulta" value={fmt(sim.summary.waitC.mean)} unit="min" hint={ci(sim.summary.waitC)} />
              <Metric label="Abandonos" value={fmt(sim.summary.abandoned.mean)} unit="por día" hint={`${ci(sim.summary.abandoned)} · ${pct(sim.summary.abandonRate.mean)} de consultas`} tone={sim.summary.abandonRate.mean > 0.05 ? "warn" : undefined} />
              <Metric label="Percentil 90 de espera" value={fmt(sim.summary.p90)} unit="min" hint={`Urg. ${fmt(sim.summary.p90U)} · Cons. ${fmt(sim.summary.p90C)} min`} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Panel title="Espera media por franja de llegada (min)">
                <SlotBars values={sim.summary.slotWait} format={(v) => `${fmt(v)} min`} />
              </Panel>
              <Panel title="Abandonos por franja (por día)">
                <SlotBars values={sim.summary.slotAbandoned} format={(v) => fmt(v, 2)} />
              </Panel>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Llegadas por día: {fmt(sim.summary.arrivals.mean, 0)} ({ci(sim.summary.arrivals, 0)}). {sim.summary.unserved > 0 && `Sin atender al cierre por falta de médicos: ${fmt(sim.summary.unserved)}.`}
            </p>
          </>
        )}
      </Ready>
    </div>
  );
}
