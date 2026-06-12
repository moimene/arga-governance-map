// ITEM-113 — Tests de la tabla de normalización de materias para pactos parasociales
import { describe, it, expect } from 'vitest';
import {
  normalizeMateriaPacto,
  materiaPactoCoincide,
  materiasPactoCoincidentes,
} from '../materia-pacto-mapping';
import { evaluarPactosParasociales } from '../pactos-engine';
import type { PactoParasocial, PactosEvalInput } from '../pactos-engine';

// ─── normalizeMateriaPacto ─────────────────────────────────────────────────

describe('ITEM-113 normalizeMateriaPacto', () => {
  it('colapsa AUMENTO_CAPITAL y AMPLIACION_CAPITAL a la misma canónica', () => {
    expect(normalizeMateriaPacto('AUMENTO_CAPITAL')).toEqual(['AMPLIACION_CAPITAL']);
    expect(normalizeMateriaPacto('AMPLIACION_CAPITAL')).toEqual(['AMPLIACION_CAPITAL']);
  });

  it('colapsa DISOLUCION y LIQUIDACION a la misma canónica', () => {
    expect(normalizeMateriaPacto('DISOLUCION')).toEqual(['LIQUIDACION']);
    expect(normalizeMateriaPacto('LIQUIDACION')).toEqual(['LIQUIDACION']);
  });

  it('mapea VENTA_ACTIVOS_SUSTANCIALES y VENTA_ACTIVOS_ESENCIALES a la misma canónica', () => {
    expect(normalizeMateriaPacto('VENTA_ACTIVOS_SUSTANCIALES')).toEqual(['VENTA_ACTIVOS_ESENCIALES']);
    expect(normalizeMateriaPacto('VENTA_ACTIVOS_ESENCIALES')).toEqual(['VENTA_ACTIVOS_ESENCIALES']);
  });

  it('preserva las materias estructurales puras', () => {
    expect(normalizeMateriaPacto('FUSION')).toEqual(['FUSION']);
    expect(normalizeMateriaPacto('ESCISION')).toEqual(['ESCISION']);
    expect(normalizeMateriaPacto('TRANSFORMACION')).toEqual(['TRANSFORMACION']);
  });

  it('expande la materia paraguas OPERACION_ESTRUCTURAL a las estructurales canónicas', () => {
    const expanded = normalizeMateriaPacto('OPERACION_ESTRUCTURAL');
    expect(expanded).toContain('FUSION');
    expect(expanded).toContain('ESCISION');
    expect(expanded).toContain('LIQUIDACION');
    expect(expanded).toContain('TRANSFORMACION');
    expect(expanded).toContain('VENTA_ACTIVOS_ESENCIALES');
  });

  it('normaliza grafía: minúsculas, tildes, espacios y guiones', () => {
    expect(normalizeMateriaPacto('aumento de capital')).toEqual(['AMPLIACION_CAPITAL']);
    expect(normalizeMateriaPacto('Disolución')).toEqual(['LIQUIDACION']);
    expect(normalizeMateriaPacto('Venta-Activos-Esenciales')).toEqual(['VENTA_ACTIVOS_ESENCIALES']);
  });

  it('devuelve la forma normalizada literal cuando no hay mapeo conocido', () => {
    expect(normalizeMateriaPacto('MATERIA_DESCONOCIDA')).toEqual(['MATERIA_DESCONOCIDA']);
    expect(normalizeMateriaPacto('materia desconocida')).toEqual(['MATERIA_DESCONOCIDA']);
  });

  it('devuelve array vacío para entrada vacía', () => {
    expect(normalizeMateriaPacto('')).toEqual([]);
    expect(normalizeMateriaPacto('   ')).toEqual([]);
  });
});

// ─── materiaPactoCoincide / materiasPactoCoincidentes ───────────────────────

describe('ITEM-113 materiaPactoCoincide', () => {
  it('hace match entre AUMENTO_CAPITAL operativo y AMPLIACION_CAPITAL del pacto', () => {
    expect(materiaPactoCoincide('AUMENTO_CAPITAL', ['AMPLIACION_CAPITAL'])).toBe(true);
  });

  it('hace match entre DISOLUCION del pacto y LIQUIDACION operativa', () => {
    expect(materiaPactoCoincide('LIQUIDACION', ['DISOLUCION'])).toBe(true);
  });

  it('OPERACION_ESTRUCTURAL operativa hace match con FUSION del pacto', () => {
    expect(materiaPactoCoincide('OPERACION_ESTRUCTURAL', ['FUSION', 'ESCISION'])).toBe(true);
  });

  it('no hace match cuando las materias no se solapan', () => {
    expect(materiaPactoCoincide('NOMBRAMIENTO_CONSEJERO', ['FUSION', 'ESCISION'])).toBe(false);
  });

  it('materiasPactoCoincidentes conserva la grafía original del acuerdo', () => {
    const out = materiasPactoCoincidentes(
      ['AUMENTO_CAPITAL', 'NOMBRAMIENTO_CONSEJERO'],
      ['AMPLIACION_CAPITAL', 'EMISION_CONVERTIBLES'],
    );
    expect(out).toEqual(['AUMENTO_CAPITAL']);
  });
});

