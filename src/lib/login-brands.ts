// Marca del Login por query param (?tenant=) o selector interactivo.
// Login es PRE-AUTH: no hay sesión ni tenant resuelto, así que no puede leer tenants.branding.
// Mapa estático mínimo y consciente; tras el login manda TenantBrandProvider.
//
// SIN CREDENCIALES (rotación 2026-09-05): esta pantalla no conoce ninguna contraseña.
// Las cuentas demo viven en Auth y su contraseña solo en `.env` (DEMO_PASSWORD_*),
// nunca en el repo ni en la UI. La selección de entorno se contrasta con
// `user_profiles.tenant_id` después de autenticar (loginTenantMismatch).
export interface LoginBrandFeature {
  icon: "network" | "shield" | "eye" | "scale" | "compass" | "brain";
  title: string;
  description?: string;
}

export type LoginBrandKey = "arga" | "garrigues" | "nuevo";

export interface LoginBrand {
  key: LoginBrandKey;
  tenantId: string; // tenants.id al que da acceso este entorno
  nombre: string;
  sufijo: string;
  entorno: string; // subtítulo bajo el H1 de acceso
  tagline: string;
  badge: string;
  footer: string;
  panelBg?: string; // fondo inline del panel izquierdo (sin provider aún)
  accentColor: string;
  /** Fondo del botón de acceso. Pre-auth no hay provider de marca que lo resuelva. */
  ctaBg?: string;
  defaultPath: string; // ruta destino tras autenticación
  emailPlaceholder: string;
  features: LoginBrandFeature[];
}

export const LOGIN_BRANDS: Record<string, LoginBrand> = {
  arga: {
    key: "arga",
    tenantId: "00000000-0000-0000-0000-000000000001",
    nombre: "ARGA",
    sufijo: "Seguros",
    entorno: "Consola corporativa del grupo asegurador",
    tagline: "Sistema de Gobernanza Corporativa de Grupo",
    badge: "Consola Corporativa TGMS",
    footer: "TGMS v1.0 · Entorno seguro asegurador",
    panelBg: "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)",
    accentColor: "#E8112D",
    defaultPath: "/",
    emailPlaceholder: "usuario@argaseguros.com",
    features: [
      {
        icon: "network",
        title: "Consola de Gobernanza y Mapa de Grupo",
        description: "Visión integral de entidades, órganos y delegaciones",
      },
      {
        icon: "shield",
        title: "Trazabilidad Norma → Control → Evidencia",
        description: "Matriz de cumplimiento, políticas y auditoría",
      },
      {
        icon: "eye",
        title: "Auditoría Nativa WORM y Canal Ético (SII)",
        description: "Inmutabilidad de evidencias y buzón seguro",
      },
    ],
  },
  garrigues: {
    key: "garrigues",
    tenantId: "00000000-0000-0000-0000-000000000002",
    nombre: "Garrigues",
    sufijo: "Corporate Solutions",
    entorno: "Gobernanza del despacho y de las sociedades gestionadas",
    tagline: "Sistema de Gobernanza Corporativa & Despacho",
    badge: "Consola Corporativa Garrigues",
    footer: "g-digital · Demo sin efecto jurídico",
    panelBg: "#004438",
    accentColor: "#009a77",
    defaultPath: "/",
    emailPlaceholder: "usuario@garrigues-demo.dev",
    features: [
      {
        icon: "network",
        title: "Consola de Gobernanza y Mapa de Grupo",
        description: "Visión integral de sociedades gestionadas y órganos",
      },
      {
        icon: "scale",
        title: "Secretaría Societaria & Motor de Reglas LSC",
        description: "Convocatorias, acuerdos, actas, libros y plantillas",
      },
      {
        icon: "compass",
        title: "GRC Compass & AI Governance (AIMS 360)",
        description: "Riesgo penal, ciberseguridad y supervisión de la IA",
      },
    ],
  },
  // Tenant EN BLANCO (spec 2026-09-19): nace sin una sola sociedad y se cablea
  // por pantalla. La fuente de verdad del tenant es
  // `scripts/tenants/tenant-spec.ts`; un test vigila que este `tenantId` no
  // diverja de aquel. Marca descriptiva y sin narrativa: no es un cliente.
  nuevo: {
    key: "nuevo",
    tenantId: "00000000-0000-0000-0000-000000000003",
    nombre: "Grupo Nuevo",
    sufijo: "Entorno en blanco",
    entorno: "Grupo creado desde cero: sin sociedades ni datos sembrados",
    tagline: "Sistema de Gobernanza Corporativa — alta de un grupo desde cero",
    badge: "Consola Corporativa TGMS",
    footer: "TGMS · Entorno en blanco · Demo sin efecto jurídico",
    panelBg: "#1f3a5f",
    accentColor: "#3b6ea8",
    ctaBg: "#1f3a5f",
    defaultPath: "/",
    emailPlaceholder: "usuario@grupo-nuevo-demo.dev",
    features: [
      {
        icon: "network",
        title: "Alta de sociedades y estructura de grupo",
        description: "Matriz, filiales, capital, socios, órganos y cargos por pantalla",
      },
      {
        icon: "scale",
        title: "Secretaría Societaria sobre el derecho común",
        description: "Convocatorias, acuerdos, actas y libros con el pack base LSC",
      },
      {
        icon: "compass",
        title: "GRC, AI Governance y canal interno",
        description: "Todos los módulos abiertos para recorrer el sistema completo",
      },
    ],
  },
};

