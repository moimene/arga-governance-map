import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTenantContext } from "@/context/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { archiveAnnualAccountsComponentWithEADTrust } from "@/lib/qtsp/qtsp-proxy-client";

export const ANNUAL_ACCOUNTS_COMPONENTS = [
  "BALANCE_SHEET",
  "PROFIT_AND_LOSS_STATEMENT",
  "NOTES",
  "CHANGES_IN_EQUITY_STATEMENT",
  "CASH_FLOW_STATEMENT",
  "MANAGEMENT_REPORT",
] as const;

export type AnnualAccountsComponentKind = (typeof ANNUAL_ACCOUNTS_COMPONENTS)[number];

export const ANNUAL_ACCOUNTS_COMPONENT_LABELS: Record<AnnualAccountsComponentKind, string> = {
  BALANCE_SHEET: "Balance",
  PROFIT_AND_LOSS_STATEMENT: "Cuenta de pérdidas y ganancias",
  NOTES: "Memoria",
  CHANGES_IN_EQUITY_STATEMENT: "Estado de cambios en el patrimonio neto",
  CASH_FLOW_STATEMENT: "Estado de flujos de efectivo",
  MANAGEMENT_REPORT: "Informe de gestión",
};

type EvidenceBinary = {
  artifact_role?: string | null;
  component_kind?: string | null;
  hash_sha256?: string | null;
  hash_sha512?: string | null;
  storage_path?: string | null;
  storage_object_id?: string | null;
  storage_version?: string | null;
};

type EvidenceSource = {
  tenant_id?: string | null;
  entity_id?: string | null;
  body_id?: string | null;
  meeting_id?: string | null;
  agenda_item_id?: string | null;
  matter_code?: string | null;
  fiscal_year?: number | null;
};

export interface AnnualAccountsEvidenceCandidate {
  id: string;
  referenceCode: string | null;
  status: string;
  manifestHash: string;
  storagePath: string;
  binary: Required<EvidenceBinary>;
  source: Required<EvidenceSource>;
}

export interface AnnualAccountsSetHead {
  id: string;
  meeting_id: string;
  agenda_item_id: string;
  fiscal_year: number;
  is_consolidated: boolean;
  cash_flow_statement_applicable: boolean;
  management_report_applicable: boolean;
  version_number: number;
  supersedes_set_id: string | null;
  approval_status: "APPROVED";
  immutability_status: "IMMUTABLE";
  manifest_hash_sha256: string;
  approved_at: string;
  immutable_at: string;
  components: Array<{
    id: string;
    component_kind: AnnualAccountsComponentKind;
    required_for_set: boolean;
    content_hash_sha256: string;
    content_hash_sha512: string;
    evidence_bundle_id: string;
    storage_object_id: string;
    storage_version: string;
  }>;
}

