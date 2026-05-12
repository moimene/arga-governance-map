import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import type { NotificationRow } from "./useDashboardData";

export function useAllNotifications() {
  return useQuery({
    queryKey: ["notifications", "all"],
    queryFn: async (): Promise<NotificationRow[]> => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as NotificationRow[];
    },
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ["notifications", "unreadCount"],
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("is_read", false);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["dashboard", "alerts"] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("notifications").update({ is_read: true }).eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["dashboard", "alerts"] });
    },
  });
}

/**
 * L13-B: escaneo no bloqueante de vacancia presidencial.
 *
 * La RPC persiste notificaciones internas D+0/D+60/D+90 para Secretaría.
 * Si la migración aún no está aplicada o el usuario no tiene rol operativo,
 * el hook degrada a no-op para no romper la carga del dashboard.
 */
export function useAutoScanVacanciasPresidencia() {
  const { tenantId } = useTenantContext();
  const qc = useQueryClient();

  return useQuery({
    queryKey: ["vacancia-presidencia-scan", tenantId],
    enabled: !!tenantId,
    retry: false,
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<unknown> => {
      const { data, error } = await supabase.rpc("fn_scan_vacancias_presidencia", {
        p_tenant_id: tenantId,
      });

      if (error) {
        console.warn("Vacancia presidencial scan skipped:", error.message);
        return { skipped: true, error: error.message };
      }

      await Promise.all([
        qc.invalidateQueries({ queryKey: ["notifications", "all"], exact: true }),
        qc.invalidateQueries({ queryKey: ["notifications", "unreadCount"], exact: true }),
        qc.invalidateQueries({ queryKey: ["dashboard", "alerts"] }),
      ]);

      return data;
    },
  });
}
