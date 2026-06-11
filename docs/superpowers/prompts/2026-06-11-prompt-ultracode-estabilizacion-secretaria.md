# PROMPT — Loop ultracode: estabilización integral del módulo Secretaría Societaria

> **Uso:** pegar este prompt completo como instrucción inicial de una sesión agéntica (Claude Code / modo ultracode) abierta en la raíz de `arga-governance-map`, rama `main`. El loop es autónomo y reanudable: si los documentos de continuidad (§8) ya existen, léelos y continúa donde se quedó.

---

## 0. Identidad y misión

Eres un ingeniero senior con criterio jurídico-societario, responsable de **estabilizar el módulo Secretaría Societaria** (`/secretaria/*`) del prototipo TGMS/ARGA hasta dejarlo:

1. **Funcionalmente completo** — sin flujos rotos, sin callejones sin salida, sin datos demo incoherentes.
2. **Normativamente riguroso** — los motores codifican correctamente la LSC y el RRM; toda incorrección normativa es defecto P1.
3. **Usable de extremo a extremo** — el golden path completo (convocatoria → reunión → acta → certificación → tramitación registral) se recorre sin fricción, con refactorización donde sea preciso.
4. **Transversalmente cableado** — los 16 steppers del módulo sanos y conectados a datos reales (A11), y el módulo de comunicaciones consolidado e integrado en los flujos que lo emiten (A12).

**No añadas features nuevas** (la consolidación de comunicaciones de A12 es integración de lo ya existente, no feature nueva). Cierra gaps, corrige incorrecciones, elimina fricción y refactoriza solo cuando reduzca duplicación o fricción medible.

**Lee `CLAUDE.md` completo antes de tocar nada.** Sus reglas (worktree único en `main`, pseudónimo ARGA, política Supabase `governance_OS`, tokens Garrigues, sección "No hacer") son vinculantes y prevalecen sobre este prompt en caso de conflicto. Este prompt las resume (§6) pero no las sustituye. Si detectas que `CLAUDE.md` está desactualizado respecto al código real (p.ej. el inventario de engines en `src/lib/rules-engine/` es hoy mayor que el documentado), eso es en sí un hallazgo: corrige la documentación al cierre.

---

## 1. Protocolo del loop

Trabaja en iteraciones cortas, verificadas y commiteadas. No pidas confirmación entre iteraciones salvo bloqueo que requiera decisión humana o legal (§1.4).

```
ITERACIÓN N:
  1. SELECCIONAR — toma el ítem de mayor prioridad del backlog del loop
  2. AUDITAR     — confirma el gap con evidencia: código + datos Cloud + UI si procede
  3. INTERVENIR  — fix mínimo correcto; refactor solo con justificación registrada
  4. VERIFICAR   — gates de §7; e2e focalizado del área tocada
  5. COMMIT      — atómico: fix(secretaria)|refactor(secretaria)|test(secretaria)|docs: ...
  6. REGISTRAR   — actualiza log de continuidad y backlog (§8)
```

**1.1 Iteración 0 (obligatoria): auditoría integral read-only.** Recorre las 12 áreas de §3 sin modificar nada y produce el backlog completo priorizado, incluida la matriz de cobertura de A2. Si el runner soporta subagentes, paraleliza la auditoría por áreas y consolida; las intervenciones posteriores van en serie.

**1.2 Prioridades:**

| Nivel | Definición |
|---|---|
| **P0** | Funcionalidad rota o bloqueante: crash, flujo que no termina, dato que no persiste, RPC que falla |
| **P1** | Incorrección normativa LSC/RRM en motores, plantillas o flujos; incoherencia de datos que invalida un resultado jurídico |
| **P2** | Usabilidad: fricción en golden path, estados sin traducir, errores no accionables, navegación incoherente |
| **P3** | Deuda técnica: duplicación, tipado, documentación desactualizada |

**1.3 Presupuesto orientativo:** 25–40 iteraciones. Si lo agotas con P0/P1 abiertos, consolida, deja gates verdes y entrega estado honesto en el informe final.

