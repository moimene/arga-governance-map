// ============================================================
// Motor de Evaluación de Pactos Parasociales — MVP (3 cláusulas)
// Spec: Plan Maestro Sprint D — D4
// ============================================================
//
// Veredicto PARALELO e INDEPENDIENTE del resultado societario:
// - El motor LSC determina si el acuerdo es PROCLAMABLE (validez legal)
// - Este motor determina si hay INCUMPLIMIENTO de pactos parasociales
// - Un acuerdo puede ser proclamable pero incumplir un pacto (o viceversa)
//
// 3 tipos MVP:
// 1. VETO — titular tiene derecho de bloqueo sobre materias específicas
// 2. MAYORIA_REFORZADA_PACTADA — umbral superior al legal
// 3. CONSENTIMIENTO_INVERSOR — requiere consentimiento previo escrito
// ============================================================

import type { ExplainNode, EvalSeverity, Fuente } from './types';

// ─── Types ──────────────────────────────────────────────────────────────────

export type TipoPacto =
  | 'VETO'
  | 'MAYORIA_REFORZADA_PACTADA'
  | 'CONSENTIMIENTO_INVERSOR'
  | 'TAG_ALONG'
  | 'DRAG_ALONG'
  | 'LOCK_UP'
  | 'SINDICACION_VOTO';

export interface PactoParasocial {
  id: string;
  titulo: string;
  tipo_clausula: TipoPacto;
  descripcion?: string;
  firmantes: Array<{
    nombre: string;
    tipo: string;
    capital_pct: number;
    via?: string;
  }>;
  materias_aplicables: string[];
  umbral_activacion?: number;        // fracción (0.75 = 75%)
  capital_minimo_pct?: number;       // porcentaje requerido
  titular_veto?: string;
  condicion_detallada?: string;
  estado: 'VIGENTE' | 'SUSPENDIDO' | 'EXPIRADO' | 'RESUELTO';
  documento_ref?: string;
}

export interface PactosEvalInput {
  materias: string[];                 // materias del acuerdo propuesto
  capitalPresente: number;            // capital presente/representado en la sesión
  capitalTotal: number;               // capital social total
  votosFavor: number;                 // votos a favor (capital)
  votosContra: number;                // votos en contra (capital)
  consentimientosPrevios: string[];   // IDs de pactos con consentimiento obtenido
  vetoRenunciado: string[];           // IDs de pactos donde el titular renunció al veto
}

export interface PactoEvalResult {
  pacto_id: string;
  pacto_titulo: string;
  tipo: TipoPacto;
  aplica: boolean;
  cumple: boolean;
  severity: EvalSeverity;
  explain: ExplainNode;
}

export interface PactosEvalOutput {
  pacto_ok: boolean;                  // true si todos cumplen o no aplican
  pactos_evaluados: number;
  pactos_aplicables: number;
  pactos_cumplidos: number;
  pactos_incumplidos: number;
  resultados: PactoEvalResult[];
  explain: ExplainNode[];
  blocking_issues: string[];
  warnings: string[];
}

// ─── Evaluador principal ────────────────────────────────────────────────────

/**
 * Evalúa todos los pactos parasociales vigentes contra un acuerdo propuesto.
 *
 * Produce un veredicto PARALELO al motor LSC:
 * - pacto_ok = true → ningún pacto incumplido
 * - pacto_ok = false → al menos un pacto incumplido (BLOCKING)
 *
 * Los pactos no vigentes se ignoran silenciosamente.
 */