export function resolveLoginBrand(searchOrKey: string): LoginBrand {
  let t = searchOrKey || "";
  if (t.startsWith("?") || t.includes("=")) {
    t = (new URLSearchParams(t).get("tenant") ?? "").toLowerCase();
  } else {
    t = t.toLowerCase();
  }

  // hasOwnProperty explícito anti prototype-pollution
  return Object.prototype.hasOwnProperty.call(LOGIN_BRANDS, t)
    ? LOGIN_BRANDS[t]
    : LOGIN_BRANDS.arga;
}

/**
 * Entornos que el selector ofrece SIEMPRE. Un entorno fuera de esta lista (p. ej.
 * un tenant en blanco) solo aparece cuando se llega por su enlace `?tenant=…`:
 * la pantalla que ven las demos de ARGA y Garrigues no cambia, y cada entorno
 * nuevo se entrega con su propio enlace de acceso.
 */
export const ENTORNOS_BASE: readonly LoginBrandKey[] = ["arga", "garrigues"];

export function entornosVisibles(inicial: LoginBrandKey): LoginBrandKey[] {
  return ENTORNOS_BASE.includes(inicial) ? [...ENTORNOS_BASE] : [...ENTORNOS_BASE, inicial];
}

/** Ruta de /login con el entorno preseleccionado. */
export function loginPathFor(key: LoginBrandKey): string {
  return `/login?tenant=${key}`;
}

/** Entorno al que pertenece un tenant, o null si no está en esta pantalla. */
export function brandForTenant(tenantId: string | null | undefined): LoginBrand | null {
  if (!tenantId) return null;
  return Object.values(LOGIN_BRANDS).find((b) => b.tenantId === tenantId) ?? null;
}

/**
 * Motivo por el que una sesión recién autenticada NO puede entrar en el entorno
 * elegido; null si encaja. Una cuenta sin perfil (autoalta huérfana) tampoco entra.
 */
export function loginTenantMismatch(
  selected: LoginBrand,
  tenantId: string | null | undefined,
): string | null {
  if (!tenantId) return "Esta cuenta no tiene perfil en ningún entorno. Solicita el alta al administrador.";
  if (tenantId === selected.tenantId) return null;
  const real = brandForTenant(tenantId);
  return real
    ? `Esta cuenta pertenece al entorno ${real.nombre}, no a ${selected.nombre}. Selecciona el entorno correcto.`
    : "Esta cuenta pertenece a un entorno que no está disponible en esta pantalla.";
}
