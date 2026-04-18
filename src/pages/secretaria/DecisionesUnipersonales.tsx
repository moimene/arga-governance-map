import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2 } from "lucide-react";
import { useDecisionesUnipersList } from "@/hooks/useDecisionesUnipers";

const STATUS_TONE: Record<string, string> = {
  BORRADOR: "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]",
  FIRMADA:  "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  ANULADA:  "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
};

const TYPE_TONE: Record<string, string> = {
  SOCIO_UNICO:         "bg-[var(--status-info)] text-[var(--g-text-inverse)]",
  ADMINISTRADOR_UNICO: "bg-[var(--g-sec-300)] text-[var(--g-text-inverse)]",
};

const SELECT_CLASS =
  "rounded border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-1.5 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]";

export default function DecisionesUnipersonales() {
  const navigate = useNavigate();
  const { data, isLoading } = useDecisionesUnipersList();

  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  const filtered = (data ?? []).filter((item) => {
    if (filterStatus !== "ALL" && item.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
          <Building2 className="h-3.5 w-3.5" />
          Secretaría · Decisiones unipersonales
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
          Decisiones de socio único / administrador único
        </h1>
        <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
          Adopción formal de decisiones cuando no hay órgano colegiado.
        </p>
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
          <option value="FIRMADA">Firmada</option>
          <option value="ANULADA">Anulada</option>
        </select>
        {filterStatus !== "ALL" && (
          <button
            type="button"
            onClick={() => setFilterStatus("ALL")}
            className="text-sm text-[var(--g-text-secondary)] hover:text-[var(--g-text-primary)] transition-colors"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      <div
        className="overflow-hidden border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <table className="w-full">
          <thead>
            <tr className="bg-[var(--g-surface-subtle)]">
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Título</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Tipo</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Entidad</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Decide</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Fecha</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Registral</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--g-border-subtle)]">
            {isLoading ? (
              <tr><td colSpan={7} className="px-6 py-8 text-center text-sm text-[var(--g-text-secondary)]">Cargando…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-6 py-8 text-center text-sm text-[var(--g-text-secondary)]">Sin decisiones para los filtros seleccionados.</td></tr>
            ) : (
              filtered.map((d) => (
                <tr
                  key={d.id}
                  onClick={() => navigate(`/secretaria/decisiones-unipersonales/${d.id}`)}
                  className="cursor-pointer transition-colors hover:bg-[var(--g-surface-subtle)]/50"
                >
                  <td className="px-6 py-4 text-sm font-medium text-[var(--g-text-primary)]">{d.title}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium ${
                        TYPE_TONE[d.decision_type] ?? "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
                      }`}
                      style={{ borderRadius: "var(--g-radius-sm)" }}
                    >
                      {d.decision_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">{d.entity_name ?? "—"}</td>
                  <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">{d.decider_name ?? "—"}</td>
                  <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">
                    {d.decision_date ? new Date(d.decision_date).toLocaleDateString("es-ES") : "—"}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {d.requires_registry ? (
                      <span className="text-[var(--status-warning)]">Sí</span>
                    ) : (
                      <span className="text-[var(--g-text-secondary)]">No</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium ${
                        STATUS_TONE[d.status] ?? "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
                      }`}
                      style={{ borderRadius: "var(--g-radius-sm)" }}
                    >
                      {d.status}
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
