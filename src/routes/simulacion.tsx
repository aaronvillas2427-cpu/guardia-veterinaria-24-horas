import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, Metric, NumField, PageHeader, Panel, Ready, Segmented, SlotBars } from "@/components/app/kit";
import { useStore } from "@/lib/store";
import { pageHead } from "@/lib/head";
import { runSimulation } from "@/lib/sim-runner";
import { simInputFor, vetsFor } from "@/engine/params";
import type { DayType } from "@/engine/types";
import { fmt, fmtDate, pct } from "@/lib/format";
import { Button } from "@/components/ui/button";
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
  const [stage, setStage] = useState<1 | 2 | 3>(1);
  const [announcement, setAnnouncement] = useState("");
  const [error, setError] = useState("");
  const p = state.params;
  const sim = state.lastSim;

  const run = async () => {
    setRunning(true);
    setStage(2);
    setError("");
    setAnnouncement("Simulación iniciada. Calculando resultados, espere.");
    try {
      const summary = await runSimulation(simInputFor(p, day));
      await dispatch({ kind: "sim/run", payload: { dayType: day, summary } });
      setStage(3);
      setAnnouncement(`Resultados listos: espera de urgencias ${fmt(summary.waitU.mean)} minutos, consultas ${fmt(summary.waitC.mean)} minutos y ${fmt(summary.abandoned.mean)} abandonos por día.`);
    } catch (e) {
      setStage(1);
      setError(`La simulación falló: ${e instanceof Error ? e.message : e}`);
      toast.error(`La simulación falló: ${e instanceof Error ? e.message : e}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div>
      <PageHeader title="Simulación de turnos" subtitle="Turnos de 24 horas · Misma semilla, mismos resultados." />
      <div role="status" aria-live="polite" className="sr-only">{announcement}</div>
      {error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
      <ol className="mb-6 grid grid-cols-3 gap-2" aria-label="Etapas de simulación">{["Parámetros", "Ejecutar", "Resultados"].map((name,i)=><li key={name}><Button variant="ghost" disabled={running || (i===2&&!sim)} onClick={()=>setStage((i+1) as 1|2|3)} aria-current={stage===i+1?"step":undefined} className={`w-full flex-wrap border-b-2 rounded-none px-1 text-xs ${stage===i+1?"border-primary text-primary":"border-border/40 text-muted-foreground"}`}><span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted font-mono">{stage>i+1?<Check className="h-3 w-3"/>:i+1}</span>{name}</Button></li>)}</ol>
      {running && <div className="mb-6 rounded-xl border border-primary bg-card p-4" aria-busy="true"><p className="mb-3 flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin"/>Calculando {p.replications} réplicas de 24 horas…</p><div role="progressbar" aria-label="Simulación en curso" className="h-2 overflow-hidden rounded-full bg-muted"><div className="skeleton h-full w-full bg-primary"/></div></div>}
      <Ready>
        <Panel className="mb-4" title="Parámetros del turno">
          <div className="flex flex-wrap items-end gap-3">
            <Segmented value={day} onChange={setDay} options={[{ value: "weekday", label: "Entre semana" }, { value: "weekend", label: "Fin de semana" }]} />
            <NumField className="w-32" label="Semilla" max={4294967295} value={p.seed} onCommit={(v) => void dispatch({ kind: "params/set", payload: { patch: { seed: Math.floor(v) }, label: `Semilla ${p.seed} → ${Math.floor(v)}` } })} />
            <NumField className="w-28" label="Réplicas" min={1} max={500} value={p.replications} onCommit={(v) => void dispatch({ kind: "params/set", payload: { patch: { replications: Math.max(1, Math.floor(v)) }, label: `Réplicas ${p.replications} → ${Math.floor(v)}` } })} />
            <Button onClick={run} disabled={running} className="flex h-11 items-center gap-2 rounded-lg bg-primary px-5 font-semibold text-primary-foreground disabled:opacity-60">
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} {running ? "Simulando…" : "Simular"}
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Médicos por franja: {vetsFor(p, day).join(" · ")} — <Link to="/turnos" className="min-h-11 inline-flex items-center text-primary underline">editar en Turnos</Link>
          </p>
        </Panel>

        {stage === 2 && !running && <div className="mb-6 flex items-center justify-between gap-3 border-y border-border/40 py-5"><p className="text-sm text-muted-foreground">{p.replications} réplicas listas para ejecutar.</p><Button onClick={run}><Play/>Ejecutar</Button></div>}
        {!sim ? (
          <EmptyState title="Aún no hay simulación"><Button onClick={run} disabled={running} variant="outline" className="mt-3"><Play/>Ejecutar primera simulación</Button></EmptyState>
        ) : (
          <>
            <p className="mb-3 text-sm text-muted-foreground">
              Resultado: {sim.dayType === "weekend" ? "fin de semana" : "entre semana"} · {sim.summary.replications} réplicas · semilla {sim.summary.seed} · {fmtDate(sim.ts)}
            </p>
            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Metric label="Espera media urgencia" value={fmt(sim.summary.waitU.mean)} unit="min" hint={ci(sim.summary.waitU)} interval={sim.summary.waitU} />
              <Metric label="Espera media consulta" value={fmt(sim.summary.waitC.mean)} unit="min" hint={ci(sim.summary.waitC)} interval={sim.summary.waitC} />
              <Metric label="Abandonos" value={fmt(sim.summary.abandoned.mean)} unit="por día" hint={`${ci(sim.summary.abandoned)} · ${pct(sim.summary.abandonRate.mean)} de consultas`} interval={sim.summary.abandoned} tone={sim.summary.abandonRate.mean > 0.05 ? "warn" : "ok"} />
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
