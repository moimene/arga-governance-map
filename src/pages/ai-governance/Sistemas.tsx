import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Cpu, PlusCircle, Search, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { useAiSystemsList } from "@/hooks/useAiSystems";
import { cn } from "@/lib/utils";

const RISK_COLORS: Record<string, string> = {
  Inaceptable: "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
  Alto:        "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
  Limitado:    "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  Mínimo:      "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
};

const STATUS_CHIP: Record<string, string> = {
  ACTIVO:        "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  EN_EVALUACION: "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  RETIRADO:      "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]",
};

const SYSTEM_STATUS_LABEL: Record<string, string> = {
  ACTIVO: "Activo",
  EN_EVALUACION: "En evaluación",
  RETIRADO: "Retirado",
};

const SYSTEM_STATUS_OPTIONS = [
  { value: "Todos", label: "Todos" },
  { value: "ACTIVO", label: "Activos" },
  { value: "EN_EVALUACION", label: "En evaluación" },
  { value: "RETIRADO", label: "Retirados" },
];

const RISK_LEVELS = [
  { value: "Todos", label: "Todos" },
  { value: "Inaceptable", label: "Inaceptable" },
  { value: "Alto", label: "Alto" },
  { value: "Limitado", label: "Limitado" },
  { value: "Mínimo", label: "Mínimo" },
];

const FILTER_BUTTON =
  "px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--g-surface-page)]";

