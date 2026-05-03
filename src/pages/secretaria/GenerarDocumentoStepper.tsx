/**
 * GenerarDocumentoStepper — 5-step wizard for document generation
 *
 * Flow: Select plantilla → Review variables → Fill capa3 → Editable draft → Generate
 *
 * Route: /secretaria/acuerdos/:id/generar
 */

import { useState, useMemo, useCallback, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  FileCheck2,
  FileText,
  Edit3,
  Eye,
  Download,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Shield,
  Lock,
  Sparkles,
  Save,
  CloudOff,
} from "lucide-react";
import { useAgreement } from "@/hooks/useAgreementCompliance";
import { useAgreementNormativeSnapshot } from "@/hooks/useNormativeFramework";
import { usePlantillasProtegidas } from "@/hooks/usePlantillasProtegidas";
import type { PlantillaProtegidaRow } from "@/hooks/usePlantillasProtegidas";
import { useQTSPSign, type QESSignResult } from "@/hooks/useQTSPSign";
import { supabase } from "@/integrations/supabase/client";
import { Capa3Form, validateCapa3 } from "@/components/secretaria/Capa3Form";
import { resolveVariables } from "@/lib/doc-gen/variable-resolver";
import type { Capa2Variable, ResolverContext } from "@/lib/doc-gen/variable-resolver";
import { buildAgreementResolverContext } from "@/lib/doc-gen/resolver-context";
import { downloadDocx, printRenderedDocument } from "@/lib/doc-gen/docx-generator";
import { archiveDocxToStorage } from "@/lib/doc-gen/storage-archiver";
import { generarVerificadorOffline } from "@/lib/rules-engine";
import type { EvidenceManifest, EvidenceArtifact } from "@/lib/rules-engine";
import { useTenantContext } from "@/context/TenantContext";
import { useSecretariaScope } from "@/components/secretaria/shell";
import { normalizeCapa3Draft, normalizeCapa3Fields } from "@/lib/secretaria/capa3-fields";
import {
  buildSecretariaDocumentGenerationRequest,
  type SecretariaDocumentType,
} from "@/lib/secretaria/document-generation-boundary";
import {
  finalizeEditableDocumentDraft,
  prepareDocumentComposition,
  buildCapa3AiAllowedFields,
  loadLatestEditableDocumentDraft,
  saveEditableDocumentDraft,
  suggestCapa3DraftWithAnthropicFallback,
  type ComposeDocumentResult,
  type PreparedDocumentComposition,
  type SaveEditableDocumentDraftResult,
} from "@/lib/motor-plantillas";
import { isLegallyReviewedDraft, isOperationalTemplate } from "@/lib/doc-gen/template-operability";

// ── Step definitions ─────────────────────────────────────────────────────────

const STEPS = [
  { key: "plantilla", label: "Plantilla", icon: FileCheck2 },
  { key: "variables", label: "Variables", icon: FileText },
  { key: "editables", label: "Editables", icon: Edit3 },
  { key: "borrador", label: "Borrador", icon: Eye },
  { key: "generar", label: "Generar", icon: Download },
] as const;

type DraftPersistenceStatus = "idle" | "saving" | "saved" | "dirty" | "blocked" | "error";

function hasResolvedValue(value: unknown) {
  if (value === undefined || value === null) return false;
  if (typeof value === "string" && value.trim() === "") return false;
  return true;
}

function inferDocumentTypeForComposer(
  plantilla: PlantillaProtegidaRow,
  adoptionMode?: string | null,
): SecretariaDocumentType {
  const tipo = plantilla.tipo;
  const mode = adoptionMode?.toUpperCase() ?? "";
  if (tipo === "ACTA_ACUERDO_ESCRITO" || mode === "NO_SESSION" || mode === "CO_APROBACION" || mode === "SOLIDARIO") {
    return "ACUERDO_SIN_SESION";
  }
  if (tipo === "ACTA_CONSIGNACION" || mode.startsWith("UNIPERSONAL")) {
    return "DECISION_UNIPERSONAL";
  }
  if (tipo === "INFORME_DOCUMENTAL_PRE") return "INFORME_DOCUMENTAL_PRE";
  if (tipo === "INFORME_PRECEPTIVO") return "INFORME_DOCUMENTAL_PRE";
  return "INFORME_DOCUMENTAL_PRE";
}

// ── Main component ───────────────────────────────────────────────────────────

