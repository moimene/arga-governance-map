import type {
  EffectiveRuleResolution,
  EffectiveRuleSourceLayer,
  ExplainNode,
  Fuente,
  NormativePlane,
  ReglaParametro,
  RuleComparator,
  RuleParamOverride,
} from './types';

/**
 * Hierarchy: LEY > ESTATUTOS > PACTO_PARASOCIAL > REGLAMENTO
 *
 * Rules:
 * 1. Override can ELEVATE but never LOWER a legal minimum
 * 2. For numbers: higher value = more restrictive (for quorum/majority thresholds)
 * 3. For arrays: union = more restrictive (for required documents)
 * 4. Multiple overrides are resolved from lowest priority to highest
 */

export const FUENTE_PRIORITY: Record<Fuente, number> = {
  LEY: 100,
  ESTATUTOS: 80,
  PACTO_PARASOCIAL: 60,
  REGLAMENTO: 40,
  OVERRIDE_INTERNO: 20,
  SISTEMA: 0,
};

export function resolverReglaEfectiva<T>(
  reglaBase: ReglaParametro<T>,
  overrides: RuleParamOverride[] = [],
  comparador: RuleComparator = 'mayor'
): ReglaParametro<T> {
  // No overrides provided — return base unchanged
  if (!overrides || overrides.length === 0) {
    return { ...reglaBase };
  }

  // Sort overrides by source priority (lowest first, so highest wins)
  const sorted = [...overrides]
    .filter(o => FUENTE_PRIORITY[o.fuente] !== undefined)
    .sort((a, b) => FUENTE_PRIORITY[a.fuente] - FUENTE_PRIORITY[b.fuente]);

  let resultado = { ...reglaBase };

  for (const override of sorted) {
    const overrideValue = override.valor as T;
    const overrideFuente = override.fuente;
    const overridePriority = FUENTE_PRIORITY[overrideFuente];
    const basePriority = FUENTE_PRIORITY[resultado.fuente];

    // Cannot lower a legal minimum (override from lower-priority source)
    if (overridePriority < basePriority) {
      // Lower priority source trying to override — only apply if it elevates
      if (comparador === 'mayor') {
        if (
          typeof overrideValue === 'number' &&
          typeof resultado.valor === 'number'
        ) {
          if (overrideValue > resultado.valor) {
            // Elevation is allowed
            resultado = {
              valor: overrideValue,
              fuente: overrideFuente,
              referencia: override.referencia,
            };
          }
          // else: trying to lower — ignored, resultado unchanged
        }
      } else if (comparador === 'union') {
        // For union mode with lower priority: still merge arrays
        if (
          Array.isArray(overrideValue) &&
          Array.isArray(resultado.valor)
        ) {
          const union = [...new Set([...(resultado.valor as unknown[]), ...(overrideValue as unknown[])])];
          resultado = {
            valor: union as T,
            fuente: overrideFuente,
            referencia: override.referencia,
          };
        }
      } else if (comparador === 'override') {
        // For override mode: lower priority sources still apply (override any existing value)
        resultado = {
          valor: overrideValue,
          fuente: overrideFuente,
          referencia: override.referencia,
        };
      }
      // Skip further processing for lower-priority sources in mayor mode
      if (comparador !== 'override') continue;
    }

    // Same or higher (or equal) priority source — apply override logic
    switch (comparador) {
      case 'mayor': {
        // For numeric comparisons: higher priority source always wins
        // Same priority source applies only if value is higher
        if (
          typeof overrideValue === 'number' &&
          typeof resultado.valor === 'number'
        ) {
          const isHigherPriority = overridePriority > basePriority;
          const isHigherValue = overrideValue > resultado.valor;

          if (isHigherPriority || isHigherValue) {
            resultado = {
              valor: overrideValue,
              fuente: overrideFuente,
              referencia: override.referencia,
            };
          }
        }
        break;
      }

      case 'union': {
        // For arrays: union = more restrictive (merge and deduplicate)
        if (
          Array.isArray(overrideValue) &&
          Array.isArray(resultado.valor)
        ) {
          const union = [...new Set([...(resultado.valor as unknown[]), ...(overrideValue as unknown[])])];
          resultado = {
            valor: union as T,
            fuente: overrideFuente,
            referencia: override.referencia,
          };
        }
        break;
      }

      case 'override': {
        // Higher or equal priority always wins (for booleans, strings, or any type)
        resultado = {
          valor: overrideValue,
          fuente: overrideFuente,
          referencia: override.referencia,
        };
        break;
      }
    }
  }

  return resultado;
}

