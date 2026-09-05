import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { altoRiesgoDeclarado, evaluateMultiregimeIncident } from "../incident-clocks";

const FICHA = "src/pages/ai-governance/IncidenteDetalle.tsx";
const DETALLE_SISTEMA = "src/pages/ai-governance/SistemaDetalle.tsx";
const DECLARACION = "src/components/ai-governance/DeclaracionConformidadModal.tsx";
const APP = "src/App.tsx";
const read = (f: string) => readFileSync(f, "utf8");

describe("clasificación de riesgo: tres estados, no dos", () => {
  it("sin clasificación devuelve undefined, no false", () => {
    // El defecto original: `/…/.test(risk_level ?? "")`. `RegExp.test` devuelve
    // SIEMPRE un booleano, así que «no consta» y «consta que no» colapsaban en
    // el mismo `false` y la ficha afirmaba la clasificación que no existe.
    expect(altoRiesgoDeclarado(null)).toBeUndefined();
    expect(altoRiesgoDeclarado(undefined)).toBeUndefined();
    expect(altoRiesgoDeclarado("")).toBeUndefined();
    expect(altoRiesgoDeclarado("   ")).toBeUndefined();
  });

  it("con clasificación devuelve el booleano que corresponde", () => {
    // Control positivo: sin esto, una función que devolviera undefined siempre
    // pasaría el test de arriba.
    expect(altoRiesgoDeclarado("Alto")).toBe(true);
    expect(altoRiesgoDeclarado("Inaceptable")).toBe(true);
    expect(altoRiesgoDeclarado("HIGH")).toBe(true);
    expect(altoRiesgoDeclarado("Limitado")).toBe(false);
    expect(altoRiesgoDeclarado("Mínimo")).toBe(false);
  });

  it("el motor trata los tres estados de forma distinta", () => {
    const base = { knowledgeDate: "2026-01-01T00:00:00.000Z", isAiRelated: true };
    const sinClasificar = evaluateMultiregimeIncident({ ...base, isAiHighRisk: altoRiesgoDeclarado(null) });
    const noAlto = evaluateMultiregimeIncident({ ...base, isAiHighRisk: altoRiesgoDeclarado("Limitado") });
    const alto = evaluateMultiregimeIncident({ ...base, isAiHighRisk: altoRiesgoDeclarado("Alto") });

    // Sin clasificar: el plazo se muestra, PERO advertido.
    expect(sinClasificar.ria, "sin clasificación se oculta el plazo del art. 73").toBeDefined();
    expect(sinClasificar.ria?.highRiskUnconfirmed).toBe(true);
    // Clasificado fuera del alto riesgo: no hay plazo que contar.
    expect(noAlto.ria, "un sistema clasificado fuera del alto riesgo no debería contar plazo").toBeUndefined();
    // Alto riesgo acreditado: plazo sin cautela.
    expect(alto.ria).toBeDefined();
    expect(alto.ria?.highRiskUnconfirmed).toBe(false);
  });

  it("la ficha no vuelve a colapsar los tres estados en un booleano", () => {
    const src = read(FICHA);
    const m = src.match(/isAiHighRisk:\s*([^\n]+)/);
    expect(m, "la ficha no pasa el riesgo del sistema al motor").not.toBeNull();
    expect(
      /altoRiesgoDeclarado\(/.test(m![1]),
      `la ficha vuelve a derivar el alto riesgo sin el tri-estado: ${m![1].trim()}`,
    ).toBe(true);
    expect(
      /\.test\(/.test(m![1]),
      "la ficha vuelve a usar RegExp.test, que nunca devuelve undefined",
    ).toBe(false);
  });
});

describe("los enlaces del módulo apuntan a rutas montadas", () => {
  it("ningún enlace de AI Governance apunta a una ruta que el router no monta", () => {
    // Tres botones de la ficha de sistema apuntaban a `/evaluaciones/nueva` y
    // `/incidentes/nueva`; el router monta `/nuevo`. El usuario caía en el
    // catch-all sin que nada fallara.
    const app = read(APP);
    const montadas = new Set(
      (app.match(/path="\/ai-governance[^"]*"/g) ?? []).map((m) => m.slice(6, -1)),
    );
    expect(montadas.size, "no se han leído las rutas de App.tsx").toBeGreaterThan(0);

    for (const f of [FICHA, DETALLE_SISTEMA, "src/pages/ai-governance/Dashboard.tsx",
                     "src/pages/ai-governance/Evaluaciones.tsx", "src/pages/ai-governance/Sistemas.tsx",
                     "src/pages/ai-governance/Incidentes.tsx"]) {
      const src = read(f);
      for (const m of src.matchAll(/["'`](\/ai-governance\/[a-z-]+(?:\/[a-z-]+)?)(?:[?"'`])/g)) {
        const ruta = m[1];
        // Las rutas con parámetro se escriben con template literal y quedan
        // fuera de este barrido; lo que se vigila son los literales estáticos.
        expect(
          montadas.has(ruta),
          `${f}: enlaza a ${ruta}, que el router no monta (rutas montadas: ${[...montadas].join(", ")})`,
        ).toBe(true);
      }
    }
  });
});

describe("DORA no se afirma para un tenant que lo tiene oculto", () => {
  it("toda superficie que nombra DORA o su supervisor está gateada por módulo", () => {
    // D-5 (`branding.modules`) oculta DORA a Garrigues en el resto del producto.
    // La ficha de incidente le pintaba la tarjeta «Supervisor Financiero
    // (DGSFP)» y un subexpediente «DORA — DGSFP / BdE», y la declaración de
    // conformidad —que se DESCARGA— lo enumeraba como marco de referencia.
    for (const f of [FICHA, DECLARACION]) {
      const src = read(f);
      expect(
        /isModuleEnabled\(\s*branding\s*,\s*"dora"\s*\)/.test(src),
        `${f} nombra DORA sin resolver el módulo del tenant`,
      ).toBe(true);
      // Y la variable de la puerta gobierna de verdad el render, en TODOS los
      // sitios que nombran el régimen. Comprobar "existe un guard" no bastaba:
      // con dos superficies DORA en el mismo fichero, desgatear una dejaba la
      // otra satisfaciendo el test (medido con mutación, 2026-09-05).
      const puerta = src.match(/const\s+(\w+)\s*=\s*isModuleEnabled\(\s*branding\s*,\s*"dora"\s*\)/);
      expect(puerta, `${f}: la puerta de DORA no se guarda en ninguna variable`).not.toBeNull();
      const v = puerta![1];
      const usos = (src.match(new RegExp(`\\b${v}\\b`, "g")) ?? []).length - 1; // menos la declaración
      // Cuántas superficies del fichero nombran el régimen o a su supervisor.
      const superficiesDora = (src.match(/DGSFP|Resiliencia Operativa Digital|Supervisor Financiero/g) ?? []).length;
      expect(
        usos,
        `${f}: ${superficiesDora} menciones de DORA/DGSFP y sólo ${usos} usos de ${v}: alguna se pinta sin puerta`,
      ).toBeGreaterThanOrEqual(f === DECLARACION ? 1 : 2);
    }
  });

  it("la ficha no anuncia relojes que no está contando", () => {
    // `affectsPii` / `isIctCritical` son constantes `false` sin ningún control
    // en la UI, así que los relojes del RGPD y de DORA no se cuentan nunca. El
    // banner afirmaba «Relojes regulatorios independientes activados».
    const src = read(FICHA);
    expect(
      /Relojes regulatorios independientes activados/.test(src),
      "la ficha vuelve a anunciar tres relojes activados que no está contando",
    ).toBe(false);
    // Se exige que la variable se CALCULE y se USE en el texto: comprobar sólo
    // que el identificador aparece lo satisfacía su propia declaración, con el
    // banner ya desconectado (medido con mutación, 2026-09-05).
    expect(
      /const\s+regimenesEnCurso\s*=/.test(src),
      "la ficha no calcula qué regímenes se están contando",
    ).toBe(true);
    expect(
      /\{regimenesEnCurso\.length > 0/.test(src) && /regimenesEnCurso\.join\(/.test(src),
      "el banner ya no se construye a partir de los regímenes realmente contados",
    ).toBe(true);
  });
});