export default function GenerarDocumentoStepper() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const scope = useSecretariaScope();
  const { tenantId } = useTenantContext();
  const qc = useQueryClient();
  const { data: agreement, isLoading: agreementLoading } = useAgreement(id);
  const { data: normativeSnapshot } = useAgreementNormativeSnapshot(agreement);
  const { data: plantillas = [], isLoading: plantillasLoading } = usePlantillasProtegidas();
  const requestedPlantillaId = searchParams.get("plantilla");

  const [step, setStep] = useState(0);
  const [selectedPlantilla, setSelectedPlantilla] = useState<PlantillaProtegidaRow | null>(null);
  const [resolvedVars, setResolvedVars] = useState<Record<string, unknown>>({});
  const [unresolvedVars, setUnresolvedVars] = useState<string[]>([]);
  const [capa3Values, setCapa3Values] = useState<Record<string, string>>({});
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
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
  const [documentActionError, setDocumentActionError] = useState<string | null>(null);
  const [docxBuffer, setDocxBuffer] = useState<Uint8Array | null>(null);
  const [qesResult, setQesResult] = useState<QESSignResult | null>(null);
  const [capa3Errors, setCapa3Errors] = useState<Record<string, string>>({});
  const [preparedDraft, setPreparedDraft] = useState<PreparedDocumentComposition | null>(null);
  const [editableDraftText, setEditableDraftText] = useState("");
  const [draftPersistenceStatus, setDraftPersistenceStatus] = useState<DraftPersistenceStatus>("idle");
  const [draftPersistenceMessage, setDraftPersistenceMessage] = useState<string | null>(null);
  const [draftCloudId, setDraftCloudId] = useState<string | null>(null);
  const [compositionResult, setCompositionResult] = useState<ComposeDocumentResult | null>(null);
  const [isDraftingCapa3, setIsDraftingCapa3] = useState(false);
  const [capa3AssistantSummary, setCapa3AssistantSummary] = useState<string | null>(null);
  const [capa3AssistantApplied, setCapa3AssistantApplied] = useState(false);

  const { signMutation } = useQTSPSign();
  const expedientePath = scope.createScopedTo(`/secretaria/acuerdos/${id}`);
  const missingRequiredCapa2 = useMemo(() => {
    if (!selectedPlantilla) return [];
    return (selectedPlantilla.capa2_variables ?? [])
      .filter((variable) => variable.fuente !== "USUARIO")
      .map((variable) => variable.variable)
      .filter((variable) => !hasResolvedValue(resolvedVars[variable]));
  }, [resolvedVars, selectedPlantilla]);

  // Filter plantillas compatible with this agreement
  const compatiblePlantillas = useMemo(() => {
    if (!agreement) return [];
    const agreementJurisdiction = agreement.entities?.jurisdiction ?? "ES";
    return plantillas.filter((p) => {
      const templateJurisdiction = p.jurisdiccion?.toUpperCase();
      const jurisdiccionOk =
        !templateJurisdiction ||
        templateJurisdiction === "GLOBAL" ||
        templateJurisdiction === "MULTI" ||
        templateJurisdiction === agreementJurisdiction.toUpperCase();
      const materiaOk =
        !p.materia_acuerdo ||
        p.materia_acuerdo === agreement.agreement_kind ||
        p.materia_acuerdo === agreement.matter_class;
      const adoptionOk =
        !p.adoption_mode || p.adoption_mode === agreement.adoption_mode;
      const organoOk =
        !p.organo_tipo ||
        !agreement.governing_bodies?.body_type ||
        p.organo_tipo === agreement.governing_bodies.body_type;
      return isOperationalTemplate(p) && jurisdiccionOk && materiaOk && adoptionOk && organoOk;
    });
  }, [plantillas, agreement]);
  const requestedPlantilla = useMemo(
    () => compatiblePlantillas.find((plantilla) => plantilla.id === requestedPlantillaId) ?? null,
    [compatiblePlantillas, requestedPlantillaId],
  );
  const normalizedCapa3Fields = useMemo(
    () => normalizeCapa3Fields(selectedPlantilla?.capa3_editables),
    [selectedPlantilla?.capa3_editables],
  );
  const normalizedCapa3Values = useMemo(
    () => normalizeCapa3Draft(normalizedCapa3Fields, capa3Values).values,
    [capa3Values, normalizedCapa3Fields],
  );
  const editableDraftLength = useMemo(
    () => editableDraftText.trim().length,
    [editableDraftText],
  );

  const buildComposerRequest = useCallback(
    async (plantilla: PlantillaProtegidaRow) => {
      if (!agreement || !tenantId) throw new Error("No hay acuerdo o tenant para componer el documento.");
      const documentType = inferDocumentTypeForComposer(plantilla, agreement.adoption_mode);
      return buildSecretariaDocumentGenerationRequest({
        documentType,
        tenantId,
        entityId: agreement.entity_id,
        agreementIds: [agreement.id],
        templateId: plantilla.id,
        expectedAdoptionMode: agreement.adoption_mode as Parameters<typeof buildSecretariaDocumentGenerationRequest>[0]["expectedAdoptionMode"],
        aiAssist: capa3AssistantApplied
          ? { enabled: true, allowed_fields: buildCapa3AiAllowedFields(normalizedCapa3Fields) }
          : null,
      });
    },
    [agreement, capa3AssistantApplied, normalizedCapa3Fields, tenantId],
  );

  const applyDraftPersistenceResult = useCallback(
    (result: SaveEditableDocumentDraftResult, successMessage: string) => {
      if (result.ok) {
        setDraftPersistenceStatus("saved");
        setDraftPersistenceMessage(successMessage);
        setDraftCloudId(result.draft?.id ?? null);
        return true;
      }

      const missing = result.schemaGate.missing.slice(0, 6).join(", ");
      if (!result.schemaGate.supported && result.schemaGate.missing.length > 0) {
        setDraftPersistenceStatus("blocked");
        setDraftCloudId(null);
        setDraftPersistenceMessage(
          `Persistencia Cloud no disponible: falta ${result.schemaGate.table} (${missing}).`,
        );
        return false;
      }

      setDraftPersistenceStatus("error");
      setDraftCloudId(null);
      setDraftPersistenceMessage(result.error ?? "No se pudo guardar el borrador en Cloud.");
      return false;
    },
    [],
  );

  const persistEditableDraft = useCallback(
    async (
      source: PreparedDocumentComposition,
      bodyText: string,
      draftState: "EDITABLE_DRAFT" | "DRAFT_CONFIGURED",
      contentHashSha256?: string | null,
    ) => {
      setDraftPersistenceStatus("saving");
      setDraftPersistenceMessage(
        draftState === "DRAFT_CONFIGURED"
          ? "Guardando borrador configurado en Cloud..."
          : "Guardando borrador editable en Cloud...",
      );
      const result = await saveEditableDocumentDraft({
        prepared: source,
        renderedBodyText: bodyText,
        draftState,
        contentHashSha256,
      });
      return applyDraftPersistenceResult(
        result,
        draftState === "DRAFT_CONFIGURED"
          ? "Borrador configurado guardado en Cloud."
          : "Borrador editable guardado en Cloud.",
      );
    },
    [applyDraftPersistenceResult],
  );

  // ── Step 1: Select plantilla ─────────────────────────────────────────────

  const handleSelectPlantilla = useCallback(
    async (plantilla: PlantillaProtegidaRow) => {
      setSelectedPlantilla(plantilla);
      setCompositionResult(null);
      setPreparedDraft(null);
      setEditableDraftText("");
      setDraftPersistenceStatus("idle");
      setDraftPersistenceMessage(null);
      setDraftCloudId(null);
      setDocxBuffer(null);
      setContentHash("");
      setCapa3AssistantSummary(null);
      setCapa3AssistantApplied(false);

      // Auto-resolve variables
      if (plantilla.capa2_variables && agreement) {
        setIsResolving(true);
        try {
          const context: ResolverContext = buildAgreementResolverContext(agreement, tenantId ?? "");
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
    [agreement, tenantId]
  );

  useEffect(() => {
    if (!requestedPlantillaId || !requestedPlantilla) return;
    if (selectedPlantilla?.id === requestedPlantillaId) return;
    void handleSelectPlantilla(requestedPlantilla);
  }, [handleSelectPlantilla, requestedPlantilla, requestedPlantillaId, selectedPlantilla?.id]);

  // ── Step 4: Render preview ───────────────────────────────────────────────

  const handleRenderPreview = useCallback(async () => {
    if (!selectedPlantilla?.capa1_inmutable) {
      setRenderError("La plantilla no tiene contenido capa1.");
      return;
    }

    try {
      const request = await buildComposerRequest(selectedPlantilla);
      const prepared = await prepareDocumentComposition(request, normalizedCapa3Values, {
        plantilla: selectedPlantilla,
        baseVariables: resolvedVars,
        normativeSnapshot,
      });
      setResolvedVars(prepared.capa2.values);
      setUnresolvedVars(Array.from(new Set([...prepared.capa2.unresolved, ...prepared.unresolvedVariables])));
      setPreparedDraft(prepared);
      setEditableDraftText(prepared.renderedBodyText);
      setRenderError(null);

      setDraftPersistenceStatus("saving");
      setDraftPersistenceMessage("Comprobando borrador Cloud...");
      const existingDraft = await loadLatestEditableDocumentDraft({ prepared });
      if (existingDraft.ok && existingDraft.draft) {
        setEditableDraftText(existingDraft.draft.rendered_body_text);
        setDraftPersistenceStatus("saved");
        setDraftCloudId(existingDraft.draft.id);
        setDraftPersistenceMessage("Borrador Cloud recuperado.");
      } else if (!existingDraft.ok) {
        const missing = existingDraft.schemaGate.missing.slice(0, 6).join(", ");
        setDraftPersistenceStatus(existingDraft.schemaGate.supported ? "error" : "blocked");
        setDraftCloudId(null);
        setDraftPersistenceMessage(
          existingDraft.schemaGate.supported
            ? existingDraft.error ?? "No se pudo consultar el borrador Cloud."
            : `Persistencia Cloud no disponible: falta ${existingDraft.schemaGate.table} (${missing}).`,
        );
      } else {
        await persistEditableDraft(prepared, prepared.renderedBodyText, "EDITABLE_DRAFT");
      }
    } catch (e) {
      setRenderError(e instanceof Error ? e.message : "Error al renderizar la plantilla.");
    }

    setStep(3);
  }, [selectedPlantilla, normalizedCapa3Values, buildComposerRequest, resolvedVars, normativeSnapshot, persistEditableDraft]);

  const handleDraftCapa3 = useCallback(async () => {
    if (!selectedPlantilla) return;
    setIsDraftingCapa3(true);
    try {
      const result = await suggestCapa3DraftWithAnthropicFallback({
        fields: normalizedCapa3Fields,
        currentValues: normalizedCapa3Values,
        baseVariables: {
          ...resolvedVars,
          agreement_id: agreement.id,
          entity_id: agreement.entity_id,
          denominacion_social: agreement.entities?.common_name ?? "",
          materia_acuerdo: agreement.agreement_kind,
          modo_adopcion: agreement.adoption_mode,
          contenido_acuerdo: agreement.decision_text ?? agreement.proposal_text ?? "",
          texto_decision: agreement.decision_text ?? agreement.proposal_text ?? "",
        },
        documentType: inferDocumentTypeForComposer(selectedPlantilla, agreement.adoption_mode),
        templateTipo: selectedPlantilla.tipo,
      });
      setCapa3Values(result.values);
      setPreparedDraft(null);
      setEditableDraftText("");
      setCompositionResult(null);
      setDocxBuffer(null);
      setContentHash("");
      setDraftPersistenceStatus("idle");
      setDraftPersistenceMessage(null);
      setDraftCloudId(null);
      setCapa3AssistantApplied(result.suggestions.length > 0);
      setCapa3AssistantSummary(
        result.suggestions.length > 0
          ? `${result.suggestions.length} sugerencia(s) aplicadas · ${result.modelName}.`
          : "No hay campos vacíos con contexto suficiente para sugerir.",
      );
      setCapa3Errors({});
    } finally {
      setIsDraftingCapa3(false);
    }
  }, [agreement, normalizedCapa3Fields, normalizedCapa3Values, resolvedVars, selectedPlantilla]);

  const handleSignQES = useCallback(async () => {
    if (!docxBuffer || !selectedPlantilla || !agreement) {
      setSigningError("Documento no generado aún");
      return;
    }
    setSigningStatus("pending");
    setSigningError(null);
    try {
      const result = await signMutation.mutateAsync({
        documentName: `${selectedPlantilla.tipo}_${agreement.id.slice(0, 8)}.docx`,
        documentData: docxBuffer.buffer.slice(docxBuffer.byteOffset, docxBuffer.byteOffset + docxBuffer.byteLength) as ArrayBuffer,
        signatories: [{ name: "Lucía Martín", email: "lucia.martin@arga-seguros.com", surnames: "Martín García", sequence: 1 }],
        createdBy: "secretaria-demo",
        agreementId: agreement.id,
        onProgress: () => {},
      });
      setQesResult(result);
      if (result.signedDocumentData) {
        setDocxBuffer(new Uint8Array(result.signedDocumentData));
      }
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
      const filename = (
        compositionResult?.document.filename ??
        `${selectedPlantilla?.tipo || "documento"}_${agreement.id.slice(0, 8)}_${new Date().toISOString().split("T")[0]}.docx`
      ).replace(/\.docx$/i, "");
      const archiveBuffer = qesResult?.signedDocumentData
        ? qesResult.signedDocumentData
        : docxBuffer.buffer.slice(docxBuffer.byteOffset, docxBuffer.byteOffset + docxBuffer.byteLength) as ArrayBuffer;
      const result = await archiveDocxToStorage(archiveBuffer, agreement.id, filename, tenantId ?? "", {
        processKind: compositionResult?.request.document_type ?? inferDocumentTypeForComposer(
          selectedPlantilla,
          agreement.adoption_mode,
        ),
        evidenceStatus: "DEMO_OPERATIVA",
        recordId: agreement.id,
        templateId: selectedPlantilla?.id ?? null,
        templateTipo: selectedPlantilla?.tipo,
        templateVersion: selectedPlantilla?.version,
        contentHash,
        signedBy: qesResult ? "EAD Trust" : undefined,
        qesSrId: qesResult?.srId,
        qesDocumentId: qesResult?.documentId,
        qesDocumentHash: qesResult?.documentHash,
        qesSignatoryIds: qesResult?.signatoryIds,
        qesSignedAt: qesResult?.signed_at,
        archivedBufferKind: qesResult?.signedDocumentData ? "QTSP_SIGNED_DOCX" : "ORIGINAL_DOCX",
        normativeSnapshotId: normativeSnapshot?.snapshot_id ?? null,
        normativeProfileId: normativeSnapshot?.profile_id ?? null,
        normativeProfileHash: normativeSnapshot?.profile_hash ?? null,
        normativeFrameworkStatus: normativeSnapshot?.framework_status ?? null,
        normativeSourceLayers: normativeSnapshot
          ? Array.from(new Set(normativeSnapshot.sources.map((source) => source.layer)))
          : [],
        formalizationRequirements: normativeSnapshot
          ? normativeSnapshot.formalization_requirements.map((item) => item.kind)
          : [],
      });

      if (result.ok) {
        const docUrl = result.documentUrl || null;
        setArchiveUrl(docUrl);
        setArchiveStatus("archived");
        // C5: write document_url back to the agreement record
        if (docUrl && agreement?.id && tenantId) {
          await supabase
            .from("agreements")
            .update({ document_url: docUrl })
            .eq("id", agreement.id)
            .eq("tenant_id", tenantId);
          qc.invalidateQueries({ queryKey: ["agreement", tenantId, agreement.id] });
        }
      } else {
        setArchiveError(result.error || "Error al archivar el documento");
        setArchiveStatus("error");
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Error desconocido al archivar";
      setArchiveError(errorMsg);
      setArchiveStatus("error");
    }
  }, [docxBuffer, agreement, selectedPlantilla, tenantId, qc, qesResult, contentHash, compositionResult, normativeSnapshot]);

  // ── Step 5: Configure draft and generate DOCX ───────────────────────────

  const handleGenerate = useCallback(async () => {
    if (!selectedPlantilla || !preparedDraft) return;

    setIsGenerating(true);
    try {
      const result = await finalizeEditableDocumentDraft(preparedDraft, editableDraftText, {
        plantilla: selectedPlantilla,
        baseVariables: resolvedVars,
        archiveDraft: false,
        normativeSnapshot,
      });
      const persisted = await persistEditableDraft(
        result,
        result.renderedBodyText,
        "DRAFT_CONFIGURED",
        result.contentHash,
      );
      if (!persisted) {
        setRenderError("No se puede configurar el DOCX hasta guardar el borrador en Cloud.");
        return;
      }

      setCompositionResult(result);
      setContentHash(result.contentHash);
      setDocxBuffer(result.docxBuffer);
      setDocumentActionError(null);
      setSigningStatus("idle");
      setSigningError(null);
      setQesResult(null);
      setArchiveStatus("idle");
      setArchiveUrl(null);
      setArchiveError(null);
      setStep(4);
    } catch (e) {
      setRenderError(e instanceof Error ? e.message : "Error al generar DOCX.");
    } finally {
      setIsGenerating(false);
    }
  }, [editableDraftText, persistEditableDraft, preparedDraft, resolvedVars, selectedPlantilla, normativeSnapshot]);

  const handleDownloadDocument = useCallback(() => {
    if (!docxBuffer || !compositionResult) {
      setDocumentActionError("Documento no generado aún.");
      return;
    }

    downloadDocx(docxBuffer, compositionResult.document.filename);
    setDocumentActionError(null);
  }, [docxBuffer, compositionResult]);

  const handlePrintDocument = useCallback(() => {
    if (!compositionResult) {
      setDocumentActionError("Documento no generado aún.");
      return;
    }

    try {
      printRenderedDocument({
        title: compositionResult.title,
        subtitle: agreement.entities?.name ?? undefined,
        renderedText: compositionResult.document.renderedText,
        filename: compositionResult.document.filename,
        contentHash: compositionResult.document.contentHash,
        generatedAt: compositionResult.document.generatedAt,
      });
      setDocumentActionError(null);
    } catch (error) {
      setDocumentActionError(error instanceof Error ? error.message : "No se pudo imprimir el documento.");
    }
  }, [compositionResult, agreement.entities?.name]);

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
          onClick={() => navigate(expedientePath)}
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

            {requestedPlantillaId ? (
              <div
                className={`flex items-start gap-2 px-4 py-3 text-sm ${
                  requestedPlantilla
                    ? "border border-[var(--g-sec-300)] bg-[var(--g-sec-100)] text-[var(--g-text-primary)]"
                    : "border border-[var(--status-warning)] bg-[var(--g-surface-muted)] text-[var(--g-text-primary)]"
                }`}
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                {requestedPlantilla ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-success)]" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-warning)]" />
                )}
                <span>
                  {requestedPlantilla
                    ? "Plantilla indicada detectada y seleccionada automáticamente."
                    : "La plantilla indicada no es compatible con este acuerdo; elige una alternativa."}
                  <span className="ml-1 font-mono text-xs">{requestedPlantillaId.slice(0, 8)}</span>
                </span>
              </div>
            ) : null}

            {compatiblePlantillas.length === 0 ? (
              <div
                className="flex items-center gap-2 px-4 py-3 text-sm text-[var(--status-warning)] bg-[var(--g-surface-muted)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <AlertTriangle className="h-4 w-4" />
                No hay plantillas operativas compatibles.
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
                        v{p.version} — {isLegallyReviewedDraft(p) ? "BORRADOR revisado" : p.estado}
                        {p.referencia_legal && ` — ${p.referencia_legal}`}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-semibold ${
                        p.estado === "ACTIVA"
                          ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
                          : p.estado === "APROBADA"
                          ? "bg-[var(--g-brand-bright)] text-[var(--g-text-inverse)]"
                          : isLegallyReviewedDraft(p)
                          ? "bg-[var(--status-info)] text-[var(--g-text-inverse)]"
                          : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
                      }`}
                      style={{ borderRadius: "var(--g-radius-full)" }}
                    >
                      {isLegallyReviewedDraft(p) ? "REVISADO" : p.estado}
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

                {missingRequiredCapa2.length > 0 ? (
                  <div
                    className="flex items-start gap-2 border border-[var(--status-warning)] bg-[var(--g-surface-card)] px-4 py-2 text-xs text-[var(--status-warning)]"
                    role="status"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>
                      Variables Capa 2 no resueltas: {missingRequiredCapa2.join(", ")}. El composer
                      las conservara como advertencias de post-render.
                    </span>
                  </div>
                ) : null}

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

            {normalizedCapa3Fields.length > 0 ? (
              <div
                className="flex flex-col gap-3 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <div>
                  <p className="text-sm font-medium text-[var(--g-text-primary)]">
                    Asistente de borrador Capa 3
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--g-text-secondary)]">
                    Sugiere valores editables con whitelist; Capa 1 permanece inmutable.
                  </p>
                  {capa3AssistantSummary ? (
                    <p className="mt-1 text-xs text-[var(--g-brand-3308)]">{capa3AssistantSummary}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => void handleDraftCapa3()}
                  disabled={isDraftingCapa3}
                  aria-busy={isDraftingCapa3}
                  className="inline-flex items-center justify-center gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-xs font-medium text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)] disabled:opacity-50"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  {isDraftingCapa3 ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {isDraftingCapa3 ? "Sugiriendo..." : "Sugerir borrador"}
                </button>
              </div>
            ) : null}

            <Capa3Form
              fields={normalizedCapa3Fields}
              values={normalizedCapa3Values}
              onChange={(vals) => {
                setCapa3Values(vals);
                setCapa3Errors({});
                setPreparedDraft(null);
                setEditableDraftText("");
                setCompositionResult(null);
                setDocxBuffer(null);
                setContentHash("");
                setDraftPersistenceStatus("idle");
                setDraftPersistenceMessage(null);
                setDraftCloudId(null);
              }}
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
                  const errors = validateCapa3(normalizedCapa3Fields, normalizedCapa3Values);
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
                Crear borrador
                <Eye className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* ──────── Step 3: Editable draft ──────── */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">
              Borrador editable del documento
            </h2>

            {renderError ? (
              <div
                id="editable-draft-error"
                className="border border-[var(--status-error)] bg-[var(--g-surface-card)] px-4 py-3 text-sm text-[var(--status-error)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                {renderError}
              </div>
            ) : null}

            {preparedDraft ? (
              <div
                className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
                style={{ borderRadius: "var(--g-radius-lg)" }}
              >
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <label htmlFor="editable-document-draft" className="text-sm font-medium text-[var(--g-text-primary)]">
                    Texto del borrador
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[10px] text-[var(--g-text-secondary)]">
                      {editableDraftLength} caracteres
                    </span>
                    <button
                      type="button"
                      onClick={() => void persistEditableDraft(preparedDraft, editableDraftText, "EDITABLE_DRAFT")}
                      disabled={draftPersistenceStatus === "saving" || editableDraftLength === 0}
                      aria-busy={draftPersistenceStatus === "saving"}
                      className="inline-flex items-center gap-1.5 border border-[var(--g-border-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)] disabled:opacity-50"
                      style={{ borderRadius: "var(--g-radius-md)" }}
                    >
                      {draftPersistenceStatus === "saving" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                      Guardar borrador
                    </button>
                  </div>
                </div>
                <textarea
                  id="editable-document-draft"
                  value={editableDraftText}
                  onChange={(event) => {
                    setEditableDraftText(event.target.value);
                    setRenderError(null);
                    setCompositionResult(null);
                    setDocxBuffer(null);
                    setContentHash("");
                    setDraftPersistenceStatus("dirty");
                    setDraftPersistenceMessage("Cambios pendientes de guardar en Cloud.");
                  }}
                  aria-invalid={!!renderError}
                  aria-describedby={renderError ? "editable-draft-error editable-draft-meta" : "editable-draft-meta"}
                  className="min-h-[420px] w-full resize-y border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-4 py-3 text-sm leading-relaxed text-[var(--g-text-primary)] outline-none transition-colors focus:border-[var(--g-brand-3308)] focus:ring-2 focus:ring-[var(--g-brand-3308)] focus:ring-offset-2 focus:ring-offset-[var(--g-surface-card)]"
                  style={{
                    borderRadius: "var(--g-radius-md)",
                    fontFamily: "'Montserrat', 'Inter', sans-serif",
                  }}
                />
                <div
                  id="editable-draft-meta"
                  className="mt-3 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-3 py-2"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--g-text-secondary)]">
                    <span className="font-medium text-[var(--g-text-primary)]">Trazabilidad del sistema</span>
                    <span className="font-mono">{preparedDraft.request.request_id.slice(0, 12)}</span>
                    <span>{preparedDraft.request.evidence_status}</span>
                    {draftCloudId ? <span className="font-mono">draft {draftCloudId.slice(0, 8)}</span> : null}
                  </div>
                  {draftPersistenceMessage ? (
                    <p
                      className={`mt-2 flex items-start gap-2 text-xs ${
                        draftPersistenceStatus === "blocked" || draftPersistenceStatus === "error"
                          ? "text-[var(--status-error)]"
                          : draftPersistenceStatus === "dirty"
                          ? "text-[var(--status-warning)]"
                          : "text-[var(--g-text-secondary)]"
                      }`}
                    >
                      {draftPersistenceStatus === "blocked" || draftPersistenceStatus === "error" ? (
                        <CloudOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      ) : draftPersistenceStatus === "saving" ? (
                        <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin" />
                      ) : (
                        <Save className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      )}
                      <span>{draftPersistenceMessage}</span>
                    </p>
                  ) : null}
                </div>
              </div>
            ) : (
              <div
                className="border border-[var(--status-warning)] bg-[var(--g-surface-muted)] px-4 py-3 text-sm text-[var(--g-text-primary)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                El borrador debe regenerarse desde Capa 3 antes de crear el DOCX.
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
                disabled={
                  isGenerating ||
                  !!renderError ||
                  !preparedDraft ||
                  editableDraftLength === 0 ||
                  draftPersistenceStatus === "saving" ||
                  draftPersistenceStatus === "blocked"
                }
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] transition-colors disabled:opacity-50"
                style={{ borderRadius: "var(--g-radius-md)" }}
                aria-busy={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Configurando...
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5" />
                    Configurar borrador
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ──────── Step 4: Generated + Signing ──────── */}
        {step === 4 && (
          <div className="space-y-4 py-6">
            <div
              className="flex items-center gap-3 px-4 py-3 bg-[var(--status-success)]/10 text-[var(--status-success)]"
              style={{ borderRadius: "var(--g-radius-lg)" }}
            >
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <span className="text-sm font-medium">Borrador configurado correctamente</span>
            </div>

            {compositionResult ? (
              <div
                className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
                style={{ borderRadius: "var(--g-radius-lg)" }}
              >
                <h3 className="text-sm font-semibold text-[var(--g-text-primary)]">
                  Resultado del composer
                </h3>
                <div className="mt-3 grid gap-2 text-xs text-[var(--g-text-secondary)] sm:grid-cols-2">
                  <p>
                    <span className="font-medium text-[var(--g-text-primary)]">Boundary:</span>{" "}
                    {compositionResult.request.document_type} · {compositionResult.request.evidence_status}
                  </p>
                  <p>
                    <span className="font-medium text-[var(--g-text-primary)]">Plantilla:</span>{" "}
                    {compositionResult.template.tipo} v{compositionResult.template.version}
                  </p>
                  <p className="font-mono">
                    Hash {compositionResult.contentHash.slice(0, 16)}
                  </p>
                  <p>
                    Validacion post-render: {compositionResult.postRenderValidation.ok ? "OK" : "Bloqueada"}
                  </p>
                </div>
              </div>
            ) : null}

            <div
              className="border border-[var(--g-border-subtle)] p-4 bg-[var(--g-surface-subtle)]"
              style={{ borderRadius: "var(--g-radius-lg)" }}
            >
              <h3 className="text-sm font-semibold text-[var(--g-text-primary)] mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                  Artefacto DOCX del borrador
              </h3>
              <p className="text-xs text-[var(--g-text-secondary)] mb-4">
                El borrador revisado ya tiene hash y artefacto DOCX demo-operativo. Desde aquí puedes
                descargar el archivo, abrir una vista imprimible o continuar con firma y archivo.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={handleDownloadDocument}
                  disabled={!docxBuffer || !compositionResult}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium border border-[var(--g-border-subtle)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-card)] transition-colors disabled:opacity-50"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                  aria-label="Descargar documento DOCX"
                >
                  <Download className="h-4 w-4" />
                  {qesResult?.signedDocumentData ? "Descargar DOCX firmado" : "Descargar DOCX"}
                </button>
                <button
                  type="button"
                  onClick={handlePrintDocument}
                  disabled={!compositionResult}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium border border-[var(--g-border-subtle)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-card)] transition-colors disabled:opacity-50"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                  aria-label="Imprimir documento o exportar como PDF"
                >
                  <Printer className="h-4 w-4" />
                  Imprimir / PDF
                </button>
              </div>
              {compositionResult ? (
                <p className="mt-3 font-mono text-[10px] text-[var(--g-text-secondary)]">
                  {compositionResult.document.filename} · {compositionResult.document.documentId}
                </p>
              ) : null}
              {documentActionError ? (
                <p className="mt-3 text-xs text-[var(--status-error)]">{documentActionError}</p>
              ) : null}
            </div>

            <div
              className="border border-[var(--g-border-subtle)] p-4 bg-[var(--g-surface-subtle)]"
              style={{ borderRadius: "var(--g-radius-lg)" }}
            >
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
                  <div
                    className="flex items-center gap-2 px-3 py-2 bg-[var(--status-success)]/10 text-[var(--status-success)]"
                    style={{ borderRadius: "var(--g-radius-sm)" }}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm font-medium">Solicitud QES activada correctamente</span>
                  </div>
                  <p className="text-xs text-[var(--g-text-secondary)]">
                    EAD Trust ha registrado la solicitud de firma. El archivo se archivará con los
                    identificadores QTSP y, si el proveedor entrega un artefacto firmado, se archivará
                    ese binario firmado.
                  </p>
                  {qesResult ? (
                    <p className="font-mono text-[10px] text-[var(--g-text-secondary)]">
                      SR {qesResult.srId} · DOC {qesResult.documentId} · hash {qesResult.documentHash.slice(0, 12)}
                    </p>
                  ) : null}
                </div>
              )}

              {signingStatus === "error" && (
                <div className="space-y-2">
                  <div
                    className="flex items-center gap-2 px-3 py-2 bg-[var(--status-error)]/10 text-[var(--status-error)]"
                    style={{ borderRadius: "var(--g-radius-sm)" }}
                  >
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

            <div
              className="border border-[var(--g-border-subtle)] p-4 bg-[var(--g-surface-subtle)]"
              style={{ borderRadius: "var(--g-radius-lg)" }}
            >
              <h3 className="text-sm font-semibold text-[var(--g-text-primary)] mb-3 flex items-center gap-2">
                <FileCheck2 className="h-4 w-4" />
                Archivar en Supabase Storage
              </h3>

              {archiveStatus === "idle" && (
                <>
                  <p className="text-xs text-[var(--g-text-secondary)] mb-4">
                    Guarde el documento en Supabase Storage con hash SHA-512 y bundle operativo demo de evidencia documental; no constituye evidencia final productiva.
                    {qesResult ? " Se adjuntarán los metadatos QTSP de EAD Trust." : ""}
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
                  <div
                    className="flex items-center gap-2 px-3 py-2 bg-[var(--status-success)]/10 text-[var(--status-success)]"
                    style={{ borderRadius: "var(--g-radius-sm)" }}
                  >
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
                  <div className="flex flex-wrap gap-2">
                    <span
                      className="inline-block px-2 py-1 text-[10px] font-semibold bg-[var(--status-success)] text-[var(--g-text-inverse)]"
                      style={{ borderRadius: "var(--g-radius-full)" }}
                    >
                      Archivado
                    </span>
                    <span
                      className="inline-block px-2 py-1 text-[10px] font-semibold bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]"
                      style={{ borderRadius: "var(--g-radius-full)" }}
                    >
                      Vinculado al expediente
                    </span>
                  </div>
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
                  <div
                    className="flex items-center gap-2 px-3 py-2 bg-[var(--status-error)]/10 text-[var(--status-error)]"
                    style={{ borderRadius: "var(--g-radius-sm)" }}
                  >
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
                  setPreparedDraft(null);
                  setEditableDraftText("");
                  setDraftPersistenceStatus("idle");
                  setDraftPersistenceMessage(null);
                  setDraftCloudId(null);
                  setCapa3Values({});
                  setSelectedPlantilla(null);
                  setSigningStatus("idle");
                  setArchiveStatus("idle");
                  setArchiveUrl(null);
                  setArchiveError(null);
                  setDocxBuffer(null);
                  setQesResult(null);
                  setCompositionResult(null);
                  setDocumentActionError(null);
                }}
                className="flex items-center gap-1.5 px-4 py-2 text-sm border border-[var(--g-border-subtle)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] transition-colors"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                Generar otro
              </button>
              <button
                type="button"
                onClick={() => navigate(expedientePath)}
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
