# Plan de Implementacion: Motor de Reglas LSC para Secretaria Societaria

**Fecha:** 2026-04-19
**Spec:** `docs/superpowers/specs/2026-04-19-motor-reglas-lsc-secretaria-design.md`
**Alcance:** Espana (LSC) — SA y SL
**Estimacion:** 4 fases, ~41 tareas (actualizado post-feedback legal + integracion QTSP + plantillas protegidas + contrato variables + proceso sin sesion como flujo dominante)

---

## Fase 0: Schema + Seed (sin romper nada)

### T1. Migracion SQL: tablas del motor de reglas

**Archivo:** `supabase/migrations/20260419_000001_rule_engine_tables.sql`

**Crear:**
- `rule_packs` (id TEXT PK, tenant_id, descripcion, materia, organo_tipo, created_at)
- `rule_pack_versions` (id UUID PK, pack_id FK, version, payload JSONB, is_active, created_at, UNIQUE pack_id+version)
- `rule_param_overrides` (id UUID PK, tenant_id, entity_id FK, materia, clave, valor JSONB, fuente CHECK, referencia, created_at, UNIQUE entity_id+materia+clave)
- `rule_evaluation_results` (id UUID PK, tenant_id, agreement_id FK, etapa, ok, explain JSONB, rule_pack_id, rule_pack_version, tsq_token TEXT, created_at, UNIQUE agreement_id+etapa)
- `conflicto_interes` (id UUID PK, tenant_id, agreement_id FK, mandate_id FK, tipo CHECK('EXCLUIR_QUORUM','EXCLUIR_VOTO','EXCLUIR_AMBOS'), motivo, capital_afectado NUMERIC, resuelto_por UUID, created_at)
- RLS en las 5 tablas (tenant_id scoping, append-only para results)
- Trigger `worm_guard()`: funcion que lanza excepcion ante UPDATE/DELETE, aplicado a `rule_evaluation_results`

**Columnas nuevas en tablas existentes:**
- `agreements`: ADD `rule_pack_id TEXT`, `rule_pack_version TEXT`, `compliance_explain JSONB`, `gate_hash TEXT` (SHA-256 sellado con QSeal)
- `entities`: ADD `forma_administracion TEXT CHECK (forma_administracion IN ('ADMINISTRADOR_UNICO', 'ADMINISTRADORES_SOLIDARIOS', 'ADMINISTRADORES_MANCOMUNADOS', 'CONSEJO'))` — determina el modo de adopcion efectivo junto con el organo del pack. Default `'CONSEJO'` para entidades existentes.
- `entities`: ADD `es_unipersonal BOOLEAN DEFAULT false` — true si la sociedad tiene socio unico (art. 15 LSC)

**AC:**
- Migracion aplicable sin errores en Supabase Cloud
- RLS habilitado y verificado
- Tablas existentes no afectadas
- `bun run build` sin errores

---

### T2. Seed de Rule Packs: 16 materias LSC

**Archivo:** `scripts/seed-rule-packs.ts`

Insertar en `rule_packs` + `rule_pack_versions` los 16 Rule Packs v1.0.0 del catalogo (seccion 5 de la spec). Cada pack con su payload JSONB completo incluyendo los campos nuevos de tipologias de organo:
- `modosAdopcionPermitidos`: array de AdoptionMode compatibles con la materia
- `acta`: ReglaActa con `tipoActaPorModo`, `contenidoMinimo` (sesion/consignacion/acuerdoEscrito), `requiereTranscripcionLibroActas`, `requiereConformidadConjunta`
- `noSession`: ReglaNoSession — habilitacion, condicion adopcion, ventana minima, canales requeridos, silencio equivale a, cierre anticipado. Solo presente si `modosAdopcionPermitidos` incluye `NO_SESSION`.
- Secciones existentes: convocatoria, constitucion, votacion, documentacion, plazosMateriales, postAcuerdo

**Ejemplo de `acta` en cada pack:**
```json
"acta": {
  "tipoActaPorModo": {
    "MEETING": "ACTA_JUNTA",
    "UNIVERSAL": "ACTA_JUNTA",
    "UNIPERSONAL_SOCIO": "ACTA_CONSIGNACION_SOCIO",
    "UNIPERSONAL_ADMIN": "ACTA_CONSIGNACION_ADMIN",
    "NO_SESSION": "ACTA_ACUERDO_ESCRITO"
  },
  "contenidoMinimo": {
    "sesion": ["asistentes", "orden_dia", "deliberaciones", "votaciones", "resultado"],
    "consignacion": ["identidad_decisor", "texto_decision", "fecha", "firma"]
  },
  "requiereTranscripcionLibroActas": true,
  "requiereConformidadConjunta": false
}
```

**Criterios por organoTipo:**
- JUNTA_GENERAL: `modosAdopcionPermitidos` incluye MEETING, UNIVERSAL, UNIPERSONAL_SOCIO (y NO_SESSION para SL si aplica)
- CONSEJO: `modosAdopcionPermitidos` incluye MEETING, UNIPERSONAL_ADMIN (para admin unico)
- `requiereTranscripcionLibroActas = true` para materias de Junta (art. 15.2 LSC en socio unico)
- `requiereConformidadConjunta = true` solo si administradores mancomunados

**Materias:**
1. FORMULACION_CUENTAS
2. APROBACION_CUENTAS
3. APLICACION_RESULTADO
4. NOMBRAMIENTO_CESE
5. MOD_ESTATUTOS
6. AUMENTO_CAPITAL
7. AUMENTO_CAPITAL_NO_DINERARIO
8. REDUCCION_CAPITAL
9. SUPRESION_PREFERENTE
10. FUSION
11. ESCISION
12. TRANSFORMACION
13. DISOLUCION
14. EMISION_OBLIGACIONES
15. RETRIBUCION_ADMIN
16. CESION_GLOBAL_ACTIVO

**AC:**
- Script idempotente (DELETE + INSERT con tenant demo)
- Cada payload valido contra la interfaz RulePack
- Ejecutable con `bun run scripts/seed-rule-packs.ts`

---

### T3. Seed de overrides demo: entidad ARGA Seguros SA

**Archivo:** `scripts/seed-rule-packs.ts` (seccion adicional)

Insertar 3-5 `rule_param_overrides` para la entidad demo (ARGA Seguros SA, `entity_id = "00000000-0000-0000-0000-000000000010"`):

- Quorum de constitucion elevado por estatutos (e.g., 30% en vez de 25% para ordinaria 1a)
- Plazo de convocatoria consejo elevado a 5 dias
- Voto de calidad del presidente habilitado para materias ordinarias del consejo

**Actualizar entidad demo:**
- `forma_administracion = 'CONSEJO'` (ARGA Seguros SA tiene consejo de administracion)
- `es_unipersonal = false`

**AC:**
- Overrides insertados sin errores
- Fuente = 'ESTATUTOS' en todos
- Entidad demo tiene `forma_administracion` y `es_unipersonal` correctos

---

### T3b. Migracion SQL: extension de personas y mandates

**Archivo:** `supabase/migrations/20260419_000002_persons_extension.sql`

**Columnas nuevas en `persons`:**
- `person_type TEXT NOT NULL DEFAULT 'NATURAL' CHECK (person_type IN ('NATURAL', 'JURIDICA'))`
- `tax_id TEXT` — NIF/CIF
- `representative_person_id UUID REFERENCES persons(id)` — representante permanente si JURIDICA (art. 212 bis LSC)
- `denomination TEXT` — razon social (solo JURIDICA)

**Columnas nuevas en `mandates`:**
- `capital_participacion NUMERIC` — numero de acciones/participaciones
- `porcentaje_capital NUMERIC` — % sobre capital social
- `tiene_derecho_voto BOOLEAN DEFAULT true`
- `clase_accion TEXT` — para unanimidades/vetos de clase
- `representative_person_id UUID REFERENCES persons(id)` — representante del consejero PJ

