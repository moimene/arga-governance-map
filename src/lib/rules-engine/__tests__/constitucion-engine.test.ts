import { describe, it, expect } from 'vitest';
import {
  evaluarConstitucion,
  calcularDenominadorAjustado,
  type ConstitucionOutput,
} from '../constitucion-engine';
import type {
  ConstitucionInput,
  RulePack,
  RuleParamOverride,
  ConflictoInteres,
} from '../types';

describe('constitucion-engine', () => {
  // ===== Helper: create standard test inputs =====

  function createRulePack(
    clase: 'ORDINARIA' | 'ESTATUTARIA' | 'ESTRUCTURAL'
  ): RulePack {
    return {
      id: `pack-${clase}`,
      materia: 'Test Materia',
      clase,
      organoTipo: 'JUNTA_GENERAL',
      modosAdopcionPermitidos: ['MEETING'],
      convocatoria: {
        antelacionDias: { SA: { valor: 15, fuente: 'LEY' }, SL: { valor: 5, fuente: 'LEY' } },
        canales: { SA: ['BORME'], SL: ['NOTIFICACION'] },
        contenidoMinimo: [],
      },
      constitucion: {
        quorum: {
          SA_1a: { valor: 0.25, fuente: 'LEY', referencia: 'art. 189 LSC' },
          SA_2a: { valor: 0, fuente: 'LEY', referencia: 'art. 189 LSC' },
          SL: { valor: 0, fuente: 'LEY', referencia: 'art. 201 LSC' },
          CONSEJO: { valor: 'mayoria_miembros', fuente: 'LEY' },
        },
      },
      votacion: {
        mayoria: {
          SA: { formula: 'favor > contra', fuente: 'LEY' },
          SL: { formula: 'favor > contra', fuente: 'LEY' },
          CONSEJO: { formula: 'mayoria_consejeros', fuente: 'LEY' },
        },
        abstenciones: 'no_cuentan',
      },
      documentacion: { obligatoria: [] },
      acta: {
        tipoActaPorModo: {},
        contenidoMinimo: { sesion: [], consignacion: [], acuerdoEscrito: [] },
        requiereTranscripcionLibroActas: false,
        requiereConformidadConjunta: false,
      },
      plazosMateriales: {},
      postAcuerdo: {
        inscribible: false,
        instrumentoRequerido: 'NINGUNO',
        publicacionRequerida: false,
      },
    };
  }

  function createConstitucionInput(
    tipoSocial: 'SA' | 'SL',
    primeraConvocatoria: boolean = true,
    materiaClase: 'ORDINARIA' | 'ESTATUTARIA' | 'ESTRUCTURAL' = 'ORDINARIA',
    capitalConDerechoVoto: number = 100,
    capitalPresenteRepresentado: number = 50,
    adoptionMode: 'MEETING' | 'UNIPERSONAL_SOCIO' | 'NO_SESSION' = 'MEETING'
  ): ConstitucionInput {
    return {
      tipoSocial,
      organoTipo: 'JUNTA_GENERAL',
      adoptionMode,
      primeraConvocatoria,
      materiaClase,
      capitalConDerechoVoto,
      capitalPresenteRepresentado,
    };
  }

  // ===== Test: Gate — UNIPERSONAL_SOCIO =====

  it('gate: UNIPERSONAL_SOCIO should skip quorum evaluation', () => {
    const input = createConstitucionInput('SA', true, 'ORDINARIA', 100, 0, 'UNIPERSONAL_SOCIO');
    const packs = [createRulePack('ORDINARIA')];
    const result = evaluarConstitucion(input, packs);

    expect(result.ok).toBe(true);
    expect(result.quorumCubierto).toBe(true);
    expect(result.quorumRequerido).toBe(0);
  });

  it('gate: UNIPERSONAL_ADMIN should skip quorum evaluation', () => {
    const input = createConstitucionInput('SA', true, 'ORDINARIA', 100, 0, 'UNIPERSONAL_SOCIO');
    const packs = [createRulePack('ORDINARIA')];
    const result = evaluarConstitucion(input, packs);

    expect(result.ok).toBe(true);
  });

  it('gate: NO_SESSION should skip quorum evaluation', () => {
    const input = createConstitucionInput('SA', true, 'ORDINARIA', 100, 0, 'NO_SESSION');
    const packs = [createRulePack('ORDINARIA')];
    const result = evaluarConstitucion(input, packs);

    expect(result.ok).toBe(true);
  });

  // ===== Test: SA 1a ORDINARIA — 25% quorum =====

  it('SA 1a ORDINARIA: 25% quorum — should pass when capital >= 25%', () => {
    const input = createConstitucionInput('SA', true, 'ORDINARIA', 100, 30);
    const packs = [createRulePack('ORDINARIA')];
    const result = evaluarConstitucion(input, packs);

    expect(result.ok).toBe(true);
    expect(result.quorumRequerido).toBe(0.25);
    expect(result.quorumPresente).toBe(0.3);
    expect(result.quorumCubierto).toBe(true);
  });

  it('SA 1a ORDINARIA: 25% quorum — should fail when capital < 25%', () => {
    const input = createConstitucionInput('SA', true, 'ORDINARIA', 100, 20);
    const packs = [createRulePack('ORDINARIA')];
    const result = evaluarConstitucion(input, packs);

    expect(result.ok).toBe(false);
    expect(result.quorumCubierto).toBe(false);
    expect(result.severity).toBe('BLOCKING');
    expect(result.blocking_issues).toContain('quorum_not_met');
  });

  // ===== Test: SA 2a ORDINARIA — no quorum required =====

  it('SA 2a ORDINARIA: no quorum — should always pass', () => {
    const input = createConstitucionInput('SA', false, 'ORDINARIA', 100, 0);
    const packs = [createRulePack('ORDINARIA')];
    const result = evaluarConstitucion(input, packs);

    expect(result.ok).toBe(true);
    expect(result.quorumRequerido).toBe(0);
    expect(result.quorumCubierto).toBe(true);
  });

  // ===== Test: SA 1a ESPECIAL (ESTATUTARIA) — 50% quorum =====

  it('SA 1a ESPECIAL (ESTATUTARIA): 50% quorum — should pass when capital >= 50%', () => {
    const input = createConstitucionInput('SA', true, 'ESTATUTARIA', 100, 50);
    const packs = [createRulePack('ESTATUTARIA')];
    const result = evaluarConstitucion(input, packs);

    expect(result.ok).toBe(true);
    expect(result.quorumRequerido).toBe(0.5);
    expect(result.quorumPresente).toBe(0.5);
  });

  it('SA 1a ESPECIAL (ESTRUCTURAL): 50% quorum — should pass when capital >= 50%', () => {
    const input = createConstitucionInput('SA', true, 'ESTRUCTURAL', 100, 51);
    const packs = [createRulePack('ESTRUCTURAL')];
    const result = evaluarConstitucion(input, packs);

    expect(result.ok).toBe(true);
    expect(result.quorumRequerido).toBe(0.5);
  });

  // ===== Test: SA 2a ESPECIAL — 25% quorum =====

  it('SA 2a ESPECIAL: 25% quorum — should pass when capital >= 25%', () => {
    const input = createConstitucionInput('SA', false, 'ESTATUTARIA', 100, 26);
    const packs = [createRulePack('ESTATUTARIA')];
    const result = evaluarConstitucion(input, packs);

    expect(result.ok).toBe(true);
    expect(result.quorumRequerido).toBe(0.25);
  });

  // ===== Test: SL — no legal quorum (0) =====

  it('SL: no legal quorum — should always pass', () => {
    const input = createConstitucionInput('SL', true, 'ORDINARIA', 100, 0);
    const packs = [createRulePack('ORDINARIA')];
    const result = evaluarConstitucion(input, packs);

    expect(result.ok).toBe(true);
    expect(result.quorumRequerido).toBe(0);
  });

  // ===== Test: SL with override — 30% (estatutos) =====

  it('SL with override: estatutario quorum — should apply override', () => {
    const input = createConstitucionInput('SL', true, 'ORDINARIA', 100, 35);
    const packs = [createRulePack('ORDINARIA')];
    const override: RuleParamOverride = {
      id: 'override-1',
      entity_id: 'entity-1',
      materia: 'CONSTITUCION',
      clave: 'SL_quorum_pct',
      valor: 0.3,
      fuente: 'ESTATUTOS',
      referencia: 'art. 25 Estatutos',
    };
    const result = evaluarConstitucion(input, packs, [override]);

    expect(result.ok).toBe(true);
    expect(result.quorumRequerido).toBe(0.3);
  });

  it('CONSEJO: quórum uses members majority before sociedad type', () => {
    const input: ConstitucionInput = {
      tipoSocial: 'SA',
      organoTipo: 'CONSEJO',
      adoptionMode: 'MEETING',
      primeraConvocatoria: true,
      materiaClase: 'ORDINARIA',
      capitalConDerechoVoto: 10,
      capitalPresenteRepresentado: 5,
      totalMiembros: 10,
      asistentesPresentes: 5,
    };
    const pack = { ...createRulePack('ORDINARIA'), organoTipo: 'CONSEJO' as const };

    const exactHalf = evaluarConstitucion(input, [pack]);
    const majority = evaluarConstitucion(
      { ...input, capitalPresenteRepresentado: 6, asistentesPresentes: 6 },
      [pack]
    );

    expect(exactHalf.ok).toBe(false);
    expect(exactHalf.quorumRequerido).toBe(0.6);
    expect(majority.ok).toBe(true);
  });

  // ===== Test: Denominador ajustado — EXCLUIR_QUORUM =====

  it('denominador ajustado: EXCLUIR_QUORUM should reduce quorum denominator', () => {
    const conflicto: ConflictoInteres = {
      mandate_id: 'mandate-1',
      tipo: 'EXCLUIR_QUORUM',
      motivo: 'Conflicto de interés',
      capital_afectado: 20,
    };
    const input: ConstitucionInput = {
      tipoSocial: 'SA',
      organoTipo: 'JUNTA_GENERAL',
      adoptionMode: 'MEETING',
      primeraConvocatoria: true,
      materiaClase: 'ORDINARIA',
      capitalConDerechoVoto: 100,
      capitalPresenteRepresentado: 25, // exactly 25% of 100
      conflictos: [conflicto],
    };
    const packs = [createRulePack('ORDINARIA')];
    const result = evaluarConstitucion(input, packs);

    // capital_convocable = 100 - 20 = 80; quorum = 25% of 80 = 20
    // present = 25, which is >= 20 ✓
    expect(result.ok).toBe(true);
    expect(result.denominadorAjustado?.capital_convocable).toBe(80);
  });

  it('denominador ajustado: EXCLUIR_AMBOS should exclude from both quorum and vote', () => {
    const conflicto: ConflictoInteres = {
      mandate_id: 'mandate-1',
      tipo: 'EXCLUIR_AMBOS',
      motivo: 'Conflicto grave',
      capital_afectado: 30,
    };
    const input: ConstitucionInput = {
      tipoSocial: 'SA',
      organoTipo: 'JUNTA_GENERAL',
      adoptionMode: 'MEETING',
      primeraConvocatoria: true,
      materiaClase: 'ORDINARIA',
      capitalConDerechoVoto: 100,
      capitalPresenteRepresentado: 20, // 25% of 70 = 17.5
      conflictos: [conflicto],
    };
    const packs = [createRulePack('ORDINARIA')];
    const result = evaluarConstitucion(input, packs);

    expect(result.denominadorAjustado?.capital_convocable).toBe(70);
    expect(result.denominadorAjustado?.capital_votante).toBe(70);
  });

  // ===== Test: denominador ajustado is zero — BLOCKING =====

  it('denominador adjusted: capital_convocable = 0 should BLOCK', () => {
    const conflicto: ConflictoInteres = {
      mandate_id: 'mandate-1',
      tipo: 'EXCLUIR_QUORUM',
      motivo: 'Todos excluidos',
      capital_afectado: 100,
    };
    const input: ConstitucionInput = {
      tipoSocial: 'SA',
      organoTipo: 'JUNTA_GENERAL',
      adoptionMode: 'MEETING',
      primeraConvocatoria: true,
      materiaClase: 'ORDINARIA',
      capitalConDerechoVoto: 100,
      capitalPresenteRepresentado: 50,
      conflictos: [conflicto],
    };
    const packs = [createRulePack('ORDINARIA')];
    const result = evaluarConstitucion(input, packs);

    expect(result.ok).toBe(false);
    expect(result.severity).toBe('BLOCKING');
    expect(result.blocking_issues).toContain('capital_convocable_zero_or_negative');
  });

  // ===== Test: Profile combinado (multi-materia) =====

  it('profile combinado: ORDINARIA + ESTATUTARIA in SA 1a should use 50% quorum', () => {
    const input: ConstitucionInput = {
      tipoSocial: 'SA',
      organoTipo: 'JUNTA_GENERAL',
      adoptionMode: 'MEETING',
      primeraConvocatoria: true,
      materiaClase: 'ORDINARIA', // First materia is ORDINARIA
      capitalConDerechoVoto: 100,
      capitalPresenteRepresentado: 50,
    };
    const packs = [
      createRulePack('ORDINARIA'),
      createRulePack('ESTATUTARIA'), // Mix with ESTATUTARIA
    ];
    const result = evaluarConstitucion(input, packs);

    // Should resolve to 50% (most demanding)
    expect(result.quorumRequerido).toBe(0.5);
    expect(result.explain[result.explain.length - 1].referencia).toContain('combinado');
  });

  // ===== Test: calcularDenominadorAjustado helper =====

  it('calcularDenominadorAjustado: no conflictos', () => {
    const resultado = calcularDenominadorAjustado(100, undefined);

    expect(resultado.capital_total).toBe(100);
    expect(resultado.capital_convocable).toBe(100);
    expect(resultado.capital_votante).toBe(100);
    expect(resultado.capital_excluido_quorum).toBe(0);
    expect(resultado.capital_excluido_voto).toBe(0);
  });

  it('calcularDenominadorAjustado: multiple conflictos', () => {
    const conflictos: ConflictoInteres[] = [
      {
        mandate_id: 'm1',
        tipo: 'EXCLUIR_QUORUM',
        motivo: 'Conflicto 1',
        capital_afectado: 15,
      },
      {
        mandate_id: 'm2',
        tipo: 'EXCLUIR_VOTO',
        motivo: 'Conflicto 2',
        capital_afectado: 10,
      },
      {
        mandate_id: 'm3',
        tipo: 'EXCLUIR_AMBOS',
        motivo: 'Conflicto 3',
        capital_afectado: 5,
      },
    ];
    const resultado = calcularDenominadorAjustado(100, conflictos);

    // EXCLUIR_QUORUM: 15; EXCLUIR_AMBOS: 5 → capital_excluido_quorum = 20
    // EXCLUIR_VOTO: 10; EXCLUIR_AMBOS: 5 → capital_excluido_voto = 15
    expect(resultado.capital_excluido_quorum).toBe(20);
    expect(resultado.capital_excluido_voto).toBe(15);
    expect(resultado.capital_convocable).toBe(80);
    expect(resultado.capital_votante).toBe(85);
    expect(resultado.mandatos_excluidos).toContain('m1');
    expect(resultado.mandatos_excluidos).toContain('m2');
    expect(resultado.mandatos_excluidos).toContain('m3');
  });

  // ===== Test: ExplainNode structure =====

  it('should include explain nodes with fuente and referencia', () => {
    const input = createConstitucionInput('SA', true, 'ORDINARIA', 100, 30);
    const packs = [createRulePack('ORDINARIA')];
    const result = evaluarConstitucion(input, packs);

    expect(result.explain).toBeDefined();
    expect(result.explain.length).toBeGreaterThan(0);
    const quorumNode = result.explain.find(n => n.regla?.includes('Quórum'));
    expect(quorumNode).toBeDefined();
    expect(quorumNode?.fuente).toBe('LEY');
    expect(quorumNode?.referencia).toContain('art.');
  });
});
