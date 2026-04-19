import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileWarning } from "lucide-react";

const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";

type ExceptionRow = {
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

function useExceptions() {
  return useQuery({
    queryKey: ["grc", "excepciones"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exceptions")
        .select("id, code, status, justification, compensatory_controls, requested_at, expires_at, obligation_id, obligations:obligation_id(code, title)")
        .eq("tenant_id", DEMO_TENANT)
        .order("requested_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ExceptionRow[];
    },
  });
}

const STATUS_CHIP: Record<string, string> = {
  Pendiente: "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  Aprobada:  "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  Rechazada: "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
  Expirada:  "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]",
};

export default function Excepciones() {
  const { data: exceptions = [], isLoading } = useExceptions();

  return (
    <div className="p-6 space-y-5">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileWarning className="h-5 w-5 text-[var(--g-brand-3308)]" />
          <div>
            <h1 className="text-2xl font-bold text-[var(--g-text-primary)]">Excepciones</h1>
            <p className="text-sm text-[var(--g-text-secondary)]">
              Desviaciones justificadas con controles compensatorios aprobados.
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled
          aria-label="Solicitar excepción (próximamente)"
          className="inline-flex items-center gap-2 px-4 h-10 text-sm font-medium bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] opacity-50 cursor-not-allowed"
          style={{ borderRadius: "var(--g-radius-md)" }}
          aria-disabled="true"
        >
          + Solicitar excepción
        </button>
      </header>

      {isLoading && (
        <div className="text-sm text-[var(--g-text-secondary)] animate-pulse">Cargando…</div>
      )}

      {!isLoading && exceptions.length === 0 && (
        <div className="py-16 text-center text-sm text-[var(--g-text-secondary)]">
          No hay excepciones registradas.
        </div>
      )}

      <div
        className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)]"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[750px]">
            <thead>
              <tr className="bg-[var(--g-surface-subtle)]">
                <th className="px-5 py-3 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">
                  Código
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">
                  Obligación
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">
                  Solicitada
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">
                  Expira
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--g-border-subtle)]">
              {exceptions.map((e) => (
                <tr
                  key={e.id}
                  className="hover:bg-[var(--g-surface-subtle)]/50 transition-colors"
                >
                  <td className="px-5 py-3 font-mono text-xs text-[var(--g-text-secondary)]">
                    {e.code}
                  </td>
                  <td className="px-5 py-3 text-sm">
                    {e.obligations ? (
                      <div>
                        <div className="font-medium text-[var(--g-text-primary)]">
                          {e.obligations.code}
                        </div>
                        <div className="text-xs text-[var(--g-text-secondary)] truncate max-w-xs">
                          {e.obligations.title}
                        </div>
                      </div>
                    ) : (
                      <span className="text-[var(--g-text-secondary)]">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${STATUS_CHIP[e.status] ?? ""}`}
                      style={{ borderRadius: "var(--g-radius-full)" }}
                    >
                      {e.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-[var(--g-text-secondary)]">
                    {e.requested_at ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-sm text-[var(--g-text-secondary)]">
                    {e.expires_at ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Detail panel for first exception */}
        {exceptions.length > 0 && (
          <div className="px-5 py-4 border-t border-[var(--g-border-subtle)] bg-[var(--g-surface-page)]">
            <div className="text-xs font-semibold uppercase text-[var(--g-text-secondary)] mb-2">
              Justificación — {exceptions[0].code}
            </div>
            <p className="text-sm text-[var(--g-text-secondary)] leading-relaxed mb-2">
              {exceptions[0].justification ?? "—"}
            </p>
            {exceptions[0].compensatory_controls && (
              <>
                <div className="text-xs font-semibold uppercase text-[var(--g-text-secondary)] mb-1">
                  Controles compensatorios
                </div>
                <p className="text-sm text-[var(--g-text-secondary)] leading-relaxed">
                  {exceptions[0].compensatory_controls}
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
