# Refactor total del módulo AIMS + cuestionario guiado de calificación — plan de ejecución

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** dejar el módulo AI Governance con una frontera legacy/backbone decidida y ejecutada tabla por tabla, un solo criterio por decisión en módulos hoja, pantallas de ≤ 400 líneas, un vocabulario único, y el cuestionario guiado de calificación regulatoria del equipo legal como primer camino de escritura real del backbone, con huella de servidor, supersedencia e historial.

**Architecture:** el inventario sigue en `ai_systems` (decisión del 2026-09-07). El backbone `aims_*` sólo conserva las tablas con un camino de escritura desde una pantalla; las demás se declaran esquema muerto y se les retira hook, superficie y test. Todo criterio (derivación del cuestionario, perfil de aplicabilidad, conformidad, check vigente, relojes, vocabulario) vive en `src/lib/aims/*.ts` como módulo hoja; las pantallas sólo pintan y se descomponen por paso y por bloque en `src/components/ai-governance/**`. La clasificación se persiste versionada en `aims_classification_questionnaires` y se completa por RPC que calcula SHA-512 en servidor y sincroniza `ai_systems.regulatory_role` / `risk_level`, que dejan de ser editables por otro camino.

**Tech Stack:** React 18 + TypeScript (relajado), TanStack Query v5, Supabase JS v2 (PostgREST + RPC), Postgres (RLS, triggers, SECURITY DEFINER), bun test.

**Spec:** `docs/superpowers/reviews/2026-09-08-validacion-spec-cuestionario-vs-refactor-aims.md` (validación de la spec v1.1 con las decisiones S-1…S-14) + `docs/superpowers/prompts/2026-09-08-goal-refactor-total-aims.md` (goal). Ledger vivo: `docs/superpowers/plans/2026-09-08-ledger-refactor-aims.md`.

## Global Constraints

- ARGA es pseudónimo: jamás el nombre real del cliente en código, dato, docs ni commits.
- EAD Trust: sólo interposición, mensajería básica y custodia. Ningún claim nuevo de QES, firma, ERDS, envío, entrega ni sello.
- `bun run db:check-target` antes de tocar Supabase. Migraciones forward-only con espejo en `supabase/migrations/`. Nunca `db push` ni `repair`.
- **Toda escritura en `governance_OS` exige autorización expresa del usuario, cambio a cambio.** Las sondas que no deban persistir van en `BEGIN … ROLLBACK`.
- `git add` sólo por rutas explícitas. Nunca commitear `version garrigues/`, `Gobernanza ia/`, `docs/architecture*`, `DOC GRC/para tirar*`, `pkcs11.txt`, `scripts/*platform-architecture*` ni los hunks Archify de `.gitignore` / `README.md` / `package.json`.
- No escribir en `governance_module_events` / `governance_module_links`.
- Cero cambio ARGA en dato. En pantalla: sólo corrección de defecto probado, declarado en el ledger.
- Cero borrado, pisado o duplicado del dato de Garrigues (Harvey `2f877e8c…` y su evaluación `fdcccf9e…`).
- Vocabulario persistido que NO cambia: `risk_level ∈ {Inaceptable, Alto, Limitado, Mínimo}`, `regulatory_role ∈ {PROVEEDOR, RESPONSABLE_DESPLIEGUE, IMPORTADOR, DISTRIBUIDOR, PROVEEDOR_GPAI, PROVEEDOR_POSTERIOR}`.
- Toda migración que cree tabla: `revoke delete, truncate, references, trigger … from authenticated`, `revoke all … from anon`, bloque de verificación que **aborta** con control positivo del instrumento.
- Escrituras sobre tablas sin `tenant_id`: probar pertenencia contra `ai_systems`, acotar con el `.eq` pegado al `.update(`, `if (!data) throw`.
- Gates: `bun test` ≥ 4 320 pass, 151 skip (sin skips nuevos), 0 fail al mergear; `typecheck`, `lint`, `build` limpios. Nunca vitest con service_role.
- Componentes Garrigues: sólo tokens `var(--g-*)` / `var(--status-*)`; nunca colores Tailwind nativos ni hex.
- Ningún fichero de `src/pages/ai-governance/` ni de `src/components/ai-governance/**` por encima de 400 líneas.
- Arnés de mutación en cada gate nuevo: commitear, mutar, ver caer en la aserción exacta, restaurar sólo el fichero mutado, comprobar `git diff --quiet` sobre él.

---

## Estructura de ficheros

```
src/lib/aims/
  vocabulario.ts                       NUEVO  hoja. Estados, severidades, niveles, marcos + etiquetas + opciones de filtro
  cuestionario-calificacion.ts         NUEVO  hoja. Preguntas con ayuda, derivación rol/nivel/marcos/perfil, bloqueos
  perfil-aplicabilidad.ts              MOD    + catalogProfile (importa la hoja)
  rol-regulatorio.ts                   MOD    conserva tipos/etiquetas; retira PREGUNTAS_*, proponerNivel, exigeMotivacionArt63
  readiness.ts                         MOD    retira aimsScreenPostures/aimsReadOnlyHandoffs; etiquetas de estado desde vocabulario
  handoffs.ts                          NUEVO  los 4 handoffs read-only (dato de navegación, no prosa de pantalla)
src/hooks/
  useAimsClasificacion.ts              NUEVO  historial/vigente/iniciar/guardar borrador/completar/registrar sistema
  useAimsFria.ts                       BORRAR (destino b)
  useAimsTechnicalFile.ts              MOD    retira model/dataset/close; añade crear esqueleto, registrar versión, registrar indicador; edita sección tenant-scoped
  useAimsMultiregime.ts                MOD    + useAbrirSubexpedienteRegimen (insert con tenant_id explícito)
  useAiSystems.ts                      MOD    retira useCreateAiSystem (el alta va por RPC)
src/components/ai-governance/
  clasificacion/ClasificacionGuiada.tsx        stepper 4 fases
  clasificacion/PreguntaGuiada.tsx             pregunta Sí/No + panel de ayuda (3 secciones)
  clasificacion/ResultadoProvisional.tsx       sidebar en tiempo real
  clasificacion/HistorialClasificaciones.tsx   versiones con fecha, autor, hash
  sistema/CabeceraSistema.tsx, ClasificacionVigentePanel.tsx, TabExpedienteTecnico.tsx,
          TabEvaluaciones.tsx, TabIncidentes.tsx, TabVigilancia.tsx, EditarSistemaModal.tsx,
          EscaladoSecretariaModal.tsx
  evaluacion/PasoParametros.tsx, PasoMedidas.tsx, ControlesDeMedida.tsx, PasoRevision.tsx,
             PasoResultado.tsx, PerfilAplicabilidadBanner.tsx
  evaluacion-detalle/CabeceraInforme.tsx, ChecklistMedidas.tsx, PlanYNotas.tsx
  dashboard/KpiCards.tsx, ComplianceMonitorPanel.tsx, ReadinessDomains.tsx,
            HandoffAffordances.tsx, PrioridadAhora.tsx, OrganoRector.tsx
  incidente/CabeceraIncidente.tsx, RelojesRegulatorios.tsx, SubexpedientesRegimen.tsx,
            EdicionIncidente.tsx, FormularioIncidente.tsx
src/pages/ai-governance/*.tsx           MOD    ≤ 400 líneas; sólo composición
supabase/migrations/
  20260908120000_aims_cuestionario_calificacion.sql
  20260908130000_ai_aims_revoca_privilegios_heredados.sql
src/test/aims/
  pantallas-acotadas.test.ts            NUEVO  ≤ 400 líneas, con control positivo
  vocabulario-unico.test.ts             NUEVO  arista + comportamiento
  cuestionario-arista.test.ts           NUEVO  los consumidores importan y llaman la hoja
  frontera-backbone.test.ts             NUEVO  ninguna superficie lee/escribe una tabla (b); las (a) tienen escritura
src/test/schema/
  aims-cuestionario-migration-shape.test.ts   NUEVO  forma del SQL ejecutable
  aims-cuestionario-live.test.ts              NUEVO  logins reales, dos direcciones, inmutabilidad (ROJO hasta aplicar la migración)
  garrigues-ia-owner-write.test.ts            MOD    el alta va por fn_aims_registrar_sistema
src/lib/aims/__tests__/
  cuestionario-calificacion.test.ts     NUEVO
  vocabulario.test.ts                   NUEVO
```

