# Secretaría Societaria — Ciclos básicos: spec funcional + lógica de procesos

**Fecha:** 2026-05-10.
**Versión:** v1 (post-Phase B base estable, commit `878a7ab`).
**Propósito:** documento descriptivo de la funcionalidad y lógica de los
ciclos básicos del módulo Secretaría Societaria (TGMS), suficiente para
diseñar una batería de pruebas (unitarias, contract, integración, e2e UI
driving) contra esta línea base.

**Alcance:** los ciclos validados end-to-end por Phase B (B4-B7), que
representan el demostrador operativo "prototipo realista y funcional" del
módulo. NO cubre módulos adyacentes (GRC Compass, AI Governance) ni flujos
TGMS Console.

---

## 1. Contexto y arquitectura general

### 1.1 Producto

**TGMS Platform — módulo Secretaría Societaria**: plataforma de gobernanza
corporativa para el ciclo formal societario de grupos aseguradores
multinacionales. Cliente demo objetivo: **Grupo ARGA Seguros** (pseudónimo
operativo del cliente real).

El módulo Secretaría cubre:
1. **Constitución y estructura societaria**: alta de sociedades, órganos
   sociales, cap table, condiciones de personas (cargos vigentes).
2. **Convocatoria**: emisión formal con motor LSC v2 que evalúa antelación,
   forma, contenido, canales de publicación según jurisdicción.
3. **Reunión societaria**: stepper 6 pasos (constitución → asistentes →
   quórum → agenda → votaciones → cierre/acta) con motor V2 evaluando cada
   fase.
4. **Acta**: generada vía `fn_generar_acta` con `content_hash` SHA-512 +
   `snapshot_id` linkando al censo inmutable.
5. **Certificación**: pipeline QTSP 3-RPCs (`fn_generar_certificacion` +
   `fn_firmar_certificacion` + `fn_emitir_certificacion`) con audit_log WORM.
6. **Adopción sin sesión** (4 modos): `NO_SESSION` (votación distribuida),
   `CO_APROBACION` (k de n admins), `SOLIDARIO` (1 admin actuante),
   `UNIPERSONAL_SOCIO`/`UNIPERSONAL_ADMIN` (decisión unipersonal).
7. **Tramitación registral**: TramitadorStepper notarial/registral
   (parcialmente cubierto fuera de scope de este documento).
8. **Generación documental**: GenerarDocumentoStepper con plantillas
   tri-capa + QTSP archival (parcialmente cubierto).

### 1.2 Stack y backbone

- **Frontend**: React 18 + TypeScript + Vite + Tailwind + shadcn/ui +
  TanStack Query.
- **Backend**: Supabase Cloud (proyecto `governance_OS`, ref
  `hzqwefkwsxopwrmtksbg`, eu-central-1).
- **Auth**: Supabase Auth (demo: `demo@arga-seguros.com`).
- **Tenant**: `00000000-0000-0000-0000-000000000001` (multi-tenant, demo
  único).
- **Motor LSC v2**: lógica TS pura en `src/lib/rules-engine/` —
  evaluadores, orquestador, jerarquía normativa.
- **QTSP**: EAD Trust Digital Trust API (stub determinista en demo, real
  en producción) para QES/QSeal/timestamps cualificados.

---

## 2. Modelo canónico de datos

### 2.1 Tablas core

| Tabla | Rol | Notas clave |
|---|---|---|
| `persons` | Personas físicas (PF) y jurídicas (PJ) | `person_type IN ('PF','PJ')`. PJ aparece como owner de `entities` vía FK `person_id`. |
| `entities` | Sociedad / órgano corporativo | `tipo_social IN ('SA','SAU','SL','SLU')`, `tipo_organo_admin IN ('CDA','ADMIN_UNICO','ADMIN_SOLIDARIOS','ADMIN_MANCOMUNADOS')`, `forma_administracion`, `es_unipersonal`, `es_cotizada`. |
| `entity_capital_profile` | Capital escriturado/desembolsado | Como máximo **1 fila VIGENTE** por `entity_id` (UNIQUE parcial). |
| `share_classes` | Clases de acciones/participaciones | `votes_per_title`, `economic_rights_coeff`, `voting_rights`, `veto_rights`. |
| `capital_holdings` | Libro de socios (cap table) | `holder_person_id` + `share_class_id` + `numero_titulos` + `porcentaje_capital`. `is_treasury=true` ⇒ `voting_weight=0`. |
| `governing_bodies` | Junta General, Consejo, Comisiones | `body_type IN ('JUNTA','CDA','COMISION_DELEGADA')`, `quorum_rule` JSONB. |
| `condiciones_persona` | Cargo de persona en sociedad/órgano | CHECK `chk_condicion_body_coherente`: ADMIN_*/SOCIO/ADMIN_PJ deben tener `body_id NULL`; CONSEJERO/PRESIDENTE/SECRETARIO/VICEPRESIDENTE/CONSEJERO_COORDINADOR deben tener `body_id NOT NULL`. |
| `representaciones` | PJ_PERMANENTE / JUNTA_PROXY / CONSEJO_DELEGACION | (Fase 0+1 backbone). |
| `parte_votante_current` | Proyección regenerable | `voting_weight` y `denominator_weight` separados. |
| `censo_snapshot` | Inmutable, append-only | Triggers BEFORE UPDATE/DELETE lanzan excepción. `audit_worm_id` automático. |
| `meetings` | Sesión societaria | Estados: `DRAFT` → `CONVOCADA` → `OPEN`/`CELEBRADA` → `CANCELADA`. CHECK rechaza `'PROGRAMADA'`. |
| `meeting_attendees` | Asistencia | `attendance_type IN ('PRESENCIAL','REPRESENTADO','AUSENTE')`. FK NO-CASCADE a `meetings.id`. |
| `meeting_resolutions` | Votaciones por punto agenda | Una fila por punto, link al `agreement_id` cuando se materializa. |
| `meeting_votes` | Votos individuales | FK NO-CASCADE a `meeting_attendees.id` (importante en cleanup). |
| `agreements` | **Agregado raíz** del acuerdo societario | Ver §2.2. |
| `convocatorias` | Convocatoria emitida | `estado IN ('BORRADOR','EMITIDA','ANULADA')`, `tipo_convocatoria IN ('ORDINARIA','EXTRAORDINARIA','UNIVERSAL')`. |
| `no_session_resolutions` | Votación distribuida sin sesión | `status IN ('VOTING_OPEN','APROBADO','RECHAZADO','EXPIRADO')`. |
| `unipersonal_decisions` | Decisión unipersonal socio/admin | `decision_type IN ('SOCIO_UNICO','ADMINISTRADOR_UNICO')`, `status IN ('BORRADOR','FIRMADA')`. |
| `minutes` | Acta generada | `content_hash` SHA-512 + `snapshot_id` (link a censo) + `body_id` + `entity_id`. Una fila por reunión. |
| `certifications` | Certificación QTSP de acuerdos | `gate_hash`, `hash_certificacion`, `tsq_token` (bytea), `signature_status`, `evidence_id`, `agreements_certified[]`. FK no-CASCADE → `minutes.id`. |
| `evidence_bundles` | Bundle SHA-512 sellado | `manifest_hash`, opcionalmente vinculado a `certifications.evidence_id`. |
| `authority_evidence` | Acreditación de cargo certificante | Trigger-creado al insertar PRESIDENTE/SECRETARIO en `condiciones_persona`. |
| `capability_matrix` | Permisos rol × acción | RBAC interno (SECRETARIO/ADMIN_TENANT/COMPLIANCE/CONSEJERO/AUDITOR × SNAPSHOT/VOTE/CERTIFICATION). Seed F1. |
| `audit_log` | WORM trail (SHA-512 hash chain) | Triggers `fn_audit_worm` + `fn_verify_audit_chain`. NO se borra (intencional). |

