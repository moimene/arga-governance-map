// src/test/sii/sii-afirmaciones.test.ts
// El producto deja de afirmar lo que no sostiene.
//
// Todo lo prohibido aquí se vio EN PANTALLA, no se dedujo del código.
//
// DOS DEFECTOS DEL PROPIO GUARD, corregidos el 2026-09-05:
//
//  1. La superficie era `readdirSync` NO RECURSIVO sobre `src/pages/sii` y
//     `src/lib/sii`, y dejaba fuera `src/hooks/useWhistleblowing.ts` — donde
//     viven los fixtures, el mensaje del acuse y la asignación de instructora,
//     que es exactamente donde estaban las afirmaciones falsas más caras— y
//     `scripts/garrigues/sii/`, que siembra los tres casos de Garrigues.
//  2. Los patrones eran más estrechos que el criterio: `/Art\. 34/` no veía
//     «Artículo 34», y `/[Cc]ifrado de extremo a extremo/` no veía «buzón
//     cifrado» ni «zona encriptada», que era lo que ponía la pantalla.
//
// REGLA AL ESCRIBIR UN PATRÓN: se prohíbe la AFIRMACIÓN, no la palabra. Una
// lista negra de palabras no distingue afirmar de negar y tropieza con el
// propio texto correcto —«no hay cifrado», «ni sello de tiempo»—. Cada patrón
// de abajo se comprobó contra el código ANTERIOR a la corrección (cae) y contra
// el actual (pasa).
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const raiz = process.cwd();
const leer = (rel: string) => readFileSync(join(raiz, rel), "utf8");

/** Recursivo. Se excluye el material de test: un test que asierta la AUSENCIA
 *  de una frase tiene que poder escribirla. */
function ficheros(dir: string): string[] {
  const abs = join(raiz, dir);
  return readdirSync(abs).flatMap((f) => {
    if (f === "__tests__" || f === "node_modules") return [];
    const full = join(abs, f);
    if (statSync(full).isDirectory()) return ficheros(relative(raiz, full));
    if (/\.test\.tsx?$/.test(f)) return [];
    return /\.tsx?$/.test(f) ? [relative(raiz, full)] : [];
  });
}

const RUTAS = [
  ...ficheros("src/pages/sii"),
  ...ficheros("src/lib/sii"),
  ...ficheros("scripts/garrigues/sii"),
  "src/hooks/useWhistleblowing.ts",
];

const superficie: Array<readonly [string, string]> = RUTAS.map((f) => [f, leer(f)] as const);

describe("SII — la superficie escaneada cubre de verdad el módulo", () => {
  it("incluye el hook, los scripts de siembra y los subdirectorios", () => {
    expect(RUTAS).toContain("src/hooks/useWhistleblowing.ts");
    expect(RUTAS.some((f) => f.startsWith("scripts/garrigues/sii/"))).toBe(true);
    expect(RUTAS).toContain("src/pages/sii/SiiPortalIntake.tsx");
    expect(RUTAS).toContain("src/lib/sii/roles-por-tenant.ts");
    // Sin material de test: si entra, el guard se prohíbe a sí mismo.
    expect(RUTAS.filter((f) => f.includes("__tests__") || f.includes(".test."))).toEqual([]);
  });
});

