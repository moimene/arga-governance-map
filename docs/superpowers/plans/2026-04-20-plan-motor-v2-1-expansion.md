# Motor de Reglas LSC v2.1 — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expandir el motor de reglas de 16 a 28 rule packs, añadir modos CO_APROBACION y SOLIDARIO, implementar MVP de pactos parasociales y actualizar el contrato de variables a v1.1.

**Architecture:** Spec completa en `docs/legal-team/specs acuerdos/Especificacion_Tecnica_Motor_Reglas_LSC_v2_1.docx`. Ruta crítica: T4-ext → T9-ext → T11-ext → D4-engine → D4-integration. Track paralelo: T1-pactos → T2-pactos (convergencia en D4-engine). T2-ext es independiente.

**Tech Stack:** React 18 + TypeScript (`noImplicitAny: false`, `strictNullChecks: false`) + Supabase + Vitest. Todos los tokens de color: `var(--g-*)` y `var(--status-*)`.

---

## Ruta crítica

```
T4-ext ──→ T9-ext ──→ T11-ext ──→ D4-engine ──→ D4-integration
                                        ↑
T1-pactos ──→ T2-pactos ────────────────┘
T2-ext (independiente, paralelo)
```

---

## Task 1: T4-ext — Tipos expandidos (types.ts)

**Files:**
- Modify: `src/lib/rules-engine/types.ts`

- [ ] **Extender `AdoptionMode`** — añadir `'CO_APROBACION'` y `'SOLIDARIO'`:

```typescript
export type AdoptionMode =
  | 'MEETING'
  | 'UNIVERSAL'
  | 'NO_SESSION'
  | 'UNIPERSONAL_SOCIO'
  | 'UNIPERSONAL_ADMIN'
  | 'CO_APROBACION'  // nuevo: co-aprobación k-de-n sin sesión formal
  | 'SOLIDARIO';     // nuevo: administrador solidario actúa individualmente
```

- [ ] **Añadir `ExecutionMode`** y sus configs:

```typescript
export interface CoAprobacionConfig {
  k: number;
  n: number;
  ventanaConsenso: string;  // e.g. "15d"
  estatutosPermitenSinSesion: boolean;
  firmas: Array<{ adminId: string; fechaFirma: string; hashDocumento: string }>;
}

export interface SolidarioConfig {
  adminActuante: string;
  restriccionesEstatutarias: Array<{
    materia: string;
    requiereCofirma: boolean;
    cofirmantes?: string[];
  }>;
  vigenciaDesde: string;
  vigenciaHasta?: string;
}

export type ExecutionMode =
  | { tipo: 'SESION' }
  | { tipo: 'CO_APROBACION'; config: CoAprobacionConfig }
  | { tipo: 'SOLIDARIO'; config: SolidarioConfig };
```

- [ ] **Extender `TipoActa`** — añadir `'ACTA_ORGANO_ADMIN'`:

```typescript
export type TipoActa =
  | 'ACTA_JUNTA'
  | 'ACTA_CONSEJO'
  | 'ACTA_CONSIGNACION_SOCIO'
  | 'ACTA_CONSIGNACION_ADMIN'
  | 'ACTA_DECISION_CONJUNTA'
  | 'ACTA_ACUERDO_ESCRITO'
  | 'ACTA_ORGANO_ADMIN';  // nuevo
```

- [ ] **Añadir tipos de pactos parasociales**:

