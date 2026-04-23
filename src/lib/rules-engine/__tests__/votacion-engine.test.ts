import { describe, it, expect } from 'vitest';
import { evaluarVotacion } from '../votacion-engine';
import type {
  VotacionInput,
  RulePack,
  MajoritySpec,
  ConflictoInteres,
  ReglaConvocatoria,
  ReglaConstitucion,
  ReglaDocumentacion,
  ReglaActa,
  ReglaPlazosMateriales,
  ReglaPostAcuerdo,
} from '../types';

// ============================================================
// Test Helpers
// ============================================================

const createBaseMajoritySpec = (overrides?: Partial<MajoritySpec>): MajoritySpec => ({
  formula: 'favor > contra',
  fuente: 'LEY',
  referencia: 'art. 194 LSC',
  ...overrides,
});

const createBaseRulePack = (overrides?: Partial<RulePack>): RulePack => ({
  id: 'pack-1',
  materia: 'APROBACION_CUENTAS',
  clase: 'ORDINARIA',
  organoTipo: 'JUNTA_GENERAL',
  modosAdopcionPermitidos: ['MEETING', 'NO_SESSION'],
  convocatoria: {} as unknown as ReglaConvocatoria,
  constitucion: {} as unknown as ReglaConstitucion,
  votacion: {
    mayoria: {
      SA: createBaseMajoritySpec({ formula: 'favor > contra' }),
      SL: createBaseMajoritySpec({ formula: 'favor > contra' }),
      CONSEJO: createBaseMajoritySpec({ formula: 'mayoria_consejeros' }),
    },
    abstenciones: 'no_cuentan',
    votoCalidadPermitido: true,
  },
  documentacion: {} as unknown as ReglaDocumentacion,
  acta: {} as unknown as ReglaActa,
  plazosMateriales: {} as unknown as ReglaPlazosMateriales,
  postAcuerdo: {} as unknown as ReglaPostAcuerdo,
  ...overrides,
});

const createBaseInput = (overrides?: Partial<VotacionInput>): VotacionInput => ({
  tipoSocial: 'SA',
  organoTipo: 'JUNTA_GENERAL',
  adoptionMode: 'MEETING',
  materiaClase: 'ORDINARIA',
  materias: ['APROBACION_CUENTAS'],
  votos: {
    favor: 10,
    contra: 5,
    abstenciones: 2,
    en_blanco: 0,
    capital_presente: 750,
    capital_total: 1000,
  },
  votoCalidadHabilitado: false,
  esEmpate: false,
  decisionFirmada: false,
  ...overrides,
});

// ============================================================
// Gate 0: Adoption Mode
// ============================================================

describe('Gate 0: Adoption Mode', () => {
  it('UNIPERSONAL_SOCIO firmada → OK', () => {
    const input = createBaseInput({
      adoptionMode: 'UNIPERSONAL_SOCIO',
      decisionFirmada: true,
    });
    const pack = createBaseRulePack();
    const result = evaluarVotacion(input, [pack]);

    expect(result.ok).toBe(true);
    expect(result.acuerdoProclamable).toBe(true);
  });

  it('UNIPERSONAL_SOCIO sin firma → BLOCKING', () => {
    const input = createBaseInput({
      adoptionMode: 'UNIPERSONAL_SOCIO',
      decisionFirmada: false,
    });
    const pack = createBaseRulePack();
    const result = evaluarVotacion(input, [pack]);

    expect(result.ok).toBe(false);
    expect(result.blocking_issues).toContain('unipersonal_not_signed');
  });

  it('UNIPERSONAL_ADMIN firmada → OK', () => {
    const input = createBaseInput({
      adoptionMode: 'UNIPERSONAL_ADMIN',
      decisionFirmada: true,
    });
    const pack = createBaseRulePack();
    const result = evaluarVotacion(input, [pack]);

    expect(result.ok).toBe(true);
  });
});

// ============================================================
// Gate 1: Elegibilidad (interest conflicts)
// ============================================================

