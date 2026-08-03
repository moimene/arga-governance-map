import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTenantContext } from "@/context/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import {
  assertRegistryRpcResult,
  type RegistryBaseDocumentKind,
  type RegistryQualificationOutcome,
  type RegistryRpcResult,
} from "@/lib/secretaria/registry-lifecycle";

export interface RegistryFilingEventRow {
  id: string;
  tenant_id: string;
  filing_id: string;
  operation_id: string;
  event_type: string;
  from_status: string | null;
  to_status: string;
  sequence_no: number;
  effective_at: string;
  evidence_artifact_id: string | null;
  actor_user_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

interface RegistryMutationContext {
  tenantId: string;
  queryClient: ReturnType<typeof useQueryClient>;
}

async function invokeRegistryRpc(
  name:
    | "fn_registry_prepare_filing"
    | "fn_registry_record_presentation"
    | "fn_registry_record_qualification"
    | "fn_registry_submit_remedy"
    | "fn_registry_record_inscription"
    | "fn_registry_record_publication",
  params: Record<string, unknown>,
): Promise<RegistryRpcResult> {
  const { data, error } = await supabase.rpc(name, params);
  if (error) throw error;
  return assertRegistryRpcResult(data);
}

function invalidateRegistry(context: RegistryMutationContext, filingId?: string | null) {
  context.queryClient.invalidateQueries({ queryKey: ["registry_filings", context.tenantId] });
  context.queryClient.invalidateQueries({ queryKey: ["registry_filing_events", context.tenantId] });
  if (filingId) {
    context.queryClient.invalidateQueries({
      queryKey: ["registry_filings", context.tenantId, "byId", filingId],
    });
  }
}

export function useRegistryFilingEvents(filingId?: string | null) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!tenantId && !!filingId,
    queryKey: ["registry_filing_events", tenantId, filingId],
    queryFn: async (): Promise<RegistryFilingEventRow[]> => {
      const { data, error } = await supabase
        .from("registry_filing_events")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("filing_id", filingId!)
        .order("sequence_no", { ascending: true });
      if (error) throw error;
      return (data ?? []) as RegistryFilingEventRow[];
    },
  });
}

export function usePrepareRegistryFiling() {
  const { tenantId } = useTenantContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      operationId: string;
      entityId: string;
      sourceDomain: "AGREEMENT" | "CERTIFICATION" | "MANDATORY_BOOK" | "GROUP_CAMPAIGN_POST_TASK";
      sourceId: string;
      baseDocumentKind: RegistryBaseDocumentKind;
      baseDocumentArtifactId: string;
      filingVia: string;
      agreementId?: string | null;
      rulePackVersionId?: string | null;
      procedureProfileCode?: string | null;
      procedureSnapshot?: Record<string, unknown>;
      deedDate?: string | null;
      notaryName?: string | null;
      protocolNumber?: string | null;
      filingId?: string | null;
    }) => {
      if (!tenantId) throw new Error("tenant_id requerido para preparar el expediente registral");
      return invokeRegistryRpc("fn_registry_prepare_filing", {
        p_tenant_id: tenantId,
        p_operation_id: params.operationId,
        p_entity_id: params.entityId,
        p_source_domain: params.sourceDomain,
        p_source_id: params.sourceId,
        p_base_document_kind: params.baseDocumentKind,
        p_base_document_artifact_id: params.baseDocumentArtifactId,
        p_filing_via: params.filingVia,
        p_agreement_id: params.agreementId ?? null,
        p_rule_pack_version_id: params.rulePackVersionId ?? null,
        p_procedure_profile_code: params.procedureProfileCode ?? null,
        p_procedure_snapshot: params.procedureSnapshot ?? {},
        p_deed_date: params.deedDate ?? null,
        p_notary_name: params.notaryName ?? null,
        p_protocol_number: params.protocolNumber ?? null,
        p_filing_id: params.filingId ?? null,
      });
    },
    onSuccess: (result) => invalidateRegistry({ tenantId: tenantId!, queryClient }, result.filing_id),
  });
}

