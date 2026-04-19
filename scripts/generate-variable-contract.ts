/**
 * Variable Contract YAML Generator
 * Reads types.ts, extracts exported types/interfaces, and generates a YAML contract file
 * Run with: bun run scripts/generate-variable-contract.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const PROJECT_ROOT = path.join(__dirname, '..');
const TYPES_FILE = path.join(PROJECT_ROOT, 'src/lib/rules-engine/types.ts');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'docs/contratos');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'variables-plantillas-v1.0.0.yaml');

// ============================================================
// Type Parser
// ============================================================

interface ParsedType {
  name: string;
  kind: 'interface' | 'type_alias';
  fields: Array<{
    name: string;
    type: string;
    required: boolean;
  }>;
}

interface TypeClassification {
  MOTOR_REGLAS: ParsedType[];
  USUARIO: ParsedType[];
  QTSP: ParsedType[];
}

/**
 * Extract all exported types and interfaces from types.ts
 */
function parseTypesFile(content: string): ParsedType[] {
  const types: ParsedType[] = [];

  // Pattern 1: export interface NAME [extends X] { ... }
  // Handle interfaces that may extend other types
  const interfaceRegex = /export\s+interface\s+(\w+)\s*(?:<[^>]+>)?(?:\s+extends\s+[^{]+)?\s*\{([^}]+)\}/g;
  let match;

  while ((match = interfaceRegex.exec(content)) !== null) {
    const name = match[1];
    const body = match[2];

    const fields = parseInterfaceBody(body);
    types.push({
      name,
      kind: 'interface',
      fields,
    });
  }

  // Pattern 2: export type NAME = ...
  // Handle simple union types, type aliases, and complex types
  const typeRegex = /export\s+type\s+(\w+)\s*(?:<[^>]+>)?\s*=\s*([^;]+);/g;

  while ((match = typeRegex.exec(content)) !== null) {
    const name = match[1];
    const definition = match[2].trim();

    // Skip primitive union types like Fuente, TipoSocial, etc.
    // These are typically 'VALUE' | 'VALUE' | ...
    if (isPrimitiveUnion(definition)) {
      types.push({
        name,
        kind: 'type_alias',
        fields: [], // No fields for union types
      });
    } else if (isObjectType(definition)) {
      // Complex object type
      const fields = parseObjectTypeDefinition(definition);
      types.push({
        name,
        kind: 'type_alias',
        fields,
      });
    } else {
      // Other aliases (single type, etc.)
      types.push({
        name,
        kind: 'type_alias',
        fields: [],
      });
    }
  }

  return types;
}

/**
 * Check if a type definition is a primitive union (e.g., 'A' | 'B' | 'C')
 */
function isPrimitiveUnion(definition: string): boolean {
  // If it contains only string literals and pipes, it's a primitive union
  const trimmed = definition.trim();
  return /^['"]?\w+['"]?\s*(\|\s*['"]?\w+['"]?)*$/.test(trimmed);
}

/**
 * Check if a type definition is an object type (starts with { or Record<)
 */
function isObjectType(definition: string): boolean {
  return definition.trim().startsWith('{') || definition.trim().startsWith('Record<');
}

/**
 * Parse interface body to extract fields
 */
function parseInterfaceBody(body: string): Array<{ name: string; type: string; required: boolean }> {
  const fields: Array<{ name: string; type: string; required: boolean }> = [];
  const lines = body.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

    // Match: fieldName?: type; or fieldName: type;
    const fieldRegex = /^(\w+)(\?)?:\s*([^;]+);/;
    const match = fieldRegex.exec(trimmed);

    if (match) {
      const [, fieldName, optional, fieldType] = match;
      fields.push({
        name: fieldName,
        type: fieldType.trim(),
        required: !optional,
      });
    }
  }

  // Note: interfaces that extend other types (e.g., extends EvaluacionResult)
  // will have their own fields listed, plus inherited fields from parent.
  // We capture the declared fields here.

  return fields;
}

/**
 * Parse object type definition (simplified)
 */
function parseObjectTypeDefinition(definition: string): Array<{ name: string; type: string; required: boolean }> {
  // For now, return empty array for complex type aliases
  // In a production system, you'd want to handle these more carefully
  return [];
}

/**
 * Classify types into MOTOR_REGLAS, USUARIO, QTSP
 */
