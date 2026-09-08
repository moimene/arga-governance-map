import { describe, it, expect } from "bun:test";
import {
  CUESTIONARIO_VERSION,
  ETIQUETA_PERFIL,
  PREGUNTAS,
  bloqueosParaConfirmar,
  derivarMarcos,
  derivarNivel,
  derivarRol,
  perfilCatalogo,
  preguntasVisibles,
  resultadoProvisional,
  type Respuestas,
} from "../cuestionario-calificacion";

/**
 * El cuestionario guiado de calificación regulatoria de la spec v1.1 del
 * equipo legal, con las decisiones S-1…S-9 de la validación del 2026-09-08:
 * el árbol DERIVA rol y nivel (nadie los elige de un desplegable), sólo
 * alcanza dos roles, y el vocabulario persistido no cambia.
 */

const DESPLIEGUE: Respuestas = { Q1_1: false, Q1_2: false, Q1_3: false, Q1_4: true };
const NADA_DE_RIESGO: Respuestas = { Q2_1: false, Q2_2: false, Q2_4: false, Q2_5: false };

describe("catálogo de preguntas", () => {
  it("son las nueve de la spec, cada una con las tres secciones de ayuda", () => {
    expect(CUESTIONARIO_VERSION).toBe("1.1");
    expect(PREGUNTAS.map((p) => p.id)).toEqual([
      "Q1_1", "Q1_2", "Q1_3", "Q1_4", "Q2_1", "Q2_2", "Q2_3", "Q2_4", "Q2_5",
    ]);
    // Donde se corrigió una cita de la spec, la spec se conserva en notaSpec.
    expect(PREGUNTAS.find((p) => p.id === "Q1_1")?.notaSpec).toMatch(/3\.1/);
    expect(PREGUNTAS.find((p) => p.id === "Q1_2")?.notaSpec).toMatch(/3\.3/);
    for (const p of PREGUNTAS) {
      expect(p.ayuda.queSignifica.length, `${p.id} sin «qué significa»`).toBeGreaterThan(20);
      expect(p.ayuda.ejemplos.length, `${p.id} sin ejemplos`).toBeGreaterThan(0);
      expect(p.ayuda.comoSaberlo.length, `${p.id} sin «cómo saberlo»`).toBeGreaterThan(20);
      expect(p.articulo, `${p.id} sin artículo`).toMatch(/art/i);
    }
  });

  it("Q2.3 sólo es visible cuando el caso está en el anexo III", () => {
    expect(preguntasVisibles({ Q2_2: false }).map((p) => p.id)).not.toContain("Q2_3");
    expect(preguntasVisibles({ Q2_2: true }).map((p) => p.id)).toContain("Q2_3");
    // Sin responder Q2.2 tampoco: la excepción es de un caso que primero hay que afirmar.
    expect(preguntasVisibles({}).map((p) => p.id)).not.toContain("Q2_3");
  });
});

describe("fase 1 — rol", () => {
  it("cualquiera de Q1.1–Q1.3 afirmativa hace proveedor", () => {
    expect(derivarRol({ Q1_1: true, Q1_2: false, Q1_3: false })?.rol).toBe("PROVEEDOR");
    expect(derivarRol({ Q1_1: false, Q1_2: true, Q1_3: false })?.rol).toBe("PROVEEDOR");
    expect(derivarRol({ Q1_1: false, Q1_2: false, Q1_3: true })?.rol).toBe("PROVEEDOR");
  });

  it("las tres negativas hacen responsable del despliegue (art. 3.4), con el término del Reglamento", () => {
    const r = derivarRol(DESPLIEGUE);
    expect(r?.rol).toBe("RESPONSABLE_DESPLIEGUE");
    expect(r?.motivo).toMatch(/3\.4/);
  });

  it("Q1.4 es complementaria: no determina el rol por sí sola", () => {
    expect(derivarRol({ Q1_1: false, Q1_2: false, Q1_3: false, Q1_4: true })?.rol).toBe("RESPONSABLE_DESPLIEGUE");
    expect(derivarRol({ Q1_1: false, Q1_2: false, Q1_3: false, Q1_4: false })?.rol).toBe("RESPONSABLE_DESPLIEGUE");
  });

  it("con alguna de Q1.1–Q1.3 sin responder no hay rol", () => {
    expect(derivarRol({ Q1_1: false, Q1_2: false })).toBeNull();
    expect(derivarRol({})).toBeNull();
    // Pero una afirmativa basta aunque falten las otras: ya es proveedor.
    expect(derivarRol({ Q1_1: true })?.rol).toBe("PROVEEDOR");
  });
});

