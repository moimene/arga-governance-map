import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Contrato del panel informativo del perfil de ejecución (Lote 1-bis, fase 1).
 *
 * La autorización legal registrada en el dossier es explícita: el panel es
 * INFORMATIVO y NO DISRUPTIVO. Estos pines evitan que una regresión lo
 * convierta en checkpoint operativo (fase 2+) sin decisión expresa.
 */
function read(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

const PANEL = "src/components/secretaria/MatterExecutionProfilePanel.tsx";
const TRAMITADOR = "src/pages/secretaria/TramitadorStepper.tsx";
const DOSSIER = "docs/superpowers/specs/dossier-revision-legal-matter-execution-profile.md";

describe("MatterExecutionProfilePanel — contrato de fase 1 informativa", () => {
  it("se declara informativo y no bloqueante en la propia superficie", () => {
    const panel = read(PANEL);
    expect(panel).toContain("Informativo · no bloqueante");
    expect(panel).toContain("No impide continuar la tramitación.");
    expect(panel).toContain('aria-label="Perfil de ejecución del acuerdo (informativo)"');
  });

  it("no fabrica perfil legal sin regla versionada ni rompe el tramitador si falla", () => {
    const panel = read(PANEL);
    // Sin rule pack no hay referencia legal que mostrar: valores por defecto
    // (Junta/SA/sesión formal) presentarían plazos y fuentes inventados.
    expect(panel).toContain("if (!materia || !rulePack) return null;");
    // Fallo silencioso: observación pura, el flujo continúa igual.
    expect(panel).toContain("} catch {");
    expect(panel).toContain("if (!profile) return null;");
  });

  // Codex adversarial (P1): ningún dato jurídico puede salir de un valor por
  // defecto, y la regla resuelta debe ser la del órgano del acuerdo.
  it("exige contexto real completo: sin tipo social, órgano o forma de adopción calla", () => {
    const panel = read(PANEL);
    expect(panel).toContain("const tipoSocial = entity?.tipo_social?.trim();");
    expect(panel).toContain("if (!tipoSocial) return null;");
    expect(panel).toContain("if (!packOrgano || !organoTipo) return null;");
    expect(panel).toContain("if (!adoptionMode?.trim()) return null;");
    // Sin defaults fabricados en la construcción del perfil.
    expect(panel).not.toContain('?? "JUNTA_GENERAL"');
    expect(panel).not.toContain('?? "SA"');
    expect(panel).not.toContain('?? "MEETING"');
  });

  it("calla si la regla versionada resuelta no es la del órgano del acuerdo", () => {
    const panel = read(PANEL);
    expect(panel).toContain("!organoMatchesPack(packOrgano, organoTipo)");
    // Sin bucket comodín: COMISION/COMITE/SOCIO_UNICO no pueden casar entre sí.
    expect(panel).not.toContain('return "OTRO";');
    // Un pack híbrido no acredita órgano: el panel calla.
    expect(panel).toContain('raw === "JUNTA_GENERAL_O_CONSEJO"');
    // El órgano del acuerdo lo resuelve el módulo canónico del proyecto.
    const tramitador2 = read(TRAMITADOR);
    expect(tramitador2).toContain("resolveOrganoTipo(selectedAgreementBody)");
    // Y el tramitador resuelve el órgano real del acuerdo para el rule pack.
    const tramitador = read(TRAMITADOR);
    expect(tramitador).toContain("selectedAgreementOrganoTipo");
    expect(tramitador).toContain("organoTipo={selectedAgreementOrganoTipo}");
  });

  it("no presenta el plazo del art. 176 LSC como mínimo de órganos de administración", () => {
    const panel = read(PANEL);
    expect(panel).toContain("isJuntaOrgano(profile.organo_tipo)");
    expect(panel).toContain("Plazo y forma según estatutos y reglamento del órgano de administración");
  });

  it("el tramitador lo monta sin condicionar ningún gate de avance", () => {
    const tramitador = read(TRAMITADOR);
    expect(tramitador).toContain("<MatterExecutionProfilePanel");
    // El perfil no debe participar en la habilitación de pasos.
    expect(tramitador).not.toContain("profile.gaps");
    expect(tramitador).not.toContain("buildMatterExecutionProfile");
  });

  it("la autorización de la fase 1 consta registrada en el dossier", () => {
    const dossier = read(DOSSIER);
    expect(dossier).toContain(
      "- [x] Autorizacion para conectar panel informativo en TramitadorStepper.",
    );
    expect(dossier).toContain("solo fase 1 informativa");
  });
});
