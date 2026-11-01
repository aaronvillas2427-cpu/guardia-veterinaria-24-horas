import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Metric, PageHeader, Panel, Ready, Segmented, ChartToggle } from "@/components/app/kit";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useRef } from "react";
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
  const [table, setTable] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const trigger = useRef<HTMLElement | null>(null);

  return (
    <div>
      <PageHeader title="Hospitalización simulada" subtitle="Simulación de estancias con los parámetros actuales; se asigna la jaula libre de menor número." />
      <Ready>
        <div className="mb-4 flex flex-wrap gap-3">
          <Segmented value={s} onChange={setS} options={SPECIES.map((x) => ({ value: x, label: SPECIES_LABEL[x] }))} />
          <Segmented value={days} onChange={setDays} options={[{ value: "7", label: "7 días" }, { value: "14", label: "14 días" }]} />
        </div>
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <Metric label="Ingresos" value={String(res.stays.length)} />
          <Metric label="Altas" value={String(discharges)} />
          <Metric label="Referidos" value={String(res.referred.length)} tone={res.referred.length ? "bad" : undefined} hint="por falta de jaula" />
        </div>
        <Panel title={`Ocupación por jaula · ${SPECIES_LABEL[s]}`} aside={<ChartToggle table={table} onChange={setTable}/> }>
          <p className="mb-4 text-xs text-muted-foreground">{res.stays.length} ingresos, {discharges} altas y {res.referred.length} referidos en {D} días simulados. Datos de ejemplo, no agenda clínica real.</p>
          <div className="mb-5 flex flex-wrap gap-4 text-xs text-muted-foreground"><span className="flex items-center gap-2"><span className="gantt-stay h-3 w-5 rounded-sm"/>Ingreso / estancia</span><span className="flex items-center gap-2"><span className="h-3 w-3 border-2 border-primary bg-card"/>Alta □</span><span className="flex items-center gap-2"><span className="gantt-referral h-3 w-3"/>Referido ×</span></div>
          {table ? <div className="max-h-[60dvh] overflow-auto" tabIndex={0} role="region" aria-label="Tabla de hospitalización"><table className="w-full text-xs"><caption className="sr-only">Ingresos, altas y referidos de la simulación</caption><thead className="sticky top-0 bg-card"><tr>{["Paciente","Jaula","Ingreso (día)","Alta (día)","Estado"].map(h=><th scope="col" key={h} className="p-2 text-left">{h}</th>)}</tr></thead><tbody>{res.stays.map(x=><tr key={x.pid} className="border-t border-border/40"><th scope="row" className="p-2">{x.pid+1}</th><td className="font-mono">{x.cage+1}</td><td className="font-mono">{(x.admit+1).toFixed(1)}</td><td className="font-mono">{(x.discharge+1).toFixed(1)}</td><td>{x.discharge<=D?"Alta":"En estancia"}</td></tr>)}{res.referred.map(x=><tr key={`r${x.pid}`} className="border-t border-border/40"><th scope="row" className="p-2">{x.pid+1}</th><td>—</td><td className="font-mono">{(x.t+1).toFixed(1)}</td><td>—</td><td>Referido</td></tr>)}</tbody></table></div> : p.cages[s]===0 ? <p className="text-sm text-muted-foreground">No hay jaulas configuradas para {SPECIES_LABEL[s].toLowerCase()}: todos los pacientes se referirían.</p> : <div>
          <div className="ml-14 grid pb-3 font-mono text-[9px] text-muted-foreground" style={{gridTemplateColumns:`repeat(${D},minmax(0,1fr))`}}>{Array.from({length:D},(_,d)=><span key={d} className="text-center">{d+1}</span>)}</div>
          {Array.from({length:p.cages[s]},(_,c)=><div key={c} className="border-t border-border/40 py-3"><div className="flex min-h-14 items-center"><span className="w-14 shrink-0 text-[10px] font-medium">Jaula {c+1}</span><div className="relative h-9 min-w-0 flex-1" aria-hidden="true">{res.stays.filter(x=>x.cage===c).map(x=><span key={x.pid} className="gantt-stay absolute top-2 h-5 rounded-sm border border-primary" style={{left:`${x.admit/D*100}%`,width:`${Math.max(.4,(Math.min(D,x.discharge)-x.admit)/D*100)}%`}}>{x.discharge<=D&&<span className="absolute right-0 top-0 h-full w-1 border border-primary bg-card"/>}</span>)}</div></div><label className="flex flex-wrap items-center gap-2 pl-14 text-[10px] text-muted-foreground">Estancias<select aria-label={`Detalle de pacientes en jaula ${c+1}`} className="min-h-11 min-w-0 max-w-full flex-1 rounded-lg border border-input bg-card px-2" defaultValue="" onChange={e=>{const x=res.stays.find(x=>String(x.pid)===e.target.value);if(x){trigger.current=e.currentTarget;setDetail(`Paciente ${x.pid+1} · ${SPECIES_SINGULAR[s]} · Jaula ${c+1}. Ingreso: día ${(x.admit+1).toFixed(1)}. Alta: día ${(x.discharge+1).toFixed(1)}.`);}}}><option value="" disabled>Elegir paciente</option>{res.stays.filter(x=>x.cage===c).map(x=><option key={x.pid} value={x.pid}>Paciente {x.pid+1}: {(x.admit+1).toFixed(1)} → {(x.discharge+1).toFixed(1)}</option>)}</select></label></div>)}
          <div className="flex min-h-14 items-center border-t border-border/40"><span className="w-14 shrink-0 text-[10px] font-semibold text-destructive">Referidos</span><div className="relative h-12 min-w-0 flex-1" aria-hidden="true">{res.referred.map(x=><span key={x.pid} className="gantt-referral absolute top-3 flex h-5 w-2 items-center justify-center text-xs" style={{left:`${Math.min(98,x.t/D*100)}%`}}>×</span>)}</div></div><label className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">Detalle de referidos<select className="min-h-11 min-w-0 max-w-full flex-1 rounded-lg border border-input bg-card px-2" defaultValue="" onChange={e=>{const x=res.referred.find(x=>String(x.pid)===e.target.value);if(x){trigger.current=e.currentTarget;setDetail(`Paciente ${x.pid+1}: referido día ${(x.t+1).toFixed(1)} por falta de jaula.`);}}}><option value="" disabled>Elegir paciente</option>{res.referred.map(x=><option key={x.pid} value={x.pid}>Paciente {x.pid+1}: día {(x.t+1).toFixed(1)}</option>)}</select></label></div>}

        </Panel>
        <Dialog open={!!detail} onOpenChange={open=>{if(!open)setDetail(null);}}><DialogContent onCloseAutoFocus={e=>{e.preventDefault();trigger.current?.focus();}}><DialogTitle>Detalle de hospitalización</DialogTitle><DialogDescription>{detail}</DialogDescription></DialogContent></Dialog>

      </Ready>
    </div>
  );
}
