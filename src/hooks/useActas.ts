import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import {
  buildCertificationPlan,
  extractPointSnapshots,
  type CertificationPlan,
  type CertificationResolutionRow,
} from "@/lib/secretaria/certification-snapshot";
import {
  buildMeetingAgreementPayload,
  extractAgendaItemIndexFromExecutionMode,
  type AgreementOrigin,
} from "@/lib/secretaria/agreement-360";
import type { MeetingAdoptionSnapshot } from "@/lib/rules-engine";
import { secretariaOperationError } from "@/lib/secretaria/supabase-error-message";
import type {
  AuthoritativeEadEvidence,
  AuthoritativeEvidenceState,
  AuthoritativeLegalArtifact,
  CertificationLegalGateStatus,
  EadSignatureType,
  MinuteApprovalMethod,
  MinuteLegalGateStatus,
} from "@/lib/secretaria/authoritative-legal-state";
import {
  buildActaAgendaViewModel,
  computeCanonicalMinutesHash,
  validateActaLegalStructure,
  type ActaAgendaConstanciaRow,
  type ActaAgendaDebateRow,
  type ActaAgendaItemRow,
  type ActaAgendaItemViewModel,
  type ActaAgreementRow,
  type ActaLegalStructureValidationResult,
  type ActaMeetingResolutionRow,
} from "@/lib/secretaria/acta-agenda";

export interface ActaRow {
  id: string;
  tenant_id: string;
  meeting_id: string;
  content: string | null;
  signed_at: string | null;
  signed_by_secretary_id: string | null;
  signed_by_president_id: string | null;
  registered_at: string | null;
  is_locked: boolean;
  created_at: string;
  /** F8.1: las minutes ahora llevan body_id/entity_id denormalizados. */
  body_id: string | null;
  entity_id: string | null;
  meeting_type: string | null;
  body_name: string | null;
  entity_name: string | null;
  resolutions_count: number;
  canonical_minutes_hash?: string | null;
  content_hash?: string | null;
  authoritative_manifest_hash?: string | null;
  final_legal_artifact_id?: string | null;
  approval_method?: MinuteApprovalMethod | null;
  approval_effective_at?: string | null;
  president_consent_verification_id?: string | null;
  secretary_consent_verification_id?: string | null;
  legal_gate_status?: MinuteLegalGateStatus;
  president_consent_evidence_id?: string | null;
  secretary_constancia_evidence_id?: string | null;
  approval_evidence_mode?: "INTERPOSITION" | null;
  approval_signature_claim?: false | null;
  approval_evidenced_at?: string | null;
  approval_canonical_status?: "APPROVED_EVIDENCED" | null;
  book_section_id?: string | null;
  book_entry_id?: string | null;
  book_destination_status?: "UNRESOLVED" | "RESOLVED" | "POSTED" | "LEGACY_REVIEW";
  book_destination_resolved_at?: string | null;
}

export interface CertificationRow {
  id: string;
  tenant_id: string;
  minute_id: string;
  content: string | null;
  agreements_certified: string[] | null;
  certifier_id: string | null;
  authority_evidence_id: string | null;
  visto_bueno_persona_id: string | null;
  certificante_role: string | null;
  requires_qualified_signature: boolean;
  signature_status: string;
  jurisdictional_requirements: Record<string, unknown> | null;
  created_at: string;
  agreement_id: string | null;
  evidence_id?: string | null;
  gate_hash?: string | null;
  final_legal_artifact_id?: string | null;
  certifier_qtsp_verification_id?: string | null;
  visto_bueno_qtsp_verification_id?: string | null;
  content_hash_sha256?: string | null;
  agreements_manifest_hash?: string | null;
  required_ead_signature_type?: EadSignatureType;
  verified_ead_signature_type?: EadSignatureType | null;
  emitted_at?: string | null;
  legal_gate_status?: CertificationLegalGateStatus;
  certifier_constancia_evidence_id?: string | null;
  visto_bueno_constancia_evidence_id?: string | null;
  interposition_evidence_mode?: "INTERPOSITION" | null;
  interposition_signature_claim?: false | null;
  constancia_evidenced_at?: string | null;
  evidence_binding_hash_sha256?: string | null;
  interposition_canonical_status?: "CONSTANCIA_VERIFIED" | null;
}

