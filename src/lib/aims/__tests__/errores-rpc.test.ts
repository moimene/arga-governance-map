import { describe, it, expect } from "bun:test";
import { codigoRpc, mensajeUsuario } from "../errores-rpc";

describe("errores-rpc — del raise exception al mensaje de pantalla", () => {
  it("separa el código del texto que ya viene en castellano", () => {
    const err = { message: "MISMO_EVALUADOR: la revisión la firma una persona distinta de quien congeló", code: "42501" };
    expect(mensajeUsuario(err)).toBe("la revisión la firma una persona distinta de quien congeló");
    expect(codigoRpc(err)).toBe("MISMO_EVALUADOR");
  });

  it("un código solo recibe copy propio; un código que no conoce se devuelve tal cual", () => {
    expect(mensajeUsuario(new Error("CUESTIONARIO_SUPERSEDIDO_INMUTABLE"))).toBe("Un cuestionario supersedido no se modifica.");
    expect(codigoRpc("CUESTIONARIO_SUPERSEDIDO_INMUTABLE")).toBe("CUESTIONARIO_SUPERSEDIDO_INMUTABLE");
    expect(mensajeUsuario("CODIGO_QUE_NADIE_LANZA")).toBe("CODIGO_QUE_NADIE_LANZA");
  });

  it("un Error normal pasa intacto y sin código", () => {
    const err = new Error("Failed to fetch");
    expect(mensajeUsuario(err)).toBe("Failed to fetch");
    expect(codigoRpc(err)).toBeNull();
  });

  it("null → cadena vacía", () => {
    expect(mensajeUsuario(null)).toBe("");
    expect(mensajeUsuario(undefined)).toBe("");
    expect(codigoRpc(null)).toBeNull();
  });
});
