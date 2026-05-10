# Consolidación pre-test cycle — Ronda 2

**Fecha:** 2026-05-10.
**Origen:** Equipo (legal + ops) reporta 7 bloques de gaps adicionales tras
validar BATCHES 1-3 (commit `11ed646`). El sistema sigue sin estar listo
para arrancar ciclo de pruebas.
**Predecesor:** `2026-05-10-secretaria-consolidacion-pre-test-cycle.md`.

---

## Catálogo de gaps P0 ronda 2

Los gaps se etiquetan con prefijo según naturaleza:
- `B-` = Bug de lógica (no aceptable en demo)
- `U-` = UX confusión / friction
- `F-` = Feature faltante
- `A-` = Re-arquitectura

### B-A: Motor V2 aplica reglas de Junta al convocar Consejo

**Severidad:** ALTA · **Esfuerzo:** M.

Cuando el usuario convoca un Consejo en ARGA Seguros y selecciona materia
APROBACION_CUENTAS en el orden del día (Paso 3), el motor devuelve reglas
de Junta General (porque APROBACION_CUENTAS es competencia de JG, no del
CdA). Además **no aparecen las reglas reales** que aplicarían al órgano
correspondiente.

`useRuleResolutions` recibe `(entity_id, materias[])` pero no filtra por
`body_type`, así que devuelve cualquier regla que matchee la materia
independientemente del órgano convocante.

**Fix:** `useRuleResolutions` debe recibir `body_type` y filtrar reglas
con `applies_to_body_types` compatibles. Si `body_type='CDA'` y materia
es competencia de JG, motor debe devolver `null` con explicación
"Materia no compatible con este órgano. La aprobación de cuentas anuales
es competencia de la Junta General (art. 164 LSC). Convoca una Junta o
selecciona materia compatible con el CdA (formulación de cuentas, etc.)."

### B-B: Acuerdo sin sesión Paso 5 — botón Adoptar deshabilitado con todos favor

**Severidad:** ALTA · **Esfuerzo:** S.

`AcuerdoSinSesionStepper.tsx:834`:
```tsx
disabled={adoptAgreement.isPending || !resultado?.aprobado}
```

Aunque el usuario marca todos los votos como FAVOR, `resultado.aprobado`
no se vuelve `true`. Causas posibles:
- Motor V2 no recalcula tras registrar votos (queda con snapshot stale).
- `total_members` no se popularizó al crear `no_session_resolutions`
  (insert hook usa input sin defaults consistentes).
- Pipeline 5-gate del no-session devuelve unanimidad falsa por edge case.

**Fix:** auditar la cadena `useCastVote → fn_no_session_cast_response →
recálculo de resultado` y asegurar que tras N votos FAVOR consecutivos
con `total_members=N`, `resultado.aprobado=true`. Añadir test motor V2
para el caso.

### B-C: Botón "Crear sociedad" sigue invisible — root cause real

**Severidad:** ALTA · **Esfuerzo:** S.

El BATCH 1 de la ronda 1 puso "Nueva sociedad" en Dashboard quick actions
SOLO en modo `grupo`. Pero el usuario arranca normalmente en modo
**sociedad** (scope ARGA Seguros) → nunca ve el quick action. Además, el
sidebar `SOCIEDAD_NAV_GROUPS` (`navigation.ts:63`) **no incluye una
entrada "Sociedades"** — solo "Ficha societaria" que apunta a la
sociedad scopeada. Por tanto en modo sociedad NO hay forma de navegar al
listado completo ni ver el botón "Nueva sociedad" de SociedadesList.

**Fix:**
1. Añadir entrada "Sociedades" al `SOCIEDAD_NAV_GROUPS` (sin
   `requiresEntity`, link al listado completo `/secretaria/sociedades`).
2. Añadir quick action "Nueva sociedad" también en modo sociedad
   (Dashboard).
