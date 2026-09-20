import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import {
  AVISO_COBERTURA_PROVISIONAL,
  DESPLIEGUE_REQUIREMENTS,
  PROCEDENCIA_DESPLIEGUE,
  catalogoDeLosFindings,
  codigosDelPerfil,
  evaluadaContraOtroCatalogo,
  perfilAplicable,
  procedenciaDe,
} from "../perfil-aplicabilidad";
import { AESIA_RIA_REQUIREMENTS, ISO_42001_REQUIREMENTS } from "../catalog-aesia";
import { ROLES_DE_DESPLIEGUE, ROLES_DE_PROVEEDOR, derivarMarcos } from "../cuestionario-calificacion";

/**
 * Las 84 medidas guía desarrollan los arts. 9 a 15, 17, 72 y 73: son las
 * obligaciones del PROVEEDOR de un sistema de alto riesgo. Medir con ellas a un
 * responsable del despliegue de riesgo limitado produce un porcentaje que no
 * dice si cumple, sino que se le ha medido contra deberes que no le vinculan.
 *
 * En el primer piloto real (Harvey, tenant Garrigues) eso dio un 49 %.
 */

const medidasDe = (cat: typeof AESIA_RIA_REQUIREMENTS) =>
  cat.reduce((n, r) => n + r.measures.length, 0);

describe("el catálogo se acota por rol y nivel de riesgo", () => {
  it("un responsable del despliegue de riesgo limitado no se mide con el catálogo del proveedor", () => {
    // Control positivo del instrumento: el catálogo de proveedor es el que se
    // dice que es. Sin esto, un perfil que devolviera siempre lo mismo dejaría
    // el resto de aserciones verdes.
    // 84 → 93 → 99 con el recotejo contra el consolidado (F1.T12 y F1.T13, 2026-09-19).
    expect(medidasDe(AESIA_RIA_REQUIREMENTS), "el catálogo de proveedor ya no son 99 medidas").toBe(99);

    const perfil = perfilAplicable(
      { regulatory_role: "RESPONSABLE_DESPLIEGUE", risk_level: "Limitado" },
      AESIA_RIA_REQUIREMENTS,
    );
    expect(perfil.requirements).toBe(DESPLIEGUE_REQUIREMENTS);
    expect(perfil.provisional, "el catálogo del despliegue no se declara provisional").toBe(true);
    expect(medidasDe(perfil.requirements)).toBeLessThan(medidasDe(AESIA_RIA_REQUIREMENTS));
    expect(medidasDe(perfil.requirements)).toBeGreaterThanOrEqual(30);
  });

  it("sin rol declarado FALLA ABIERTO: catálogo completo y aviso", () => {
    // Medir de más y decirlo es conservador; medir de menos por un dato que
    // falta esconde obligaciones.
    const perfil = perfilAplicable({ regulatory_role: null, risk_level: "Limitado" }, AESIA_RIA_REQUIREMENTS);
    expect(perfil.requirements).toBe(AESIA_RIA_REQUIREMENTS);
    expect(perfil.sinRolDeclarado).toBe(true);
    expect(perfil.motivo).toMatch(/no declara rol/i);
  });

  it("en alto riesgo no se reduce nada, sea cual sea el rol", () => {
    for (const nivel of ["Alto", "Inaceptable"]) {
      const perfil = perfilAplicable(
        { regulatory_role: "RESPONSABLE_DESPLIEGUE", risk_level: nivel },
        AESIA_RIA_REQUIREMENTS,
      );
      expect(perfil.requirements, `${nivel} se está midiendo con el catálogo reducido`).toBe(
        AESIA_RIA_REQUIREMENTS,
      );
      expect(perfil.provisional).toBe(false);
    }
  });

  it("sin nivel de riesgo tampoco se reduce", () => {
    const perfil = perfilAplicable(
      { regulatory_role: "RESPONSABLE_DESPLIEGUE", risk_level: "" },
      AESIA_RIA_REQUIREMENTS,
    );
    expect(perfil.requirements).toBe(AESIA_RIA_REQUIREMENTS);
  });

  it("un proveedor de riesgo limitado sigue midiéndose con su catálogo", () => {
    const perfil = perfilAplicable(
      { regulatory_role: "PROVEEDOR", risk_level: "Limitado" },
      AESIA_RIA_REQUIREMENTS,
    );
    expect(perfil.requirements).toBe(AESIA_RIA_REQUIREMENTS);
  });
});

