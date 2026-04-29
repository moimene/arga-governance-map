import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import {
  buildCertificationRegistryIntake,
  parseMeetingPointReference,
  type CertificationRegistryIntake,
} from "@/lib/secretaria/certification-registry-intake";

export interface FilingRow {
  id: string;
  tenant_id: string;
  deed_id: string | null;
  filing_via: string | null;
  filing_number: string | null;
  presentation_date: string | null;
  status: string;
  estimated_resolution: string | null;
  inscription_number: string | null;
  borme_ref: string | null;
  psm_ref: string | null;
  siger_ref: string | null;
  conservatoria_ref: string | null;
  jucerja_ref: string | null;
  diario_oficial_ref: string | null;
  defect_details: Record<string, unknown> | null;
  resolution_document_url: string | null;
  created_at: string;
  updated_at: string;
  agreement_id: string | null;
  agreement_entity_id?: string | null;
}

export function useTramitacionesList(entityId?: string | null) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["registry_filings", tenantId, "list", entityId ?? "all"],
    enabled: !!tenantId,
    queryFn: async (): Promise<FilingRow[]> => {
      let agreementIds: string[] | null = null;

      if (entityId) {
        const { data: agreements, error: agreementsError } = await supabase
          .from("agreements")
          .select("id")
          .eq("tenant_id", tenantId!)
          .eq("entity_id", entityId);

        if (agreementsError) throw agreementsError;
        agreementIds = (agreements ?? []).map((agreement) => agreement.id);
        if (agreementIds.length === 0) return [];
      }

      let query = supabase
        .from("registry_filings")
        .select("*, agreements(entity_id)")
        .eq("tenant_id", tenantId!)
        .order("presentation_date", { ascending: false });

      if (agreementIds) {
        query = query.in("agreement_id", agreementIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      type Raw = FilingRow & { agreements?: { entity_id?: string | null } | null };
      return ((data ?? []) as Raw[]).map((row) => ({
        ...row,
        agreement_entity_id: row.agreements?.entity_id ?? null,
      }));
    },
  });
}

export function useTramitacionById(id: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!id && !!tenantId,
    queryKey: ["registry_filings", tenantId, "byId", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registry_filings")
        .select("*, deeds(notary, deed_date, status, content)")
        .eq("id", id!)
        .eq("tenant_id", tenantId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useCertificationRegistryIntake(certificationId: string | null | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    enabled: !!certificationId && !!tenantId,
    queryKey: ["certification_registry_intake", tenantId, certificationId],
    queryFn: async (): Promise<CertificationRegistryIntake | null> => {
      const { data: certification, error: certificationError } = await supabase
        .from("certifications")
        .select("id, tenant_id, agreement_id, agreements_certified, signature_status, evidence_id, minute_id, created_at, gate_hash")
        .eq("id", certificationId!)
        .eq("tenant_id", tenantId!)
        .maybeSingle();
      if (certificationError) throw certificationError;
      if (!certification) return null;

      let minute:
        | { id: string; entity_id: string | null; body_id: string | null; meeting_id: string | null }
        | null = null;
      if ((certification as { minute_id?: string | null }).minute_id) {
        const { data: minuteData, error: minuteError } = await supabase
          .from("minutes")
          .select("id, entity_id, body_id, meeting_id")
          .eq("id", (certification as { minute_id: string }).minute_id)
          .eq("tenant_id", tenantId!)
          .maybeSingle();
        if (minuteError) throw minuteError;
        minute = minuteData as typeof minute;
      }

      const raw = certification as {
        id: string;
        agreement_id?: string | null;
        agreements_certified?: string[] | null;
        signature_status?: string | null;
        evidence_id?: string | null;
        minute_id?: string | null;
        gate_hash?: string | null;
      };
      const parsedPointRefs = (raw.agreements_certified ?? [])
        .map((reference) => ({ reference, parsed: parseMeetingPointReference(reference) }))
        .filter((item): item is { reference: string; parsed: { meetingId: string; agendaItemIndex: number } } =>
          Boolean(item.parsed)
        );
      const resolvedPointAgreementIds: string[] = [];
      let unresolvedPointReferences = parsedPointRefs.map((item) => item.reference);

      if (parsedPointRefs.length > 0) {
        const meetingIds = Array.from(new Set(parsedPointRefs.map((item) => item.parsed.meetingId)));
        const { data: resolutionRows, error: resolutionError } = await supabase
          .from("meeting_resolutions")
          .select("meeting_id, agenda_item_index, agreement_id")
          .eq("tenant_id", tenantId!)
          .in("meeting_id", meetingIds);
        if (resolutionError) throw resolutionError;

        const pointAgreementByRef = new Map<string, string>();
        for (const row of (resolutionRows ?? []) as Array<{
          meeting_id: string;
          agenda_item_index: number;
          agreement_id: string | null;
        }>) {
          const ref = `meeting:${row.meeting_id}:point:${row.agenda_item_index}`;
          if (row.agreement_id) pointAgreementByRef.set(ref, row.agreement_id);
        }

        for (const item of parsedPointRefs) {
          const agreementId = pointAgreementByRef.get(item.reference);
          if (agreementId) resolvedPointAgreementIds.push(agreementId);
        }
        unresolvedPointReferences = parsedPointRefs
          .map((item) => item.reference)
          .filter((reference) => !pointAgreementByRef.has(reference));
      }

      return buildCertificationRegistryIntake({
        id: raw.id,
        minuteId: raw.minute_id,
        agreementId: raw.agreement_id,
        agreementsCertified: raw.agreements_certified,
        resolvedPointAgreementIds,
        unresolvedPointReferences,
        signatureStatus: raw.signature_status,
        evidenceId: raw.evidence_id,
        gateHash: raw.gate_hash,
        entityId: minute?.entity_id ?? null,
        bodyId: minute?.body_id ?? null,
        meetingId: minute?.meeting_id ?? null,
      });
    },
  });
}
