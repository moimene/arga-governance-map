# Saneamiento backlog — Invalidaciones tras auditoría dirigida

Fecha: 2026-05-08
Worktree: `/Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map`, rama `main`
Cierra dos ítems del backlog: INC-06 (deuda fantasma) e INC-11 (consolidación trivial, no bug).
Añade verificación contextual posterior de INC-08 e INC-10 para evitar repetir deuda fantasma.

## Contexto

El inventario del 2026-05-06 (`docs/superpowers/plans/2026-05-06-saneamiento-integral-inventario.md`) listó 12 incoherencias derivadas de cuatro auditorías paralelas de Consola, Secretaría, GRC y AIMS. Algunas de esas incoherencias se basaban en grep ciego sin verificación contextual. Al abordar el carril ahora, la inspección revela que dos de los ítems eran falsos positivos.

Este documento los cierra explícitamente para evitar que cualquier sesión futura reabra el mismo análisis.

## INC-06 — `useTenantContext` en 7 archivos Secretaría → INVALIDADA

### Inventario original (2026-05-06)

> 7 archivos usan queries Supabase pero NO usan `useTenantContext()` (regla activa: "ya NO usar `DEMO_TENANT` hardcodeado")
>
> Archivos: `ConvocatoriasStepper.tsx`, `ConvocatoriaDetalle.tsx`, `AcuerdoSinSesionStepper.tsx`, `ExpedienteSinSesionStepper.tsx`, `DecisionUnipersonalStepper.tsx`, `TramitadorLista.tsx`, `LibroSocios.tsx`.

### Verificación 2026-05-08

Auditoría línea por línea:

```
Archivo                              supabase.* import_supabase useTenantContext hook_imports
ConvocatoriasStepper.tsx             0          0               0                8
ConvocatoriaDetalle.tsx              0          0               0                2
AcuerdoSinSesionStepper.tsx          0          0               0                6
ExpedienteSinSesionStepper.tsx       0          0               0                0
DecisionUnipersonalStepper.tsx       0          0               0                4
TramitadorLista.tsx                  0          0               0                1
LibroSocios.tsx                      0          0               0                1
```

**Ninguno hace queries Supabase directas. Ninguno importa el cliente Supabase.** Toda la lógica multi-tenant vive en los hooks que consumen (`useEntitiesList`, `useBodiesByEntity`, `useBodyMandates`, `useCreateConvocatoria`, `useEntityRules`, `usePlantillaProtegida`, `useAcuerdosSinSesion`, etc.), todos los cuales ya usan `useTenantContext()` internamente.

`ExpedienteSinSesionStepper.tsx` es un wireframe puro (solo `STEPS` hardcoded + UI), no consume datos.

### Conclusión

La regla "no usar `DEMO_TENANT` hardcodeado" se cumple **por construcción**: estos archivos no manejan tenant scoping en absoluto, lo delegan en hooks que ya están bajo el patrón. **Forzar `useTenantContext()` en una página que no consulta Supabase es ruido.**

El audit subagent del 2026-05-06 reportó "no usa useTenantContext" sin verificar si los archivos tenían razón para usarlo. Falso positivo arrastrado al inventario.

**Estado: INC-06 cerrada como INVALID.** No se aplica fix porque no hay deuda real.

## INC-11 — `RequireAuth` import duplicado en `App.tsx` → INVALIDADA + fix estilístico aplicado

### Inventario original (2026-05-06)

> `RequireAuth` aparece importado dos veces en `App.tsx` (línea 12 y 41).

### Verificación 2026-05-08

Inspección directa de `src/App.tsx`:

```ts
// línea 12
import { ProtectedShell } from "@/components/RequireAuth";
// línea 39
import { RequireAuth } from "@/components/RequireAuth";
```

Son **dos imports de exports distintos** (`ProtectedShell` y `RequireAuth`) del mismo módulo. NO es un import duplicado del mismo símbolo. Ambos componentes se usan en el archivo: `ProtectedShell` en línea 150 (envuelve la consola TGMS), `RequireAuth` en líneas 182, 240, 269 (envuelve los módulos Secretaría, GRC, AIMS).

### Fix estilístico aplicado

Aunque no hay bug, los dos imports del mismo módulo se consolidan en uno solo por convención de estilo:

