# Plan Oleada 2 — Plantillas de Contenido + Rule Packs ES

> **Fecha:** 2026-04-20  
> **Dependencia bloqueante:** Equipo legal entrega modelos de acuerdo (ver prompt en `TGMS_mapfre_mockup/docs/superpowers/specs/2026-04-20-prompt-equipo-legal-plantillas-oleada2.md`)  
> **Objetivo:** Pasar de 9 plantillas de proceso a 22+ plantillas de contenido. Completar rule_pack_versions con payloads reales. Añadir SLU como tercer tipo social.

---

## Arquitectura: cómo encajan las plantillas de Oleada 2

Las Oleada 1 son **plantillas de proceso** (el envoltorio del acta). Las Oleada 2 son **modelos de acuerdo** (la parte dispositiva, lo que va dentro del acta).

```
Acta (Oleada 1)
├── Apertura, quórum, constitución  ← automático, capa1 inmutable
├── Punto 1 del orden del día:
│     texto_decision = MODELO_APROBACION_CUENTAS  ← Oleada 2 (nuevo)
├── Punto 2 del orden del día:
│     texto_decision = MODELO_NOMBRAMIENTO_CONSEJERO  ← Oleada 2 (nuevo)
└── Cierre, firmas QES               ← automático, capa1 inmutable
```

**Implementación técnica:** Los modelos de Oleada 2 son un nuevo tipo de plantilla (`tipo = 'MODELO_ACUERDO'`) que el sistema carga como pre-fill del campo `texto_decision` en `capa3_editables` cuando el secretario selecciona una materia. El secretario puede editar el texto libremente.

---

## Cambios en el esquema de datos

### Nueva columna en `plantillas_protegidas`

```sql
ALTER TABLE plantillas_protegidas
  ADD COLUMN IF NOT EXISTS materia_acuerdo TEXT;
  -- Identifica la materia: APROBACION_CUENTAS, NOMBRAMIENTO_CONSEJERO, etc.
  -- NULL para plantillas de proceso (Oleada 1)
  -- NOT NULL para modelos de acuerdo (Oleada 2)
```

### Nuevo tipo en CHECK constraint

```sql
ALTER TABLE plantillas_protegidas
  DROP CONSTRAINT IF EXISTS plantillas_protegidas_tipo_check;

ALTER TABLE plantillas_protegidas
  ADD CONSTRAINT plantillas_protegidas_tipo_check
  CHECK (tipo IN (
    -- Oleada 1: plantillas de proceso
    'ACTA_SESION', 'ACTA_CONSIGNACION', 'ACTA_ACUERDO_ESCRITO',
    'CERTIFICACION', 'CONVOCATORIA', 'CONVOCATORIA_SL_NOTIFICACION',
    -- Oleada 2: modelos de acuerdo (parte dispositiva)
    'MODELO_ACUERDO'
  ));
```

### Índice por materia

```sql
CREATE INDEX IF NOT EXISTS idx_plantillas_materia
  ON plantillas_protegidas(tenant_id, materia_acuerdo, tipo_social, estado)
  WHERE materia_acuerdo IS NOT NULL;
```

---

## Materias a implementar (13) y sus rule packs

| # | `materia_acuerdo` | Tipo social | Variantes | Rule pack asociado |
|---|---|---|---|---|
| 1 | `APROBACION_CUENTAS` | SA + SL | Con auditor / Sin auditor | `APROBACION_CUENTAS` (ya existe, falta payload) |
| 2 | `DISTRIBUCION_DIVIDENDOS` | SA + SL | Definitivo / A cuenta / Reservas | `DISTRIBUCION_DIVIDENDOS` (ya existe, falta payload) |
| 3 | `NOMBRAMIENTO_CONSEJERO` | SA + SL | JGA / Cooptación | `NOMBRAMIENTO_CONSEJERO` (ya existe, falta payload) |
| 4 | `CESE_CONSEJERO` | SA + SL | Por JGA / Por renuncia / Por expiración | Nuevo |
| 5 | `DELEGACION_FACULTADES` | SA + SL | Permanente (CD) / Puntual | Nuevo |
| 6 | `MODIFICACION_ESTATUTOS` | SA + SL | Denominación / Domicilio / Objeto / Órgano adm. | Nuevo |
| 7 | `AUMENTO_CAPITAL` | SA + SL | Con DSP / Sin DSP / Con cargo a reservas | Nuevo |
| 8 | `REDUCCION_CAPITAL` | SA + SL | Por pérdidas / Devolución aportaciones / Reservas | Nuevo |
| 9 | `OPERACION_VINCULADA` | SA + SL | Préstamo / Servicios / Activos | Nuevo |
| 10 | `NOMBRAMIENTO_AUDITOR` | SA + SL | Primer nombramiento / Renovación / Revocación | Nuevo |
| 11 | `APROBACION_PLAN_NEGOCIO` | SA + SL | Por Consejo / Por JGA | Nuevo |
| 12 | `AUTORIZACION_GARANTIA` | SA + SL | JGA (>25% activo) / Consejo | Nuevo |
| 13 | `RATIFICACION_ACTOS` | SA + SL | Por Consejo / Por JGA | Nuevo |

