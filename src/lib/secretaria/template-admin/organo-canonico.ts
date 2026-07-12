/**
 * Enum canónico de organo_tipo + aliases legacy.
 * Sprint 1 — Spec §6.1 OrganoCanonicoEnum.
 */

export const ORGANO_CANONICO = [
  "JUNTA_GENERAL",
  // Valor deprecado: compatibilidad temporal para ACTA_ACUERDO_ESCRITO /
  // ACUERDO_SIN_SESION hasta desdoblar la plantilla en variantes por órgano.
  "JUNTA_GENERAL_O_CONSEJO",
  "CONSEJO_ADMIN",
  "ORGANO_ADMIN",
  "SOCIO_UNICO",
  "ADMIN_UNICO",
  "ADMIN_CONJUNTA_O_COAPROBADORES",
  "ADMIN_SOLIDARIOS",
  "COMISION_DELEGADA",
  "SOPORTE_INTERNO",
  "DERIVADO_DEL_ACTO",
] as const;

export type OrganoCanonico = (typeof ORGANO_CANONICO)[number];

export const ORGANO_ALIAS: Record<string, OrganoCanonico> = {
  JUNTA: "JUNTA_GENERAL",
  CONSEJO_ADMINISTRACION: "CONSEJO_ADMIN",
  CONSEJO: "CONSEJO_ADMIN",
  ADMIN_CONJUNTA: "ADMIN_CONJUNTA_O_COAPROBADORES",
  ADMIN_SOLIDARIO: "ADMIN_SOLIDARIOS",
};

const CANONICO_SET = new Set<string>(ORGANO_CANONICO);

export function isOrganoCanonico(value: unknown): value is OrganoCanonico {
  return typeof value === "string" && CANONICO_SET.has(value);
}

export function normalizeOrganoTipo(value: string | null | undefined): OrganoCanonico | null {
  if (!value || typeof value !== "string") return null;
  const upper = value.trim().toUpperCase();
  if (CANONICO_SET.has(upper)) return upper as OrganoCanonico;
  if (upper in ORGANO_ALIAS) return ORGANO_ALIAS[upper];
  return null;
}