## Frontera de las 25 tablas `aims_*` (decisión, ejecutada en las tareas 4, 8, 9, 11)

| Tabla | Filas ARGA/Garr | Destino | Cómo |
|---|---|---|---|
| `aims_classification_questionnaires` (nueva) | — | **(a)** | alta por RPC, reclasificación desde la ficha, historial |
| `aims_evidence_items` | 0/0 | (a) ya | sin cambio |
| `aims_technical_file_sections` | 5/0 | **(a)** | editar sección (hook existente, cableado), iniciar esqueleto anexo IV |
| `aims_system_versions` | 3/0 | **(a)** | registrar versión desde la pestaña del expediente |
| `aims_monitoring_indicators` | 1/0 | **(a)** | registrar indicador desde Vigilancia |
| `aims_incident_regimes` | 0/0 | **(a)** | abrir subexpediente por régimen desde la ficha del incidente (con motivación de aplicabilidad) |
| `aims_fria_*` (7) | 0/0 | **(b)** | retirar hook, pestaña, tipos del contrato de columnas y los tests que sólo los mantenían vivos |
| `aims_model_registry`, `aims_dataset_registry` | 0/0 | (b) | retirar hooks y pestaña «Modelos & Datasets» (siempre vacía) |
| `aims_incident_reports`, `aims_regulatory_clocks`, `aims_incident_evidence_packs`, `aims_evidence_packs`, `aims_change_requests`, `aims_component_inventory`, `aims_control_tests` | 0/0 | (b) | sin código que retirar; esquema muerto declarado en el ledger; escritura revocada a `authenticated` |
| `aims_requirement_catalog` (4/0), `aims_requirement_checks` (4/0), `aims_control_catalog` (2/0), `aims_post_market_plans` (1/0) | | (b) | 0 lectores en `src/`; ARGA no las ve en ninguna pantalla (medido); dato intacto; escritura revocada |

---

### Task 1: vocabulario único (hoja)

**Files:**
- Create: `src/lib/aims/vocabulario.ts`
- Create: `src/lib/aims/__tests__/vocabulario.test.ts`
- Modify: `src/lib/aims/readiness.ts` (`normalizeAimsStatus`, `systemStatusLabel`, `systemStatusChipClass`, `isMaterialSeverity` pasan a importar/re-exportar desde la hoja)
- Modify: `src/pages/ai-governance/Sistemas.tsx`, `Evaluaciones.tsx`, `Incidentes.tsx`, `IncidenteNuevo.tsx`, `SistemaNuevo.tsx`, `Dashboard.tsx`, `SistemaDetalle.tsx` (listas locales → `opcionesFiltro(...)` / `etiqueta(...)`)
- Create: `src/test/aims/vocabulario-unico.test.ts`

**Interfaces (produce):**
```ts
export const NIVELES_RIESGO = ["Inaceptable", "Alto", "Limitado", "Mínimo"] as const;
export type NivelRiesgo = (typeof NIVELES_RIESGO)[number];
export const ESTADOS_SISTEMA = ["ACTIVO", "EN_EVALUACION", "RETIRADO"] as const;
export const ESTADOS_EVALUACION = ["CONFORME", "CON_GAPS", "BORRADOR"] as const;      // los que ESCRIBE evaluacion-payload
export const ESTADOS_EVALUACION_LEGADO = ["APROBADO", "EN_REVISION"] as const;         // sólo lectura, dato ARGA
export const SEVERIDADES_INCIDENTE = ["CRITICO", "ALTO", "MEDIO", "BAJO"] as const;
export const ESTADOS_INCIDENTE = ["ABIERTO", "EN_INVESTIGACION", "CERRADO"] as const;
export const MARCOS_EVALUACION = ["EU_AI_ACT", "ISO_42001"] as const;
export type Dominio = "nivel" | "estadoSistema" | "estadoEvaluacion" | "severidad" | "estadoIncidente" | "marco";
export function etiqueta(dominio: Dominio, valor: string | null | undefined): string;   // fallback: el literal crudo
export function opcionesFiltro(dominio: Dominio, extra?: string[]): { value: string; label: string }[]; // ["Todos", …]
export function normalizeAimsStatus(s: string | null | undefined): string;            // movido desde readiness
export function chipClaseEstadoSistema(s: string | null | undefined): string;         // movido (systemStatusChipClass)
export function isMaterialSeverity(s: string | null | undefined): boolean;             // movido
```

- [ ] Escribir `vocabulario.test.ts`: `etiqueta("severidad","CRITICO") === "Crítico"`, valor desconocido devuelve el literal, `opcionesFiltro("estadoSistema", ["Conforme"])` = Todos + 3 + extra sin duplicar, `normalizeAimsStatus("En revisión") === "EN_REVISION"`.
- [ ] Ejecutar → falla (módulo no existe). Implementar. Ejecutar → pasa.
- [ ] Mover las funciones de `readiness.ts` a la hoja y re-exportar desde `readiness.ts` (los tests existentes `vocabulario-escritura-lectura`, `readiness.test` siguen importando de `readiness`).
- [ ] Sustituir en las 7 pantallas las listas locales por `opcionesFiltro`/`etiqueta`. `Sistemas.tsx` conserva la derivación de estados extra presentes en el dato (pasa como `extra`).
- [ ] `vocabulario-unico.test.ts`: (1) **comportamiento**: `estadosQueElProductoEscribe()` (importar `buildEvaluationPayload`) ⊂ `ESTADOS_EVALUACION`; los `<option value=…>` de `IncidenteNuevo.tsx` para severidad/estado ⊂ vocabulario; los de `SistemaNuevo.tsx` para estado ⊂ `ESTADOS_SISTEMA`. (2) **arista**: cada una de las 7 pantallas importa `@/lib/aims/vocabulario` y llama `opcionesFiltro(` o `etiqueta(`. (3) **capa débil declarada**: ninguna pantalla declara `const (SEVERITY|STATUS|RISK)_?(OPTIONS|LEVELS|LABEL)` ni `INCIDENT_STATUS_LABEL`. Control positivo: la lista de pantallas tiene 7 entradas y todas existen.
- [ ] `bun test src/lib/aims src/test/aims` verde; `bun run typecheck`.
- [ ] Mutación: en `Incidentes.tsx` volver a declarar `SEVERITY_OPTIONS` local → cae la aserción (3); restaurar. Commit `refactor(aims): vocabulario único en módulo hoja`.

