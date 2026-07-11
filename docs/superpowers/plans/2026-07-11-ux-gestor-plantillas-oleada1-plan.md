# UX Gestor de Plantillas — Oleada 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ejecutar la Oleada 1 del informe UX del Gestor (consola de gobierno documental por riesgo): lectura ejecutiva de salud, alertas accionables, fixtures como cobertura provisional, archivadas fuera de la vista por defecto, modo solo-lectura honesto y Gate PRE en lenguaje jurídico.

**Architecture:** Shell delgado ([GestorPlantillas.tsx](src/pages/secretaria/GestorPlantillas.tsx)) + tabs en `src/components/secretaria/gestor/`. Se REUTILIZA la infraestructura existente (alertas AlertBanner con jerarquía, filtros de legal-template-review, badges de fixture, patrón schema-issue-mapper ITEM-088 para traducir códigos). Los ids `?tab=` no cambian.

**Tech Stack:** Igual (React + TS relajado, tokens Garrigues).

## Global Constraints

- Ids de tab (`?tab=dashboard|catalogo|cobertura|importar|metricas|auditoria|validacion|configuracion`) estables (redirect plantillas-tracker pinado en App.tsx y e2e/25).
- Labels de tab NO se renombran en esta oleada (pinados en e2e/14/17/21/24/25); diferido a Oleada 2 con actualización coordinada de specs.
- El H1 SÍ se renombra a "Gobierno de plantillas" (el sidebar ya se llama así: navigation.ts:99/317 — es un fix de coherencia). Actualizar e2e/12, 14, 16, 17, 21.
- Fixtures NO se excluyen (diseño intencional: cobertura puente consumida por la generación documental y la matriz de cobertura); se re-etiquetan.
- TriCapaEditor.test.tsx asierta hoy botón Guardar presente+disabled → se actualiza junto al cambio.
- RBAC intacto (tab-guards). Demo = SECRETARIO.

## Evidencia de auditoría (wf_8b63c9be-b43, 9 agentes + probes Cloud)

| Afirmación del informe | Veredicto | Matiz clave |
|---|---|---|
| Dashboard sin lectura ejecutiva ni jerarquía | PARCIAL | Alertas ERROR/WARNING ya existen y KPIs son clicables; faltan estado global, tono correcto ("Total activas" con umbral mágico ≥41) y CTAs con filtro preaplicado |
| Gap core no accionable | CONFIRMADO | Además el gap ORGANO_ADMIN·FORMULACION_CUENTAS puede ser artefacto de tipificación (existe ACTIVA con órgano CONSEJO_ADMIN y una ARCHIVADA ORGANO_ADMIN) → la acción honesta es "revisar tipificación/reactivar", no "crear nueva". Materia en clave raw |
| Fixtures compiten como "Activa" | PARCIAL | Ya tienen badge "Fixture local · no usable", sin CTA de uso, sin transiciones, y KPIs no los cuentan; el residual real es el pill de ESTADO verde idéntico a una ACTIVA real |
| Catálogo mezcla archivadas por defecto | CONFIRMADO | 110+14=124 ítems, 29% ARCHIVADA, auto-select puede abrir una ARCHIVADA/fixture; fix barato: default de filtro de estado |
| "Guardar" visible sin permisos | PARCIAL | El solo-lectura funcional existe (botones disabled, guards); el residual: botones visibles, campos readOnly sin tratamiento visual, banner poco prominente |
| Gate PRE en jerga sin consecuencia/acción | PARCIAL | Códigos crudos (SEM_NAMESPACE_SIN_PROVEEDOR…, chips "blocking/warning/info" en inglés) confirmado y masivo en datos reales (24×, 185×…); pero gate-pre-semantic ya incluye consecuencia en algunos y el patrón traductor ITEM-088 existe (solo se aplicó al wizard) |
| "Cobertura modos 120%" confusa | CONFIRMADO+ | Es un BUG: numerador sin intersectar con el universo de 5 modos (Motor v2.1 añadió CO_APROBACION/SOLIDARIO); enmascara el gap real del modo UNIVERSAL (4/5=80%) y silencia la alerta <80%. Tabla plana con estado/modo en clave raw y ARCHIVADA sin badge |

