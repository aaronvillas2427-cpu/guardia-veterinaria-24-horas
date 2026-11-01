import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { NumField, PageHeader, Panel, Ready, Segmented, SlotBars } from "@/components/app/kit";
import { useStore } from "@/lib/store";
import { pageHead } from "@/lib/head";
import { hourLabel, lambdaFor, round2, vetsFor } from "@/engine/params";
import type { DayType } from "@/engine/types";

export const Route = createFileRoute("/turnos")({
  head: pageHead("Turnos y llegadas", "24 franjas horarias con tasa de llegadas entre semana, multiplicador de fin de semana y médicos por franja."),
  component: Turnos,
});

function Turnos() {
  const { state, dispatch } = useStore();
  const [day, setDay] = useState<DayType>("weekday");
  const p = state.params;
  const lam = lambdaFor(p, day);
  const vets = vetsFor(p, day);

  const setLambda = (h: number, v: number) => {
    const arr = [...p.lambdaWeekday];
    arr[h] = v;
    void dispatch({ kind: "params/set", payload: { patch: { lambdaWeekday: arr }, label: `λ ${hourLabel(h)}: ${p.lambdaWeekday[h]} → ${v} llegadas/h` } });
  };
  const setVets = (h: number, v: number) => {
    const key = day === "weekend" ? "vetsWeekend" : "vetsWeekday";
    const arr = [...p[key]];
    arr[h] = Math.round(v);
    void dispatch({ kind: "params/set", payload: { patch: { [key]: arr }, label: `Médicos ${day === "weekend" ? "fin de semana" : "entre semana"} ${hourLabel(h)}: ${p[key][h]} → ${arr[h]}` } });
  };

  return (
    <div>
      <PageHeader title="Turnos y llegadas" subtitle="λ = llegadas por hora. El fin de semana usa λ entre semana × multiplicador." />
      <Ready>
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
              <Row key={h} h={h} base={p.lambdaWeekday[h]} result={l} vets={vets[h]} editLambda={day === "weekday"} onLambda={setLambda} onVets={setVets} />
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
      {editLambda ? <NumField value={base} step={0.1} max={500} onCommit={(v) => onLambda(h, v)} label={`λ ${hourLabel(h)}`} className="[&>span:first-child]:sr-only" /> : <div className="font-mono tabular-nums text-muted-foreground">{base}</div>}
      <div className="text-right font-mono font-semibold tabular-nums">{result.toFixed(2)}</div>
      <NumField value={vets} max={100} onCommit={(v) => onVets(h, v)} label={`Médicos ${hourLabel(h)}`} className="[&>span:first-child]:sr-only" />
    </>
  );
}
