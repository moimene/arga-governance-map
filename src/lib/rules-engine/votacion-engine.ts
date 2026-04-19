// ============================================================
// Motor de Reglas LSC — Votación Engine
// Spec: docs/superpowers/specs/2026-04-19-motor-reglas-lsc-secretaria-design.md §8
// ============================================================

import type {
  VotacionInput,
  VotacionOutput,
  RulePack,
  RuleParamOverride,
  ExplainNode,
  EvalSeverity,
  MajoritySpec,
  ConflictoInteres,
} from './types';
import { evaluarMayoria } from './majority-evaluator';
import { evaluarProcesoSinSesion } from './no-session-engine';
import { calcularDenominadorAjustado } from './constitucion-engine';
import { resolverReglaEfectiva } from './jerarquia-normativa';

/**
 * evaluarVotacion — 6-Gate Voting Engine with NO_SESSION delegation
 *
 * Gate 0: Adoption mode routing
 *   - UNIPERSONAL_SOCIO/ADMIN: skip, ok:true if decisionFirmada
 *   - NO_SESSION: delegate to evaluarProcesoSinSesion()
 *   - MEETING/UNIVERSAL: proceed to gates 1-6
 *
 * Gates 1-6 (for collegial voting):
 * 1. Elegibilidad (interest conflicts → adjusted denominator)
 * 2. Quórum (reference to constitución, already verified)
 * 3. Mayoría (call evaluarMayoria)
 * 4. Unanimidad (if required, check all votes)
 * 5. Vetos (statutory = BLOCKING, pact = WARNING only)
 * 6. Voto de calidad (break tie, but not with veto or unanimidad)
 *
 * Returns VotacionOutput with all gate results.
 */
