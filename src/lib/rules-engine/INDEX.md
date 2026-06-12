# Motor de Reglas LSC — Rules Engine Index

Implementación pura (sin side effects, sin DB, sin React/Supabase) del motor determinístico de gobernanza corporativa.

> **Estado del índice (2026-06-11, ITEM-117 / ITEM-119):** este documento se ha
> reescrito contra el código real del directorio. Antes describía 4 de los ~27
> módulos, listaba consumidores inexistentes y contradecía DL-2. La sección
> **Inventario de módulos** distingue ahora cada módulo como **VIVO** (tiene al
> menos un consumidor runtime, directo o transitivo) o **DEAD-CODE** (solo lo
> consumen tests). No se ha eliminado código en esta pasada; la decisión por
> módulo queda documentada para una limpieza posterior supervisada.

---

## Inventario de módulos (ITEM-117)

Liveness verificada por grep de importadores fuera de `rules-engine/` y de los
tests, y por trazabilidad transitiva a través del barrel `index.ts` y del
orquestador (`evaluarAcuerdoCompleto`, consumido por `usePreviewAcuerdo.ts` y
`useAgreementCompliance.ts`).

### Módulos VIVOS (consumidor runtime directo o transitivo)

| Módulo | Vía de consumo |
|---|---|
| `types.ts` | Tipos base de todo el motor (re-export `index.ts`). |
| `index.ts` | Barrel. Consumido por hooks/páginas/`lib/secretaria`. |
| `jerarquia-normativa.ts` | `resolverReglaEfectiva*` usado por `lib/secretaria` y hooks. |
| `rule-resolution.ts` | `resolveRulePackForMatter` + normalizadores (hooks `useRuleResolution`, `useRulePackForMateria`). |
| `convocatoria-engine.ts` | `evaluarConvocatoria` vía orquestador y consumo directo. |
| `constitucion-engine.ts` | `evaluarConstitucion` vía orquestador y consumo directo. |
| `majority-evaluator.ts` | `evaluarMayoria` (consumo directo en stepper/hooks). |
| `votacion-engine.ts` | `evaluarVotacion` vía orquestador (Flujos A–E, co-aprobación, solidario). |
| `no-session-engine.ts` | `evaluarProcesoSinSesion` invocado por `votacion-engine` (transitivo). |
| `documentacion-engine.ts` | `evaluarDocumentacion` invocado por orquestador (transitivo). |
| `pactos-engine.ts` | `evaluarPactosParasociales` (orquestador + consumo directo; 7 importadores). |
| `orquestador.ts` | `evaluarAcuerdoCompleto` consumido por `usePreviewAcuerdo` / `useAgreementCompliance`. |
| `meeting-adoption-snapshot.ts` | `buildMeetingAdoptionSnapshot` consumido por `lib/secretaria`. |
| `meeting-vote-completeness.ts` | `evaluateMeetingVoteCompleteness` consumido por `lib/secretaria`/hooks. |
| `agenda-item-engine.ts` | Taxonomía v3.1 de puntos; consumido por `lib/secretaria/acta-agenda`, `agenda-kind`, etc. |
| `compliance-gates.ts` | `buildCompliancePanelResult` / `gateFromEvaluation` consumidos por `PreviewGatePanel.tsx`. |
| `qtsp-integration.ts` | `verificarIntegridad`, `validarPreFirma` consumidos por `useQTSPVerification`/`useQTSPSign`. |
| `evidence-bundle.ts` | `sha256`, `computeManifestHashSync`, `generarVerificadorOffline` consumidos por doc-gen/hooks. |
| `comms-plazo-engine.ts` | Consumido por la capa de comunicaciones (1 importador externo). |

> Nota sobre exports parcialmente muertos en módulos vivos: el módulo es VIVO
> pero algunos símbolos exportados no tienen consumidor runtime, p. ej.
> `calcularDenominadorAjustado`, `validarCapitalUniversal` (constitucion-engine),
> `evaluateAgendaItemComplianceGate` (compliance-gates), `determinarAdoptionMode`,
> `componerPerfilSesion` (orquestador), `firmarDocumentoQES`, `notificarCertificado`
> (qtsp-integration), `generarEvidenceBundle`, `empaquetarASiCE` (evidence-bundle).
> Son candidatos a poda de export, no a borrado de archivo.