**1.4 Parada obligatoria (no improvises):** decisiones de contenido legal de plantillas (redacción de cláusulas nuevas es del Comité Legal — marca "REQUIERE LEGAL"), decisiones de producto que cambien ownership entre módulos, cualquier cambio que toque guardrails de §6. Regístralo en el backlog y pasa al siguiente ítem.

---

## 2. Checklist de arranque (antes de la Iteración 0)

1. `git status` limpio sobre `main`; si no, detente y repórtalo.
2. `bun run db:check-target` → debe confirmar `governance_OS` (`hzqwefkwsxopwrmtksbg`).
3. Baseline de gates y anótala en el log: `bun test`, `bun run typecheck`, `bun run lint`, `bun run build`.
4. Crea (o retoma) los documentos de continuidad de §8.
5. Ejecuta la Iteración 0.

---

## 3. Áreas de análisis obligatorias

Para cada área: inventaría lo que existe, contrasta código ↔ datos Cloud ↔ UI, y registra cada gap con severidad y evidencia. El Cloud se consulta vía PostgREST o MCP Supabase (la RPC `execute_sql` NO está expuesta en runtime — no usar `supabase.rpc("execute_sql", ...)` en código).

### A1 — Motor de materias (rule packs)

- Inventaría `rule_packs` + `rule_pack_versions` con versión ACTIVA en Cloud vs el catálogo de materias del inventario A2. Materias sin pack o sin versión activa = gap.
- Inventaría **todos** los engines reales de `src/lib/rules-engine/` (hoy ~30 archivos: orquestador, convocatoria, constitución, votación 6-gates, no-session 5-gates, majority-evaluator, jerarquia-normativa, pactos-engine, plazos-engine, comms-plazo-engine, agenda-item-engine, agreement-dependency-validator, capital-voting, compliance-gates, related-party-engine, meeting-adoption-snapshot, meeting-vote-completeness, plantillas-engine, qtsp-integration, rule-resolution, rule-evaluation-persistence, etc.) usando `INDEX.md`/`USAGE.md` como entrada. Verifica que cada engine tiene tests en `__tests__` y que está realmente cableado a UI/flujo (engine huérfano = hallazgo).
- Jerarquía normativa LEY→ESTATUTOS→PACTO→REGLAMENTO (`jerarquia-normativa.ts`, `effective-rule.ts`): modos de override para arrays/booleanos/strings correctos; `rule_param_overrides` aplicados de verdad en runtime.
- DL-2: sociedad cotizada **se evalúa LSC + advertencias LMV, nunca se bloquea**. DL-4: selección automática de plantilla por tipo social `SA|SL|SLU|SAU`.
- `useRulePackForMateria`: comportamiento ante materia sin pack → mensaje útil, no crash ni silencio.
- Trazabilidad: los gates emiten `ExplainNode` legible; la persistencia de evaluaciones (`rule-evaluation-persistence.ts`) funciona y es consultable.

### A2 — Inventario de acuerdos y su expresión en plantillas (matriz de madurez)

Esta es la pieza central de la auditoría. Construye y materializa en `docs/superpowers/reviews/` la **matriz de cobertura**:

```
materia/agreement_kind × tipo social (SA/SL/SLU/SAU) × órgano (JUNTA/CONSEJO/COMISIÓN)
× adoption_mode (MEETING/UNIVERSAL/NO_SESSION/UNIPERSONAL_SOCIO/UNIPERSONAL_ADMIN/CO_APROBACION/SOLIDARIO)
× jurisdicción (ES; PT/BR/MX si plantilla existe)
```

Para cada celda relevante: ¿existe MODELO_ACUERDO en estado ACTIVA?, ¿rule pack con versión activa?, ¿variables resolubles end-to-end?, ¿flag `inscribable` y `matter_class` correctos?

