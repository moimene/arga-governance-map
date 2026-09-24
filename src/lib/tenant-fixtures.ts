// Fixtures estáticos de demo (`src/data/*`) por tenant.
//
// POR QUÉ EXISTE. ESG, «Actividad reciente» y Notificaciones no leen de Cloud:
// pintan ficheros estáticos escritos para la demo de ARGA (nombres, cifras,
// sociedades de ese grupo). En un tenant que nace EN BLANCO para cablearse por
// pantalla, esas superficies enseñarían el dato de otro grupo como si fuera
// suyo. Un tenant lo evita declarando `branding.fixtures = "none"`.
//
// CONTRATO. Solo se apaga con la declaración EXPRESA. branding NULL (ARGA, o
// carga en vuelo) y branding sin la clave (Garrigues) siguen viendo lo mismo que
// hoy: cero cambio para los dos tenants existentes. Por eso es una lista negra
// por declaración y no un «solo ARGA»: cambiar lo que ve Garrigues no es
// competencia de este módulo.
import type { TenantBranding } from "@/context/TenantBrandContext";

type BrandingWithFixtures = TenantBranding & { fixtures?: unknown };

export function usaFixturesDemo(branding: BrandingWithFixtures | null): boolean {
  if (!branding) return true;
  return branding.fixtures !== "none";
}
