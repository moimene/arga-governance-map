// Marca del Login por query param (?tenant=) o selector interactivo.
// Login es PRE-AUTH: no hay sesión ni tenant resuelto, así que no puede leer tenants.branding.
// Mapa estático mínimo y consciente; tras el login manda TenantBrandProvider.
// Emails demo SIEMPRE en dominio ficticio o demo.
export interface LoginBrandFeature {
  icon: "network" | "shield" | "eye" | "scale" | "compass" | "brain";
  title: string;
  description?: string;
}

export interface LoginBrand {
  key: "arga" | "garrigues";
  nombre: string;
  sufijo: string;
  tagline: string;
  badge: string;
  footer: string;
  panelBg?: string; // fondo inline del panel izquierdo (sin provider aún)
  accentColor: string;
  defaultPath: string; // ruta destino tras autenticación
  demoEmail: string;
  demoPassword: string;
  features: LoginBrandFeature[];
}

export const LOGIN_BRANDS: Record<string, LoginBrand> = {
  arga: {
    key: "arga",
    nombre: "ARGA",
    sufijo: "Seguros",
    tagline: "Sistema de Gobernanza Corporativa de Grupo",
    badge: "Consola Corporativa TGMS",
    footer: "TGMS v1.0 · Entorno seguro asegurador",
    panelBg: "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)",
    accentColor: "#E8112D",
    defaultPath: "/",
    demoEmail: "demo@arga-seguros.com",
    demoPassword: "TGMSdemo2026!",
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
    nombre: "Garrigues",
    sufijo: "Corporate Solutions",
    tagline: "Sistema de Gobernanza Corporativa & Despacho",
    badge: "Consola Corporativa Garrigues",
    footer: "g-digital · Demo sin efecto jurídico",
    panelBg: "#004438",
    accentColor: "#009a77",
    defaultPath: "/",
    demoEmail: "demo@garrigues-demo.dev",
    demoPassword: "TGMSdemo2026!",
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