### 2.2 Tabla `agreements` (agregado raíz)

Cualquier acuerdo societario formal queda materializado como fila en
`agreements`, sea cual sea su modo de adopción:

```sql
agreements (
  id uuid PK,
  tenant_id uuid NOT NULL,
  entity_id uuid REFERENCES entities,
  body_id uuid REFERENCES governing_bodies,  -- NULL en UNIPERSONAL
  agreement_kind text NOT NULL,              -- materia (APROBACION_CUENTAS, etc.)
  matter_class text NOT NULL,                -- CHECK IN ('ORDINARIA','ESTATUTARIA','ESTRUCTURAL')
  inscribable boolean DEFAULT false,
  adoption_mode text NOT NULL,               -- ver §3.1
  required_quorum_code text,
  required_majority_code text,
  jurisdiction_rule_id uuid,
  proposal_text text,
  decision_text text,
  decision_date date,
  effective_date date,
  status text NOT NULL DEFAULT 'DRAFT',      -- ver §3.2
  parent_meeting_id uuid REFERENCES meetings,           -- NULL en sin sesión
  unipersonal_decision_id uuid REFERENCES unipersonal_decisions,
  no_session_resolution_id uuid REFERENCES no_session_resolutions,
  statutory_basis text,
  compliance_snapshot jsonb,                 -- frozen al pasar a ADOPTED
  approval_workflow jsonb,                   -- estados workflow custom
  document_url text,                         -- URL del bundle archivado
  execution_mode jsonb,                      -- detalles del modo (k/n, adminActuante…)
  created_at timestamptz DEFAULT now()
)
```

CHECK constraints relevantes:
- `agreements_adoption_mode_check`: 7 valores válidos (ver §3.1).
- `agreements_matter_class_check`: 3 valores válidos
  ('ORDINARIA','ESTATUTARIA','ESTRUCTURAL'). Materias `ESPECIAL` del
  catálogo se filtran al hook (§7.5).

---

## 3. Catálogos de dominio

### 3.1 `AdoptionMode` (modos de adopción)

7 valores válidos definidos en `src/lib/rules-engine/types.ts` y aplicados
por el CHECK SQL post-migración 000057:

| Modo | Origen | Cuándo aplica | Estructura agreements |
|---|---|---|---|
| `MEETING` | Sesión presencial/telemática del CdA o Junta General | Convocatoria + reunión + votación formal | `parent_meeting_id` apunta al `meetings.id` |
| `UNIVERSAL` | Junta universal (sin convocatoria, todos presentes y aceptan agenda) | Junta universal art. 178 LSC | `parent_meeting_id`, `tipo_convocatoria='UNIVERSAL'` |
| `NO_SESSION` | Acuerdo sin sesión del CdA por escrito (votación distribuida) | Art. 248.2 LSC, requiere unanimidad | `no_session_resolution_id` apunta a `no_session_resolutions` |
| `UNIPERSONAL_SOCIO` | Sociedades unipersonales (SAU/SLU): el socio único decide | Art. 15 LSC | `unipersonal_decision_id`, `body_id NULL` |
| `UNIPERSONAL_ADMIN` | Administrador único | Art. 210 LSC | `unipersonal_decision_id`, `body_id NULL` |
| `SOLIDARIO` | 1 administrador solidario actúa unilateralmente | Art. 233 LSC + estatutos | `execution_mode.tipo='SOLIDARIO'`, `execution_mode.config.adminActuante` |
| `CO_APROBACION` | k de n administradores firman | Art. 248 LSC + estatutos / art. 245 (mancomunados) | `execution_mode.tipo='CO_APROBACION'`, `execution_mode.config.{k,n,firmas[]}` |

### 3.2 `agreements.status` (state machine)

```
DRAFT
  ├→ PROPOSED         (presentado a debate)
  │
  └→ ADOPTED          (aprobado por motor V2)
       │
       ├→ CERTIFIED   (certificación emitida con evidencia)
       │
       ├→ INSTRUMENTED (escritura/instancia notarial)
       │
       ├→ FILED       (presentado en registro)
       │
       └→ REGISTERED  / REJECTED_REGISTRY
              │
              └→ PUBLISHED (BORME / equivalente)
```

### 3.3 `MatterClass` (clase de materia)

CHECK SQL acepta exactamente 3 valores:

| matter_class | Mayoría requerida | Inscribibilidad típica | Ejemplos |
|---|---|---|---|
| `ORDINARIA` | Simple (>50%) | No-inscribible salvo cese/nombramiento | APROBACION_CUENTAS, NOMBRAMIENTO_CONSEJERO, DELEGACION_FACULTADES |
| `ESTATUTARIA` | Reforzada (2/3 — art. 199/201 LSC) | Inscribible | MOD_ESTATUTOS, AUMENTO_CAPITAL, REDUCCION_CAPITAL |
| `ESTRUCTURAL` | Reforzada + escritura + notario | Inscribible obligatorio | FUSION, ESCISION, DISOLUCION, TRANSFORMACION |

⚠ El catálogo `materia_catalog` también tiene rows con
`matter_class='ESPECIAL'` (PACTO_PARASOCIAL, EXCLUSION_SOCIO,
SEPARACION_SOCIO) que NO se persisten en `agreements`. El hook
`useMateriaCatalog` los filtra automáticamente vía
`filterAgreementCompatibleMaterias()` en `src/lib/secretaria/matter-class.ts`.
Plan: `docs/superpowers/plans/2026-05-09-matter-class-especial-filter.md`.

### 3.4 `TipoSocial`

`SA | SAU | SL | SLU` con derivaciones:
- `SAU`/`SLU` ⇔ `es_unipersonal=true`.
- Junta General ⇔ Junta de Accionistas (SA/SAU) o de Socios (SL/SLU).
- En unipersonales, el órgano "Junta" se transforma a "Socio único".

### 3.5 `TipoOrgano`

