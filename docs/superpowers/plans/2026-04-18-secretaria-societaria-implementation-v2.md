# Plan v2 — Secretaría Societaria (con agregado `agreements`)

**Fecha:** 2026-04-18
**Supersede:** `2026-04-18-secretaria-societaria-implementation.md` (v1, en TGMS_mapfre_mockup)
**Repo:** `/Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map`
**Estado base:** T1 (schema + seed) ✓, T2 (shell Garrigues) ✓, T3 (rules + dashboard) ✓, T1b (agreements) ✓

---

## Cambios respecto al plan v1

### 1. Agregado raíz `agreements`

El "acuerdo societario" deja de ser un dato secundario disperso por `meeting_resolutions`, `no_session_resolutions` y `unipersonal_decisions`, y pasa a ser un **agregado raíz con vida propia**.

```
agreements (
  id, tenant_id, entity_id, body_id, code,
  agreement_kind,            -- 'APROBACION_CUENTAS'|'NOMBRAMIENTO_CESE'|'MOD_ESTATUTOS'|...
  matter_class,              -- ORDINARIA | ESTATUTARIA | ESTRUCTURAL
  inscribable,               -- bool
  adoption_mode,             -- MEETING | UNIVERSAL | NO_SESSION | UNIPERSONAL_SOCIO | UNIPERSONAL_ADMIN
  required_quorum_code,
  required_majority_code,
  jurisdiction_rule_id,
  proposal_text, decision_text, decision_date, effective_date,
  status,                    -- DRAFT→PROPOSED→ADOPTED→CERTIFIED→INSTRUMENTED→FILED→REGISTERED
  parent_meeting_id,
  unipersonal_decision_id,
  no_session_resolution_id,
  statutory_basis,
  compliance_snapshot        -- jsonb, frozen al pasar a ADOPTED
)
```

**FKs añadidos (ya aplicados en T1b):**
- `certifications.agreement_id → agreements.id`
- `registry_filings.agreement_id → agreements.id`
- `meeting_resolutions.agreement_id → agreements.id`

### 2. Flujo de creación

Cada vía de adopción **crea una fila en `agreements`**:

| Vía de adopción | Cuándo se crea el agreement | adoption_mode |
|---|---|---|
| Reunión presencial/telemática | Al aprobar votación en `ReunionStepper` paso 5 | `MEETING` |
| Junta universal | Ídem pero con flag de universalidad | `UNIVERSAL` |
| Acuerdo sin sesión escrito | Al cerrar votación (`AcuerdoSinSesionStepper` paso 6) | `NO_SESSION` |
| Decisión socio único | Al firmar decisión unipersonal de socio | `UNIPERSONAL_SOCIO` |
| Decisión adm. único | Al firmar decisión unipersonal de administrador | `UNIPERSONAL_ADMIN` |

El estado del agreement progresa independientemente del estado de la reunión / decisión que lo originó:
- `DRAFT` → `PROPOSED` (redactado, pendiente de adopción)
- `PROPOSED` → `ADOPTED` (votado favorablemente; snapshot de compliance frozen)
- `ADOPTED` → `CERTIFIED` (certificación emitida)
- `CERTIFIED` → `INSTRUMENTED` (escritura o instancia firmada, si inscribible)
- `INSTRUMENTED` → `FILED` (presentado en registro)
- `FILED` → `REGISTERED` (inscripción OK) | `REJECTED_REGISTRY` (subsanación)
- `REGISTERED` → `PUBLISHED` (BORME/PSM/etc.)

### 3. Tasks nuevas o modificadas

| Task | Cambio vs v1 |
|---|---|
| T4  | Convocatorias — sin cambios (no crea agreement) |
| T5  | **Reuniones** — paso 5 "Votaciones" crea filas en `agreements` (adoption_mode=`MEETING`), rellena snapshot compliance |
| T6  | **Actas + Certificaciones** — `certifications.agreement_id` obligatorio al emitir |
| T7  | **Tramitador** — parte siempre de un `agreement.id`; `registry_filings.agreement_id` obligatorio |
| T8  | **Acuerdos sin sesión** — al cerrar votación crea `agreement` con adoption_mode=`NO_SESSION` |
| T9  | **Decisiones unipersonales** — al firmar crea `agreement` con adoption_mode correspondiente |
| T13 | **NUEVO** — `useAgreementCompliance` |
| T14 | **NUEVO** — vista "Expediente del acuerdo" (timeline cross-table) |