export interface ResolverReglaEfectivaOptions {
  path?: string;
  label?: string;
  /**
   * Por defecto los pactos se informan como capa contractual, pero no alteran
   * la validez societaria ni la regla efectiva societaria.
   */
  allowContractualAsEffective?: boolean;
  legalMinimum?: unknown;
}

function valueLabel(value: unknown) {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function planeForFuente(fuente: Fuente): NormativePlane {
  if (fuente === 'PACTO_PARASOCIAL') return 'CONTRACTUAL';
  if (fuente === 'OVERRIDE_INTERNO') return 'OPERATIVO';
  if (fuente === 'SISTEMA') return 'SISTEMA';
  return 'SOCIETARIO';
}

function layerFromRule<T>(
  rule: ReglaParametro<T>,
  params: {
    path: string;
    label: string;
    applied: boolean;
    reason: string;
    contractualOnly?: boolean;
  },
): EffectiveRuleSourceLayer {
  return {
    layer: rule.fuente,
    plane: planeForFuente(rule.fuente),
    path: params.path,
    label: params.label,
    value: rule.valor,
    reference: rule.referencia ?? null,
    applied: params.applied,
    contractual_only: params.contractualOnly || undefined,
    reason: params.reason,
  };
}

function layerFromOverride(
  override: RuleParamOverride,
  params: {
    path: string;
    label: string;
    applied: boolean;
    reason: string;
    contractualOnly?: boolean;
  },
): EffectiveRuleSourceLayer {
  return {
    layer: override.fuente,
    plane: planeForFuente(override.fuente),
    path: override.clave || params.path,
    label: params.label,
    value: override.valor,
    reference: override.referencia ?? null,
    applied: params.applied,
    contractual_only: params.contractualOnly || undefined,
    reason: params.reason,
  };
}

function explain(params: {
  regla: string;
  fuente: Fuente;
  referencia?: string | null;
  resultado: 'OK' | 'WARNING' | 'BLOCKING';
  mensaje: string;
  valor?: unknown;
}): ExplainNode {
  return {
    regla: params.regla,
    fuente: params.fuente,
    referencia: params.referencia ?? undefined,
    resultado: params.resultado,
    mensaje: params.mensaje,
    valor: params.valor === undefined ? undefined : valueLabel(params.valor),
  };
}

function isBelowLegalMinimum<T>(
  candidate: T,
  legalMinimum: unknown,
  comparador: RuleComparator,
) {
  if (comparador !== 'mayor') return false;
  return (
    typeof candidate === 'number' &&
    typeof legalMinimum === 'number' &&
    candidate < legalMinimum
  );
}

function isBooleanLegalDowngrade<T>(
  candidate: T,
  legalMinimum: unknown,
  comparador: RuleComparator,
) {
  if (comparador !== 'override') return false;
  return legalMinimum === true && candidate === false;
}

function applyCandidate<T>(
  current: ReglaParametro<T>,
  candidate: ReglaParametro<T>,
  comparador: RuleComparator,
): { applied: boolean; next: ReglaParametro<T>; reason: string } {
  const candidatePriority = FUENTE_PRIORITY[candidate.fuente];
  const currentPriority = FUENTE_PRIORITY[current.fuente];

  if (comparador === 'union') {
    if (Array.isArray(candidate.valor) && Array.isArray(current.valor)) {
      const union = [...new Set([...(current.valor as unknown[]), ...(candidate.valor as unknown[])])];
      return {
        applied: true,
        next: { ...candidate, valor: union as T },
        reason: 'Se incorporan requisitos documentales adicionales sin eliminar los ya exigidos.',
      };
    }
    return {
      applied: false,
      next: current,
      reason: 'No se aplica porque la regla no es una lista acumulable.',
    };
  }

  if (comparador === 'override') {
    return {
      applied: true,
      next: candidate,
      reason: 'Se aplica como configuración expresa, respetando el suelo legal validado previamente.',
    };
  }

  if (
    comparador === 'mayor' &&
    typeof candidate.valor === 'number' &&
    typeof current.valor === 'number'
  ) {
    const isHigherPriority = candidatePriority > currentPriority;
    const isHigherValue = candidate.valor > current.valor;
    if (isHigherPriority || isHigherValue) {
      return {
        applied: true,
        next: candidate,
        reason: isHigherPriority
          ? 'Prevalece por mayor jerarquía normativa.'
          : 'Se aplica por elevar el requisito efectivo.',
      };
    }
  }

  return {
    applied: false,
    next: current,
    reason: 'No modifica la regla efectiva por prioridad o por no elevar el requisito aplicable.',
  };
}

export function resolverReglaEfectivaConTrazabilidad<T>(
  reglaBase: ReglaParametro<T>,
  overrides: RuleParamOverride[] = [],
  comparador: RuleComparator = 'mayor',
  options: ResolverReglaEfectivaOptions = {},
): EffectiveRuleResolution<T> {
  const path = options.path ?? 'regla';
  const label = options.label ?? path;
  const legalMinimum = options.legalMinimum ?? (reglaBase.fuente === 'LEY' ? reglaBase.valor : undefined);
  const source_layers: EffectiveRuleSourceLayer[] = [
    layerFromRule(reglaBase, {
      path,
      label,
      applied: true,
      reason: 'Regla base aplicable.',
    }),
  ];
  const explain_nodes: ExplainNode[] = [
    explain({
      regla: `${path}.base`,
      fuente: reglaBase.fuente,
      referencia: reglaBase.referencia,
      resultado: 'OK',
      mensaje: `Regla base: ${valueLabel(reglaBase.valor)}.`,
      valor: reglaBase.valor,
    }),
  ];
  const blocking_issues: string[] = [];
  const warnings: string[] = [];

  const sorted = [...(overrides ?? [])]
    .filter((o) => FUENTE_PRIORITY[o.fuente] !== undefined)
    .sort((a, b) => FUENTE_PRIORITY[a.fuente] - FUENTE_PRIORITY[b.fuente]);

  let effective = { ...reglaBase };

  for (const override of sorted) {
    const candidate = {
      valor: override.valor as T,
      fuente: override.fuente,
      referencia: override.referencia,
    };

    const contractualOnly =
      override.fuente === 'PACTO_PARASOCIAL' && options.allowContractualAsEffective !== true;

    if (contractualOnly) {
      const message =
        'Pacto parasocial aplicable como obligación contractual; no altera la validez societaria del acuerdo.';
      warnings.push(message);
      source_layers.push(layerFromOverride(override, {
        path,
        label,
        applied: false,
        contractualOnly: true,
        reason: message,
      }));
      explain_nodes.push(explain({
        regla: `${override.clave || path}.pacto_contractual`,
        fuente: override.fuente,
        referencia: override.referencia,
        resultado: 'WARNING',
        mensaje: message,
        valor: override.valor,
      }));
      continue;
    }

    if (
      isBelowLegalMinimum(candidate.valor, legalMinimum, comparador) ||
      isBooleanLegalDowngrade(candidate.valor, legalMinimum, comparador)
    ) {
      const issue =
        `override_below_legal_minimum:${override.clave || path}:${valueLabel(override.valor)}<${valueLabel(legalMinimum)}`;
      blocking_issues.push(issue);
      source_layers.push(layerFromOverride(override, {
        path,
        label,
        applied: false,
        reason: 'No se aplica porque rebaja un mínimo legal.',
      }));
      explain_nodes.push(explain({
        regla: `${override.clave || path}.legal_floor`,
        fuente: override.fuente,
        referencia: override.referencia,
        resultado: 'BLOCKING',
        mensaje: 'La personalización intenta rebajar un mínimo legal y queda bloqueada.',
        valor: override.valor,
      }));
      continue;
    }

    const applied = applyCandidate(effective, candidate, comparador);
    effective = applied.next;
    source_layers.push(layerFromOverride(override, {
      path,
      label,
      applied: applied.applied,
      reason: applied.reason,
    }));
    explain_nodes.push(explain({
      regla: `${override.clave || path}.override`,
      fuente: override.fuente,
      referencia: override.referencia,
      resultado: applied.applied ? 'OK' : 'WARNING',
      mensaje: applied.reason,
      valor: override.valor,
    }));
  }

  const severity = blocking_issues.length > 0 ? 'BLOCKING' : warnings.length > 0 ? 'WARNING' : 'OK';

  return {
    ok: blocking_issues.length === 0,
    severity,
    effective_rule: effective,
    summary: {
      path,
      label,
      comparator: comparador,
      legal_minimum: legalMinimum,
      effective_value: effective.valor,
      effective_source: effective.fuente,
      effective_reference: effective.referencia ?? null,
    },
    source_layers,
    explain_nodes,
    blocking_issues,
    warnings,
  };
}
