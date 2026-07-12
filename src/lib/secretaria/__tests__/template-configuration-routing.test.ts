import { describe, expect, it } from "vitest";
import {
  applyTemplateRouteScope,
  buildMatterCatalogUrl,
  buildTemplateGovernanceUrl,
  buildTemplateLibraryUrl,
  buildUrlWithSearchParams,
  isTemplateCycleParam,
  mergeUrlSearchParams,
  patchSearchParams,
  pickTemplateHandoffSearchParams,
  templateCycleForEstado,
} from "../template-configuration-routing";

describe("template configuration routing", () => {
  it("patches one query key without clobbering the navigation context", () => {
    const current = new URLSearchParams(
      "tab=catalogo&materia=CESE_CONSEJERO&plantilla=tpl-1&estado=ACTIVA&scope=sociedad&entity=arga&future=keep&future=second",
    );
    const next = patchSearchParams(current, { tab: "auditoria", focus: null });

    expect(next.get("tab")).toBe("auditoria");
    expect(next.get("materia")).toBe("CESE_CONSEJERO");
    expect(next.get("plantilla")).toBe("tpl-1");
    expect(next.get("estado")).toBe("ACTIVA");
    expect(next.get("scope")).toBe("sociedad");
    expect(next.get("entity")).toBe("arga");
    expect(next.getAll("future")).toEqual(["keep", "second"]);
  });

  it("merges an internal destination over the current Gestor context", () => {
    expect(
      mergeUrlSearchParams(
        "/secretaria/gestor-plantillas?tab=catalogo&plantilla=tpl-new&estado=BORRADOR",
        "tab=importar&scope=sociedad&entity=arga&materia=FUSION&q=acta&modo=legal",
      ),
    ).toBe(
      "/secretaria/gestor-plantillas?tab=catalogo&scope=sociedad&entity=arga&materia=FUSION&q=acta&modo=legal&plantilla=tpl-new&estado=BORRADOR",
    );
  });

  it("keeps the template and society scope when entering the registry stepper", () => {
    const current = new URLSearchParams(
      "plantilla=legal-fixture-documento-registral-es&tipo=DOCUMENTO_REGISTRAL&materia=FUSION&estado=PRESENTADA&scope=sociedad&entity=arga",
    );
    const picked = pickTemplateHandoffSearchParams(current);

    expect(buildUrlWithSearchParams("/secretaria/tramitador/nuevo", picked)).toBe(
      "/secretaria/tramitador/nuevo?plantilla=legal-fixture-documento-registral-es&tipo=DOCUMENTO_REGISTRAL&materia=FUSION&scope=sociedad&entity=arga",
    );
    expect(picked.has("estado")).toBe(false);
  });

  it("keeps group scope and removes an incoherent entity from the handoff", () => {
    const picked = pickTemplateHandoffSearchParams(
      "plantilla=tpl-1&tipo=DOCUMENTO_REGISTRAL&scope=grupo&entity=stale&future=drop",
    );

    expect(buildUrlWithSearchParams("/secretaria/tramitador/nuevo", picked)).toBe(
      "/secretaria/tramitador/nuevo?plantilla=tpl-1&tipo=DOCUMENTO_REGISTRAL&scope=grupo",
    );
    expect(picked.has("entity")).toBe(false);
    expect(picked.has("future")).toBe(false);
  });

  it("normalizes a legacy entity-only handoff to society scope", () => {
    const picked = pickTemplateHandoffSearchParams("plantilla=tpl-1&entity=arga");

    expect(picked.get("scope")).toBe("sociedad");
    expect(picked.get("entity")).toBe("arga");
  });

  it("builds contextual round trips across the three configuration surfaces", () => {
    expect(
      buildTemplateLibraryUrl({
        materia: "CESE_CONSEJERO",
        plantilla: "tpl-1",
        ciclo: "vigentes",
        scope: "sociedad",
        entityId: "arga",
      }),
    ).toBe(
      "/secretaria/plantillas?materia=CESE_CONSEJERO&plantilla=tpl-1&ciclo=vigentes&scope=sociedad&entity=arga",
    );
    expect(
      buildTemplateGovernanceUrl({
        materia: "CESE_CONSEJERO",
        plantilla: "tpl-1",
        estado: "ACTIVA",
        scope: "sociedad",
        entityId: "arga",
      }),
    ).toBe(
      "/secretaria/gestor-plantillas?tab=catalogo&materia=CESE_CONSEJERO&plantilla=tpl-1&estado=ACTIVA&scope=sociedad&entity=arga",
    );
    expect(
      buildMatterCatalogUrl({
        materia: "CESE_CONSEJERO",
        vista: "plantillas",
        scope: "sociedad",
        entityId: "arga",
      }),
    ).toBe(
      "/secretaria/catalogo-materias?materia=CESE_CONSEJERO&vista=plantillas&scope=sociedad&entity=arga",
    );
  });

  it("builds explicit group URLs without leaking an entity", () => {
    expect(
      buildTemplateLibraryUrl({ materia: "CESE_CONSEJERO", scope: "grupo", entityId: "stale" }),
    ).toBe("/secretaria/plantillas?materia=CESE_CONSEJERO&scope=grupo");
    expect(
      buildTemplateGovernanceUrl({ materia: "CESE_CONSEJERO", scope: "grupo", entityId: "stale" }),
    ).toBe("/secretaria/gestor-plantillas?tab=catalogo&materia=CESE_CONSEJERO&scope=grupo");
    expect(
      buildMatterCatalogUrl({ materia: "CESE_CONSEJERO", scope: "grupo", entityId: "stale" }),
    ).toBe("/secretaria/catalogo-materias?materia=CESE_CONSEJERO&scope=grupo");
  });

  it("adds an explicit scope to an existing workflow target", () => {
    expect(
      applyTemplateRouteScope(
        "/secretaria/tramitador?plantilla=tpl-1&tipo=DOCUMENTO_REGISTRAL",
        "grupo",
        "stale",
      ),
    ).toBe(
      "/secretaria/tramitador?plantilla=tpl-1&tipo=DOCUMENTO_REGISTRAL&scope=grupo",
    );
    expect(
      applyTemplateRouteScope("/secretaria/tramitador?plantilla=tpl-1", "sociedad", "arga"),
    ).toBe("/secretaria/tramitador?plantilla=tpl-1&scope=sociedad&entity=arga");
  });

  it("maps persisted states to their recoverable lifecycle segment", () => {
    expect(templateCycleForEstado("ACTIVA")).toBe("vigentes");
    expect(templateCycleForEstado("REVISADA")).toBe("preparacion");
    expect(templateCycleForEstado("ARCHIVADA")).toBe("historico");
    expect(isTemplateCycleParam("todas")).toBe(true);
    expect(isTemplateCycleParam("ACTIVA")).toBe(false);
  });
});
