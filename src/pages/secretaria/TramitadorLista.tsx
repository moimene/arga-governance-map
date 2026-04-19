import { useNavigate } from "react-router-dom";
import { Gavel, Plus, FolderOpen } from "lucide-react";
import { useTramitacionesList, type FilingRow } from "@/hooks/useTramitador";

const STATUS_TONE: Record<string, string> = {
  BORRADOR:    "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]",
  PREPARADA:   "bg-[var(--status-info)] text-[var(--g-text-inverse)]",
  PRESENTADA:  "bg-[var(--status-info)] text-[var(--g-text-inverse)]",
  EN_TRAMITE:  "bg-[var(--status-info)] text-[var(--g-text-inverse)]",
  SUBSANACION: "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  INSCRITA:    "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  DENEGADA:    "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
};

function registryRef(f: FilingRow): string {
  return (
    f.borme_ref ??
    f.psm_ref ??
    f.siger_ref ??
    f.conservatoria_ref ??
    f.jucerja_ref ??
    f.diario_oficial_ref ??
    "—"
  );
}

export default function TramitadorLista() {
  const navigate = useNavigate();
  const { data, isLoading } = useTramitacionesList();

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
            <Gavel className="h-3.5 w-3.5" />
            Secretaría · Tramitador registral
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
            Tramitaciones registrales
          </h1>
          <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
            Elevación a público, presentación en BORME / PSM / SIGER / JUCERJA / CONSERVATORIA y
            seguimiento de subsanaciones.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/secretaria/tramitador/nuevo")}
          className="inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <Plus className="h-4 w-4" />
          Nueva tramitación
        </button>
      </div>

      <div
        className="overflow-hidden border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <table className="w-full">
          <thead>
            <tr className="bg-[var(--g-surface-subtle)]">
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Nº presentación
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Vía
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Registro destino
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Fecha
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Estado
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--g-border-subtle)]">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-[var(--g-text-secondary)]">
                  Cargando…
                </td>
              </tr>
            ) : !data || data.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                    <FolderOpen className="h-12 w-12 text-[var(--g-text-secondary)]/40 mb-3" />
                    <p className="text-sm font-medium text-[var(--g-text-secondary)]">
                      Sin tramitaciones registradas.
                    </p>
                    <p className="text-xs text-[var(--g-text-secondary)]/70 mt-1">
                      Registra una nueva tramitación para comenzar.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((f) => (
                <tr
                  key={f.id}
                  onClick={() => navigate(`/secretaria/tramitador/${f.id}`)}
                  className="cursor-pointer transition-colors hover:bg-[var(--g-surface-subtle)]/50"
                >
                  <td className="px-6 py-4 text-sm font-medium text-[var(--g-text-primary)]">
                    {f.filing_number ?? "s/n"}
                  </td>
                  <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">
                    {f.filing_via ?? "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">
                    {registryRef(f)}
                  </td>
                  <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">
                    {f.presentation_date ? new Date(f.presentation_date).toLocaleDateString("es-ES") : "—"}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium ${
                        STATUS_TONE[f.status] ?? "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
                      }`}
                      style={{ borderRadius: "var(--g-radius-sm)" }}
                    >
                      {f.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