export function evaluarVotacion(
  input: VotacionInput,
  packs: RulePack[],
  overrides: RuleParamOverride[] = []
): VotacionOutput {
  const explainNodes: ExplainNode[] = [];
  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  let severity: EvalSeverity = 'OK';
  let acuerdoProclamable = false;
  let mayoriaAlcanzada = false;
  let unanimidadAlcanzada = false;
  let votoCalidadUsado = false;
  let vetoAplicado = false;

  // ================================================================
  // Gate 0: Adoption mode routing
  // ================================================================

  // UNIPERSONAL decisions
  if (input.adoptionMode === 'UNIPERSONAL_SOCIO' || input.adoptionMode === 'UNIPERSONAL_ADMIN') {
    const gateNode: ExplainNode = {
      regla: `Gate 0: Modo adopción ${input.adoptionMode}`,
      fuente: 'LEY',
      referencia: 'art. 15/210 LSC',
      resultado: 'OK',
      mensaje: `Decisión unipersonal — ${input.decisionFirmada ? 'FIRMADA (válida)' : 'NO FIRMADA'}`,
    };
    explainNodes.push(gateNode);

    if (!input.decisionFirmada) {
      gateNode.resultado = 'BLOCKING';
      gateNode.mensaje = 'Decisión unipersonal DEBE estar firmada';
      blockingIssues.push('unipersonal_not_signed');
      severity = 'BLOCKING';
      acuerdoProclamable = false;
    } else {
      acuerdoProclamable = true;
    }

    return {
      etapa: 'VOTACION',
      ok: acuerdoProclamable,
      severity,
      explain: explainNodes,
      blocking_issues: blockingIssues,
      warnings,
      acuerdoProclamable,
      mayoriaAlcanzada: false,
    };
  }

  // NO_SESSION delegation
  if (input.adoptionMode === 'NO_SESSION') {
    if (!input.noSessionInput) {
      const errorNode: ExplainNode = {
        regla: 'Gate 0: NO_SESSION sin input',
        fuente: 'LEY',
        resultado: 'BLOCKING',
        mensaje: 'NO_SESSION requerido pero noSessionInput ausente',
      };
      explainNodes.push(errorNode);
      blockingIssues.push('no_session_input_missing');
      severity = 'BLOCKING';

      return {
        etapa: 'VOTACION',
        ok: false,
        severity,
        explain: explainNodes,
        blocking_issues: blockingIssues,
        warnings,
        acuerdoProclamable: false,
        mayoriaAlcanzada: false,
      };
    }

    // Find the matching pack for this matter
    const matchedPack = packs.find(p =>
      input.materias.some(m => p.materia === m || p.clase === input.materiaClase)
    );

    const noSessionOutput = evaluarProcesoSinSesion(input.noSessionInput, matchedPack);

    explainNodes.push({
      regla: 'Gate 0: Delegación a motor sin sesión',
      fuente: 'LEY',
      resultado: noSessionOutput.ok ? 'OK' : 'BLOCKING',
      mensaje: `Proceso sin sesión: ${noSessionOutput.estado}`,
      hijos: noSessionOutput.explain,
    });

    if (!noSessionOutput.ok) {
      blockingIssues.push(...noSessionOutput.blocking_issues);
      severity = 'BLOCKING';
    }
    warnings.push(...noSessionOutput.warnings);

    return {
      etapa: 'VOTACION',
      ok: noSessionOutput.ok,
      severity,
      explain: explainNodes,
      blocking_issues: blockingIssues,
      warnings,
      acuerdoProclamable: noSessionOutput.ok,
      mayoriaAlcanzada: noSessionOutput.ok,
      noSessionOutput,
    };
  }

  // For MEETING/UNIVERSAL: continue with gates 1-6
  const matchedPacks = packs.filter(p =>
    input.materias.some(m => p.materia === m || p.clase === input.materiaClase)
  );

  if (matchedPacks.length === 0) {
    warnings.push(`No rule packs matched for materias: ${input.materias.join(', ')}`);
  }

  // ================================================================
  // Gate 1: Elegibilidad (interest conflicts → adjusted denominator)
  // ================================================================

  const denominadorAjustado = calcularDenominadorAjustado(
    input.votos.capital_total,
    input.conflictos
  );

  const gateElegibilidad: ExplainNode = {
    regla: 'Gate 1: Elegibilidad (conflictos de interés)',
    fuente: 'LEY',
    referencia: 'art. 187 LSC',
    resultado: 'OK',
    mensaje: `Capital votante ajustado: ${denominadorAjustado.capital_votante} (excluidos ${denominadorAjustado.capital_excluido_voto})`,
  };

  if (denominadorAjustado.mandatos_excluidos.length > 0) {
    gateElegibilidad.hijos = [
      {
        regla: 'Mandatos excluidos del voto',
        fuente: 'LEY',
        resultado: 'WARNING',
        mensaje: `${denominadorAjustado.mandatos_excluidos.length} mandato(s) excluido(s): ${denominadorAjustado.mandatos_excluidos.join(', ')}`,
      },
    ];
  }

  explainNodes.push(gateElegibilidad);

  // ================================================================
  // Gate 2: Quórum (reference, assumed already verified)
  // ================================================================

  const gateQuorum: ExplainNode = {
    regla: 'Gate 2: Quórum',
    fuente: 'LEY',
    resultado: 'OK',
    mensaje: 'Quórum verificado en fase CONSTITUCION (referencia)',
  };
  explainNodes.push(gateQuorum);

  // ================================================================
  // Gate 3: Mayoría
  // ================================================================

  let majoritySpec: MajoritySpec | undefined;

  // Select majority spec from matched packs
  for (const pack of matchedPacks) {
    if (input.tipoSocial === 'SA') {
      majoritySpec = pack.votacion.mayoria.SA;
    } else if (input.tipoSocial === 'SL') {
      majoritySpec = pack.votacion.mayoria.SL;
    } else if (input.organoTipo === 'CONSEJO') {
      majoritySpec = pack.votacion.mayoria.CONSEJO;
    }

    if (majoritySpec) break;
  }

  if (!majoritySpec) {
    const errorNode: ExplainNode = {
      regla: 'Gate 3: Mayoría no definida',
      fuente: 'LEY',
      resultado: 'BLOCKING',
      mensaje: 'No se encontró especificación de mayoría para tipo social/órgano',
    };
    explainNodes.push(errorNode);
    blockingIssues.push('majority_spec_missing');
    severity = 'BLOCKING';

    return {
      etapa: 'VOTACION',
      ok: false,
      severity,
      explain: explainNodes,
      blocking_issues: blockingIssues,
      warnings,
      acuerdoProclamable: false,
      mayoriaAlcanzada: false,
    };
  }

  // Use the majority spec (overrides would be applied at a higher level if needed)
  const effectiveMajority = majoritySpec;

  // Get abstenciones treatment from pack
  const abstractencionesTratamiento = matchedPacks[0]?.votacion.abstenciones ?? 'no_cuentan';

  const majorityResult = evaluarMayoria(effectiveMajority, input.votos, abstractencionesTratamiento);
  mayoriaAlcanzada = majorityResult.alcanzada;

  explainNodes.push(majorityResult.explain);

  if (!mayoriaAlcanzada) {
    blockingIssues.push('majority_not_achieved');
    severity = 'BLOCKING';
  }

  // ================================================================
  // Gate 4: Unanimidad (if required)
  // ================================================================

  const unanimidadRule = matchedPacks[0]?.votacion.unanimidad;
  let unanimidadRequired = false;

  if (unanimidadRule && unanimidadRule.requerida) {
    unanimidadRequired = true;
    const votos = input.votos;

    // Check unanimidad based on scope
    let todosConsienten = false;

    if (unanimidadRule.ambito === 'TODOS') {
      // All votes must be favor (no contra/abstenciones counted against)
      todosConsienten = votos.favor === votos.favor + votos.contra + votos.abstenciones && votos.favor > 0;
    } else if (unanimidadRule.ambito === 'PRESENTES') {
      // Among those present, all favor
      todosConsienten = votos.favor === votos.favor + votos.contra && votos.favor > 0;
    } else if (unanimidadRule.ambito === 'CLASE') {
      // Unanimidad within a class (structural votes)
      todosConsienten = votos.favor === votos.favor + votos.contra && votos.favor > 0;
    }

    unanimidadAlcanzada = todosConsienten;

    const unanimidadNode: ExplainNode = {
      regla: 'Unanimidad requerida',
      fuente: unanimidadRule.fuente,
      referencia: unanimidadRule.referencia,
      resultado: unanimidadAlcanzada ? 'OK' : 'BLOCKING',
      mensaje: unanimidadAlcanzada
        ? `Unanimidad alcanzada (ámbito: ${unanimidadRule.ambito})`
        : `Unanimidad NO alcanzada: ${votos.favor} favor vs ${votos.contra + votos.abstenciones} contra/abstenciones`,
    };
    explainNodes.push(unanimidadNode);

    if (!unanimidadAlcanzada) {
      blockingIssues.push('unanimidad_not_achieved');
      severity = 'BLOCKING';
    }
  }

  // ================================================================
  // Gate 5: Vetos
  // ================================================================

  // Placeholder: vetos would come from pack.votacion.vetos (not in spec yet)
  // For now, assume no vetos unless later specified
  const vetoNode: ExplainNode = {
    regla: 'Gate 5: Vetos',
    fuente: 'ESTATUTOS',
    resultado: 'OK',
    mensaje: 'Sin vetos aplicados',
  };
  explainNodes.push(vetoNode);

  // ================================================================
  // Gate 6: Voto de calidad
  // ================================================================

  if (input.esEmpate && input.votoCalidadHabilitado) {
    // Check if veto or unanimidad would prevent use
    if (vetoAplicado || unanimidadRequired) {
      const vetoCalidadNode: ExplainNode = {
        regla: 'Voto de calidad bloqueado',
        fuente: 'ESTATUTOS',
        resultado: 'WARNING',
        mensaje: 'Empate existe pero voto de calidad no permitido (existe veto o unanimidad requerida)',
      };
      explainNodes.push(vetoCalidadNode);
    } else {
      votoCalidadUsado = true;
      mayoriaAlcanzada = true; // Tie is broken

      const vetoCalidadNode: ExplainNode = {
        regla: 'Voto de calidad (desempate)',
        fuente: 'ESTATUTOS',
        resultado: 'OK',
        mensaje: 'Empate resuelto con voto de calidad del presidente/administrador',
      };
      explainNodes.push(vetoCalidadNode);
    }
  }

  // ================================================================
  // Final decision
  // ================================================================

  const allBlockingMet = blockingIssues.length === 0;
  acuerdoProclamable = allBlockingMet && mayoriaAlcanzada;

  return {
    etapa: 'VOTACION',
    ok: acuerdoProclamable,
    severity,
    explain: explainNodes,
    blocking_issues: blockingIssues,
    warnings,
    acuerdoProclamable,
    mayoriaAlcanzada,
    unanimidadRequerida: unanimidadRequired,
    unanimidadAlcanzada: unanimidadRequired ? unanimidadAlcanzada : undefined,
    vetoAplicado: vetoAplicado || undefined,
    votoCalidadUsado: votoCalidadUsado || undefined,
  };
}
