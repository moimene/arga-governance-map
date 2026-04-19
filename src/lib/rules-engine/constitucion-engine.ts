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
  let quorumFuente = 'LEY';
  let quorumReferencia = 'art. 188 LSC';
  let isCombinadoProfile = false;

  if (input.tipoSocial === 'SA') {
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
    quorumReferencia = `art. 189 LSC (SA ${input.primeraConvocatoria ? '1a' : '2a'} ${determineMateriaClase})`;
  } else if (input.tipoSocial === 'SL') {
    // SL: typically 0 (sin quórum legal) unless override
    requiredQuorum = 0;
    quorumReferencia = 'art. 201 LSC (SL)';
  } else if (input.organoTipo === 'CONSEJO') {
    // CONSEJO: mayoría de miembros
    requiredQuorum = input.totalMiembros ? input.totalMiembros / 2 : 0;
    quorumReferencia = 'Estatutos / Consejo';
  }

  // ================================================================
  // Step 5: Apply overrides via resolverReglaEfectiva
  // ================================================================
  const quorumBase = {
    valor: requiredQuorum,
    fuente: 'LEY' as const,
    referencia: quorumReferencia,
  };

  const effectiveQuorum = resolverReglaEfectiva(quorumBase, overrides, 'mayor');
  requiredQuorum = effectiveQuorum.valor as number;
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