function formatDate(value: string | null) {
  if (!value) return "Sin fecha";
  return new Date(value).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function systemStatusLabel(status: string | null | undefined) {
  if (!status) return "Sin estado";
  return SYSTEM_STATUS_LABEL[status] ?? status;
}

function systemRiskLabel(risk: string | null | undefined) {
  return risk ? `Riesgo ${risk}` : "Sin clasificación";
}

function FilterGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="min-w-0">
      <p className="mb-2 text-xs font-medium text-[var(--g-text-secondary)]">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={cn(
              FILTER_BUTTON,
              value === option.value
                ? "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]"
                : "border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] text-[var(--g-text-secondary)] hover:bg-[var(--g-surface-subtle)]",
            )}
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Sistemas() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("Todos");
  const [statusFilter, setStatusFilter] = useState("Todos");

  const { data: systems = [], isLoading } = useAiSystemsList(
    riskFilter !== "Todos" ? riskFilter : undefined
  );

  const filtered = systems.filter((s) => {
    const q = search.toLowerCase();
    const matchesSearch = !search || (
      s.name.toLowerCase().includes(q) ||
      (s.vendor?.toLowerCase().includes(q) ?? false) ||
      (s.use_case?.toLowerCase().includes(q) ?? false) ||
      (s.system_type?.toLowerCase().includes(q) ?? false)
    );
    const matchesStatus = statusFilter === "Todos" || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const activeCount = systems.filter((s) => s.status === "ACTIVO").length;
  const attentionCount = systems.filter((s) => s.risk_level === "Alto" || s.risk_level === "Inaceptable").length;

  return (
    <div className="mx-auto max-w-[1200px] space-y-5 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Cpu className="h-5 w-5 shrink-0 text-[var(--g-brand-3308)]" />
            <h1 className="min-w-0 text-xl font-bold text-[var(--g-text-primary)]">Inventario de sistemas IA</h1>
          </div>
          <p className="max-w-[72ch] text-sm text-[var(--g-text-secondary)]">
            Mesa operativa de AIMS: sistemas, proveedor, uso, riesgo AI Act y estado de seguimiento.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/ai-governance/sistemas/nuevo")}
          className="inline-flex w-full shrink-0 items-center justify-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--g-surface-page)] sm:w-auto"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <PlusCircle className="h-4 w-4" />
          Nuevo sistema
        </button>
      </div>

      <section
        className="grid gap-3 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] p-4 md:grid-cols-[1.3fr_0.7fr_0.7fr]"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        aria-label="Estado del inventario AIMS"
      >
        <div className="flex min-w-0 gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center bg-[var(--g-sec-100)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <ShieldCheck className="h-5 w-5 text-[var(--g-brand-3308)]" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--g-text-primary)]">Demo AIMS conectada</p>
            <p className="mt-1 text-xs leading-5 text-[var(--g-text-secondary)]">
              Inventario propietario de AI Governance. Las decisiones de riesgo operativo se derivan hacia GRC sin escritura cruzada.
            </p>
          </div>
        </div>
        <div className="border-t border-[var(--g-border-subtle)] pt-3 md:border-l md:border-t-0 md:pl-4 md:pt-0">
          <p className="text-xs text-[var(--g-text-secondary)]">Sistemas activos</p>
          <p className="mt-1 text-lg font-semibold text-[var(--g-text-primary)]">{activeCount}/{systems.length}</p>
        </div>
        <div className="border-t border-[var(--g-border-subtle)] pt-3 md:border-l md:border-t-0 md:pl-4 md:pt-0">
          <p className="text-xs text-[var(--g-text-secondary)]">Atención prioritaria</p>
          <p className="mt-1 text-lg font-semibold text-[var(--status-error)]">{attentionCount}</p>
        </div>
      </section>

      {/* Filtros */}
      <section
        className="border border-[var(--g-border-default)] bg-[var(--g-surface-card)] p-4"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        aria-label="Filtros del inventario de sistemas"
      >
        <div className="mb-4 flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-[var(--g-brand-3308)]" />
          <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">Filtros</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(220px,1fr)_auto_auto] lg:items-end">
        {/* Búsqueda */}
          <div className="min-w-0">
            <label htmlFor="aims-system-search" className="mb-2 block text-xs font-medium text-[var(--g-text-secondary)]">
              Buscar
            </label>
            <div className="relative min-w-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--g-text-secondary)]" />
              <input
                id="aims-system-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Sistema, proveedor, uso o tipo"
                className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] py-2 pl-9 pr-3 text-sm text-[var(--g-text-primary)] outline-none transition-colors placeholder:text-[var(--g-text-secondary)]/60 focus:border-[var(--g-brand-3308)] focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              />
            </div>
          </div>

          <FilterGroup label="Riesgo" options={RISK_LEVELS} value={riskFilter} onChange={setRiskFilter} />
          <FilterGroup label="Estado" options={SYSTEM_STATUS_OPTIONS} value={statusFilter} onChange={setStatusFilter} />
        </div>
      </section>

      {/* Tabla */}
      <div
        className="overflow-hidden border border-[var(--g-border-default)] bg-[var(--g-surface-card)]"
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
            <p className="mt-1 text-xs text-[var(--g-text-secondary)]">Ajusta búsqueda, riesgo o estado.</p>
          </div>
        ) : (
          <>
            <div className="hidden lg:block">
              <table className="w-full table-fixed">
                <thead>
                  <tr className="bg-[var(--g-surface-subtle)]">
                    <th className="w-[29%] px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Sistema</th>
                    <th className="w-[14%] px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Tipo</th>
                    <th className="w-[14%] px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Riesgo</th>
                    <th className="w-[14%] px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Proveedor</th>
                    <th className="w-[14%] px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Despliegue</th>
                    <th className="w-[12%] px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Estado</th>
                    <th className="w-[3%] px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--g-border-subtle)]">
                  {filtered.map((sys) => {
                    const riskCls = RISK_COLORS[sys.risk_level ?? ""] ?? "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]";
                    const statusCls = STATUS_CHIP[sys.status] ?? "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]";
                    return (
                      <tr
                        key={sys.id}
                        className="cursor-pointer transition-colors hover:bg-[var(--g-surface-subtle)]/50"
                        onClick={() => navigate(`/ai-governance/sistemas/${sys.id}`)}
                      >
                        <td className="min-w-0 px-6 py-4">
                          <p className="truncate text-sm font-medium text-[var(--g-text-primary)]">{sys.name}</p>
                          <p className="mt-0.5 truncate text-xs text-[var(--g-text-secondary)]">{sys.use_case ?? "Sin caso de uso documentado"}</p>
                        </td>
                        <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">
                          <span className="block truncate">{sys.system_type ?? "Sin tipo"}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${riskCls}`}
                            style={{ borderRadius: "var(--g-radius-sm)" }}
                          >
                            {systemRiskLabel(sys.risk_level)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">
                          <span className="block truncate">{sys.vendor ?? "Sin proveedor"}</span>
                        </td>
                        <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">
                          {formatDate(sys.deployment_date)}
                        </td>
                        <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${statusCls}`}
                          style={{ borderRadius: "var(--g-radius-full)" }}
                        >
                          {systemStatusLabel(sys.status)}
                        </span>
                        </td>
                        <td className="px-4 py-4">
                          <ArrowRight className="h-4 w-4 text-[var(--g-text-secondary)]" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-[var(--g-border-subtle)] lg:hidden" role="list" aria-label="Lista móvil de sistemas IA">
              {filtered.map((sys) => {
                const riskCls = RISK_COLORS[sys.risk_level ?? ""] ?? "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]";
                const statusCls = STATUS_CHIP[sys.status] ?? "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]";
                return (
                  <article key={sys.id} role="listitem" className="p-4">
                    <button
                      type="button"
                      onClick={() => navigate(`/ai-governance/sistemas/${sys.id}`)}
                      className="flex w-full min-w-0 items-start justify-between gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--g-surface-card)]"
                      style={{ borderRadius: "var(--g-radius-md)" }}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-[var(--g-text-primary)]">{sys.name}</span>
                        <span className="mt-1 block line-clamp-2 text-xs leading-5 text-[var(--g-text-secondary)]">
                          {sys.use_case ?? "Sin caso de uso documentado"}
                        </span>
                      </span>
                      <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-[var(--g-text-secondary)]" />
                    </button>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${riskCls}`}
                        style={{ borderRadius: "var(--g-radius-sm)" }}
                      >
                        {systemRiskLabel(sys.risk_level)}
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${statusCls}`}
                        style={{ borderRadius: "var(--g-radius-full)" }}
                      >
                        {systemStatusLabel(sys.status)}
                      </span>
                    </div>
                    <dl className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                      <div className="min-w-0">
                        <dt className="text-[var(--g-text-secondary)]">Proveedor</dt>
                        <dd className="truncate font-medium text-[var(--g-text-primary)]">{sys.vendor ?? "Sin proveedor"}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-[var(--g-text-secondary)]">Tipo</dt>
                        <dd className="truncate font-medium text-[var(--g-text-primary)]">{sys.system_type ?? "Sin tipo"}</dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-[var(--g-text-secondary)]">Despliegue</dt>
                        <dd className="font-medium text-[var(--g-text-primary)]">{formatDate(sys.deployment_date)}</dd>
                      </div>
                    </dl>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>
      <div className="text-xs text-[var(--g-text-secondary)]">
        {filtered.length} sistema{filtered.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
