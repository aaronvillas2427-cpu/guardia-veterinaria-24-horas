import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Meter, PageHeader, Panel, Ready } from "@/components/app/kit";
import { useStore } from "@/lib/store";
import { pageHead } from "@/lib/head";
import { describeEvent, replay, sortEvents } from "@/engine/events";
import { defaultParams } from "@/engine/params";
import { SPECIES, SPECIES_LABEL } from "@/engine/types";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/historial")({
  head: pageHead("Historial", "Eventos inmutables con deshacer y rehacer, y reconstrucción del estado a una fecha y hora pasada."),
  component: Historial,
});

const toLocalInput = (ts: number) => {
  const d = new Date(ts - new Date(ts).getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
};

function Historial() {
  const { events, state, undo, redo } = useStore();
  const [showSample, setShowSample] = useState(false);
  const [at, setAt] = useState("");
  const list = useMemo(() => sortEvents(events).reverse().filter((e) => showSample || !("sample" in e.payload && e.payload.sample)), [events, showSample]);
  const rejected = useMemo(() => new Set(state.rejections.map((r) => r.eventId)), [state.rejections]);
  const atTs = at ? new Date(at).getTime() : null;
  const past = useMemo(() => (atTs == null || !Number.isFinite(atTs) ? null : replay(events, defaultParams(), atTs)), [events, atTs]);

  return (
    <div>
      <PageHeader title="Historial" subtitle="Los eventos nunca se borran. Deshacer y rehacer agregan eventos compensatorios." />
      <Ready>
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <Panel title="Estado al…">
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">Fecha y hora</span>
                <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} className="h-11 rounded-lg border border-input bg-background px-3 text-sm" />
              </label>
              <button onClick={() => setAt(toLocalInput(Date.now() - 86400000))} className="h-11 rounded-lg border border-border bg-card px-3 text-sm">Hace 24 h</button>
            </div>
            {!past ? (
              <p className="mt-3 text-sm text-muted-foreground">Elija un momento para reconstruir turnos, jaulas y ocupación.</p>
            ) : (
              <div className="mt-4 space-y-3">
                <p className="text-sm">
                  Médicos entre semana: <span className="font-mono">{past.params.vetsWeekday.join(" ")}</span>
                  <br />
                  Fin de semana: <span className="font-mono">{past.params.vetsWeekend.join(" ")}</span>
                  <br />
                  Multiplicador: <span className="font-mono">{past.params.weekendMult}×</span>
                </p>
                {SPECIES.map((s) => (
                  <div key={s}>
                    <Meter label={SPECIES_LABEL[s]} value={past.occupancy[s].filter(Boolean).length} max={past.params.cages[s]} />
                    <p className="mt-1 truncate text-xs text-muted-foreground">{past.occupancy[s].map((a, i) => (a ? `${i + 1}: ${a.patient}` : null)).filter(Boolean).join(" · ") || "Sin pacientes"}</p>
                  </div>
                ))}
              </div>
            )}
          </Panel>
          <Panel
            title={`Eventos (${events.length})`}
            aside={
              <div className="flex gap-2">
                <button onClick={undo} disabled={!state.undoStack.length} className="h-10 rounded-lg border border-border bg-card px-3 text-sm disabled:opacity-40">Deshacer ({state.undoStack.length})</button>
                <button onClick={redo} disabled={!state.redoStack.length} className="h-10 rounded-lg border border-border bg-card px-3 text-sm disabled:opacity-40">Rehacer ({state.redoStack.length})</button>
              </div>
            }
          >
            <label className="mb-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={showSample} onChange={(e) => setShowSample(e.target.checked)} className="h-5 w-5 accent-primary" /> Mostrar eventos de ejemplo
            </label>
            {list.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Aún no hay cambios propios. Edite turnos o ingrese un paciente.</p>
            ) : (
              <ol className="max-h-[60vh] space-y-1 overflow-auto">
                {list.slice(0, 400).map((e) => (
                  <li key={e.id} className={cn("rounded-lg border border-border px-3 py-2 text-sm", state.undone.has(e.id) && "opacity-50 line-through", rejected.has(e.id) && "border-destructive/40 bg-destructive/5")}>
                    <div>{describeEvent(e)}</div>
                    <div className="text-xs text-muted-foreground">
                      {fmtDate(e.ts)} · pestaña {e.tab.slice(0, 6)}
                      {rejected.has(e.id) && <b className="ml-1 text-destructive">· rechazado (jaula ocupada)</b>}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      </Ready>
    </div>
  );
}
