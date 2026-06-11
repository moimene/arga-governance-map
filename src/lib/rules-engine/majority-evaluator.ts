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
 * - "favor >= 2/3_capital_presente" — 2/3 of present/concurrent capital
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
  const formula = canonicalFormula(spec.formula);

  // Parse doble condicional
  let formulaActual = formula;
  if (
    spec.dobleCondicional &&
    votos.capital_presente < spec.dobleCondicional.umbral * votos.capital_total
  ) {
    // Capital present is below threshold — use alternative formula
    formulaActual = canonicalFormula(spec.dobleCondicional.mayoriaAlternativa);
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

  // Evaluate formula. Concurrentes (art. 248.1): si no llega el dato, el
  // fallback prudente es favor+contra+abstenciones (quien votó o se abstuvo
  // estaba concurrente), nunca solo los emitidos.
  const concurrentes =
    votos.miembros_presentes && votos.miembros_presentes > 0
      ? votos.miembros_presentes
      : votos.favor + votos.contra + votos.abstenciones;
  const result = evaluateFormula(
    formulaActual,
    favor_ajustado,
    contra_ajustado,
    emitidos,
    votos.capital_presente,
    votos.capital_total,
    votos.total_miembros || 0,
    concurrentes
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

function normalizedFormulaText(formula: string) {
  return formula
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function canonicalFormula(formula: string) {
  const raw = formula.trim();
  const normalized = normalizedFormulaText(raw);
  const compact = normalized.replace(/\s+/g, '');

  if (compact === 'favor>contra' || normalized === 'favor > contra') return 'favor > contra';
  // ITEM-009/036 — art. 248.1 LSC (literal BOE): los acuerdos del consejo se
  // adoptan "por mayoría absoluta de los consejeros CONCURRENTES a la sesión".
  // Las dos grafías de pack que citan 248.1 se canonicalizan a la base de
  // concurrentes, no al tamaño total del órgano ('mayoria_consejeros' queda
  // para fórmulas que exijan explícitamente mayoría del total).
  if (normalized === 'favor > presentes_mitad') return 'favor > 1/2_miembros_presentes';
  if (normalized === 'favor > presentes_mitad_no_vinculados') return 'favor > 1/2_capital_presente';
  if (normalized === 'favor > total_miembros / 2') return 'favor > 1/2_miembros_presentes';
  // ITEM-010 — art. 249.3 LSC: la delegación permanente de facultades exige
  // el voto favorable de las DOS TERCERAS PARTES DE LOS COMPONENTES del
  // consejo (sí sobre el total del órgano, no sobre concurrentes).
  if (normalized === 'favor >= 2/3_total_miembros' || normalized === 'favor >= 2/3 componentes') {
    return 'favor >= 2/3_total_miembros';
  }
  if (normalized === 'mayoria' || normalized === 'mayoria simple') return 'favor > contra';
  if (normalized === 'favor > mitad_capital_con_voto') return 'favor > 1/2_capital_total_con_voto';
  if (normalized === '> 1/2 capital') return 'favor > 1/2_capital_total_con_voto';
  if (normalized === 'favor > 0.5 * capital_presente') return 'favor > 1/2_capital_presente';
  if (normalized === '>= 2/3 emitidos siempre') return 'favor >= 2/3_emitidos';
  if (normalized === '>= 2/3 capital') return 'favor >= 2/3_capital';
  if (
    normalized === 'reforzada art. 201.2 lsc' ||
    normalized === '> 1/2 presente en 1a; >= 2/3 emitidos si < 50% en 2a'
  ) {
    return 'lsc_201_2_reforzada';
  }

  return raw;
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
  const formulaActual = canonicalFormula(formula);

  // Simple majority: favor > contra
  if (formulaActual === 'favor > contra') {
    return {
      alcanzada: favor > contra,
      valorRequerido: contra + 1,
      valorObtenido: favor,
    };
  }

  // 2/3 of votes cast
  if (formulaActual === 'favor >= 2/3_emitidos') {
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
  if (formulaActual === 'favor > 1/2_emitidos') {
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
  if (formulaActual === 'favor > 1/2_capital_presente') {
    const requerido = capital_presente / 2;
    return {
      alcanzada: favor > requerido,
      valorRequerido: requerido,
      valorObtenido: favor,
    };
  }

  // ITEM-007 — art. 198 LSC (SL, mayoría ordinaria; BOE literal): doble
  // condición — (1) mayoría de los votos válidamente emitidos (favor > contra;
  // los blancos no computan) Y (2) que el favor represente AL MENOS un tercio
  // (>=, no estricto) de los votos correspondientes al total de
  // participaciones. Antes solo se comprobaba favor > total/3: un 34% a favor
  // con 40% en contra se proclamaba.
  if (formulaActual === 'favor > 1/3_capital_total_con_voto') {
    const suelo = capital_total / 3;
    return {
      alcanzada: favor > contra && favor >= suelo,
      valorRequerido: Math.max(contra, suelo),
      valorObtenido: favor,
    };
  }

  // Absolute majority of total voting capital (art. 199 LSC)
  if (formulaActual === 'favor > 1/2_capital_total_con_voto') {
    const requerido = capital_total / 2;
    return {
      alcanzada: favor > requerido,
      valorRequerido: requerido,
      valorObtenido: favor,
    };
  }

  // 2/3 of present/concurrent capital
  if (formulaActual === 'favor >= 2/3_capital_presente') {
    const requerido = (2 * capital_presente) / 3;
    return {
      alcanzada: favor >= requerido,
      valorRequerido: requerido,
      valorObtenido: favor,
    };
  }

  // 2/3 of total capital
  if (formulaActual === 'favor >= 2/3_capital') {
    const requerido = (2 * capital_total) / 3;
    return {
      alcanzada: favor >= requerido,
      valorRequerido: requerido,
      valorObtenido: favor,
    };
  }

  // SA reinforced matters under art. 201.2 LSC.
  // ITEM-008 — BOE literal: con capital presente >50% basta mayoría absoluta;
  // en el tramo [25%, 50%) se exige el voto favorable de los DOS TERCIOS DEL
  // CAPITAL PRESENTE o representado (no de los votos emitidos — con
  // abstenciones el cómputo sobre emitidos producía falsos positivos).
  // Caso límite de concurrencia exactamente 50%: se mantiene la lectura
  // mayoritaria (mayoría absoluta) documentada en el backlog del loop.
  if (formulaActual === 'lsc_201_2_reforzada') {
    const capitalRatio = capital_total > 0 ? capital_presente / capital_total : 0;
    if (capitalRatio >= 0.5) {
      const requerido = capital_presente / 2;
      return {
        alcanzada: favor > requerido,
        valorRequerido: requerido,
        valorObtenido: favor,
      };
    }
    if (capital_presente === 0) {
      return { alcanzada: false, valorRequerido: 1, valorObtenido: 0 };
    }
    const requerido = (2 * capital_presente) / 3;
    return {
      alcanzada: favor >= requerido,
      valorRequerido: requerido,
      valorObtenido: favor,
    };
  }

  // Consejo: mayoría de miembros
  if (formulaActual === 'mayoria_consejeros') {
    const requerido = total_miembros / 2;
    return {
      alcanzada: favor > requerido,
      valorRequerido: requerido,
      valorObtenido: favor,
    };
  }

  // ITEM-009 — art. 248.1 LSC: mayoría absoluta de los consejeros
  // CONCURRENTES a la sesión (el caller resuelve el fallback de
  // miembros_presentes con favor+contra+abstenciones).
  if (formulaActual === 'favor > 1/2_miembros_presentes') {
    if (miembros_presentes === 0) {
      return { alcanzada: false, valorRequerido: 1, valorObtenido: favor };
    }
    const requerido = miembros_presentes / 2;
    return {
      alcanzada: favor > requerido,
      valorRequerido: requerido,
      valorObtenido: favor,
    };
  }

  // ITEM-010 — art. 249.3 LSC: 2/3 de los componentes del consejo
  // (delegación permanente de facultades y designación de consejeros
  // delegados/comisiones ejecutivas).
  if (formulaActual === 'favor >= 2/3_total_miembros') {
    if (total_miembros === 0) {
      return { alcanzada: false, valorRequerido: 1, valorObtenido: favor };
    }
    const requerido = (2 * total_miembros) / 3;
    return {
      alcanzada: favor >= requerido,
      valorRequerido: requerido,
      valorObtenido: favor,
    };
  }

  // Unknown formula — default to false
  return { alcanzada: false, valorRequerido: 0, valorObtenido: 0 };
}
