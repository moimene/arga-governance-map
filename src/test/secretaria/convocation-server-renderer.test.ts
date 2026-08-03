import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  assertExactBinaryIdentity,
  renderConvocationDocx,
} from "../../../supabase/functions/convocation-artifact-register/renderer";

const manifestHash = "a".repeat(128);
const manifest = {
  schema_version: "secretaria.convocation-manifest.v2",
  renderer_contract_version: "2026-07-21.1",
  convocatoria_id: "11111111-1111-4111-8111-111111111111",
  tenant_id: "00000000-0000-0000-0000-000000000001",
  data_class: "DEMO",
  legal_effect: "DEMO_SIMULATION_NO_LEGAL_EFFECT",
  record_status: "DEMO_OPERATIONAL_DRAFT_RECORDED",
  database_state: "EMITIDA",
  not_a_legal_convocation: true,
  president_action_not_asserted: true,
  recorded_at: "2026-07-20T09:00:00.000Z",
  recorded_on: "2026-07-20",
  recorded_by_user_id: "77777777-7777-4777-8777-777777777777",
  approved_template: {
    id: "88888888-8888-4888-8888-888888888888",
    type: "CONVOCATORIA",
    matter: "ANY",
    version: 11,
    content_hash_sha256: "9".repeat(64),
  },
  reviewed_demo_draft_text: "SIMULACIÓN DEMO / SIN EFECTO JURÍDICO\n\nBorrador operativo referido al cargo de Presidente. No se afirma que el Presidente haya ordenado, consentido, emitido o firmado una convocatoria.\n\nEl orden del día comprende los puntos propuestos en este documento.",
  reviewed_demo_draft_text_hash_sha256: "1f23494a73c549e7b5611c5f4dc4a593fbc7fa5f669ae9e87a82d832e5559555",
  entity: {
    id: "22222222-2222-4222-8222-222222222222",
    person_id: "99999999-9999-4999-8999-999999999999",
    legal_name: "ARGA Seguros, S.A.",
    jurisdiction: "ES",
    entity_status: "Active",
    data_class: "DEMO",
  },
  body: {
    id: "33333333-3333-4333-8333-333333333333",
    name: "Consejo de Administración",
    body_type: "CONSEJO_ADMINISTRACION",
  },
  authority: {
    route: "PRESIDENTE_ART_246_1",
    office: "PRESIDENTE",
    office_evidence_id: "44444444-4444-4444-8444-444444444444",
    person_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    person_name: "Antonio Ríos",
    office_evidence_status: "VIGENTE",
    office_evidence_source: "authority_evidence",
    act_basis: "DEMO_SYSTEM_RECORD_NO_LEGAL_EFFECT",
    act_legal_effect: "DEMO_SIMULATION_NO_LEGAL_EFFECT",
    act_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    act_hash_sha512: "c".repeat(128),
    act_type: "DEMO_CONVOCATION_RECORD",
    act_recorded_by: "77777777-7777-4777-8777-777777777777",
    act_recorded_at: "2026-07-20T09:00:00.000Z",
    actor_role_reference_only: true,
    president_action_not_asserted: true,
    office_evidence_is_not_convocation_act: true,
    ead_signature_service_required: false,
    legal_signature_status: "NOT_ASSERTED",
    external_signature_requirements: "OUT_OF_SCOPE_FOR_THIS_DEMO_ARTIFACT",
  },
  meeting: {
    first_call_at: "2026-08-09T08:00:00.000Z",
    second_call_at: null,
    modality: "PRESENCIAL",
    place: "Madrid",
  },
  publication: {
    requested_channels: ["EAD_INTERPOSITION"],
    sandbox_channels: ["SANDBOX_EAD_INTERPOSITION"],
    delivery_mode: "SANDBOX_ONLY",
    real_delivery_allowed: false,
    ead_interposition_separate: true,
    ead_signature_service_required: false,
    legal_signature_status: "NOT_ASSERTED",
    external_signature_requirements: "OUT_OF_SCOPE_FOR_THIS_DEMO_ARTIFACT",
  },
  document_source: {
    reviewed_text: "Mismo texto canónico que reviewed_demo_draft_text",
    reviewed_text_hash_sha256: "1f23494a73c549e7b5611c5f4dc4a593fbc7fa5f669ae9e87a82d832e5559555",
    reviewed_text_hash_sha512: "d".repeat(128),
    render_policy: "SERVER_ONLY_FROM_IMMUTABLE_MANIFEST",
  },
  agenda: [
    {
      order_number: 1,
      title: "Informe del Director General sobre la marcha de la Sociedad",
      matter_code: "INFORME_DG_MARCHA_SOCIEDAD",
      kind: "INFORMATIVA",
      proposal_text: "El Consejo toma conocimiento del informe presentado.",
    },
    {
      order_number: 2,
      title: "Informe de gobierno corporativo y cumplimiento",
      matter_code: "INFORME_GOBIERNO_CORPORATIVO_CUMPLIMIENTO",
      kind: "INFORMATIVA",
      proposal_text: "El Consejo toma conocimiento del informe presentado.",
    },
    {
      order_number: 3,
      title: "Formulación de las cuentas anuales del ejercicio 2025",
      matter_code: "FORMULACION_CUENTAS",
      kind: "DECISORIA",
      requires_attachments: true,
      proposal_text: "Formular las cuentas anuales individuales del ejercicio 2025.",
    },
    {
      order_number: 4,
      title: "Designación de representante de la socia única en una filial",
      matter_code: "DESIGNACION_REPRESENTANTE_SOCIO_UNICO_FILIAL",
      kind: "DECISORIA",
      proposal_text: "Designar a Dña. Carmen Delgado Ortiz para ejercer la representación indicada.",
      target_entity_id: "55555555-5555-4555-8555-555555555555",
      target_entity_name: "ARGA Digital, S.L.U.",
      representative_person_id: "66666666-6666-4666-8666-666666666666",
      representative_name: "Carmen Delgado Ortiz",
      representation_delegation_id: "3b8da713-8353-4fa9-91c8-917cf0bcb9b3",
      representation_authority_route: "GENERAL_PUBLIC_POWER_ART_183_1",
      representation_evidence_status: "DEMO_SIMULATION_NO_LEGAL_EFFECT",
      representation_source_reference: "DEMO-SEED:REPRESENTATION:CARMEN:ART-183-1:NO-LEGAL-EFFECT",
      representation_source_uri: "evidence-bundle://representation/demo-source",
      representation_source_hash_sha512: "e".repeat(128),
      representation_legal_effect: "DEMO_SIMULATION_NO_LEGAL_EFFECT",
      source_shareholder_entity_id: "22222222-2222-4222-8222-222222222222",
      source_shareholder_person_id: "99999999-9999-4999-8999-999999999999",
      capital_ownership_percentage: 100,
      capital_voting_percentage: 100,
      capital_evidence_status: "DEMO_SIMULATION_NO_LEGAL_EFFECT",
      data_class: "DEMO",
      legal_effect: "DEMO_SIMULATION_NO_LEGAL_EFFECT",
      authority_gate_version: "AUTHORITY_GATE_V1",
    },
    {
      order_number: 5,
      title: "Otorgamiento de poderes generales al CFO",
      matter_code: "OTORGAMIENTO_PODERES_CFO",
      kind: "DECISORIA",
      proposal_text: "Otorgar poderes generales al CFO en los términos sometidos al Consejo.",
    },
  ],
  recipients: [
    {
      person_id: "12121212-1212-4121-8121-121212121212",
      condition_id: "13131313-1313-4131-8131-131313131313",
      name: "Consejera Demo",
      office: "CONSEJERO",
      email: "consejera.demo@arga-seguros.com",
      channel: "EAD_INTERPOSITION",
    },
  ],
  recipient_selection: {
    schema_version: "secretaria.convocation-recipient-selection.v1",
    source: "condiciones_persona",
    body_id: "33333333-3333-4333-8333-333333333333",
    effective_date: "2026-08-09",
    total_active: 1,
    selected_count: 1,
    excluded_count: 0,
    excluded_person_ids: [],
    seat_roles: ["CONSEJERO", "PRESIDENTE", "VICEPRESIDENTE", "CONSEJERO_COORDINADOR"],
    seat_semantics: "PRIMARY_ONLY",
    temporal_semantics: "EFFECTIVE_AT_MEETING_DATE",
  },
  supporting_documents: {
    schema_version: "secretaria.convocation-supporting-intents.v1",
    expected_count: 1,
    completion_policy: "EXACT_SET_REQUIRED_BEFORE_FINAL",
    intents: [
      {
        intent_id: "14141414-1414-4141-8141-141414141414",
        ordinal: 1,
        display_name: "Informe de gestión 2025",
        description: "Documento soporte del punto de cuentas anuales",
        file_name: "informe_gestion_2025.pdf",
        size_bytes: 4096,
        mime_type: "application/pdf",
        hash_sha256: "e".repeat(64),
        hash_sha512: "f".repeat(128),
        agenda_item_index: 2,
        intent_state: "COMMITTED_BEFORE_EMISSION",
      },
    ],
  },
};