describe("SII — no se afirma lo que no se sostiene", () => {
  const prohibido: Array<readonly [RegExp, string]> = [
    // ── Servicios de confianza que no existen ────────────────────────────
    [/QSeal/i, "no hay sello: no existe artefacto ni interacción con el proveedor"],
    [
      /sellad[oa]s?\s+(?:con\s+|por\s+|)(?:QTSP|EAD)/i,
      "«Registrando con sellado EAD…» sobre una mutación que solo escribe en localStorage",
    ],
    [
      /[Ff]irm(?:ar|e|ada|ado)\s+(?:y\s+\w+\s+)?(?:la\s+)?[Cc]omunicaci/,
      "«Firmar y Registrar Comunicación»: no se firma nada",
    ],
    // ── Integridad criptográfica inexistente ─────────────────────────────
    [/SHA512:|SHA-512/, "no había hash: era Math.random() bajo una etiqueta que afirmaba integridad"],
    [/SHA256:/, "el «hash» del token era el propio token con un prefijo delante"],
    [/\bWORM\b/, "«Exportar Libro-Registro Certificado (WORM)» descargaba un JSON.stringify plano"],
    // ── Cifrado inexistente ──────────────────────────────────────────────
    [/[Cc]ifrado de extremo a extremo/, "los mensajes viven en claro en localStorage"],
    [
      /(?:enviad|transmitid|guardad|custodiad|almacenad)[oa]s?\s+(?:de\s+forma\s+)?(?:cifrad|encriptad)/i,
      "«Mensaje enviado de forma cifrada al instructor»: no se cifra nada",
    ],
    [/(?:buzón|zona|canal|expediente)\s+(?:cifrad|encriptad)[oa]/i, "«buzón cifrado» / «zona encriptada»"],
    // ── Anonimato y entropía ─────────────────────────────────────────────
    [/100% anónimo|anonimato técnico/, "PI-31 Anexo 1 §3.c reserva el anónimo a la vía postal"],
    [/alta entropía/i, "el token eran 8 caracteres de Math.random() bajo ese rótulo"],
    // ── Fases y trazas inexistentes ──────────────────────────────────────
    [/admitid[oa] a trámite/, "no existe fase de admisión: el estado que se escribe es ACUSE_EMITIDO"],
    [/log (?:de auditoría )?independiente/i, "el gate solo escribe una marca en sessionStorage"],
    [/metadatos EXIF/i, "el saneado solo renombra el fichero; el contenido ni se sube"],
    // ── Citas legales incorrectas ────────────────────────────────────────
    [
      /Art(?:\.|ículo)\s*34\b/,
      "el registro de informaciones es el art. 26; el 34 es «Delegado de protección de datos»",
    ],
  ];

  for (const [patron, motivo] of prohibido) {
    it(`ninguna superficie SII dice ${patron} — ${motivo}`, () => {
      const infractores = superficie.filter(([, src]) => patron.test(src)).map(([f]) => f);
      expect(infractores).toEqual([]);
    });
  }
});

describe("SII — la identidad no se hereda entre tenants", () => {
  // Los tres sitios donde estaba cableada una fila real de `persons` de ARGA.
  const HOOK = leer("src/hooks/useWhistleblowing.ts");
  const DETALLE = leer("src/pages/sii/SiiCaseDetalle.tsx");

  it("el hook no estampa un nombre propio fuera de los fixtures de ARGA", () => {
    // Los fixtures de ARGA (INITIAL_SII_REPORTS) sí la nombran: son SU demo.
    // Lo que no puede volver es que la mutación de alta o la recusación la
    // escriban para cualquier tenant.
    const trasFixtures = HOOK.slice(HOOK.indexOf("const ARGA_TENANT"));
    expect(trasFixtures).not.toContain("Elena Navarro");
    expect(trasFixtures).not.toContain("Comité de Cumplimiento e Independencia");
  });

  it("la causa de recusación no nombra un órgano de aseguradora en duro", () => {
    expect(DETALLE).not.toContain("Comisión Auditoría)</option>");
    expect(DETALLE).toContain("roles.causaCupulaLabel");
  });
});