---

## Tasks

### Task 1: Migración SQL — esquema + modelos de acuerdo

**Prerequisito:** Equipo legal entrega los modelos redactados (prompt en specs/)  
**Archivo:** `supabase/migrations/20260420_000012_oleada2_modelos_acuerdo.sql`

- [ ] Añadir columna `materia_acuerdo TEXT` a `plantillas_protegidas`
- [ ] Actualizar CHECK constraint para incluir `'MODELO_ACUERDO'`
- [ ] Crear índice `idx_plantillas_materia`
- [ ] INSERT de los 13 modelos × variantes (≈30 filas total) con:
  - `tipo = 'MODELO_ACUERDO'`
  - `materia_acuerdo = 'APROBACION_CUENTAS'` (etc.)
  - `tipo_social` (SA / SL / AMBAS)
  - `capa1_inmutable` = texto del modelo (de legal)
  - `capa2_variables` = variables que aporta el sistema
  - `capa3_editables` = campos que completa el secretario
  - `referencia_legal` = artículos LSC
  - `estado = 'REVISADA'` inicialmente

```sql
-- Ejemplo de una fila:
INSERT INTO plantillas_protegidas (
  tenant_id, tipo, materia_acuerdo, variante_nombre, tipo_social,
  capa1_inmutable, capa2_variables, capa3_editables,
  referencia_legal, notas_legal, estado, version
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'MODELO_ACUERDO',
  'APROBACION_CUENTAS',
  'Con auditor obligatorio',
  'AMBAS',
  $$ [texto de legal aquí] $$,
  $$ [variables JSON] $$::jsonb,
  $$ [editables JSON] $$::jsonb,
  'Arts. 164, 253-254, 272 LSC',
  'Oleada 2: Modelo aprobación de cuentas con auditor.',
  'REVISADA',
  '1.0.0'
);
```

### Task 2: Completar payloads de rule_pack_versions (3 existentes + 10 nuevos)

**Archivo:** `supabase/migrations/20260420_000013_rule_pack_payloads.sql`

El payload JSON de cada rule pack tiene esta estructura (ya definida en `src/lib/rules-engine/types.ts`):

```typescript
interface RulePackPayload {
  materia: string;
  clase: 'ORDINARIA' | 'ESTATUTARIA' | 'ESTRUCTURAL';
  organoTipo: 'JUNTA_GENERAL' | 'CONSEJO_ADMINISTRACION' | 'COMISION_DELEGADA';
  modosAdopcionPermitidos: AdoptionMode[];
  convocatoria: {
    plazoDiasSA: number;
    plazoDiasSL: number;
    canales: string[];
    documentosObligatorios: string[];
  };
  constitucion: {
    quorumSA_1conv: number;   // porcentaje (25 = 25%)
    quorumSA_2conv: number;   // 0 = cualquiera
    quorumSL: number;
    quorumConsejo: string;    // 'MAYORIA_SIMPLE_PRESENTES'
  };
  votacion: {
    mayoriaBase: string;      // 'SIMPLE' | 'REFORZADA_LEGAL' | 'UNANIMIDAD'
    umbralesSA: Record<string, number>;
    umbralesSL: Record<string, number>;
    abstenciones: 'NO_CUENTAN' | 'CUENTAN_COMO_CONTRA';
    permitirVotoCalidad: boolean;
  };
  documentacion: {
    documentosPreSesion: string[];
    tipoActaRequerido: string;
    requiereInformeAuditor: boolean;
    requiereInformeAdministradores: boolean;
  };
  postAcuerdo: {
    inscribible: boolean;
    instrumentoPublico: 'SIEMPRE' | 'NUNCA' | 'SOLO_SA';
    plazoInscripcionDias: number;
    publicacionBORME: boolean;
    plazoPrescripcionImpugnacion: string;
  };
}
```

