import { describe, it, expect } from 'vitest';
import {
  evaluarProcesoSinSesion,
  evaluarVentana,
  evaluarUnanimidadCapitalSL,
  evaluarCirculacionConsejo,
  evaluarDecisionSocioUnico,
} from '../no-session-engine';
import type {
  NoSessionInput,
  RulePack,
  NoSessionRespuesta,
  NoSessionNotificacion,
  ReglaConvocatoria,
  ReglaConstitucion,
  ReglaVotacion,
  ReglaDocumentacion,
  ReglaActa,
  ReglaPlazosMateriales,
  ReglaPostAcuerdo,
} from '../types';

// ============================================================
// Test Helpers
// ============================================================

const createBaseInput = (overrides?: Partial<NoSessionInput>): NoSessionInput => ({
  tipoProceso: 'UNANIMIDAD_ESCRITA_SL',
  condicionAdopcion: 'UNANIMIDAD_CAPITAL',
  organoTipo: 'JUNTA_GENERAL',
  tipoSocial: 'SL',
  respuestas: [],
  notificaciones: [],
  totalDestinatarios: 3,
  totalCapitalSocial: 1000,
  ventana: {
    inicio: '2026-04-19T00:00:00Z',
    fin: '2026-04-26T00:00:00Z',
    ahora: '2026-04-20T12:00:00Z',
  },
  propuestaTexto: 'Aprobación de cuentas anuales',
  decisionConsignada: false,
  ...overrides,
});

const createBasePack = (overrides?: Partial<RulePack>): RulePack => ({
  id: 'pack-1',
  materia: 'APROBACION_CUENTAS',
  clase: 'ORDINARIA',
  organoTipo: 'JUNTA_GENERAL',
  modosAdopcionPermitidos: ['MEETING', 'NO_SESSION'],
  convocatoria: {} as unknown as ReglaConvocatoria,
  constitucion: {} as unknown as ReglaConstitucion,
  votacion: {} as unknown as ReglaVotacion,
  documentacion: {} as unknown as ReglaDocumentacion,
  acta: {} as unknown as ReglaActa,
  plazosMateriales: {} as unknown as ReglaPlazosMateriales,
  postAcuerdo: {} as unknown as ReglaPostAcuerdo,
  noSession: {
    habilitado_por_estatutos: { valor: true, fuente: 'ESTATUTOS' },
    habilitado_por_reglamento: { valor: false, fuente: 'REGLAMENTO' },
    condicion_junta_sl: 'UNANIMIDAD_CAPITAL',
    condicion_consejo: 'MAYORIA_SIN_OPOSICION',
    ventana_minima_dias: { valor: 7, fuente: 'ESTATUTOS' },
    ventana_fuente: 'ESTATUTOS',
    canal_requerido_junta_sl: {
      valor: ['NOTIFICACION_CERTIFICADA', 'EMAIL_CON_ACUSE'],
      fuente: 'ESTATUTOS',
    },
    canal_requerido_consejo: {
      valor: ['NOTIFICACION_CERTIFICADA'],
      fuente: 'ESTATUTOS',
    },
    silencio_equivale_a: 'NADA',
    cierre_anticipado: true,
    contenido_minimo_propuesta: ['Texto de propuesta', 'Derecho de voto'],
  },
  ...overrides,
});

// ============================================================
// Gate 0: Habilitación
// ============================================================

describe('Gate 0: Habilitación', () => {
  it('Estatutos habilitados SI → pass', () => {
    const input = createBaseInput({ organoTipo: 'JUNTA_GENERAL' });
    const pack = createBasePack();
    const result = evaluarProcesoSinSesion(input, pack);

    expect(result.gates[0].gate).toBe('habilitacion');
    expect(result.gates[0].ok).toBe(true);
  });

  it('Estatutos habilitados NO → BLOCKING', () => {
    const input = createBaseInput({ organoTipo: 'JUNTA_GENERAL' });
    const pack = createBasePack({
      noSession: {
        ...createBasePack().noSession!,
        habilitado_por_estatutos: { valor: false, fuente: 'ESTATUTOS' },
      },
    });
    const result = evaluarProcesoSinSesion(input, pack);

    expect(result.gates[0].ok).toBe(false);
    expect(result.blocking_issues).toContain('no_session_not_enabled');
  });

  it('Reglamento habilitado SI (consejo) → pass', () => {
    const input = createBaseInput({ organoTipo: 'CONSEJO' });
    const pack = createBasePack({
      organoTipo: 'CONSEJO',
      noSession: {
        ...createBasePack().noSession!,
        habilitado_por_reglamento: { valor: true, fuente: 'REGLAMENTO' },
      },
    });
    const result = evaluarProcesoSinSesion(input, pack);

    expect(result.gates[0].ok).toBe(true);
  });
});

