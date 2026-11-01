import { createFileRoute } from "@tanstack/react-router";
import { Metric, NumField, PageHeader, Panel, Ready, Select } from "@/components/app/kit";
import { useStore } from "@/lib/store";
import { pageHead } from "@/lib/head";
import { meanServiceMin, muPerHour } from "@/engine/params";
import type { Dist, DistKind, Params } from "@/engine/types";
import { fmt } from "@/lib/format";

export const Route = createFileRoute("/atencion")({
  head: pageHead("Tipos de atención", "Urgencias con prioridad y consultas generales con paciencia configurable: mezcla y tiempos de servicio."),
  component: Atencion,
});

const KINDS = [
  { value: "exp", label: "Exponencial" },
  { value: "lognormal", label: "Lognormal" },
  { value: "fixed", label: "Fija" },
];

function Atencion() {
  const { state, dispatch } = useStore();
  const p = state.params;
  const set = (patch: Partial<Params>, label: string) => void dispatch({ kind: "params/set", payload: { patch, label } });

  const DistEditor = ({ k, title }: { k: "serviceUrgencia" | "serviceConsulta"; title: string }) => {
    const d = p[k];
    const upd = (nd: Dist, what: string) => set({ [k]: nd }, `${title}: ${what}`);
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Select label="Distribución" value={d.kind} options={KINDS} onChange={(v) => upd({ ...d, kind: v as DistKind }, `distribución ${v}`)} />
        <NumField label="Media" suffix="min" step={1} max={600} value={d.mean} onCommit={(v) => upd({ ...d, mean: v }, `media ${d.mean} → ${v} min`)} />
        {d.kind === "lognormal" && <NumField label="Coef. de variación" step={0.1} max={5} value={d.cv} onCommit={(v) => upd({ ...d, cv: v }, `CV ${d.cv} → ${v}`)} />}
      </div>
    );
  };

  return (
    <div>
      <PageHeader title="Tipos de atención" subtitle="Las urgencias se atienden antes que las consultas (sin interrumpir una consulta en curso) y nunca abandonan." />
      <Ready>
        <div className="mb-4 grid grid-cols-2 gap-3">
          <Metric label="Servicio medio combinado" value={fmt(meanServiceMin(p))} unit="min" />
          <Metric label="Tasa por médico (μ)" value={fmt(muPerHour(p), 2)} unit="pacientes/h" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Mezcla">
            <NumField label="Urgencias del total" suffix="%" max={100} value={Math.round(p.urgentShare * 1000) / 10} onCommit={(v) => set({ urgentShare: v / 100 }, `Urgencias: ${fmt(p.urgentShare * 100)} % → ${fmt(v)} %`)} />
            <p className="mt-2 text-sm text-muted-foreground">Consultas generales: {fmt((1 - p.urgentShare) * 100)} %</p>
          </Panel>
          <Panel title="Paciencia de consulta general">
            <div className="grid grid-cols-2 gap-3">
              <Select label="Tipo" value={p.patienceKind} options={[{ value: "exp", label: "Exponencial" }, { value: "fixed", label: "Fija" }]} onChange={(v) => set({ patienceKind: v as "exp" | "fixed" }, `Paciencia: ${v}`)} />
              <NumField label="Media" suffix="min" max={1000} value={p.patienceMin} onCommit={(v) => set({ patienceMin: v }, `Paciencia ${p.patienceMin} → ${v} min`)} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Si el paciente no empieza a ser atendido antes de agotar su paciencia, se retira. Las urgencias no abandonan.</p>
          </Panel>
          <Panel title="Urgencia · tiempo de servicio"><DistEditor k="serviceUrgencia" title="Servicio urgencia" /></Panel>
          <Panel title="Consulta general · tiempo de servicio"><DistEditor k="serviceConsulta" title="Servicio consulta" /></Panel>
        </div>
      </Ready>
    </div>
  );
}
