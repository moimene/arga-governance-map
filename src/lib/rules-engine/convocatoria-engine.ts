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
  //
  // Dispatch por organoTipo: las juntas (JGA/JGE) aplican LSC art. 176;
  // los consejos / comisiones aplican estatutos o reglamento ("razonable" —
  // LSC art. 246.2 para CdA). Sin este dispatch, un CdA recibía la
  // antelación de junta (30 días para SA) — bug operativo.
  // ================================================================
  const antelacionDiasRequerida = calcularAntelacion(
    input.tipoSocial,
    input.organoTipo,
    packs,
    overrides
  );
  const fechaLimitePublicacion = restarDias(
    input.fechaJunta,
    antelacionDiasRequerida
  );

  const organoTipoUpper = (input.organoTipo ?? 'JGA').toUpperCase();
  const isJunta = organoTipoUpper === 'JGA' || organoTipoUpper === 'JGE' || organoTipoUpper.includes('JUNTA');
  explainNodes.push(
    createExplainNode(
      'Antelación requerida',
      // Jerarquía documentada: LEY → ESTATUTOS → REGLAMENTO → ACUERDO.
      // Para juntas el plazo viene de LSC art. 176. Para CdA / comisiones el
      // plazo lo fija el reglamento del órgano (art. 246.2 LSC habla de
      // "convocatoria razonable" — el detalle está en el reglamento del
      // consejo, no en estatutos). La enum `Fuente` (types.ts) ya distingue.
      isJunta ? 'LEY' : 'REGLAMENTO',
      isJunta ? 'art. 176 LSC' : 'art. 246.2 LSC / reglamento del órgano',
      'OK',
      isJunta
        ? `${antelacionDiasRequerida} días de antelación requeridos para ${input.tipoSocial} (junta)`
        : `${antelacionDiasRequerida} días de antelación para ${organoTipoUpper} (default reglamento del órgano; override por rule_pack)`,
      antelacionDiasRequerida
    )
  );

  // ================================================================
  // Rule 2: Canales — publicación pública SÓLO para juntas (LSC art. 173,
  //         179). Los consejos / comisiones se NOTIFICAN al miembro
  //         (art. 246 LSC) por canales directos: email, correo certificado,
  //         ERDS, burofax. Sin este guard, una convocatoria de CdA en SA
  //         cotizada con web inscrita recibía WEB_SOCIEDAD como canal
  //         exigido y el filtro de la UI (CHANNELS_RELEVANT_BY_BODY_TYPE)
  //         lo ocultaba → reminder perpetuo "CHANNEL_REMINDER" falso
  //         (Codex P2 PR #3).
  // ================================================================
  let canalesExigidos = calcularCanales(input, packs, overrides);

  // Codex P2 round 7: filtrar canales abstractos del rule_pack que no
  // tienen counterpart concreto seleccionable en la UI. Los packs de
  // CONSEJO usan códigos genéricos tipo `CONVOCATORIA_CONSEJO` o
  // `NOTIFICACION_GENERICA`, pero Paso 5 sólo ofrece EMAIL_SIMPLE,
  // CORREO_CERTIFICADO, ERDS, BUROFAX. `channelSatisfiesReminder()` no
  // los reconoce como equivalentes → reminder perpetuamente pending.
  // Para órganos NO junta, eliminamos los códigos abstractos del
  // contrato de reminders.
  //
  // Codex P2 round 15: si tras filtrar quedan CERO canales para non-
  // junta, garantizamos al menos un canal concreto (ERDS — preferido
  // por trazabilidad QTSP + acuse legal) para que el reminder dispare
  // y el secretario tenga que confirmar al menos un canal de
  // notificación directa al miembro. Sin esto, una convocatoria CdA
  // con pack que sólo trae códigos abstractos podía emitirse sin
  // canales y sin reminder, contradiciendo el explain node "art. 246
  // LSC: notificación individual obligatoria".
  if (!isJunta) {
    const ABSTRACT_NON_JUNTA_CODES = new Set([
      'CONVOCATORIA_CONSEJO',
      'CONVOCATORIA_COMISION',
      'CONVOCATORIA_COMITE',
      'NOTIFICACION_GENERICA',
      'NOTIFICACION_DIRECTA',
    ]);
    canalesExigidos = canalesExigidos.filter((c) => !ABSTRACT_NON_JUNTA_CODES.has(c));
    if (canalesExigidos.length === 0) {
      // Codex P2 round 17 PR #3: el fallback debe ser un canal que la UI
      // de la jurisdicción del tenant SÍ ofrezca y `channelSatisfiesReminder`
      // pueda mapear a algo seleccionable. ERDS funciona en ES/PT/MX (con
      // QTSP) pero no aparece en CHANNEL_OPTIONS.BR → CdA brasileño con
      // pack abstracto quedaba con reminder eterno tras EMAIL_SIMPLE.
      const jurisdictionUpper = (input.jurisdiction ?? 'ES').toUpperCase();
      const FALLBACK_NON_JUNTA: Record<string, string> = {
        ES: 'ERDS',           // EAD Trust QTSP — preferido por trazabilidad
        PT: 'ERDS',           // misma cobertura QTSP eIDAS
        MX: 'CORREO_CERTIFICADO', // QTSP no obligatorio; correo certificado equivalente
        BR: 'EMAIL_SIMPLE',   // único canal directo en CHANNEL_OPTIONS.BR
      };
      const fallback = FALLBACK_NON_JUNTA[jurisdictionUpper] ?? 'EMAIL_SIMPLE';
      canalesExigidos.push(fallback);
      explainNodes.push(
        createExplainNode(
          `Canales: fallback ${fallback} para notificación directa`,
          'SISTEMA',
          'art. 246 LSC + Codex round 15/17',
          'OK',
          `${organoTipoUpper} (${jurisdictionUpper}): rule_pack sólo declaraba códigos abstractos; se exige ${fallback} como mínimo concreto disponible en la UI de la jurisdicción.`,
          undefined
        )
      );
    }
  }

  if (isJunta && input.tipoSocial === 'SA' && !input.webInscrita) {
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
        'art. 173 LSC',
        'OK',
        'SA sin web inscrita debe publicar en BORME + diario oficial',
        undefined
      )
    );
  }

  if (isJunta && input.tipoSocial === 'SA' && input.webInscrita) {
    if (!canalesExigidos.includes('WEB_SOCIEDAD')) {
      canalesExigidos.push('WEB_SOCIEDAD');
    }
    explainNodes.push(
      createExplainNode(
        'Canales: SA con web inscrita',
        'LEY',
        'art. 173 LSC',
        'OK',
        'SA con web inscrita debe publicar en web de la sociedad',
        undefined
      )
    );
  }

  if (!isJunta) {
    explainNodes.push(
      createExplainNode(
        'Canales: notificación directa al miembro',
        'LEY',
        'art. 246 LSC / reglamento del órgano',
        'OK',
        `${organoTipoUpper}: no aplica publicación pública (BORME, web). Notificación individual a cada miembro (email/correo certificado/ERDS/burofax).`,
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
      'arts. 196-197 y 272 LSC (según materia)',
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
      'art. 174 LSC',
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
      'arts. 196-197 y 272.2 LSC',
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
 * Despachado por organoTipo:
 * - JGA/JGE (juntas): LSC art. 176 → SA=30, SL=15 (override via rule_pack)
 * - CDA: LSC art. 246.2 "razonable" → default 5d (override via rule_pack)
 * - COMISION / COMISION_DELEGADA / COMITE: estatutos / reglamento → default 3d
 *
 * Apply overrides from jerarquia_normativa.
 */
function calcularAntelacion(
  tipoSocial: TipoSocial,
  organoTipo: string | undefined,
  packs: RulePack[],
  overrides: RuleParamOverride[]
): number {
  // Defaults por órgano cuando no hay pack aplicable.
  const organoUpper = (organoTipo ?? 'JGA').toUpperCase();
  const isJunta = organoUpper === 'JGA' || organoUpper === 'JGE' || organoUpper.includes('JUNTA');
  const isConsejo = !isJunta && (organoUpper === 'CDA' || organoUpper.includes('CONSEJO'));
  const isComision = !isJunta && !isConsejo &&
    (organoUpper.includes('COMISION') || organoUpper.includes('COMITE'));

  const defaultForOrgano = (): number => {
    if (isJunta) return tipoSocial === 'SA' ? 30 : 15;
    if (isConsejo) return 5;
    if (isComision) return 3;
    return 5;
  };

  // Collect all rules from applicable packs
  const antelacionFromPacks = packs
    .map((pack) => pack.convocatoria.antelacionDias[tipoSocial])
    .filter((entry) => entry !== undefined && entry !== null);

  if (antelacionFromPacks.length === 0) {
    return defaultForOrgano();
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

  // ITEM-005: solo overrides de clave de ANTELACIÓN. resolveRulePackForMatter
  // filtra por materia pero no por clave, y el modo 'mayor' aplicaba cualquier
  // override numérico superior (p.ej. constitucion_quorum_pct=33 inflaba la
  // antelación de 30 a 33 días). Espejo del patrón isQuorumOverride de
  // constitucion-engine.
  const antelacionOverrides = overrides.filter((override) =>
    String(override.clave ?? '').toUpperCase().includes('ANTELACION')
  );
  const resolved = resolverReglaEfectiva(maxAntelacion, antelacionOverrides, 'mayor');

  if (typeof resolved.valor === 'number') return resolved.valor;
  return defaultForOrgano();
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

  // Always include "Orden del día" (mandatory per art. 174 LSC)
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
  fuente: 'LEY' | 'ESTATUTOS' | 'PACTO_PARASOCIAL' | 'REGLAMENTO' | 'SISTEMA',
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
