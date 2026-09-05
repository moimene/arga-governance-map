// Gate de las tres correcciones del carril GRC que impedían fabricar dato en
// `/grc/penal-anticorrupcion` y en el seed del mapa penal, más el gateo por
// tenant de las pantallas de régimen asegurador.
//
// Todos son tests de COMPORTAMIENTO sobre funciones puras o sobre la lista de
// navegación real: ninguno mira el texto del código fuente.
import { describe, expect, it } from "vitest";
import { esRiesgoPenal, nivelRiesgo } from "../penal-scope";
import { descripcionArticulo } from "../../../../scripts/garrigues/penal/descripcion-articulo";
import { GRC_NAV_ITEMS } from "@/components/garrigues-shell/navigation";
import { isModuleEnabled } from "@/lib/tenant-modules";

// Codificación real de cada tenant, comprobada en Cloud: ARGA guarda sus 18
// riesgos penales con module_id='penal' y código RSK-PEN-*; Garrigues los 82
// del mapa con module_id='risk' y RSK-GARR-PEN-*.
const RIESGO_ARGA = { module_id: "penal", code: "RSK-PEN-001" };
const RIESGO_GARRIGUES = { module_id: "risk", code: "RSK-GARR-PEN-069" };

describe("esRiesgoPenal — reconoce las dos codificaciones, no solo la de ARGA", () => {
  it("cuenta los riesgos penales de ambos tenants", () => {
    expect(esRiesgoPenal(RIESGO_ARGA)).toBe(true);
    // Este es el que el filtro anterior no veía: daba 0 sobre 82 y la tarjeta
    // remataba con un `|| 9` literal.
    expect(esRiesgoPenal(RIESGO_GARRIGUES)).toBe(true);
  });

  it("no arrastra riesgos de otros módulos", () => {
    expect(esRiesgoPenal({ module_id: "risk", code: "RSK-GARR-CYBER-01" })).toBe(false);
    expect(esRiesgoPenal({ module_id: "solvency2", code: "RSK-S2-004" })).toBe(false);
    expect(esRiesgoPenal({ module_id: null, code: null })).toBe(false);
  });
});

describe("nivelRiesgo — nunca devuelve un número que no esté en la fila", () => {
  it("un riesgo evaluado por banda ordinal NO recibe score", () => {
    // Los 82 de Garrigues: probability, impact, inherent_score y residual_score
    // a NULL, y la banda como único nivel publicado por la fuente. Antes
    // salían «6 / 3», y el 3 además en verde.
    const nivel = nivelRiesgo({
      ...RIESGO_GARRIGUES,
      probability: null,
      impact: null,
      inherent_score: null,
      residual_score: null,
      assessed_band: "ROJO",
    });
    expect(nivel).toEqual({ tipo: "BANDA", banda: "ROJO" });
  });

  it("un riesgo con inherente pero sin residual NO recibe residual deducido", () => {
    // Los 18 de ARGA: inherent_score presente, residual_score NULL. El
    // `Math.ceil(inherent / 2)` anterior fabricaba un residual y lo pintaba en
    // verde como si estuviera mitigado.
    const nivel = nivelRiesgo({ ...RIESGO_ARGA, inherent_score: 12, residual_score: null });
    expect(nivel).toEqual({ tipo: "SCORE", inherente: 12, residual: null });
  });

  it("con los dos ejes calcula el score, y con medio dato no completa el otro", () => {
    expect(nivelRiesgo({ probability: 3, impact: 4 })).toEqual({
      tipo: "SCORE",
      inherente: 12,
      residual: null,
    });
    // Medio dato no es dato: no se rellena el eje que falta con un 1.
    expect(nivelRiesgo({ probability: 3, impact: null })).toEqual({ tipo: "SIN_DATO" });
  });

  it("sin ejes, sin score y sin banda es SIN_DATO, no un 6", () => {
    expect(nivelRiesgo({ code: "RSK-PEN-999" })).toEqual({ tipo: "SIN_DATO" });
  });
});

describe("descripcionArticulo — no atribuye al Código Penal lo que no es suyo", () => {
  it("el contrabando conserva su norma real", () => {
    // Es el ÚNICO riesgo en banda roja del mapa, y la plantilla anterior lo
    // rotulaba «Artículos del Código Penal: Ley de represión del contrabando».
    // Se tipifica en la LO 12/1995, no en el CP.
    expect(descripcionArticulo("Ley de represión del contrabando")).toBe(
      "Ley de represión del contrabando",
    );
    expect(descripcionArticulo("Ley de represión del contrabando")).not.toMatch(/Código Penal/);
  });

  it("el articulado del CP sí se atribuye al CP", () => {
    expect(descripcionArticulo("305 y siguientes")).toBe("Artículos del Código Penal: 305 y siguientes");
    expect(descripcionArticulo("286 quater")).toBe("Artículos del Código Penal: 286 quater");
    expect(descripcionArticulo("159 a 161")).toBe("Artículos del Código Penal: 159 a 161");
  });

  it("sin artículo no se inventa descripción", () => {
    expect(descripcionArticulo("")).toBeNull();
    expect(descripcionArticulo(null)).toBeNull();
    expect(descripcionArticulo(undefined)).toBeNull();
  });
});

describe("navegación GRC — el régimen que no aplica no se ofrece", () => {
  // Lista blanca real del tenant Garrigues (`tenants.branding->modules`).
  const GARRIGUES = {
    modules: [
      "secretaria", "grc", "ai-governance", "sii", "politicas", "obligaciones",
      "delegaciones", "hallazgos", "conflictos", "governance-map", "entidades", "organos",
    ],
  } as never;

  const visibles = (branding: never | null) =>
    GRC_NAV_ITEMS.filter((i) => !i.moduleKey || isModuleEnabled(branding, i.moduleKey)).map((i) => i.to);

  it("un despacho no ve Solvencia II ni el registro DORA de terceros", () => {
    const rutas = visibles(GARRIGUES);
    expect(rutas).not.toContain("/grc/solvencia-ii");
    expect(rutas).not.toContain("/grc/tprm");
    expect(rutas).not.toContain("/grc/packs");
    // Lo que sí le aplica sigue ahí.
    expect(rutas).toContain("/grc/penal-anticorrupcion");
    expect(rutas).toContain("/grc/risk-360");
  });

  it("ARGA no ve ningún cambio: sin branding, todo visible", () => {
    // Contrato cero-cambio: `isModuleEnabled` falla ABIERTO con branding nulo.
    const rutas = visibles(null);
    expect(rutas).toContain("/grc/solvencia-ii");
    expect(rutas).toContain("/grc/tprm");
    expect(rutas).toContain("/grc/packs");
    expect(rutas).toHaveLength(GRC_NAV_ITEMS.length);
  });
});
