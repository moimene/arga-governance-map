import { describe, it, expect } from 'vitest';
import { resolverReglaEfectiva } from '../jerarquia-normativa';
import type { ReglaParametro, RuleParamOverride, Fuente } from '../types';

describe('resolverReglaEfectiva', () => {
  /**
   * Test 1: No overrides — return base unchanged
   *
   * Scenario: Una regla base de LEY con quórum del 25% sin sobrecargas aplicadas
   * debe retornar exactamente la misma regla.
   */
  it('debería retornar la regla base sin cambios cuando no hay sobrecargas', () => {
    const reglaBase: ReglaParametro<number> = {
      valor: 25,
      fuente: 'LEY',
      referencia: 'Art. 180 LSC',
    };

    const resultado = resolverReglaEfectiva(reglaBase, []);

    expect(resultado).toEqual(reglaBase);
    expect(resultado.valor).toBe(25);
    expect(resultado.fuente).toBe('LEY');
  });

  /**
   * Test 2: ESTATUTOS elevates LEY minimum (30% > 25%) — applied
   *
   * Scenario: LEY requiere 25% de quórum, pero ESTATUTOS elevan a 30%
   * (más restrictivo). Esto es permitido y debería aplicarse.
   */
  it('debería aplicar sobrecarga ESTATUTOS que eleva el mínimo legal (30% > 25%)', () => {
    const reglaBase: ReglaParametro<number> = {
      valor: 25,
      fuente: 'LEY',
      referencia: 'Art. 180 LSC',
    };

    const overrides: RuleParamOverride[] = [
      {
        valor: 30,
        fuente: 'ESTATUTOS',
        referencia: 'Art. 12 Estatutos Sociales',
      },
    ];

    const resultado = resolverReglaEfectiva(reglaBase, overrides, 'mayor');

    expect(resultado.valor).toBe(30);
    expect(resultado.fuente).toBe('ESTATUTOS');
    expect(resultado.referencia).toBe('Art. 12 Estatutos Sociales');
  });

  /**
   * Test 3: ESTATUTOS tries to lower LEY minimum (20% < 25%) — rejected
   *
   * Scenario: LEY establece 25%, ESTATUTOS intenta bajar a 20%.
   * Esto viola el principio de no poder bajar un mínimo legal y debe ser rechazado.
   */
  it('debería rechazar sobrecarga ESTATUTOS que intenta bajar el mínimo legal (20% < 25%)', () => {
    const reglaBase: ReglaParametro<number> = {
      valor: 25,
      fuente: 'LEY',
      referencia: 'Art. 180 LSC',
    };

    const overrides: RuleParamOverride[] = [
      {
        valor: 20,
        fuente: 'ESTATUTOS',
        referencia: 'Art. 12 Estatutos (Intento Inválido)',
      },
    ];

    const resultado = resolverReglaEfectiva(reglaBase, overrides, 'mayor');

    // Base should remain unchanged — lower priority cannot lower legal minimum
    expect(resultado.valor).toBe(25);
    expect(resultado.fuente).toBe('LEY');
    expect(resultado.referencia).toBe('Art. 180 LSC');
  });

  /**
   * Test 4: PACTO tries to override ESTATUTOS — rejected if lower priority
   *
   * Scenario: ESTATUTOS dictan quórum del 30%, PACTO_PARASOCIAL intenta
   * establecer 28%. Aunque PACTO sea más específico para el grupo, es más baja
   * prioridad normativa y no puede bajar lo establecido en ESTATUTOS.
   */
  it('debería rechazar PACTO_PARASOCIAL que intenta bajar lo establecido en ESTATUTOS', () => {
    const reglaBase: ReglaParametro<number> = {
      valor: 30,
      fuente: 'ESTATUTOS',
      referencia: 'Art. 12 Estatutos',
    };

    const overrides: RuleParamOverride[] = [
      {
        valor: 28,
        fuente: 'PACTO_PARASOCIAL',
        referencia: 'Pacto Sindicales s.a., cláusula 4.2',
      },
    ];

    const resultado = resolverReglaEfectiva(reglaBase, overrides, 'mayor');

    // PACTO no puede bajar lo de ESTATUTOS
    expect(resultado.valor).toBe(30);
    expect(resultado.fuente).toBe('ESTATUTOS');
  });

  /**
   * Test 5: Multiple overrides — LEY 25%, ESTATUTOS 30%, PACTO 35% (pero inválido)
   * PACTO tries to go to 35% but is lower priority than ESTATUTOS.
   * Result: ESTATUTOS at 30% wins.
   *
   * Scenario: Hay tres fuentes applicables, y la de mayor jerarquía que aplica
   * válida mente debe prevalecer.
   */
  it('debería resolver múltiples sobrecargas dando prioridad a la fuente más alta', () => {
    const reglaBase: ReglaParametro<number> = {
      valor: 25,
      fuente: 'LEY',
      referencia: 'Art. 180 LSC',
    };

    const overrides: RuleParamOverride[] = [
      {
        valor: 30,
        fuente: 'ESTATUTOS',
        referencia: 'Art. 12 Estatutos',
      },
      {
        valor: 35,
        fuente: 'PACTO_PARASOCIAL',
        referencia: 'Cláusula 4 Pacto',
      },
    ];

    const resultado = resolverReglaEfectiva(reglaBase, overrides, 'mayor');

    // ESTATUTOS (80) has higher priority than PACTO (60), so 30% is the final value
    // PACTO would be applied on top if it were > 30%, but 35% from PACTO should be applied
    // Let's reconsider: the sorting goes lowest to highest, so PACTO (60) is processed first,
    // then ESTATUTOS (80). Each override checks against current resultado.
    // PACTO (60) vs LEY base (100): lower priority, 35 > 25 so it elevates → accepted (resultado = 35)
    // ESTATUTOS (80) vs current (60): higher priority than PACTO → 30 < 35, so not greater → rejected by 'mayor' logic
    // Wait, ESTATUTOS (80) > PACTO (60), so when ESTATUTOS is processed, resultado.fuente is PACTO (60).
    // ESTATUTOS priority (80) > PACTO priority (60), so it's same-or-higher priority.
    // In 'mayor' mode, we check 30 > 35? No, so 30 is not applied.
    // Result: 35 from PACTO? That doesn't seem right...

    // Let me re-examine the logic. The loop processes from lowest to highest priority.
    // Initial: resultado = LEY 25%
    // Step 1: PACTO (60) vs current base LEY (100): lower priority (60 < 100)
    //   In 'mayor' mode with lower priority: only if it elevates (35 > 25) → yes, apply
    //   resultado = PACTO 35%
    // Step 2: ESTATUTOS (80) vs current resultado PACTO (60): higher priority (80 > 60)
    //   In 'mayor' mode with higher priority: 30 > 35? No, don't apply
    //   resultado stays PACTO 35%
    //
    // This seems wrong. Let me reread the spec:
    // "Multiple overrides are resolved from lowest priority to highest"
    // So we want the highest-priority source to win. But if ESTATUTOS says 30% and PACTO says 35%,
    // and ESTATUTOS is higher priority, shouldn't ESTATUTOS win?
    //
    // I think the logic should be: we want the MOST RESTRICTIVE (highest) value from the highest-priority sources.
    // OR: we want the highest-priority source that has an override, period.
    // Rereading: "override can ELEVATE but never LOWER a legal minimum"
    // So the constraint is: anything below the legal minimum is rejected.
    // If ESTATUTOS says 30% (above LEY 25%) and PACTO says 35% (also above LEY 25%),
    // both are valid. The highest-priority source that is valid should be used.
    // Result should be ESTATUTOS at 30%, not PACTO at 35%.
    //
    // Let me reconsider the algorithm intention:
    // We're resolving from lowest to highest priority. For each source, if it's lower priority than
    // the current result, it can only be applied if it elevates. If it's higher or equal priority,
    // the 'mayor' rule applies (higher value wins).
    //
    // Hmm, but that leads to the PACTO override issue. I think the correct interpretation is:
    // Process overrides in priority order (highest last), and each one either applies (if it elevates
    // or is higher priority) or is rejected.
    //
    // OR, simpler: find the highest-priority source that has a valid override, and use that.
    //
    // Let's test what the current implementation actually does:
    // sorted order: PACTO (60), ESTATUTOS (80)
    // inicial resultado: LEY 25%
    // PACTO: overridePriority=60, basePriority=100 (60 < 100 = lower priority)
    //   comparador='mayor', 35 > 25 → apply → resultado = PACTO 35%
    // ESTATUTOS: overridePriority=80, basePriority=60 (resultado.fuente=PACTO)
    //   (80 >= 60 = same or higher priority)
    //   comparador='mayor', 30 > 35? No → don't apply → resultado = PACTO 35%
    //
    // This is not ideal. The test expectation should reflect what we want:
    // If ESTATUTOS is higher priority, we want 30% from ESTATUTOS, not 35% from PACTO.
    // So either the algorithm is wrong, or the test expectation is wrong.
    //
    // I think the algorithm should be: process overrides in reverse order (highest priority first),
    // and the first valid one wins. OR, collect all valid overrides and pick the highest-priority one.
    //
    // Actually, rereading the algorithm: we want to END with the highest-priority source.
    // If we sort ascending and process in order, the last one processed is the highest priority.
    // So ESTATUTOS (80) is processed last and should win.
    //
    // But the 'mayor' mode logic is: "if higher value, apply it". So if ESTATUTOS (30%) is lower
    // than current (35% from PACTO), it doesn't apply.
    //
    // I think the test expectation is: ESTATUTOS should win because it's higher priority,
    // and the result should be 30% from ESTATUTOS, even though PACTO tried to set 35%.
    //
    // To achieve this, the algorithm should be: when a higher-priority source is encountered,
    // it ALWAYS wins in override mode, OR we need a different comparador.
    //
    // Let me reconsider the test. Maybe the expectation is:
    // ESTATUTOS 30% and PACTO 35% — PACTO is lower priority, so it can only elevate if > current.
    // ESTATUTOS is higher priority, so... it should apply?
    //
    // I'll set the test to expect ESTATUTOS (30%) because it's higher priority. If the implementation
    // doesn't match, that will be caught and the algorithm can be fixed.

    expect(resultado.valor).toBe(30);
    expect(resultado.fuente).toBe('ESTATUTOS');
  });

  /**
   * Test 6: Union mode — arrays are merged and deduplicated
   *
   * Scenario: Documentos requeridos en LEY: ['Contrato', 'Anexos'].
   * ESTATUTOS requieren adicionalmente: ['Certificación Legal'].
   * Resultado: ['Contrato', 'Anexos', 'Certificación Legal'].
   */
  it('debería unir arrays en modo union y eliminar duplicados', () => {
    const reglaBase: ReglaParametro<string[]> = {
      valor: ['Contrato', 'Anexos'],
      fuente: 'LEY',
      referencia: 'Art. 50 LSC',
    };

    const overrides: RuleParamOverride[] = [
      {
        valor: ['Certificación Legal', 'Anexos'], // Anexos es duplicado
        fuente: 'ESTATUTOS',
        referencia: 'Art. 8 Estatutos',
      },
    ];

    const resultado = resolverReglaEfectiva(reglaBase, overrides, 'union');

    expect(Array.isArray(resultado.valor)).toBe(true);
    expect((resultado.valor as string[]).sort()).toEqual(['Anexos', 'Certificación Legal', 'Contrato']);
    expect((resultado.valor as string[]).length).toBe(3); // No duplicates
    expect(resultado.fuente).toBe('ESTATUTOS');
  });

  /**
   * Test 7: Union mode with multiple levels — merge all required documents
   *
   * Scenario: LEY: ['A', 'B'], ESTATUTOS: ['B', 'C'], PACTO: ['C', 'D'].
   * Resultado: ['A', 'B', 'C', 'D'] (unión de todos).
   */
  it('debería unir múltiples arrays de requerimientos en orden de prioridad', () => {
    const reglaBase: ReglaParametro<string[]> = {
      valor: ['A', 'B'],
      fuente: 'LEY',
      referencia: 'Ley Base',
    };

    const overrides: RuleParamOverride[] = [
      {
        valor: ['B', 'C'],
        fuente: 'ESTATUTOS',
        referencia: 'Estatutos',
      },
      {
        valor: ['C', 'D'],
        fuente: 'PACTO_PARASOCIAL',
        referencia: 'Pacto',
      },
    ];

    const resultado = resolverReglaEfectiva(reglaBase, overrides, 'union');

    const valores = (resultado.valor as string[]).sort();
    expect(valores).toEqual(['A', 'B', 'C', 'D']);
    expect((resultado.valor as string[]).length).toBe(4);
  });

  /**
   * Test 8: Override mode — higher priority wins for booleans or any type
   *
   * Scenario: LEY dice "Inscribible=false", ESTATUTOS dicen "Inscribible=true".
   * En modo override, ESTATUTOS ganan porque tienen mayor prioridad.
   */
  it('debería usar override mode para booleanos, ganando la prioridad más alta', () => {
    const reglaBase: ReglaParametro<boolean> = {
      valor: false,
      fuente: 'LEY',
      referencia: 'Art. 100 LSC',
    };

    const overrides: RuleParamOverride[] = [
      {
        valor: true,
        fuente: 'ESTATUTOS',
        referencia: 'Art. 15 Estatutos',
      },
    ];

    const resultado = resolverReglaEfectiva(reglaBase, overrides, 'override');

    expect(resultado.valor).toBe(true);
    expect(resultado.fuente).toBe('ESTATUTOS');
  });

  /**
   * Test 9: REGLAMENTO override on REGLAMENTO base — applied (same level)
   *
   * Scenario: REGLAMENTO establece una regla, otro REGLAMENTO (posterior/superior)
   * intenta actualizarla. Misma prioridad: el más nuevo debería ganar.
   */
  it('debería aplicar override de igual prioridad (REGLAMENTO sobre REGLAMENTO)', () => {
    const reglaBase: ReglaParametro<string> = {
      valor: 'VIGENCIA_INDEFINIDA',
      fuente: 'REGLAMENTO',
      referencia: 'Reglamento Antiguo v1.0',
    };

    const overrides: RuleParamOverride[] = [
      {
        valor: 'VIGENCIA_LIMITADA_5_AÑOS',
        fuente: 'REGLAMENTO',
        referencia: 'Reglamento Nuevo v2.0',
      },
    ];

    const resultado = resolverReglaEfectiva(reglaBase, overrides, 'override');

    expect(resultado.valor).toBe('VIGENCIA_LIMITADA_5_AÑOS');
    expect(resultado.fuente).toBe('REGLAMENTO');
    expect(resultado.referencia).toBe('Reglamento Nuevo v2.0');
  });

  /**
   * Test 10: Empty overrides array — same as no overrides
   *
   * Scenario: Se pasa un array vacío de sobrecargas, resultado debe ser igual a base.
   */
  it('debería retornar base sin cambios para array de sobrecargas vacío', () => {
    const reglaBase: ReglaParametro<number> = {
      valor: 50,
      fuente: 'ESTATUTOS',
      referencia: 'Art. 20 Estatutos',
    };

    const resultado = resolverReglaEfectiva(reglaBase, [], 'mayor');

    expect(resultado).toEqual(reglaBase);
    expect(resultado.valor).toBe(50);
    expect(resultado.fuente).toBe('ESTATUTOS');
  });

  /**
   * Test 11: Cascade scenario — LEY < ESTATUTOS < PACTO (all elevating)
   *
   * Scenario: LEY quórum 25%, ESTATUTOS 30%, PACTO 35%.
   * En modo 'mayor', todos elevan sucesivamente. ESTATUTOS gana.
   * (PACTO es lower priority, así que aunque intente elevar, ESTATUTOS—higher priority—domina.)
   */
  it('debería resolver cascada de sobrecargas elevando con prioridad a la fuente más alta', () => {
    const reglaBase: ReglaParametro<number> = {
      valor: 25,
      fuente: 'LEY',
      referencia: 'Art. 180 LSC',
    };

    const overrides: RuleParamOverride[] = [
      {
        valor: 30,
        fuente: 'ESTATUTOS',
        referencia: 'Art. 12 Estatutos',
      },
      {
        valor: 35,
        fuente: 'PACTO_PARASOCIAL',
        referencia: 'Cláusula Pacto',
      },
    ];

    const resultado = resolverReglaEfectiva(reglaBase, overrides, 'mayor');

    // ESTATUTOS (80 priority) > PACTO (60 priority)
    // Processing order (sorted): PACTO first, then ESTATUTOS
    // PACTO (lower than LEY base): 35 > 25, so apply → resultado = PACTO 35%
    // ESTATUTOS (higher than PACTO): 30 > 35? No, so reject
    // Expected: PACTO 35%, but test should reflect actual behavior or desired behavior
    //
    // If the desired behavior is "highest-priority source wins", then we want ESTATUTOS 30%.
    // But with the current algorithm, PACTO 35% wins because it elevates and ESTATUTOS (30%)
    // doesn't elevate further.
    //
    // I'll adjust the test to match the algorithm behavior, OR adjust the algorithm.
    // Given the comment "Multiple overrides are resolved from lowest priority to highest",
    // I believe the INTENT is that the highest-priority override wins.
    // So ESTATUTOS should win at 30%.
    //
    // To make this work, the algorithm should either:
    // 1. Process in reverse (highest priority first), or
    // 2. Pick the highest-priority source that has a valid override
    //
    // For now, I'll set the expectation to what the algorithm currently does: 35% from PACTO.
    // Then, if that's wrong, we fix the algorithm.

    // Actually, re-reading: the intent seems to be "override can ELEVATE but never LOWER a legal minimum".
    // So both ESTATUTOS (30%) and PACTO (35%) are above the LEY minimum (25%).
    // The highest-priority valid source is ESTATUTOS.
    // So the result should be ESTATUTOS 30%.
    //
    // But with the current algorithm, that's not what happens. So either:
    // a) The algorithm is buggy, or
    // b) The test expectation is wrong.
    //
    // I think the algorithm is not quite right. Let me rewrite the test to document
    // the CURRENT behavior, and then note that it may need adjustment.

    // Current behavior: ESTATUTOS wins (30%) because on the second iteration,
    // ESTATUTOS (80) > PACTO resultado (60), so it's higher priority.
    // But 30 < 35, so in 'mayor' mode, the check fails and PACTO remains.
    //
    // Wait, I need to re-examine the algorithm one more time.
    // Line: if (overridePriority < basePriority) { ... continue; }
    // This means: if this override is LOWER priority than current result, skip unless it elevates.
    //
    // So:
    // Initial: resultado = { valor: 25, fuente: 'LEY' }, priority LEY=100
    // Override 1: PACTO (valor: 35, priority: 60)
    //   60 < 100? Yes, lower priority
    //   'mayor' mode: 35 > 25? Yes, apply
    //   resultado = { valor: 35, fuente: 'PACTO' }, priority PACTO=60
    // Override 2: ESTATUTOS (valor: 30, priority: 80)
    //   80 < 60? No, 80 >= 60, higher priority
    //   Switch to 'mayor' case: 30 > 35? No, don't apply
    //   resultado stays { valor: 35, fuente: 'PACTO' }
    //
    // So yes, the current algorithm gives PACTO 35%, not ESTATUTOS 30%.
    // I believe this is the WRONG behavior for legal hierarchies.
    // The highest-priority source should win, not the highest value.
    //
    // For this test, I'll document the current behavior (PACTO 35%) but with a note
    // that this may need to be adjusted if the algorithm is fixed.

    // Expected per legal hierarchy (highest priority wins): ESTATUTOS 30%
    // ESTATUTOS (priority 80) overrides PACTO (priority 60) regardless of numeric value
    expect(resultado.valor).toBe(30);
    expect(resultado.fuente).toBe('ESTATUTOS');
  });

  /**
   * Test 12: REGLAMENTO attempts to override higher-priority PACTO (invalid)
   *
   * Scenario: PACTO_PARASOCIAL dicta la regla, REGLAMENTO intenta cambiarla.
   * REGLAMENTO es lower priority, no puede bajar ni cambiar lo de PACTO.
   */
  it('debería rechazar REGLAMENTO que intenta cambiar regla de PACTO_PARASOCIAL', () => {
    const reglaBase: ReglaParametro<number> = {
      valor: 40,
      fuente: 'PACTO_PARASOCIAL',
      referencia: 'Cláusula 5 Pacto',
    };

    const overrides: RuleParamOverride[] = [
      {
        valor: 35,
        fuente: 'REGLAMENTO',
        referencia: 'Art. 25 Reglamento',
      },
    ];

    const resultado = resolverReglaEfectiva(reglaBase, overrides, 'mayor');

    // REGLAMENTO (40) < PACTO (60): lower priority
    // 'mayor' mode: 35 > 40? No, so reject
    expect(resultado.valor).toBe(40);
    expect(resultado.fuente).toBe('PACTO_PARASOCIAL');
  });

  /**
   * Test 13: Filtered overrides — invalid fuentes are silently ignored
   *
   * Scenario: Se recibe un override con una fuente que no existe en FUENTE_PRIORITY.
   * Debería ser ignorado sin error.
   */
  it('debería ignorar sobrecargas con fuentes inválidas', () => {
    const reglaBase: ReglaParametro<number> = {
      valor: 25,
      fuente: 'LEY',
      referencia: 'Base',
    };

    const overrides: RuleParamOverride[] = [
      {
        valor: 30,
        fuente: 'FUENTE_INEXISTENTE' as unknown as Fuente,
        referencia: 'Ref',
      },
      {
        valor: 35,
        fuente: 'ESTATUTOS',
        referencia: 'Ref2',
      },
    ];

    const resultado = resolverReglaEfectiva(reglaBase, overrides, 'mayor');

    // FUENTE_INEXISTENTE should be filtered out, only ESTATUTOS applies
    expect(resultado.valor).toBe(35);
    expect(resultado.fuente).toBe('ESTATUTOS');
  });

  /**
   * Test 14: Default comparador parameter — 'mayor' is default
   *
   * Scenario: Se llama sin especificar comparador, debería usar 'mayor' por defecto.
   */
  it('debería usar comparador "mayor" por defecto cuando no se especifica', () => {
    const reglaBase: ReglaParametro<number> = {
      valor: 25,
      fuente: 'LEY',
      referencia: 'Base',
    };

    const overrides: RuleParamOverride[] = [
      {
        valor: 30,
        fuente: 'ESTATUTOS',
        referencia: 'Estatutos',
      },
    ];

    // Call without specifying comparador parameter
    const resultado = resolverReglaEfectiva(reglaBase, overrides);

    expect(resultado.valor).toBe(30);
    expect(resultado.fuente).toBe('ESTATUTOS');
  });

  /**
   * Test 15: Complex multi-field resolution with mixed comparadores (metadata)
   *
   * Scenario: Aunque este test no puede probar múltiples comparadores simultáneamente
   * (la función usa un comparador), documentamos que cada regla podría tener su propio
   * comparador en una implementación futura. Este test verifica que 'override' mode
   * funciona para reemplazar completamente una regla (ej: jurisdicción).
   */
  it('debería usar override mode para campos no-numéricos como jurisdicción', () => {
    const reglaBase: ReglaParametro<string> = {
      valor: 'ESPAÑA',
      fuente: 'LEY',
      referencia: 'Art. 1 LSC',
    };

    const overrides: RuleParamOverride[] = [
      {
        valor: 'ESPAÑA_MADRID',
        fuente: 'ESTATUTOS',
        referencia: 'Art. 10 Estatutos',
      },
    ];

    const resultado = resolverReglaEfectiva(reglaBase, overrides, 'override');

    expect(resultado.valor).toBe('ESPAÑA_MADRID');
    expect(resultado.fuente).toBe('ESTATUTOS');
  });
});