type RawEvidenceBundle = {
  id: string;
  reference_code?: string | null;
  status?: string | null;
  manifest?: Record<string, unknown> | null;
  manifest_hash?: string | null;
  storage_path?: string | null;
  legal_hold?: boolean | null;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function evidenceBinary(manifest: unknown): EvidenceBinary {
  const root = record(manifest);
  const direct = record(root.binary);
  if (Object.keys(direct).length > 0) return direct as EvidenceBinary;
  return record(record(root.payload).binary) as EvidenceBinary;
}

function evidenceSource(manifest: unknown): EvidenceSource {
  return record(record(manifest).source) as EvidenceSource;
}

function isSha(value: unknown, length: number): value is string {
  return typeof value === "string" && new RegExp(`^[0-9a-f]{${length}}$`).test(value);
}

function toCandidate(
  row: RawEvidenceBundle,
  expected?: { tenantId: string; meetingId: string; agendaItemId: string; fiscalYear: number },
): AnnualAccountsEvidenceCandidate | null {
  const binary = evidenceBinary(row.manifest);
  const source = evidenceSource(row.manifest);
  const verification = record(record(row.manifest).verification);
  if (
    row.legal_hold !== true ||
    row.status !== "VERIFIED" ||
    !isSha(row.manifest_hash, 64) ||
    typeof row.storage_path !== "string" ||
    !row.storage_path ||
    binary.artifact_role !== "ANNUAL_ACCOUNTS_COMPONENT" ||
    !ANNUAL_ACCOUNTS_COMPONENTS.includes(binary.component_kind as AnnualAccountsComponentKind) ||
    !isSha(binary.hash_sha256, 64) ||
    !isSha(binary.hash_sha512, 128) ||
    binary.storage_path !== row.storage_path ||
    typeof binary.storage_object_id !== "string" ||
    !binary.storage_object_id ||
    typeof binary.storage_version !== "string" ||
    !binary.storage_version ||
    source.matter_code !== "FORMULACION_CUENTAS" ||
    typeof source.tenant_id !== "string" ||
    typeof source.entity_id !== "string" ||
    typeof source.body_id !== "string" ||
    typeof source.meeting_id !== "string" ||
    typeof source.agenda_item_id !== "string" ||
    !Number.isInteger(source.fiscal_year) ||
    verification.provider !== "EAD_TRUST" ||
    verification.service !== "EVIDENCE_MANAGER" ||
    verification.provider_status !== "COMPLETED" ||
    verification.signature_claim !== false ||
    verification.sandbox !== false ||
    (
      expected !== undefined && (
        source.tenant_id !== expected.tenantId ||
        source.meeting_id !== expected.meetingId ||
        source.agenda_item_id !== expected.agendaItemId ||
        source.fiscal_year !== expected.fiscalYear
      )
    )
  ) {
    return null;
  }

  return {
    id: row.id,
    referenceCode: row.reference_code ?? null,
    status: row.status!,
    manifestHash: row.manifest_hash,
    storagePath: row.storage_path,
    binary: binary as Required<EvidenceBinary>,
    source: source as Required<EvidenceSource>,
  };
}

export function useAnnualAccountsEvidenceCandidates(
  meetingId?: string,
  agendaItemId?: string,
  fiscalYear?: number,
) {
  const { tenantId } = useTenantContext();
  const enabled = !!tenantId && !!meetingId && !!agendaItemId && Number.isInteger(fiscalYear);
  return useQuery({
    queryKey: [
      "secretaria",
      tenantId,
      "annual-accounts",
      meetingId,
      agendaItemId,
      fiscalYear,
      "evidence-candidates",
    ],
    enabled,
    queryFn: async (): Promise<AnnualAccountsEvidenceCandidate[]> => {
      const { data, error } = await supabase
        .from("evidence_bundles")
        .select("id, reference_code, status, manifest, manifest_hash, storage_path, legal_hold")
        .eq("tenant_id", tenantId!)
        .eq("source_module", "secretaria")
        .eq("source_object_type", "ANNUAL_ACCOUNTS_COMPONENT")
        .eq("source_object_id", agendaItemId!)
        .eq("legal_hold", true)
        .eq("status", "VERIFIED")
        .not("manifest", "is", null)
        .not("storage_path", "is", null)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return ((data ?? []) as RawEvidenceBundle[])
        .map((row) => toCandidate(row, {
          tenantId: tenantId!,
          meetingId: meetingId!,
          agendaItemId: agendaItemId!,
          fiscalYear: fiscalYear!,
        }))
        .filter((candidate): candidate is AnnualAccountsEvidenceCandidate => candidate !== null);
    },
  });
}

export interface ArchiveAnnualAccountsComponentInput {
  meetingId: string;
  agendaItemId: string;
  fiscalYear: number;
  componentKind: AnnualAccountsComponentKind;
  artifact: File;
}

export function useArchiveAnnualAccountsComponent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ArchiveAnnualAccountsComponentInput) => {
      const result = await archiveAnnualAccountsComponentWithEADTrust({
        meetingId: input.meetingId,
        agendaItemId: input.agendaItemId,
        fiscalYear: input.fiscalYear,
        componentKind: input.componentKind,
        documentData: await input.artifact.arrayBuffer(),
        documentName: input.artifact.name,
        mimeType: input.artifact.type || "application/octet-stream",
      });
      if (!result) {
        throw new Error(
          "Evidence Manager no está disponible o el cortafuegos de pruebas impide el envío.",
        );
      }
      return result;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["secretaria"] });
    },
  });
}