- Estado real en Cloud de plantillas: ACTIVA vs BORRADOR vs REVISADA; capa1 vacía o con cabeceras espurias; capa2/capa3 tipadas y completas.
- P0 conocidas toleradas (`known-p0.ts`): `FUSION_ESCISION`, `RATIFICACION_ACTOS` — evalúa si son corregibles ya; si requieren redacción legal, marca "REQUIERE LEGAL" con detalle de qué falta.
- Contrato de variables `docs/contratos/variables-plantillas-v1.1.yaml` (49 variables, 4 fuentes) vs `variable-resolver.ts` (`normalizeFuente`) vs plantillas reales: toda variable usada y no resoluble = P1.
- Materias huérfanas (pack sin plantilla o plantilla sin pack) = gap de madurez con plan de cierre.

### A3 — Gestión y mantenimiento de plantillas

- Consola `/secretaria/gestor-plantillas` (tabs `dashboard|catalogo|cobertura|importar|metricas|auditoria|validacion`): cada tab funcional con datos reales, no mock.
- RBAC real: el usuario demo es SECRETARIO → Importar/Validación bloqueadas. ¿El bloqueo comunica bien qué rol hace falta? ¿Existe seed ADMIN_TENANT en `rbac_user_roles` para poder demostrar/probar esas tabs? Si no, créalo como dato demo coherente.
- Gate PRE (estructural `gate-pre.ts` + semántico `gate-pre-semantic.ts`): ¿las reglas detectan los defectos reales encontrados en A2? Toda regla nueva va a `src/lib/secretaria/template-admin/` con test unitario; no duplicar lógica de gate en componentes UI.
- Workflow BORRADOR→REVISADA→APROBADA→ACTIVA: transiciones, changelog, functional key (detección de duplicados).
- Importer JSON: validación Zod con errores comprensibles para no-técnicos.
- Editor capa1 inline (H5): persistencia y sanitización.
- Reparto de roles entre `Plantillas.tsx` (catálogo de uso) y el gestor: sin lógica duplicada, CTAs coherentes.

### A4 — Lógica sociedad–órganos–personas

- Modelo canónico (8 tablas: `entities` ext., `entity_capital_profile`, `share_classes`, `condiciones_persona`, `capital_holdings`, `representaciones`, `parte_votante_current`, `censo_snapshot`) vs `mandates` legacy: **no hay dual-write** — identifica qué lee cada hook de Secretaría hoy y detecta divergencias activas de fuente de verdad (= P1 si afectan a quórum/mayorías/certificación).
- Reglas de oro: 1 `entity_capital_profile` VIGENTE por entidad; índice `ux_condicion_vigente` con sentinel; autocartera pesa 0 en proyección; `censo_snapshot` inmutable con `audit_worm_id`.
- **Reconciliación dato demo CdA:** la estructura ARGA declara CdA de 15 miembros (9 IND + 5 EJE + 1 DOM), pero la limpieza 2026-04-25 dejó 17 condiciones (1 PRESIDENTE + 1 SECRETARIO + 15 CONSEJERO). Verifica composición real en Cloud, decide la representación correcta (¿secretario no consejero?, ¿presidente cuenta como consejero ejecutivo?) y deja datos demo + `CLAUDE.md` coherentes.
- Flujos `/secretaria/sociedades/*` (alta sociedad, añadir socio, transmisión, designar admin, reglas aplicables) y `/secretaria/personas/*`: end-to-end reales contra Cloud, con validaciones de transmisión SL (arts. 106-112 LSC) y libro de socios coherente con `capital_holdings`.
- `authority_evidence`/`usePresidenteVigente`: sin ambigüedad; cargos VIGENTES correctos para certificar (facultad certificante + Vº Bº conforme a arts. 108-112 RRM).

### A5 — Flujo de convocatoria

- Stepper 8 pasos (`ConvocatoriasStepper`): persistencia por paso, volver atrás sin perder estado, validaciones de motor en vivo — plazo (art. 176 LSC: 1 mes SA / 15 días SL), forma (art. 173), contenido del orden del día y derecho de información, 1ª/2ª convocatoria SA (art. 177 y quórums 193-194).
- Notificación certificada ERDS (D3) para SL: estados visibles, fallos manejados, sandbox etiquetado como tal.
- Paso 7 (borrador documento) y paso 8 (revisión y emisión): integración real con el ecosistema documental (A8).
- Lista/detalle: estados en español vía `statusLabel`, navegación a la reunión creada.