describe("fase 2 — nivel", () => {
  it("una práctica prohibida es Inaceptable y bloquea (art. 5)", () => {
    const n = derivarNivel({ Q2_1: true });
    expect(n?.nivel).toBe("Inaceptable");
    expect(resultadoProvisional({ Q2_1: true }).bloqueado).toBe(true);
    expect(resultadoProvisional({ Q2_1: true }).perfil).toBeNull();
  });

  it("anexo III sin excepción es Alto", () => {
    const n = derivarNivel({ Q2_1: false, Q2_2: true, Q2_3: false });
    expect(n?.nivel).toBe("Alto");
    expect(n?.exigeArt63).toBe(false);
  });

  it("anexo III con la excepción del art. 6.3 sigue el árbol y exige motivación", () => {
    const limitado = derivarNivel({ Q2_1: false, Q2_2: true, Q2_3: true, Q2_4: true });
    expect(limitado?.nivel).toBe("Limitado");
    expect(limitado?.exigeArt63).toBe(true);
    const minimo = derivarNivel({ Q2_1: false, Q2_2: true, Q2_3: true, Q2_4: false });
    expect(minimo?.nivel).toBe("Mínimo");
    expect(minimo?.exigeArt63).toBe(true);
  });

  it("interacción con personas o contenido generado es Limitado (art. 50)", () => {
    expect(derivarNivel({ Q2_1: false, Q2_2: false, Q2_4: true })?.nivel).toBe("Limitado");
  });

  it("nada de lo anterior es Mínimo", () => {
    expect(derivarNivel(NADA_DE_RIESGO)?.nivel).toBe("Mínimo");
  });

  it("sin las respuestas necesarias no hay nivel", () => {
    expect(derivarNivel({})).toBeNull();
    expect(derivarNivel({ Q2_1: false })).toBeNull();
    expect(derivarNivel({ Q2_1: false, Q2_2: true })).toBeNull(); // falta Q2.3
    expect(derivarNivel({ Q2_1: false, Q2_2: false })).toBeNull(); // falta Q2.4
  });

  it("la dependencia GPAI es independiente del nivel", () => {
    expect(resultadoProvisional({ ...NADA_DE_RIESGO, Q2_5: true }).gpai).toBe(true);
    expect(resultadoProvisional({ ...NADA_DE_RIESGO, Q2_5: true }).nivel).toBe("Mínimo");
    expect(resultadoProvisional(NADA_DE_RIESGO).gpai).toBe(false);
  });
});

