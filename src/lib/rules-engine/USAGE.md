# Motor de Reglas LSC — Guía de Uso

Instrucciones de integración para desarrolladores que usan las funciones puras del motor.

## Importación

```typescript
// Bordes no-computables
import {
  evaluarBordesNoComputables,
  BordeInput,
  ReglaNoComputable,
  EvalSeverity,
  BordeStatus,
} from '@/lib/rules-engine/bordes-no-computables';

// Plantillas
import {
  evaluarPlantillaProtegida,
  calcularRulesetSnapshotId,
  GO_LIVE_CONFIG,
  PlantillaEvalInput,
  PlantillaEvalOutput,
  PlantillaProtegida,
  AdoptionMode,
} from '@/lib/rules-engine/plantillas-engine';
```

## Ejemplo: Evaluación de Bordes

```typescript
import { evaluarBordesNoComputables } from '@/lib/rules-engine/bordes-no-computables';

function validarAcuerdo(
  esCotizada: boolean,
  tipoSocial: 'SA' | 'SL',
  materias: string[],
  resolvedFlags: Record<string, boolean>
) {
  const bordes = evaluarBordesNoComputables({
    esCotizada,
    tipoSocial,
    materias,
    perimetroClaseDefinido: resolvedFlags.perimetroClaseDefinido,
    consentimientoClaseResuelto: resolvedFlags.consentimientoClaseResuelto,
    liquidezVerificada: resolvedFlags.liquidezVerificada,
    indelegabilidadVerificada: resolvedFlags.indelegabilidadVerificada,
    juntaTelematicaChecklist: resolvedFlags.juntaTelematicaChecklist,
    evidenciaPublicacionSA: resolvedFlags.evidenciaPublicacionSA,
    evidenciaNotificacionSL: resolvedFlags.evidenciaNotificacionSL,
  });

  // Verificar si es cotizada (FUERA_DE_ALCANCE)
  if (bordes.some((b) => b.status === 'FUERA_DE_ALCANCE')) {
    return { ok: false, error: 'Entidad cotizada fuera de alcance' };
  }

  // Recolectar issues bloqueantes
  const blocking = bordes.filter((b) => b.severity === 'BLOCKING');
  if (blocking.length > 0) {
    return {
      ok: false,
      error: 'Bordes bloqueantes detectados',
      issues: blocking.map((b) => ({ id: b.id, resolucion: b.resolucion })),
    };
  }

  // Warnings pero continuar
  const warnings = bordes.filter((b) => b.severity === 'WARNING');
  return {
    ok: true,
    warnings: warnings.map((b) => ({ id: b.id, nombre: b.nombre })),
  };
}
```

## Ejemplo: Validación de Plantillas

```typescript
import {
  evaluarPlantillaProtegida,
  GO_LIVE_CONFIG,
} from '@/lib/rules-engine/plantillas-engine';

function usarPlantilla(
  adoption: 'MEETING' | 'NO_SESSION',
  organoTipo: string,
  tipoActa: string,
  plantillasDB: PlantillaProtegida[],
  variables: Record<string, unknown>
) {
  const result = evaluarPlantillaProtegida({
    adoptionMode: adoption,
    organoTipo,
    tipoActaRequerido: tipoActa,
    plantillasDisponibles: plantillasDB,
    variablesResueltas: variables,
    gateConfig: GO_LIVE_CONFIG,
  });

  if (!result.ok) {
    // Mostrar blocking issues en UI
    console.error('Plantilla inválida:', result.blocking_issues);
    return null;
  }

  if (result.warnings.length > 0) {
    // Mostrar warnings pero continuar
    console.warn('Plantilla con advertencias:', result.warnings);
  }

  // Usar plantilla
  return {
    plantilla_id: result.plantillaUsada,
    esFallback: result.esFallback,
  };
}
```

## Casos de Uso por Página

### `pages/secretaria/AccuerdoDetalle.tsx`

```typescript
import { useAcuerdoCompliance } from '@/hooks/useAgreementCompliance';

export function AccuerdoDetalle() {
  const { agreement, entity } = useAccuerdoData();
  const { bordes, plantilla, isBlockingIssue } = useAcuerdoCompliance(
    agreement
  );

  // Mostrar bordes pendientes
  const pendingBordes = bordes.filter((b) => b.status === 'PENDIENTE');

  return (
    <div>
      {isBlockingIssue && (
        <Alert variant="destructive">
          No puede proceder sin resolver bordes bloqueantes.
        </Alert>
      )}

      {pendingBordes.map((b) => (
        <BordeResolutionCard key={b.id} borde={b} />
      ))}

      {plantilla && <PlantillaPreview plantilla={plantilla} />}

      <AprobacionButton disabled={isBlockingIssue} />
    </div>
  );
}
```