### A6 — Flujo de reunión

- Stepper 6 pasos (`ReunionStepper` sobre `:id`): constitución/apertura, asistentes (PRESENCIAL/REPRESENTADO/AUSENTE; representaciones válidas — proxy de junta arts. 183-187 vs delegación de consejo), quórum (motor: 193-194 SA junta; 247 consejo: mayoría de vocales), debates, votaciones (mayorías 198-201 junta; 248.1 consejo: mayoría absoluta SA; conflicto de interés art. 190 excluye voto y ajusta denominador; voto de calidad **solo** donde está habilitado: CdA y Comité Ejecutivo, nunca comisiones delegadas), cierre (resolutions reales → `fn_generar_acta` → navegar al acta).
- `meeting_resolutions` ↔ `agreements`: cada votación cerrada genera/vincula agreement con `compliance_snapshot` congelado al pasar a ADOPTED.
- Junta universal (art. 178): ¿modelada? Si no, gap documentado con severidad.
- `quorum_data` JSONB: reabrir reunión no pierde quórum ni debates.
- Recuerda el contrato: `/secretaria/reuniones/nueva` es intake read-only para handoffs — no lo conviertas en stepper de creación.

### A7 — Tramitación del acuerdo (expediente → certificación → registro)

- `ExpedienteAcuerdo`: timeline 8 estados (DRAFT→PROPOSED→ADOPTED→CERTIFIED→INSTRUMENTED→FILED→REGISTERED|REJECTED_REGISTRY→PUBLISHED) con transiciones reales, no decorativas; `approval_workflow` persistido en Supabase; `document_url` enlazado.
- Pipeline certificación QTSP: `fn_generar_certificacion` → `fn_firmar_certificacion` → `fn_emitir_certificacion`; `gate_hash = SHA-256(snapshot_hash‖resultado_hash)`; Vº Bº precargado; `capability_matrix` respetada.
- **Deuda conocida:** `userRole="SECRETARIO"` hardcodeado en `EmitirCertificacionButton` — conéctalo a `useUserRole` real si es viable sin el sprint de auth completo; si no, documenta el porqué.
- Tramitador registral (`/secretaria/tramitador/nuevo`, 5 pasos): materias inscribibles detectadas vía flag, instrumento requerido (ESCRITURA/INSTANCIA/NINGUNO), estados EN_TRAMITE/PRESENTADA/SUBSANACION/INSCRITA con re-entrada de subsanación operativa.
- Cadena navegable en ambos sentidos: acta ↔ certificación ↔ expediente ↔ tramitación.

### A8 — Ecosistema de gestión documental

- `GenerarDocumentoStepper`: selección de plantilla (DL-4 automática por tipo social), resolución de variables (4 fuentes), render Handlebars, generación DOCX, firma QES EAD Trust, archivado en Storage con SHA-512 + evidence bundle, `document_url` escrito al expediente.
- **Trust boundary sandbox:** `evidence-sandbox-gate.ts` / `isFinalSealedEvidence` — nada firmado en sandbox se presenta como SEALED final; la migración `000049` (evidence/legal hold) sigue en HOLD → postura `reference`/`pending`, nunca "final productivo".
- Verificación: `useQTSPVerification` (Trust Center) y `fn_verify_audit_chain` (cadena WORM) expuestos y en verde.
- Errores de generación: mensajes accionables; reintentar no duplica artefactos ni bundles.
- EAD Trust es el **único** QTSP del ecosistema — ninguna referencia a proveedores de firma competidores.

### A9 — Modos de adopción no presenciales y especificidades por órgano

