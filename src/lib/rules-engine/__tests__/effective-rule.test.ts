import { describe, expect, it } from 'vitest';
import { buildEffectiveRuleProjection } from '../effective-rule';
import type { RulePack, RuleParamOverride } from '../types';

const pack: RulePack = {
  id: 'AUMENTO_CAPITAL',
  materia: 'AUMENTO_CAPITAL',
  clase: 'ESTATUTARIA',
  organoTipo: 'JUNTA_GENERAL',
  modosAdopcionPermitidos: ['MEETING'],
  convocatoria: {
    antelacionDias: {
      SA: { valor: 30, fuente: 'LEY', referencia: 'art. 176 LSC' },
      SL: { valor: 15, fuente: 'LEY', referencia: 'art. 176 LSC' },
      SAU: { valor: 30, fuente: 'LEY', referencia: 'art. 176 LSC' },
      SLU: { valor: 15, fuente: 'LEY', referencia: 'art. 176 LSC' },
    },
    canales: { SA: [], SL: [], SAU: [], SLU: [] },
    contenidoMinimo: [],
  },
  constitucion: {
    quorum: {
      SA_1a: { valor: 0.5, fuente: 'LEY', referencia: 'art. 194 LSC' },
      SA_2a: { valor: 0.25, fuente: 'LEY' },
      SL: { valor: 0, fuente: 'LEY' },
      CONSEJO: { valor: 'mayoria_miembros', fuente: 'LEY' },
    },
  },
  votacion: {
    mayoria: {
      SA: { formula: 'favor >= 2/3_emitidos', fuente: 'LEY', referencia: 'art. 201 LSC' },
      SL: { formula: 'favor > contra', fuente: 'LEY' },
      CONSEJO: { formula: 'favor > contra', fuente: 'LEY' },
    },
    abstenciones: 'no_cuentan',
  },
  documentacion: {
    obligatoria: [{ id: 'certificacion', nombre: 'Certificación' }],
  },
  acta: {
    tipoActaPorModo: { MEETING: 'ACTA_JUNTA' },
    contenidoMinimo: { sesion: [], consignacion: [], acuerdoEscrito: [] },
    requiereTranscripcionLibroActas: true,
    requiereConformidadConjunta: false,
  },
  plazosMateriales: {},
  postAcuerdo: {
    inscribible: true,
    instrumentoRequerido: 'ESCRITURA',
    publicacionRequerida: false,
  },
};

describe('buildEffectiveRuleProjection', () => {
  it('proyecta mayoría, quórum, documentos y formalización desde el rule pack curado', () => {
    const result = buildEffectiveRuleProjection({ pack, tipoSocial: 'SA' });

    expect(result.materia).toBe('AUMENTO_CAPITAL');
    expect(result.notice_days).toBe(30);
    expect(result.quorum).toBe(0.5);
    expect(result.majority_formula).toBe('favor >= 2/3_emitidos');
    expect(result.required_documents).toEqual(['certificacion']);
    expect(result.instrument_required).toBe('ESCRITURA');
    expect(result.registry_required).toBe(true);
  });

  it('aplica estatutos y mantiene pactos como capa contractual no societaria', () => {
    const overrides: RuleParamOverride[] = [
      {
        id: 'ov-doc',
        entity_id: 'entity-1',
        materia: 'AUMENTO_CAPITAL',
        clave: 'documentacion.obligatoria',
        valor: ['informe_administradores'],
        fuente: 'ESTATUTOS',
        referencia: 'art. 20 Estatutos',
      },
      {
        id: 'pacto-mayoria',
        entity_id: 'entity-1',
        materia: 'AUMENTO_CAPITAL',
        clave: 'votacion.mayoria',
        valor: 'favor >= 75_emitidos',
        fuente: 'PACTO_PARASOCIAL',
        referencia: 'pacto demo',
      },
    ];

    const result = buildEffectiveRuleProjection({ pack, tipoSocial: 'SA', overrides });

    expect(result.required_documents).toEqual(['certificacion', 'informe_administradores']);
    expect(result.majority_formula).toBe('favor >= 2/3_emitidos');
    expect(result.source_layers.some((layer) => layer.layer === 'PACTO_PARASOCIAL' && layer.contractual_only)).toBe(true);
    expect(result.warnings[0]).toMatch(/contractual/i);
  });
});