export function evaluarPactosParasociales(
  pactos: PactoParasocial[],
  input: PactosEvalInput
): PactosEvalOutput {
  const resultados: PactoEvalResult[] = [];
  const explain: ExplainNode[] = [];
  const blockingIssues: string[] = [];
  const warnings: string[] = [];

  // Filtrar solo pactos vigentes
  const vigentes = pactos.filter(p => p.estado === 'VIGENTE');

  for (const pacto of vigentes) {
    let result: PactoEvalResult;

    switch (pacto.tipo_clausula) {
      case 'VETO':
        result = evaluarVeto(pacto, input);
        break;
      case 'MAYORIA_REFORZADA_PACTADA':
        result = evaluarMayoriaReforzada(pacto, input);
        break;
      case 'CONSENTIMIENTO_INVERSOR':
        result = evaluarConsentimientoInversor(pacto, input);
        break;
      case 'TAG_ALONG':
      case 'DRAG_ALONG':
      case 'SINDICACION_VOTO':
        result = evaluarPactoWarningOnly(pacto, input);
        break;
      default:
        // Tipos no implementados en MVP (TAG_ALONG, etc.)
        result = {
          pacto_id: pacto.id,
          pacto_titulo: pacto.titulo,
          tipo: pacto.tipo_clausula,
          aplica: false,
          cumple: true,
          severity: 'OK',
          explain: {
            regla: `pacto_${pacto.tipo_clausula.toLowerCase()}_no_implementado`,
            fuente: 'PACTO_PARASOCIAL',
            resultado: 'OK',
            mensaje: `Tipo de pacto ${pacto.tipo_clausula} no evaluado en MVP — se ignora.`,
          },
        };
        break;
    }

    resultados.push(result);
    explain.push(result.explain);

    if (result.severity === 'BLOCKING') {
      blockingIssues.push(
        `PACTO INCUMPLIDO: ${pacto.titulo} (${pacto.tipo_clausula})`
      );
    } else if (result.severity === 'WARNING') {
      warnings.push(
        `PACTO ADVERTENCIA: ${pacto.titulo} — ${result.explain.mensaje}`
      );
    }
  }

  const aplicables = resultados.filter(r => r.aplica);
  const cumplidos = aplicables.filter(r => r.cumple);
  const incumplidos = aplicables.filter(r => !r.cumple);

  return {
    pacto_ok: incumplidos.length === 0,
    pactos_evaluados: vigentes.length,
    pactos_aplicables: aplicables.length,
    pactos_cumplidos: cumplidos.length,
    pactos_incumplidos: incumplidos.length,
    resultados,
    explain,
    blocking_issues: blockingIssues,
    warnings,
  };
}

// ─── Evaluador: pactos warning-only ─────────────────────────────────────────

function evaluarPactoWarningOnly(
  pacto: PactoParasocial,
  input: PactosEvalInput
): PactoEvalResult {
  const fuente: Fuente = 'PACTO_PARASOCIAL';
  const materiasCoincidentes = input.materias.filter(m =>
    pacto.materias_aplicables.includes(m)
  );

  if (materiasCoincidentes.length === 0) {
    return {
      pacto_id: pacto.id,
      pacto_titulo: pacto.titulo,
      tipo: pacto.tipo_clausula,
      aplica: false,
      cumple: true,
      severity: 'OK',
      explain: {
        regla: `pacto_${pacto.tipo_clausula.toLowerCase()}_no_aplica`,
        fuente,
        referencia: pacto.documento_ref,
        resultado: 'OK',
        mensaje: `Pacto ${pacto.tipo_clausula} no aplica a las materias del acuerdo.`,
      },
    };
  }

  const mensaje = pacto.tipo_clausula === 'SINDICACION_VOTO'
    ? 'Pacto de sindicacion de voto activo: revisar sentido de voto; advertencia contractual sin bloqueo societario.'
    : 'Pacto de arrastre/acompanamiento activo en transmision: revisar derechos contractuales; no bloquea el asiento societario.';

  return {
    pacto_id: pacto.id,
    pacto_titulo: pacto.titulo,
    tipo: pacto.tipo_clausula,
    aplica: true,
    cumple: true,
    severity: 'WARNING',
    explain: {
      regla: `pacto_${pacto.tipo_clausula.toLowerCase()}_warning`,
      fuente,
      referencia: pacto.documento_ref,
      resultado: 'WARNING',
      mensaje: `${mensaje} Materias afectadas: ${materiasCoincidentes.join(', ')}.`,
    },
  };
}

// ─── Evaluador: VETO ────────────────────────────────────────────────────────

