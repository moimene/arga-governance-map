import { describe, expect, it } from "vitest";
import { derivePowerCapa3Prefill } from "../agreement-capa3-prefill";

describe("derivePowerCapa3Prefill", () => {
  it("estructura apoderado, facultades y límites desde el acuerdo adoptado", () => {
    expect(
      derivePowerCapa3Prefill(
        "Otorgar a D. Pablo Navarro, responsable de la Dirección Financiera (CFO), poderes generales para la gestión financiera ordinaria, contratación bancaria, tesorería, cobros y pagos, con los límites internos aprobados por el Consejo y exclusión de las facultades legalmente indelegables.",
      ),
    ).toEqual({
      apoderado_nombre: "D. Pablo Navarro",
      facultades_poder: "la gestión financiera ordinaria, contratación bancaria, tesorería, cobros y pagos",
      limitaciones_poder: "con los límites internos aprobados por el Consejo y exclusión de las facultades legalmente indelegables",
    });
  });

  it("no inventa valores si el texto no contiene un poder reconocible", () => {
    expect(derivePowerCapa3Prefill("El Consejo queda informado.")).toEqual({
      apoderado_nombre: undefined,
      facultades_poder: undefined,
      limitaciones_poder: undefined,
    });
  });
});