`CDA | ADMIN_UNICO | ADMIN_SOLIDARIOS | ADMIN_MANCOMUNADOS` con derivaciones
en `forma_administracion`:
- `CDA` → `CONSEJO`
- `ADMIN_UNICO` → `ADMINISTRADOR_UNICO`
- `ADMIN_SOLIDARIOS` → `ADMINISTRADORES_SOLIDARIOS`
- `ADMIN_MANCOMUNADOS` → `ADMINISTRADORES_MANCOMUNADOS`

---

## 4. Motor LSC v2 (rules-engine)

### 4.1 Capas de jerarquía normativa

`src/lib/rules-engine/jerarquia-normativa.ts` resuelve cada parámetro de
gate con prioridad descendente:

```
1. LEY            (rule_packs LSC con payloads versionados)
2. ESTATUTOS      (overrides estatutarios — rule_param_overrides)
3. PACTO          (pactos parasociales — pacto_clausulas)
4. REGLAMENTO     (reglamento del órgano)
```

`resolverReglaEfectiva()` aplica modos `override` (arrays/booleanos/strings)
o `merge` (numbers).

### 4.2 Pipelines

**Pipeline votación (6 gates)** — `src/lib/rules-engine/votacion-engine.ts`:

```
Gate 1: Convocatoria válida (plazo + forma + contenido)
Gate 2: Quórum constitución (mayoría asistencia capital)
Gate 3: Conflictos de interés (excluir voting_weight)
Gate 4: Mayoría adopción (simple/reforzada/unanimidad)
Gate 5: Bordes no computables (cotizadas + operaciones vinculadas, voto calidad presidente, representación)
Gate 6: Pactos parasociales (veto / consentimiento / mayoría reforzada pactada)
```

Cada gate retorna `{ ok, blocking_issues[], warnings[], explain[] }`. El
agregado final produce un `compliance_snapshot` JSONB que se freezea en
`agreements.compliance_snapshot` al pasar a `ADOPTED`.

**Pipeline sin sesión (5 gates)** — `src/lib/rules-engine/no-session-engine.ts`:

```
Gate 1: Modo permitido por estatutos (NO_SESSION habilitado)
Gate 2: Materia compatible con sin sesión
Gate 3: Total members + ventana temporal
Gate 4: Unanimidad alcanzada (votes_for >= total_members)
Gate 5: Pactos parasociales (mismo Gate 6 del pipeline votación)
```

**Engine version**: `src/lib/rules-engine/meeting-adoption-snapshot.ts`
exporta `MEETING_ADOPTION_SNAPSHOT_ENGINE_VERSION = "2.1"` post-A2.
`isLegacyMeetingAdoptionSnapshot()` discrimina shape pre/post motor V2.1.

### 4.3 Orquestador transversal

`src/lib/rules-engine/orquestador.ts` coordina los flujos:
- Flujo A: MEETING (convocatoria → reunión → votación → acta)
- Flujo B: UNIVERSAL
- Flujo C: NO_SESSION
- Flujo D: CO_APROBACION
- Flujo E: SOLIDARIO
- Flujo F: UNIPERSONAL_SOCIO/ADMIN

Cada flujo invoca los gates relevantes y produce el snapshot final.

---

## 5. Ciclos básicos cubiertos (validados E2E)

### 5.1 Ciclo: alta de sociedad SA con CdA (B7)

**Stepper**: `SociedadNuevaStepper` (4 pasos), ruta `/secretaria/sociedades/nueva`.

**Pre-condiciones:**
- Usuario con rol SECRETARIO o ADMIN_TENANT.
- Tenant activo en sesión.

**Flujo de pasos:**

| Paso | UI | Inputs requeridos | canNext gate |
|---|---|---|---|
| 0. Identidad | StepIdentidad | `legal_name *`, `tax_id *`, `tipo_social` (SA/SAU/SL/SLU), `jurisdiction *`, `common_name`, `registration_number` | `legal_name && tax_id && jurisdiction` |
| 1. Administración | StepAdmin | `tipo_organo_admin` (CDA/ADMIN_UNICO/ADMIN_SOLIDARIOS/ADMIN_MANCOMUNADOS), `es_unipersonal`, `es_cotizada` | `tipo_organo_admin` |
| 2. Capital | StepCapital | `capital_escriturado *`, `numero_titulos`, `valor_nominal` (auto), `currency` (EUR default) | `capital_escriturado > 0` |
| 3. Confirmar | StepConfirm | (resumen read-only) | true |

**Acción final**: botón "Crear sociedad" llama `guardar()` que ejecuta 5 inserts secuenciales (NO transacción multi-tabla — best-effort rollback compensatorio en catch):

```
1. INSERT persons (PJ con tax_id legal)
2. INSERT entities (FK person_id, slug derivado de legal_name + Date.now)
3. INSERT entity_capital_profile (estado='VIGENTE')
4. INSERT share_classes (clase ORD ordinaria por defecto)
5. INSERT governing_bodies (2 órganos: JUNTA + admin body por buildInitialBodies)
```

**Post-condiciones (verificables Cloud):**
- 1 row en `persons` con `person_type='PJ'`, `denomination=legal_name`.
- 1 row en `entities` con FK al PJ, `entity_status='Active'`, `forma_administracion` derivada.
- 1 row en `entity_capital_profile` VIGENTE.
- 1 row en `share_classes` con `class_code='ORD'`, `voting_rights=true`.
- ≥2 rows en `governing_bodies` (JUNTA + admin body — CDA o equivalente).
- Redirige a `/secretaria/sociedades/{entity_id}`.
- Toast "Sociedad creada correctamente".

**Edge cases / errores conocidos:**
- Tax_id duplicado → `persons` UNIQUE viola → toast.error rollback.
- Si falla insert intermedio (cap profile/share/bodies): cleanup compensatorio
  en orden inverso (cubierto por `e2e/35-secretaria-alta-rollback.spec.ts`).

**Tests existentes:**
- `e2e/35-secretaria-alta-rollback.spec.ts` (rollback pesimista).
- `e2e/43-secretaria-phase-b7-sociedad-nueva-ui-driving.spec.ts` (happy path optimista, opt-in).

---

### 5.2 Ciclo: convocatoria de reunión (B5)

**Stepper**: `ConvocatoriasStepper` (7 pasos), ruta `/secretaria/convocatorias/nueva`.

**Pre-condiciones:**
- Entity activa con `useEntityDemoReadiness` ≠ `'reference_only'` (requiere
  capital_holdings activos + governing_bodies + condiciones_persona vigentes
  + authority_evidence).
- Body al menos 1 vigente para la entity.
- Usuario con permisos SECRETARIO o equivalente.

**Flujo de pasos:**

