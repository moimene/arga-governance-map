/**
 * Test suite para evaluarPlantillaProtegida() y calcularRulesetSnapshotId()
 *
 * 12+ test cases covering:
 * - Exact template matching (ACTIVA, APROBADA)
 * - Variables validation (USUARIO vs MOTOR_REGLAS)
 * - Snapshot ID calculation (determinism)
 * - Protecciones validation
 * - Fallback modes (STRICT, FALLBACK, DISABLED)
 * - Gate config matching
 * - organo_tipo filtering
 */

import { describe, it, expect } from 'vitest';
import {
  evaluarPlantillaProtegida,
  calcularRulesetSnapshotId,
  resolverPlantillaConvocatoria,
  PlantillaEvalInput,
  PlantillaProtegida,
  GO_LIVE_CONFIG,
} from '../plantillas-engine';

describe('calcularRulesetSnapshotId', () => {
  // Test: Deterministic hash for same input
  it('should produce deterministic hash for same parameters', () => {
    const params = { foo: 'bar', num: 42 };
    const hash1 = calcularRulesetSnapshotId(params);
    const hash2 = calcularRulesetSnapshotId(params);

    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[0-9a-f]{8}$/); // 8-char hex
  });

  // Test: Different params produce different hashes
  it('should produce different hashes for different parameters', () => {
    const params1 = { foo: 'bar' };
    const params2 = { foo: 'baz' };

    const hash1 = calcularRulesetSnapshotId(params1);
    const hash2 = calcularRulesetSnapshotId(params2);

    expect(hash1).not.toBe(hash2);
  });

  // Test: Determinism with overrides
  it('should maintain determinism with overrides', () => {
    const params = { rule: 'test' };
    const overrides = [{ opt1: true }, { opt2: false }];

    const hash1 = calcularRulesetSnapshotId(params, overrides);
    const hash2 = calcularRulesetSnapshotId(params, overrides);

    expect(hash1).toBe(hash2);
  });
});

