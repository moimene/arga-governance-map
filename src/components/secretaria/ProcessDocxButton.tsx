import { useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { usePlantillasProtegidas } from "@/hooks/usePlantillasProtegidas";
import { DocumentPreflightError, selectProcessTemplate } from "@/lib/doc-gen/process-documents";
import type { ProcessDocumentGenerationInput } from "@/lib/doc-gen/process-documents";
import {
  buildCapa3AiAllowedFields,
  generateProcessDocxWithMotor,
  suggestCapa3DraftWithAnthropicFallback,
} from "@/lib/motor-plantillas";
import { useTenantContext } from "@/context/TenantContext";
import { validateCapa3 } from "./Capa3Form";
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
  const [capa3Values, setCapa3Values] = useState<Record<string, string>>({});
  const [capa3Errors, setCapa3Errors] = useState<Record<string, string>>({});
  const [draftAssistLoading, setDraftAssistLoading] = useState(false);
  const [draftAssistSummary, setDraftAssistSummary] = useState<string | null>(null);
  const [draftAssistApplied, setDraftAssistApplied] = useState(false);

  const plantillasForGeneration = useMemo(
    () => withLegalTeamTemplateFixtures(plantillas),
    [plantillas],
  );

  const selectedTemplate = useMemo(
    () =>
      selectProcessTemplate(
        plantillasForGeneration,
        input.templateTypes,
        input.templateCriteria ?? {},
        input.preferredTemplateId,
      ),
    [input.preferredTemplateId, input.templateCriteria, input.templateTypes, plantillasForGeneration],
  );

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

  async function runGenerate(nextCapa3Values: Record<string, string> = {}) {
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
      setCapa3Values(matrixResolution?.initialCapa3Values ?? {});
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
      const result = await suggestCapa3DraftWithAnthropicFallback({
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

  return (
    <>
      <button
        type="button"
        onClick={handleGenerate}
        disabled={isLoading || generating || !!disabledReason}
        aria-busy={generating}
        title={effectiveDisabledReason ?? `${evidencePosture.label}: ${evidencePosture.reason}`}
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
        onChange={(values) => {
          setCapa3Values(values);
          setCapa3Errors({});
        }}
        onClose={() => setCaptureOpen(false)}
        onSubmit={handleGenerateWithCapa3}
      />
    </>
  );
}
