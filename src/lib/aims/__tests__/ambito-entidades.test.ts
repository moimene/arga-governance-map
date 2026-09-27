import { describe, it, expect } from "bun:test";
import {
  paisDeEntidad,
  paisDelAmbito,
  entidadEnAmbito,
  sistemaEnAmbito,
  filtrarSistemasPorAmbito,
} from "../ambito-entidades";
import { scopes } from "@/data/scopes";

describe("paisDeEntidad", () => {
  it("coalesce(country, jurisdiction), en mayúsculas", () => {
    expect(paisDeEntidad({ country: "es" })).toBe("ES");
    expect(paisDeEntidad({ country: null, jurisdiction: "pt" })).toBe("PT");
  });
  it("UK se normaliza a GB", () => {
    expect(paisDeEntidad({ country: "UK" })).toBe("GB");
  });
  it("sin country ni jurisdiction, null (ARGA hoy: country NULL, medido)", () => {
    expect(paisDeEntidad({})).toBeNull();
    expect(paisDeEntidad({ country: null, jurisdiction: null })).toBeNull();
  });
});

describe("paisDelAmbito", () => {
  it("un país conocido resuelve a su ISO2", () => {
    expect(paisDelAmbito("España")).toBe("ES");
    expect(paisDelAmbito("Brasil")).toBe("BR");
  });
  it("una región o un ámbito global no tiene país único: null (no se inventa la composición)", () => {
    expect(paisDelAmbito("LATAM")).toBeNull();
    expect(paisDelAmbito("Europa")).toBeNull();
    expect(paisDelAmbito("Grupo ARGA (Global)")).toBeNull();
    expect(paisDelAmbito("Asia-Pacífico")).toBeNull();
  });
});

describe("entidadEnAmbito", () => {
  it("ámbito sin país conocido: todas las entidades caen dentro (no filtra)", () => {
    expect(entidadEnAmbito({ id: "e1", country: "FR" }, "LATAM")).toBe(true);
    expect(entidadEnAmbito({ id: "e1" }, "LATAM")).toBe(true);
  });
  it("ámbito con país conocido: sólo la entidad de ese país", () => {
    expect(entidadEnAmbito({ id: "e1", country: "ES" }, "España")).toBe(true);
    expect(entidadEnAmbito({ id: "e1", country: "PT" }, "España")).toBe(false);
  });
});

describe("sistemaEnAmbito — falla abierto", () => {
  const entities = [
    { id: "arga-es", country: "ES" },
    { id: "arga-br", country: "BR" },
  ];

  it("un sistema SIN sujeto se muestra en cualquier ámbito (0 sujetos hoy en ARGA y Garrigues)", () => {
    for (const scope of [...scopes, "Marruecos", "Ámbito inventado"]) {
      expect(sistemaEnAmbito("sys-1", scope, [], entities)).toBe(true);
    }
  });

  it("un sistema con sujeto en España se muestra en España y no en México", () => {
    const subjects = [{ systemId: "sys-1", entityId: "arga-es" }];
    expect(sistemaEnAmbito("sys-1", "España", subjects, entities)).toBe(true);
    expect(sistemaEnAmbito("sys-1", "México", subjects, entities)).toBe(false);
  });

  it("un sujeto cuya entidad no se resuelve no oculta el sistema (dato roto, no se calla)", () => {
    const subjects = [{ systemId: "sys-1", entityId: "no-existe" }];
    expect(sistemaEnAmbito("sys-1", "España", subjects, entities)).toBe(true);
  });

  it("un sistema con MÁS de un sujeto se muestra si CUALQUIERA cae en el ámbito", () => {
    const subjects = [
      { systemId: "sys-1", entityId: "arga-es" },
      { systemId: "sys-1", entityId: "arga-br" },
    ];
    expect(sistemaEnAmbito("sys-1", "México", subjects, entities)).toBe(false);
    expect(sistemaEnAmbito("sys-1", "Brasil", subjects, entities)).toBe(true);
  });
});

describe("filtrarSistemasPorAmbito — control positivo con el dato vivo de ARGA (14 sistemas sin sujeto)", () => {
  it("con 0 sujetos, ningún ámbito recorta el inventario", () => {
    const systems = Array.from({ length: 14 }, (_, i) => ({ id: `sys-${i}` }));
    for (const scope of [...scopes, "(Global)"]) {
      expect(filtrarSistemasPorAmbito(systems, scope, [], []).length).toBe(14);
    }
  });
});
