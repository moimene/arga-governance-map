import {
  Bell,
  BookOpen,
  Briefcase,
  Building2,
  Calendar,
  FileSignature,
  FileSearch,
  FileText,
  Gavel,
  Globe,
  Layers,
  LayoutDashboard,
  Library,
  Repeat2,
  ScrollText,
  UserCircle,
  Users,
} from "lucide-react";
import type { SecretariaMode, SecretariaNavGroup, SecretariaNavItem } from "./types";

export const GRUPO_NAV_GROUPS: SecretariaNavGroup[] = [
  {
    label: "Dirección de grupo",
    items: [
      { label: "Dashboard", to: "/secretaria", icon: LayoutDashboard, end: true },
      { label: "Sociedades", to: "/secretaria/sociedades", icon: Building2 },
      { label: "Personas", to: "/secretaria/personas", icon: UserCircle },
      { label: "Board Pack", to: "/secretaria/board-pack", icon: Briefcase },
      { label: "Campañas de grupo", to: "/secretaria/procesos-grupo", icon: Repeat2 },
      { label: "Calendario", to: "/secretaria/calendario", icon: Calendar },
      { label: "Multi-jurisdicción", to: "/secretaria/multi-jurisdiccion", icon: Globe },
    ],
  },
  {
    label: "Operativa multi-sociedad",
    items: [
      { label: "Convocatorias", to: "/secretaria/convocatorias", icon: Bell },
      { label: "Reuniones", to: "/secretaria/reuniones", icon: Users },
      { label: "Actas", to: "/secretaria/actas", icon: FileSignature },
      {
        label: "Decisiones unipersonales",
        to: "/secretaria/decisiones-unipersonales",
        icon: Building2,
      },
      { label: "Acuerdos sin sesión", to: "/secretaria/acuerdos-sin-sesion", icon: ScrollText },
      { label: "Tramitador registral", to: "/secretaria/tramitador", icon: Gavel },
      { label: "Libro de socios", to: "/secretaria/libro-socios", icon: BookOpen },
      { label: "Libros obligatorios", to: "/secretaria/libros", icon: Library },
    ],
  },
  {
    label: "Biblioteca legal",
    items: [
      { label: "Plantillas", to: "/secretaria/plantillas", icon: FileText },
      { label: "Gestor plantillas", to: "/secretaria/gestor-plantillas", icon: Layers },
      { label: "Revision documentos", to: "/secretaria/documentos/pendientes-revision", icon: FileSearch },
    ],
  },
];

export const SOCIEDAD_NAV_GROUPS: SecretariaNavGroup[] = [
  {
    label: "Contexto de sociedad",
    items: [
      { label: "Dashboard", to: "/secretaria", icon: LayoutDashboard, end: true },
      {
        label: "Ficha societaria",
        to: "/secretaria/sociedades",
        icon: Building2,
        requiresEntity: true,
        selectedEntityRoute: true,
      },
      { label: "Personas y cargos", to: "/secretaria/personas", icon: UserCircle },
      { label: "Board Pack", to: "/secretaria/board-pack", icon: Briefcase, requiresEntity: true },
    ],
  },
  {
    label: "Expedientes de la sociedad",
    items: [
      { label: "Convocatorias", to: "/secretaria/convocatorias", icon: Bell, requiresEntity: true },
      { label: "Reuniones", to: "/secretaria/reuniones", icon: Users, requiresEntity: true },
      { label: "Actas", to: "/secretaria/actas", icon: FileSignature, requiresEntity: true },
      {
        label: "Decisiones unipersonales",
        to: "/secretaria/decisiones-unipersonales",
        icon: Building2,
        requiresEntity: true,
      },
      {
        label: "Acuerdos sin sesión",
        to: "/secretaria/acuerdos-sin-sesion",
        icon: ScrollText,
        requiresEntity: true,
      },
      { label: "Tramitador registral", to: "/secretaria/tramitador", icon: Gavel, requiresEntity: true },
    ],
  },
  {
    label: "Libros y cumplimiento",
    items: [
      { label: "Libro de socios", to: "/secretaria/libro-socios", icon: BookOpen, requiresEntity: true },
      { label: "Libros obligatorios", to: "/secretaria/libros", icon: Library, requiresEntity: true },
      { label: "Calendario", to: "/secretaria/calendario", icon: Calendar, requiresEntity: true },
      { label: "Multi-jurisdicción", to: "/secretaria/multi-jurisdiccion", icon: Globe },
    ],
  },
  {
    label: "Biblioteca aplicable",
    items: [
      { label: "Plantillas", to: "/secretaria/plantillas", icon: FileText },
      { label: "Gestor plantillas", to: "/secretaria/gestor-plantillas", icon: Layers },
      { label: "Revision documentos", to: "/secretaria/documentos/pendientes-revision", icon: FileSearch },
    ],
  },
];

const ALL_NAV_ITEMS: SecretariaNavItem[] = [...GRUPO_NAV_GROUPS, ...SOCIEDAD_NAV_GROUPS]
  .flatMap((group) => group.items)
  .filter((item, index, items) => items.findIndex((candidate) => candidate.to === item.to) === index);

function routeMatches(pathname: string, item: SecretariaNavItem) {
  if (item.end) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

export function getNavGroups(mode: SecretariaMode) {
  return mode === "sociedad" ? SOCIEDAD_NAV_GROUPS : GRUPO_NAV_GROUPS;
}

export function getSecretariaSectionLabel(pathname: string, mode: SecretariaMode) {
  if (/^\/secretaria\/sociedades\/[^/]+\/reglas/.test(pathname)) return "Reglas aplicables";
  if (/^\/secretaria\/sociedades\/[^/]+/.test(pathname)) return "Ficha societaria";
  if (/^\/secretaria\/personas\/[^/]+/.test(pathname)) return "Personas";
  if (/^\/secretaria\/convocatorias\/nueva/.test(pathname)) return "Convocatorias";
  if (/^\/secretaria\/reuniones\/nueva/.test(pathname)) return "Reuniones";
  if (/^\/secretaria\/procesos-grupo/.test(pathname)) return "Campañas de grupo";
  if (/^\/secretaria\/tramitador\/nuevo/.test(pathname)) return "Tramitador registral";
  if (/^\/secretaria\/documentos\/pendientes-revision/.test(pathname)) return "Documentos pendientes de revision";
  if (/^\/secretaria\/acuerdos\/[^/]+\/generar/.test(pathname)) return "Generar documento";
  if (/^\/secretaria\/acuerdos\/[^/]+/.test(pathname)) return "Expediente";

  const match = ALL_NAV_ITEMS
    .slice()
    .sort((a, b) => b.to.length - a.to.length)
    .find((item) => routeMatches(pathname, item));

  if (match) return match.label;
  return mode === "sociedad" ? "Mesa de sociedad" : "Panel de grupo";
}
