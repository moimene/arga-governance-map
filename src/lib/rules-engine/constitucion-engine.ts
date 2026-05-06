// ============================================================
// Motor de Reglas LSC — Constitución Engine
// Spec: docs/superpowers/specs/2026-04-19-motor-reglas-lsc-secretaria-design.md §6
// ============================================================

import type {
  ConstitucionInput,
  ConstitucionOutput,
  RulePack,
  RuleParamOverride,
  ExplainNode,
  EvalSeverity,
  ConflictoInteres,
  DenominadorAjustado,
  TipoSocial,
} from './types';
import { resolverReglaEfectiva } from './jerarquia-normativa';

type NumericQuorumKey = 'SA_1a' | 'SA_2a' | 'SL';

function normalizeQuorumFraction(value: number) {
  if (!Number.isFinite(value)) return value;
  if (value > 1) return value / 100;
  if (value < 0) return 0;
  return value;
}

function normalizeQuorumParam<T extends { valor: number }>(param: T): T {
  return {
    ...param,
    valor: normalizeQuorumFraction(param.valor),
  };
}

function isQuorumOverride(override: RuleParamOverride) {
  const raw = `${override.materia ?? ''} ${override.clave ?? ''}`.toUpperCase();
  return raw.includes('QUORUM') || raw.includes('QUÓRUM') || raw.includes('CONSTITUCION');
}

function normalizeQuorumOverrides(overrides: RuleParamOverride[]) {
  return overrides
    .filter(isQuorumOverride)
    .map((override) => {
      if (typeof override.valor !== 'number') return override;
      return {
        ...override,
        valor: normalizeQuorumFraction(override.valor),
      };
    });
}

function resolvePackQuorum(packs: RulePack[], key: NumericQuorumKey) {
  const candidates = packs
    .map((pack) => pack.constitucion?.quorum?.[key])
    .filter((param): param is NonNullable<RulePack['constitucion']['quorum'][NumericQuorumKey]> =>
      typeof param?.valor === 'number',
    )
    .map(normalizeQuorumParam);

  if (candidates.length === 0) return null;
  return candidates.reduce((max, current) => current.valor > max.valor ? current : max);
}

/**
 * evaluarConstitucion — Assess quorum requirements and verify meeting is properly constituted
 *
 * Logic:
 * 1. Gate: adoption_mode (UNIPERSONAL → skip, ok:true. NO_SESSION → skip, ok:true)
 * 2. Calculate denominador ajustado if conflictos exist
 * 3. Determine required quorum from pack.constitucion.quorum
 * 4. Apply overrides via resolverReglaEfectiva
 * 5. Profile combinado: use most demanding quorum for multi-materia sessions
 * 6. Evaluate: quorumPresente >= quorumRequerido * denominador
 * 7. Return with explain nodes
 */