function classifyTypes(types: ParsedType[]): TypeClassification {
  const classified: TypeClassification = {
    MOTOR_REGLAS: [],
    USUARIO: [],
    QTSP: [],
  };

  for (const type of types) {
    const name = type.name;

    // QTSP classification
    if (
      name.includes('QTSP') ||
      name.includes('QES') ||
      name.includes('Trust') ||
      name.includes('Verification') ||
      name.includes('Seal') ||
      name.includes('Notification') ||
      name.includes('Evidence')
    ) {
      classified.QTSP.push(type);
    }
    // USUARIO classification
    else if (name.includes('Input') || name.includes('Output')) {
      classified.USUARIO.push(type);
    }
    // MOTOR_REGLAS (everything else)
    else {
      classified.MOTOR_REGLAS.push(type);
    }
  }

  return classified;
}

/**
 * Convert field type to YAML representation
 */
function typeToYamlType(fieldType: string): string {
  // Clean up the type string for YAML readability
  return fieldType.replace(/\s+/g, ' ').trim();
}

/**
 * Generate YAML content
 */
function generateYaml(classified: TypeClassification): string {
  const now = new Date().toISOString();
  let yaml = `# Contrato de Variables — Motor de Reglas LSC
# Generado automáticamente por scripts/generate-variable-contract.ts
# NO EDITAR MANUALMENTE — regenerar con: bun run scripts/generate-variable-contract.ts

version: "1.0.0"
fecha_generacion: "${now}"
fecha_congelacion: null  # Se rellena al congelar

bloques:
`;

  // MOTOR_REGLAS block
  yaml += `  MOTOR_REGLAS:
    descripcion: "Tipos internos del motor de reglas"
    tipos:
`;
  for (const type of classified.MOTOR_REGLAS) {
    yaml += `      ${type.name}:\n`;
    if (type.fields.length > 0) {
      yaml += `        campos:\n`;
      for (const field of type.fields) {
        yaml += `          ${field.name}:\n`;
        yaml += `            tipo: "${typeToYamlType(field.type)}"\n`;
        yaml += `            requerido: ${field.required}\n`;
      }
    } else {
      yaml += `        campos: {}\n`;
    }
  }

  // USUARIO block
  yaml += `
  USUARIO:
    descripcion: "Tipos de entrada del usuario"
    tipos:
`;
  for (const type of classified.USUARIO) {
    yaml += `      ${type.name}:\n`;
    if (type.fields.length > 0) {
      yaml += `        campos:\n`;
      for (const field of type.fields) {
        yaml += `          ${field.name}:\n`;
        yaml += `            tipo: "${typeToYamlType(field.type)}"\n`;
        yaml += `            requerido: ${field.required}\n`;
      }
    } else {
      yaml += `        campos: {}\n`;
    }
  }

  // QTSP block
  yaml += `
  QTSP:
    descripcion: "Tipos de integración QTSP"
    tipos:
`;
  for (const type of classified.QTSP) {
    yaml += `      ${type.name}:\n`;
    if (type.fields.length > 0) {
      yaml += `        campos:\n`;
      for (const field of type.fields) {
        yaml += `          ${field.name}:\n`;
        yaml += `            tipo: "${typeToYamlType(field.type)}"\n`;
        yaml += `            requerido: ${field.required}\n`;
      }
    } else {
      yaml += `        campos: {}\n`;
    }
  }

  return yaml;
}

/**
 * Main execution
 */
async function main() {
  try {
    // Read types.ts
    console.log(`Reading ${TYPES_FILE}...`);
    const content = fs.readFileSync(TYPES_FILE, 'utf-8');

    // Parse types
    console.log('Parsing types...');
    const types = parseTypesFile(content);
    console.log(`Found ${types.length} exported types`);

    // Classify types
    console.log('Classifying types...');
    const classified = classifyTypes(types);
    console.log(`  MOTOR_REGLAS: ${classified.MOTOR_REGLAS.length}`);
    console.log(`  USUARIO: ${classified.USUARIO.length}`);
    console.log(`  QTSP: ${classified.QTSP.length}`);

    // Generate YAML
    console.log('Generating YAML...');
    const yaml = generateYaml(classified);

    // Create output directory if needed
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
      console.log(`Created directory ${OUTPUT_DIR}`);
    }

    // Write output file
    fs.writeFileSync(OUTPUT_FILE, yaml);
    console.log(`Written to ${OUTPUT_FILE}`);

    // Summary
    console.log('\n=== Summary ===');
    console.log(`Total types: ${types.length}`);
    console.log(`MOTOR_REGLAS: ${classified.MOTOR_REGLAS.length}`);
    console.log(`USUARIO: ${classified.USUARIO.length}`);
    console.log(`QTSP: ${classified.QTSP.length}`);
    console.log('\nGeneration complete!');
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
