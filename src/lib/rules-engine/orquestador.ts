// ============================================================
// Motor de Reglas LSC — Orquestador Principal
// Spec: docs/superpowers/specs/2026-04-19-motor-reglas-lsc-secretaria-design.md §8
// ============================================================

import type {
  ComplianceResult,
  RulePack,
  RuleParamOverride,
  FormaAdministracion,
  AdoptionMode,
  TipoOrgano,
  TipoSocial,
  ConvocatoriaInput,
  ConstitucionInput,
  VotacionInput,
  DocumentacionInput,
  ExplainNode,
  EvaluacionResult,
  EvalSeverity,
} from './types';
import { evaluarConvocatoria } from './convocatoria-engine';
import { evaluarConstitucion } from './constitucion-engine';
import { evaluarVotacion } from './votacion-engine';
import { evaluarDocumentacion } from './documentacion-engine';
import { evaluarPactosParasociales, type PactoParasocial, type PactosEvalInput, type PactosEvalOutput } from './pactos-engine';

/**
 * Determina el modo de adopción basado en estructura y contexto.
 *
 * Lógica:
 * - Si esUnipersonal AND organoTipo=JUNTA_GENERAL → UNIPERSONAL_SOCIO
 * - Si formaAdministracion=ADMINISTRADOR_UNICO AND organoTipo=CONSEJO → UNIPERSONAL_ADMIN
 * - Si modoSolicitado está en modosAdopcionPermitidos → usar modoSolicitado
 * - Default: MEETING
 */
export function determinarAdoptionMode(
  formaAdministracion: FormaAdministracion,
  organoTipo: TipoOrgano,
  esUnipersonal: boolean,
  modoSolicitado?: AdoptionMode,
  modosPermitidos: AdoptionMode[] = [
    'MEETING',
    'UNIVERSAL',
    'NO_SESSION',
    'UNIPERSONAL_SOCIO',
    'UNIPERSONAL_ADMIN',
  ]
): AdoptionMode {
  // Caso 1: Decisión socio único en Junta General
  if (esUnipersonal && organoTipo === 'JUNTA_GENERAL') {
    return 'UNIPERSONAL_SOCIO';
  }

  // Caso 2: Decisión admin único (solo si administrador único en Consejo)
  if (
    formaAdministracion === 'ADMINISTRADOR_UNICO' &&
    organoTipo === 'CONSEJO'
  ) {
    return 'UNIPERSONAL_ADMIN';
  }

  // Caso 3: Modo solicitado explícitamente
  if (modoSolicitado && modosPermitidos.includes(modoSolicitado)) {
    return modoSolicitado;
  }

  // Default: Modo colegiado
  return 'MEETING';
}

/**
 * Compone el perfil de sesión más exigente entre múltiples materias.
 * Solo aplica para MEETING/UNIVERSAL.
 *
 * Retorna:
 * - antelacionMax: máximo requerido entre todas las materias
 * - quorumMax: máximo requerido entre todas las materias
 * - documentosUnion: lista de documentos obligatorios de todas las materias
 */
export function componerPerfilSesion(
  packs: RulePack[],
  overrides: RuleParamOverride[] = [],
  tipoSocial: TipoSocial
): {
  antelacionMax: number;
  quorumMax: number;
  documentosUnion: Array<{ id: string; nombre: string }>;
} {
  let antelacionMax = 0;
  let quorumMax = 0;
  const documentosMap = new Map<string, string>();

  // Analizar cada pack
  for (const pack of packs) {
    // Antelación
    const reglaAnt = pack.convocatoria.antelacionDias[tipoSocial];
    if (reglaAnt) {
      antelacionMax = Math.max(antelacionMax, reglaAnt.valor);
    }

    // Quórum
    const reglaQuo =
      tipoSocial === 'SA'
        ? pack.constitucion.quorum.SA_1a
        : pack.constitucion.quorum.SL;
    if (reglaQuo && typeof reglaQuo.valor === 'number') {
      quorumMax = Math.max(quorumMax, reglaQuo.valor);
    }

    // Documentos
    for (const doc of pack.documentacion.obligatoria) {
      if (!documentosMap.has(doc.id)) {
        documentosMap.set(doc.id, doc.nombre);
      }
    }
  }

  // Aplicar overrides si existen
  for (const override of overrides) {
    if (override.clave === 'antelacion_dias') {
      antelacionMax = Math.max(antelacionMax, Number(override.valor) || 0);
    } else if (override.clave === 'quorum') {
      quorumMax = Math.max(quorumMax, Number(override.valor) || 0);
    }
  }

  return {
    antelacionMax,
    quorumMax,
    documentosUnion: Array.from(documentosMap, ([id, nombre]) => ({ id, nombre })),
  };
}