function requiredMajorityCodeForSnapshot(
  snapshot: MeetingAdoptionSnapshot,
  storedCode?: string | null,
) {
  if (storedCode?.startsWith(`${snapshot.materia}:`)) return storedCode;
  return `${snapshot.materia}:${snapshot.materia_clase}`;
}

export function useActasList(entityId?: string | null) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["actas", tenantId, "list", entityId ?? "all"],
    enabled: !!tenantId,
    queryFn: async (): Promise<ActaRow[]> => {
      let query = supabase
        .from("minutes")
        .select(
          "*, meetings(meeting_type, governing_bodies(name, entities(common_name, legal_name)))",
        )
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });

      if (entityId) {
        query = query.eq("entity_id", entityId);
      }

      const { data, error } = await query;
      if (error) throw error;
      type MinuteRaw = Omit<ActaRow, "meeting_type" | "body_name" | "entity_name" | "resolutions_count"> & {
        meetings?: {
          meeting_type?: string | null;
          governing_bodies?: {
            name?: string | null;
            entities?: { common_name?: string | null; legal_name?: string | null } | null;
          } | null;
        } | null;
      };
      const rows = (data ?? []) as MinuteRaw[];

      // Count resolutions per meeting in a single query
      const meetingIds = rows.map((m) => m.meeting_id).filter(Boolean);
      const counts = new Map<string, number>();
      if (meetingIds.length > 0) {
        const { data: resRows } = await supabase
          .from("meeting_resolutions")
          .select("meeting_id")
          .in("meeting_id", meetingIds);
        for (const r of (resRows ?? []) as { meeting_id: string }[]) {
          counts.set(r.meeting_id, (counts.get(r.meeting_id) ?? 0) + 1);
        }
      }

      return rows.map((m) => ({
        ...m,
        meeting_type: m.meetings?.meeting_type ?? null,
        body_name: m.meetings?.governing_bodies?.name ?? null,
        entity_name:
          m.meetings?.governing_bodies?.entities?.legal_name ??
          m.meetings?.governing_bodies?.entities?.common_name ??
          null,
        resolutions_count: counts.get(m.meeting_id) ?? 0,
      }));
    },
  });
}

export type ActaDetailRow = Omit<ActaRow, "meeting_type" | "body_name" | "entity_name" | "resolutions_count"> & {
  signed_president?: { id?: string | null; full_name?: string | null; email?: string | null } | null;
  signed_secretary?: { id?: string | null; full_name?: string | null; email?: string | null } | null;
  meetings?: {
    meeting_type?: string | null;
    scheduled_start?: string | null;
    scheduled_end?: string | null;
    location?: string | null;
    quorum_data?: Record<string, unknown> | null;
    president?: { id?: string | null; full_name?: string | null; email?: string | null } | null;
    secretary?: { id?: string | null; full_name?: string | null; email?: string | null } | null;
    governing_bodies?: {
      name?: string | null;
      body_type?: string | null;
      entities?: {
        common_name?: string | null;
        legal_name?: string | null;
        jurisdiction?: string | null;
      } | null;
    } | null;
  } | null;
};

export function useActaById(id: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!id && !!tenantId,
    queryKey: ["actas", tenantId, "byId", id],
    queryFn: async () => {
      // `*` incluye body_id/entity_id (añadidos en migración
      // 20260421_000024). Los necesita EmitirCertificacionButton.
      const { data, error } = await supabase
        .from("minutes")
        .select(
          "*, signed_president:signed_by_president_id(id, full_name, email), signed_secretary:signed_by_secretary_id(id, full_name, email), meetings(meeting_type, scheduled_start, scheduled_end, location, quorum_data, president:president_id(id, full_name, email), secretary:secretary_id(id, full_name, email), governing_bodies(name, body_type, entities(common_name, legal_name, jurisdiction)))",
        )
        .eq("id", id!)
        .eq("tenant_id", tenantId!)
        .maybeSingle();
      if (error) throw error;
      return data as ActaDetailRow | null;
    },
  });
}

