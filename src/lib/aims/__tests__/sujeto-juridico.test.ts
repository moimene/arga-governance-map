// src/lib/aims/__tests__/sujeto-juridico.test.ts
//
// F2.T1 — el criterio de sujeto, contra los catálogos REALES.
//
// Garrigues se mide contra su catálogo congelado del repo, que es la única
// fuente de verdad de su perímetro (G1). ARGA no tiene catálogo en el repo: sus
// 16 formas jurídicas se midieron en Cloud el 20-09-2026 y viajan aquí como
// copia declarada. Una copia congelada que nadie contrasta es un verde falso
// (lección del 2026-09-07), así que el contraste vivo con Cloud NO vive aquí:
// vive en `src/test/schema/aims-sujeto-juridico-live.test.ts`, con logins reales.
import { describe, expect, it } from "bun:test";
import { GARRIGUES_ENTITIES } from "../../../../scripts/garrigues/entities-catalog";
import { FORMAS_ARGA_MEDIDAS } from "../../../test/aims/formas-juridicas-medidas";
import {
  CLASE_POR_FORMA,
  claseDeEntidad,
  esEntidadElegible,
  etiquetaSociedad,
  normalizaForma,
  requiereLegal,
  titularJuridico,
  type EntidadSujeto,
} from "../sujeto-juridico";

const G: EntidadSujeto[] = GARRIGUES_ENTITIES.map((e) => ({
  slug: e.slug,
  legalName: e.legalName,
  legalForm: e.legalForm,
  groupRole: e.groupRole,
  entityStatus: e.entityStatus,
  parentSlug: e.parentSlug,
}));
const g = (slug: string): EntidadSujeto => {
  const e = G.find((x) => x.slug === slug);
  if (!e) throw new Error(`el catálogo de Garrigues no tiene «${slug}»: el test mediría otra cosa`);
  return e;
};

const FORMAS_ARGA = [...FORMAS_ARGA_MEDIDAS];

const soc = (legalName: string, legalForm: string): EntidadSujeto => ({
  slug: legalName.toLowerCase().replace(/\W+/g, "-"),
  legalName,
  legalForm,
});

describe("F2.T1 — toda forma real de los dos tenants está clasificada", () => {
  it("Garrigues: las 18 formas del catálogo resuelven, y ninguna queda SIN_CLASIFICAR", () => {
    const formas = [...new Set(G.map((e) => e.legalForm as string))];
    // Control del instrumento: si el catálogo se vaciara, el bucle no mediría nada.
    expect(formas.length).toBe(18);
    const sinClasificar = formas.filter((f) => !CLASE_POR_FORMA[normalizaForma(f)]);
    expect(sinClasificar, "formas de Garrigues sin clase").toEqual([]);
  });

  it("ARGA: las 16 formas medidas en Cloud resuelven", () => {
    expect(FORMAS_ARGA.length).toBe(16);
    const sinClasificar = FORMAS_ARGA.filter((f) => !CLASE_POR_FORMA[normalizaForma(f)]);
    expect(sinClasificar, "formas de ARGA sin clase").toEqual([]);
  });

  it("control positivo: una forma inventada NO es elegible y pide clasificarla", () => {
    const v = esEntidadElegible(soc("Zeta Holdings ZZZ", "ZZZ"));
    expect(v.clase).toBe("SIN_CLASIFICAR");
    expect(v.elegible).toBe(false);
    expect(v.requiereLegal).toBe(true);
    expect(v.motivo).toContain("no clasificada");
    // Y una entidad sin forma tampoco pasa por el hueco.
    expect(esEntidadElegible(soc("Sin forma, S.?", null as unknown as string)).elegible).toBe(false);
  });

  it("«S.L.» de ARGA y «SL» de Garrigues son la misma clave", () => {
    expect(normalizaForma("S.L.")).toBe("SL");
    expect(normalizaForma("  s.p.a. ")).toBe("SPA");
    expect(claseDeEntidad(soc("Una, S.L.", "S.L."))).toBe("SOCIEDAD");
    expect(claseDeEntidad(soc("Una SL", "SL"))).toBe("SOCIEDAD");
  });
});

