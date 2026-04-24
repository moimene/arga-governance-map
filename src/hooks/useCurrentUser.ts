import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "./useUserRole";
import { useTenantContext } from "@/context/TenantContext";

interface CurrentUser {
  id: string;
  email: string | null;
}

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ? { id: data.user.id, email: data.user.email ?? null } : null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email ?? null } : null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { user, loading };
}

export function useCurrentUserProfile() {
  const { user } = useCurrentUser();
  const { tenantId } = useTenantContext();

  return useQuery({
    queryKey: ["user_profiles", tenantId, user?.id],
    enabled: !!user?.id && !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*, persons(full_name)")
        .eq("user_id", user!.id)
        .eq("tenant_id", tenantId!)
        .maybeSingle();
      if (error) throw error;
      type ProfileRaw = { role_code: string | null; persons?: { full_name?: string | null } | null };
      const row = data as ProfileRaw | null;
      return {
        roleCode: row?.role_code ?? null,
        displayName: row?.persons?.full_name ?? null,
      };
    },
  });
}

export function useCurrentUserRole() {
  const { user, loading: userLoading } = useCurrentUser();
  const { roles, permissions, hasPermission, isLoading: roleLoading } = useUserRole(user?.id);
  const { data: profile, isLoading: profileLoading } = useCurrentUserProfile();

  // Prefer rbac_user_roles role; fall back to user_profiles.role_code; then "SECRETARIO" for demo
  const primaryRole = roles[0] ?? profile?.roleCode ?? "SECRETARIO";
  const displayName = profile?.displayName ?? user?.email ?? "Usuario";

  return {
    user,
    primaryRole,
    displayName,
    roles,
    permissions,
    hasPermission,
    isLoading: userLoading || roleLoading || profileLoading,
  };
}
