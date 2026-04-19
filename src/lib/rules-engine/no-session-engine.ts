// ============================================================
// Motor de Reglas LSC — No-Session Engine
// Spec: docs/superpowers/specs/2026-04-19-motor-reglas-lsc-secretaria-design.md §5
// ============================================================

import type {
  NoSessionInput,
  NoSessionOutput,
  RulePack,
  NoSessionRespuesta,
  NoSessionNotificacion,
  SentidoRespuesta,
  ExplainNode,
  EvalSeverity,
} from './types';

/**
 * evaluarProcesoSinSesion — 5-Gate Engine for no-session decision processes
 *
 * Gates:
 * 0. Habilitación (estatutos o reglamento)
 * 1. Materia admitida para modo sin sesión
 * 2. Notificación fehaciente (todos ENTREGADA)
 * 3. Ventana abierta (no cerrada, no anticipadamente cerrada)
 * 4. Condición de adopción (unanimidad SL / circulación consejo / socio único)
 *
 * Returns NoSessionOutput with gates array and overall ok/severity
 */
export function evaluarProcesoSinSesion(
  input: NoSessionInput,
  pack?: RulePack
): NoSessionOutput {
  const gatesResults: NoSessionOutput['gates'] = [];
  const explainNodes: ExplainNode[] = [];
  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  let overallOk = true;
  let overallSeverity: EvalSeverity = 'OK';

  // ================================================================
  // Gate 0: Habilitación
  // ================================================================
  const gateHabilitacion = evaluarHabilitacion(input, pack);
  gatesResults.push(gateHabilitacion);
  explainNodes.push(gateHabilitacion.explain[0]);

  if (gateHabilitacion.explain[0].resultado === 'BLOCKING') {
    blockingIssues.push('no_session_not_enabled');
    overallOk = false;
    overallSeverity = 'BLOCKING';
    return {
      ok: false,
      estado: 'CERRADO_FAIL',
      gates: gatesResults,
      explain: explainNodes,
      blocking_issues: blockingIssues,
      warnings,
    };
  }

  // ================================================================
  // Gate 1: Materia admitida
  // ================================================================
  const gateMateria = evaluarMateria(input, pack);
  gatesResults.push(gateMateria);
  explainNodes.push(gateMateria.explain[0]);

  if (gateMateria.explain[0].resultado === 'BLOCKING') {
    blockingIssues.push('materia_not_admitted');
    overallOk = false;
    overallSeverity = 'BLOCKING';
    return {
      ok: false,
      estado: 'CERRADO_FAIL',
      gates: gatesResults,
      explain: explainNodes,
      blocking_issues: blockingIssues,
      warnings,
    };
  }

  // ================================================================
  // Gate 2: Notificación fehaciente
  // ================================================================
  const gateNotificacion = evaluarNotificacion(input);
  gatesResults.push(gateNotificacion);
  explainNodes.push(...gateNotificacion.explain);

  if (gateNotificacion.explain.some(n => n.resultado === 'BLOCKING')) {
    blockingIssues.push(...gateNotificacion.explain
      .filter(n => n.resultado === 'BLOCKING')
      .map(n => `notificacion_${n.mensaje.toLowerCase().replace(/\s+/g, '_').substring(0, 30)}`));
    overallOk = false;
    overallSeverity = 'BLOCKING';
    return {
      ok: false,
      estado: 'CERRADO_FAIL',
      gates: gatesResults,
      explain: explainNodes,
      blocking_issues: blockingIssues,
      warnings,
    };
  }

  // ================================================================
  // Gate 3: Ventana de consentimiento
  // ================================================================
  const gateVentana = evaluarVentana(input);
  gatesResults.push(gateVentana);
  explainNodes.push(...gateVentana.explain);

  let cierreAnticipado = false;
  let motivoCierre = '';

  if (gateVentana.explain.some(n => n.resultado === 'BLOCKING')) {
    blockingIssues.push('window_closed');
    overallOk = false;
    overallSeverity = 'BLOCKING';
    cierreAnticipado = true;
    motivoCierre = 'Ventana cerrada sin alcanzar unanimidad/mayoría requerida';
    return {
      ok: false,
      estado: 'CERRADO_FAIL',
      gates: gatesResults,
      explain: explainNodes,
      blocking_issues: blockingIssues,
      warnings,
      cierreAnticipado,
      motivoCierre,
    };
  }

  // Check for early closure with unanimidad
  if (gateVentana.explain.some(n => n.mensaje.includes('Cierre anticipado'))) {
    cierreAnticipado = true;
    motivoCierre = 'Unanimidad alcanzada antes de fin de ventana';
  }

  // ================================================================
  // Gate 4: Condición de adopción
  // ================================================================
  const gateAdopcion = evaluarCondicionAdopcion(input);
  gatesResults.push(gateAdopcion);
  explainNodes.push(...gateAdopcion.explain);

  if (gateAdopcion.explain.some(n => n.resultado === 'BLOCKING')) {
    blockingIssues.push('adoption_condition_not_met');
    overallOk = false;
    overallSeverity = 'BLOCKING';

    const closedState = cierreAnticipado && motivoCierre
      ? 'CERRADO_FAIL'
      : 'ABIERTO';

    return {
      ok: false,
      estado: closedState as 'CERRADO_FAIL' | 'ABIERTO',
      gates: gatesResults,
      explain: explainNodes,
      blocking_issues: blockingIssues,
      warnings,
      cierreAnticipado,
      motivoCierre: motivoCierre || undefined,
    };
  }

  // QES Verification warnings
  const qesWarnings = verificarQESFirmas(input);
  warnings.push(...qesWarnings);

  // ================================================================
  // Final state
  // ================================================================
  const estado = overallOk ? 'CERRADO_OK' : 'CERRADO_FAIL';

  return {
    ok: overallOk,
    estado,
    gates: gatesResults,
    explain: explainNodes,
    blocking_issues: blockingIssues,
    warnings,
    cierreAnticipado: cierreAnticipado || undefined,
    motivoCierre: motivoCierre || undefined,
  };
}

