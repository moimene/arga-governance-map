import { describe, expect, it } from 'vitest';
import {
  buildCompliancePanelResult,
  evaluateAgendaItemComplianceGate,
  gateFromEvaluation,
} from '../compliance-gates';

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
    const votingGate = gateFromEvaluation({
      etapa: 'votacion',
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
  });
});
