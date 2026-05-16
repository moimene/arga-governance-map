import type {
  EffectiveRuleResolution,
  EffectiveRuleSourceLayer,
  ExplainNode,
  ReglaParametro,
  RulePack,
  RuleParamOverride,
  TipoSocial,
} from './types';
import { resolverReglaEfectivaConTrazabilidad } from './jerarquia-normativa';

export interface EffectiveRuleProjection {
  materia: string;
  organoTipo: string;
  tipoSocial: TipoSocial;
  notice_days: number | null;
  quorum: number | string | null;
  majority_formula: string | null;
  required_documents: string[];
  instrument_required: RulePack['postAcuerdo']['instrumentoRequerido'];
  registry_required: boolean;
  publication_required: boolean;
  source_layers: EffectiveRuleSourceLayer[];
  explain_nodes: ExplainNode[];
  blocking_issues: string[];
  warnings: string[];
}

function overridesFor(overrides: RuleParamOverride[], path: string) {
  return overrides.filter((override) => override.clave === path || override.clave.endsWith(`.${path}`));
}

function mergeResolution<T>(
  acc: {
    source_layers: EffectiveRuleSourceLayer[];
    explain_nodes: ExplainNode[];
    blocking_issues: string[];
    warnings: string[];
  },
  resolution: EffectiveRuleResolution<T>,
) {
  acc.source_layers.push(...resolution.source_layers);
  acc.explain_nodes.push(...resolution.explain_nodes);
  acc.blocking_issues.push(...resolution.blocking_issues);
  acc.warnings.push(...resolution.warnings);
}

export function buildEffectiveRuleProjection(params: {
  pack: RulePack;
  tipoSocial: TipoSocial;
  overrides?: RuleParamOverride[];
}): EffectiveRuleProjection {
  const { pack, tipoSocial } = params;
  const overrides = params.overrides ?? [];
  const trace = {
    source_layers: [] as EffectiveRuleSourceLayer[],
    explain_nodes: [] as ExplainNode[],
    blocking_issues: [] as string[],
    warnings: [] as string[],
  };

  const noticeBase = pack.convocatoria.antelacionDias[tipoSocial] ?? null;
  const notice = noticeBase
    ? resolverReglaEfectivaConTrazabilidad(noticeBase, overridesFor(overrides, 'convocatoria.antelacionDias'), 'mayor', {
      path: 'convocatoria.antelacionDias',
      label: 'Plazo de convocatoria',
    })
    : null;
  if (notice) mergeResolution(trace, notice);

  const quorumPath = tipoSocial === 'SA' || tipoSocial === 'SAU'
    ? 'constitucion.quorum.SA_1a'
    : 'constitucion.quorum.SL';
  const quorumBase = tipoSocial === 'SA' || tipoSocial === 'SAU'
    ? pack.constitucion.quorum.SA_1a
    : pack.constitucion.quorum.SL;
  const quorum = resolverReglaEfectivaConTrazabilidad(quorumBase, overridesFor(overrides, quorumPath), 'mayor', {
    path: quorumPath,
    label: 'Quórum de constitución',
  });
  mergeResolution(trace, quorum);

  const majorityBase = pack.votacion.mayoria[tipoSocial === 'SAU' ? 'SA' : tipoSocial === 'SLU' ? 'SL' : tipoSocial] ??
    pack.votacion.mayoria.SL ??
    pack.votacion.mayoria.SA;
  const majorityRule: ReglaParametro<string> | null = majorityBase
    ? {
      valor: majorityBase.formula,
      fuente: majorityBase.fuente,
      referencia: majorityBase.referencia,
    }
    : null;
  const majority = majorityRule
    ? resolverReglaEfectivaConTrazabilidad(majorityRule, overridesFor(overrides, 'votacion.mayoria'), 'override', {
      path: 'votacion.mayoria',
      label: 'Mayoría requerida',
    })
    : null;
  if (majority) mergeResolution(trace, majority);

  const documentsBase: ReglaParametro<string[]> = {
    valor: pack.documentacion.obligatoria.map((doc) => doc.id),
    fuente: 'LEY',
    referencia: pack.documentacion.obligatoria.map((doc) => doc.condicion).filter(Boolean).join('; ') || undefined,
  };
  const documents = resolverReglaEfectivaConTrazabilidad(documentsBase, overridesFor(overrides, 'documentacion.obligatoria'), 'union', {
    path: 'documentacion.obligatoria',
    label: 'Documentos obligatorios',
  });
  mergeResolution(trace, documents);

  return {
    materia: pack.materia,
    organoTipo: pack.organoTipo,
    tipoSocial,
    notice_days: notice?.effective_rule.valor ?? null,
    quorum: quorum.effective_rule.valor,
    majority_formula: majority?.effective_rule.valor ?? null,
    required_documents: documents.effective_rule.valor,
    instrument_required: pack.postAcuerdo.instrumentoRequerido,
    registry_required: pack.postAcuerdo.inscribible,
    publication_required: pack.postAcuerdo.publicacionRequerida,
    source_layers: trace.source_layers,
    explain_nodes: trace.explain_nodes,
    blocking_issues: Array.from(new Set(trace.blocking_issues)),
    warnings: Array.from(new Set(trace.warnings)),
  };
}
