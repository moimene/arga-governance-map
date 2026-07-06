import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import type { PlantillaProtegidaRow } from "@/hooks/usePlantillasProtegidas";
import type { SecretariaAdoptionMode, SecretariaDocumentType } from "@/lib/secretaria/document-generation-boundary";
import { buildSecretariaDocumentGenerationRequest } from "@/lib/secretaria/document-generation-boundary";
import { composeDocument } from "@/lib/motor-plantillas/composer";

export interface SecretariaDocumentArtifactRow {
  id: string;
  tenant_id: string;
  artifact_kind: string;
  title: string;
  status: string;
  version: number;
  template_id: string | null;
  template_version: string | null;
  document_url: string | null;
  mime_type: string | null;
  content_hash: string | null;
  hash_sha512: string | null;
  evidence_bundle_id: string | null;
  evidence_status: string;
  source_domain: string | null;
  source_id: string | null;
  source_hash: string | null;
  source_payload: Record<string, unknown>;
  rule_pack_version_id: string | null;
  normative_snapshot_hash: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AgreementDocumentRequirementRow {
  id: string;
  tenant_id: string;
  agreement_id: string;
  matter_code: string;
  requirement_code: string;
  document_kind: string;
  title: string;
  required_level: string;
  blocking_policy: string;
  fase: string;
  legal_basis: string | null;
  annex_targets: string[];
  template_binding_key: string | null;
  status: string;
  explain: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DocumentAnnexLinkRow {
  id: string;
  tenant_id: string;
  artifact_id: string;
  linked_domain: string;
  linked_id: string;
  annex_role: string;
  annex_order: number;
  is_mandatory_annex: boolean;
  included_in_export: boolean;
  included_in_certification_bundle: boolean;
  frozen_at: string | null;
  created_at: string;
  artifact?: SecretariaDocumentArtifactRow | null;
}

const INFORME_KINDS = ["INFORME_PRECEPTIVO", "INFORME_DOCUMENTAL_PRE", "INFORME_GESTION"];

function documentTypeForArtifactKind(kind: string): SecretariaDocumentType {
  if (kind === "INFORME_PRECEPTIVO") return "INFORME_PRECEPTIVO";
  if (kind === "INFORME_GESTION") return "INFORME_GESTION";
  if (kind === "DOCUMENTO_REGISTRAL") return "DOCUMENTO_REGISTRAL";
  return "INFORME_DOCUMENTAL_PRE";
}

function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function asAdoptionMode(value: unknown): SecretariaAdoptionMode | null {
  const raw = asString(value);
  if (
    raw === "MEETING" ||
    raw === "NO_SESSION" ||
    raw === "UNIPERSONAL_SOCIO" ||
    raw === "UNIPERSONAL_ADMIN" ||
    raw === "CO_APROBACION" ||
    raw === "SOLIDARIO"
  ) {
    return raw;
  }
  return null;
}

function buildRequirementBaseVariables(params: {
  agreementId: string;
  agreementKind?: string | null;
  entityName?: string | null;
  bodyName?: string | null;
  requirementCode: string;
  legalBasis?: string | null;
  sourcePayload?: Record<string, unknown>;
}) {
  const source = params.sourcePayload ?? {};
  const matterCode = asString(source.matter_code) ?? params.agreementKind ?? params.requirementCode;
  const phase = asString(source.phase) ?? asString(source.fase) ?? "EXPEDIENTE";
  const requirementCode = asString(source.requirement_code) ?? params.requirementCode;
  return {
    agreement_id: params.agreementId,
    denominacion_social: params.entityName ?? "ARGA Seguros, S.A.",
    organo_nombre: params.bodyName ?? "Organo societario",
    materia_acuerdo: matterCode,
    fecha: new Date().toISOString().slice(0, 10),
    objeto_informe: `Revisión documental del requisito ${requirementCode} en fase ${phase}.`,
    fundamento_legal: params.legalBasis ?? asString(source.legal_basis) ?? "LSC y normativa societaria aplicable.",
    comprobaciones_texto: [
      `Requisito documental: ${requirementCode}`,
      `Materia: ${matterCode}`,
      `Fase: ${phase}`,
      `Anexos destino: ${Array.isArray(source.annex_targets) ? source.annex_targets.join(", ") : "EXPEDIENTE"}`,
    ].join("\n"),
    conclusion_informe: "Documento generado como soporte operativo del expediente societario TGMS.",
    resultado_gate: "DEMO_OPERATIVA",
    resultado_evaluacion: "Requisito materializado y pendiente de revisión jurídica cuando proceda.",
    snapshot_hash: asString(source.normative_snapshot_hash) ?? `agreement:${params.agreementId}`,
  };
}

function sourceAnnexTargets(sourcePayload?: Record<string, unknown>) {
  const raw = sourcePayload?.annex_targets;
  return Array.isArray(raw) ? raw.filter((target): target is string => typeof target === "string") : [];
}

export function useSecretariaDocumentArtifacts(filters?: { kinds?: string[]; sourceDomain?: string | null }) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!tenantId,
    queryKey: ["secretaria_document_artifacts", tenantId, filters?.kinds?.join("|") ?? "all", filters?.sourceDomain ?? "all"],
    queryFn: async (): Promise<SecretariaDocumentArtifactRow[]> => {
      let query = supabase
        .from("secretaria_document_artifacts")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("updated_at", { ascending: false });
      if (filters?.kinds?.length) query = query.in("artifact_kind", filters.kinds);
      if (filters?.sourceDomain) query = query.eq("source_domain", filters.sourceDomain);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as SecretariaDocumentArtifactRow[];
    },
  });
}

