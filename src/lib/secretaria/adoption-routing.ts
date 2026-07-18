import { resolveMateriaAlias } from "./agenda-materias";

/**
 * adoption-routing — resuelve el destino del PROCESO DE ADOPCIÓN de un acuerdo
 * a partir de la materia y de los modos de adopción admitidos por la regla
 * aplicable (`modosAdopcionPermitidos` del rule pack) o por la plantilla
 * (`adoption_mode`).
 *
 * Es el contrato compartido de los CTAs "Iniciar expediente" de Materias y
 * reglas, del uso de MODELO_ACUERDO desde Plantillas/Gestor y del rescate de
 * vía muerta del Tramitador registral: la fase registral llega DESPUÉS de la
 * adopción, nunca como punto de entrada de una materia sin acuerdo adoptado.
 */

export type AdoptionRouteScope = "grupo" | "sociedad";

export interface AdoptionRouteTarget {
  to: string;
  /** Modo de adopción canónico que decide la ruta. */
  mode: string;
  label: string;
  hint: string;
}

/**
 * Prioridad de vía cuando la regla admite varios modos: la sesión formal es la
 * vía general del proceso societario; las vías escritas y unipersonales solo
 * se proponen como destino primario cuando la regla no admite sesión.
 */
const MODE_PRIORITY = [
  "MEETING",
  "UNIVERSAL",
  "NO_SESSION",
  "CO_APROBACION",
  "SOLIDARIO",
  "UNIPERSONAL_SOCIO",
  "UNIPERSONAL_ADMIN",
] as const;

const MODE_ROUTE: Record<string, { path: string; hint: string }> = {
  MEETING: {
    path: "/secretaria/convocatorias/nueva",
    hint: "Abre la convocatoria del órgano competente con esta materia en el orden del día.",
  },
  UNIVERSAL: {
    path: "/secretaria/convocatorias/nueva",
    hint: "Prepara la sesión y el orden del día con esta materia; la junta universal se constituye sin necesidad de convocatoria previa (art. 178 LSC).",
  },
  NO_SESSION: {
    path: "/secretaria/acuerdos-sin-sesion/nuevo",
    hint: "Abre el acuerdo por escrito y sin sesión con esta materia como propuesta.",
  },
  CO_APROBACION: {
    path: "/secretaria/acuerdos-sin-sesion/co-aprobacion",
    hint: "Abre la decisión mancomunada de administradores para esta materia.",
  },
  SOLIDARIO: {
    path: "/secretaria/acuerdos-sin-sesion/solidario",
    hint: "Abre la decisión de administrador solidario para esta materia.",
  },
  UNIPERSONAL_SOCIO: {
    path: "/secretaria/decisiones-unipersonales/nueva",
    hint: "Abre la decisión del socio único para esta materia.",
  },
  UNIPERSONAL_ADMIN: {
    path: "/secretaria/decisiones-unipersonales/nueva",
    hint: "Abre la decisión del administrador único para esta materia.",
  },
};

type AdoptionModeInput = string | { code?: string | null } | null | undefined;

export function normalizeAdoptionModes(modes?: ReadonlyArray<AdoptionModeInput> | null): string[] {
  if (!modes) return [];
  const normalized = modes
    .map((mode) => (typeof mode === "string" ? mode : mode?.code ?? ""))
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean);
  return Array.from(new Set(normalized));
}

export function pickPrimaryAdoptionMode(modes?: ReadonlyArray<AdoptionModeInput> | null): string {
  const normalized = normalizeAdoptionModes(modes);
  for (const mode of MODE_PRIORITY) {
    if (normalized.includes(mode)) return mode;
  }
  // Sin información de modos (regla no versionada o payload sin
  // modosAdopcionPermitidos): la sesión formal es la vía supletoria general.
  return "MEETING";
}

/**
 * Mapa grueso para los steppers de co-aprobación y administrador solidario,
 * cuyo selector de "Clase de materia" usa códigos agregados legacy. Devuelve
 * null cuando no hay correspondencia fiable: mejor no pre-seleccionar que
 * pre-seleccionar mal.
 */
export function coarseAdoptionMateria(materia?: string | null): string | null {
  const canonical = resolveMateriaAlias(materia);
  if (!canonical) return null;
  if (canonical === "APROBACION_CUENTAS") return "APROBACION_CUENTAS";
  if (["NOMBRAMIENTO_CONSEJERO", "CESE_CONSEJERO", "COOPTACION"].includes(canonical)) {
    return "NOMBRAMIENTO_CESE";
  }
  if (canonical === "MODIFICACION_ESTATUTOS") return "MOD_ESTATUTOS";
  if (
    ["FUSION", "ESCISION", "FUSION_ESCISION", "DISOLUCION", "TRANSFORMACION", "AUMENTO_CAPITAL", "REDUCCION_CAPITAL"].includes(
      canonical,
    )
  ) {
    return "OPERACION_ESTRUCTURAL";
  }
  if (canonical === "DELEGACION_FACULTADES") return "DELEGACION_FACULTADES";
  return null;
}

export function resolveAdoptionRoute(input: {
  materia: string;
  adoptionModes?: ReadonlyArray<AdoptionModeInput> | null;
  plantillaId?: string | null;
  scope?: AdoptionRouteScope | null;
  entityId?: string | null;
}): AdoptionRouteTarget {
  const mode = pickPrimaryAdoptionMode(input.adoptionModes);
  const route = MODE_ROUTE[mode] ?? MODE_ROUTE.MEETING;
  const params = new URLSearchParams();
  const materia = resolveMateriaAlias(input.materia);
  if (materia) params.set("materia", materia);
  if (input.plantillaId) params.set("plantilla", input.plantillaId);
  // La vía unipersonal distingue decisor: el stepper de destino pre-selecciona
  // socio único vs administrador único a partir de este parámetro.
  if (mode === "UNIPERSONAL_SOCIO") params.set("decisor", "SOCIO_UNICO");
  if (mode === "UNIPERSONAL_ADMIN") params.set("decisor", "ADMINISTRADOR_UNICO");
  if (input.scope) params.set("scope", input.scope);
  if (input.scope === "sociedad" && input.entityId) params.set("entity", input.entityId);
  const query = params.toString();
  return {
    to: query ? `${route.path}?${query}` : route.path,
    mode,
    label: "Iniciar adopción",
    hint: route.hint,
  };
}
