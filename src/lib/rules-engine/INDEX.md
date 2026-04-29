# Motor de Reglas LSC — Rules Engine Index

Implementación pura (sin side effects, sin DB, sin React/Supabase) del motor determinístico de gobernanza corporativa.

## Archivos

### Core Functions

#### `rule-resolution.ts`
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

#### `bordes-no-computables.ts`
Evaluación de 7 "bordes no-computables" — edge cases que el motor determinístico no puede resolver sin intervención externa.

**Función principal:**
```typescript
evaluarBordesNoComputables(input: BordeInput): ReglaNoComputable[]
```

**Los 7 bordes:**
1. **BORDE_COTIZADA** — Entidad cotizada → FUERA_DE_ALCANCE (bloqueo total, retorna immediate)
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

**Return:** Array vacío si ninguno aplica. Si `esCotizada=true`, retorna 1 item y finaliza.

#### `plantillas-engine.ts`
Gate PRE de verificación de plantillas documentarias antes de su uso.

**Funciones principales:**

```typescript
evaluarPlantillaProtegida(input: PlantillaEvalInput): PlantillaEvalOutput

calcularRulesetSnapshotId(params: unknown, overrides?: unknown[]): string
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

### Test Files

#### `__tests__/bordes-no-computables.test.ts`
**15 test cases** cobriendo:
- Cotizadas → FUERA_DE_ALCANCE
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

## Types

### Shared
```typescript
type EvalSeverity = 'BLOCKING' | 'WARNING' | 'CRITICAL' | 'INFO';
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
  step: string;
  result: boolean;
  detail: string;
}
```

## Contrato de Pureza

Todas las funciones son **PURE**:
- ✅ Determinísticas (same input → same output)
- ✅ Sin side effects (sin mutaciones, sin I/O, sin DB)
- ✅ Sin imports de React, Supabase, node.js
- ✅ Cálculos locales solamente
- ✅ Retorno de tipos estructurados

## Integración

Estas funciones serán consumidas por:
- `src/hooks/useMotorReglas.ts` — hook que encapsula la lógica
- `src/pages/secretaria/AccuerdoDetalle.tsx` — validación pre-aprobación
- `src/domain/agreements/validation.ts` — pipeline de validación
- `backend/app/domain/secretaria/motor_service.py` — espejo servidor

## Ejecución de Tests

```bash
cd /sessions/determined-confident-pascal/mnt/arga-governance-map

# Todos los tests del motor
npm run test -- src/lib/rules-engine/__tests__/

# Tests específicos
npm run test -- bordes-no-computables.test.ts
npm run test -- plantillas-engine.test.ts
```

## Referencias Legales

- **art. 182 LSC:** Junta telemática (previsión estatutaria)
- **art. 213 LSC:** Notificación SL (convocatoria)
- **art. 224 LSC:** Publicación SA (BORME)
- **art. 273 LSC:** Reparto de dividendos (suficiencia liquidez)
- **art. 305 LSC:** Consentimiento de clase (acuerdos que afecten clases)