export function useInformesArtifacts() {
  return useSecretariaDocumentArtifacts({ kinds: INFORME_KINDS });
}

export function useAgreementDocumentRequirements(agreementId?: string | null) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!tenantId && !!agreementId,
    queryKey: ["agreement_document_requirements", tenantId, agreementId],
    queryFn: async (): Promise<AgreementDocumentRequirementRow[]> => {
      const { data, error } = await supabase
        .from("agreement_document_requirements")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("agreement_id", agreementId!)
        .order("fase", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AgreementDocumentRequirementRow[];
    },
  });
}

export function useCertificationAnnexGate(agreementIds: string[]) {
  const { tenantId } = useTenantContext();
  const stableIds = Array.from(new Set(agreementIds.filter(Boolean))).sort();
  return useQuery({
    enabled: !!tenantId && stableIds.length > 0,
    queryKey: ["agreement_document_requirements", tenantId, "certification-annex-gate", stableIds.join("|")],
    queryFn: async (): Promise<AgreementDocumentRequirementRow[]> => {
      const { data, error } = await supabase
        .from("agreement_document_requirements")
        .select("*")
        .eq("tenant_id", tenantId!)
        .in("agreement_id", stableIds);
      if (error) throw error;
      return (data ?? []) as AgreementDocumentRequirementRow[];
    },
  });
}

export function useDocumentAnnexLinks(filters: { linkedDomain: string; linkedIds: string[] }) {
  const { tenantId } = useTenantContext();
  const linkedIds = Array.from(new Set(filters.linkedIds.filter(Boolean))).sort();
  return useQuery({
    enabled: !!tenantId && !!filters.linkedDomain && linkedIds.length > 0,
    queryKey: ["document_annex_links", tenantId, filters.linkedDomain, linkedIds.join("|")],
    queryFn: async (): Promise<DocumentAnnexLinkRow[]> => {
      const { data, error } = await supabase
        .from("document_annex_links")
        .select(`
          *,
          artifact:artifact_id(*)
        `)
        .eq("tenant_id", tenantId!)
        .eq("linked_domain", filters.linkedDomain)
        .in("linked_id", linkedIds)
        .order("annex_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DocumentAnnexLinkRow[];
    },
  });
}

export function useRefreshAgreementDocumentRequirements() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenantContext();
  return useMutation({
    mutationFn: async (agreementId: string): Promise<number> => {
      const { data, error } = await supabase.rpc("fn_refresh_agreement_document_requirements", {
        p_agreement_id: agreementId,
      });
      if (error) throw error;
      return Number(data ?? 0);
    },
    onSuccess: (_count, agreementId) => {
      queryClient.invalidateQueries({ queryKey: ["agreement_document_requirements", tenantId, agreementId] });
      queryClient.invalidateQueries({ queryKey: ["secretaria_document_artifacts", tenantId] });
    },
  });
}

