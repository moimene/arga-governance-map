# Plan — Consolidación pre-ciclo de pruebas

**Estado:** Activo. Ejecución autónoma autorizada.
**Fecha:** 2026-05-10.
**Origen:** Equipo (legal + ops) detecta gaps severos de lógica/UX que impiden
arrancar un ciclo de pruebas significativo. La batería de tests propuesta queda
en backlog hasta cerrar consolidación.

---

## Inventario consolidado de gaps críticos

### G1 — Discoverability: "Nueva sociedad" no descubrible desde Dashboard
**Severidad:** ALTA. **Esfuerzo:** XS.

- `Dashboard.tsx` "Empezar un flujo" expone solo 3 quick actions:
  Nueva convocatoria, Nueva reunión, Generar documento (+ Campañas en modo
  grupo).
- **Falta** "Nueva sociedad" y "Nuevo acuerdo sin sesión".
- El usuario debe navegar manualmente a `/secretaria/sociedades` y encontrar
  el botón "Nueva sociedad" en la cabecera de la lista.
- Mi spec funcional decía 4 acciones (incluyendo "Nuevo acuerdo") pero la
  implementación tiene solo 3 — **inconsistencia documentada vs realidad**.

**Fix:** añadir "Nueva sociedad" + "Nuevo acuerdo sin sesión" a las
quick actions del Dashboard. Conditional: "Nueva sociedad" solo en modo
grupo (no tiene sentido en scope sociedad).

### G2 — Legibility: composer/convocatorias/actas con tipografía hostil
**Severidad:** ALTA. **Esfuerzo:** S.

Auditoría de `GenerarDocumentoStepper.tsx`, `ConvocatoriasStepper.tsx`,
`ActaDetalle.tsx`:
- Headers de paso: `text-sm` (14px) — debería ser `text-base` (16px).
- Editable draft textarea: `text-sm leading-relaxed` con min-h-[420px] —
  para revisión legal de documentos extensos, **necesita 16px+ con
  leading-loose** y opcionalmente serif para mejor lectura.
- Variables Capa 2 table en step 1: `text-xs` (12px) en celdas con
  expresiones técnicas. Densidad excesiva.
- Subtítulos descriptivos: `text-xs` con `text-[var(--g-text-secondary)]` —
  cumple WCAG AA (8.2:1) pero percepción de "ilegible" por jerarquía floja.

**Fix:** patch de tipografía en 3 superficies:
1. Composer (`GenerarDocumentoStepper`): borrador editable → `text-base
   leading-loose`. Headers de paso → `text-base font-semibold`.
2. Convocatoria stepper (`ConvocatoriasStepper`): orden del día items →
   `text-base` (titulo input). Resumen final → `text-base`.
3. Acta detalle (`ActaDetalle`): contenido del acta `<pre>` → `text-base
   leading-relaxed font-sans`. Snapshot legal cards → `text-sm` (mantener)
   pero mejorar jerarquía con headers `text-base font-semibold`.

### G3 — Agenda items sin "propuesta de acuerdo"
**Severidad:** ALTA. **Esfuerzo:** M.

Análisis de `AgendaItem` en `useConvocatorias.ts:163`:
```ts
export interface AgendaItem {
  id: string;
  titulo: string;
  materia: string;
  tipo: "ORDINARIA" | "ESTATUTARIA" | "ESTRUCTURAL";
  inscribible: boolean;
}
```

**Falta:** `propuesta_acuerdo` (texto libre redactable por el secretario)
y opcionalmente `template_id` (link a `MODELO_ACUERDO` plantilla protegida).

**Impacto operativo:** sin esto, la convocatoria emitida queda con
descripción genérica del punto pero los consejeros NO reciben el texto
concreto de la propuesta antes de la sesión. En SA con cuestiones
estatutarias/estructurales, los consejeros legalmente necesitan estudiar
el texto exacto que se propondrá (art. 197.1 LSC informe previo).

**Fix:** extender `AgendaItem` con `propuesta_acuerdo: string | null` +
`template_id?: string | null` (futuro). UI: textarea expandible por punto
en paso 3 de ConvocatoriasStepper. Persistir en `convocatorias.agenda_items`
JSONB (no requiere migration porque ya es JSONB).

### G4 — 17 plantillas legales sin firma del Comité Legal
**Severidad:** MEDIA-ALTA. **Esfuerzo:** UI marker S, fix legal externo.

