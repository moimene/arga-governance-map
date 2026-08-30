import { describe, expect, it } from 'vitest';
import {
  buildCompliancePanelResult,
  evaluateAgendaItemComplianceGate,
  gateFromEvaluation,
} from '../compliance-gates';
import type { EtapaEvaluacion } from '../types';

describe('compliance-gates', () => {
  it('permite ejecutar gates completos solo en puntos decisorios', () => {
    const result = evaluateAgendaItemComplianceGate({
      kind: 'DECISORIO',
      title: 'Aprobación de cuentas',
      hasAgreement: true,
    });

    expect(result.shouldRunAgreementGates).toBe(true);
    expect(result.agreementAllowed).toBe(true);
    expect(result.gate.status).toBe('OK');
  });

  it('bloquea un acuerdo sobre punto informativo con mensaje determinista', () => {
    const result = evaluateAgendaItemComplianceGate({
      kind: 'INFORMATIVO',
      title: 'Informe del presidente',
      hasAgreement: true,
    });

    expect(result.shouldRunAgreementGates).toBe(false);
    expect(result.agreementAllowed).toBe(false);
    expect(result.gate.status).toBe('BLOCKING');
    expect(result.gate.blocking_issues[0]).toMatch(/solo DECISORIO/i);
  });

  it('marca constancias no decisorias como no aplicables al motor de validez', () => {
    const result = evaluateAgendaItemComplianceGate({
      kind: 'RUEGOS_PREGUNTAS',
      title: 'Ruegos y preguntas',
      hasAgreement: false,
    });

    expect(result.shouldRunAgreementGates).toBe(false);
    expect(result.gate.status).toBe('NOT_APPLICABLE');
    expect(result.gate.message).toBe('El punto genera constancia, no acuerdo.');
  });

  it('consolida bloqueos y próximos pasos para el panel de cumplimiento', () => {
    // `VOTACION` en MAYUSCULA, que es lo que emite `votacion-engine.ts:118`.
    // Este fixture decia `'votacion'`, y con el mapa de etapas en minuscula el
    // test pasaba con el unico valor que produccion NUNCA emite: no era un
    // typo de fixture, era un test documentando el defecto como si fuera el
    // contrato. Con la etapa tipada, la minuscula ya ni compila.
    const votingGate = gateFromEvaluation({
      etapa: 'VOTACION',
      ok: false,
      severity: 'BLOCKING',
      explain: [],
      blocking_issues: ['majority_not_achieved'],
      warnings: [],
    });
    const panel = buildCompliancePanelResult({ gates: [votingGate] });

    expect(panel.can_advance).toBe(false);
    expect(panel.blocking_issues).toEqual(['majority_not_achieved']);
    expect(panel.next_actions[0]).toMatch(/votación/i);
    // Y en sentido contrario: el sintoma del defecto era que una votacion
    // bloqueada proponia el paso siguiente de la FORMALIZACION, por el
    // `?? 'formalization'` que tapaba la clave no encontrada.
    expect(panel.next_actions[0]).not.toMatch(/formalizaci|instrumento|registral/i);
  });

  it('cada etapa que emiten los motores cae en su gate, y ninguna en el fallback', () => {
    // El `?? 'formalization'` de `gateFromEvaluation` convierte una clave que
    // falta en un gate PLAUSIBLE, no en un error: por eso el defecto de las
    // tres mayusculas sobrevivio. Este test recorre las 7 etapas reales.
    const esperado: Array<[EtapaEvaluacion, string]> = [
      ['CONVOCATORIA', 'Convocatoria'],
      ['convocatoria_skip', 'Convocatoria'],
      ['CONSTITUCION', 'Constitución de la sesión'],
      ['constitucion_skip', 'Constitución de la sesión'],
      ['VOTACION', 'Mayoría y votación'],
      ['documentacion', 'Documentación'],
      ['agenda_item', 'Tipo de punto'],
    ];
    for (const [etapa, label] of esperado) {
      const gate = gateFromEvaluation({
        etapa, ok: true, severity: 'OK', explain: [], blocking_issues: [], warnings: [],
      });
      expect(gate.label).toBe(label);
      // Ninguna de las siete debe caer en el fallback.
      if (etapa !== 'documentacion') expect(gate.kind).not.toBe('formalization');
    }
  });
});
