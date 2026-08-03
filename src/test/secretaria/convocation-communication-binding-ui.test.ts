import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const stepper = read("src/pages/secretaria/ConvocatoriasStepper.tsx");
const detail = read("src/pages/secretaria/ConvocatoriaDetalle.tsx");
const sendStep = read("src/components/secretaria/comunicaciones/PasoEnvioMiembros.tsx");
const archive = read("src/lib/doc-gen/process-documents.ts");
const uploads = read("src/hooks/useConvocatorias.ts");
const communicationHook = read("src/hooks/useCommunication.ts");
const dispatcher = read("supabase/functions/comms-dispatcher/index.ts");
const artifactRegister = read("supabase/functions/convocation-artifact-register/index.ts");
const supportingArtifactRegister = read("supabase/functions/convocation-supporting-artifact-register/index.ts");
const artifactClient = read("src/lib/secretaria/convocation-artifact-registration.ts");
const supportingArtifactClient = read("src/lib/secretaria/convocation-supporting-artifact-registration.ts");
const resendWebhook = read("supabase/functions/webhook-resend/index.ts");
const erdsHook = read("src/hooks/useERDSNotification.ts");
const eadSystemPolicy = read("supabase/migrations/20260720148000_secretaria_ead_interposition_system_policy.sql");
const supportingIntentBinding = read("supabase/migrations/20260720149000_secretaria_supporting_attachment_intent_binding.sql");

