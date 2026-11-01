import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Activity, AlertTriangle, Redo2, Undo2, LayoutDashboard, CalendarDays, Stethoscope, FlaskConical, ChartNoAxesCombined, PawPrint, BedDouble, Files, History, Settings2, Shield, Search, Sun, Moon, Ellipsis, ArrowUpRight } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Sheet, SheetTrigger, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useTheme } from "./theme";
const NAV = [
  { to: "/", label: "Inicio", icon: LayoutDashboard, group: "Operación" },
  { to: "/turnos", label: "Turnos", icon: CalendarDays, group: "Operación" },
  { to: "/atencion", label: "Atención", icon: Stethoscope, group: "Operación" },
  { to: "/jaulas", label: "Jaulas", icon: PawPrint, group: "Operación" },
  { to: "/hospitalizacion", label: "Hospitalización", icon: BedDouble, group: "Operación" },
  { to: "/simulacion", label: "Simulación", icon: FlaskConical, group: "Análisis" },
  { to: "/erlang", label: "Erlang C", icon: ChartNoAxesCombined, group: "Análisis" },
  { to: "/registros", label: "Registros", icon: Files, group: "Datos" },
  { to: "/historial", label: "Historial", icon: History, group: "Datos" },
  { to: "/ajustes", label: "Ajustes", icon: Settings2, group: "Ajustes" },
  { to: "/admin", label: "Administración", icon: Shield, group: "Ajustes" },
] as const;
const GROUPS = ["Operación", "Análisis", "Datos", "Ajustes"];
export function AppShell({ children }: { children: ReactNode }) {
  const { idbBlocked, state, undo, redo, status } = useStore();
  const { dark, toggle } = useTheme();
  const path = useRouterState({ select: s => s.location.pathname });
  const navigate = useNavigate();
  const [command, setCommand] = useState(false);
  const [more, setMore] = useState(false);
  const searchRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { const key = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCommand(v => !v); } }; document.addEventListener("keydown", key); return () => document.removeEventListener("keydown", key); }, []);
  const links = (mobile = false) => GROUPS.map(group => <div key={group} className="mb-5"><p className="mb-2 px-3 text-[11px] font-semibold uppercase text-muted-foreground">{group}</p>{NAV.filter(n => n.group === group).map(n => <Link key={n.to} to={n.to} aria-current={path === n.to ? "page" : undefined} onClick={() => mobile && setMore(false)} className={`mb-1 flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${path === n.to ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}><n.icon className="h-[18px] w-[18px]" />{n.label}{path === n.to && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}</Link>)}</div>);
  return <div className="min-h-dvh bg-background">
    <a href="#contenido" className="fixed left-4 top-4 z-[100] -translate-y-32 rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground focus:translate-y-0">Saltar al contenido</a>
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-border/40 bg-sidebar lg:flex">
      <Link to="/" className="flex min-h-24 items-center gap-3 px-6"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Activity className="h-6 w-6" /></span><span className="text-sm font-semibold leading-snug">Guardia Veterinaria<br /><span className="font-mono text-xs text-primary">24 h · Puebla</span></span></Link>
      <nav aria-label="Navegación principal" className="flex-1 overflow-y-auto px-4 py-3">{links()}</nav>
      <div className="border-t border-border/40 px-6 py-5 text-xs text-muted-foreground"><span className="mb-1 flex items-center gap-2 font-medium"><Shield className="h-4 w-4" /> Guardado en este navegador</span>Datos de ejemplo · México</div>
    </aside>
    <div className="lg:pl-60">
      <header className="sticky top-0 z-30 border-b border-border/40 bg-card">
        <div className="mx-auto flex min-h-16 max-w-[1440px] items-center gap-2 px-4 lg:px-8">
          <Link to="/" className="mr-auto flex items-center gap-2 text-sm font-semibold lg:hidden"><Activity className="h-5 w-5 text-primary" /><span>Guardia <span className="text-primary">24 h</span></span></Link>
          <div className="mr-auto hidden items-center gap-2 text-sm text-muted-foreground lg:flex">Centro de mando <ArrowUpRight className="h-3 w-3" /><span className="font-medium text-foreground">{NAV.find(n => n.to === path)?.label ?? "Guardia"}</span></div>
          <Dialog open={command} onOpenChange={setCommand}><DialogTrigger asChild><Button ref={searchRef} variant="ghost" size="icon" aria-label="Buscar una pantalla" title="Buscar una pantalla (Ctrl/Cmd + K)"><Search /></Button></DialogTrigger><DialogContent onCloseAutoFocus={e => { e.preventDefault(); searchRef.current?.focus(); }}><DialogTitle>Ir a una pantalla</DialogTitle><DialogDescription className="sr-only">Buscar y seleccionar una sección de Guardia Veterinaria.</DialogDescription><Command><CommandInput aria-label="Buscar pantalla" placeholder="Buscar pantalla…" /><CommandList><CommandEmpty>No se encontraron pantallas.</CommandEmpty>{GROUPS.map(g => <CommandGroup key={g} heading={g}>{NAV.filter(n => n.group === g).map(n => <CommandItem key={n.to} value={n.label} className="min-h-11" onSelect={() => { setCommand(false); void navigate({ to: n.to }); }}><n.icon />{n.label}</CommandItem>)}</CommandGroup>)}</CommandList></Command></DialogContent></Dialog>
          <Button variant="ghost" size="icon" onClick={toggle} aria-label={dark ? "Activar tema claro" : "Activar tema oscuro"} title={dark ? "Tema claro" : "Tema oscuro"}>{dark ? <Sun /> : <Moon />}</Button>
          <span className="mx-1 hidden h-6 border-l border-border/40 sm:block" />
          <Button variant="ghost" size="icon" aria-label="Deshacer" title="Deshacer" disabled={status !== "ready" || !state.undoStack.length} onClick={undo}><Undo2 /></Button>
          <Button variant="ghost" size="icon" aria-label="Rehacer" title="Rehacer" disabled={status !== "ready" || !state.redoStack.length} onClick={redo}><Redo2 /></Button>
        </div>
      </header>
      {idbBlocked && <div role="alert" className="flex items-start gap-3 border-b border-warning bg-card p-4 text-sm"><AlertTriangle className="h-5 w-5 text-warning" />Este navegador bloquea IndexedDB. Los cambios se perderán al cerrar la pestaña. Permita el almacenamiento del sitio.</div>}
      <main id="contenido" tabIndex={-1} className="mx-auto max-w-[1440px] px-4 py-6 pb-28 focus:outline-none lg:px-8 lg:py-8 lg:pb-12">{children}</main>
      <nav aria-label="Navegación móvil" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border/40 bg-card pb-[env(safe-area-inset-bottom)] lg:hidden">
        {NAV.filter(n => ["/", "/turnos", "/jaulas", "/simulacion"].includes(n.to)).map(n => <Link to={n.to} key={n.to} aria-current={path === n.to ? "page" : undefined} className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[10px] font-medium ${path === n.to ? "text-primary bg-accent" : "text-muted-foreground"}`}><n.icon className="h-5 w-5" />{n.label}</Link>)}
        <Sheet open={more} onOpenChange={setMore}><SheetTrigger asChild><Button variant="ghost" className="h-16 flex-col gap-1 rounded-none text-[10px]"><Ellipsis className="h-5 w-5" />Más</Button></SheetTrigger><SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl"><SheetTitle>Más secciones</SheetTitle><SheetDescription className="mb-5">Guardia Veterinaria 24 h</SheetDescription><nav aria-label="Todas las secciones">{links(true)}</nav></SheetContent></Sheet>
      </nav>
    </div>
  </div>;
}
