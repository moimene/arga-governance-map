import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const detail = read("src/pages/secretaria/ActaDetalle.tsx");
const button = read("src/components/secretaria/AprobarActaButton.tsx");
const hook = read("src/hooks/useActas.ts");
const bookHook = read("src/hooks/useSocietaryBookEntries.ts");
const certificationButton = read("src/components/secretaria/EmitirCertificacionButton.tsx");
const booksPage = read("src/pages/secretaria/LibrosObligatorios.tsx");

describe("Acta → evidencia EAD → aprobación → asiento → certificación", () => {
  it("distingue destino RESOLVED para aprobar y POSTED para certificar", () => {
    expect(detail).toContain('effectiveBookDestinationStatus !== "RESOLVED"');
    expect(detail).toContain('bookDestinationStatus={effectiveBookDestinationStatus}');
    expect(detail).toContain("resolveCertificationSourceGate({");
    expect(detail).toContain("onApproved={handleRegisterBookEntry}");
    expect(detail).toContain("Asentar acta aprobada");
  });

  it("aprueba desde artefacto y verificaciones persistidas, no desde personas declaradas por la UI", () => {
    expect(button).toContain('useAuthoritativeLegalEvidence(\n      "MINUTE"');
    expect(button).toContain('verifiedSigner(evidence.data?.verifications ?? [], "PRESIDENTE")');
    expect(button).toContain('verifiedSigner(evidence.data?.verifications ?? [], "SECRETARIO")');
    expect(hook).toContain('supabase.rpc("fn_aprobar_acta_autoritativa"');
    expect(hook).toContain("p_final_legal_artifact_id: params.finalLegalArtifactId");
    expect(hook).toContain(
      "p_president_consent_verification_id: params.presidentConsentVerificationId",
    );
    expect(hook).not.toContain('supabase.rpc("fn_aprobar_acta",');
    expect(button).not.toContain("presidentPersonaId");
  });

  it("no usa signed_at como gate jurídico ni presenta una simulación como aprobación", () => {
    expect(detail).toContain('const legalGateStatus = m.legal_gate_status ?? "DRAFT"');
    expect(detail).toContain('legalGateStatus === "DEMO_SIMULATION"');
    expect(detail).toContain("Simulación demo sin efecto jurídico");
    expect(detail).toMatch(
      /const isAuthoritativelyApproved\s*=\s*[\s\S]{0,120}legalGateStatus === "APPROVED_SIGNED"[\s\S]{0,240}approval_evidence_mode === "INTERPOSITION"[\s\S]{0,160}approval_signature_claim === false/,
    );
    expect(detail).not.toContain("const approvalMode = m.signed_at");
  });

  it("mantiene el asiento idempotente después de la aprobación autoritativa", () => {
    expect(button).toContain("await onApproved?.()");
    expect(detail).toContain("const bookEntryOperationId = useMemo(");
    expect(detail).toContain("() => (id ? crypto.randomUUID() : null)");
    expect(detail).toContain("operationId: bookEntryOperationId");
    expect(detail).toContain("!isAuthoritativelyApproved");
  });

  it("certifica solo por RPC autoritativa y jamás con tokens demo", () => {
    expect(certificationButton).toContain("useFirmarCertificacionAutoritativa");
    expect(certificationButton).toContain("useEmitirCertificacionAutoritativa");
    expect(hook).toContain('"fn_firmar_certificacion_autoritativa"');
    expect(certificationButton).not.toContain("qtsp:demo");
    expect(certificationButton).not.toContain("tsq:demo");
    expect(certificationButton).not.toContain('supabase.rpc("fn_firmar_certificacion"');
    expect(certificationButton).not.toMatch(/\bQES\b/);
  });

  it("explica que el artefacto final nace del output EAD reconciliado, no del candidato", () => {
    expect(certificationButton).toContain("recupere el output");
    expect(certificationButton).toContain("e-archive ese resultado");
    expect(detail).toContain("recupere el output");
    expect(detail).toContain("registrar el artefacto final");
  });

  it("refresca el acta y sus asientos tras resolver y registrar", () => {
    expect(bookHook).toContain('["actas", tenantId, "byId", minuteId]');
    expect(bookHook).toContain('["actas", tenantId, "byId", params.minuteId]');
    expect(bookHook).toContain(
      '["societary_book_entries", tenantId, "minute", params.minuteId]',
    );
  });

  it("expone la configuración de la sección de actas también en la tabla desktop", () => {
    const desktopTable = booksPage.slice(
      booksPage.indexOf('data-testid="libros-desktop-table"'),
    );

    expect(desktopTable).toContain('data-testid="libro-legalizacion-actions-desktop"');
    expect(desktopTable).toContain("<LibroLegalizacionActions book={b} />");
    expect(booksPage.match(/<LibroLegalizacionActions book=\{b\} \/>/g)).toHaveLength(2);
  });

  it("confirma dentro de la aplicación sin bloquear el navegador", () => {
    expect(button).toContain("AlertDialogTrigger");
    expect(button).toContain("Aprobar y bloquear definitivamente");
    expect(button).not.toContain("window.confirm");
  });
});