**Columnas nuevas en `meeting_attendees`:**
- `capital_representado NUMERIC` — capital que aporta al quorum (propio + delegaciones)
- `via_representante BOOLEAN DEFAULT false`

**AC:**
- Migracion aplicable sin errores
- Columnas nullable, no rompe datos existentes
- `person_type` default 'NATURAL' preserva personas existentes

---

### T3c. Migracion SQL: role book y auditoria

**Archivo:** `supabase/migrations/20260419_000003_role_book.sql`

**Crear:**
- `secretaria_role_assignments` (id UUID PK, tenant_id, person_id FK, role TEXT CHECK, entity_id FK nullable, body_id FK nullable, assigned_by UUID, created_at)
  - `role` CHECK IN ('SECRETARIA_CORPORATIVA', 'SECRETARIO', 'PRESIDENTE', 'MIEMBRO', 'COMITE_LEGAL', 'ADMIN_SISTEMA')
  - `entity_id` + `body_id` opcionales para scope POR_ORGANO / POR_ENTIDAD
- `rule_change_audit` (id UUID PK, tenant_id, actor_id, actor_role, resource_type, resource_id, action, payload_before JSONB, payload_after JSONB, created_at)
  - WORM: solo INSERT, sin UPDATE/DELETE policies
  - Trigger `worm_guard()` aplicado (misma funcion que `rule_evaluation_results`) — doble capa de inmutabilidad (RLS + trigger)

**RLS endurecido:**
- `rule_packs`: SELECT por roles autorizados (SECRETARIA_CORPORATIVA, SECRETARIO, PRESIDENTE, COMITE_LEGAL, ADMIN_SISTEMA)
- `rule_param_overrides`: INSERT/UPDATE solo SECRETARIA_CORPORATIVA y SECRETARIO
- `rule_evaluation_results`: INSERT only (append-only), SELECT por roles autorizados
- `rule_change_audit`: INSERT only, SELECT por SECRETARIA_CORPORATIVA y COMITE_LEGAL
- **CRITICO**: verificar que el frontend NUNCA use service_role key

**AC:**
- RLS verificado con test de denegacion (usuario sin rol → denied)
- `rule_change_audit` no permite UPDATE/DELETE (verificado por RLS y trigger `worm_guard()`)
- `bun run build` sin errores

---

### T3d. Migracion SQL: plantillas protegidas

**Archivo:** `supabase/migrations/20260419_000004_plantillas_protegidas.sql`

**Crear:**
- `plantillas_protegidas` (id UUID PK, tenant_id, tipo TEXT CHECK, materia TEXT nullable, jurisdiccion TEXT, version TEXT, estado TEXT CHECK, aprobada_por TEXT, fecha_aprobacion TIMESTAMPTZ, contenido_template TEXT, variables JSONB, protecciones JSONB, snapshot_rule_pack_required BOOLEAN DEFAULT true, adoption_mode TEXT, organo_tipo TEXT nullable, contrato_variables_version TEXT nullable, created_at)
  - `tipo` CHECK IN ('ACTA_SESION', 'ACTA_CONSIGNACION', 'CERTIFICACION', 'CONVOCATORIA')
  - `estado` CHECK IN ('BORRADOR', 'REVISADA', 'APROBADA', 'ACTIVA', 'DEPRECADA')
  - `adoption_mode` CHECK IN ('MEETING', 'UNIVERSAL', 'NO_SESSION', 'UNIPERSONAL_SOCIO', 'UNIPERSONAL_ADMIN') para matching modo-especifico
  - `organo_tipo` para variantes especificas por organo (ej. CONSEJO vs JUNTA_GENERAL)
  - `contrato_variables_version` referencia a version congelada del contrato de variables
- RLS: lectura por roles de secretaria, escritura por SECRETARIA_CORPORATIVA/SECRETARIO, aprobacion solo COMITE_LEGAL

**Seed — Oleada 0 (7 plantillas esqueleto):**
1. Acta de sesion — Junta General (adoption_mode=MEETING|UNIVERSAL)
2. Acta de sesion — Consejo (adoption_mode=MEETING, organo_tipo=CONSEJO)
3. Acta de consignacion — Socio unico (adoption_mode=UNIPERSONAL_SOCIO)
4. Acta de consignacion — Admin unico (adoption_mode=UNIPERSONAL_ADMIN)
5. Acta de acuerdo escrito — Sin sesion (NO_SESSION) — flujo dominante, estructura propia
6. Certificacion de acuerdos (adoption_mode=null, todos los modos)
7. Convocatoria — SA + SL (adoption_mode=MEETING|UNIVERSAL|UNIPERSONAL_SOCIO)

Todas en estado `BORRADOR` con placeholder variables (`{{snapshot_hash}}`, `{{resultado_gate}}`, `{{conformidad_conjunta}}`, etc.) — artefactos tecnicos, no contenido juridico. Variables JSONB array incluyendo minimo las variables MOTOR_REGLAS (snapshot_hash, resultado_gate, etc.).

**AC:**
- Migracion aplicable
- 7 plantillas seed en estado BORRADOR
- Cada plantilla con variables JSONB array conteniendo variables MOTOR_REGLAS
- adoption_mode y organo_tipo definidos segun materia

---

### T3e. Seed: personas juridicas demo y capital

**Archivo:** `scripts/seed-personas-demo.ts`

Actualizar datos demo del tenant ARGA Seguros:
- Consejera dominical "Isabel Moreno" representando a **ARGA Capital Inversiones SL** (persona juridica):
  - Crear persona JURIDICA `ARGA Capital Inversiones SL` con `representative_person_id` → Isabel Moreno
  - Mandato de la persona juridica en el Consejo, con `representative_person_id` → Isabel Moreno
- Asignar `capital_participacion` y `porcentaje_capital` a todos los mandatos del Consejo de ARGA Seguros (9 consejeros, distribucion ejemplo)
- Asignar `capital_participacion` a socios de la JGA (si hay)

**AC:**
- Al menos 1 persona juridica con representante designado
- Capital asignado a mandatos del Consejo demo
- `bun run scripts/seed-personas-demo.ts` idempotente

---

### T3f. Seed: asignaciones de roles de secretaria

**Archivo:** `scripts/seed-role-assignments.ts`

Insertar `secretaria_role_assignments` para el tenant demo:
- Lucia Paredes → SECRETARIA_CORPORATIVA (scope global) + SECRETARIO (scope CdA)
- Antonio Rios → PRESIDENTE (scope CdA)
- Resto de consejeros → MIEMBRO (scope CdA)
- Usuario admin → COMITE_LEGAL + ADMIN_SISTEMA

**AC:**
- Roles asignados sin errores
- RLS verificable: Lucia puede crear overrides, consejeros solo leen evaluaciones

---

### T3g. Migracion SQL: expediente sin sesion

**Archivo:** `supabase/migrations/20260419_000005_no_session_expediente.sql`

**Crear:**
- `no_session_expedientes` (id UUID PK, tenant_id, agreement_id FK, entity_id FK, body_id FK, tipo_proceso CHECK('UNANIMIDAD_ESCRITA_SL','CIRCULACION_CONSEJO','DECISION_SOCIO_UNICO_SL','DECISION_SOCIO_UNICO_SA'), propuesta_texto, propuesta_documentos JSONB, propuesta_fecha, propuesta_firmada_por FK, ventana_inicio, ventana_fin, ventana_dias_habiles, ventana_fuente CHECK, estado CHECK('BORRADOR','NOTIFICADO','ABIERTO','CERRADO_OK','CERRADO_FAIL','PROCLAMADO'), condicion_adopcion CHECK('UNANIMIDAD_CAPITAL','UNANIMIDAD_CONSEJEROS','MAYORIA_CONSEJEROS_ESCRITA','DECISION_UNICA'), fecha_cierre, motivo_cierre, rule_pack_id, rule_pack_version, snapshot_hash, created_at, updated_at)
- `no_session_respuestas` WORM (id UUID PK, tenant_id, expediente_id FK, person_id FK, capital_participacion NUMERIC, porcentaje_capital NUMERIC, es_consejero BOOLEAN, sentido CHECK('CONSENTIMIENTO','OBJECION','OBJECION_PROCEDIMIENTO','SILENCIO'), texto_respuesta, fecha_respuesta, firma_qes_ref, firma_qes_timestamp, ocsp_status, notificacion_certificada_ref, UNIQUE(expediente_id, person_id))
- `no_session_notificaciones` WORM (id UUID PK, tenant_id, expediente_id FK, person_id FK, canal CHECK('NOTIFICACION_CERTIFICADA','EMAIL_SIMPLE','BUROFAX','ENTREGA_PERSONAL'), enviada_at, entregada_at, evidencia_ref, evidencia_hash, estado CHECK('PENDIENTE','ENVIADA','ENTREGADA','FALLIDA','RECHAZADA'))
- RLS en las 3 tablas (tenant_id scoping)
- Triggers `worm_guard()` en `no_session_respuestas` y `no_session_notificaciones`

