import { Button } from "@/components/ui/button";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader, Panel, Ready } from "@/components/app/kit";
import { useStore } from "@/lib/store";
import { pageHead } from "@/lib/head";

export const Route = createFileRoute("/ajustes")({
  head: pageHead("Ajustes", "Estado del almacenamiento local y restauración de los datos de ejemplo."),
  component: Ajustes,
});

function Ajustes() {
  const { idbBlocked, events, visits, hosps, resetSample } = useStore();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const restore = async () => {
    setBusy(true);
    try {
      await resetSample();
      toast.success("Datos de ejemplo restaurados.");
    } catch (e) {
      toast.error(`No se pudo restaurar: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  };
  return (
    <div>
      <PageHeader title="Ajustes" />
      <Ready>
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Almacenamiento en este navegador">
            <p className="text-sm">{idbBlocked ? "IndexedDB bloqueado: los datos solo viven en esta pestaña." : "Guardado en IndexedDB de este navegador. No hay servidor ni cuentas."}</p>
            <p className="mt-2 font-mono text-sm text-muted-foreground">{events.length} eventos · {visits.length.toLocaleString("es-MX")} consultas · {hosps.length.toLocaleString("es-MX")} hospitalizaciones</p>
          </Panel>
          <Panel title="Datos de ejemplo">
            <p className="text-sm text-muted-foreground">Borra todo el historial y los registros y vuelve a generar los datos de ejemplo (semilla 72000).</p>
            {!confirm ? (
              <Button onClick={() => setConfirm(true)} className="mt-3 h-12 rounded-lg border border-destructive/50 px-4 font-semibold text-destructive">Restaurar datos de ejemplo</Button>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button disabled={busy} onClick={restore} className="h-12 rounded-lg bg-destructive px-4 font-semibold text-destructive-foreground disabled:opacity-60">{busy ? "Restaurando…" : "Sí, borrar y restaurar"}</Button>
                <Button onClick={() => setConfirm(false)} className="h-12 rounded-lg border border-border bg-card px-4">Cancelar</Button>
              </div>
            )}
          </Panel>
          <Panel title="Administración">
            <p className="text-sm text-muted-foreground">Objetivos de servicio y bloqueo, nueva semilla, importar y exportar.</p>
            <Link to="/admin" className="mt-3 inline-flex h-12 items-center rounded-lg bg-primary px-4 font-semibold text-primary-foreground">Abrir panel /admin</Link>
          </Panel>
        </div>
      </Ready>
    </div>
  );
}