| Paso | Label | Inputs clave | canAdvance gate |
|---|---|---|---|
| 1 | Sociedad y órgano | `selectedEntity`, `selectedBody`, `tipoConvocatoria` (ORDINARIA/EXTRAORDINARIA/UNIVERSAL) | `selectedEntity && selectedBody && !readinessBlocked` |
| 2 | Fecha y plazo legal | `fechaReunion *`, `horaReunion`, `lugar *`, `formatoReunion` (PRESENCIAL/TELEMATICA/MIXTA), opcional `habilitarSegunda` + `fechaReunion2` | `fechaReunion && lugar` |
| 3 | Orden del día | `agendaItems[]` con `{titulo, materia, tipo, inscribible}` | al menos 1 item con `titulo.trim()` no vacío |
| 4 | Destinatarios | mandates activos del body cargan automáticamente, opcional `excludedPersonIds` | true |
| 5 | Canales de publicación | `publication_channels[]` (defaults recomendados por jurisdicción: ES → WEB_CORPORATIVA + ERDS; PT → JORNAL_OFICIAL; BR → DIARIO_OFICIAL; MX → DOF) | true |
| 6 | Adjuntos | `adjuntos[]` con `{nombre, descripcion}` opcional | true |
| 7 | Revisión y emisión | (resumen) | true |

**Motor V2 evalúa en paralelo** (no bloquea, advierte):
- `evaluacionV2.antelacionDiasRequerida`: días requeridos según jurisdicción/tipo (SA art. 176 LSC = 1 mes ordinaria, SL = 15 días).
- `noticeOk`: si fechaReunion-fechaEmision >= antelación.
- `noticeDoubleEvaluation`: V1/V2 convergencia.
- `ruleResolutions`: rule packs aplicables + payloads compatibles.
- `pendingLegalChannelReminders`: canales legales obligatorios pendientes.
- `missingRequiredDocuments`: documentos pre-sesión obligatorios.

**Acción final**: botón "Emitir convocatoria" llama `handleEmitir()` →
`useCreateConvocatoria()` → INSERT en `convocatorias` con `estado='EMITIDA'`.

**Side effects**: ninguno destructivo. La convocatoria queda en `convocatorias`
con `rule_trace`, `reminders_trace`, `accepted_warnings` para auditoría.

**Post-condiciones:**
- 1 row en `convocatorias` con `estado='EMITIDA'`, `body_id`, `tipo_convocatoria`,
  `agenda_items` JSONB (≥1 punto), `publication_channels` array.
- Success screen in-page (NO redirect) con `setEmitidoId`.
- Toast "Convocatoria emitida correctamente".

**Edge cases:**
- Si `noticeOk=false` (plazo no cumplido): la convocatoria se emite igualmente
  como recordatorio no bloqueante (warning en `accepted_warnings`).
- `tipoConvocatoria='UNIVERSAL'`: `junta_universal=true`, `tipoConvocatoria` no
  evalúa antelación (los socios universalmente presentes aceptan agenda en mesa).
- Habilitar segunda convocatoria: campos extras `fecha_2`, `is_second_call`.

**Tests existentes:**
- `e2e/04-secretaria-convocatorias.spec.ts` (read-only smoke).
- `e2e/18-secretaria-golden-path.spec.ts` (golden path contra ARGA real).
- `e2e/41-secretaria-phase-b5-convocatoria-ui-driving.spec.ts` (sintético opt-in).

---

### 5.3 Ciclo: reunión completa con acta (B4 v1)

**Stepper**: `ReunionStepper` (6 pasos), ruta `/secretaria/reuniones/{id}`.

**Pre-condiciones:**
- Meeting existente con `status IN ('CONVOCADA','OPEN','CELEBRADA')`.
- Body con condiciones_persona vigentes (los miembros del CdA o Junta).
- Si SA + CdA: PRESIDENTE y SECRETARIO con `body_id NOT NULL`.

**Flujo de pasos:**

| Paso | Label | Inputs / acciones | Side effects |
|---|---|---|---|
| 1 | Constitución | botón "Declarar apertura" | `useOpenMeeting`: meetings.status → 'OPEN'/'CELEBRADA' |
| 2 | Asistentes | selector PRESENCIAL/REPRESENTADO/AUSENTE por miembro, "Guardar asistencia" | `useReplaceAttendees`: purga `meeting_votes` referenciando attendees previos (FK no-CASCADE) → DELETE/INSERT `meeting_attendees` |
| 3 | Quórum | (calculado motor V2 desde attendees + cap table + body.quorum_rule) | persiste en `meetings.quorum_data.quorum` |
| 4 | Agenda y debate | añadir `agendaItems[]` con `{punto, notas, materia}`, "Guardar debates" | persiste en `meetings.quorum_data.debates` |
| 5 | Votaciones | selector FAVOR/CONTRA/ABSTENCION por punto + persona, "Registrar resolución y crear expediente Acuerdo 360" | `useSaveMeetingResolutions` → RPC `fn_save_meeting_resolutions` (transaccional, SECURITY DEFINER, role guard SECRETARIO/ADMIN_TENANT). Atomic: persiste `meeting_resolutions` + `meeting_votes` + `agreements` (con `compliance_snapshot`) + `rule_evaluation_results`. |
| 6 | Cierre | botón "Confirmar cierre y generar acta" | RPC `fn_generar_acta` (SECURITY DEFINER, gate hash SHA-256(snapshot_hash‖resultado_hash)). Crea `minutes` con `body_id`, `entity_id`, `content_hash`, `snapshot_id`, `gate_hash`. |

**Motor V2 acumula compliance_snapshot por agreement** durante step 5 (vía
`fn_save_meeting_resolutions`). Cada agreement queda con
`adoption_mode='MEETING'`, `parent_meeting_id`, `status='ADOPTED'` (si
favor>contra y motor OK) o `'DRAFT'` (si motor NOK).

**Post-condiciones:**
- ≥1 row en `meeting_attendees` (3 en demo SA CdA).
- ≥1 row en `meeting_resolutions` (1 por punto agenda con materia).
- ≥1 row en `agreements` con `parent_meeting_id`, `compliance_snapshot` (engine_version='2.1').
- 1 row en `minutes` con `meeting_id`, `body_id`, `entity_id`, `content_hash` (hex),
  `snapshot_id` (puede ser NULL en legacy).
- Navega a `/secretaria/actas/{minute_id}`.

**RPC clave: `fn_save_meeting_resolutions`** (migración 000056):
- Transaccional, SECURITY DEFINER.
- Role guard: `fn_secretaria_assert_role_allowed(p_tenant_id, ARRAY['SECRETARIO','ADMIN_TENANT'])`.
- `FOR UPDATE OF m`: lock optimista del meeting.
- Idempotency: índices únicos `ux_meeting_resolutions_point` + `ux_agreements_meeting_agenda_point`.
- Reemplaza atomically: meeting_votes + meeting_resolutions + agreements + rule_evaluation_results.

**Edge cases:**
- Acta legacy (pre-F8.1): `snapshot_id NULL` → gate_hash usa `'NO_SNAPSHOT_HASH'`.
- Re-registro de votación: idempotente, no duplica filas.
- Quórum no alcanzado: agreements quedan en `'DRAFT'` con motor V2 reportando `blocking_issues`.