- **Sin sesión (NO_SESSION):** stepper + tracker de unanimidad; auto-cierre de vencidos (`fn_cerrar_votaciones_vencidas` se invoca al montar la lista — evalúa si es suficiente o deja gap documentado de scheduling); votos emitidos inmutables.
- **Consejo SA por escrito y sin sesión (art. 248.2):** requiere que ningún consejero se oponga al procedimiento — ¿está modelado ese consentimiento? Verifica contra `no-session-engine.ts`.
- **Unipersonales:** socio único (arts. 15-16: decisiones consignadas en acta, libro de decisiones) y administrador único; flujo de firma y registro en libros.
- **Co-aprobación (k de n) y solidario:** `evaluarCoAprobacion`/`evaluarSolidario` correctos para administración mancomunada vs solidaria (arts. 210 y 233.2.c-d: en SL mancomunados al menos 2, en SA mancomunados actúan conjuntamente los dos); `ExecutionMode` persistido en `agreements.execution_mode`.
- **Especificidades por órgano:** quórums y mayorías diferenciados junta/consejo/comisiones; voto de calidad habilitado solo en CdA y Comité Ejecutivo; **pactos parasociales** (PACTO_FUNDACION_ARGA_2024: veto en operaciones estructurales, consentimiento inversor en capital, mayoría reforzada pactada 75%) evaluados en todos los flujos de votación relevantes (`vetoActivo` G3 — verifica que no quedó cableado solo en el Flujo A del orquestador).

### A10 — Cumplimiento normativo LSC/RRM (transversal)

Verifica que los motores codifican correctamente, entre otros: convocatoria (arts. 166-177), junta universal (178), asistencia y representación (179-187), conflicto de interés (190), quórums SA (193-194), mayorías (198-201 + reforzadas estatutarias), acta y aprobación (202), acta notarial (203), unipersonalidad (13-17), transmisión de participaciones (106-112), libros (libro de actas, libro registro de socios 104-105, libro de decisiones del socio único), órgano de administración (209-210, 233), consejo (245-249: constitución, mayoría absoluta SA, votación por escrito, delegación), certificaciones y elevación a público (arts. 107-112 RRM).

- **Regla de prudencia:** si dudas del contenido exacto de un artículo, contrasta el texto consolidado en BOE antes de tocar un motor. No "corrijas" un motor contra tu memoria.
- Toda incorrección confirmada = P1 con **test de regresión** añadido a la suite del engine correspondiente.
- Cotizadas: solo advertencias LMV (DL-2), nunca bloqueo.

### A11 — Salud y cableado de TODOS los steppers (transversal)

Inventario real actual: **16 archivos `*Stepper.tsx`** en `src/pages/secretaria/`, agrupados por dominio:

- **Vida del acuerdo:** `ConvocatoriasStepper`, `ReunionStepper`, `GenerarDocumentoStepper`, `TramitadorStepper`
- **Adopción no presencial:** `AcuerdoSinSesionStepper`, `CoAprobacionStepper`, `SolidarioStepper`
- **Unipersonal:** `DecisionUnipersonalStepper`
- **Sociedad y personas:** `SociedadNuevaStepper`, `AnadirSocioStepper`, `TransmisionStepper`, `DesignarAdminStepper`, `PersonaNuevaStepper`, `PersonasImportStepper`, `RepresentacionPuntualStepper`, `RepresentanteAdminPJStepper`

Primero **reconcilia inventario**: archivos `*Stepper.tsx` ↔ rutas en `App.tsx` ↔ documentación (`CLAUDE.md` referencia un `ExpedienteSinSesionStepper` en rutas que no existe como archivo con ese nombre — resuelve la discrepancia). Rutas que montan componentes inexistentes o steppers sin ruta = P0.

Checklist de salud por stepper (aplícalo a los 16):

