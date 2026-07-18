/**
 * Política de metadatos de plantillas — módulo HOJA sin dependencias internas.
 *
 * Lote 2 coherencia: estos predicados los comparten la revisión legal
 * (legal-template-review), el Gate PRE (gate-pre / gate-pre-semantic) y los
 * labels de UI. Viven aquí, y no en labels.ts, porque labels.ts importa
 * TRANSITION_MATRIX de template-admin-service y este a su vez importa el Gate
 * PRE: un import gate→labels crearía un ciclo con TDZ que crashea el runtime
 * (ReferenceError al evaluar TRANSITION_MATRIX antes de su inicialización) sin
 * que tsc ni eslint lo detecten. NO añadir imports de otros módulos de
 * template-admin aquí.
 */
import type { TemplateMetadataPolicy } from "./types";

export function normalizeMetadataCode(value?: string | null): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/[.\s/-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

/**
 * Certificaciones, informes y soportes no representan por sí mismos una forma
 * de adopción. Para cualquier otro tipo el fallback es conservador: la forma de
 * adopción debe informarse.
 */
export const NON_ADOPTABLE_DOCUMENT_TYPES = new Set<string>([
  "CERTIFICACION",
  "INFORME_PRECEPTIVO",
  "INFORME_DOCUMENTAL_PRE",
  "INFORME_GESTION",
  "DOCUMENTO_REGISTRAL",
  "SUBSANACION_REGISTRAL",
]);

export function isAdoptionMetadataRequired(tipo?: string | null): boolean {
  const normalized = normalizeMetadataCode(tipo);
  return !normalized || !NON_ADOPTABLE_DOCUMENT_TYPES.has(normalized);
}

export function templateMetadataPolicy(tipo?: string | null): TemplateMetadataPolicy {
  return {
    organoRequired: true,
    adoptionModeRequired: isAdoptionMetadataRequired(tipo),
  };
}

/**
 * Tipos documentales cuya cita legal puede eximirse cuando el documento es
 * soporte interno del expediente (informes de trabajo que no citan norma).
 *
 * Codex adversarial (P1): la exención NO puede depender solo del órgano. Un
 * documento que materializa o instrumenta el acuerdo (modelo, acta,
 * certificación, convocatoria, documento registral) cita norma siempre — si la
 * exención mirase únicamente `organo_tipo`, bastaría clasificarlo como soporte
 * interno para eludir tanto `META_REF_LEGAL_FORMAT` como `missingReference`.
 */
const LEGAL_REFERENCE_EXEMPTIBLE_TYPES = new Set<string>([
  "INFORME_PRECEPTIVO",
  "INFORME_DOCUMENTAL_PRE",
  "INFORME_GESTION",
]);

/**
 * Criterio único de referencia legal (Lote 2 coherencia): exigible salvo para
 * informes de soporte interno. Lo comparten la revisión legal (comprueba
 * no-vacía) y el Gate PRE (comprueba formato de fuente legal); un solo
 * predicado evita que las tres pantallas de configuración cuenten cosas
 * distintas para el mismo dato.
 */
export function requiresLegalReference(input: {
  tipo?: string | null;
  organo_tipo?: string | null;
}): boolean {
  const tipo = normalizeMetadataCode(input.tipo);
  // Solo los informes de trabajo admiten la exención; el resto cita norma
  // aunque estén marcados como soporte interno.
  if (tipo && !LEGAL_REFERENCE_EXEMPTIBLE_TYPES.has(tipo)) return true;
  return normalizeMetadataCode(input.organo_tipo) !== "SOPORTE_INTERNO";
}

/** `ANY` es válido en bindings, no sustituye metadatos de una plantilla. */
export function hasSpecificTemplateMetadata(value?: string | null): boolean {
  const normalized = normalizeMetadataCode(value);
  return Boolean(normalized && normalized !== "ANY");
}