describe("authoritative server-side convocatoria DOCX", () => {
  it("is byte-for-byte deterministic and is a valid Word OOXML package", async () => {
    const first = renderConvocationDocx(manifest, manifestHash);
    const second = renderConvocationDocx(structuredClone(manifest), manifestHash);
    expect(first.bytes).toEqual(second.bytes);
    expect(createHash("sha256").update(first.bytes).digest("hex")).toBe(
      "ae83464392151310a5a24e3b62f123ce8b25434761f785d007541dec99ef3115",
    );
    expect(first.bytes.slice(0, 2)).toEqual(new Uint8Array([0x50, 0x4b]));

    const zip = await JSZip.loadAsync(first.bytes);
    expect(Object.keys(zip.files).sort()).toEqual([
      "[Content_Types].xml",
      "_rels/.rels",
      "docProps/app.xml",
      "docProps/core.xml",
      "word/_rels/document.xml.rels",
      "word/document.xml",
      "word/settings.xml",
      "word/styles.xml",
    ]);
    const documentXml = await zip.file("word/document.xml")!.async("string");
    expect(documentXml).toContain("ARGA Seguros, S.A.");
    expect(documentXml).toContain("Borrador operativo referido al cargo de Presidente");
    expect(documentXml).toContain("El orden del día comprende los puntos propuestos");
    expect(documentXml).toContain(manifest.reviewed_demo_draft_text_hash_sha256);
    expect(documentXml).toContain("Consejo de Administración");
    expect(documentXml).toContain("Antonio Ríos");
    expect(documentXml).toContain("F.1. Informe del Director General");
    expect(documentXml).toContain("F.2. Informe de gobierno corporativo");
    expect(documentXml).toContain("F.3. Formulación de las cuentas anuales");
    expect(documentXml).toContain("F.4. Designación de representante");
    expect(documentXml).toContain("F.5. Otorgamiento de poderes generales");
    expect(documentXml).toContain("ARGA Digital, S.L.U.");
    expect(documentXml).toContain("Carmen Delgado Ortiz");
    expect(documentXml).not.toContain("Representación y capital acreditados");
    expect(documentXml).toContain("Consejera Demo");
    expect(documentXml).toContain("consejera.demo@arga-seguros.com");
    expect(documentXml).toContain(
      "Consejo de Administración (CONSEJO_ADMINISTRACION)",
    );
    expect(documentXml).toContain(
      "Borrador operativo DEMO registrado (DEMO_OPERATIONAL_DRAFT_RECORDED)",
    );
    expect(documentXml).toContain(
      "Competencia del Presidente conforme al artículo 246.1 LSC (PRESIDENTE_ART_246_1)",
    );
    expect(documentXml).toContain(
      "Informe del Director General sobre la marcha de la Sociedad (INFORME_DG_MARCHA_SOCIEDAD)",
    );
    expect(documentXml).toContain(
      "Solo entorno de simulación (SANDBOX_ONLY)",
    );
    expect(documentXml).toContain(
      "Simulación DEMO sin efecto jurídico (DEMO_SIMULATION_NO_LEGAL_EFFECT)",
    );
    expect(documentXml).toContain(manifestHash);
    expect(documentXml).toContain("SIN EFECTOS JURÍDICOS");
    expect(documentXml).toContain("interposición");
    expect(documentXml).toContain("Destinatarios y canal de puesta a disposición");
    expect(documentXml).toContain("Nota sobre EAD Trust");
    expect(documentXml).toContain("mensajería básica, la custodia y el e-archiving");
    expect(documentXml).toContain("no afirma que el Presidente haya ordenado, consentido, emitido o firmado");

    const annexIndex = documentXml.indexOf("Anexo técnico de trazabilidad");
    expect(annexIndex).toBeGreaterThan(0);
    const legalDocumentXml = documentXml.slice(0, annexIndex);
    const technicalAnnexXml = documentXml.slice(annexIndex);
    expect(legalDocumentXml).toContain("Texto íntegro revisado de la convocatoria DEMO");
    expect(legalDocumentXml).not.toContain("4. Orden del día");
    expect(legalDocumentXml).not.toContain(manifest.convocatoria_id);
    expect(legalDocumentXml).not.toContain(manifestHash);
    expect(legalDocumentXml).not.toContain(manifest.reviewed_demo_draft_text_hash_sha256);
    expect(legalDocumentXml).not.toContain("PRESIDENTE_ART_246_1");
    expect(legalDocumentXml).not.toContain("INFORME_DG_MARCHA_SOCIEDAD");
    expect(legalDocumentXml).not.toContain("DEMO-SEED:REPRESENTATION");
    expect(technicalAnnexXml).toContain(manifest.convocatoria_id);
    expect(technicalAnnexXml).toContain(manifestHash);
    expect(technicalAnnexXml).toContain(manifest.reviewed_demo_draft_text_hash_sha256);
    expect(technicalAnnexXml).toContain("PRESIDENTE_ART_246_1");
    expect(technicalAnnexXml).toContain("INFORME_DG_MARCHA_SOCIEDAD");
    expect(technicalAnnexXml).toContain("DEMO-SEED:REPRESENTATION");
    expect(technicalAnnexXml).toContain("evidence-bundle://representation/demo-source");
    expect(technicalAnnexXml).toContain(manifest.recipients[0].person_id);
    expect(technicalAnnexXml).toContain(manifest.recipients[0].condition_id);
    expect(technicalAnnexXml).toContain("SERVER_ONLY_FROM_IMMUTABLE_MANIFEST");
    expect(documentXml).toMatch(
      /<w:pPr><w:pStyle w:val="Heading1"\/><w:pageBreakBefore\/><\/w:pPr><w:r><w:t>Anexo técnico de trazabilidad<\/w:t><\/w:r>/,
    );
    expect(documentXml).not.toMatch(
      /\bQES\b|electronic[ -]sign|firma electr[oó]nica|firmado electr[oó]nicamente/i,
    );
    expect(documentXml).not.toMatch(/\bERDS\b|entrega electr[oó]nica certificada/i);
  });

  it("rejects legacy/certified channels and internal references in legal text", () => {
    expect(() => renderConvocationDocx({
      ...manifest,
      renderer_contract_version: "2026-07-20.3",
    }, manifestHash)).toThrow(/renderer contract/);
    expect(() => renderConvocationDocx({
      ...manifest,
      publication: { ...manifest.publication, requested_channels: ["ERDS"] },
    }, manifestHash)).toThrow(/forbidden or unsupported publication channel/);
    expect(() => renderConvocationDocx({
      ...manifest,
      reviewed_demo_draft_text: `${manifest.reviewed_demo_draft_text}\n11111111-1111-4111-8111-111111111111`,
    }, manifestHash)).toThrow(/internal technical reference/);
  });

  it("fails closed when an immutable binary has any different identity", () => {
    const expected = {
      hashSha256: "b".repeat(64),
      hashSha512: "c".repeat(128),
      sizeBytes: 1234,
      storageUri: "evidence-bundle://convocatorias/111/final.docx",
    };
    expect(() => assertExactBinaryIdentity(expected, expected)).not.toThrow();
    expect(() => assertExactBinaryIdentity(expected, {
      ...expected,
      hashSha512: "d".repeat(128),
    })).toThrow(/different identity/);
    expect(() => assertExactBinaryIdentity(expected, {
      ...expected,
      sizeBytes: 1235,
    })).toThrow(/different identity/);
  });

  it("returns an existing immutable artifact from verified custody before invoking the renderer", () => {
    const edge = readFileSync(
      join(process.cwd(), "supabase/functions/convocation-artifact-register/index.ts"),
      "utf8",
    );
    const existingLookup = edge.indexOf("const { data: existingData, error: existingError }");
    const reuseReturn = edge.indexOf("reused: true", existingLookup);
    const render = edge.indexOf(
      "rendered = renderConvocationDocx(canonicalManifest, storedManifestHash)",
    );

    expect(existingLookup).toBeGreaterThan(0);
    expect(edge.indexOf("root.renderer_contract_version !== RENDERER_CONTRACT_VERSION")).toBeLessThan(existingLookup);
    expect(reuseReturn).toBeGreaterThan(existingLookup);
    expect(render).toBeGreaterThan(reuseReturn);

    const reuseBranch = edge.slice(existingLookup, render);
    expect(reuseBranch).toContain("convocation_manifest_hash_sha512");
    expect(reuseBranch).toContain("existingArtifactStoragePath(");
    expect(reuseBranch).toContain("assertStoredBytesMatch(");
    expect(reuseBranch).toContain("artifact_verified_mime_type");
    expect(reuseBranch).toContain("createSignedUrl(existingStoragePath, 120)");
    expect(reuseBranch).toContain("Existing immutable artifact binary is missing from private custody");
    expect(reuseBranch).not.toContain("renderConvocationDocx(");
    expect(reuseBranch).not.toContain(".upload(");
    expect(reuseBranch).not.toContain("fn_register_server_rendered_convocation_attachment");

    expect(edge).toContain("manifestHash !== storedManifestHash");
    expect(edge).toContain("existing.artifact_verified_mime_type !== DOCX_MIME");
    expect(edge).toContain("data.type !== expectedMimeType");
    expect(edge).toContain("existing.file_url !== `evidence-bundle://${storagePath}`");
    expect(edge).not.toContain("assertExactBinaryIdentity");
  });

  it("accepts only identity/manifest observation from the browser", () => {
    const edge = readFileSync(
      join(process.cwd(), "supabase/functions/convocation-artifact-register/index.ts"),
      "utf8",
    );
    const client = readFileSync(
      join(process.cwd(), "src/lib/secretaria/convocation-artifact-registration.ts"),
      "utf8",
    );
    const supportingClient = readFileSync(
      join(process.cwd(), "src/lib/secretaria/convocation-supporting-artifact-registration.ts"),
      "utf8",
    );
    const processSource = readFileSync(
      join(process.cwd(), "src/lib/doc-gen/process-documents.ts"),
      "utf8",
    );
    const supportingEdge = readFileSync(
      join(process.cwd(), "supabase/functions/convocation-supporting-artifact-register/index.ts"),
      "utf8",
    );
    expect(edge).toContain("!['convocatoriaId', 'expectedManifestHashSha512'].includes(key)");
    expect(edge).toContain("fn_get_convocation_manifest_canonical_source");
    expect(edge).toContain("fn_register_server_rendered_convocation_attachment");
    expect(edge).toContain("renderConvocationDocx(canonicalManifest, storedManifestHash)");
    expect(edge).toContain("Reviewed DEMO draft text SHA-256 verification failed");
    expect(edge).toContain("policy.ead_signature_service_required !== false");
    expect(edge).toContain("policy.legal_signature_status !== 'NOT_ASSERTED'");
    expect(edge.indexOf("const publicationPolicy =")).toBeLessThan(
      edge.indexOf("publicationPolicy.requested_channels"),
    );
    expect(edge).not.toContain("documentBase64");
    expect(edge).not.toContain("review_context");
    expect(edge).not.toContain("convocation_artifact_candidates");
    expect(edge).toContain("row.is_active === true");
    expect(edge).not.toContain("row.is_active ?? true");
    expect(supportingEdge).toContain("row.is_active === true");
    expect(supportingEdge).not.toContain("row.is_active ?? true");
    expect(supportingEdge).toContain("Unsupported request fields");
    expect(supportingClient).toContain('"convocation-supporting-artifact-register"');
    expect(client).toContain('"convocation-artifact-register"');
    expect(client).not.toContain("expectedHashSha256");
    expect(client).not.toContain("expectedHashSha512");
    expect(client).not.toContain("storageUri");
    expect(client).toContain("const body: RenderAuthoritativeConvocationInput");
    expect(client).toContain('digestArrayBufferHex("SHA-256"');
    expect(client).toContain('digestArrayBufferHex("SHA-512"');
    expect(client).toContain("downloadedSha512 !== data.attachment.file_hash_sha512");
    expect(processSource).not.toContain("precommitConvocationFinalCandidate");
    expect(processSource).toContain("authoritativeDocumentData: artifact.documentData");
    expect(processSource).toContain("downloadDocx(deliveredBuffer ?? buffer, deliveredFilename)");
  });
});