`plantillas_protegidas.aprobada_por IS NULL` en 17 de 37 plantillas
ACTIVAS. **El sistema permite generar documentos desde estas plantillas
sin marca visible de "pendiente de firma legal"** — riesgo de emitir
documentos no validados como evidencia operativa.

**Fix UI inmediato:** marca "Pendiente firma legal" en `Plantillas.tsx` y
`GenerarDocumentoStepper` step 1 cuando `aprobada_por IS NULL`. Bloquear o
warn (decisión semántica del Comité Legal — por defecto WARN).

**Fix legal:** acción del Comité (no de ingeniería).

### G5 — FUSION_ESCISION: 1 plantilla cubre 4 operaciones distintas
**Severidad:** ALTA. **Esfuerzo:** L (refactor plantilla + motor).

Plantilla genérica para FUSION + ESCISION + TRANSFORMACION + DISOLUCION
con cita LSC genérica en lugar de RDL 5/2023 vigente. Quórum, mayoría y
plazos legalmente DIFERENTES por operación, pero la plantilla no captura
`tipo_operacion_estructural` como input Capa 2.

**Fix:** refactor en 4 plantillas separadas O añadir `tipo_operacion_estructural`
como Capa 2 con conditional Handlebars + motor V2 evaluator que aplica
reglas correctas según tipo. **Bloqueante** porque emitir un acta de
"fusión" con redacción mixta crea riesgo legal de impugnación.

### G6 — RATIFICACION_ACTOS sin lista de actos a ratificar
**Severidad:** ALTA. **Esfuerzo:** S (Capa 3 repeatable).

La plantilla no captura `actos_a_ratificar[]` → el documento emitido
queda con "los actos del CdA realizados durante…" sin enumerar. Riesgo
de nulidad por indeterminación.

**Fix:** añadir Capa 3 field `actos_a_ratificar` (array repeatable) con
mínimo 1 elemento.

### G7 — SEGUROS_RESPONSABILIDAD: conflicto intra-grupo ARGA
**Severidad:** MEDIA. **Esfuerzo:** decisión legal.

Plantilla con conflicto intra-grupo no resuelto. Decisión Comité Legal
pendiente. **Fix técnico:** marcar como `lifecycle_status='UNDER_REVIEW'`
hasta resolución, ocultarla del catálogo activo.

### G8 — Plantillas con fuente ENTIDAD no canónica (5 afectadas)
**Severidad:** MEDIA. **Esfuerzo:** S (data fix).

AUMENTO_CAPITAL, DISTRIBUCION_DIVIDENDOS, MODIFICACION_ESTATUTOS,
NOMBRAMIENTO_AUDITOR + 1. Fuente declarada como `ENTIDAD` literal en lugar
de paths dotted (`entities.legal_name`, etc.). El normalizador H1a en
`variable-resolver.ts` lo maneja vía mapeo, pero queda como deuda — debería
ser dotted desde origen.

### G9 — Plantillas con variables Capa 2 huérfanas (2 afectadas)
**Severidad:** BAJA-MEDIA. **Esfuerzo:** XS.

DISTRIBUCION_DIVIDENDOS (`denominacion_social`) y REDUCCION_CAPITAL
(`tipo_social`) declaran variables Capa 2 que no se usan en Capa 1. Genera
ruido en el composer (campos vacíos sin propósito).

### G10 — Plantillas con duplicidad Capa 2/Capa 3 (4 afectadas)
**Severidad:** MEDIA. **Esfuerzo:** S.

CESE_CONSEJERO ×2, NOMBRAMIENTO_CONSEJERO ×2: la misma variable se
declara en Capa 2 (auto-resolver) y Capa 3 (input editable). Comportamiento
de precedencia indefinido — bug en producción si el resolver Capa 2
sobrescribe input Capa 3 del usuario.

**Fix:** decidir contractualmente que Capa 3 SIEMPRE gana cuando ambas
declaradas; documentar en `motor-plantillas`.

---

## Plan de ejecución

### BATCH 1 — Discoverability (P0, XS, ~1h)

**Objetivo:** que cualquier usuario llegue a "crear sociedad" en ≤2 clicks
desde el dashboard.

**Files:**
- `src/pages/secretaria/Dashboard.tsx` — añadir 2 quick actions en
  modo grupo: "Nueva sociedad" + "Nuevo acuerdo sin sesión".