```typescript
export type TipoClausulaPacto =
  | 'VETO_MATERIA' | 'MAYORIA_REFORZADA' | 'CONSENTIMIENTO_INVERSOR'
  | 'TAG_ALONG' | 'DRAG_ALONG' | 'ROFR' | 'LOCK_UP'
  | 'CAPEX_THRESHOLD' | 'DEBT_LIMIT' | 'RESERVED_MATTERS'
  | 'BUDGET_CONTROL' | 'RPT_CONTROL' | 'DIVIDEND_POLICY' | 'COC';

export interface ClausulaPacto {
  id: string;
  tipo: TipoClausulaPacto;
  materiaAmbito: string[];
  titulares: Array<{ id: string; tipo: 'PERSONA' | 'BLOQUE' | 'CLASE' }>;
  umbral?: { valor: number; unidad: 'PCT' | 'EUR' | 'DIAS' };
  ventanaRespuestaDias?: number;
  estatutarizada: boolean;
  efectoIncumplimiento: 'ALERTA' | 'BLOQUEO_PACTO' | 'MEDIACION' | 'ARBITRAJE';
}

export interface PactosEvaluation {
  aplica: boolean;
  clausulasEvaluadas: Array<{
    clausulaId: string;
    tipo: TipoClausulaPacto;
    ok: boolean;
    explain: ExplainNode;
  }>;
  pactoOk: boolean | null;
}

export interface PactoParasocial {
  id: string;
  entityId: string;
  pactoRef: string;
  fechaPacto: string;
  partes: string[];
  clausulas: ClausulaPacto[];
  estado: 'VIGENTE' | 'RESUELTO' | 'SUSPENDIDO';
}
```

- [ ] **Extender `RulePack`** — añadir campo `reglaEspecifica` opcional:

```typescript
export interface RulePack {
  // ... existing fields ...
  reglaEspecifica?: Record<string, unknown>;  // nuevo v2.1
}
```

- [ ] Run `npx tsc --noEmit` — 0 errores
- [ ] Run `npx vitest run` — todos los tests pasan (342/342)
- [ ] Commit: `git add src/lib/rules-engine/types.ts && git commit -m "feat(motor): T4-ext — AdoptionMode CO_APROBACION/SOLIDARIO + tipos pactos parasociales v2.1"`

---

## Task 2: T1-pactos — Migración SQL tablas pactos

**Files:**
- Create: `supabase/migrations/20260420_000015_pactos_parasociales.sql`

- [ ] **Crear tabla `pactos_parasociales`**:

```sql
CREATE TABLE pactos_parasociales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  entity_id UUID NOT NULL REFERENCES entities(id),
  pacto_ref TEXT NOT NULL,
  fecha_pacto TIMESTAMPTZ NOT NULL,
  partes JSONB NOT NULL,
  estado TEXT NOT NULL CHECK (estado IN ('VIGENTE', 'RESUELTO', 'SUSPENDIDO')),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

- [ ] **Crear tabla `pacto_clausulas`**:

```sql
CREATE TABLE pacto_clausulas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pacto_id UUID NOT NULL REFERENCES pactos_parasociales(id),
  tipo TEXT NOT NULL CHECK (tipo IN (
    'VETO_MATERIA', 'MAYORIA_REFORZADA', 'CONSENTIMIENTO_INVERSOR',
    'TAG_ALONG', 'DRAG_ALONG', 'ROFR', 'LOCK_UP',
    'CAPEX_THRESHOLD', 'DEBT_LIMIT', 'RESERVED_MATTERS',
    'BUDGET_CONTROL', 'RPT_CONTROL', 'DIVIDEND_POLICY', 'COC'
  )),
  materia_ambito JSONB NOT NULL,
  titulares JSONB NOT NULL,
  umbral JSONB,
  ventana_respuesta_dias INT,
  estatutarizada BOOLEAN DEFAULT false,
  efecto_incumplimiento TEXT CHECK (efecto_incumplimiento IN (
    'ALERTA', 'BLOQUEO_PACTO', 'MEDIACION', 'ARBITRAJE'
  )),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

- [ ] **Crear tabla `pacto_evaluacion_results` (WORM)**:

```sql
CREATE TABLE pacto_evaluacion_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  agreement_id UUID NOT NULL REFERENCES agreements(id),
  pacto_id UUID NOT NULL REFERENCES pactos_parasociales(id),
  pacto_ok BOOLEAN NOT NULL,
  explain JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION worm_guard() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'WORM violation: % on % is prohibited', TG_OP, TG_TABLE_NAME;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_worm_pacto_eval
  BEFORE UPDATE OR DELETE ON pacto_evaluacion_results
  FOR EACH ROW EXECUTE FUNCTION worm_guard();
```

- [ ] **Índices**:

```sql
CREATE INDEX idx_pactos_entity ON pactos_parasociales(entity_id);
CREATE INDEX idx_pactos_tenant ON pactos_parasociales(tenant_id);
CREATE INDEX idx_clausulas_pacto ON pacto_clausulas(pacto_id);
CREATE INDEX idx_eval_agreement ON pacto_evaluacion_results(agreement_id);
```