export function useCertificationPlanForMinute(minuteId: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!minuteId && !!tenantId,
    queryKey: ["certification_plan", tenantId, "forMinute", minuteId],
    queryFn: async (): Promise<CertificationPlan> => {
      const { data: minute, error: minuteError } = await supabase
        .from("minutes")
        .select("meeting_id")
        .eq("id", minuteId!)
        .eq("tenant_id", tenantId!)
        .maybeSingle();
      if (minuteError) throw minuteError;
      if (!minute?.meeting_id) {
        return buildCertificationPlan({ meetingId: "no-meeting", quorumData: null, resolutions: [] });
      }

      const [meetingRes, resolutionsRes] = await Promise.all([
        supabase
          .from("meetings")
          .select("quorum_data")
          .eq("id", minute.meeting_id)
          .eq("tenant_id", tenantId!)
          .maybeSingle(),
        supabase
          .from("meeting_resolutions")
          .select("id, agenda_item_index, agreement_id, resolution_text, status")
          .eq("meeting_id", minute.meeting_id)
          .eq("tenant_id", tenantId!)
          .order("agenda_item_index", { ascending: true }),
      ]);
      if (meetingRes.error) throw meetingRes.error;
      if (resolutionsRes.error) throw resolutionsRes.error;

      return buildCertificationPlan({
        meetingId: minute.meeting_id,
        quorumData: (meetingRes.data as { quorum_data?: Record<string, unknown> | null } | null)?.quorum_data ?? null,
        resolutions: (resolutionsRes.data ?? []) as CertificationResolutionRow[],
      });
    },
  });
}

export function useCertificationsByMinute(minuteId: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!minuteId && !!tenantId,
    queryKey: ["certifications", tenantId, "byMinute", minuteId],
    queryFn: async (): Promise<CertificationRow[]> => {
      const { data, error } = await supabase
        .from("certifications")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("minute_id", minuteId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CertificationRow[];
    },
  });
}

