import { describe, expect, it } from "vitest";
import {
  resolveInformePreceptivo,
  type BodyConfigWithInformePreceptivo,
} from "../informe-preceptivo-gate";

// Config de prueba con dos informantes DISTINTOS a propósito, para probar que
// el helper lee `organo_informante` de la entrada real y no lo hardcodea.
const CONFIG: BodyConfigWithInformePreceptivo = {
  informe_preceptivo_de: [
    {
      materia: "ADMISION_SOCIO_CUOTA",
      organo_informante: "garrigues-consejo-de-socios",
      fuente: "ESTATUTOS",
      referencia: "arts. 39.5.b.i y 30.3.b Estatutos (mayoría 80%)",
      firmeza: "FIRME",
    },
    {
      materia: "NOMBRAMIENTO_ADMINISTRADOR_UNICO",
      organo_informante: "garrigues-comite-nominaciones",
      fuente: "ESTATUTOS",
      firmeza: "FIRME",
    },
  ],
};

describe("resolveInformePreceptivo", () => {
  it("Junta + materia reservada → requerido con el órgano informante de la entrada", () => {
    expect(resolveInformePreceptivo("ADMISION_SOCIO_CUOTA", "JUNTA", CONFIG)).toEqual({
      requerido: true,
      organoInformante: "garrigues-consejo-de-socios",
    });
  });

  it("informante variable: lee organo_informante de cada entrada, no un único órgano cableado", () => {
    expect(
      resolveInformePreceptivo("NOMBRAMIENTO_ADMINISTRADOR_UNICO", "JUNTA", CONFIG),
    ).toEqual({
      requerido: true,
      organoInformante: "garrigues-comite-nominaciones",
    });
  });

  it("materia no reservada no requiere informe", () => {
    expect(
      resolveInformePreceptivo("RETRIBUCION_PRESTACIONES_ACCESORIAS", "JUNTA", CONFIG),
    ).toEqual({ requerido: false, organoInformante: null });
  });

  it("órgano adoptante no-Junta nunca requiere informe, aunque la materia esté en config", () => {
    expect(resolveInformePreceptivo("ADMISION_SOCIO_CUOTA", "COMITE", CONFIG)).toEqual({
      requerido: false,
      organoInformante: null,
    });
  });

  it("claves extra (fuente/referencia/firmeza) en la entrada no rompen el matching", () => {
    const entryWithExtras = CONFIG.informe_preceptivo_de![0];
    expect(Object.keys(entryWithExtras)).toEqual(
      expect.arrayContaining(["fuente", "referencia", "firmeza"]),
    );
    expect(resolveInformePreceptivo("ADMISION_SOCIO_CUOTA", "JUNTA", CONFIG).requerido).toBe(
      true,
    );
  });

  it("config sin informe_preceptivo_de (caso ARGA) nunca requiere informe", () => {
    expect(resolveInformePreceptivo("ADMISION_SOCIO_CUOTA", "JUNTA", {})).toEqual({
      requerido: false,
      organoInformante: null,
    });
    expect(resolveInformePreceptivo("ADMISION_SOCIO_CUOTA", "JUNTA", null)).toEqual({
      requerido: false,
      organoInformante: null,
    });
  });
});
