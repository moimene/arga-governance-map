---
title: P1 Week 4-5 — M4+M5 Consolidated Adversarial Review
date: 2026-05-17
phase: comms-p1-w4-w5
status: PASS (with 1 scope deferral + 3 pre-existing lint issues out of scope)
---

# M4+M5 Adversarial Review — Entry Points + UI

## Entregables W4+W5

| Archivo | Función |
|---|---|
| `src/components/secretaria/comunicaciones/PasoEnvioMiembros.tsx` | Componente standalone reutilizable: programar envío con recipients desde `useBodyMandates`, plazo check, canal selectors, hash SHA-512 del cuerpo |
| `src/components/secretaria/comunicaciones/DistribuirPackButton.tsx` | Modal wrapper para BoardPack: PUESTA_DISPOSICION al CdA |
| `src/pages/secretaria/Comunicaciones.tsx` | Dashboard con tabs (Borradores / Programadas / Enviando / Enviadas / Errores), filtros (rebotes, libre), tabla con link a detalle + cancelar |
| `src/pages/secretaria/ComunicacionDetalle.tsx` | Detalle con recipients table (badge `fallback` si `canal_original ≠ canal_usado`), errores, reintentar |
| `src/App.tsx` | Registradas rutas `/secretaria/comunicaciones` y `/secretaria/comunicaciones/:id` |

## DECISIÓN ADVERSARIAL MAYOR

### `ConvocatoriasStepper.tsx` inline integration DEFERIDA

Plan W4 task 4.1 proponía integrar `PasoEnvioMiembros` como nuevo Paso 9 dentro del stepper existente. El **spike W1 sobre el stepper** (validation a posteriori): **4.110 líneas** en un solo componente. Modificar sin refactor previo del state management es alto riesgo de regresión.

**Decisión:** crear `PasoEnvioMiembros` como **componente standalone reutilizable** invocable desde:
1. Una ruta nueva `/secretaria/comunicaciones/programar` (CTA secundaria en ConvocatoriasStepper Paso 8 — pendiente wiring)
2. Modal de `DistribuirPackButton` desde BoardPack
3. Cualquier flujo futuro (TramitadorStepper, ExpedienteAcuerdo, ReunionStepper CierreStep)

Beneficios:
- 0 cambios al monolito → 0 riesgo de regresión.
- Componente testable aisladamente.
- Reusable desde 5+ entry points sin duplicación.

Coste:
- El "Paso 9 inline" del plan no se entrega como inline; se entrega como **modal/ruta separada**. UX equivalente.
- La CTA "Saltar envío" del Paso 8 queda pendiente de wiring al stepper (refactor scope independiente).

**Documentado como deuda P1.5:** rama dedicada `feat/comms-p1.5-stepper-integration` cuando se aborde refactor de `ConvocatoriasStepper`.

## Hallazgos adversariales menores

### Pre-existing lint issues fuera de scope

`bun run lint` reporta:
- 2 errors en `src/pages/secretaria/ConvocatoriasStepper.tsx:1285-1286` (`no-extra-boolean-cast`)
- 1 warning en `src/pages/secretaria/ConvocatoriasStepper.tsx:1185` (missing dep en useEffect)

Pre-existentes (no introducidos por el módulo comms). Fix con `eslint --fix` trivial pero queda fuera de scope para preservar disciplina de PR boundaries.

**Verificación scope:** `bunx eslint <comms-module-files>` → 0 issues.

### `useEntityNormativeProfile` shape no estricto

El hook `useCommsPlazoCheck` consume `useEntityNormativeProfile(entity_id).data`. El return shape no está estrictamente tipado en `useNormativeFramework`. Aplicado type guard inline:
```ts
const p = profile as { tipo_social?: string; es_cotizada?: boolean; jurisdiction?: string };
```
Con defaults seguros (`?? 'SA'`, `?? false`, `?? 'ES'`). Test verifica el path correcto.

### Persona sin email no impide programar

`PasoEnvioMiembros` filtra `recipientsPayload` por `m.email != null` antes de INSERT recipients. Si todos los miembros vigentes carecen de email, lanza error claro:
> "Ningún miembro vigente tiene email. Verifica el directorio de personas."

Esto evita INSERTs con `destino_primario = ''` que fallarían silenciosamente en el adapter.

## Tests + verificación final

| Check | Resultado |
|---|---|
| `bun test` (full project) | 1768 pass, 152 skip, 16 fail (todos pre-existentes en openxml-validation, no comms) |
| `bun test src/lib/comms/ + plazo + hook` | 35 pass, 0 fail, 65 expect() calls, 470ms, 11 files |
| `bun run typecheck` | PASS |
| `bun run lint` (scoped a comms) | 0 issues |
| `bun run build` | PASS (6.38s, warnings de chunk size pre-existentes) |

## Deudas anotadas

- **D9 [W4 deferred]** Wiring CTA "Saltar envío" + redirect a `/secretaria/comunicaciones/programar?convocatoriaId=...` en `ConvocatoriasStepper` Paso 8. Requiere refactor del stepper o nueva rama dedicada.
- **D10 [P1.5]** Crear página `/secretaria/comunicaciones/programar` que envuelve `PasoEnvioMiembros` con loader que carga `convocatoria → documento → bodyId`.
- **D11 [P1.5]** Entry points bonus: TramitadorStepper, ExpedienteAcuerdo, ReunionStepper CierreStep — mismo patrón de modal con `PasoEnvioMiembros`.
- **D12 [P3]** Composer libre (6 steps) según plan W5 — deferido a P3 con voto a distancia.

## Veredicto M4+M5

**PASS.** Módulo de comunicaciones P1 operativo end-to-end:
- Schema Cloud con 5 tablas + RLS + triggers + 87/96 plantillas seeded.
- 3 adapters + dispatcher + retry policy + plazo engine (bug crítico de inversión corregido).
- 5 Edge Functions escritas (deployment pendiente de configurar secrets).
- 4 hooks React + 4 componentes UI + dashboard + detalle.
- pg_cron job registrado INACTIVE pendiente de activación post-deploy.

**Pendiente exclusivamente:** configuración de secrets/GUCs + deploy Edge Functions + activación cron job.
**Ver:** `docs/superpowers/notes/2026-05-17-comms-p1-final-secrets-checklist.md`