export function evaluarConstitucion(
  input: ConstitucionInput,
  packs: RulePack[],
  overrides: RuleParamOverride[] = []
): ConstitucionOutput {
  const explainNodes: ExplainNode[] = [];
  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  let severity: EvalSeverity = 'OK';

  // ================================================================
  // Gate 1: adoption_mode — UNIPERSONAL or NO_SESSION
  // ================================================================
  if (
    input.adoptionMode === 'UNIPERSONAL_SOCIO' ||
    input.adoptionMode === 'UNIPERSONAL_ADMIN' ||
    input.adoptionMode === 'NO_SESSION'
  ) {
    const gateNode: ExplainNode = {
      regla: `Gate: Modo adopción ${input.adoptionMode}`,
      fuente: 'LEY',
      referencia: 'art. 15/210 LSC / Acuerdos sin sesión',
      resultado: 'OK',
      mensaje: `Modo ${input.adoptionMode} no requiere evaluación de quórum (sin sesión colectiva)`,
    };
    explainNodes.push(gateNode);

    return {
      etapa: 'CONSTITUCION',
      ok: true,
      severity: 'OK',
      explain: explainNodes,
      blocking_issues: [],
      warnings: [],
      quorumRequerido: 0,
      quorumPresente: 0,
      quorumCubierto: true,
    };
  }

  // ================================================================
  // Gate 1b: Junta universal — art. 178 LSC
  // ================================================================
  if (input.esJuntaUniversal === true || input.adoptionMode === 'UNIVERSAL') {
    const universal = validarCapitalUniversal(
      input.capitalPresenteRepresentado,
      input.capitalConDerechoVoto
    );
    const aceptacionUnanime = input.aceptacionUnanimeCelebracion === true;
    const ok = universal.ok && aceptacionUnanime;

    const gateNode: ExplainNode = {
      regla: 'Gate: Junta universal',
      fuente: 'LEY',
      referencia: 'art. 178 LSC',
      umbral: 100,
      valor: universal.pctPresente,
      resultado: ok ? 'OK' : 'BLOCKING',
      mensaje: ok
        ? 'Junta universal valida: 100% del capital presente y aceptacion unanime de la celebracion. Se omiten umbrales de primera/segunda convocatoria.'
        : `Junta universal no valida: ${universal.mensaje} Aceptacion unanime: ${aceptacionUnanime ? 'si' : 'no'}.`,
    };
    explainNodes.push(gateNode);

    if (!universal.ok) blockingIssues.push('universal_capital_not_full');
    if (!aceptacionUnanime) blockingIssues.push('universal_acceptance_missing');
    severity = ok ? 'OK' : 'BLOCKING';

    return {
      etapa: 'CONSTITUCION',
      ok,
      severity,
      explain: explainNodes,
      blocking_issues: blockingIssues,
      warnings,
      quorumRequerido: 1,
      quorumPresente: universal.pctPresente / 100,
      quorumCubierto: ok,
    };
  }

  // ================================================================
  // Gate 1c: source census must exist before any quorum math
  // ================================================================
  if (input.capitalConDerechoVoto <= 0) {
    const gateNode: ExplainNode = {
      regla: 'Gate: Censo disponible',
      fuente: 'SISTEMA',
      resultado: 'BLOCKING',
      mensaje:
        'No hay censo con capital/derechos de voto o miembros computables para constituir la sesión. Carga el censo societario antes de calcular quórum.',
    };
    explainNodes.push(gateNode);
    blockingIssues.push('census_not_available');
    severity = 'BLOCKING';

    return {
      etapa: 'CONSTITUCION',
      ok: false,
      severity,
      explain: explainNodes,
      blocking_issues: blockingIssues,
      warnings,
      quorumRequerido: 0,
      quorumPresente: 0,
      quorumCubierto: false,
    };
  }

  // ================================================================
  // Step 2: Calculate denominador ajustado (interest conflicts)
  // ================================================================
  const denominadorAjustado = calcularDenominadorAjustado(
    input.capitalConDerechoVoto,
    input.conflictos
  );

  // Gate: denominador ajustado is zero
  if (denominadorAjustado.capital_convocable <= 0) {
    const gateNode: ExplainNode = {
      regla: 'Gate: Denominador ajustado',
      fuente: 'LEY',
      referencia: 'art. 187 LSC (conflictos de interés)',
      resultado: 'BLOCKING',
      mensaje: `Capital convocable = ${denominadorAjustado.capital_convocable} (≤0). Todos los socios excluidos del quórum.`,
    };
    explainNodes.push(gateNode);
    blockingIssues.push('capital_convocable_zero_or_negative');
    severity = 'BLOCKING';

    return {
      etapa: 'CONSTITUCION',
      ok: false,
      severity,
      explain: explainNodes,
      blocking_issues: blockingIssues,
      warnings,
      quorumRequerido: 0,
      quorumPresente: 0,
      quorumCubierto: false,
      denominadorAjustado,
    };
  }

  // ================================================================
  // Step 3: Check for combined profile (multi-materia sessions)
  // ================================================================
  // If multiple packs of different classes are provided, use the most demanding quorum
  const allMateriaClases = new Set(packs.map(p => p.clase));
  const hasMultipleMaterias = allMateriaClases.size > 1;

  // Find matching rule packs for this materia
  const matchedPacks = packs.filter(p =>
    input.materiaClase === 'ORDINARIA'
      ? p.clase === 'ORDINARIA'
      : ['ESTATUTARIA', 'ESTRUCTURAL'].includes(p.clase)
  );

  if (matchedPacks.length === 0) {
    warnings.push(`No rule packs found for materia clase ${input.materiaClase}`);
  }

  // ================================================================
  // Step 4: Determine required quorum
  // ================================================================
  let requiredQuorum = 0;
  let quorumFuente: import('./types').Fuente = 'LEY';
  let quorumReferencia = 'art. 188 LSC';
  let isCombinadoProfile = false;

  if (input.organoTipo === 'CONSEJO' || input.organoTipo === 'COMISION_DELEGADA') {
    // Consejo/comisiones: the denominator is members, not share capital.
    // Use the exact majority threshold when total members are known so 5/10
    // does not incorrectly constitute a "mayoría de miembros".
    requiredQuorum = input.totalMiembros && input.totalMiembros > 0
      ? (Math.floor(input.totalMiembros / 2) + 1) / input.totalMiembros
      : 0.5;
    quorumReferencia = input.organoTipo === 'CONSEJO'
      ? 'art. 247.1 LSC — mayoría de vocales del Consejo'
      : 'Reglamento/estatutos — mayoría de miembros de la comisión';
  } else if (input.tipoSocial === 'SA' || input.tipoSocial === 'SAU') {
    // SA: quorum depends on primeraConvocatoria and materiaClase
    // But if we have multiple material classes, use the most demanding
    let determineMateriaClase = input.materiaClase;

    if (hasMultipleMaterias && input.primeraConvocatoria) {
      // For SA 1a with multiple matters: use ESPECIAL rules (50%)
      determineMateriaClase = 'ESPECIAL';
      isCombinadoProfile = true;
    }

    const quorumPct = input.primeraConvocatoria
      ? determineMateriaClase === 'ORDINARIA'
        ? 0.25 // SA 1a ORDINARIA: 25%
        : 0.5 // SA 1a ESPECIAL: 50%
      : determineMateriaClase === 'ORDINARIA'
      ? 0 // SA 2a ORDINARIA: sin mínimo
      : 0.25; // SA 2a ESPECIAL: 25%

    requiredQuorum = quorumPct;
    quorumReferencia = determineMateriaClase === 'ORDINARIA'
      ? `art. 193 LSC (SA ${input.primeraConvocatoria ? '1a' : '2a'} ordinaria)`
      : `art. 194 LSC (SA ${input.primeraConvocatoria ? '1a' : '2a'} materia cualificada)`;

    const packQuorum = resolvePackQuorum(matchedPacks, input.primeraConvocatoria ? 'SA_1a' : 'SA_2a');
    if (packQuorum && packQuorum.valor > requiredQuorum) {
      requiredQuorum = packQuorum.valor;
      quorumFuente = packQuorum.fuente;
      quorumReferencia = packQuorum.referencia ?? quorumReferencia;
    }
  } else if (input.tipoSocial === 'SL' || input.tipoSocial === 'SLU') {
    // SL: typically 0 (sin quórum legal) unless override
    requiredQuorum = 0;
    quorumReferencia = 'art. 201 LSC (SL)';

    const packQuorum = resolvePackQuorum(matchedPacks, 'SL');
    if (packQuorum && packQuorum.valor > requiredQuorum) {
      requiredQuorum = packQuorum.valor;
      quorumFuente = packQuorum.fuente;
      quorumReferencia = packQuorum.referencia ?? quorumReferencia;
    }
  }

  // ================================================================
  // Step 5: Apply overrides via resolverReglaEfectiva
  // ================================================================
  const quorumBase = {
    valor: requiredQuorum,
    fuente: 'LEY' as const,
    referencia: quorumReferencia,
  };

  const effectiveQuorum = resolverReglaEfectiva(quorumBase, normalizeQuorumOverrides(overrides), 'mayor');
  requiredQuorum = normalizeQuorumFraction(effectiveQuorum.valor as number);
  quorumFuente = effectiveQuorum.fuente;
  quorumReferencia = effectiveQuorum.referencia || quorumReferencia;

  // ================================================================
  // Step 6: Append combinado profile marker to referencia
  // ================================================================
  if (isCombinadoProfile) {
    quorumReferencia += ' (perfil combinado)';
  }

  // ================================================================
  // Step 7: Calculate quorum present (percentage of denominador)
  // ================================================================
  const quorumPresente = input.capitalPresenteRepresentado / denominadorAjustado.capital_convocable;
  const quorumCubierto = quorumPresente >= requiredQuorum;

  // Add explain node
  const quorumNode: ExplainNode = {
    regla: `Quórum requerido: ${(requiredQuorum * 100).toFixed(0)}%`,
    fuente: quorumFuente,
    referencia: quorumReferencia,
    umbral: requiredQuorum * 100,
    valor: quorumPresente * 100,
    resultado: quorumCubierto ? 'OK' : 'BLOCKING',
    mensaje: quorumCubierto
      ? `Quórum cubierto: ${(quorumPresente * 100).toFixed(2)}% >= ${(requiredQuorum * 100).toFixed(0)}%`
      : `Quórum NO cubierto: ${(quorumPresente * 100).toFixed(2)}% < ${(requiredQuorum * 100).toFixed(0)}%`,
  };
  explainNodes.push(quorumNode);

  // ================================================================
  // Finalize
  // ================================================================
  if (!quorumCubierto) {
    blockingIssues.push('quorum_not_met');
    severity = 'BLOCKING';
  }

  return {
    etapa: 'CONSTITUCION',
    ok: quorumCubierto,
    severity,
    explain: explainNodes,
    blocking_issues: blockingIssues,
    warnings,
    quorumRequerido: requiredQuorum,
    quorumPresente,
    quorumCubierto,
    denominadorAjustado: denominadorAjustado.capital_total > 0 ? denominadorAjustado : undefined,
  };
}