- [ ] **RLS** (seguir patrón del proyecto: usar `secretaria_role_assignments` o `tenant_id` según lo que existe)

- [ ] **Migración AdoptionMode**: crear `supabase/migrations/20260420_000016_extend_adoption_mode.sql`:

```sql
ALTER TABLE agreements ADD COLUMN IF NOT EXISTS execution_mode JSONB;
ALTER TABLE agreements ADD CONSTRAINT IF NOT EXISTS chk_execution_mode_tipo
  CHECK (execution_mode IS NULL OR execution_mode->>'tipo' IN ('SESION', 'CO_APROBACION', 'SOLIDARIO'));
ALTER TABLE entities ADD COLUMN IF NOT EXISTS admin_solidario_restricciones JSONB;
```

- [ ] Run `npx tsc --noEmit` — 0 errores
- [ ] Commit: `git add supabase/migrations/20260420_000015_pactos_parasociales.sql supabase/migrations/20260420_000016_extend_adoption_mode.sql && git commit -m "feat(db): T1-pactos — tablas pactos parasociales WORM + execution_mode en agreements"`

---

## Task 3: T2-ext — Seed 12 nuevos rule packs (INDEPENDIENTE — se puede hacer en paralelo)

**Files:**
- Create: `supabase/migrations/20260420_000017_seed_rule_packs_v2.sql`

Insertar los 12 nuevos rule packs. Los JSONs completos están en `docs/legal-team/specs acuerdos/Especificacion_Tecnica_Motor_Reglas_LSC_v2_1.docx` sección 5.

Los 12 packs son (con su `organoTipo`):

| Pack ID | Materia | organoTipo |
|---|---|---|
| DELEGACION_FACULTADES | Delegación facultades | CONSEJO |
| COOPTACION | Cooptación consejeros SA | CONSEJO |
| DIVIDENDO_A_CUENTA | Dividendo a cuenta | CONSEJO |
| EJECUCION_AUMENTO_DELEGADO | Ejecución aumento delegado | CONSEJO |
| TRASLADO_DOMICILIO | Traslado domicilio España | CONSEJO |
| CUENTAS_CONSOLIDADAS | Cuentas consolidadas | CONSEJO |
| INFORME_GESTION | Informe de gestión | CONSEJO |
| OPERACION_VINCULADA | Operación vinculada | CONSEJO |
| NOMBRAMIENTO_AUDITOR | Nombramiento auditor | JUNTA_GENERAL |
| APROBACION_PRESUPUESTO | Presupuesto anual | CONSEJO |
| AUTORIZACION_GARANTIA | Garantía/aval corporativo | JUNTA_GENERAL (si >25% activo) o CONSEJO |
| RATIFICACION_ACTOS | Ratificación actos sin autorización | CONSEJO o JUNTA_GENERAL |

- [ ] Leer el contenido JSON de la sección 5 del docx (ya disponible en el contexto del plan)
- [ ] Para cada pack: INSERT INTO `rule_packs` + INSERT INTO `rule_pack_versions` con `payload` JSONB completo que incluya todos los campos del spec: `convocatoria`, `constitucion`, `votacion`, `documentacion`, `plazosMateriales`, `postAcuerdo`, `acta`, `reglaEspecifica`
- [ ] Usar `ON CONFLICT (materia, tenant_id) DO UPDATE SET ...` para idempotencia
- [ ] Verificar counts: 12 nuevos packs insertados
- [ ] Run `npx tsc --noEmit` — 0 errores
- [ ] Commit: `git add supabase/migrations/20260420_000017_seed_rule_packs_v2.sql && git commit -m "feat(db): T2-ext — seed 12 nuevos rule packs LSC v2.1 (28 packs totales)"`

---

## Task 4: T9-ext — Ramas CO_APROBACION y SOLIDARIO en votacion-engine

**Files:**
- Modify: `src/lib/rules-engine/votacion-engine.ts`
- Create helper functions (inline in votacion-engine or in new file `src/lib/rules-engine/co-aprobacion-engine.ts`)