### Task 2: motor puro del cuestionario (hoja)

**Files:**
- Create: `src/lib/aims/cuestionario-calificacion.ts`
- Create: `src/lib/aims/__tests__/cuestionario-calificacion.test.ts`
- Modify: `src/lib/aims/perfil-aplicabilidad.ts` (+ `catalogProfile` en `PerfilAplicabilidad`, calculado con `perfilCatalogo`)
- Modify: `src/lib/aims/rol-regulatorio.ts` (retirar `PREGUNTAS_ROL`, `PREGUNTAS_CLASIFICACION`, `RespuestasClasificacion`, `PropuestaClasificacion`, `clasificacionCompleta`, `proponerNivel`, `exigeMotivacionArt63`, `rolQueImponeElArt25`, `PerfilRegulatorio`; conservar `RolRegulatorio`, `NivelRiesgo`, `ROLES_REGULATORIOS`, `ETIQUETA_ROL`)

**Interfaces (produce):**
```ts
export const CUESTIONARIO_VERSION = "1.1";
export type IdPregunta = "Q1_1" | "Q1_2" | "Q1_3" | "Q1_4" | "Q2_1" | "Q2_2" | "Q2_3" | "Q2_4" | "Q2_5";
export type Respuestas = Partial<Record<IdPregunta, boolean>>;
export type Ayuda = { queSignifica: string; ejemplos: string[]; comoSaberlo: string };
export type PreguntaGuiada = {
  id: IdPregunta; fase: 1 | 2; titulo: string; articulo: string; ayuda: Ayuda;
  siImplica: string; noImplica: string;
  /** Q2_3 sólo si Q2_2 === true */
  visibleSi?: (r: Respuestas) => boolean;
};
export const PREGUNTAS: PreguntaGuiada[];                           // Q1.1–Q1.4, Q2.1–Q2.5 con el texto literal de la spec
export type RolDerivado = "PROVEEDOR" | "RESPONSABLE_DESPLIEGUE";
export type NivelDerivado = "Inaceptable" | "Alto" | "Limitado" | "Mínimo";
export type PerfilCatalogo = "PROFILE_A" | "PROFILE_B" | "PROFILE_C";
export const ETIQUETA_PERFIL: Record<PerfilCatalogo, string>;       // «A — alto riesgo, proveedor», …
export type MarcoNormativo = { code: string; norma: "RIA" | "RGPD" | "DEONTOLOGIA"; articulos: string; titulo: string; nota?: string };
export type ResultadoCuestionario = {
  rol: RolDerivado | null; motivoRol: string;
  nivel: NivelDerivado | null; motivoNivel: string;
  gpai: boolean; exigeArt63: boolean; bloqueado: boolean;         // bloqueado ⇔ Q2_1 === true
  marcos: MarcoNormativo[]; perfil: PerfilCatalogo | null;
  pendientes: IdPregunta[];                                        // visibles sin responder
};
export function preguntasVisibles(r: Respuestas): PreguntaGuiada[];
export function derivarRol(r: Respuestas): { rol: RolDerivado; motivo: string } | null;   // null si falta Q1_1..Q1_3
export function derivarNivel(r: Respuestas): { nivel: NivelDerivado; motivo: string; exigeArt63: boolean } | null;
export function derivarMarcos(rol: RolDerivado | null, nivel: NivelDerivado | null, gpai: boolean): MarcoNormativo[];
export function perfilCatalogo(rol: string | null | undefined, nivel: string | null | undefined): PerfilCatalogo | null;
export function resultadoProvisional(r: Respuestas): ResultadoCuestionario;
export function bloqueosParaConfirmar(r: Respuestas, justificacionArt63: string, tieneOwner: boolean): { bloqueos: string[]; avisos: string[] };
```
Reglas (de la spec, §2.2–2.4 y §5.2, con las decisiones S-1…S-9):
- rol: PROVEEDOR si Q1_1 ∨ Q1_2 ∨ Q1_3; si las tres son `false` → RESPONSABLE_DESPLIEGUE. Q1_4 no determina (motivo lo cita). Con alguna de Q1_1..Q1_3 sin responder → null.
- nivel: Q2_1 → Inaceptable + bloqueado. Q2_2 ∧ ¬Q2_3 → Alto. Q2_2 ∧ Q2_3 → sigue el árbol (Q2_4 → Limitado, si no Mínimo) con `exigeArt63 = true`. ¬Q2_2 ∧ Q2_4 → Limitado. Resto → Mínimo. Q2_5 → `gpai`.
- perfil: Inaceptable → null; Alto ∧ PROVEEDOR → A; Alto ∧ RESPONSABLE_DESPLIEGUE → B; Limitado/Mínimo → C. `perfilCatalogo` acepta también los otros cuatro roles persistidos (IMPORTADOR, DISTRIBUIDOR → como despliegue; PROVEEDOR_GPAI, PROVEEDOR_POSTERIOR → como proveedor).
- marcos (numeración final; nota conserva la cita de la spec cuando cambia): siempre `RIA art. 4`; RESPONSABLE_DESPLIEGUE ∧ Alto → `RIA arts. 26`, `RIA art. 27 (sólo si concurre un supuesto del 27.1)`, `RGPD arts. 28 y 35`; PROVEEDOR ∧ Alto → `RIA arts. 9–15`, `RIA arts. 17 y 47`, `RIA arts. 72 y 73`; Limitado → `RIA art. 50`; Mínimo → `RIA art. 95 (la spec cita art. 69, numeración de borrador)`; gpai → `RIA arts. 51–56 (la spec cita 51–55, cap. V-A)`; transversal `RGPD` y `Deontología profesional`.
- bloqueos: preguntas visibles sin responder; Q2_1 (bloqueado); `exigeArt63 ∧ justificación < 40 caracteres`. Avisos: sin owner («Este sistema no tiene propietario asignado»).