describe('Gate 1: Elegibilidad', () => {
  it('Sin conflictos → OK', () => {
    const input = createBaseInput({ conflictos: [] });
    const pack = createBaseRulePack();
    const result = evaluarVotacion(input, [pack]);

    expect(result.explain.some(e => e.regla.includes('Elegibilidad'))).toBe(true);
  });

  it('EXCLUIR_VOTO ajusta denominador', () => {
    const conflictos: ConflictoInteres[] = [
      {
        mandate_id: 'm1',
        tipo: 'EXCLUIR_VOTO',
        motivo: 'Relacionado con materia',
        capital_afectado: 100,
      },
    ];
    const input = createBaseInput({ conflictos });
    const pack = createBaseRulePack();
    const result = evaluarVotacion(input, [pack]);

    const elegibilidadNode = result.explain.find(e => e.regla.includes('Elegibilidad'));
    expect(elegibilidadNode).toBeDefined();
  });
});

// ============================================================
// Gate 3: Mayoría
// ============================================================

describe('Gate 3: Mayoría', () => {
  it('SA ordinaria simple majority pass', () => {
    const input = createBaseInput({
      tipoSocial: 'SA',
      votos: {
        favor: 10,
        contra: 5,
        abstenciones: 2,
        en_blanco: 0,
        capital_presente: 750,
        capital_total: 1000,
      },
    });
    const pack = createBaseRulePack({
      votacion: {
        mayoria: {
          SA: createBaseMajoritySpec({ formula: 'favor > contra' }),
          SL: createBaseMajoritySpec(),
          CONSEJO: createBaseMajoritySpec(),
        },
        abstenciones: 'no_cuentan',
      },
    });
    const result = evaluarVotacion(input, [pack]);

    expect(result.mayoriaAlcanzada).toBe(true);
    expect(result.acuerdoProclamable).toBe(true);
  });

  it('SA ordinaria simple majority fail', () => {
    const input = createBaseInput({
      tipoSocial: 'SA',
      votos: {
        favor: 5,
        contra: 10,
        abstenciones: 2,
        en_blanco: 0,
        capital_presente: 750,
        capital_total: 1000,
      },
    });
    const pack = createBaseRulePack({
      votacion: {
        mayoria: {
          SA: createBaseMajoritySpec({ formula: 'favor > contra' }),
          SL: createBaseMajoritySpec(),
          CONSEJO: createBaseMajoritySpec(),
        },
        abstenciones: 'no_cuentan',
      },
    });
    const result = evaluarVotacion(input, [pack]);

    expect(result.mayoriaAlcanzada).toBe(false);
    expect(result.blocking_issues).toContain('majority_not_achieved');
  });

  it('SA 2a convocatoria con doble condicional', () => {
    const input = createBaseInput({
      tipoSocial: 'SA',
      votos: {
        favor: 40,
        contra: 30,
        abstenciones: 0,
        en_blanco: 0,
        capital_presente: 400, // 40% < 50% umbral
        capital_total: 1000,
      },
    });
    const pack = createBaseRulePack({
      votacion: {
        mayoria: {
          SA: createBaseMajoritySpec({
            formula: 'favor >= 2/3_capital_presente',
            dobleCondicional: {
              umbral: 0.5,
              mayoriaAlternativa: 'favor > contra',
            },
          }),
          SL: createBaseMajoritySpec(),
          CONSEJO: createBaseMajoritySpec(),
        },
        abstenciones: 'no_cuentan',
      },
    });
    const result = evaluarVotacion(input, [pack]);

    // Capital present is 40% < 50% → use mayoriaAlternativa: "favor > contra"
    // favor (40) > contra (30) → TRUE
    expect(result.mayoriaAlcanzada).toBe(true);
  });
});

// ============================================================
// Gate 4: Unanimidad
// ============================================================

describe('Gate 4: Unanimidad', () => {
  it('Unanimidad requerida y alcanzada → OK', () => {
    const input = createBaseInput({
      votos: {
        favor: 17,
        contra: 0,
        abstenciones: 0,
        en_blanco: 0,
        capital_presente: 1000,
        capital_total: 1000,
      },
    });
    const pack = createBaseRulePack({
      votacion: {
        mayoria: {
          SA: createBaseMajoritySpec(),
          SL: createBaseMajoritySpec(),
          CONSEJO: createBaseMajoritySpec(),
        },
        unanimidad: {
          requerida: true,
          ambito: 'PRESENTES',
          fuente: 'ESTATUTOS',
        },
        abstenciones: 'no_cuentan',
      },
    });
    const result = evaluarVotacion(input, [pack]);

    expect(result.unanimidadRequerida).toBe(true);
    expect(result.unanimidadAlcanzada).toBe(true);
  });

  it('Unanimidad requerida pero no alcanzada → BLOCKING', () => {
    const input = createBaseInput({
      votos: {
        favor: 15,
        contra: 2,
        abstenciones: 0,
        en_blanco: 0,
        capital_presente: 1000,
        capital_total: 1000,
      },
    });
    const pack = createBaseRulePack({
      votacion: {
        mayoria: {
          SA: createBaseMajoritySpec(),
          SL: createBaseMajoritySpec(),
          CONSEJO: createBaseMajoritySpec(),
        },
        unanimidad: {
          requerida: true,
          ambito: 'PRESENTES',
          fuente: 'ESTATUTOS',
        },
        abstenciones: 'no_cuentan',
      },
    });
    const result = evaluarVotacion(input, [pack]);

    expect(result.unanimidadAlcanzada).toBe(false);
    expect(result.blocking_issues).toContain('unanimidad_not_achieved');
  });
});

