// Scopes geográficos y saludo del Dashboard por tenant (G1 Task 8).
// branding NULL (ARGA) → lista estática y saludo actuales VERBATIM (contrato
// cero-cambio). branding presente → scopes del branding o derivado del
// scope_label; saludo genérico hasta que G2 aporte la persona del perfil.
import type { TenantBranding } from "@/context/TenantBrandContext";
import { scopeLabel } from "@/lib/tenant-brand-labels";
import { scopes as ARGA_SCOPES } from "@/data/scopes";

type BrandingWithScopes = TenantBranding & { scopes?: string[] };

export function scopesForTenant(
  branding: BrandingWithScopes | null,
): readonly string[] {
  if (!branding) return ARGA_SCOPES;
  const list = branding.scopes;
  if (Array.isArray(list) && list.length > 0 && list.every((s) => typeof s === "string")) {
    return list;
  }
  return [`${scopeLabel(branding)} (Global)`];
}

export function dashboardGreeting(branding: TenantBranding | null): string {
  return branding ? "Buen día" : "Buen día, Lucía";
}
