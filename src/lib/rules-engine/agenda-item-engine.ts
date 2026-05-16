import type {
  AgendaItemEvaluationInput,
  AgendaItemEvaluationResult,
  AgendaItemGateMode,
  AgendaItemKind,
  AgendaItemResolutionKind,
  AgendaReportAcceptanceVote,
  EvalSeverity,
  ExplainNode,
} from './types';

export const AGENDA_ITEM_KINDS: AgendaItemKind[] = [
  'DECISORIO',
  'INFORMATIVO',
  'TOMA_DE_RAZON',
  'DELIBERATIVO',
  'ACEPTACION_INFORME',
  'RUEGOS_PREGUNTAS',
];

export const NON_DECISION_AGENDA_ITEM_KINDS = AGENDA_ITEM_KINDS.filter(
  (kind) => kind !== 'DECISORIO',
);

const VALID_KINDS = new Set<AgendaItemKind>(AGENDA_ITEM_KINDS);
const VALID_REPORT_ACCEPTANCE_VOTES = new Set<AgendaReportAcceptanceVote>([
  'NONE',
  'ASSENT',
  'BINDING',
]);

export function normalizeAgendaItemKind(value: unknown): AgendaItemKind {
  if (typeof value !== 'string') return 'DELIBERATIVO';
  const upper = value.toUpperCase().trim();
  return VALID_KINDS.has(upper as AgendaItemKind) ? (upper as AgendaItemKind) : 'DELIBERATIVO';
}

export function normalizeAgendaReportAcceptanceVote(value: unknown): AgendaReportAcceptanceVote {
  if (typeof value !== 'string') return 'NONE';
  const upper = value.toUpperCase().trim();
  return VALID_REPORT_ACCEPTANCE_VOTES.has(upper as AgendaReportAcceptanceVote)
    ? (upper as AgendaReportAcceptanceVote)
    : 'NONE';
}

export function isDecisionAgendaItem(kind: AgendaItemKind): boolean {
  return kind === 'DECISORIO';
}

export function resolutionKindForAgendaItem(kind: AgendaItemKind): AgendaItemResolutionKind {
  if (kind === 'DECISORIO') return 'DECISION';
  if (kind === 'INFORMATIVO') return 'INFORMATION_NOTED';
  if (kind === 'TOMA_DE_RAZON') return 'ACKNOWLEDGEMENT_NOTED';
  if (kind === 'ACEPTACION_INFORME') return 'REPORT_ACCEPTED';
  if (kind === 'RUEGOS_PREGUNTAS') return 'QUESTIONS_ANSWERS';
  return 'DELIBERATION_OUTCOME';
}

function gateModeForAgendaItem(
  kind: AgendaItemKind,
  requiresVote: AgendaReportAcceptanceVote,
): AgendaItemGateMode {
  if (kind === 'DECISORIO') return 'FULL_GATE';
  if (kind === 'ACEPTACION_INFORME' && requiresVote !== 'NONE') return 'LIGHT_ACCEPTANCE';
  return 'CONSTANCIA';
}

function makeExplain(
  kind: AgendaItemKind,
  severity: EvalSeverity,
  message: string,
  orderNumber?: number | null,
): ExplainNode {
  return {
    regla: 'agenda_item_kind_boundary',
    fuente: 'SISTEMA',
    resultado: severity,
    valor: kind,
    mensaje: orderNumber ? `Punto ${orderNumber}: ${message}` : message,
  };
}

function isUnknownKind(value: unknown) {
  if (typeof value !== 'string') return true;
  const upper = value.toUpperCase().trim();
  return !VALID_KINDS.has(upper as AgendaItemKind);
}

export function evaluarPuntoOrdenDia(input: AgendaItemEvaluationInput): AgendaItemEvaluationResult {
  const itemKind = normalizeAgendaItemKind(input.kind);
  const rawRequiresVote = normalizeAgendaReportAcceptanceVote(input.requiresVote);
  const requiresVote = itemKind === 'ACEPTACION_INFORME' ? rawRequiresVote : 'NONE';
  const shouldRunAgreementGates = itemKind === 'DECISORIO';
  const agreementAllowed = shouldRunAgreementGates;
  const gateMode = gateModeForAgendaItem(itemKind, requiresVote);
  const constanciaRequired = !shouldRunAgreementGates;
  const blocking_issues: string[] = [];
  const warnings: string[] = [];
  const explain: ExplainNode[] = [];

  let severity: EvalSeverity = 'OK';
  let ok = true;

  if (isUnknownKind(input.kind)) {
    warnings.push('Tipo de punto no informado o no reconocido: se trata como DELIBERATIVO y no puede generar Acuerdo 360.');
    explain.push(
      makeExplain(
        itemKind,
        'WARNING',
        'Tipo de punto no informado o no reconocido; fallback seguro a DELIBERATIVO.',
        input.orderNumber,
      ),
    );
  }

  if (rawRequiresVote !== 'NONE' && itemKind !== 'ACEPTACION_INFORME') {
    warnings.push(`requires_vote=${rawRequiresVote} ignorado: solo aplica a ACEPTACION_INFORME.`);
    explain.push(
      makeExplain(
        itemKind,
        'WARNING',
        `requires_vote=${rawRequiresVote} no aplica a puntos ${itemKind}; se normaliza a NONE.`,
        input.orderNumber,
      ),
    );
  }

  if (shouldRunAgreementGates) {
    explain.push(
      makeExplain(
        itemKind,
        'OK',
        'Punto decisorio: puede materializar Acuerdo 360 y ejecutar convocatoria, quórum, votación, documentación y plazos.',
        input.orderNumber,
      ),
    );
  } else {
    const message =
      'Punto no decisorio: no produce negocio jurídico ni puede ejecutar FULL_GATE; debe documentarse como constancia en acta.';
    explain.push(makeExplain(itemKind, 'OK', message, input.orderNumber));

    if (itemKind === 'ACEPTACION_INFORME' && requiresVote !== 'NONE') {
      warnings.push(
        `Aceptación de informe con ${requiresVote}: se documenta conformidad sin crear Acuerdo 360 ni mayoría LSC.`,
      );
    }
  }

  if (!agreementAllowed && input.hasAgreement) {
    ok = false;
    severity = 'BLOCKING';
    const title = input.title?.trim() ? ` "${input.title.trim()}"` : '';
    const issue =
      `El punto${title} está clasificado como ${itemKind}; solo DECISORIO puede materializar un acuerdo. Reclasifica el punto antes de crear Acuerdo 360.`;
    blocking_issues.push(issue);
    explain.push(makeExplain(itemKind, 'BLOCKING', issue, input.orderNumber));
  }

  return {
    etapa: 'agenda_item',
    ok,
    severity,
    explain,
    blocking_issues,
    warnings,
    itemKind,
    gateMode,
    shouldRunAgreementGates,
    agreementAllowed,
    constanciaRequired,
    requiresVote,
    resolutionKind: shouldRunAgreementGates ? 'DECISION' : resolutionKindForAgendaItem(itemKind),
  };
}

export function shouldRunAgreementGatesForAgendaItem(input: AgendaItemEvaluationInput): boolean {
  return evaluarPuntoOrdenDia(input).shouldRunAgreementGates;
}