// ============================================================
// Gate 1: Materia
// ============================================================

describe('Gate 1: Materia', () => {
  it('Materia admitida → pass', () => {
    const input = createBaseInput();
    const pack = createBasePack({ modosAdopcionPermitidos: ['MEETING', 'NO_SESSION'] });
    const result = evaluarProcesoSinSesion(input, pack);

    expect(result.gates[1].gate).toBe('materia');
    expect(result.gates[1].ok).toBe(true);
  });

  it('Materia excluida → BLOCKING', () => {
    const input = createBaseInput();
    const pack = createBasePack({ modosAdopcionPermitidos: ['MEETING'] });
    const result = evaluarProcesoSinSesion(input, pack);

    expect(result.gates[1].ok).toBe(false);
    expect(result.blocking_issues).toContain('materia_not_admitted');
  });
});

// ============================================================
// Gate 2: Notificación
// ============================================================

describe('Gate 2: Notificación', () => {
  it('Todas ENTREGADA → pass', () => {
    const input = createBaseInput({
      notificaciones: [
        { person_id: '1', canal: 'EMAIL', estado: 'ENTREGADA' },
        { person_id: '2', canal: 'EMAIL', estado: 'ENTREGADA' },
        { person_id: '3', canal: 'EMAIL', estado: 'ENTREGADA' },
      ],
    });
    const pack = createBasePack();
    const result = evaluarProcesoSinSesion(input, pack);

    expect(result.gates[2].ok).toBe(true);
  });

  it('Alguna PENDIENTE → BLOCKING', () => {
    const input = createBaseInput({
      notificaciones: [
        { person_id: '1', canal: 'EMAIL', estado: 'ENTREGADA' },
        { person_id: '2', canal: 'EMAIL', estado: 'PENDIENTE' },
        { person_id: '3', canal: 'EMAIL', estado: 'ENTREGADA' },
      ],
    });
    const pack = createBasePack();
    const result = evaluarProcesoSinSesion(input, pack);

    expect(result.gates[2].ok).toBe(false);
    expect(result.blocking_issues.some(i => i.includes('notificacion'))).toBe(true);
  });
});

// ============================================================
// Gate 3: Ventana
// ============================================================

describe('Gate 3: Ventana', () => {
  it('Ventana abierta → pass', () => {
    const input = createBaseInput({
      ventana: {
        inicio: '2026-04-19T00:00:00Z',
        fin: '2026-04-26T00:00:00Z',
        ahora: '2026-04-20T12:00:00Z',
      },
    });

    const result = evaluarVentana(input);
    expect(result.ok).toBe(true);
  });

  it('Ventana cerrada → BLOCKING', () => {
    const input = createBaseInput({
      ventana: {
        inicio: '2026-04-15T00:00:00Z',
        fin: '2026-04-19T00:00:00Z',
        ahora: '2026-04-20T12:00:00Z',
      },
    });

    const result = evaluarVentana(input);
    expect(result.ok).toBe(false);
  });

  it('Cierre anticipado por unanimidad → OK', () => {
    const input = createBaseInput({
      respuestas: [
        {
          person_id: '1',
          capital_participacion: 500,
          porcentaje_capital: 50,
          es_consejero: false,
          sentido: 'CONSENTIMIENTO',
        },
        {
          person_id: '2',
          capital_participacion: 500,
          porcentaje_capital: 50,
          es_consejero: false,
          sentido: 'CONSENTIMIENTO',
        },
      ],
      ventana: {
        inicio: '2026-04-19T00:00:00Z',
        fin: '2026-04-26T00:00:00Z',
        ahora: '2026-04-25T23:00:00Z', // Still before fin
      },
    });

    const result = evaluarVentana(input);
    expect(result.ok).toBe(true);
    expect(result.explain.some(e => e.mensaje.includes('Cierre anticipado'))).toBe(true);
  });
});

// ============================================================
// Gate 4: Unanimidad SL
// ============================================================