**Tests existentes:**
- `src/test/schema/secretaria-p0-meeting-resolutions-rpc.test.ts` (contract guard).
- `e2e/05-secretaria-reuniones.spec.ts` (smoke).
- `e2e/18-secretaria-golden-path.spec.ts` (golden path ARGA).
- `e2e/39-secretaria-phase-b3-rpc-production-path.spec.ts` (RPC cloud-real opt-in).
- `e2e/40-secretaria-phase-b4-ui-driving-synthetic.spec.ts` v0+v1 (UI driving sintético opt-in).

---

### 5.4 Ciclo: emitir certificación QTSP (B4 v2)

**Componente**: `EmitirCertificacionButton` mounted en `ActaDetalle.tsx`.

**Pre-condiciones:**
- Minute existe con `body_id`, `entity_id`, `content_hash`, `snapshot_id` (opcional).
- Al menos 1 agreement adopted referenciado por `meeting_resolutions` del meeting.
- `useCertificationPlanForMinute(minuteId)` retorna `hasPointSnapshots=true` y
  `refs.length≥1` (acuerdos proclamables).
- Usuario rol con `capability_matrix[role][CERTIFICATION]=true` (default: SECRETARIO).
- En SA, presidente vigente disponible vía `usePresidenteVigente(entityId, bodyId)`
  (precarga `vb_persona_id`).

**Acción**: click "Emitir certificación" ejecuta pipeline 3-RPCs en cadena:

```
1. fn_generar_certificacion(minute_id, tipo='ACUERDO',
                            agreements_certified[], certificante_role,
                            visto_bueno_persona_id)
   → certifications row con gate_hash = SHA-256(snapshot_hash || resultado_hash)
   Devuelve cert_id.

2. fn_firmar_certificacion(cert_id, qtsp_token, tsq_token)
   QES stub: tsq_token = base64(`tsq:demo:${cert_id}:${ts}`)
   Calcula hash_certificacion = SHA-256(gate_hash || content || tsq_token base64)
   Persiste tsq_token (decoded → bytea), hash_certificacion, signature_status='SIGNED'

3. fn_emitir_certificacion(cert_id)
   Valida signature_status='SIGNED', construye URI bundle
   ('evidence_bundle:{bundle_id}@{manifest_hash}' o marker textual)
   INSERT audit_log con action='CERT_EMITIDA', object_type='certifications',
   object_id=cert_id, delta JSONB con {hash_certificacion, uri, signature_status, ts}
   Devuelve uri.
```

**Post-condiciones:**
- 1 row en `certifications` con:
  - `signature_status='SIGNED'`
  - `gate_hash` (hex), `hash_certificacion` (hex)
  - `tsq_token` (bytea, no null)
  - `agreements_certified[]` con ≥1 UUID
  - `certificante_role` (default 'SECRETARIO')
  - `tenant_id`, `minute_id`, `tipo='ACUERDO'`
- 1 row en `audit_log` WORM con action='CERT_EMITIDA', object_id=cert.id.
- Toast "Certificación emitida".
- UI panel muestra "Certificación #{id.slice(0,8)}".

**Edge cases / gates:**
- `gate_hash IS NULL` en step 2: error "cert sin gate_hash — llamar fn_generar antes".
- `tsq_token vacío`: error "p_tsq_token requerido (base64)".
- `signature_status != 'SIGNED'` en step 3: error "cert no firmada".
- `evidence_id IS NULL` (caso común en demo): URI = 'evidence_bundle not yet linked'.

**Tests existentes:**
- `src/test/schema/rpcs-acta-cert.test.ts` (probe RPCs Cloud).
- `e2e/40-secretaria-phase-b4-ui-driving-synthetic.spec.ts` v2 (UI driving end-to-end + audit_log verify).

---

### 5.5 Ciclo: adopción sin sesión — modos alternativos (B6)

#### 5.5.1 Sub-ciclo: `CO_APROBACION` (k de n admins)

**Stepper**: `CoAprobacionStepper` (5 pasos), ruta `/secretaria/acuerdos-sin-sesion/co-aprobacion`.

**Pre-condiciones:**
- Entity con `forma_administracion IN ('ADMINISTRADORES_SOLIDARIOS','ADMINISTRADORES_MANCOMUNADOS','CONSEJO')`.
- Al menos n admins con `condicion_persona.tipo_condicion='ADMIN_SOLIDARIO'` (body_id NULL) o equivalentes.
- `useEntityDemoReadiness !== 'reference_only'`.

**Flujo de pasos:**

| Paso | Label | Inputs | canAdvance |
|---|---|---|---|
| 1 | Tipo de acuerdo | `selectedEntity`, `selectedBody`, `materia`, `texto` | todos truthy + `!readinessBlocked` |
| 2 | Configuración k de n | `k`, `n`, `ventana` (timeline temporal), `estatutosPermitenSinSesion` | `k>0 && n>=k && ventana` |
| 3 | Firmas | `firmas[]` (input "Nombre del administrador firmante" + botón "Añadir") | `firmas.length>0` (ideal: ≥k) |
| 4 | Evaluación motor | (auto-evalúa con `evaluarCoAprobacion()`) | `motorResult` truthy |
| 5 | Registrar | botón "Registrar acuerdo" → INSERT directo en `agreements` | — |

**Acción final**: INSERT en `agreements` con:
- `adoption_mode='CO_APROBACION'`
- `body_id=selectedBodyId`, `entity_id=selectedEntityId`
- `agreement_kind=materia`, `matter_class` derivado (ESTRUCTURAL si MOD_ESTATUTOS o OPERACION_ESTRUCTURAL, sino ORDINARIA)
- `status='ADOPTED'` si `motorResult.ok`, sino `'DRAFT'`
- `execution_mode={tipo:'CO_APROBACION', config:{k, n, ventanaConsenso, firmas[]}, agreement_360: {...}}`
- `compliance_snapshot=motorResult`

#### 5.5.2 Sub-ciclo: `SOLIDARIO` (1 admin actuante)

**Stepper**: `SolidarioStepper` (4 pasos), ruta `/secretaria/acuerdos-sin-sesion/solidario`.

**Pre-condiciones:** mismas que CO_APROBACION + al menos 1 admin solidario.

**Flujo de pasos:**

| Paso | Label | Inputs | canAdvance |
|---|---|---|---|
| 1 | Tipo de acuerdo | `#solidario-entidad` (entity), `#solidario-organo` (body), `#solidario-materia`, `#solidario-texto` | todos truthy |
| 2 | Administrador actuante | `#solidario-admin-id`, `#solidario-admin-nombre`, `#solidario-vigencia-desde`, `materiasRestringidas[]` opcional | `adminId && adminNombre && vigenciaDesde` |
| 3 | Evaluación motor | (auto-evalúa con `evaluarSolidario()`) | `motorResult` truthy |
| 4 | Registrar | botón "Registrar acuerdo" → INSERT en `agreements` | — |

