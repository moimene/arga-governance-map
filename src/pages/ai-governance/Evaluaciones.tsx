import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, ClipboardCheck, FileWarning, Route, Search, SlidersHorizontal } from "lucide-react";
import { useAllAssessments } from "@/hooks/useAiAssessments";
import { isAimsTechnicalFileGapCandidate } from "@/lib/aims/readiness";
import { cn } from "@/lib/utils";

const ASSESSMENT_STATUS_CHIP: Record<string, string> = {
  APROBADO:    "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  EN_REVISION: "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  BORRADOR:    "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]",
};

const FRAMEWORK_BADGE: Record<string, string> = {
  EU_AI_ACT:  "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]",
  ISO_42001:  "bg-[var(--g-sec-100)] text-[var(--g-brand-3308)]",
};

const ASSESSMENT_STATUS_LABEL: Record<string, string> = {
  APROBADO: "Aprobada",
  EN_REVISION: "En revisión",
  BORRADOR: "Borrador",
};

const FRAMEWORK_LABEL: Record<string, string> = {
  EU_AI_ACT: "EU AI Act",
  ISO_42001: "ISO 42001",
};

const STATUS_OPTIONS = [
  { value: "Todos", label: "Todas" },
  { value: "APROBADO", label: "Aprobadas" },
  { value: "EN_REVISION", label: "En revisión" },
  { value: "BORRADOR", label: "Borrador" },
];

const FRAMEWORK_OPTIONS = [
  { value: "Todos", label: "Todos" },
  { value: "EU_AI_ACT", label: "EU AI Act" },
  { value: "ISO_42001", label: "ISO 42001" },
];

