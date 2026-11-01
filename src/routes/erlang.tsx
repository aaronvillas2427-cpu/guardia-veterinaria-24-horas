import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, Panel, Ready, Segmented } from "@/components/app/kit";
import { useStore } from "@/lib/store";
import { pageHead } from "@/lib/head";
import { erlangTable, hourLabel, round2 } from "@/engine/params";
import type { DayType } from "@/engine/types";
import { fmt, pct } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/erlang")({
  head: pageHead("Erlang C por franja", "Carga, ocupación, probabilidad de espera, espera media y nivel de servicio por franja, con médicos recomendados."),
  component: Erlang,
});

function Erlang() {
  const { state } = useStore();
  const [day, setDay] = useState<DayType>("weekday");
  const p = state.params;
  const rows = erlangTable(p, day);
  const sim = state.lastSim?.dayType === day ? state.lastSim : null;
  const changes = rows.filter((r) => r.recommended !== r.c);

  return (
    <div>
      <PageHeader title="Erlang C por franja" subtitle={`Objetivo: ${pct(p.targetServiceLevel, 0)} atendidos en ≤ ${p.targetMinutes} min (configurable en /admin).`} />
      <Ready>
        <div className="mb-4"><Segmented value={day} onChange={setDay} options={[{ value: "weekday", label: "Entre semana" }, { value: "weekend", label: "Fin de semana" }]} /></div>
        <Panel title="Recomendación" className="mb-4">
          {changes.length === 0 ? (
            <p className="text-sm">La plantilla actual cumple el objetivo en las 24 franjas sin médicos de sobra.</p>
          ) : (
            <ul className="flex flex-wrap gap-2 text-sm">
              {changes.map((r) => (
                <li key={r.hour} className={cn("rounded-lg border px-3 py-2 font-mono", r.recommended > r.c ? "border-destructive/40 bg-destructive/5" : "border-border bg-muted")}>
                  {hourLabel(r.hour)}: {r.c} → <b>{r.recommended}</b> ({r.recommended > r.c ? "+" : ""}{r.recommended - r.c})
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel className="mb-4 overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-muted text-xs text-muted-foreground">
                <tr>
                  {["Hora", "λ (/h)", "Médicos", "a (Erl)", "ρ", "Pw", "Wq (min)", `NS(${p.targetMinutes} min)`, "Recom.", "Sim. espera (min)"].map((h) => (
                    <th key={h} className="px-3 py-2 text-right font-semibold first:text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="font-mono tabular-nums">
                {rows.map((r) => (
                  <tr key={r.hour} className="border-t border-border">
                    <td className="px-3 py-1.5 text-left">{hourLabel(r.hour)}</td>
                    <td className="px-3 text-right">{round2(r.lambda).toFixed(2)}</td>
                    <td className="px-3 text-right">{r.c}</td>
                    <td className="px-3 text-right">{fmt(r.a, 2)}</td>
                    <td className={cn("px-3 text-right", !r.stable && "text-destructive")}>{fmt(r.rho, 2)}</td>
                    <td className="px-3 text-right">{r.stable ? pct(r.pw) : "—"}</td>
                    <td className={cn("px-3 text-right", !r.stable && "font-sans font-semibold text-destructive")}>{r.stable ? fmt(r.wqMin!) : "insuficiente"}</td>
                    <td className="px-3 text-right">{r.stable ? pct(r.ns!) : "—"}</td>
                    <td className={cn("px-3 text-right font-semibold", r.recommended > r.c ? "text-destructive" : r.recommended < r.c ? "text-primary" : "")}>{r.recommended}</td>
                    <td className="px-3 text-right text-muted-foreground">{sim ? fmt(sim.summary.slotWait[r.hour]) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="¿Por qué difiere de la simulación?">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p><b className="text-foreground">Erlang C no tiene abandono:</b> supone que todos esperan lo necesario. En la simulación, las consultas se van al agotar su paciencia; eso acorta la cola y la espera de quienes se quedan, por lo que la espera simulada suele ser <i>menor</i> que Wq cuando hay saturación — a cambio de pacientes perdidos. Cuando ρ ≥ 1, Erlang C no tiene estado estable («insuficiente»), pero la simulación sí da un resultado porque los abandonos limitan la cola.</p>
            <p><b className="text-foreground">Otras diferencias:</b> Erlang C trata cada franja como estacionaria e independiente, usa servicio exponencial con la media combinada y no distingue prioridades. La simulación arrastra la cola de una franja a la siguiente, usa la distribución configurada y atiende urgencias primero.</p>
            {!sim && <p>Ejecute una simulación de este tipo de día para ver la columna comparativa.</p>}
          </div>
        </Panel>
      </Ready>
    </div>
  );
}