function evaluarVeto(
  pacto: PactoParasocial,
  input: PactosEvalInput
): PactoEvalResult {
  const fuente: Fuente = 'PACTO_PARASOCIAL';

  // Comprobar si alguna materia del acuerdo está en las materias del pacto
  const materiasCoincidentes = input.materias.filter(m =>
    pacto.materias_aplicables.includes(m)
  );

  if (materiasCoincidentes.length === 0) {
    return {
      pacto_id: pacto.id,
      pacto_titulo: pacto.titulo,
      tipo: 'VETO',
      aplica: false,
      cumple: true,
      severity: 'OK',
      explain: {
        regla: 'veto_no_aplica',
        fuente,
        referencia: pacto.documento_ref,
        resultado: 'OK',
        mensaje: `Derecho de veto de ${pacto.titular_veto} no aplica — materias del acuerdo (${input.materias.join(', ')}) no coinciden con materias protegidas (${pacto.materias_aplicables.join(', ')}).`,
      },
    };
  }

  // Aplica — verificar si el veto fue renunciado
  const renunciado = input.vetoRenunciado.includes(pacto.id);

  if (renunciado) {
    return {
      pacto_id: pacto.id,
      pacto_titulo: pacto.titulo,
      tipo: 'VETO',
      aplica: true,
      cumple: true,
      severity: 'OK',
      explain: {
        regla: 'veto_renunciado',
        fuente,
        referencia: pacto.documento_ref,
        resultado: 'OK',
        mensaje: `${pacto.titular_veto} ha renunciado al derecho de veto para esta operación. Materias afectadas: ${materiasCoincidentes.join(', ')}.`,
      },
    };
  }

  // Veto activo y no renunciado → BLOCKING
  return {
    pacto_id: pacto.id,
    pacto_titulo: pacto.titulo,
    tipo: 'VETO',
    aplica: true,
    cumple: false,
    severity: 'BLOCKING',
    explain: {
      regla: 'veto_activo',
      fuente,
      referencia: pacto.documento_ref,
      resultado: 'BLOCKING',
      mensaje: `VETO ACTIVO: ${pacto.titular_veto} tiene derecho de veto sobre las materias ${materiasCoincidentes.join(', ')}. ${pacto.condicion_detallada ?? 'Se requiere consentimiento escrito previo.'} Sin renuncia expresa, el acuerdo incumple el pacto parasocial.`,
      hijos: [
        {
          regla: 'veto_materias_afectadas',
          fuente,
          resultado: 'BLOCKING',
          mensaje: `Materias protegidas coincidentes: ${materiasCoincidentes.join(', ')}`,
        },
        {
          regla: 'veto_titular',
          fuente,
          resultado: 'BLOCKING',
          mensaje: `Titular: ${pacto.titular_veto} — capital: ${pacto.firmantes.map(f => `${f.nombre} (${f.capital_pct}%)`).join(', ')}`,
        },
      ],
    },
  };
}

// ─── Evaluador: MAYORIA_REFORZADA_PACTADA ───────────────────────────────────

function evaluarMayoriaReforzada(
  pacto: PactoParasocial,
  input: PactosEvalInput
): PactoEvalResult {
  const fuente: Fuente = 'PACTO_PARASOCIAL';

  // Comprobar si alguna materia aplica
  const materiasCoincidentes = input.materias.filter(m =>
    pacto.materias_aplicables.includes(m)
  );

  if (materiasCoincidentes.length === 0) {
    return {
      pacto_id: pacto.id,
      pacto_titulo: pacto.titulo,
      tipo: 'MAYORIA_REFORZADA_PACTADA',
      aplica: false,
      cumple: true,
      severity: 'OK',
      explain: {
        regla: 'mayoria_pactada_no_aplica',
        fuente,
        referencia: pacto.documento_ref,
        resultado: 'OK',
        mensaje: `Mayoría reforzada pactada no aplica — materias del acuerdo no coinciden con materias protegidas.`,
      },
    };
  }

  // Evaluar umbral pactado
  const umbral = pacto.umbral_activacion ?? 0;
  const capitalVotante = input.capitalPresente;
  const porcentajeFavor = capitalVotante > 0
    ? input.votosFavor / capitalVotante
    : 0;

  const cumple = porcentajeFavor >= umbral;

  return {
    pacto_id: pacto.id,
    pacto_titulo: pacto.titulo,
    tipo: 'MAYORIA_REFORZADA_PACTADA',
    aplica: true,
    cumple,
    severity: cumple ? 'OK' : 'BLOCKING',
    explain: {
      regla: 'mayoria_pactada_evaluacion',
      fuente,
      referencia: pacto.documento_ref,
      umbral,
      valor: porcentajeFavor,
      resultado: cumple ? 'OK' : 'BLOCKING',
      mensaje: cumple
        ? `Mayoría pactada alcanzada: ${(porcentajeFavor * 100).toFixed(1)}% a favor ≥ ${(umbral * 100).toFixed(0)}% requerido. Materias: ${materiasCoincidentes.join(', ')}.`
        : `MAYORÍA PACTADA NO ALCANZADA: ${(porcentajeFavor * 100).toFixed(1)}% a favor < ${(umbral * 100).toFixed(0)}% requerido por pacto parasocial. Materias: ${materiasCoincidentes.join(', ')}. ${pacto.condicion_detallada ?? ''}`,
      hijos: [
        {
          regla: 'mayoria_pactada_cifras',
          fuente,
          resultado: cumple ? 'OK' : 'BLOCKING',
          mensaje: `Votos a favor: ${input.votosFavor} / Capital presente: ${capitalVotante} = ${(porcentajeFavor * 100).toFixed(1)}% — Umbral pactado: ${(umbral * 100).toFixed(0)}%`,
        },
      ],
    },
  };
}