export function useRecordRegistryPresentation() {
  const { tenantId } = useTenantContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      filingId: string;
      operationId: string;
      filingNumber: string;
      presentationDate: string;
      filingVia: string;
      evidenceArtifactId: string;
      effectiveAt?: string;
    }) => {
      if (!tenantId) throw new Error("tenant_id requerido para registrar la presentación");
      return invokeRegistryRpc("fn_registry_record_presentation", {
        p_tenant_id: tenantId,
        p_filing_id: params.filingId,
        p_operation_id: params.operationId,
        p_filing_number: params.filingNumber,
        p_presentation_date: params.presentationDate,
        p_filing_via: params.filingVia,
        p_evidence_artifact_id: params.evidenceArtifactId,
        p_effective_at: params.effectiveAt ?? new Date().toISOString(),
      });
    },
    onSuccess: (result) => invalidateRegistry({ tenantId: tenantId!, queryClient }, result.filing_id),
  });
}

export function useRecordRegistryQualification() {
  const { tenantId } = useTenantContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      filingId: string;
      operationId: string;
      outcome: RegistryQualificationOutcome;
      effectiveAt: string;
      evidenceArtifactId: string;
      defectDescription?: string | null;
    }) => {
      if (!tenantId) throw new Error("tenant_id requerido para registrar la calificación");
      return invokeRegistryRpc("fn_registry_record_qualification", {
        p_tenant_id: tenantId,
        p_filing_id: params.filingId,
        p_operation_id: params.operationId,
        p_outcome: params.outcome,
        p_effective_at: params.effectiveAt,
        p_evidence_artifact_id: params.evidenceArtifactId,
        p_defect_description: params.defectDescription ?? null,
      });
    },
    onSuccess: (result) => invalidateRegistry({ tenantId: tenantId!, queryClient }, result.filing_id),
  });
}

export function useSubmitRegistryRemedy() {
  const { tenantId } = useTenantContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      filingId: string;
      operationId: string;
      remedyDescription: string;
      evidenceArtifactId: string;
      effectiveAt?: string;
    }) => {
      if (!tenantId) throw new Error("tenant_id requerido para registrar la subsanación");
      return invokeRegistryRpc("fn_registry_submit_remedy", {
        p_tenant_id: tenantId,
        p_filing_id: params.filingId,
        p_operation_id: params.operationId,
        p_remedy_description: params.remedyDescription,
        p_evidence_artifact_id: params.evidenceArtifactId,
        p_effective_at: params.effectiveAt ?? new Date().toISOString(),
      });
    },
    onSuccess: (result) => invalidateRegistry({ tenantId: tenantId!, queryClient }, result.filing_id),
  });
}

export function useRecordRegistryInscription() {
  const { tenantId } = useTenantContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      filingId: string;
      operationId: string;
      inscriptionNumber: string;
      registeredAt: string;
      evidenceArtifactId: string;
    }) => {
      if (!tenantId) throw new Error("tenant_id requerido para registrar la inscripción");
      return invokeRegistryRpc("fn_registry_record_inscription", {
        p_tenant_id: tenantId,
        p_filing_id: params.filingId,
        p_operation_id: params.operationId,
        p_inscription_number: params.inscriptionNumber,
        p_registered_at: params.registeredAt,
        p_evidence_artifact_id: params.evidenceArtifactId,
      });
    },
    onSuccess: (result) => invalidateRegistry({ tenantId: tenantId!, queryClient }, result.filing_id),
  });
}

export function useRecordRegistryPublication() {
  const { tenantId } = useTenantContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      filingId: string;
      operationId: string;
      publicationReference: string;
      publishedAt: string;
      evidenceArtifactId: string;
    }) => {
      if (!tenantId) throw new Error("tenant_id requerido para registrar la publicación");
      return invokeRegistryRpc("fn_registry_record_publication", {
        p_tenant_id: tenantId,
        p_filing_id: params.filingId,
        p_operation_id: params.operationId,
        p_publication_reference: params.publicationReference,
        p_published_at: params.publishedAt,
        p_evidence_artifact_id: params.evidenceArtifactId,
      });
    },
    onSuccess: (result) => invalidateRegistry({ tenantId: tenantId!, queryClient }, result.filing_id),
  });
}
