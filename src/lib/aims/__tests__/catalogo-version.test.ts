import { describe, expect, it } from "bun:test";
import { AESIA_RIA_REQUIREMENTS, ISO_42001_REQUIREMENTS, VERSION_CATALOGO_RIA } from "../catalog-aesia";
import { cambiosDelCatalogoDesde } from "../perfil-aplicabilidad";

/**
 * ¿Con qué versión del catálogo se respondió una evaluación guardada?
 *
 * La fila no guarda versión (la columna `catalog_version` llega con F2.T3),
 * pero cada finding guarda el texto de la medida tal como se le preguntó
 * (`title`). Si ese texto ya no es el vigente, la respuesta se dio a otra
 * formulación, y la pantalla lo tiene que decir en vez de pintar la respuesta
 * vieja debajo del texto nuevo como si respondiera a él.
 */
const medidas = AESIA_RIA_REQUIREMENTS.flatMap((r) => r.measures);
const vigente = (id: string) => {
  const m = medidas.find((x) => x.id === id);
  if (!m) throw new Error(`no existe ${id}`);
  return m.description;
};
const nuevasDeEstaVersion = medidas.filter((m) => m.desde === VERSION_CATALOGO_RIA).map((m) => m.id);

describe("versión del catálogo con que se respondió una evaluación", () => {
  it("respondida con el texto vigente y sin fecha: no se puede afirmar nada", () => {
    const findings = ["MG_QUAL_01", "MG_TRANS_01"].map((code) => ({ code, title: vigente(code), status: "L5" }));
    expect(cambiosDelCatalogoDesde(findings)).toEqual({ anterior: false, corregidas: [], nuevas: [] });
  });

  it("respondida con el texto vigente ANTES de que entraran medidas nuevas: es anterior", () => {
    // Las medidas nuevas suben la versión aunque ningún texto respondido cambiara.
    const findings = ["MG_QUAL_01", "MG_TRANS_02"].map((code) => ({ code, title: vigente(code), status: "L5" }));
    const c = cambiosDelCatalogoDesde(findings, "2026-09-07");
    expect(c.anterior).toBe(true);
    expect(c.corregidas).toEqual([]);
    expect(nuevasDeEstaVersion.length).toBeGreaterThan(0);
    expect(c.nuevas).toEqual(nuevasDeEstaVersion);
  });

  it("control: respondida con el texto vigente el día de la versión o después, no es anterior", () => {
    const findings = ["MG_QUAL_01", "MG_TRANS_02"].map((code) => ({ code, title: vigente(code), status: "L5" }));
    expect(cambiosDelCatalogoDesde(findings, VERSION_CATALOGO_RIA).anterior).toBe(false);
    expect(cambiosDelCatalogoDesde(findings, "2026-10-01T09:00:00Z").anterior).toBe(false);
  });

  it("una evaluación ISO con códigos del catálogo, anterior a las medidas nuevas, lo dice", () => {
    const iso = ISO_42001_REQUIREMENTS.flatMap((r) => r.measures);
    const nuevasIso = iso.filter((m) => m.desde === VERSION_CATALOGO_RIA).map((m) => m.id);
    const findings = iso.filter((m) => !m.desde).map((m) => ({ code: m.id, title: m.description, status: "L5" }));
    expect(findings.length).toBeGreaterThan(0);
    const c = cambiosDelCatalogoDesde(findings, "2026-07-31");
    expect(c.anterior).toBe(true);
    expect(nuevasIso.length).toBeGreaterThan(0);
    expect(c.nuevas).toEqual(nuevasIso);
  });

  it("respondida a una formulación ya corregida: es anterior y dice qué cambió y qué entró", () => {
    // Texto literal del finding de la evaluación de Harvey (07-09), medido en Cloud.
    const findings = [
      { code: "MG_TRANS_01", title: "Diseñar el sistema para que su funcionamiento sea transparente para el usuario final", status: "L3" },
      { code: "MG_QUAL_01", title: vigente("MG_QUAL_01"), status: "L5" },
    ];
    const c = cambiosDelCatalogoDesde(findings);
    expect(c.anterior).toBe(true);
    expect(c.corregidas).toEqual(["MG_TRANS_01"]);
    expect(nuevasDeEstaVersion.length).toBeGreaterThan(0);
    expect(c.nuevas).toEqual(nuevasDeEstaVersion);
  });

  it("una medida nueva ya contestada no se lista como pendiente de la versión", () => {
    const nueva = nuevasDeEstaVersion[0];
    const findings = [
      { code: "MG_TRANS_01", title: "texto de otra versión", status: "L3" },
      { code: nueva, title: vigente(nueva), status: "L5" },
    ];
    expect(cambiosDelCatalogoDesde(findings).nuevas).not.toContain(nueva);
  });

  it("sin texto persistido no se afirma nada", () => {
    expect(cambiosDelCatalogoDesde([{ code: "MG_TRANS_01" }]).anterior).toBe(false);
  });

  it("códigos que no están en ningún catálogo (legado de ARGA) no afirman nada, tampoco con fecha antigua", () => {
    const legado = [{ code: "VAL-01", title: "Validación antigua" }];
    const vacio = { anterior: false, corregidas: [], nuevas: [] };
    expect(cambiosDelCatalogoDesde(legado)).toEqual(vacio);
    expect(cambiosDelCatalogoDesde(legado, "2025-10-01")).toEqual(vacio);
    expect(cambiosDelCatalogoDesde([{ code: "ISO-05", title: "Política de IA (A.5)" }], "2026-07-31")).toEqual(vacio);
  });

  it("sin findings no hay nada que comparar", () => {
    expect(cambiosDelCatalogoDesde([]).anterior).toBe(false);
    expect(cambiosDelCatalogoDesde(undefined).anterior).toBe(false);
    expect(cambiosDelCatalogoDesde(null).anterior).toBe(false);
  });
});
