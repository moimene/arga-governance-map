import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAssessmentById } from "@/hooks/useAiAssessments";
import {
  AESIA_RIA_REQUIREMENTS,
  ISO_42001_REQUIREMENTS,
  calculateAdaptationPlan,
  MATURITY_LEVELS,
  DIFFICULTY_LEVELS,
} from "@/lib/aims/catalog-aesia";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  FileCheck,
  Printer,
  ShieldCheck,
  Sliders,
} from "lucide-react";
import { toast } from "sonner";

export default function EvaluacionDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: assessment, isLoading, error } = useAssessmentById(id);

  const [expandedRequirements, setExpandedRequirements] = useState<Record<string, boolean>>({
    QUALITY_MGMT: true,
    RISK_MGMT: true,
  });

  const toggleReq = (code: string) => {
    setExpandedRequirements((prev) => ({ ...prev, [code]: !prev[code] }));
  };

  if (isLoading) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-[var(--g-surface-subtle)] rounded w-1/3" />
          <div className="h-32 bg-[var(--g-surface-subtle)] rounded" />
          <div className="h-64 bg-[var(--g-surface-subtle)] rounded" />
        </div>
      </div>
    );
  }

  if (error || !assessment) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <div
          className="p-6 bg-[var(--g-surface-card)] border border-[var(--status-error)]/30 text-center"
          style={{ borderRadius: "var(--g-radius-lg)" }}
        >
          <AlertTriangle className="w-12 h-12 text-[var(--status-error)] mx-auto mb-3" />
          <h2 className="text-xl font-bold text-[var(--g-text-primary)] mb-2">Evaluación no encontrada</h2>
          <p className="text-sm text-[var(--g-text-secondary)] mb-4">
            No se ha podido localizar el expediente de autodiagnóstico solicitado.
          </p>
          <button
            onClick={() => navigate("/ai-governance/evaluaciones")}
            className="px-4 py-2 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] transition-colors"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            Volver a Evaluaciones
          </button>
        </div>
      </div>
    );
  }

  const isIso = assessment.framework === "ISO_42001";
  const catalog = isIso ? ISO_42001_REQUIREMENTS : AESIA_RIA_REQUIREMENTS;

  // Mapear findings para lookup rápido por código de medida
  const findingsMap: Record<string, { status: string; title?: string; planCode?: string }> = {};
  (assessment.findings || []).forEach((f) => {
    findingsMap[f.code] = f;
  });

  // Calcular conteo de planes
  const planCounts: Record<string, number> = { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0 };
  let evaluatedCount = 0;

  catalog.forEach((req) => {
    req.measures.forEach((m) => {
      const finding = findingsMap[m.id] || findingsMap[m.code];
      if (finding) {
        evaluatedCount++;
        const maturity = finding.status;
        const plan = calculateAdaptationPlan(maturity);
        if (plan.code !== "00") {
          planCounts[plan.code] = (planCounts[plan.code] || 0) + 1;
        }
      }
    });
  });

  const handlePrint = () => {
    window.print();
  };

  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(assessment, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute(
      "download",
      `informe-diagnostico-aesia-${assessment.system_id || "sistema"}-${new Date().toISOString().slice(0, 10)}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success("Informe de diagnóstico exportado en formato JSON");
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <button
          onClick={() => navigate("/ai-governance/evaluaciones")}
          className="flex items-center gap-2 text-sm text-[var(--g-text-secondary)] hover:text-[var(--g-text-primary)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver a Evaluaciones</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportJson}
            className="flex items-center gap-1.5 px-3 py-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] text-sm font-medium transition-colors"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <Download className="w-4 h-4" />
            <span>Exportar JSON</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] text-sm font-medium transition-colors"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir / PDF</span>
          </button>
        </div>
      </div>

      {/* Header Card */}
      <div
        className="p-6 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] space-y-4"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-[var(--g-text-secondary)]">
              <span className="font-mono font-semibold text-[var(--g-brand-3308)]">
                {isIso ? "ISO/IEC 42001 AUDIT" : "AESIA GUÍA 16 / RIA"}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Fecha: {assessment.assessment_date ? new Date(assessment.assessment_date).toLocaleDateString("es-ES") : "N/D"}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-[var(--g-text-primary)]">
              Informe de Autodiagnóstico de Conformidad
            </h1>
            <p className="text-sm text-[var(--g-text-secondary)]">
              Sistema Evaluado:{" "}
              {assessment.system_id ? (
                <Link
                  to={`/ai-governance/sistemas/${assessment.system_id}`}
                  className="font-bold text-[var(--g-brand-3308)] hover:underline inline-flex items-center gap-1"
                >
                  {assessment.ai_systems?.name || "Ver Ficha de Sistema"}
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              ) : (
                <span className="italic">No asignado</span>
              )}
            </p>
          </div>

          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold text-[var(--g-brand-3308)]">{assessment.score ?? 0}%</span>
              <span
                className={`px-2.5 py-1 text-xs font-semibold uppercase tracking-wider ${
                  assessment.status === "CONFORME"
                    ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
                    : "bg-[var(--status-warning)] text-[var(--g-text-inverse)]"
                }`}
                style={{ borderRadius: "var(--g-radius-full)" }}
              >
                {assessment.status}
              </span>
            </div>
            <span className="text-xs text-[var(--g-text-secondary)]">Madurez Global del Sistema</span>
          </div>
        </div>

        {/* Handoff callout if gaps exist */}
        {/* Sólo cuando consta una brecha. `BORRADOR` significa que no se ha
            evaluado: afirmar "no conformidades detectadas" ahí es tan falso
            como afirmar conformidad, sólo que en la otra dirección. */}
        {["CON_GAPS", "NO_CONFORME"].includes(assessment.status ?? "") && (
          <div
            className="p-4 bg-[var(--g-surface-subtle)] border-l-4 border-[var(--status-warning)] flex flex-wrap items-center justify-between gap-3 print:hidden"
            style={{ borderRadius: "var(--g-radius-sm)" }}
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-[var(--status-warning)] shrink-0" />
              <div>
                <p className="text-xs font-bold text-[var(--g-text-primary)]">
                  Gaps Normativos Detectados en la Evaluación
                </p>
                <p className="text-xs text-[var(--g-text-secondary)]">
                  Se requiere la formulación de planes de acción correctivos en GRC Compass para cerrar no conformidades.
                </p>
              </div>
            </div>
            <Link
              to={`/grc/risk-360?origen=aims&assessment_id=${assessment.id}&sistema=${encodeURIComponent(
                assessment.ai_systems?.name || ""
              )}`}
              className="px-3 py-1.5 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] text-xs font-medium transition-colors inline-flex items-center gap-1.5"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <span>Escalar a Risk 360</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        )}
      </div>

      {/* KPI Cards: Plan de Adaptación Breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div
          className="p-4 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] text-center space-y-1"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <div className="text-2xl font-bold text-[var(--status-error)]">{planCounts["01"]}</div>
          <div className="text-xs font-semibold text-[var(--g-text-primary)]">Plan 01</div>
          <div className="text-[10px] text-[var(--g-text-secondary)]">Doc. e Implementar</div>
        </div>

        <div
          className="p-4 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] text-center space-y-1"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <div className="text-2xl font-bold text-[var(--status-warning)]">{planCounts["02"]}</div>
          <div className="text-xs font-semibold text-[var(--g-text-primary)]">Plan 02</div>
          <div className="text-[10px] text-[var(--g-text-secondary)]">Implementar</div>
        </div>

        <div
          className="p-4 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] text-center space-y-1"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <div className="text-2xl font-bold text-[var(--status-success)]">{planCounts["03"]}</div>
          <div className="text-xs font-semibold text-[var(--g-text-primary)]">Plan 03</div>
          <div className="text-[10px] text-[var(--g-text-secondary)]">Adaptación Completa</div>
        </div>

        <div
          className="p-4 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] text-center space-y-1"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <div className="text-2xl font-bold text-[var(--status-info)]">{planCounts["04"]}</div>
          <div className="text-xs font-semibold text-[var(--g-text-primary)]">Plan 04</div>
          <div className="text-[10px] text-[var(--g-text-secondary)]">Documentar</div>
        </div>

        <div
          className="p-4 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] text-center space-y-1 col-span-2 md:col-span-1"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <div className="text-2xl font-bold text-[var(--g-brand-3308)]">{planCounts["05"]}</div>
          <div className="text-xs font-semibold text-[var(--g-text-primary)]">Plan 05</div>
          <div className="text-[10px] text-[var(--g-text-secondary)]">No necesaria (L8)</div>
        </div>
      </div>

      {/* Detailed Checklist Accordion */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--g-text-primary)]">
            Desglose de Requisitos y Medidas Guía (MG)
          </h2>
          <span className="text-xs text-[var(--g-text-secondary)]">
            {catalog.length} áreas normativas ({evaluatedCount} medidas evaluadas)
          </span>
        </div>

        {catalog.map((req) => {
          const isExpanded = expandedRequirements[req.code] ?? false;
          const reqMeasures = req.measures;
          const reqEvaluated = reqMeasures.filter((m) => !!(findingsMap[m.id] || findingsMap[m.code])).length;

          return (
            <div
              key={req.code}
              className="bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] overflow-hidden"
              style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
            >
              {/* Accordion Header */}
              <button
                onClick={() => toggleReq(req.code)}
                className="w-full p-4 bg-[var(--g-surface-subtle)]/40 hover:bg-[var(--g-surface-subtle)] flex items-center justify-between text-left transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-[var(--g-brand-3308)]" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-[var(--g-text-secondary)]" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[var(--g-text-primary)]">{req.title}</span>
                      <span className="text-xs font-mono text-[var(--g-brand-3308)] bg-[var(--g-surface-card)] px-2 py-0.5 border border-[var(--g-border-subtle)]" style={{ borderRadius: 'var(--g-radius-sm)' }}>
                        {req.articleRef}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--g-text-secondary)] line-clamp-1">{req.description}</p>
                  </div>
                </div>

                <div className="text-xs font-semibold text-[var(--g-text-secondary)]">
                  {reqEvaluated}/{reqMeasures.length} evaluadas
                </div>
              </button>

              {/* Accordion Body: Table of MGs */}
              {isExpanded && (
                <div className="p-4 overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--g-border-subtle)] text-[var(--g-text-secondary)]">
                        <th className="pb-2 font-semibold">Código</th>
                        <th className="pb-2 font-semibold">Descripción de la Medida (MG)</th>
                        <th className="pb-2 font-semibold">Subapartado</th>
                        <th className="pb-2 font-semibold">Madurez (AESIA)</th>
                        <th className="pb-2 font-semibold">Plan de Adaptación</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--g-border-subtle)]">
                      {reqMeasures.map((m) => {
                        const finding = findingsMap[m.id] || findingsMap[m.code];
                        const maturity = finding?.status;
                        const plan = calculateAdaptationPlan(maturity);
                        const matMeta = maturity ? MATURITY_LEVELS[maturity] : null;

                        return (
                          <tr key={m.id} className="hover:bg-[var(--g-surface-subtle)]/30 transition-colors">
                            <td className="py-2.5 font-mono text-[var(--g-brand-3308)] font-semibold">{m.id}</td>
                            <td className="py-2.5 pr-4 text-[var(--g-text-primary)]">{m.description}</td>
                            <td className="py-2.5 font-mono text-[var(--g-text-secondary)]">{m.subpartId}</td>
                            <td className="py-2.5">
                              {maturity ? (
                                <span
                                  className={`px-2 py-0.5 font-semibold text-[11px] ${
                                    maturity === "L5"
                                      ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
                                      : maturity === "L8"
                                      ? "bg-[var(--status-info)] text-[var(--g-text-inverse)]"
                                      : "bg-[var(--status-warning)] text-[var(--g-text-inverse)]"
                                  }`}
                                  style={{ borderRadius: "var(--g-radius-sm)" }}
                                  title={matMeta?.description}
                                >
                                  {maturity} — {matMeta?.title || maturity}
                                </span>
                              ) : (
                                <span className="text-[var(--g-text-secondary)] italic">Pendiente</span>
                              )}
                            </td>
                            <td className="py-2.5">
                              {plan.code !== "00" ? (
                                <span
                                  className={`px-2 py-0.5 font-medium text-[11px] ${
                                    plan.code === "03" || plan.code === "05"
                                      ? "text-[var(--status-success)] bg-[var(--g-surface-subtle)]"
                                      : plan.code === "01"
                                      ? "text-[var(--status-error)] bg-[var(--status-error)]/10"
                                      : "text-[var(--status-warning)] bg-[var(--status-warning)]/10"
                                  }`}
                                  style={{ borderRadius: "var(--g-radius-sm)" }}
                                >
                                  {plan.label}
                                </span>
                              ) : (
                                <span className="text-[var(--g-text-secondary)]">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