```ts
// antes (líneas 12 + 39)
import { ProtectedShell } from "@/components/RequireAuth";
…
import { RequireAuth } from "@/components/RequireAuth";

// después (línea 12 única)
import { ProtectedShell, RequireAuth } from "@/components/RequireAuth";
```

**Estado: INC-11 cerrada como INVALID (no era bug) + consolidación estilística aplicada.**

## INC-08 — Módulos `/grc/m/*` con secciones placeholder → VALIDADA PARCIAL + scope refinado

### Inventario original (2026-05-06)

> `/grc/m/{dora,cyber,gdpr,audit}/*` modular shell con secciones (`SOC.tsx`, `Vulnerabilities.tsx`, etc.) mostrando placeholders.

### Verificación 2026-05-08

Inspección contextual de `src/pages/grc/modules/*/*.tsx`:

| Categoría | Archivos | Evidencia |
|---|---|---|
| Conectadas a hooks/Supabase | `dora/Incidents.tsx`, `dora/BCM.tsx`, `dora/RTO.tsx`, `cyber/Incidents.tsx`, `cyber/Vulnerabilities.tsx`, `audit/Findings.tsx`, `audit/ActionPlans.tsx` | Importan hooks o `supabase`, renderizan datos, loading/empty states. |
| Vista puente no vacía | `dora/PoliciesLink.tsx` | Enlace intencional a `/politicas`, no placeholder vacío. |
| Demo estática con contenido | `gdpr/ROPA.tsx`, `gdpr/DPIAs.tsx`, `gdpr/DSARs.tsx` | Arrays locales con filas demo y tablas renderizadas. No están Cloud-connected, pero no son pantallas vacías. |
| Placeholder enterprise real | `audit/Program.tsx`, `cyber/SOC.tsx`, `dora/Thresholds.tsx`, `gdpr/DPO.tsx` | Copy explícito: "disponible en versión enterprise" / "configuración disponible en versión enterprise". |

### Conclusión

El inventario original era demasiado amplio. **No es cierto que `/grc/m/*` esté vacío de forma generalizada.** Hay 7 pantallas operativas conectadas, 1 puente, 3 demos estáticas y 4 placeholders enterprise reales.

**Estado: INC-08 sigue activa, pero refinada a deuda parcial.**

Plan recomendado cuando se aborde:

1. Mantener rutas operativas conectadas.
2. Decidir si las 3 vistas GDPR estáticas deben seguir como demo content o plegarse hasta tener fuente Cloud.
3. Plegar u ocultar en navegación Cloud (`grc_module_nav.is_enabled=false` o equivalente de UI) solo estas 4 secciones enterprise: `audit/governance/program`, `cyber/governance/soc`, `dora/config/thresholds`, `gdpr/governance/dpo`.
4. No borrar componentes sin revisar si se usan como señal comercial de roadmap.

No se aplica fix en este carril: el objetivo era verificación contextual sin código.

## INC-10 — Centralizar status-labels / chips GRC → VALIDADA

### Inventario original (2026-05-06)

> Status values (`"Abierto"`, `"En tratamiento"`) hardcoded en `RiskEditor.tsx`, `IncidenteStepper.tsx` y `SEV_CHIP` duplicado en 3+ páginas.

### Verificación 2026-05-08

El hallazgo es real y mayor que el ejemplo original:

- `src/pages/grc/RiskEditor.tsx`: `BASE_STATUS_OPTIONS = ["Abierto", "En tratamiento"]` y defaults de `status`.
- `src/pages/grc/IncidenteStepper.tsx`: defaults `severity: "Alto"`, `status: "Abierto"` y opciones de severidad hardcoded.
- Duplicación de chips detectada en al menos 14 mapas locales:
  - `IncidenteDetalle.tsx`: `SEV_CHIP`, `NOTIF_STATUS_CHIP`
  - `IncidentesList.tsx`: `SEV_CHIP`, `STATUS_CHIP`
  - `MyWork.tsx`: `STATUS_CHIP`
  - `Excepciones.tsx`: `STATUS_CHIP`
  - `modules/dora/Incidents.tsx`: `SEV_CHIP`
  - `modules/cyber/Incidents.tsx`: `SEV_CHIP`
  - `modules/cyber/Vulnerabilities.tsx`: `SEV_CHIP`, `STATUS_CHIP`
  - `modules/audit/Findings.tsx`: `SEV_CHIP`
  - `modules/audit/ActionPlans.tsx`: `STATUS_CHIP`
  - `modules/gdpr/ROPA.tsx`, `DPIAs.tsx`, `DSARs.tsx`: `RISK_CHIP` / `STATUS_CHIP`
