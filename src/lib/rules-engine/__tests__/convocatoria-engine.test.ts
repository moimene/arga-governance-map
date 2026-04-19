// ============================================================
// Motor de Reglas LSC — Convocatoria Engine Tests
// Spec: docs/superpowers/specs/2026-04-19-motor-reglas-lsc-secretaria-design.md §6
// ============================================================

import { describe, it, expect } from 'vitest';
import { evaluarConvocatoria } from '../convocatoria-engine';
import type { RulePack, ConvocatoriaInput, RuleParamOverride } from '../types';

// ================================================================
// Helper: createTestPack
// ================================================================
/**
 * createTestPack — creates a minimal valid RulePack for testing
 *
 * Provides sensible defaults for all required fields, allowing
 * targeted overrides via the partial RulePack.
 */
function createTestPack(overrides?: Partial<RulePack>): RulePack {
  const baseId = Math.random().toString(36).substr(2, 9);

  return {
    id: `pack-${baseId}`,
    materia: 'PRUEBA',
    clase: 'ORDINARIA',
    organoTipo: 'JUNTA_GENERAL',
    modosAdopcionPermitidos: ['MEETING'],
    convocatoria: {
      antelacionDias: {
        SA: { valor: 30, fuente: 'LEY', referencia: 'art. 176.1 LSC' },
        SL: { valor: 15, fuente: 'LEY', referencia: 'art. 176.2 LSC' },
      },
      canales: {
        SA: ['BORME', 'WEB_SOCIEDAD'],
        SL: ['BUROFAX', 'EMAIL_CERTIFICADO'],
      },
      contenidoMinimo: [
        'Orden del día',
        'Lugar',
        'Hora',
        'Fecha',
      ],
      documentosObligatorios: [
        {
          id: 'doc-001',
          nombre: 'Informe de gestión',
          condicion: 'Si se revisan cuentas',
        },
      ],
    },
    constitucion: {
      quorum: {
        SA_1a: { valor: 0.25, fuente: 'LEY', referencia: 'art. 187 LSC' },
        SA_2a: { valor: 0, fuente: 'LEY', referencia: 'art. 187 LSC' },
        SL: { valor: 0, fuente: 'LEY', referencia: 'art. 197 LSC' },
        CONSEJO: {
          valor: 'mayoria_miembros',
          fuente: 'LEY',
          referencia: 'art. 240 LSC',
        },
      },
    },
    votacion: {
      mayoria: {
        SA: {
          formula: 'favor > contra',
          fuente: 'LEY',
          referencia: 'art. 189 LSC',
        },
        SL: {
          formula: 'favor > contra',
          fuente: 'LEY',
          referencia: 'art. 199 LSC',
        },
        CONSEJO: {
          formula: 'mayoria_miembros',
          fuente: 'LEY',
          referencia: 'art. 242 LSC',
        },
      },
      abstenciones: 'no_cuentan',
    },
    documentacion: {
      obligatoria: [
        {
          id: 'doc-001',
          nombre: 'Informe de gestión',
        },
      ],
      ventanaDisponibilidad: {
        dias: 30,
        fuente: 'LEY',
      },
    },
    acta: {
      tipoActaPorModo: {
        MEETING: 'ACTA_JUNTA',
      },
      contenidoMinimo: {
        sesion: [
          'Fecha y hora',
          'Asistentes',
          'Orden del día',
          'Acuerdos adoptados',
        ],
        consignacion: ['Propuesta', 'Decisión'],
        acuerdoEscrito: ['Propuesta', 'Aceptaciones', 'Rechazo'],
      },
      requiereTranscripcionLibroActas: true,
      requiereConformidadConjunta: false,
    },
    plazosMateriales: {
      inscripcion: {
        plazo_dias: 30,
        fuente: 'LEY',
        referencia: 'art. 215 LSC',
      },
    },
    postAcuerdo: {
      inscribible: false,
      instrumentoRequerido: 'NINGUNO',
      publicacionRequerida: false,
    },
    ...overrides,
  };
}

// ================================================================
// Tests
// ================================================================

