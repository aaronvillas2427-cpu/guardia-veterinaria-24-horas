import { simulateShifts, type SimInput } from "../engine/sim";

self.onmessage = (e: MessageEvent<SimInput>) => {
  try {
    self.postMessage({ ok: true, result: simulateShifts(e.data) });
  } catch (err) {
    self.postMessage({ ok: false, error: String(err) });
  }
};