**Done criteria:**
- Dashboard modo grupo tiene 5 quick actions (4 + Nueva sociedad)
  o 4 en modo sociedad (las 3 + Nuevo acuerdo).
- Visual responsive OK (no truncate en mobile).
- Tests existentes no se rompen.

### BATCH 2 — Legibility (P0, S, ~2h)

**Objetivo:** texto legal en zonas de lectura crítica al menos 16px.

**Files:**
- `src/pages/secretaria/GenerarDocumentoStepper.tsx` — borrador editable
  textarea + headers de paso.
- `src/pages/secretaria/ConvocatoriasStepper.tsx` — input titulo agenda
  items + resumen final.
- `src/pages/secretaria/ActaDetalle.tsx` — contenido del acta `<pre>`.

**Done criteria:**
- Borrador editable: `text-base` (16px) `leading-loose`.
- Acta contenido: `text-base leading-relaxed`.
- Headers de paso composer: `text-base font-semibold`.
- Lint + typecheck + e2e B4 pasan sin regresión.

### BATCH 3 — Agenda items con propuesta de acuerdo (P0, M, ~3h)

**Objetivo:** secretario puede redactar la propuesta concreta de acuerdo
por cada punto del orden del día durante la convocatoria.

**Files:**
- `src/hooks/useConvocatorias.ts` — extender `AgendaItem` interface.
- `src/pages/secretaria/ConvocatoriasStepper.tsx` — UI textarea expandible
  por punto en paso 3. Resumen step 7 muestra propuesta si presente.
- `src/lib/secretaria/__tests__/` — unit test del shape extendido.
- `e2e/41-secretaria-phase-b5-convocatoria-ui-driving.spec.ts` — extender
  para llenar propuesta y verificar persistencia en `agenda_items` JSONB.

**Done criteria:**
- `AgendaItem` tiene `propuesta_acuerdo: string | null`.
- UI muestra textarea condicional ("Añadir propuesta concreta").
- Persistencia en `convocatorias.agenda_items` JSONB verificada.
- e2e B5 pasa con la extensión + el campo persiste.
- Backward-compatible: convocatorias antiguas sin `propuesta_acuerdo` se leen como `null`.

### BATCH 4 — Plantillas legales (P1, mixto, post-batches 1-3)

**G4 marca pendiente firma legal:** UI marker en `Plantillas.tsx` +
`GenerarDocumentoStepper` step 1 con badge "Pendiente firma legal" cuando
`aprobada_por IS NULL`. WARN (no BLOCK) por defecto.

**G7 SEGUROS_RESPONSABILIDAD:** marcar `lifecycle_status='UNDER_REVIEW'`
en DB para excluirla del catálogo activo (hasta decisión Comité).

**G9 + G10 (huérfanas + duplicidades):** acción legal externa con plan
estructurado por plantilla (fuera de scope del primer push de
consolidación, requiere coordinación con equipo legal).

**G5 + G6 (FUSION_ESCISION + RATIFICACION_ACTOS):** Sprint dedicado —
refactor plantilla + motor + Capa 3 repeatable. Spec aparte.

---

## Verificación post-batches 1-3

```bash
bun run typecheck   # 0 errores
bun run lint        # 0 errores
bun test            # 1039+ pass / 0 fail
SECRETARIA_E2E_PHASE_B1=1 PLAYWRIGHT_PORT=5191 bunx playwright test \
  e2e/40-secretaria-phase-b4-ui-driving-synthetic.spec.ts \
  e2e/41-secretaria-phase-b5-convocatoria-ui-driving.spec.ts \
  e2e/42-secretaria-phase-b6-adoption-modes-ui-driving.spec.ts \
  e2e/43-secretaria-phase-b7-sociedad-nueva-ui-driving.spec.ts \
  --project=chromium --reporter=list
# Expected: 9/9 pass
```

## Out of scope explícito

- Tests nuevos del plan §3 (post-Phase B): congelados hasta consolidación
  cierre.
- Refactor Sprint B Motor v1 + Composer (composeDocument(), post-render
  validation, review state machine): asumido por carril paralelo, no por
  este plan.
- Multi-tenant boundary tests: post-consolidación.
- Plantillas G4/G7/G9/G10 acción legal externa: no bloquea consolidación
  técnica.

## Owner

Ingeniería Secretaría carril (este worktree). Coordinación con Comité
Legal para G4/G5/G6/G7 vía documentación + marcadores en plantillas.