Para cada materia, rellenar estos campos con los valores LSC correctos:

| Materia | clase | quorumSA_1conv | quorumSA_2conv | mayoriaBase | inscribible |
|---|---|---|---|---|---|
| APROBACION_CUENTAS | ORDINARIA | 25% | 0% | SIMPLE | No |
| DISTRIBUCION_DIVIDENDOS | ORDINARIA | 25% | 0% | SIMPLE | No |
| NOMBRAMIENTO_CONSEJERO | ORDINARIA | 25% | 0% | SIMPLE | **Sí** |
| CESE_CONSEJERO | ORDINARIA | 25% | 0% | SIMPLE | **Sí** |
| DELEGACION_FACULTADES | ORDINARIA | — (Consejo) | — | SIMPLE | **Sí** |
| MODIFICACION_ESTATUTOS | **ESTATUTARIA** | 50% | 25% | **REFORZADA_LEGAL (2/3)** | **Sí** |
| AUMENTO_CAPITAL | **ESTATUTARIA** | 50% | 25% | **REFORZADA_LEGAL (2/3)** | **Sí** |
| REDUCCION_CAPITAL | **ESTATUTARIA** | 50% | 25% | **REFORZADA_LEGAL (2/3)** | **Sí** |
| OPERACION_VINCULADA | ORDINARIA | 25% | 0% | SIMPLE (excluye vinculado) | No |
| NOMBRAMIENTO_AUDITOR | ORDINARIA | 25% | 0% | SIMPLE | **Sí** |
| APROBACION_PLAN_NEGOCIO | ORDINARIA | — (Consejo) | — | SIMPLE | No |
| AUTORIZACION_GARANTIA | ORDINARIA/ESTATUTARIA | Según cuantía | — | Según cuantía | No |
| RATIFICACION_ACTOS | ORDINARIA | 25% | 0% | SIMPLE | No |

- [ ] UPDATE de los 3 rule_pack_versions existentes con payload completo
- [ ] INSERT de los 10 nuevos rule_packs + rule_pack_versions con payload

### Task 3: Hook `useModelosAcuerdo`

**Archivo:** `src/hooks/useModelosAcuerdo.ts`

```typescript
// Devuelve los modelos de acuerdo disponibles para una materia + tipo social
export function useModelosAcuerdo(materia: string, tipoSocial: 'SA' | 'SL') {
  return useQuery({
    queryKey: ['modelos_acuerdo', materia, tipoSocial],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plantillas_protegidas')
        .select('id, variante_nombre, capa1_inmutable, capa2_variables, capa3_editables, referencia_legal')
        .eq('tenant_id', DEMO_TENANT)
        .eq('tipo', 'MODELO_ACUERDO')
        .eq('materia_acuerdo', materia)
        .in('tipo_social', [tipoSocial, 'AMBAS'])
        .in('estado', ['ACTIVA', 'APROBADA', 'REVISADA'])
        .order('variante_nombre');
      if (error) throw error;
      return data ?? [];
    },
  });
}
```

### Task 4: Selector de modelo en TramitadorStepper (paso 2)

**Archivo:** `src/pages/secretaria/TramitadorStepper.tsx`

Cuando el usuario selecciona una materia en el paso 2, mostrar los modelos disponibles de Oleada 2:

```
Paso 2: Redacción del acuerdo
  [Selector de materia]  → APROBACION_CUENTAS
  [Variante del modelo]  → ○ Con auditor obligatorio  ○ Sin auditor
  [Texto del acuerdo]    → [Pre-relleno con modelo seleccionado, editable]
```