describe('evaluarPlantillaProtegida', () => {
  const plantillaActiva: PlantillaProtegida = {
    id: 'TPL_ACTA_SESION_CDA',
    tipo: 'ACTA_SESION',
    adoption_mode: 'MEETING',
    organo_tipo: 'CDA',
    status: 'ACTIVA',
    variables: [
      { key: 'fecha_sesion', source: 'USUARIO', required: true },
      { key: 'lugar_sesion', source: 'USUARIO', required: true },
      { key: 'acta_numero', source: 'MOTOR_REGLAS', required: true },
    ],
  };

  const plantillaAprobada: PlantillaProtegida = {
    id: 'TPL_CERTIFICACION',
    tipo: 'CERTIFICACION',
    adoption_mode: undefined,
    organo_tipo: undefined,
    status: 'APROBADA',
    variables: [
      { key: 'acuerdo_id', source: 'USUARIO', required: true },
      { key: 'certificador_name', source: 'USUARIO', required: false },
    ],
  };

  const plantillaBorrador: PlantillaProtegida = {
    id: 'TPL_ACTA_DRAFT',
    tipo: 'ACTA_SESION',
    status: 'BORRADOR',
    variables: [
      { key: 'fecha', source: 'USUARIO', required: true },
    ],
  };

  const plantillaFallback: PlantillaProtegida = {
    id: 'TPL_ACTA_ACUERDO_ESCRITO_GEN',
    tipo: 'ACTA_ACUERDO_ESCRITO_GENERICO',
    adoption_mode: undefined,
    status: 'APROBADA',
    variables: [
      { key: 'descripcion_acuerdo', source: 'USUARIO', required: true },
    ],
  };

  // Test 1: Exact active template match
  it('should return ok=true when exact ACTIVA plantilla found and variables resolved', () => {
    const input: PlantillaEvalInput = {
      adoptionMode: 'MEETING',
      organoTipo: 'CDA',
      tipoActaRequerido: 'ACTA_SESION',
      plantillasDisponibles: [plantillaActiva],
      variablesResueltas: {
        fecha_sesion: '2026-04-20',
        lugar_sesion: 'Madrid',
        acta_numero: '001',
      },
      gateConfig: GO_LIVE_CONFIG,
    };

    const result = evaluarPlantillaProtegida(input);

    expect(result.ok).toBe(true);
    expect(result.severity).toBe('INFO');
    expect(result.plantillaUsada).toBe('TPL_ACTA_SESION_CDA');
    expect(result.esFallback).toBe(false);
  });

  // Test 2: Exact approved template match
  it('should return ok=true when exact APROBADA plantilla found', () => {
    const input: PlantillaEvalInput = {
      adoptionMode: 'MEETING',
      organoTipo: 'CDA',
      tipoActaRequerido: 'CERTIFICACION',
      plantillasDisponibles: [plantillaAprobada],
      variablesResueltas: {
        acuerdo_id: 'ACU-001',
      },
      gateConfig: GO_LIVE_CONFIG,
    };

    const result = evaluarPlantillaProtegida(input);

    expect(result.ok).toBe(true);
    expect(result.plantillaUsada).toBe('TPL_CERTIFICACION');
  });

  // Test 3: Borrador status rejected
  it('should reject BORRADOR plantillas even if tipo matches', () => {
    const input: PlantillaEvalInput = {
      adoptionMode: 'MEETING',
      organoTipo: 'CDA',
      tipoActaRequerido: 'ACTA_SESION',
      plantillasDisponibles: [plantillaBorrador, plantillaActiva],
      variablesResueltas: { fecha_sesion: '2026-04-20', lugar_sesion: 'Madrid' },
      gateConfig: GO_LIVE_CONFIG,
    };

    const result = evaluarPlantillaProtegida(input);

    // Should skip BORRADOR and use ACTIVA
    expect(result.plantillaUsada).toBe('TPL_ACTA_SESION_CDA');
  });

  // Test 4: Missing required variable
  it('should return BLOCKING when required USUARIO variable not resolved', () => {
    const input: PlantillaEvalInput = {
      adoptionMode: 'MEETING',
      organoTipo: 'CDA',
      tipoActaRequerido: 'ACTA_SESION',
      plantillasDisponibles: [plantillaActiva],
      variablesResueltas: {
        fecha_sesion: '2026-04-20',
        // lugar_sesion is MISSING
      },
      gateConfig: GO_LIVE_CONFIG,
    };

    const result = evaluarPlantillaProtegida(input);

    expect(result.ok).toBe(false);
    expect(result.severity).toBe('BLOCKING');
    expect(result.blocking_issues.some((i) => i.includes('lugar_sesion'))).toBe(
      true
    );
  });

  // Test 5: MOTOR_REGLAS variables don't require user input
  it('should NOT require MOTOR_REGLAS variables to be in variablesResueltas', () => {
    const input: PlantillaEvalInput = {
      adoptionMode: 'MEETING',
      organoTipo: 'CDA',
      tipoActaRequerido: 'ACTA_SESION',
      plantillasDisponibles: [plantillaActiva],
      variablesResueltas: {
        fecha_sesion: '2026-04-20',
        lugar_sesion: 'Barcelona',
        // acta_numero (MOTOR_REGLAS) not provided — OK!
      },
      gateConfig: GO_LIVE_CONFIG,
    };

    const result = evaluarPlantillaProtegida(input);

    expect(result.ok).toBe(true);
  });

  // Test 6: STRICT mode — no fallback if exact not found
  it('should return BLOCKING in STRICT mode when exact plantilla not found', () => {
    const input: PlantillaEvalInput = {
      adoptionMode: 'MEETING',
      organoTipo: 'CDA',
      tipoActaRequerido: 'ACTA_SESION',
      plantillasDisponibles: [plantillaFallback], // wrong tipo
      variablesResueltas: { fecha_sesion: '2026-04-20' },
      gateConfig: GO_LIVE_CONFIG, // STRICT mode by default
    };

    const result = evaluarPlantillaProtegida(input);

    expect(result.ok).toBe(false);
    expect(result.severity).toBe('BLOCKING');
    expect(result.esFallback).toBe(false);
    expect(result.blocking_issues.some((i) => i.includes('STRICT'))).toBe(true);
  });

  // Test 7: FALLBACK mode — uses fallback when exact not found
  it('should use fallback plantilla in FALLBACK mode and return WARNING', () => {
    const fallbackConfig = {
      rules: [
        {
          id: 'rule_acuerdo_escrito_fallback',
          tipo_requerido: 'ACTA_ACUERDO_ESCRITO',
          adoption_modes: ['NO_SESSION'],
          modo: 'FALLBACK' as const,
          fallback_tipo: 'ACTA_ACUERDO_ESCRITO_GENERICO',
        },
      ],
      default_mode: 'FALLBACK' as const,
    };

    const input: PlantillaEvalInput = {
      adoptionMode: 'NO_SESSION',
      organoTipo: 'CDA',
      tipoActaRequerido: 'ACTA_ACUERDO_ESCRITO',
      plantillasDisponibles: [plantillaFallback],
      variablesResueltas: {
        descripcion_acuerdo: 'Acuerdo de test',
      },
      gateConfig: fallbackConfig,
    };

    const result = evaluarPlantillaProtegida(input);

    expect(result.ok).toBe(true);
    expect(result.severity).toBe('WARNING');
    expect(result.plantillaUsada).toBe('TPL_ACTA_ACUERDO_ESCRITO_GEN');
    expect(result.esFallback).toBe(true);
    expect(result.warnings.some((w) => w.includes('fallback'))).toBe(true);
  });

  // Test 8: DISABLED mode — always OK
  it('should return ok=true in DISABLED mode regardless of plantillas', () => {
    const disabledConfig = {
      rules: [],
      default_mode: 'DISABLED' as const,
    };

    const input: PlantillaEvalInput = {
      adoptionMode: 'MEETING',
      organoTipo: 'CDA',
      tipoActaRequerido: 'ACTA_SESION',
      plantillasDisponibles: [], // empty!
      variablesResueltas: {}, // empty!
      gateConfig: disabledConfig,
    };

    const result = evaluarPlantillaProtegida(input);

    expect(result.ok).toBe(true);
    expect(result.severity).toBe('INFO');
  });

  // Test 9: Adoption mode filtering
  it('should match adoption_mode correctly (comma-separated)', () => {
    const plantillaMultiAdopt: PlantillaProtegida = {
      id: 'TPL_CERT_MULTI',
      tipo: 'CERTIFICACION',
      adoption_mode: 'MEETING,UNIVERSAL,NO_SESSION',
      status: 'APROBADA',
      variables: [{ key: 'id', source: 'USUARIO', required: true }],
    };

    const input: PlantillaEvalInput = {
      adoptionMode: 'UNIVERSAL',
      organoTipo: 'CDA',
      tipoActaRequerido: 'CERTIFICACION',
      plantillasDisponibles: [plantillaMultiAdopt],
      variablesResueltas: { id: 'test' },
      gateConfig: GO_LIVE_CONFIG,
    };

    const result = evaluarPlantillaProtegida(input);

    expect(result.ok).toBe(true);
    expect(result.plantillaUsada).toBe('TPL_CERT_MULTI');
  });

  // Test 10: Organo tipo filtering (undefined = applies to all)
  it('should apply plantilla with undefined organo_tipo to any organo', () => {
    const input: PlantillaEvalInput = {
      adoptionMode: 'MEETING',
      organoTipo: 'CONSEJO_ADMINISTRACION', // different from organo_tipo=undefined
      tipoActaRequerido: 'CERTIFICACION',
      plantillasDisponibles: [plantillaAprobada], // organo_tipo: undefined
      variablesResueltas: { acuerdo_id: 'test' },
      gateConfig: GO_LIVE_CONFIG,
    };

    const result = evaluarPlantillaProtegida(input);

    expect(result.ok).toBe(true);
    expect(result.plantillaUsada).toBe('TPL_CERTIFICACION');
  });

  // Test 11: Ruleset snapshot ID validation
  it('should check ruleset_snapshot_id mismatch when provided', () => {
    const protectedPlantilla: PlantillaProtegida = {
      id: 'TPL_PROTECTED',
      tipo: 'ACTA_SESION',
      status: 'APROBADA',
      variables: [{ key: 'id', source: 'USUARIO', required: true }],
      protecciones: { hash_contenido: 'placeholder' }, // needed for snapshot check to execute
      ruleset_snapshot_id: 'abc12345',
    };

    const input: PlantillaEvalInput = {
      adoptionMode: 'MEETING',
      organoTipo: 'CDA',
      tipoActaRequerido: 'ACTA_SESION',
      plantillasDisponibles: [protectedPlantilla],
      variablesResueltas: { id: 'test' },
      gateConfig: GO_LIVE_CONFIG,
      rulesetSnapshotId: 'xyz98765', // different!
    };

    const result = evaluarPlantillaProtegida(input);

    expect(result.ok).toBe(false);
    expect(result.severity).toBe('BLOCKING');
    expect(result.blocking_issues.some((i) => i.includes('mismatch'))).toBe(true);
  });

  // Test 12: Explain chain populated
  it('should populate explain chain with steps', () => {
    const input: PlantillaEvalInput = {
      adoptionMode: 'MEETING',
      organoTipo: 'CDA',
      tipoActaRequerido: 'ACTA_SESION',
      plantillasDisponibles: [plantillaActiva],
      variablesResueltas: { fecha_sesion: '2026-04-20', lugar_sesion: 'Madrid' },
      gateConfig: GO_LIVE_CONFIG,
    };

    const result = evaluarPlantillaProtegida(input);

    expect(result.explain.length).toBeGreaterThan(0);
    expect(result.explain.map((e) => e.step)).toContain('lookup_rule');
    expect(result.explain.map((e) => e.step)).toContain('apply_mode');
    expect(result.explain.map((e) => e.step)).toContain('find_exact');
  });

  // Test 13: GO_LIVE_CONFIG structure
  it('should have correct GO_LIVE_CONFIG structure with 9 rules', () => {
    expect(GO_LIVE_CONFIG.rules).toHaveLength(9);
    expect(GO_LIVE_CONFIG.default_mode).toBe('STRICT');

    const tipos = GO_LIVE_CONFIG.rules.map((r) => r.tipo_requerido);
    expect(tipos).toContain('ACTA_SESION');
    expect(tipos).toContain('CERTIFICACION');
    expect(tipos).toContain('ACTA_ACUERDO_ESCRITO');

    // At least one FALLBACK rule
    expect(GO_LIVE_CONFIG.rules.some((r) => r.modo === 'FALLBACK')).toBe(true);
  });

  // Test 14: Deterministic output
  it('should produce deterministic output for same input', () => {
    const input: PlantillaEvalInput = {
      adoptionMode: 'MEETING',
      organoTipo: 'CDA',
      tipoActaRequerido: 'ACTA_SESION',
      plantillasDisponibles: [plantillaActiva],
      variablesResueltas: { fecha_sesion: '2026-04-20', lugar_sesion: 'Madrid' },
      gateConfig: GO_LIVE_CONFIG,
    };

    const result1 = evaluarPlantillaProtegida(input);
    const result2 = evaluarPlantillaProtegida(input);

    expect(result1).toEqual(result2);
  });

  // Test 15: No plantillas available at all
  it('should return BLOCKING when no plantillas available', () => {
    const input: PlantillaEvalInput = {
      adoptionMode: 'MEETING',
      organoTipo: 'CDA',
      tipoActaRequerido: 'ACTA_SESION',
      plantillasDisponibles: [],
      variablesResueltas: {},
      gateConfig: GO_LIVE_CONFIG,
    };

    const result = evaluarPlantillaProtegida(input);

    expect(result.ok).toBe(false);
    expect(result.severity).toBe('BLOCKING');
    expect(result.blocking_issues.length).toBeGreaterThan(0);
  });
});