describe("cada medida del perfil dice de dónde sale y con qué carácter", () => {
  it("todas las medidas del catálogo del despliegue tienen procedencia declarada", () => {
    const sinProcedencia = DESPLIEGUE_REQUIREMENTS.flatMap((r) => r.measures)
      .map((m) => m.id)
      .filter((id) => !procedenciaDe(id));
    expect(sinProcedencia, `medidas sin procedencia: ${sinProcedencia.join(", ")}`).toEqual([]);
  });

  it("no sobra procedencia de medidas que no existen", () => {
    const codigos = new Set(DESPLIEGUE_REQUIREMENTS.flatMap((r) => r.measures.map((m) => m.id)));
    const huerfanas = Object.keys(PROCEDENCIA_DESPLIEGUE).filter((id) => !codigos.has(id));
    expect(huerfanas, `procedencia huérfana: ${huerfanas.join(", ")}`).toEqual([]);
  });

  it("ningún control de ISO 42001 se presenta como obligación jurídica", () => {
    // La validación regulatoria lo dice expresamente: ISO/IEC 42001 y las guías
    // de la AESIA valen como marco operativo de madurez y documentación, pero
    // las obligaciones ejecutables se anclan en el RIA, el RGPD y el derecho
    // aplicable. Presentar un control del anexo A como deber jurídico sería
    // fabricar una obligación que la norma no impone.
    const isoComoObligacion = Object.entries(PROCEDENCIA_DESPLIEGUE)
      .filter(([, p]) => p.fuente === "ISO_42001" && p.caracter === "OBLIGACION")
      .map(([id]) => id);
    expect(isoComoObligacion, `ISO presentada como obligación: ${isoComoObligacion.join(", ")}`).toEqual([]);

    // Y lo mismo con la deontología profesional, que no es norma exigible por
    // el Reglamento.
    const deontologiaComoObligacion = Object.entries(PROCEDENCIA_DESPLIEGUE)
      .filter(([, p]) => p.fuente === "DEONTOLOGIA" && p.caracter === "OBLIGACION")
      .map(([id]) => id);
    expect(deontologiaComoObligacion).toEqual([]);
  });

  it("el art. 26 no se presenta como obligación en riesgo limitado", () => {
    // El art. 26 vincula al responsable del despliegue de un sistema de ALTO
    // riesgo. El catálogo del perfil es el de riesgo limitado.
    const art26 = Object.entries(PROCEDENCIA_DESPLIEGUE).filter(([, p]) => p.norma.startsWith("Art. 26"));
    expect(art26.length, "ya no hay medidas del art. 26: revisa este invariante").toBeGreaterThan(0);
    expect(art26.every(([, p]) => p.caracter === "MARCO_OPERATIVO")).toBe(true);
  });

  it("el art. 4 sí es obligación: vincula a proveedores y a responsables del despliegue", () => {
    const art4 = Object.entries(PROCEDENCIA_DESPLIEGUE).filter(([, p]) => p.norma === "Art. 4");
    expect(art4.length).toBeGreaterThan(0);
    expect(art4.every(([, p]) => p.caracter === "OBLIGACION")).toBe(true);
  });

  it("F1.T11 — el art. 4 con la redacción del Ómnibus: adoptar medidas para apoyar, sin nivel exigido", () => {
    const alf = DESPLIEGUE_REQUIREMENTS.find((r) => r.code === "ALFABETIZACION");
    expect(alf, "ha desaparecido el requisito del art. 4").toBeDefined();
    expect(alf!.description).toMatch(/adoptar medidas para apoyar/i);
    expect(alf!.description).toMatch(/no exige garantizar un nivel/i);
    expect(alf!.description).not.toMatch(/Garantizar un nivel suficiente/i);
    // El registro de aprovechamiento mide un resultado que el art. 4 ya no
    // exige: es marco operativo, no obligación.
    expect(procedenciaDe("MD_ALF_05")?.caracter).toBe("MARCO_OPERATIVO");
  });

  it("F1.T11 — el catálogo no mide el art. 4 como obligación de un rol al que los marcos no se lo asignan", () => {
    // Retirada a medias: `derivarMarcos` dejó de asignar el art. 4 a importador
    // y distribuidor, pero el perfil les servía el catálogo del desplegador,
    // que mide MD_ALF_01 a 04 como OBLIGACION «Art. 4».
    const mideArt4 = (reqs: typeof AESIA_RIA_REQUIREMENTS) =>
      reqs.some((r) =>
        r.measures.some((m) => {
          const proc = procedenciaDe(m.id);
          return proc?.caracter === "OBLIGACION" && proc.norma === "Art. 4";
        }),
      );
    // Control positivo del instrumento: distingue un catálogo del otro.
    expect(mideArt4(DESPLIEGUE_REQUIREMENTS)).toBe(true);
    expect(mideArt4(AESIA_RIA_REQUIREMENTS)).toBe(false);
    const roles = [...ROLES_DE_DESPLIEGUE, ...ROLES_DE_PROVEEDOR];
    expect(roles).toEqual(expect.arrayContaining(["RESPONSABLE_DESPLIEGUE", "IMPORTADOR", "DISTRIBUIDOR", "PROVEEDOR"]));

    const discrepan: string[] = [];
    let midenArt4 = 0;
    for (const rol of roles) {
      for (const nivel of ["Alto", "Limitado", "Mínimo"]) {
        const mide = mideArt4(perfilAplicable({ regulatory_role: rol, risk_level: nivel }, AESIA_RIA_REQUIREMENTS).requirements);
        const asignado = derivarMarcos(rol, nivel, false).some((m) => m.code === "RIA_ART_4");
        if (mide) midenArt4++;
        if (mide && !asignado) discrepan.push(`${rol} · ${nivel}`);
      }
    }
    expect(discrepan).toEqual([]);
    // Sin esto, un perfil que nunca sirviera el catálogo del desplegador
    // dejaría la lista vacía por construcción.
    expect(midenArt4).toBeGreaterThan(0);
  });

  it("F1.T11 — el art. 50.4 obliga al responsable del despliegue a divulgar, no a marcar", () => {
    const tra = DESPLIEGUE_REQUIREMENTS.find((r) => r.code === "TRANSPARENCIA")!;
    const m = tra.measures.find((x) => x.id === "MD_TRA_02");
    expect(m?.description).toMatch(/^Divulgaci[óo]n/);
    expect(tra.subparts.find((s) => s.subpartId === "TRA.CONTENIDO")?.titleShort).toMatch(/Divulgaci[óo]n/);
    expect(procedenciaDe("MD_TRA_02")?.norma).toBe("Art. 50.4");
  });

  it("los códigos no colisionan con los del catálogo del proveedor", () => {
    // Si colisionaran, `catalogoDeLosFindings` no podría distinguir con cuál se
    // evaluó una fila ya guardada.
    const proveedor = new Set(AESIA_RIA_REQUIREMENTS.flatMap((r) => r.measures.map((m) => m.id)));
    const choques = DESPLIEGUE_REQUIREMENTS.flatMap((r) => r.measures.map((m) => m.id)).filter((id) =>
      proveedor.has(id),
    );
    expect(choques).toEqual([]);
  });
});