export function useAuthoritativeLegalEvidence(
  sourceDomain: "MINUTE" | "CERTIFICATION",
  sourceId?: string | null,
  finalLegalArtifactId?: string | null,
) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!tenantId && !!sourceId,
    queryKey: [
      "secretaria_authoritative_evidence",
      tenantId,
      sourceDomain,
      sourceId,
      finalLegalArtifactId ?? "current",
    ],
    queryFn: async (): Promise<AuthoritativeEvidenceState> => {
      let artifactQuery = supabase
        .from("secretaria_legal_artifacts")
        .select(
          "id, tenant_id, source_domain, source_id, artifact_kind, content_hash_sha256, binary_hash_sha256, binary_hash_sha512, signature_packaging, evidence_mode, evidence_bundle_id, artifact_status, immutable_at",
        )
        .eq("tenant_id", tenantId!)
        .eq("source_domain", sourceDomain)
        .eq("source_id", sourceId!)
        .order("immutable_at", { ascending: false })
        .limit(1);
      if (finalLegalArtifactId) {
        artifactQuery = artifactQuery.eq("id", finalLegalArtifactId);
      }

      const { data: artifactRows, error: artifactError } = await artifactQuery;
      if (artifactError) {
        throw secretariaOperationError(
          artifactError,
          "No se pudo comprobar el artefacto jurídico final.",
        );
      }
      const artifact = ((artifactRows ?? [])[0] ?? null) as AuthoritativeLegalArtifact | null;
      if (!artifact) return { artifact: null, verifications: [] };

      const { data: evidenceRows, error: evidenceError } = await supabase
        .from("secretaria_ead_interposition_evidence")
        .select(
          "id, tenant_id, legal_artifact_id, subject_person_id, subject_role, evidence_purpose, provider, provider_mode, provider_reference, provider_status, evidence_bundle_id, signature_claim, verified_at",
        )
        .eq("tenant_id", tenantId!)
        .eq("legal_artifact_id", artifact.id)
        .in("evidence_purpose", ["CONSENT", "CONSTANCIA"])
        .order("verified_at", { ascending: true });
      if (evidenceError) {
        throw secretariaOperationError(
          evidenceError,
          "No se pudieron comprobar los consentimientos y constancias de EAD Trust.",
        );
      }

      type EvidenceRaw = {
        id: string;
        tenant_id: string;
        legal_artifact_id: string;
        subject_person_id: string;
        subject_role: AuthoritativeEadEvidence["signer_role"];
        evidence_purpose: AuthoritativeEadEvidence["evidence_purpose"];
        provider: "EAD_TRUST";
        provider_mode: "INTERPOSITION";
        provider_reference: string;
        provider_status: "COMPLETED" | "VERIFIED";
        evidence_bundle_id: string;
        signature_claim: false;
        verified_at: string;
      };
      const evidences: AuthoritativeEadEvidence[] = ((evidenceRows ?? []) as EvidenceRaw[])
        .map((row) => ({
          id: row.id,
          tenant_id: row.tenant_id,
          legal_artifact_id: row.legal_artifact_id,
          signer_person_id: row.subject_person_id,
          signer_role: row.subject_role,
          evidence_purpose: row.evidence_purpose,
          provider: row.provider,
          provider_mode: row.provider_mode,
          provider_reference: row.provider_reference,
          provider_evidence_bundle_id: row.evidence_bundle_id,
          signature_claim: row.signature_claim,
          verification_status: "VERIFIED",
          verified_at: row.verified_at,
        }));

      return {
        artifact,
        verifications: evidences,
      };
    },
  });
}

export interface AprobarActaResult {
  minute_id: string;
  approval_evidenced_at: string;
  final_legal_artifact_id: string;
  president_consent_evidence_id: string;
  secretary_constancia_evidence_id: string;
  evidence_mode: "INTERPOSITION";
  signature_claim: false;
  canonical_gate_status: "APPROVED_EVIDENCED";
  already_evidenced: boolean;
}

/**
 * Promueve el acta exclusivamente mediante el gate autoritativo: artefacto
 * final inmutable, consentimientos individuales EAD Trust de Presidencia y
 * Secretaría y destino de libro resuelto. `signed_at` es un resultado del RPC,
 * nunca la prueba que habilita la operación.
 */
export function useAprobarActa(minuteId: string | undefined) {
  const { tenantId } = useTenantContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      finalLegalArtifactId: string;
      approvalMethod: MinuteApprovalMethod;
      approvalEffectiveAt: string;
      presidentConsentVerificationId: string;
      secretaryConsentVerificationId: string;
    }) => {
      if (!minuteId) throw new Error("Acta no disponible.");
      const { data, error } = await supabase.rpc("fn_aprobar_acta_autoritativa", {
        p_minute_id: minuteId,
        p_final_legal_artifact_id: params.finalLegalArtifactId,
        p_approval_method: params.approvalMethod,
        p_approval_effective_at: params.approvalEffectiveAt,
        p_president_consent_verification_id: params.presidentConsentVerificationId,
        p_secretary_consent_verification_id: params.secretaryConsentVerificationId,
      });
      if (error) {
        throw secretariaOperationError(error, "No se pudo aprobar el acta con evidencia EAD.");
      }
      return data as AprobarActaResult;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["actas", tenantId] });
    },
  });
}

