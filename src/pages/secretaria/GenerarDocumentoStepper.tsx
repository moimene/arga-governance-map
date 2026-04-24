/**
 * GenerarDocumentoStepper — 5-step wizard for document generation
 *
 * Flow: Select plantilla → Review variables → Fill capa3 → Preview → Generate
 *
 * Route: /secretaria/acuerdos/:id/generar
 */

import { useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  FileCheck2,
  FileText,
  Edit3,
  Eye,
  Download,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Shield,
  Lock,
} from "lucide-react";
import { useAgreement } from "@/hooks/useAgreementCompliance";
import { usePlantillasProtegidas } from "@/hooks/usePlantillasProtegidas";
import type { PlantillaProtegidaRow } from "@/hooks/usePlantillasProtegidas";
import { useQTSPSign } from "@/hooks/useQTSPSign";
import { Capa3Form, validateCapa3 } from "@/components/secretaria/Capa3Form";
import { renderTemplate } from "@/lib/doc-gen/template-renderer";
import { resolveVariables, mergeVariables } from "@/lib/doc-gen/variable-resolver";
import type { Capa2Variable, ResolverContext } from "@/lib/doc-gen/variable-resolver";
import { generateDocx, downloadDocx, computeContentHash } from "@/lib/doc-gen/docx-generator";
import type { EditableField } from "@/lib/doc-gen/docx-generator";
import { archiveDocxToStorage } from "@/lib/doc-gen/storage-archiver";
import { generarVerificadorOffline } from "@/lib/rules-engine";
import type { EvidenceManifest, EvidenceArtifact } from "@/lib/rules-engine";
import { useTenantContext } from "@/context/TenantContext";

// ── Step definitions ─────────────────────────────────────────────────────────

const STEPS = [
  { key: "plantilla", label: "Plantilla", icon: FileCheck2 },
  { key: "variables", label: "Variables", icon: FileText },
  { key: "editables", label: "Editables", icon: Edit3 },
  { key: "preview", label: "Vista previa", icon: Eye },
  { key: "generar", label: "Generar", icon: Download },
] as const;

// ── Main component ───────────────────────────────────────────────────────────