// ================================================================
// Gate 0: Habilitación
// ================================================================

function evaluarHabilitacion(
  input: NoSessionInput,
  pack?: RulePack
): NoSessionOutput['gates'][0] {
  const explain: ExplainNode[] = [];

  if (input.organoTipo === 'JUNTA_GENERAL') {
    const habilitado = pack?.noSession?.habilitado_por_estatutos.valor ?? false;
    const resultado = habilitado ? 'OK' : 'BLOCKING';
    explain.push({
      regla: 'Habilitación por estatutos (Junta General)',
      fuente: 'ESTATUTOS',
      referencia: 'Estatutos de la sociedad',
      resultado,
      mensaje: habilitado
        ? 'Acuerdos sin sesión HABILITADOS por estatutos'
        : 'Acuerdos sin sesión NO HABILITADOS por estatutos',
    });
    return { gate: 'habilitacion', ok: habilitado, severity: resultado, explain };
  }

  if (input.organoTipo === 'CONSEJO') {
    const habilitado = pack?.noSession?.habilitado_por_reglamento.valor ?? false;
    const resultado = habilitado ? 'OK' : 'BLOCKING';
    explain.push({
      regla: 'Habilitación por reglamento (Consejo)',
      fuente: 'REGLAMENTO',
      referencia: 'Reglamento del Consejo',
      resultado,
      mensaje: habilitado
        ? 'Circulación HABILITADA por reglamento'
        : 'Circulación NO HABILITADA por reglamento',
    });
    return { gate: 'habilitacion', ok: habilitado, severity: resultado, explain };
  }

  explain.push({
    regla: 'Gate: Habilitación',
    fuente: 'LEY',
    resultado: 'OK',
    mensaje: `Órgano ${input.organoTipo} — procedimiento sin sesión aplicable`,
  });
  return { gate: 'habilitacion', ok: true, severity: 'OK', explain };
}

// ================================================================
// Gate 1: Materia admitida
// ================================================================

function evaluarMateria(
  input: NoSessionInput,
  pack?: RulePack
): NoSessionOutput['gates'][0] {
  const explain: ExplainNode[] = [];

  const admitted =
    pack?.modosAdopcionPermitidos.includes('NO_SESSION') ?? false;

  explain.push({
    regla: 'Materia admitida para modo sin sesión',
    fuente: 'ESTATUTOS',
    resultado: admitted ? 'OK' : 'BLOCKING',
    mensaje: admitted
      ? `Materia "${input.tipoProceso}" ADMITIDA para procedimiento sin sesión`
      : `Materia "${input.tipoProceso}" EXCLUIDA de procedimiento sin sesión`,
  });

  return { gate: 'materia', ok: admitted, severity: admitted ? 'OK' : 'BLOCKING', explain };
}

// ================================================================
// Gate 2: Notificación fehaciente
// ================================================================