- [ ] Leer `src/lib/rules-engine/votacion-engine.ts` para entender la estructura actual del dispatcher

- [ ] **Añadir función `evaluarCoAprobacion`**:

```typescript
export interface CoAprobacionResult {
  ok: boolean;
  explain: ExplainNode;
}

export function evaluarCoAprobacion(
  config: CoAprobacionConfig,
  adminVigentes: string[],  // IDs de admins vigentes a la fecha
  fechaAcuerdo: string
): CoAprobacionResult {
  const { k, n, firmas, ventanaConsenso, estatutosPermitenSinSesion } = config;

  if (!estatutosPermitenSinSesion) {
    return { ok: false, explain: { id: 'CO_APROBACION_NO_PERMITIDA', resultado: 'FAIL', mensaje: 'Los estatutos no permiten adopción sin sesión formal', hijos: [] } };
  }

  const firmasValidas = firmas.filter(f => adminVigentes.includes(f.adminId));
  if (firmasValidas.length < k) {
    return { ok: false, explain: { id: 'FIRMAS_INSUFICIENTES', resultado: 'FAIL', mensaje: `Se requieren ${k} de ${n} firmas. Válidas: ${firmasValidas.length}`, hijos: [] } };
  }

  const uniqueSigners = new Set(firmasValidas.map(f => f.adminId));
  if (uniqueSigners.size < firmasValidas.length) {
    return { ok: false, explain: { id: 'FIRMAS_DUPLICADAS', resultado: 'FAIL', mensaje: 'Se detectaron firmas duplicadas', hijos: [] } };
  }

  // Validate ventana consenso (parse "15d" → 15 days in ms)
  const days = parseInt(ventanaConsenso.replace('d', ''), 10);
  const windowMs = days * 24 * 60 * 60 * 1000;
  const fechas = firmasValidas.map(f => new Date(f.fechaFirma).getTime());
  const spread = Math.max(...fechas) - Math.min(...fechas);
  if (spread > windowMs) {
    return { ok: false, explain: { id: 'VENTANA_EXCEDIDA', resultado: 'FAIL', mensaje: `Las firmas exceden la ventana de consenso de ${ventanaConsenso}`, hijos: [] } };
  }

  return { ok: true, explain: { id: 'CO_APROBACION_OK', resultado: 'OK', mensaje: `${firmasValidas.length}/${n} firmas válidas (k=${k})`, hijos: [] } };
}
```

- [ ] **Añadir función `evaluarSolidario`**:

```typescript
export interface SolidarioResult {
  ok: boolean;
  explain: ExplainNode;
}

export function evaluarSolidario(
  config: SolidarioConfig,
  adminVigentes: string[],
  materia: string,
  fechaAcuerdo: string,
  firmasPresentes?: string[]  // adminIds que han firmado
): SolidarioResult {
  const { adminActuante, restriccionesEstatutarias, vigenciaDesde, vigenciaHasta } = config;

  if (!adminVigentes.includes(adminActuante)) {
    return { ok: false, explain: { id: 'ADMIN_NO_VIGENTE', resultado: 'FAIL', mensaje: `Administrador ${adminActuante} no vigente a fecha del acuerdo`, hijos: [] } };
  }

  const fecha = new Date(fechaAcuerdo).getTime();
  if (fecha < new Date(vigenciaDesde).getTime() || (vigenciaHasta && fecha > new Date(vigenciaHasta).getTime())) {
    return { ok: false, explain: { id: 'FUERA_VIGENCIA', resultado: 'FAIL', mensaje: 'La actuación cae fuera del período de vigencia del administrador', hijos: [] } };
  }

  const restriccion = restriccionesEstatutarias.find(r => r.materia === materia);
  if (restriccion?.requiereCofirma) {
    if (!restriccion.cofirmantes?.length) {
      return { ok: false, explain: { id: 'COFIRMA_REQUERIDA', resultado: 'FAIL', mensaje: `La materia ${materia} requiere cofirma según estatutos`, hijos: [] } };
    }
    const cofirmaPresente = restriccion.cofirmantes.some(c => firmasPresentes?.includes(c));
    if (!cofirmaPresente) {
      return { ok: false, explain: { id: 'COFIRMA_AUSENTE', resultado: 'FAIL', mensaje: 'No se encontró la cofirma requerida por estatutos', hijos: [] } };
    }
  }

  return { ok: true, explain: { id: 'SOLIDARIO_OK', resultado: 'OK', mensaje: `Administrador ${adminActuante} autorizado para ${materia}`, hijos: [] } };
}
```

