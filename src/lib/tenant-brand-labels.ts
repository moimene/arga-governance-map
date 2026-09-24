// Labels de marca con defaults ARGA/TGMS VERBATIM: son contrato (Task 4 G0).
// Cambiar un default rompe la promesa "cero cambio visual para ARGA".
import type { TenantBranding } from "@/context/TenantBrandContext";

export const DEFAULT_SHELL_LABEL = "TGMS PLATFORM";
export const DEFAULT_SCOPE_LABEL = "Grupo ARGA";
export const DEFAULT_SII_ORG_LABEL = "Grupo ARGA Seguros";
export const DEFAULT_BRAND_NAME = "TGMS";

function cleanString(value: string | undefined | null): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return v.length > 0 ? v : null;
}

export function shellLabel(b: TenantBranding | null): string {
  if (!b) return DEFAULT_SHELL_LABEL;
  return cleanString(b.shell_label) ?? DEFAULT_SHELL_LABEL;
}

export function brandName(b: TenantBranding | null): string {
  if (!b) return DEFAULT_BRAND_NAME;
  return cleanString(b.nombre) ?? "Grupo";
}

export function scopeLabel(b: TenantBranding | null): string {
  if (!b) return DEFAULT_SCOPE_LABEL;
  const explicit = cleanString(b.scope_label);
  if (explicit) return explicit;
  const nombre = cleanString(b.nombre);
  if (nombre) return nombre;
  return "Grupo";
}

export function siiOrgLabel(b: TenantBranding | null): string {
  if (!b) return DEFAULT_SII_ORG_LABEL;
  const explicit = cleanString(b.sii_org_label);
  if (explicit) return explicit;
  const nombre = cleanString(b.nombre);
  if (nombre) return nombre;
  return "Entidad";
}

export const DEFAULT_GROUP_FULL_LABEL = "Grupo ARGA Seguros";

/** Nombre completo del grupo para breadcrumbs/copy. Default ARGA verbatim solo con branding null. */
export function groupFullLabel(b: TenantBranding | null): string {
  if (!b) return DEFAULT_GROUP_FULL_LABEL;
  const explicit = cleanString(b.scope_label);
  if (explicit) return explicit;
  const nombre = cleanString(b.nombre);
  if (nombre) {
    return nombre.startsWith("Grupo") ? nombre : `Grupo ${nombre}`;
  }
  return "Grupo";
}

/** Chip de vista de grupo del dashboard de Secretaría. Default ARGA verbatim solo con branding null. */
export function groupPortfolioLabel(b: TenantBranding | null): string {
  if (!b) return "Vista de grupo: cartera societaria ARGA";
  return `Vista de grupo: cartera societaria ${brandName(b)}`;
}