function evaluarNotificacion(input: NoSessionInput): NoSessionOutput['gates'][0] {
  const explain: ExplainNode[] = [];
  let allDelivered = true;
  const pendienteCount = input.notificaciones.filter(n => n.estado !== 'ENTREGADA').length;

  if (pendienteCount > 0) {
    allDelivered = false;
    explain.push({
      regla: 'Notificación fehaciente',
      fuente: 'LEY',
      referencia: 'art. 625 LSC',
      resultado: 'BLOCKING',
      mensaje: `${pendienteCount} notificación(es) aún no ENTREGADA(S) (estado: ${input.notificaciones
        .filter(n => n.estado !== 'ENTREGADA')
        .map(n => n.estado)
        .join(', ')})`,
    });
  } else {
    explain.push({
      regla: 'Notificación fehaciente',
      fuente: 'LEY',
      referencia: 'art. 625 LSC',
      resultado: 'OK',
      mensaje: `Todas (${input.notificaciones.length}) notificaciones ENTREGADAS fehacientemente`,
    });
  }

  return {
    gate: 'notificacion',
    ok: allDelivered,
    severity: allDelivered ? 'OK' : 'BLOCKING',
    explain,
  };
}

// ================================================================
// Gate 3: Ventana de consentimiento
// ================================================================

export function evaluarVentana(input: NoSessionInput): NoSessionOutput['gates'][0] {
  const explain: ExplainNode[] = [];
  const ahora = new Date(input.ventana.ahora);
  const inicio = new Date(input.ventana.inicio);
  const fin = new Date(input.ventana.fin);

  // Window not yet open
  if (ahora < inicio) {
    explain.push({
      regla: 'Ventana de consentimiento',
      fuente: 'ESTATUTOS',
      resultado: 'BLOCKING',
      mensaje: `Ventana no abierta. Abre en: ${input.ventana.inicio}`,
    });
    return { gate: 'ventana', ok: false, severity: 'BLOCKING', explain };
  }

  // Window naturally closed
  if (ahora > fin) {
    const respuestasCount = input.respuestas.length;
    const consentimientos = input.respuestas.filter(r => r.sentido === 'CONSENTIMIENTO').length;

    // Check for unanimidad
    const unanimidad = respuestasCount > 0 && consentimientos === respuestasCount;

    if (unanimidad) {
      explain.push({
        regla: 'Ventana cerrada con unanimidad',
        fuente: 'ESTATUTOS',
        resultado: 'OK',
        mensaje: `Ventana expirada pero UNANIMIDAD alcanzada: ${consentimientos}/${respuestasCount} consienten`,
      });
      return { gate: 'ventana', ok: true, severity: 'OK', explain };
    }

    explain.push({
      regla: 'Ventana de consentimiento',
      fuente: 'ESTATUTOS',
      resultado: 'BLOCKING',
      mensaje: `Ventana cerrada sin unanimidad: ${consentimientos}/${respuestasCount} consienten. Cierre: ${input.ventana.fin}`,
    });
    return { gate: 'ventana', ok: false, severity: 'BLOCKING', explain };
  }

  // Window open, check for early closure
  const respuestas = input.respuestas;
  const consentimientos = respuestas.filter(r => r.sentido === 'CONSENTIMIENTO').length;
  const objeciones = respuestas.filter(r => r.sentido === 'OBJECION').length;
  const objecionesProcedimiento = respuestas.filter(
    r => r.sentido === 'OBJECION_PROCEDIMIENTO'
  ).length;
  const respuestasCount = respuestas.length;

  // Para CONSEJO, una objeción procedimiento impide cierre anticipado
  if (input.organoTipo === 'CONSEJO' && objecionesProcedimiento > 0) {
    explain.push({
      regla: 'Objeción de procedimiento',
      fuente: 'ESTATUTOS',
      resultado: 'BLOCKING',
      mensaje: `Cierre anticipado RECHAZADO: ${objecionesProcedimiento} consejero(s) objetan procedimiento escrito`,
    });
    return { gate: 'ventana', ok: false, severity: 'BLOCKING', explain };
  }

  // Para SL UNANIMIDAD_ESCRITA, todos deben consentir
  if (
    input.tipoSocial === 'SL' &&
    input.condicionAdopcion === 'UNANIMIDAD_CAPITAL'
  ) {
    const todosConsienten = respuestasCount === consentimientos && respuestasCount > 0;
    if (todosConsienten) {
      explain.push({
        regla: 'Cierre anticipado por unanimidad',
        fuente: 'ESTATUTOS',
        resultado: 'OK',
        mensaje: `Cierre anticipado PERMITIDO: todos (${respuestasCount}) consienten antes de fin de ventana`,
      });
      return { gate: 'ventana', ok: true, severity: 'OK', explain };
    }
  }

  // Ventana abierta, no early closure conditions met
  explain.push({
    regla: 'Ventana abierta',
    fuente: 'ESTATUTOS',
    resultado: 'OK',
    mensaje: `Ventana en progreso. Respuestas: ${consentimientos}C, ${objeciones}X, ${respuestasCount} total. Cierra: ${input.ventana.fin}`,
  });

  return { gate: 'ventana', ok: true, severity: 'OK', explain };
}

