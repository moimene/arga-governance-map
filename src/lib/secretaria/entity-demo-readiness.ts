export type DemoReadinessStatus = "complete" | "partial" | "reference_only";

export type DemoReadinessReason =
  | "no_cap_table"
  | "cap_table_not_100"
  | "no_governing_body"
  | "no_active_positions"
  | "no_authority_evidence"
  | "no_compatible_templates"
  | "no_census";

export type DemoReadinessInput = {
  capitalHoldings?: Array<{ porcentaje_capital?: number | null; effective_to?: string | null }>;
  governingBodies?: Array<{ id: string }>;
  activePositions?: Array<{ id: string }>;
  authorityEvidence?: Array<{ id: string }>;
  compatibleTemplates?: Array<{ id: string }>;
  meetings?: Array<{ id: string }>;
  censusSnapshots?: Array<{ id: string }>;
};

export type DemoReadiness = {
  status: DemoReadinessStatus;
  reasons: DemoReadinessReason[];
};

export function classifyEntityDemoReadiness(input: DemoReadinessInput): DemoReadiness {
  const activeHoldings = (input.capitalHoldings ?? []).filter((holding) => holding.effective_to == null);
  const capSum = activeHoldings.reduce((sum, holding) => sum + Number(holding.porcentaje_capital ?? 0), 0);
  const reasons: DemoReadinessReason[] = [];

  if (activeHoldings.length === 0) reasons.push("no_cap_table");
  else if (Math.abs(capSum - 100) > 0.05) reasons.push("cap_table_not_100");

  if ((input.governingBodies ?? []).length === 0) reasons.push("no_governing_body");
  if ((input.activePositions ?? []).length === 0) reasons.push("no_active_positions");
  if ((input.authorityEvidence ?? []).length === 0) reasons.push("no_authority_evidence");
  if ((input.compatibleTemplates ?? []).length === 0) reasons.push("no_compatible_templates");
  if ((input.meetings ?? []).length > 0 && (input.censusSnapshots ?? []).length < (input.meetings ?? []).length) {
    reasons.push("no_census");
  }

  const hardReferenceReasons: DemoReadinessReason[] = [
    "no_cap_table",
    "no_governing_body",
    "no_active_positions",
    "no_authority_evidence",
  ];
  const status: DemoReadinessStatus =
    reasons.length === 0
      ? "complete"
      : reasons.some((reason) => hardReferenceReasons.includes(reason))
        ? "reference_only"
        : "partial";

  return { status, reasons };
}

export const DEMO_READINESS_REASON_LABELS: Record<DemoReadinessReason, string> = {
  no_cap_table: "sin socios o cap table vigente",
  cap_table_not_100: "cap table vigente no suma 100%",
  no_governing_body: "sin órgano social operativo",
  no_active_positions: "sin cargos o mandatos vigentes",
  no_authority_evidence: "sin authority evidence certificante",
  no_compatible_templates: "sin plantillas compatibles",
  no_census: "sin snapshot/censo vigente",
};

export function demoReadinessMessage(readiness: DemoReadiness) {
  if (readiness.status !== "reference_only") return null;
  const reasons = readiness.reasons.map((reason) => DEMO_READINESS_REASON_LABELS[reason]).join(", ");
  return `Esta sociedad aún no tiene censo/órgano/cargos suficientes para este flujo (${reasons}).`;
}

export type ScopeBody = {
  id: string;
  entity_id?: string | null;
  body_type?: string | null;
  name?: string | null;
  config?: Record<string, unknown> | null;
};

export type ScopeMeeting = {
  id: string;
  body_id?: string | null;
};

export type ScopeNoSessionResolution = {
  id: string;
  body_id?: string | null;
};

export type ScopeAgreement = {
  id: string;
  entity_id?: string | null;
  body_id?: string | null;
  parent_meeting_id?: string | null;
  no_session_resolution_id?: string | null;
  adoption_mode?: string | null;
  agreement_kind?: string | null;
};

export type AgreementScopePatchResult =
  | { ok: true; patch: { entity_id?: string; body_id?: string }; source: string }
  | { ok: false; reason: "no_candidate" | "ambiguous" | "conflict"; candidateCount: number };

function uniqueCandidateKey(candidate: { entity_id: string; body_id: string }) {
  return `${candidate.entity_id}:${candidate.body_id}`;
}