- [ ] Añadir selector de variante tras el selector de materia
- [ ] Llamar a `useModelosAcuerdo(materia, tipoSocial)`
- [ ] Pre-rellenar el textarea de `texto_decision` con `capa1_inmutable` del modelo seleccionado
- [ ] Resolver variables del sistema automáticamente (capa2_variables)
- [ ] Mostrar los campos de `capa3_editables` como formulario adicional

### Task 5: SLU / SAU como tercer tipo social

**Archivo:** `supabase/migrations/20260420_000014_tipo_social_slu.sql`

```sql
-- Añadir SLU a los tipos válidos en jurisdiction_rule_sets y agreements
-- (si existen CHECK constraints que los limiten)
-- Comportamiento SLU:
--   - Convocatoria: no aplica (art. 15 / art. 173.3 LSC — solo comunicar al RM)
--   - Quórum: no aplica (socio único)
--   - Modo adopción: UNIPERSONAL_SOCIO (preferente) o MEETING (si tiene administrador diferente)
--   - Inscribir unipersonalidad: sí (art. 13 LSC — obligatoria)
```

- [ ] Migración SQL: añadir SLU/SAU a enums relevantes
- [ ] Actualizar `checkNoticePeriodByType` en `useJurisdiccionRules.ts` para SLU
- [ ] Añadir rule pack `SOCIEDAD_UNIPERSONAL` con comportamiento especial
- [ ] Seed: entidad Cartera ARGA S.L.U. como ejemplo de SLU

### Task 6: Tests Oleada 2

**Archivo:** `src/lib/rules-engine/__tests__/oleada2-modelos.test.ts`

```typescript
// Para cada materia: verificar que el rule pack payload es coherente con el motor
describe('Rule packs Oleada 2', () => {
  it('MODIFICACION_ESTATUTOS — mayoría reforzada 2/3', () => {
    const result = evaluarMayoria({
      mayoriaBase: 'REFORZADA_LEGAL',
      votosFavor: 55, totalVotos: 100
    });
    expect(result.proclamable).toBe(false); // < 2/3
  });

  it('MODIFICACION_ESTATUTOS — quórum estatutario 1ª conv SA', () => {
    const result = evaluarConstitucion({
      tipoSocial: 'SA',
      materia_clase: 'ESTATUTARIA',
      presentePct: 49,
      convocatoria: 1
    });
    expect(result.constituida).toBe(false); // < 50% requerido
  });
  // ...
});
```

- [ ] 2 tests por materia × 13 materias = ~26 tests nuevos
- [ ] Tests de regresión: verificar que los 3 rule packs existentes funcionan con los nuevos payloads

### Task 7: Documentación GestorPlantillas — mostrar modelos Oleada 2

**Archivo:** `src/pages/secretaria/GestorPlantillas.tsx`

- [ ] Añadir tab "Modelos de acuerdo" junto a "Plantillas de proceso"
- [ ] Listado filtrable por materia / tipo social / estado
- [ ] Vista previa del modelo (capa1_inmutable renderizada)
- [ ] Indicar qué variables son del sistema vs del secretario

---

## Criterio de salida

- [ ] 13 materias con al menos 1 modelo de acuerdo en estado REVISADA
- [ ] 13 rule packs con payload JSONB completo en `rule_pack_versions`
- [ ] Hook `useModelosAcuerdo` devuelve datos reales de Supabase
- [ ] TramitadorStepper pre-rellena el texto del acuerdo con el modelo
- [ ] 300+ tests pasando (26 nuevos + 316 existentes)
- [ ] tsc 0 errors, build limpio

---

## Dependencias externas

| Dependencia | Responsable | Estado | Fecha estimada |
|---|---|---|---|
| Modelos de acuerdo redactados (13 materias) | Equipo Legal | Pendiente | 30/04/2026 (alta prioridad) |
| Validación legal de rule pack payloads | Equipo Legal | Pendiente | 30/04/2026 |
| Revisión modelos: variantes estatutarias (aumento/reducción capital) | Legal + Desarrollo | Pendiente | 15/05/2026 |

**El desarrollo de Tasks 1-2 está bloqueado hasta que Legal entregue los modelos.**  
**Tasks 3-7 se pueden preparar en paralelo (estructura sin contenido).**