describe("fase 3 — marcos y perfil", () => {
  it("el art. 4 aplica siempre", () => {
    for (const [rol, nivel] of [["PROVEEDOR", "Alto"], ["RESPONSABLE_DESPLIEGUE", "Mínimo"]] as const) {
      expect(derivarMarcos(rol, nivel, false).map((m) => m.code)).toContain("RIA_ART_4");
    }
  });

  it("proveedor de alto riesgo: arts. 9–15, 17 y 47, 72 y 73", () => {
    const codes = derivarMarcos("PROVEEDOR", "Alto", false).map((m) => m.code);
    expect(codes).toEqual(expect.arrayContaining(["RIA_ARTS_9_15", "RIA_ARTS_17_47", "RIA_ARTS_72_73"]));
    expect(codes).not.toContain("RIA_ART_26");
  });

  it("responsable del despliegue de alto riesgo: art. 26, art. 27 con su nota, y RGPD 28/35", () => {
    const marcos = derivarMarcos("RESPONSABLE_DESPLIEGUE", "Alto", false);
    const codes = marcos.map((m) => m.code);
    expect(codes).toEqual(expect.arrayContaining(["RIA_ART_26", "RIA_ART_27", "RGPD_ARTS_28_35"]));
    // S-8: el 27.1 no alcanza a todo responsable del despliegue; la nota lo dice.
    expect(marcos.find((m) => m.code === "RIA_ART_27")?.nota).toMatch(/27\.1/);
    expect(codes).not.toContain("RIA_ARTS_9_15");
  });

  it("riesgo limitado: art. 50 para cualquier rol", () => {
    expect(derivarMarcos("PROVEEDOR", "Limitado", false).map((m) => m.code)).toContain("RIA_ART_50");
    expect(derivarMarcos("RESPONSABLE_DESPLIEGUE", "Limitado", false).map((m) => m.code)).toContain("RIA_ART_50");
  });

  it("riesgo mínimo cita el art. 95 del texto final y conserva la cita de borrador de la spec en la nota", () => {
    const m = derivarMarcos("RESPONSABLE_DESPLIEGUE", "Mínimo", false).find((x) => x.code === "RIA_ART_95");
    expect(m?.articulos).toMatch(/95/);
    expect(m?.nota).toMatch(/69/);
  });

  it("GPAI añade el capítulo V con numeración final y conserva la cita de la spec en la nota", () => {
    const con = derivarMarcos("RESPONSABLE_DESPLIEGUE", "Limitado", true).find((x) => x.code === "RIA_CAP_V_GPAI");
    expect(con?.articulos).toMatch(/51/);
    expect(con?.articulos).toMatch(/56/);
    expect(con?.nota).toMatch(/55/);
    expect(derivarMarcos("RESPONSABLE_DESPLIEGUE", "Limitado", false).map((m) => m.code)).not.toContain("RIA_CAP_V_GPAI");
  });

  it("para el responsable del despliegue, el cap. V se acota en la nota: vincula al proveedor del modelo", () => {
    const desp = derivarMarcos("RESPONSABLE_DESPLIEGUE", "Limitado", true).find((x) => x.code === "RIA_CAP_V_GPAI");
    expect(desp?.nota).toMatch(/PROVEEDOR del modelo/);
    expect(desp?.nota).toMatch(/equipo legal/);
    const prov = derivarMarcos("PROVEEDOR", "Limitado", true).find((x) => x.code === "RIA_CAP_V_GPAI");
    expect(prov?.nota).not.toMatch(/PROVEEDOR del modelo/);
  });

  it("importador y distribuidor (roles persistidos que el árbol no deriva) citan sus artículos sin desarrollarlos", () => {
    const imp = derivarMarcos("IMPORTADOR", "Alto", false);
    expect(imp.map((m) => m.code)).toContain("RIA_ARTS_23_24");
    expect(imp.find((m) => m.code === "RIA_ARTS_23_24")?.articulos).toBe("Art. 23");
    // No se les cuelgan los deberes del responsable del despliegue (art. 26).
    expect(imp.map((m) => m.code)).not.toContain("RIA_ART_26");
    expect(derivarMarcos("DISTRIBUIDOR", "Alto", false).find((m) => m.code === "RIA_ARTS_23_24")?.articulos).toBe("Art. 24");
  });

  it("los transversales (RGPD y deontología) van siempre", () => {
    const codes = derivarMarcos("PROVEEDOR", "Mínimo", false).map((m) => m.code);
    expect(codes).toEqual(expect.arrayContaining(["RGPD_TRANSVERSAL", "DEONTOLOGIA"]));
  });

  it("sin rol o sin nivel no se derivan marcos", () => {
    expect(derivarMarcos(null, "Alto", true)).toEqual([]);
    expect(derivarMarcos("PROVEEDOR", null, true)).toEqual([]);
  });

  it("perfil A/B/C por rol y nivel, y null en Inaceptable", () => {
    expect(perfilCatalogo("PROVEEDOR", "Alto")).toBe("PROFILE_A");
    expect(perfilCatalogo("RESPONSABLE_DESPLIEGUE", "Alto")).toBe("PROFILE_B");
    expect(perfilCatalogo("PROVEEDOR", "Limitado")).toBe("PROFILE_C");
    expect(perfilCatalogo("RESPONSABLE_DESPLIEGUE", "Mínimo")).toBe("PROFILE_C");
    expect(perfilCatalogo("PROVEEDOR", "Inaceptable")).toBeNull();
    expect(perfilCatalogo(null, "Alto")).toBeNull();
    expect(perfilCatalogo("PROVEEDOR", "")).toBeNull();
  });

  it("los cuatro roles persistidos que el árbol no deriva se agrupan por su posición", () => {
    // S-1: siguen en el CHECK de ai_systems y hay que saber leerlos.
    expect(perfilCatalogo("IMPORTADOR", "Limitado")).toBe("PROFILE_C");
    expect(perfilCatalogo("DISTRIBUIDOR", "Alto")).toBe("PROFILE_B");
    expect(perfilCatalogo("PROVEEDOR_GPAI", "Alto")).toBe("PROFILE_A");
    expect(perfilCatalogo("PROVEEDOR_POSTERIOR", "Alto")).toBe("PROFILE_A");
    expect(ETIQUETA_PERFIL.PROFILE_C).toMatch(/limitado/i);
  });
});