// ─── Integración con evaluarPactosParasociales ──────────────────────────────

function makeInput(overrides?: Partial<PactosEvalInput>): PactosEvalInput {
  return {
    materias: [],
    capitalPresente: 1000,
    capitalTotal: 1000,
    votosFavor: 800,
    votosContra: 200,
    consentimientosPrevios: [],
    vetoRenunciado: [],
    ...overrides,
  };
}

const PACTO_VETO_CLOUD: PactoParasocial = {
  id: 'veto-fundacion',
  titulo: 'Veto Fundación ARGA',
  tipo_clausula: 'VETO',
  firmantes: [{ nombre: 'Fundación ARGA', tipo: 'SOCIO', capital_pct: 69.69 }],
  // Vocabulario tal como vive en Cloud
  materias_aplicables: ['FUSION', 'ESCISION', 'DISOLUCION', 'VENTA_ACTIVOS_SUSTANCIALES', 'TRANSFORMACION'],
  titular_veto: 'Fundación ARGA',
  estado: 'VIGENTE',
};

const PACTO_MAYORIA_CLOUD: PactoParasocial = {
  id: 'mayoria-capital',
  titulo: 'Mayoría reforzada 75% capital',
  tipo_clausula: 'MAYORIA_REFORZADA_PACTADA',
  firmantes: [{ nombre: 'Fundación ARGA', tipo: 'SOCIO', capital_pct: 69.69 }],
  materias_aplicables: ['AMPLIACION_CAPITAL', 'EMISION_CONVERTIBLES', 'EXCLUSION_PREFERENTE'],
  umbral_activacion: 0.75,
  estado: 'VIGENTE',
};

describe('ITEM-113 integración pactos-engine: el veto YA dispara con vocabulario operativo', () => {
  it('DISOLUCION del pacto dispara veto BLOCKING con materia operativa LIQUIDACION', () => {
    const out = evaluarPactosParasociales([PACTO_VETO_CLOUD], makeInput({ materias: ['LIQUIDACION'] }));
    expect(out.pacto_ok).toBe(false);
    expect(out.pactos_aplicables).toBe(1);
    expect(out.blocking_issues.length).toBeGreaterThan(0);
  });

  it('VENTA_ACTIVOS_ESENCIALES operativa dispara veto contra VENTA_ACTIVOS_SUSTANCIALES del pacto', () => {
    const out = evaluarPactosParasociales([PACTO_VETO_CLOUD], makeInput({ materias: ['VENTA_ACTIVOS_ESENCIALES'] }));
    expect(out.pacto_ok).toBe(false);
    expect(out.pactos_aplicables).toBe(1);
  });

  it('OPERACION_ESTRUCTURAL (CoAprobacion) dispara el veto de Fundación ARGA', () => {
    const out = evaluarPactosParasociales([PACTO_VETO_CLOUD], makeInput({ materias: ['OPERACION_ESTRUCTURAL'] }));
    expect(out.pacto_ok).toBe(false);
    expect(out.pactos_aplicables).toBe(1);
  });

  it('AUMENTO_CAPITAL operativo evalúa la mayoría reforzada pactada (AMPLIACION_CAPITAL del pacto)', () => {
    const cumple = evaluarPactosParasociales(
      [PACTO_MAYORIA_CLOUD],
      makeInput({ materias: ['AUMENTO_CAPITAL'], votosFavor: 800, capitalPresente: 1000 }),
    );
    expect(cumple.pactos_aplicables).toBe(1);
    expect(cumple.pacto_ok).toBe(true); // 80% >= 75%

    const incumple = evaluarPactosParasociales(
      [PACTO_MAYORIA_CLOUD],
      makeInput({ materias: ['AUMENTO_CAPITAL'], votosFavor: 600, capitalPresente: 1000 }),
    );
    expect(incumple.pactos_aplicables).toBe(1);
    expect(incumple.pacto_ok).toBe(false); // 60% < 75%
  });

  it('materia sin solape no activa el pacto', () => {
    const out = evaluarPactosParasociales([PACTO_VETO_CLOUD], makeInput({ materias: ['NOMBRAMIENTO_CONSEJERO'] }));
    expect(out.pacto_ok).toBe(true);
    expect(out.pactos_aplicables).toBe(0);
  });
});
