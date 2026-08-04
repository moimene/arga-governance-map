import { describe, it, expect } from "vitest";
import {
  LEGAL_BASELINE_BY_TIPO_SOCIAL,
  displaySocietyLegalForm,
} from "@/lib/secretaria/mesa-control-societaria";
import { legalFormFromTipo } from "@/lib/secretaria/sociedad-onboarding/defaults";
import { buildPrototypeMeetingRulePackFallback } from "@/lib/secretaria/prototype-rule-pack-fallback";
import { deriveTipoSocial } from "@/lib/secretaria/tipo-social";
import {
  normalizeSocietyFormForNormative,
  normalizeSocietyFormForRuleSet,
} from "@/lib/secretaria/normative-framework";
import { TIPO_SOCIAL_OPTIONS } from "@/pages/secretaria/sociedad-nueva/StepIdentificacionLegal";
import { TIPO_SOCIAL_LABEL, tipoSocialLabel } from "@/lib/secretaria/template-admin/labels";

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

// Task 2 (task-2-brief.md): los normalizadores dejan de colapsar SLP a SL y
// las superficies visibles dejan de caer al código crudo "SLP".

describe("deriveTipoSocial y normalizadores de forma societaria no colapsan SLP a SL (Task 2)", () => {
  it("deriveTipoSocial reconoce SLP y NO lo colapsa a SL", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(deriveTipoSocial({ tipo_social: "SLP" } as any)).toBe("SLP");
  });

  it("normalizeSocietyFormForNormative conserva la identidad SLP (código corto y texto libre)", () => {
    // Código canónico corto, tal como llega de entities.tipo_social.
    expect(normalizeSocietyFormForNormative("SLP")).toBe("SLP");
    expect(normalizeSocietyFormForNormative("S.L.P.")).toBe("SLP");
    // Texto libre (p.ej. entities.legal_form == legalFormFromTipo("SLP") de la
    // Task 1): antes caía en la rama genérica "SOCIEDADLIMITADA" y colapsaba a
    // "SL", perdiendo la identidad profesional.
    expect(normalizeSocietyFormForNormative("Sociedad Limitada Profesional")).toBe("SLP");
  });

  it("normalizeSocietyFormForRuleSet enruta SLP a los primitivos SL (LSC supletoria)", () => {
    // jurisdiction_rule_sets solo tiene company_form SA/SL: SLP debe resolver
    // como SL para que la búsqueda de régimen aplicable encuentre fila (Ley
    // 2/2007 no sustituye la LSC supletoria a estos efectos).
    expect(normalizeSocietyFormForRuleSet("SLP")).toBe("SL");
    expect(normalizeSocietyFormForRuleSet("Sociedad Limitada Profesional")).toBe("SL");
  });
});

describe("Identidad visible de SLP en superficies UI (Task 2 Step 3b)", () => {
  it("el dropdown de alta de sociedad ofrece SLP con nombre completo (no código crudo)", () => {
    const option = TIPO_SOCIAL_OPTIONS.find((opt) => opt.value === "SLP");
    expect(option).toBeDefined();
    expect(option?.label).toBe("Sociedad Limitada Profesional");
  });

  it("TIPO_SOCIAL_LABEL y tipoSocialLabel() no caen a código crudo para SLP", () => {
    expect(TIPO_SOCIAL_LABEL.SLP).toBe("Sociedad Limitada Profesional");
    expect(tipoSocialLabel("SLP")).toBe("Sociedad Limitada Profesional");
  });

  it("displaySocietyLegalForm (ES) no cae a código crudo para SLP", () => {
    expect(displaySocietyLegalForm({ jurisdiction: "ES", tipoSocial: "SLP" })).toBe(
      "Sociedad Limitada Profesional",
    );
  });
});