### `pages/secretaria/ReunionStepper.tsx` (Paso de Plantillas)

```typescript
import { evaluarPlantillaProtegida } from '@/lib/rules-engine/plantillas-engine';

function PlantillaSelector({ acta, variables }) {
  const plantillaEval = evaluarPlantillaProtegida({
    adoptionMode: 'MEETING',
    organoTipo: acta.body_type,
    tipoActaRequerido: acta.expected_template_type,
    plantillasDisponibles: availableTemplates,
    variablesResueltas: variables,
    gateConfig: GO_LIVE_CONFIG,
  });

  return (
    <div>
      <PlantillaPreview plantilla={plantillaEval.plantillaUsada} />
      {plantillaEval.esFallback && (
        <Alert variant="warning">Usando fallback</Alert>
      )}
      {plantillaEval.blocking_issues.map((issue) => (
        <FormError key={issue}>{issue}</FormError>
      ))}
    </div>
  );
}
```

### `hooks/useAgreementCompliance.ts`

```typescript
import { evaluarBordesNoComputables } from '@/lib/rules-engine/bordes-no-computables';
import { evaluarPlantillaProtegida } from '@/lib/rules-engine/plantillas-engine';

export function useAgreementCompliance(agreement: Agreement) {
  const bordes = evaluarBordesNoComputables({
    esCotizada: agreement.entity.is_listed,
    tipoSocial: agreement.entity.social_type,
    materias: agreement.matters,
    perimetroClaseDefinido: agreement.class_perimeter_defined,
    // ... otros flags
  });

  const plantilla = evaluarPlantillaProtegida({
    adoptionMode: agreement.adoption_mode,
    organoTipo: agreement.body_type,
    tipoActaRequerido: agreement.expected_template_type,
    plantillasDisponibles: templates,
    variablesResueltas: agreementVariables,
    gateConfig: GO_LIVE_CONFIG,
  });

  const isBlockingIssue =
    bordes.some((b) => b.severity === 'BLOCKING' && b.status !== 'RESUELTO') ||
    (!plantilla.ok && plantilla.severity === 'BLOCKING');

  return { bordes, plantilla, isBlockingIssue };
}
```

## Contrato de Pureza

**IMPORTANTE:** Estas funciones son PURAS. Esto significa:

✅ **PERMITIDO:**
- Llamar desde cualquier contexto (React, hooks, servicios, utils)
- Pasar output directamente a otros motores
- Usar en tests, workers, servidor
- Cachear resultados (same input = same output)

❌ **NO PERMITIDO:**
- Modificar parámetros (input es inmutable)
- Hacer llamadas a DB, API, fetch
- Usar React hooks internamente
- Generar side effects

## Testing

```bash
# Todos los tests
npm run test -- src/lib/rules-engine/__tests__/

# Test específico
npm run test -- bordes-no-computables.test.ts
npm run test -- plantillas-engine.test.ts

# Con cobertura
npm run test -- --coverage src/lib/rules-engine/
```

## Referencias del Motor

- **Spec:** `/docs/superpowers/specs/2026-04-18-secretaria-societaria-design.md`
- **Plan:** `/docs/superpowers/plans/2026-04-18-secretaria-societaria-implementation-v2.md`
- **Tipos base:** `src/lib/rules-engine/types.ts`
- **Index de motores:** `src/lib/rules-engine/INDEX.md`

## Cambios Frecuentes

Si necesitas actualizar:

### Los 7 bordes
→ Modificar `evaluarBordesNoComputables()` en `bordes-no-computables.ts`

### Materias que activan bordes
→ Actualizar arrays `materiasConClaseImpacto`, `incluyeRepartoDividendos`, etc.

### GO_LIVE_CONFIG (rules de plantillas)
→ Modificar `GO_LIVE_CONFIG` en `plantillas-engine.ts`

### Variables de plantilla
→ Actualizar `PlantillaProtegida.variables` en DB + test fixtures

## Debugging

Cada función retorna un objeto `explain` con pasos de evaluación:

```typescript
const result = evaluarPlantillaProtegida(input);
result.explain.forEach((step) => {
  console.log(`${step.step}: ${step.result} — ${step.detail}`);
});
```

Output:
```
lookup_rule: true — Buscando rule para tipo="ACTA_SESION", adoption="MEETING", organo="CDA"
apply_mode: true — Modo de gate: STRICT (rule.id=rule_acta_sesion_cda)
find_exact: true — Plantilla exacta encontrada: "TPL_ACTA_SESION_CDA"
validate_variables: true — Todas las variables requeridas resueltas
```
