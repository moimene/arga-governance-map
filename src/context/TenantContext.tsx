/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

// ── Types ────────────────────────────────────────────────────────────────────

export interface TenantContextValue {
  tenantId: string | null;
  entityId: string | null;
  personId: string | null;
  roleCode: string | null;
  isLoading: boolean;
}

// ── Context ──────────────────────────────────────────────────────────────────

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

// ── Provider ─────────────────────────────────────────────────────────────────

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [entityId, setEntityId] = useState<string | null>(null);
  const [personId, setPersonId] = useState<string | null>(null);
  const [roleCode, setRoleCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setTenantId(null);
      setEntityId(null);
      setPersonId(null);
      setRoleCode(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    supabase
      .from("user_profiles")
      .select("tenant_id, entity_id, person_id, role_code")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error("[TenantContext] Error loading user_profiles:", error.message);
        }
        setTenantId(data?.tenant_id ?? null);
        setEntityId(data?.entity_id ?? null);
        setPersonId(data?.person_id ?? null);
        setRoleCode(data?.role_code ?? null);
        setIsLoading(false);
      });
  }, [userId]);

  return (
    <TenantContext.Provider
      value={{ tenantId, entityId, personId, roleCode, isLoading }}
    >
      {children}
    </TenantContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useTenantContext(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenantContext must be inside TenantProvider");
  return ctx;
}