**Acción final**: INSERT en `agreements` con:
- `adoption_mode='SOLIDARIO'`
- `execution_mode={tipo:'SOLIDARIO', config:{adminActuante, restriccionesEstatutarias[], vigenciaDesde}}`
- resto idéntico a CO_APROBACION.

#### 5.5.3 Sub-ciclo: `UNIPERSONAL_SOCIO` / `UNIPERSONAL_ADMIN`

**Stepper**: `DecisionUnipersonalStepper` (3 pasos), ruta `/secretaria/decisiones-unipersonales/nueva`.

**Pre-condiciones:**
- Entity con `es_unipersonal=true` (SAU/SLU) para SOCIO_UNICO, o
  `tipo_organo_admin='ADMIN_UNICO'` para ADMINISTRADOR_UNICO.
- Catálogo de materias filtrado a `agreement_compatible` (excluye ESPECIAL).

**Flujo de pasos:**

| Paso | Label | Inputs | canAdvance |
|---|---|---|---|
| 1 | Tipo y materia | sociedad select, botón `SOCIO_UNICO`/`ADMINISTRADOR_UNICO`, `materia` (del catálogo filtrado) | `selectedEntityId && materia && !readinessBlocked` |
| 2 | Texto del acuerdo | `texto *`, `fundamentoLegal` opcional | `texto.trim().length > 0` |
| 3 | Registro y documento | botón "Registrar decisión y expediente" | — |

**Acción final**: `useCreateUnipersonalDecision.mutate()` ejecuta:
1. INSERT `unipersonal_decisions` (status='FIRMADA', decision_type='SOCIO_UNICO'/'ADMINISTRADOR_UNICO', requires_registry derivado del catálogo)
2. INSERT `agreements` (adoption_mode='UNIPERSONAL_SOCIO'/'UNIPERSONAL_ADMIN', status='ADOPTED', body_id=NULL, unipersonal_decision_id link)

**Post-condiciones:**
- 1 row en `unipersonal_decisions` con `status='FIRMADA'`, `entity_id`.
- 1 row en `agreements` con `adoption_mode='UNIPERSONAL_*'`, `status='ADOPTED'`,
  `body_id NULL`, `unipersonal_decision_id` FK.
- Banner success "Decisión registrada y expediente creado".

**Tests existentes (los 3 sub-ciclos):**
- `e2e/30-secretaria-functional-watchdog.spec.ts` (cableado read-only).
- `e2e/32-secretaria-arga-real-destructive.spec.ts` (NO_SESSION ARGA destructive).
- `e2e/38-secretaria-phase-b1v3-adoption-modes.spec.ts` (cloud-real API de los 7 modos).
- `e2e/42-secretaria-phase-b6-adoption-modes-ui-driving.spec.ts` (UI driving sintético opt-in CO+SOL+UNI).

---

## 6. Constraints, gates y guards transversales

### 6.1 RBAC + capability_matrix

`src/hooks/useCurrentUser.ts` retorna `primaryRole` desde `rbac_user_roles`
(fallback `'SECRETARIO'`).

`capability_matrix` (15 rows seed F1, 5 roles × 3 acciones):

| Rol | SNAPSHOT | VOTE | CERTIFICATION |
|---|---|---|---|
| SECRETARIO | ✓ | ✓ | ✓ |
| ADMIN_TENANT | ✓ | ✓ | ✓ |
| COMPLIANCE | ✓ | ✗ | ✗ |
| CONSEJERO | ✗ | ✓ | ✗ |
| AUDITOR | ✗ | ✗ | ✗ |

`useHasCapability(role, action)` consulta sin fetch adicional.

### 6.2 SoD (Separation of Duties)

`SodGuard` component bloquea (BLOCK) o advierte (WARN) ante toxic pairs:
- SECRETARIO + CONSEJERO mismo persona → WARN
- AUDITOR + cualquier rol operativo → BLOCK

### 6.3 Demo-readiness

`useEntityDemoReadiness(entityId)` clasifica entity en:
- `complete`: todos los criterios OK
- `partial`: al menos 1 criterio falta (no bloqueante)
- `reference_only`: falta uno de los hard reasons → BLOQUEA flujos
  (steppers usan `readinessBlocked = readiness.status === 'reference_only'`)

Hard reasons (bloquean):
- `no_cap_table`: 0 capital_holdings activos
- `no_governing_body`: 0 governing_bodies
- `no_active_positions`: 0 condiciones_persona VIGENTE
- `no_authority_evidence`: 0 authority_evidence VIGENTE

Soft reasons (no bloquean, advierten):
- `cap_table_not_100`: |Σ porcentaje_capital - 100| > 0.05
- `no_compatible_templates`: 0 plantillas ACTIVA con materia_acuerdo en agreements
- `no_census`: meetings sin censo_snapshot

### 6.4 RLS (Row-Level Security)

Todas las tablas core tienen policy `tenant_isolation` con
`USING (tenant_id = current_setting('app.tenant_id')::uuid)` o equivalente.
Service role bypass disponible vía `fn_secretaria_is_service_role()` para
tests destructive opt-in.

### 6.5 CHECK constraints clave

| Constraint | Tabla | Regla |
|---|---|---|
| `agreements_adoption_mode_check` | agreements | adoption_mode IN (7 valores §3.1) |
| `agreements_matter_class_check` | agreements | matter_class IN ('ORDINARIA','ESTATUTARIA','ESTRUCTURAL') |
| `chk_condicion_body_coherente` | condiciones_persona | ADMIN_*/SOCIO/ADMIN_PJ ⇒ body_id NULL; CONSEJERO/PRESIDENTE/SECRETARIO ⇒ body_id NOT NULL |
| `meetings_status_check` | meetings | status IN ('DRAFT','CONVOCADA','OPEN','CELEBRADA','CANCELADA') |
| `persons_person_type_check` | persons | person_type IN ('PF','PJ') |

### 6.6 FK no-CASCADE (relevantes para cleanup)

| FK | Implicación |
|---|---|
| `meeting_votes.attendee_id → meeting_attendees.id` | Antes de DELETE attendees, purgar votes. |
| `certifications.minute_id → minutes.id` | Antes de DELETE minute, borrar certifications referenciando. |
| `agreements.unipersonal_decision_id → unipersonal_decisions.id` | Antes de DELETE decision, borrar agreement referenciando. |
| `agreements.parent_meeting_id → meetings.id` | Antes de DELETE meeting, borrar agreements referenciando (en patrón watchdog). |

### 6.7 WORM trail (audit_log)

Trigger `fn_audit_worm` crea hash chain SHA-512 (cada row `hash_sha512`
incluye el `prev_hash`). `fn_verify_audit_chain` valida integridad.

DELETE en `audit_log` está bloqueado por trigger BEFORE DELETE → entries
de tipo `CERT_EMITIDA` quedan permanentemente en el trail (intencional).