### Módulos DEAD-CODE (sin consumidor runtime — solo tests)

| Módulo | Símbolo(s) | Decisión |
|---|---|---|
| `bordes-no-computables.ts` | `evaluarBordesNoComputables` (DL-2) | **MANTENER (candidato a cablear).** Valor jurídico inmediato (cotizada, art. 182/213/224/305 LSC). DL-2 ya resuelta: emite WARNING + advertencias LMV, **no** bloquea. |
| `plazos-engine.ts` | canales cotizada CNMV/BORME (art. 517 LSC) | **MANTENER (candidato a cablear).** Valor jurídico inmediato. |
| `related-party-engine.ts` | operaciones vinculadas (art. 231 LSC) | **MANTENER (candidato a cablear).** Valor jurídico inmediato. |
| `capital-voting.ts` | cómputo de capital/voto | MANTENER. Reservado; sin consumidor. |
| `agreement-dependency-validator.ts` | validación de dependencias entre acuerdos | MANTENER. Reservado; sin consumidor. |
| `effective-rule.ts` | `buildEffectiveRuleProjection` | **SUPERSEDED** por `fn_secretaria_materialize_effective_rule_matrix` (server-side). Candidato a archivar/eliminar tras confirmar la vía server-side. |
| `rule-evaluation-persistence.ts` | `buildRuleEvaluationResultInsert` | **SUPERSEDED** por `fn_save_meeting_resolutions` (server-side). Candidato a archivar/eliminar. |
| `plantillas-gate-config.ts` | configuración de gate de plantillas | **SUPERSEDED.** La configuración viva del gate vive en `template-admin/` (`gate-pre.ts` / `gate-pre-semantic.ts`). Candidato a archivar. |
| `plantillas-engine.ts` (parcial) | `evaluarPlantillaProtegida`, `GO_LIVE_CONFIG`, `calcularRulesetSnapshotId`, `resolverPlantillaConvocatoria` (DL-4) | DEAD-CODE en runtime. Ver **DL-4 (ITEM-119)** abajo. |

> El hook `src/hooks/useMatterRegistry.ts` (resolución `materia_template_binding`)
> también carece de consumidores runtime; queda fuera del `rules-engine/` pero se
> anota aquí por coherencia con el inventario del motor.

---

## DL-4 — selección de plantilla de convocatoria por tipo social (ITEM-119)

La selección automática de plantilla de convocatoria por tipo social existe
**dos veces**. La conducta efectiva es correcta, pero la divergencia invita a
regresiones. Decisión documentada:

- **VIVA / CANÓNICA en runtime:** lógica **inline en `ConvocatoriasStepper.tsx`**
  (`convocatoriaTemplateTypes`, líneas ~1109–1115). Establece el orden de
  preferencia por tipo social: `SL`/`SLU` → `[CONVOCATORIA_SL_NOTIFICACION,
  CONVOCATORIA]`; `SA`/`SAU` → `[CONVOCATORIA, CONVOCATORIA_SL_NOTIFICACION]`.
  Cubre los **4** valores de `TipoSocial` (`SA | SL | SLU | SAU`) y es la que
  realmente ejecuta en la UI.
- **SUPERSEDED / DEAD-CODE:** `resolverPlantillaConvocatoria` en
  `plantillas-engine.ts` (líneas ~444–478, refs art. 173.1/173.2 LSC). Tiene
  tests pero **0 consumidores runtime** y está tipada solo para `'SA' | 'SL'`
  (no contempla `SLU`/`SAU`). **No usar como fuente de verdad.** Cualquier cambio
  legal debe aplicarse a la lógica inline de `ConvocatoriasStepper` (o, si se
  consolida, extraer una única función ampliada a `SLU`→régimen SL y
  `SAU`→régimen SA y consumirla desde el stepper, retirando esta versión).

---

## Detalle de funciones por módulo (referencia)

### `rule-resolution.ts`
Capa canónica para resolver qué versión de regla aplica antes de ejecutar un stepper o campaña.

**Funciones principales:**
```typescript
normalizeRuleLifecycleStatus(row)
normalizeRulePackVersion(row)
resolveRulePackForMatter(input)
```

