/**
 * Plantillas ACTIVA con P0 semántico conocido y tolerado.
 * Estado 2026-05-14: lista cerrada a cero tras corregir RATIFICACION_ACTOS
 * y añadir condicional requiere_experto en FUSION_ESCISION.
 */

export type KnownP0 = {
  id: string;
  materia: string;
  organo: string;
  rule: string;
  description: string;
};

export const KNOWN_P0_TEMPLATES: ReadonlyArray<KnownP0> = [] as const;

export const KNOWN_P0_TEMPLATE_IDS: ReadonlySet<string> = new Set(
  KNOWN_P0_TEMPLATES.map((p) => p.id),
);

export function isKnownP0(id: string): boolean {
  return KNOWN_P0_TEMPLATE_IDS.has(id);
}
