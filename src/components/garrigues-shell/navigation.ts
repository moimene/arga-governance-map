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
  Scale,
  ShieldCheck,
} from "lucide-react";
import type { TenantBranding } from "@/context/TenantBrandContext";
import { isModuleEnabled } from "@/lib/tenant-modules";

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
  { label: "Packs por País",  to: "/grc/packs",               icon: Globe2, moduleKey: "country-packs" },
  { label: "Incidentes",      to: "/grc/incidentes",          icon: AlertTriangle },
  { label: "Mi Trabajo",      to: "/grc/mywork",              icon: Briefcase },
  { label: "Alertas",         to: "/grc/alertas",             icon: AlertTriangle },
  { label: "Excepciones",     to: "/grc/excepciones",         icon: FileWarning },
];

export const AI_NAV_ITEMS: GarriguesSimpleNavItem[] = [
  { label: "Dashboard",       to: "/ai-governance",              icon: LayoutDashboard, end: true },
  { label: "Sistemas IA",     to: "/ai-governance/sistemas",     icon: Cpu },
  { label: "Evaluaciones",    to: "/ai-governance/evaluaciones", icon: ClipboardCheck },
  { label: "Incidentes IA",   to: "/ai-governance/incidentes",   icon: AlertTriangle },
];
