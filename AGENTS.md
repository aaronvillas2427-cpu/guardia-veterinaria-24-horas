<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Calculation engine lives in `src/engine/` as pure TypeScript (no React, no browser APIs) so it is unit-tested with Vitest (`src/engine/engine.test.ts`).
- All app data is browser-only: an append-only event log in IndexedDB (`src/lib/idb.ts`, `src/lib/store.tsx`); state is always `replay(events)`. Undo/redo are new compensating events, never deletions.
- Cross-tab sync uses BroadcastChannel; cage conflicts are resolved deterministically in `replay` by (timestamp, id) — earliest wins.
- Everything read from storage or imported is validated with the zod schemas in `src/engine/validate.ts`.
- Shift simulations run in a Web Worker (`src/workers/sim.worker.ts`) via `src/lib/sim-runner.ts`.
- The /admin key is a plain constant in `src/lib/admin.ts` — not real auth.
