import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { NumField, PageHeader, Panel, Ready, Segmented, SlotBars } from "@/components/app/kit";
import { useStore } from "@/lib/store";
import { pageHead } from "@/lib/head";
import { hourLabel, lambdaFor, round2, vetsFor } from "@/engine/params";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useRef } from "react";
import { ChartToggle } from "@/components/app/kit";
import type { DayType } from "@/engine/types";

export const Route = createFileRoute("/turnos")({
  head: pageHead("Turnos y llegadas", "24 franjas horarias con tasa de llegadas entre semana, multiplicador de fin de semana y médicos por franja."),
  component: Turnos,
});

function Turnos() {
  const { state, dispatch } = useStore();
  const [day, setDay] = useState<DayType>("weekday");
  const [cell, setCell] = useState<{ day: DayType; hour: number; label: string } | null>(null);
  const [asTable, setAsTable] = useState(false);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const [blockSize,setBlockSize]=useState(6);
  useEffect(()=>{const update=()=>setBlockSize(window.innerWidth>=1600?24:window.innerWidth>=900?12:6);update();window.addEventListener("resize",update);return()=>window.removeEventListener("resize",update);},[]);
  const p = state.params;
  const lam = lambdaFor(p, day);
  const vets = vetsFor(p, day);

  const setLambda = (h: number, v: number) => {
    const arr = [...p.lambdaWeekday];
    arr[h] = v;
    void dispatch({ kind: "params/set", payload: { patch: { lambdaWeekday: arr }, label: `λ ${hourLabel(h)}: ${p.lambdaWeekday[h]} → ${v} llegadas/h` } });
  };
  const setVets = (h: number, v: number, selectedDay: DayType = day) => {
    const key = selectedDay === "weekend" ? "vetsWeekend" : "vetsWeekday";
    const arr = [...p[key]];
    arr[h] = Math.round(v);
    void dispatch({ kind: "params/set", payload: { patch: { [key]: arr }, label: `Médicos ${selectedDay === "weekend" ? "fin de semana" : "entre semana"} ${hourLabel(h)}: ${p[key][h]} → ${arr[h]}` } });
  };

  return (
    <div>
      <PageHeader title="Turnos y llegadas" subtitle="λ = llegadas por hora. El fin de semana usa λ entre semana × multiplicador." />
      <Ready>
        <Panel title="Llegadas por día y hora" className="mb-6" aside={<ChartToggle table={asTable} onChange={setAsTable} />}>
          <p className="mb-4 text-xs text-muted-foreground">Lunes a viernes comparten las mismas tasas; sábado y domingo aplican el multiplicador. Cambiar una franja actualiza todo su tipo de día.</p>
          <div className="mb-4 flex flex-wrap gap-3 text-xs text-muted-foreground"><span>λ · llegadas/h</span><span className="rounded bg-muted px-2 py-1">Baja</span><span className="rounded bg-accent px-2 py-1">Media</span><span className="rounded bg-primary px-2 py-1 text-primary-foreground">Alta</span></div>
          {asTable ? <div className="max-h-96 overflow-auto"><table className="w-full text-xs"><caption className="sr-only">Tasas por tipo de día</caption><thead className="sticky top-0 bg-card"><tr><th scope="col" className="p-2">Hora</th><th scope="col">Lun–Vie</th><th scope="col">Sáb–Dom</th></tr></thead><tbody>{p.lambdaWeekday.map((v,h)=><tr key={h} className="border-t border-border/40"><th scope="row" className="p-2 font-mono">{hourLabel(h)}</th><td className="text-center font-mono">{v.toFixed(2)}</td><td className="text-center font-mono">{(v*p.weekendMult).toFixed(2)}</td></tr>)}</tbody></table></div> : <div className="grid gap-1 ">{Array.from({length:24/blockSize},(_,half)=><div key={half} className="grid gap-0.5" style={{gridTemplateColumns:`2rem repeat(${blockSize},minmax(44px,1fr))`}}><span/><>{Array.from({length:blockSize},(_,i)=><span key={i} className="py-2 text-center font-mono text-[10px] text-muted-foreground">{String(i+half*blockSize).padStart(2,"0")}</span>)}</>{["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"].map((label,d)=><div key={label} className="contents"><span className="flex items-center text-[10px] font-medium">{label}</span>{Array.from({length:blockSize},(_,i)=>{const h=i+half*blockSize;const dt:DayType=d>=5?"weekend":"weekday";const value=lambdaFor(p,dt)[h]??0;const ratio=value/Math.max(1,...lambdaFor(p,"weekend"));return <Button key={h} variant="ghost" className={`h-11 min-w-0 rounded-sm p-0 font-mono text-[9px] ${ratio>.66?"bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground":ratio>.33?"bg-accent text-accent-foreground":"bg-muted text-foreground"}`} aria-label={`${label} ${hourLabel(h)}, ${value.toFixed(2)} llegadas por hora. Editar`} onClick={e=>{trigger.current=e.currentTarget;setCell({day:dt,hour:h,label});}}>{value.toFixed(1)}</Button>;})}</div>)}</div>)}</div>}
        </Panel>
        <Sheet open={!!cell} onOpenChange={open=>{if(!open)setCell(null);}}><SheetContent side="bottom" className="mx-auto max-h-[85dvh] max-w-xl overflow-auto rounded-t-2xl" onCloseAutoFocus={e=>{e.preventDefault();trigger.current?.focus();}}><SheetTitle>{cell ? `${cell.label} · ${hourLabel(cell.hour)}` : "Editar franja"}</SheetTitle><SheetDescription className="mt-2">{cell?.day==="weekend"?"Aplica a sábado y domingo; la tasa se obtiene con el multiplicador.":"Aplica de lunes a viernes."}</SheetDescription>{cell&&<div className="my-6 grid grid-cols-2 gap-4">{cell.day==="weekday"?<NumField label="Llegadas base por hora" step={.1} max={500} value={p.lambdaWeekday[cell.hour]??0} onCommit={v=>setLambda(cell.hour,v)}/>:<NumField label="Multiplicador fin de semana" step={.05} max={10} value={p.weekendMult} onCommit={v=>void dispatch({kind:"params/set",payload:{patch:{weekendMult:v},label:`Multiplicador fin de semana: ${p.weekendMult} → ${v}`}})}/>}<NumField label="Médicos" max={100} value={vetsFor(p,cell.day)[cell.hour]??0} onCommit={v=>setVets(cell.hour,v,cell.day)}/></div>}<Button className="w-full" onClick={()=>setCell(null)}>Listo</Button></SheetContent></Sheet>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <Segmented value={day} onChange={setDay} options={[{ value: "weekday", label: "Entre semana" }, { value: "weekend", label: "Fin de semana" }]} />
          <NumField className="w-44" label="Multiplicador fin de semana" step={0.05} max={10} value={p.weekendMult} suffix="×" onCommit={(v) => void dispatch({ kind: "params/set", payload: { patch: { weekendMult: v }, label: `Multiplicador fin de semana: ${p.weekendMult} → ${v}` } })} />
        </div>
        <Panel title={`λ resultante por franja · ${round2(lam.reduce((s, x) => s + x, 0))} llegadas/día`} className="mb-4">
          <SlotBars values={lam} format={(v) => `${round2(v)} llegadas/h`} />
        </Panel>
        <Panel>
          <div className="grid grid-cols-[3.5rem_1fr_4.5rem_1fr] items-center gap-x-2 gap-y-1.5 text-sm">
            <div className="text-xs font-semibold text-muted-foreground">Hora</div>
            <div className="text-xs font-semibold text-muted-foreground">λ base (/h)</div>
            <div className="text-right text-xs font-semibold text-muted-foreground">λ result.</div>
            <div className="text-xs font-semibold text-muted-foreground">Médicos</div>
            {lam.map((l, h) => (
              <Row key={h} h={h} base={p.lambdaWeekday[h] ?? 0} result={l} vets={vets[h] ?? 0} editLambda={day === "weekday"} onLambda={setLambda} onVets={(h,v)=>setVets(h,v)} />
            ))}
          </div>
          {day === "weekend" && <p className="mt-3 text-xs text-muted-foreground">Para cambiar λ base use la pestaña «Entre semana».</p>}
        </Panel>
      </Ready>
    </div>
  );
}

function Row({ h, base, result, vets, editLambda, onLambda, onVets }: { h: number; base: number; result: number; vets: number; editLambda: boolean; onLambda: (h: number, v: number) => void; onVets: (h: number, v: number) => void }) {
  return (
    <>
      <div className="font-mono text-xs tabular-nums">{hourLabel(h)}</div>
      {editLambda ? <NumField value={base} step={0.1} max={500} onCommit={(v) => onLambda(h, v)} label={`λ ${hourLabel(h)}`}  /> : <div className="font-mono tabular-nums text-muted-foreground">{base}</div>}
      <div className="text-right font-mono font-semibold tabular-nums">{result.toFixed(2)}</div>
      <NumField value={vets} max={100} onCommit={(v) => onVets(h, v)} label={`Médicos ${hourLabel(h)}`}  />
    </>
  );
}
