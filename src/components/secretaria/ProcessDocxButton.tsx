import { useMemo, useState } from "react";
import { Download, FileText, Loader2, Save, ShieldCheck, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { usePlantillasProtegidas } from "@/hooks/usePlantillasProtegidas";
import { DocumentPreflightError, resolveProcessTemplateSelection } from "@/lib/doc-gen/process-documents";
import type { ProcessDocumentGenerationInput } from "@/lib/doc-gen/process-documents";
import {
  buildCapa3AiAllowedFields,
  finalizeProcessDocumentDraftWithMotor,
  formatEditableDraftDiffSummary,
  generateProcessDocxWithMotor,
  loadLatestEditableDocumentDraft,
  prepareProcessDocumentDraftWithMotor,
  saveEditableDocumentDraft,
  summarizeEditableDraftDiff,
  suggestActaDraftPolishWithCapa3CopilotFallback,
  suggestCapa3DraftWithOpenAIFallback,
  type ActaDraftPolishResult,
  type PreparedProcessDocumentDraft,
} from "@/lib/motor-plantillas";
import { actaLegalStructureFromVariables } from "@/lib/secretaria/acta-legal-structure";
import { useTenantContext } from "@/context/TenantContext";
import { validateCapa3 } from "@/lib/secretaria/capa3-form-validation";
import type { Capa3Values } from "@/lib/secretaria/capa3-fields";
import { Capa3CaptureDialog } from "./Capa3CaptureDialog";
import { withLegalTeamTemplateFixtures } from "@/lib/secretaria/legal-template-fixtures";
import { resolveTemplateProcessMatrix } from "@/lib/secretaria/template-process-matrix";
import {
  resolveAgreementDocumentTrace,
  resolveDocumentEvidencePosture,
} from "@/lib/secretaria/agreement-document-contract";

type ProcessDocxButtonInput = Omit<ProcessDocumentGenerationInput, "plantillas">;

interface ProcessDocxButtonProps {
  input: ProcessDocxButtonInput;
  label?: string;
  variant?: "primary" | "outline" | "ghost";
  className?: string;
  disabledReason?: string | null;
}

const VARIANT_CLASS = {
  primary: "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)]",
  outline: "border border-[var(--g-border-subtle)] bg-transparent text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]",
  ghost: "text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]",
};

const ARCHIVE_REASON_LABEL: Record<string, string> = {
  agreement_context_not_available: "No hay expediente/acuerdo vinculado para archivar evidencia demo/operativa.",
  tenant_context_not_available: "No hay contexto de tenant para archivar evidencia demo/operativa.",
  archive_failed: "El archivo no se pudo archivar como evidencia demo/operativa.",
  minute_without_meeting: "El acta no tiene reunión vinculada para resolver acuerdos.",
  certification_not_found: "No se encontró la certificación vinculada.",
};

const DRAFT_PERSISTENCE_STATUS_LABEL: Record<"idle" | "saving" | "saved" | "dirty" | "blocked" | "error", string> = {
  idle: "sin cambios",
  saving: "guardando",
  saved: "guardado",
  dirty: "pendiente de guardar",
  blocked: "bloqueado",
  error: "error",
};

export function ProcessDocxButton({
  input,
  label = "Generar DOCX",
  variant = "outline",
  className = "",
  disabledReason = null,
}: ProcessDocxButtonProps) {
  const { data: plantillas = [], isLoading } = usePlantillasProtegidas();
  const { tenantId } = useTenantContext();
  const [generating, setGenerating] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [capa3Values, setCapa3Values] = useState<Capa3Values>({});
  const [capa3Errors, setCapa3Errors] = useState<Record<string, string>>({});
  const [draftAssistLoading, setDraftAssistLoading] = useState(false);
  const [draftAssistSummary, setDraftAssistSummary] = useState<string | null>(null);
  const [draftAssistApplied, setDraftAssistApplied] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [preparedProcessDraft, setPreparedProcessDraft] = useState<PreparedProcessDocumentDraft | null>(null);
  const [composerDraftText, setComposerDraftText] = useState("");
  const [editableDraftText, setEditableDraftText] = useState("");
  const [draftCloudId, setDraftCloudId] = useState<string | null>(null);
  const [draftPersistenceMessage, setDraftPersistenceMessage] = useState<string | null>(null);
  const [draftPersistenceStatus, setDraftPersistenceStatus] = useState<"idle" | "saving" | "saved" | "dirty" | "blocked" | "error">("idle");
  const [polishLoading, setPolishLoading] = useState(false);
  const [polishResult, setPolishResult] = useState<ActaDraftPolishResult | null>(null);
  const [polishMessage, setPolishMessage] = useState<string | null>(null);

  const plantillasForGeneration = useMemo(
    () => withLegalTeamTemplateFixtures(plantillas),
    [plantillas],
  );

  const templateSelection = useMemo(
    () =>
      resolveProcessTemplateSelection(
        plantillasForGeneration,
        input.templateTypes,
        input.templateCriteria ?? {},
        input.preferredTemplateId,
      ),
    [input.preferredTemplateId, input.templateCriteria, input.templateTypes, plantillasForGeneration],
  );
  const selectedTemplate = templateSelection.selected;

  const matrixResolution = useMemo(
    () => resolveTemplateProcessMatrix(selectedTemplate, {
      processHint: input.kind,
      variables: input.variables,
      capa3Values: input.capa3Values,
    }),
    [input.capa3Values, input.kind, input.variables, selectedTemplate],
  );
  const capa3Fields = matrixResolution?.capa3Fields ?? [];
  const evidencePosture = useMemo(() => {
    const archiveOptions = input.archive && typeof input.archive === "object" ? input.archive : {};
    const trace = resolveAgreementDocumentTrace({
      kind: input.kind,
      recordId: input.recordId,
      templateTypes: input.templateTypes,
      explicitAgreementIds: [
        archiveOptions.agreementId,
        ...(archiveOptions.agreementIds ?? []),
      ],
      variables: input.variables,
    });
    return resolveDocumentEvidencePosture(trace);
  }, [input.archive, input.kind, input.recordId, input.templateTypes, input.variables]);
  const effectiveDisabledReason =
    disabledReason ??
    (isLoading
      ? "Cargando plantillas documentales aplicables."
      : generating
      ? "Generando documento Word."
      : null);
  const isActaReviewFlow = input.kind === "ACTA";
  const diffSummary = useMemo(
    () => summarizeEditableDraftDiff(composerDraftText, editableDraftText),
    [composerDraftText, editableDraftText],
  );

  async function persistReviewDraft(
    draft: PreparedProcessDocumentDraft,
    bodyText: string,
    draftState: "EDITABLE_DRAFT" | "DRAFT_CONFIGURED",
    contentHashSha256?: string | null,
  ) {
    setDraftPersistenceStatus("saving");
    setDraftPersistenceMessage(
      draftState === "DRAFT_CONFIGURED"
        ? "Guardando acta final revisada en Cloud..."
        : "Guardando borrador compuesto en Cloud...",
    );
    const diff = summarizeEditableDraftDiff(draft.prepared.renderedBodyText, bodyText);
    const composerDraft = draft.prepared.mergedVariables.document_composer_draft;
    const result = await saveEditableDocumentDraft({
      prepared: draft.prepared,
      renderedBodyText: bodyText,
      draftState,
      contentHashSha256,
      metadata: {
        document_composer: composerDraft && typeof composerDraft === "object" ? composerDraft as Record<string, unknown> : null,
        ai_polish: polishResult
          ? {
              mode: polishResult.mode,
              modelName: polishResult.modelName,
              promptVersion: polishResult.promptVersion,
              proposals: polishResult.proposals,
              appliedProposals: polishResult.appliedProposals,
              skippedProposals: polishResult.skippedProposals,
              validation: polishResult.validation,
              summary: polishResult.summary,
            }
          : null,
        human_review_required: true,
        secretary_review_diff: diff,
      },
    });

    if (result.ok) {
      setDraftPersistenceStatus("saved");
      setDraftCloudId(result.draft?.id ?? null);
      setDraftPersistenceMessage(
        draftState === "DRAFT_CONFIGURED"
          ? "Acta final revisada guardada en Cloud."
          : "Borrador compuesto guardado en Cloud.",
      );
      return true;
    }

    const missing = result.schemaGate.missing.slice(0, 6).join(", ");
    setDraftCloudId(null);
    if (!result.schemaGate.supported && result.schemaGate.missing.length > 0) {
      setDraftPersistenceStatus("blocked");
      setDraftPersistenceMessage(
        `Persistencia Cloud no disponible: falta ${result.schemaGate.table} (${missing}).`,
      );
      return false;
    }

    setDraftPersistenceStatus("error");
    setDraftPersistenceMessage(result.error ?? "No se pudo guardar el borrador en Cloud.");
    return false;
  }

  async function prepareActaReviewDraft(nextCapa3Values: Capa3Values = {}) {
    setGenerating(true);
    try {
      const mergedCapa3Values = {
        ...(input.capa3Values ?? {}),
        ...nextCapa3Values,
      };
      const resolved = resolveTemplateProcessMatrix(selectedTemplate, {
        processHint: input.kind,
        variables: input.variables,
        capa3Values: mergedCapa3Values,
      });
      const normalizedCapa3Values = resolved?.capa3Draft.values ?? mergedCapa3Values;
      const draft = await prepareProcessDocumentDraftWithMotor({
        ...input,
        tenantId,
        plantillas: plantillasForGeneration,
        variables: {
          ...(resolved?.variables ?? {}),
          ...(input.variables ?? {}),
        },
        capa3Values: normalizedCapa3Values,
        aiAssist: draftAssistApplied
          ? { enabled: true, allowed_fields: buildCapa3AiAllowedFields(capa3Fields) }
          : null,
      });

      setPreparedProcessDraft(draft);
      setComposerDraftText(draft.prepared.renderedBodyText);
      setEditableDraftText(draft.prepared.renderedBodyText);
      setDraftCloudId(null);
      setPolishResult(null);
      setPolishMessage(null);
      setDraftPersistenceStatus("saving");
      setDraftPersistenceMessage("Comprobando borrador Cloud...");

      const existingDraft = await loadLatestEditableDocumentDraft({ prepared: draft.prepared });
      if (existingDraft.ok && existingDraft.draft) {
        setEditableDraftText(existingDraft.draft.rendered_body_text);
        setDraftCloudId(existingDraft.draft.id);
        setDraftPersistenceStatus("saved");
        setDraftPersistenceMessage("Borrador Cloud recuperado.");
      } else if (!existingDraft.ok) {
        const missing = existingDraft.schemaGate.missing.slice(0, 6).join(", ");
        setDraftPersistenceStatus(existingDraft.schemaGate.supported ? "error" : "blocked");
        setDraftPersistenceMessage(
          existingDraft.schemaGate.supported
            ? existingDraft.error ?? "No se pudo consultar el borrador Cloud."
            : `Persistencia Cloud no disponible: falta ${existingDraft.schemaGate.table} (${missing}).`,
        );
      } else {
        await persistReviewDraft(draft, draft.prepared.renderedBodyText, "EDITABLE_DRAFT");
      }

      setReviewOpen(true);
      return true;
    } catch (error) {
      const description = error instanceof Error ? error.message : "Inténtelo de nuevo.";
      toast.error("No se pudo preparar el borrador del acta", { description });
      return false;
    } finally {
      setGenerating(false);
    }
  }

  async function runGenerate(nextCapa3Values: Capa3Values = {}) {
    if (isActaReviewFlow) {
      return prepareActaReviewDraft(nextCapa3Values);
    }

    setGenerating(true);
    try {
      const mergedCapa3Values = {
        ...(input.capa3Values ?? {}),
        ...nextCapa3Values,
      };
      const resolved = resolveTemplateProcessMatrix(selectedTemplate, {
        processHint: input.kind,
        variables: input.variables,
        capa3Values: mergedCapa3Values,
      });
      const normalizedCapa3Values = resolved?.capa3Draft.values ?? mergedCapa3Values;
      const result = await generateProcessDocxWithMotor({
        ...input,
        tenantId,
        plantillas: plantillasForGeneration,
        variables: {
          ...(resolved?.variables ?? {}),
          ...(input.variables ?? {}),
        },
        capa3Values: normalizedCapa3Values,
        aiAssist: draftAssistApplied
          ? { enabled: true, allowed_fields: buildCapa3AiAllowedFields(capa3Fields) }
          : null,
      });
      if (result.archive.archived) {
        if (result.archive.reused) {
          toast.success("Documento existente reutilizado por hash coincidente", {
            description: `${result.evidencePosture.label} · hash ${result.contentHash.slice(0, 12)}`,
          });
          return true;
        }
        toast.success("Documento Word generado y archivado como evidencia demo/operativa", {
          description: `${result.evidencePosture.label} · no evidencia final productiva · hash ${result.contentHash.slice(0, 12)}`,
        });
        return true;
      }

      const skippedReason = result.archive.skippedReason;
      if (skippedReason && skippedReason !== "archive_disabled") {
        toast.warning("Documento Word generado sin evidencia final productiva", {
          description:
            result.archive.errors[0] ??
            ARCHIVE_REASON_LABEL[skippedReason] ??
            result.evidencePosture.reason,
        });
        return true;
      }

      toast.success("Documento Word generado", {
        description: result.usedFallback
          ? "Generado con plantilla tecnica del sistema."
          : `${result.templateTipo} v${result.templateVersion} · hash ${result.contentHash.slice(0, 12)}`,
      });
      return true;
    } catch (error) {
      if (error instanceof DocumentPreflightError) {
        toast.error("Faltan variables obligatorias", {
          description: error.blockingVariables.slice(0, 4).join(", "),
        });
        return false;
      }
      const description = error instanceof Error ? error.message : "Inténtelo de nuevo.";
      toast.error("No se pudo generar el documento", { description });
      return false;
    } finally {
      setGenerating(false);
    }
  }

  async function handleGenerate() {
    if (capa3Fields.length > 0) {
      const initialValues = matrixResolution?.initialCapa3Values ?? {};
      const errors = validateCapa3(capa3Fields, initialValues);
      if (Object.keys(errors).length === 0) {
        await runGenerate(initialValues);
        return;
      }

      setCapa3Values(initialValues);
      setCapa3Errors({});
      setDraftAssistSummary(null);
      setDraftAssistApplied(false);
      setCaptureOpen(true);
      return;
    }
    await runGenerate();
  }

  async function handleDraftAssist() {
    setDraftAssistLoading(true);
    try {
      const resolved = resolveTemplateProcessMatrix(selectedTemplate, {
        processHint: input.kind,
        variables: input.variables,
        capa3Values,
      });
      const result = await suggestCapa3DraftWithOpenAIFallback({
        fields: capa3Fields,
        currentValues: capa3Values,
        baseVariables: {
          ...(resolved?.variables ?? {}),
          ...(input.variables ?? {}),
        },
        documentType: input.kind,
        templateTipo: selectedTemplate?.tipo,
      });
      setCapa3Values(result.values);
      setDraftAssistApplied(result.suggestions.length > 0);
      setDraftAssistSummary(
        result.suggestions.length > 0
          ? `${result.suggestions.length} sugerencia(s) aplicadas · ${result.modelName} · revisión humana obligatoria.`
          : "No hay campos vacíos con contexto suficiente para sugerir.",
      );
      setCapa3Errors({});
    } finally {
      setDraftAssistLoading(false);
    }
  }

  async function handleGenerateWithCapa3() {
    const resolved = resolveTemplateProcessMatrix(selectedTemplate, {
      processHint: input.kind,
      variables: input.variables,
      capa3Values,
    });
    const normalizedCapa3Values = resolved?.capa3Draft.values ?? {
      ...(matrixResolution?.initialCapa3Values ?? {}),
      ...capa3Values,
    };
    const errors = validateCapa3(capa3Fields, normalizedCapa3Values);
    if (Object.keys(errors).length > 0) {
      setCapa3Errors(errors);
      return;
    }
    setCapa3Errors({});
    const ok = await runGenerate(normalizedCapa3Values);
    if (ok) setCaptureOpen(false);
  }

  async function handleSaveReviewDraft() {
    if (!preparedProcessDraft) return;
    await persistReviewDraft(preparedProcessDraft, editableDraftText, "EDITABLE_DRAFT");
  }

  async function handleFinalizeReviewedActa() {
    if (!preparedProcessDraft) return;
    setGenerating(true);
    try {
      const persisted = await persistReviewDraft(preparedProcessDraft, editableDraftText, "EDITABLE_DRAFT");
      if (!persisted) {
        toast.error("No se puede cerrar el acta hasta guardar el borrador revisado.");
        return;
      }

      const result = await finalizeProcessDocumentDraftWithMotor({
        draft: preparedProcessDraft,
        editedBodyText: editableDraftText,
      });
      await persistReviewDraft(preparedProcessDraft, result.composition.renderedBodyText, "DRAFT_CONFIGURED", result.contentHash);

      if (result.archive.archived) {
        if (result.archive.reused) {
          toast.success("Documento existente reutilizado por hash coincidente", {
            description: `${result.evidencePosture.label} · hash ${result.contentHash.slice(0, 12)}`,
          });
          setReviewOpen(false);
          return;
        }
        toast.success("Acta DOCX validada, generada y archivada", {
          description: `${result.evidencePosture.label} · estructura DOCX conforme · hash ${result.contentHash.slice(0, 12)}`,
        });
      } else {
        const skippedReason = result.archive.skippedReason;
        toast.success("Acta DOCX validada y generada", {
          description:
            skippedReason && skippedReason !== "archive_disabled"
              ? result.archive.errors[0] ?? ARCHIVE_REASON_LABEL[skippedReason] ?? "Archivado no completado."
              : `estructura DOCX conforme · hash ${result.contentHash.slice(0, 12)}`,
        });
      }
      setReviewOpen(false);
    } catch (error) {
      const description = error instanceof Error ? error.message : "Inténtelo de nuevo.";
      toast.error("No se pudo cerrar el acta DOCX", { description });
    } finally {
      setGenerating(false);
    }
  }

  async function handlePolishActaDraft() {
    if (!preparedProcessDraft) return;
    const actaLegalStructure = actaLegalStructureFromVariables(preparedProcessDraft.prepared.mergedVariables);
    if (!actaLegalStructure) {
      toast.error("No hay estructura legal del acta para gobernar el copiloto.");
      return;
    }

    setPolishLoading(true);
    setPolishMessage("Analizando el borrador con límites de redacción...");
    try {
      const result = await suggestActaDraftPolishWithCapa3CopilotFallback({
        text: editableDraftText,
        actaLegalStructure,
        maxProposals: 6,
      });
      setPolishResult(result);

      if (!result.validation.ok) {
        setPolishMessage("El copiloto propuso cambios no aplicables por afectar contenido protegido.");
        toast.warning("No se aplicaron cambios de redacción", {
          description: result.validation.issues[0]?.message ?? "La validación del acta bloqueó la propuesta.",
        });
        return;
      }

      if (result.appliedProposals.length === 0) {
        setPolishMessage(result.summary);
        toast.info("Sin mejoras aplicables", {
          description: result.summary,
        });
        return;
      }

      setEditableDraftText(result.proposedText);
      setDraftPersistenceStatus("dirty");
      setDraftPersistenceMessage("Cambios del copiloto pendientes de guardar y revisar.");
      setPolishMessage(
        `${result.appliedProposals.length} propuesta(s) aplicadas · ${result.modelName} · revisión humana obligatoria.`,
      );
      toast.success("Copiloto Capa 3 aplicado", {
        description: `${result.appliedProposals.length} propuesta(s); valida estructura legal antes del cierre.`,
      });
    } catch (error) {
      const description = error instanceof Error ? error.message : "Inténtelo de nuevo.";
      setPolishMessage(description);
      toast.error("No se pudo asistir la redacción", { description });
    } finally {
      setPolishLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleGenerate}
        disabled={isLoading || generating || !!disabledReason}
        aria-busy={generating}
        title={
          effectiveDisabledReason ??
          `${evidencePosture.label}: ${evidencePosture.reason}${
            templateSelection.selectionReason ? ` · Selección documental: ${templateSelection.selectionReason}` : ""
          }`
        }
        className={`inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASS[variant]} ${className}`}
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {isLoading ? "Cargando plantillas..." : generating ? "Generando..." : label}
      </button>
      {disabledReason ? (
        <p className="mt-1 max-w-[320px] text-xs leading-relaxed text-[var(--g-text-secondary)]">
          {disabledReason}
        </p>
      ) : null}

      <Capa3CaptureDialog
        open={captureOpen}
        subtitle={selectedTemplate ? `${selectedTemplate.tipo} · ${selectedTemplate.version}` : "Plantilla documental"}
        fields={capa3Fields}
        values={capa3Values}
        errors={capa3Errors}
        loading={generating}
        draftAssistLoading={draftAssistLoading}
        draftAssistSummary={draftAssistSummary}
        onDraftAssist={capa3Fields.length > 0 ? handleDraftAssist : undefined}
        submitLabel={isActaReviewFlow ? "Preparar borrador" : "Generar DOCX"}
        onChange={(values) => {
          setCapa3Values(values);
          setCapa3Errors({});
        }}
        onClose={() => setCaptureOpen(false)}
        onSubmit={handleGenerateWithCapa3}
      />

      {reviewOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--g-brand-3308)]/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="acta-review-title"
            className="max-h-[92vh] w-full max-w-[980px] overflow-hidden border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
            style={{ borderRadius: "var(--g-radius-xl)", boxShadow: "var(--g-shadow-modal)" }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--g-border-subtle)] px-5 py-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
                  <FileText className="h-3.5 w-3.5" />
                  Acta preparada para revisión
                </div>
                <h2 id="acta-review-title" className="mt-1 text-lg font-semibold text-[var(--g-text-primary)]">
                  Borrador compuesto del acta
                </h2>
                <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
                  El acta se compone desde el orden del día y queda pendiente de cierre por la Secretaría.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReviewOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
                aria-label="Cerrar revisión del acta"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid max-h-[68vh] grid-cols-1 gap-4 overflow-y-auto px-5 py-4 lg:grid-cols-[1fr_280px]">
              <div>
                <label htmlFor="acta-editable-draft" className="text-sm font-medium text-[var(--g-text-primary)]">
                  Texto del acta
                </label>
                <textarea
                  id="acta-editable-draft"
                  value={editableDraftText}
                  onChange={(event) => {
                    setEditableDraftText(event.target.value);
                    setDraftPersistenceStatus("dirty");
                    setDraftPersistenceMessage("Cambios pendientes de guardar.");
                  }}
                  className="mt-2 min-h-[460px] w-full resize-y border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 font-mono text-sm leading-relaxed text-[var(--g-text-primary)] outline-none focus:border-[var(--g-brand-3308)] focus:ring-2 focus:ring-[var(--g-brand-3308)]/20"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                  aria-describedby="acta-editable-draft-meta"
                />
                <div id="acta-editable-draft-meta" className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--g-text-secondary)]">
                  <span>{formatEditableDraftDiffSummary(diffSummary)}</span>
                  {draftCloudId ? <span className="font-mono">draft {draftCloudId.slice(0, 8)}</span> : null}
                </div>
              </div>

              <aside className="space-y-3">
                <div
                  className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] p-3 text-xs text-[var(--g-text-secondary)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <div className="flex items-center gap-2 font-semibold text-[var(--g-brand-3308)]">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Validación antes de firma
                  </div>
                  <p className="mt-2">
                    El DOCX final se valida contra la estructura del acta, el orden del día, las secciones RRM y el hash canónico antes de quedar disponible.
                  </p>
                </div>

                <div
                  className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-3 text-xs text-[var(--g-text-secondary)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-[var(--g-text-primary)]">Copiloto Capa 3</p>
                    <button
                      type="button"
                      onClick={handlePolishActaDraft}
                      disabled={!preparedProcessDraft || polishLoading || generating || !editableDraftText.trim()}
                      aria-busy={polishLoading}
                      className="inline-flex items-center gap-1.5 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-2.5 py-1.5 text-xs font-medium text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)] disabled:opacity-50"
                      style={{ borderRadius: "var(--g-radius-md)" }}
                    >
                      {polishLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      {polishLoading ? "Asistiendo..." : "Asistir redacción"}
                    </button>
                  </div>
                  <p className="mt-2">
                    Asiste campos editables y pulido narrativo del acta sin tocar hechos jurídicos. Secretaría decide si conserva los cambios.
                  </p>
                  {polishMessage ? (
                    <p className="mt-2 text-[var(--g-brand-3308)]">{polishMessage}</p>
                  ) : null}
                  {polishResult?.skippedProposals.length ? (
                    <p className="mt-2 text-[var(--status-warning)]">
                      {polishResult.skippedProposals.length} propuesta(s) bloqueada(s) por protección del acta.
                    </p>
                  ) : null}
                </div>

                <div
                  className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-3 text-xs text-[var(--g-text-secondary)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <p className="font-semibold text-[var(--g-text-primary)]">Persistencia</p>
                  <p className="mt-1">
                    {draftPersistenceMessage ?? "Sin cambios pendientes."}
                  </p>
                  <p className="mt-1">
                    Estado: {DRAFT_PERSISTENCE_STATUS_LABEL[draftPersistenceStatus]}
                  </p>
                </div>

                <div
                  className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-3 text-xs text-[var(--g-text-secondary)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <p className="font-semibold text-[var(--g-text-primary)]">Cambios de la Secretaría</p>
                  {diffSummary.preview.length > 0 ? (
                    <pre className="mt-2 max-h-[180px] overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-[var(--g-text-secondary)]">
                      {diffSummary.preview.join("\n")}
                    </pre>
                  ) : (
                    <p className="mt-1">El texto coincide con el borrador compuesto.</p>
                  )}
                </div>
              </aside>
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--g-border-subtle)] px-5 py-4">
              <button
                type="button"
                onClick={() => setReviewOpen(false)}
                className="border border-[var(--g-border-subtle)] px-4 py-2 text-sm font-medium text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveReviewDraft}
                disabled={!preparedProcessDraft || generating || draftPersistenceStatus === "saving"}
                aria-busy={draftPersistenceStatus === "saving"}
                className="inline-flex items-center gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-4 py-2 text-sm font-medium text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)] disabled:opacity-50"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                {draftPersistenceStatus === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Guardar borrador
              </button>
              <button
                type="button"
                onClick={handleFinalizeReviewedActa}
                disabled={!preparedProcessDraft || generating || !editableDraftText.trim() || draftPersistenceStatus === "blocked"}
                aria-busy={generating}
                className="inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] disabled:opacity-50"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {generating ? "Validando..." : "Cerrar y generar DOCX"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