- [ ] **Actualizar el dispatcher en `votacion-engine.ts`** para que reconozca los nuevos modos. Buscar el switch/if-chain principal que selecciona rama por `adoption_mode` y añadir casos `CO_APROBACION` y `SOLIDARIO`.

- [ ] Run `npx tsc --noEmit` — 0 errores
- [ ] Run `npx vitest run` — 342/342 tests pasan
- [ ] Commit: `feat(motor): T9-ext — evaluarCoAprobacion + evaluarSolidario en votacion-engine`

---

## Task 5: T2-pactos — Seed pacto demo ARGA

**Files:**
- Create: `supabase/migrations/20260420_000018_seed_pacto_arga.sql`

Depende de: Task 2 (tablas creadas)

- [ ] INSERT pacto FUNDACION_ARGA_2024:

```sql
-- Pacto parasocial Fundación ARGA
INSERT INTO pactos_parasociales (id, tenant_id, entity_id, pacto_ref, fecha_pacto, partes, estado)
VALUES (
  '00000000-0000-0000-0000-000000000030',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000010',  -- ARGA Seguros S.A.
  'PACTO_FUNDACION_ARGA_2024',
  '2024-01-15T00:00:00Z',
  '["FUNDACION_ARGA", "ARGA_CAPITAL_INVERSIONES"]'::jsonb,
  'VIGENTE'
) ON CONFLICT (id) DO NOTHING;

-- Cláusula 1: VETO_MATERIA — operaciones estructurales
INSERT INTO pacto_clausulas (pacto_id, tipo, materia_ambito, titulares, ventana_respuesta_dias, estatutarizada, efecto_incumplimiento)
VALUES (
  '00000000-0000-0000-0000-000000000030',
  'VETO_MATERIA',
  '["FUSION", "ESCISION", "TRANSFORMACION", "CESION_GLOBAL_ACTIVO", "DISOLUCION"]'::jsonb,
  '[{"id": "FUNDACION_ARGA", "tipo": "BLOQUE"}]'::jsonb,
  15, false, 'BLOQUEO_PACTO'
);

-- Cláusula 2: CONSENTIMIENTO_INVERSOR — capital
INSERT INTO pacto_clausulas (pacto_id, tipo, materia_ambito, titulares, ventana_respuesta_dias, estatutarizada, efecto_incumplimiento)
VALUES (
  '00000000-0000-0000-0000-000000000030',
  'CONSENTIMIENTO_INVERSOR',
  '["AUMENTO_CAPITAL", "AUMENTO_CAPITAL_NO_DINERARIO", "REDUCCION_CAPITAL"]'::jsonb,
  '[{"id": "FUNDACION_ARGA", "tipo": "BLOQUE"}]'::jsonb,
  10, false, 'ALERTA'
);

-- Cláusula 3: CAPEX_THRESHOLD — 500K EUR
INSERT INTO pacto_clausulas (pacto_id, tipo, materia_ambito, titulares, umbral, ventana_respuesta_dias, estatutarizada, efecto_incumplimiento)
VALUES (
  '00000000-0000-0000-0000-000000000030',
  'CAPEX_THRESHOLD',
  '["*"]'::jsonb,
  '[{"id": "FUNDACION_ARGA", "tipo": "BLOQUE"}]'::jsonb,
  '{"valor": 500000, "unidad": "EUR"}'::jsonb,
  10, false, 'ALERTA'
);
```

- [ ] Run `npx tsc --noEmit` — 0 errores
- [ ] Commit: `feat(db): T2-pactos — seed pacto parasocial Fundación ARGA (3 cláusulas MVP)`

---

## Task 6: D4-engine — Motor de pactos parasociales

**Files:**
- Create: `src/lib/rules-engine/pactos-engine.ts`
- Create: `src/lib/rules-engine/__tests__/pactos-engine.test.ts`

Depende de: Task 1 (tipos) + Task 2 (tablas)