// ─── Evaluador: CONSENTIMIENTO_INVERSOR ─────────────────────────────────────

function evaluarConsentimientoInversor(
  pacto: PactoParasocial,
  input: PactosEvalInput
): PactoEvalResult {
  const fuente: Fuente = 'PACTO_PARASOCIAL';

  // Comprobar si alguna materia aplica
  const materiasCoincidentes = input.materias.filter(m =>
    pacto.materias_aplicables.includes(m)
  );

  if (materiasCoincidentes.length === 0) {
    return {
      pacto_id: pacto.id,
      pacto_titulo: pacto.titulo,
      tipo: 'CONSENTIMIENTO_INVERSOR',
      aplica: false,
      cumple: true,
      severity: 'OK',
      explain: {
        regla: 'consentimiento_no_aplica',
        fuente,
        referencia: pacto.documento_ref,
        resultado: 'OK',
        mensaje: `Consentimiento inversor no aplica — materias del acuerdo no coinciden con materias protegidas.`,
      },
    };
  }

  // Verificar si se obtuvo consentimiento previo
  const consentimientoObtenido = input.consentimientosPrevios.includes(pacto.id);

  if (consentimientoObtenido) {
    return {
      pacto_id: pacto.id,
      pacto_titulo: pacto.titulo,
      tipo: 'CONSENTIMIENTO_INVERSOR',
      aplica: true,
      cumple: true,
      severity: 'OK',
      explain: {
        regla: 'consentimiento_obtenido',
        fuente,
        referencia: pacto.documento_ref,
        resultado: 'OK',
        mensaje: `Consentimiento inversor obtenido de ${pacto.titular_veto ?? 'accionistas requeridos'}. Materias: ${materiasCoincidentes.join(', ')}.`,
      },
    };
  }

  // No obtenido → WARNING (no BLOCKING, porque el acuerdo es válido societariamente
  // pero incumple el pacto — la consecuencia es contractual, no de nulidad)
  return {
    pacto_id: pacto.id,
    pacto_titulo: pacto.titulo,
    tipo: 'CONSENTIMIENTO_INVERSOR',
    aplica: true,
    cumple: false,
    severity: 'BLOCKING',
    explain: {
      regla: 'consentimiento_no_obtenido',
      fuente,
      referencia: pacto.documento_ref,
      resultado: 'BLOCKING',
      mensaje: `CONSENTIMIENTO NO OBTENIDO: Se requiere consentimiento previo de ${pacto.titular_veto ?? 'accionistas que representen ≥' + (pacto.capital_minimo_pct ?? '?') + '% del capital'} para las materias: ${materiasCoincidentes.join(', ')}. ${pacto.condicion_detallada ?? ''}`,
      hijos: [
        {
          regla: 'consentimiento_requisito',
          fuente,
          resultado: 'BLOCKING',
          mensaje: `Capital mínimo requerido: ${pacto.capital_minimo_pct ?? '?'}% — Titular: ${pacto.titular_veto ?? 'No especificado'}`,
        },
      ],
    },
  };
}