export function useGenerateAuthoritativeCertification(minuteId: string | undefined) {
  const { tenantId } = useTenantContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      tipo: string;
      agreementIds: string[];
      certificanteRole: string;
      vistoBuenoPersonaId?: string | null;
    }) => {
      if (!minuteId) throw new Error("Acta no disponible.");
      const { data, error } = await supabase.rpc("fn_generar_certificacion", {
        p_minute_id: minuteId,
        p_tipo: params.tipo,
        p_agreements_certified: params.agreementIds,
        p_certificante_role: params.certificanteRole,
        p_visto_bueno_persona_id: params.vistoBuenoPersonaId ?? null,
      });
      if (error) {
        throw secretariaOperationError(
          error,
          "No se pudo preparar la certificación autoritativa.",
        );
      }
      return String(data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["certifications", tenantId, "byMinute", minuteId],
      });
    },
  });
}

export function useSetCertificationDraftContent(minuteId: string | undefined) {
  const { tenantId } = useTenantContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { certificationId: string; content: string }) => {
      const { data, error } = await supabase.rpc(
        "fn_actualizar_borrador_certificacion",
        {
          p_certification_id: params.certificationId,
          p_content: params.content,
        },
      );
      if (error) {
        throw secretariaOperationError(
          error,
          "No se pudo persistir el cuerpo de la certificación.",
        );
      }
      const result = data as { certification_id?: string } | null;
      if (!result?.certification_id) {
        throw new Error(
          "La certificación ya no está en estado borrador o no pertenece al expediente actual.",
        );
      }
      return String(result.certification_id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["certifications", tenantId, "byMinute", minuteId],
      });
    },
  });
}

export interface FirmarCertificacionAutoritativaResult {
  certification_id: string;
  canonical_gate_status: "CONSTANCIA_VERIFIED";
  evidence_mode: "INTERPOSITION";
  signature_claim: false;
  certifier_constancia_evidence_id: string;
  visto_bueno_constancia_evidence_id: string | null;
  evidence_binding_hash_sha256: string;
  already_evidenced: boolean;
}

export function useFirmarCertificacionAutoritativa(
  minuteId: string | undefined,
  certificationId: string | undefined,
) {
  const { tenantId } = useTenantContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      finalLegalArtifactId: string;
      certifierVerificationId: string;
      vistoBuenoVerificationId?: string | null;
    }) => {
      if (!certificationId) throw new Error("Certificación no disponible.");
      const { data, error } = await supabase.rpc(
        "fn_firmar_certificacion_autoritativa",
        {
          p_certification_id: certificationId,
          p_final_legal_artifact_id: params.finalLegalArtifactId,
          p_certifier_qtsp_verification_id: params.certifierVerificationId,
          p_visto_bueno_qtsp_verification_id:
            params.vistoBuenoVerificationId ?? null,
        },
      );
      if (error) {
        throw secretariaOperationError(
          error,
          "No se pudo validar la evidencia EAD de la certificación.",
        );
      }
      return data as FirmarCertificacionAutoritativaResult;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["certifications", tenantId, "byMinute", minuteId],
        }),
        queryClient.invalidateQueries({
          queryKey: [
            "secretaria_authoritative_evidence",
            tenantId,
            "CERTIFICATION",
            certificationId,
          ],
        }),
      ]);
    },
  });
}

export function useEmitirCertificacionAutoritativa(
  minuteId: string | undefined,
  certificationId: string | undefined,
) {
  const { tenantId } = useTenantContext();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!certificationId) throw new Error("Certificación no disponible.");
      const { data, error } = await supabase.rpc("fn_emitir_certificacion", {
        p_certification_id: certificationId,
      });
      if (error) {
        throw secretariaOperationError(
          error,
          "No se pudo emitir la certificación autoritativa.",
        );
      }
      return String(data);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["certifications", tenantId, "byMinute", minuteId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["certification_plan", tenantId, "forMinute", minuteId],
        }),
      ]);
    },
  });
}

export interface UpdateActaBorradorResult {
  minute_id: string;
  content_hash: string;
  updated: boolean;
}

