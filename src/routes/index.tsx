import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { Metric, Panel, Ready, SlotBars } from "@/components/app/kit";
import { Button } from "@/components/ui/button";
import { CageRings } from "@/components/app/ring-gauge";
import { useStore } from "@/lib/store";
import { pageHead } from "@/lib/head";
import { runSimulation } from "@/lib/sim-runner";
import { dayTypeOf, simInputFor, vetsFor, hourLabel, cageAnalysis, lambdaFor } from "@/engine/params";
import { fmt, fmtDate, pct } from "@/lib/format";
export const Route = createFileRoute("/")({ head: pageHead("Inicio", "Médicos por turno hoy, abandonos de la última simulación y ocupación de jaulas por especie."), component: Home });
function useNow() { const [now,setNow]=useState<Date|null>(null);useEffect(()=>{setNow(new Date());const t=setInterval(()=>setNow(new Date()),60000);return()=>clearInterval(t);},[]);return now; }
function Home() {
 const {state,dispatch,status}=useStore(); const [running,setRunning]=useState(false);const [announcement,setAnnouncement]=useState("");const [error,setError]=useState("");const now=useNow();const day=now?dayTypeOf(now):"weekday";const hour=now?.getHours()??0;
 const simulate=async()=>{setRunning(true);setError("");setAnnouncement("Simulación iniciada. Calculando turnos de 24 horas.");try{const summary=await runSimulation(simInputFor(state.params,day));await dispatch({kind:"sim/run",payload:{dayType:day,summary}});const msg=`Simulación lista: ${fmt(summary.abandoned.mean)} consultas abandonadas por día.`;setAnnouncement(msg);toast.success(msg);}catch(e){const msg=`La simulación falló: ${e instanceof Error?e.message:e}`;setError(msg);toast.error(msg);}finally{setRunning(false);}};
 const vets=vetsFor(state.params,day);const sim=state.lastSim;const cages=cageAnalysis(state.params);
 return <div className="space-y-6"><div aria-live="polite" role="status" className="sr-only">{announcement}</div>{error&&<p role="alert" className="text-destructive">{error}</p>}
 <div className="flex flex-col gap-5 border-b border-border/40 pb-6 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs text-muted-foreground">{now?now.toLocaleDateString("es-MX",{weekday:"long",day:"numeric",month:"long"}):"Hoy"} · {day==="weekend"?"fin de semana":"entre semana"}</p><h1 className="mt-2 text-3xl font-semibold">Guardia de hoy</h1><p className="mt-2 text-xs text-muted-foreground">Puebla, México · Datos de ejemplo</p></div><Button onClick={simulate} disabled={running||status!=="ready"} className="h-14 w-full px-6 text-base sm:w-auto">{running?<Loader2 className="animate-spin"/>:<Play/>}{running?"Simulando…":"Simular 24 horas"}</Button></div>
 <Ready><div className="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2 xl:grid-cols-4">
 <Metric label={`Médicos ahora (${hourLabel(hour)})`} value={String(vets[hour])} unit="médicos" hint={`${vets.reduce((s,v)=>s+v,0)} horas-médico hoy`} series={vets}/>
 <Metric label="Consultas abandonadas" value={sim?fmt(sim.summary.abandoned.mean):"—"} unit="por día" hint={sim?`IC 95 %: ${fmt(sim.summary.abandoned.lo)}–${fmt(sim.summary.abandoned.hi)}`:"Aún sin simulación"} series={sim?.summary.slotAbandoned} tone={sim?sim.summary.abandonRate.mean>.05?"warn":"ok":undefined}/>
 <Metric label="Espera media urgencia" value={sim?fmt(sim.summary.waitU.mean):"—"} unit="min" hint={sim?`90 % espera ≤ ${fmt(sim.summary.p90U)} min`:"Aún sin simulación"} series={sim?.summary.slotWait}/>
 <Metric label="Espera media consulta" value={sim?fmt(sim.summary.waitC.mean):"—"} unit="min" hint={sim?`Abandono ${pct(sim.summary.abandonRate.mean)}`:"Aún sin simulación"} series={sim?.summary.slotWait}/></div>
 <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_1fr]"><Panel title="Médicos por franja hoy" aside={<Link to="/turnos" className="inline-flex min-h-11 items-center text-sm font-medium text-primary">Editar turnos →</Link>}><SlotBars values={vets} compare={lambdaFor(state.params,day)} highlight={hour} format={v=>`${v} médicos`}/>{sim&&<p className="mt-4 text-xs text-muted-foreground">Última simulación: {fmtDate(sim.ts)} · {sim.dayType==="weekend"?"fin de semana":"entre semana"} · {sim.summary.replications} réplicas</p>}</Panel>
 <Panel title="Ocupación de jaulas ahora" aside={<Link to="/jaulas" className="inline-flex min-h-11 items-center text-sm font-medium text-primary">Gestionar →</Link>}><CageRings rows={cages.map(r=>({...r,occupied:state.occupancy[r.species].filter(Boolean).length,target:state.params.targetBlocking}))}/></Panel></div></Ready></div>;
}