- [ ] Crear `src/lib/rules-engine/pactos-engine.ts`:

```typescript
import type { ClausulaPacto, PactosEvaluation, ExplainNode } from './types';

interface AgreementForPactos {
  id: string;
  materia: string;
  votacion?: { pctFavor: number };
  vetos?: Array<{ titularId: string; ejercido: boolean }>;
  consentimientos?: Array<{ titularId: string; otorgado: boolean }>;
  capexImporte?: number;
}

export function evaluarVetoMateria(
  acuerdo: AgreementForPactos,
  clausula: ClausulaPacto
): { ok: boolean; explain: ExplainNode } {
  const vetoEjercido = clausula.titulares.some(t =>
    acuerdo.vetos?.some(v => v.titularId === t.id && v.ejercido === true)
  );
  if (vetoEjercido) {
    const efecto = clausula.estatutarizada ? 'BLOQUEO_SOCIETARIO' : 'BLOQUEO_PACTO';
    return {
      ok: false,
      explain: { id: 'VETO_EJERCIDO', resultado: 'FAIL', mensaje: `Veto ejercido. Efecto: ${efecto}`, hijos: [] }
    };
  }
  return { ok: true, explain: { id: 'VETO_NO_EJERCIDO', resultado: 'OK', mensaje: 'Ningún titular ha ejercido veto', hijos: [] } };
}

export function evaluarMayoriaReforzadaPacto(
  acuerdo: AgreementForPactos,
  clausula: ClausulaPacto
): { ok: boolean; explain: ExplainNode } {
  const umbralPacto = clausula.umbral?.valor ?? 0;
  const pctFavor = acuerdo.votacion?.pctFavor ?? 0;
  if (pctFavor < umbralPacto) {
    return {
      ok: false,
      explain: { id: 'MAYORIA_PACTO_NO_ALCANZADA', resultado: 'FAIL', mensaje: `${pctFavor}% < ${umbralPacto}% requerido por pacto`, hijos: [] }
    };
  }
  return { ok: true, explain: { id: 'MAYORIA_PACTO_OK', resultado: 'OK', mensaje: `${pctFavor}% >= ${umbralPacto}% pacto`, hijos: [] } };
}

export function evaluarConsentimientoInversor(
  acuerdo: AgreementForPactos,
  clausula: ClausulaPacto
): { ok: boolean; explain: ExplainNode } {
  const titularIds = clausula.titulares.map(t => t.id);
  const faltantes = titularIds.filter(tid =>
    !acuerdo.consentimientos?.some(c => c.titularId === tid && c.otorgado === true)
  );
  if (faltantes.length > 0) {
    return {
      ok: false,
      explain: { id: 'CONSENTIMIENTO_AUSENTE', resultado: 'FAIL', mensaje: `Faltan consentimientos: ${faltantes.length} de ${titularIds.length}`, hijos: [] }
    };
  }
  return { ok: true, explain: { id: 'CONSENTIMIENTO_OK', resultado: 'OK', mensaje: 'Todos los consentimientos recibidos', hijos: [] } };
}

export function evaluarPactosParasociales(
  acuerdo: AgreementForPactos,
  clausulas: ClausulaPacto[]
): PactosEvaluation {
  const clausulasAplicables = clausulas.filter(c =>
    c.materiaAmbito.includes('*') || c.materiaAmbito.includes(acuerdo.materia)
  );

  if (clausulasAplicables.length === 0) {
    return { aplica: false, clausulasEvaluadas: [], pactoOk: null };
  }

  const clausulasEvaluadas = clausulasAplicables.map(clausula => {
    let result: { ok: boolean; explain: ExplainNode };
    switch (clausula.tipo) {
      case 'VETO_MATERIA':
        result = evaluarVetoMateria(acuerdo, clausula);
        break;
      case 'MAYORIA_REFORZADA':
        result = evaluarMayoriaReforzadaPacto(acuerdo, clausula);
        break;
      case 'CONSENTIMIENTO_INVERSOR':
        result = evaluarConsentimientoInversor(acuerdo, clausula);
        break;
      default:
        result = { ok: true, explain: { id: 'TIPO_NO_MVP', resultado: 'OK', mensaje: 'Tipo no evaluado en MVP', hijos: [] } };
    }
    return { clausulaId: clausula.id, tipo: clausula.tipo, ...result };
  });

  const pactoOk = clausulasEvaluadas.every(e => e.ok);
  return { aplica: true, clausulasEvaluadas, pactoOk };
}
```