describe('resolverPlantillaConvocatoria (DL-4)', () => {
  it('should auto-select CONVOCATORIA for SA entities', () => {
    const result = resolverPlantillaConvocatoria('SA', 'CONVOCATORIA_SL_NOTIFICACION');
    expect(result.tipoResuelto).toBe('CONVOCATORIA');
    expect(result.autoSeleccionada).toBe(true);
    expect(result.motivo).toContain('art. 173.1 LSC');
  });

  it('should auto-select CONVOCATORIA_SL_NOTIFICACION for SL entities', () => {
    const result = resolverPlantillaConvocatoria('SL', 'CONVOCATORIA');
    expect(result.tipoResuelto).toBe('CONVOCATORIA_SL_NOTIFICACION');
    expect(result.autoSeleccionada).toBe(true);
    expect(result.motivo).toContain('art. 173.2 LSC');
  });

  it('should NOT auto-select when SA already requesting CONVOCATORIA', () => {
    const result = resolverPlantillaConvocatoria('SA', 'CONVOCATORIA');
    expect(result.tipoResuelto).toBe('CONVOCATORIA');
    expect(result.autoSeleccionada).toBe(false);
  });

  it('should NOT auto-select when SL already requesting CONVOCATORIA_SL_NOTIFICACION', () => {
    const result = resolverPlantillaConvocatoria('SL', 'CONVOCATORIA_SL_NOTIFICACION');
    expect(result.tipoResuelto).toBe('CONVOCATORIA_SL_NOTIFICACION');
    expect(result.autoSeleccionada).toBe(false);
  });

  it('should NOT auto-select for non-convocatoria tipos', () => {
    const result = resolverPlantillaConvocatoria('SA', 'ACTA_SESION');
    expect(result.tipoResuelto).toBe('ACTA_SESION');
    expect(result.autoSeleccionada).toBe(false);
  });

  it('should NOT auto-select when tipoSocial is undefined', () => {
    const result = resolverPlantillaConvocatoria(undefined, 'CONVOCATORIA');
    expect(result.tipoResuelto).toBe('CONVOCATORIA');
    expect(result.autoSeleccionada).toBe(false);
  });
});
