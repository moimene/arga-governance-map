import { describe, expect, it } from "vitest";
import {
  buildStandaloneCertificationExplainNodes,
  canonicalizeCertificationSource,
  computeSourceHash,
  resolveCertificationAuthority,
  resolveStandaloneCertificationSource,
  type AuthorityEvidenceLike,
  type StandaloneCertificationKind,
} from "../standalone-certifications";
import {
  buildStandaloneCertificationEvidenceManifest,
  buildStandaloneCertificationFilename,
  buildStandaloneCertificationRenderedText,
  type StandaloneCertificationDocumentRow,
} from "../standalone-certifications/document";

const kind: StandaloneCertificationKind = {
  kind_code: "CERT_VIGENCIA_CARGO",
  label: "Certificado de vigencia de cargo",
  source_domain: "condiciones_persona",
  legal_effect: "TERCERO",
  requires_visto_bueno: true,
  requires_rm_reference: true,
  requires_qes: false,
  authority_policy: { certificante_roles: ["SECRETARIO", "VICESECRETARIO"] },
};

const authorityRows: AuthorityEvidenceLike[] = [
  {
    id: "ae-secretario",
    entity_id: "entity-1",
    body_id: "body-1",
    person_id: "secretario-1",
    cargo: "SECRETARIO",
    estado: "VIGENTE",
    fecha_inicio: "2026-01-01",
    inscripcion_rm_referencia: "RM-M-1",
  },
  {
    id: "ae-presidente",
    entity_id: "entity-1",
    body_id: "body-1",
    person_id: "presidente-1",
    cargo: "PRESIDENTE",
    estado: "VIGENTE",
    fecha_inicio: "2026-01-01",
    inscripcion_rm_referencia: "RM-M-2",
  },
];

const documentCertification: StandaloneCertificationDocumentRow = {
  id: "12345678-1234-4234-9234-123456789abc",
  tenant_id: "00000000-0000-0000-0000-000000000001",
  entity_id: "6d7ed736-f263-4531-a59d-c6ca0cd41602",
  body_id: "body-1",
  kind_code: "CERT_VIGENCIA_CARGO",
  source_domain: "condiciones_persona",
  source_id: "condition-1",
  source_payload: { cargo: "SECRETARIO", estado: "VIGENTE" },
  source_hash: "a".repeat(64),
  source_summary: { rows: 1, cargo: "SECRETARIO" },
  cutoff_at: "2026-06-20T10:00:00.000Z",
  issued_to: "Registro Mercantil",
  legal_effect: "TERCERO",
  capa3_payload: { issued_to: "Registro Mercantil" },
  certificante_role: "SECRETARIO",
  authority_evidence_id: "ae-secretario",
  visto_bueno_persona_id: "presidente-1",
  requires_visto_bueno: true,
  requires_qes: false,
  artifact_id: "artifact-1",
  evidence_bundle_id: null,
  status: "SOURCE_LOCKED",
  kind,
  artifact: {
    id: "artifact-1",
    title: "Certificado de vigencia de cargo",
  },
};

describe("standalone-certifications", () => {
  it("canoniza la fuente de forma estable aunque cambie el orden de claves", () => {
    expect(canonicalizeCertificationSource({ b: 2, a: 1 })).toBe(canonicalizeCertificationSource({ a: 1, b: 2 }));
  });

  it("calcula source_hash estable para la fuente certificada", async () => {
    const a = await computeSourceHash({ b: 2, a: 1 });
    const b = await computeSourceHash({ a: 1, b: 2 });
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it("resuelve fuente autónoma sin depender de acta ni canonical_minutes_hash", async () => {
    const source = await resolveStandaloneCertificationSource(kind, {
      entity_id: "entity-1",
      body_id: "body-1",
      cutoff_at: "2026-06-20T00:00:00.000Z",
      source_payload: [{ id: "cargo-1", tipo_condicion: "SECRETARIO" }],
      source_summary: { rows: 1 },
    });

    expect(source.kind_code).toBe("CERT_VIGENCIA_CARGO");
    expect(source.source_domain).toBe("condiciones_persona");
    expect(source.source_hash).toHaveLength(64);
    expect(JSON.stringify(source)).not.toContain("canonical_minutes_hash");
  });

  it("valida certificante y visto bueno con referencia RM", () => {
    const resolution = resolveCertificationAuthority({
      kind,
      entityId: "entity-1",
      bodyId: "body-1",
      certificanteRole: "SECRETARIO",
      vistoBuenoPersonId: "presidente-1",
      currentPersonId: "secretario-1",
      authorityEvidence: authorityRows,
    });

    expect(resolution.ok).toBe(true);
    expect(resolution.certificante?.id).toBe("ae-secretario");
    expect(resolution.vistoBueno?.id).toBe("ae-presidente");
  });

  it("bloquea cuando falta Vº Bº requerido", () => {
    const resolution = resolveCertificationAuthority({
      kind,
      entityId: "entity-1",
      bodyId: "body-1",
      certificanteRole: "SECRETARIO",
      currentPersonId: "secretario-1",
      authorityEvidence: authorityRows,
    });

    expect(resolution.ok).toBe(false);
    expect(resolution.issues.some((issue) => issue.code === "VISTO_BUENO_NOT_SELECTED")).toBe(true);
    expect(buildStandaloneCertificationExplainNodes({ authority: resolution })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "VISTO_BUENO_NOT_SELECTED", severity: "BLOCKING" }),
      ]),
    );
  });

  it("renderiza un DOCX autónomo con fuente, autoridad y hash trazable", () => {
    const rendered = buildStandaloneCertificationRenderedText({
      certification: documentCertification,
      entityName: "ARGA Seguros S.A.",
      generatedAt: "2026-06-20T12:00:00.000Z",
    });

    expect(rendered).toContain("CERTIFICACIÓN AUTÓNOMA");
    expect(rendered).toContain("ARGA Seguros S.A.");
    expect(rendered).toContain(documentCertification.source_hash);
    expect(rendered).toContain("Authority evidence: ae-secretario");
    expect(rendered).toContain('"cargo": "SECRETARIO"');
  });

  it("construye filename y manifest de evidencia para STANDALONE_CERTIFICATION", () => {
    const filename = buildStandaloneCertificationFilename({
      certification: documentCertification,
      generatedAt: "2026-06-20T12:34:56.000Z",
    });
    const manifest = buildStandaloneCertificationEvidenceManifest({
      certification: documentCertification,
      entityName: "ARGA Seguros S.A.",
      artifactId: "artifact-1",
      storagePath: "tenant/standalone-certifications/cert/doc.docx",
      filename,
      contentHash: "b".repeat(64),
      hashSha512: "c".repeat(128),
      generatedAt: "2026-06-20T12:34:56.000Z",
    });

    expect(filename).toContain("cert_vigencia_cargo");
    expect(manifest.source.hash).toBe(documentCertification.source_hash);
    expect(manifest.metadata.source_object_type).toBe("STANDALONE_CERTIFICATION");
    expect(manifest.artifacts[0].hash_sha512).toHaveLength(128);
  });
});