- `src/lib/secretaria/status-labels.ts` existe, pero es de Secretaría: no cubre GRC ni debería convertirse sin diseño en dependencia cross-module.

### Conclusión

**INC-10 es deuda real.** No es el mismo patrón falso-positivo de INC-06/11. La deuda no está limitada a `RiskEditor`/`IncidenteStepper`; afecta a la superficie GRC modular y a listas/detalles.

Plan recomendado cuando se aborde:

1. Crear una centralización GRC propia (`src/lib/grc/status-labels.ts` o equivalente), no reutilizar directamente la de Secretaría.
2. Separar funciones por dominio: `incidentStatusLabel`, `incidentSeverityChip`, `riskStatusOptions`, `exceptionStatusChip`, `notificationStatusLabel`, con fallback neutral.
3. Migrar por grupos de bajo riesgo: incidentes primero (`IncidentesList`, `IncidenteDetalle`, `modules/dora/Incidents`, `modules/cyber/Incidents`, `IncidenteStepper`), luego riesgos/excepciones, luego módulos GDPR/audit/cyber vulnerabilidades.
4. Añadir tests de contrato para labels/chips GRC antes de tocar UI.

No se aplica fix en este carril: el objetivo era verificación contextual sin código.

## Lección para inventarios futuros

Las dos invalidaciones comparten causa raíz: **grep ciego sin verificación de contexto**. Para evitar repetirlo:

- Antes de marcar "no usa X" como deuda, verificar si el archivo tiene **razón** para usar X.
- Antes de marcar "import duplicado", verificar si los símbolos son distintos.
- Auditorías delegadas a subagentes deben recibir el `archivo:línea` de la afirmación para que el revisor humano pueda contrastar.

## Backlog actualizado tras este carril

INCs RESUELTAS:
- INC-01 (AGENTS.md sanitize) ✅ commit `c5ac25d`
- INC-03/04/05 (orphan routes + `/dashboards`) ✅ commit `dd8baa5`
- INC-09 (WIP no commiteado) ✅ absorbido por carril ARGA golden path
- INC-12 (worktree legacy) ✅ commit `851cd69`
- **INC-06 (useTenantContext)** ❌→✅ INVALID, deuda fantasma documentada
- **INC-11 (RequireAuth import)** ❌→✅ INVALID + consolidación estilística aplicada
- INC-14 (Gestor de Reglas Acuerdo360) ✅ commits `83a3f6f` … `6c2747e`

INCs activas P0 (1):
- INC-13 Promoción Vercel preview → producción (requiere decisión externa)

INCs activas P1 (4):
- INC-15 Saneamiento sociedad por sociedad
- INC-16 Schema versionado de estatutos/reglamentos
- INC-08 Plegar secciones modulares vacías `/grc/m/*` — **validada parcial, scope refinado a 4 placeholders enterprise + decisión sobre 3 vistas GDPR estáticas**
- INC-02 Mover `docs/BORRADORES INTERMEDIOS/` fuera del repo

INCs activas P2/P3 (3):
- INC-10 Centralizar status-labels GRC — **validada como deuda real**
- INC-17 Documentar ruta despliegue prod
- INC-07 Decidir gap evaluaciones AIMS RLS

## Verificación

```md
- 2026-05-08 INC-06/11: verificación documental previa; cierre en commit 7a60c55.
- 2026-05-08 INC-08/10: verificación contextual por lectura/grep de `src/pages/grc/modules/*`, `src/pages/grc/RiskEditor.tsx`, `src/pages/grc/IncidenteStepper.tsx`, `src/pages/grc/**` chips y `src/lib/secretaria/status-labels.ts`.
- No source code changed in INC-08/10 verification: yes
- `bun run typecheck`: pass
- `bun run lint`: pass
- `bun run build`: pass, con warnings esperados de Browserslist/chunk size
- `bun test`: 898 pass / 66 skip / 0 fail
- No secrets stored: yes
- No Cloud writes: yes
```
