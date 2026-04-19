import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Plus, FolderOpen } from "lucide-react";
import { useConvocatoriasList } from "@/hooks/useConvocatorias";

const ESTADO_TONE: Record<string, string> = {
  BORRADOR:  "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]",
  CONVOCADA: "bg-[var(--status-info)] text-[var(--g-text-inverse)]",
  CELEBRADA: "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  CANCELADA: "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
};

const SELECT_CLASS =
  "rounded border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-1.5 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]";

export default function ConvocatoriasList() {
  const navigate = useNavigate();
  const { data, isLoading } = useConvocatoriasList();

  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterJurisdiction, setFilterJurisdiction] = useState<string>("ALL");

  const filtered = (data ?? []).filter((item) => {
    if (filterStatus !== "ALL" && item.estado !== filterStatus) return false;
    if (filterJurisdiction !== "ALL" && item.jurisdiction !== filterJurisdiction) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
            <Bell className="h-3.5 w-3.5" />
            Secretaría · Convocatorias
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
            Convocatorias
          </h1>
          <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
            Preparación, emisión y trazabilidad de convocatorias de juntas y consejos.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/secretaria/convocatorias/nueva")}
          className="inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
          aria-label="Crear nueva convocatoria"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nueva convocatoria
        </button>
      </div>

      {/* Filtros */}
      <div className="mb-4 flex items-center gap-3">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className={SELECT_CLASS}
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <option value="ALL">Todos los estados</option>
          <option value="BORRADOR">Borrador</option>
          <option value="CONVOCADA">Convocada</option>
          <option value="CELEBRADA">Celebrada</option>
          <option value="CANCELADA">Cancelada</option>
        </select>
        <select
          value={filterJurisdiction}
          onChange={(e) => setFilterJurisdiction(e.target.value)}
          className={SELECT_CLASS}
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <option value="ALL">Todas las jurisdicciones</option>
          <option value="ES">ES — España</option>
          <option value="BR">BR — Brasil</option>
          <option value="MX">MX — México</option>
          <option value="PT">PT — Portugal</option>
        </select>
        {(filterStatus !== "ALL" || filterJurisdiction !== "ALL") && (
          <button
            type="button"
            onClick={() => { setFilterStatus("ALL"); setFilterJurisdiction("ALL"); }}
            className="text-sm text-[var(--g-text-secondary)] hover:text-[var(--g-text-primary)] transition-colors"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      <div
        className="overflow-x-auto border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="bg-[var(--g-surface-subtle)]">
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Órgano
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Entidad
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Fecha 1ª conv
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Modalidad
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Flags
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Estado
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--g-border-subtle)]">
            {isLoading ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-8 text-center text-sm text-[var(--g-text-secondary)]"
                >
                  Cargando…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                    <FolderOpen className="h-12 w-12 text-[var(--g-text-secondary)]/40 mb-3" />
                    <p className="text-sm font-medium text-[var(--g-text-secondary)]">
                      Sin convocatorias para los filtros seleccionados.
                    </p>
                    <p className="text-xs text-[var(--g-text-secondary)]/70 mt-1">
                      Crea una nueva convocatoria para comenzar.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => navigate(`/secretaria/convocatorias/${c.id}`)}
                  className="cursor-pointer transition-colors hover:bg-[var(--g-surface-subtle)]/50"
                >
                  <td className="px-6 py-4 text-sm font-medium text-[var(--g-text-primary)]">
                    {c.body_name ?? "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">
                    {c.entity_name ?? "—"}
                    {c.jurisdiction ? (
                      <span className="ml-2 text-[11px]">· {c.jurisdiction}</span>
                    ) : null}
                  </td>
                  <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">
                    {c.fecha_1 ? new Date(c.fecha_1).toLocaleString("es-ES") : "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">
                    {c.modalidad ?? "—"}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {c.junta_universal ? (
                        <span
                          className="bg-[var(--g-sec-100)] px-2 py-0.5 text-[11px] font-medium text-[var(--g-brand-3308)]"
                          style={{ borderRadius: "var(--g-radius-sm)" }}
                        >
                          Universal
                        </span>
                      ) : null}
                      {c.is_second_call ? (
                        <span
                          className="bg-[var(--status-warning)] px-2 py-0.5 text-[11px] font-medium text-[var(--g-text-inverse)]"
                          style={{ borderRadius: "var(--g-radius-sm)" }}
                        >
                          2ª conv
                        </span>
                      ) : null}
                      {c.urgente ? (
                        <span
                          className="bg-[var(--status-error)] px-2 py-0.5 text-[11px] font-medium text-[var(--g-text-inverse)]"
                          style={{ borderRadius: "var(--g-radius-sm)" }}
                        >
                          Urgente
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium ${
                        ESTADO_TONE[c.estado] ?? "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
                      }`}
                      style={{ borderRadius: "var(--g-radius-sm)" }}
                    >
                      {c.estado}
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