---

## 7. Patrones operativos relevantes

### 7.1 Marker scheme tests destructive (Phase B)

| Carril | tax_id PJ | tax_id PF | runId |
|---|---|---|---|
| B4 | `Z-PB-<6hex>` | `Y-PB-<6hex>-{n}` | `PB-YYYYMMDD-HHMMSS-<6hex>-B4` |
| B5 | `Z-CV-<6hex>` | `Y-CV-<6hex>-{n,S}` | `CV-...-<6hex>-B5` |
| B6 | `Z-AS-<6hex>` | `Y-AS-<6hex>-{A0..A3,S}` | `AS-...-<6hex>-B6` |
| B7 | `Z-NS-<6hex>` | (no PFs en B7) | `NS-...-<6hex>-B7` |

Convención: `entities.legal_name LIKE 'PHASE-B<n>-<MARKER>-<runId>%'`.

### 7.2 Cleanup destructive (orden FK-safe)

```
1. certifications (FK → minutes)
2. rule_evaluation_results (FK → meetings)
3. minutes (FK → meetings)
4. meeting_resolutions (FK → meetings)
5. agreements (FK → meetings via parent_meeting_id, FK → unipersonal_decisions)
6. unipersonal_decisions (FK referenced by agreements)
7. meeting_votes (FK → meeting_attendees)
8. meeting_attendees (FK → meetings)
9. meetings
10. authority_evidence (trigger-creado)
11. condiciones_persona
12. capital_holdings
13. share_classes
14. entity_capital_profile
15. governing_bodies
16. entities
17. persons (PJ + PFs)
```

audit_log NUNCA se borra (WORM intencional).

### 7.3 Pre-cleanup defensivo idempotente

Cada spec destructive opt-in implementa `cleanLeftover<Phase>Residue()` que
ejecuta en `beforeAll` ANTES de crear la fixture. Detecta y purga residuos
de runs anteriores fallidos. Permite re-runs back-to-back limpios.

### 7.4 Materia-class filter

`src/lib/secretaria/matter-class.ts`:
- `AGREEMENT_COMPATIBLE_MATTER_CLASSES = ['ORDINARIA','ESTATUTARIA','ESTRUCTURAL']`
- `filterAgreementCompatibleMaterias(rows)` filtra ESPECIAL.

`useMateriaCatalog` aplica el filtro en hook → DecisionUnipersonalStepper
nunca expone PACTO_PARASOCIAL/EXCLUSION/SEPARACION_SOCIO.

### 7.5 RPC contract surface

| RPC | Tabla output | SECURITY | Role guard | Idempotente |
|---|---|---|---|---|
| `fn_save_meeting_resolutions` | meeting_resolutions + meeting_votes + agreements + rule_evaluation_results | DEFINER | SECRETARIO/ADMIN_TENANT | ✓ (UNIQUE indexes) |
| `fn_generar_acta` | minutes | DEFINER | (no role guard explícito) | ✓ (gate_hash basado en snapshot) |
| `fn_generar_certificacion` | certifications | DEFINER | (no role guard explícito) | ✓ (UNIQUE composite) |
| `fn_firmar_certificacion` | certifications UPDATE | DEFINER | — | ✗ (idempotencia depende de gate_hash check) |
| `fn_emitir_certificacion` | audit_log INSERT | DEFINER | — | ✗ (cada llamada crea audit row) |
| `fn_secretaria_assert_role_allowed` | (helper, raises EXCEPTION si no autorizado) | DEFINER | — | — |

---

## 8. Mapa cobertura → tests existentes

### 8.1 Cobertura actual (post-Phase B)

| Ciclo | Read-only smoke | Cloud-real API destructive | UI driving destructive |
|---|---|---|---|
| **Alta sociedad** (5.1) | e2e/34, e2e/35 (rollback) | — | e2e/43 (B7) |
| **Convocatoria** (5.2) | e2e/04 | — | e2e/41 (B5), e2e/18 (golden ARGA) |
| **Reunión + acta** (5.3) | e2e/05, e2e/12 | e2e/39 (B3 RPC) | e2e/40 v0+v1 (B4), e2e/18 |
| **Certificación QTSP** (5.4) | e2e/14 | e2e/14 (legacy) | e2e/40 v2 (B4) |
| **CO_APROBACION** (5.5.1) | e2e/30 (cableado) | e2e/38 (B1v3) | e2e/42 B6.1 |
| **SOLIDARIO** (5.5.2) | e2e/30 (cableado) | e2e/38 (B1v3) | e2e/42 B6.2 |
| **UNIPERSONAL** (5.5.3) | — | e2e/38 (B1v3) | e2e/42 B6.3 |
| **NO_SESSION** (3.1) | e2e/30 (cableado) | e2e/32 (ARGA destructive), e2e/38 | — (gap) |

### 8.2 Tests unitarios y contract existentes

- Motor V2: `src/lib/rules-engine/__tests__/` (votacion-engine, no-session,
  jerarquia-normativa, bordes, meeting-adoption-snapshot, etc.).
- Schema guards: `src/test/schema/` (canonical-model, canonical-triggers,
  RPCs, secretaria-p0-meeting-resolutions-rpc, rpcs-acta-cert).
- Helpers: `src/lib/secretaria/__tests__/` (matter-class, agreement-360,
  body-labels, certification-snapshot, capa3-fields, etc.).

Total: 1039 unit/integration pass / 66 skip / 0 fail.

### 8.3 Áreas no cubiertas (gaps explícitos)

- **TramitadorStepper** (5 pasos registro notarial/registral): sólo `e2e/06`
  smoke. Sin cloud-real ni UI driving destructive sintético.
- **GenerarDocumentoStepper** (DOCX templates + QTSP archival): sólo `e2e/14`
  smoke. Sin UI driving sintético.
- **ExpedienteAcuerdo 360** (timeline 8 estados): solo lectura en `e2e/40` v2
  + watchdog. Falta UI driving que ejercite las transiciones explícitas
  (DRAFT→PROPOSED→ADOPTED→CERTIFIED→INSTRUMENTED→FILED→REGISTERED→PUBLISHED).
- **NO_SESSION UI driving sintético** (no ARGA): gap pequeño — `e2e/32` cubre
  ARGA destructive pero no hay equivalente sintético.
- **AnadirSocioStepper / TransmisionStepper / DesignarAdminStepper**: cap
  table mutations + cambios admin. Sin cobertura UI driving destructive.
- **PersonaNuevaStepper**: alta de personas standalone. Sin cobertura
  destructive.
- **Multi-tenant boundary tests**: no se valida explícitamente que un tenant
  no puede leer/modificar datos de otro tenant.
- **Convocatoria UNIVERSAL** (junta universal art. 178 LSC): el ConvocatoriasStepper
  permite tipoConvocatoria='UNIVERSAL' pero no hay test UI driving específico.
