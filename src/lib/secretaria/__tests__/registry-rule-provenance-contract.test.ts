import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Contrato de los avisos de procedencia de la regla registral.
 *
 * Verificado contra Cloud (2026-07-18): 8 de 37 acuerdos reciben hoy una regla
 * de otro órgano, y el instrumento que de ahí sale gatea `handleRegisterDeed`,
 * que persiste en `registry_filings` con estado ELEVADA. El aviso existía solo
 * en el paso 2; el botón está en el paso 5.
 *
 * Estos pines fijan dos cosas: que el aviso acompaña a la decisión, y que
 * ADVIERTE sin bloquear. Si con discrepancia de órgano debe además impedirse la
 * elevación, es criterio del Comité Legal y debe entrar con su acta, no de
 * tapadillo en un refactor.
 */
function read(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

const TRAMITADOR = "src/pages/secretaria/TramitadorStepper.tsx";
const NOTICE = "src/components/secretaria/RegistryRuleProvenanceNotice.tsx";
const HOOK_SIMULADOR = "src/hooks/useRulePacks.ts";
const RULE_MANAGER = "src/hooks/useRuleManager.ts";

describe("procedencia de la regla registral — avisar sin bloquear", () => {
  it("el aviso acompaña a la decisión: aparece dos veces, una junto al botón de escritura", () => {
    const tramitador = read(TRAMITADOR);
    const apariciones = tramitador.split("<RegistryRuleProvenanceNotice").length - 1;
    expect(apariciones).toBe(2);
    expect(tramitador).toContain("registryRuleProvenance");
  });

  it("distingue no tener regla de tener la de otro órgano", () => {
    const tramitador = read(TRAMITADOR);
    expect(tramitador).toContain('? "PROTOTIPO"');
    expect(tramitador).toContain('? "OTRO_ORGANO"');
    expect(tramitador).toContain("isUnreliableRulePackSelection(rulePackData?.selectionReason)");
  });

  it("NO bloquea: la procedencia no entra en la habilitación del botón", () => {
    const tramitador = read(TRAMITADOR);
    const habilitacion = tramitador.slice(
      tramitador.indexOf("const canRegisterDeed"),
      tramitador.indexOf("const canRegisterDeed") + 600,
    );
    expect(habilitacion).not.toContain("registryRuleProvenance");
    expect(habilitacion).not.toContain("selectionReason");
  });

  it("el aviso no dictamina: describe la procedencia y remite al criterio del abogado", () => {
    const notice = read(NOTICE);
    // Solo el texto que LEE el abogado: los comentarios del módulo sí explican
    // el porqué del cambio y citan la jerga que la UI no debe usar.
    const visible = notice.slice(notice.indexOf("const mensaje ="), notice.indexOf("return ("));
    expect(visible).toContain("revise los efectos registrales antes de utilizarlos");
    // Nada de conclusiones sobre validez o eficacia — eso lo dictamina el
    // abogado. "No están acreditados" se retiró por leerse como dictamen.
    expect(visible).not.toMatch(/no es válid|es nulo|debe otorgarse|no procede la inscripción/i);
    expect(visible).not.toContain("no están acreditados");
    // Ni jerga de plataforma en una superficie dirigida a un jurista.
    expect(visible).not.toContain("Cloud");
  });

  it("el aviso es accesible: se anuncia y el icono no se lee", () => {
    const notice = read(NOTICE);
    expect(notice).toContain('role="status"');
    expect(notice).toContain('aria-live="polite"');
    expect(notice).toContain('aria-hidden="true"');
  });

  it("usa tokens Garrigues y ningún color nativo de Tailwind", () => {
    const notice = read(NOTICE);
    expect(notice).toContain("var(--status-warning)");
    expect(notice).toContain("var(--g-text-secondary)");
    expect(notice).not.toMatch(/\b(bg|text|border)-(amber|red|green|yellow|gray|slate)-\d{2,3}\b/);
    expect(notice).not.toMatch(/#[0-9a-fA-F]{6}/);
  });
});

describe("el simulador no deriva mayoría de un pack ambiguo", () => {
  it("se niega a elegir entre packs de órganos distintos sin conocer el órgano", () => {
    const hook = read(HOOK_SIMULADOR);
    expect(hook).toContain("if (!organo && distintosOrganos.size > 1) return null;");
    // Con órgano conocido sí filtra, conservando su desempate de siempre.
    expect(hook).toContain("rulePackOrganoFamily(r.rule_packs?.organo_tipo) === organo");
    expect(hook).toContain("pickFreshestRulePackVersion(candidatos)");
  });

  it("NO cuela fail-closed por discrepancia de órgano: eso es la opción C", () => {
    // Codex adversarial: filtrar por órgano y devolver null cuando no hay
    // coincidencia es exactamente el comportamiento excluido de este lote.
    // Preferir sí; dejar de servir, no.
    const hook = read(HOOK_SIMULADOR);
    expect(hook).toContain("const candidatos = delOrgano.length > 0 ? delOrgano : rows;");
    expect(hook).toContain("post-demo y pendiente");
  });

  it("el órgano se propaga desde el input, que ya lo llevaba", () => {
    const manager = read(RULE_MANAGER);
    expect(manager).toContain("useRulePackForMateria(input.matter, input.bodyType)");
  });
});