**Responsabilidades:**
- Normalizar esquemas legacy (`is_active`, `payload`, `version`) y lifecycle jurídico (`status`, `params`, `version_tag`).
- Seleccionar versión por materia, órgano, clase, vigencia y estado.
- Bloquear en producción cualquier versión que no esté `ACTIVE`.
- Permitir `APPROVED` solo en UAT cuando se solicita expresamente.
- Incluir overrides aplicables en el `rulesetSnapshotId`.
- Devolver un contrato único `RuleResolution` para UI, campañas y motor.

### `agenda-item-engine.ts`
Frontera canónica entre punto del orden del día y acuerdo.

**Funciones principales:**
```typescript
normalizeAgendaItemKind(value)
evaluarPuntoOrdenDia(input)
shouldRunAgreementGatesForAgendaItem(input)
```

**Responsabilidades:**
- Normalizar la taxonomía v3.1 de puntos: `DECISORIO`, `INFORMATIVO`,
  `TOMA_DE_RAZON`, `DELIBERATIVO`, `ACEPTACION_INFORME`, `RUEGOS_PREGUNTAS`.
- Permitir FULL_GATE del motor solo para `DECISORIO`.
- Bloquear de forma determinista cualquier intento de materializar Acuerdo 360
  sobre un punto no decisorio.
- Mapear puntos no decisorios a outcomes de constancia para acta.

### `bordes-no-computables.ts`  *(DEAD-CODE — candidato a cablear, DL-2)*
Evaluación de 7 "bordes no-computables" — edge cases que el motor determinístico no puede resolver sin intervención externa.

**Función principal:**
```typescript
evaluarBordesNoComputables(input: BordeInput): ReglaNoComputable[]
```

**Los 7 bordes:**
1. **BORDE_COTIZADA** — Entidad cotizada → WARNING + advertencias LMV (DL-2: evalúa LSC y continúa, **no** bloquea; **sin** early-return)
2. **BORDE_CONSENTIMIENTO_CLASE** — Consentimiento de clase en materias estatutarias
   - Sin perimetro definido → BLOCKING
   - Con perimetro pero no resuelto → BLOCKING
   - Resuelto → INFO
3. **BORDE_LIQUIDEZ** — Suficiencia de liquidez para REPARTO_DIVIDENDOS
   - No verificada → BLOCKING
   - Verificada → INFO
4. **BORDE_INDELEGABILIDAD** — Verificación de indelegabilidad de materias
   - No verificada → WARNING
   - Verificada → INFO
5. **BORDE_JUNTA_TELEMATICA** — Previsión estatutaria (art. 182 LSC)
   - Sin checklist → BLOCKING
   - Con checklist → INFO
6. **BORDE_PUBLICACION_SA** — Publicación en BORME (art. 224 LSC)
   - Sin evidencia → WARNING
   - Con evidencia → INFO
7. **BORDE_NOTIFICACION_SL** — Notificación individual (art. 213 LSC)
   - Sin evidencia → WARNING
   - Con evidencia → INFO

**Return:** Array vacío si ninguno aplica. `BORDE_COTIZADA` añade 1 item de WARNING pero **no** finaliza la evaluación del resto de bordes (DL-2, 2026-04-19).

### `plantillas-engine.ts`  *(DEAD-CODE en runtime — SUPERSEDED, ver DL-4)*
Gate PRE de verificación de plantillas documentarias antes de su uso. **Sin
consumidor runtime.** El gate vivo en producción vive en `template-admin/`
(`gate-pre.ts` / `gate-pre-semantic.ts`).

**Funciones principales:**

```typescript
evaluarPlantillaProtegida(input: PlantillaEvalInput): PlantillaEvalOutput
calcularRulesetSnapshotId(params: unknown, overrides?: unknown[]): string
resolverPlantillaConvocatoria(tipoSocial, tipoActaRequerido)   // DL-4 — SUPERSEDED por la lógica inline de ConvocatoriasStepper
```

**Modos de Gate:**
- **DISABLED:** Siempre retorna `ok=true` (validación deshabilitada)
- **STRICT:** Exige plantilla exacta (ACTIVA/APROBADA), sin fallbacks
- **FALLBACK:** Intenta exacta → fallback → BLOCKING si nada

