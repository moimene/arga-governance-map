// ============================================================
// Motor de Reglas LSC — Convocatoria Engine
// Spec: docs/superpowers/specs/2026-04-19-motor-reglas-lsc-secretaria-design.md §5
// ============================================================

import type {
  ConvocatoriaInput,
  ConvocatoriaOutput,
  RulePack,
  RuleParamOverride,
  ExplainNode,
  EvalSeverity,
  TipoSocial,
} from './types';
import { resolverReglaEfectiva } from './jerarquia-normativa';

/**
 * evaluarConvocatoria — Main entry point
 *
 * Evaluates convocation rules for a meeting based on:
 * 1. Adoption mode (gates unipersonal and universal)
 * 2. Proper timing (advance notice requirements)
 * 3. Required channels (BORME, diario, website, etc.)
 * 4. Minimum content and mandatory documents
 *
 * Returns ConvocatoriaOutput with detailed explain nodes including
 * source (fuente) and reference (referencia) for each rule.
 */
export function evaluarConvocatoria(
  input: ConvocatoriaInput,
  packs: RulePack[],
  overrides: RuleParamOverride[] = []
): ConvocatoriaOutput {
  const explainNodes: ExplainNode[] = [];
  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  let severity: EvalSeverity = 'OK';

  // ================================================================
  // Gate 1: Adoption mode — UNIPERSONAL (socio/admin)
  // ================================================================
  if (
    input.adoptionMode === 'UNIPERSONAL_SOCIO' ||
    input.adoptionMode === 'UNIPERSONAL_ADMIN'
  ) {
    const gateNode = createExplainNode(
      'Gate: Decisión unipersonal',
      'LEY',
      'art. 15/210 LSC',
      'OK',
      `No requiere convocatoria formal — decisión unipersonal (${input.adoptionMode === 'UNIPERSONAL_SOCIO' ? 'socio único' : 'administrador único'}) puede adoptar acuerdos sin sesión`,
      undefined
    );
    explainNodes.push(gateNode);
    return {
      etapa: 'CONVOCATORIA',
      ok: true,
      severity: 'OK',
      explain: explainNodes,
      blocking_issues: [],
      warnings: [],
      fechaLimitePublicacion: input.fechaJunta,
      antelacionDiasRequerida: 0,
      canalesExigidos: [],
      contenidoMinimo: [],
      documentosObligatorios: [],
      ventanaDisponibilidad: {
        desde: input.fechaJunta,
        hasta: input.fechaJunta,
      },
    };
  }

  // ================================================================
  // Gate 2: Junta universal — no convocatoria formal
  // ================================================================
  if (input.esJuntaUniversal) {
    const gateNode = createExplainNode(
      'Gate: Junta universal',
      'LEY',
      'art. 178 LSC',
      'OK',
      'Junta universal — no requiere convocatoria formal cuando todos los socios asisten',
      undefined
    );
    explainNodes.push(gateNode);
    return {
      etapa: 'CONVOCATORIA',
      ok: true,
      severity: 'OK',
      explain: explainNodes,
      blocking_issues: [],
      warnings: [],
      fechaLimitePublicacion: input.fechaJunta,
      antelacionDiasRequerida: 0,
      canalesExigidos: [],
      contenidoMinimo: [],
      documentosObligatorios: [],
      ventanaDisponibilidad: {
        desde: input.fechaJunta,
        hasta: input.fechaJunta,
      },
    };
  }

  // ================================================================
  // Rule 1: Antelación (advance notice)
  // ================================================================
  const antelacionDiasRequerida = calcularAntelacion(
    input.tipoSocial,
    packs,
    overrides
  );
  const fechaLimitePublicacion = restarDias(
    input.fechaJunta,
    antelacionDiasRequerida
  );

  explainNodes.push(
    createExplainNode(
      'Antelación requerida',
      'LEY',
      'art. 176 LSC',
      'OK',
      `${antelacionDiasRequerida} días de antelación requeridos para ${input.tipoSocial}`,
      antelacionDiasRequerida
    )
  );

  // ================================================================
  // Rule 2: Canales (SA sin web inscrita: BORME + diario)
  // ================================================================
  const canalesExigidos = calcularCanales(input, packs, overrides);

  if (input.tipoSocial === 'SA' && !input.webInscrita) {
    if (!canalesExigidos.includes('BORME')) {
      canalesExigidos.push('BORME');
    }
    if (!canalesExigidos.includes('DIARIO_OFICIAL')) {
      canalesExigidos.push('DIARIO_OFICIAL');
    }
    explainNodes.push(
      createExplainNode(
        'Canales: SA sin web inscrita',
        'LEY',
        'art. 179 LSC',
        'OK',
        'SA sin web inscrita debe publicar en BORME + diario oficial',
        undefined
      )
    );
  }

  if (input.tipoSocial === 'SA' && input.webInscrita) {
    if (!canalesExigidos.includes('WEB_SOCIEDAD')) {
      canalesExigidos.push('WEB_SOCIEDAD');
    }
    explainNodes.push(
      createExplainNode(
        'Canales: SA con web inscrita',
        'LEY',
        'art. 179 LSC',
        'OK',
        'SA con web inscrita debe publicar en web de la sociedad',
        undefined
      )
    );
  }

  // ================================================================
  // Rule 3: Documentos obligatorios
  // ================================================================
  const documentosObligatorios = calcularDocumentos(input, packs, overrides);

  explainNodes.push(
    createExplainNode(
      'Documentos obligatorios',
      'LEY',
      'art. 180-181 LSC',
      'OK',
      `${documentosObligatorios.length} documento(s) obligatorio(s) a disposición de los socios`,
      undefined
    )
  );

  // ================================================================
  // Rule 4: Contenido mínimo
  // ================================================================
  const contenidoMinimo = calcularContenido(input, packs, overrides);

  explainNodes.push(
    createExplainNode(
      'Contenido mínimo',
      'LEY',
      'art. 182 LSC',
      'OK',
      `Convocatoria debe incluir: ${contenidoMinimo.join(', ')}`,
      undefined
    )
  );

  // ================================================================
  // Rule 5: Ventana disponibilidad
  // ================================================================
  const ventanaDisponibilidad = {
    desde: fechaLimitePublicacion,
    hasta: input.fechaJunta,
  };

  explainNodes.push(
    createExplainNode(
      'Ventana disponibilidad',
      'LEY',
      'art. 180 LSC',
      'OK',
      `Documentos disponibles desde ${fechaLimitePublicacion} hasta ${input.fechaJunta}`,
      undefined
    )
  );

  // ================================================================
  // Final evaluation
  // ================================================================
  const ok = blockingIssues.length === 0;
  if (blockingIssues.length > 0) {
    severity = 'BLOCKING';
  } else if (warnings.length > 0) {
    severity = 'WARNING';
  }

  return {
    etapa: 'CONVOCATORIA',
    ok,
    severity,
    explain: explainNodes,
    blocking_issues: blockingIssues,
    warnings,
    fechaLimitePublicacion,
    antelacionDiasRequerida,
    canalesExigidos,
    contenidoMinimo,
    documentosObligatorios,
    ventanaDisponibilidad,
  };
}

