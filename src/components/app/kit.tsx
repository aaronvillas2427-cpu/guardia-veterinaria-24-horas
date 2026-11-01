import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Panel({ title, children, className, aside }: { title?: string; children: ReactNode; className?: string; aside?: ReactNode }) {
  return (
    <section className={cn("rounded-xl border border-border bg-card p-4 shadow-panel", className)}>
      {title && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

export function Metric({ label, value, unit, hint, tone }: { label: string; value: string; unit?: string | undefined; hint?: string | undefined; tone?: "ok" | "warn" | "bad" | undefined }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-panel">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className={cn("mt-1 font-mono text-2xl font-semibold tabular-nums", tone === "bad" ? "text-destructive" : tone === "warn" ? "text-warning" : "text-foreground")}>
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>}
      </div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

/** Barras de 24 franjas. */
export function SlotBars({ values, highlight, format = (v) => String(v), height = 72, compare }: { values: number[]; highlight?: number; format?: (v: number) => string; height?: number; compare?: number[] }) {
  const max = Math.max(1e-9, ...values, ...(compare ?? []));
  return (
    <div>
      <div className="flex items-end gap-[2px]" style={{ height }}>
        {values.map((v, h) => (
          <div key={h} className="relative flex h-full flex-1 items-end" title={`${String(h).padStart(2, "0")}:00 — ${format(v)}`}>
            <div className={cn("w-full rounded-t-sm", h === highlight ? "bg-primary" : "bg-primary/35")} style={{ height: `${(v / max) * 100}%` }} />
            {compare && <div className="absolute inset-x-0 border-t-2 border-foreground/60" style={{ bottom: `${(compare[h]! / max) * 100}%` }} />}
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
        <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
      </div>
    </div>
  );
}

export function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  const r = max ? value / max : 0;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="font-mono tabular-nums">
          {value}/{max} <span className="text-muted-foreground">jaulas</span>
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", r >= 0.9 ? "bg-destructive" : r >= 0.75 ? "bg-warning" : "bg-primary")} style={{ width: `${Math.min(100, r * 100)}%` }} />
      </div>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-card px-4 py-10 text-center">
      <Inbox className="mb-2 h-8 w-8 text-muted-foreground" />
      <p className="font-medium">{title}</p>
      {children && <div className="mt-1 text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
      <div>
        <p className="font-medium text-destructive">No se pudieron cargar los datos</p>
        <p className="mt-1 text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

/** Renderiza hijos solo cuando el almacén del navegador está listo. */
export function Ready({ children }: { children: ReactNode }) {
  const { status, error } = useStore();
  if (status === "loading")
    return (
      <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Preparando datos del hospital…
      </div>
    );
  if (status === "error") return <ErrorState message={error ?? "Error desconocido"} />;
  return <>{children}</>;
}

/** Campo numérico que confirma al salir o con Enter (un evento por cambio). */
export function NumField({ value, onCommit, step = 1, min = 0, max, label, suffix, className }: { value: number; onCommit: (v: number) => void; step?: number; min?: number; max?: number; label?: string; suffix?: string; className?: string }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = () => {
    const v = Number(text.replace(",", "."));
    if (!Number.isFinite(v) || v < min || (max != null && v > max)) {
      setText(String(value));
      return;
    }
    if (v !== value) onCommit(v);
  };
  return (
    <label className={cn("flex flex-col gap-1", className)}>
      {label && <span className="text-xs font-medium text-muted-foreground">{label}</span>}
      <span className="relative flex items-center">
        <input
          inputMode="decimal"
          aria-label={label}
          className="h-11 w-full rounded-lg border border-input bg-background px-3 font-mono tabular-nums outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
          value={text}
          step={step}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
        />
        {suffix && <span className="pointer-events-none absolute right-3 text-xs text-muted-foreground">{suffix}</span>}
      </span>
    </label>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="inline-flex rounded-lg border border-border bg-muted p-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn("min-h-10 rounded-md px-3 text-sm font-medium transition-colors", value === o.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Select({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; label: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="h-11 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary">
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}
