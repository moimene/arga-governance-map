# Saneamiento backlog — Invalidaciones tras auditoría dirigida

Fecha: 2026-05-08
Worktree: `/Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map`, rama `main`
Cierra dos ítems del backlog: INC-06 (deuda fantasma) e INC-11 (consolidación trivial, no bug).

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
- INC-08 Plegar secciones modulares vacías `/grc/m/*`
- INC-02 Mover `docs/BORRADORES INTERMEDIOS/` fuera del repo

INCs activas P2/P3 (2):
- INC-10 Centralizar status-labels GRC
- INC-17 Documentar ruta despliegue prod
- INC-07 Decidir gap evaluaciones AIMS RLS

## Verificación

```md
- bunx tsc --noEmit --pretty false: pendiente al cerrar
- bun run lint: pendiente al cerrar
- bun test: pendiente al cerrar
- bun run build: pendiente al cerrar
- No secrets stored: yes
- No Cloud writes: yes
```
