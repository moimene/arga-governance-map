import { describe, it, expect } from "bun:test";
import { SISTEMAS_IA, type Procedencia } from "../../../scripts/garrigues/ia/catalogo-ia";

/**
 * C1 — Catálogo del inventario de IA del tenant Garrigues.
 *
 * La fuente NO es uniforme, y por eso hay tres niveles de procedencia. Mezclarlos
 * sería presentar como norma interna vigente algo que sólo declaró el usuario.
 */
describe("Catálogo de IA — la procedencia no se mezcla", () => {
  it("las herramientas corporativas son las de PI-30 §3.1.1 y sólo esas", () => {
    const corporativas = SISTEMAS_IA.filter((s) => s.provenance === "PI-30_ART_3_1_1");
    expect(corporativas.map((s) => s.name).sort()).toEqual(
      ["Copilot", "Garrigues GA_IA", "Harvey"],
    );
  });

  it("lo declarado por el usuario no se presenta como norma interna", () => {
    // PI-30 no menciona los acuerdos enterprise, y clasifica las versiones
    // públicas de esos proveedores como NO corporativas (§3.1.2).
    const declarados = SISTEMAS_IA.filter((s) => s.provenance === "DECLARADO_USUARIO");
    expect(declarados.length, "no consta lo declarado por el usuario").toBeGreaterThan(0);
    // La aserción anterior era `declarados.every(s => s.provenance !== "PI-30…")`
    // sobre un array YA filtrado a `=== "DECLARADO_USUARIO"`: no podía fallar
    // nunca, y era justo la que da nombre al test.
    //
    // El campo que RECLAMA fuente es `sourceRef`. Se vigila sobre TODO lo que no
    // sale de la política —no sólo lo declarado—: una mutación que apuntaba el
    // `sourceRef` del roadmap a PI-30 se escapaba del filtro anterior.
    // `description` sí puede nombrarla —el texto honesto la cita para NEGAR que
    // respalde nada—, así que ahí sólo se vigila que no afirme aprobación.
    for (const s of SISTEMAS_IA.filter((x) => x.provenance !== "PI-30_ART_3_1_1")) {
      expect(s.sourceRef, `${s.name} invoca PI-30 como fuente de lo que la política no dice`)
        .not.toMatch(/PI-30/);
      expect(s.description, `${s.name} presenta como aprobado lo que sólo está declarado`)
        .not.toMatch(/\b(aprobad|autorizad|homologad|validad)[oa]s? por (la )?PI-30/i);
    }
  });

  it("el roadmap se marca como plan y no como desplegado", () => {
    const plan = SISTEMAS_IA.filter((s) => s.provenance === "PLAN_NO_DESPLEGADO");
    expect(plan.length).toBeGreaterThan(0);
    expect(plan.every((s) => s.status === "PLANIFICADO")).toBe(true);
  });

  it("toda entrada declara su procedencia con una de las tres etiquetas", () => {
    const validas: Procedencia[] = ["PI-30_ART_3_1_1", "DECLARADO_USUARIO", "PLAN_NO_DESPLEGADO"];
    for (const s of SISTEMAS_IA) {
      expect(validas, `${s.name} sin procedencia válida`).toContain(s.provenance);
      expect(s.sourceRef.length, `${s.name} sin referencia de fuente`).toBeGreaterThan(0);
    }
  });
});

describe("Catálogo de IA — no se clasifica lo que no se ha clasificado", () => {
  it("ningún sistema afirma un nivel de riesgo del RIA", () => {
    // Nadie ha hecho la clasificación del art. 6 / anexo III. Poner "Alto" o
    // "Limitado" sería inventarla; la consola ya sabe pintar "sin clasificar".
    for (const s of SISTEMAS_IA) {
      expect(s.risk_level, `${s.name} afirma un nivel de riesgo no acreditado`).toBeNull();
    }
  });

  it("la supervisión humana consta como regla de la propia política", () => {
    // PI-30 §3.2(c): los outputs "deben ser revisados, ajustados y validados"
    // y la IA "no es un sustituto" del trabajo. Es dato de la fuente, no
    // opinión, y sostiene el carácter asistivo de las herramientas.
    const corporativas = SISTEMAS_IA.filter((s) => s.provenance === "PI-30_ART_3_1_1");
    expect(corporativas.every((s) => s.humanOversight)).toBe(true);
  });
});

describe("Catálogo de IA — restricciones y ownership", () => {
  it("GA_IA arrastra la excepción de Gemini-Google que dice la política", () => {
    const gaia = SISTEMAS_IA.find((s) => s.name === "Garrigues GA_IA");
    expect(gaia?.restrictions ?? "", "GA_IA sin la excepción de §3.1.1").toMatch(/Gemini/i);
  });

  it("la prohibición de contenidos gráficos consta como restricción del ámbito", () => {
    // §3.2(d): no está permitido generar contenidos gráficos o audiovisuales;
    // la excepción exige Comité de IA y Senior Partner.
    const conProhibicion = SISTEMAS_IA.filter((s) => /gr[áa]fic/i.test(s.restrictions ?? ""));
    expect(conProhibicion.length, "la prohibición de §3.2(d) no consta").toBeGreaterThan(0);
  });

  it("todo sistema apunta al órgano rector por slug, no por UUID", () => {
    for (const s of SISTEMAS_IA) {
      expect(s.owner_body_slug, `${s.name} sin órgano`).toBe("garrigues-comite-gobernanza-ia");
    }
  });
});