**AC:**
- Migracion aplicable sin errores
- WORM verificado: UPDATE/DELETE en respuestas y notificaciones lanza excepcion
- RLS habilitado

---

### T3h. Seed: expediente sin sesion demo

**Archivo:** `scripts/seed-no-session-demo.ts`

Insertar datos demo en el tenant ARGA Seguros:
- 1 expediente de circulacion escrita del Consejo (FORMULACION_CUENTAS, tipo=CIRCULACION_CONSEJO, estado=CERRADO_OK): propuesta, 9 notificaciones certificadas entregadas, 8 consentimientos + 1 objecion al contenido (no al procedimiento), mayoria alcanzada
- 1 expediente de decision de socio unico SLU (APROBACION_CUENTAS, tipo=DECISION_SOCIO_UNICO_SL, estado=PROCLAMADO): respuesta unica con firma QES
- 1 expediente abierto de junta SL (NOMBRAMIENTO_CESE, tipo=UNANIMIDAD_ESCRITA_SL, estado=ABIERTO): propuesta notificada, 2 de 3 socios han consentido, ventana abierta

**AC:**
- 3 expedientes demo con datos coherentes
- Respuestas con firma_qes_ref populated en expedientes cerrados
- Script idempotente

---

## Fase 1: Motor transversal (funciones puras, sin UI)

### T4. Tipos base del motor de reglas

**Archivo:** `src/lib/rules-engine/types.ts`

Definir todos los tipos de la spec seccion 4, incluyendo los nuevos tipos de tipologias de organo:

**Tipos existentes:** `Fuente`, `TipoSocial`, `TipoOrgano`, `ReglaParametro<T>`, `ReglaConvocatoria`, `ReglaConstitucion`, `ReglaVotacion`, `MajoritySpec`, `ReglaDocumentacion`, `ReglaPlazosMateriales`, `ReglaPostAcuerdo`, `RulePack`, `EvaluacionResult`, `ExplainNode`, `RuleParamOverride`, `DenominadorAjustado`, `QTSPSealRequest`, `QTSPSealResponse`, `QTSPSignRequest`, `QTSPNotificationRequest`, `QTSPNotificationEvidence`, `TrustVerificationRequest`, `TrustVerificationResponse`.

- `ReglaNoSession`, `TipoProceso`, `CondicionAdopcion`, `SentidoRespuesta` — tipos del proceso sin sesion (spec §4.2, §6.6)
- `NoSessionInput`, `NoSessionOutput` — interfaces del motor sin sesion (spec §6.6)

**Tipos nuevos (organos + actas):**
- `FormaAdministracion`: `"ADMINISTRADOR_UNICO" | "ADMINISTRADORES_SOLIDARIOS" | "ADMINISTRADORES_MANCOMUNADOS" | "CONSEJO"`
- `AdoptionMode`: `"MEETING" | "UNIVERSAL" | "NO_SESSION" | "UNIPERSONAL_SOCIO" | "UNIPERSONAL_ADMIN"`
- `TipoActa`: `"ACTA_JUNTA" | "ACTA_CONSEJO" | "ACTA_CONSIGNACION_SOCIO" | "ACTA_CONSIGNACION_ADMIN" | "ACTA_DECISION_CONJUNTA" | "ACTA_ACUERDO_ESCRITO"`
- `ReglaActa`: `{ tipoActaPorModo, contenidoMinimo, requiereTranscripcionLibroActas, requiereConformidadConjunta }`

**Campos nuevos en `RulePack`:**
- `modosAdopcionPermitidos: AdoptionMode[]`
- `acta?: ReglaActa`

**AC:**
- `tsc --noEmit` sin errores
- Archivo exporta todos los tipos (incluyendo los 4 nuevos)

---

### T5. Resolucion de jerarquia normativa

**Archivo:** `src/lib/rules-engine/jerarquia-normativa.ts`

Implementar `resolverReglaEfectiva<T>()` (spec seccion 7): LEY > ESTATUTOS > PACTO. Nunca rebajar minimos legales. Comparadores para numeros (mayor = mas estricto para quorum/mayoria) y arrays (union = mas estricto para documentos).

**Archivo test:** `src/lib/rules-engine/__tests__/jerarquia-normativa.test.ts`

**AC:**
- 8+ tests: ley sin override, estatutos elevan, estatutos rebajan (bloquea), pacto no afecta, multiples overrides
- Funcion pura, zero dependencias externas

---

### T6. Motor de Convocatoria

**Archivo:** `src/lib/rules-engine/convocatoria-engine.ts`

Implementar `evaluarConvocatoria()` (spec seccion 6.1):
- **Gate de adoption_mode**: si `UNIPERSONAL_SOCIO` o `UNIPERSONAL_ADMIN` → skip completo, retornar `ok: true` con explain "No requiere convocatoria (organo unipersonal, art. 15/210 LSC)"
- Calcular antelacion maxima entre todas las materias del orden del dia
- Determinar canales segun tipo social y web inscrita
- Unir documentos obligatorios de todos los packs
- Calcular ventana de disponibilidad
- Junta universal: bypass completo
- Aplicar overrides por entidad
- Producir explain con fuente y referencia por regla

**Archivo test:** `src/lib/rules-engine/__tests__/convocatoria-engine.test.ts`

**AC:**
- 14+ tests: SA 30 dias, SL 15 dias, junta universal, multi-materia (rige la mas estricta), sin web inscrita → BORME+diario, override estatutario que eleva plazo, documentos union, **unipersonal_socio skip**, **unipersonal_admin skip**
- Funcion pura

---

### T7. Motor de Constitucion

**Archivo:** `src/lib/rules-engine/constitucion-engine.ts`

Implementar `evaluarConstitucion()` (spec seccion 6.2):
- **Gate de adoption_mode**: si `UNIPERSONAL_SOCIO` o `UNIPERSONAL_ADMIN` → skip completo, retornar `quorumCubierto: true, ok: true` con explain "No requiere quorum (organo unipersonal)"
- SA ordinaria 1a: 25% capital con derecho de voto
- SA ordinaria 2a: sin minimo
- SA especial (art. 194) 1a: 50%
- SA especial 2a: 25%
- SL: sin quorum legal (salvo override estatutario)
- Consejo: mayoria de miembros presentes
- Perfil combinado: si hay materias ordinarias + especiales, rige quorum especial
- **Denominador ajustado por conflicto**: `capital_convocable = capital_con_derecho_voto - excluidos_quorum`. Si `capital_convocable = 0` → BLOCKING automatico. Usar `calcularDenominadorAjustado()` de §16.3 del spec.

**Archivo test:** `src/lib/rules-engine/__tests__/constitucion-engine.test.ts`

**AC:**
- 14+ tests: SA 1a ordinaria OK/FAIL, SA 2a sin minimo, SA 1a especial, SA 2a especial, SL sin quorum, SL con override, consejo, multi-materia combinada, **unipersonal skip**, **NO_SESSION skip**, **denominador ajustado por EXCLUIR_QUORUM**, **capital_convocable = 0 → BLOCKING**

