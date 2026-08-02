// Labels de marca con defaults ARGA/TGMS VERBATIM: son contrato (Task 4 G0).
// Cambiar un default rompe la promesa "cero cambio visual para ARGA".
import type { TenantBranding } from "@/context/TenantBrandContext";

export const DEFAULT_SHELL_LABEL = "TGMS PLATFORM";
export const DEFAULT_SCOPE_LABEL = "Grupo ARGA";
export const DEFAULT_SII_ORG_LABEL = "Grupo ARGA Seguros";
export const DEFAULT_BRAND_NAME = "TGMS";

function pick(value: string | undefined, fallback: string): string {
  const v = (value ?? "").trim();
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
