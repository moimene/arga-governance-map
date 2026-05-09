# INC-10 — Centralización status-labels/chips GRC

Fecha: 2026-05-09
Worktree: `/Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map`, rama `main`
Plan original: `docs/superpowers/plans/2026-05-08-saneamiento-backlog-invalidations.md` (sección INC-10)

## Objetivo

Reemplazar 11 mapas locales de chips/labels duplicados en `src/pages/grc/` y `src/pages/grc/modules/`
por un módulo centralizado `src/lib/grc/status-labels.ts` con helpers tipados y fallback NEUTRAL
automático.

## Inventario migrado

14 archivos con 16 instancias de mapas locales (1–2 por archivo):

| Dominio | Map exportado | Helper | Archivos migrados |
|---|---|---|---:|
| Severity (incidentes/findings/vulns) | `SEVERITY_CHIP` | `severityChip()` | 6 |
| Incident lifecycle | `INCIDENT_STATUS_CHIP` | `incidentStatusChip()` | 2 |
| Notification (DORA/GDPR) chip + label | `NOTIFICATION_STATUS_CHIP/LABEL` | `notificationStatusChip()` / `notificationStatusLabel()` | 1 |
| Exception lifecycle | `EXCEPTION_STATUS_CHIP` | `exceptionStatusChip()` | 1 |
| Vulnerability lifecycle | `VULNERABILITY_STATUS_CHIP` | `vulnerabilityStatusChip()` | 1 |
| Action plan lifecycle | `ACTION_PLAN_STATUS_CHIP` | `actionPlanStatusChip()` | 1 |
| DSAR lifecycle (GDPR) | `DSAR_STATUS_CHIP` | `dsarStatusChip()` | 1 |
| DPIA lifecycle (GDPR) | `DPIA_STATUS_CHIP` | `dpiaStatusChip()` | 1 |
| Risk level (ROPA + DPIAs) | `RISK_LEVEL_CHIP` | `riskLevelChip()` | 2 |

Adicional (no chips, mismo carril por coupling):
- `SEVERITY_OPTIONS` (anti-drift dropdown ↔ chip): migra `IncidenteStepper` (4 `<option>` literales) e `IncidentesList` (severity filter array).
- `RISK_STATUS_OPTIONS`: migra `BASE_STATUS_OPTIONS` hardcodeado en `RiskEditor`.

## Decisiones de diseño no obvias

### 1. Fallback NEUTRAL automático en helpers

El plan original especificó "fallback neutral". 8 de los 14 callers usaban `?? ""` (string vacío)
en lugar de un className NEUTRAL explícito, lo que producía un chip invisible cuando el valor no
estaba en el map (un `<span>` con clases base de chip pero sin color de fondo o borde).

**Cambio de comportamiento intencional:** los helpers (`severityChip(value)`, etc.) devuelven
NEUTRAL automáticamente para valores ausentes/desconocidos. Eso convierte chips invisibles en
chips muted+border legibles, alineado con el plan ("fallback neutral") y mejor UX.

Los maps siguen exportados sin fallback para callers que necesiten preservar el comportamiento
previo de chip invisible — pero ningún caller migrado lo necesitaba.

### 2. Severity vs risk-level: escalas distintas

Aunque visualmente solapan en 3 niveles (Alto/Medio/Bajo), severity tiene "Crítico" y risk-level
no. Mantenerlos separados (`SEVERITY_CHIP` vs `RISK_LEVEL_CHIP`) evita que un caller use el chip
equivocado. El test de contrato verifica explícitamente que `RISK_LEVEL_CHIP` no tiene la clave
"Crítico".

### 3. `SEVERITY_OPTIONS` como anti-drift

`IncidenteStepper` tenía 4 `<option value="...">` hardcodeados con los valores de severity. Si
mañana se añade "Catastrófico" a `SEVERITY_CHIP` pero no al dropdown, la UI no sabe ofrecer la
opción nueva. Centralizar el array `SEVERITY_OPTIONS = ["Crítico", "Alto", "Medio", "Bajo"]`
(en orden canónico de gravedad) cierra ese drift.

El test de contrato lo valida con `[...SEVERITY_OPTIONS].sort() === Object.keys(SEVERITY_CHIP).sort()`.

No se hizo lo mismo con `INCIDENT_STATUS_OPTIONS`: el filter array
`["Abierto", "En contención", "En investigación", "Resuelto", "Cerrado"]` solo aparece en
`IncidentesList`. Sin duplicación, no hay drift potencial. Centralizarlo expandiría scope sin
beneficio claro.

### 4. Gotcha TypeScript: `readonly tuple.includes(string)`

`RISK_STATUS_OPTIONS` se declara `as const` para preservar tipos literales (`readonly ["Abierto", "En tratamiento"]`).
En `RiskEditor` la lógica original era:

```ts
const statusOptions = BASE_STATUS_OPTIONS.includes(form.status) ? ... : [...BASE_STATUS_OPTIONS, form.status];
```

`form.status: string` no es asignable a `"Abierto" | "En tratamiento"` (el parámetro de `.includes()`
sobre un readonly tuple). Solución aplicada: tipar explícitamente la copia local como `string[]`:

```ts
const baseStatusOptions: string[] = [...RISK_STATUS_OPTIONS];
```

Esto preserva la inmutabilidad del export y permite el `.includes(form.status)` en el caller.

## Scope excluido (no es deuda real)

- **`READINESS_CHIP` y `ACCESS_CHIP` en `src/pages/grc/Dashboard.tsx`:** dominios distintos
  (lifecycle de readiness P0, niveles de acceso). No son chips de status/severity/risk. Cada uno
  aparece una sola vez. No hay duplicación que centralizar.

- **`INCIDENT_TYPE_LABEL` en `IncidentesList`:** mapping a labels humanizados de
  DORA/CYBER/GDPR/AUDIT/PENAL. Es un map de display de un código a su nombre largo en español,
  no un chip de estado. Aparece una sola vez, sin drift potencial.

## Verificación standalone

Antes de commitear, las gates se re-corrieron contra working tree con SOLO los cambios de INC-10
staged (las modificaciones cross-worktree de Codex en `src/components/secretaria/shell/`,
`src/pages/secretaria/`, `src/hooks/useEntities.ts`, etc. fueron stasheadas separadamente):

```
bun run db:check-target: pass
bun run typecheck:       pass
bun run lint:            pass
bun run build:           pass (5.04s)
bun test:                962 pass / 66 skip / 0 fail (+35 nuevos vs baseline 927)
```

Resultados idénticos a la corrida combinada con los cambios externos, lo que confirma que
INC-10 no depende del trabajo paralelo de Codex.

## Deuda residual

- **No se migra `INCIDENT_STATUS_OPTIONS` ni `INCIDENT_TYPE_LABEL`:** documentado arriba como
  scope excluido por no haber duplicación.
- **Cambio de display chip-invisible → chip-NEUTRAL:** intencional y alineado con plan, pero
  podría revelar valores de status no reconocidos que antes pasaban silenciosos. Si una sesión
  futura ve chips NEUTRAL inesperados en producción, eso es un dato útil (datos sucios) no un bug
  de migración.
- **Posible carril futuro:** centralización extendida si aparecen nuevos dominios GRC (P0
  readiness, access level) que justifiquen sus propios maps en `status-labels.ts`. Hoy
  prematuro.
