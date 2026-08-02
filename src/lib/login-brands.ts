// Marca del Login por query param (?tenant=). Login es PRE-AUTH: no hay
// sesión ni tenant resuelto, así que no puede leer tenants.branding.
// Mapa estático mínimo y consciente (duplica 6 valores del branding Cloud);
// tras el login manda TenantBrandProvider. Emails demo SIEMPRE en dominio
// ficticio (garrigues-demo.dev), jamás el dominio real del despacho.
export interface LoginBrand {
  key: "arga" | "garrigues";
  nombre: string;
  sufijo: string;
  tagline: string;
  footer: string;
  panelBg?: string; // fondo inline del panel izquierdo (sin provider aún)
  demoEmail: string;
  demoPassword: string;
}

const LOGIN_BRANDS: Record<string, LoginBrand> = {
  arga: {
    key: "arga",
    nombre: "ARGA",
    sufijo: "Seguros",
    tagline: "Sistema de Gobernanza Corporativa",
    footer: "TGMS v1.0 · Entorno seguro",
    demoEmail: "demo@arga-seguros.com",
    demoPassword: "TGMSdemo2026!",
  },
  garrigues: {
    key: "garrigues",
    nombre: "Garrigues",
    sufijo: "Gobernanza",
    tagline: "Gobernanza del despacho y de su grupo",
    footer: "g-digital · Demo sin efecto jurídico",
    panelBg: "#004438",
    demoEmail: "demo@garrigues-demo.dev",
    demoPassword: "TGMSdemo2026!",
  },
};

export function resolveLoginBrand(search: string): LoginBrand {
  const t = (new URLSearchParams(search).get("tenant") ?? "").toLowerCase();
  return LOGIN_BRANDS[t] ?? LOGIN_BRANDS.arga;
}
