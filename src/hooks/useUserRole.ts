import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";

type UserRoleRow = {
  rbac_roles: { role_code: string; display_name: string; permissions: string[] } | null;
};

export function useUserRole(userId?: string) {
  const query = useQuery({
    enabled: !!userId,
    queryKey: ["rbac_user_roles", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rbac_user_roles")
        .select("*, rbac_roles!inner(role_code, display_name, permissions)")
        .eq("tenant_id", DEMO_TENANT)
        .eq("user_id", userId!)
        .eq("is_active", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = (query.data ?? []) as UserRoleRow[];
  const roles = rows.map((r) => r.rbac_roles?.role_code).filter(Boolean);
  const allPerms = rows.flatMap((r) => {
    const perms = r.rbac_roles?.permissions;
    return Array.isArray(perms) ? perms : [];
  });
  const permissions = [...new Set(allPerms)];

  const hasPermission = (perm: string) => {
    if (permissions.includes("*")) return true;
    if (permissions.includes(perm)) return true;
    const [resource] = perm.split(":");
    return permissions.includes(`${resource}:*`);
  };

  return { roles, permissions, hasPermission, isLoading: query.isLoading };
}