describe('evaluarConvocatoria', () => {
  const defaultInput: ConvocatoriaInput = {
    tipoSocial: 'SA',
    organoTipo: 'JUNTA_GENERAL',
    adoptionMode: 'MEETING',
    fechaJunta: '2026-05-15',
    esCotizada: false,
    webInscrita: false,
    primeraConvocatoria: true,
    esJuntaUniversal: false,
    materias: ['APROBACION_CUENTAS'],
  };

  // ================================================================
  // Test 1: SA antelación 30 días (art. 176.1 LSC)
  // ================================================================
  it('SA: antelación 30 días (art. 176.1 LSC)', () => {
    const pack = createTestPack({
      convocatoria: {
        ...createTestPack().convocatoria,
        antelacionDias: {
          SA: { valor: 30, fuente: 'LEY', referencia: 'art. 176.1 LSC' },
          SL: { valor: 15, fuente: 'LEY', referencia: 'art. 176.2 LSC' },
        },
      },
    });

    const result = evaluarConvocatoria(
      { ...defaultInput, tipoSocial: 'SA' },
      [pack],
      []
    );

    expect(result.antelacionDiasRequerida).toBe(30);
    expect(result.severity).toBe('OK');
    expect(result.ok).toBe(true);
    expect(result.explain.length).toBeGreaterThan(0);
    expect(result.explain[0].fuente).toBe('LEY');
  });

  // ================================================================
  // Test 2: SL antelación 15 días (art. 176.2 LSC)
  // ================================================================
  it('SL: antelación 15 días (art. 176.2 LSC)', () => {
    const pack = createTestPack({
      convocatoria: {
        ...createTestPack().convocatoria,
        antelacionDias: {
          SA: { valor: 30, fuente: 'LEY', referencia: 'art. 176.1 LSC' },
          SL: { valor: 15, fuente: 'LEY', referencia: 'art. 176.2 LSC' },
        },
      },
    });

    const result = evaluarConvocatoria(
      { ...defaultInput, tipoSocial: 'SL' },
      [pack],
      []
    );

    expect(result.antelacionDiasRequerida).toBe(15);
    expect(result.ok).toBe(true);
  });

  // ================================================================
  // Test 3: Junta universal — bypass completo
  // ================================================================
  it('Junta universal: bypass completo', () => {
    const pack = createTestPack();

    const result = evaluarConvocatoria(
      { ...defaultInput, esJuntaUniversal: true },
      [pack],
      []
    );

    expect(result.ok).toBe(true);
    expect(result.antelacionDiasRequerida).toBe(0);
    expect(result.canalesExigidos).toHaveLength(0);
    expect(result.documentosObligatorios).toHaveLength(0);
    expect(result.explain[0].mensaje).toMatch(/junta universal/i);
  });

  // ================================================================
  // Test 4: Multi-materia — rige la antelación más estricta
  // ================================================================
  it('Multi-materia: rige la antelación más estricta', () => {
    const pack1 = createTestPack({
      id: 'pack-1',
      materia: 'APROBACION_CUENTAS',
      convocatoria: {
        ...createTestPack().convocatoria,
        antelacionDias: {
          SA: { valor: 30, fuente: 'LEY', referencia: 'art. 176.1 LSC' },
          SL: { valor: 15, fuente: 'LEY', referencia: 'art. 176.2 LSC' },
        },
      },
    });

    const pack2 = createTestPack({
      id: 'pack-2',
      materia: 'MOD_ESTATUTOS',
      convocatoria: {
        ...createTestPack().convocatoria,
        antelacionDias: {
          SA: { valor: 60, fuente: 'ESTATUTOS', referencia: 'Estatutos art. 12' },
          SL: { valor: 30, fuente: 'ESTATUTOS', referencia: 'Estatutos art. 12' },
        },
      },
    });

    const result = evaluarConvocatoria(
      {
        ...defaultInput,
        tipoSocial: 'SA',
        materias: ['APROBACION_CUENTAS', 'MOD_ESTATUTOS'],
      },
      [pack1, pack2],
      []
    );

    // Should take max (60 > 30)
    expect(result.antelacionDiasRequerida).toBe(60);
  });

  // ================================================================
  // Test 5: SA sin web inscrita — BORME + diario exigidos
  // ================================================================
  it('SA sin web inscrita: BORME + diario exigidos', () => {
    const pack = createTestPack({
      convocatoria: {
        ...createTestPack().convocatoria,
        canales: {
          SA: [],
          SL: [],
        },
      },
    });

    const result = evaluarConvocatoria(
      {
        ...defaultInput,
        tipoSocial: 'SA',
        webInscrita: false,
      },
      [pack],
      []
    );

    expect(result.canalesExigidos).toContain('BORME');
    expect(result.canalesExigidos).toContain('DIARIO_OFICIAL');
  });

  // ================================================================
  // Test 6: SA con web inscrita — WEB_SOCIEDAD exigido
  // ================================================================
  it('SA con web inscrita: WEB_SOCIEDAD exigido', () => {
    const pack = createTestPack({
      convocatoria: {
        ...createTestPack().convocatoria,
        canales: {
          SA: [],
          SL: [],
        },
      },
    });

    const result = evaluarConvocatoria(
      {
        ...defaultInput,
        tipoSocial: 'SA',
        webInscrita: true,
      },
      [pack],
      []
    );

    expect(result.canalesExigidos).toContain('WEB_SOCIEDAD');
  });

  // ================================================================
  // Test 7: Override estatutario que eleva plazo (40 días vs 30)
  // ================================================================
  it('Override estatutario que eleva plazo (40 días)', () => {
    const pack = createTestPack({
      convocatoria: {
        ...createTestPack().convocatoria,
        antelacionDias: {
          SA: { valor: 30, fuente: 'LEY', referencia: 'art. 176.1 LSC' },
          SL: { valor: 15, fuente: 'LEY', referencia: 'art. 176.2 LSC' },
        },
      },
    });

    const override: RuleParamOverride = {
      id: 'ov-001',
      entity_id: 'ent-001',
      materia: 'PRUEBA',
      clave: 'antelacion_sa',
      valor: 40,
      fuente: 'ESTATUTOS',
      referencia: 'Estatutos art. 15',
    };

    const result = evaluarConvocatoria(
      { ...defaultInput, tipoSocial: 'SA' },
      [pack],
      [override]
    );

    expect(result.antelacionDiasRequerida).toBe(40);
  });

  // ================================================================
  // Test 8: Documentos — unión de obligatorios de todos los packs
  // ================================================================
  it('Documentos: unión de obligatorios de todos los packs', () => {
    const pack1 = createTestPack({
      id: 'pack-1',
      convocatoria: {
        ...createTestPack().convocatoria,
        documentosObligatorios: [
          { id: 'doc-001', nombre: 'Informe de gestión' },
        ],
      },
    });

    const pack2 = createTestPack({
      id: 'pack-2',
      convocatoria: {
        ...createTestPack().convocatoria,
        documentosObligatorios: [
          { id: 'doc-002', nombre: 'Informe de auditor' },
        ],
      },
    });

    const result = evaluarConvocatoria(
      defaultInput,
      [pack1, pack2],
      []
    );

    expect(result.documentosObligatorios.length).toBeGreaterThanOrEqual(2);
    const ids = result.documentosObligatorios.map((d) => d.id);
    expect(ids).toContain('doc-001');
    expect(ids).toContain('doc-002');
  });

  // ================================================================
  // Test 9: Unipersonal_socio — skip completo convocatoria
  // ================================================================
  it('Unipersonal_socio: skip completo convocatoria', () => {
    const pack = createTestPack();

    const result = evaluarConvocatoria(
      { ...defaultInput, adoptionMode: 'UNIPERSONAL_SOCIO' },
      [pack],
      []
    );

    expect(result.ok).toBe(true);
    expect(result.antelacionDiasRequerida).toBe(0);
    expect(result.canalesExigidos).toHaveLength(0);
    expect(result.explain[0].mensaje).toMatch(/unipersonal/i);
  });

  // ================================================================
  // Test 10: Unipersonal_admin — skip completo convocatoria
  // ================================================================
  it('Unipersonal_admin: skip completo convocatoria', () => {
    const pack = createTestPack();

    const result = evaluarConvocatoria(
      { ...defaultInput, adoptionMode: 'UNIPERSONAL_ADMIN' },
      [pack],
      []
    );

    expect(result.ok).toBe(true);
    expect(result.antelacionDiasRequerida).toBe(0);
    expect(result.canalesExigidos).toHaveLength(0);
    expect(result.explain[0].mensaje).toMatch(/unipersonal/i);
  });

  // ================================================================
  // Test 11: Contenido mínimo incluye orden del día
  // ================================================================
  it('Contenido mínimo incluye orden del día', () => {
    const pack = createTestPack({
      convocatoria: {
        ...createTestPack().convocatoria,
        contenidoMinimo: [],
      },
    });

    const result = evaluarConvocatoria(
      defaultInput,
      [pack],
      []
    );

    expect(result.contenidoMinimo).toContain('Orden del día');
  });

  // ================================================================
  // Test 12: Fecha límite calculada correctamente
  // ================================================================
  it('Fecha límite calculada correctamente', () => {
    const pack = createTestPack({
      convocatoria: {
        ...createTestPack().convocatoria,
        antelacionDias: {
          SA: { valor: 30, fuente: 'LEY', referencia: 'art. 176.1 LSC' },
          SL: { valor: 15, fuente: 'LEY', referencia: 'art. 176.2 LSC' },
        },
      },
    });

    const result = evaluarConvocatoria(
      {
        ...defaultInput,
        tipoSocial: 'SA',
        fechaJunta: '2026-06-15',
      },
      [pack],
      []
    );

    // 30 days before 2026-06-15 should be approximately 2026-05-16
    const expectedDate = new Date('2026-06-15');
    expectedDate.setDate(expectedDate.getDate() - 30);
    const expectedDateStr = expectedDate.toISOString().split('T')[0];

    expect(result.fechaLimitePublicacion).toBe(expectedDateStr);
  });

  // ================================================================
  // Test 13: Pack sin documentos obligatorios — array vacío
  // ================================================================
  it('Pack sin documentos obligatorios: array vacío', () => {
    const pack = createTestPack({
      convocatoria: {
        ...createTestPack().convocatoria,
        documentosObligatorios: undefined,
      },
    });

    const result = evaluarConvocatoria(
      defaultInput,
      [pack],
      []
    );

    expect(Array.isArray(result.documentosObligatorios)).toBe(true);
  });

  // ================================================================
  // Test 14: Ventana disponibilidad calculada
  // ================================================================
  it('Ventana disponibilidad calculada', () => {
    const pack = createTestPack();

    const result = evaluarConvocatoria(
      {
        ...defaultInput,
        tipoSocial: 'SA',
        fechaJunta: '2026-06-15',
      },
      [pack],
      []
    );

    const ventana = result.ventanaDisponibilidad;

    // Check that desde < hasta
    expect(new Date(ventana.desde) < new Date(ventana.hasta)).toBe(true);
    expect(ventana.hasta).toBe('2026-06-15');
  });

  // ================================================================
  // Test 15: Multiple packs with overlapping documentos
  // ================================================================
  it('Multiple packs with overlapping documentos — deduplication', () => {
    const pack1 = createTestPack({
      id: 'pack-1',
      convocatoria: {
        ...createTestPack().convocatoria,
        documentosObligatorios: [
          { id: 'doc-001', nombre: 'Informe de gestión' },
          { id: 'doc-002', nombre: 'Informe de auditor' },
        ],
      },
    });

    const pack2 = createTestPack({
      id: 'pack-2',
      convocatoria: {
        ...createTestPack().convocatoria,
        documentosObligatorios: [
          { id: 'doc-001', nombre: 'Informe de gestión' }, // duplicate
          { id: 'doc-003', nombre: 'Propuesta de distribución' },
        ],
      },
    });

    const result = evaluarConvocatoria(
      defaultInput,
      [pack1, pack2],
      []
    );

    const ids = result.documentosObligatorios.map((d) => d.id);
    // Should have 3 unique docs (001, 002, 003)
    expect(new Set(ids).size).toBe(3);
  });
});