/**
 * Evalúa un acuerdo completo a través del flujo correspondiente.
 *
 * Tres flujos:
 *
 * **Flow A (MEETING/UNIVERSAL):** Colegiado completo
 * 1. evaluarConvocatoria → BLOCKING = stop
 * 2. evaluarConstitucion → BLOCKING = stop
 * 3. evaluarVotacion → BLOCKING = stop
 * 4. evaluarDocumentacion → BLOCKING = stop
 * Resultado: path='A'
 *
 * **Flow B (UNIPERSONAL_SOCIO/UNIPERSONAL_ADMIN):** Decisión unipersonal
 * 1. Skip convocatoria, constitución (return ok:true)
 * 2. evaluarVotacion (delegará a ok:true si decisionFirmada)
 * 3. evaluarDocumentacion (acta consignación)
 * Resultado: path='B'
 *
 * **Flow C (NO_SESSION):** Sin sesión
 * 1. evaluarVotacion (delegará a evaluarProcesoSinSesion)
 * 2. evaluarDocumentacion (acta acuerdo escrito)
 * Resultado: path='C'
 */
export function evaluarAcuerdoCompleto(
  adoptionMode: AdoptionMode,
  packs: RulePack[],
  overrides: RuleParamOverride[] = [],
  inputs: {
    convocatoria?: ConvocatoriaInput;
    constitucion?: ConstitucionInput;
    votacion?: VotacionInput;
    documentacion?: DocumentacionInput;
    pactos?: {
      pactos: PactoParasocial[];
      evalInput: PactosEvalInput;
    };
  }
): ComplianceResult {
  const etapas: EvaluacionResult[] = [];
  const allExplain: ExplainNode[] = [];
  const allBlockingIssues: string[] = [];
  const allWarnings: string[] = [];
  let ok = true;
  let path: 'A' | 'B' | 'C' = 'A';

  // ===== FLUJO A: COLEGIADO (MEETING/UNIVERSAL) =====
  if (adoptionMode === 'MEETING' || adoptionMode === 'UNIVERSAL') {
    path = 'A';

    // Add path marker explain node
    const pathNode: ExplainNode = {
      regla: `Flujo A: Acuerdo colegiado (${adoptionMode})`,
      fuente: 'LEY',
      referencia: 'art. 176+ LSC',
      resultado: 'OK',
      mensaje: `Evaluación de acuerdo en modo colegiado (${adoptionMode === 'UNIVERSAL' ? 'junta universal' : 'sesión ordinaria'})`
    };
    allExplain.push(pathNode);

    // Etapa 1: Convocatoria
    if (inputs.convocatoria) {
      const resultConv = evaluarConvocatoria(inputs.convocatoria, packs, overrides);
      etapas.push(resultConv);
      allExplain.push(...resultConv.explain);
      allBlockingIssues.push(...resultConv.blocking_issues);
      allWarnings.push(...resultConv.warnings);

      if (resultConv.severity === 'BLOCKING') {
        ok = false;
        return {
          ok,
          adoptionMode,
          path,
          etapas,
          explain: allExplain,
          blocking_issues: allBlockingIssues,
          warnings: allWarnings,
        };
      }
    }

    // Etapa 2: Constitución
    if (inputs.constitucion) {
      const resultConst = evaluarConstitucion(inputs.constitucion, packs, overrides);
      etapas.push(resultConst);
      allExplain.push(...resultConst.explain);
      allBlockingIssues.push(...resultConst.blocking_issues);
      allWarnings.push(...resultConst.warnings);

      if (resultConst.severity === 'BLOCKING') {
        ok = false;
        return {
          ok,
          adoptionMode,
          path,
          etapas,
          explain: allExplain,
          blocking_issues: allBlockingIssues,
          warnings: allWarnings,
        };
      }
    }

    // Etapa 3: Votación
    if (inputs.votacion) {
      const resultVot = evaluarVotacion(inputs.votacion, packs, overrides);
      etapas.push(resultVot);
      allExplain.push(...resultVot.explain);
      allBlockingIssues.push(...resultVot.blocking_issues);
      allWarnings.push(...resultVot.warnings);

      if (resultVot.severity === 'BLOCKING') {
        ok = false;
        return {
          ok,
          adoptionMode,
          path,
          etapas,
          explain: allExplain,
          blocking_issues: allBlockingIssues,
          warnings: allWarnings,
        };
      }
    }

    // Etapa 4: Documentación
    if (inputs.documentacion) {
      const resultDoc = evaluarDocumentacion(inputs.documentacion, packs);
      etapas.push(resultDoc);
      allExplain.push(...resultDoc.explain);
      allBlockingIssues.push(...resultDoc.blocking_issues);
      allWarnings.push(...resultDoc.warnings);

      if (resultDoc.severity === 'BLOCKING') {
        ok = false;
      }
    }
  }
  // ===== FLUJO B: UNIPERSONAL =====
  else if (
    adoptionMode === 'UNIPERSONAL_SOCIO' ||
    adoptionMode === 'UNIPERSONAL_ADMIN'
  ) {
    path = 'B';

    // Add path marker explain node
    const pathNodeB: ExplainNode = {
      regla: `Flujo B: Decisión unipersonal (${adoptionMode})`,
      fuente: 'LEY',
      referencia: 'art. 201-202 LSC',
      resultado: 'OK',
      mensaje: `Evaluación de acuerdo en modo unipersonal (${adoptionMode === 'UNIPERSONAL_SOCIO' ? 'socio único' : 'administrador único'})`
    };
    allExplain.push(pathNodeB);

    // Skip convocatoria, constitución → marcar como OK
    const skipConv: EvaluacionResult = {
      etapa: 'convocatoria_skip',
      ok: true,
      severity: 'OK',
      explain: [
        {
          regla: 'skip_convocatoria_unipersonal',
          fuente: 'LEY',
          referencia: 'art. 201-202 LSC',
          resultado: 'OK',
          mensaje: `Convocatoria no requerida en modo ${adoptionMode}`,
        },
      ],
      blocking_issues: [],
      warnings: [],
    };
    etapas.push(skipConv);
    allExplain.push(...skipConv.explain);

    const skipConst: EvaluacionResult = {
      etapa: 'constitucion_skip',
      ok: true,
      severity: 'OK',
      explain: [
        {
          regla: 'skip_constitucion_unipersonal',
          fuente: 'LEY',
          resultado: 'OK',
          mensaje: `Constitución no requerida en modo ${adoptionMode}`,
        },
      ],
      blocking_issues: [],
      warnings: [],
    };
    etapas.push(skipConst);
    allExplain.push(...skipConst.explain);

    // Etapa 3: Votación (delegará a ok:true si decisionFirmada)
    if (inputs.votacion) {
      const resultVot = evaluarVotacion(inputs.votacion, packs, overrides);
      etapas.push(resultVot);
      allExplain.push(...resultVot.explain);
      allBlockingIssues.push(...resultVot.blocking_issues);
      allWarnings.push(...resultVot.warnings);

      if (resultVot.severity === 'BLOCKING') {
        ok = false;
        return {
          ok,
          adoptionMode,
          path,
          etapas,
          explain: allExplain,
          blocking_issues: allBlockingIssues,
          warnings: allWarnings,
        };
      }
    }

    // Etapa 4: Documentación
    if (inputs.documentacion) {
      const resultDoc = evaluarDocumentacion(inputs.documentacion, packs);
      etapas.push(resultDoc);
      allExplain.push(...resultDoc.explain);
      allBlockingIssues.push(...resultDoc.blocking_issues);
      allWarnings.push(...resultDoc.warnings);

      if (resultDoc.severity === 'BLOCKING') {
        ok = false;
      }
    }
  }
  // ===== FLUJO C: SIN SESIÓN =====
  else if (adoptionMode === 'NO_SESSION') {
    path = 'C';

    // Add path marker explain node
    const pathNodeC: ExplainNode = {
      regla: 'Flujo C: Proceso sin sesión',
      fuente: 'LEY',
      referencia: 'art. 197 LSC',
      resultado: 'OK',
      mensaje: 'Evaluación de acuerdo en proceso sin sesión colectiva'
    };
    allExplain.push(pathNodeC);

    // Skip convocatoria, constitución
    const skipConv: EvaluacionResult = {
      etapa: 'convocatoria_skip',
      ok: true,
      severity: 'OK',
      explain: [
        {
          regla: 'skip_convocatoria_nosession',
          fuente: 'LEY',
          referencia: 'art. 197 LSC',
          resultado: 'OK',
          mensaje: 'Convocatoria no requerida en proceso sin sesión',
        },
      ],
      blocking_issues: [],
      warnings: [],
    };
    etapas.push(skipConv);
    allExplain.push(...skipConv.explain);

    const skipConst: EvaluacionResult = {
      etapa: 'constitucion_skip',
      ok: true,
      severity: 'OK',
      explain: [
        {
          regla: 'skip_constitucion_nosession',
          fuente: 'LEY',
          resultado: 'OK',
          mensaje: 'Constitución no requerida en proceso sin sesión',
        },
      ],
      blocking_issues: [],
      warnings: [],
    };
    etapas.push(skipConst);
    allExplain.push(...skipConst.explain);

    // Etapa 3: Votación (delegará a evaluarProcesoSinSesion)
    if (inputs.votacion) {
      const resultVot = evaluarVotacion(inputs.votacion, packs, overrides);
      etapas.push(resultVot);
      allExplain.push(...resultVot.explain);
      allBlockingIssues.push(...resultVot.blocking_issues);
      allWarnings.push(...resultVot.warnings);

      if (resultVot.severity === 'BLOCKING') {
        ok = false;
        return {
          ok,
          adoptionMode,
          path,
          etapas,
          explain: allExplain,
          blocking_issues: allBlockingIssues,
          warnings: allWarnings,
        };
      }
    }

    // Etapa 4: Documentación
    if (inputs.documentacion) {
      const resultDoc = evaluarDocumentacion(inputs.documentacion, packs);
      etapas.push(resultDoc);
      allExplain.push(...resultDoc.explain);
      allBlockingIssues.push(...resultDoc.blocking_issues);
      allWarnings.push(...resultDoc.warnings);

      if (resultDoc.severity === 'BLOCKING') {
        ok = false;
      }
    }
  }

  // ===== ETAPA POST-VOTACIÓN: PACTOS PARASOCIALES =====
  // Evaluación paralela e independiente del resultado societario.
  // Un acuerdo puede ser proclamable pero incumplir un pacto.
  let pactosResult: PactosEvalOutput | undefined;

  if (inputs.pactos && inputs.pactos.pactos.length > 0) {
    pactosResult = evaluarPactosParasociales(
      inputs.pactos.pactos,
      inputs.pactos.evalInput
    );

    // Add pactos explain nodes
    const pactosHeader: ExplainNode = {
      regla: 'pactos_parasociales',
      fuente: 'PACTO_PARASOCIAL',
      resultado: pactosResult.pacto_ok ? 'OK' : 'BLOCKING',
      mensaje: pactosResult.pacto_ok
        ? `Pactos parasociales: ${pactosResult.pactos_aplicables} evaluados, todos cumplidos.`
        : `PACTOS INCUMPLIDOS: ${pactosResult.pactos_incumplidos} de ${pactosResult.pactos_aplicables} pactos aplicables no se cumplen.`,
      hijos: pactosResult.explain,
    };
    allExplain.push(pactosHeader);
    allBlockingIssues.push(...pactosResult.blocking_issues);
    allWarnings.push(...pactosResult.warnings);

    // Pactos blocking → warning, NOT ok=false
    // Reason: pactos are contractual obligations, not corporate validity.
    // The agreement is still legally valid (proclamable), but breaches the pact.
    // We surface it as blocking_issues for the UI to show, but don't flip ok.
  }

  return {
    ok,
    adoptionMode,
    path,
    etapas,
    explain: allExplain,
    blocking_issues: allBlockingIssues,
    warnings: allWarnings,
    pactosResult,
  };
}