describe("el informe resuelve el catálogo por el dato, no por la columna", () => {
  it("una evaluación del despliegue se pinta con su catálogo", () => {
    const findings = DESPLIEGUE_REQUIREMENTS[0].measures.map((m) => ({ code: m.id }));
    expect(
      catalogoDeLosFindings(findings, [AESIA_RIA_REQUIREMENTS, DESPLIEGUE_REQUIREMENTS]),
    ).toBe(DESPLIEGUE_REQUIREMENTS);
  });

  it("una evaluación del proveedor se sigue pintando con las 84", () => {
    const findings = AESIA_RIA_REQUIREMENTS[0].measures.map((m) => ({ code: m.id }));
    expect(
      catalogoDeLosFindings(findings, [AESIA_RIA_REQUIREMENTS, DESPLIEGUE_REQUIREMENTS]),
    ).toBe(AESIA_RIA_REQUIREMENTS);
  });

  it("sin findings, o con códigos de ningún catálogo, se queda con el primero", () => {
    expect(catalogoDeLosFindings([], [ISO_42001_REQUIREMENTS, DESPLIEGUE_REQUIREMENTS])).toBe(
      ISO_42001_REQUIREMENTS,
    );
    expect(
      catalogoDeLosFindings([{ code: "VAL-01" }], [ISO_42001_REQUIREMENTS, DESPLIEGUE_REQUIREMENTS]),
    ).toBe(ISO_42001_REQUIREMENTS);
  });
});