describe("F2.T1 — un establecimiento no es sujeto: sube a su titular", () => {
  const casos: Array<[string, string]> = [
    ["garrigues-shanghai-rep-office", "jya-garrigues-slp"],
    ["eu-law-office-garrigues", "jya-garrigues-slp"],
    ["g-advisory-colombia", "g-advisory-slp"],
    ["garrigues-portugal-sucursal", "garrigues-portugal-slp"],
    ["g-digital-division", "jya-garrigues-slp"],
  ];

  for (const [slug, titular] of casos) {
    it(`${slug} no es elegible y responde en ${titular}`, () => {
      const v = esEntidadElegible(g(slug));
      expect(v.elegible).toBe(false);
      expect(v.clase).toBe("ESTABLECIMIENTO");
      expect(v.subeATitular).toBe(true);
      // No pide dictamen: que una sucursal no sea persona jurídica no es dudoso.
      expect(v.requiereLegal).toBe(false);
      expect(titularJuridico(g(slug), G)?.slug).toBe(titular);
    });
  }

  it("control positivo: una sociedad es su propio titular", () => {
    expect(titularJuridico(g("garrigues-ip-slp"), G)?.slug).toBe("garrigues-ip-slp");
  });

  it("si la cadena se rompe, no se inventa titular", () => {
    const huerfana: EntidadSujeto = {
      slug: "sucursal-huerfana", legalName: "Sucursal huérfana",
      legalForm: "SUCURSAL", groupRole: "SUCURSAL", parentSlug: "no-existe",
    };
    expect(titularJuridico(huerfana, G)).toBeNull();
    // Y un ciclo no cuelga ni devuelve basura.
    const a: EntidadSujeto = { slug: "a", legalName: "A", legalForm: "OFICINA", parentSlug: "b" };
    const b: EntidadSujeto = { slug: "b", legalName: "B", legalForm: "OFICINA", parentSlug: "a" };
    expect(titularJuridico(a, [a, b])).toBeNull();
  });
});

describe("F2.T1 — los casos que decidió D-U4 y los que siguen abiertos", () => {
  it("la Fundación y los tres vehículos SL son elegibles", () => {
    expect(esEntidadElegible(g("fundacion-garrigues")).elegible).toBe(true);
    expect(claseDeEntidad(g("fundacion-garrigues"))).toBe("FUNDACION");
    for (const slug of ["violet-inversiones-2010-sl", "ewch-inversiones-sl", "garben-inversiones-2013-slu"]) {
      expect(esEntidadElegible(g(slug)).elegible, slug).toBe(true);
    }
  });

  it("el Centro de Estudios y BSVV no son sujeto, y se dice que falta acreditar personalidad", () => {
    for (const slug of ["centro-estudios-garrigues", "bsvv-chile"]) {
      const v = esEntidadElegible(g(slug));
      expect(v.elegible, slug).toBe(false);
      expect(v.clase, slug).toBe("SIN_PERSONALIDAD_ACREDITADA");
      expect(v.requiereLegal, slug).toBe(true);
      expect(v.motivo, slug).toContain("personalidad jurídica");
    }
    // BSVV lo decide su PAPEL (integración), no su forma: por forma sería sociedad.
    expect(CLASE_POR_FORMA[normalizaForma("LIMITADA")]).toBe("SOCIEDAD");
  });

  it("las tres SC, las dos LLP y la SPK quedan pendientes de dictamen (H-09), no elegibles", () => {
    const pendientes = G.filter((e) => ["SC", "LLP", "SPK"].includes(e.legalForm as string));
    // Control del instrumento: el catálogo tiene exactamente esas seis.
    expect(pendientes.map((e) => e.slug).sort()).toEqual([
      "g-advisory-mexico-sc", "garrigues-llp-us", "garrigues-mexico-sc",
      "garrigues-mx-sc", "garrigues-polska-spk", "garrigues-uk-llp",
    ]);
    for (const e of pendientes) {
      expect(esEntidadElegible(e).clase, e.slug).toBe("PERSONALIDAD_NO_ACREDITADA");
      expect(requiereLegal(e), e.slug).toBe(true);
    }
  });

  it("una sociedad liquidada no recibe obligaciones vivas", () => {
    const v = esEntidadElegible(g("garrigues-sports-entertainment-slp"));
    expect(v.elegible).toBe(false);
    expect(v.motivo).toContain("no está activa");
    // Control positivo: su forma SÍ sería elegible; lo que la excluye es el estado.
    expect(CLASE_POR_FORMA[normalizaForma("SLP")]).toBe("SOCIEDAD");
  });
});

describe("F2.T1 — dos sujetos elegibles no comparten etiqueta", () => {
  it("en Garrigues, cada elegible tiene etiqueta propia", () => {
    const etiquetas = G.filter((e) => esEntidadElegible(e).elegible).map(etiquetaSociedad);
    expect(etiquetas.length).toBeGreaterThan(10);
    expect(etiquetas.length).toBe(new Set(etiquetas).size);
  });

  it("los tres pares de ARGA que comparten nombre común quedan distinguidos", () => {
    // Medido en Cloud el 20-09-2026: Brasil, México y Portugal tienen dos
    // sociedades DISTINTAS con el mismo `common_name`. La etiqueta es la
    // denominación social, así que no se mezclan.
    const pares: Array<[string, string]> = [
      ["ARGA Seguros Brasil Ltda.", "ARGA Brasil Seguros S.A."],
      ["ARGA México Seguros, S.A. de C.V.", "ARGA Seguros México S.A. de C.V."],
      ["ARGA Portugal Seguros, S.A.", "ARGA Seguros Portugal, Unipessoal Lda."],
    ];
    for (const [a, b] of pares) {
      expect(etiquetaSociedad(soc(a, "S.A."))).not.toBe(etiquetaSociedad(soc(b, "S.A.")));
    }
  });
});
