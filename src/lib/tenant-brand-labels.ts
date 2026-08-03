// Labels de marca con defaults ARGA/TGMS VERBATIM: son contrato (Task 4 G0).
// Cambiar un default rompe la promesa "cero cambio visual para ARGA".
import type { TenantBranding } from "@/context/TenantBrandContext";

export const DEFAULT_SHELL_LABEL = "TGMS PLATFORM";
export const DEFAULT_SCOPE_LABEL = "Grupo ARGA";
export const DEFAULT_SII_ORG_LABEL = "Grupo ARGA Seguros";
export const DEFAULT_BRAND_NAME = "TGMS";

function pick(value: string | undefined, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const v = value.trim();
  return v.length > 0 ? v : fallback;
}

export function shellLabel(b: TenantBranding | null): string {
  return pick(b?.shell_label, DEFAULT_SHELL_LABEL);
}

export function scopeLabel(b: TenantBranding | null): string {
  return pick(b?.scope_label, DEFAULT_SCOPE_LABEL);
}

export function siiOrgLabel(b: TenantBranding | null): string {
  return pick(b?.sii_org_label, DEFAULT_SII_ORG_LABEL);
}

export function brandName(b: TenantBranding | null): string {
  return pick(b?.nombre, DEFAULT_BRAND_NAME);
}

export const DEFAULT_GROUP_FULL_LABEL = "Grupo ARGA Seguros";

/** Nombre completo del grupo para breadcrumbs/copy. Default ARGA verbatim. */
export function groupFullLabel(b: TenantBranding | null): string {
  if (!b) return DEFAULT_GROUP_FULL_LABEL;
  return pick(b.scope_label, DEFAULT_GROUP_FULL_LABEL);
}

/** Chip de vista de grupo del dashboard de Secretaría. Default ARGA verbatim. */
export function groupPortfolioLabel(b: TenantBranding | null): string {
  if (!b) return "Vista de grupo: cartera societaria ARGA";
  return `Vista de grupo: cartera societaria ${brandName(b)}`;
}