- [ ] Tests primero (≥ 14 casos): rol proveedor por cada Q1; despliegue con las tres a false; null con una sin responder; Q1_4 no cambia el rol; prohibido bloquea; anexo III sin excepción = Alto; anexo III con excepción baja a Limitado/Mínimo con `exigeArt63`; transparencia = Limitado; nada = Mínimo; gpai independiente; perfiles A/B/C y null; marcos por combinación (incluida la nota de numeración); `preguntasVisibles` oculta Q2_3 sin Q2_2; `bloqueosParaConfirmar` exige justificación ≥ 40 y pendientes; `perfilCatalogo("IMPORTADOR","Limitado") === "PROFILE_C"`.
- [ ] Ejecutar → falla. Implementar. Ejecutar → pasa.
- [ ] `perfil-aplicabilidad.ts`: `perfilAplicable` devuelve además `catalogProfile: perfilCatalogo(rol, nivel)`; perfil B (alto + despliegue) cae al catálogo completo con `motivo` que lo dice («no hay catálogo validado para el responsable del despliegue de alto riesgo»). Test en `perfil-aplicabilidad.test.ts`.
- [ ] Retirar de `rol-regulatorio.ts` lo que la hoja sustituye; `bun run typecheck` señala los consumidores (`SistemaNuevo`) que se reescriben en la Task 7.
- [ ] Commit `feat(aims): motor puro del cuestionario guiado de calificación`.

### Task 3: migración del cuestionario (repo; aplicar sólo con autorización)

**Files:**
- Create: `supabase/migrations/20260908120000_aims_cuestionario_calificacion.sql`
- Create: `src/test/schema/aims-cuestionario-migration-shape.test.ts`

Contenido de la migración (todo en un fichero, orden exacto):
1. Tabla `public.aims_classification_questionnaires` (columnas de la spec §3.1 con S-3/S-12/S-13): `id`, `tenant_id uuid not null`, `system_id uuid not null references public.ai_systems(id) on delete cascade` (el borrado del sistema —que el producto no ofrece— arrastra su historial; sin cascade, un sistema con cuestionario sería imborrable y las sondas dejarían residuo), `version int not null default 1`, `status text not null default 'DRAFT' check (status in ('DRAFT','COMPLETED','SUPERSEDED'))`, `questionnaire_version text not null`, `phase1_responses jsonb not null default '{}'`, `phase2_responses jsonb not null default '{}'`, `phase2_art63_justification text`, `computed_role text` CHECK in (los 6 del CHECK de `ai_systems`), `computed_risk_level text` CHECK in ('Inaceptable','Alto','Limitado','Mínimo'), `gpai_dependency boolean not null default false`, `applicable_frameworks jsonb not null default '[]'`, `catalog_profile text` CHECK in ('PROFILE_A','PROFILE_B','PROFILE_C'), `completed_by uuid`, `completed_at timestamptz`, `content_hash text`, `created_by uuid default auth.uid()`, `created_at`, `updated_at`; `unique (system_id, version)`.
2. Índices: `ux_aims_classification_completed_per_system (system_id) where status='COMPLETED'`; `ux_aims_classification_draft_per_system (system_id) where status='DRAFT'`; `ix_aims_classification_tenant_system (tenant_id, system_id)`.
3. RLS: enable; `drop policy if exists` + `create policy … for select to authenticated using (tenant_id = fn_current_tenant_id())`; insert `with check (tenant_id = fn_current_tenant_id() and exists (select 1 from ai_systems s where s.id = system_id and s.tenant_id = fn_current_tenant_id()))`; update `using/with check (tenant_id = fn_current_tenant_id())`. **Sin política de DELETE.**
4. Grants: `revoke all on table … from public, anon; grant select, insert, update on table … to authenticated; revoke delete, truncate, references, trigger on table … from authenticated`.
5. Trigger `fn_aims_cuestionario_inmutable` BEFORE UPDATE: `tenant_id`/`system_id` nunca cambian; si `old.status='SUPERSEDED'` → raise `CUESTIONARIO_SUPERSEDIDO_INMUTABLE` (42501); si `old.status='COMPLETED'` → sólo se admite `new.status='SUPERSEDED'` con `current_setting('aims.clasificacion_rpc', true) = 'on'` y todo lo demás idéntico (comparar `to_jsonb(old) - 'status' - 'updated_at'` con `to_jsonb(new) - …`), si no raise `CUESTIONARIO_COMPLETADO_INMUTABLE`; si `old.status='DRAFT'` y `new.status='COMPLETED'` sin el setting → raise `COMPLETAR_SOLO_POR_RPC`; en DRAFT `new.updated_at := now()`.
6. Trigger sobre `ai_systems`, `fn_ai_systems_clasificacion_solo_por_cuestionario`: BEFORE INSERT: si `coalesce(current_setting('request.jwt.claims', true)::jsonb->>'role','') = 'authenticated'` y el setting no está `on` → raise `ALTA_SOLO_POR_CUESTIONARIO` (42501). BEFORE UPDATE OF `regulatory_role, risk_level`: si cambia cualquiera y el setting no está `on` → raise `CLASIFICACION_SOLO_POR_CUESTIONARIO` (42501). (service_role y `postgres` quedan fuera del gate de INSERT; el de UPDATE aplica a todos.)
7. RPC `public.fn_aims_completar_cuestionario(p_id uuid) returns table (id uuid, version int, content_hash text, completed_at timestamptz)` SECURITY DEFINER, `set search_path = public`: tenant de sesión (42501 si null); `select … for update` de la fila por id **y** tenant (42501 si no); status DRAFT (42501 si no); `computed_risk_level = 'Inaceptable'` → raise `PRACTICA_PROHIBIDA_BLOQUEA`; `computed_role`, `computed_risk_level`, `catalog_profile` no nulos → si no raise `CUESTIONARIO_INCOMPLETO`; si `(phase2_responses->>'Q2_2')::boolean` y nivel ∉ (Alto, Inaceptable) y `length(trim(coalesce(phase2_art63_justification,''))) < 40` → raise `ART63_MOTIVACION_OBLIGATORIA`; `perform set_config('aims.clasificacion_rpc','on',true)`; `update … set status='SUPERSEDED' where system_id = v.system_id and status='COMPLETED'`; `v_version := coalesce(max(version) where system_id,0)+1` (si la fila DRAFT ya tiene versión mayor, se respeta la mayor); `v_completed_at := now(); v_uid := auth.uid()`; canónico `jsonb_build_object('cuestionario_id', id, 'system_id', …, 'version', v_version, 'questionnaire_version', …, 'phase1_responses', …, 'phase2_responses', …, 'phase2_art63_justification', coalesce(…,''), 'computed_role', …, 'computed_risk_level', …, 'gpai_dependency', …, 'applicable_frameworks', …, 'catalog_profile', …, 'completed_by', v_uid, 'completed_at', v_completed_at)::text`; `v_hash := encode(sha512(convert_to(v_canonico,'UTF8')),'hex')`; update fila (status COMPLETED, version, completed_by, completed_at, content_hash, updated_at); `update ai_systems set regulatory_role = computed_role, risk_level = computed_risk_level, regulatory_profile = jsonb_build_object('cuestionario_id', …, 'version', …, 'questionnaire_version', …, 'rol', …, 'nivel', …, 'perfil', …, 'gpai', …, 'marcos', …, 'exige_art63', …, 'completado_en', …, 'completado_por', …, 'content_hash', …) where id = v.system_id and tenant_id = v_tenant`; return.
8. RPC `public.fn_aims_registrar_sistema(p_sistema jsonb, p_cuestionario jsonb) returns uuid` SECURITY DEFINER: tenant de sesión; `set_config on`; `insert into ai_systems (tenant_id, name, system_type, vendor, deployment_date, status, use_case, description, owner_id, aims_reference_code, regulatory_role, risk_level)` con `tenant_id := v_tenant` (**nunca del cliente**), `name` obligatorio (raise `NOMBRE_OBLIGATORIO`), rol/nivel desde `p_cuestionario` (`computed_role`, `computed_risk_level`); insert cuestionario DRAFT con `tenant_id = v_tenant`, `system_id`, `questionnaire_version`, `phase1_responses`, `phase2_responses`, `phase2_art63_justification`, `computed_*`, `gpai_dependency`, `applicable_frameworks`, `catalog_profile`; `perform fn_aims_completar_cuestionario(v_q_id)`; return `v_system_id`. `revoke all on function … from public, anon; grant execute … to authenticated` en las dos.
9. Bloque `do $verificacion$`: tabla con 20 columnas; 3 índices; RLS habilitada; exactamente 3 políticas y ninguna de DELETE; `authenticated` sin DELETE/TRUNCATE/REFERENCES/TRIGGER y `anon` sin nada (contra `information_schema.role_table_grants`); 2 triggers; 2 funciones con `prosecdef`; y **prueba de comportamiento revertida**: dentro del bloque, insertar un cuestionario DRAFT de prueba para un sistema existente del tenant ARGA con `set_config('request.jwt.claims', …)`?? — NO: el bloque no tiene sesión. En su lugar, control positivo del instrumento (`constraint_que_no_existe_jamas` = 0) como en `20260907180000`. La prueba de comportamiento va en el test vivo (Task 13) y en la sonda `BEGIN … ROLLBACK` de esta tarea.

