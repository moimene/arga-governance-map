import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DashboardKpis {
  entidades: number;
  mandatosVencimiento: number;
  politicasPendientes: number;
  hallazgosAbiertos: number;
  delegacionesCaducadas: number;
}

export function useDashboardKpis() {
  return useQuery({
    queryKey: ["dashboard", "kpis"],
    queryFn: async (): Promise<DashboardKpis> => {
      const in90 = new Date();
      in90.setDate(in90.getDate() + 90);
      const in90Iso = in90.toISOString().slice(0, 10);

      const [ent, man, pol, fnd, del] = await Promise.all([
        supabase.from("entities").select("*", { count: "exact", head: true }).eq("entity_status", "Active"),
        supabase.from("mandates").select("*", { count: "exact", head: true }).eq("status", "Activo").lt("end_date", in90Iso),
        supabase.from("policies").select("*", { count: "exact", head: true }).in("status", ["In Review", "Approval Pending"]),
        supabase.from("findings").select("*", { count: "exact", head: true }).eq("status", "Abierto"),
        supabase.from("delegations").select("*", { count: "exact", head: true }).eq("status", "Caducada"),
      ]);

      return {
        entidades: ent.count ?? 0,
        mandatosVencimiento: man.count ?? 0,
        politicasPendientes: pol.count ?? 0,
        hallazgosAbiertos: fnd.count ?? 0,
        delegacionesCaducadas: del.count ?? 0,
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

export function useDashboardAlerts() {
  return useQuery({
    queryKey: ["dashboard", "alerts"],
    queryFn: async (): Promise<NotificationRow[]> => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(7);
      if (error) throw error;
      return (data ?? []) as NotificationRow[];
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
  return useQuery({
    queryKey: ["dashboard", "upcomingMeetings"],
    queryFn: async (): Promise<UpcomingMeetingRow[]> => {
      const { data, error } = await supabase
        .from("meetings")
        .select("id, slug, scheduled_start, status, governing_bodies!inner(name, slug)")
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
