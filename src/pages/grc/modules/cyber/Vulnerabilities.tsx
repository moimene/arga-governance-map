import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";

type VulnerabilityRow = {
  id: string;
  cve_id: string | null;
  title: string;
  cvss_score: number | null;
  severity: string;
  asset_name: string | null;
  status: string;
  remediation_due: string | null;
};

function useVulnerabilities() {
  return useQuery({
    queryKey: ["grc", "vulnerabilities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vulnerabilities")
        .select("id, cve_id, title, cvss_score, severity, asset_name, status, remediation_due")
        .eq("tenant_id", DEMO_TENANT)
        .order("cvss_score", { ascending: false });
      if (error) throw error;
      return (data ?? []) as VulnerabilityRow[];
    },
  });
}

const SEV_CHIP: Record<string, string> = {
  Crítico: "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
  Alto:    "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  Medio:   "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]",
  Bajo:    "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]",
};

const STATUS_CHIP: Record<string, string> = {
  Abierta:        "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
  "En mitigación":"bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  Parcheada:      "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  Aceptada:       "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]",
};

export default function Vulnerabilities() {
  const { data: vulns = [], isLoading } = useVulnerabilities();

  return (
    <div className="p-6 space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-[var(--g-text-primary)]">Vulnerabilidades</h1>
        <p className="text-sm text-[var(--g-text-secondary)]">
          CVEs y vulnerabilidades activas en infraestructura ICT.
        </p>
      </header>

      {isLoading && (
        <div className="text-sm text-[var(--g-text-secondary)] animate-pulse">Cargando…</div>
      )}

      <div
        className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)]"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--g-surface-subtle)]">
                {["CVE", "Descripción", "CVSS", "Severidad", "Activo", "Estado", "Remediación"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--g-border-subtle)]">
              {vulns.map((v) => (
                <tr key={v.id} className="hover:bg-[var(--g-surface-subtle)]/50 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs text-[var(--g-text-secondary)]">
                    {v.cve_id ?? "—"}
                  </td>
                  <td className="px-5 py-3">
                    <span className="font-medium text-[var(--g-text-primary)]">{v.title}</span>
                  </td>
                  <td className="px-5 py-3 text-[var(--g-text-secondary)] font-mono text-xs">
                    {v.cvss_score ?? "—"}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${SEV_CHIP[v.severity] ?? ""}`}
                      style={{ borderRadius: "var(--g-radius-full)" }}
                    >
                      {v.severity}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-[var(--g-text-secondary)]">
                    {v.asset_name ?? "—"}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${STATUS_CHIP[v.status] ?? ""}`}
                      style={{ borderRadius: "var(--g-radius-full)" }}
                    >
                      {v.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-[var(--g-text-secondary)]">
                    {v.remediation_due ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