- **Bordes no computables avanzados**: cotizadas + operación vinculada,
  voto calidad presidente, representación PJ_PERMANENTE — cubiertos por motor
  V2 unit tests pero no por UI driving.

---

## 9. Sugerencias para batería de pruebas

### 9.1 Niveles de cobertura

1. **Unit / Contract** (rápidos, deterministas, sin Cloud):
   - Motor V2 gates (cada uno con su matriz de inputs).
   - Helpers (matter-class, body-labels, certification-snapshot).
   - Schema guards (probe RPC existence, columns, CHECK constraints).

2. **Integration** (Cloud-real, opt-in, fixture sintética sin UI):
   - RPC paths: `fn_save_meeting_resolutions`, `fn_generar_acta`,
     `fn_generar_certificacion`, `fn_firmar_certificacion`,
     `fn_emitir_certificacion`.
   - Audit log integrity (hash chain).
   - RLS tenant isolation.

3. **UI driving destructive opt-in** (Cloud-real + Playwright, fixture sintética):
   - Steppers end-to-end con verificación Cloud post-run.
   - Pre-cleanup + post-cleanup defensivos.

4. **Smoke / Read-only**:
   - Renderizado de páginas, navegación, redirects.
   - Sin mutaciones de estado.

### 9.2 Matriz de casos por ciclo

Para cada uno de los 5 ciclos básicos (5.1-5.5), una batería razonable
debería cubrir:

- **Happy path**: inputs válidos, todos los gates motor V2 OK → status='ADOPTED' / estado='EMITIDA'.
- **Gate guards**: inputs que disparan cada blocking_issue de motor V2 → status='DRAFT' o error.
- **Constraint violations**: inputs que violan CHECK SQL (e.g., adoption_mode inválido, matter_class ESPECIAL) → HTTP 400.
- **RBAC/capability**: usuario sin permiso → button hidden o action blocked.
- **Demo-readiness**: entity con hard reason → readinessBlocked → stepper bloqueado.
- **FK constraint**: cleanup ordering errors (validar que el orden propuesto en §7.2 funciona).
- **Idempotencia**: ejecutar happy path 2 veces sobre la misma fixture → no duplicados.
- **Multi-tenant**: tenant A no puede leer datos de tenant B.

### 9.3 Prioridad pragmática

Por ROI demo-realista:
1. **P0** — happy paths de los 5 ciclos básicos en UI driving destructive (ya cubierto por Phase B).
2. **P1** — gaps explícitos §8.3: TramitadorStepper, ExpedienteAcuerdo 360 timeline, NO_SESSION sintético.
3. **P2** — gate guards motor V2 (cada blocking_issue con UI driving que lo dispare).
4. **P3** — multi-tenant boundary, idempotencia bajo carga.
5. **P4** — accessibility, responsive, performance (Lighthouse).

### 9.4 Anti-patterns a evitar

- **NO** mockear motor V2 en tests UI driving — el contrato real es la
  evaluación efectiva con datos sintéticos.
- **NO** usar tenant fijo `00000000-...-0001` en tests multi-tenant —
  crear fixtures con tenants efímeros.
- **NO** asumir que pre-existing data de otros runs limpia — siempre
  pre-cleanup defensivo idempotente.
- **NO** hacer cleanup con cascading FK errors silenciosos — verificar
  explícitamente cada DELETE.
- **NO** dejar fixtures con marcadores reutilizables entre carriles
  (e.g., `Z-PB-` está reservado para Phase B4).

### 9.5 Métricas sugeridas para CI gate

- **Tests unitarios**: > 1000 pass, < 100 skip, 0 fail.
- **Schema contract**: 100% RPCs probados (existence + signature).
- **UI driving destructive**: 100% de los 5 ciclos básicos pasan en
  `SECRETARIA_E2E_PHASE_B1=1` < 60s total.
- **Cleanup integrity**: 0 residuos PB en Cloud post-run.
- **Lint**: 0 errores, < 30 warnings conocidos.
- **Typecheck**: 0 errores con `tsc -b` (no `--noEmit`).

---

## 10. Referencias internas

- ADR migración 000057: `docs/superpowers/plans/2026-05-09-adr-000057-extend-adoption-mode.md`
- Plan filtro ESPECIAL: `docs/superpowers/plans/2026-05-09-matter-class-especial-filter.md`
- Spec motor LSC: `docs/superpowers/specs/2026-04-19-motor-reglas-lsc-secretaria-design.md`
- Decisiones legales motor LSC: `docs/superpowers/specs/2026-04-19-decisiones-legales-motor-lsc-resueltas.md`
- Spec gestión societaria MVP: `docs/superpowers/specs/2026-04-21-gestion-societaria-mvp-design.md`
- Cross-module coherence: `docs/superpowers/specs/2026-04-19-cross-module-coherence-v1-v2-v3.md`
- Pipeline document generation: `docs/superpowers/specs/2026-04-19-document-generation-pipeline-design.md`
- Certificación + autoridad: `docs/superpowers/specs/2026-04-21-certificacion-autoridad-design.md`

## 11. Glosario operativo

- **Tenant**: instancia multi-cliente. Demo único tenant `00000000-...-0001`.
- **Entity**: sociedad (SA/SL/SAU/SLU). Owner es una `persons` PJ.
- **Body**: órgano social (Junta General, CdA, Comisión Delegada).
- **Condicion**: cargo de persona en sociedad/órgano (CONSEJERO, ADMIN_SOLIDARIO, SOCIO, etc.).
- **Holding**: posición de capital en libro de socios.
- **Convocatoria**: aviso formal de reunión con orden del día.
- **Meeting**: sesión societaria ejecutada.
- **Minute**: acta generada con hash + censo snapshot.
- **Certification**: certificación QTSP de acuerdos firmada (QES) y emitida (audit).
- **Agreement**: agregado raíz de cualquier acuerdo societario adoptado.
- **No_session_resolution**: votación distribuida del CdA sin sesión.
- **Unipersonal_decision**: decisión de socio único o admin único.
- **Compliance_snapshot**: JSONB del motor V2 frozen al pasar agreement a ADOPTED.
- **Gate_hash**: SHA-256 anchoring entre snapshot censo + resultado motor (cert).
- **WORM**: Write-Once-Read-Many. audit_log es WORM (no DELETE).
- **QTSP**: Qualified Trust Service Provider (EAD Trust en este caso).
- **QES**: Qualified Electronic Signature.
- **TSQ**: Time-Stamp Query (timestamp cualificado).
- **Demo-readiness**: clasificación de entity para demo (complete/partial/reference_only).
- **Capability**: permiso rol×acción del RBAC interno (capability_matrix).
- **SoD**: Separation of Duties — toxic pairs entre roles.
- **Pre-cleanup defensivo**: helper idempotente que purga residuos antes de fixture.
- **Phase B**: línea base estable post commit `878a7ab` (5 ciclos básicos UI driving destructive).