describe('Gate 4: Unanimidad Capital SL', () => {
  it('Todos consienten 100% capital → OK', () => {
    const input = createBaseInput({
      respuestas: [
        {
          person_id: '1',
          capital_participacion: 500,
          porcentaje_capital: 50,
          es_consejero: false,
          sentido: 'CONSENTIMIENTO',
        },
        {
          person_id: '2',
          capital_participacion: 500,
          porcentaje_capital: 50,
          es_consejero: false,
          sentido: 'CONSENTIMIENTO',
        },
      ],
    });

    const result = evaluarUnanimidadCapitalSL(input);
    expect(result.ok).toBe(true);
    expect(result.severity).toBe('OK');
  });

  it('Un silencio → FAIL', () => {
    const input = createBaseInput({
      respuestas: [
        {
          person_id: '1',
          capital_participacion: 500,
          porcentaje_capital: 50,
          es_consejero: false,
          sentido: 'CONSENTIMIENTO',
        },
        {
          person_id: '2',
          capital_participacion: 500,
          porcentaje_capital: 50,
          es_consejero: false,
          sentido: 'SILENCIO',
        },
      ],
    });

    const result = evaluarUnanimidadCapitalSL(input);
    expect(result.ok).toBe(false);
  });

  it('Una objeción → FAIL', () => {
    const input = createBaseInput({
      respuestas: [
        {
          person_id: '1',
          capital_participacion: 500,
          porcentaje_capital: 50,
          es_consejero: false,
          sentido: 'CONSENTIMIENTO',
        },
        {
          person_id: '2',
          capital_participacion: 500,
          porcentaje_capital: 50,
          es_consejero: false,
          sentido: 'OBJECION',
        },
      ],
    });

    const result = evaluarUnanimidadCapitalSL(input);
    expect(result.ok).toBe(false);
  });

  it('Capital parcial (80%) → FAIL', () => {
    const input = createBaseInput({
      totalCapitalSocial: 1000,
      respuestas: [
        {
          person_id: '1',
          capital_participacion: 800,
          porcentaje_capital: 80,
          es_consejero: false,
          sentido: 'CONSENTIMIENTO',
        },
      ],
    });

    const result = evaluarUnanimidadCapitalSL(input);
    expect(result.ok).toBe(false);
  });
});

// ============================================================
// Gate 4: Circulación Consejo
// ============================================================

describe('Gate 4: Circulación Consejo', () => {
  it('Sin objeción procedimiento + mayoría → OK', () => {
    const input = createBaseInput({
      organoTipo: 'CONSEJO',
      condicionAdopcion: 'UNANIMIDAD_CONSEJEROS',
      respuestas: [
        {
          person_id: '1',
          capital_participacion: 0,
          porcentaje_capital: 0,
          es_consejero: true,
          sentido: 'CONSENTIMIENTO',
        },
        {
          person_id: '2',
          capital_participacion: 0,
          porcentaje_capital: 0,
          es_consejero: true,
          sentido: 'CONSENTIMIENTO',
        },
        {
          person_id: '3',
          capital_participacion: 0,
          porcentaje_capital: 0,
          es_consejero: true,
          sentido: 'OBJECION',
        },
      ],
    });

    const result = evaluarCirculacionConsejo(input);
    expect(result.ok).toBe(true);
  });

  it('Con objeción procedimiento → BLOCKING', () => {
    const input = createBaseInput({
      organoTipo: 'CONSEJO',
      respuestas: [
        {
          person_id: '1',
          capital_participacion: 0,
          porcentaje_capital: 0,
          es_consejero: true,
          sentido: 'CONSENTIMIENTO',
        },
        {
          person_id: '2',
          capital_participacion: 0,
          porcentaje_capital: 0,
          es_consejero: true,
          sentido: 'OBJECION_PROCEDIMIENTO',
        },
      ],
    });

    const result = evaluarCirculacionConsejo(input);
    expect(result.ok).toBe(false);
    expect(result.severity).toBe('BLOCKING');
  });

  it('Mayoría alcanzada → OK', () => {
    const input = createBaseInput({
      organoTipo: 'CONSEJO',
      totalDestinatarios: 5,
      respuestas: [
        {
          person_id: '1',
          capital_participacion: 0,
          porcentaje_capital: 0,
          es_consejero: true,
          sentido: 'CONSENTIMIENTO',
        },
        {
          person_id: '2',
          capital_participacion: 0,
          porcentaje_capital: 0,
          es_consejero: true,
          sentido: 'CONSENTIMIENTO',
        },
        {
          person_id: '3',
          capital_participacion: 0,
          porcentaje_capital: 0,
          es_consejero: true,
          sentido: 'OBJECION',
        },
      ],
    });

    const result = evaluarCirculacionConsejo(input);
    expect(result.ok).toBe(true);
  });

  it('Mayoría no alcanzada → FAIL', () => {
    const input = createBaseInput({
      organoTipo: 'CONSEJO',
      respuestas: [
        {
          person_id: '1',
          capital_participacion: 0,
          porcentaje_capital: 0,
          es_consejero: true,
          sentido: 'CONSENTIMIENTO',
        },
        {
          person_id: '2',
          capital_participacion: 0,
          porcentaje_capital: 0,
          es_consejero: true,
          sentido: 'OBJECION',
        },
        {
          person_id: '3',
          capital_participacion: 0,
          porcentaje_capital: 0,
          es_consejero: true,
          sentido: 'OBJECION',
        },
      ],
    });

    const result = evaluarCirculacionConsejo(input);
    expect(result.ok).toBe(false);
  });

  it('Quórum participación insuficiente → WARNING', () => {
    const input = createBaseInput({
      organoTipo: 'CONSEJO',
      totalDestinatarios: 10,
      respuestas: [
        {
          person_id: '1',
          capital_participacion: 0,
          porcentaje_capital: 0,
          es_consejero: true,
          sentido: 'CONSENTIMIENTO',
        },
        {
          person_id: '2',
          capital_participacion: 0,
          porcentaje_capital: 0,
          es_consejero: true,
          sentido: 'CONSENTIMIENTO',
        },
        {
          person_id: '3',
          capital_participacion: 0,
          porcentaje_capital: 0,
          es_consejero: true,
          sentido: 'OBJECION',
        },
      ],
    });

    const result = evaluarCirculacionConsejo(input);
    expect(result.ok).toBe(true);
    expect(result.severity).toBe('WARNING');
  });
});

