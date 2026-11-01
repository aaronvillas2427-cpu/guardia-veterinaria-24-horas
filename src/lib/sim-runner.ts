import { simulateShifts, type SimInput, type SimSummary } from "@/engine/sim";

/** Ejecuta la simulación en un Web Worker (con respaldo síncrono si no hay Workers). */
export function runSimulation(input: SimInput): Promise<SimSummary> {
  if (typeof Worker === "undefined") return Promise.resolve(simulateShifts(input));
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL("../workers/sim.worker.ts", import.meta.url), { type: "module" });
    w.onmessage = (e: MessageEvent<{ ok: boolean; result?: SimSummary; error?: string }>) => {
      w.terminate();
      if (e.data.ok && e.data.result) resolve(e.data.result);
      else reject(new Error(e.data.error ?? "Error en la simulación"));
    };
    w.onerror = (e) => {
      w.terminate();
      reject(new Error(e.message || "Error en el Worker"));
    };
    w.postMessage(input);
  });
}