- [ ] Escribir `aims-cuestionario-migration-shape.test.ts` (sobre el SQL sin comentarios): la tabla se crea; `enable row level security`; 3 `create policy` con `to authenticated` y `fn_current_tenant_id()`, ninguna `for delete`, ninguna `or true`/`using (true)`; `revoke … from anon`; `revoke delete, truncate, references, trigger`; 2 `security definer`; `sha512(`; `set_config('aims.clasificacion_rpc'`; `raise exception 'ART63_MOTIVACION_OBLIGATORIA'`; `raise exception 'PRACTICA_PROHIBIDA_BLOQUEA'`; bloque de verificación con `constraint_que_no_existe_jamas`. Control positivo: el fichero tiene > 200 líneas.
- [ ] Ejecutar → falla (fichero no existe). Escribir la migración. Ejecutar → pasa.
- [ ] `bun run db:check-target`. Sonda **revertida** contra Cloud (una sola llamada `execute_sql` con `begin; <migración entera>; <inserción DRAFT para el sistema ARGA 'DocAnalyzer' con set_config de claims de un usuario ARGA>; select fn_aims_completar_cuestionario(...); select content_hash, version, status …; <segundo cuestionario y comprobación de SUPERSEDED>; <update directo de una COMPLETED → esperar excepción capturada en bloque DO>; rollback;`). Registrar en el ledger los resultados (hash de 128 hex, supersedencia, rechazo del UPDATE directo, rechazo del art. 6.3 sin motivación, rechazo del INSERT directo en `ai_systems` como authenticated).
- [ ] Commit `feat(aims): migración del cuestionario guiado (pendiente de aplicar)`.

### Task 4: migración de endurecimiento de privilegios heredados

**Files:**
- Create: `supabase/migrations/20260908130000_ai_aims_revoca_privilegios_heredados.sql`
- Modify: `src/test/schema/aims-cuestionario-migration-shape.test.ts` (segundo `describe` para esta migración)

- [ ] Lista **enumerada** de las 28 tablas (4 `ai_*` + 24 `aims_*` sin `aims_evidence_items`): `revoke all on table … from anon` en las 28; `revoke truncate, references, trigger on table … from authenticated` en las 28; `revoke insert, update, delete on table … from authenticated` en las **20** de destino (b); `revoke execute on function public.fn_aims_close_technical_file(uuid, text, text, text) from authenticated`. Verificación que aborta: `anon` con 0 grants sobre las 28; `authenticated` sin TRUNCATE en ninguna; `authenticated` sin INSERT en las 20; control positivo: `authenticated` conserva SELECT sobre `ai_systems` e INSERT sobre `ai_systems` (= 1).
- [ ] Comprobar que ningún test ni script del repo escribe con `authenticated` en las 20 (grep `from("<tabla>")` en `src/test`, `e2e`, `scripts` — hoy 0 apariciones fuera de los hooks retirados).
- [ ] `aims-column-contract.test.ts` usa la clave anónima para detectar `42703`: con `anon` sin SELECT, una columna inexistente sigue devolviendo `42703` (el análisis del `select` precede al chequeo de privilegios) y una existente devuelve `42501`, que la sonda ya trata como «existe». Dejar constancia en el test (comentario) y comprobarlo en la sonda revertida de la Task 3 (`set role anon; select columna_inexistente from aims_system_versions` → 42703).
- [ ] Sonda revertida contra Cloud de la migración entera. Commit `chore(aims): revoca a anon y los privilegios heredados del backbone (pendiente de aplicar)`.

### Task 5: hook `useAimsClasificacion`

**Files:**
- Create: `src/hooks/useAimsClasificacion.ts`
- Modify: `src/hooks/__tests__/useAimsTenant.test.ts` (`HOOKS_ESPERADOS` += el nuevo; −`useAimsFria.ts` cuando se borre en Task 8)

