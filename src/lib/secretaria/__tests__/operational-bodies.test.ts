import { describe, expect, it } from "vitest";
import { isAdoptingBody, isOperationalSecretariaBody } from "../operational-bodies";

describe("isAdoptingBody", () => {
  it("ARGA (sin config.naturaleza) sigue siendo órgano de adopción — cero cambio", () => {
    expect(isAdoptingBody({ slug: "arga-cda", name: "Consejo de Administración" })).toBe(true);
    expect(isAdoptingBody({ slug: "arga-cda", name: "CdA", config: {} })).toBe(true);
    expect(isAdoptingBody({ slug: "arga-cda", name: "CdA", config: { quorum: "simple" } })).toBe(
      true,
    );
  });

  it("un órgano consultivo (config.naturaleza='CONSULTIVO') no puede adoptar", () => {
    expect(
      isAdoptingBody({
        slug: "garrigues-consejo-de-socios",
        name: "Consejo de Socios",
        config: { naturaleza: "CONSULTIVO" },
      }),
    ).toBe(false);
  });

  it("un órgano decisorio (config.naturaleza='DECISORIO') sí puede adoptar", () => {
    expect(
      isAdoptingBody({
        slug: "garrigues-junta-socios",
        name: "Junta de Socios",
        config: { naturaleza: "DECISORIO" },
      }),
    ).toBe(true);
  });

  it("sigue excluyendo lo que ya excluía isOperationalSecretariaBody (composición, no reemplazo)", () => {
    const e2eBody = { slug: "e2e-real-cda", name: "CdA E2E" };
    expect(isOperationalSecretariaBody(e2eBody)).toBe(false);
    expect(isAdoptingBody(e2eBody)).toBe(false);
  });
});

describe("isOperationalSecretariaBody — camino default (adoptingOnly ausente)", () => {
  // Fix round 1 (Task 7): useBodiesByEntity(entityId) sin opts usa este
  // filtro, NO isAdoptingBody — CatalogoOrganos, useSidebarVisibilityContext
  // y ActivarMarcoNormativo dependen de que un consultivo siga apareciendo
  // aquí (CatalogoOrganos necesita listar los 19 COMITE de Garrigues para
  // poder gestionar su reglamento/miembros/vinculaciones).
  it("un órgano consultivo SÍ pasa el filtro por defecto — solo isAdoptingBody lo excluye", () => {
    const consultivo = {
      slug: "garrigues-consejo-de-socios",
      name: "Consejo de Socios",
      config: { naturaleza: "CONSULTIVO" },
    };
    expect(isOperationalSecretariaBody(consultivo)).toBe(true);
    expect(isAdoptingBody(consultivo)).toBe(false);
  });
});
