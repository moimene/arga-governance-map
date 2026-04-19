/**
 * Variable Contract Stability Test
 * Verifies that all types in types.ts are tracked in the YAML contract
 * Run with: npm test -- variable-contract.test.ts
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const PROJECT_ROOT = path.join(__dirname, '../../../..');
const TYPES_FILE = path.join(PROJECT_ROOT, 'src/lib/rules-engine/types.ts');
const YAML_FILE = path.join(PROJECT_ROOT, 'docs/contratos/variables-plantillas-v1.0.0.yaml');

// ============================================================
// Helper Functions
// ============================================================

/**
 * Extract all exported type/interface names from types.ts
 */
function extractTypesFromFile(): string[] {
  const content = fs.readFileSync(TYPES_FILE, 'utf-8');
  const types = new Set<string>();

  // Match: export interface NAME
  const interfaceRegex = /export\s+interface\s+(\w+)/g;
  let match;
  while ((match = interfaceRegex.exec(content)) !== null) {
    types.add(match[1]);
  }

  // Match: export type NAME
  const typeRegex = /export\s+type\s+(\w+)/g;
  while ((match = typeRegex.exec(content)) !== null) {
    types.add(match[1]);
  }

  return Array.from(types).sort();
}

/**
 * Extract all type names from the YAML contract file
 * Returns a map of block name to array of type names
 */
function extractTypesFromYaml(): Record<string, string[]> {
  const content = fs.readFileSync(YAML_FILE, 'utf-8');
  const result: Record<string, string[]> = {};

  // Split into blocks (MOTOR_REGLAS, USUARIO, QTSP)
  const blocks = ['MOTOR_REGLAS', 'USUARIO', 'QTSP'];

  for (const block of blocks) {
    result[block] = [];

    // Find the block section
    const blockRegex = new RegExp(`\\s${block}:\\s*\\n\\s*descripcion:.*?\\n\\s*tipos:\\s*\\n([\\s\\S]*?)(?=\\n  \\w|$)`);
    const blockMatch = blockRegex.exec(content);

    if (blockMatch) {
      const blockContent = blockMatch[1];

      // Extract type names (lines like "      TypeName:")
      const typeRegex = /^\s{6}(\w+):/gm;
      let typeMatch;
      while ((typeMatch = typeRegex.exec(blockContent)) !== null) {
        result[block].push(typeMatch[1]);
      }
    }

    result[block].sort();
  }

  return result;
}

/**
 * Validate YAML structure
 */
function validateYamlStructure() {
  const content = fs.readFileSync(YAML_FILE, 'utf-8');

  // Check version field
  const versionMatch = /^version:\s*"([^"]+)"$/m.exec(content);
  if (!versionMatch) {
    throw new Error('YAML missing version field');
  }

  // Check fecha_generacion field
  const fechaGenMatch = /^fecha_generacion:\s*"([^"]+)"$/m.exec(content);
  if (!fechaGenMatch) {
    throw new Error('YAML missing fecha_generacion field');
  }

  // Check if fecha_generacion is a valid ISO date
  const isoDate = fechaGenMatch[1];
  try {
    new Date(isoDate);
  } catch {
    throw new Error(`fecha_generacion is not a valid ISO date: ${isoDate}`);
  }

  // Check fecha_congelacion field
  const fechaCongMatch = /^fecha_congelacion:\s*(.+)$/m.exec(content);
  if (!fechaCongMatch) {
    throw new Error('YAML missing fecha_congelacion field');
  }

  const fechaCongValue = fechaCongMatch[1].trim();
  if (fechaCongValue !== 'null' && fechaCongValue !== '~') {
    // If not null, it should be a valid ISO date
    try {
      new Date(fechaCongValue);
    } catch {
      throw new Error(`fecha_congelacion is not a valid ISO date: ${fechaCongValue}`);
    }
  }

  // Check that all 3 bloques exist
  for (const bloc of ['MOTOR_REGLAS', 'USUARIO', 'QTSP']) {
    if (!content.includes(`  ${bloc}:`)) {
      throw new Error(`YAML missing bloque: ${bloc}`);
    }
  }
}

// ============================================================
// Tests
// ============================================================