3. Verificar SociedadesList header tiene CTA "Nueva sociedad" prominente
   en ambos modos.

### U-A: Convocatoria Paso 3 — agenda obliga elegir entre 7 acuerdos predefinidos

**Severidad:** MEDIA-ALTA · **Esfuerzo:** M.

`AGENDA_MATERIAS` array tiene 7 opciones predefinidas (APROBACION_CUENTAS,
NOMBRAMIENTO_CONSEJERO, etc.) y el usuario debe elegir UNA por punto. No
hay opción de "Otros / acuerdo libre" sin asociar a una regla, lo cual
es una expectativa estándar para temas no contemplados en catálogo.

Confusión adicional: los 3 valores de `tipo` (ORDINARIA / ESTATUTARIA /
ESTRUCTURAL) no se explican en la UI. El usuario no sabe para qué sirven
ni cómo cambian la regla aplicable.

**Fix:**
- Añadir opción "Otros — acuerdo libre" al dropdown de materia que NO
  invoca motor V2 (queda como punto informativo sin reglas asociadas).
- Tooltip por opción `tipo` explicando: ORDINARIA = mayoría simple;
  ESTATUTARIA = mayoría reforzada art. 199 LSC; ESTRUCTURAL = mayoría
  reforzada + escritura/notario.

### U-B: Convocatoria Paso 4 — Presidente y Secretario no priorizados

**Severidad:** BAJA-MEDIA · **Esfuerzo:** XS.

La lista de destinatarios (mandates activos del body) aparece en orden
arbitrario. Usuario espera Presidente y Secretario al inicio.

**Fix:** ordenar `activeMandates` con prioridad PRESIDENTE > SECRETARIO >
VICEPRESIDENTE > CONSEJERO_COORDINADOR > CONSEJERO > resto.

### U-C: Convocatoria Paso 5 — canales según tipo de órgano

**Severidad:** MEDIA · **Esfuerzo:** M.

La lista larga de canales (BORME, ERDS, JORNAL, DOF, etc.) solo aplica
a Junta General. Para CdA y comisiones la comunicación es directa a los
miembros (correo certificado + email). Mostrar todo crea ruido.

Falta opción de "Email simple" — para CdA / comisiones donde es
suficiente la comunicación electrónica.

**Fix:** filtrar `PUBLICATION_CHANNELS_BY_BODY_TYPE`. Para `body_type
IN ('CDA','COMISION_DELEGADA')` mostrar solo `[CORREO_CERTIFICADO,
EMAIL_SIMPLE, ERDS]`. Añadir constante `EMAIL_SIMPLE` al catálogo
si no existe.

### U-D: Convocatoria Paso 6 — adjuntos sin vinculación a reglas

**Severidad:** MEDIA · **Esfuerzo:** M.

Los adjuntos son texto libre. No hay vinculación a las reglas del
acuerdo. Por ejemplo, cuando se aprueban cuentas anuales, el motor V2
debería REQUERIR que se adjunte el "Borrador de cuentas anuales" o las
"Cuentas formuladas por el CdA" — esto es obligatorio por art. 197
LSC.

**Fix:** vincular `requiredDocuments` (que el motor ya calcula) al paso
6 con UI que pre-rellena los adjuntos esperados. Marcar "Pendiente" los
que faltan y bloquear emisión si son obligatorios.

### U-E: Composer doc genera contenido sucio (trazabilidad/meta en texto)

**Severidad:** ALTA · **Esfuerzo:** M.

El documento generado por GenerarDocumentoStepper incluye en el texto
campos como "Trazabilidad del sistema", "campos editables", IDs de
request, hashes — meta-información que no debe aparecer en el documento
legal final. Debe quedar fuera del texto que se firma.

**Fix:** auditar plantillas (Capa 1) y resolver-context para no
inyectar estos campos en el render. Mantenerlos como metadata externa
(en `evidence_bundles` y `audit_log`) pero no dentro del DOCX.

