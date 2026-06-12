import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationG15 = readFileSync(
  join(process.cwd(), "supabase/migrations/20260516120006_f3_g15_evidence_immutability.sql"),
  "utf8",
);
const edgeFunction = readFileSync(
  join(process.cwd(), "supabase/functions/sign-evidence-url/index.ts"),
  "utf8",
);
const hook = readFileSync(
  join(process.cwd(), "src/hooks/useEvidenceBundleSignedUrl.ts"),
  "utf8",
);
const storageArchiver = readFileSync(
  join(process.cwd(), "src/lib/doc-gen/storage-archiver.ts"),
  "utf8",
);
const evidenceForense = readFileSync(
  join(process.cwd(), "src/components/EvidenceForenseSection.tsx"),
  "utf8",
);
const expedienteAcuerdo = readFileSync(
  join(process.cwd(), "src/pages/secretaria/ExpedienteAcuerdo.tsx"),
  "utf8",
);

describe("F3.G15 — evidence_bundles immutability & supersession", () => {
  it("adds storage_path, supersedes_id, manifest, manifest_hash as IF NOT EXISTS", () => {
    expect(migrationG15).toMatch(/ADD COLUMN IF NOT EXISTS storage_path text/);
    expect(migrationG15).toMatch(/ADD COLUMN IF NOT EXISTS supersedes_id uuid REFERENCES public\.evidence_bundles\(id\)/);
    expect(migrationG15).toMatch(/ADD COLUMN IF NOT EXISTS manifest jsonb/);
    expect(migrationG15).toMatch(/ADD COLUMN IF NOT EXISTS manifest_hash text/);
  });

  it("creates evidence_bundles_latest view (HEAD of supersession chain)", () => {
    expect(migrationG15).toMatch(/CREATE OR REPLACE VIEW public\.evidence_bundles_latest AS/);
    expect(migrationG15).toMatch(/WHERE NOT EXISTS \(\s*SELECT 1 FROM public\.evidence_bundles s WHERE s\.supersedes_id = eb\.id/);
    expect(migrationG15).toMatch(/GRANT SELECT ON public\.evidence_bundles_latest TO authenticated, service_role/);
  });

  it("creates recursive fn_evidence_bundle_chain helper", () => {
    expect(migrationG15).toMatch(/CREATE OR REPLACE FUNCTION public\.fn_evidence_bundle_chain\(p_bundle_id uuid\)/);
    expect(migrationG15).toMatch(/WITH RECURSIVE chain AS/);
    expect(migrationG15).toMatch(/REVOKE EXECUTE ON FUNCTION public\.fn_evidence_bundle_chain\(uuid\) FROM PUBLIC, anon/);
  });

  it("acknowledges the existing WORM trigger (no redundant own trigger)", () => {
    // Drift G8 documented: original plan v1 proposed fn_evidence_immutable but
    // Cloud already has a WORM trigger that blocks all UPDATE on
    // evidence_bundles, so the new trigger would be redundant.
    expect(migrationG15).toMatch(/WORM trigger existente/);
    expect(migrationG15).not.toMatch(/CREATE TRIGGER trg_evidence_immutable/);
  });
});

describe("F3.G3 — Edge Function sign-evidence-url", () => {
  it("requires Bearer authorization (no anon)", () => {
    expect(edgeFunction).toMatch(/missing bearer token/);
    expect(edgeFunction).toMatch(/req\.headers\.get\("Authorization"\)/);
  });

  it("verifies the user via supabase.auth.getUser() before any DB read", () => {
    expect(edgeFunction).toMatch(/await userClient\.auth\.getUser\(\)/);
    expect(edgeFunction).toMatch(/invalid or expired token/);
  });

  it("reads evidence_bundles with the user JWT (so RLS filters by tenant)", () => {
    expect(edgeFunction).toMatch(/userClient[\s\S]*?\.from\("evidence_bundles"\)[\s\S]*?\.select\([^)]*\)[\s\S]*?\.eq\("id", bundleId\)/);
  });

  it("blocks signed URL when legal_hold is true", () => {
    expect(edgeFunction).toMatch(/bundle\.legal_hold === true/);
    expect(edgeFunction).toMatch(/legal hold active on this bundle/);
  });

  it("prefers storage_path over legacy document_url extraction", () => {
    expect(edgeFunction).toMatch(/let storagePath: string \| null = bundle\.storage_path/);
    expect(edgeFunction).toMatch(/extractPathFromDocumentUrl\(bundle\.document_url\)/);
  });

  it("rejects path traversal attempts", () => {
    expect(edgeFunction).toMatch(/storagePath\.includes\("\.\."\)/);
    expect(edgeFunction).toMatch(/storagePath\.startsWith\("\/"\)/);
  });

  it("signs the URL via service_role admin client (only path with signing privilege)", () => {
    expect(edgeFunction).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(edgeFunction).toMatch(/adminClient\.storage\s*\n?\s*\.from\(BUCKET\)\s*\n?\s*\.createSignedUrl\(storagePath, SIGNED_URL_TTL_SECONDS\)/);
  });

  it("uses 5-minute TTL (concilio: never store signed URLs in DB)", () => {
    expect(edgeFunction).toMatch(/SIGNED_URL_TTL_SECONDS = 300/);
  });
});

