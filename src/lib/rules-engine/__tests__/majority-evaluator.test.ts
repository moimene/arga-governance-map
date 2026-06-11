import { describe, it, expect } from 'vitest';
import { evaluarMayoria, type MajorityResult } from '../majority-evaluator';
import type { MajoritySpec, VotosInput } from '../types';

describe('majority-evaluator', () => {
  // ===== Helper: create standard test inputs =====

  function createMajoritySpec(
    formula: string,
    fuente: 'LEY' | 'ESTATUTOS' = 'LEY',
    referencia?: string
  ): MajoritySpec {
    return {
      formula,
      fuente,
      referencia: referencia || `art. 193 LSC`,
    };
  }

  function createVotos(
    favor: number,
    contra: number,
    abstenciones: number = 0,
    en_blanco: number = 0,
    capital_presente: number = 100,
    capital_total: number = 100,
    total_miembros?: number,
    miembros_presentes?: number
  ): VotosInput {
    return {
      favor,
      contra,
      abstenciones,
      en_blanco,
      capital_presente,
      capital_total,
      ...(total_miembros !== undefined && { total_miembros }),
      ...(miembros_presentes !== undefined && { miembros_presentes }),
    };
  }

  // ===== Test: Simple majority (favor > contra) =====

  it('should pass simple majority when favor > contra', () => {
    const spec = createMajoritySpec('favor > contra');
    const votos = createVotos(10, 5);
    const result = evaluarMayoria(spec, votos);

    expect(result.alcanzada).toBe(true);
    expect(result.valorObtenido).toBe(10);
    expect(result.valorRequerido).toBe(6);
    expect(result.explain.resultado).toBe('OK');
  });

  it('should fail simple majority when favor <= contra', () => {
    const spec = createMajoritySpec('favor > contra');
    const votos = createVotos(5, 5);
    const result = evaluarMayoria(spec, votos);

    expect(result.alcanzada).toBe(false);
    expect(result.explain.resultado).toBe('BLOCKING');
  });

  it('should fail simple majority when favor < contra', () => {
    const spec = createMajoritySpec('favor > contra');
    const votos = createVotos(3, 7);
    const result = evaluarMayoria(spec, votos);

    expect(result.alcanzada).toBe(false);
  });

  // ===== Test: 2/3 of votes cast (favor >= 2/3_emitidos) =====

  it('should pass 2/3_emitidos when favor >= 2/3 of (favor + contra)', () => {
    const spec = createMajoritySpec('favor >= 2/3_emitidos');
    // 10 favor + 5 contra = 15 emitidos; 2/3 = 10; 10 >= 10 ✓
    const votos = createVotos(10, 5);
    const result = evaluarMayoria(spec, votos);

    expect(result.alcanzada).toBe(true);
    expect(result.valorObtenido).toBe(10);
    expect(result.valorRequerido).toBe(10);
  });

  it('should fail 2/3_emitidos when favor < 2/3 of emitidos', () => {
    const spec = createMajoritySpec('favor >= 2/3_emitidos');
    // 9 favor + 6 contra = 15 emitidos; 2/3 = 10; 9 < 10 ✗
    const votos = createVotos(9, 6);
    const result = evaluarMayoria(spec, votos);

    expect(result.alcanzada).toBe(false);
  });

  it('should handle 0 emitidos for 2/3_emitidos (no votes cast)', () => {
    const spec = createMajoritySpec('favor >= 2/3_emitidos');
    const votos = createVotos(0, 0);
    const result = evaluarMayoria(spec, votos);

    expect(result.alcanzada).toBe(false);
    expect(result.valorObtenido).toBe(0);
  });

  // ===== Test: Absolute majority of votes cast (favor > 1/2_emitidos) =====

  it('should pass 1/2_emitidos when favor > half of emitidos', () => {
    const spec = createMajoritySpec('favor > 1/2_emitidos');
    // 11 favor + 9 contra = 20 emitidos; 1/2 = 10; 11 > 10 ✓
    const votos = createVotos(11, 9);
    const result = evaluarMayoria(spec, votos);

    expect(result.alcanzada).toBe(true);
    expect(result.valorRequerido).toBe(10);
  });

  it('should fail 1/2_emitidos when favor = half of emitidos', () => {
    const spec = createMajoritySpec('favor > 1/2_emitidos');
    // 10 favor + 10 contra = 20 emitidos; 1/2 = 10; 10 > 10 ✗
    const votos = createVotos(10, 10);
    const result = evaluarMayoria(spec, votos);

    expect(result.alcanzada).toBe(false);
  });

  // ===== Test: Majority of present capital (favor > 1/2_capital_presente) =====

  it('should pass 1/2_capital_presente when favor > half', () => {
    const spec = createMajoritySpec('favor > 1/2_capital_presente');
    // 60 favor; capital_presente = 100; 1/2 = 50; 60 > 50 ✓
    const votos = createVotos(60, 40, 0, 0, 100, 200);
    const result = evaluarMayoria(spec, votos);

    expect(result.alcanzada).toBe(true);
    expect(result.valorRequerido).toBe(50);
  });

  it('should fail 1/2_capital_presente when favor <= half', () => {
    const spec = createMajoritySpec('favor > 1/2_capital_presente');
    // 50 favor; capital_presente = 100; 1/2 = 50; 50 > 50 ✗
    const votos = createVotos(50, 50, 0, 0, 100, 200);
    const result = evaluarMayoria(spec, votos);

    expect(result.alcanzada).toBe(false);
  });

  // ===== Test: 2/3 of total capital (favor >= 2/3_capital) =====

  it('should pass 2/3_capital when favor >= 2/3 of total', () => {
    const spec = createMajoritySpec('favor >= 2/3_capital');
    // 70 favor; capital_total = 100; 2/3 ≈ 66.67; 70 >= 66.67 ✓
    const votos = createVotos(70, 30, 0, 0, 70, 100);
    const result = evaluarMayoria(spec, votos);

    expect(result.alcanzada).toBe(true);
    expect(result.valorObtenido).toBe(70);
  });

  it('should fail 2/3_capital when favor < 2/3 of total', () => {
    const spec = createMajoritySpec('favor >= 2/3_capital');
    // 60 favor; capital_total = 100; 2/3 ≈ 66.67; 60 < 66.67 ✗
    const votos = createVotos(60, 40, 0, 0, 60, 100);
    const result = evaluarMayoria(spec, votos);

    expect(result.alcanzada).toBe(false);
  });

  // ===== Test: Consejo — mayoría de miembros =====

  it('should pass mayoria_consejeros when miembros_presentes > half of total', () => {
    const spec = createMajoritySpec('mayoria_consejeros');
    // 5 miembros presentes; total = 9; 1/2 = 4.5; 5 > 4.5 ✓
    const votos = createVotos(5, 4, 0, 0, 0, 0, 9, 5);
    const result = evaluarMayoria(spec, votos);

    expect(result.alcanzada).toBe(true);
    expect(result.valorRequerido).toBe(4.5);
  });

  it('should fail mayoria_consejeros when miembros_presentes <= half of total', () => {
    const spec = createMajoritySpec('mayoria_consejeros');
    // 4 miembros presentes; total = 9; 1/2 = 4.5; 4 > 4.5 ✗
    const votos = createVotos(4, 5, 0, 0, 0, 0, 9, 4);
    const result = evaluarMayoria(spec, votos);

    expect(result.alcanzada).toBe(false);
  });

  it('normalizes legacy Consejo formulas from active rule packs', () => {
    const votos = createVotos(3, 0, 0, 0, 3, 3, 3, 3);

    expect(evaluarMayoria(createMajoritySpec('Mayoría'), votos).alcanzada).toBe(true);
    expect(evaluarMayoria(createMajoritySpec('favor > presentes_mitad'), votos).alcanzada).toBe(true);
    expect(evaluarMayoria(createMajoritySpec('favor > total_miembros / 2'), votos).alcanzada).toBe(true);
  });

  it('normalizes legacy SL capital threshold formulas from active rule packs', () => {
    expect(
      evaluarMayoria(
        createMajoritySpec('favor > 1/3_capital_total_con_voto'),
        createVotos(34, 0, 0, 0, 34, 100),
      ).alcanzada,
    ).toBe(true);

    expect(
      evaluarMayoria(
        createMajoritySpec('favor > mitad_capital_con_voto'),
        createVotos(51, 0, 0, 0, 51, 100),
      ).alcanzada,
    ).toBe(true);
  });

  it('normalizes legacy reinforced SA formulas from active rule packs', () => {
    expect(
      evaluarMayoria(
        createMajoritySpec('> 1/2 presente en 1a; >= 2/3 emitidos si < 50% en 2a'),
        createVotos(31, 29, 0, 0, 60, 100),
      ).alcanzada,
    ).toBe(true);

    expect(
      evaluarMayoria(
        createMajoritySpec('reforzada art. 201.2 LSC'),
        createVotos(20, 10, 0, 0, 40, 100),
      ).alcanzada,
    ).toBe(true);
  });

  // ===== Test: Abstenciones handling =====

  it('abstenciones no_cuentan: should exclude abstenciones from denominator', () => {
    const spec = createMajoritySpec('favor > 1/2_emitidos');
    // 6 favor + 4 contra + 2 abstenciones; emitidos = 10 (no_cuentan); 1/2 = 5; 6 > 5 ✓
    const votos = createVotos(6, 4, 2);
    const result = evaluarMayoria(spec, votos, 'no_cuentan');

    expect(result.alcanzada).toBe(true);
    expect(result.valorRequerido).toBe(5);
  });

  it('abstenciones cuentan_como_contra: should add abstenciones to contra', () => {
    const spec = createMajoritySpec('favor > contra');
    // 6 favor + 4 contra + 2 abstenciones → contra = 6 (4+2); 6 > 6 ✗
    const votos = createVotos(6, 4, 2);
    const result = evaluarMayoria(spec, votos, 'cuentan_como_contra');

    expect(result.alcanzada).toBe(false);
    expect(result.valorRequerido).toBe(7);
  });

  it('abstenciones cuentan_como_voto: should include abstenciones in emitidos', () => {
    const spec = createMajoritySpec('favor >= 2/3_emitidos');
    // 10 favor + 5 contra + 5 abstenciones; emitidos = 20 (10+5+5); 2/3 ≈ 13.33; 10 >= 13.33 ✗
    const votos = createVotos(10, 5, 5);
    const result = evaluarMayoria(spec, votos, 'cuentan_como_voto');

    expect(result.alcanzada).toBe(false);
    expect(result.valorRequerido).toBeCloseTo(13.33, 1);
  });

  // ===== Test: en_blanco is NEVER counted =====

  it('en_blanco should never be counted in any formula', () => {
    const spec = createMajoritySpec('favor > contra');
    // 10 favor + 5 contra + 5 en_blanco; emitidos = 15; 10 > 5 ✓
    const votos = createVotos(10, 5, 0, 5);
    const result = evaluarMayoria(spec, votos);

    expect(result.alcanzada).toBe(true);
    // en_blanco should not affect the comparison
    expect(result.valorObtenido).toBe(10);
    expect(result.valorRequerido).toBe(6);
  });

  // ===== Test: Doble condicional (art. 201.2 LSC) =====

  it('doble condicional: should use alternative formula when capital_presente < umbral', () => {
    const spec: MajoritySpec = {
      formula: 'favor >= 2/3_emitidos',
      fuente: 'LEY',
      referencia: 'art. 201.2 LSC',
      dobleCondicional: {
        umbral: 0.5, // 50% of capital
        mayoriaAlternativa: 'mayoria_consejeros',
      },
    };
    // capital_presente = 40; capital_total = 100; 40 < 50 → use mayoriaAlternativa
    const votos = createVotos(5, 0, 0, 0, 40, 100, 9, 5);
    const result = evaluarMayoria(spec, votos);

    // Should evaluate mayoria_consejeros (5 > 4.5) not 2/3_emitidos
    expect(result.alcanzada).toBe(true);
    expect(result.formula).toBe('mayoria_consejeros');
  });

  it('doble condicional: should use normal formula when capital_presente >= umbral', () => {
    const spec: MajoritySpec = {
      formula: 'favor >= 2/3_emitidos',
      fuente: 'LEY',
      referencia: 'art. 201.2 LSC',
      dobleCondicional: {
        umbral: 0.5,
        mayoriaAlternativa: 'mayoria_consejeros',
      },
    };
    // capital_presente = 60; capital_total = 100; 60 >= 50 → use normal formula
    const votos = createVotos(10, 5, 0, 0, 60, 100);
    const result = evaluarMayoria(spec, votos);

    // Should evaluate 2/3_emitidos (10 >= 10) not mayoria_consejeros
    expect(result.alcanzada).toBe(true);
    expect(result.formula).toBe('favor >= 2/3_emitidos');
  });

  // ===== Test: ExplainNode structure =====

  it('should include explain node with fuente and referencia', () => {
    const spec = createMajoritySpec('favor > contra', 'ESTATUTOS', 'art. 25 Estatutos');
    const votos = createVotos(10, 5);
    const result = evaluarMayoria(spec, votos);

    expect(result.explain).toBeDefined();
    expect(result.explain.fuente).toBe('ESTATUTOS');
    expect(result.explain.referencia).toBe('art. 25 Estatutos');
    expect(result.explain.resultado).toBe('OK');
    expect(result.explain.mensaje).toContain('Mayoría alcanzada');
  });

  it('explain node should show BLOCKING result on failure', () => {
    const spec = createMajoritySpec('favor > contra');
    const votos = createVotos(3, 7);
    const result = evaluarMayoria(spec, votos);

    expect(result.explain.resultado).toBe('BLOCKING');
    expect(result.explain.mensaje).toContain('NO alcanzada');
  });
});