---

## Orden de ejecución (Fase C)

```
T4  → T5  → T6  → T7  → T8  → T9  → T10 → T11 → T13 → T14 → T12
```

Rationale: primero vías de adopción (T5/T8/T9), luego certificación (T6), luego registro (T7), luego transversales (T13/T14), y por último cross-links desde módulos externos (T12) para evitar imports rotos.

---

## Tasks detalladas

### T4 — Convocatorias

**Archivos:**
- `src/hooks/useConvocatorias.ts` — list, detail, create
- `src/pages/secretaria/ConvocatoriasList.tsx` — tabla + filtros (tipo, estado, entidad)
- `src/pages/secretaria/ConvocatoriaDetalle.tsx` — detalle + attachments + vínculo a meeting
- `src/pages/secretaria/ConvocatoriasStepper.tsx` — 7 pasos (tipo → fecha/plazo → orden del día → destinatarios → canales → adjuntos → emisión)

**Rutas a añadir en `App.tsx`:**
```
/secretaria/convocatorias           → ConvocatoriasList
/secretaria/convocatorias/nueva     → ConvocatoriasStepper
/secretaria/convocatorias/:id       → ConvocatoriaDetalle
```

**UX tokens:** tabla con header `bg-[var(--g-surface-subtle)]`, stepper vertical con `border-l-2 border-[var(--g-brand-3308)]` para pasos completados.

### T5 — Reuniones

**Archivos:**
- `src/hooks/useReunionSecretaria.ts` — con mutation `createAgreementsFromVotes`
- `src/pages/secretaria/ReunionesLista.tsx`
- `src/pages/secretaria/ReunionStepper.tsx` — 6 pasos (constitución → asistentes → quórum → debates → **votaciones (crea agreements)** → cierre)

**Cambio crítico:** cuando paso 5 "Votaciones" se marca aprobado, por cada `meeting_resolutions` row:
```typescript
INSERT INTO agreements (
  tenant_id, entity_id, body_id, agreement_kind, matter_class,
  inscribable, adoption_mode, parent_meeting_id,
  proposal_text, decision_text, decision_date, status,
  compliance_snapshot, jurisdiction_rule_id
) VALUES (..., 'ADOPTED', jsonb_build_object(...), ...);

UPDATE meeting_resolutions SET agreement_id = <new agreement id>;
```

### T6 — Actas + Certificaciones

**Archivos:**
- `src/hooks/useActas.ts` — list, detail con meeting + agreements asociados
- `src/pages/secretaria/ActasLista.tsx`
- `src/pages/secretaria/ActaDetalle.tsx` — render del acta + lista de agreements + botón "Emitir certificación" (abre modal → selecciona agreement)

Al emitir: `certifications.agreement_id` es obligatorio; cambia el agreement a `CERTIFIED`.

### T7 — Tramitador registral

**Archivos:**
- `src/hooks/useTramitador.ts`
- `src/pages/secretaria/TramitadorLista.tsx`
- `src/pages/secretaria/TramitadorStepper.tsx` — 5 pasos (**seleccionar agreement** → escoger vía notarial/electrónica → datos del instrumento → presentación → seguimiento)

El paso 1 fuerza la selección de un agreement en estado ≥ `CERTIFIED`. Los estados del agreement avanzan: `CERTIFIED → INSTRUMENTED → FILED → REGISTERED`.

### T8 — Acuerdos sin sesión

**Archivos:**
- `src/hooks/useAcuerdosSinSesion.ts` — con mutation `closeVotingAndCreateAgreement`
- `src/pages/secretaria/AcuerdosSinSesion.tsx`
- `src/pages/secretaria/AcuerdoSinSesionStepper.tsx` — 6 pasos (tipo acuerdo → propuesta → destinatarios → envío y votación → **cierre (crea agreement)** → certificación opcional)
- `src/pages/secretaria/AcuerdoSinSesionDetalle.tsx`

### T9 — Decisiones unipersonales

**Archivos:**
- `src/hooks/useDecisionesUnipers.ts` — con mutation `signAndCreateAgreement`
- `src/pages/secretaria/DecisionesUnipersonales.tsx`
- `src/pages/secretaria/DecisionDetalle.tsx`

Al firmar: crea agreement con adoption_mode = `UNIPERSONAL_SOCIO` o `UNIPERSONAL_ADMIN`.