// ================================================================
// Gate 4: Condición de adopción
// ================================================================

function evaluarCondicionAdopcion(input: NoSessionInput): NoSessionOutput['gates'][0] {
  const explain: ExplainNode[] = [];

  switch (input.condicionAdopcion) {
    case 'UNANIMIDAD_CAPITAL': {
      const result = evaluarUnanimidadCapitalSL(input);
      explain.push(...result.explain);
      return {
        gate: 'adopcion',
        ok: result.ok,
        severity: result.severity,
        explain,
      };
    }

    case 'UNANIMIDAD_CONSEJEROS': {
      const result = evaluarCirculacionConsejo(input);
      explain.push(...result.explain);
      return {
        gate: 'adopcion',
        ok: result.ok,
        severity: result.severity,
        explain,
      };
    }

    case 'DECISION_UNICA': {
      const result = evaluarDecisionSocioUnico(input);
      explain.push(...result.explain);
      return {
        gate: 'adopcion',
        ok: result.ok,
        severity: result.severity,
        explain,
      };
    }

    case 'MAYORIA_CONSEJEROS_ESCRITA': {
      const result = evaluarCirculacionConsejo(input);
      explain.push(...result.explain);
      return {
        gate: 'adopcion',
        ok: result.ok,
        severity: result.severity,
        explain,
      };
    }

    default:
      explain.push({
        regla: 'Condición de adopción desconocida',
        fuente: 'LEY',
        resultado: 'BLOCKING',
        mensaje: `Condición ${input.condicionAdopcion} no soportada`,
      });
      return { gate: 'adopcion', ok: false, severity: 'BLOCKING', explain };
  }
}

// ================================================================
// Unanimidad Capital SL
// ================================================================

export function evaluarUnanimidadCapitalSL(input: NoSessionInput): {
  ok: boolean;
  severity: EvalSeverity;
  explain: ExplainNode[];
} {
  const explain: ExplainNode[] = [];
  const respuestas = input.respuestas;
  const consentimientos = respuestas.filter(r => r.sentido === 'CONSENTIMIENTO');
  const capitalConsentido = consentimientos.reduce((sum, r) => sum + r.capital_participacion, 0);
  const capital100 = Math.abs(capitalConsentido - input.totalCapitalSocial) < 0.01;

  // Check: all must consent
  const todosConsienten =
    respuestas.length > 0 &&
    respuestas.every(r => r.sentido === 'CONSENTIMIENTO');

  if (!todosConsienten) {
    const noConsienten = respuestas.filter(r => r.sentido !== 'CONSENTIMIENTO');
    explain.push({
      regla: 'Unanimidad de capital (SL)',
      fuente: 'LEY',
      referencia: 'art. 629 LSC',
      resultado: 'BLOCKING',
      mensaje: `NO UNANIMIDAD: ${noConsienten.length} socio(s) no consiente(n) (${noConsienten
        .map(r => r.sentido)
        .join(', ')})`,
    });
    return { ok: false, severity: 'BLOCKING', explain };
  }

  if (!capital100) {
    explain.push({
      regla: 'Capital consentido = 100%',
      fuente: 'LEY',
      referencia: 'art. 629 LSC',
      resultado: 'BLOCKING',
      mensaje: `Capital consentido: ${(capitalConsentido / input.totalCapitalSocial * 100).toFixed(2)}% (debe ser 100%)`,
    });
    return { ok: false, severity: 'BLOCKING', explain };
  }

  explain.push({
    regla: 'Unanimidad de capital',
    fuente: 'LEY',
    referencia: 'art. 629 LSC',
    resultado: 'OK',
    mensaje: `Unanimidad alcanzada: ${consentimientos.length} socios consienten 100% del capital`,
  });

  return { ok: true, severity: 'OK', explain };
}

// ================================================================
// Circulación Consejo (Mayoría o sin objeción procedimiento)
// ================================================================