describe("convocatoria communication UI and dispatcher contract", () => {
  it("waits for the real final DOCX and the materialized meeting", () => {
    expect(stepper).not.toContain("documentUri={`convocatoria:${emitidoId}`}");
    expect(stepper).toContain("después de generar y archivar el DOCX final");
    expect(detail).toContain("Programa primero la reunión operativa");
    expect(detail).toContain("!effectiveMeeting");
    expect(communicationHook).not.toContain(".neq('estado', 'CANCELADA')");
  });

  it("passes the final DOCX and every supporting attachment into the atomic package", () => {
    expect(detail).toContain('attachment.artifact_kind === "CONVOCATORIA_FINAL"');
    expect(detail).toContain('attachment.artifact_kind === "SUPPORTING_DOCUMENT"');
    expect(detail).toContain("sourceAttachmentId={canonicalConvocatoriaAttachment.id}");
    expect(detail).toContain("supportingAttachments={supportingConvocatoriaAttachments}");
    expect(sendStep).toContain("...(props.supportingAttachments ?? []).map");
    expect(sendStep).toContain("source_attachment_id: attachment.id");
    expect(sendStep).toContain("hash_sha256: attachment.hashSha256");
    expect(sendStep).toContain("hash_sha512: attachment.hashSha512");
  });

  it("computes real dual hashes for newly uploaded supporting documents", () => {
    expect(uploads).toContain("computeFileHashes");
    expect(uploads).toContain('subtle.digest("SHA-256"');
    expect(uploads).toContain('subtle.digest("SHA-512"');
    expect(uploads).toContain("expectedHashSha256: hashes.sha256");
    expect(uploads).toContain("expectedHashSha512: hashes.sha512");
    expect(uploads).not.toContain('.from("attachments")\n        .insert');
  });

  it("precommits exact attachment intents before emission and never rewrites the trace", () => {
    const prehash = stepper.indexOf("await buildSupportingAttachmentIntents(adjuntos)");
    const emission = stepper.indexOf("createConvocatoria.mutateAsync", prehash);
    expect(prehash).toBeGreaterThan(0);
    expect(emission).toBeGreaterThan(prehash);
    expect(stepper).toContain("uploaded_references: attachmentIntents");
    expect(stepper).not.toContain(".update({ reminders_trace:");
    expect(uploads).toContain("hash_sha256");
    expect(uploads).toContain("hash_sha512");
    expect(uploads).toContain("/supporting/${intentId}-${hashes.sha256.slice(0, 16)}-");
    expect(uploads).not.toContain('.remove([storagePath])');
  });

  it("binds supporting documents to the WORM manifest and requires the exact set before final", () => {
    expect(supportingIntentBinding).toContain("trg_01_convocation_manifest_enrich_supporting_intents");
    expect(supportingIntentBinding).toContain("secretaria.convocation-supporting-intents.v1");
    expect(supportingIntentBinding).toContain("supporting_attachment_intent_id");
    expect(supportingIntentBinding).toContain("SUPPORTING_ATTACHMENT_DOES_NOT_MATCH_EXACT_WORM_INTENT");
    expect(supportingIntentBinding).toContain("FINAL_CONVOCATION_REQUIRES_COMPLETE_EXACT_SUPPORTING_SET");
    expect(supportingIntentBinding).toContain("IMMUTABLE_CONVOCATION_TRACE_MUTATION_FORBIDDEN");
  });

  it("validates a live Auth session before creating Storage candidates", () => {
    expect(supportingArtifactClient).toContain("ensureLiveSupabaseSession");
    expect(supportingArtifactClient).toContain("supabase.auth.getUser(session.access_token)");
    expect(supportingArtifactClient).toContain("supabase.auth.refreshSession()");
    expect(supportingArtifactClient).toContain("La sesión de autenticación ya no es válida en el servidor");
    const sessionGuard = uploads.indexOf("await ensureLiveSupabaseSession()");
    const storageUpload = uploads.indexOf('.from("matter-documents")');
    expect(sessionGuard).toBeGreaterThan(0);
    expect(storageUpload).toBeGreaterThan(sessionGuard);
  });

  it("server-renders the final DOCX and separately rehashes supporting artifacts", () => {
    expect(archive).toContain("renderAndRegisterAuthoritativeConvocation");
    expect(archive).toContain("authoritativeDocumentData: artifact.documentData");
    expect(archive).not.toContain("precommitConvocationFinalCandidate");
    expect(artifactClient).toContain('"convocation-artifact-register"');
    expect(supportingArtifactClient).toContain('"convocation-supporting-artifact-register"');
    expect(artifactRegister).toContain("renderConvocationDocx(canonicalManifest, storedManifestHash)");
    expect(artifactRegister).toContain("digestHex('SHA-256', rendered.bytes)");
    expect(artifactRegister).toContain("digestHex('SHA-512', rendered.bytes)");
    expect(artifactRegister).toContain("fn_register_server_rendered_convocation_attachment");
    expect(artifactRegister).not.toContain("convocation_artifact_candidates");
    expect(supportingArtifactRegister).toContain(".download(storagePath)");
    expect(supportingArtifactRegister).toContain("hasDocxPackageMarkers(bytes)");
    expect(supportingArtifactRegister).toContain("fn_register_verified_convocation_attachment");
  });

  it("keeps ordinary scheduling atomic and prepares DEMO sandbox exclusively as BORRADOR", () => {
    expect(sendStep).toContain("const sandboxDraft = props.demoSandboxOnly === true");
    expect(sendStep).toContain("const requestedState = sandboxDraft ? 'BORRADOR' : 'PROGRAMADA'");
    expect(sendStep).toContain("estado: requestedState");
    expect(sendStep).toContain("fecha_programada: sandboxDraft ? null : fechaProgramada.toISOString()");
    expect(sendStep).toMatch(/if \(!sandboxDraft\) \{\s*await triggerDispatcher\(\);\s*\}/);
    expect(sendStep).toContain("providerInteraction: sandboxDraft ? 'NONE' : 'DISPATCHER_TRIGGERED'");
    expect(sendStep).not.toContain("programar.mutateAsync");
  });

  it("unlocks sandbox preparation only after the final server DOCX and materialized meeting", () => {
    const finalArtifactGuard = detail.indexOf(": !canonicalConvocatoriaAttachment ?");
    const meetingGuard = detail.indexOf(": !effectiveMeeting ?");
    const sendStepRender = detail.indexOf(": communicationOpen ?");
    expect(finalArtifactGuard).toBeGreaterThan(0);
    expect(meetingGuard).toBeGreaterThan(finalArtifactGuard);
    expect(sendStepRender).toBeGreaterThan(meetingGuard);
    expect(detail).toContain("demoSandboxOnly={demoSandboxOnly}");
    expect(detail).toContain('demoSandboxOnly ? "Preparar comunicación sandbox" : "Programar comunicación"');
    expect(detail).toContain('if (result.estado === "BORRADOR")');
    expect(detail).toContain("Comunicación sandbox preparada en borrador");
    expect(detail).toContain("Sin programación, sin envío y sin interacción con proveedor.");
  });

  it("rehashes body and every binary then revalidates the aggregate before providers", () => {
    expect(dispatcher).toContain("new TextEncoder().encode(comm.cuerpo_render)");
    expect(dispatcher).toContain("requires exactly one generated final document");
    expect(dispatcher).toContain("digestHex('SHA-256', bytes)");
    expect(dispatcher).toContain("digestHex('SHA-512', bytes)");
    expect(dispatcher).toContain("fn_revalidate_recipient_dispatch_attempt");
    expect(dispatcher).toContain("p_verified_attachments: verifiedAttachments");
    expect(dispatcher).toContain("content: verifiedContent");
    expect(dispatcher).toContain("isRetriablePreProviderFailure");
  });

  it("scopes provider claims and keeps active UI on a non-dispatchable EAD draft", () => {
    expect(dispatcher).toContain(".eq('tenant_id', profile.tenant_id)");
    expect(dispatcher).toContain("p_tenant_id: auth.isServiceRole ? null : auth.tenantId");
    expect(dispatcher).toContain("TGMS_EAD_NOTICE_PACKAGE_V1");
    expect(dispatcher).toContain("EAD Notice Manager attachment contract is not explicitly configured");
    expect(dispatcher).toContain("scope: packageMode ? 'MESSAGE_AND_ATTACHMENTS' : 'MESSAGE_BODY'");
    expect(dispatcher).toContain("contentBase64: attachment.content_base64");
    expect(erdsHook).toContain("fn_create_ead_interposition_draft");
    expect(erdsHook).toContain('status: "BORRADOR"');
    expect(erdsHook).toContain("providerInteraction: false");
    expect(erdsHook).not.toContain("useProgramCommunication");
    expect(erdsHook).not.toContain("BUROFAX_ERDS");
    expect(eadSystemPolicy).toContain("UNVERIFIED_CERTIFIED_LEVEL_IS_READ_ONLY_FOR_NEW_CAPTURES");
    expect(eadSystemPolicy).toContain("fn_revalidate_recipient_dispatch_attempt");
  });

  it("persists callbacks through governed reconciliation and keeps certification claims honest", () => {
    expect(resendWebhook).toContain("fn_recipient_record_resend_callback");
    expect(resendWebhook).not.toMatch(/from\('communication_recipients'\)\.update/);
    expect(resendWebhook).not.toMatch(/from\('communication_delivery_events'\)\.insert/);
    expect(dispatcher).toContain("EMAIL_CERTIFICADO is read-only until authoritative provider contract evidence is configured");
    expect(dispatcher).not.toContain("eadTrustTimestamp");
    expect(dispatcher).toContain("escapeHtml(signed.signedUrl)");
    expect(dispatcher).toContain("escapeHtml(a.label)");
    expect(dispatcher).toContain("acceptedUnknown: true");
    expect(dispatcher).toContain("if (!result.ok && 'acceptedUnknown' in result && result.acceptedUnknown)");
    expect(dispatcher).not.toContain("else if (result.acceptedUnknown)");
    expect(dispatcher).toContain("accepted-but-unknown provider result");
    expect(dispatcher).toContain("Resend transport outcome is unknown");
    expect(dispatcher).toContain("EAD Notice Manager transport outcome is unknown");
    expect(dispatcher).toContain("provider acceptance cannot be ruled out");
    expect(dispatcher).toContain("COMPLETED hash differs from the exact message/package hash");
    expect(dispatcher).toContain("expires_at");
    expect(artifactRegister).toContain("Date.parse(row.expires_at) > now");
    expect(supportingArtifactRegister).toContain("Date.parse(row.expires_at) > authorizationTime");
  });
});
