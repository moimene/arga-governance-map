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

export const siiItems: SidebarItem[] = [
  { label: "SII — Canal Interno", to: "/sii", icon: AlertOctagon, badge: { text: "2", tone: "warning" }, sii: true },
];

export const adminItems: SidebarItem[] = [
  { label: "Administración", to: "/admin", icon: Settings },
];

export const helpItems: SidebarItem[] = [
  { label: "Documentación", to: "/documentacion", icon: BookOpen },
];