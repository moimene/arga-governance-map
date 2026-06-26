import {
  Bell,
  BookOpen,
  Briefcase,
  Building2,
  Calendar,
  FileCheck2,
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
  Send,
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

export const GRUPO_NAV_GROUPS: SecretariaNavGroup[] = [
  {
    label: "Inicio",
    items: [
      { label: "Mesa", to: "/secretaria", icon: LayoutDashboard, end: true },
      {
        label: "Board pack",
        to: "/secretaria/board-pack",
        icon: Briefcase,
        visibility: { requiresCapability: "canCertify" },
      },
      { label: "Campañas de grupo", to: "/secretaria/procesos-grupo", icon: Repeat2 },
    ],
  },
  {
    label: "Adopción",
    items: [
      { label: "Convocatorias", to: "/secretaria/convocatorias", icon: Bell },
      { label: "Reuniones", to: "/secretaria/reuniones", icon: Users },
      { label: "Acuerdos sin sesión", to: "/secretaria/acuerdos-sin-sesion", icon: ScrollText },
      { label: "Decisiones unipersonales", to: "/secretaria/decisiones-unipersonales", icon: Building2 },
    ],
  },
  {
    label: "Documentación",
    items: [
      { label: "Actas", to: "/secretaria/actas", icon: FileSignature },
      { label: "Actas pendientes", to: "/secretaria/actas?vista=pendientes", icon: FileSignature },
      { label: "Certificaciones de acuerdos", to: "/secretaria/actas?vista=certificaciones", icon: FileSignature },
      { label: "Informes y anexos", to: "/secretaria/informes", icon: FileText },
      { label: "Certificaciones autónomas", to: "/secretaria/certificaciones", icon: FileCheck2 },
      // ITEM-065: las rutas /secretaria/comunicaciones existían sin entrada de
      // sidebar (página huérfana). Se añade aquí en Documentación.
      { label: "Comunicaciones", to: "/secretaria/comunicaciones", icon: Send },
      { label: "Revisión documental", to: "/secretaria/documentos/pendientes-revision", icon: FileSearch },
    ],
  },
  {
    label: "Registro público",
    items: [
      { label: "Registro", to: "/secretaria/tramitador", icon: Gavel },
      { label: "Subsanaciones", to: "/secretaria/tramitador?estado=SUBSANACION", icon: Gavel },
      { label: "Presentaciones registrales", to: "/secretaria/tramitador?estado=PRESENTADA", icon: Gavel },
    ],
  },
  {
    label: "Libros y registros sociales",
    items: [
      { label: "Libro de socios", to: "/secretaria/libro-socios", icon: BookOpen },
      { label: "Libros obligatorios", to: "/secretaria/libros", icon: Library },
      { label: "Calendario societario", to: "/secretaria/calendario", icon: Calendar },
      { label: "Multi-jurisdicción", to: "/secretaria/multi-jurisdiccion", icon: Globe },
    ],
  },
  {
    label: "Sociedades y personas",
    items: [
      { label: "Sociedades", to: "/secretaria/sociedades", icon: Building2 },
      { label: "Personas, cargos y representantes", to: "/secretaria/personas", icon: UserCircle },
    ],
  },
  {
    label: "Configuración y reglas",
    items: [
      { label: "Materias y reglas", to: "/secretaria/catalogo-materias", icon: BookOpen },
      { label: "Catálogo de órganos", to: "/secretaria/catalogo-organos", icon: Landmark },
      { label: "Plantillas documentales", to: "/secretaria/plantillas", icon: FileText },
      { label: "Gobierno de plantillas", to: "/secretaria/gestor-plantillas", icon: Layers },
      // ITEM-078: duplicado de "Documentos en revisión" (sección Documentación)
      // hacia la misma ruta con otro label — eliminado.
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
 * Secuencia canónica:
 *   Acuerdo → Adopción → Documentación → Registro público si procede
 *   → Libros y registros sociales siempre.
 *
 * La navegación se ordena por ese flujo, pero usa rutas existentes y vistas
 * filtradas. No crea entradas libres para actas, certificaciones ni
 * tramitaciones: esas acciones nacen desde reunión, acuerdo o documento fuente.
 */
export const SOCIEDAD_NAV_GROUPS: SecretariaNavGroup[] = [
  {
    label: "Inicio",
    items: [
      { label: "Mesa", to: "/secretaria", icon: LayoutDashboard, end: true },
      {
        label: "Board pack",
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
    label: "Adopción",
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
        // Entry point a los modos NO_SESSION / CO_APROBACION / SOLIDARIO.
        // La página decide qué CTA concreto mostrar según el régimen.
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
    ],
  },
  {
    label: "Documentación",
    items: [
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
        label: "Actas pendientes",
        to: "/secretaria/actas?vista=pendientes",
        icon: FileSignature,
        requiresEntity: true,
        visibility: { requiresEntity: true },
      },
      {
        label: "Certificaciones de acuerdos",
        to: "/secretaria/actas?vista=certificaciones",
        icon: FileSignature,
        requiresEntity: true,
        visibility: { requiresEntity: true },
      },
      {
        label: "Informes y anexos",
        to: "/secretaria/informes",
        icon: FileText,
        requiresEntity: true,
        visibility: { requiresEntity: true },
      },
      {
        label: "Certificaciones autónomas",
        to: "/secretaria/certificaciones",
        icon: FileCheck2,
        requiresEntity: true,
        visibility: { requiresEntity: true },
      },
      {
        // ITEM-065: entrada de Comunicaciones también en modo sociedad.
        label: "Comunicaciones",
        to: "/secretaria/comunicaciones",
        icon: Send,
        requiresEntity: true,
        visibility: { requiresEntity: true },
      },
      {
        label: "Revisión documental",
        to: "/secretaria/documentos/pendientes-revision",
        icon: FileSearch,
      },
    ],
  },
  {
    label: "Registro público",
    items: [
      {
        label: "Registro",
        to: "/secretaria/tramitador",
        icon: Gavel,
        requiresEntity: true,
        visibility: { requiresEntity: true },
      },
      {
        label: "Subsanaciones",
        to: "/secretaria/tramitador?estado=SUBSANACION",
        icon: Gavel,
        requiresEntity: true,
        visibility: { requiresEntity: true },
      },
      {
        label: "Presentaciones registrales",
        to: "/secretaria/tramitador?estado=PRESENTADA",
        icon: Gavel,
        requiresEntity: true,
        visibility: { requiresEntity: true },
      },
    ],
  },
  {
    label: "Libros y registros sociales",
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
        label: "Calendario societario",
        to: "/secretaria/calendario",
        icon: Calendar,
        requiresEntity: true,
        visibility: { requiresEntity: true },
      },
      { label: "Multi-jurisdicción", to: "/secretaria/multi-jurisdiccion", icon: Globe },
    ],
  },
  {
    label: "Sociedades y personas",
    items: [
      {
        label: "Sociedades",
        to: "/secretaria/sociedades",
        icon: Building2,
        selectedEntityRoute: true,
      },
      { label: "Personas, cargos y representantes", to: "/secretaria/personas", icon: UserCircle },
    ],
  },
  {
    label: "Configuración y reglas",
    items: [
      { label: "Materias y reglas", to: "/secretaria/catalogo-materias", icon: BookOpen },
      { label: "Catálogo de órganos", to: "/secretaria/catalogo-organos", icon: Landmark },
      { label: "Plantillas documentales", to: "/secretaria/plantillas", icon: FileText },
      { label: "Gobierno de plantillas", to: "/secretaria/gestor-plantillas", icon: Layers },
      // ITEM-078: duplicado de "Documentos en revisión" (sección Documentación)
      // hacia la misma ruta con otro label — eliminado.
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