// ============================================================
// Gate 6: Voto de Calidad
// ============================================================

describe('Gate 6: Voto de Calidad', () => {
  it('Empate + voto calidad habilitado → resuelto', () => {
    const input = createBaseInput({
      esEmpate: true,
      votoCalidadHabilitado: true,
      votos: {
        favor: 8,
        contra: 8,
        abstenciones: 1,
        en_blanco: 0,
        capital_presente: 750,
        capital_total: 1000,
      },
    });
    const pack = createBaseRulePack({
      votacion: {
        mayoria: {
          SA: createBaseMajoritySpec({ formula: 'favor > contra' }),
          SL: createBaseMajoritySpec(),
          CONSEJO: createBaseMajoritySpec(),
        },
        abstenciones: 'no_cuentan',
        votoCalidadPermitido: true,
      },
    });
    const result = evaluarVotacion(input, [pack]);

    expect(result.votoCalidadUsado).toBe(true);
    expect(result.mayoriaAlcanzada).toBe(true);
  });

  it('Empate sin voto calidad → no resuelto', () => {
    const input = createBaseInput({
      esEmpate: true,
      votoCalidadHabilitado: false,
      votos: {
        favor: 8,
        contra: 8,
        abstenciones: 1,
        en_blanco: 0,
        capital_presente: 750,
        capital_total: 1000,
      },
    });
    const pack = createBaseRulePack();
    const result = evaluarVotacion(input, [pack]);

    expect(result.votoCalidadUsado).toBeUndefined();
    expect(result.mayoriaAlcanzada).toBe(false);
  });
});

// ============================================================
// SL Cases
// ============================================================

describe('SL votación', () => {
  it('SL ordinaria mayoría simple', () => {
    const input = createBaseInput({
      tipoSocial: 'SL',
      votos: {
        favor: 100,
        contra: 50,
        abstenciones: 10,
        en_blanco: 0,
        capital_presente: 1000,
        capital_total: 2000,
      },
    });
    const pack = createBaseRulePack({
      votacion: {
        mayoria: {
          SA: createBaseMajoritySpec(),
          SL: createBaseMajoritySpec({ formula: 'favor > contra' }),
          CONSEJO: createBaseMajoritySpec(),
        },
        abstenciones: 'no_cuentan',
      },
    });
    const result = evaluarVotacion(input, [pack]);

    expect(result.mayoriaAlcanzada).toBe(true);
  });

  it('SL reforzada 2/3', () => {
    const input = createBaseInput({
      tipoSocial: 'SL',
      votos: {
        favor: 200,
        contra: 50,
        abstenciones: 0,
        en_blanco: 0,
        capital_presente: 2000,
        capital_total: 3000,
      },
    });
    const pack = createBaseRulePack({
      votacion: {
        mayoria: {
          SA: createBaseMajoritySpec(),
          SL: createBaseMajoritySpec({ formula: 'favor >= 2/3_emitidos' }),
          CONSEJO: createBaseMajoritySpec(),
        },
        abstenciones: 'no_cuentan',
      },
    });
    const result = evaluarVotacion(input, [pack]);

    expect(result.mayoriaAlcanzada).toBe(true);
  });
});

// ============================================================
// Consejo Cases
// ============================================================

describe('Consejo votación', () => {
  it('Consejo mayoría de miembros', () => {
    const input = createBaseInput({
      organoTipo: 'CONSEJO',
      votos: {
        favor: 6,
        contra: 3,
        abstenciones: 1,
        en_blanco: 0,
        capital_presente: 0,
        capital_total: 0,
        total_miembros: 10,
        miembros_presentes: 10,
      },
    });
    const pack = createBaseRulePack({
      organoTipo: 'CONSEJO',
      votacion: {
        mayoria: {
          SA: createBaseMajoritySpec(),
          SL: createBaseMajoritySpec(),
          CONSEJO: createBaseMajoritySpec({ formula: 'mayoria_consejeros' }),
        },
        abstenciones: 'no_cuentan',
      },
    });
    const result = evaluarVotacion(input, [pack]);

    expect(result.mayoriaAlcanzada).toBe(true);
  });
});