**Validaciones:**
- Plantilla status (ACTIVA/APROBADA solamente)
- Variables requeridas (source=USUARIO; MOTOR_REGLAS ignoradas)
- Matching adoption_mode y organo_tipo
- Ruleset snapshot ID (si aplicable)
- Protecciones de contenido (secciones inmutables, hash)

**GO_LIVE_CONFIG:**
7 rules pre-configuradas:
1. ACTA_SESION + MEETING → STRICT
2. ACTA_SESION + CONSEJO → STRICT
3. ACTA_CONSIGNACION_SOCIO → STRICT
4. ACTA_CONSIGNACION_ADMIN → STRICT
5. CERTIFICACION → STRICT
6. CONVOCATORIA → STRICT
7. ACTA_ACUERDO_ESCRITO + NO_SESSION → FALLBACK

---

## Test Files

#### `__tests__/bordes-no-computables.test.ts`
**15 test cases** cobriendo:
- Cotizadas → WARNING (DL-2) + continuación del resto de bordes
- Consentimiento clase (sin perimetro, no resuelto, resuelto)
- Liquidez (no verificada, verificada)
- Indelegabilidad (no verificada, verificada)
- Junta telemática (sin checklist, con checklist)
- Publicación SA (sin evidencia, con evidencia)
- Notificación SL (sin evidencia, con evidencia)
- Entidad normal sin bordes → empty array
- Múltiples bordes en un input
- Materias que activan clase (FUSION, TRANSFORMACION)
- Determinismo (same input = same output)

#### `__tests__/plantillas-engine.test.ts`
**15 test cases** cobriendo:
- Hash determinístico (calcularRulesetSnapshotId)
- Exact match (ACTIVA, APROBADA)
- Rejection de BORRADOR
- Variables required (USUARIO vs MOTOR_REGLAS)
- STRICT mode (sin fallback)
- FALLBACK mode (con fallback)
- DISABLED mode (siempre OK)
- Adoption mode matching
- Organo tipo filtering
- Ruleset snapshot ID validation
- Explain chain populated
- GO_LIVE_CONFIG structure
- Determinismo
- No plantillas available

> Nota: estos tests cubren código DEAD-CODE en runtime. Si se retira
> `resolverPlantillaConvocatoria`, sus tests deben trasladarse a la lógica inline
> de `ConvocatoriasStepper` (ITEM-119).

## Types

### Shared
```typescript
type EvalSeverity = 'OK' | 'WARNING' | 'BLOCKING';
```

### bordes-no-computables.ts
```typescript
type BordeStatus = 'RESUELTO' | 'PENDIENTE' | 'FUERA_DE_ALCANCE';

interface BordeInput {
  esCotizada: boolean;
  tipoSocial: 'SA' | 'SL';
  materias: string[];
  consentimientoClaseResuelto?: boolean;
  perimetroClaseDefinido?: boolean;
  liquidezVerificada?: boolean;
  indelegabilidadVerificada?: boolean;
  juntaTelematicaChecklist?: boolean;
  evidenciaPublicacionSA?: boolean;
  evidenciaNotificacionSL?: boolean;
}

interface ReglaNoComputable {
  id: string;
  nombre: string;
  condicion: string;
  aplica: boolean;
  status: BordeStatus;
  severity: EvalSeverity;
  resolucion?: string;
}
```

