// Mirror of src/lib/rules-engine/comms-plazo-engine.ts for Deno/Edge Functions.
// CI gate test will diff both implementations periodically (P1 W6 task 6.7).

export type TipoComunicacion =
  | 'CONVOCATORIA' | 'NOTIFICACION_INDIVIDUAL' | 'PUESTA_DISPOSICION'
  | 'SOLICITUD_DECLARACION' | 'CIRCULAR_SIN_SESION' | 'RECORDATORIO'
  | 'NOTIFICACION_ACUERDO' | 'REMISION_ACTA' | 'CERTIFICACION'
  | 'NOTIFICACION_CARGO' | 'ALERTA_VENCIMIENTO' | 'CONSIGNACION'
  | 'COMUNICACION_INTER_ORGANO' | 'SOLICITUD_INFORMACION'
  | 'RESPUESTA_INFORMACION' | 'COMUNICACION_LIBRE';

export type OrganoTipo =
  | 'JUNTA_GENERAL' | 'CONSEJO_ADMIN' | 'COMISION_DELEGADA'
  | 'SOCIO_UNICO' | 'ADMIN_UNICO' | 'ADMIN_CONJUNTA' | 'ADMIN_SOLIDARIOS';

export interface NormativeProfile {
  tipo_social: string;
  es_cotizada: boolean;
  jurisdiction: string;
}

export interface ComunicacionConfigSubset {
  plazo_legal_dias: number | null;
  referencia_legal: string;
}

export interface PlazoComunicacionInput {
  tipo_comunicacion: TipoComunicacion;
  organo_tipo: OrganoTipo;
  entity_id: string;
  fecha_evento_referenciado: Date | null;
  normative_profile: NormativeProfile;
  template_id: string | null;
  comunicacion_config?: ComunicacionConfigSubset | null;
}

export interface PlazoComunicacionResult {
  min_envio_date: Date | null;
  plazo_dias: number;
  unidad: 'NATURAL' | 'HABIL';
  fecha_limite_default: Date | null;
  referencia_legal: string;
  fuente_resolucion: 'LEY' | 'ESTATUTOS' | 'REGLAMENTO' | 'COMUNICACION_CONFIG';
  warnings: string[];
}

function subtractDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() - n);
  return out;
}

// ITEM-024: "un mes" del art. 176.1 LSC se computa de fecha a fecha (art. 5.1
// CC); si el día no existe en el mes destino, último día de ese mes.
function subtractOneMonthFechaAFecha(d: Date): Date {
  const out = new Date(d);
  const day = out.getDate();
  out.setDate(1);
  out.setMonth(out.getMonth() - 1);
  const lastDayOfTargetMonth = new Date(out.getFullYear(), out.getMonth() + 1, 0).getDate();
  out.setDate(Math.min(day, lastDayOfTargetMonth));
  return out;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

export function calcularPlazoComunicacion(input: PlazoComunicacionInput): PlazoComunicacionResult {
  if (input.normative_profile.jurisdiction !== 'ES') {
    return {
      min_envio_date: null,
      plazo_dias: 0,
      unidad: 'NATURAL',
      fecha_limite_default: null,
      referencia_legal: 'Multi-jurisdicción no soportada en P1-P4',
      fuente_resolucion: 'LEY',
      warnings: [`Jurisdicción ${input.normative_profile.jurisdiction} fuera de scope`],
    };
  }

  if (input.tipo_comunicacion === 'CONVOCATORIA') {
    return calcularPlazoConvocatoria(input);
  }

  const cfg = input.comunicacion_config;
  return {
    min_envio_date: null,
    plazo_dias: cfg?.plazo_legal_dias ?? 0,
    unidad: 'NATURAL',
    fecha_limite_default:
      cfg?.plazo_legal_dias && input.fecha_evento_referenciado
        ? addDays(input.fecha_evento_referenciado, cfg.plazo_legal_dias)
        : null,
    referencia_legal: cfg?.referencia_legal ?? 'Sin plazo legal específico',
    fuente_resolucion: cfg ? 'COMUNICACION_CONFIG' : 'LEY',
    warnings: [],
  };
}

function calcularPlazoConvocatoria(input: PlazoComunicacionInput): PlazoComunicacionResult {
  const { organo_tipo, normative_profile, fecha_evento_referenciado } = input;
  if (organo_tipo === 'JUNTA_GENERAL') {
    const isSA = normative_profile.tipo_social === 'SA' || normative_profile.tipo_social === 'SAU';
    // ITEM-024: SA = "un mes" de fecha a fecha (arts. 176.1 LSC + 5.1 CC);
    // SL = 15 días naturales (art. 176.1 LSC — el 173 regula la FORMA).
    const plazo = isSA ? 30 : 15;
    const ref = 'Art. 176.1 LSC';
    const warnings: string[] = [];
    if (normative_profile.es_cotizada) {
      warnings.push('Sociedad cotizada: verificar art. 516 LSC para 2ª convocatoria');
    }
    const minEnvio = fecha_evento_referenciado
      ? isSA
        ? subtractOneMonthFechaAFecha(fecha_evento_referenciado)
        : subtractDays(fecha_evento_referenciado, plazo)
      : null;
    return {
      min_envio_date: minEnvio,
      plazo_dias: plazo,
      unidad: 'NATURAL',
      fecha_limite_default: null,
      referencia_legal: ref,
      fuente_resolucion: 'LEY',
      warnings,
    };
  }
  if (organo_tipo === 'CONSEJO_ADMIN') {
    return {
      min_envio_date: null, plazo_dias: 0, unidad: 'NATURAL',
      fecha_limite_default: null,
      referencia_legal: 'Art. 246 LSC (plazo según estatutos)',
      fuente_resolucion: 'ESTATUTOS',
      warnings: ['Verificar plazo en estatutos del Consejo'],
    };
  }
  if (organo_tipo === 'COMISION_DELEGADA') {
    return {
      min_envio_date: null, plazo_dias: 0, unidad: 'NATURAL',
      fecha_limite_default: null,
      referencia_legal: 'Art. 249 LSC + Reglamento del Consejo',
      fuente_resolucion: 'REGLAMENTO',
      warnings: ['Verificar plazo en Reglamento del Consejo'],
    };
  }
  return {
    min_envio_date: null, plazo_dias: 0, unidad: 'NATURAL',
    fecha_limite_default: null,
    referencia_legal: 'No aplica plazo de convocatoria a órgano no colegiado',
    fuente_resolucion: 'LEY',
    warnings: [],
  };
}