describe("las pantallas declaran el perfil", () => {
  it("el wizard y el informe avisan de la cobertura provisional", () => {
    // Cargar un catálogo no validado por el Comité de IA sin decirlo lo
    // convertiría en un dictamen que nadie ha firmado.
    // El wizard se descompuso el 2026-09-08: el aviso lo pinta su banner y la
    // página sólo lo monta. Se apunta a donde vive el literal.
    for (const f of [
      "src/components/ai-governance/evaluacion/PerfilAplicabilidadBanner.tsx",
      "src/components/ai-governance/evaluacion-detalle/CabeceraInforme.tsx",
    ]) {
      const src = readFileSync(f, "utf8");
      expect(src, `${f} no declara la cobertura provisional`).toContain("AVISO_COBERTURA_PROVISIONAL");
    }
    // ARISTA. Repuntar sólo el literal dejaría verde un banner que nadie monta:
    // el aviso estaría escrito y no llegaría a ninguna pantalla.
    const wizard = readFileSync("src/pages/ai-governance/EvaluacionNueva.tsx", "utf8");
    expect(wizard, "el wizard ya no monta el banner del perfil: el aviso no llega a pantalla")
      .toContain("<PerfilAplicabilidadBanner");
    expect(AVISO_COBERTURA_PROVISIONAL).toMatch(/Comité de IA/);
  });

  it("el wizard elige el catálogo por el perfil, no por el marco a secas", () => {
    const src = readFileSync("src/pages/ai-governance/EvaluacionNueva.tsx", "utf8");
    expect(src).toMatch(/perfilAplicable\(selectedSystem/);
    expect(src).toMatch(/const requirements: RequirementDef\[\] = perfil\.requirements/);
  });
});

describe("el perfil expone el perfil de catálogo A/B/C del cuestionario guiado (2026-09-08)", () => {
  it("proveedor de alto riesgo es A; despliegue de alto riesgo es B y falla abierto diciéndolo", () => {
    const a = perfilAplicable({ regulatory_role: "PROVEEDOR", risk_level: "Alto" }, AESIA_RIA_REQUIREMENTS);
    expect(a.catalogProfile).toBe("PROFILE_A");
    const b = perfilAplicable({ regulatory_role: "RESPONSABLE_DESPLIEGUE", risk_level: "Alto" }, AESIA_RIA_REQUIREMENTS);
    expect(b.catalogProfile).toBe("PROFILE_B");
    // S-6: no hay catálogo validado para el perfil B; se mide contra las 84 y se dice.
    expect(b.requirements).toBe(AESIA_RIA_REQUIREMENTS);
    expect(b.motivo).toMatch(/no hay catálogo validado/i);
  });

  it("despliegue de riesgo limitado es C con las 44; sin rol no hay perfil", () => {
    const c = perfilAplicable({ regulatory_role: "RESPONSABLE_DESPLIEGUE", risk_level: "Limitado" }, AESIA_RIA_REQUIREMENTS);
    expect(c.catalogProfile).toBe("PROFILE_C");
    expect(c.requirements).toBe(DESPLIEGUE_REQUIREMENTS);
    expect(perfilAplicable({ regulatory_role: null, risk_level: "Limitado" }, AESIA_RIA_REQUIREMENTS).catalogProfile).toBeNull();
  });
});

describe("evaluadaContraOtroCatalogo — sólo con clasificación guiada", () => {
  const MG = [{ code: "MG_QUAL_01" }, { code: "MG_QUAL_02" }];
  const MD = [{ code: "MD_ALF_01" }, { code: "MD_TRA_01" }];
  const despliegueGuiado = {
    regulatory_role: "RESPONSABLE_DESPLIEGUE",
    risk_level: "Limitado",
    regulatory_profile: { cuestionario_id: "x" },
  };
  const sinPerfil = { regulatory_role: null, risk_level: null, regulatory_profile: null };

  it("(a) findings del proveedor sobre un desplegador clasificado → true", () => {
    // Control del instrumento: esos códigos son del catálogo de proveedor.
    expect(catalogoDeLosFindings(MG, [AESIA_RIA_REQUIREMENTS, DESPLIEGUE_REQUIREMENTS])).toBe(AESIA_RIA_REQUIREMENTS);
    expect(evaluadaContraOtroCatalogo(MG, despliegueGuiado, AESIA_RIA_REQUIREMENTS)).toBe(true);
  });

  it("(b) sin regulatory_profile ni rol → false SIEMPRE (fail-open intacto, cero cambio ARGA)", () => {
    // Sin rol, perfilAplicable ya elige el catálogo de proveedor, igual que los
    // findings MG: esta aserción da false con o sin guard (documenta ARGA, no muerde).
    expect(evaluadaContraOtroCatalogo(MG, sinPerfil, AESIA_RIA_REQUIREMENTS)).toBe(false);
    // ÉSTA es la que muerde el guard: rol de despliegue (catálogo distinto de los
    // findings MG) y sin cuestionario. Sin tieneClasificacionGuiada daría true.
    expect(evaluadaContraOtroCatalogo(MG, { ...despliegueGuiado, regulatory_profile: null }, AESIA_RIA_REQUIREMENTS)).toBe(false);
  });

  it("(e) sin nada evaluado contra el RIA no se afirma «otro catálogo»: [], undefined e ISO 42001 → false", () => {
    // Control del instrumento: sin aciertos catalogoDeLosFindings cae a candidatos[0].
    expect(catalogoDeLosFindings([], [AESIA_RIA_REQUIREMENTS, DESPLIEGUE_REQUIREMENTS])).toBe(AESIA_RIA_REQUIREMENTS);
    expect(evaluadaContraOtroCatalogo([], despliegueGuiado, AESIA_RIA_REQUIREMENTS)).toBe(false);
    expect(evaluadaContraOtroCatalogo(undefined, despliegueGuiado, AESIA_RIA_REQUIREMENTS)).toBe(false);
    expect(evaluadaContraOtroCatalogo([{ code: "ISO_A_6_2_2" }], despliegueGuiado, AESIA_RIA_REQUIREMENTS)).toBe(false);
    // Y el positivo (a) sigue vivo al lado.
    expect(evaluadaContraOtroCatalogo(MG, despliegueGuiado, AESIA_RIA_REQUIREMENTS)).toBe(true);
  });

  it("(c) findings del despliegue sobre el mismo desplegador → false", () => {
    expect(evaluadaContraOtroCatalogo(MD, despliegueGuiado, AESIA_RIA_REQUIREMENTS)).toBe(false);
  });

  it("(d) codigosDelPerfil sigue al perfil: despliegue sin QUALITY_MGMT, sin rol con él", () => {
    const codigosDespliegue = codigosDelPerfil(despliegueGuiado, AESIA_RIA_REQUIREMENTS);
    expect(codigosDespliegue).toEqual(new Set(DESPLIEGUE_REQUIREMENTS.map((r) => r.code)));
    expect(codigosDespliegue.has("QUALITY_MGMT")).toBe(false);
    expect(codigosDelPerfil(sinPerfil, AESIA_RIA_REQUIREMENTS).has("QUALITY_MGMT")).toBe(true);
  });
});
