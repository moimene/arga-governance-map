// El gate de tipos cubre tres perímetros y es fácil encogerlo sin querer.
//
// Este fichero existe porque yo mismo lo encogí durante la fase: metí tests y
// scripts dentro de `tsconfig.app.json` y subí su `lib`, o sea que amplié el
// contrato de PRODUCCIÓN para acomodar ficheros que no son producción. Eso no
// da error en ningún sitio: el recuento baja, la suite pasa y nadie se entera.
//
// Comprueba RESOLUCIÓN REAL, no cadenas dentro de un JSON. `tsc --showConfig`
// devuelve la lista de ficheros que el proyecto acaba compilando después de
// resolver `include`/`exclude`/`references`, así que sigue siendo válido
// aunque alguien reescriba los patrones de otra manera.
import { describe, expect, it } from "vitest";

function ficherosDelProyecto(tsconfig: string): string[] {
  const r = Bun.spawnSync(["bunx", "tsc", "-p", tsconfig, "--showConfig"], {
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });
  const salida = new TextDecoder().decode(r.stdout);
  // Si tsc no devuelve JSON, el test debe caer con el motivo a la vista y no
  // pasar en vacío con una lista vacía.
  expect(salida.trim().startsWith("{"), `tsc no devolvió config para ${tsconfig}: ${salida.slice(0, 200)}`).toBe(true);
  return (JSON.parse(salida).files ?? []) as string[];
}

const contiene = (fs: string[], sufijo: string) => fs.some((f) => f.endsWith(sufijo));

describe("el perímetro del gate de tipos no encoge sin que se note", () => {
  const enTests = ficherosDelProyecto("tsconfig.tests.json");
  const enApp = ficherosDelProyecto("tsconfig.app.json");

  it("los scripts están dentro del gate", () => {
    // Los seeds y las sondas escriben en Cloud. Un tipo mal en un script no es
    // menos grave que en la app: es más.
    expect(contiene(enTests, "scripts/seed-garrigues-obligaciones.ts")).toBe(true);
    expect(contiene(enTests, "scripts/garrigues/penal/generar-catalogo.ts")).toBe(true);
  });

  it("los tests están dentro del gate", () => {
    expect(contiene(enTests, "src/test/schema/sesion-compartida.test.ts")).toBe(true);
    expect(contiene(enTests, "src/lib/secretaria/__tests__/matter-execution-profile.test.ts")).toBe(true);
  });

  it("y producción sigue viéndose a sí misma", () => {
    // Control negativo del control: si esta aserción cae, el proyecto de tests
    // dejó de incluir `src` y las dos anteriores estarían pasando sobre un
    // programa distinto del que se despliega.
    expect(contiene(enTests, "src/lib/secretaria/meeting-links.ts")).toBe(true);
    expect(contiene(enApp, "src/lib/secretaria/meeting-links.ts")).toBe(true);
  });

  it("PERO el perímetro de producción NO arrastra tests ni scripts", () => {
    // Esta es la aserción que me habría ahorrado el error. `tsconfig.app.json`
    // define lo que se compila y se despliega; meterle un `.test.ts` obliga a
    // ensanchar su `lib` y sus tipos para acomodar ficheros que nunca llegan al
    // bundle, y ese ensanche deja de proteger el código que sí llega.
    expect(enApp.filter((f) => f.includes(".test."))).toEqual([]);
    expect(enApp.filter((f) => f.startsWith("scripts/") || f.includes("/scripts/"))).toEqual([]);
  });
});
