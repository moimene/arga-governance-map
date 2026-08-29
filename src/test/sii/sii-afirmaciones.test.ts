// src/test/sii/sii-afirmaciones.test.ts
// Tarea 3 del carril C3 — el producto deja de afirmar lo que no sostiene.
//
// Todo lo prohibido aquí se vio EN PANTALLA en la verificación viva del
// 2026-08-29, no se dedujo del código.
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const raiz = process.cwd();
const leer = (rel: string) => readFileSync(join(raiz, rel), "utf8");

const superficie: Array<readonly [string, string]> = ["src/pages/sii", "src/lib/sii"].flatMap((dir) =>
  readdirSync(join(raiz, dir))
    .filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"))
    .map((f) => [`${dir}/${f}`, leer(`${dir}/${f}`)] as const),
);

describe("SII — no se afirma lo que no se sostiene", () => {
  const prohibido: Array<readonly [RegExp, string]> = [
    [/QSeal|[Ss]ellado QTSP/, "no hay sello: no existe artefacto ni interacción con el proveedor"],
    [/SHA512:|SHA-512/, "no había hash: era Math.random() bajo una etiqueta que afirmaba integridad"],
    [/[Cc]ifrado de extremo a extremo/, "los mensajes viven en claro en localStorage"],
    [/100% anónimo|anonimato técnico/, "PI-31 Anexo 1 §3.c reserva el anónimo a la vía postal"],
    [/admitid[oa] a trámite/, "no existe fase de admisión: el estado que se escribe es RECIBIDO"],
    [/Art\. 34/, "el registro de informaciones es el art. 26; el 34 es Delegado de protección de datos"],
  ];

  for (const [patron, motivo] of prohibido) {
    it(`ninguna superficie SII dice ${patron} — ${motivo}`, () => {
      const infractores = superficie.filter(([, src]) => patron.test(src)).map(([f]) => f);
      expect(infractores).toEqual([]);
    });
  }
});

describe("SII — lo que SÍ debe seguir dicho", () => {
  // Aserciones en sentido contrario. Un test que solo prohíbe deja que la
  // corrección desaparezca en el próximo refactor sin que nadie se entere.
  const todo = superficie.map(([, src]) => src).join("\n");

  it("conserva la cita del art. 36 para la prohibición de represalias", () => {
    // VERIFICADO contra el consolidado del BOE (BOE-A-2023-4513) el 2026-08-29:
    // art. 36 = "Prohibición de represalias". Un auditor propuso cambiarlo a 35
    // ("Condiciones de protección") y habría INTRODUCIDO un error en una ficha
    // que se enseña a abogados. Este test impide que esa "corrección" vuelva.
    expect(/[Aa]rt\. 36/.test(todo)).toBe(true);
  });

  it("cita el art. 26 para el libro-registro", () => {
    // El art. 26.1 usa literalmente el término "libro-registro", así que el
    // NOMBRE era correcto desde el principio: solo fallaba el número.
    expect(/[Aa]rt\. 26/.test(todo)).toBe(true);
  });

  it("conserva los plazos del art. 9.2.c y 9.2.d, que sí son correctos", () => {
    expect(/9\.2\.c/.test(todo)).toBe(true);
    expect(/9\.2\.d/.test(todo)).toBe(true);
  });

  it("nombra la confidencialidad reforzada, que es lo que sí sostiene la fuente", () => {
    expect(/[Cc]onfidencialidad reforzada/.test(todo)).toBe(true);
  });
});

describe("SII — ningún KPI afirma cumplimiento sin dato", () => {
  const dashboard = leer("src/pages/sii/SiiDashboard.tsx");

  it("no hay porcentajes literales cableados", () => {
    // Había un "100%" literal en Garantías de Protección que no calculaba nada,
    // y un "100%" de fallback en Cumplimiento Acuse que se pintaba en verde
    // sobre CERO expedientes. Ambos vistos en pantalla.
    expect(/>\s*100%\s*</.test(dashboard)).toBe(false);
    expect(/:\s*"100%"/.test(dashboard)).toBe(false);
  });

  it("el cumplimiento de acuse distingue 'sin dato' de 'cumplido'", () => {
    expect(dashboard).toContain("no hay cumplimiento que medir");
  });
});

describe("GRC — el banner del canal no afirma capacidad del proveedor", () => {
  const penal = leer("src/pages/grc/PenalAnticorrupcion.tsx");

  it("no declara un SLA activo ni custodia cualificada de un tercero", () => {
    // La TSL acredita que EAD Trust NO consta como prestador cualificado de
    // preservación (0 PSES/Q frente a 22 de otros prestadores), y además el
    // módulo no custodia nada: guarda en localStorage, en claro.
    expect(/SLA .*ACTIVO/.test(penal)).toBe(false);
    expect(penal).not.toContain("custodia EAD Trust");
  });

  it("enuncia los plazos como exigencia legal, no como nivel de servicio cumplido", () => {
    expect(penal).toContain("Plazos legales: 7 días / 3 meses");
  });
});
