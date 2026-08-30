// Los órganos que el motor nombra dependen del tenant, y el defecto es
// LITERALMENTE lo que había.
//
// El motor cableaba «Comité de Cumplimiento» y «la Presidencia de la Comisión
// de Auditoría y Control». Son órganos de una aseguradora: en un despacho no
// existen, y el Responsable del SII es un órgano **unipersonal**, así que
// llamarlo comisión cambia quién responde.
//
// La aserción que hace segura la refactorización no es «Garrigues ve lo suyo»:
// es que **el valor por defecto sea byte a byte el de antes**. Si el defecto se
// desviara, ARGA cambiaría sin que nadie lo hubiera pedido.
import { describe, expect, it } from "vitest";
import {
  evaluateConflictOfInterest,
  evaluateSubcasePerimeter,
  ORGANOS_SII_POR_DEFECTO,
} from "@/lib/sii/whistleblowing-engine";
import { SII_ORGANOS_GARRIGUES } from "../../../scripts/garrigues/sii/canal-interno";

describe("SII — los órganos del motor, por tenant", () => {
  it("el DEFECTO es exactamente lo que el motor decía antes", () => {
    // Copiado del código anterior, no de la memoria. Si esto cambia, ARGA
    // cambia — y ese es el único cambio que este carril no puede hacer.
    expect(ORGANOS_SII_POR_DEFECTO).toEqual({
      comiteCumplimientoPenal: "Comité de Cumplimiento / Posible Remisión Fiscalía",
      comiteCumplimiento: "Comité de Cumplimiento",
      organoEscalado: "la Presidencia de la Comisión de Auditoría y Control",
    });
  });

  it("sin pasar órganos, el motor produce lo de siempre", () => {
    const r = evaluateSubcasePerimeter({
      category: "Otros",
      summary: "Comunicación ordinaria sin clasificar.",
      detailedDescription: "",
    });
    expect(r.subcasesToCreate.map((s) => s.authorityTarget)).toContain("Comité de Cumplimiento");

    const c = evaluateConflictOfInterest(
      { id: "i1", name: "X", department: "Legal" },
      { isBoardTarget: true },
    );
    expect(c.description).toContain("la Presidencia de la Comisión de Auditoría y Control");
  });

  it("con los de Garrigues, ninguno es un órgano colegiado", () => {
    const r = evaluateSubcasePerimeter({
      category: "Otros",
      summary: "Comunicación ordinaria sin clasificar.",
      detailedDescription: "",
      organos: SII_ORGANOS_GARRIGUES,
    });
    const destinos = r.subcasesToCreate.map((s) => s.authorityTarget).join(" ");
    expect(destinos).toContain("Senior Partner");
    // Lo que NO puede aparecer. Un despacho no tiene ninguno de estos.
    expect(destinos).not.toMatch(/Comité de Cumplimiento\b/);
    expect(destinos).not.toMatch(/Comisión de Auditoría/);
  });

  it("y el escalado nombra la salida que la política prevé para el conflicto", () => {
    // PI-31 §4: si el Responsable está en conflicto, es el órgano de
    // administración quien designa a quien resuelve. Escalar «al Senior
    // Partner» a secas dejaría el procedimiento sin salida justo en el caso en
    // que hace falta.
    const c = evaluateConflictOfInterest(
      { id: "i1", name: "X", department: "Legal" },
      { isBoardTarget: true },
      SII_ORGANOS_GARRIGUES,
    );
    expect(c.description).toContain("Senior Partner");
    expect(c.description).toContain("órgano de administración");
    expect(c.description).not.toContain("Comisión de Auditoría");
    // El código de acción no se toca: es contrato de la interfaz.
    expect(c.actionRequired).toBe("ESCALADO_COMITE_AUDITORIA");
  });
});