export function useAnnualAccountsSetHead(meetingId?: string, agendaItemId?: string | null) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["secretaria", tenantId, "annual-accounts", meetingId, agendaItemId, "head"],
    enabled: !!tenantId && !!meetingId && !!agendaItemId,
    queryFn: async (): Promise<AnnualAccountsSetHead | null> => {
      const { data: sets, error: setError } = await supabase
        .from("secretaria_annual_accounts_sets")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("meeting_id", meetingId!)
        .eq("agenda_item_id", agendaItemId!)
        .order("version_number", { ascending: false });
      if (setError) throw setError;
      const rows = (sets ?? []) as Omit<AnnualAccountsSetHead, "components">[];
      if (rows.length === 0) return null;
      const superseded = new Set(rows.map((row) => row.supersedes_set_id).filter(Boolean));
      const head = rows.find((row) => !superseded.has(row.id));
      if (!head) throw new Error("No se pudo resolver una única versión vigente de las cuentas.");

      const { data: components, error: componentsError } = await supabase
        .from("secretaria_annual_accounts_components")
        .select(
          "id, component_kind, required_for_set, content_hash_sha256, content_hash_sha512, evidence_bundle_id, storage_object_id, storage_version",
        )
        .eq("tenant_id", tenantId!)
        .eq("annual_accounts_set_id", head.id)
        .order("component_kind");
      if (componentsError) throw componentsError;
      return {
        ...head,
        components: (components ?? []) as AnnualAccountsSetHead["components"],
      };
    },
  });
}

export interface FixAnnualAccountsSetInput {
  meetingId: string;
  agendaItemId: string;
  fiscalYear: number;
  isConsolidated: boolean;
  cashFlowStatementApplicable: boolean;
  managementReportApplicable: boolean;
  selections: Partial<Record<AnnualAccountsComponentKind, AnnualAccountsEvidenceCandidate>>;
  supersedesSetId?: string | null;
}

export function useFixAnnualAccountsSet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: FixAnnualAccountsSetInput) => {
      const components = ANNUAL_ACCOUNTS_COMPONENTS.flatMap((kind) => {
        const candidate = input.selections[kind];
        if (!candidate) return [];
        return [{
          component_kind: kind,
          evidence_bundle_id: candidate.id,
          content_hash_sha256: candidate.binary.hash_sha256,
          content_hash_sha512: candidate.binary.hash_sha512,
          storage_path: candidate.storagePath,
          storage_object_id: candidate.binary.storage_object_id,
          storage_version: candidate.binary.storage_version,
        }];
      });
      const { data, error } = await supabase.rpc("fn_secretaria_fix_annual_accounts_set", {
        p_meeting_id: input.meetingId,
        p_agenda_item_id: input.agendaItemId,
        p_fiscal_year: input.fiscalYear,
        p_is_consolidated: input.isConsolidated,
        p_cash_flow_statement_applicable: input.cashFlowStatementApplicable,
        p_management_report_applicable: input.managementReportApplicable,
        p_components: components,
        p_supersedes_set_id: input.supersedesSetId ?? null,
      });
      if (error) throw error;
      return data as {
        set_id: string;
        version_number: number;
        approval_status: "APPROVED";
        immutability_status: "IMMUTABLE";
        manifest_hash_sha256: string;
        component_count: number;
      };
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["secretaria"] });
    },
  });
}

export function useFreezeAnnualAccountsSignerRoster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ setId, snapshotId }: { setId: string; snapshotId: string }) => {
      const { data, error } = await supabase.rpc(
        "fn_secretaria_freeze_annual_accounts_signer_roster",
        { p_annual_accounts_set_id: setId, p_snapshot_id: snapshotId },
      );
      if (error) throw error;
      return data as {
        roster_id: string;
        roster_hash_sha256: string;
        expected_signer_count: number;
        reused: boolean;
      };
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["secretaria"] }),
  });
}

export function useRecordAnnualAccountsMissingSignatureCause() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      expectedSignerId: string;
      causeCode: "DEATH" | "ILLNESS_OR_INCAPACITY" | "DISAGREEMENT" | "UNREACHABLE" | "OTHER_JUSTIFIED";
      causeText: string;
      supersedesOutcomeId?: string | null;
    }) => {
      const { data, error } = await supabase.rpc(
        "fn_secretaria_record_annual_accounts_signer_outcome",
        {
          p_expected_signer_id: input.expectedSignerId,
          p_outcome_type: "MISSING_SIGNATURE_CAUSE",
          p_signature_request_id: null,
          p_provider_evidence_bundle_id: null,
          p_missing_signature_cause_code: input.causeCode,
          p_missing_signature_cause_text: input.causeText,
          p_supersedes_outcome_id: input.supersedesOutcomeId ?? null,
        },
      );
      if (error) throw error;
      return data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["secretaria"] }),
  });
}