/**
 * validarCapitalUniversal — Verifica que el 100% del capital con derecho a voto
 * esté presente/representado para la Junta Universal (art. 178 LSC).
 *
 * @param capitalPresente Capital presente y representado (unidades absolutas)
 * @param capitalTotal Capital total con derecho a voto (excluyendo tesorería)
 */
export function validarCapitalUniversal(
  capitalPresente: number,
  capitalTotal: number
): { ok: boolean; pctPresente: number; pctFaltante: number; mensaje: string } {
  if (capitalTotal <= 0) {
    return {
      ok: false,
      pctPresente: 0,
      pctFaltante: 100,
      mensaje: "Capital total no definido. No se puede validar Junta Universal.",
    };
  }
  const pctPresente = (capitalPresente / capitalTotal) * 100;
  const pctFaltante = Math.max(0, 100 - pctPresente);
  const ok = pctPresente >= 100;
  return {
    ok,
    pctPresente,
    pctFaltante,
    mensaje: ok
      ? `100% del capital presente (art. 178 LSC). Junta Universal válida.`
      : `Junta Universal requiere el 100% del capital. Presente: ${pctPresente.toFixed(2)}%. Falta: ${pctFaltante.toFixed(2)}%.`,
  };
}

/**
 * calcularDenominadorAjustado — Calculate adjusted denominator (capital convocable)
 *
 * Adjusts for interest conflicts:
 * - EXCLUIR_QUORUM: excluded from quorum denominator
 * - EXCLUIR_VOTO: excluded from vote denominator
 * - EXCLUIR_AMBOS: excluded from both quorum and vote
 *
 * Returns:
 * - capital_convocable = capital_total - capital_excluido_quorum
 * - capital_votante = capital_total - capital_excluido_voto
 */
export function calcularDenominadorAjustado(
  capitalTotal: number,
  conflictos?: ConflictoInteres[]
): DenominadorAjustado {
  let capital_excluido_quorum = 0;
  let capital_excluido_voto = 0;
  const mandatos_excluidos: string[] = [];

  if (conflictos && conflictos.length > 0) {
    for (const conflicto of conflictos) {
      if (conflicto.tipo === 'EXCLUIR_QUORUM' || conflicto.tipo === 'EXCLUIR_AMBOS') {
        capital_excluido_quorum += conflicto.capital_afectado;
      }
      if (conflicto.tipo === 'EXCLUIR_VOTO' || conflicto.tipo === 'EXCLUIR_AMBOS') {
        capital_excluido_voto += conflicto.capital_afectado;
      }
      mandatos_excluidos.push(conflicto.mandate_id);
    }
  }

  return {
    capital_total: capitalTotal,
    capital_excluido_quorum,
    capital_excluido_voto,
    capital_convocable: Math.max(0, capitalTotal - capital_excluido_quorum),
    capital_votante: Math.max(0, capitalTotal - capital_excluido_voto),
    mandatos_excluidos,
  };
}