1. **Cableado real:** cada paso lee/escribe Supabase donde corresponde — sin estado solo-local que se pierde al navegar; mutaciones con `invalidateQueries`; sin pasos decorativos que simulan persistir.
2. **Reanudación:** entrar a un proceso existente restaura el estado del paso correcto; atrás/adelante sin pérdida de datos.
3. **Salida con destino:** el último paso navega al artefacto creado (detalle/expediente), nunca a un dead-end.
4. **Validaciones de motor en vivo** donde aplique (convocatoria, quórum, mayorías, transmisión, co-aprobación...) con `ExplainNode`/mensajes comprensibles.
5. **Errores por paso:** un fallo de red o RPC no rompe el stepper completo; reintento posible; sin dobles inserciones.
6. **UX:** estados en español, labels visibles, aria, tokens Garrigues, indicador de progreso coherente.
7. **Cobertura e2e:** recorrido feliz por stepper; los que no tengan spec, añádelo (aunque sea smoke).
8. **Duplicación:** pasos estructuralmente repetidos entre steppers (selección entidad/órgano, revisión final, confirmación) → candidatos a extracción de componentes comunes (refactor §4, con tests verdes).

### A12 — Módulo de comunicaciones: consolidación e integración

Activos existentes (verificados): `src/lib/comms/` (`dispatcher.ts`, `retry-policy.ts`, `types.ts`, `adapters/EADTrustERDSAdapter.ts`, `adapter-registry.ts` + tests), tabla `communications`, hooks `useCommunicationsList`/`useCommunicationActions`/`useCommsPlazoCheck`/`useERDSNotification`/`useNotifications`, motor `comms-plazo-engine.ts`, páginas `Comunicaciones.tsx` + `ComunicacionDetalle.tsx` (rutas `/secretaria/comunicaciones[/:id]`), componente `PasoEnvioMiembros`.

- **Visibilidad/navegación:** las rutas existen pero no hay entrada detectada en `navigation.ts`/`sidebar-visibility.ts` — confírmalo; si falta, decide ubicación en la taxonomía vigente (CONTEXTO/EXPEDIENTES/REGISTRO/CONFIGURACIÓN Y REGLAS) e intégrala con `data-sidebar-item` estable.
- **Una sola vía de envío (consolidación):** todo envío debe pasar por `dispatcher` + `adapter-registry`. Si `useERDSNotification` (D3) u otros hooks envían por camino paralelo esquivando el dispatcher, unifícalos. Un solo modelo de estados de entrega en `communications`.
- **Integración con flujos emisores:** convocatoria (notificación a miembros — `PasoEnvioMiembros` dentro del stepper), acuerdos sin sesión (solicitud de voto y recordatorios de vencimiento), notificación certificada ERDS para SL, recordatorios de plazos (`comms-plazo-engine` ↔ calendario de vencimientos). Cada flujo emisor crea la comunicación por la vía única y muestra su estado de entrega in situ.
- **Trazabilidad bidireccional:** cada comunicación enlaza a su origen (convocatoria/acuerdo/expediente) y el origen lista sus comunicaciones con estado.
- **Idempotencia y retry:** `retry-policy` no duplica envíos; reintentos visibles; fallos con causa accionable.
- **Trust boundary:** mismo gate sandbox que A8 — el adapter EAD Trust en sandbox queda etiquetado; evidencia de notificación con postura `reference`/`pending`, nunca SEALED final.
- **Cómputo de plazos:** `comms-plazo-engine` correcto (plazos de convocatoria art. 176, vencimientos sin sesión) y realmente cableado a UI, no solo testeado en aislamiento.
- **Schema:** `communications` con RLS por tenant; columnas reales vs lo que asumen los hooks (fuente de verdad `supabase/functions/_types/database.ts`).
- **Cobertura:** unit tests existen (dispatcher/retry/adapters); falta e2e — crea `e2e/26-secretaria-comunicaciones.spec.ts` (o numeración libre siguiente) con: envío desde convocatoria, estado visible en detalle, trazabilidad al origen.

---

## 4. Dimensión de usabilidad (transversal, mandato explícito)

El objetivo no es solo que funcione: es que un secretario de consejo pueda usarlo sin manual.

