export type StandaloneCertificationKindCode =
  | "CERT_LIBRO_SOCIOS_TITULARIDAD"
  | "CERT_LIBRO_SOCIOS_TRANSMISION"
  | "CERT_LIBRO_ACTAS_EXTRACTO"
  | "CERT_VIGENCIA_CARGO"
  | "CERT_LIBROS_LEGALIZACION"
  | "CERT_ACUERDO_SIN_SESION"
  | "CERT_DECISION_SOCIO_UNICO"
  | string;

export type StandaloneCertificationLegalEffect =
  | "INTERNO"
  | "SOCIO"
  | "AUDITOR"
  | "TERCERO"
  | "REGISTRAL"
  | "SUPERVISOR"
  | "PROBATORIO";

export type StandaloneCertificationStatus =
  | "DRAFT"
  | "SOURCE_LOCKED"
  | "GENERATED"
  | "SIGNED"
  | "EMITTED"
  | "SUPERSEDED"
  | "REVOKED"
  | "FAILED";

export interface StandaloneCertificationKind {
  kind_code: StandaloneCertificationKindCode;
  label: string;
  source_domain: string;
  legal_effect: StandaloneCertificationLegalEffect;
  requires_visto_bueno: boolean;
  requires_rm_reference: boolean;
  requires_qes: boolean;
  template_binding_key?: string | null;
  authority_policy?: {
    certificante_roles?: string[];
    source?: string;
    [key: string]: unknown;
  } | null;
  disclaimer_policy?: Record<string, unknown> | null;
}

export interface AuthorityEvidenceLike {
  id: string;
  entity_id: string;
  body_id?: string | null;
  person_id: string;
  cargo: string;
  estado: string;
  fecha_inicio?: string | null;
  inscripcion_rm_referencia?: string | null;
}

export interface StandaloneCertificationSource {
  kind_code: StandaloneCertificationKindCode;
  source_domain: string;
  source_id?: string | null;
  entity_id: string;
  body_id?: string | null;
  cutoff_at: string;
  source_payload: unknown;
  source_summary?: Record<string, unknown>;
}

export interface ResolvedStandaloneCertificationSource extends StandaloneCertificationSource {
  source_hash: string;
}

export interface CertificationAuthorityInput {
  kind: StandaloneCertificationKind;
  entityId: string;
  bodyId?: string | null;
  certificanteRole: string;
  vistoBuenoPersonId?: string | null;
  authorityEvidence: AuthorityEvidenceLike[];
  currentPersonId?: string | null;
  currentRoleCode?: string | null;
}

export interface CertificationAuthorityResolution {
  ok: boolean;
  certificante?: AuthorityEvidenceLike | null;
  vistoBueno?: AuthorityEvidenceLike | null;
  issues: Array<{ code: string; severity: "BLOCKING" | "WARNING"; message: string }>;
}

export interface StandaloneCertificationExplainNode {
  code: string;
  severity: "OK" | "WARNING" | "BLOCKING";
  message: string;
}

