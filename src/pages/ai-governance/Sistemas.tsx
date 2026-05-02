import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Cpu, Search, ArrowRight, PlusCircle } from "lucide-react";
import { useAiSystemsList } from "@/hooks/useAiSystems";

const RISK_COLORS: Record<string, string> = {
  Inaceptable: "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
  Alto:        "bg-[var(--status-error)]/80 text-[var(--g-text-inverse)]",
  Limitado:    "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  Mínimo:      "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
};

const STATUS_CHIP: Record<string, string> = {
  ACTIVO:        "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  EN_EVALUACION: "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  RETIRADO:      "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]",
};

const RISK_LEVELS = ["Todos", "Inaceptable", "Alto", "Limitado", "Mínimo"];

export default function Sistemas() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("Todos");

  const { data: systems = [], isLoading } = useAiSystemsList(
    riskFilter !== "Todos" ? riskFilter : undefined
  );

  const filtered = systems.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.vendor?.toLowerCase().includes(q) ?? false) ||
      (s.use_case?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Cpu className="h-5 w-5 text-[var(--g-brand-3308)]" />
            <h1 className="text-xl font-bold text-[var(--g-text-primary)]">Inventario de Sistemas IA</h1>
          </div>
          <p className="text-sm text-[var(--g-text-secondary)]">
            Clasificación según niveles de riesgo EU AI Act
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/ai-governance/sistemas/nuevo")}
          className="inline-flex shrink-0 items-center justify-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <PlusCircle className="h-4 w-4" />
          Nuevo sistema
        </button>
      </div>

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Búsqueda */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--g-text-secondary)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar sistema, vendor..."
            aria-label="Buscar sistemas IA"
            className="w-full pl-9 pr-3 py-2 text-sm bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)]/60 focus:border-[var(--g-brand-3308)] outline-none transition-colors"
            style={{ borderRadius: "var(--g-radius-md)" }}
          />
        </div>

        {/* Filtro riesgo */}
        <div className="flex gap-1.5 flex-wrap">
          {RISK_LEVELS.map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setRiskFilter(lvl)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                riskFilter === lvl
                  ? "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]"
                  : "bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] text-[var(--g-text-secondary)] hover:bg-[var(--g-surface-subtle)]"
              }`}
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div
        className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] overflow-hidden"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        {isLoading ? (
          <div className="p-8 space-y-3">
            {[1,2,3].map((i) => <div key={i} className="skeleton h-12" style={{ borderRadius: "var(--g-radius-md)" }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Cpu className="h-10 w-10 text-[var(--g-text-secondary)] mb-3" />
            <p className="text-sm font-medium text-[var(--g-text-primary)]">No se encontraron sistemas</p>
            <p className="text-xs text-[var(--g-text-secondary)] mt-1">Ajusta los filtros de búsqueda</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-[var(--g-surface-subtle)]">
                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">Sistema</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">Riesgo EU AI Act</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">Vendor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">Despliegue</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">Estado</th>
                <th className="px-6 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--g-border-subtle)]">
              {filtered.map((sys) => {
                const riskCls = RISK_COLORS[sys.risk_level ?? ""] ?? "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]";
                const statusCls = STATUS_CHIP[sys.status] ?? "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]";
                return (
                  <tr
                    key={sys.id}
                    className="hover:bg-[var(--g-surface-subtle)]/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/ai-governance/sistemas/${sys.id}`)}
                  >
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-[var(--g-text-primary)]">{sys.name}</p>
                      <p className="text-xs text-[var(--g-text-secondary)] mt-0.5 line-clamp-1">{sys.use_case}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">{sys.system_type ?? "—"}</td>
                    <td className="px-6 py-4">
                      {sys.risk_level ? (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${riskCls}`}
                          style={{ borderRadius: "var(--g-radius-sm)" }}
                        >
                          {sys.risk_level}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">{sys.vendor ?? "—"}</td>
                    <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">
                      {sys.deployment_date
                        ? new Date(sys.deployment_date).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })
                        : "—"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${statusCls}`}
                        style={{ borderRadius: "var(--g-radius-full)" }}
                      >
                        {sys.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <ArrowRight className="h-4 w-4 text-[var(--g-text-secondary)]" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <div className="mt-3 text-xs text-[var(--g-text-secondary)]">
        {filtered.length} sistema{filtered.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