describe("SII — lo que SÍ debe seguir dicho", () => {
  // Aserciones en sentido contrario. Un test que solo prohíbe deja que la
  // corrección desaparezca en el próximo refactor sin que nadie se entere.
  const todo = superficie.map(([, src]) => src).join("\n");

  it("conserva la cita del art. 36 para la prohibición de represalias", () => {
    // VERIFICADO contra el consolidado del BOE (BOE-A-2023-4513): art. 36 =
    // "Prohibición de represalias". Un auditor propuso cambiarlo a 35
    // ("Condiciones de protección") y habría INTRODUCIDO un error en una ficha
    // que se enseña a abogados. Este test impide que esa "corrección" vuelva.
    expect(/[Aa]rt\. 36/.test(todo)).toBe(true);
  });

  it("cita el art. 26 para el libro-registro", () => {
    // El art. 26.1 usa literalmente el término "libro-registro".
    expect(/[Aa]rt(?:\.|ículo)\s*26/.test(todo)).toBe(true);
  });

  it("conserva los plazos del art. 9.2.c y 9.2.d, que sí son correctos", () => {
    expect(/9\.2\.c/.test(todo)).toBe(true);
    expect(/9\.2\.d/.test(todo)).toBe(true);
  });

  it("nombra la confidencialidad reforzada, que es lo que sí sostiene la fuente", () => {
    expect(/[Cc]onfidencialidad reforzada/.test(todo)).toBe(true);
  });

  it("dice en pantalla que la persistencia es local y sin eficacia jurídica", () => {
    // Decisión de producto: el canal no se conecta a Cloud, Y LA PANTALLA LO
    // DICE. Si el aviso desaparece, el módulo vuelve a aparentar producción.
    //
    // El guard exigía solo que la constante APARECIERA en el fuente, y el
    // `import` bastaba: borrar el `{SII_AVISO_PERSISTENCIA_LOCAL}` renderizado
    // dejando el import mantenía el test en verde (derrotado por mutación en la
    // review adversarial). Ahora se exige la aparición DENTRO de JSX —`{…}`—,
    // que es la forma en que un texto llega a la pantalla, y no en la línea de
    // import.
    const renderiza = (src: string) =>
      /\{\s*SII_AVISO_PERSISTENCIA_LOCAL\s*\}/.test(
        src.replace(/^import[^;]*;$/gm, ""),
      );
    const pantallas = superficie.filter(([f]) => f.startsWith("src/pages/sii/"));
    const conAviso = pantallas.filter(([, src]) => renderiza(src));
    expect(conAviso.map(([f]) => f).sort()).toEqual([
      "src/pages/sii/SiiDashboard.tsx",
      "src/pages/sii/SiiLayout.tsx",
      "src/pages/sii/SiiLibroRegistro.tsx",
      "src/pages/sii/SiiPortalIntake.tsx",
      "src/pages/sii/SiiSafeInbox.tsx",
    ]);
  });

  it("marca los expedientes sembrados como simulados donde se listan y donde se abren", () => {
    // Mismo criterio: la etiqueta tiene que RENDERIZARSE, no solo importarse.
    const renderizaEtiqueta = (ruta: string) =>
      /\{\s*SII_ETIQUETA_SIMULADO\s*\}/.test(leer(ruta).replace(/^import[^;]*;$/gm, ""));
    expect(renderizaEtiqueta("src/pages/sii/SiiDashboard.tsx")).toBe(true);
    expect(renderizaEtiqueta("src/pages/sii/SiiCaseDetalle.tsx")).toBe(true);
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

  it("el cumplimiento de acuse mide PUNTUALIDAD, no presencia", () => {
    // Contaba `!!r.acknowledgmentSentDate`: un acuse tardío sumaba igual que uno
    // en plazo. El comportamiento se prueba en whistleblowing-engine.test.ts;
    // esto impide que el KPI vuelva a contar la mera presencia.
    expect(dashboard).toContain("ackSentOnTime");
  });
});

describe("GRC — el banner del canal no afirma capacidad del proveedor", () => {
  const penal = leer("src/pages/grc/PenalAnticorrupcion.tsx");

  it("no declara un SLA activo ni custodia cualificada de un tercero", () => {
    // La TSL acredita que EAD Trust NO consta como prestador cualificado de
    // preservación, y además el módulo no custodia nada: localStorage, en claro.
    expect(/SLA .*ACTIVO/.test(penal)).toBe(false);
    expect(penal).not.toContain("custodia EAD Trust");
  });

  it("enuncia los plazos como exigencia legal, no como nivel de servicio cumplido", () => {
    expect(penal).toContain("Plazos legales: 7 días / 3 meses");
  });
});