// ============================================================
// Gate 4: Decisión Socio Único
// ============================================================

describe('Gate 4: Decisión Socio Único', () => {
  it('Consignada → OK', () => {
    const input = createBaseInput({
      decisionConsignada: true,
      respuestas: [
        {
          person_id: '1',
          capital_participacion: 1000,
          porcentaje_capital: 100,
          es_consejero: false,
          sentido: 'CONSENTIMIENTO',
        },
      ],
    });

    const result = evaluarDecisionSocioUnico(input);
    expect(result.ok).toBe(true);
  });

  it('No consignada → FAIL', () => {
    const input = createBaseInput({
      decisionConsignada: false,
      respuestas: [
        {
          person_id: '1',
          capital_participacion: 1000,
          porcentaje_capital: 100,
          es_consejero: false,
          sentido: 'CONSENTIMIENTO',
        },
      ],
    });

    const result = evaluarDecisionSocioUnico(input);
    expect(result.ok).toBe(false);
  });
});

// ============================================================
// Full Process Tests
// ============================================================

describe('evaluarProcesoSinSesion — full flow', () => {
  it('Valid unanimidad SL → CERRADO_OK', () => {
    const input = createBaseInput({
      notificaciones: [
        { person_id: '1', canal: 'EMAIL', estado: 'ENTREGADA' },
        { person_id: '2', canal: 'EMAIL', estado: 'ENTREGADA' },
      ],
      respuestas: [
        {
          person_id: '1',
          capital_participacion: 500,
          porcentaje_capital: 50,
          es_consejero: false,
          sentido: 'CONSENTIMIENTO',
        },
        {
          person_id: '2',
          capital_participacion: 500,
          porcentaje_capital: 50,
          es_consejero: false,
          sentido: 'CONSENTIMIENTO',
        },
      ],
    });
    const pack = createBasePack();
    const result = evaluarProcesoSinSesion(input, pack);

    expect(result.ok).toBe(true);
    expect(result.estado).toBe('CERRADO_OK');
  });

  it('No habilitado → early BLOCKING', () => {
    const input = createBaseInput({ organoTipo: 'JUNTA_GENERAL' });
    const pack = createBasePack({
      noSession: {
        ...createBasePack().noSession!,
        habilitado_por_estatutos: { valor: false, fuente: 'ESTATUTOS' },
      },
    });
    const result = evaluarProcesoSinSesion(input, pack);

    expect(result.ok).toBe(false);
    expect(result.estado).toBe('CERRADO_FAIL');
    expect(result.gates).toHaveLength(1);
  });
});