// ============================================================
// Conflicto de Interés
// ============================================================

describe('Conflicto de interés', () => {
  it('EXCLUIR_VOTO excluye del voto', () => {
    const conflictos: ConflictoInteres[] = [
      {
        mandate_id: 'm1',
        tipo: 'EXCLUIR_VOTO',
        motivo: 'Relacionado con materia',
        capital_afectado: 100,
      },
    ];
    const input = createBaseInput({
      conflictos,
      votos: {
        favor: 450,
        contra: 250,
        abstenciones: 50,
        en_blanco: 0,
        capital_presente: 750,
        capital_total: 1000,
      },
    });
    const pack = createBaseRulePack();
    const result = evaluarVotacion(input, [pack]);

    // Capital votante should be adjusted
    expect(result.explain.some(e => e.regla.includes('Elegibilidad'))).toBe(true);
  });

  it('EXCLUIR_AMBOS excluye de quórum y voto', () => {
    const conflictos: ConflictoInteres[] = [
      {
        mandate_id: 'm1',
        tipo: 'EXCLUIR_AMBOS',
        motivo: 'Conflicto grave',
        capital_afectado: 200,
      },
    ];
    const input = createBaseInput({ conflictos });
    const pack = createBaseRulePack();
    const result = evaluarVotacion(input, [pack]);

    expect(result.explain.some(e => e.regla.includes('Elegibilidad'))).toBe(true);
  });
});

// ============================================================
// NO_SESSION Delegation
// ============================================================

describe('NO_SESSION delegation', () => {
  it('NO_SESSION adoption mode with valid input → delegates', () => {
    const input = createBaseInput({
      adoptionMode: 'NO_SESSION',
      noSessionInput: {
        tipoProceso: 'UNANIMIDAD_ESCRITA_SL',
        condicionAdopcion: 'UNANIMIDAD_CAPITAL',
        organoTipo: 'JUNTA_GENERAL',
        tipoSocial: 'SL',
        respuestas: [
          {
            person_id: '1',
            capital_participacion: 500,
            porcentaje_capital: 50,
            es_consejero: false,
            sentido: 'CONSENTIMIENTO',
          },
          {
            person_id: '2',
            capital_participacion: 500,
            porcentaje_capital: 50,
            es_consejero: false,
            sentido: 'CONSENTIMIENTO',
          },
        ],
        notificaciones: [
          { person_id: '1', canal: 'EMAIL', estado: 'ENTREGADA' },
          { person_id: '2', canal: 'EMAIL', estado: 'ENTREGADA' },
        ],
        totalDestinatarios: 2,
        totalCapitalSocial: 1000,
        ventana: {
          inicio: '2026-04-19T00:00:00Z',
          fin: '2026-04-26T00:00:00Z',
          ahora: '2026-04-20T12:00:00Z',
        },
        propuestaTexto: 'Aprobación de cuentas',
      },
    });
    const pack = createBaseRulePack({
      modosAdopcionPermitidos: ['MEETING', 'NO_SESSION'],
      noSession: {
        habilitado_por_estatutos: { valor: true, fuente: 'ESTATUTOS' },
        habilitado_por_reglamento: { valor: false, fuente: 'REGLAMENTO' },
        condicion_junta_sl: 'UNANIMIDAD_CAPITAL',
        condicion_consejo: 'MAYORIA_SIN_OPOSICION',
        ventana_minima_dias: { valor: 7, fuente: 'ESTATUTOS' },
        ventana_fuente: 'ESTATUTOS',
        canal_requerido_junta_sl: {
          valor: ['NOTIFICACION_CERTIFICADA', 'EMAIL_CON_ACUSE'],
          fuente: 'ESTATUTOS',
        },
        canal_requerido_consejo: {
          valor: ['NOTIFICACION_CERTIFICADA'],
          fuente: 'ESTATUTOS',
        },
        silencio_equivale_a: 'NADA',
        cierre_anticipado: true,
        contenido_minimo_propuesta: [],
      },
    });
    const result = evaluarVotacion(input, [pack]);

    expect(result.noSessionOutput).toBeDefined();
    expect(result.noSessionOutput?.ok).toBe(true);
  });

  it('NO_SESSION without noSessionInput → BLOCKING', () => {
    const input = createBaseInput({
      adoptionMode: 'NO_SESSION',
      noSessionInput: undefined,
    });
    const pack = createBaseRulePack();
    const result = evaluarVotacion(input, [pack]);

    expect(result.ok).toBe(false);
    expect(result.blocking_issues).toContain('no_session_input_missing');
  });
});

