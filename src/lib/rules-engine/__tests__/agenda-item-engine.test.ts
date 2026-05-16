import { describe, expect, it } from 'vitest';
import {
  evaluarPuntoOrdenDia,
  normalizeAgendaItemKind,
  resolutionKindForAgendaItem,
  shouldRunAgreementGatesForAgendaItem,
} from '../agenda-item-engine';
import type { AgendaItemKind } from '../types';

describe('agenda-item-engine', () => {
  it.each<[unknown, AgendaItemKind]>([
    ['DECISORIO', 'DECISORIO'],
    ['decisorio', 'DECISORIO'],
    ['INFORMATIVO', 'INFORMATIVO'],
    ['TOMA_DE_RAZON', 'TOMA_DE_RAZON'],
    ['ACEPTACION_INFORME', 'ACEPTACION_INFORME'],
    ['RUEGOS_PREGUNTAS', 'RUEGOS_PREGUNTAS'],
    ['unknown', 'DELIBERATIVO'],
    [null, 'DELIBERATIVO'],
  ])('normaliza kind %p -> %s', (input, expected) => {
    expect(normalizeAgendaItemKind(input)).toBe(expected);
  });

  it('permite FULL_GATE solo para puntos DECISORIO', () => {
    const result = evaluarPuntoOrdenDia({
      kind: 'DECISORIO',
      title: 'Nombramiento de consejero',
      orderNumber: 1,
      hasAgreement: true,
    });

    expect(result.ok).toBe(true);
    expect(result.gateMode).toBe('FULL_GATE');
    expect(result.shouldRunAgreementGates).toBe(true);
    expect(result.agreementAllowed).toBe(true);
    expect(result.resolutionKind).toBe('DECISION');
    expect(result.blocking_issues).toEqual([]);
  });

  it.each<AgendaItemKind>([
    'INFORMATIVO',
    'TOMA_DE_RAZON',
    'DELIBERATIVO',
    'ACEPTACION_INFORME',
    'RUEGOS_PREGUNTAS',
  ])('bloquea materializar acuerdo sobre punto no decisorio %s', (kind) => {
    const result = evaluarPuntoOrdenDia({
      kind,
      title: 'Informe del comité de auditoría',
      orderNumber: 2,
      hasAgreement: true,
    });

    expect(result.ok).toBe(false);
    expect(result.severity).toBe('BLOCKING');
    expect(result.shouldRunAgreementGates).toBe(false);
    expect(result.agreementAllowed).toBe(false);
    expect(result.constanciaRequired).toBe(true);
    expect(result.blocking_issues[0]).toMatch(/solo DECISORIO puede materializar un acuerdo/i);
  });

  it('documenta ACEPTACION_INFORME con asentimiento como evaluación ligera, no FULL_GATE', () => {
    const result = evaluarPuntoOrdenDia({
      kind: 'ACEPTACION_INFORME',
      requiresVote: 'ASSENT',
      hasAgreement: false,
    });

    expect(result.ok).toBe(true);
    expect(result.gateMode).toBe('LIGHT_ACCEPTANCE');
    expect(result.shouldRunAgreementGates).toBe(false);
    expect(result.resolutionKind).toBe('REPORT_ACCEPTED');
    expect(result.warnings[0]).toMatch(/sin crear Acuerdo 360/i);
  });

  it('expone helper shouldRunAgreementGatesForAgendaItem como contrato de UI', () => {
    expect(shouldRunAgreementGatesForAgendaItem({ kind: 'DECISORIO' })).toBe(true);
    expect(shouldRunAgreementGatesForAgendaItem({ kind: 'INFORMATIVO' })).toBe(false);
  });

  it('permite punto DECISORIO en fase borrador aunque aún no tenga agreement materializado', () => {
    const result = evaluarPuntoOrdenDia({
      kind: 'DECISORIO',
      title: 'Aprobación de cuentas',
      hasAgreement: false,
    });

    expect(result.ok).toBe(true);
    expect(result.shouldRunAgreementGates).toBe(true);
    expect(result.blocking_issues).toEqual([]);
  });

  it('ignora requires_vote en DECISORIO y deja warning de configuración', () => {
    const result = evaluarPuntoOrdenDia({
      kind: 'DECISORIO',
      requiresVote: 'BINDING',
      hasAgreement: false,
    });

    expect(result.ok).toBe(true);
    expect(result.gateMode).toBe('FULL_GATE');
    expect(result.requiresVote).toBe('NONE');
    expect(result.warnings[0]).toMatch(/solo aplica a ACEPTACION_INFORME/i);
  });

  it('fallback seguro para input vacío: DELIBERATIVO con warning y sin FULL_GATE', () => {
    const result = evaluarPuntoOrdenDia({});

    expect(result.ok).toBe(true);
    expect(result.itemKind).toBe('DELIBERATIVO');
    expect(result.shouldRunAgreementGates).toBe(false);
    expect(result.warnings[0]).toMatch(/no informado/i);
  });

  it('mapea cada tipo no decisorio a su outcome de constancia', () => {
    expect(resolutionKindForAgendaItem('INFORMATIVO')).toBe('INFORMATION_NOTED');
    expect(resolutionKindForAgendaItem('TOMA_DE_RAZON')).toBe('ACKNOWLEDGEMENT_NOTED');
    expect(resolutionKindForAgendaItem('DELIBERATIVO')).toBe('DELIBERATION_OUTCOME');
    expect(resolutionKindForAgendaItem('ACEPTACION_INFORME')).toBe('REPORT_ACCEPTED');
    expect(resolutionKindForAgendaItem('RUEGOS_PREGUNTAS')).toBe('QUESTIONS_ANSWERS');
  });
});
