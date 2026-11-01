import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { NumField, PageHeader, Panel, Ready } from "@/components/app/kit";
import { useStore } from "@/lib/store";
import { pageHead } from "@/lib/head";
import { ADMIN_KEY } from "@/lib/admin";
import { download, fmt } from "@/lib/format";
import type { Params } from "@/engine/types";

export const Route = createFileRoute("/admin")({
  head: pageHead("Administración", "Objetivos de nivel de servicio y bloqueo, semilla de datos e importación/exportación JSON."),
  component: Admin,
});

function Admin() {
  const [ok, setOk] = useState(false);
  const [key, setKey] = useState("");
  const [bad, setBad] = useState(false);
  if (!ok)
    return (
      <div className="mx-auto max-w-sm">
        <PageHeader title="Administración" />
        <Panel>
          <p className="mb-3 rounded-lg bg-warning/10 p-3 text-sm">Esta clave está escrita en el código de la app: <b>no es seguridad real</b>, solo evita cambios accidentales.</p>
          <form onSubmit={(e) => { e.preventDefault(); if (key === ADMIN_KEY) setOk(true); else setBad(true); }} className="space-y-3">
            <input type="password" aria-label="Clave" value={key} onChange={(e) => { setKey(e.target.value); setBad(false); }} placeholder="Clave de administración" className="h-12 w-full rounded-lg border border-input bg-background px-3" />
            {bad && <p className="text-sm text-destructive">Clave incorrecta.</p>}
            <button className="h-12 w-full rounded-lg bg-primary font-semibold text-primary-foreground">Entrar</button>
          </form>
        </Panel>
      </div>
    );
  return <AdminPanel />;
}

function AdminPanel() {
  const { state, dispatch, resetSample, exportData, importData } = useStore();
  const p = state.params;
  const [seed, setSeed] = useState(String(p.seed));
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<Params>, label: string) => void dispatch({ kind: "params/set", payload: { patch, label } });

  const regenerate = async () => {
    const n = Number(seed);
    if (!Number.isInteger(n) || n < 0 || n > 4294967295) return toast.error("La semilla debe ser un entero entre 0 y 4 294 967 295.");
    setBusy(true);
    await resetSample(n);
    setBusy(false);
    toast.success(`Datos regenerados con semilla ${n}.`);
  };
  const onImport = async (f: File) => {
    try {
      const raw = JSON.parse(await f.text());
      const r = await importData(raw);
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
    } catch {
      toast.error("El archivo no es JSON válido.");
    }
  };

  return (
    <div>
      <PageHeader title="Administración" subtitle="Clave simple en el código; no es autenticación real." />
      <Ready>
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Objetivos">
            <div className="grid grid-cols-3 gap-3">
              <NumField label="Nivel de servicio" suffix="%" max={100} value={Math.round(p.targetServiceLevel * 1000) / 10} onCommit={(v) => set({ targetServiceLevel: v / 100 }, `Objetivo NS: ${fmt(p.targetServiceLevel * 100)} % → ${fmt(v)} %`)} />
              <NumField label="En ≤" suffix="min" max={600} value={p.targetMinutes} onCommit={(v) => set({ targetMinutes: v }, `Umbral NS: ${p.targetMinutes} → ${v} min`)} />
              <NumField label="Bloqueo máx." suffix="%" max={100} step={0.5} value={Math.round(p.targetBlocking * 1000) / 10} onCommit={(v) => set({ targetBlocking: v / 100 }, `Objetivo bloqueo: ${fmt(p.targetBlocking * 100)} % → ${fmt(v)} %`)} />
            </div>
          </Panel>
          <Panel title="Regenerar datos de ejemplo">
            <div className="flex items-end gap-2">
              <label className="flex flex-1 flex-col gap-1"><span className="text-xs font-medium text-muted-foreground">Semilla</span><input inputMode="numeric" value={seed} onChange={(e) => setSeed(e.target.value)} className="h-11 rounded-lg border border-input bg-background px-3 font-mono" /></label>
              <button disabled={busy} onClick={regenerate} className="h-11 rounded-lg bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-60">{busy ? "Generando…" : "Regenerar"}</button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Reemplaza historial y registros por 48 000 filas nuevas.</p>
          </Panel>
          <Panel title="Importar / exportar JSON">
            <div className="flex flex-wrap gap-2">
              <button onClick={() => download(`guardia-vet-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(exportData()), "application/json")} className="h-11 rounded-lg border border-border bg-card px-4 font-medium">Exportar todo</button>
              <button onClick={() => file.current?.click()} className="h-11 rounded-lg border border-border bg-card px-4 font-medium">Importar…</button>
              <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onImport(f); e.target.value = ""; }} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Al importar se valida cada evento y registro; si algo no cumple el formato, no se cambia nada.</p>
          </Panel>
        </div>
      </Ready>
    </div>
  );
}
