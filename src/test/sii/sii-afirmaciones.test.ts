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
import { sinComentarios } from "../helpers/sin-comentarios";
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
  // PUERTAS DE ENTRADA desde fuera del módulo. `GovernanceMap` seguía diciendo
  // «Al acceder se registrará en el log de auditoría independiente» —la misma
  // afirmación que se retiró de SiiLayout y del tour— y sobrevivió a todo el
  // cierre porque un guard que solo mira `src/pages/sii` no ve las puertas de
  // al lado. Lo cazó la verificación viva sobre el bundle desplegado, no la
  // suite. Quien afirme algo del canal entra aquí, esté donde esté.
  "src/pages/GovernanceMap.tsx",
  "src/context/TourContext.tsx",
  "src/pages/Documentacion.tsx",
];

// Se juzga lo que se RENDERIZA, no la prosa que explica una retirada: el
// comentario que documenta por qué se quitó una frase la contiene, y sin esto el
// guard se dispara contra su propia justificación —lo que empuja a borrar el
// comentario, que es justo lo que no se quiere—. Ocurrió tres veces el 2026-09-05.
const superficie: Array<readonly [string, string]> = RUTAS.map(
  (f) => [f, sinComentarios(leer(f))] as const,
);

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
    // OJO al escribir aquí: la pantalla de alta dice «No garantiza el
    // anonimato» y ofrece la modalidad «Comunicación Anónima Estricta», que es
    // el nombre de la opción. Prohibir la PALABRA tumbaría el texto correcto.
    // Lo que se prohíbe es la promesa de que el sistema PRESERVA algo.
    [
      /[Pp]reservaci[óo]n\s+(?:absoluta|estricta|total)/,
      "«Preservación absoluta de IP y huella» / «Preservación estricta del anonimato en Safe Inbox», pintadas como MEDIDA CAUTELAR ACTIVA en la ficha",
    ],
    [/\bIP\b[^.\n]{0,25}huella/i, "ni se trata la IP ni hay huella que preservar"],
    [/sin metadatos/i, "el saneado solo renombra el fichero: los metadatos ni se tocan"],
    [/credencial segura/i, "el código de seguimiento son 8 caracteres de Math.random()"],
    // ── Envío y entrega que no ocurren ───────────────────────────────────
    [
      /(?:transmit|remit|elev|escal|notific)\w*\s+(?:\w+\s+){0,3}(?:urgente|inmediat|preferente)/i,
      "«Alerta transmitida con carácter urgente» / «se eleva de manera inmediata y preferente»: la mutación solo escribe en localStorage de este navegador",
    ],
    [
      /emitid[oa]\s+en\s+plazo\s+legal/i,
      "el acuse se anunciaba SIEMPRE en plazo, aunque se emitiera pasados los 7 días del art. 9.2.c",
    ],
    // ── Fases y trazas inexistentes ──────────────────────────────────────
    [/admitid[oa] a trámite/, "no existe fase de admisión: el estado que se escribe es ACUSE_EMITIDO"],
    // La misma afirmación con otras palabras, que por eso se le escapó al gate:
    // el modal del acuse decía «acreditando la recepción y el inicio de las
    // diligencias previas conforme al Art. 9.2.c», y ni se abre diligencia
    // ninguna ni el 9.2.c las menciona (cotejado contra BOE-A-2023-4513: solo
    // regula el envío del acuse en siete días naturales).
    [
      /diligencias previas/i,
      "el acuse no abre diligencia alguna: la mutación escribe status=ACUSE_EMITIDO y un mensaje",
    ],
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

  it("el libro-registro distingue asiento incorporado, asignado y calculado al vuelo", () => {
    // Tres estados distintos que la pantalla pintaba como dos. Desde que el
    // ALTA asigna número de entrada (PI-31, Anexo §4), hay un estado intermedio:
    // asignado y conservado, pero todavía no incorporado —eso solo ocurre al
    // cerrar—. Sin el tercer rótulo, un asiento ya registrado se seguiría
    // presentando como si se calculara para mostrarlo.
    const libro = leer("src/pages/sii/SiiLibroRegistro.tsx");
    expect(libro).toContain("incorporadoAlCierre");
    expect(libro).toContain("numeroEntradaAsignadoAt");
    // Y el rótulo del estado intermedio existe de verdad, no solo el campo.
    expect(/Asignado en el registro/.test(libro)).toBe(true);
  });

  it("la ficha ENUNCIA la fase de admisión que el producto no modela", () => {
    // El bloque de relojes pinta 9.2.c y 9.2.d y se quedaba ahí, con lo que un
    // lector suponía que esos eran todos los plazos del circuito. PI-31, Anexo
    // §5.b impone otros dos (diez días para decidir, cinco para comunicarlo) y
    // el producto no los modela. Se declara la regla Y se dice que no se mide:
    // enunciar el plazo a secas insinuaría que hay reloj detrás.
    //
    // Se exige que se RENDERICE —dentro de `{…}`—, no que se importe: el import
    // solo prueba que alguien escribió una línea.
    const ficha = leer("src/pages/sii/SiiCaseDetalle.tsx").replace(/^import[^;]*;$/gm, "");
    expect(/\{\s*roles\.admisionATramite\.plazoDecision\s*\}/.test(ficha)).toBe(true);
    expect(/\{\s*roles\.admisionATramite\.plazoComunicacion\s*\}/.test(ficha)).toBe(true);
    // La cautela va en la misma superficie que el plazo, no en otra pantalla.
    expect(/\{\s*roles\.admisionATramite\.noModelado\s*\}/.test(ficha)).toBe(true);
    // Y gateado: el bloque sale del resolutor por tenant, no de un literal.
    expect(ficha).toContain("roles.admisionATramite &&");
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
  // Con `leer` a secas, el bloque de abajo lo satisfacía el COMENTARIO que
  // explica la corrección —«no hay cumplimiento que medir» está escrito en él—,
  // así que borrar el render y dejar la prosa pasaba el gate. Se juzga lo que
  // se renderiza: mismo criterio que la superficie de arriba.
  const dashboard = sinComentarios(leer("src/pages/sii/SiiDashboard.tsx"));

  it("no hay porcentajes literales cableados", () => {
    // Había un "100%" literal en Garantías de Protección que no calculaba nada,
    // y un "100%" de fallback en Cumplimiento Acuse que se pintaba en verde
    // sobre CERO expedientes. Ambos vistos en pantalla.
    expect(/>\s*100%\s*</.test(dashboard)).toBe(false);
    expect(/:\s*"100%"/.test(dashboard)).toBe(false);
  });

  it("el cumplimiento de acuse distingue 'sin dato' de 'cumplido'", () => {
    expect(dashboard).toContain("no hay cumplimiento que medir");
    // Y la invariante que sostiene la frase: con CERO expedientes el KPI no
    // pinta porcentaje ninguno. Un 100% verde sobre cero se lee «vamos
    // perfectos», que es lo contrario de «no hay dato».
    expect(dashboard).toMatch(/totalReports > 0\s*\?[^:]*%[^:]*:\s*"—"/);
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

describe("SII — un plazo agotado no se enuncia como plazo por consumir", () => {
  // El chip «Resolución Ordinaria (3m)» iba cableado al token de éxito y
  // escribía el contador crudo: con los tres expedientes sembrados —los tres
  // pasado el plazo del art. 9.2.d— la ficha decía «-58 días restantes» EN
  // VERDE. El comportamiento se prueba en whistleblowing-engine.test.ts; esto
  // impide que una pantalla vuelva a redactar la cuenta atrás por su cuenta.
  const PANTALLAS = ["src/pages/sii/SiiCaseDetalle.tsx", "src/pages/sii/SiiDashboard.tsx"];

  for (const ruta of PANTALLAS) {
    it(`${ruta} deja la cuenta atrás en el motor`, () => {
      const src = sinComentarios(leer(ruta));
      expect(src).toContain("describeDeadlineCountdown(");
      // Escribir «restantes» en la pantalla es reintroducir el defecto: el
      // texto lo produce la función pura, que mira el signo. Un contador con
      // signo negativo NO puede llamarse «restantes».
      expect(src).not.toMatch(/restantes/);
    });
  }
});

describe("SII — el modelo no nombra destinatarios de remisión que nadie sabe escribir", () => {
  // El expediente declaraba `referralAuthority` con tres destinatarios
  // —Ministerio Fiscal, Fiscalía Europea y la Autoridad Independiente— y NADIE
  // lo escribía ni lo leía: ni el cierre, ni la derivación, ni el asiento del
  // Libro-registro. Un campo así insinúa una remisión que el producto no hace.
  //
  // La regla no es «prohibido el campo», es «si está, alguien lo escribe»: el
  // día que la ficha ofrezca elegir destinatario, el campo vuelve y este gate
  // sigue verde. Se mira la superficie SIN comentarios, porque el comentario
  // que explica la retirada lo nombra.
  it("si el tipo declara el destinatario, alguna superficie lo asigna", () => {
    const declarantes = superficie.filter(([, src]) => /referralAuthority\??:/.test(src));
    const escritores = superficie.filter(([, src]) => /referralAuthority\s*[:=]\s*[^;\n]*"/.test(src));
    expect(declarantes.length === 0 || escritores.length > 0).toBe(true);
  });
});
