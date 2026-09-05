import { Navigate, useParams } from "react-router-dom";
import { useTenantBranding, useTenantBrandingLoading } from "@/context/TenantBrandContext";
import { isModuleEnabled } from "@/lib/tenant-modules";

function ModuleFallback() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-[var(--g-text-secondary)]">
      Cargando...
    </div>
  );
}

/**
 * D-5 — guard de ruta por módulo. Espera a que el branding cargue antes de
 * decidir: useTenantBranding() devuelve null tanto para ARGA como durante la
 * carga, y redirigir con esa ambigüedad produce parpadeo/falso negativo.
 */
export function RequireModule({ moduleKey, children }: { moduleKey: string; children: React.ReactNode }) {
  const branding = useTenantBranding();
  const loading = useTenantBrandingLoading();
  if (loading) return <ModuleFallback />;
  if (!isModuleEnabled(branding, moduleKey)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/**
 * Guard por módulo de la ruta dinámica /grc/m/:moduleId.
 *
 * Antes solo gateaba `dora` y dejaba pasar cualquier otro moduleId, con este
 * motivo escrito: generalizar «evaluaría la lista blanca de Garrigues contra
 * cualquier moduleId y los ocultaría todos». Eso es hoy exactamente lo que se
 * quiere: las vistas de esos módulos son fixtures de una aseguradora (pólizas,
 * siniestros, tomadores) y un despacho no debe alcanzarlas por URL directa.
 *
 * ARGA no cambia: su `branding` es NULL e `isModuleEnabled` falla ABIERTO, así
 * que sigue viendo las diez vistas. Garrigues declara lista blanca sin dora,
 * gdpr, cyber ni audit, y deja de alcanzarlas.
 */
export function RequireGrcModule({ children }: { children: React.ReactNode }) {
  const { moduleId } = useParams();
  if (!moduleId) return <>{children}</>;
  return <RequireModule moduleKey={moduleId}>{children}</RequireModule>;
}