- [ ] Escribir tests en `src/lib/rules-engine/__tests__/pactos-engine.test.ts`:

```typescript
// PA-01: veto ejercido → pactoOk=false
// PA-02: veto NO ejercido → pactoOk=true
// PA-03: mayoría reforzada pacto alcanzada → ok
// PA-04: mayoría reforzada pacto NO alcanzada → fail
// PA-05: consentimiento presente → ok
// PA-06: consentimiento ausente → fail
// PA-07: cláusula estatutarizada → efecto BLOQUEO_SOCIETARIO
// PA-08: cláusula no estatutarizada → efecto BLOQUEO_PACTO
// PA-09: materia no en ámbito → aplica=false, pactoOk=null
// PA-10: comodín "*" → aplica aunque la materia no coincida
```

- [ ] Run `npx vitest run src/lib/rules-engine/__tests__/pactos-engine.test.ts` — todos pasan
- [ ] Run `npx vitest run` — todos los tests pasan
- [ ] Run `npx tsc --noEmit` — 0 errores
- [ ] Commit: `feat(motor): D4-engine — evaluarPactosParasociales + 3 evaluadores MVP`

---

## Task 7: T11-ext — Orquestador flujos D y E + integración pactos

**Files:**
- Modify: `src/lib/rules-engine/orquestador.ts`

Depende de: Task 4 (T9-ext) + Task 6 (D4-engine)

- [ ] Leer `src/lib/rules-engine/orquestador.ts` para entender la estructura actual

- [ ] **Actualizar `determinarAdoptionMode()`** — añadir ramas CO_APROBACION y SOLIDARIO antes de las heurísticas existentes:

```typescript
// En determinarAdoptionMode():
if ((acuerdo as any).executionMode?.tipo === 'CO_APROBACION') return 'CO_APROBACION';
if ((acuerdo as any).executionMode?.tipo === 'SOLIDARIO') return 'SOLIDARIO';
// ... resto de lógica existente
```

- [ ] **Añadir flujo D (CO_APROBACION)** en el dispatcher del orquestador:
  - Skip convocatoria (paso omitido)
  - Llamar `evaluarCoAprobacion(config, adminVigentes, fecha)`
  - Generar acta tipo `ACTA_DECISION_CONJUNTA`
  - Evaluar plazos y post-acuerdo

- [ ] **Añadir flujo E (SOLIDARIO)** en el dispatcher del orquestador:
  - Skip convocatoria
  - Llamar `evaluarSolidario(config, adminVigentes, materia, fecha, firmasPresentes)`
  - Generar acta tipo `ACTA_ORGANO_ADMIN`
  - Evaluar plazos y post-acuerdo

- [ ] **Integrar evaluación de pactos parasociales** — añadir después de votación, antes de generación de acta:

```typescript
// En el flujo principal del orquestador (flujo A/MEETING):
// ... después de evaluarVotacion() ...

// Evaluación de pactos parasociales
const pactosResult = evaluarPactosParasociales(
  agreementContext,
  agreementContext.pactosClausulas ?? []
);
if (pactosResult.aplica && !pactosResult.pactoOk) {
  // Añadir warning/block en el explain, NO bloquear societariamente
  // salvo que alguna cláusula tenga estatutarizada=true
  const hayEstatutarizada = pactosResult.clausulasEvaluadas
    .filter(e => !e.ok)
    .some(e => /* clausula original tiene estatutarizada=true */ false);
  if (hayEstatutarizada) {
    return { proclamable: false, explain: [..., pactosResult] };
  }
  // Si no estatutarizada: solo warning en explain, no bloquea
}
```

- [ ] Run `npx tsc --noEmit` — 0 errores
- [ ] Run `npx vitest run` — todos los tests pasan
- [ ] Commit: `feat(motor): T11-ext — orquestador flujos D/E CO_APROBACION+SOLIDARIO + integración pactos`

---

