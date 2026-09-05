import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { sinComentarios } from "../helpers/sin-comentarios";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");



const generator = read("src/pages/secretaria/GenerarDocumentoStepper.tsx");
const agreement = read("src/pages/secretaria/ExpedienteAcuerdo.tsx");
const certification = read("src/components/secretaria/EmitirCertificacionButton.tsx");
const annualAccounts = read("src/components/secretaria/AnnualAccountsArtifactPanel.tsx");
const eadControl = read("src/components/secretaria/EADInterpositionControl.tsx");
const convocation = read("src/pages/secretaria/ConvocatoriaDetalle.tsx");
const standaloneCertification = read("src/lib/secretaria/standalone-certifications/document.ts");
const incidentDetail = read("src/pages/grc/IncidenteDetalle.tsx");
const aiSystemDetail = read("src/pages/ai-governance/SistemaDetalle.tsx");
const tprm = read("src/pages/grc/TPRM.tsx");
const penal = read("src/pages/grc/PenalAnticorrupcion.tsx");
const demoRunner = read("src/lib/demo-operable/runner.ts");
const demoTrust = read("src/lib/demo-operable/trust-sandbox.ts");
const authoritativeState = read("src/lib/secretaria/authoritative-legal-state.ts");

describe("política de producto EAD Trust · interposición, mensajería y e-archiving", () => {
  it("el generador retira la firma genérica y deriva la custodia al expediente", () => {
    expect(generator).toContain("La solicitud genérica de firma está retirada");
    expect(generator).toContain("Custodia disponible desde expediente");
    expect(generator).not.toContain("signMutation.mutateAsync");
    expect(generator).not.toContain("Firma electrónica (EAD Trust)");
    expect(generator).not.toContain("Solicitar firma");
    expect(generator).not.toContain("Documento firmado por todos los firmantes");
  });

  it("el cierre documental de Agreement 360 no exige QES", () => {
    expect(agreement).toContain('id: "ARCHIVO_DOCUMENTAL"');
    expect(agreement).not.toContain("check.type === \"QES\"");
    expect(agreement).not.toContain("qesVerified=");
  });

  it("la certificación no eleva ADVANCED a requisito de producto", () => {
    expect(certification).not.toContain('required_ead_signature_type === "ADVANCED"');
    expect(certification).toContain("interposición EAD");
    expect(certification).toContain("e-archive ese resultado");
  });

  it("la custodia de cuentas no sustituye las firmas societarias del artículo 253.2 LSC", () => {
    expect(annualAccounts).toContain("artículo 253.2 LSC");
    expect(annualAccounts).toContain("firma de todos los administradores");
    expect(annualAccounts).toContain("La custodia EAD no sustituye esa evidencia societaria");
    expect(annualAccounts).toContain("no afirma una firma");
  });

  it("el control mantiene el candidato del navegador fuera de la custodia final", () => {
    expect(eadControl).toContain("EAD Trust · Custodia/e-archiving");
    expect(eadControl).toContain("solo un candidato descargable para revisión");
    expect(eadControl).toContain("Custodia final no disponible");
    expect(eadControl).toContain("render binario producido");
    expect(eadControl).not.toContain("Output firmado recuperado");
    expect(eadControl).not.toContain("archiveFinalLegalArtifactWithEADTrust");
  });

  it("convocatoria y certificación autónoma no generan promesas de QES o timestamp", () => {
    expect(convocation).not.toContain("tsq_token");
    expect(convocation).not.toContain("firma_qes_ref");
    expect(convocation).not.toContain("sello_tiempo_ref");
    expect(convocation).not.toContain("Pendiente de firma electrónica productiva");
    expect(standaloneCertification).toContain('ead_operation: "INTERPOSITION_CUSTODY"');
    expect(standaloneCertification).toContain("signature_claim: false");
    expect(standaloneCertification).not.toContain("QES EAD Trust requerida");
  });

  it("retira la promesa de firma también de GRC y AI Governance", () => {
    // A3 (2026-08-29) endureció la mitad de AI Governance, pero dejaba tres
    // aserciones POSITIVAS sobre GRC que exigían la presencia de afirmaciones
    // que el producto no sostiene:
    //
    //   toContain("Custodia documental (EAD Trust)")          — GRC no llama a EAD
    //   toContain("PLAN DE SALIDA CUSTODIADO EN LEDGER WORM") — no consultaba nada
    //   toContain("QSeal no personal")                        — sin token de sello
    //
    // Con ellas, retirar la afirmación ponía el gate en ROJO: el test premiaba
    // conservarla. Es la misma forma que tenía `e2e/grc-dora.spec.ts`, que
    // asertaba «QSeal Custodia» como comportamiento esperado. Un gate que pina
    // una afirmación sin respaldo no protege el producto: lo ata a ella.
    //
    // El motivo que las justificaba («GRC no se ha medido aquí») ya no vale:
    // el carril GRC lo midió el 2026-09-05 —ninguna evidencia de esos módulos
    // tiene token de sello y EAD Trust no es prestador de firma ni de sello en
    // el alcance vigente— y retiró las tres. Las positivas pasan a negativas.
    const incidentCode = sinComentarios(incidentDetail);
    const aiCode = sinComentarios(aiSystemDetail);
    const tprmCode = sinComentarios(tprm);
    const penalCode = sinComentarios(penal);

    expect(incidentCode).not.toMatch(/Custodia documental \(EAD\s*Trust\)/i);
    expect(incidentCode).not.toContain("El proveedor emite firma simple o avanzada");
    expect(aiCode).not.toMatch(/EAD\s*Trust/i);
    expect(aiCode).not.toContain("Confirmar y Firmar");
    expect(tprmCode).not.toContain("LEDGER WORM");
    expect(tprmCode).not.toContain("qualified timestamping");
    expect(penalCode).not.toMatch(/QSeal Custodia|Verificar QSeal|EAD Trust Custody ID/);
    expect(penalCode).not.toContain("selladas mediante firma electrónica");

    // Control positivo: los tres ficheros se han leído de verdad. Sin esto, una
    // ruta equivocada daría cadena vacía y todas las negativas pasarían solas.
    for (const [nombre, src] of [
      ["IncidenteDetalle", incidentDetail],
      ["SistemaDetalle", aiSystemDetail],
      ["TPRM", tprm],
      ["PenalAnticorrupcion", penal],
    ] as const) {
      expect(src.length, `${nombre}: fuente vacía, las negativas pasarían vacuas`)
        .toBeGreaterThan(1000);
    }
  });

  it("la demo modela interposición sandbox, nunca QES sandbox", () => {
    expect(demoRunner).toContain('interpositionMode: "INTERPOSITION_SANDBOX"');
    expect(demoRunner).not.toContain("QES_SANDBOX");
    expect(demoTrust).toContain('interposition: {');
    expect(demoTrust).not.toContain("create-signature-request");
    expect(demoTrust).not.toContain("activate-signature-request");
    expect(authoritativeState).toContain('EadSignatureType = "INTERPOSITION"');
    expect(authoritativeState).not.toContain('"INTERPOSITION" | "ADVANCED"');
  });
});
