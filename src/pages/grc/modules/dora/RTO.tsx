import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";

type BiaRow = {
  id: string;
  function_name: string;
  is_critical: boolean | null;
  rto_objective: number | null;
  rpo_objective: number | null;
  mtd_objective: number | null;
};

function useBia() {
  return useQuery({
    queryKey: ["grc", "bia"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bcm_bia")
        .select("id, function_name, is_critical, rto_objective, rpo_objective, mtd_objective")
        .eq("tenant_id", DEMO_TENANT)
        .order("function_name");
      if (error) throw error;
      return (data ?? []) as BiaRow[];
    },
  });
}

function RtoGauge({ label, hours }: { label: string; hours: number | null }) {
  const pct = Math.min(100, ((hours ?? 0) / 24) * 100);
  const color =
    (hours ?? 0) <= 4
      ? "bg-[var(--status-error)]"
      : (hours ?? 0) <= 8
      ? "bg-[var(--status-warning)]"
      : "bg-[var(--g-brand-bright)]";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--g-text-secondary)]">{label}</span>
        <span className="text-lg font-bold text-[var(--g-text-primary)]">
          {hours ?? "—"}h
        </span>
      </div>
      <div
        className="h-2 w-full bg-[var(--g-surface-muted)] overflow-hidden"
        style={{ borderRadius: "var(--g-radius-full)" }}
      >
        <div
          className={`h-full ${color}`}
          style={{ width: `${pct}%`, borderRadius: "var(--g-radius-full)" }}
        />
      </div>
    </div>
  );
}

export default function RTO() {
  const { data: bia = [], isLoading } = useBia();

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-[var(--g-text-primary)]">Objetivos RTO / RPO / MTD</h1>
        <p className="text-sm text-[var(--g-text-secondary)]">
          Objetivos de recuperación definidos en el BIA para funciones críticas DORA.
        </p>
      </header>

      {isLoading && <div className="text-sm text-[var(--g-text-secondary)] animate-pulse">Cargando…</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {bia.map((b) => (
          <div
            key={b.id}
            className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-5"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="flex items-start gap-2 mb-4">
              <div>
                <div className="text-base font-bold text-[var(--g-text-primary)]">
                  {b.function_name}
                </div>
                {b.is_critical && (
                  <span
                    className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-[var(--status-error)] text-[var(--g-text-inverse)] mt-1"
                    style={{ borderRadius: "var(--g-radius-full)" }}
                  >
                    Función crítica
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-3">
              <RtoGauge label="RTO — Recovery Time Objective" hours={b.rto_objective} />
              <RtoGauge label="RPO — Recovery Point Objective" hours={b.rpo_objective} />
              <RtoGauge label="MTD — Maximum Tolerable Downtime" hours={b.mtd_objective} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
