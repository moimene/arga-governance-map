import { describe, it, expect } from "vitest";
import { LEGAL_BASELINE_BY_TIPO_SOCIAL } from "@/lib/secretaria/mesa-control-societaria";
import { legalFormFromTipo } from "@/lib/secretaria/sociedad-onboarding/defaults";
import { buildPrototypeMeetingRulePackFallback } from "@/lib/secretaria/prototype-rule-pack-fallback";

// Nota de adaptación (task-1-brief.md §Step 1): el brief original usaba
// `buildPrototypeRulePack("SLP")` y campos `quorumPrimeraConvocatoria` como
// pseudocódigo ilustrativo. La API real es `buildPrototypeMeetingRulePackFallback
// (spec, organoTipo)` y `LegalBaseline` usa `firstQuorumPct`/`legalReference`
// (ver src/lib/rules-engine/types.ts y prototype-rule-pack-fallback.ts). Este
// test se adapta a la API real; el objetivo de la aserción es el mismo: SLP
// existe en el baseline legal y en antelacionDias/canales del rule pack de
// prototipo.

describe("TipoSocial soporta SLP como forma limitada-profesional", () => {
  it("SLP tiene baseline legal (reutiliza primitivos de SL, identidad propia)", () => {
    const slp = LEGAL_BASELINE_BY_TIPO_SOCIAL.SLP;
    expect(slp).toBeDefined();

    // SLP reutiliza quórum/mayoría de la familia limitada (SL)
    expect(slp.firstQuorumPct).toBe(LEGAL_BASELINE_BY_TIPO_SOCIAL.SL.firstQuorumPct);
    expect(slp.secondQuorumPct).toBe(LEGAL_BASELINE_BY_TIPO_SOCIAL.SL.secondQuorumPct);
    expect(slp.ordinaryMajorityPct).toBe(LEGAL_BASELINE_BY_TIPO_SOCIAL.SL.ordinaryMajorityPct);
    expect(slp.reinforcedMajorityPct).toBe(LEGAL_BASELINE_BY_TIPO_SOCIAL.SL.reinforcedMajorityPct);
    expect(slp.noticeDays).toBe(LEGAL_BASELINE_BY_TIPO_SOCIAL.SL.noticeDays);

    // ...pero con identidad legal propia (Comité Legal 2026-08-04: la
    // referencia de antelación NUNCA cita la Ley 2/2007, pero el baseline
    // legal general de SLP sí puede citarla como marco societario supletorio).
    expect(slp.legalReference).toBe("Ley 2/2007 de sociedades profesionales; LSC supletoria");
    expect(slp.legalReference).not.toBe(LEGAL_BASELINE_BY_TIPO_SOCIAL.SL.legalReference);
  });

  it("legalFormFromTipo etiqueta SLP como Sociedad Limitada Profesional (no 'Limitada')", () => {
    expect(legalFormFromTipo("SLP")).toBe("Sociedad Limitada Profesional");
  });

  it("el rule pack de prototipo tiene antelación y canales para SLP", () => {
    const pack = buildPrototypeMeetingRulePackFallback(
      { materia: "APROBACION_CUENTAS", clase: "ORDINARIA" },
      "CONSEJO",
    );

    expect(pack.convocatoria.antelacionDias.SLP).toBeDefined();
    expect(pack.convocatoria.antelacionDias.SLP.valor).toBe(15);
    // Cita vinculante Comité Legal 2026-08-04: la Ley 2/2007 no regula plazos
    // de convocatoria; la antelación SLP remite solo a la LSC supletoria.
    expect(pack.convocatoria.antelacionDias.SLP.referencia).toBe("art. 176 LSC (supletoria)");

    expect(pack.convocatoria.canales.SLP).toBeDefined();
  });
});
