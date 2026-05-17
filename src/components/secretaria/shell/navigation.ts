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
  Landmark,
  LayoutDashboard,
  Library,
  Repeat2,
  ScrollText,
  UserCircle,
  Users,
} from "lucide-react";
import type {
  VisibleSecretariaNavGroup,
  VisibleSecretariaNavItem,
} from "@/lib/secretaria/sidebar-visibility";
import type { SecretariaMode } from "./types";

export type SecretariaNavGroup = VisibleSecretariaNavGroup;
export type SecretariaNavItem = VisibleSecretariaNavItem;

/**
 * Modo "grupo" — vista cross-sociedad del Secretario General de grupo.
 * Se mantienen labels alineados con la taxonomía nueva: PANEL, OPERATIVA,
 * CONFIGURACIÓN Y REGLAS (la "biblioteca legal" se unificó como
 * "Configuración y reglas" para coincidir con el modo sociedad).
 */
export const GRUPO_NAV_GROUPS: SecretariaNavGroup[] = [
  {
    label: "Panel de grupo",
    items: [
      { label: "Dashboard", to: "/secretaria", icon: LayoutDashboard, end: true },
      { label: "Sociedades", to: "/secretaria/sociedades", icon: Building2 },
      { label: "Personas", to: "/secretaria/personas", icon: UserCircle },
      {
        label: "Board Pack",
        to: "/secretaria/board-pack",
        icon: Briefcase,
        visibility: { requiresCapability: "canCertify" },
      },
      { label: "Campañas de grupo", to: "/secretaria/procesos-grupo", icon: Repeat2 },
      { label: "Procesos", to: "/secretaria/calendario", icon: Calendar },
      { label: "Multi-jurisdicción", to: "/secretaria/multi-jurisdiccion", icon: Globe },
    ],
  },
  {
    label: "Operativa multi-sociedad",
    items: [
      { label: "Convocatorias", to: "/secretaria/convocatorias", icon: Bell },
      { label: "Reuniones", to: "/secretaria/reuniones", icon: Users },
      { label: "Actas", to: "/secretaria/actas", icon: FileSignature },
      { label: "Decisiones unipersonales", to: "/secretaria/decisiones-unipersonales", icon: Building2 },
      { label: "Acuerdos sin sesión", to: "/secretaria/acuerdos-sin-sesion", icon: ScrollText },
      { label: "Tramitador registral", to: "/secretaria/tramitador", icon: Gavel },
      { label: "Libro de socios", to: "/secretaria/libro-socios", icon: BookOpen },
      { label: "Libros obligatorios", to: "/secretaria/libros", icon: Library },
    ],
  },
  {
    label: "Configuración y reglas",
    items: [
      { label: "Materias y reglas", to: "/secretaria/catalogo-materias", icon: BookOpen },
      { label: "Catálogo de órganos", to: "/secretaria/catalogo-organos", icon: Landmark },
      { label: "Plantillas", to: "/secretaria/plantillas", icon: FileText },
      { label: "Gestor plantillas", to: "/secretaria/gestor-plantillas", icon: Layers },
      { label: "Revisión documentos", to: "/secretaria/documentos/pendientes-revision", icon: FileSearch },
    ],
  },
];

/**
 * Modo "sociedad" — vista enfocada en una entidad concreta. Cada item lleva
 * reglas de visibilidad declarativas que el sidebar evalúa contra el contexto
 * (capability_matrix, tipo_social, tipo_organo_admin, body_types vigentes,
 * readiness). El centralizador `getVisibleSidebarSections` aplica los filtros
 * y poda secciones enteras cuando no queda ningún item visible.
 *
 * Sections (taxonomía 2026-05-12):
 *   CONTEXTO                  — anatomía societaria
 *   EXPEDIENTES               — flujos de adopción de acuerdos
 *   REGISTRO                  — libros, calendario, multi-jurisdicción
 *   CONFIGURACIÓN Y REGLAS    — reglas legales y plantillas
 */