**Interfaces (produce):**
```ts
export interface CuestionarioCalificacion { id; tenant_id; system_id; version; status: "DRAFT"|"COMPLETED"|"SUPERSEDED"; questionnaire_version; phase1_responses: Respuestas; phase2_responses: Respuestas; phase2_art63_justification: string|null; computed_role: string|null; computed_risk_level: string|null; gpai_dependency: boolean; applicable_frameworks: MarcoNormativo[]; catalog_profile: string|null; completed_by: string|null; completed_at: string|null; content_hash: string|null; created_at; updated_at }
export function useCuestionariosDeSistema(systemId?: string)   // queryKey ["aims_classification_questionnaires", tenantId, systemId]; skipToken sin tenant; order version desc
export function useCuestionarioVigente(systemId?: string)      // el COMPLETED o null (derivado del anterior, sin segunda consulta)
export function useBorradorCuestionario(systemId?: string)     // el DRAFT o null
export function useIniciarCuestionario()                       // insert { tenant_id, system_id, questionnaire_version: CUESTIONARIO_VERSION } .select().single()
export function useGuardarBorradorCuestionario()               // update(campos).eq("tenant_id", tenantId).eq("id", id).select().maybeSingle(); if (!data) throw
export function useCompletarCuestionario()                     // rpc("fn_aims_completar_cuestionario", { p_id }); invalida cuestionarios y ai_systems
export function useRegistrarSistemaClasificado()               // rpc("fn_aims_registrar_sistema", { p_sistema, p_cuestionario }) → uuid; invalida ai_systems
```
- [ ] Implementar. `bun test src/hooks/__tests__/useAimsTenant.test.ts` (glob lo descubre; ancla actualizada). Commit.

### Task 6: componentes del cuestionario

**Files:** `src/components/ai-governance/clasificacion/{ClasificacionGuiada,PreguntaGuiada,ResultadoProvisional,HistorialClasificaciones}.tsx`

- `ClasificacionGuiada({ modo: "alta" | "reclasificacion", respuestasIniciales?, justificacionInicial?, tieneOwner, onCambio?(respuestas, justificacion), onConfirmar(resultado, respuestas, justificacion) })`: stepper de 4 fases (cabecera con 4 pasos; activo/completado/pendiente con tokens `--g-*`), panel central con `PreguntaGuiada` por pregunta visible de la fase, `ResultadoProvisional` a la derecha (recalculado con `resultadoProvisional` en cada respuesta), banner de bloqueo `role="alert"` si `bloqueado`, aviso amarillo art. 6.3 + textarea obligatoria si `exigeArt63`, fase 3 automática (lista de marcos con `articulos` y `nota`), fase 4 resumen (rol, nivel, perfil, marcos, aviso 6.3, aviso sin owner) + «Volver» (deshabilitado en fase 1) + «Confirmar clasificación» (deshabilitado si `bloqueosParaConfirmar(...).bloqueos.length > 0`, con la lista de bloqueos visible). ≤ 300 líneas.
- `PreguntaGuiada({ pregunta, valor, onChange })`: título con icono de ayuda (`aria-expanded`), botones Sí/No con `aria-pressed`, panel colapsable con «¿Qué significa esto?», «Ejemplos» y «¿Cómo saberlo?» desde `pregunta.ayuda`, enlace «Necesito ayuda con esta pregunta».
- `ResultadoProvisional({ resultado })`: rol probable, nivel probable, perfil probable, GPAI; «Posible proveedor» al marcar Q1.1 (CA-6).
- `HistorialClasificaciones({ cuestionarios })`: tabla versión / estado (`etiqueta`) / fecha / autor (uuid abreviado; el módulo no resuelve a nombre) / hash (16 primeros hex + copiar) / rol / nivel / perfil.
- [ ] Test de contrato de superficie en `src/test/aims/cuestionario-arista.test.ts`: `ClasificacionGuiada` importa y llama `resultadoProvisional(` y `bloqueosParaConfirmar(`; no declara ningún array de preguntas propio (`titulo:` sólo en la hoja); `PreguntaGuiada` renderiza las tres secciones de ayuda desde `pregunta.ayuda` (no literales). Control positivo: los 4 ficheros existen.
- [ ] Commit.

### Task 7: `SistemaNuevo` — el alta se clasifica por el cuestionario

**Files:** Modify `src/pages/ai-governance/SistemaNuevo.tsx`; Modify `src/hooks/useAiSystems.ts` (retirar `useCreateAiSystem`).

- [ ] Sustituir el bloque de rol (radio + art. 25) y el de clasificación (4 preguntas + `<select>` de nivel + motivación) por `<ClasificacionGuiada modo="alta" … />`. El formulario no se envía sin `onConfirmar` recibido (CA-1): el botón «Registrar sistema» queda deshabilitado hasta que el cuestionario esté confirmado y muestra «Iniciar clasificación guiada» / «Continuar clasificación» (estado en memoria) según haya respuestas.
- [ ] `handleSubmit` → `useRegistrarSistemaClasificado().mutateAsync({ p_sistema: {...}, p_cuestionario: { questionnaire_version, phase1_responses, phase2_responses, phase2_art63_justification, computed_role, computed_risk_level, gpai_dependency, applicable_frameworks, catalog_profile } })`, navegar a la ficha. Sin `tenant_id` en el payload (lo pone la RPC).
- [ ] ≤ 400 líneas. Actualizar tests que citaban `PREGUNTAS_ROL`/`proponerNivel` si los hay (`grep -rn "proponerNivel\|PREGUNTAS_ROL\|PREGUNTAS_CLASIFICACION" src`).
- [ ] Commit `feat(aims): el alta se clasifica con el cuestionario guiado y se registra por RPC`.

### Task 8: `SistemaDetalle` — descomposición + clasificación vigente + frontera

**Files:** Modify `SistemaDetalle.tsx` (→ composición ≤ 400); Create `sistema/*.tsx`; Delete `src/hooks/useAimsFria.ts`; Modify `src/hooks/useAimsTechnicalFile.ts`; Modify `src/test/aims/aims-column-contract.test.ts` (`TIPO_A_TABLA` sin FRIA/model/dataset; ancla `>= 13` → `>= 4`), `src/test/aims/no-fabricated-claims.test.ts` (los describes «A4 — la pestaña FRIA…», «FRIA — ausencia acreditada…», «el órgano de la FRIA…», «el hook no declara columnas inexistentes» sobre `useAimsTechnicalFile` se adaptan a la superficie que queda: el criterio «sin dato no se afirma nada» se conserva sobre el expediente técnico), `src/hooks/__tests__/useAimsTenant.test.ts`.