## Task 8: Tests — CO_APROBACION + SOLIDARIO + regresión pactos

**Files:**
- Create: `src/lib/rules-engine/__tests__/co-aprobacion-solidario.test.ts`

- [ ] Implementar los 10 tests del spec (6 CO_APROBACION + 4 SOLIDARIO):

```typescript
// CO-01: k=2 n=3, 2 firmas válidas → ok=true
// CO-02: k=2 n=3, solo 1 firma → ok=false FIRMAS_INSUFICIENTES
// CO-03: firma de admin no vigente → ok=false ADMIN_NO_VIGENTE (filtrado)
// CO-04: materia con restricción estatutaria → depende de config
// CO-05: k=1 n=1 caso mínimo → ok=true
// CO-06: 2 firmas del mismo adminId → ok=false FIRMAS_DUPLICADAS
// SO-01: admin vigente, materia no restringida → ok=true
// SO-02: admin no vigente → ok=false ADMIN_NO_VIGENTE
// SO-03: materia restringida sin cofirma → ok=false COFIRMA_REQUERIDA
// SO-04: materia no restringida → ok=true
```

- [ ] Run `npx vitest run` — todos pasan (342 + nuevos)
- [ ] Run `npx tsc --noEmit` — 0 errores
- [ ] Commit: `test(motor): CO_APROBACION + SOLIDARIO + pactos — cobertura spec v2.1`

---

## Task 9: Variable contract YAML + hook usePactosParasociales

**Files:**
- Create: `docs/contratos/variables-plantillas-v1.1.yaml`
- Create: `src/hooks/usePactosParasociales.ts`

- [ ] **Crear archivo YAML** `docs/contratos/variables-plantillas-v1.1.yaml` con las 49 variables del spec (sección 10 del docx). El contenido YAML completo está en el spec.

- [ ] **Crear hook** `src/hooks/usePactosParasociales.ts`:

```typescript
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";

export function usePactosParasociales(entityId?: string) {
  return useQuery({
    queryKey: ["pactos_parasociales", entityId ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("pactos_parasociales")
        .select("*, pacto_clausulas(*)")
        .eq("tenant_id", DEMO_TENANT)
        .eq("estado", "VIGENTE");
      if (entityId) q = q.eq("entity_id", entityId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: true,
  });
}
```

- [ ] Run `npx tsc --noEmit` — 0 errores
- [ ] Commit: `feat(motor): variable contract v1.1 YAML + usePactosParasociales hook`

---

## Criterio de salida

- [ ] `AdoptionMode` tiene 7 valores (+ CO_APROBACION + SOLIDARIO)
- [ ] `TipoActa` incluye `ACTA_ORGANO_ADMIN`
- [ ] Tipos de pactos completos (`ClausulaPacto`, `PactosEvaluation`, `PactoParasocial`)
- [ ] 3 tablas SQL nuevas (pactos_parasociales, pacto_clausulas, pacto_evaluacion_results WORM)
- [ ] 12 nuevos rule packs seeded (28 total)
- [ ] `evaluarCoAprobacion` + `evaluarSolidario` implementados con 10 tests
- [ ] `evaluarPactosParasociales` implementado con 10 tests
- [ ] Orquestador despacha flujos D y E
- [ ] Pactos evaluados después de votación en flujo principal
- [ ] Seed PACTO_FUNDACION_ARGA_2024 con 3 cláusulas
- [ ] `usePactosParasociales` hook
- [ ] `variables-plantillas-v1.1.yaml` en docs/contratos/
- [ ] `npx tsc --noEmit` — 0 errores
- [ ] `npx vitest run` — 360+ tests pasando (342 existentes + 18+ nuevos)
- [ ] `vite build` — build limpio

---

## Dependencias externas

| Dependencia | Estado |
|---|---|
| Spec técnica completa | ✅ Disponible en `docs/legal-team/specs acuerdos/Especificacion_Tecnica_Motor_Reglas_LSC_v2_1.docx` |
| 12 JSONs rule packs | ✅ En sección 5 del docx |
| Pacto ARGA seed JSON | ✅ En sección 9 del docx |
| Variable contract YAML | ✅ En sección 10 del docx |
| Validación legal de los 12 nuevos packs | Pendiente equipo legal |