describe("resultado provisional y confirmación", () => {
  it("en tiempo real: con Q1.1 marcada ya dice posible proveedor aunque falte el resto", () => {
    const r = resultadoProvisional({ Q1_1: true });
    expect(r.rol).toBe("PROVEEDOR");
    expect(r.nivel).toBeNull();
    expect(r.pendientes).toEqual(expect.arrayContaining(["Q1_2", "Q1_3", "Q1_4", "Q2_1", "Q2_2", "Q2_4", "Q2_5"]));
    expect(r.pendientes).not.toContain("Q2_3");
  });

  it("completo y coherente: despliegue · limitado · GPAI → perfil C con art. 50 y cap. V", () => {
    const r = resultadoProvisional({ ...DESPLIEGUE, Q2_1: false, Q2_2: false, Q2_4: true, Q2_5: true });
    expect(r.rol).toBe("RESPONSABLE_DESPLIEGUE");
    expect(r.nivel).toBe("Limitado");
    expect(r.perfil).toBe("PROFILE_C");
    expect(r.gpai).toBe(true);
    expect(r.marcos.map((m) => m.code)).toEqual(expect.arrayContaining(["RIA_ART_4", "RIA_ART_50", "RIA_CAP_V_GPAI"]));
    expect(r.pendientes).toEqual([]);
    expect(r.bloqueado).toBe(false);
  });

  it("no se confirma con preguntas pendientes", () => {
    const { bloqueos } = bloqueosParaConfirmar({ Q1_1: true }, "", true);
    expect(bloqueos.some((b) => /pendiente/i.test(b))).toBe(true);
  });

  it("no se confirma una práctica prohibida", () => {
    const { bloqueos } = bloqueosParaConfirmar({ ...DESPLIEGUE, Q2_1: true, Q2_2: false, Q2_4: false, Q2_5: false }, "", true);
    expect(bloqueos.some((b) => /art\. 5/i.test(b))).toBe(true);
  });

  it("el art. 6.3 exige motivación (≥ 40 caracteres) al bajar del anexo III", () => {
    const respuestas: Respuestas = { ...DESPLIEGUE, Q2_1: false, Q2_2: true, Q2_3: true, Q2_4: true, Q2_5: false };
    expect(bloqueosParaConfirmar(respuestas, "", true).bloqueos.some((b) => /6\.3/.test(b))).toBe(true);
    expect(bloqueosParaConfirmar(respuestas, "demasiado corta", true).bloqueos.some((b) => /6\.3/.test(b))).toBe(true);
    const larga = "Uso interno de bajo importe, sin decisiones automatizadas sobre personas ni efectos jurídicos.";
    expect(bloqueosParaConfirmar(respuestas, larga, true).bloqueos).toEqual([]);
  });

  it("sin owner declarado avisa pero no bloquea", () => {
    const completo: Respuestas = { ...DESPLIEGUE, ...NADA_DE_RIESGO };
    const sin = bloqueosParaConfirmar(completo, "", false);
    expect(sin.bloqueos).toEqual([]);
    expect(sin.avisos.some((a) => /propietario/i.test(a))).toBe(true);
    expect(bloqueosParaConfirmar(completo, "", true).avisos).toEqual([]);
  });
});