---

### T8. Evaluador de mayorias (MajoritySpec parser)

**Archivo:** `src/lib/rules-engine/majority-evaluator.ts`

Implementar `evaluarMayoria(spec: MajoritySpec, votos: VotosInput): boolean`:
- Parser de formulas: `favor > contra`, `favor >= 2/3_emitidos`, `favor > 1/2_capital_presente`
- Universos de computo: votos_emitidos, capital_presente, consejeros_presentes, capital_total
- Tratamiento de abstenciones: no_cuentan, cuentan_como_contra, cuentan_como_voto
- Doble condicional (art. 201.2): si capital_presente < umbral → aplicar mayoriaAlternativa

**Archivo test:** `src/lib/rules-engine/__tests__/majority-evaluator.test.ts`

**AC:**
- 15+ tests: mayorias simples, absolutas, 2/3, doble condicional SA 2a conv, tratamiento abstenciones, empate, votos en blanco, consejo

---

### T9. Motor de Votacion (Gate Engine 6 pasos)

**Archivo:** `src/lib/rules-engine/votacion-engine.ts`

Implementar `evaluarVotacion()` (spec seccion 6.3) con los 6 gates + gate previo de adoption_mode:

**Gate 0 — Modo de adopcion:**
- Si `UNIPERSONAL_SOCIO` o `UNIPERSONAL_ADMIN` → skip completo, retornar `acuerdoProclamable: true, ok: true` si decision firmada. Explain: "Decision unipersonal — no requiere votacion (art. 15/210 LSC)"
- Si `NO_SESSION` → delegar a `evaluarProcesoSinSesion()` (T9b). NO evaluar en-linea — el proceso sin sesion tiene su propio motor con 5 gates diferenciados por organo (spec §6.6)
- Si `MEETING` o `UNIVERSAL` → ejecutar los 6 gates completos

**Gates 1-6 (organo colegiado):**
1. Elegibilidad (exclusion por conflicto de interes — modelo formalizado EXCLUIR_QUORUM/VOTO/AMBOS con denominador ajustado)
2. Quorum (referencia a constitucion)
3. Mayoria (delega a majority-evaluator)
4. Unanimidad (por ambito: todos/presentes/clase)
5. Vetos (estatutarios bloquean, pactados solo reportan)
6. Voto de calidad (solo en empate, solo si habilitado)

**Archivo test:** `src/lib/rules-engine/__tests__/votacion-engine.test.ts`

**AC:**
- 30+ tests: SA ordinaria, SA reforzada 1a y 2a, SL ordinaria y reforzada, conflicto interes excluye voto, unanimidad requerida y no alcanzada, veto estatutario bloquea, veto pactado solo reporta, empate + voto calidad, empate + voto calidad excluido para materia, **unipersonal_socio firmada OK**, **unipersonal_admin firmada OK**, **unipersonal sin firma FAIL**, **NO_SESSION delegacion a motor sin sesion**, **EXCLUIR_VOTO vs EXCLUIR_QUORUM denominadores distintos**, **EXCLUIR_AMBOS sale de ambos**, **veto prevalece sobre voto de calidad (golden G/W/T)**, **doble umbral SA 2a conv (golden G/W/T)**, **abstenciones segun parametro denominador (golden G/W/T)**

---

### T9b. Motor de proceso sin sesion (5 gates)

**Archivo:** `src/lib/rules-engine/no-session-engine.ts`

Implementar `evaluarProcesoSinSesion()` (spec seccion 6.6) con 5 gates diferenciados:

**Gate 0 — Habilitacion:** verificar `noSession.habilitado_por_estatutos` (junta SL) o `noSession.habilitado_por_reglamento` (consejo). No habilitado → BLOCKING.

**Gate 1 — Materia:** verificar `pack.modosAdopcionPermitidos.includes('NO_SESSION')`. Materias reforzadas → BLOCKING.

**Gate 2 — Notificacion fehaciente:** verificar que todos los destinatarios tienen notificacion `ENTREGADA`. Falta alguno → BLOCKING.

**Gate 3 — Ventana de consentimiento:** verificar apertura/cierre, cierre anticipado si unanimidad alcanzada u objecion recibida. Implementar `evaluarVentana()`.

**Gate 4 — Condicion de adopcion (3 variantes):**
- `evaluarUnanimidadCapitalSL()`: 100% capital consentido, 0 objeciones, 0 silencios. Cada consentimiento con firma QES.
- `evaluarCirculacionConsejo()`: (a) 0 OBJECION_PROCEDIMIENTO, (b) mayoria ordinaria sobre consejeros participantes, (c) quorum de participacion.
- `evaluarDecisionSocioUnico()`: decision consignada → ok.

**Verificacion QES:** cada consentimiento sin `firma_qes_ref` produce WARNING (junta SL) o BLOCKING (si configurado).

**Archivo test:** `src/lib/rules-engine/__tests__/no-session-engine.test.ts`

**AC:**
- 20+ tests:
  - Habilitacion: estatutos SI/NO, reglamento SI/NO
  - Materia: admitida/excluida
  - Notificacion: completa/incompleta
  - Ventana: abierta/cerrada/cierre anticipado por unanimidad/cierre anticipado por objecion
  - Unanimidad SL: todos consienten OK, un silencio FAIL, una objecion FAIL, capital parcial FAIL
  - Circulacion consejo: sin oposicion procedimiento OK, con oposicion FAIL, mayoria alcanzada OK, mayoria no alcanzada FAIL, quorum participacion OK/FAIL
  - Decision unica: consignada OK, sin consignar FAIL
  - Firma QES: presente OK, ausente WARNING/BLOCKING
- Funciones puras

---

### T10. Motor de Documentacion

**Archivo:** `src/lib/rules-engine/documentacion-engine.ts`

Implementar `evaluarDocumentacion()` (spec seccion 6.4) + `evaluarActa()`:

**Documentacion pre-sesion:**
- Union de documentos obligatorios de todos los packs de las materias
- Verificar disponibilidad en la ventana temporal
- Evaluar condiciones ("si_auditada", "si_no_dinerario")

**Evaluacion de acta (nuevo — ReglaActa):**
- Determinar `TipoActa` correcto segun `adoption_mode` via `acta.tipoActaPorModo`
- Verificar `contenidoMinimo` segun modo:
  - `sesion` para MEETING/UNIVERSAL (asistentes, orden_dia, deliberaciones, votaciones, resultado)
  - `consignacion` para UNIPERSONAL_SOCIO/UNIPERSONAL_ADMIN (identidad_decisor, texto_decision, fecha, firma)
  - `acuerdoEscrito` para NO_SESSION (propuesta, respuestas_socios, resultado, fecha_cierre)
- Si `requiereTranscripcionLibroActas = true` → verificar transcripcion (socio unico, art. 15.2 LSC)
- Si `requiereConformidadConjunta = true` → verificar firma conjunta (mancomunados)

**Archivo test:** `src/lib/rules-engine/__tests__/documentacion-engine.test.ts`

**AC:**
- 12+ tests: todos disponibles, faltante, condicion no aplica, multi-materia union, ventana incumplida, **acta sesion OK**, **acta consignacion OK**, **acta consignacion falta campo**, **transcripcion libro requerida**, **conformidad conjunta requerida**, **acta acuerdo escrito OK**, **tipo acta incorrecto para modo**

---

### T11. Orquestador transversal

**Archivo:** `src/lib/rules-engine/orquestador.ts`

