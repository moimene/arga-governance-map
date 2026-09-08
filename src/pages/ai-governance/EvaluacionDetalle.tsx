import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useAssessmentById, useFreezeAssessment, useReviewAssessment } from "@/hooks/useAiAssessments";
import {
  AESIA_RIA_REQUIREMENTS,
  ISO_42001_REQUIREMENTS,
  calculateAdaptationPlan,
} from "@/lib/aims/catalog-aesia";
import type { AccionPDA } from "@/lib/aims/plan-adaptacion";
import { DESPLIEGUE_REQUIREMENTS, catalogoDeLosFindings } from "@/lib/aims/perfil-aplicabilidad";
import CabeceraInforme from "@/components/ai-governance/evaluacion-detalle/CabeceraInforme";
import ChecklistMedidas from "@/components/ai-governance/evaluacion-detalle/ChecklistMedidas";
import PlanYNotas from "@/components/ai-governance/evaluacion-detalle/PlanYNotas";
import type { FindingPintable } from "@/components/ai-governance/evaluacion-detalle/tipos";

export default function EvaluacionDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: assessment, isLoading, error } = useAssessmentById(id);
  const congelar = useFreezeAssessment();
  const revisar = useReviewAssessment();

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
  // El catálogo se resuelve por el DATO, no por la columna `framework`: desde
  // que hay perfil por rol, dos evaluaciones `EU_AI_ACT` pueden venir de
  // catálogos distintos, y pintar la de un responsable del despliegue contra
  // las 84 del proveedor mostraría 84 «Pendiente» y ninguna de las respondidas.
  const catalog = catalogoDeLosFindings(assessment.findings, [
    isIso ? ISO_42001_REQUIREMENTS : AESIA_RIA_REQUIREMENTS,
    DESPLIEGUE_REQUIREMENTS,
    isIso ? AESIA_RIA_REQUIREMENTS : ISO_42001_REQUIREMENTS,
  ]);

  // Mapear findings para lookup rápido por código de medida
  const findingsMap: Record<string, FindingPintable> = {};
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

  // Cuántos findings hay persistidos frente a cuántos reconcilian con el
  // catálogo del marco. En Cloud hay evaluaciones con códigos `VAL-01`, `ART_9`
  // o `ISO-05` que no están en ningún catálogo: el desglose las pinta enteras
  // como «Pendiente» mientras la cabecera muestra el `score` guardado. Sin
  // decirlo, la pantalla se contradice a sí misma en silencio.
  const findingsPersistidos = (assessment.findings || []).length;
  const findingsSinReconciliar = findingsPersistidos > 0 && evaluatedCount === 0;

  /** Códigos que el marco conoce: lo que quede fuera es medida adicional. */
  const codigosDelCatalogo = new Set(catalog.flatMap((r) => r.measures.map((m) => m.id)));

  const handleCongelar = async () => {
    try {
      const res = await congelar.mutateAsync(assessment.id);
      toast.success(`Evaluación congelada. Huella ${res?.content_hash?.slice(0, 16)}…`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`No se pudo congelar: ${msg}`);
    }
  };

  const handleRevisar = async () => {
    try {
      await revisar.mutateAsync(assessment.id);
      toast.success("Revisión registrada.");
    } catch (err) {
      // El error de la RPC ya explica el caso: misma cuenta que congeló, no
      // congelada todavía, o ya revisada. Se muestra tal cual.
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`No se pudo registrar la revisión: ${msg}`);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(assessment, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute(
      "download",
      // No es un informe A la AESIA: es un autodiagnóstico interno. El nombre
      // anterior («informe-diagnostico-aesia») inducía a error sobre el estatus
      // regulatorio del documento.
      `autodiagnostico-aims-${assessment.system_id || "sistema"}-${new Date().toISOString().slice(0, 10)}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success("Autodiagnóstico exportado en formato JSON");
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <CabeceraInforme
        assessment={assessment}
        isIso={isIso}
        catalogoDeDespliegue={catalog === DESPLIEGUE_REQUIREMENTS}
        onExportJson={handleExportJson}
        onPrint={handlePrint}
        onCongelar={handleCongelar}
        onRevisar={handleRevisar}
        congelando={congelar.isPending}
        revisando={revisar.isPending}
      />

      <ChecklistMedidas
        catalog={catalog}
        findingsMap={findingsMap}
        planCounts={planCounts}
        evaluatedCount={evaluatedCount}
        findingsPersistidos={findingsPersistidos}
        findingsSinReconciliar={findingsSinReconciliar}
        expandedRequirements={expandedRequirements}
        onToggleRequirement={toggleReq}
      />

      <PlanYNotas
        acciones={assessment.action_plan as AccionPDA[] | null}
        findings={assessment.findings}
        catalogCodes={codigosDelCatalogo}
        notes={assessment.notes}
      />
    </div>
  );
}
