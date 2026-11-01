import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { replay, type AppEvent, type AppState } from "@/engine/events";
import { defaultParams } from "@/engine/params";
import { DEFAULT_SEED } from "@/engine/rng";
import { generateSample } from "@/engine/sample";
import { SPECIES_SINGULAR, type Hosp, type Visit } from "@/engine/types";
import { ExportSchema, parseEvents, parseHosps, parseVisits, type ExportData } from "@/engine/validate";
import * as idb from "./idb";

type Status = "loading" | "ready" | "error";
type NewEvent = { [K in AppEvent["kind"]]: { kind: K; payload: Extract<AppEvent, { kind: K }>["payload"] } }[AppEvent["kind"]];

interface StoreCtx {
  status: Status;
  error: string | null;
  idbBlocked: boolean;
  tabId: string;
  events: AppEvent[];
  state: AppState;
  visits: Visit[];
  hosps: Hosp[];
  dispatch: (e: NewEvent) => Promise<AppEvent>;
  undo: () => void;
  redo: () => void;
  resetSample: (seed?: number) => Promise<void>;
  exportData: () => ExportData;
  importData: (raw: unknown) => Promise<{ ok: boolean; message: string }>;
}

const Ctx = createContext<StoreCtx | null>(null);
const DEFAULTS = defaultParams();
const CHANNEL = "guardia-vet-24h";

export function StoreProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [idbBlocked, setIdbBlocked] = useState(false);
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [hosps, setHosps] = useState<Hosp[]>([]);
  const [tabId, setTabId] = useState("");
  const dbRef = useRef<IDBDatabase | null>(null);
  const chanRef = useRef<BroadcastChannel | null>(null);
  const lastTs = useRef(0);
  const notified = useRef<Set<string> | null>(null);

  const loadFromDb = useCallback(async () => {
    const db = dbRef.current;
    if (!db) return false;
    const pe = parseEvents(await idb.getAllEvents(db));
    const pv = parseVisits(await idb.getBlob(db, "visits"));
    const ph = parseHosps(await idb.getBlob(db, "hosps"));
    const dropped = pe.dropped + pv.dropped + ph.dropped;
    if (dropped) toast.warning(`Se descartaron ${dropped} registros inválidos del almacenamiento.`);
    if (!pe.valid.length && !pv.valid.length) return false;
    setEvents(pe.valid);
    setVisits(pv.valid);
    setHosps(ph.valid);
    return true;
  }, []);

  const writeSample = useCallback(async (seed: number) => {
    const s = generateSample(seed, Date.now());
    if (dbRef.current) await idb.replaceAll(dbRef.current, s.events, { visits: s.visits, hosps: s.hosps });
    notified.current = new Set();
    setEvents(s.events);
    setVisits(s.visits);
    setHosps(s.hosps);
  }, []);

  useEffect(() => {
    const id = crypto.randomUUID();
    setTabId(id);
    let cancelled = false;
    (async () => {
      try {
        try {
          dbRef.current = await idb.openDb();
        } catch {
          dbRef.current = null;
          setIdbBlocked(true);
        }
        const had = await loadFromDb();
        if (!had) await writeSample(DEFAULT_SEED);
        if (!cancelled) setStatus("ready");
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setStatus("error");
        }
      }
    })();
    if (typeof BroadcastChannel !== "undefined") {
      const ch = new BroadcastChannel(CHANNEL);
      chanRef.current = ch;
      ch.onmessage = (m) => {
        const data = m.data as { type: string; event?: unknown };
        if (data?.type === "event") {
          const pe = parseEvents([data.event]);
          const ne = pe.valid[0];
          if (ne) setEvents((prev) => (prev.some((x) => x.id === ne.id) ? prev : [...prev, ne]));
        } else if (data?.type === "reset") {
          notified.current = null;
          void loadFromDb();
          toast.info("Otra pestaña reemplazó los datos; se recargaron.");
        }
      };
    }
    return () => {
      cancelled = true;
      chanRef.current?.close();
    };
  }, [loadFromDb, writeSample]);

  const state = useMemo(() => replay(events, DEFAULTS), [events]);

  // Avisar cuando un ingreso de esta pestaña pierde un conflicto de jaula.
  useEffect(() => {
    if (status !== "ready") return;
    if (!notified.current) {
      notified.current = new Set(state.rejections.map((r) => r.eventId));
      return;
    }
    for (const r of state.rejections) {
      if (notified.current.has(r.eventId)) continue;
      notified.current.add(r.eventId);
      if (r.tab !== tabId) continue;
      const sug = r.suggestion == null ? "No hay otra jaula libre de esta especie." : `Siguiente jaula libre: ${SPECIES_SINGULAR[r.species]} ${r.suggestion + 1}.`;
      toast.error(`Ingreso rechazado: la jaula ${r.cage + 1} ya la ocupó otro registro anterior. ${sug}`, { duration: 10000 });
    }
  }, [state.rejections, status, tabId]);

  const dispatch = useCallback(
    async (ne: NewEvent) => {
      const ts = Math.max(Date.now(), lastTs.current + 1);
      lastTs.current = ts;
      const e = { ...ne, id: `${ts.toString(36)}-${crypto.randomUUID().slice(0, 8)}`, ts, tab: tabId } as AppEvent;
      if (dbRef.current) {
        try {
          await idb.appendEvent(dbRef.current, e);
        } catch {
          toast.error("No se pudo guardar el evento en este navegador.");
        }
      }
      setEvents((prev) => [...prev, e]);
      chanRef.current?.postMessage({ type: "event", event: e });
      return e;
    },
    [tabId],
  );

  const undo = useCallback(() => {
    const t = state.undoStack.at(-1);
    if (t) void dispatch({ kind: "undo", payload: { target: t } });
  }, [state.undoStack, dispatch]);
  const redo = useCallback(() => {
    const t = state.redoStack.at(-1);
    if (t) void dispatch({ kind: "redo", payload: { target: t } });
  }, [state.redoStack, dispatch]);

  const resetSample = useCallback(
    async (seed = DEFAULT_SEED) => {
      await writeSample(seed);
      chanRef.current?.postMessage({ type: "reset" });
    },
    [writeSample],
  );

  const exportData = useCallback(
    (): ExportData => ({ format: "guardia-vet-24h", version: 1, exportedAt: Date.now(), events, visits, hosps }),
    [events, visits, hosps],
  );

  const importData = useCallback(async (raw: unknown) => {
    const r = ExportSchema.safeParse(raw);
    if (!r.success) return { ok: false, message: `Archivo inválido: ${r.error.issues[0]?.path.join(".") || "formato"} — ${r.error.issues[0]?.message ?? ""}` };
    const d = r.data as ExportData;
    const v = (d.visits ?? []) as Visit[];
    const h = (d.hosps ?? []) as Hosp[];
    const evs = d.events as AppEvent[];
    if (dbRef.current) await idb.replaceAll(dbRef.current, evs, { visits: v, hosps: h });
    notified.current = null;
    setEvents(evs);
    setVisits(v);
    setHosps(h);
    chanRef.current?.postMessage({ type: "reset" });
    return { ok: true, message: `Importados ${evs.length} eventos, ${v.length} consultas y ${h.length} hospitalizaciones.` };
  }, []);

  const value: StoreCtx = { status, error, idbBlocked, tabId, events, state, visits, hosps, dispatch, undo, redo, resetSample, exportData, importData };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useStore fuera de StoreProvider");
  return c;
}