describe('Variable Contract Stability', () => {
  it('should have a valid types.ts file', () => {
    expect(fs.existsSync(TYPES_FILE)).toBe(true);
  });

  it('should have a generated YAML contract', () => {
    expect(fs.existsSync(YAML_FILE)).toBe(true);
  });

  it('should have valid YAML structure', () => {
    expect(() => validateYamlStructure()).not.toThrow();
  });

  it('should extract types from types.ts', () => {
    const types = extractTypesFromFile();
    expect(types.length).toBeGreaterThan(0);
  });

  it('should extract types from YAML', () => {
    const types = extractTypesFromYaml();
    const totalTypes = Object.values(types).reduce((sum, arr) => sum + arr.length, 0);
    expect(totalTypes).toBeGreaterThan(0);
  });

  it('should have no types in types.ts that are missing from YAML', () => {
    const fileTypes = extractTypesFromFile();
    const yamlTypes = extractTypesFromYaml();

    // Flatten YAML types
    const allYamlTypes = new Set<string>();
    Object.values(yamlTypes).forEach((types) => {
      types.forEach((t) => allYamlTypes.add(t));
    });

    const missing: string[] = [];
    for (const type of fileTypes) {
      if (!allYamlTypes.has(type)) {
        missing.push(type);
      }
    }

    if (missing.length > 0) {
      const message = missing.map((t) => `  - ${t}`).join('\n');
      throw new Error(
        `${missing.length} type(s) in types.ts are missing from YAML contract:\n${message}\n\nRegenerator YAML with: bun run scripts/generate-variable-contract.ts`
      );
    }
  });

  it('should have no types in YAML that are missing from types.ts', () => {
    const fileTypes = new Set(extractTypesFromFile());
    const yamlTypes = extractTypesFromYaml();

    // Flatten YAML types
    const allYamlTypes: string[] = [];
    Object.values(yamlTypes).forEach((types) => {
      types.forEach((t) => allYamlTypes.push(t));
    });

    const orphaned: string[] = [];
    for (const type of allYamlTypes) {
      if (!fileTypes.has(type)) {
        orphaned.push(type);
      }
    }

    if (orphaned.length > 0) {
      const message = orphaned.map((t) => `  - ${t}`).join('\n');
      throw new Error(
        `${orphaned.length} type(s) in YAML contract are missing from types.ts:\n${message}\n\nCheck if these types were removed and regenerate YAML.`
      );
    }
  });

  it('should have all 3 type classification blocks', () => {
    const types = extractTypesFromYaml();
    expect(types).toHaveProperty('MOTOR_REGLAS');
    expect(types).toHaveProperty('USUARIO');
    expect(types).toHaveProperty('QTSP');
  });

  it('should have reasonable distribution of types', () => {
    const types = extractTypesFromYaml();
    const totalTypes = Object.values(types).reduce((sum, arr) => sum + arr.length, 0);

    // All should have at least 1 type
    expect(types.MOTOR_REGLAS.length).toBeGreaterThan(0);
    expect(types.USUARIO.length).toBeGreaterThan(0);
    expect(types.QTSP.length).toBeGreaterThan(0);

    // MOTOR_REGLAS should be the largest (internal types)
    expect(types.MOTOR_REGLAS.length).toBeGreaterThanOrEqual(types.USUARIO.length);
    expect(types.MOTOR_REGLAS.length).toBeGreaterThanOrEqual(types.QTSP.length);
  });

  it('should verify specific expected types are classified correctly', () => {
    const types = extractTypesFromYaml();

    // MOTOR_REGLAS should have rule types
    const ruleTypes = ['ReglaConvocatoria', 'ReglaConstitucion', 'RulePack'];
    for (const rule of ruleTypes) {
      expect(types.MOTOR_REGLAS).toContain(rule);
    }

    // USUARIO should have Input/Output types
    const userTypes = ['ConvocatoriaInput', 'ConvocatoriaOutput', 'VotacionInput', 'VotacionOutput'];
    for (const user of userTypes) {
      expect(types.USUARIO).toContain(user);
    }

    // QTSP should have QTSP types
    const qtspTypes = ['QTSPSealRequest', 'QTSPSignRequest'];
    for (const qtsp of qtspTypes) {
      expect(types.QTSP).toContain(qtsp);
    }
  });

  it('should report summary statistics', () => {
    const fileTypes = extractTypesFromFile();
    const yamlTypes = extractTypesFromYaml();

    const summary = {
      totalInFile: fileTypes.length,
      totalInYaml: Object.values(yamlTypes).reduce((sum, arr) => sum + arr.length, 0),
      motorReglas: yamlTypes.MOTOR_REGLAS.length,
      usuario: yamlTypes.USUARIO.length,
      qtsp: yamlTypes.QTSP.length,
    };

    console.log('\n=== Variable Contract Summary ===');
    console.log(`Total types in types.ts: ${summary.totalInFile}`);
    console.log(`Total types in YAML: ${summary.totalInYaml}`);
    console.log(`  MOTOR_REGLAS: ${summary.motorReglas}`);
    console.log(`  USUARIO: ${summary.usuario}`);
    console.log(`  QTSP: ${summary.qtsp}`);

    expect(summary.totalInFile).toBe(summary.totalInYaml);
  });
});