- [ ] `ClasificacionVigentePanel`: lee `useCuestionarioVigente` + `useCuestionariosDeSistema`; pinta rol/nivel/perfil/GPAI/marcos/fecha/autor/hash con `etiqueta` y `ETIQUETA_PERFIL`; badge de nivel por tokens; si no hay cuestionario: «Sin clasificación guiada — se mide contra el catálogo completo» + CTA «Iniciar clasificación guiada»; si hay: CTA «Nueva clasificación» → abre `ClasificacionGuiada modo="reclasificacion"` (crea DRAFT con `useIniciarCuestionario` si no existe, autosave con `useGuardarBorradorCuestionario` en `onCambio` con debounce 800 ms, `onConfirmar` → guardar borrador con los computed + `useCompletarCuestionario`); enlace «Historial» → `HistorialClasificaciones`.
- [ ] `EditarSistemaModal`: **sin** rol ni nivel (trigger los bloquea; S-12). El texto del modal dice que la clasificación se cambia con una nueva clasificación guiada.
- [ ] `TabExpedienteTecnico`: secciones existentes (chip por `etiqueta`/neutral), **Editar** sección (`useUpdateTechnicalFileSection` con `.eq("tenant_id", tenantId).eq("id", id)` + `maybeSingle` + `if (!data) throw`), «Iniciar expediente técnico (anexo IV)» sólo si 0 secciones: inserta el esqueleto de 9 secciones del anexo IV (`ANEXO_IV_SECCIONES` en `src/lib/aims/expediente-tecnico.ts`, hoja) con `tenant_id` explícito; lista de versiones + «Registrar versión» (`version_label`, `release_stage`, `effective_from`, `change_summary`; insert con `tenant_id` explícito). Se retira el botón «cerrar expediente» y `useCloseAimsTechnicalFile`. La pestaña dice, desde los marcos derivados, si el art. 11 vincula al rol (proveedor de alto riesgo) o si el expediente es marco operativo.
- [ ] `TabVigilancia`: indicadores + «Registrar indicador» (`indicator_name`, `metric_key`, `status` ∈ {OK}, `last_observed_at`; insert con `tenant_id` explícito).
- [ ] Retirar pestaña FRIA y pestaña «Modelos & Datasets»; borrar `useAimsFria.ts`; retirar `useAimsModelRegistry`/`useAimsDatasetRegistry`/`useCloseAimsTechnicalFile` y sus tipos. En la ficha, el art. 27 aparece sólo como marco derivado (con su nota) cuando el cuestionario lo deriva.
- [ ] Corregir de paso las tres rutas `/nueva` → `/nuevo` (P1 de la revisión profunda, `SistemaDetalle.tsx:349,:586,:644`).
- [ ] Gate de frontera `src/test/aims/frontera-backbone.test.ts`: (1) ninguna fuente de `superficieAims()` ni de `src/hooks/useAi*.ts` contiene `from("<tabla (b)>")` para las 20 (lista enumerada); (2) cada tabla (a) tiene al menos un `.insert(` o `.update(` en algún hook que la nombra (`aims_evidence_items`, `aims_classification_questionnaires`, `aims_technical_file_sections`, `aims_system_versions`, `aims_monitoring_indicators`, `aims_incident_regimes`); (3) no existe `src/hooks/useAimsFria.ts`. Control positivo: el barrido encuentra ≥ 30 ficheros.
- [ ] `bun test src/test/aims src/hooks src/lib/aims` verde; typecheck. Mutación: reintroducir `from("aims_fria_assessments")` en un hook → cae (1). Commit.

### Task 9: `EvaluacionNueva` — descomposición + perfil

**Files:** Modify `EvaluacionNueva.tsx` (≤ 400); Create `evaluacion/*.tsx`.

- [ ] Extraer `PasoParametros` (sistema, marco, fecha), `PasoMedidas` (+ `ControlesDeMedida`, medidas adicionales), `PasoRevision` (notas, plan), `PasoResultado`. El estado y los `useMemo` de criterio (`perfilAplicable`, `buildEvaluationPayload`, `evidenciasPorMedida`) se quedan en la página o pasan como props: **ningún paso reimplementa un criterio**.
- [ ] `PerfilAplicabilidadBanner`: badge del perfil activo (`ETIQUETA_PERFIL[perfil.catalogProfile]`), «Cobertura provisional» si `provisional`, y cuando el sistema no tiene cuestionario COMPLETED: «Sin clasificación guiada — catálogo completo por defecto» (CA-7). Enlace a la ficha para clasificar.
- [ ] Test de arista (ampliar `cuestionario-arista.test.ts`): `EvaluacionNueva` o `PerfilAplicabilidadBanner` importa `perfilAplicable` y lee `catalogProfile`; ningún paso importa `catalog-aesia` para decidir el catálogo (sólo tipos).
- [ ] Commit.

### Task 10: `Dashboard` — descomposición + catálogo de posturas borrado

**Files:** Modify `Dashboard.tsx` (≤ 400); Create `dashboard/*.tsx`; Create `src/lib/aims/handoffs.ts`; Modify `readiness.ts` (borrar `aimsScreenPostures`, `AimsScreenPosture`, `AimsContractPosture`, `AimsScreenOperation`, `aimsReadOnlyHandoffs` → `handoffs.ts`); Modify `src/lib/aims/__tests__/readiness.test.ts` (borrar el `it` de posturas; el de handoffs importa de `handoffs.ts`); Modify `src/test/aims/no-fabricated-claims.test.ts` (borrar el describe «la postura de pantalla se pinta del dato»; su control positivo desaparece con el objeto que vigilaba).

- [ ] Borrar `ScreenPostureTable` y la sección «Contrato por pantalla». Motivo (ledger): descripción en prosa de lo que hacen las pantallas, mantenida aparte de las pantallas; la tabla de superficies del ledger la sustituye, y se genera del código una vez.
- [ ] Extraer `KpiCards`, `ComplianceMonitorPanel`, `ReadinessDomains`, `HandoffAffordances` (lee `handoffs.ts`), `PrioridadAhora`, `OrganoRector` (mantiene la arista `useBodyBySlug(aiGovernanceBodySlug(tenantId))` → `Link /organos/{slug}`).
- [ ] Añadir tarjeta «Clasificación guiada»: sistemas con cuestionario COMPLETED / sin él (medido con `useAllCuestionariosVigentes()` — añadir al hook: `select system_id, catalog_profile where status='COMPLETED'`, tenant-scoped).
- [ ] Commit.

### Task 11: `EvaluacionDetalle`, `IncidenteDetalle`, `IncidenteNuevo` — descomposición + subexpediente por régimen

**Files:** Modify las tres páginas (≤ 400); Create `evaluacion-detalle/*.tsx`, `incidente/*.tsx`; Modify `src/hooks/useAimsMultiregime.ts` (+ `useAbrirSubexpedienteRegimen`).

- [ ] `useAbrirSubexpedienteRegimen`: insert `{ tenant_id, incident_id, regime_code, target_authority, lead_role, applicability_rationale, status: 'OPEN' }` tras comprobar que el incidente es del tenant (`ai_incidents` tiene `tenant_id`: `.eq("tenant_id")` directo). `SubexpedientesRegimen`: por régimen del catálogo, si hay fila → estado y cierre (existente); si no → «Abrir subexpediente» con textarea de motivación de aplicabilidad obligatoria (≥ 20 caracteres) y autoridad/rol precargados del catálogo. El texto que hoy dice «la apertura no está disponible desde esta consola» se **retira** (retirada completa: buscar la frase por subcadena en todo `src/`).
- [ ] `RelojesRegulatorios`: los tres relojes con el mismo predicado; nada nuevo de criterio.
- [ ] `EdicionIncidente`: los campos del perímetro regulatorio de `20260907220000` (`incident_type`, `ria_severity`, `affects_personal_data`, `high_risk_to_subjects`, `affected_count`, `ict_related`, `affects_critical_function`, `knowledge_at`) si no estaban ya cableados; si lo están, sólo extracción.
- [ ] `IncidenteNuevo` → `FormularioIncidente` con `opcionesFiltro`/`etiqueta` para severidad y estado (sin «Todos»).
- [ ] `EvaluacionDetalle` → `CabeceraInforme`, `ChecklistMedidas`, `PlanYNotas`; los criterios (`motivoNoAcredita`, `checksVigentes`, `resumenPlan`) siguen importados de `lib/`.
- [ ] Ampliar `frontera-backbone.test.ts` (2) con el insert de regímenes. Commit.