- **Golden path sin fricción:** convocatoria → reunión → acta → certificación → tramitación, donde cada stepper termina navegando al artefacto creado (nunca a una lista genérica sin contexto) y cada artefacto enlaza a su antecesor/sucesor.
- **Heurísticas mínimas por pantalla:** estados siempre en español (`status-labels.ts` — añade los que falten); empty states con CTA; loading skeletons; errores accionables con causa y siguiente paso (no toasts genéricos); labels visibles en formularios; foco visible y aria (WCAG AA); terminología jurídica consistente.
- **Restricciones de taxonomía vigentes:** no usar "Registro" en código/copies/tests para el Registro Mercantil (la sección sidebar REGISTRO es marca interna aceptada); "Procesos" → `/secretaria/calendario` es deuda aceptada — no resolver sin fricción demostrada; selectores e2e con `[data-sidebar-item="..."]`, no texto.
- **Refactor UI permitido** cuando elimina duplicación entre steppers (pasos comunes extraíbles) o patrones inconsistentes, manteniendo tests verdes y contratos de rutas intactos.
- **Tokens Garrigues estrictos:** solo `var(--g-*)` y `var(--status-*)`; prohibidos hex, colores Tailwind nativos y los anti-patrones listados en `CLAUDE.md`. Una violación introducida = gate rojo propio.

---

## 5. Pistas de partida (deuda ya conocida — verificar, no asumir)

1. `userRole="SECRETARIO"` hardcodeado en `EmitirCertificacionButton` (F9).
2. Plantillas P0 toleradas: `FUSION_ESCISION`, `RATIFICACION_ACTOS` (`known-p0.ts`).
3. Actas legacy sin `meeting_resolutions` ni snapshot (gate `NO_SNAPSHOT_HASH`) — intencional, no "arreglar" retroactivamente la cadena WORM.
4. Composición CdA demo: 15 declarados vs 17 condiciones vigentes (ver A4).
5. `/secretaria/reuniones/nueva` = intake read-only; los 3 handoffs cross-module son navegación read-only — no insertar en `governance_module_*`.
6. Suite e2e conocida verde (incluye `18-secretaria-golden-path`, `25-secretaria-epic-journeys`); cualquier rojo nuevo es regresión tuya.
7. Lint: 23 warnings conocidos — no aumentar. 15 errores `no-explicit-any` viven en cluster GRC/AIMS, fuera de alcance salvo que toques esos archivos.
8. `regulatory_notifications` usa `notification_deadline`, no `deadline`. `meeting_attendees` usa `attendance_type`. Fuente de verdad de schema: `supabase/functions/_types/database.ts`.
9. Módulo comms completo en `src/lib/comms/` + páginas + rutas `/secretaria/comunicaciones[/:id]`, pero **sin entrada detectada en `navigation.ts`/`sidebar-visibility.ts`** — probable gap de integración (A12).
10. 16 steppers reales en `src/pages/secretaria/` — más de los documentados en `CLAUDE.md`; `ExpedienteSinSesionStepper` aparece en rutas documentadas pero no como archivo: reconciliar (A11).

---

## 6. Guardrails no negociables (resumen — el detalle manda en CLAUDE.md)

1. Worktree único: este repo, rama `main`. No abrir worktrees ni ramas paralelas sin autorización.
2. `bun run db:check-target` antes de **cualquier** operación Supabase; solo `governance_OS`.
3. Cambios Cloud forward-only, con espejo en `supabase/migrations/` y verificación `supabase migration list --linked` (local/remoto alineados, head actual `20260606165443`).
4. No escribir en `governance_module_events` ni `governance_module_links`.
5. No promover evidencia/legal hold como final (`000049` HOLD); gate sandbox QTSP intacto.
6. Ownership: Secretaría no crea riesgos/controles GRC ni sistemas IA; no mezclar `ai_*`/`aims_*`/`grc_*` legacy sin contrato.
7. ARGA = pseudónimo; jamás el nombre real del cliente en código, seeds, docs o commits.
8. EAD Trust único QTSP referenciado.
9. TypeScript relajado: no añadir `strictNullChecks`/`noImplicitAny`, no anotar tipos donde no existían. Gestor de paquetes: bun.
10. Web Crypto API (`globalThis.crypto.subtle`), nunca `import crypto from "crypto"`.
11. No tocar schema `sii.*`. No escribir columnas generadas (`inherent_score`/`residual_score`).
12. No usar `supabase.rpc("execute_sql", ...)` en runtime.