export function evaluarCirculacionConsejo(input: NoSessionInput): {
  ok: boolean;
  severity: EvalSeverity;
  explain: ExplainNode[];
} {
  const explain: ExplainNode[] = [];
  const respuestas = input.respuestas;
  const consentimientos = respuestas.filter(r => r.sentido === 'CONSENTIMIENTO').length;
  const objeciones = respuestas.filter(r => r.sentido === 'OBJECION').length;
  const objecionesProcedimiento = respuestas.filter(
    r => r.sentido === 'OBJECION_PROCEDIMIENTO'
  ).length;

  // Level 1: objeción de procedimiento bloquea
  if (objecionesProcedimiento > 0) {
    explain.push({
      regla: 'Objeción de procedimiento',
      fuente: 'ESTATUTOS',
      resultado: 'BLOCKING',
      mensaje: `Circulación rechazada: ${objecionesProcedimiento} consejero(s) objetan el procedimiento escrito`,
    });
    return { ok: false, severity: 'BLOCKING', explain };
  }

  // Level 2: among respuestas, mayoría de CONSENTIMIENTO > OBJECION
  if (respuestas.length === 0) {
    explain.push({
      regla: 'Sin respuestas',
      fuente: 'ESTATUTOS',
      resultado: 'BLOCKING',
      mensaje: 'Ningún consejero ha respondido',
    });
    return { ok: false, severity: 'BLOCKING', explain };
  }

  const mayoriaAlcanzada = consentimientos > objeciones;

  if (!mayoriaAlcanzada) {
    explain.push({
      regla: 'Mayoría de consentimientos',
      fuente: 'ESTATUTOS',
      resultado: 'BLOCKING',
      mensaje: `Mayoría NO alcanzada: ${consentimientos} consienten vs ${objeciones} objetan`,
    });
    return { ok: false, severity: 'BLOCKING', explain };
  }

  // Participation quorum (50% of total)
  const participationPct = respuestas.length / input.totalDestinatarios;
  const quorumParticipacion = participationPct >= 0.5;

  if (!quorumParticipacion) {
    explain.push({
      regla: 'Quórum de participación (≥50%)',
      fuente: 'ESTATUTOS',
      resultado: 'WARNING',
      mensaje: `Participación baja: ${(participationPct * 100).toFixed(0)}% (${respuestas.length}/${input.totalDestinatarios})`,
    });
  }

  explain.push({
    regla: 'Mayoría de consentimientos',
    fuente: 'ESTATUTOS',
    resultado: 'OK',
    mensaje: `Mayoría alcanzada: ${consentimientos} consienten > ${objeciones} objetan (participación: ${(participationPct * 100).toFixed(0)}%)`,
  });

  return { ok: true, severity: quorumParticipacion ? 'OK' : 'WARNING', explain };
}

// ================================================================
// Decisión Socio Único
// ================================================================

export function evaluarDecisionSocioUnico(input: NoSessionInput): {
  ok: boolean;
  severity: EvalSeverity;
  explain: ExplainNode[];
} {
  const explain: ExplainNode[] = [];

  // Must be consignada
  if (!input.decisionConsignada) {
    explain.push({
      regla: 'Decisión consignada',
      fuente: 'LEY',
      referencia: 'art. 629/210 LSC',
      resultado: 'BLOCKING',
      mensaje: 'Decisión unipersonal debe consignarse en acta',
    });
    return { ok: false, severity: 'BLOCKING', explain };
  }

  // Must have 1 respuesta with CONSENTIMIENTO
  const consentimientos = input.respuestas.filter(r => r.sentido === 'CONSENTIMIENTO');

  if (consentimientos.length === 0) {
    explain.push({
      regla: 'Consentimiento del socio único',
      fuente: 'LEY',
      resultado: 'BLOCKING',
      mensaje: 'Socio único debe dar consentimiento',
    });
    return { ok: false, severity: 'BLOCKING', explain };
  }

  explain.push({
    regla: 'Decisión consignada con consentimiento',
    fuente: 'LEY',
    referencia: 'art. 629/210 LSC',
    resultado: 'OK',
    mensaje: 'Decisión consignada y consentimiento dado',
  });

  return { ok: true, severity: 'OK', explain };
}

// ================================================================
// QES Verification (warnings only)
// ================================================================

function verificarQESFirmas(input: NoSessionInput): string[] {
  const warnings: string[] = [];

  const sinFirma = input.respuestas.filter(r => r.sentido === 'CONSENTIMIENTO' && !r.firma_qes_ref);

  if (sinFirma.length > 0) {
    warnings.push(
      `${sinFirma.length} socio(s)/consejero(s) consienten pero no disponen de firma QES (considerar requerir)`
    );
  }

  return warnings;
}
