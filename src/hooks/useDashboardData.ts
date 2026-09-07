import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import { applyVisibleDataClass } from "@/lib/secretaria/data-class";

/**
 * Todas las consultas de este fichero van tenant-scoped y con `tenantId` en la
 * queryKey. Sin esa clave, `TenantProvider` arranca en `null` y dos tenants
 * comparten la misma entrada de caché de TanStack en la misma sesión de
 * navegador: RLS separa la base de datos, pero no la caché del cliente.
 */

export interface DashboardKpis {
  entidades: number | null;
  mandatosVencimiento: number | null;
  politicasPendientes: number | null;
  hallazgosAbiertos: number | null;
  delegacionesCaducadas: number | null;
}

function measuredCount(result: PromiseSettledResult<{ count: number | null; error: unknown }>): number | null {
  return result.status === "fulfilled" && !result.value.error
    ? result.value.count ?? null
    : null;
}

export function useDashboardKpis() {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["dashboard", "kpis", tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<DashboardKpis> => {
      const in90 = new Date();
      in90.setDate(in90.getDate() + 90);
      const in90Iso = in90.toISOString().slice(0, 10);

      const [ent, man, pol, fnd, del] = await Promise.allSettled([
        applyVisibleDataClass(
          supabase
            .from("entities")
            .select("*", { count: "exact", head: true })
            .eq("tenant_id", tenantId!)
            .eq("entity_status", "Active"),
        ),
        // ITEM-090: mandatos por vencer leídos de condiciones_persona (fuente
        // canónica). estado VIGENTE == mandato activo; fecha_fin == end_date.
        // mandates queda solo para vistas legacy del shell TGMS.
        supabase
          .from("condiciones_persona")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", tenantId!)
          .eq("estado", "VIGENTE")
          .not("fecha_fin", "is", null)
          .lt("fecha_fin", in90Iso),
        supabase
          .from("policies")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", tenantId!)
          .in("status", ["In Review", "Approval Pending"]),
        supabase
          .from("findings")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", tenantId!)
          .eq("status", "Abierto"),
        supabase
          .from("delegations")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", tenantId!)
          .eq("status", "Caducada"),
      ]);

      return {
        entidades: measuredCount(ent),
        mandatosVencimiento: measuredCount(man),
        politicasPendientes: measuredCount(pol),
        hallazgosAbiertos: measuredCount(fnd),
        delegacionesCaducadas: measuredCount(del),
      };
    },
  });
}

export interface NotificationRow {
  id: string;
  title: string;
  body: string | null;
  route: string | null;
  type: "error" | "warning" | "info" | string;
  is_read: boolean;
  created_at: string;
}

export interface DashboardAlerts {
  items: NotificationRow[];
  total: number | null;
}

export function useDashboardAlerts() {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["dashboard", "alerts", tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<DashboardAlerts> => {
      const { data, error, count } = await supabase
        .from("notifications")
        .select("*", { count: "exact" })
        .eq("tenant_id", tenantId!)
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(7);
      if (error) throw error;
      return { items: (data ?? []) as NotificationRow[], total: count ?? null };
    },
  });
}

export interface UpcomingMeetingRow {
  id: string;
  slug: string;
  scheduled_start: string;
  status: string;
  body_name: string;
  body_slug: string;
}

export function useUpcomingMeetings() {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["dashboard", "upcomingMeetings", tenantId],
    enabled: !!tenantId,
    queryFn: async (): Promise<UpcomingMeetingRow[]> => {
      const { data, error } = await supabase
        .from("meetings")
        .select("id, slug, scheduled_start, status, governing_bodies!inner(name, slug)")
        .eq("tenant_id", tenantId!)
        .eq("status", "CONVOCADA")
        .order("scheduled_start", { ascending: true })
        .limit(5);
      if (error) throw error;
      type Raw = {
        id: string;
        slug: string;
        scheduled_start: string;
        status: string;
        governing_bodies?: { name?: string | null; slug?: string | null } | null;
      };
      return ((data ?? []) as Raw[]).map((m) => ({
        id: m.id,
        slug: m.slug,
        scheduled_start: m.scheduled_start,
        status: m.status,
        body_name: m.governing_bodies?.name ?? "",
        body_slug: m.governing_bodies?.slug ?? "",
      }));
    },
  });
}