---

### Task G1: H1 "Gobierno de plantillas" + subtítulo + acciones en lenguaje jurídico

**Files:** Modify `src/pages/secretaria/GestorPlantillas.tsx`, `src/components/secretaria/gestor/DashboardTab.tsx`, e2e/12, 14, 16, 17, 21.

- H1 → "Gobierno de plantillas"; subtítulo → "Consola de gobierno legal, versión, cobertura y auditoría de plantillas protegidas."
- Acción rápida "Gate PRE global" → "Comprobación documental global" (id tab validacion intacto).
- Acciones rápidas Importar/Validación solo si `canAccess` (hoy rebotan con toast para SECRETARIO).

### Task G2: Estado global de salud documental + alertas accionables

**Files:** Modify `DashboardTab.tsx`, `AuditoriaTab.tsx`, `CoberturaLegalTab.tsx`, `src/lib/secretaria/template-admin/cloud-helpers.ts` (+ index barrel).

- Línea ejecutiva al frente: "Gobierno documental operativo[, con advertencias]: X vigentes, cobertura core N/14, M sin changelog[, K fixtures provisionales]." con pill de estado (operativa/advertencias/bloqueos).
- "Total activas": tono neutral (volumen ≠ salud; fuera el umbral mágico 41).
- Alerta "sin changelog" → navega a `?tab=auditoria&focus=sin-changelog`; AuditoriaTab gana sección "Plantillas sin changelog" con la LISTA (nuevo `listOrphanTemplates(tenantId)` en cloud-helpers, misma lógica que countOrphanTemplates devolviendo filas) y acción por fila (ver en catálogo).
- CoberturaLegalTab: fila de gap con materia humanizada, impacto y acción honesta ("Revisar tipificación del modelo existente o reactivar la versión archivada; si procede, importar plantilla").

### Task G3: Fixtures = "Cobertura provisional"

**Files:** Modify `CatalogoTab.tsx`, `CoberturaLegalTab.tsx`.

- El EstadoBadge de una fila fixture muestra "Cobertura provisional" (tono neutro con borde warning), no "Activa"; detalle mantiene el aviso existente.
- En cobertura extendida, label "Fixture local" → "Cobertura provisional (fixture local)".

### Task G4: Catálogo — vigentes por defecto

**Files:** Modify `CatalogoTab.tsx`.

- `filterEstado` default "ACTIVA" (opción "Todas" a un clic; archivadas/deprecadas opt-in). El contador ya desglosa reales/fixtures.
- Con ello el auto-select abre una ACTIVA, no una ARCHIVADA alfabética.

### Task G5: Editor tri-capa — modo solo lectura honesto

**Files:** Modify `TriCapaEditor.tsx` + `__tests__/TriCapaEditor.test.tsx`.

- Con `readOnlyReason`: banner prominente arriba "Modo solo lectura — {motivo}"; botones Guardar/Cancelar NO se renderizan; campos con tratamiento visual readOnly (superficie muted, sin ring de focus editable).
- Test de componente actualizado (Guardar ausente en readOnly; presente con permisos).

### Task G6: Gate PRE en lenguaje jurídico

**Files:** Create `src/lib/secretaria/template-admin/gate-pre-issue-labels.ts` (+ barrel + test). Modify `TriCapaEditor.tsx`, `ValidacionTab.tsx`.

- `gatePreIssueLabel(code)`: etiqueta humana ES por código (SEM_NAMESPACE_SIN_PROVEEDOR → "Variables sin origen de datos (saldrían en blanco)", CAPA2_UNUSED_VARIABLE → "Variable declarada que no se usa en el texto", DUP_ACTIVE_FUNCTIONAL_KEY → "Ya existe una plantilla activa equivalente", etc.), fallback al código.
- `gatePreSeverityLabel`: BLOCKING→"Bloqueante", WARNING→"Advertencia", INFO→"Informativa". Chips y tablas usan estos labels; el código técnico queda como detalle secundario (title/monospace pequeño).
- Primera mención "Gate PRE" acompañada de "comprobación documental previa".

