import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  rulePackOrganoFamily,
  sameRulePackOrgano,
} from "@/lib/secretaria/rule-pack-organo";

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
    // Codex adversarial (2ª pasada): lista blanca, NO coincidencia por
    // substring. Con `includes()`, un código como NO_ADMINISTRACION casaba
    // como órgano de administración.
    //
    // El criterio ya no vive en el panel: es el módulo compartido
    // `rule-pack-organo`, para que el hook de selección y el panel no puedan
    // discrepar sobre a qué órgano pertenece la misma regla.
    expect(panel).toContain("rulePackOrganoFamily(value)");
    expect(panel).not.toContain('raw.includes("CONSEJO")');
    expect(panel).not.toContain('raw.includes("JUNTA")');
    // Ni el pack híbrido, ni el soporte interno, ni el socio único acreditan un
    // órgano del motor: el panel calla. Que el socio único equivalga a la Junta
    // (art. 15 LSC) es criterio pendiente del Comité Legal.
    expect(rulePackOrganoFamily("JUNTA_GENERAL_O_CONSEJO")).toBeNull();
    expect(rulePackOrganoFamily("SOPORTE_INTERNO")).toBe("SOPORTE_INTERNO");
    expect(rulePackOrganoFamily("SOCIO_UNICO")).toBe("SOCIO_UNICO");
    expect(sameRulePackOrgano("SOCIO_UNICO", "JUNTA_GENERAL")).toBe(false);
    // Y el substring no puede colarse: un código que "contiene" CONSEJO no casa.
    expect(rulePackOrganoFamily("NO_ADMINISTRACION")).toBeNull();
    expect(rulePackOrganoFamily("SIN_CONSEJO")).toBeNull();
    // El órgano del acuerdo lo resuelve el módulo canónico del proyecto, en su
    // variante ESTRICTA: el fallback a Junta sirve para calcular quórums, no
    // para afirmar en pantalla un órgano que nadie ha acreditado.
    const tramitador2 = read(TRAMITADOR);
    expect(tramitador2).toContain("resolveOrganoTipoStrict(selectedAgreementBody)");
    expect(tramitador2).not.toContain("resolveOrganoTipo(selectedAgreementBody)");
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

  it("no presenta un cero ni un umbral crudo como si fueran contenido jurídico", () => {
    const panel = read(PANEL);
    // Verificado en vivo (2026-07-18): un acuerdo sin sesión mostraba
    // "Constitución: 0 · art. 198 LSC", atribuyendo al artículo un quórum cero
    // que no establece. Un "0" es ausencia de umbral, no una regla.
    expect(panel).toContain("if (/^0([.,]0+)?$/.test(raw)) return null;");
    expect(panel).toContain("No aplica: no hay sesión que constituir");
    // La junta universal NO entra en esa lista: no requiere convocatoria, pero
    // sí hay sesión que constituir.
    expect(panel).not.toContain('SIN_SESION_MODES = new Set([\n  "UNIVERSAL"');
    // Y el umbral no se repite en crudo cuando la regla ya expresa la
    // proporción: "1/3 capital social" no necesita "(> 0.3333333333333333)",
    // que además es una cifra redondeada distinta de la fracción exacta.
    expect(panel).toContain("if (rule && /[0-9%]/.test(rule)) return null;");
    expect(panel).not.toContain("${profile.votacion.majority_threshold})");
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
