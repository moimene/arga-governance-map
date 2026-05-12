/**
 * Plantillas ACTIVA con P0 semántico conocido y tolerado en Sprint 1.
 * Referencia: docs/superpowers/specs/2026-05-12-gestor-plantillas-sprint1-design.md §2.3.
 * Memoria de estado: 2026-05-12.
 */

export type KnownP0 = {
  id: string;
  materia: string;
  organo: string;
  rule: string;
  description: string;
};

export const KNOWN_P0_TEMPLATES: ReadonlyArray<KnownP0> = [
  {
    id: "e3697ad9-e0c2-4baf-9144-c80a11808c07",
    materia: "FUSION_ESCISION",
    organo: "JUNTA_GENERAL",
    rule: "SEM_FUSION_EXPERTO_CONDICIONAL",
    description:
      "capa1_inmutable no condiciona informe de experto en fusiones simplificadas (art. 53 RDL 5/2023).",
  },
  {
    id: "edd5c389-0187-476c-9592-c020058fdc69",
    materia: "RATIFICACION_ACTOS",
    organo: "CONSEJO_ADMIN",
    rule: "SEM_RATIFICACION_IDENTIFICACION",
    description:
      "capa3_editables sin campo obligatorio para identificación de actos ratificados.",
  },
] as const;

export const KNOWN_P0_TEMPLATE_IDS: ReadonlySet<string> = new Set(
  KNOWN_P0_TEMPLATES.map((p) => p.id),
);

export function isKnownP0(id: string): boolean {
  return KNOWN_P0_TEMPLATE_IDS.has(id);
}
