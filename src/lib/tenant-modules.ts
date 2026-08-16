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
  // `[]` es un array de strings válido, así que pasaría el guard de forma y
  // gatearía TODO a false: con `moduleKey` en los 8 govItems, los 3 moduleItems
  // y SII, el sidebar del tenant quedaría en "Dashboard" y nada más. Es el
  // shape más fácil de producir con un seed a medio escribir, así que la lista
  // vacía se trata como "no declarada" y falla ABIERTO igual que branding NULL.
  // Una lista blanca deliberada siempre tiene al menos un módulo.
  if (!Array.isArray(list) || list.length === 0) return true;
  if (!list.every((m) => typeof m === "string")) return true;
  return list.includes(moduleKey);
}