function matchingBodiesFromAgreementKind(agreement: ScopeAgreement, bodies: ScopeBody[], targetEntityId?: string | null) {
  if (!targetEntityId) return null;
  const entityBodies = bodies.filter((body) => body.entity_id === targetEntityId);
  const adoptionMode = String(agreement.adoption_mode ?? "").toUpperCase();
  const kind = String(agreement.agreement_kind ?? "").toUpperCase();
  const candidates = entityBodies.filter((body) => {
    const config = body.config ?? {};
    const organType = String(config.organo_tipo ?? body.body_type ?? body.name ?? "").toUpperCase();
    const bodyLabel = `${body.body_type ?? ""} ${body.name ?? ""} ${organType}`.toUpperCase();
    if (adoptionMode === "UNIPERSONAL_SOCIO") return organType.includes("SOCIO_UNICO") || bodyLabel.includes("SOCIO UNICO");
    if (adoptionMode === "UNIPERSONAL_ADMIN") return organType.includes("ADMIN_UNICO") || bodyLabel.includes("ADMINISTRADOR UNICO");
    if (adoptionMode === "CO_APROBACION") return config.adoption_mode === "CO_APROBACION";
    if (adoptionMode === "SOLIDARIO") return config.adoption_mode === "SOLIDARIO";
    if (kind.includes("CONSEJ") || kind.includes("POLITICA") || kind.includes("DELEGACION")) {
      return bodyLabel.includes("CONSEJO") || bodyLabel.includes("CDA");
    }
    return bodyLabel.includes("JUNTA");
  });
  return candidates;
}

export function inferAgreementScopePatch(params: {
  agreement: ScopeAgreement;
  bodies: ScopeBody[];
  meetings?: ScopeMeeting[];
  noSessionResolutions?: ScopeNoSessionResolution[];
  targetEntityId?: string | null;
}): AgreementScopePatchResult {
  const { agreement, bodies, meetings = [], noSessionResolutions = [], targetEntityId } = params;
  const bodyById = new Map(bodies.map((body) => [body.id, body]));
  const meetingById = new Map(meetings.map((meeting) => [meeting.id, meeting]));
  const resolutionById = new Map(noSessionResolutions.map((resolution) => [resolution.id, resolution]));
  const candidates: Array<{ entity_id: string; body_id: string; source: string }> = [];

  const addBody = (bodyId: string | null | undefined, source: string) => {
    if (!bodyId) return;
    const body = bodyById.get(bodyId);
    if (!body?.entity_id) return;
    candidates.push({ entity_id: body.entity_id, body_id: body.id, source });
  };

  addBody(agreement.body_id, "body_id");

  if (agreement.parent_meeting_id) {
    addBody(meetingById.get(agreement.parent_meeting_id)?.body_id, "parent_meeting_id");
  }

  if (agreement.no_session_resolution_id) {
    addBody(resolutionById.get(agreement.no_session_resolution_id)?.body_id, "no_session_resolution_id");
  }

  if (candidates.length === 0) {
    const inferredCandidates = matchingBodiesFromAgreementKind(agreement, bodies, targetEntityId ?? agreement.entity_id ?? null);
    if (inferredCandidates && inferredCandidates.length > 1) {
      return { ok: false, reason: "ambiguous", candidateCount: inferredCandidates.length };
    }
    const inferred = inferredCandidates?.[0] ?? null;
    if (inferred?.entity_id) {
      candidates.push({ entity_id: inferred.entity_id, body_id: inferred.id, source: "agreement_kind" });
    }
  }

  const unique = new Map(candidates.map((candidate) => [uniqueCandidateKey(candidate), candidate]));
  if (unique.size === 0) return { ok: false, reason: "no_candidate", candidateCount: 0 };
  if (unique.size > 1) return { ok: false, reason: "ambiguous", candidateCount: unique.size };

  const [candidate] = Array.from(unique.values());
  if (targetEntityId && candidate.entity_id !== targetEntityId) {
    return { ok: false, reason: "conflict", candidateCount: 1 };
  }
  if (agreement.entity_id && agreement.entity_id !== candidate.entity_id) {
    return { ok: false, reason: "conflict", candidateCount: 1 };
  }
  if (agreement.body_id && agreement.body_id !== candidate.body_id) {
    return { ok: false, reason: "conflict", candidateCount: 1 };
  }

  const patch: { entity_id?: string; body_id?: string } = {};
  if (!agreement.entity_id) patch.entity_id = candidate.entity_id;
  if (!agreement.body_id) patch.body_id = candidate.body_id;
  if (Object.keys(patch).length === 0) return { ok: false, reason: "no_candidate", candidateCount: 1 };
  return { ok: true, patch, source: candidate.source };
}
