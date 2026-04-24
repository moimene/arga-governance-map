import { Library, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { useLibrosList } from "@/hooks/useLibros";
import { statusLabel } from "@/lib/secretaria/status-labels";

const LEG_STATUS_TONE: Record<string, string> = {
  PENDIENTE:  "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  PRESENTADO: "bg-[var(--status-info)] text-[var(--g-text-inverse)]",
  LEGALIZADO: "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  RECHAZADO:  "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
};

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export default function LibrosObligatorios() {
  const { data, isLoading } = useLibrosList();

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
          <Library className="h-3.5 w-3.5" />
          Secretaría · Libros obligatorios
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
          Libros obligatorios
        </h1>
        <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
          Libros de actas, socios, acciones y contratos del socio único — con alertas de legalización
          electrónica.
        </p>
      </div>

      <div
        className="overflow-hidden border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <table className="w-full">
          <thead>
            <tr className="bg-[var(--g-surface-subtle)]">
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Libro</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Entidad</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Periodo</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Plazo legalización</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Legalización</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--g-border-subtle)]">
            {isLoading ? (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-sm text-[var(--g-text-secondary)]">Cargando…</td></tr>
            ) : !data || data.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-sm text-[var(--g-text-secondary)]">Sin libros.</td></tr>
            ) : (
              data.map((b) => {
                const days = daysUntil(b.legalization_deadline);
                const isAlert = days !== null && days <= 30 && b.legalization_status !== "LEGALIZADO";
                const isOk = b.legalization_status === "LEGALIZADO";
                return (
                  <tr key={b.id} className={isAlert ? "bg-[var(--g-sec-100)]/40" : ""}>
                    <td className="px-6 py-4 text-sm font-medium text-[var(--g-text-primary)]">
                      {b.book_kind}
                      <span className="ml-2 text-[11px] text-[var(--g-text-secondary)]">
                        vol. {b.volume_number}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">
                      {b.entity_name ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">{b.period}</td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center gap-2">
                        {isOk ? (
                          <CheckCircle2 className="h-4 w-4 text-[var(--status-success)]" />
                        ) : isAlert ? (
                          <AlertTriangle className="h-4 w-4 text-[var(--status-warning)]" />
                        ) : (
                          <Clock className="h-4 w-4 text-[var(--g-text-secondary)]" />
                        )}
                        <span className="text-[var(--g-text-primary)]">
                          {b.legalization_deadline
                            ? new Date(b.legalization_deadline).toLocaleDateString("es-ES")
                            : "—"}
                        </span>
                        {days !== null && !isOk ? (
                          <span className="text-[11px] text-[var(--g-text-secondary)]">
                            ({days >= 0 ? `en ${days}d` : `vencido hace ${-days}d`})
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium ${
                          LEG_STATUS_TONE[b.legalization_status] ?? "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
                        }`}
                        style={{ borderRadius: "var(--g-radius-sm)" }}
                      >
                        {statusLabel(b.legalization_status)}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
