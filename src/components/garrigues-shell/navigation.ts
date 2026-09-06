import {
  Activity,
  AlertTriangle,
  BookOpen,
  Brain,
  Briefcase,
  ClipboardCheck,
  Cpu,
  FileWarning,
  Globe2,
  Layers,
  LayoutDashboard,
  Leaf,
  Scale,
  ShieldCheck,
} from "lucide-react";
import type { TenantBranding } from "@/context/TenantBrandContext";
import { isModuleEnabled } from "@/lib/tenant-modules";
import { esgVisibleParaTenant } from "../../../scripts/garrigues/esg/plan-sostenibilidad";

export type GarriguesModuleId = "secretaria" | "grc" | "ai-governance";

export interface GarriguesModuleDef {
  id: GarriguesModuleId;
  label: string;
  shortLabel: string;
  description: string;
  basePath: string;
  icon: React.ElementType;
  moduleKey: string;
}

export const GARRIGUES_MODULES: GarriguesModuleDef[] = [
  {
    id: "secretaria",
    label: "Secretaría Societaria",
    shortLabel: "Secretaría",
    description: "Gobierno societario, reuniones y libros",
    basePath: "/secretaria",
    icon: BookOpen,
    moduleKey: "secretaria",
  },
  {
    id: "grc",
    label: "GRC Compass",
    shortLabel: "GRC",
    description: "Riesgos, terceros y cumplimiento normativo",
    basePath: "/grc",
    icon: ShieldCheck,
    moduleKey: "grc",
  },
  {
    id: "ai-governance",
    label: "AI Governance",
    shortLabel: "AI Gov",
    description: "Inventario y cumplimiento EU AI Act / ISO 42001",
    basePath: "/ai-governance",
    icon: Brain,
    moduleKey: "ai-governance",
  },
];

export function getEnabledGarriguesModules(
  branding: TenantBranding | null
): GarriguesModuleDef[] {
  return GARRIGUES_MODULES.filter((mod) => isModuleEnabled(branding, mod.moduleKey));
}

export function getActiveGarriguesModule(pathname: string): GarriguesModuleDef | null {
  if (pathname.startsWith("/secretaria")) {
    return GARRIGUES_MODULES[0];
  }
  if (pathname.startsWith("/grc")) {
    return GARRIGUES_MODULES[1];
  }
  if (pathname.startsWith("/ai-governance")) {
    return GARRIGUES_MODULES[2];
  }
  return null;
}

export interface GarriguesSimpleNavItem {
  label: string;
  to: string;
  icon: React.ElementType;
  end?: boolean;
  moduleKey?: string;
  /**
   * Gate por TENANT, para las pantallas cuyo contenido pertenece a un tenant
   * concreto y no a una lista blanca de módulos.
   *
   * No sirve `moduleKey` aquí: `isModuleEnabled` falla ABIERTO con branding
   * NULL, así que ARGA vería el item y aterrizaría en una pantalla vacía. El
   * gate tiene que ser el MISMO que usa la pantalla, y ese falla CERRADO.
   */
  tenantGate?: (tenantId: string | null | undefined) => boolean;
}

export const GRC_NAV_ITEMS: GarriguesSimpleNavItem[] = [
  { label: "Dashboard",       to: "/grc",                     icon: LayoutDashboard, end: true },
  { label: "Risk 360",        to: "/grc/risk-360",            icon: Activity },
  // Régimen sectorial asegurador y registro DORA de terceros TIC: ninguno de
  // los dos aplica a un despacho. `isModuleEnabled` falla ABIERTO, así que un
  // tenant sin `branding.modules` (ARGA) los sigue viendo sin cambio alguno.
  { label: "Solvencia II",    to: "/grc/solvencia-ii",        icon: ShieldCheck, moduleKey: "solvencia-ii" },
  { label: "Terceros (TPRM)", to: "/grc/tprm",                icon: Layers, moduleKey: "tprm" },
  { label: "Penal / Anticorr.", to: "/grc/penal-anticorrupcion", icon: Scale },
  // `/grc/sostenibilidad` existía en App.tsx sin ningún item que llevara a
  // ella: ruta huérfana, alcanzable solo escribiendo la URL. Entra aquí con el
  // MISMO gate que aplica la pantalla, así que solo la ve el tenant dueño del
  // catálogo y ARGA no gana ningún item.
  { label: "Sostenibilidad", to: "/grc/sostenibilidad", icon: Leaf, tenantGate: esgVisibleParaTenant },
  { label: "Packs por País",  to: "/grc/packs",               icon: Globe2, moduleKey: "country-packs" },
  { label: "Incidentes",      to: "/grc/incidentes",          icon: AlertTriangle },
  { label: "Mi Trabajo",      to: "/grc/mywork",              icon: Briefcase },
  { label: "Alertas",         to: "/grc/alertas",             icon: AlertTriangle },
  { label: "Excepciones",     to: "/grc/excepciones",         icon: FileWarning },
];

/**
 * Items GRC que este tenant puede ver: lista blanca de módulos (falla ABIERTO)
 * y, cuando el item lo declara, el gate por tenant de la propia pantalla (falla
 * CERRADO). Vive aquí y no en el sidebar para que sea comprobable sin montar el
 * árbol de React.
 */
export function getVisibleGrcNavItems(
  branding: TenantBranding | null,
  tenantId: string | null | undefined,
): GarriguesSimpleNavItem[] {
  return GRC_NAV_ITEMS.filter(
    (item) =>
      (!item.moduleKey || isModuleEnabled(branding, item.moduleKey)) &&
      (!item.tenantGate || item.tenantGate(tenantId)),
  );
}

export const AI_NAV_ITEMS: GarriguesSimpleNavItem[] = [
  { label: "Dashboard",       to: "/ai-governance",              icon: LayoutDashboard, end: true },
  { label: "Sistemas IA",     to: "/ai-governance/sistemas",     icon: Cpu },
  { label: "Evaluaciones",    to: "/ai-governance/evaluaciones", icon: ClipboardCheck },
  { label: "Incidentes IA",   to: "/ai-governance/incidentes",   icon: AlertTriangle },
];
