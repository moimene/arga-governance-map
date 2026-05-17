// comms-plazo-engine: legal notice computation for comms module
// Extension of rules-engine. Single source of truth for plazo calculations.

import type { TipoComunicacion, OrganoTipo } from '@/lib/comms/types';

export interface NormativeProfile {
  tipo_social: 'SA' | 'SL' | 'SLU' | 'SAU' | string;
  es_cotizada: boolean;
  jurisdiction: string;
  [k: string]: unknown;
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
  // TODO P3: segunda convocatoria art. 177 LSC
  // es_segunda_convocatoria: boolean;
  // plazo_segunda_convocatoria_dias: number | null;
  // min_envio_segunda: Date | null;
}

function subtractDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() - n);
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

  // P3: añadir branches para D3 (aumento), D4 (reducción), D7 (fusión) aquí.

  // P1 fallback: leer comunicacion_config
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
    const plazo = isSA ? 30 : 15;
    const ref = isSA ? 'Art. 176.1 LSC' : 'Art. 173 LSC';
    const warnings: string[] = [];
    if (normative_profile.es_cotizada) {
      warnings.push('Sociedad cotizada: verificar art. 516 LSC para 2ª convocatoria');
    }
    return {
      min_envio_date: fecha_evento_referenciado ? subtractDays(fecha_evento_referenciado, plazo) : null,
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
      min_envio_date: null,
      plazo_dias: 0,
      unidad: 'NATURAL',
      fecha_limite_default: null,
      referencia_legal: 'Art. 246 LSC (plazo según estatutos)',
      fuente_resolucion: 'ESTATUTOS',
      warnings: ['Verificar plazo en estatutos del Consejo'],
    };
  }

  if (organo_tipo === 'COMISION_DELEGADA') {
    return {
      min_envio_date: null,
      plazo_dias: 0,
      unidad: 'NATURAL',
      fecha_limite_default: null,
      referencia_legal: 'Art. 249 LSC + Reglamento del Consejo',
      fuente_resolucion: 'REGLAMENTO',
      warnings: ['Verificar plazo en Reglamento del Consejo'],
    };
  }

  return {
    min_envio_date: null,
    plazo_dias: 0,
    unidad: 'NATURAL',
    fecha_limite_default: null,
    referencia_legal: 'No aplica plazo de convocatoria a órgano no colegiado',
    fuente_resolucion: 'LEY',
    warnings: [],
  };
}
