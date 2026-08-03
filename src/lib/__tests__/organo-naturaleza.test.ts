import { describe, expect, it } from "vitest";
import { organoNaturalezaBadges } from "@/lib/organo-naturaleza";

describe("organoNaturalezaBadges", () => {
  it("config sin naturaleza / null / no-objeto → [] (ARGA intacta)", () => {
    expect(organoNaturalezaBadges(null)).toEqual([]);
    expect(organoNaturalezaBadges({})).toEqual([]);
    expect(organoNaturalezaBadges("x")).toEqual([]);
  });
  it("CONSULTIVO → badge con dependencia en title", () => {
    const b = organoNaturalezaBadges({ naturaleza: "CONSULTIVO", depende_de: ["SENIOR_PARTNER"] });
    expect(b[0].label).toBe("Consultivo — no adopta acuerdos");
    expect(b[0].title).toContain("SENIOR_PARTNER");
  });
  it("dependencia dual y preceptivo", () => {
    const b = organoNaturalezaBadges({ naturaleza: "CONSULTIVO", depende_de: ["ADMINISTRADOR_UNICO", "SENIOR_PARTNER"], informe_preceptivo: true });
    expect(b.some((x) => x.label === "Informa preceptivamente a la Junta")).toBe(true);
  });
});