Implementar:
- `determinarAdoptionMode()`: a partir de `FormaAdministracion` de la entidad + `organoTipo` del pack → devuelve `AdoptionMode` efectivo. Ej: entidad con `ADMINISTRADOR_UNICO` + pack de CONSEJO → `UNIPERSONAL_ADMIN`; entidad con `CONSEJO` + pack de JUNTA → `MEETING`.
- `componerPerfilSesion()`: max antelacion, quorum mas exigente, documentos union. Solo aplica si `adoption_mode ∈ [MEETING, UNIVERSAL]`.
- `evaluarAcuerdoCompleto()`: encadena los motores segun el flujo del `adoption_mode`:
  - **Flujo A** (MEETING/UNIVERSAL): convocatoria → constitucion → votacion → documentacion → acta → plazos materiales → postAcuerdo
  - **Flujo B** (UNIPERSONAL_SOCIO/UNIPERSONAL_ADMIN): skip convocatoria/constitucion/votacion → acta (consignacion) → plazos materiales → postAcuerdo
  - **Flujo C** (NO_SESSION): delega a `evaluarProcesoSinSesion()` (T9b) → habilitacion → notificacion → ventana → evaluacion diferenciada → acta (acuerdo escrito) → plazos materiales → postAcuerdo. Carga expediente + respuestas + notificaciones desde `no_session_expedientes`.
  - Produce `ComplianceResult` compatible + `explain` completo con path indicado

**Archivo:** `src/lib/rules-engine/index.ts` — re-exports

**Archivo test:** `src/lib/rules-engine/__tests__/orquestador.test.ts`

**AC:**
- 10+ tests E2E: sesion con 1 materia ordinaria, sesion multi-materia (ordinaria + reforzada), junta universal, acuerdo sin sesion (unanimidad SL), **decision socio unico (flujo B)**, **decision admin unico (flujo B)**, **admin mancomunado con conformidad conjunta**, **adoption_mode determinado por forma administracion**, **acta tipo correcto por modo**, **explain refleja path unipersonal**
- **NO_SESSION E2E**: 6+ tests adicionales — unanimidad SL completa, circulacion consejo aprobada, circulacion con objecion procedimiento → reconduccion a sesion, decision socio unico, materia no admitida, ventana expirada sin unanimidad
- Resultado compatible con `ComplianceResult` existente

---

### T12. Hook `useRulePacks`

**Archivo:** `src/hooks/useRulePacks.ts`

Implementar:
- `useRulePacks()`: carga todos los rule pack versions activos del tenant
- `useRulePacksForEntity(entityId)`: carga packs + overrides para la entidad
- `useRulePackForMateria(materia)`: carga un pack especifico

Usa TanStack Query, patron identico a hooks existentes.

**AC:**
- Carga desde Supabase
- staleTime=60_000
- Tipado correcto con las interfaces de T4

---

### T13. Fix inmediato: `checkNoticePeriodByType` — SA 30 dias

**Archivo:** `src/hooks/useJurisdiccionRules.ts`

Corregir el bug actual donde SA tiene `ORDINARIA: 15, EXTRAORDINARIA: 5`. Debe ser `ORDINARIA: 30, EXTRAORDINARIA: 30` segun LSC art. 176.1. Anadir comentario con referencia legal.

**AC:**
- SA: 30/30 dias
- SL: 15/15 dias (correcto, se mantiene)
- Tests existentes actualizados si los hay

---

### T13b. Evaluador de bordes no computables

**Archivo:** `src/lib/rules-engine/bordes-no-computables.ts`

Implementar `evaluarBordesNoComputables()` (spec seccion 14):
- Catalogo de 7 bordes: consentimientos de clase, suficiencia de liquidez, indelegabilidad fina, junta telematica, evidencia publicacion SA, evidencia notificacion SL, cotizadas
- Cada borde: evaluar condicion → si aplica y no resuelto → BLOQUEO/WARNING
- Cotizadas: si la entidad es cotizada → FUERA_DE_ALCANCE, el motor rechaza la evaluacion completa
- Retorna array de `ReglaNoComputable` con resolucion pendiente

**Archivo test:** `src/lib/rules-engine/__tests__/bordes-no-computables.test.ts`

**AC:**
- 8+ tests: cotizada rechazada, consentimiento clase sin perimetro → BLOQUEO, consentimiento clase con perimetro → OK, telematica sin checklist → BLOQUEO, publicacion sin evidencia → WARNING, entidad normal → 0 bordes
- Funcion pura

---

### T13c. Motor de plantillas protegidas (Gate PRE)

**Archivo:** `src/lib/rules-engine/plantillas-engine.ts`

Implementar `evaluarPlantillaProtegida()` (spec seccion 11) con soporte para 3 niveles de exigencia:
- Verificar que existe plantilla ACTIVA y APROBADA para el tipo de acta segun `adoption_mode`
- Verificar variables obligatorias resueltas (MOTOR_REGLAS: inyectadas; USUARIO: completadas)
- Verificar protecciones textuales (hash de secciones inmutables)
- Verificar `ruleset_snapshot_id` embebido
- Verificar contenido minimo del anuncio para materias con "texto integro" (MOD_ESTATUTOS art. 287)

**Tipo `PlantillaExigencia`:**
```typescript
type PlantillaExigencia = 'STRICT' | 'FALLBACK' | 'DISABLED';
```

**Comportamiento por exigencia:**
- `STRICT`: match exacto requerido, BLOCKING si falta
- `FALLBACK`: intenta match exacto, cae a plantilla generica designada con WARNING, BLOCKING si ninguna existe
- `DISABLED`: sin verificacion (dev/test solo)

**Implementar `goLiveConfig` constante:**
- 6 plantillas STRICT: ACTA_SESION JUNTA, ACTA_SESION CONSEJO, ACTA_CONSIGNACION SOCIO, ACTA_CONSIGNACION ADMIN, CERTIFICACION, CONVOCATORIA
- NO_SESSION como FALLBACK (cae a ACTA_ACUERDO_ESCRITO generica si no existe)

**Comportamiento WARNING:**
- Documento recibe marca visible en primera pagina
- `rule_evaluation_results` registra WARNING con plantilla_usada y plantilla_esperada
- evidence_bundle incluye WARNING en manifiesto

Implementar `calcularRulesetSnapshotId()`:
- Hash SHA-256 sincrono del payload JSONB del Rule Pack + overrides
- **CRITICO**: calculo sincrono, no diferido (riesgo de asincronia identificado por equipo legal)
- Solicitar sello TSQ al QTSP y persistir `tsq_token` junto al hash
- Sellar `gate_hash` con QSeal del QTSP al consolidar evaluacion en agreements

**Archivo:** `src/lib/rules-engine/plantillas-gate-config.ts` — nueva configuracion de exigencias

**Archivo test:** `src/lib/rules-engine/__tests__/plantillas-engine.test.ts`

**AC:**
- 12+ tests: plantilla activa OK, plantilla borrador → FAIL, variable faltante → FAIL, snapshot embebido, hash deterministico (mismo input = mismo hash), proteccion violada → FAIL, **fallback usado → WARNING en result**, **fallback no encontrado → BLOCKING**, **DISABLED mode → siempre ok**, **transicion FALLBACK→STRICT despues de activacion plantilla**
- Funcion pura

---

### T13d. Hook `usePersonasExtended`

**Archivo:** `src/hooks/usePersonasExtended.ts`

Implementar:
- `usePersonasConCapital(bodyId)`: carga mandatos activos con `capital_participacion`, `porcentaje_capital`, `person_type`, `representative_person_id`. Hace join con `persons` para obtener tipo y representante.
- `useAsistentesConCapital(meetingId)`: carga meeting_attendees con capital_representado, delegaciones, y flag de representante persona juridica.
- `validarRepresentantesPJ(mandates)`: funcion pura que verifica que todas las personas juridicas tienen representante designado. Retorna array de BLOCKING si falta alguno.

Patron TanStack Query identico a `useBodies.ts`.

**AC:**
- Capital cargado correctamente
- Persona juridica sin representante → BLOCKING
- `bun run build` sin errores

---

## Fase 2: Integracion en frontend

### T14. `useAgreementCompliance` — path V2 con feature flag

**Archivo:** `src/hooks/useAgreementCompliance.ts`

