// ============================================================
// Motor de Reglas LSC — Majority Evaluator
// Spec: docs/superpowers/specs/2026-04-19-motor-reglas-lsc-secretaria-design.md §7
// ============================================================

import type { MajoritySpec, VotosInput, ExplainNode, Fuente } from './types';

/**
 * MajorityResult — outcome of majority evaluation
 */
export interface MajorityResult {
  alcanzada: boolean;
  formula: string;
  valorRequerido: number;
  valorObtenido: number;
  explain: ExplainNode;
}

/**
 * evaluarMayoria — Pure function to evaluate majority requirements
 *
 * Parses formula strings and evaluates against vote tallies.
 *
 * Supported formulas:
 * - "favor > contra" — simple majority (favor strictly greater than contra)
 * - "favor >= 2/3_emitidos" — 2/3 of votes cast
 * - "favor > 1/2_emitidos" — absolute majority of votes cast
 * - "favor > 1/2_capital_presente" — majority of present capital
 * - "favor >= 2/3_capital" — 2/3 of total capital
 * - "mayoria_consejeros" — favor > total_miembros/2
 *
 * Abstenciones handling:
 * - 'no_cuentan': excluded from denominator
 * - 'cuentan_como_contra': added to contra
 * - 'cuentan_como_voto': added to denominator (emitidos) but not favor or contra
 *
 * Doble condicional (art. 201.2 LSC):
 * - If capital_presente < umbral * capital_total → use mayoriaAlternativa
 */
export function evaluarMayoria(
  spec: MajoritySpec,
  votos: VotosInput,
  abstenciones_tratamiento: 'no_cuentan' | 'cuentan_como_contra' | 'cuentan_como_voto' = 'no_cuentan'
): MajorityResult {
  const formula = spec.formula.trim();

  // Parse doble condicional
  let formulaActual = formula;
  if (
    spec.dobleCondicional &&
    votos.capital_presente < spec.dobleCondicional.umbral * votos.capital_total
  ) {
    // Capital present is below threshold — use alternative formula
    formulaActual = spec.dobleCondicional.mayoriaAlternativa;
  }

  // Calculate denominadores
  const emitidos = calcularEmitidos(votos, abstenciones_tratamiento);
  const capital_votante = votos.capital_total - (votos.capital_total > 0 ? 0 : 0);

  // Apply abstenciones adjustment to favor/contra
  const contra_ajustado =
    abstenciones_tratamiento === 'cuentan_como_contra'
      ? votos.contra + votos.abstenciones
      : votos.contra;
  const favor_ajustado = votos.favor;

  // Evaluate formula
  const result = evaluateFormula(
    formulaActual,
    favor_ajustado,
    contra_ajustado,
    emitidos,
    votos.capital_presente,
    votos.capital_total,
    votos.total_miembros || 0,
    votos.miembros_presentes || 0
  );

  return {
    alcanzada: result.alcanzada,
    formula: formulaActual,
    valorRequerido: result.valorRequerido,
    valorObtenido: result.valorObtenido,
    explain: {
      regla: `Mayoría: ${formulaActual}`,
      fuente: spec.fuente,
      referencia: spec.referencia,
      umbral: result.valorRequerido,
      valor: result.valorObtenido,
      resultado: result.alcanzada ? 'OK' : 'BLOCKING',
      mensaje: result.alcanzada
        ? `Mayoría alcanzada: ${result.valorObtenido} >= ${result.valorRequerido}`
        : `Mayoría NO alcanzada: ${result.valorObtenido} < ${result.valorRequerido}`,
    },
  };
}

/**
 * calcularEmitidos — Calculate votes cast (denominator for majority)
 *
 * emitidos = favor + contra + (abstenciones if cuentan_como_voto)
 * en_blanco is NEVER counted
 */
function calcularEmitidos(
  votos: VotosInput,
  abstenciones_tratamiento: 'no_cuentan' | 'cuentan_como_contra' | 'cuentan_como_voto'
): number {
  const base = votos.favor + votos.contra;
  if (abstenciones_tratamiento === 'cuentan_como_voto') {
    return base + votos.abstenciones;
  }
  // no_cuentan or cuentan_como_contra: abstenciones don't affect denominator
  return base;
}

/**
 * evaluateFormula — Parse and evaluate a formula string
 *
 * Returns {alcanzada, valorRequerido, valorObtenido}
 */
function evaluateFormula(
  formula: string,
  favor: number,
  contra: number,
  emitidos: number,
  capital_presente: number,
  capital_total: number,
  total_miembros: number,
  miembros_presentes: number
): { alcanzada: boolean; valorRequerido: number; valorObtenido: number } {
  // Simple majority: favor > contra
  if (formula === 'favor > contra') {
    return {
      alcanzada: favor > contra,
      valorRequerido: contra + 1,
      valorObtenido: favor,
    };
  }

  // 2/3 of votes cast
  if (formula === 'favor >= 2/3_emitidos') {
    if (emitidos === 0) {
      return { alcanzada: false, valorRequerido: 1, valorObtenido: 0 };
    }
    const requerido = (2 * emitidos) / 3;
    return {
      alcanzada: favor >= requerido,
      valorRequerido: requerido,
      valorObtenido: favor,
    };
  }

  // Absolute majority of votes cast
  if (formula === 'favor > 1/2_emitidos') {
    if (emitidos === 0) {
      return { alcanzada: false, valorRequerido: 1, valorObtenido: 0 };
    }
    const requerido = emitidos / 2;
    return {
      alcanzada: favor > requerido,
      valorRequerido: requerido,
      valorObtenido: favor,
    };
  }

  // Majority of present capital
  if (formula === 'favor > 1/2_capital_presente') {
    const requerido = capital_presente / 2;
    return {
      alcanzada: favor > requerido,
      valorRequerido: requerido,
      valorObtenido: favor,
    };
  }

  // 2/3 of total capital
  if (formula === 'favor >= 2/3_capital') {
    const requerido = (2 * capital_total) / 3;
    return {
      alcanzada: favor >= requerido,
      valorRequerido: requerido,
      valorObtenido: favor,
    };
  }

  // Consejo: mayoría de miembros
  if (formula === 'mayoria_consejeros') {
    const requerido = total_miembros / 2;
    return {
      alcanzada: favor > requerido,
      valorRequerido: requerido,
      valorObtenido: favor,
    };
  }

  // Unknown formula — default to false
  return { alcanzada: false, valorRequerido: 0, valorObtenido: 0 };
}