export function useCreateSecretariaDocumentArtifact() {
  const { tenantId } = useTenantContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      artifactKind: string;
      title: string;
      sourceDomain?: string | null;
      sourceId?: string | null;
      sourceHash?: string | null;
      sourcePayload?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    }): Promise<SecretariaDocumentArtifactRow> => {
      if (!tenantId) throw new Error("tenantId requerido");
      const { data, error } = await supabase
        .from("secretaria_document_artifacts")
        .insert({
          tenant_id: tenantId,
          artifact_kind: params.artifactKind,
          title: params.title,
          status: "DRAFT",
          source_domain: params.sourceDomain ?? null,
          source_id: params.sourceId ?? null,
          source_hash: params.sourceHash ?? null,
          source_payload: params.sourcePayload ?? {},
          evidence_status: "DEMO_OPERATIVA",
          metadata: params.metadata ?? {},
        })
        .select("*")
        .single();
      if (error) throw error;
      return data as SecretariaDocumentArtifactRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["secretaria_document_artifacts", tenantId] });
    },
  });
}

export function useCreateAndLinkAgreementDocumentArtifact() {
  const { tenantId } = useTenantContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      agreementId: string;
      entityId?: string | null;
      bodyId?: string | null;
      meetingId?: string | null;
      entityName?: string | null;
      bodyName?: string | null;
      agreementKind?: string | null;
      requirementId: string;
      requirementCode: string;
      artifactKind: string;
      title: string;
      templateBindingKey?: string | null;
      legalBasis?: string | null;
      plantillas?: PlantillaProtegidaRow[];
      sourcePayload?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
    }): Promise<SecretariaDocumentArtifactRow> => {
      if (!tenantId) throw new Error("tenantId requerido");
      if (!params.entityId) throw new Error("entity_id requerido para generar documento del expediente");
      if (!params.plantillas?.length) throw new Error("No hay plantillas cargadas para generar el documento");
      const now = new Date().toISOString();
      const documentType = documentTypeForArtifactKind(params.artifactKind);
      const request = await buildSecretariaDocumentGenerationRequest({
        documentType,
        tenantId,
        entityId: params.entityId,
        agreementIds: [params.agreementId],
        meetingId: params.meetingId ?? null,
        templateProfileId: params.templateBindingKey ?? params.artifactKind,
        expectedAdoptionMode: asAdoptionMode(params.sourcePayload?.adoption_mode),
        requestedAt: now,
      });
      const baseVariables = buildRequirementBaseVariables({
        agreementId: params.agreementId,
        agreementKind: params.agreementKind,
        entityName: params.entityName,
        bodyName: params.bodyName,
        requirementCode: params.requirementCode,
        legalBasis: params.legalBasis,
        sourcePayload: params.sourcePayload,
      });
      const composition = await composeDocument(request, {}, {
        plantillas: params.plantillas,
        baseVariables,
        archiveDraft: true,
        title: params.title,
        subtitle: params.entityName ?? undefined,
        entityName: params.entityName ?? undefined,
        filenamePrefix: params.artifactKind,
        templateContext: {
          templateId: null,
          bindingId: params.templateBindingKey ?? null,
          templateVersion: null,
        },
      });
      if (composition.archive.attempted && !composition.archive.archived) {
        throw new Error(composition.archive.error ?? "El documento se generó pero no pudo archivarse");
      }
      const { data: artifact, error: artifactError } = await supabase
        .from("secretaria_document_artifacts")
        .insert({
          tenant_id: tenantId,
          artifact_kind: params.artifactKind,
          title: params.title,
          status: composition.archive.archived ? "ARCHIVED" : "GENERATED",
          template_id: composition.template.id,
          template_version: composition.template.version,
          document_url: composition.archive.documentUrl ?? null,
          mime_type: composition.document.mimeType,
          content_hash: composition.contentHash,
          hash_sha512: composition.archive.hash512 ?? null,
          evidence_bundle_id: composition.archive.evidenceBundleId ?? null,
          source_domain: "agreement",
          source_id: params.agreementId,
          source_hash: request.request_hash_sha256,
          source_payload: params.sourcePayload ?? {},
          evidence_status: "DEMO_OPERATIVA",
          generated_at: now,
          metadata: {
            creation_channel: "agreement_document_requirement_panel",
            agreement_id: params.agreementId,
            requirement_id: params.requirementId,
            requirement_code: params.requirementCode,
            request_id: request.request_id,
            request_hash_sha256: request.request_hash_sha256,
            filename: composition.document.filename,
            rendered_text_hash: composition.contentHash,
            archive_skipped_reason: composition.archive.skippedReason ?? null,
            ...(params.metadata ?? {}),
          },
        })
        .select("*")
        .single();
      if (artifactError) throw artifactError;

      const typedArtifact = artifact as SecretariaDocumentArtifactRow;
      const { error: linkError } = await supabase
        .from("agreement_document_links")
        .upsert(
          {
            tenant_id: tenantId,
            requirement_id: params.requirementId,
            artifact_id: typedArtifact.id,
            link_role: "SATISFIES_REQUIREMENT",
          },
          { onConflict: "tenant_id,requirement_id,artifact_id" },
        );
      if (linkError) throw linkError;

      const { error: annexError } = await supabase
        .from("document_annex_links")
        .upsert(
          {
            tenant_id: tenantId,
            artifact_id: typedArtifact.id,
            linked_domain: "agreement",
            linked_id: params.agreementId,
            annex_role: params.requirementCode,
            annex_order: 1,
            is_mandatory_annex: true,
            included_in_export: true,
            included_in_certification_bundle: true,
            frozen_at: now,
          },
          { onConflict: "tenant_id,artifact_id,linked_domain,linked_id,annex_role" },
        );
      if (annexError) throw annexError;

      const annexTargets = sourceAnnexTargets(params.sourcePayload);
      const extraAnnexLinks: Array<Record<string, unknown>> = [];
      if (params.meetingId && annexTargets.includes("REUNION")) {
        extraAnnexLinks.push({
          tenant_id: tenantId,
          artifact_id: typedArtifact.id,
          linked_domain: "meeting",
          linked_id: params.meetingId,
          annex_role: params.requirementCode,
          annex_order: 1,
          is_mandatory_annex: true,
          included_in_export: true,
          included_in_certification_bundle: annexTargets.includes("CERTIFICACION"),
          frozen_at: now,
        });
      }
      if (params.meetingId && annexTargets.includes("BOARD_PACK")) {
        extraAnnexLinks.push({
          tenant_id: tenantId,
          artifact_id: typedArtifact.id,
          linked_domain: "board_pack",
          linked_id: params.meetingId,
          annex_role: params.requirementCode,
          annex_order: 1,
          is_mandatory_annex: true,
          included_in_export: true,
          included_in_certification_bundle: annexTargets.includes("CERTIFICACION"),
          frozen_at: now,
        });
      }
      if (extraAnnexLinks.length > 0) {
        const { error: extraAnnexError } = await supabase
          .from("document_annex_links")
          .upsert(extraAnnexLinks, { onConflict: "tenant_id,artifact_id,linked_domain,linked_id,annex_role" });
        if (extraAnnexError) throw extraAnnexError;
      }

      const { error: updateError } = await supabase
        .from("agreement_document_requirements")
        .update({ status: "SATISFIED" })
        .eq("tenant_id", tenantId)
        .eq("id", params.requirementId);
      if (updateError) throw updateError;

      return typedArtifact;
    },
    onSuccess: (_artifact, params) => {
      queryClient.invalidateQueries({ queryKey: ["agreement_document_requirements", tenantId, params.agreementId] });
      queryClient.invalidateQueries({ queryKey: ["secretaria_document_artifacts", tenantId] });
    },
  });
}

export function useUpdateSecretariaDocumentArtifactStatus() {
  const { tenantId } = useTenantContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      artifactId: string;
      status: string;
      reviewed?: boolean;
      metadata?: Record<string, unknown>;
    }): Promise<SecretariaDocumentArtifactRow> => {
      if (!tenantId) throw new Error("tenantId requerido");
      const patch: Record<string, unknown> = {
        status: params.status,
      };
      if (params.reviewed) {
        patch.reviewed_at = new Date().toISOString();
      }
      if (params.metadata) {
        patch.metadata = params.metadata;
      }
      const { data, error } = await supabase
        .from("secretaria_document_artifacts")
        .update(patch)
        .eq("tenant_id", tenantId)
        .eq("id", params.artifactId)
        .select("*")
        .single();
      if (error) throw error;
      return data as SecretariaDocumentArtifactRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["secretaria_document_artifacts", tenantId] });
    },
  });
}