Anadir flag constante `const ENGINE_V2 = false;` (activable manualmente). Cuando V2:
- Cargar rule packs + overrides
- Ejecutar `evaluarAcuerdoCompleto()` del orquestador
- Mapear resultado a `ComplianceResult` (misma interfaz de salida)
- Persistir `rule_evaluation_results` en Supabase
- Retornar resultado V2

Cuando V1 (default): logica actual sin cambios.

**AC:**
- Con `ENGINE_V2 = false`: comportamiento identico al actual
- Con `ENGINE_V2 = true`: resultado correcto del motor V2
- No rompe ninguna pagina existente

---

### T15. ConvocatoriasStepper — consumir motor V2

**Archivo:** `src/pages/secretaria/ConvocatoriasStepper.tsx`

En Step 2 (fecha y plazo), reemplazar `checkNoticePeriodByType()` por `evaluarConvocatoria()`:
- Mostrar antelacion requerida con fuente y referencia legal
- Badge de estado (OK/ERROR) con explain expandible
- Si materia requiere documentos, mostrar checklist
- Mantener bloqueo de emision si plazo no cumplido

Respetar tokens Garrigues (`--g-*`, `--status-*`).

**AC:**
- Plazo SA = 30 dias, SL = 15 dias (corregido)
- Explain visible con referencia legal
- Checklist documental por materia
- UX identica al patron existente (no rompe)

---

### T15b. ExpedienteSinSesionStepper — flujo NO_SESSION completo

**Archivo:** `src/pages/secretaria/ExpedienteSinSesionStepper.tsx`

Stepper de 6 pasos para el proceso sin sesion:

**Step 1 — Propuesta:** Seleccionar materia (filtrada por `modosAdopcionPermitidos` con NO_SESSION), redactar propuesta, adjuntar documentacion. Motor verifica habilitacion por estatutos/reglamento.

**Step 2 — Destinatarios y notificacion:** Cargar censo desde `usePersonasConCapital()`. Seleccionar canal (NOTIFICACION_CERTIFICADA default). Lanzar notificaciones via QTSP. Mostrar estado de entrega con evidencia.

**Step 3 — Ventana de consentimiento:** Countdown, tabla de respuestas en tiempo real (quien, sentido, fecha, firma QES). Cierre anticipado si unanimidad alcanzada o objecion al procedimiento.

**Step 4 — Evaluacion:** Ejecutar `evaluarProcesoSinSesion()`. Mostrar resultado del Gate con explain expandible. Si `ok: false` → opciones: reconducir a sesion o cerrar como CERRADO_FAIL.

**Step 5 — Acta y firma:** Generar acta de acuerdo escrito con plantilla protegida. Incluye propuesta, relacion de respuestas con firma QES, resultado, snapshot. Firma QES secretario + VºBº presidente.

**Step 6 — Tramitacion:** Inscribibilidad, instrumento, publicacion. Continua en tramitador si escritura requerida.

**AC:**
- Stepper navega 6 pasos sin errores
- Tokens Garrigues en todos los componentes
- Integra con motor V2 (ENGINE_V2 flag)

---

### T15c. Hook `useNoSessionExpediente`

**Archivo:** `src/hooks/useNoSessionExpediente.ts`

Implementar:
- `useNoSessionExpediente(expedienteId)`: carga expediente + respuestas + notificaciones. Patron TanStack Query.
- `useNoSessionExpedientes(agreementId)`: lista expedientes por acuerdo.
- `useCrearExpediente()`: mutation para crear expediente con tipo_proceso y condicion_adopcion.
- `useRegistrarRespuesta()`: mutation para registrar consentimiento/objecion (WORM — no se puede modificar).
- `useEnviarNotificacion()`: mutation para enviar notificacion y actualizar estado.

**AC:**
- Carga correcta de expediente con respuestas y notificaciones
- Mutation de respuesta es one-shot (no permite edicion)
- `bun run build` sin errores

---

### T15d. Integracion QTSP en ExpedienteSinSesionStepper

**Archivo:** `src/pages/secretaria/ExpedienteSinSesionStepper.tsx` (ampliacion)

Integrar servicios QTSP en el stepper:
- **Step 2**: llamada a notificacion certificada eDelivery para enviar propuesta a cada destinatario. Persistir evidencia en `no_session_notificaciones`.
- **Step 3**: cada consentimiento se recoge con firma QES via QTSP. Verificar OCSP al firmar. Persistir `firma_qes_ref` y `ocsp_status` en `no_session_respuestas`.
- **Step 5**: firma QES del acta por secretario y presidente con verificacion OCSP.

**AC:**
- Notificacion certificada integrada en Step 2
- Firma QES en consentimientos (Step 3) y acta (Step 5)
- Tokens Garrigues

---

### T16. ReunionStepper — consumir motor V2

**Archivo:** `src/pages/secretaria/ReunionStepper.tsx`

Step 3 (quorum): reemplazar `computeQuorumStatus()` por `evaluarConstitucion()`:
- Mostrar quorum requerido con fuente (LEY vs ESTATUTOS)
- Distinguir primera/segunda convocatoria
- Badge OK/ERROR con porcentaje

Step 4 (votacion): integrar `evaluarVotacion()`:
- Mostrar resultado del gate engine por paso
- Exclusion de voto por conflicto de interes (art. 190)
- Resultado con explain expandible

**AC:**
- Quorum SA 1a ordinaria = 25%, especial = 50%
- Mayoria SA ordinaria = favor > contra, reforzada = segun art. 201
- Explain visible en cada votacion

---

### T17. ExpedienteAcuerdo — panel de explain

**Archivo:** `src/pages/secretaria/ExpedienteAcuerdo.tsx`

Anadir seccion "Validacion normativa" al timeline del expediente:
- Cargar `rule_evaluation_results` para el agreement
- Mostrar resultado por etapa (CONVOCATORIA, CONSTITUCION, VOTACION, etc.)
- Cada etapa expandible con explain nodes (regla, fuente, referencia, umbral, valor, resultado)
- Iconos de estado con tokens `--status-success/warning/error`

**AC:**
- Panel visible solo si hay resultados de evaluacion
- Explain expandible con fuente legal
- Tokens Garrigues correctos

---

### T18. TramitadorStepper — inscribibilidad del Rule Pack

**Archivo:** `src/pages/secretaria/TramitadorStepper.tsx`

Steps 2-3: leer `postAcuerdo` del Rule Pack del agreement:
- `inscribible` → determina si requiere tramitacion
- `instrumentoRequerido` → ESCRITURA / INSTANCIA / NINGUNO
- `publicacionRequerida` → BORME u otro canal
- `plazoInscripcion` → plazo recomendado

**AC:**
- Datos de inscribibilidad vienen del Rule Pack, no hardcodeados

---

### T19. SecretariaDashboard — KPIs con motor V2

**Archivo:** `src/pages/secretaria/Dashboard.tsx`

KPI "Acuerdos pendientes de compliance": contar agreements donde `rule_evaluation_results` tiene algun `ok = false`.

**AC:**
- KPI actualizado
- No rompe KPIs existentes

---

## Fase 3: Validacion y switch

### T20. Comparacion V1 vs V2 y switch

**Tareas finales:**
1. Activar `ENGINE_V2 = true` como default
2. Ejecutar evaluacion de todos los agreements existentes del tenant demo
3. Comparar resultados V1 vs V2 — documentar divergencias
4. Si 0 divergencias en 30+ evaluaciones → deprecar path V1
5. Eliminar logica hardcodeada de `useAgreementCompliance` (path V1)
6. Convertir `checkNoticePeriodByType` y `computeQuorumStatus` en wrappers del motor V2

**AC:**
- Motor V2 es el unico path activo
- 0 regresiones en funcionalidad existente
- Funciones legacy wrappean motor V2

### T21. Evidence bundle y expediente probatorio ASiC-E

**Archivo:** `src/lib/rules-engine/evidence-bundle.ts` + migracion `20260419_000006_evidence_bundles.sql`