describe("ITEM-009/010 — mayorías del consejo (arts. 248.1 y 249.3 LSC)", () => {
  it("248.1: CdA de 15 con 9 concurrentes y 5-4 SÍ adopta (mayoría absoluta de concurrentes)", () => {
    const result = evaluarMayoria(
      { formula: "favor > presentes_mitad", fuente: "LEY", referencia: "art. 248.1 LSC" },
      { favor: 5, contra: 4, abstenciones: 0, en_blanco: 0, capital_presente: 9, capital_total: 15, total_miembros: 15, miembros_presentes: 9 },
    );
    expect(result.alcanzada).toBe(true); // 5 > 4.5 — antes exigía 5 > 7.5 (falso negativo)
  });

  it("248.1: 4F/3C/2A con 9 concurrentes NO adopta (4 no supera 4.5)", () => {
    const result = evaluarMayoria(
      { formula: "favor > presentes_mitad", fuente: "LEY", referencia: "art. 248.1 LSC" },
      { favor: 4, contra: 3, abstenciones: 2, en_blanco: 0, capital_presente: 9, capital_total: 15, total_miembros: 15, miembros_presentes: 9 },
    );
    expect(result.alcanzada).toBe(false);
  });

  it("248.1 fallback sin dato de concurrentes: usa favor+contra+abstenciones, no solo emitidos", () => {
    const result = evaluarMayoria(
      { formula: "favor > presentes_mitad", fuente: "LEY" },
      { favor: 4, contra: 3, abstenciones: 3, en_blanco: 0, capital_presente: 0, capital_total: 0 },
    );
    // concurrentes inferidos = 10 → requiere > 5; con solo emitidos (7) habría adoptado (4 > 3.5)
    expect(result.alcanzada).toBe(false);
  });

  it("249.3: delegación de facultades exige 2/3 de los COMPONENTES — 9/15 no llega (requiere 10)", () => {
    const result = evaluarMayoria(
      { formula: "favor >= 2/3_total_miembros", fuente: "LEY", referencia: "art. 249.3 LSC" },
      { favor: 9, contra: 0, abstenciones: 0, en_blanco: 0, capital_presente: 9, capital_total: 15, total_miembros: 15, miembros_presentes: 9 },
    );
    expect(result.alcanzada).toBe(false); // 9 < 10
    const result10 = evaluarMayoria(
      { formula: "favor >= 2/3_total_miembros", fuente: "LEY" },
      { favor: 10, contra: 0, abstenciones: 0, en_blanco: 0, capital_presente: 10, capital_total: 15, total_miembros: 15, miembros_presentes: 10 },
    );
    expect(result10.alcanzada).toBe(true);
  });

  it("'favor > total_miembros / 2' (grafía de packs que citan 248.1) evalúa sobre concurrentes", () => {
    const result = evaluarMayoria(
      { formula: "favor > total_miembros / 2", fuente: "LEY", referencia: "art. 248.1 LSC" },
      { favor: 5, contra: 4, abstenciones: 0, en_blanco: 0, capital_presente: 9, capital_total: 15, total_miembros: 15, miembros_presentes: 9 },
    );
    expect(result.alcanzada).toBe(true);
  });
});