/**
 * W0 — guarda la edición del contenido de un acta en BORRADOR vía
 * `fn_actualizar_borrador_acta`. La RPC recalcula `content_hash` con el mismo
 * algoritmo que `fn_generar_acta` y rechaza el acta firmada/bloqueada. Cierra la
 * incidencia de la primera pasada de test: hasta ahora no existía ningún camino
 * para editar y persistir el texto del acta (ActaDetalle era read-only).
 */
export function useUpdateActaBorrador(minuteId: string | undefined) {
  const { tenantId } = useTenantContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (content: string): Promise<UpdateActaBorradorResult> => {
      if (!minuteId) throw new Error("Acta no disponible.");
      const { data, error } = await supabase.rpc("fn_actualizar_borrador_acta", {
        p_minute_id: minuteId,
        p_content: content,
      });
      if (error) throw error;
      return data as UpdateActaBorradorResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["actas", tenantId] });
    },
  });
}

export interface MaterializeMeetingPointAgreementInput {
  meetingId: string;
  bodyId: string | null;
  entityId: string | null;
  scheduledStart?: string | null;
  snapshot: MeetingAdoptionSnapshot;
  origin?: AgreementOrigin;
}

export function useMaterializeMeetingPointAgreement(minuteId: string | undefined) {
  const { tenantId } = useTenantContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: MaterializeMeetingPointAgreementInput) => {
      if (!tenantId) throw new Error("Tenant activo no disponible.");
      if (!input.entityId || !input.bodyId) {
        throw new Error("No se puede materializar el acuerdo: falta entidad u órgano.");
      }

      const agendaItemIndex = input.snapshot.agenda_item_index;
      const { data: agendaItem, error: agendaItemError } = await supabase
        .from("agenda_items")
        .select("id, kind")
        .eq("tenant_id", tenantId)
        .eq("meeting_id", input.meetingId)
        .eq("order_number", agendaItemIndex)
        .maybeSingle();
      if (agendaItemError) throw agendaItemError;
      const agendaItemRow = agendaItem as { id?: string | null; kind?: string | null } | null;
      if (!agendaItemRow?.id) {
        throw new Error("No existe el punto del orden del día que debe anclar el acuerdo.");
      }
      if (agendaItemRow.kind !== "DECISORIO") {
        throw new Error("Solo un punto decisorio puede materializarse como Acuerdo 360.");
      }

      const { data: resolutionRows, error: resolutionError } = await supabase
        .from("meeting_resolutions")
        .select("id, agenda_item_index, agreement_id, resolution_text, required_majority_code, status")
        .eq("tenant_id", tenantId)
        .eq("meeting_id", input.meetingId)
        .eq("agenda_item_index", agendaItemIndex)
        .limit(1);
      if (resolutionError) throw resolutionError;
      const resolution = (resolutionRows ?? [])[0] as
        | {
            id: string;
            agreement_id: string | null;
            resolution_text: string | null;
            required_majority_code: string | null;
          }
        | undefined;

      if (!resolution) {
        throw new Error("No existe la resolución persistida del punto. Registre primero la votación de la reunión.");
      }
      if (resolution.agreement_id) {
        return {
          agreementId: resolution.agreement_id,
          agendaItemIndex,
          created: false,
          linkedExistingResolution: true,
        };
      }

      const { data: existingAgreements, error: existingAgreementsError } = await supabase
        .from("agreements")
        .select("id, execution_mode")
        .eq("tenant_id", tenantId)
        .eq("parent_meeting_id", input.meetingId);
      if (existingAgreementsError) throw existingAgreementsError;

      const existingAgreementId = ((existingAgreements ?? []) as Array<{ id: string; execution_mode?: unknown }>)
        .find((agreement) => extractAgendaItemIndexFromExecutionMode(agreement.execution_mode) === agendaItemIndex)
        ?.id ?? null;

      const payload = buildMeetingAgreementPayload({
        tenantId,
        entityId: input.entityId,
        bodyId: input.bodyId,
        meetingId: input.meetingId,
        scheduledStart: input.scheduledStart,
        snapshot: input.snapshot,
        resolutionText: resolution.resolution_text,
        requiredMajorityCode: requiredMajorityCodeForSnapshot(input.snapshot, resolution.required_majority_code),
        origin: input.origin ?? "MEETING_FLOOR",
        agendaItemId: agendaItemRow.id,
      });
      if (!payload) {
        throw new Error("El punto no es societariamente proclamable y no puede materializarse como Acuerdo 360.");
      }

      let agreementId = existingAgreementId;
      if (agreementId) {
        const { error: updateError } = await supabase
          .from("agreements")
          .update(payload)
          .eq("tenant_id", tenantId)
          .eq("id", agreementId);
        if (updateError) throw updateError;
      } else {
        const { data: insertedAgreement, error: insertError } = await supabase
          .from("agreements")
          .insert(payload)
          .select("id")
          .single();
        if (insertError) throw insertError;
        agreementId = (insertedAgreement as { id: string }).id;
      }

      const { error: linkError } = await supabase
        .from("meeting_resolutions")
        .update({
          agreement_id: agreementId,
          status: "ADOPTED",
          resolution_text: input.snapshot.resolution_text,
          required_majority_code: requiredMajorityCodeForSnapshot(input.snapshot, resolution.required_majority_code),
        })
        .eq("tenant_id", tenantId)
        .eq("id", resolution.id);
      if (linkError) throw linkError;

      return {
        agreementId,
        agendaItemIndex,
        created: !existingAgreementId,
        linkedExistingResolution: false,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["certification_plan", tenantId, "forMinute", minuteId] });
      queryClient.invalidateQueries({ queryKey: ["actas", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["meeting_resolutions", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["agreements", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["certification_registry_intake", tenantId] });
    },
  });
}