### U-F: AcuerdoSinSesion Paso 1 — bloquea acuerdos libres por tipología órgano

**Severidad:** MEDIA-ALTA · **Esfuerzo:** M.

El stepper asume una materia predefinida del catálogo. No permite
"acuerdo libre" sin tipología. Además no controla que la materia
elegida sea competencia del órgano destinatario:
- APROBACION_CUENTAS → debe ser Junta General
- FORMULACION_CUENTAS → debe ser órgano de administración
- NOMBRAMIENTO_AUDITOR → Junta General
- DELEGACION_FACULTADES → órgano administración

**Fix:** validador en Paso 1 que filtra materias compatibles con el
body seleccionado y propone alternativa si hay mismatch.

### U-G: AcuerdoSinSesion — multiacuerdo en una sola votación

**Severidad:** MEDIA-ALTA · **Esfuerzo:** L.

Actualmente cada `no_session_resolution` tiene UN solo `proposal_text` y
una votación. La realidad operativa es que múltiples acuerdos se promueven
en la misma ronda (e.g., "aprobar cuentas + reparto dividendos +
nombramiento auditor" en una sola consulta a los miembros).

**Fix:** refactorizar `no_session_resolutions` para soportar N propuestas
hijas. Cada propuesta tiene su propio `proposal_text` + materia + votos.
Schema: añadir tabla `no_session_propuestas` o usar JSONB array. Decisión
de schema en sub-spec dedicada.

### F-A: Convocatoria Paso 2 — domicilio social default

**Severidad:** MEDIA · **Esfuerzo:** XS.

Campo `lugar` se inicia vacío. Debería pre-rellenarse con el domicilio
social de la entity (campo `entities.domicilio_social` o equivalente)
y permitir override. Si no existe el campo en `entities`, deuda de schema.

**Fix:** leer `entity.domicilio_social` y setear como default. Si null,
mostrar warning "Esta sociedad no tiene domicilio social registrado.
Edita la ficha societaria para añadirlo."

### F-B: AcuerdoSinSesion Paso 3 — dirección de notificación

**Severidad:** MEDIA · **Esfuerzo:** S.

No se captura la dirección a la que se notificará el acuerdo a los
miembros (postal o electrónica certificada). Necesario para QTSP/ERDS
trazabilidad.

**Fix:** campo nuevo en stepper `direccion_notificacion` (texto libre o
selector entre direcciones registradas para cada miembro).

### F-C: AcuerdoSinSesion Paso 4 — UI de votación por miembro

**Severidad:** MEDIA · **Esfuerzo:** L.

Actualmente la votación se "registra" desde el secretario (Paso 4 de
ese stepper). En realidad debe poder votarse desde la UI del miembro
del órgano O adjuntar copia del documento de votación generado en
Paso 3 (si la votación se hizo por escrito fuera del sistema).

**Fix:** dos opciones:
1. UI dedicada `/secretaria/acuerdos-sin-sesion/{id}/votar/{persona_id}`
   con autenticación del miembro.
2. Adjunto de documento PDF firmado QES con las firmas de los miembros.

Versión futura: recoger el momento exacto de la aceptación con
timestamp QTSP.

### F-D: Libro de socios — cap table no visible

**Severidad:** MEDIA · **Esfuerzo:** S.

`/secretaria/libro-socios` no muestra el cap table actual de la
sociedad scopeada. Debería listar todas las `capital_holdings` activas
con holder, share_class, número títulos, % capital, fecha alta.

**Fix:** auditar `LibroSocios.tsx` y añadir tabla cap table.

### F-E: Libros obligatorios — no visualizables

**Severidad:** MEDIA · **Esfuerzo:** M.

`/secretaria/libros` permite registrar fechas de legalización pero no
visualizar el contenido del libro. Los dos libros obligatorios (registro
de actas + registro de socios) deben tener vista paginada del histórico.

**Fix:** vistas dedicadas para cada libro:
- `/secretaria/libros/actas` lista todas las `minutes` ordenadas
  cronológicamente.
- `/secretaria/libros/socios` igual a `/secretaria/libro-socios` con
  histórico (incluyendo holdings con `effective_to NOT NULL`).

### F-F: Calendario — vistas por rol

**Severidad:** MEDIA · **Esfuerzo:** S.

Calendario muestra todo a todos. SECRETARIO/ADMIN_TENANT debe ver
todas las convocatorias / reuniones / vencimientos. Otros roles
(CONSEJERO, COMPLIANCE, AUDITOR) deben ver solo "su agenda" (eventos
donde son destinatario).

**Fix:** filtrar `Calendario.tsx` por rol via `useCurrentUserRole`.
Para no-admin, solo eventos donde la persona del usuario aparece como
destinatario / president / secretary / member del body.

### A-A: Composer 4 capas — re-arquitectura

**Severidad:** P1 (sprint dedicado) · **Esfuerzo:** XL.

Modelo actual: 3 capas (1 plantilla / 2 datos+variables / 3 editable
por usuario). Evolución requerida:

```
Capa 1: Plantilla (inmutable, firmada legal)
Capa 2: Datos y variables (auto-resolver desde fuentes canónicas)
Capa 3: Composer IA (NUEVO — sugiere borrador desde Capa 1+2 con LLM)
Capa 4: Edición final por usuario (renombrar actual Capa 3 a Capa 4)
```

Plus: limpiar plantillas para no incluir trazabilidad/logs en texto
generado. Plus: 17 plantillas sin firma + 3 críticas (FUSION_ESCISION
genérica, RATIFICACION_ACTOS sin lista, SEGUROS_RESPONSABILIDAD
conflicto intra-grupo).

**Fuera de scope ronda 2.** Se aborda en sprint dedicado post-ronda 2.

### Diferido: DecisionUnipersonal

A revisar tras consolidación de los anteriores. No se modifica en esta
ronda.

---

## Plan de ejecución por batches

| Batch | Ítems | Severidad | Esfuerzo | Estado |
|---|---|---|---|---|
| **4** | B-C (botón sociedad invisible — sidebar SOCIEDAD + Dashboard ambos modos) | ALTA | S | pending |
| **5** | B-A (motor reglas filter por body_type) + tests | ALTA | M | pending |
| **6** | B-B (acuerdo sin sesión votación adopt) + tests | ALTA | S | pending |
| **7** | U-A (agenda libre + materia tooltip) | MEDIA-ALTA | M | pending |
| **8** | U-B (orden destinatarios) + U-C (canales por órgano) + U-D (adjuntos por regla) | MEDIA-ALTA | M | pending |
| **9** | F-A (domicilio social default) | MEDIA | XS | pending |
| **10** | U-F + U-G (refactor AcuerdoSinSesion: libre + multiacuerdo) | MEDIA-ALTA | L | pending |
| **11** | F-B (notificación) + F-C (UI votación por miembro / adjunto) | MEDIA | M+L | pending |
| **12** | F-D (cap table) + F-E (libros obligatorios visibles) | MEDIA | M | pending |
| **13** | F-F (calendario por rol) | MEDIA | S | pending |
| **14** | U-E (composer doc clean output) | ALTA | M | pending |
| **A-1** (P1) | Composer 4 capas re-arquitectura | P1 | XL | sprint |
| **L-1..7** (P1) | Plantillas legales G4-G10 | P1 | mixto | comité |

## Strategy

Ejecuto secuencialmente BATCHES 4-14 en este worktree con commits +
push por batch. Cada batch verifica:
- typecheck + lint
- tests unitarios sin regresión
- e2e Phase B sin regresión (cuando aplique)
- demo manual del afectado (cuando sea UI puro)

A-1 (composer 4 capas) y L-1..7 quedan fuera de scope inmediato hasta
cerrar consolidación visible.
