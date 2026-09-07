import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAssessmentById, useFreezeAssessment, useReviewAssessment } from "@/hooks/useAiAssessments";
import {
  AESIA_RIA_REQUIREMENTS,
  ISO_42001_REQUIREMENTS,
  calculateAdaptationPlan,
  MATURITY_LEVELS,
  difficultyLabel,
  subpartTitle,
} from "@/lib/aims/catalog-aesia";
import { motivoNoAcredita } from "@/lib/aims/conformidad";
import { resumenPlan, type AccionPDA } from "@/lib/aims/plan-adaptacion";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Download,
  ExternalLink,
  FileCheck,
  Lock,
  Printer,
  ShieldCheck,
  Sliders,
} from "lucide-react";
import { assessmentAcreditaConformidad } from "@/lib/aims/readiness";
import {
  AVISO_COBERTURA_PROVISIONAL,
  AVISO_ISO_NO_ES_OBLIGACION,
  DESPLIEGUE_REQUIREMENTS,
  catalogoDeLosFindings,
  procedenciaDe,
} from "@/lib/aims/perfil-aplicabilidad";
import { toast } from "sonner";

type FindingPintable = {
  code: string;
  status: string;
  title?: string;
  planCode?: string;
  difficulty?: string | null;
  justification?: string | null;
  kind?: "MG" | "MA";
  requirementCode?: string;
  evidenceCount?: number;
};

/**
 * Notas y Plan de Adaptación.
 *
 * No se renderizaban ni en el informe ni al imprimir. En el piloto de Harvey el
 * PDA —seis acciones con responsable, prioridad y fecha— vive entero en
 * `notes`, así que el documento imprimible salía sin el plan que lo justifica.
 *
 * `whitespace-pre-line` porque el texto persistido lleva sus propios saltos de
 * línea: renderizarlo en un párrafo normal los colapsaba y la lista numerada se
 * leía como un chorro.
 */
function NotasYPlanDeAdaptacion({ notes }: { notes: string | null | undefined }) {
  const texto = (notes ?? "").trim();
  if (!texto) return null;
  return (
    <section
      className="p-6 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] space-y-3 break-inside-avoid"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <div className="flex items-center gap-2 border-b border-[var(--g-border-subtle)] pb-3">
        <ClipboardList className="w-4 h-4 text-[var(--g-brand-3308)]" />
        <h2 className="text-sm font-bold text-[var(--g-text-primary)]">
          Notas y Plan de Adaptación
        </h2>
      </div>
      <p className="text-sm text-[var(--g-text-primary)] whitespace-pre-line leading-relaxed">
        {texto}
      </p>
    </section>
  );
}

/**
 * Medidas Adicionales: las que quien evalúa añade porque el catálogo no las
 * trae. Se pintan aparte porque no pertenecen a ningún requisito del marco y,
 * si se mezclaran, el desglose por artículo dejaría de cuadrar.
 *
 * Hasta el 2026-09-07 no había ninguna que pintar: se perdían al enviar.
 */
