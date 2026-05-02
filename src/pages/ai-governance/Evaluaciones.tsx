import { Link, useNavigate } from "react-router-dom";
import { ClipboardCheck, ArrowRight, Route } from "lucide-react";
import { useAllAssessments } from "@/hooks/useAiAssessments";
import { isAimsTechnicalFileGapCandidate } from "@/lib/aims/readiness";

const ASSESSMENT_STATUS_CHIP: Record<string, string> = {
  APROBADO:    "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  EN_REVISION: "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  BORRADOR:    "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]",
};

const FRAMEWORK_BADGE: Record<string, string> = {
  EU_AI_ACT:  "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]",
  ISO_42001:  "bg-[var(--g-sec-100)] text-[var(--g-brand-3308)]",
};

export default function Evaluaciones() {
  const navigate = useNavigate();
  const { data: assessments = [], isLoading } = useAllAssessments();

  return (
    <div className="p-6 max-w-[1100px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <ClipboardCheck className="h-5 w-5 text-[var(--g-brand-3308)]" />
          <h1 className="text-xl font-bold text-[var(--g-text-primary)]">Evaluaciones de Riesgo IA</h1>
        </div>
        <p className="text-sm text-[var(--g-text-secondary)]">
          Evaluaciones EU AI Act e ISO 42001 de los sistemas en el inventario
        </p>
      </div>

      <div
        className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] overflow-hidden"
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
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-[var(--g-surface-subtle)]">
                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">Sistema</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">Framework</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">Score</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">Fecha</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">GRC</th>
                <th className="px-6 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--g-border-subtle)]">
              {assessments.map((ass) => {
                const statusCls = ASSESSMENT_STATUS_CHIP[ass.status] ?? "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]";
                const frameCls = FRAMEWORK_BADGE[ass.framework ?? ""] ?? "bg-[var(--g-surface-subtle)] text-[var(--g-text-secondary)]";
                const hasGrcHandoff = isAimsTechnicalFileGapCandidate(ass);
                return (
                  <tr
                    key={ass.id}
                    className="hover:bg-[var(--g-surface-subtle)]/50 transition-colors cursor-pointer"
                    onClick={() => ass.system_id && navigate(`/ai-governance/sistemas/${ass.system_id}`)}
                  >
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-[var(--g-text-primary)]">
                        {ass.ai_systems?.name ?? "—"}
                      </p>
                      {ass.ai_systems?.risk_level && (
                        <p className="text-xs text-[var(--g-text-secondary)] mt-0.5">
                          Riesgo {ass.ai_systems.risk_level}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${frameCls}`}
                        style={{ borderRadius: "var(--g-radius-sm)" }}
                      >
                        {ass.framework ?? "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {ass.score !== null ? (
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-1.5 bg-[var(--g-surface-muted)]" style={{ borderRadius: "var(--g-radius-full)" }}>
                            <div
                              className={`h-1.5 ${
                                ass.score >= 80
                                  ? "bg-[var(--status-success)]"
                                  : ass.score >= 60
                                  ? "bg-[var(--status-warning)]"
                                  : "bg-[var(--status-error)]"
                              }`}
                              style={{ borderRadius: "var(--g-radius-full)", width: `${ass.score}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-[var(--g-text-primary)]">{ass.score}</span>
                        </div>
                      ) : "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">
                      {ass.assessment_date
                        ? new Date(ass.assessment_date).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })
                        : "—"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${statusCls}`}
                        style={{ borderRadius: "var(--g-radius-full)" }}
                      >
                        {ass.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {hasGrcHandoff ? (
                        <Link
                          to={`/grc/risk-360?source=aims&handoff=AIMS_TECHNICAL_FILE_GAP&assessment=${ass.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-2 py-1 text-xs font-medium text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-muted)]"
                          style={{ borderRadius: "var(--g-radius-md)" }}
                        >
                          <Route className="h-3.5 w-3.5 text-[var(--g-brand-3308)]" />
                          Abrir intake GRC
                        </Link>
                      ) : (
                        <span className="text-xs text-[var(--g-text-secondary)]">Sin gap activo</span>
                      )}
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
    </div>
  );
}
