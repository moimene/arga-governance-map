// src/test/garrigues/entities-catalog.test.ts
// Invariantes del catálogo del perímetro Garrigues (G1). El catálogo es la única
// fuente de verdad del seed: si estos tests fallan, el seed NO debe ejecutarse.
import { describe, expect, it } from "vitest";
import {
  GARRIGUES_ENTITIES,
  GARRIGUES_MATRIZ_UUID,
} from "../../../scripts/garrigues/entities-catalog";

describe("Catálogo perímetro Garrigues — invariantes", () => {
  it("tiene 33 entidades con uuid/slug/nif únicos", () => {
    expect(GARRIGUES_ENTITIES.length).toBe(33);
    const uuids = GARRIGUES_ENTITIES.map((e) => e.uuid);
    const slugs = GARRIGUES_ENTITIES.map((e) => e.slug);
    const nifs = GARRIGUES_ENTITIES.map((e) => e.nif).filter(Boolean);
    expect(new Set(uuids).size).toBe(33);
    expect(new Set(slugs).size).toBe(33);
    expect(new Set(nifs).size).toBe(nifs.length);
  });

  it("exactamente una MATRIZ, sin parent, con NIF real y datos registrales del RM", () => {
    const matrices = GARRIGUES_ENTITIES.filter((e) => e.groupRole === "MATRIZ");
    expect(matrices.length).toBe(1);
    const m = matrices[0];
    expect(m.uuid).toBe(GARRIGUES_MATRIZ_UUID);
    expect(m.parentSlug).toBeNull();
    expect(m.nif).toBe("B81709081");
    expect(m.provenance.confianza).toBe("CONFIRMADO");
    expect(m.registral?.hoja).toBe("M-190538");
    expect(m.registral?.tomo).toBe("17456");
    expect(m.registral?.folio).toBe("132");
  });

  it("todos los parentSlug resuelven a un slug del catálogo y no hay ciclos", () => {
    const bySlug = new Map(GARRIGUES_ENTITIES.map((e) => [e.slug, e]));
    for (const e of GARRIGUES_ENTITIES) {
      if (e.parentSlug === null) continue;
      expect(bySlug.has(e.parentSlug)).toBe(true);
      // subida hasta raíz con cota anti-ciclo
      let cur = e;
      let hops = 0;
      while (cur.parentSlug !== null) {
        cur = bySlug.get(cur.parentSlug)!;
        hops += 1;
        expect(hops).toBeLessThan(10);
      }
    }
  });

  it("honestidad de procedencia: pct solo cuando la confianza no es PENDIENTE", () => {
    for (const e of GARRIGUES_ENTITIES) {
      if (e.provenance.confianza === "PENDIENTE") {
        expect(e.ownershipPct).toBeNull();
      }
    }
  });

  it("cobertura del motor: toda entidad no-ES o no-sociedad va marcada fuera de cobertura", () => {
    for (const e of GARRIGUES_ENTITIES) {
      if (e.jurisdiction !== "ES") {
        expect(e.provenance.cobertura_motor).toBe(false);
      }
      if (e.groupRole === "DIVISION" || e.groupRole === "OFICINA" || e.groupRole === "OFICINA_REPRESENTACION") {
        expect(e.provenance.cobertura_motor).toBe(false);
      }
    }
  });

  it("H1 vigilado: la entidad fabricada 'Xoo.com' no existe en el catálogo", () => {
    const nombres = GARRIGUES_ENTITIES.map((e) => (e.legalName + e.commonName).toLowerCase());
    expect(nombres.some((n) => n.includes("xoo"))).toBe(false);
  });

  it("EAD Trust: única con CONSEJO, cuelga de NewLaw, 51% a confirmar", () => {
    const consejos = GARRIGUES_ENTITIES.filter((e) => e.formaAdministracion === "CONSEJO");
    expect(consejos.length).toBe(1);
    const ead = consejos[0];
    expect(ead.slug).toBe("ead-trust-sl");
    expect(ead.parentSlug).toBe("cia-digital-newlaw-slu");
    expect(ead.ownershipPct).toBe(51);
    expect(ead.provenance.confianza).toBe("A_CONFIRMAR");
  });

  it("las SLP llevan tipoSocial NULL con nota pendiente de G3", () => {
    const slps = GARRIGUES_ENTITIES.filter((e) => e.legalForm === "SLP");
    expect(slps.length).toBeGreaterThanOrEqual(7);
    for (const e of slps) {
      expect(e.tipoSocial).toBeNull();
      expect(e.provenance.notas ?? []).toContain("TIPO_SOCIAL_SLP_PENDIENTE_G3");
    }
  });
});
