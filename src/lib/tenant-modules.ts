// D-5 — aplicabilidad de módulos por tenant (spec G4 §8).
// branding NULL = ARGA o carga en vuelo → todo visible (falla ABIERTO: el
// contrato cero-cambio de ARGA manda sobre la ocultación). Cuando el tenant
// declara `modules`, la lista actúa como lista blanca.
import type { TenantBranding } from "@/context/TenantBrandContext";

export type TenantModulesState = "loading" | "unconfigured" | "empty" | "configured";

export type BrandingWithModules = TenantBranding & { modules?: unknown };

export interface ResolveModulesOptions {
  isLoading?: boolean;
}

/**
 * Resuelve el estado de configuración de módulos del tenant.
 * - "loading": consulta de branding en curso (options.isLoading = true).
 * - "unconfigured": branding nulo o clave `modules` ausente/inválida. Falla ABIERTO.
 * - "empty": `modules: []` declarado deliberadamente vacío por el admin. Falla CERRADO.
 * - "configured": array de strings válido con al menos un módulo.
 */
export function resolveTenantModulesState(
  branding: BrandingWithModules | null | undefined,
  options?: ResolveModulesOptions,
): TenantModulesState {
  if (options?.isLoading) {
    return "loading";
  }
  if (!branding || branding.modules === undefined || branding.modules === null) {
    return "unconfigured";
  }
  const list = branding.modules;
  if (!Array.isArray(list) || !list.every((m) => typeof m === "string")) {
    return "unconfigured";
  }
  if (list.length === 0) {
    return "empty";
  }
  return "configured";
}

export function isModuleEnabled(
  branding: BrandingWithModules | null | undefined,
  moduleKey: string,
  options?: ResolveModulesOptions,
): boolean {
  const state = resolveTenantModulesState(branding, options);
  switch (state) {
    case "loading":
    case "unconfigured":
      // Falla ABIERTO: el contrato cero-cambio de ARGA (branding NULL) manda,
      // y la decisión T3 de Grupo Nuevo (...0003 sin modules declarado)
      // expone todos los módulos.
      return true;
    case "empty":
      // Lista deliberadamente vacía: el administrador desactivó explícitamente
      // todos los módulos gobernados.
      return false;
    case "configured":
      return (branding!.modules as string[]).includes(moduleKey);
  }
}