// =============================================================================
// P0 — Acta cronológica agenda-driven.
// =============================================================================
//
// El acta se construye desde `agenda_items ORDER BY order_number`, no desde
// `agreements`. Un `agreement` es únicamente el resultado posible de un punto
// DECISORIO. Puntos informativos, tomas de razón, deliberativos, aceptación de
// informe y ruegos/preguntas se documentan como constancia.

export type ActaPuntoSequencial = ActaAgendaItemViewModel;
export type AgendaItemRow = ActaAgendaItemRow;
export type MeetingResolutionRow = ActaMeetingResolutionRow;

export interface ActaAgendaContract {
  puntos: ActaAgendaItemViewModel[];
  validation: ActaLegalStructureValidationResult;
  canonicalMinutesHash: string;
  agreementRows: ActaAgreementRow[];
}

/**
 * Construye el array de puntos del acta preservando el orden cronológico
 * exigido por RRM art. 99. NUNCA reagrupa por `kind`.
 *
 * Reglas:
 *  1. Ordena por `order_number` ASC (estable, no por kind).
 *  2. Para cada punto, busca su resolución por `agenda_item_index === order_number`.
 *  3. Si hay resolución → enriquece con `kind_resolution`, `status`,
 *     `resolution_text`, `agreement_id`. Si no → campos null (degradación elegante).
 *  4. `kind` normalizado via `normalizeAgendaItemKind` (default DELIBERATIVO).
 *
 * Función PURA: sin efectos secundarios, sin Supabase, sin Tanstack.
 * Reutilizable por tests, plantillas y previsualización de acta.
 */
export function buildActaPuntosSequencial(
  agendaItems: AgendaItemRow[],
  resolutions: MeetingResolutionRow[],
): ActaPuntoSequencial[] {
  return buildActaAgendaViewModel({ agendaItems, resolutions });
}

