import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { registryTerminal } from "../registry-lifecycle";

/**
 * Contrato del detalle de expediente registral (`/secretaria/tramitador/:id`).
 *
 * La parte que decide (qué terminal corresponde a cada vía) se prueba por
 * comportamiento en `registry-lifecycle.test.ts`; aquí se comprueba que la
 * pantalla la CONSUME, porque el defecto no estaba en la decisión sino en que
 * la pantalla tenía su propio rótulo fijo. Es un backstop de acoplamiento, no
 * la prueba principal: se declara como tal.
 */
const TRAMITADOR = resolve(process.cwd(), "src/pages/secretaria/TramitadorStepper.tsx");
const src = () => readFileSync(TRAMITADOR, "utf8");

describe("detalle registral — el rótulo lo decide la vía", () => {
  it("un depósito y una legalización no se llaman inscripción", () => {
    // Base de comportamiento del rótulo que la pantalla usa.
    expect(registryTerminal("DEPOSITO_CUENTAS").noun).toBe("depósito");
    expect(registryTerminal("LEGALIZACION_LIBROS").noun).toBe("legalización");
    expect(registryTerminal(null).noun).toBe("inscripción");
  });

  it("la pantalla rotula por la vía y no con «Inscripción» fija", () => {
    const contenido = src();
    expect(contenido).toContain("registryTerminal(filing?.procedure_profile_code)");
    expect(contenido).toContain("[terminalLabel, filing.inscription_number]");
    expect(contenido).not.toContain('["Inscripción", filing.inscription_number]');
  });
});

describe("detalle registral — el instrumento notarial solo cuando lo hay", () => {
  it("la sección de escritura está condicionada y no cae al estado registral", () => {
    const contenido = src();
    expect(contenido).toContain("tieneEscritura");
    // El fallback que presentaba el estado REGISTRAL como estado de una
    // escritura inexistente no puede volver.
    expect(contenido).not.toContain("statusLabel(filing.deeds?.status ?? filing.status");
    expect(contenido).toContain("Esta vía no se documenta en escritura pública.");
  });
});

describe("detalle registral — no hay columnas write-only", () => {
  it("pinta lo que las RPC persisten", () => {
    const contenido = src();
    // Las cinco columnas que el ciclo v2 escribe y ninguna superficie leía.
    for (const columna of [
      "filing.registered_at",
      "filing.publication_reference",
      "filing.published_at",
      "filing.resolution_document_url",
      "filing?.defect_details",
    ]) {
      expect(contenido, `${columna} sigue siendo write-only`).toContain(columna);
    }
  });
});