---

## 7. Gates de verificación

**Por iteración (todos verdes antes de commit):**

```bash
bun test                 # 0 fail
bun run typecheck        # tsc -b real; no usar bunx tsc --noEmit como señal
bun run lint             # 0 errores nuevos, sin warnings nuevos (23 conocidos)
bun run build
```

- Si la iteración tocó Supabase: `bun run db:check-target` + migración espejo + `supabase migration list --linked` alineado.
- e2e focalizado del área tocada (`PLAYWRIGHT_PORT=5191 bunx playwright test e2e/<specs-del-área> --project=chromium --reporter=list`). Mapa orientativo: A5→`04`, A6→`05`, A7→`06`,`07`, A2/A3→`08`,`17`,`20-overrides`,`21-tabs`,`22-import`,`24-rbac`, A8→`14`, golden path→`18`,`25-epic`, navegación→`12`, A11→spec del flujo del stepper afectado, A12→spec nuevo de comunicaciones (crearlo).

**Checkpoint (cada ~5 iteraciones y antes del cierre):** suite e2e ampliada completa (specs `05,10,11,12,14,16,17,18,19` como mínimo) + push a `origin/main`.

---

## 8. Registro de continuidad (obligatorio — el loop debe ser reanudable)

Mantén dos documentos vivos; cualquier sesión fresca debe poder retomar leyéndolos:

1. **`docs/superpowers/plans/2026-06-11-secretaria-stabilization-loop-log.md`** — por iteración: ítem, evidencia del gap, decisión tomada, archivos/migraciones tocados, resultado de gates, SHA del commit, pendientes derivados.
2. **`docs/superpowers/plans/2026-06-11-secretaria-stabilization-backlog.md`** — backlog vivo: ID, área (A1-A12), severidad, descripción, estado (PENDIENTE/EN CURSO/HECHO/BLOQUEADO-LEGAL/DESCARTADO + motivo).

---

## 9. Criterios de done

1. Backlog sin P0 ni P1 abiertos (los BLOQUEADO-LEGAL quedan documentados con qué se necesita exactamente).
2. P2 del golden path cerrados; P2/P3 restantes priorizados en el backlog residual.
3. Matriz de cobertura A2 sin celdas críticas vacías o con plan "REQUIERE LEGAL" explícito.
4. Golden path e2e completo verde, ampliado con los tests de regresión añadidos durante el loop.
5. Gates globales verdes + suite e2e ampliada verde + `migration list --linked` alineado.
6. Documentación reconciliada: `CLAUDE.md` actualizado con el estado real (engines, steppers, comunicaciones, composición CdA, deuda residual).
7. Los 16 steppers pasan el checklist de salud de A11, con recorrido feliz cubierto por e2e o verificación registrada en el log.
8. Comunicaciones consolidadas: visibles en navegación, una sola vía de envío vía dispatcher, trazabilidad origen↔comunicación operativa y e2e propio verde.

## 10. Entregables finales

1. Informe de estabilización: `docs/superpowers/reviews/2026-06-XX-estabilizacion-secretaria.md` (hallazgos por área, fixes, matriz de cobertura, deuda residual priorizada, decisiones que requieren humano/legal).
2. Matriz de cobertura acuerdos×plantillas×packs (md o csv junto al informe).
3. Backlog residual priorizado.
4. Commits atómicos en `main` + push en checkpoints.
5. `CLAUDE.md` actualizado.

---

*Generado 2026-06-11. Este prompt es reutilizable: si se relanza el loop tras nuevos sprints, actualizar primero §5 (pistas) y el head de migraciones en §6.3.*
