import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";

function useBcm() {
  return useQuery({
    queryKey: ["grc", "bcm"],
    queryFn: async () => {
      const [bia, plans] = await Promise.all([
        supabase
          .from("bcm_bia")
          .select("id, function_name, is_critical, rto_objective, rpo_objective, mtd_objective, approved_at")
          .eq("tenant_id", DEMO_TENANT)
          .order("function_name"),
        supabase
          .from("bcm_plans")
          .select("id, plan_code, plan_type, bia_id, last_test_date, next_test_date, test_result, bcm_bia:bia_id(function_name)")
          .eq("tenant_id", DEMO_TENANT),
      ]);
      return { bia: bia.data ?? [], plans: plans.data ?? [] };
    },
  });
}

export default function BCM() {
  const { data, isLoading } = useBcm();

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-[var(--g-text-primary)]">Business Continuity</h1>
        <p className="text-sm text-[var(--g-text-secondary)]">
          BIA · Funciones críticas y objetivos de recuperación DORA.
        </p>
      </header>

      {isLoading && <div className="text-sm text-[var(--g-text-secondary)] animate-pulse">Cargando…</div>}

      {/* BIA table */}
      <div
        className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)]"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="px-5 py-4 border-b border-[var(--g-border-subtle)]">
          <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">
            BIA · Funciones analizadas ({data?.bia.length ?? 0})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--g-surface-subtle)]">
                {["Función", "Crítica", "RTO (h)", "RPO (h)", "MTD (h)", "Aprobada"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--g-border-subtle)]">
              {(data?.bia ?? []).map((b: any) => (
                <tr key={b.id} className="hover:bg-[var(--g-surface-subtle)]/50 transition-colors">
                  <td className="px-5 py-3 font-medium text-[var(--g-text-primary)]">{b.function_name}</td>
                  <td className="px-5 py-3">
                    {b.is_critical ? (
                      <span
                        className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-[var(--status-error)] text-[var(--g-text-inverse)]"
                        style={{ borderRadius: "var(--g-radius-full)" }}
                      >
                        Sí
                      </span>
                    ) : (
                      <span className="text-[var(--g-text-secondary)]">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-[var(--g-text-secondary)]">{b.rto_objective}</td>
                  <td className="px-5 py-3 text-[var(--g-text-secondary)]">{b.rpo_objective}</td>
                  <td className="px-5 py-3 text-[var(--g-text-secondary)]">{b.mtd_objective}</td>
                  <td className="px-5 py-3 text-[var(--g-text-secondary)]">{b.approved_at ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Plans table */}
      <div
        className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)]"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="px-5 py-4 border-b border-[var(--g-border-subtle)]">
          <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">
            Planes BCP/DRP ({data?.plans.length ?? 0})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--g-surface-subtle)]">
                {["Código", "Tipo", "Función", "Último test", "Próx. test", "Resultado"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--g-border-subtle)]">
              {(data?.plans ?? []).map((p: any) => (
                <tr key={p.id} className="hover:bg-[var(--g-surface-subtle)]/50 transition-colors">
                  <td className="px-5 py-3 font-medium text-[var(--g-text-primary)]">{p.plan_code}</td>
                  <td className="px-5 py-3">
                    <span
                      className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]"
                      style={{ borderRadius: "var(--g-radius-full)" }}
                    >
                      {p.plan_type}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[var(--g-text-secondary)]">
                    {(p.bcm_bia as any)?.function_name ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-[var(--g-text-secondary)]">{p.last_test_date ?? "—"}</td>
                  <td className="px-5 py-3 text-[var(--g-text-secondary)]">{p.next_test_date ?? "—"}</td>
                  <td className="px-5 py-3 text-[var(--g-text-secondary)]">{p.test_result ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
