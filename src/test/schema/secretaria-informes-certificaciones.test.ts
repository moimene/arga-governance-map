import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260620045834_secretaria_informes_certificaciones.sql",
  "utf8",
);
const artifactsHook = readFileSync("src/hooks/useSecretariaDocumentArtifacts.ts", "utf8");
const standaloneHook = readFileSync("src/hooks/useStandaloneCertifications.ts", "utf8");
const standalonePage = readFileSync("src/pages/secretaria/CertificacionesAutonomas.tsx", "utf8");
const standaloneActions = readFileSync("src/components/secretaria/StandaloneCertificationActions.tsx", "utf8");
const documentReviewPage = readFileSync("src/pages/secretaria/DocumentosPendientesRevision.tsx", "utf8");
const standaloneDocument = readFileSync(
  "src/lib/secretaria/standalone-certifications/document.ts",
  "utf8",
);

describe("secretaria informes y certificaciones migration", () => {
  it("creates the shared document and standalone certification model", () => {
    [
      "secretaria_document_artifacts",
      "agreement_document_requirements",
      "agreement_document_links",
      "document_annex_links",
      "standalone_certification_kinds",
      "standalone_certifications",
    ].forEach((table) => {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`);
      expect(migration).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
    });
  });

  it("exposes guarded RPCs for checklist sync and autonomous certification lifecycle", () => {
    [
      "fn_refresh_agreement_document_requirements",
      "fn_secretaria_document_annex_manifest",
      "fn_secretaria_document_annex_manifest_hash",
      "fn_secretaria_can_write_document_artifacts",
      "fn_prepare_standalone_certification_source",
      "fn_create_standalone_certification",
      "fn_emit_standalone_certification",
      "fn_supersede_standalone_certification",
    ].forEach((fnName) => {
      expect(migration).toContain(`CREATE OR REPLACE FUNCTION public.${fnName}`);
      expect(migration).toContain(`REVOKE ALL ON FUNCTION public.${fnName}`);
      expect(migration).toContain(`GRANT EXECUTE ON FUNCTION public.${fnName}`);
    });
    expect(migration).toContain("fn_secretaria_assert_tenant_access");
    expect(migration).toContain("fn_secretaria_assert_capability");
  });

  it("limits direct Data API writes to certification-capable roles", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.fn_secretaria_can_write_document_artifacts");
    expect(migration).toContain("cm.action = 'CERTIFICATION'");
    expect(migration).toContain("cm.enabled IS TRUE");
    [
      "secretaria_document_artifacts",
      "agreement_document_requirements",
      "agreement_document_links",
      "document_annex_links",
      "standalone_certification_kinds",
      "standalone_certifications",
    ].forEach((table) => {
      expect(migration).toContain(`ON public.${table} FOR ALL`);
      expect(migration).toContain("USING (public.fn_secretaria_can_write_document_artifacts(tenant_id))");
      expect(migration).toContain("WITH CHECK (public.fn_secretaria_can_write_document_artifacts(tenant_id))");
    });
  });

  it("seeds agreement 360 and EAD Trust evidence semantics", () => {
    expect(migration).toContain("CERT_ACUERDO_360");
    expect(migration).toContain("CERTIFICACION_AUTONOMA:ACUERDO_360");
    expect(migration).toContain("EAD_TRUST");
    expect(migration).toContain("'CERT_ACUERDO_360'");
    expect(migration).toContain("'agreements'");
  });

  it("covers the expanded standalone certification catalog from the product review", () => {
    [
      "CERT_CAP_TABLE_FECHA",
      "CERT_DERECHOS_VOTO",
      "CERT_COMPOSICION_ORGANO",
      "CERT_ENVIO_CONVOCATORIA",
      "CERT_EVIDENCE_BUNDLE",
      "CERT_BOARD_PACK_CONTENIDO",
    ].forEach((kindCode) => {
      expect(migration).toContain(kindCode);
    });
    expect(migration).toContain('"generic_table":true');
    expect(migration).toContain("generic_table_resolver");
  });

  it("freezes certification annex manifests when emitting autonomous certificates", () => {
    expect(migration).toContain("linked_domain = 'agreement'");
    expect(migration).toContain("'standalone_certification'");
    expect(migration).toContain("'annex_manifest_hash'");
    expect(migration).toContain("included_in_certification_bundle IS TRUE");
    expect(migration).toContain("STANDALONE_CERT_EMITIDA");
  });

  it("generates agreement document artifacts through the DOCX composer before linking", () => {
    expect(artifactsHook).toContain("composeDocument(request");
    expect(artifactsHook).toContain("content_hash: composition.contentHash");
    expect(artifactsHook).toContain("hash_sha512: composition.archive.hash512");
    expect(artifactsHook).toContain("evidence_bundle_id: composition.archive.evidenceBundleId");
    expect(artifactsHook).toContain('linked_domain: "board_pack"');
  });

  it("archives autonomous certifications as DOCX evidence bundles before emission", () => {
    expect(standaloneHook).toContain("useGenerateStandaloneCertificationDocument");
    expect(standaloneHook).toContain("archiveStandaloneCertificationDocument");
    expect(standaloneDocument).toContain("generateDocx({");
    expect(standaloneDocument).toContain("SOURCE_OBJECT_TYPE.STANDALONE_CERTIFICATION");
    expect(standaloneDocument).toContain('source_module: "secretaria"');
    expect(standaloneDocument).toContain('status: "OPEN"');
  });

  it("keeps auditor/compliance flows read-only in certification UI", () => {
    [standalonePage, standaloneActions, documentReviewPage].forEach((source) => {
      expect(source).toContain("useHasCapability");
      expect(source).toContain("CERTIFICATION");
    });
    expect(standaloneActions).toContain("!canCertify");
    // UX-7/§8.2: ambas páginas usan el copy aprobado de permisos "Sin permisos"
    // (literal §8.2), consistente entre certificaciones y revisión documental.
    expect(standalonePage).toContain("Tu rol puede consultar esta información, pero no ejecutar esta acción.");
    expect(documentReviewPage).toContain("Tu rol puede consultar esta información, pero no ejecutar esta acción.");
  });
});
