import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Download,
  ExternalLink,
  FileCheck,
  Lock,
  Printer,
} from "lucide-react";
import { assessmentAcreditaConformidad } from "@/lib/aims/readiness";
import {
  AVISO_COBERTURA_PROVISIONAL,
  AVISO_ISO_NO_ES_OBLIGACION,
} from "@/lib/aims/perfil-aplicabilidad";
import { normalizeAimsStatus } from "@/lib/aims/vocabulario";
import type { AiRiskAssessment } from "@/hooks/useAiAssessments";

export interface CabeceraInformeProps {
  assessment: AiRiskAssessment & { ai_systems?: { name?: string | null } | null };
  isIso: boolean;
  /** Resuelto en la página: el catálogo medido es el del desplegador. */
  catalogoDeDespliegue: boolean;
  onExportJson: () => void;
  onPrint: () => void;
  onCongelar: () => void;
  onRevisar: () => void;
  congelando: boolean;
  revisando: boolean;
}

/** Barra de acciones, identificación del informe y custodia. */
export default function CabeceraInforme({
  assessment,
  isIso,
  catalogoDeDespliegue,
  onExportJson,
  onPrint,
  onCongelar,
  onRevisar,
  congelando,
  revisando,
}: CabeceraInformeProps) {
  const navigate = useNavigate();

  return (
    <>
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
            onClick={onExportJson}
            className="flex items-center gap-1.5 px-3 py-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] text-sm font-medium transition-colors"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <Download className="w-4 h-4" />
            <span>Exportar JSON</span>
          </button>
          <button
            onClick={onPrint}
            className="flex items-center gap-1.5 px-3 py-2 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] text-sm font-medium transition-colors"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir / PDF</span>
          </button>
        </div>
      </div>

      <div
        className="p-6 bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] space-y-4"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-[var(--g-text-secondary)]">
              <span className="font-mono font-semibold text-[var(--g-brand-3308)]">
                {/* La fuente de un requisito del Reglamento es el ARTÍCULO: la
                    atribución a la guía numerada de la Agencia nunca se cotejó
                    contra publicación oficial y se retiró de todo el módulo. */}
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
              // Risk 360 pinta la entrada desde AIMS con `source` + `handoff`
              // (Risk360.tsx); con el contrato anterior el enlace llegaba mudo.
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
                onClick={onCongelar}
                disabled={congelando || normalizeAimsStatus(assessment.status) === "BORRADOR"}
                aria-busy={congelando}
                title={
                  normalizeAimsStatus(assessment.status) === "BORRADOR"
                    ? "Un borrador no se congela: ciérralo antes."
                    : undefined
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <Lock className="w-3.5 h-3.5" />
                {congelando ? "Congelando…" : "Congelar evaluación"}
              </button>
            ) : !assessment.reviewed_at ? (
              <button
                type="button"
                onClick={onRevisar}
                disabled={revisando}
                aria-busy={revisando}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[var(--g-border-subtle)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] disabled:opacity-60 transition-colors"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <FileCheck className="w-3.5 h-3.5 text-[var(--g-brand-3308)]" />
                {revisando ? "Registrando…" : "Revisar y aprobar"}
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

      {catalogoDeDespliegue && (
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
    </>
  );
}
