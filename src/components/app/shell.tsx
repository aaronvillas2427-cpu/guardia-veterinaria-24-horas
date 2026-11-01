import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Activity, AlertTriangle, Redo2, Undo2 } from "lucide-react";
import { useStore } from "@/lib/store";

const NAV = [
  { to: "/", label: "Inicio" },
  { to: "/turnos", label: "Turnos" },
  { to: "/atencion", label: "Atención" },
  { to: "/simulacion", label: "Simulación" },
  { to: "/erlang", label: "Erlang C" },
  { to: "/jaulas", label: "Jaulas" },
  { to: "/hospitalizacion", label: "Hospitalización" },
  { to: "/registros", label: "Registros" },
  { to: "/historial", label: "Historial" },
  { to: "/ajustes", label: "Ajustes" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { idbBlocked, state, undo, redo, status } = useStore();
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
          <Link to="/" className="flex items-center gap-2 font-display font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Activity className="h-4 w-4" />
            </span>
            <span className="leading-tight">Guardia Veterinaria <span className="text-primary">24 h</span></span>
          </Link>
          <div className="ml-auto flex gap-1">
            <button aria-label="Deshacer" disabled={status !== "ready" || !state.undoStack.length} onClick={undo} className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card disabled:opacity-40">
              <Undo2 className="h-4 w-4" />
            </button>
            <button aria-label="Rehacer" disabled={status !== "ready" || !state.redoStack.length} onClick={redo} className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card disabled:opacity-40">
              <Redo2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.to === "/" }}
              className="whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted data-[status=active]:bg-primary data-[status=active]:text-primary-foreground"
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      {idbBlocked && (
        <div role="alert" className="border-b border-warning/40 bg-warning/10">
          <div className="mx-auto flex max-w-6xl items-start gap-2 px-4 py-2 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            Este navegador bloquea el almacenamiento local (IndexedDB). Puede usar la app, pero los cambios se perderán al cerrar la pestaña. Desactive el modo privado o permita el almacenamiento del sitio.
          </div>
        </div>
      )}
      <main className="mx-auto max-w-6xl px-4 py-5 pb-16">{children}</main>
    </div>
  );
}
