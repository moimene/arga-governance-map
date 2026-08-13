/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";

// Perfil de marca por tenant (tenants.branding). null = marca por defecto
// del producto (ARGA/TGMS): el provider no escribe ningún token y los
// consumidores usan sus strings default — cero cambio visual.
export interface TenantBranding {
  nombre?: string;
  shell_label?: string;
  scope_label?: string;
  sii_org_label?: string;
  tokens?: Record<string, string>;
}

const TenantBrandContext = createContext<TenantBranding | null>(null);
const TenantBrandLoadingContext = createContext<boolean>(false);

/** Aplica tokens CSS custom (--*) sobre `el` y devuelve el cleanup exacto. */
export function applyBrandTokens(
  el: HTMLElement,
  tokens?: Record<string, string> | null,
): () => void {
  if (!tokens) return () => {};
  const applied: string[] = [];
  for (const [k, v] of Object.entries(tokens)) {
    if (!k.startsWith("--") || typeof v !== "string") continue;
    el.style.setProperty(k, v);
    applied.push(k);
  }
  return () => {
    for (const k of applied) el.style.removeProperty(k);
  };
}

export function TenantBrandProvider({ children }: { children: ReactNode }) {
  const { tenantId } = useTenantContext();

  const { data, isLoading } = useQuery({
    queryKey: ["tenant-branding", tenantId],
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .eq("id", tenantId!)
        .maybeSingle();
      if (error) throw error;
      // Los tipos generados no incluyen `branding` (regeneración diferida, G0):
      // cast local vía unknown, mismo patrón que useSii con vistas no tipadas.
      const row = data as unknown as { branding?: TenantBranding | null } | null;
      return row?.branding ?? null;
    },
  });

  const branding = data ?? null;
  const brandingLoading = !!tenantId && isLoading;

  useEffect(
    () => applyBrandTokens(document.documentElement, branding?.tokens),
    [branding],
  );

  return (
    <TenantBrandContext.Provider value={branding}>
      <TenantBrandLoadingContext.Provider value={brandingLoading}>
        {children}
      </TenantBrandLoadingContext.Provider>
    </TenantBrandContext.Provider>
  );
}

export function useTenantBranding(): TenantBranding | null {
  return useContext(TenantBrandContext) ?? null;
}

/** true mientras la query de branding está en vuelo. Necesario para los
 *  guards de ruta: useTenantBranding() devuelve null tanto para ARGA como
 *  durante la carga, y redirigir con esa ambigüedad produce parpadeo. */
export function useTenantBrandingLoading(): boolean {
  return useContext(TenantBrandLoadingContext);
}
