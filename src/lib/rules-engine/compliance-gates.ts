import type {
  AgendaItemEvaluationInput,
  ComplianceGateKind,
  ComplianceGateResult,
  ComplianceGateStatus,
  CompliancePanelResult,
  EffectiveRuleResolution,
  EvaluacionResult,
  ExplainNode,
  Fuente,
} from './types';
import { evaluarPuntoOrdenDia } from './agenda-item-engine';

const STAGE_TO_GATE: Record<string, ComplianceGateKind> = {
  convocatoria: 'convocation',
  convocatoria_skip: 'convocation',
  constitucion: 'constitution',
  constitucion_skip: 'constitution',
  votacion: 'majority',
  documentacion: 'documentation',
  postAcuerdo: 'formalization',
};

const GATE_LABELS: Record<ComplianceGateKind, string> = {
  routing: 'Tipo de punto',
  convocation: 'Convocatoria',
  constitution: 'Constitución de la sesión',
  quorum: 'Quórum',
  conflict: 'Conflictos de interés',
  majority: 'Mayoría y votación',
  unanimity: 'Unanimidad',
  documentation: 'Documentación',
  formalization: 'Formalización',
  registry: 'Registro',
  publication: 'Publicación',
  contractual: 'Obligaciones contractuales',
};

function firstExplain(result: Pick<EvaluacionResult, 'explain'>): ExplainNode | null {
  return result.explain[0] ?? null;
}

function statusFromSeverity(severity: EvaluacionResult['severity']): ComplianceGateStatus {
  if (severity === 'BLOCKING') return 'BLOCKING';
  if (severity === 'WARNING') return 'WARNING';
  return 'OK';
}

function defaultMessage(result: EvaluacionResult, label: string) {
  const first = firstExplain(result);
  if (first?.mensaje) return first.mensaje;
  if (result.ok) return `${label}: requisito cumplido.`;
  return `${label}: requisito pendiente o no cumplido.`;
}

export function gateFromEvaluation(
  result: EvaluacionResult,
  options: {
    kind?: ComplianceGateKind;
    label?: string;
    notApplicable?: boolean;
    source?: Fuente;
    reference?: string | null;
  } = {},
): ComplianceGateResult {
  const kind = options.kind ?? STAGE_TO_GATE[result.etapa] ?? 'formalization';
  const label = options.label ?? GATE_LABELS[kind];
  const status = options.notApplicable ? 'NOT_APPLICABLE' : statusFromSeverity(result.severity);
  const explain = firstExplain(result);

  return {
    kind,
    label,
    status,
    ok: result.ok,
    blocksProgress: status === 'BLOCKING',
    notApplicable: options.notApplicable || undefined,
    message: defaultMessage(result, label),
    source: options.source ?? explain?.fuente,
    reference: options.reference ?? explain?.referencia ?? null,
    explain: result.explain,
    blocking_issues: result.blocking_issues,
    warnings: result.warnings,
  };
}

export function evaluateAgendaItemComplianceGate(
  input: AgendaItemEvaluationInput,
): {
  gate: ComplianceGateResult;
  shouldRunAgreementGates: boolean;
  agreementAllowed: boolean;
} {
  const result = evaluarPuntoOrdenDia(input);
  const gate = gateFromEvaluation(result, {
    kind: 'routing',
    label: 'Punto del orden del día',
    notApplicable: !result.shouldRunAgreementGates && result.ok,
  });

  return {
    gate: {
      ...gate,
      message: result.shouldRunAgreementGates
        ? 'El punto es decisorio y puede generar acuerdo.'
        : result.ok
          ? 'El punto genera constancia, no acuerdo.'
          : gate.message,
    },
    shouldRunAgreementGates: result.shouldRunAgreementGates,
    agreementAllowed: result.agreementAllowed,
  };
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function nextActionsFromGates(gates: ComplianceGateResult[]) {
  const actions: string[] = [];
  for (const gate of gates) {
    if (!gate.blocksProgress) continue;
    if (gate.kind === 'routing') actions.push('Revisar el tipo del punto del orden del día antes de crear o mantener el acuerdo.');
    if (gate.kind === 'convocation') actions.push('Completar o corregir convocatoria y documentación previa.');
    if (gate.kind === 'constitution' || gate.kind === 'quorum') actions.push('Completar constitución de la sesión y quórum.');
    if (gate.kind === 'majority' || gate.kind === 'unanimity') actions.push('Registrar resultado de votación, mayoría aplicada y proclamación.');
    if (gate.kind === 'documentation') actions.push('Completar documentos obligatorios y datos mínimos del acta.');
    if (gate.kind === 'formalization' || gate.kind === 'registry') actions.push('Completar formalización, instrumento o tramitación registral exigida.');
  }
  if (actions.length === 0) actions.push('No hay bloqueos societarios; continuar con la siguiente fase del expediente.');
  return unique(actions);
}

export function buildCompliancePanelResult(params: {
  gates: ComplianceGateResult[];
  effectiveRule?: EffectiveRuleResolution;
  warnings?: string[];
  blockingIssues?: string[];
}): CompliancePanelResult {
  const ruleIssues = params.effectiveRule?.blocking_issues ?? [];
  const ruleWarnings = params.effectiveRule?.warnings ?? [];
  const blocking_issues = unique([
    ...(params.blockingIssues ?? []),
    ...params.gates.flatMap((gate) => gate.blocking_issues),
    ...ruleIssues,
  ]);
  const warnings = unique([
    ...(params.warnings ?? []),
    ...params.gates.flatMap((gate) => gate.warnings),
    ...ruleWarnings,
  ]);
  const can_advance = !params.gates.some((gate) => gate.blocksProgress) && blocking_issues.length === 0;

  return {
    ok: can_advance,
    can_advance,
    gates: params.gates,
    blocking_issues,
    warnings,
    next_actions: nextActionsFromGates(params.gates),
    effective_rule: params.effectiveRule,
  };
}
