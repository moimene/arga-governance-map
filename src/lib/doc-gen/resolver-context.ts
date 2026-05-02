import type { ResolverContext } from "./variable-resolver";

export interface AgreementResolverContextInput {
  id: string;
  entity_id?: string | null;
  body_id?: string | null;
  parent_meeting_id?: string | null;
  compliance_snapshot?: Record<string, unknown> | null;
}

export function buildAgreementResolverContext(
  agreement: AgreementResolverContextInput,
  tenantId: string,
): ResolverContext {
  return {
    agreementId: agreement.id,
    tenantId,
    entityId: agreement.entity_id ?? undefined,
    bodyId: agreement.body_id ?? undefined,
    meetingId: agreement.parent_meeting_id ?? undefined,
    complianceSnapshot: agreement.compliance_snapshot ?? undefined,
  };
}