**Migracion:**
- Tabla `evidence_bundles` WORM (id UUID PK, tenant_id, agreement_id FK, manifest JSONB, manifest_hash TEXT, qseal_token TEXT, tsq_token TEXT, status CHECK('OPEN','SEALED','VERIFIED'), created_at)
- Trigger `worm_guard()` aplicado
- RLS: INSERT por SECRETARIA_CORPORATIVA/SECRETARIO, SELECT por roles autorizados

**Implementar:**
- `generarEvidenceBundle(agreementId)`: recopila todos los artefactos del acuerdo (snapshot, gate_hash, acta, certificacion, notificaciones, asientos WORM), genera manifiesto canonico con hashes, sella con QSeal + TSQ
- `empaquetarASiCE(bundleId)`: empaqueta como contenedor ASiC-E (ZIP firmado), incluye verificador offline HTML/JS
- `descargarBundle(bundleId)`: endpoint de descarga del ASiC-E

**AC:**
- 6+ tests: bundle generado con todos los artefactos, manifiesto hash correcto, QSeal aplicado, trigger WORM activo, descarga ZIP valida, bundle de acuerdo sin artefactos → error controlado
- Funcion pura para generacion de manifiesto

---

### T22. Endpoint de verificacion de confianza (Trust Center)

**Archivo:** `src/lib/rules-engine/qtsp-integration.ts` + `src/hooks/useQTSPVerification.ts`

**Implementar:**
- `verificarIntegridad(agreementId, artifactType)`: verifica hash, firma QES, estado OCSP/CRL, TSQ, identidad y cargo vigente del firmante
- Hook `useQTSPVerification(agreementId)`: expone estado de verificacion para UI
- Panel "Evidencias de confianza" en ExpedienteAcuerdo (T17): muestra TSQ, firmas QES, notificaciones certificadas con estado de verificacion

**Interfaces:**
- `TrustVerificationRequest` / `TrustVerificationResponse` (spec §17.6)
- `QTSPSealRequest` / `QTSPSealResponse` (spec §17.7)

**AC:**
- 4+ tests: integridad OK, firma invalida detectada, certificado revocado, TSQ valida
- Panel visible en ExpedienteAcuerdo con tokens Garrigues

---

### T23. Integracion QTSP: firma QES y notificacion certificada

**Archivos:** `src/lib/rules-engine/qtsp-integration.ts` (ampliacion), hooks de firma y notificacion

**Implementar:**
- `firmarDocumentoQES(documentHash, signerId, documentType)`: solicita firma QES al QTSP con verificacion OCSP previa. Retorna firma + cadena X.509 + estado OCSP.
- `notificarCertificado(request: QTSPNotificationRequest)`: cursa notificacion via eDelivery del QTSP. Retorna evidencia de entrega con acuse, fecha, hash y TSQ.
- Integrar en ConvocatoriasStepper (T15): si SL → ofrecer notificacion certificada, persistir evidencia WORM
- Integrar en AcuerdosSinSesionStepper: propuesta + recogida de consents via notificacion certificada + firma QES
- Integrar en actas/certificaciones: firma QES del secretario + presidente con verificacion OCSP

**AC:**
- 6+ tests: firma QES solicitada, OCSP verificado, notificacion cursada, evidencia persistida, certificado revocado → bloqueo, notificacion fallida → reintento
- Tokens Garrigues en todos los componentes UI

---

### T24. Contrato de variables y CI de estabilidad

**Archivos:** `scripts/generate-variable-contract.ts` + `docs/contratos/variables-plantillas-v1.0.0.yaml` + CI test

**Implementar:**
- `generate-variable-contract.ts`: script que recorre tipos exportados por `src/lib/rules-engine/types.ts` y genera automaticamente el esqueleto del contrato YAML con nombres canonicos, tipos TS, condiciones de presencia. 3 bloques: MOTOR_REGLAS, USUARIO, QTSP.
- Contrato YAML versionado (`1.0.0`), con `fecha_congelacion` inicialmente null
- CI test: compara tipos exportados contra contrato YAML versionado. Si hay divergencia (campo anadido/renombrado/eliminado), el test falla y el build se rompe. Solo pasa si `impacto_contrato_variables` = ROMPE_CONTRATO con aprobacion documentada.

**Protocolo de congelacion (3 pasos):**
1. Paso 1: Auto-generacion del borrador al cerrar T4
2. Paso 2: Revision cruzada Dev (QTSP vars) + Legal (USUARIO vars)
3. Paso 3: Firma, versionado, `fecha_congelacion` rellena

**Dependencias:** T4 (tipos base — genera el contrato), T13c (motor plantillas — consume el contrato)

**AC:**
- Script genera YAML valido desde tipos
- CI test pasa con contrato alineado
- CI test falla con tipo anadido sin actualizar contrato
- Contrato almacenado en `docs/contratos/`

---

### T25. Panel de seguimiento de plantillas y metricas

**Archivo:** `src/pages/secretaria/PlantillasTracker.tsx` + `src/hooks/usePlantillasMetrics.ts`

**Implementar:**
- Hook `usePlantillasMetrics()`: calcula 5 leading indicators (velocidad redaccion, ratio retroceso, brecha disponibilidad, tiempo en estado, cobertura modos) + 3 lagging indicators
- Panel en SecretariaDashboard con estado de cada plantilla (BORRADOR/REVISADA/APROBADA/ACTIVA), bloqueantes, dias en estado actual
- Alertas visuales con tokens `--status-warning` y `--status-error` segun umbrales

**AC:**
- 4+ tests: metricas calculadas correctamente, alerta activada por umbral, plantilla retrocedida visible, cobertura modos < 80% → alerta
- Tokens Garrigues en todos los componentes

---

## Dependencias entre tareas

```
Fase 0 (Schema):
T1 ──→ T2 ──→ T3
T1 ──→ T3b (personas)
T1 ──→ T3c (role book + WORM triggers)
T3c ──→ T3d (plantillas)
T3b ──→ T3e (seed personas)
T3c ──→ T3f (seed roles)
T1 ──→ T3g (expediente sin sesion)
T3g + T3e ──→ T3h (seed expediente demo)

Fase 1 (Motor):
   T4 ──→ T5 ──→ T6
                   ╲
                    T11 ──→ T12 ──→ T14
                   ╱
          T7 ──→ T8 ──→ T9 ──→ T9b (motor sin sesion, depende de T4)
                         ╱         ╲
               T10 ────╱           T11 (orquestador consume motor sin sesion)
   T4 ──→ T24 (contrato de variables, depende de tipos congelados)

T13 (independiente, fix inmediato)
T13b (bordes no computables, depende de T4)
T13c (plantillas engine + TSQ/QSeal, depende de T3d + T4)
T13d (hook personas, depende de T3b + T4)

Fase 2 (Frontend + QTSP):
T14 ──→ T15, T16, T17, T18, T19 (paralelas)
T14 ──→ T21 (evidence bundle, depende de T13c)
T21 ──→ T22 (trust verification)
T14 ──→ T23 (QTSP firma + notificacion, depende de T15)
T13c ──→ T25 (metricas plantillas, depende de Gate PRE)

Fase 3 (Switch):
T15-T19, T21-T23, T25 ──→ T20
```

**Ruta critica:** T1 → T4 → T5 → T8 → T9 → T9b → T11 → T12 → T14 → T16 → T20

**Pista NO_SESSION:** T1 → T3g → T3h | T4 → T9b → T11 → T15b → T15c/T15d

**Pista QTSP (paralela a frontend):** T13c → T21 → T22 → T23

**Pista plantillas (paralela a motor):** T1 → T3d → T13c → T24 → T25

**Pista paralela independiente:** T1 → T3b → T3e → T13d (personas + capital)

**Pista paralela independiente:** T1 → T3c → T3d → T13c (role book + plantillas)

---

## Criterios de aceptacion globales