### Task 12: pantallas restantes y gate de tamaño

**Files:** Modify `Sistemas.tsx`, `Evaluaciones.tsx`, `Incidentes.tsx` (ya tocadas en Task 1; comprobar ≤ 400); Create `src/test/aims/pantallas-acotadas.test.ts`.

- [ ] Gate: todo `.tsx` bajo `src/pages/ai-governance/` y `src/components/ai-governance/**` tiene ≤ 400 líneas (`readFileSync(...).split("\n").length`). Control positivo: se encuentran ≥ 10 páginas y ≥ 20 componentes. Mutación: añadir 400 líneas en blanco a un componente → cae; restaurar.
- [ ] Commit.

### Task 13: sondas vivas del cuestionario y del alta (rojas hasta aplicar la migración)

**Files:** Create `src/test/schema/aims-cuestionario-live.test.ts`; Modify `src/test/schema/garrigues-ia-owner-write.test.ts`.

- [ ] `garrigues-ia-owner-write.test.ts`: el alta pasa a `garr.rpc("fn_aims_registrar_sistema", { p_sistema: { name: MARCA, status: "ACTIVO" }, p_cuestionario: <despliegue · limitado · gpai> })`; nuevo caso «un INSERT directo como authenticated se rechaza con ALTA_SOLO_POR_CUESTIONARIO»; la limpieza sigue borrando el sistema (cascade arrastra el cuestionario; comprobar que también desapareció con `select … from aims_classification_questionnaires where system_id`).
- [ ] `aims-cuestionario-live.test.ts` con `sesionDe("ARGA")` y `sesionDe("GARRIGUES")`: (1) Garrigues registra un sistema de sonda por RPC → `content_hash` de 128 hex, `version` 1, `status` COMPLETED, `ai_systems.regulatory_role/risk_level` sincronizados; (2) UPDATE directo de la COMPLETED por su dueño → error `CUESTIONARIO_COMPLETADO_INMUTABLE` (o 0 filas: aceptar ambas formas NO — aquí el trigger lanza, exigir el error); (3) UPDATE directo de `ai_systems.risk_level` → error `CLASIFICACION_SOLO_POR_CUESTIONARIO`; (4) segundo cuestionario: DRAFT + `fn_aims_completar_cuestionario` → versión 2 COMPLETED y la 1 SUPERSEDED; (5) DRAFT con `Q2_2 = true`, nivel Limitado y sin justificación → `ART63_MOTIVACION_OBLIGATORIA`; (6) DRAFT con `Q2_1 = true` → `PRACTICA_PROHIBIDA_BLOQUEA`; (7) ARGA no ve ninguna fila del sistema de Garrigues (`select` por `system_id` → `[]`) y sí ve las suyas si las tiene (si ARGA tiene 0 cuestionarios, se crea uno de sonda para un sistema de ARGA de sonda para que la dirección no sea vacua) — **ambas direcciones con fila real**; (8) `garr.from(...).delete()` → error de permiso (no política ni grant); (9) limpieza: borrar los sistemas de sonda (cascade).
- [ ] Añadir `aims_classification_questionnaires` a `TABLAS_IA_CON_DATO_ARGA`?? NO: su vacuidad se resuelve en esta sonda con filas reales en los dos tenants. Añadirla a `DOMAIN_TABLES` de `tenant-isolation.test.ts` sólo cuando ambos tenants tengan fila persistente (Harvey clasificado por su responsable + un sistema ARGA clasificado); mientras, declararla en `aislamiento-declarado.ts` como `PENDIENTE` con motivo.
- [ ] Commit. Estos dos ficheros quedan **rojos** hasta que el usuario autorice y se aplique `20260908120000`. Se dice en el informe.

### Task 14: ledger, tabla de superficies, 49 %, CLAUDE.md

- [ ] Tabla de superficies (pantalla, panel, KPI, badge, texto legal → REAL / HONESTO / RETIRADO con `archivo:línea`). Generarla del código: por página, hooks importados → tablas → escritura sí/no.
- [ ] Tabla de las 25 tablas (arriba) con evidencia de ejecución (hook borrado, test de frontera, revoke).
- [ ] §3.8: el 49 % (medido: score 49, 84 findings `MG_*`) y por qué; el resultado esperado de la clasificación de Harvey no lo fija el producto.
- [ ] `CLAUDE.md`: «28 tablas» → 25 (tres apariciones), nueva sección corta «Refactor total AIMS (2026-09-08)» con la frontera, los gates y lo pendiente.
- [ ] Commit.

### Task 15: review adversarial de rama (≥ 3 lentes, modelo medio o superior)

- [ ] Lentes: (1) aislamiento y escritura (RLS, `tenant_id` explícito, `.eq` pegado, `if (!data) throw`, grants); (2) afirmaciones y vocabulario (retirada a medias: buscar por subcadena en todo `src/` cada frase retirada; guards de qué lado están); (3) criterio y descomposición (ninguna pantalla reimplementa un criterio; módulos hoja sin imports cruzados; spec S-1…S-14 respetadas). Cada lente entrega hallazgos con `archivo:línea`; refutador por hallazgo; 0 P0 abiertos antes de mergear.

### Task 16: gates finales, autorización, aplicación, merge, producción

- [ ] `bun run typecheck && bun run lint && bun run build && bun test` (medir y decidir en pasos separados, sin tubería). Esperado antes de aplicar: todo verde salvo `aims-cuestionario-live.test.ts` y `garrigues-ia-owner-write.test.ts`.
- [ ] **PARAR y pedir autorización** para aplicar `20260908120000` y `20260908130000` en `governance_OS`, con el resultado de las sondas revertidas.
- [ ] Tras autorización: `supabase db query -f <fichero> --linked` (jamás `"$(cat …)"`), registrar en `supabase_migrations.schema_migrations` si el CLI no lo hace, `select version from schema_migrations order by 1 desc limit 3`, ejecutar los dos tests vivos → verde, `bun test` completo → ≥ 4 320 pass / 151 skip / 0 fail.
- [ ] Merge `--no-ff` a `main`, push. Verificación en producción con los dos logins (`bunx playwright test --config=playwright.production.config.ts` + ARGA: misma medición de KPI y ficha de «Motor de triaje» antes y después; Garrigues: ficha de Harvey con «Sin clasificación guiada» y el 49 % explicado).