const ACTION_OPTIONS = [
  { value: "Todos", label: "Todas" },
  { value: "gap", label: "Requieren GRC" },
  { value: "sin-gap", label: "Sin acción GRC" },
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

function frameworkLabel(framework: string | null | undefined) {
  if (!framework) return "Sin marco";
  return FRAMEWORK_LABEL[framework] ?? framework;
}

function assessmentStatusLabel(status: string | null | undefined) {
  if (!status) return "Sin estado";
  return ASSESSMENT_STATUS_LABEL[status] ?? status;
}

function scoreTone(score: number | null) {
  if (score === null) return "bg-[var(--g-surface-muted)]";
  if (score >= 80) return "bg-[var(--status-success)]";
  if (score >= 60) return "bg-[var(--status-warning)]";
  return "bg-[var(--status-error)]";
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

export default function Evaluaciones() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [frameworkFilter, setFrameworkFilter] = useState("Todos");
  const [actionFilter, setActionFilter] = useState("Todos");
  const { data: assessments = [], isLoading } = useAllAssessments();

  const approvedCount = assessments.filter((ass) => ass.status === "APROBADO").length;
  const gapCount = assessments.filter(isAimsTechnicalFileGapCandidate).length;
  const scoredAssessments = assessments.filter((ass) => typeof ass.score === "number");
  const averageScore = scoredAssessments.length > 0
    ? Math.round(scoredAssessments.reduce((sum, ass) => sum + (ass.score ?? 0), 0) / scoredAssessments.length)
    : null;
  const filtered = assessments.filter((assessment) => {
    const q = search.toLowerCase();
    const hasGrcHandoff = isAimsTechnicalFileGapCandidate(assessment);
    const matchesSearch = !search || (
      (assessment.ai_systems?.name?.toLowerCase().includes(q) ?? false) ||
      (assessment.notes?.toLowerCase().includes(q) ?? false) ||
      (assessment.findings ?? []).some((finding) => finding.code?.toLowerCase().includes(q))
    );
    const matchesStatus = statusFilter === "Todos" || assessment.status === statusFilter;
    const matchesFramework = frameworkFilter === "Todos" || assessment.framework === frameworkFilter;
    const matchesAction =
      actionFilter === "Todos" ||
      (actionFilter === "gap" && hasGrcHandoff) ||
      (actionFilter === "sin-gap" && !hasGrcHandoff);
    return matchesSearch && matchesStatus && matchesFramework && matchesAction;
  });

  return (
    <div className="mx-auto max-w-[1200px] space-y-5 p-4 sm:p-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <ClipboardCheck className="h-5 w-5 shrink-0 text-[var(--g-brand-3308)]" />
          <h1 className="text-xl font-bold text-[var(--g-text-primary)]">Evaluaciones de riesgo IA</h1>
        </div>
        <p className="max-w-[72ch] text-sm text-[var(--g-text-secondary)]">
          Cobertura AI Act e ISO 42001 por sistema, con señal explícita cuando el expediente técnico debe derivarse a GRC.
        </p>
      </div>

      {!isLoading && assessments.length > 0 && (
        <section
          className="grid gap-3 md:grid-cols-[1.2fr_0.6fr_0.6fr_0.6fr]"
          aria-label="Estado de evaluaciones AIMS"
        >
          <div
            className="flex min-w-0 gap-3 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] p-4"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center bg-[var(--g-sec-100)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <FileWarning className="h-5 w-5 text-[var(--g-brand-3308)]" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--g-text-primary)]">Readiness de demo claro</p>
              <p className="mt-1 text-xs leading-5 text-[var(--g-text-secondary)]">
                AIMS muestra cobertura y gaps. El intake GRC es una propuesta de contexto, no una creación automática de riesgo.
              </p>
            </div>
          </div>
          {[
            { label: "Evaluaciones", value: assessments.length, tone: "info" },
            { label: "Aprobadas", value: approvedCount, tone: "success" },
            { label: "Requieren GRC", value: gapCount, tone: gapCount > 0 ? "error" : "success" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-5 py-4"
              style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
            >
              <div className={`text-2xl font-bold ${
                stat.tone === "error"
                  ? "text-[var(--status-error)]"
                  : stat.tone === "success"
                  ? "text-[var(--status-success)]"
                  : "text-[var(--g-brand-3308)]"
              }`}>
                {stat.value}
              </div>
              <div className="mt-0.5 text-xs text-[var(--g-text-secondary)]">{stat.label}</div>
            </div>
          ))}
          <div className="sr-only">
            Puntuación media {averageScore === null ? "sin datos" : `${averageScore} sobre 100`}
          </div>
        </section>
      )}

      <section
        className="border border-[var(--g-border-default)] bg-[var(--g-surface-card)] p-4"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        aria-label="Filtros de evaluaciones IA"
      >
        <div className="mb-4 flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-[var(--g-brand-3308)]" />
          <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">Filtros</h2>
        </div>
        <div className="grid gap-4 xl:grid-cols-[minmax(220px,1fr)_auto_auto_auto] xl:items-end">
          <div className="min-w-0">
            <label htmlFor="aims-assessment-search" className="mb-2 block text-xs font-medium text-[var(--g-text-secondary)]">
              Buscar
            </label>
            <div className="relative min-w-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--g-text-secondary)]" />
              <input
                id="aims-assessment-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Sistema, nota o finding"
                className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] py-2 pl-9 pr-3 text-sm text-[var(--g-text-primary)] outline-none transition-colors placeholder:text-[var(--g-text-secondary)]/60 focus:border-[var(--g-brand-3308)] focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              />
            </div>
          </div>
          <FilterGroup label="Marco" options={FRAMEWORK_OPTIONS} value={frameworkFilter} onChange={setFrameworkFilter} />
          <FilterGroup label="Estado" options={STATUS_OPTIONS} value={statusFilter} onChange={setStatusFilter} />
          <FilterGroup label="Acción" options={ACTION_OPTIONS} value={actionFilter} onChange={setActionFilter} />
        </div>
      </section>

      <div
        className="overflow-hidden border border-[var(--g-border-default)] bg-[var(--g-surface-card)]"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        {isLoading ? (
          <div className="p-8 space-y-3">
            {[1,2,3].map((i) => <div key={i} className="skeleton h-16" style={{ borderRadius: "var(--g-radius-md)" }} />)}
          </div>
        ) : assessments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ClipboardCheck className="h-10 w-10 text-[var(--g-text-secondary)] mb-3" />
            <p className="text-sm font-medium text-[var(--g-text-primary)]">Sin evaluaciones registradas</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ClipboardCheck className="h-10 w-10 text-[var(--g-text-secondary)] mb-3" />
            <p className="text-sm font-medium text-[var(--g-text-primary)]">No hay evaluaciones con esos filtros</p>
            <p className="mt-1 text-xs text-[var(--g-text-secondary)]">Ajusta búsqueda, marco, estado o acción.</p>
          </div>
        ) : (
          <>
            <div className="hidden lg:block">
              <table className="w-full table-fixed">
                <thead>
                  <tr className="bg-[var(--g-surface-subtle)]">
                    <th className="w-[29%] px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Sistema</th>
                    <th className="w-[13%] px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Marco</th>
                    <th className="w-[16%] px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Puntuación</th>
                    <th className="w-[12%] px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Fecha</th>
                    <th className="w-[14%] px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Estado</th>
                    <th className="w-[13%] px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Acción</th>
                    <th className="w-[3%] px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--g-border-subtle)]">
                  {filtered.map((ass) => {
                    const statusCls = ASSESSMENT_STATUS_CHIP[ass.status] ?? "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]";
                    const frameCls = FRAMEWORK_BADGE[ass.framework ?? ""] ?? "bg-[var(--g-surface-subtle)] text-[var(--g-text-secondary)]";
                    const hasGrcHandoff = isAimsTechnicalFileGapCandidate(ass);
                    return (
                      <tr
                        key={ass.id}
                        className="cursor-pointer transition-colors hover:bg-[var(--g-surface-subtle)]/50"
                        onClick={() => ass.system_id && navigate(`/ai-governance/sistemas/${ass.system_id}`)}
                      >
                        <td className="min-w-0 px-6 py-4">
                          <p className="truncate text-sm font-medium text-[var(--g-text-primary)]">
                            {ass.ai_systems?.name ?? "Sin sistema asociado"}
                          </p>
                          {ass.ai_systems?.risk_level && (
                            <p className="mt-0.5 truncate text-xs text-[var(--g-text-secondary)]">
                              Riesgo {ass.ai_systems.risk_level}
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${frameCls}`}
                            style={{ borderRadius: "var(--g-radius-sm)" }}
                          >
                            {frameworkLabel(ass.framework)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {ass.score !== null ? (
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-24 bg-[var(--g-surface-muted)]" style={{ borderRadius: "var(--g-radius-full)" }}>
                                <div
                                  className={`h-1.5 ${scoreTone(ass.score)}`}
                                  style={{ borderRadius: "var(--g-radius-full)", width: `${ass.score}%` }}
                                />
                              </div>
                              <span className="text-sm font-medium text-[var(--g-text-primary)]">{ass.score}/100</span>
                            </div>
                          ) : (
                            <span className="text-sm text-[var(--g-text-secondary)]">Sin puntuación</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">
                          {formatDate(ass.assessment_date)}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${statusCls}`}
                            style={{ borderRadius: "var(--g-radius-full)" }}
                          >
                            {assessmentStatusLabel(ass.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {hasGrcHandoff ? (
                            <Link
                              to={`/grc/risk-360?source=aims&handoff=AIMS_TECHNICAL_FILE_GAP&assessment=${ass.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-2 py-1 text-xs font-medium text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)]"
                              style={{ borderRadius: "var(--g-radius-md)" }}
                            >
                              <Route className="h-3.5 w-3.5 text-[var(--g-brand-3308)]" />
                              Abrir GRC
                            </Link>
                          ) : (
                            <span className="text-xs text-[var(--g-text-secondary)]">Sin acción GRC</span>
                          )}
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

            <div className="divide-y divide-[var(--g-border-subtle)] lg:hidden" role="list" aria-label="Lista móvil de evaluaciones IA">
              {filtered.map((ass) => {
                const statusCls = ASSESSMENT_STATUS_CHIP[ass.status] ?? "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]";
                const frameCls = FRAMEWORK_BADGE[ass.framework ?? ""] ?? "bg-[var(--g-surface-subtle)] text-[var(--g-text-secondary)]";
                const hasGrcHandoff = isAimsTechnicalFileGapCandidate(ass);
                return (
                  <article key={ass.id} role="listitem" className="p-4">
                    {ass.system_id ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/ai-governance/sistemas/${ass.system_id}`)}
                        className="flex w-full min-w-0 items-start justify-between gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--g-surface-card)]"
                        style={{ borderRadius: "var(--g-radius-md)" }}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-[var(--g-text-primary)]">
                            {ass.ai_systems?.name ?? "Sin sistema asociado"}
                          </span>
                          {ass.ai_systems?.risk_level && (
                            <span className="mt-1 block text-xs text-[var(--g-text-secondary)]">Riesgo {ass.ai_systems.risk_level}</span>
                          )}
                        </span>
                        <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-[var(--g-text-secondary)]" />
                      </button>
                    ) : (
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--g-text-primary)]">Sin sistema asociado</p>
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${frameCls}`}
                        style={{ borderRadius: "var(--g-radius-sm)" }}
                      >
                        {frameworkLabel(ass.framework)}
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${statusCls}`}
                        style={{ borderRadius: "var(--g-radius-full)" }}
                      >
                        {assessmentStatusLabel(ass.status)}
                      </span>
                      <span
                        className="inline-flex items-center border border-[var(--g-border-subtle)] bg-[var(--g-surface-muted)] px-2 py-0.5 text-xs font-medium text-[var(--g-text-secondary)]"
                        style={{ borderRadius: "var(--g-radius-sm)" }}
                      >
                        {formatDate(ass.assessment_date)}
                      </span>
                    </div>
                    <div className="mt-3">
                      {ass.score !== null ? (
                        <>
                          <div className="mb-1 flex items-center justify-between gap-3 text-xs text-[var(--g-text-secondary)]">
                            <span>Puntuación</span>
                            <span className="font-medium text-[var(--g-text-primary)]">{ass.score}/100</span>
                          </div>
                          <div className="h-2 bg-[var(--g-surface-muted)]" style={{ borderRadius: "var(--g-radius-full)" }}>
                            <div
                              className={`h-2 ${scoreTone(ass.score)}`}
                              style={{ borderRadius: "var(--g-radius-full)", width: `${ass.score}%` }}
                            />
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-[var(--g-text-secondary)]">Sin puntuación documentada</p>
                      )}
                    </div>
                    <div className="mt-3">
                      {hasGrcHandoff ? (
                        <Link
                          to={`/grc/risk-360?source=aims&handoff=AIMS_TECHNICAL_FILE_GAP&assessment=${ass.id}`}
                          className="inline-flex items-center gap-1 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-2 py-1 text-xs font-medium text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)]"
                          style={{ borderRadius: "var(--g-radius-md)" }}
                        >
                          <Route className="h-3.5 w-3.5 text-[var(--g-brand-3308)]" />
                          Abrir intake GRC
                        </Link>
                      ) : (
                        <span className="text-xs text-[var(--g-text-secondary)]">Sin acción GRC pendiente</span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>
      <div className="text-xs text-[var(--g-text-secondary)]">
        {filtered.length} evaluación{filtered.length !== 1 ? "es" : ""}
      </div>
    </div>
  );
}