1. **`bun run build`** sin errores en todas las fases
2. **`tsc --noEmit`** sin errores
3. **Tests del motor**: 180+ tests unitarios en `src/lib/rules-engine/__tests__/` (incluyendo cobertura de los 3 flujos: colegiado, unipersonal, sin sesion; bordes no computables; plantillas; personas juridicas; conflicto de interes formalizado; golden tests G/W/T; evidence bundle; verificacion QTSP; +20 tests de T9b + 6 tests adicionales en T11 expansion + tests de T15b/T15c/T15d + tests de T24+T25+expanded T13c)
4. **Zero regresiones**: funcionalidad existente del modulo Secretaria no se rompe
5. **Tokens Garrigues**: todos los componentes modificados usan `var(--g-*)` y `var(--status-*)`, cero colores Tailwind nativos
6. **Explain auditable**: cada evaluacion produce explain con fuente, referencia legal, umbral y valor
7. **Seed completo**: 16 materias con Rule Packs v1.0.0 insertados en el tenant demo
8. **Personas**: al menos 1 persona juridica con representante designado, capital asignado a mandatos del Consejo
9. **Role book**: 6 roles operativos con RLS verificado (test de denegacion), `rule_change_audit` WORM
10. **Plantillas protegidas**: acta sesion + consignacion + certificacion con snapshot embebido, Gate PRE bloqueante
11. **Bordes no computables**: cotizadas rechazadas, consentimiento clase sin perimetro → BLOQUEO
12. **Snapshot sincrono**: hash del ruleset calculado sincrona e inmediatamente, nunca diferido
13. **Pactos parasociales**: estructura `PactosEvaluation` presente en tipo, sin logica real (Fase 2)
14. **service_role**: verificado que el frontend NUNCA usa la service_role key de Supabase
15. **WORM con triggers**: `worm_guard()` activo en `rule_evaluation_results`, `rule_change_audit` y `evidence_bundles` — verificado que UPDATE/DELETE lanzan excepcion
16. **Conflicto formalizado**: modelo EXCLUIR_QUORUM/VOTO/AMBOS operativo, denominador ajustado en quorum y mayoria, `capital_convocable = 0` → BLOCKING
17. **Gate hash + QSeal**: `gate_hash` calculado y sellado con QSeal del QTSP al proclamar acuerdo
18. **TSQ en evaluaciones**: toda fila en `rule_evaluation_results` porta `tsq_token` con sello cualificado de tiempo
19. **Firma QES**: actas y certificaciones firmables con QES via QTSP, con verificacion OCSP previa
20. **Notificacion certificada**: convocatorias SL notificables via eDelivery del QTSP con evidencia WORM
21. **Evidence bundle**: al menos 1 bundle generado y descargable como ASiC-E para acuerdo demo
22. **Golden tests G/W/T**: 6 tests juridicos del equipo legal implementados como golden tests en suite
23. **Contrato de variables**: YAML versionado generado desde tipos T4, CI test de congelacion activo, 3 bloques (MOTOR_REGLAS, USUARIO, QTSP)
24. **Gate PRE fallback**: 6 plantillas STRICT + NO_SESSION FALLBACK configurado, WARNING trazable en explain y evidence_bundle
25. **Metricas de plantillas**: panel de seguimiento con 5 leading + 3 lagging indicators, alertas por umbral
26. **7 plantillas minimas**: Acta Junta + Acta Consejo + Acta Consignacion + Acta Acuerdo Escrito + Certificacion + Convocatoria SA + Convocatoria SL, todas ACTIVAS antes de T20
27. **Proceso sin sesion E2E**: expediente NO_SESSION completable en tenant demo — unanimidad SL con firma QES, circulacion consejo con mayoria, decision socio unico
28. **Motor NO_SESSION diferenciado**: 5 gates con 3 variantes de evaluacion (unanimidad capital SL, circulacion consejo, decision unica), 20+ tests
29. **Respuestas WORM**: `no_session_respuestas` solo INSERT con trigger `worm_guard()`, firma QES en cada consentimiento
30. **7 plantillas minimas**: Acta Junta + Acta Consejo + Acta Consignacion + Acta Acuerdo Escrito + Certificacion + Convocatoria SA + Convocatoria SL

---

## Checklist de go-live (derivado del feedback del equipo legal)

| # | Control | Responsable | Estado |
|---|---|---|---|
| 1 | Plantillas protegidas activas y aprobadas para acta sesion, consignacion y certificacion | Comite Legal | Pendiente |
| 2 | Snapshot de reglas embebido en toda acta/certificacion renderizada (hash sincrono) | Motor V2 | Pendiente |
| 3 | RLS endurecido: test de denegacion por rol en rule_packs, overrides, evaluaciones | ADMIN | Pendiente |
| 4 | service_role key NO usada en frontend (verificar env vars Vercel) | ADMIN | Pendiente |
| 5 | Auditoria de cambios activa (rule_change_audit WORM, sin UPDATE/DELETE) | ADMIN | Pendiente |
| 6 | Bordes no computables activos: cotizadas rechazadas, consentimiento clase bloqueado | Motor V2 | Pendiente |
| 7 | Pactos parasociales: pista separada, no bloquean proclamacion | Motor V2 | Pendiente |
| 8 | Gate PRE documental activo: bloquea si plantilla no aprobada o variable faltante | Motor V2 | Pendiente |
| 9 | Persona juridica sin representante → BLOCKING (art. 212 bis) | Motor V2 | Pendiente |
| 10 | Capital asignado a mandatos para computo de quorum y mayorias | Seed | Pendiente |
| 11 | Perimetro de cotizadas excluido explicitamente en el motor | Motor V2 | Pendiente |
| 12 | Feature flag ENGINE_V2 activado y V1 deprecado tras 30+ evaluaciones sin divergencia | Switch | Pendiente |
| 13 | Conflicto de interes formalizado (EXCLUIR_QUORUM/VOTO/AMBOS) con politica tipificada | Motor V2 | Pendiente |
| 14 | Denominador ajustado en quorum y mayoria; `capital_convocable = 0` → BLOCKING | Motor V2 | Pendiente |
| 15 | Trigger `worm_guard()` activo en `rule_evaluation_results`, `rule_change_audit` y `evidence_bundles` | ADMIN | Pendiente |
| 16 | TSQ sellado en snapshot y evaluaciones WORM | Motor V2 + QTSP | Pendiente |
| 17 | QSeal en `gate_hash` de agreements | Motor V2 + QTSP | Pendiente |
| 18 | Firma QES operativa para acta y certificacion con verificacion OCSP | QTSP + Comite Legal | Pendiente |
| 19 | Notificacion certificada operativa para convocatorias SL | QTSP + Motor V2 | Pendiente |
| 20 | Evidence bundle generado y descargable como ASiC-E para al menos 1 acuerdo demo | Motor V2 + QTSP | Pendiente |
| 21 | Verificador de firmas/sellos/TSQ operativo (endpoint o incluido en bundle) | QTSP | Pendiente |
| 22 | Contrato de variables congelado (YAML v1.0.0) con CI test activo | Dev + Legal | Pendiente |
| 23 | 6 plantillas minimas en estado ACTIVA antes del switch T20 | Comite Legal | Pendiente |
| 24 | Gate PRE configurado: 6 STRICT + NO_SESSION FALLBACK | Motor V2 | Pendiente |
| 25 | Panel de seguimiento de plantillas operativo con alertas por umbral | Dev | Pendiente |
| 26 | Regla de estabilidad: CI bloquea merge sin campo impacto_contrato_variables | Dev | Pendiente |
| 27 | Expediente sin sesion operativo: migracion T3g aplicada, RLS verificado, WORM en respuestas/notificaciones | ADMIN | Pendiente |
| 28 | Motor NO_SESSION: 3 variantes evaluacion (unanimidad SL + circulacion consejo + decision unica) con 20+ tests | Motor V2 | Pendiente |
| 29 | Notificacion certificada QTSP integrada en ExpedienteSinSesionStepper Step 2 | QTSP | Pendiente |
| 30 | Firma QES de consentimientos operativa en Step 3 | QTSP | Pendiente |
