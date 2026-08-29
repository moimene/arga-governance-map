import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";

export type ExceptionRow = {
  id: string;
  code: string;
  status: string;
  justification: string | null;
  compensatory_controls: string | null;
  requested_at: string | null;
  expires_at: string | null;
  obligation_id: string | null;
  obligations?: { code?: string | null; title?: string | null } | null;
};

export type CreateExceptionInput = {
  code?: string;
  justification: string;
  compensatory_controls: string;
  expires_at: string;
  obligation_id?: string | null;
};

export function useExceptions() {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["grc", "excepciones", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exceptions")
        .select("id, code, status, justification, compensatory_controls, requested_at, expires_at, obligation_id, obligations:obligation_id(code, title)")
        .eq("tenant_id", tenantId!)
        .order("requested_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ExceptionRow[];
    },
  });
}

export function useCreateException() {
  const { tenantId } = useTenantContext();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateExceptionInput) => {
      const code = input.code || `EXC-2026-${Math.floor(100 + Math.random() * 900)}`;
      const { data, error } = await supabase
        .from("exceptions")
        .insert({
          code,
          justification: input.justification,
          compensatory_controls: input.compensatory_controls,
          expires_at: input.expires_at,
          obligation_id: input.obligation_id || null,
          status: "PENDIENTE",
          tenant_id: tenantId!,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["grc", "excepciones"] });
    },
  });
}
