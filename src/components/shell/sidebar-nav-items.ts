import {
  AlertOctagon,
  BookOpen,
  Brain,
  ClipboardList,
  Compass,
  LayoutDashboard,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface SidebarItem {
  label: string;
  to: string;
  icon: LucideIcon;
  badge?: { text: string; tone: "critical" | "warning" };
  sii?: boolean;
}

export const topItems: SidebarItem[] = [
  { label: "Inicio", to: "/", icon: LayoutDashboard },
];

export const moduleItems: SidebarItem[] = [
  { label: "GRC Compass", to: "/grc", icon: Compass },
  { label: "Secretaría", to: "/secretaria", icon: ClipboardList },
  { label: "AI Governance", to: "/ai-governance", icon: Brain },
];

// El badge decía «2» — un literal inventado, sin nada detrás que lo contase.
// Un contador en el ítem de un canal de denuncias afirma que hay dos
// expedientes pendientes, y no lo sabía nadie. Se retira: cuando haya una
// cuenta real, vuelve el badge con su fuente.
//
// NOTA para el carril de coherencia: toda esta cadena está MUERTA. Este módulo
// solo lo importa `shell/Sidebar.tsx`, que solo importa `shell/AppLayout.tsx`,
// que no lo importa nadie (verificado por grep el 2026-09-05). El shell vivo es
// `shell/ShellLayout.tsx`. Borrar los tres excede el perímetro de este carril.
export const siiItems: SidebarItem[] = [
  { label: "SII — Canal Interno", to: "/sii", icon: AlertOctagon, sii: true },
];

export const adminItems: SidebarItem[] = [
  { label: "Administración", to: "/admin", icon: Settings },
];

export const helpItems: SidebarItem[] = [
  { label: "Documentación", to: "/documentacion", icon: BookOpen },
];