export const SOCIEDAD_NAV_GROUPS: SecretariaNavGroup[] = [
  {
    label: "Contexto",
    items: [
      { label: "Dashboard", to: "/secretaria", icon: LayoutDashboard, end: true },
      // Sociedades: un solo item que en modo sociedad navega a la ficha
      // activa (selectedEntityRoute) y en modo grupo a la lista. El acceso
      // a "Nueva sociedad" vive en la propia página SociedadesList — no
      // necesita un segundo item duplicado en el sidebar.
      {
        label: "Sociedades",
        to: "/secretaria/sociedades",
        icon: Building2,
        selectedEntityRoute: true,
      },
      { label: "Personas y cargos", to: "/secretaria/personas", icon: UserCircle },
      {
        label: "Board Pack",
        to: "/secretaria/board-pack",
        icon: Briefcase,
        requiresEntity: true,
        visibility: {
          requiresEntity: true,
          requiresCollegiateBody: true,
          requiresCapability: "canCertify",
          excludesIfReferenceOnly: true,
        },
      },
    ],
  },
  {
    label: "Expedientes",
    items: [
      {
        label: "Convocatorias",
        to: "/secretaria/convocatorias",
        icon: Bell,
        requiresEntity: true,
        visibility: {
          requiresEntity: true,
          requiresCollegiateBody: true,
          excludesIfReferenceOnly: true,
        },
      },
      {
        label: "Reuniones",
        to: "/secretaria/reuniones",
        icon: Users,
        requiresEntity: true,
        visibility: {
          requiresEntity: true,
          requiresCollegiateBody: true,
          excludesIfReferenceOnly: true,
        },
      },
      {
        label: "Actas",
        to: "/secretaria/actas",
        icon: FileSignature,
        requiresEntity: true,
        visibility: {
          requiresEntity: true,
          requiresCollegiateBody: true,
        },
      },
      {
        label: "Decisiones unipersonales",
        to: "/secretaria/decisiones-unipersonales",
        icon: Building2,
        requiresEntity: true,
        visibility: {
          requiresEntity: true,
          requiresUnipersonalAdmin: true,
        },
      },
      {
        // La página AcuerdosSinSesion es entry point para 3 flujos:
        //   - NO_SESSION (unanimidad, requiere colegiado)
        //   - CO_APROBACION (ADMIN_MANCOMUNADOS — k de n)
        //   - SOLIDARIO (ADMIN_SOLIDARIOS — administrador único de los solidarios)
        // No filtramos por colegialidad: si la entidad soporta CUALQUIERA
        // de esos 3 modos, el item debe aparecer y la página decide qué
        // CTAs renderizar. Los CTAs internos usan canShowAdoptionModeCta.
        label: "Acuerdos sin sesión",
        to: "/secretaria/acuerdos-sin-sesion",
        icon: ScrollText,
        requiresEntity: true,
        visibility: {
          requiresEntity: true,
          requiresAdoptionMode: ["NO_SESSION", "CO_APROBACION", "SOLIDARIO"],
          excludesIfReferenceOnly: true,
        },
      },
      {
        label: "Tramitador registral",
        to: "/secretaria/tramitador",
        icon: Gavel,
        requiresEntity: true,
        visibility: { requiresEntity: true },
      },
    ],
  },
  {
    label: "Registro",
    items: [
      {
        label: "Libro de socios",
        to: "/secretaria/libro-socios",
        icon: BookOpen,
        requiresEntity: true,
        visibility: { requiresEntity: true },
      },
      {
        label: "Libros obligatorios",
        to: "/secretaria/libros",
        icon: Library,
        requiresEntity: true,
        visibility: { requiresEntity: true },
      },
      {
        label: "Procesos",
        to: "/secretaria/calendario",
        icon: Calendar,
        requiresEntity: true,
        visibility: { requiresEntity: true },
      },
      { label: "Multi-jurisdicción", to: "/secretaria/multi-jurisdiccion", icon: Globe },
    ],
  },
  {
    label: "Configuración y reglas",
    items: [
      { label: "Materias y reglas", to: "/secretaria/catalogo-materias", icon: BookOpen },
      { label: "Catálogo de órganos", to: "/secretaria/catalogo-organos", icon: Landmark },
      { label: "Plantillas", to: "/secretaria/plantillas", icon: FileText },
      { label: "Gestor plantillas", to: "/secretaria/gestor-plantillas", icon: Layers },
      { label: "Revisión documentos", to: "/secretaria/documentos/pendientes-revision", icon: FileSearch },
    ],
  },
];

const ALL_NAV_ITEMS: SecretariaNavItem[] = [...GRUPO_NAV_GROUPS, ...SOCIEDAD_NAV_GROUPS]
  .flatMap((group) => group.items)
  .filter(
    (item, index, items) =>
      items.findIndex((candidate) => candidate.to === item.to && candidate.label === item.label) === index
  );

function routeMatches(pathname: string, item: SecretariaNavItem) {
  if (item.end) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

export function getNavGroups(mode: SecretariaMode): SecretariaNavGroup[] {
  return mode === "sociedad" ? SOCIEDAD_NAV_GROUPS : GRUPO_NAV_GROUPS;
}

export function getSecretariaSectionLabel(pathname: string, mode: SecretariaMode) {
  if (/^\/secretaria\/catalogo-materias/.test(pathname)) return "Materias y reglas";
  if (/^\/secretaria\/catalogo-organos/.test(pathname)) return "Catálogo de órganos";
  if (/^\/secretaria\/reglas/.test(pathname)) return "Materias y reglas";
  if (/^\/secretaria\/sociedades\/[^/]+\/marco-normativo\/activar/.test(pathname)) return "Activar marco normativo";
  if (/^\/secretaria\/sociedades\/[^/]+\/reglas/.test(pathname)) return "Materias y reglas";
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
