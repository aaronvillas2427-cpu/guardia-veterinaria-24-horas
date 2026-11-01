import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { Meter, Metric, Panel, Ready, SlotBars } from "@/components/app/kit";
import { useStore } from "@/lib/store";
import { pageHead } from "@/lib/head";
import { runSimulation } from "@/lib/sim-runner";
import { dayTypeOf, simInputFor, vetsFor, hourLabel, cageAnalysis } from "@/engine/params";
import { SPECIES, SPECIES_LABEL } from "@/engine/types";
import { fmt, fmtDate, pct } from "@/lib/format";

export const Route = createFileRoute("/")({
  head: pageHead("Inicio", "Médicos por turno hoy, abandonos de la última simulación y ocupación de jaulas por especie."),
  component: Home,
});

function useNow() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function Home() {
  const { state, dispatch, status } = useStore();
  const [running, setRunning] = useState(false);
  const now = useNow();
  const day = now ? dayTypeOf(now) : "weekday";
  const hour = now?.getHours() ?? 0;

  const simulate = async () => {
    setRunning(true);
    try {
      const summary = await runSimulation(simInputFor(state.params, day));
      await dispatch({ kind: "sim/run", payload: { dayType: day, summary } });
      toast.success(`Simulación lista: ${fmt(summary.abandoned.mean)} consultas abandonadas por día.`);
    } catch (e) {
      toast.error(`La simulación falló: ${e instanceof Error ? e.message : e}`);
    } finally {
      setRunning(false);
    }
  };

  const vets = vetsFor(state.params, day);
  const sim = state.lastSim;
  const cages = cageAnalysis(state.params);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{now ? now.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" }) : "Hoy"} · {day === "weekend" ? "fin de semana" : "entre semana"}</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Guardia de hoy</h1>
        </div>
        <button
          onClick={simulate}
          disabled={running || status !== "ready"}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 text-base font-semibold text-primary-foreground shadow-panel transition hover:bg-primary/90 disabled:opacity-60 sm:w-auto"
        >
          {running ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
          {running ? "Simulando…" : "Simular 24 horas"}
        </button>
      </div>

      <Ready>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label={`Médicos ahora (${hourLabel(hour)})`} value={String(vets[hour])} unit="médicos" hint={`${vets.reduce((s, v) => s + v, 0)} horas-médico hoy`} />
          <Metric
            label="Consultas abandonadas"
            value={sim ? fmt(sim.summary.abandoned.mean) : "—"}
            unit="por día"
            hint={sim ? `IC 95 %: ${fmt(sim.summary.abandoned.lo)}–${fmt(sim.summary.abandoned.hi)}` : "Aún sin simulación"}
            tone={sim && sim.summary.abandonRate.mean > 0.05 ? "warn" : undefined}
          />
          <Metric label="Espera media urgencia" value={sim ? fmt(sim.summary.waitU.mean) : "—"} unit="min" hint={sim ? `P90 ${fmt(sim.summary.p90U)} min` : undefined} />
          <Metric label="Espera media consulta" value={sim ? fmt(sim.summary.waitC.mean) : "—"} unit="min" hint={sim ? `Abandono ${pct(sim.summary.abandonRate.mean)}` : undefined} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Médicos por franja hoy" aside={<Link to="/turnos" className="text-sm font-medium text-primary">Editar</Link>}>
            <SlotBars values={vets} highlight={hour} format={(v) => `${v} médicos`} />
            {sim && (
              <p className="mt-3 text-xs text-muted-foreground">
                Última simulación: {fmtDate(sim.ts)} · {sim.dayType === "weekend" ? "fin de semana" : "entre semana"} · {sim.summary.replications} réplicas
              </p>
            )}
          </Panel>
          <Panel title="Ocupación de jaulas ahora" aside={<Link to="/jaulas" className="text-sm font-medium text-primary">Gestionar</Link>}>
            <div className="space-y-4">
              {SPECIES.map((s) => {
                const occ = state.occupancy[s].filter(Boolean).length;
                const row = cages.find((c) => c.species === s)!;
                return (
                  <div key={s}>
                    <Meter label={SPECIES_LABEL[s]} value={occ} max={state.params.cages[s]} />
                    <p className="mt-1 text-xs text-muted-foreground">Bloqueo estimado (Erlang B): {pct(row.blocking)}</p>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>
      </Ready>
    </div>
  );
}