### T10 — Libros obligatorios

**Archivos:**
- `src/hooks/useLibros.ts`
- `src/pages/secretaria/LibrosObligatorios.tsx` — tabla con alertas `bg-[var(--status-warning)]` si `next_deadline < 30 días`

### T11 — Plantillas

**Archivos:**
- `src/hooks/usePlantillas.ts`
- `src/pages/secretaria/Plantillas.tsx` — tabla + preview con locale (es-ES, pt-PT, pt-BR, es-MX)

### T13 — useAgreementCompliance

**Archivo:** `src/hooks/useAgreementCompliance.ts`

```typescript
type ComplianceResult = {
  convocation_compliant: boolean;
  quorum_compliant: boolean;
  conflict_handled: boolean;
  majority_compliant: boolean;
  instrument_required: 'ESCRITURA' | 'INSTANCIA' | 'NINGUNO';
  registry_required: boolean;
  publication_required: boolean;
  publication_channel: string | null;
  blocking_issues: string[];
};

export function useAgreementCompliance(agreementId: string): UseQueryResult<ComplianceResult>;
```

Lógica: joinea `agreements` + `jurisdiction_rule_sets` + (según adoption_mode) meeting/decision/no_session; evalúa plazos de convocatoria, quórum, conflictos notificados, mayorías requeridas por `matter_class`, y deriva si requiere escritura/instancia.

Se ejecuta **una vez al pasar de PROPOSED→ADOPTED** y el resultado se persiste en `agreements.compliance_snapshot`. Después se lee de ahí para no recalcular.

### T14 — ExpedienteAcuerdo

**Archivo:** `src/pages/secretaria/ExpedienteAcuerdo.tsx`
**Ruta:** `/secretaria/acuerdos/:id`

Timeline vertical cross-table:
1. Propuesta (agreements.proposal_text, created_at)
2. Origen (meeting | no_session | unipersonal — navegable)
3. Adopción (decision_date, decision_text)
4. Compliance snapshot (render del jsonb como checklist)
5. Certificación (si existe — navegable)
6. Instrumentación (deeds — si existe)
7. Presentación registral (registry_filings — si existe, con estado)
8. Publicación (BORME/PSM/...)

**UX:** cada hito usa el patrón WorkflowStepper ya establecido en el shell TGMS, traducido a tokens Garrigues.

### T12 — Cross-module

**Archivos:**
- `src/pages/OrganoDetalle.tsx` — añadir tab "Secretaría" con últimas convocatorias + reuniones + agreements del órgano
- `src/pages/PoliticaDetalle.tsx` — si la política fue aprobada mediante un agreement, enlace "Ver expediente"

**Usar:** hooks Secretaría ya creados en T4/T5 + `useAgreements(body_id)`.

---

## Correcciones UX pendientes de aplicar en cada task

Ver tabla "Deuda UX en el plan v1" en `CLAUDE.md`. Resumen:

- Sustituir todo `style={{ color/background/border: "var(--g-...)" }}` por `className="text-[var(--g-...)]"` cuando exista clase Tailwind equivalente.
- `var(--g-brand)` → `var(--g-brand-3308)`
- `var(--g-surface-secondary)` → `var(--g-surface-subtle)`
- `var(--g-status-*)` → `var(--status-*)` (sin `--g-`)
- Ninguna clase Tailwind de color nativa (`bg-green-*`, `text-amber-*`, `text-white`, `bg-gray-*`) en componentes bajo `/secretaria/*`.
- Montserrat activo vía `.garrigues-module` wrapper (ya presente en `SecretariaLayout`).

---

## No hacer

- No crear rutas T4-T14 en `App.tsx` hasta que sus componentes existan — hacerlo incremental por task.
- No modificar tablas del schema `sii.*` ni hooks de Fase 1 (salvo T12, y solo añadir tabs/bloques, nunca romper).
- No alterar triggers existentes (`fn_minutes_lock_guard`, `fn_convocatoria_immutable_guard`).
- No añadir `strictNullChecks` ni otras opciones de TS estrictas.

---

## Datos demo adicionales (seed T1b)

Al final de T5, sembrar 3 agreements históricos ligados al meeting `cda-22-04-2026` y a la certificación `CERT-001` existente para que el expediente funcione en demo sin necesidad de crear reunión nueva.
