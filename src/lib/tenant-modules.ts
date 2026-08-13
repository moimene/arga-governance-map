// D-5 — aplicabilidad de módulos por tenant (spec G4 §8).
// branding NULL = ARGA o carga en vuelo → todo visible (falla ABIERTO: el
// contrato cero-cambio de ARGA manda sobre la ocultación). Cuando el tenant
// declara `modules`, la lista actúa como lista blanca.
import type { TenantBranding } from "@/context/TenantBrandContext";

type BrandingWithModules = TenantBranding & { modules?: string[] };

export function isModuleEnabled(
  branding: BrandingWithModules | null,
  moduleKey: string,
): boolean {
  if (!branding) return true;
  const list = branding.modules;
  if (!Array.isArray(list) || !list.every((m) => typeof m === "string")) return true;
  return list.includes(moduleKey);
}
