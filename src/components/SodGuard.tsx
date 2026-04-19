import { useState } from "react";
import { AlertTriangle, ShieldAlert, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";

interface SodViolation {
  conflicting_role: string;
  reason: string;
  severity: string;
}

interface SodGuardProps {
  userId: string;
  proposedRole: string;
  onResult?: (violations: SodViolation[]) => void;
}

export function SodGuard({ userId, proposedRole, onResult }: SodGuardProps) {
  const [violations, setViolations] = useState<SodViolation[]>([]);
  const [checked, setChecked] = useState(false);
  const [checking, setChecking] = useState(false);

  const checkSod = async () => {
    setChecking(true);
    try {
      const { data, error } = await supabase.rpc("fn_check_sod_violations", {
        p_tenant_id: DEMO_TENANT,
        p_user_id: userId,
        p_proposed_role: proposedRole,
      });
      if (error) throw error;
      const v = (data ?? []) as SodViolation[];
      setViolations(v);
      setChecked(true);
      onResult?.(v);
    } catch (e) {
      console.error("SoD check failed for", { userId, proposedRole }, e);
    } finally {
      setChecking(false);
    }
  };

  if (!checked) {
    return (
      <button
        type="button"
        onClick={checkSod}
        disabled={checking}
        className="flex items-center gap-2 px-3 py-2 text-xs font-medium border border-[var(--g-border-subtle)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] transition-colors disabled:opacity-50"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        <ShieldAlert className="h-3.5 w-3.5" />
        {checking ? "Verificando SoD..." : "Verificar Segregación de Funciones"}
      </button>
    );
  }

  if (violations.length === 0) {
    return (
      <div
        className="flex items-center gap-2 px-4 py-3 text-sm text-[var(--status-success)]"
        style={{ borderRadius: "var(--g-radius-md)", background: "var(--g-sec-100)" }}
      >
        <ShieldCheck className="h-4 w-4" />
        Sin conflictos de segregación de funciones
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {violations.map((v, i) => (
        <div
          key={i}
          className={`flex items-start gap-3 px-4 py-3 text-sm ${
            v.severity === "BLOCK"
              ? "text-[var(--status-error)]"
              : "text-[var(--g-text-primary)]"
          }`}
          style={{
            borderRadius: "var(--g-radius-md)",
            background: v.severity === "BLOCK" ? "hsl(0 84% 60% / 0.08)" : "var(--g-surface-muted)",
            border: v.severity === "BLOCK" ? "1px solid var(--status-error)" : "1px solid var(--g-border-subtle)",
          }}
        >
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">
              {v.severity === "BLOCK" ? "BLOQUEADO" : "ADVERTENCIA"}: Conflicto con rol {v.conflicting_role}
            </div>
            <div className="text-xs mt-1 text-[var(--g-text-secondary)]">{v.reason}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