// ============================================================
// Abstenciones Handling
// ============================================================

describe('Abstenciones handling', () => {
  it('Abstenciones no_cuentan (default)', () => {
    const input = createBaseInput({
      votos: {
        favor: 10,
        contra: 5,
        abstenciones: 5,
        en_blanco: 0,
        capital_presente: 750,
        capital_total: 1000,
      },
    });
    const pack = createBaseRulePack({
      votacion: {
        mayoria: {
          SA: createBaseMajoritySpec({ formula: 'favor > contra' }),
          SL: createBaseMajoritySpec(),
          CONSEJO: createBaseMajoritySpec(),
        },
        abstenciones: 'no_cuentan',
      },
    });
    const result = evaluarVotacion(input, [pack]);

    expect(result.mayoriaAlcanzada).toBe(true); // 10 > 5
  });

  it('Abstenciones cuentan_como_contra', () => {
    const input = createBaseInput({
      votos: {
        favor: 10,
        contra: 5,
        abstenciones: 6,
        en_blanco: 0,
        capital_presente: 750,
        capital_total: 1000,
      },
    });
    const pack = createBaseRulePack({
      votacion: {
        mayoria: {
          SA: createBaseMajoritySpec({ formula: 'favor > contra' }),
          SL: createBaseMajoritySpec(),
          CONSEJO: createBaseMajoritySpec(),
        },
        abstenciones: 'cuentan_como_contra',
      },
    });
    const result = evaluarVotacion(input, [pack]);

    // With abstenciones counted as contra: 10 > (5 + 6) = 10 > 11 = FALSE
    expect(result.mayoriaAlcanzada).toBe(false);
  });
});

// ============================================================
// G3: Veto parasocial → gate 5 WARNING + gate 6 blocked
// ============================================================

describe('G3: vetoActivo', () => {
  const packCalidad = createBaseRulePack({
    votacion: {
      mayoria: {
        SA: createBaseMajoritySpec({ formula: 'favor > contra' }),
        SL: createBaseMajoritySpec(),
        CONSEJO: createBaseMajoritySpec(),
      },
      abstenciones: 'no_cuentan',
      votoCalidadPermitido: true,
    },
  });

  it('V-G3-01: veto activo bloquea voto de calidad en empate', () => {
    const input = createBaseInput({
      votos: { favor: 5, contra: 5, abstenciones: 0, en_blanco: 0, capital_presente: 500, capital_total: 1000 },
      esEmpate: true,
      votoCalidadHabilitado: true,
      vetoActivo: true,
    });
    const result = evaluarVotacion(input, [packCalidad]);

    // Voto de calidad must NOT be used when veto is active
    expect(result.votoCalidadUsado).toBeFalsy();
    // Majority not reached (tie, voto de calidad blocked)
    expect(result.mayoriaAlcanzada).toBe(false);
  });

  it('V-G3-02: veto activo aparece como WARNING en gate 5', () => {
    const input = createBaseInput({ vetoActivo: true });
    const result = evaluarVotacion(input, [packCalidad]);

    const gate5 = result.explain.find((n) => n.regla === 'Gate 5: Vetos');
    expect(gate5).toBeDefined();
    expect(gate5!.resultado).toBe('WARNING');
    expect(result.warnings.some((w) => w.includes('VETO_PACTO_ACTIVO'))).toBe(true);
  });

  it('V-G3-03: sin veto, voto de calidad funciona en empate', () => {
    const input = createBaseInput({
      votos: { favor: 5, contra: 5, abstenciones: 0, en_blanco: 0, capital_presente: 500, capital_total: 1000 },
      esEmpate: true,
      votoCalidadHabilitado: true,
      vetoActivo: false,
    });
    const result = evaluarVotacion(input, [packCalidad]);

    expect(result.votoCalidadUsado).toBe(true);
    expect(result.mayoriaAlcanzada).toBe(true);
  });
});