### Task G7: Métricas — bug 120% + traducción

**Files:** Modify `src/lib/plantillas-metrics.ts` (+ su test), `MetricasTab.tsx`.

- Numerador de coberturaModos intersectado con ADOPTION_MODES (los 5 core); test nuevo: 6 modos reales → 100% solo si los 5 core están cubiertos; caso Cloud actual (sin UNIVERSAL) → 80% y alerta <80% dispara.
- KPI label → "Cobertura de modos (mínimo core)" con sublabel explicativo.
- Tabla: Estado vía estadoLabel, Modo vía adoptionModeBusinessLabel, badge ARCHIVADA añadido.

### Task G8: Gates + verificación viva + review adversarial

- `bun test` · `typecheck` · `lint` (tocados) · `build` · e2e 12, 14, 16, 17, 21, 22, 24, 25 · recorrido en vivo · workflow review adversarial.

## Post-review adversarial (2026-07-11, 20 agentes) — fixes aplicados

- **P1 deep-link `?plantilla=` clobber**: los efectos deep-link y auto-select corrían en el mismo flush y con cache caliente + target no-ACTIVA el auto-select pisaba la selección (el panel mostraba OTRA plantilla). Unificados en un solo efecto que cede el auto-select mientras haya deep-link sin resolver.
- **P1 focus ring en solo-lectura** (TriCapaEditor): los campos readOnly conservaban `focus:outline-none` sin ring sustituto → ring neutro `--g-border-default` siempre visible.
- **P1 copy del gap core**: "reactivar la versión archivada" era una transición imposible (ARCHIVADA es terminal en TRANSITION_MATRIX) → "revisar la tipificación de órgano del modelo activo equivalente o importar una plantilla nueva; las archivadas no se reactivan".
- **P2 useTabAccess pending perpetuo**: mi fix de la carrera (isPending) dejaba loading infinito si TenantContext termina sin tenant → gate `userLoading || tenantLoading || (rolesPending && !!user && !!tenantId)`.
- **P2 señales contradictorias en Métricas**: KPI verde a 80% con alerta disparando → success solo con 5/5; la alerta nombra los modos faltantes con labels de negocio ("junta universal"), no claves crudas.
- **P2 línea ejecutiva**: severidad real (ERROR → "con incidencias", pill AA con dot en superficie sutil, no blanco sobre warning 3.5:1) y estado "Evaluando…" mientras cargan cobertura/huérfanas (antes afirmaba "trazabilidad al día" en optimista).
- **P2 Auditoría**: fila de huérfana con deep-link `&plantilla=` + aria-label; materia humanizada (labelMateria); rama isError honesta (antes un fallo de query afirmaba "todas tienen changelog").
- **P2 varios**: banner solo-lectura `role="note"` (no live region), código técnico del issue sin opacity (contraste), 3 etiquetas de gate-pre que sobreafirmaban corregidas (META_APROBADA_POR/META_ORGANO_NULL/META_REF_LEGAL_FORMAT).
- Además: fix de flakiness real preexistente en deep-links del shell (e2e/25) por la ventana `isLoading=false` con query de roles deshabilitada; y rotura preexistente de e2e/14:147 + e2e/17:4 (ITEM-089 vs specs) verificada en HEAD limpio y señalizada como tarea aparte.

## Diferido (Oleada 2-3 del informe)

Renombrar labels de tabs (con actualización coordinada de e2e), cola de incidencias unificada como tab propio, agrupación del catálogo por tipo/materia, rediseño del editor con tablas de variables por proveedor, changelog retrospectivo por lotes, comparación de versiones, workflow de promoción, asignación de responsables, exportación de auditoría, decisión Comité Legal sobre el gap FORMULACION_CUENTAS (tipificación ORGANO_ADMIN vs CONSEJO_ADMIN en organo-canonico.ts).