export default function GenerarDocumentoStepper() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tenantId } = useTenantContext();
  const { data: agreement, isLoading: agreementLoading } = useAgreement(id);
  const { data: plantillas = [], isLoading: plantillasLoading } = usePlantillasProtegidas();

  const [step, setStep] = useState(0);
  const [selectedPlantilla, setSelectedPlantilla] = useState<PlantillaProtegidaRow | null>(null);
  const [resolvedVars, setResolvedVars] = useState<Record<string, unknown>>({});
  const [unresolvedVars, setUnresolvedVars] = useState<string[]>([]);
  const [capa3Values, setCapa3Values] = useState<Record<string, string>>({});
  const [renderedText, setRenderedText] = useState("");
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [contentHash, setContentHash] = useState<string>("");
  const [signingStatus, setSigningStatus] = useState<"idle" | "pending" | "signed" | "error">(
    "idle"
  );
  const [signingError, setSigningError] = useState<string | null>(null);
  const [archiveStatus, setArchiveStatus] = useState<"idle" | "archiving" | "archived" | "error">(
    "idle"
  );
  const [archiveUrl, setArchiveUrl] = useState<string | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [docxBuffer, setDocxBuffer] = useState<Uint8Array | null>(null);
  const [capa3Errors, setCapa3Errors] = useState<Record<string, string>>({});

  const { signMutation } = useQTSPSign();

  // Filter plantillas compatible with this agreement
  const compatiblePlantillas = useMemo(() => {
    if (!agreement) return [];
    return plantillas.filter((p) => {
      const statusOk = p.estado === "ACTIVA" || p.estado === "APROBADA" || p.estado === "REVISADA";
      const jurisdiccionOk = p.jurisdiccion === "ES";
      // Match adoption_mode if set
      const adoptionOk =
        !p.adoption_mode || p.adoption_mode === agreement.adoption_mode;
      return statusOk && jurisdiccionOk && adoptionOk;
    });
  }, [plantillas, agreement]);

  // ── Step 1: Select plantilla ─────────────────────────────────────────────

  const handleSelectPlantilla = useCallback(
    async (plantilla: PlantillaProtegidaRow) => {
      setSelectedPlantilla(plantilla);

      // Auto-resolve variables
      if (plantilla.capa2_variables && agreement) {
        setIsResolving(true);
        try {
          const context: ResolverContext = {
            agreementId: agreement.id,
            tenantId: tenantId ?? "",
            entityId: agreement.entity_id,
            bodyId: agreement.body_id,
            meetingId: agreement.parent_meeting_id,
          };
          const result = await resolveVariables(
            plantilla.capa2_variables as Capa2Variable[],
            context
          );
          setResolvedVars(result.values);
          setUnresolvedVars(result.unresolved);
        } catch {
          setUnresolvedVars([]);
        } finally {
          setIsResolving(false);
        }
      }

      setStep(1);
    },
    [agreement]
  );

  // ── Step 4: Render preview ───────────────────────────────────────────────

  const handleRenderPreview = useCallback(() => {
    if (!selectedPlantilla?.capa1_inmutable) {
      setRenderError("La plantilla no tiene contenido capa1.");
      return;
    }

    const mergedVars = mergeVariables(resolvedVars, capa3Values);
    const result = renderTemplate({
      template: selectedPlantilla.capa1_inmutable,
      variables: mergedVars,
    });

    if (result.ok) {
      setRenderedText(result.text);
      setRenderError(null);
    } else {
      setRenderError(result.error || "Error al renderizar la plantilla.");
    }

    setStep(3);
  }, [selectedPlantilla, resolvedVars, capa3Values]);

  const handleSignQES = useCallback(async () => {
    if (!docxBuffer || !selectedPlantilla || !agreement) {
      setSigningError("Documento no generado aún");
      return;
    }
    setSigningStatus("pending");
    setSigningError(null);
    try {
      await signMutation.mutateAsync({
        documentName: `${selectedPlantilla.tipo}_${agreement.id.slice(0, 8)}.docx`,
        documentData: docxBuffer.buffer as ArrayBuffer,
        signatories: [{ name: "Lucía Martín", email: "lucia.martin@arga-seguros.com", surnames: "Martín García", sequence: 1 }],
        createdBy: "secretaria-demo",
        agreementId: agreement.id,
        onProgress: () => {},
      });
      setSigningStatus("signed");
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Error desconocido al firmar";
      setSigningError(errorMsg);
      setSigningStatus("error");
    }
  }, [docxBuffer, selectedPlantilla, agreement, signMutation]);

  const handleArchive = useCallback(async () => {
    if (!docxBuffer || !agreement?.id) {
      setArchiveError("Buffer del documento o ID del acuerdo no disponible");
      return;
    }

    setArchiveStatus("archiving");
    setArchiveError(null);

    try {
      const filename = `${selectedPlantilla?.tipo || "documento"}_${agreement.id.slice(0, 8)}_${new Date().toISOString().split("T")[0]}`;
      const result = await archiveDocxToStorage(docxBuffer.buffer as ArrayBuffer, agreement.id, filename, tenantId ?? "");

      if (result.ok) {
        setArchiveUrl(result.documentUrl || null);
        setArchiveStatus("archived");
      } else {
        setArchiveError(result.error || "Error al archivar el documento");
        setArchiveStatus("error");
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Error desconocido al archivar";
      setArchiveError(errorMsg);
      setArchiveStatus("error");
    }
  }, [docxBuffer, agreement, selectedPlantilla]);

  // ── Step 5: Generate DOCX ───────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    if (!selectedPlantilla || !renderedText) return;

    setIsGenerating(true);
    try {
      const hash = await computeContentHash(renderedText);
      setContentHash(hash);
      const title = renderedText.split("\n")[0] || selectedPlantilla.tipo;

      const editableFields: EditableField[] = (selectedPlantilla.capa3_editables ?? []).map(
        (f: { campo: string; descripcion: string; placeholder?: string }) => ({
          key: f.campo,
          label: f.descripcion || f.campo,
          placeholder: f.placeholder,
          value: capa3Values[f.campo] || undefined,
        })
      );

      const buffer = await generateDocx({
        renderedText,
        title,
        subtitle: agreement?.entity_id ? undefined : undefined,
        templateTipo: selectedPlantilla.tipo,
        templateVersion: selectedPlantilla.version,
        contentHash: hash,
        entityName: resolvedVars.denominacion_social as string,
        generatedAt: new Date().toISOString().split("T")[0],
        editableFields: editableFields.length > 0 ? editableFields : undefined,
      });

      // Save buffer for later archival
      setDocxBuffer(buffer);

      const filename = `${selectedPlantilla.tipo}_${agreement?.id?.slice(0, 8) || "doc"}_${new Date().toISOString().split("T")[0]}.docx`;
      downloadDocx(buffer, filename);
      setGenerated(true);
      setSigningStatus("idle");
      setSigningError(null);
      setArchiveStatus("idle");
      setArchiveUrl(null);
      setArchiveError(null);
      setStep(4);
    } catch (e) {
      setRenderError(e instanceof Error ? e.message : "Error al generar DOCX.");
    } finally {
      setIsGenerating(false);
    }
  }, [selectedPlantilla, renderedText, agreement, resolvedVars]);

  // ── Loading state ────────────────────────────────────────────────────────

  if (agreementLoading || plantillasLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--g-text-secondary)]">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Cargando...
      </div>
    );
  }

  if (!agreement) {
    return (
      <div className="p-6 text-sm text-[var(--status-error)]">
        Acuerdo no encontrado.
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(`/secretaria/acuerdos/${id}`)}
          className="flex items-center gap-1 text-sm text-[var(--g-text-secondary)] hover:text-[var(--g-text-primary)] transition-colors"
          aria-label="Volver al expediente"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </button>
        <h1 className="text-lg font-bold text-[var(--g-text-primary)]" style={{ fontFamily: "'Montserrat', sans-serif" }}>
          Generar documento
        </h1>
      </div>

      {/* Stepper bar */}
      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isCurrent = i === step;
          const isDone = i < step;
          return (
            <div key={s.key} className="flex items-center gap-1 flex-1">
              <div
                className={`flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors w-full ${
                  isCurrent
                    ? "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]"
                    : isDone
                    ? "bg-[var(--g-sec-100)] text-[var(--g-brand-3308)]"
                    : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
                }`}
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                {isDone ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                )}
                <span className="truncate hidden sm:inline">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <ArrowRight className="h-3 w-3 text-[var(--g-border-subtle)] shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div
        className="bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] p-6"
        style={{ borderRadius: "var(--g-radius-lg)" }}
      >
        {/* ──────── Step 0: Select plantilla ──────── */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">
              Seleccionar plantilla
            </h2>
            <p className="text-xs text-[var(--g-text-secondary)]">
              Plantillas compatibles con el acuerdo (adopción: {agreement.adoption_mode}, jurisdicción: ES)
            </p>

            {compatiblePlantillas.length === 0 ? (
              <div
                className="flex items-center gap-2 px-4 py-3 text-sm text-[var(--status-warning)] bg-[var(--g-surface-muted)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <AlertTriangle className="h-4 w-4" />
                No hay plantillas compatibles en estado APROBADA o ACTIVA.
              </div>
            ) : (
              <div className="space-y-2">
                {compatiblePlantillas.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectPlantilla(p)}
                    className="w-full text-left flex items-center justify-between px-4 py-3 border border-[var(--g-border-subtle)] hover:border-[var(--g-brand-3308)] hover:bg-[var(--g-sec-100)] transition-colors"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    <div>
                      <div className="text-sm font-medium text-[var(--g-text-primary)]">
                        {p.tipo}
                        {p.organo_tipo && (
                          <span className="ml-2 text-xs text-[var(--g-text-secondary)]">
                            ({p.organo_tipo})
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[var(--g-text-secondary)] mt-0.5">
                        v{p.version} — {p.estado}
                        {p.referencia_legal && ` — ${p.referencia_legal}`}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-semibold ${
                        p.estado === "ACTIVA"
                          ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
                          : p.estado === "APROBADA"
                          ? "bg-[var(--g-brand-bright)] text-[var(--g-text-inverse)]"
                          : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
                      }`}
                      style={{ borderRadius: "var(--g-radius-full)" }}
                    >
                      {p.estado}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ──────── Step 1: Review resolved variables ──────── */}
        {step === 1 && selectedPlantilla && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">
              Variables resueltas (Capa 2)
            </h2>
            <p className="text-xs text-[var(--g-text-secondary)]">
              Valores auto-resueltos desde la base de datos. Las variables de tipo USUARIO se completan en el paso siguiente.
            </p>

            {isResolving ? (
              <div className="flex items-center gap-2 py-4 text-sm text-[var(--g-text-secondary)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Resolviendo variables...
              </div>
            ) : (
              <>
                <div className="overflow-hidden border border-[var(--g-border-subtle)]" style={{ borderRadius: "var(--g-radius-md)" }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[var(--g-surface-subtle)]">
                        <th className="px-4 py-2 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">
                          Variable
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">
                          Fuente
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">
                          Valor
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--g-border-subtle)]">
                      {(selectedPlantilla.capa2_variables ?? []).map((v) => {
                        const value = resolvedVars[v.variable];
                        const isResolved = value !== undefined && value !== null;
                        return (
                          <tr key={v.variable} className="hover:bg-[var(--g-surface-subtle)]/50">
                            <td className="px-4 py-2 font-mono text-xs text-[var(--g-text-primary)]">
                              {v.variable}
                            </td>
                            <td className="px-4 py-2">
                              <span
                                className="px-1.5 py-0.5 text-[10px] font-medium bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
                                style={{ borderRadius: "var(--g-radius-sm)" }}
                              >
                                {v.fuente}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-xs">
                              {isResolved ? (
                                <span className="text-[var(--g-text-primary)]">
                                  {typeof value === "object" ? JSON.stringify(value).substring(0, 60) + "…" : String(value)}
                                </span>
                              ) : v.fuente === "USUARIO" ? (
                                <span className="italic text-[var(--g-text-secondary)]">→ Paso 3</span>
                              ) : (
                                <span className="italic text-[var(--status-warning)]">No resuelto</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {unresolvedVars.length > 0 && (
                  <div
                    className="flex items-start gap-2 px-4 py-2 text-xs text-[var(--status-warning)] bg-[var(--g-surface-muted)]"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>
                      {unresolvedVars.length} variable(s) sin resolver. El documento se generará con valores vacíos donde falten datos.
                    </span>
                  </div>
                )}

                <div className="flex justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(0)}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm border border-[var(--g-border-subtle)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] transition-colors"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] transition-colors"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    Siguiente
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ──────── Step 2: Capa3 form ──────── */}
        {step === 2 && selectedPlantilla && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">
              Campos editables (Capa 3)
            </h2>
            <p className="text-xs text-[var(--g-text-secondary)]">
              Complete los campos que requiere esta plantilla. Los campos obligatorios deben rellenarse antes de generar.
            </p>

            <Capa3Form
              fields={(selectedPlantilla.capa3_editables ?? [])}
              values={capa3Values}
              onChange={(vals) => { setCapa3Values(vals); setCapa3Errors({}); }}
            />

            {Object.keys(capa3Errors).length > 0 && (
              <div
                className="flex items-start gap-2 border border-[var(--status-error)] bg-[var(--g-surface-card)] p-3 text-xs text-[var(--status-error)]"
                role="alert"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div className="space-y-0.5">
                  {Object.values(capa3Errors).map((msg, i) => (
                    <p key={i}>{msg}</p>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm border border-[var(--g-border-subtle)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] transition-colors"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Anterior
              </button>
              <button
                type="button"
                onClick={() => {
                  const errors = validateCapa3(selectedPlantilla.capa3_editables ?? [], capa3Values);
                  if (Object.keys(errors).length > 0) {
                    setCapa3Errors(errors);
                    return;
                  }
                  setCapa3Errors({});
                  handleRenderPreview();
                }}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] transition-colors"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                Vista previa
                <Eye className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ──────── Step 3: Preview ──────── */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">
              Vista previa del documento
            </h2>

            {renderError ? (
              <div
                className="px-4 py-3 text-sm text-[var(--status-error)]"
                style={{ borderRadius: "var(--g-radius-md)", background: "hsl(0 84% 60% / 0.08)" }}
              >
                {renderError}
              </div>
            ) : (
              <div
                className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-6 max-h-[500px] overflow-y-auto text-sm leading-relaxed text-[var(--g-text-primary)] whitespace-pre-wrap"
                style={{
                  borderRadius: "var(--g-radius-lg)",
                  fontFamily: "'Montserrat', 'Inter', sans-serif",
                }}
              >
                {renderedText}
              </div>
            )}

            <div className="flex justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm border border-[var(--g-border-subtle)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] transition-colors"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Editar campos
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating || !!renderError}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] transition-colors disabled:opacity-50"
                style={{ borderRadius: "var(--g-radius-md)" }}
                aria-busy={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5" />
                    Generar DOCX
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ──────── Step 4: Generated + Signing ──────── */}
        {step === 4 && (
          <div className="space-y-4 py-6">
            <div className="flex items-center gap-3 px-4 py-3 bg-[var(--status-success)]/10 text-[var(--status-success)] rounded-lg">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <span className="text-sm font-medium">Documento generado correctamente</span>
            </div>

            <div className="border border-[var(--g-border-subtle)] rounded-lg p-4 bg-[var(--g-surface-subtle)]">
              <h3 className="text-sm font-semibold text-[var(--g-text-primary)] mb-3 flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Firma Cualificada (QES)
              </h3>

              {signingStatus === "idle" && (
                <>
                  <p className="text-xs text-[var(--g-text-secondary)] mb-4">
                    El documento se ha generado exitosamente. Puede firmarlo ahora con certificado cualificado (QES) a través del QTSP EAD Trust.
                  </p>
                  <button
                    type="button"
                    onClick={handleSignQES}
                    disabled={signMutation.isPending}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium border border-[var(--g-border-subtle)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] transition-colors disabled:opacity-50"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                    aria-busy={signMutation.isPending}
                  >
                    <Lock className="h-4 w-4" />
                    Firmar con QES
                  </button>
                </>
              )}

              {signingStatus === "pending" && (
                <div className="flex items-center justify-center gap-2 py-4 text-sm text-[var(--g-text-secondary)]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Firmando documento...
                </div>
              )}

              {signingStatus === "signed" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-3 py-2 bg-[var(--status-success)]/10 text-[var(--status-success)] rounded">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm font-medium">Documento firmado correctamente</span>
                  </div>
                  <p className="text-xs text-[var(--g-text-secondary)]">
                    La firma QES se ha aplicado al documento. El certificado está disponible en el expediente.
                  </p>
                </div>
              )}

              {signingStatus === "error" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-3 py-2 bg-[var(--status-error)]/10 text-[var(--status-error)] rounded">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm font-medium">Error al firmar</span>
                  </div>
                  <p className="text-xs text-[var(--status-error)]">{signingError}</p>
                  <button
                    type="button"
                    onClick={() => setSigningStatus("idle")}
                    className="text-xs text-[var(--g-brand-3308)] hover:underline"
                  >
                    Reintentar
                  </button>
                </div>
              )}
            </div>

            <div className="border border-[var(--g-border-subtle)] rounded-lg p-4 bg-[var(--g-surface-subtle)]">
              <h3 className="text-sm font-semibold text-[var(--g-text-primary)] mb-3 flex items-center gap-2">
                <FileCheck2 className="h-4 w-4" />
                Archivar en Supabase Storage
              </h3>

              {archiveStatus === "idle" && (
                <>
                  <p className="text-xs text-[var(--g-text-secondary)] mb-4">
                    Guarde el documento de forma segura en Supabase Storage con hash SHA-512 para verificación futura.
                  </p>
                  <button
                    type="button"
                    onClick={handleArchive}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium border border-[var(--g-border-subtle)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] transition-colors"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    <FileCheck2 className="h-4 w-4" />
                    Archivar documento
                  </button>
                </>
              )}

              {archiveStatus === "archiving" && (
                <div className="flex items-center justify-center gap-2 py-4 text-sm text-[var(--g-text-secondary)]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Archivando documento...
                </div>
              )}

              {archiveStatus === "archived" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-3 py-2 bg-[var(--status-success)]/10 text-[var(--status-success)] rounded">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm font-medium">Documento archivado correctamente</span>
                  </div>
                  {archiveUrl && (
                    <p className="text-xs text-[var(--g-text-secondary)]">
                      Disponible en:{" "}
                      <a
                        href={archiveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--g-brand-3308)] hover:underline"
                      >
                        Descargar desde Storage
                      </a>
                    </p>
                  )}
                  <span
                    className="inline-block px-2 py-1 text-[10px] font-semibold bg-[var(--status-success)] text-[var(--g-text-inverse)]"
                    style={{ borderRadius: "var(--g-radius-full)" }}
                  >
                    Archivado
                  </span>
                  {/* Verificador Offline HTML — GAS spec item */}
                  <button
                    type="button"
                    onClick={() => {
                      const artifact: EvidenceArtifact = {
                        type: "PLANTILLA_SNAPSHOT",
                        ref: archiveUrl ?? selectedPlantilla?.tipo ?? "doc",
                        hash: contentHash ?? "",
                        timestamp: new Date().toISOString(),
                        metadata: {
                          templateTipo: selectedPlantilla?.tipo,
                          templateVersion: selectedPlantilla?.version,
                        },
                      };
                      const manifest: EvidenceManifest = {
                        version: "1.0.0",
                        agreement_id: agreement?.id ?? "",
                        generated_at: new Date().toISOString(),
                        artifacts: [artifact],
                        artifact_count: 1,
                        manifest_hash: contentHash ?? "",
                      };
                      const html = generarVerificadorOffline(manifest);
                      const blob = new Blob([html], { type: "text/html" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `verificador_${agreement?.id?.slice(0, 8) ?? "doc"}.html`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    }}
                    className="inline-flex items-center gap-2 border border-[var(--g-border-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] transition-colors"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    <Shield className="h-3.5 w-3.5 text-[var(--g-brand-3308)]" />
                    Descargar verificador offline
                  </button>
                </div>
              )}

              {archiveStatus === "error" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-3 py-2 bg-[var(--status-error)]/10 text-[var(--status-error)] rounded">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm font-medium">Error al archivar</span>
                  </div>
                  <p className="text-xs text-[var(--status-error)]">{archiveError}</p>
                  <button
                    type="button"
                    onClick={() => setArchiveStatus("idle")}
                    className="text-xs text-[var(--g-brand-3308)] hover:underline"
                  >
                    Reintentar
                  </button>
                </div>
              )}
            </div>

            <div className="flex justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setStep(0);
                  setGenerated(false);
                  setRenderedText("");
                  setCapa3Values({});
                  setSelectedPlantilla(null);
                  setSigningStatus("idle");
                  setArchiveStatus("idle");
                  setArchiveUrl(null);
                  setArchiveError(null);
                  setDocxBuffer(null);
                }}
                className="flex items-center gap-1.5 px-4 py-2 text-sm border border-[var(--g-border-subtle)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] transition-colors"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                Generar otro
              </button>
              <button
                type="button"
                onClick={() => navigate(`/secretaria/acuerdos/${id}`)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] transition-colors"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <Shield className="h-3.5 w-3.5" />
                Volver al expediente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
