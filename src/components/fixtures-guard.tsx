import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { useTenantBranding, useTenantBrandingLoading } from "@/context/TenantBrandContext";
import { useTenantContext } from "@/context/TenantContext";
import { usaFixturesDemo } from "@/lib/tenant-fixtures";

/**
 * Guard de las páginas que se alimentan ENTERAS de fixtures estáticos de demo
 * (`src/data/*`): ESG y Notificaciones. Un tenant que declara
 * `branding.fixtures = "none"` ve un estado vacío honesto en lugar del dato de
 * otro grupo. Los demás tenants ven la página tal cual.
 *
 * Mismas DOS esperas que `RequireModule` y por el mismo motivo: mientras el
 * perfil o el branding están en vuelo, `useTenantBranding()` vale null igual que
 * para ARGA, y decidir con esa ambigüedad pintaría el fixture durante un frame
 * justo al tenant que pidió no verlo.
 */
export function SoloConFixturesDemo({ titulo, children }: { titulo: string; children: ReactNode }) {
  const { isLoading: tenantLoading } = useTenantContext();
  const branding = useTenantBranding();
  const brandingLoading = useTenantBrandingLoading();

  if (tenantLoading || brandingLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Cargando...</div>
    );
  }
  if (usaFixturesDemo(branding)) return <>{children}</>;

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{titulo}</h1>
      <div
        role="status"
        className="mt-6 flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center"
      >
        <Inbox className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-medium text-foreground">Sin datos todavía</p>
        <p className="max-w-xl text-sm text-muted-foreground">
          Esta vista todavía no se alimenta de datos del entorno: en los entornos de demostración muestra un
          conjunto de ejemplo. En un entorno en blanco no se muestra para no presentar como propio el dato de otro grupo.
        </p>
      </div>
    </div>
  );
}
