import type { Fuente, ReglaParametro, RuleParamOverride } from './types';

/**
 * Hierarchy: LEY > ESTATUTOS > PACTO_PARASOCIAL > REGLAMENTO
 *
 * Rules:
 * 1. Override can ELEVATE but never LOWER a legal minimum
 * 2. For numbers: higher value = more restrictive (for quorum/majority thresholds)
 * 3. For arrays: union = more restrictive (for required documents)
 * 4. Multiple overrides are resolved from lowest priority to highest
 */

const FUENTE_PRIORITY: Record<Fuente, number> = {
  LEY: 100,
  ESTATUTOS: 80,
  PACTO_PARASOCIAL: 60,
  REGLAMENTO: 40,
};

export function resolverReglaEfectiva<T>(
  reglaBase: ReglaParametro<T>,
  overrides: RuleParamOverride[] = [],
  comparador: 'mayor' | 'union' | 'override' = 'mayor'
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
