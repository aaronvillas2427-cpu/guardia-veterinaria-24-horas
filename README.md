# Guardia Veterinaria 24 h

Planificador de turnos y jaulas para un hospital veterinario 24 h (Puebla, México) con hospitalización separada para perros, gatos y exóticos. Todo corre en el navegador: no hay servidor ni cuentas.

## Cómo ejecutar

```bash
bun install
bun run dev        # app en http://localhost:8080
bunx vitest run    # pruebas
bunx vitest run src/engine --coverage --coverage.include='src/engine/**'   # cobertura del motor
```

## Estructura

- `src/engine/` — motor de cálculo en TypeScript puro (sin React): `rng.ts` (mulberry32), `erlang.ts`, `sim.ts` (simulación de eventos discretos), `cages.ts` (estancias), `events.ts` (almacén de eventos y reproducción), `sample.ts`, `csv.ts`, `validate.ts`.
- `src/workers/sim.worker.ts` — la simulación de turnos corre en un Web Worker.
- `src/lib/store.tsx` — eventos en IndexedDB (solo agregar), BroadcastChannel entre pestañas, deshacer/rehacer como eventos compensatorios.

## Datos de ejemplo

Al abrir por primera vez se generan con la semilla **72000**: 41 000 consultas, 7 000 hospitalizaciones, parámetros de turnos y jaulas, y la ocupación actual. **Todos los nombres son ficticios y llevan «(ejemplo)».** No hay datos reales de pacientes ni propietarios.

Para reemplazarlos:
- Ajuste parámetros en las pantallas (Turnos, Atención, Jaulas) — cada cambio queda en el historial.
- O importe un JSON en `/admin` con el formato `{ "format": "guardia-vet-24h", "version": 1, "exportedAt": <ms>, "events": [...], "visits": [...], "hosps": [...] }` (exporte primero para ver un ejemplo). Todo se valida; si algo no cumple, no se importa nada.
- «Restaurar datos de ejemplo» en Ajustes vuelve al estado inicial; `/admin` permite regenerar con otra semilla.

## Clave de administración

Está en `src/lib/admin.ts` (`ADMIN_KEY`, por defecto `guardia-2026`). **No es autenticación real**: cualquiera puede leerla en el código del navegador. Solo evita cambios accidentales. Cámbiela editando esa constante.

## Erlang C (espera) vs Erlang B (bloqueo)

**Consultas → Erlang C.** Los pacientes que llegan sin médico libre **esperan** en cola. Con λ (llegadas/h), μ (atenciones/h por médico) y c médicos: a = λ/μ, ρ = a/c.
- Erlang B por recurrencia estable: B(0)=1, B(k)=a·B(k−1)/(k+a·B(k−1)).
- C = B / (1 − ρ(1 − B)) — probabilidad de esperar.
- Wq = C / (cμ − λ) — espera media.
- NS(t) = 1 − C·e^(−(cμ−λ)t) — fracción atendida en ≤ t.
- Si ρ ≥ 1 no hay estado estable: se muestra «insuficiente».

Erlang C **no modela abandono** ni prioridades; por eso la simulación (urgencias primero, consultas que se van tras su paciencia, cola que pasa de una franja a otra) da esperas distintas — normalmente menores en saturación, a costa de pacientes perdidos.

**Jaulas → Erlang B.** Un paciente que necesita hospitalización y no encuentra jaula **no espera**: se refiere a otro hospital (sistema de pérdida). Con a = ingresos/día × estancia media (días), la probabilidad de bloqueo es B(c, a). La app calcula el bloqueo con las jaulas actuales, el mínimo de jaulas para el objetivo y lo valida con una simulación de estancias.

## Privacidad y alcance

Sin backend, sin cuentas y sin secretos en el frontend. Las políticas legales las agrega el cliente.