function MedidasAdicionales({
  findings,
  catalogCodes,
}: {
  findings: FindingPintable[] | null | undefined;
  catalogCodes: Set<string>;
}) {
  const adicionales = (findings ?? []).filter(
    (f) => f.kind === "MA" || (!catalogCodes.has(f.code) && f.code?.startsWith("MA_")),
  );
  if (adicionales.length === 0) return null;
  return (
    <section
      className="p-6 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] space-y-3 break-inside-avoid"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <div className="flex items-center gap-2 border-b border-[var(--g-border-subtle)] pb-3">
        <Sliders className="w-4 h-4 text-[var(--g-brand-3308)]" />
        <h2 className="text-sm font-bold text-[var(--g-text-primary)]">
          Medidas adicionales ({adicionales.length})
        </h2>
      </div>
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="border-b border-[var(--g-border-subtle)] text-[var(--g-text-secondary)]">
            <th className="pb-2 font-semibold">Código</th>
            <th className="pb-2 font-semibold">Descripción</th>
            <th className="pb-2 font-semibold">Requisito</th>
            <th className="pb-2 font-semibold">Madurez</th>
            <th className="pb-2 font-semibold">Dificultad</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--g-border-subtle)]">
          {adicionales.map((f) => (
            <tr key={f.code}>
              <td className="py-2.5 font-mono text-[var(--g-brand-3308)] font-semibold">{f.code}</td>
              <td className="py-2.5 pr-4 text-[var(--g-text-primary)]">{f.title || "—"}</td>
              <td className="py-2.5 text-[var(--g-text-secondary)]">{f.requirementCode || "—"}</td>
              <td className="py-2.5 text-[var(--g-text-primary)]">
                {f.status ? `${f.status} — ${MATURITY_LEVELS[f.status]?.title ?? f.status}` : "Pendiente"}
              </td>
              <td className="py-2.5 text-[var(--g-text-secondary)]">{difficultyLabel(f.difficulty)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/**
 * El Plan de Adaptación como tabla de acciones.
 *
 * Cuando la evaluación no lo trae —las anteriores al 2026-09-07 no lo
 * tienen— no se pinta nada aquí y el plan sigue leyéndose en la sección de
 * notas, donde vivía como prosa. No se INVENTA un plan retroactivo.
 */
function PlanDeAdaptacionEstructurado({ acciones }: { acciones: AccionPDA[] | null | undefined }) {
  const items = Array.isArray(acciones) ? acciones : [];
  if (items.length === 0) return null;
  const resumen = resumenPlan(items, new Date());
  return (
    <section
      className="p-6 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] space-y-3 break-inside-avoid"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--g-border-subtle)] pb-3">
        <h2 className="text-sm font-bold text-[var(--g-text-primary)]">
          Plan de Adaptación ({resumen.total} acciones)
        </h2>
        <span className="text-xs text-[var(--g-text-secondary)]">
          {resumen.alta} de prioridad alta · {resumen.sinResponsable} sin responsable ·{" "}
          {resumen.vencidas} vencidas
        </span>
      </div>
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="border-b border-[var(--g-border-subtle)] text-[var(--g-text-secondary)]">
            <th className="pb-2 pr-3 font-semibold">Medida</th>
            <th className="pb-2 pr-3 font-semibold">Acción</th>
            <th className="pb-2 pr-3 font-semibold">Prioridad</th>
            <th className="pb-2 pr-3 font-semibold">Vence</th>
            <th className="pb-2 font-semibold">Estado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--g-border-subtle)]">
          {items.map((a) => (
            <tr key={a.measureCode}>
              <td className="py-2 pr-3 font-mono font-semibold text-[var(--g-brand-3308)]">{a.measureCode}</td>
              <td className="py-2 pr-3 text-[var(--g-text-primary)]">{a.titulo}</td>
              <td className="py-2 pr-3">
                <span
                  className={`px-2 py-0.5 text-[10px] font-bold ${
                    a.prioridad === "ALTA"
                      ? "bg-[var(--status-error)] text-[var(--g-text-inverse)]"
                      : a.prioridad === "MEDIA"
                      ? "bg-[var(--status-warning)] text-[var(--g-text-inverse)]"
                      : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
                  }`}
                  style={{ borderRadius: "var(--g-radius-full)" }}
                >
                  {a.prioridad}
                </span>
              </td>
              <td className="py-2 pr-3 text-[var(--g-text-secondary)]">{a.vence_el ?? "Sin fecha"}</td>
              <td className="py-2 text-[var(--g-text-secondary)]">{a.estado}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

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
                {/* El alta de esta misma evaluación retiró la atribución a la guía
                    numerada de la Agencia: la fuente de un requisito del
                    Reglamento es el ARTÍCULO, y esa atribución nunca se cotejó
                    contra publicación oficial. El informe del mismo objeto se
                    había quedado fuera de la retirada. */}
                {isIso ? "ISO/IEC 42001 AUDIT" : "REGLAMENTO (UE) 2024/1689"}
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
              {/* `score` nulo es ausencia de dato, no un cero. Un 0 % se lee
                  como «evaluado y suspenso», que es una afirmación distinta. */}
              <span className="text-3xl font-bold text-[var(--g-brand-3308)]">
                {assessment.score === null || assessment.score === undefined
                  ? "sin dato"
                  : `${assessment.score}%`}
              </span>
              <span
                className={`px-2.5 py-1 text-xs font-semibold uppercase tracking-wider ${
                  assessmentAcreditaConformidad(assessment.status)
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
              // `origen`/`assessment_id` no los lee nadie: Risk 360 pinta la
              // entrada desde AIMS con `source` + `handoff` (Risk360.tsx). Con
              // el contrato anterior el enlace llegaba mudo. Mismo literal que
              // el de la lista de evaluaciones.
              to={`/grc/risk-360?source=aims&handoff=AIMS_TECHNICAL_FILE_GAP&assessment=${assessment.id}`}
              className="px-3 py-1.5 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] text-xs font-medium transition-colors inline-flex items-center gap-1.5"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <span>Escalar a Risk 360</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        )}
      </div>

      {/* ---------------------------------------------------------------
          Custodia: congelación y revisión.

          Una evaluación guardada seguía siendo editable, sin versión ni
          huella. El hash SÍ es de servidor —el contenido está en la fila, así
          que no depende de lo que diga un cliente—, y se dice lo que NO
          acredita: `now()` es la hora del servidor, no fecha cierta.
          --------------------------------------------------------------- */}
      <section
        className="p-4 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] space-y-2"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h2 className="text-sm font-bold text-[var(--g-text-primary)]">Custodia de la evaluación</h2>
            {assessment.frozen_at ? (
              <p className="text-xs text-[var(--g-text-secondary)]">
                Congelada el {new Date(assessment.frozen_at).toLocaleString("es-ES")}.{" "}
                {assessment.reviewed_at
                  ? `Revisada el ${new Date(assessment.reviewed_at).toLocaleString("es-ES")}.`
                  : "Pendiente de revisión por una persona distinta de quien la congeló."}
              </p>
            ) : (
              <p className="text-xs text-[var(--g-text-secondary)]">
                Editable. Congelarla fija su contenido y calcula su huella en servidor.
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            {!assessment.frozen_at ? (
              <button
                type="button"
                onClick={handleCongelar}
                disabled={congelar.isPending || assessment.status === "BORRADOR"}
                aria-busy={congelar.isPending}
                title={
                  assessment.status === "BORRADOR"
                    ? "Un borrador no se congela: ciérralo antes."
                    : undefined
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <Lock className="w-3.5 h-3.5" />
                {congelar.isPending ? "Congelando…" : "Congelar evaluación"}
              </button>
            ) : !assessment.reviewed_at ? (
              <button
                type="button"
                onClick={handleRevisar}
                disabled={revisar.isPending}
                aria-busy={revisar.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[var(--g-border-subtle)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] disabled:opacity-60 transition-colors"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <FileCheck className="w-3.5 h-3.5 text-[var(--g-brand-3308)]" />
                {revisar.isPending ? "Registrando…" : "Revisar y aprobar"}
              </button>
            ) : null}
          </div>
        </div>

        {assessment.content_hash && (
          <div className="space-y-1 pt-2 border-t border-[var(--g-border-subtle)]">
            <p className="font-mono text-[10px] break-all text-[var(--g-text-secondary)]">
              SHA-512 {assessment.content_hash}
            </p>
            <p className="text-[11px] text-[var(--g-text-secondary)]">
              Huella calculada en servidor sobre la serialización canónica de la evaluación.
              Acredita integridad y quién la congeló. No acredita fecha cierta: la marca temporal es
              la hora del servidor, no un sello de tiempo cualificado.
            </p>
          </div>
        )}
      </section>

      {catalog === DESPLIEGUE_REQUIREMENTS && (
        <div
          className="p-4 bg-[var(--g-surface-subtle)] border-l-4 border-[var(--status-warning)] space-y-1"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <p className="text-xs font-bold text-[var(--g-text-primary)]">
            {AVISO_COBERTURA_PROVISIONAL}
          </p>
          <p className="text-xs text-[var(--g-text-secondary)]">
            Este autodiagnóstico se ha medido contra el catálogo del responsable del despliegue, no
            contra las 84 medidas del proveedor de un sistema de alto riesgo. {AVISO_ISO_NO_ES_OBLIGACION}
          </p>
        </div>
      )}

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

        {findingsSinReconciliar && (
          <div
            className="p-4 bg-[var(--g-surface-subtle)] border-l-4 border-[var(--status-warning)] flex items-start gap-3"
            style={{ borderRadius: "var(--g-radius-sm)" }}
          >
            <AlertTriangle className="w-5 h-5 text-[var(--status-warning)] shrink-0" />
            <div className="space-y-1">
              <p className="text-xs font-bold text-[var(--g-text-primary)]">
                El desglose no corresponde a esta evaluación
              </p>
              <p className="text-xs text-[var(--g-text-secondary)]">
                La evaluación tiene {findingsPersistidos} medida(s) registradas, pero ninguna
                usa un código del catálogo de este marco: la tabla de abajo muestra el catálogo
                completo como pendiente, no el contenido real de la evaluación. El porcentaje
                de la cabecera es el valor guardado en su día, no un cálculo sobre este desglose.
              </p>
            </div>
          </div>
        )}

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

              {/* Accordion Body: Table of MGs
                  Se OCULTA por CSS en vez de desmontarse: mientras dependía de
                  `isExpanded &&`, lo plegado no llegaba al DOM y el PDF salía
                  con las áreas colapsadas fuera del documento. */}
              <div className={`p-4 overflow-x-auto ${isExpanded ? "" : "hidden print:block"}`}>
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--g-border-subtle)] text-[var(--g-text-secondary)]">
                        <th className="pb-2 font-semibold">Código</th>
                        <th className="pb-2 font-semibold">Descripción de la Medida (MG)</th>
                        <th className="pb-2 font-semibold">Bloque del requisito</th>
                        <th className="pb-2 font-semibold">Madurez</th>
                        <th className="pb-2 font-semibold">Dificultad</th>
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
                            <td className="py-2.5 text-[var(--g-text-secondary)]">
                              {subpartTitle(req, m.subpartId)}
                              {(() => {
                                const proc = procedenciaDe(m.id);
                                if (!proc) return null;
                                return (
                                  <div className="mt-0.5 text-[10px]">
                                    <span
                                      className={
                                        proc.caracter === "OBLIGACION"
                                          ? "font-semibold text-[var(--g-brand-3308)]"
                                          : "text-[var(--g-text-secondary)]"
                                      }
                                    >
                                      {proc.caracter === "OBLIGACION" ? "Obligación" : "Marco operativo"}
                                    </span>{" "}
                                    · {proc.norma}
                                  </div>
                                );
                              })()}
                            </td>
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
                              {/* Una `L8` sin motivo no acredita no-aplicabilidad:
                                  la escala declara la justificación obligatoria. Se
                                  dice en la fila, que es donde se lee el nivel. */}
                              {motivoNoAcredita(finding) && (
                                <div className="mt-1 text-[10px] font-semibold text-[var(--status-error)]">
                                  {motivoNoAcredita(finding)}
                                </div>
                              )}
                              {finding?.justification && (
                                <div className="mt-1 text-[10px] text-[var(--g-text-secondary)] italic max-w-md">
                                  {finding.justification}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 text-[var(--g-text-secondary)]">
                              {difficultyLabel(finding?.difficulty)}
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
            </div>
          );
        })}
      </div>

      <PlanDeAdaptacionEstructurado acciones={assessment.action_plan as AccionPDA[] | null} />

      <MedidasAdicionales findings={assessment.findings} catalogCodes={codigosDelCatalogo} />

      <NotasYPlanDeAdaptacion notes={assessment.notes} />
    </div>
  );
}
