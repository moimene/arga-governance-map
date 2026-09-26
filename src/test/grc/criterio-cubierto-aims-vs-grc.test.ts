// MOI-160 (D-G1) — «cubierto» en AIMS y en GRC son DOS medidas, no una.
//
// AIMS mide MADUREZ de una medida del autodiagnóstico (`acreditaConformidad`,
// `src/lib/aims/conformidad.ts`): una `L5` con evidencia, o una `L8`
// justificada. GRC mide EFECTIVIDAD DE CONTROL de una obligación
// (`obligationCoverage`, `src/lib/grc/obligation-coverage.ts`): todos sus
// controles en `Efectivo`. Miden hechos distintos — el análisis del
// 2026-09-20 (`docs/superpowers/reviews/2026-09-20-overlap-aims-grc.md` §6,
// D-G1) lo señala expresamente con el ejemplo de OBL-RIA-ORG-04 (art. 4 RIA,
// alfabetización): en GRC es una obligación de organización sin controles
// («SIN CONTROL»); en AIMS son las medidas MD_ALF_01..04 de madurez por
// sistema. Ninguna pantalla debe fundir los dos criterios en uno.
//
// Decisión (a) — dos medidas distintas, con nombres distintos en pantalla, sin
// cambio de esquema. Precedente: `lecturaRiesgo` (`assessed-band.ts`, 2026-09-07)
// ya hizo lo mismo con banda y ejes de un riesgo — se pintan las dos y la
// pantalla declara que son dos.
//
// Este fichero vigila la ARISTA, no la prosa: que ninguna pantalla reimplemente
// el criterio de la otra hoja, y que ninguna de las dos hojas importe a la
// otra (eso volvería a fundir "cubierto" en un solo criterio sin decisión
// nueva). Medido sobre el fuente SIN COMENTARIOS por el mismo motivo que
// `frontera-backbone.test.ts`: el comentario que explica la frontera nombra lo
// que prohíbe.
import { describe, expect, it } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { sinComentarios } from "@/test/helpers/sin-comentarios";

function walk(dirs: string[]): string[] {
  const out: string[] = [];
  const rec = (dir: string) => {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = `${dir}/${e.name}`;
      if (e.isDirectory()) {
        if (e.name !== "__tests__") rec(full);
      } else if (/\.tsx?$/.test(e.name)) {
        out.push(full);
      }
    }
  };
  for (const d of dirs) rec(d);
  return out;
}

const fuente = (f: string) => sinComentarios(readFileSync(f, "utf8"));

const SUPERFICIE_AIMS = walk(["src/lib/aims", "src/pages/ai-governance", "src/components/ai-governance"]);

const HOJA_GRC = "src/lib/grc/obligation-coverage.ts";
const CONSUMIDORES_GRC = [
  "src/pages/ObligacionesList.tsx",
  "src/pages/ObligacionDetalle.tsx",
  "src/pages/PoliticaDetalle.tsx",
];
const SUPERFICIE_GRC_OBLIGACIONES = walk(["src/lib/grc", "src/components/grc"]).concat(CONSUMIDORES_GRC);

const IMPORTA_HOJA_GRC = /from\s+["']@\/lib\/grc\/obligation-coverage["']/;
const IMPORTA_HOJA_AIMS = /from\s+["']@\/lib\/aims\/conformidad["']/;

describe("D-G1: obligationCoverage (GRC) es criterio único de efectividad de control", () => {
  it("MARCO PROSPECTIVO antes que nada: un marco no exigible no se mide contra controles", async () => {
    const { obligationCoverage } = await import("@/lib/grc/obligation-coverage");
    expect(obligationCoverage("[Marco Prospectivo] NIS2 algo", ["Efectivo"])).toMatchObject({ label: "MARCO PROSPECTIVO", tone: "neutral" });
  });

  it("0 controles → SIN CONTROL (caso OBL-RIA-ORG-04: sin controles asociados)", async () => {
    const { obligationCoverage } = await import("@/lib/grc/obligation-coverage");
    expect(obligationCoverage("Alfabetización en materia de IA (art. 4 RIA)", [])).toMatchObject({ label: "SIN CONTROL", tone: "critical", pulse: true });
  });

  it("todos Efectivo → CUBIERTA; alguno Parcial → EN REMEDIACIÓN; resto → EN PROCESO", async () => {
    const { obligationCoverage } = await import("@/lib/grc/obligation-coverage");
    expect(obligationCoverage("x", ["Efectivo", "Efectivo"]).label).toBe("CUBIERTA");
    expect(obligationCoverage("x", ["Efectivo", "Parcial"]).label).toBe("EN REMEDIACIÓN");
    expect(obligationCoverage("x", ["Inefectivo"]).label).toBe("EN PROCESO");
  });

  it("G-ARISTA: los tres consumidores importan la hoja y la invocan (no reimplementan el criterio)", () => {
    for (const f of CONSUMIDORES_GRC) {
      const src = fuente(f);
      expect(src, `${f} debe importar obligationCoverage de la hoja`).toMatch(IMPORTA_HOJA_GRC);
      expect(src, `${f} debe invocar obligationCoverage(...)`).toMatch(/obligationCoverage\(/);
    }
  });

  it("control positivo del regex: el propio fichero de la hoja NO se autoimporta (evita un test vacuo)", () => {
    // Si el regex de arriba estuviera roto (p.ej. escapado mal), esta
    // aserción negativa seguiría en verde sin decir nada; la prueba real de
    // que el regex funciona es que SÍ casa en los 3 consumidores de arriba,
    // que son ficheros reales leídos del disco, no un fixture inventado.
    expect(fuente(HOJA_GRC)).not.toMatch(IMPORTA_HOJA_GRC);
  });
});

describe("D-G1: frontera sin import cruzado entre AIMS (madurez) y GRC (efectividad de control)", () => {
  it("ningún fichero de AIMS importa el criterio de cobertura de obligaciones de GRC", () => {
    const ofensores = SUPERFICIE_AIMS.filter((f) => IMPORTA_HOJA_GRC.test(fuente(f)));
    expect(ofensores, `Fundiría los dos criterios sin una decisión nueva: ${ofensores.join(", ")}`).toEqual([]);
  });

  it("ningún fichero de GRC (obligaciones/controles) importa el criterio de madurez de AIMS", () => {
    const ofensores = SUPERFICIE_GRC_OBLIGACIONES.filter((f) => IMPORTA_HOJA_AIMS.test(fuente(f)));
    expect(ofensores, `Fundiría los dos criterios sin una decisión nueva: ${ofensores.join(", ")}`).toEqual([]);
  });

  it("las dos superficies no están vacías (control de que el barrido encuentra ficheros reales)", () => {
    expect(SUPERFICIE_AIMS.length).toBeGreaterThan(10);
    expect(SUPERFICIE_GRC_OBLIGACIONES.length).toBeGreaterThan(3);
  });
});