async function loadActaAgendaContract(params: {
  tenantId: string;
  meetingId: string;
}): Promise<ActaAgendaContract> {
  const [itemsRes, resolutionsRes, constanciasRes, meetingRes, agreementsRes] = await Promise.all([
    supabase
      .from("agenda_items")
      .select("id, meeting_id, order_number, title, description, kind, requires_vote, requires_attachments, tenant_id, created_at")
      .eq("meeting_id", params.meetingId)
      .eq("tenant_id", params.tenantId)
      .order("order_number", { ascending: true }),
    supabase
      .from("meeting_resolutions")
      .select("id, meeting_id, agenda_item_index, kind_resolution, status, resolution_text, agreement_id, required_majority_code")
      .eq("meeting_id", params.meetingId)
      .eq("tenant_id", params.tenantId),
    supabase
      .from("agenda_item_constancias")
      .select("id, agenda_item_id, meeting_id, kind, summary, participants, follow_ups, attachments")
      .eq("meeting_id", params.meetingId)
      .eq("tenant_id", params.tenantId),
    supabase
      .from("meetings")
      .select("quorum_data")
      .eq("id", params.meetingId)
      .eq("tenant_id", params.tenantId)
      .maybeSingle(),
    supabase
      .from("agreements")
      .select("id, parent_meeting_id, agenda_item_id, status, proposal_text, decision_text")
      .eq("parent_meeting_id", params.meetingId)
      .eq("tenant_id", params.tenantId),
  ]);
  if (itemsRes.error) throw itemsRes.error;
  if (resolutionsRes.error) throw resolutionsRes.error;
  if (constanciasRes.error) throw constanciasRes.error;
  if (meetingRes.error) throw meetingRes.error;
  if (agreementsRes.error) throw agreementsRes.error;

  const agendaItems = (itemsRes.data ?? []) as ActaAgendaItemRow[];
  const resolutions = (resolutionsRes.data ?? []) as ActaMeetingResolutionRow[];
  const constancias = (constanciasRes.data ?? []) as ActaAgendaConstanciaRow[];
  const agreementRows = (agreementsRes.data ?? []) as ActaAgreementRow[];
  const snapshots = extractPointSnapshots(
    (meetingRes.data as { quorum_data?: Record<string, unknown> | null } | null)?.quorum_data ?? null,
  );
  const quorumData =
    (meetingRes.data as { quorum_data?: Record<string, unknown> | null } | null)?.quorum_data ?? null;
  const debates = Array.isArray(quorumData?.debates)
    ? (quorumData.debates as ActaAgendaDebateRow[])
    : [];
  const puntos = buildActaAgendaViewModel({
    agendaItems,
    resolutions,
    constancias,
    snapshots,
    debates,
    agreementRows,
  });
  const validation = validateActaLegalStructure({
    meetingId: params.meetingId,
    puntos,
    agendaItems,
    agreementRows,
    renderedOrderNumbers: puntos.map((point) => point.order_number),
  });
  const canonicalMinutesHash = await computeCanonicalMinutesHash({
    meetingId: params.meetingId,
    puntos,
  });

  return { puntos, validation, canonicalMinutesHash, agreementRows };
}

export function useActaAgendaContract(meetingId: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!meetingId && !!tenantId,
    queryKey: ["actas", tenantId, "agenda_contract", meetingId],
    queryFn: () => loadActaAgendaContract({ tenantId: tenantId!, meetingId: meetingId! }),
  });
}

/**
 * Hook derivado: carga `agenda_items` + `meeting_resolutions` para un
 * meeting y devuelve los puntos en ORDEN SECUENCIAL para el loop de la
 * plantilla ACTA_SESION.
 *
 * Wrapper read-only sobre `buildActaPuntosSequencial` con tenant scoping
 * y queryKey estable.
 */
export function useActaPuntosSequencial(meetingId: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!meetingId && !!tenantId,
    queryKey: ["actas", tenantId, "puntos_sequencial", meetingId],
    queryFn: async (): Promise<ActaPuntoSequencial[]> => {
      const contract = await loadActaAgendaContract({ tenantId: tenantId!, meetingId: meetingId! });
      return contract.puntos;
    },
  });
}
