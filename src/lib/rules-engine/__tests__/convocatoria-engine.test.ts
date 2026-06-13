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

  it('ITEM-005: un override de QUÓRUM no contamina la antelación de convocatoria', () => {
    const pack = createTestPack({
      convocatoria: {
        ...createTestPack().convocatoria,
        antelacionDias: {
          SA: { valor: 30, fuente: 'LEY', referencia: 'art. 176.1 LSC' },
          SL: { valor: 15, fuente: 'LEY', referencia: 'art. 176.1 LSC' },
        },
      },
    });

    const quorumOverride: RuleParamOverride = {
      id: 'ov-q33',
      entity_id: 'ent-001',
      materia: 'PRUEBA',
      clave: 'constitucion_quorum_pct',
      valor: 33,
      fuente: 'LEY',
      referencia: 'art. 194 LSC',
    };

    const result = evaluarConvocatoria(
      { ...defaultInput, tipoSocial: 'SA' },
      [pack],
      [quorumOverride]
    );

    // Antes: 33 > 30 → la antelación se inflaba a 33 días.
    expect(result.antelacionDiasRequerida).toBe(30);
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
  // Test 12b (ITEM-142): junta SA con plazo legal por defecto = "un mes"
  // computado de fecha a fecha (art. 176.1 LSC, art. 5.1 CC), NO 30 días.
  // ================================================================
  it('ITEM-142: junta SA sin pack usa "un mes" (fecha a fecha), no 30 días', () => {
    // Sin packs → ruta default legal. Agosto se alcanza desde un mes con 31
    // días (julio), donde "un mes antes" (9-jul) ≠ "30 días antes" (10-jul).
    const result = evaluarConvocatoria(
      {
        ...defaultInput,
        tipoSocial: 'SA',
        organoTipo: 'JUNTA_GENERAL',
        fechaJunta: '2026-08-09',
      },
      [], // sin rule packs → plazo legal por defecto
      []
    );

    // Cómputo correcto fecha-a-fecha: 9-ago → 9-jul.
    expect(result.fechaLimitePublicacion).toBe('2026-07-09');
    // NO el cómputo aproximado de 30 días (que daría 10-jul).
    expect(result.fechaLimitePublicacion).not.toBe('2026-07-10');
    // El día mostrado se mantiene como aproximación (30) para display.
    expect(result.antelacionDiasRequerida).toBe(30);
    // El explain refleja el cómputo mensual legal.
    const antelacionNode = result.explain.find((n) => n.regla === 'Antelación requerida');
    expect(antelacionNode?.mensaje).toContain('Un mes');
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

  // ================================================================
  // Test 16+: Dispatch por organoTipo (bug operativo: CdA recibía 30d)
  // ================================================================
  describe('antelación dispatch por organoTipo (sin packs aplicables)', () => {
    const baseInput: ConvocatoriaInput = {
      tipoSocial: 'SA',
      organoTipo: 'JUNTA_GENERAL',
      adoptionMode: 'MEETING',
      fechaJunta: '2026-12-31',
      esCotizada: false,
      webInscrita: false,
      primeraConvocatoria: true,
      esJuntaUniversal: false,
      materias: [],
    };

    it('Junta General SA: 30 días (LSC art. 176.1) — fuente LEY', () => {
      const result = evaluarConvocatoria({ ...baseInput, organoTipo: 'JGA' }, [], []);
      expect(result.antelacionDiasRequerida).toBe(30);
      expect(result.explain.find((n) => n.regla === 'Antelación requerida')?.fuente).toBe('LEY');
    });

    it('Junta General SL: 15 días (LSC art. 176.2)', () => {
      const result = evaluarConvocatoria(
        { ...baseInput, tipoSocial: 'SL', organoTipo: 'JUNTA_GENERAL' },
        [],
        [],
      );
      expect(result.antelacionDiasRequerida).toBe(15);
    });

    it('CdA: 5 días (default reglamento, NO 30) — fuente REGLAMENTO', () => {
      const result = evaluarConvocatoria({ ...baseInput, organoTipo: 'CDA' }, [], []);
      expect(result.antelacionDiasRequerida).toBe(5);
      // Jerarquía: LEY → ESTATUTOS → REGLAMENTO. El plazo de CdA NO es
      // estatutos (art. 285-290 LSC), sino reglamento del consejo
      // (art. 246.2 LSC habla de "convocatoria razonable").
      expect(result.explain.find((n) => n.regla === 'Antelación requerida')?.fuente).toBe('REGLAMENTO');
    });

    it('CONSEJO_ADMINISTRACION: fuente REGLAMENTO (matching liberal)', () => {
      const result = evaluarConvocatoria(
        { ...baseInput, organoTipo: 'CONSEJO_ADMINISTRACION' },
        [],
        [],
      );
      expect(result.explain.find((n) => n.regla === 'Antelación requerida')?.fuente).toBe('REGLAMENTO');
    });

    it('Comisión delegada: fuente REGLAMENTO', () => {
      const result = evaluarConvocatoria(
        { ...baseInput, organoTipo: 'COMISION_DELEGADA' },
        [],
        [],
      );
      expect(result.explain.find((n) => n.regla === 'Antelación requerida')?.fuente).toBe('REGLAMENTO');
    });

    it('CONSEJO_ADMINISTRACION: 5 días (matching liberal por substring)', () => {
      const result = evaluarConvocatoria(
        { ...baseInput, organoTipo: 'CONSEJO_ADMINISTRACION' },
        [],
        [],
      );
      expect(result.antelacionDiasRequerida).toBe(5);
    });

    it('Comisión delegada: 3 días', () => {
      const result = evaluarConvocatoria(
        { ...baseInput, organoTipo: 'COMISION_DELEGADA' },
        [],
        [],
      );
      expect(result.antelacionDiasRequerida).toBe(3);
    });

    it('Comité: 3 días', () => {
      const result = evaluarConvocatoria({ ...baseInput, organoTipo: 'COMITE' }, [], []);
      expect(result.antelacionDiasRequerida).toBe(3);
    });

    it('Pack del órgano con override aplicado: gana sobre default', () => {
      const pack = createTestPack({
        convocatoria: {
          ...createTestPack().convocatoria,
          antelacionDias: {
            SA: { valor: 8, fuente: 'ESTATUTOS', referencia: 'Reglamento CdA art. 7' },
            SL: { valor: 8, fuente: 'ESTATUTOS', referencia: 'Reglamento CdA art. 7' },
          },
        },
      });
      const result = evaluarConvocatoria({ ...baseInput, organoTipo: 'CDA' }, [pack], []);
      // Override del pack (8) gana sobre default de CdA (5).
      expect(result.antelacionDiasRequerida).toBe(8);
    });
  });

  // ================================================================
  // Codex P2 PR #3: canales publicación SÓLO para juntas.
  // ================================================================
  describe('canales publicación pública sólo aplica a juntas', () => {
    const baseInput: ConvocatoriaInput = {
      tipoSocial: 'SA',
      organoTipo: 'JUNTA_GENERAL',
      adoptionMode: 'MEETING',
      fechaJunta: '2026-12-31',
      esCotizada: false,
      webInscrita: true,
      primeraConvocatoria: true,
      esJuntaUniversal: false,
      materias: [],
    };

    it('CdA SA con web inscrita: NO añade WEB_SOCIEDAD (art. 246 LSC)', () => {
      const result = evaluarConvocatoria(
        { ...baseInput, organoTipo: 'CDA', webInscrita: true },
        [],
        [],
      );
      expect(result.canalesExigidos).not.toContain('WEB_SOCIEDAD');
      expect(result.canalesExigidos).not.toContain('BORME');
      expect(result.canalesExigidos).not.toContain('DIARIO_OFICIAL');
    });

    it('CdA SA sin web inscrita: NO añade BORME ni DIARIO_OFICIAL', () => {
      const result = evaluarConvocatoria(
        { ...baseInput, organoTipo: 'CDA', webInscrita: false },
        [],
        [],
      );
      expect(result.canalesExigidos).not.toContain('BORME');
      expect(result.canalesExigidos).not.toContain('DIARIO_OFICIAL');
      expect(result.canalesExigidos).not.toContain('WEB_SOCIEDAD');
    });

    it('CdA: explain node menciona notificación directa al miembro', () => {
      const result = evaluarConvocatoria(
        { ...baseInput, organoTipo: 'CONSEJO_ADMINISTRACION' },
        [],
        [],
      );
      const canalesNode = result.explain.find((n) => n.regla.includes('Canales:'));
      expect(canalesNode?.regla).toContain('notificación directa');
      expect(canalesNode?.referencia).toContain('art. 246');
    });

    it('Comisión: NO añade canales públicos', () => {
      const result = evaluarConvocatoria(
        { ...baseInput, organoTipo: 'COMISION_DELEGADA', webInscrita: true },
        [],
        [],
      );
      expect(result.canalesExigidos).not.toContain('WEB_SOCIEDAD');
      expect(result.canalesExigidos).not.toContain('BORME');
    });

    it('Junta SA con web inscrita: SÍ añade WEB_SOCIEDAD (caso original LSC art. 179)', () => {
      const result = evaluarConvocatoria(
        { ...baseInput, organoTipo: 'JGA', webInscrita: true },
        [],
        [],
      );
      expect(result.canalesExigidos).toContain('WEB_SOCIEDAD');
    });

    it('Junta SA sin web inscrita: SÍ añade BORME + DIARIO_OFICIAL', () => {
      const result = evaluarConvocatoria(
        { ...baseInput, organoTipo: 'JGA', webInscrita: false },
        [],
        [],
      );
      expect(result.canalesExigidos).toContain('BORME');
      expect(result.canalesExigidos).toContain('DIARIO_OFICIAL');
    });

    // Codex P2 round 7 PR #3: filtrar códigos abstractos non-junta.
    it('CdA: filtra códigos abstractos del rule_pack (CONVOCATORIA_CONSEJO)', () => {
      const packWithAbstractCode = createTestPack({
        convocatoria: {
          ...createTestPack().convocatoria,
          canales: {
            SA: ['CONVOCATORIA_CONSEJO', 'EMAIL_SIMPLE'],
            SL: ['CONVOCATORIA_CONSEJO', 'EMAIL_SIMPLE'],
          },
        },
      });
      const result = evaluarConvocatoria(
        { ...baseInput, organoTipo: 'CDA' },
        [packWithAbstractCode],
        [],
      );
      // Abstract code se elimina (Paso 5 UI no lo puede satisfacer)
      expect(result.canalesExigidos).not.toContain('CONVOCATORIA_CONSEJO');
      // Concretos del pack se preservan
      expect(result.canalesExigidos).toContain('EMAIL_SIMPLE');
    });

    it('CdA: filtra NOTIFICACION_GENERICA y NOTIFICACION_DIRECTA', () => {
      const pack = createTestPack({
        convocatoria: {
          ...createTestPack().convocatoria,
          canales: {
            SA: ['NOTIFICACION_GENERICA', 'NOTIFICACION_DIRECTA', 'ERDS'],
            SL: ['NOTIFICACION_GENERICA', 'ERDS'],
          },
        },
      });
      const result = evaluarConvocatoria(
        { ...baseInput, organoTipo: 'CDA' },
        [pack],
        [],
      );
      expect(result.canalesExigidos).not.toContain('NOTIFICACION_GENERICA');
      expect(result.canalesExigidos).not.toContain('NOTIFICACION_DIRECTA');
      expect(result.canalesExigidos).toContain('ERDS');
    });

    it('JGA: NO filtra códigos del pack (sólo aplica filtro a non-junta)', () => {
      const pack = createTestPack({
        convocatoria: {
          ...createTestPack().convocatoria,
          canales: {
            SA: ['NOTIFICACION_GENERICA', 'WEB_SOCIEDAD'],
            SL: ['NOTIFICACION_GENERICA'],
          },
        },
      });
      const result = evaluarConvocatoria(
        { ...baseInput, organoTipo: 'JGA', webInscrita: true },
        [pack],
        [],
      );
      // Para junta, los códigos del pack se mantienen tal cual.
      expect(result.canalesExigidos).toContain('NOTIFICACION_GENERICA');
      expect(result.canalesExigidos).toContain('WEB_SOCIEDAD');
    });

    // Codex P2 round 15 PR #3: fallback ERDS cuando filtro deja non-
    // junta sin canales concretos.
    it('CdA con pack 100% abstracto: fallback ERDS añadido (ES default)', () => {
      const pack = createTestPack({
        convocatoria: {
          ...createTestPack().convocatoria,
          canales: {
            SA: ['CONVOCATORIA_CONSEJO', 'NOTIFICACION_GENERICA'],
            SL: ['CONVOCATORIA_CONSEJO'],
          },
        },
      });
      const result = evaluarConvocatoria(
        { ...baseInput, organoTipo: 'CDA', jurisdiction: 'ES' },
        [pack],
        [],
      );
      expect(result.canalesExigidos).not.toContain('CONVOCATORIA_CONSEJO');
      expect(result.canalesExigidos).not.toContain('NOTIFICACION_GENERICA');
      expect(result.canalesExigidos).toContain('ERDS');
      const fallbackNode = result.explain.find((n) => n.regla.includes('fallback ERDS'));
      expect(fallbackNode).toBeDefined();
      expect(fallbackNode?.fuente).toBe('SISTEMA');
    });

    // Codex P2 round 17 PR #3: fallback por jurisdicción.
    it('CdA BR con pack abstracto: fallback EMAIL_SIMPLE (único directo en BR)', () => {
      const pack = createTestPack({
        convocatoria: {
          ...createTestPack().convocatoria,
          canales: {
            SA: ['CONVOCATORIA_CONSEJO'],
            SL: ['CONVOCATORIA_CONSEJO'],
          },
        },
      });
      const result = evaluarConvocatoria(
        { ...baseInput, organoTipo: 'CDA', jurisdiction: 'BR' },
        [pack],
        [],
      );
      expect(result.canalesExigidos).toContain('EMAIL_SIMPLE');
      expect(result.canalesExigidos).not.toContain('ERDS');
    });

    it('CdA MX con pack abstracto: fallback CORREO_CERTIFICADO', () => {
      const pack = createTestPack({
        convocatoria: {
          ...createTestPack().convocatoria,
          canales: {
            SA: ['CONVOCATORIA_CONSEJO'],
            SL: ['CONVOCATORIA_CONSEJO'],
          },
        },
      });
      const result = evaluarConvocatoria(
        { ...baseInput, organoTipo: 'CDA', jurisdiction: 'MX' },
        [pack],
        [],
      );
      expect(result.canalesExigidos).toContain('CORREO_CERTIFICADO');
      expect(result.canalesExigidos).not.toContain('ERDS');
    });

    it('CdA sin jurisdiction (legacy): asume ES → ERDS', () => {
      const pack = createTestPack({
        convocatoria: {
          ...createTestPack().convocatoria,
          canales: {
            SA: ['CONVOCATORIA_CONSEJO'],
            SL: ['CONVOCATORIA_CONSEJO'],
          },
        },
      });
      const result = evaluarConvocatoria(
        { ...baseInput, organoTipo: 'CDA' /* sin jurisdiction */ },
        [pack],
        [],
      );
      expect(result.canalesExigidos).toContain('ERDS');
    });

    it('CdA con pack que ya tiene canal concreto: no añade fallback', () => {
      const pack = createTestPack({
        convocatoria: {
          ...createTestPack().convocatoria,
          canales: {
            SA: ['CONVOCATORIA_CONSEJO', 'BUROFAX'],
            SL: ['BUROFAX'],
          },
        },
      });
      const result = evaluarConvocatoria(
        { ...baseInput, organoTipo: 'CDA' },
        [pack],
        [],
      );
      expect(result.canalesExigidos).toContain('BUROFAX');
      expect(result.canalesExigidos).not.toContain('CONVOCATORIA_CONSEJO');
      const fallbackNode = result.explain.find((n) => n.regla.includes('fallback ERDS'));
      expect(fallbackNode).toBeUndefined();
    });
  });

  // ================================================================
  // ITEM-093: plazo de antelación incumplido produce WARNING
  // ================================================================
  describe('plazo de antelación (ITEM-093)', () => {
    it('emite WARNING cuando la publicación es posterior a la fecha límite', () => {
      const pack = createTestPack();
      // SA, junta el 2026-05-15, antelación 1 mes → límite 2026-04-15.
      // Publicación el 2026-05-01 (tarde) → plazo incumplido.
      const result = evaluarConvocatoria(
        { ...defaultInput, tipoSocial: 'SA', fechaPublicacion: '2026-05-01' },
        [pack],
        [],
      );

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some((w) => w.includes('antelación incumplido'))).toBe(true);
      expect(result.severity).toBe('WARNING');
      const node = result.explain.find(
        (n) => n.regla === 'Antelación cumplida' && n.resultado === 'WARNING',
      );
      expect(node).toBeDefined();
    });

    it('NO emite WARNING cuando la publicación respeta la antelación', () => {
      const pack = createTestPack();
      // SA, junta el 2026-05-15, límite 2026-04-15. Publicación 2026-04-01 → OK.
      const result = evaluarConvocatoria(
        { ...defaultInput, tipoSocial: 'SA', fechaPublicacion: '2026-04-01' },
        [pack],
        [],
      );

      expect(result.warnings.length).toBe(0);
      expect(result.severity).toBe('OK');
      const node = result.explain.find(
        (n) => n.regla === 'Antelación cumplida' && n.resultado === 'OK',
      );
      expect(node).toBeDefined();
    });

    it('NO evalúa el plazo cuando no se proporciona fechaPublicacion', () => {
      const pack = createTestPack();
      const result = evaluarConvocatoria(
        { ...defaultInput, tipoSocial: 'SA' },
        [pack],
        [],
      );

      expect(result.warnings.length).toBe(0);
      expect(result.explain.some((n) => n.regla === 'Antelación cumplida')).toBe(false);
    });
  });
});