function stableStringify(value: unknown): string {
  if (value === null) return "null";
  const t = typeof value;
  if (t === "number" || t === "boolean") return JSON.stringify(value);
  if (t === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (t === "object") {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(null);
}

export function canonicalizeCertificationSource(payload: unknown) {
  return stableStringify(payload);
}

export async function computeSourceHash(payload: unknown) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto (crypto.subtle) no disponible para calcular source_hash.");
  }
  const encoded = new TextEncoder().encode(canonicalizeCertificationSource(payload));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function resolveStandaloneCertificationSource(
  kind: StandaloneCertificationKind,
  source: Omit<StandaloneCertificationSource, "kind_code" | "source_domain">,
): Promise<ResolvedStandaloneCertificationSource> {
  const payload = source.source_payload;
  if (payload == null || (Array.isArray(payload) && payload.length === 0)) {
    throw new Error(`Fuente canónica vacía para ${kind.kind_code}.`);
  }
  return {
    ...source,
    kind_code: kind.kind_code,
    source_domain: kind.source_domain,
    source_hash: await computeSourceHash(payload),
  };
}

function sameBody(expected?: string | null, actual?: string | null) {
  return !expected || actual === expected || actual == null;
}

function pickAuthority(
  rows: AuthorityEvidenceLike[],
  entityId: string,
  bodyId: string | null | undefined,
  cargos: string[],
  personId?: string | null,
) {
  return rows
    .filter((row) => row.entity_id === entityId)
    .filter((row) => row.estado === "VIGENTE")
    .filter((row) => cargos.includes(row.cargo))
    .filter((row) => sameBody(bodyId, row.body_id))
    .filter((row) => !personId || row.person_id === personId)
    .sort((a, b) => {
      const bodyScore = Number(Boolean(b.body_id)) - Number(Boolean(a.body_id));
      if (bodyScore !== 0) return bodyScore;
      return String(b.fecha_inicio ?? "").localeCompare(String(a.fecha_inicio ?? ""));
    })[0] ?? null;
}

export function resolveCertificationAuthority(input: CertificationAuthorityInput): CertificationAuthorityResolution {
  const issues: CertificationAuthorityResolution["issues"] = [];
  const allowedRoles = input.kind.authority_policy?.certificante_roles ?? [
    "SECRETARIO",
    "VICESECRETARIO",
    "ADMIN_UNICO",
  ];

  if (!allowedRoles.includes(input.certificanteRole)) {
    issues.push({
      code: "CERTIFICANTE_ROLE_NOT_ALLOWED",
      severity: "BLOCKING",
      message: `El rol ${input.certificanteRole} no puede emitir ${input.kind.kind_code}.`,
    });
  }

  const certificante = pickAuthority(
    input.authorityEvidence,
    input.entityId,
    input.bodyId,
    [input.certificanteRole],
    input.currentRoleCode === "ADMIN_TENANT" ? null : input.currentPersonId,
  );
  if (!certificante) {
    issues.push({
      code: "CERTIFICANTE_AUTHORITY_MISSING",
      severity: "BLOCKING",
      message: `No hay autoridad vigente para ${input.certificanteRole}.`,
    });
  } else if (input.kind.requires_rm_reference && !certificante.inscripcion_rm_referencia) {
    issues.push({
      code: "CERTIFICANTE_RM_MISSING",
      severity: "BLOCKING",
      message: "El certificante no tiene referencia registral RM informada.",
    });
  }

  const vistoBueno = input.kind.requires_visto_bueno && input.vistoBuenoPersonId
    ? pickAuthority(
        input.authorityEvidence,
        input.entityId,
        input.bodyId,
        ["PRESIDENTE", "VICEPRESIDENTE"],
        input.vistoBuenoPersonId,
      )
    : null;

  if (input.kind.requires_visto_bueno && !input.vistoBuenoPersonId) {
    issues.push({
      code: "VISTO_BUENO_NOT_SELECTED",
      severity: "BLOCKING",
      message: "Debe seleccionarse la persona que presta el Vº Bº.",
    });
  } else if (input.kind.requires_visto_bueno && !vistoBueno) {
    issues.push({
      code: "VISTO_BUENO_MISSING",
      severity: "BLOCKING",
      message: "La certificación requiere Vº Bº de Presidente o Vicepresidente vigente.",
    });
  } else if (vistoBueno && input.kind.requires_rm_reference && !vistoBueno.inscripcion_rm_referencia) {
    issues.push({
      code: "VISTO_BUENO_RM_MISSING",
      severity: "BLOCKING",
      message: "El Vº Bº no tiene referencia registral RM informada.",
    });
  }

  return {
    ok: !issues.some((issue) => issue.severity === "BLOCKING"),
    certificante,
    vistoBueno,
    issues,
  };
}

export function buildStandaloneCertificationExplainNodes(params: {
  source?: ResolvedStandaloneCertificationSource | null;
  authority?: CertificationAuthorityResolution | null;
  evidenceStatus?: string | null;
}): StandaloneCertificationExplainNode[] {
  const nodes: StandaloneCertificationExplainNode[] = [];
  if (params.source) {
    nodes.push({
      code: "SOURCE_HASH",
      severity: "OK",
      message: `Fuente canónica bloqueada con hash ${params.source.source_hash}.`,
    });
  }
  params.authority?.issues.forEach((issue) => {
    nodes.push({ code: issue.code, severity: issue.severity, message: issue.message });
  });
  if (params.evidenceStatus === "DEMO_OPERATIVA" || !params.evidenceStatus) {
    nodes.push({
      code: "EVIDENCE_DEMO",
      severity: "WARNING",
      message: "Evidencia operativa demo; no evidencia cualificada productiva EAD Trust.",
    });
  }
  return nodes;
}