// ================================================================
// Helper functions
// ================================================================

/**
 * calcularAntelacion — resolve effective advance notice requirement
 *
 * Defaults: SA=30d, SL=15d
 * Apply overrides from jerarquia_normativa
 */
function calcularAntelacion(
  tipoSocial: TipoSocial,
  packs: RulePack[],
  overrides: RuleParamOverride[]
): number {
  // Collect all rules from applicable packs
  const antelacionFromPacks = packs.map((pack) => pack.convocatoria.antelacionDias[tipoSocial]);

  if (antelacionFromPacks.length === 0) {
    // Fallback defaults
    return tipoSocial === 'SA' ? 30 : 15;
  }

  // Take the most restrictive (highest) value across all packs
  let maxAntelacion = antelacionFromPacks[0];

  for (const antelacion of antelacionFromPacks.slice(1)) {
    if (
      typeof antelacion.valor === 'number' &&
      typeof maxAntelacion.valor === 'number'
    ) {
      if (antelacion.valor > maxAntelacion.valor) {
        maxAntelacion = antelacion;
      }
    }
  }

  // Apply overrides using jerarquia_normativa
  const resolved = resolverReglaEfectiva(maxAntelacion, overrides, 'mayor');

  return typeof resolved.valor === 'number' ? resolved.valor : 30;
}

/**
 * calcularCanales — union of all required channels across packs
 */
function calcularCanales(
  input: ConvocatoriaInput,
  packs: RulePack[],
  overrides: RuleParamOverride[]
): string[] {
  const canalesSet = new Set<string>();

  for (const pack of packs) {
    const canalePack = pack.convocatoria.canales[input.tipoSocial];
    if (canalePack && Array.isArray(canalePack)) {
      canalePack.forEach((c) => canalesSet.add(c));
    }
  }

  // Apply overrides if any
  // Note: overrides for channels would be handled via union logic if provided

  return Array.from(canalesSet);
}

/**
 * calcularDocumentos — union of mandatory documents across packs
 */
function calcularDocumentos(
  input: ConvocatoriaInput,
  packs: RulePack[],
  overrides: RuleParamOverride[]
): Array<{ id: string; nombre: string; condicion?: string }> {
  const docsMap = new Map<string, { id: string; nombre: string; condicion?: string }>();

  for (const pack of packs) {
    const docsPack = pack.convocatoria.documentosObligatorios || [];
    for (const doc of docsPack) {
      if (!docsMap.has(doc.id)) {
        docsMap.set(doc.id, doc);
      }
    }
  }

  return Array.from(docsMap.values());
}

/**
 * calcularContenido — union of mandatory content across packs
 */
function calcularContenido(
  input: ConvocatoriaInput,
  packs: RulePack[],
  overrides: RuleParamOverride[]
): string[] {
  const contenidoSet = new Set<string>();

  for (const pack of packs) {
    const contenidoPack = pack.convocatoria.contenidoMinimo || [];
    contenidoPack.forEach((c) => contenidoSet.add(c));
  }

  // Always include "Orden del día" (mandatory per art. 182 LSC)
  contenidoSet.add('Orden del día');

  return Array.from(contenidoSet);
}

/**
 * restarDias — subtract days from ISO date string
 */
function restarDias(fechaJunta: string, dias: number): string {
  const date = new Date(fechaJunta);
  date.setDate(date.getDate() - dias);
  return date.toISOString().split('T')[0];
}

/**
 * createExplainNode — helper to create ExplainNode with proper typing
 */
function createExplainNode(
  regla: string,
  fuente: 'LEY' | 'ESTATUTOS' | 'PACTO_PARASOCIAL' | 'REGLAMENTO',
  referencia: string,
  resultado: EvalSeverity,
  mensaje: string,
  umbral?: number | string
): ExplainNode {
  return {
    regla,
    fuente,
    referencia,
    resultado,
    mensaje,
    ...(umbral !== undefined && { umbral }),
  };
}
