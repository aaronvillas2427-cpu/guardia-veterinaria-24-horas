import { createFileRoute } from "@tanstack/react-router";
import { useDeferredValue, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Download } from "lucide-react";
import { EmptyState, PageHeader, Ready, Segmented, Select } from "@/components/app/kit";
import { useStore } from "@/lib/store";
import { pageHead } from "@/lib/head";
import { toCSV } from "@/engine/csv";
import { SPECIES, SPECIES_LABEL, SPECIES_SINGULAR, type Hosp, type Visit } from "@/engine/types";
import { download, fmt, fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/registros")({
  head: pageHead("Registros", "Tablas de consultas y hospitalizaciones de ejemplo con filtros y exportación CSV."),
  component: Registros,
});

const dateMs = (s: string, end = false) => (s ? new Date(`${s}T${end ? "23:59:59" : "00:00:00"}`).getTime() : null);

function Registros() {
  const { visits, hosps } = useStore();
  const [tab, setTab] = useState<"v" | "h">("v");
  const [species, setSpecies] = useState("all");
  const [kind, setKind] = useState("all");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const dq = useDeferredValue(q.trim().toLowerCase());

  const f = from ? dateMs(from) : null;
  const t = to ? dateMs(to, true) : null;
  const vRows = useMemo(
    () => (tab !== "v" ? [] : visits.filter((v) => (species === "all" || v.species === species) && (kind === "all" || (kind === "abandono" ? v.abandoned : v.type === kind)) && (f == null || v.ts >= f) && (t == null || v.ts <= t) && (!dq || v.patient.toLowerCase().includes(dq)))),
    [tab, visits, species, kind, f, t, dq],
  );
  const hRows = useMemo(
    () => (tab !== "h" ? [] : hosps.filter((h) => (species === "all" || h.species === species) && (kind === "all" || (kind === "referido" ? h.referred : !h.referred)) && (f == null || h.admitTs >= f) && (t == null || h.admitTs <= t) && (!dq || h.patient.toLowerCase().includes(dq)))),
    [tab, hosps, species, kind, f, t, dq],
  );
  const count = tab === "v" ? vRows.length : hRows.length;

  const exportCsv = () => {
    const csv =
      tab === "v"
        ? toCSV(vRows, [
            { header: "id", value: (r: Visit) => r.id },
            { header: "fecha", value: (r) => new Date(r.ts).toISOString() },
            { header: "tipo", value: (r) => r.type },
            { header: "especie", value: (r) => r.species },
            { header: "paciente", value: (r) => r.patient },
            { header: "espera_min", value: (r) => r.waitMin },
            { header: "servicio_min", value: (r) => r.serviceMin },
            { header: "abandono", value: (r) => (r.abandoned ? "sí" : "no") },
          ])
        : toCSV(hRows, [
            { header: "id", value: (r: Hosp) => r.id },
            { header: "ingreso", value: (r) => new Date(r.admitTs).toISOString() },
            { header: "alta", value: (r) => (r.referred ? "" : new Date(r.dischargeTs).toISOString()) },
            { header: "especie", value: (r) => r.species },
            { header: "jaula", value: (r) => (r.referred ? "" : r.cage + 1) },
            { header: "paciente", value: (r) => r.patient },
            { header: "referido", value: (r) => (r.referred ? "sí" : "no") },
          ]);
    download(tab === "v" ? "consultas.csv" : "hospitalizaciones.csv", "\uFEFF" + csv, "text/csv;charset=utf-8");
  };

  return (
    <div>
      <PageHeader title="Registros" subtitle="Datos de ejemplo generados con semilla; todos los nombres llevan «(ejemplo)»." />
      <Ready>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <Segmented value={tab} onChange={(v) => { setTab(v); setKind("all"); }} options={[{ value: "v", label: `Consultas (${visits.length.toLocaleString("es-MX")})` }, { value: "h", label: `Hospitalizaciones (${hosps.length.toLocaleString("es-MX")})` }]} />
        </div>
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Select label="Especie" value={species} onChange={setSpecies} options={[{ value: "all", label: "Todas" }, ...SPECIES.map((s) => ({ value: s, label: SPECIES_LABEL[s] }))]} />
          <Select label={tab === "v" ? "Tipo" : "Estado"} value={kind} onChange={setKind} options={tab === "v" ? [{ value: "all", label: "Todos" }, { value: "urgencia", label: "Urgencia" }, { value: "consulta", label: "Consulta" }, { value: "abandono", label: "Abandonó" }] : [{ value: "all", label: "Todos" }, { value: "ingresado", label: "Ingresado" }, { value: "referido", label: "Referido" }]} />
          <label className="flex flex-col gap-1"><span className="text-xs font-medium text-muted-foreground">Desde</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-11 rounded-lg border border-input bg-background px-2 text-sm" /></label>
          <label className="flex flex-col gap-1"><span className="text-xs font-medium text-muted-foreground">Hasta</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-11 rounded-lg border border-input bg-background px-2 text-sm" /></label>
          <label className="col-span-2 flex flex-col gap-1 sm:col-span-1"><span className="text-xs font-medium text-muted-foreground">Paciente</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" className="h-11 rounded-lg border border-input bg-background px-3 text-sm" /></label>
        </div>
        <div className="mb-2 flex items-center justify-between">
          <span className="font-mono text-sm tabular-nums">{count.toLocaleString("es-MX")} filas</span>
          <button onClick={exportCsv} disabled={!count} className="flex h-11 items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-medium disabled:opacity-40"><Download className="h-4 w-4" /> Exportar CSV</button>
        </div>
        {count === 0 ? (
          <EmptyState title="Sin resultados">{visits.length + hosps.length === 0 ? "No hay registros. Restaure los datos de ejemplo en Ajustes." : "Ningún registro coincide con los filtros."}</EmptyState>
        ) : tab === "v" ? (
          <VList count={vRows.length} render={(i) => { const v = vRows[i]!; return (
            <div className="flex h-full items-center gap-3 border-b border-border px-3">
              <span className={cn("w-2 self-stretch my-3 rounded-full", v.type === "urgencia" ? "bg-destructive" : "bg-primary/50")} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{v.patient}</div>
                <div className="text-xs text-muted-foreground">{fmtDate(v.ts)} · {SPECIES_SINGULAR[v.species]} · {v.type === "urgencia" ? "Urgencia" : "Consulta"}</div>
              </div>
              <div className="text-right font-mono text-sm tabular-nums">{fmt(v.waitMin)} <span className="text-xs text-muted-foreground">min</span>{v.abandoned && <div className="text-[11px] font-sans font-semibold text-destructive">abandonó</div>}</div>
            </div>); }} />
        ) : (
          <VList count={hRows.length} render={(i) => { const h = hRows[i]!; return (
            <div className="flex h-full items-center gap-3 border-b border-border px-3">
              <span className={cn("w-2 self-stretch my-3 rounded-full", h.referred ? "bg-destructive" : "bg-primary/50")} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{h.patient}</div>
                <div className="text-xs text-muted-foreground">{fmtDate(h.admitTs)} · {SPECIES_SINGULAR[h.species]}</div>
              </div>
              <div className="text-right text-sm">{h.referred ? <span className="font-semibold text-destructive">Referido</span> : <><span className="font-mono">Jaula {h.cage + 1}</span><div className="font-mono text-xs text-muted-foreground">{fmt((h.dischargeTs - h.admitTs) / 86400000)} d</div></>}</div>
            </div>); }} />
        )}
      </Ready>
    </div>
  );
}

function VList({ count, render }: { count: number; render: (i: number) => React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const v = useVirtualizer({ count, getScrollElement: () => ref.current, estimateSize: () => 64, overscan: 10 });
  return (
    <div ref={ref} className="h-[65vh] overflow-auto rounded-xl border border-border bg-card shadow-panel [contain:strict]">
      <div style={{ height: v.getTotalSize(), position: "relative" }}>
        {v.getVirtualItems().map((it) => (
          <div key={it.key} style={{ position: "absolute", top: 0, left: 0, right: 0, height: 64, transform: `translateY(${it.start}px)` }}>{render(it.index)}</div>
        ))}
      </div>
    </div>
  );
}