describe("F3.G3 — useEvidenceBundleSignedUrl hook", () => {
  it("invokes supabase.functions.invoke('sign-evidence-url') with bundle_id body", () => {
    expect(hook).toMatch(/supabase\.functions\.invoke<SignedUrlResponse>\(\s*"sign-evidence-url"/);
    expect(hook).toMatch(/body: \{ bundle_id: bundleId \}/);
  });

  it("uses staleTime smaller than TTL (refresh before expiry)", () => {
    expect(hook).toMatch(/staleTime: SIGNED_URL_TTL_MS - 60_000/);
  });

  it("exposes useAgreementSignedDocumentUrl helper (agreement_id → bundle_id → signed URL)", () => {
    expect(hook).toMatch(/export function useAgreementSignedDocumentUrl/);
    expect(hook).toMatch(/source_object_type.*AGREEMENT/);
  });
});

describe("F3.G3 — UI consumers refactored", () => {
  it("EvidenceForenseSection no longer renders bundle.document_url directly", () => {
    expect(evidenceForense).not.toMatch(/href=\{b\.document_url\}/);
    expect(evidenceForense).toMatch(/EvidenceBundleDownloadLink/);
    expect(evidenceForense).toMatch(/useEvidenceBundleSignedUrl/);
  });

  it("ExpedienteAcuerdo no longer renders agreement.document_url directly", () => {
    expect(expedienteAcuerdo).not.toMatch(/href=\{a\.document_url\}/);
    expect(expedienteAcuerdo).toMatch(/AgreementArchivedDocLink/);
    expect(expedienteAcuerdo).toMatch(/useAgreementSignedDocumentUrl/);
  });

  it("storage-archiver writes storage_path + sentinel document_url (no getPublicUrl)", () => {
    expect(storageArchiver).not.toMatch(/\.getPublicUrl\(/);
    expect(storageArchiver).toMatch(/storage_path: storagePath/);
    expect(storageArchiver).toMatch(/document_url: sentinelUrl/);
    expect(storageArchiver).toMatch(/`evidence-bundle:\/\/\$\{storagePath\}`/);
  });

  it("storage-archiver uses tenant-prefix path schema (F3.G3 §5)", () => {
    // ITEM-108: el path incluye ahora un fragmento del hash de contenido
    // (`__<hash8>`) para evitar colisiones same-day con contenido distinto.
    expect(storageArchiver).toMatch(
      /storagePath = `\$\{tenantId\}\/\$\{agreementId\}\/\$\{filename\}__\$\{contentFragment\}\.docx`/,
    );
  });

  it("storage-archiver uses upsert:true with content-addressed path (ITEM-108)", () => {
    // Path direccionado por contenido → upsert solo sobreescribe bytes idénticos
    // (reintento idempotente tras fallo parcial), sin dead-end de colisión.
    expect(storageArchiver).toMatch(/upsert: true/);
    expect(storageArchiver).toMatch(/const contentFragment = hashHex\.slice\(0, 8\)/);
  });
});