### plantillas-engine.ts
```typescript
type AdoptionMode =
  | 'MEETING'
  | 'UNIVERSAL'
  | 'NO_SESSION'
  | 'UNIPERSONAL_SOCIO'
  | 'UNIPERSONAL_ADMIN';

interface PlantillaProtegida {
  id: string;
  tipo: string;
  adoption_mode?: string;           // comma-separated
  organo_tipo?: string;              // null = todos
  status: 'BORRADOR' | 'ACTIVA' | 'APROBADA' | 'ARCHIVADA';
  variables: Array<{
    key: string;
    source: 'USUARIO' | 'MOTOR_REGLAS';
    required: boolean;
  }>;
  protecciones?: {
    secciones_inmutables?: string[];
    hash_contenido?: string;
  };
  ruleset_snapshot_id?: string;
}

interface PlantillaGateRule {
  id: string;
  tipo_requerido: string;
  adoption_modes: string[];
  organo_tipos?: string[];          // null = todos
  modo: 'STRICT' | 'FALLBACK' | 'DISABLED';
  fallback_tipo?: string;
}

interface PlantillaGateConfig {
  rules: PlantillaGateRule[];
  default_mode: 'STRICT' | 'FALLBACK' | 'DISABLED';
}

interface PlantillaEvalInput {
  adoptionMode: AdoptionMode;
  organoTipo: string;
  tipoActaRequerido: string;
  plantillasDisponibles: PlantillaProtegida[];
  variablesResueltas: Record<string, unknown>;
  gateConfig: PlantillaGateConfig;
  rulesetSnapshotId?: string;
}

interface PlantillaEvalOutput {
  ok: boolean;
  severity: EvalSeverity;
  plantillaUsada?: string;
  plantillaEsperada?: string;
  esFallback: boolean;
  explain: ExplainNode[];
  blocking_issues: string[];
  warnings: string[];
}

interface ExplainNode {
  regla: string;
  fuente: Fuente;
  referencia?: string;
  umbral?: number | string;
  valor?: number | string;
  resultado: EvalSeverity;
  mensaje: string;
  hijos?: ExplainNode[];
}
```

## Contrato de Pureza

Todas las funciones son **PURE**:
- ✅ Determinísticas (same input → same output)
- ✅ Sin side effects (sin mutaciones, sin I/O, sin DB)
- ✅ Sin imports de React, Supabase, node.js
- ✅ Cálculos locales solamente
- ✅ Retorno de tipos estructurados

## Integración (consumidores reales)

El motor se consume desde la capa de hooks/`lib/secretaria`/páginas vía el barrel
`@/lib/rules-engine` (no existe `src/hooks/useMotorReglas.ts` ni `src/domain/`).
Consumidores reales del barrel:

- `src/hooks/useAgreementCompliance.ts` — orquestador (`evaluarAcuerdoCompleto`).
- `src/hooks/usePreviewAcuerdo.ts` — orquestador (preview).
- `src/hooks/useRuleResolution.ts`, `src/hooks/useRulePackForMateria.ts` — `resolveRulePackForMatter`.
- `src/hooks/useQTSPSign.ts`, `src/hooks/useQTSPVerification.ts` — `qtsp-integration`.
- `src/hooks/useReunionSecretaria.ts`, `src/hooks/useActas.ts` — snapshot/votación.
- `src/lib/secretaria/*` (dual-evaluation, acta-agenda, meeting-agenda, agreement-360,
  certification-snapshot, matter-execution-profile, agenda-kind, organo-resolver,
  prototype-rule-pack-fallback).
- Páginas: `ConvocatoriasStepper.tsx`, `ReunionStepper.tsx`, `ActaDetalle.tsx`,
  `GenerarDocumentoStepper.tsx`, `DecisionUnipersonalStepper.tsx`, `ExpedienteAcuerdo.tsx`.
- `src/components/secretaria/PreviewGatePanel.tsx` — `compliance-gates`.

> Deuda anotada (no corregida en esta pasada): en `orquestador.ts` (~123–129) las
> claves de override aplicadas (`'antelacion_dias'` / `'quorum'`) no coinciden con
> las claves reales de Cloud (`'convocatoria_antelacion_dias'` /
> `'constitucion_quorum_pct'`). Relevante solo si `componerPerfilSesion` se cablea
> (hoy export muerto).

## Ejecución de Tests

```bash
# Todos los tests del motor
bun test src/lib/rules-engine/__tests__/

# Tests específicos
bun test bordes-no-computables.test.ts
bun test plantillas-engine.test.ts
```

## Referencias Legales

- **art. 173 LSC:** Forma de convocatoria SA/SL (DL-4 — selección de plantilla)
- **art. 182 LSC:** Junta telemática (previsión estatutaria)
- **art. 213 LSC:** Notificación SL (convocatoria)
- **art. 224 LSC:** Publicación SA (BORME)
- **art. 231 LSC:** Operaciones vinculadas (related-party-engine)
- **art. 273 LSC:** Reparto de dividendos (suficiencia liquidez)
- **art. 305 LSC:** Consentimiento de clase (acuerdos que afecten clases)
- **art. 517 LSC:** Canales de difusión en cotizada (plazos-engine)
