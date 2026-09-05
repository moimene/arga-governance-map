import { describe, it, expect } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";

/**
 * A3 — Ninguna superficie de AI Governance afirma un hecho que no esté en BD.
 *
 * Tres familias de falsedad, todas verificadas en vivo el 2026-08-29:
 *  1. Sellos fabricados en cliente y atribuidos a EAD Trust, a quien NO se llama
 *     nunca (0 imports, 0 fetch, 0 functions.invoke en toda la superficie AIMS).
 *  2. Un documento que el usuario DESCARGA afirmando conformidad, firma
 *     electrónica e identidad aseguradora.
 *  3. Un contrato de columnas inventado: 23 columnas declaradas que no existen,
 *     que la UI pinta como `undefined` — incluida una que se presenta como
 *     afirmación positiva sobre datos personales.
 */
const read = (f: string) => readFileSync(f, "utf8");

/**
 * Quita comentarios (`//`, `/* *\/` y `{/* *\/}` de JSX) antes de comprobar lo
 * que la pantalla DICE. Sin esto, el comentario que documenta la corrección
 * satisface el gate que vigila la corrección: la prosa que explica por qué algo
 * está mal contiene, por fuerza, las palabras del defecto.
 */
function sinComentarios(src: string): string {
  return src
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^[ \t]*\/\/.*$/gm, " ");
}

/** Toda la superficie de AI Governance, descubierta, no enumerada. */
function superficieAims(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = `${dir}/${e.name}`;
      if (e.isDirectory()) { if (e.name !== "__tests__") walk(full); }
      else if (/\.tsx?$/.test(e.name)) out.push(full);
    }
  };
  for (const d of ["src/pages/ai-governance", "src/components/ai-governance", "src/lib/aims"]) walk(d);
  for (const f of readdirSync("src/hooks")) if (/^useAims.*\.ts$/.test(f)) out.push(`src/hooks/${f}`);
  return out;
}


const DETALLE = "src/pages/ai-governance/SistemaDetalle.tsx";
const DECLARACION = "src/components/ai-governance/DeclaracionConformidadModal.tsx";
const HOOK = "src/hooks/useAimsTechnicalFile.ts";
const RPC = "supabase/migrations/20260829130000_aims_close_technical_file_sin_atribucion.sql";

/**
 * Control positivo del instrumento (forma nº7).
 *
 * Cinco bucles de este fichero recorren `superficieAims()` y TODAS sus
 * aserciones son de ausencia (`.toBe(false)`). Una lista encogida las pone
 * verdes a las cinco a la vez, y "no hay sellos fabricados" pasaría a
 * significar "no he mirado". Una aserción de ausencia sin control positivo no
 * distingue "correctamente ausente" de "ciego".
 */
describe("A3 — el barrido ve la superficie que dice barrer", () => {
  it("encuentra la superficie AIMS completa, no un subconjunto mudo", () => {
    const ficheros = superficieAims();
    expect(ficheros.length, "el barrido de la superficie AIMS se ha quedado corto")
      .toBeGreaterThanOrEqual(19);
    for (const esperado of [
      "src/pages/ai-governance/SistemaDetalle.tsx",
      "src/pages/ai-governance/IncidenteDetalle.tsx",
      "src/lib/aims/incident-clocks.ts",
      "src/hooks/useAimsTechnicalFile.ts",
    ]) {
      expect(ficheros, `${esperado} no entra en el barrido`).toContain(esperado);
    }
  });
});

describe("A3 — sin sellos fabricados", () => {
  it("el cliente no fabrica tokens de sello", () => {
    const src = read(DETALLE);
    expect(/QSEAL-EADTRUST|TSQ-TSA-EU/.test(src), `${DETALLE} fabrica un token de sello`).toBe(false);
    expect(/Date\.now\(\)/.test(src.split("handleSealTechnicalFile")[1]?.slice(0, 600) ?? ""),
      "el sello sigue derivándose de Date.now()").toBe(false);
  });

  it("ninguna superficie AIMS atribuye custodia ni firma a EAD Trust", () => {
    // No se le llama nunca: 0 imports de cliente, 0 fetch, 0 functions.invoke.
    // La excepción declarada para `EvaluacionNueva.tsx` se retiró al cerrar A2:
    // ya no escribe `evidence_url` de eadtrust.g-digital.net en ningún punto.
    for (const f of superficieAims()) {
      expect(/EAD\s*Trust|EADTRUST|eadtrust/i.test(read(f)), `${f} atribuye algo a EAD Trust`).toBe(false);
    }
  });

  it("ningún campo de token de sello recibe un valor fabricado", () => {
    // Antes solo se prohibían dos literales concretos: bastaba renombrar el
    // prefijo o mover la fabricación a un helper para volver a colarlo.
    for (const f of superficieAims()) {
      const src = read(f);
      for (const m of src.match(/(qsealToken|tsqToken|qseal_token|tsq_token)\s*[:=]\s*[^,;\n]+/g) ?? []) {
        expect(
          /undefined|null|string|unknown|\?|:\s*(qsealToken|tsqToken|p_qseal_token|p_tsq_token)\s*$/.test(m),
          `${f}: token de sello con valor fabricado → ${m.trim()}`,
        ).toBe(true);
      }
    }
  });

  it("ningún fallback rellena un hueco con una clasificación inventada", () => {
    // El sesgo recurrente del producto: el hueco se rellena con la lectura
    // optimista en vez de con la honesta. Tres ocurrencias ya catalogadas.
    const PROHIBIDOS = [
      /risk_level\s*\|\|\s*"(Alto|ALTO|HIGH)/,
      /severity\s*\|\|\s*"(MEDIA|ALTA|CRITICA)/,
      /vendor\s*\|\|\s*"(Desarrollo|Interno|Propio)/,
      /status\s*\|\|\s*"(ACTIVO|CONFORME|OPTIMAL)/,
      /system_type\s*\|\|\s*"(Machine Learning|Sistema de)/,
    ];
    for (const f of superficieAims()) {
      const src = read(f);
      for (const re of PROHIBIDOS) {
        const hit = src.match(re);
        expect(hit, `${f}: fallback que inventa dato → ${hit?.[0]}`).toBeNull();
      }
    }
  });

  it("no se afirma precinto ni sellado, que es lo que no ocurre", () => {
    // AMPLIADO (2026-09-05) de un fichero a toda la superficie. Vigilando sólo
    // `SistemaDetalle`, el alta de autodiagnóstico ofrecía «Guardar y Precintar
    // Autodiagnóstico» y confirmaba «ha sido precintada» sobre dos INSERT
    // planos, sin hash, sin sello y sin bundle. El gate no podía verlo.
    for (const f of superficieAims()) {
      const src = read(f);
      const hit = src.match(/Precintar|Precintad[oa]|WORM Sealing/i);
      expect(hit, `${f}: afirma precinto/sellado donde sólo hay un registro interno → ${hit?.[0]}`)
        .toBeNull();
    }
  });

  it("no se afirma un hash de integridad sobre tablas que no lo guardan", () => {
    // `aims_technical_file_sections` y `aims_system_versions` no tienen columna
    // de hash (verificado en Cloud, 2026-09-05) y ninguna pantalla calcula uno.
    // La ficha de sistema y la declaración de conformidad —que el usuario
    // DESCARGA— anunciaban «Registro interno con hash SHA-512».
    for (const f of superficieAims()) {
      const src = read(f);
      // Se permite nombrarlo para NEGARLO ("sin hash", "no lleva hash").
      for (const m of src.match(/[^\n]*SHA-?512[^\n]*/gi) ?? []) {
        expect(
          /\bsin hash\b|no lleva hash|no calcula|no tienen? columna/i.test(m),
          `${f}: afirma un hash que ninguna tabla guarda → ${m.trim()}`,
        ).toBe(true);
      }
    }
  });
});

describe("A3 — el texto libre del usuario no se presenta como dictamen", () => {
  it("la nota de una evaluación se pinta rotulada como nota libre", () => {
    // En Cloud hay CUATRO filas de `ai_risk_assessments` del tenant ARGA cuyo
    // `notes` afirma «el cumplimiento estricto de todos los artículos de la Ley
    // de Inteligencia Artificial de la Unión Europea». Lo escribió
    // `e2e/aims-evaluaciones.spec.ts` el 2026-07-19, no una auditoría. La ficha
    // de sistema lo pintaba a secas bajo el score, donde se lee como la
    // conclusión de la consola. El texto no se puede borrar desde aquí; lo que
    // sí se puede es dejar de presentarlo como lo que no es.
    // Se mira el CÓDIGO SIN COMENTARIOS: con los comentarios dentro, el propio
    // párrafo que explica por qué hay que rotular la nota satisfacía el gate
    // aunque el rótulo de pantalla hubiera vuelto a decir «Conclusión» (medido
    // con mutación, 2026-09-05).
    const src = sinComentarios(read(DETALLE));
    const render = src.match(/\{ass\.notes[^}]*\}/);
    expect(render, "la ficha ya no pinta la nota de la evaluación").not.toBeNull();
    const i = src.indexOf(render![0]);
    const ventana = src.slice(Math.max(0, i - 700), i + 200);
    expect(
      /Nota libre de quien registr/i.test(ventana),
      "la nota de la evaluación vuelve a pintarse sin rótulo, como si fuera la conclusión de la consola",
    ).toBe(true);
    // Y no se presenta como dictamen.
    expect(
      /Conclusi[óo]n de la (evaluaci[óo]n|auditor[íi]a)|Dictamen/i.test(ventana),
      "la nota libre vuelve a rotularse como conclusión o dictamen",
    ).toBe(false);
  });
});

describe("A3 — un cero sin dato no se pinta como un cero bueno", () => {
  const DASHBOARD = "src/pages/ai-governance/Dashboard.tsx";

  it("las KPI de riesgo e incidentes distinguen «ninguno» de «no consta»", () => {
    // Con Garrigues (0 sistemas, 0 incidentes) las tarjetas pintaban «0» en
    // verde: «Riesgo Alto sin eval. aprobada: 0» leído como logro cuando lo que
    // pasa es que no hay inventario con que contarlo.
    const src = read(DASHBOARD);
    expect(
      /neutral:/.test(src),
      "KpiCard ya no tiene tono neutro: el cero sin dato vuelve a ser verde",
    ).toBe(true);

    // …y el tono neutro tiene que PINTAR neutro. Comprobar solo que la clave
    // `neutral:` existe no dice nada de su valor: mapearla a
    // `var(--status-success)` devolvía el cero sin dato al verde y el gate
    // seguía pasando (derrotado por mutación en la review adversarial).
    for (const clave of ["neutral:"]) {
      for (const bloque of src.split(clave).slice(1)) {
        const valor = bloque.slice(0, 80);
        expect(
          /status-(success|active)/.test(valor),
          `el tono neutro se pinta con un color de éxito: ${valor.split("\n")[0].trim()}`,
        ).toBe(false);
      }
    }
    for (const [etiqueta, coleccion] of [
      ["Riesgo Alto sin eval. aprobada", "systems"],
      ["Incidentes abiertos", "incidents"],
    ] as const) {
      const i = src.indexOf(etiqueta);
      expect(i, `no se encuentra la KPI «${etiqueta}»`).toBeGreaterThan(0);
      const tarjeta = src.slice(i, i + 500);
      expect(
        new RegExp(`${coleccion}\\.length === 0 \\? "neutral"`).test(tarjeta),
        `la KPI «${etiqueta}» no pasa a tono neutro cuando ${coleccion} está vacío`,
      ).toBe(true);
    }
  });

  it("no se afirma «Standalone-ready» ni «datos demo conectados» sin comprobarlo", () => {
    const src = read(DASHBOARD);
    // Los dos eran literales incondicionales, y el primero contradecía al
    // `standaloneReady` que el propio resumen calcula.
    const ready = src.indexOf("Standalone-ready");
    expect(ready, "ha desaparecido el rótulo de readiness").toBeGreaterThan(0);
    expect(
      /readiness\.standaloneReady \? "Standalone-ready"/.test(src),
      "«Standalone-ready» vuelve a afirmarse sin mirar el resumen",
    ).toBe(true);
    expect(
      /Estado de fuentes: datos demo conectados/.test(src),
      "vuelve el literal «datos demo conectados» sin comprobar que haya datos",
    ).toBe(false);
    expect(
      /Pendiente, sin schema nuevo/.test(src),
      "vuelve «sin schema nuevo», que es falso y contradice al dominio migration",
    ).toBe(false);
  });
});

describe("A3 — no se cita lo que no se ha cotejado", () => {
  it("no se atribuye ninguna Guía AESIA a ningún requisito", () => {
    // El catálogo daba a cada requisito un número de Guía AESIA («Guía 12
    // AESIA», «Guía 2 AESIA»…) y diez de los doce llevaban una guía distinta de
    // la suya. Las guías existen (AESIA publica un catálogo numerado): el
    // defecto era la ATRIBUCIÓN, y que una guía no vinculante no es la fuente
    // de un requisito del Reglamento — la fuente es el artículo.
    // Se retiró el campo entero. Este gate impide que vuelva por cualquiera de
    // las dos puertas: el DATO del catálogo y el RÓTULO de pantalla.
    for (const f of superficieAims()) {
      const src = read(f);
      const dato = src.match(/guideRef\s*[:?]/);
      expect(dato, `${f}: el catálogo vuelve a declarar guideRef → ${dato?.[0]}`).toBeNull();
      // El rótulo, aunque se construya sin el campo. Se vigila la forma que se
      // comprobó falsa: una guía AESIA numerada atribuida a un requisito
      // concreto («Guía 12 AESIA», «Guía 2 AESIA»…). La Guía 16 queda FUERA de
      // este gate a propósito y con el motivo escrito: no es una atribución por
      // requisito sino el nombre del manual de checklists del que sale el
      // catálogo entero, es el encuadre declarado del módulo desde su origen y
      // no formaba parte del defecto medido. Su propia verificación contra
      // publicación oficial sigue siendo deuda abierta, distinta de ésta.
      for (const m of src.matchAll(/Gu[íi]a\s+\d+\s*(?:AESIA|de\s+AESIA)/gi)) {
        if (/Gu[íi]a\s+16\b/i.test(m[0])) continue;
        // Sólo se permite nombrarlo para explicar la retirada, nunca como cita.
        // El contexto se toma en una ventana, no en la línea: la justificación
        // de un comentario largo cae en la línea siguiente y comprobar sólo la
        // línea del hallazgo la dejaría fuera.
        const ventana = src.slice(Math.max(0, m.index - 260), m.index + 260);
        expect(
          /retirad|no se ha podido cotejar|no verificable|SE HA RETIRADO/i.test(ventana),
          `${f}: vuelve a atribuirse una Guía AESIA numerada a un requisito → ${m[0]}`,
        ).toBe(true);
      }
    }
  });

  it("el identificador interno de bloque no se pinta como apartado del Reglamento", () => {
    // `subpartId` («17.1.a», «9.2.a») es una clave de agrupación del catálogo,
    // no una cita cotejada del apartado y la letra del artículo. Se pintaba en
    // pantalla con el rótulo «Subapartado» y en `font-mono`, que es exactamente
    // la forma de una referencia legal. Ahora se pinta `titleShort` vía
    // `subpartTitle()`.
    for (const f of superficieAims()) {
      const src = read(f);
      for (const m of src.match(/(?<![=\w])\{[^{}\n]*\.subpartId\}/g) ?? []) {
        expect(
          false,
          `${f}: vuelve a renderizarse el identificador de bloque como si fuera una cita → ${m}`,
        ).toBe(true);
      }
      expect(
        /Subapartado\s+Legal/i.test(src),
        `${f}: vuelve el rótulo «Subapartado Legal» sobre un identificador no cotejado`,
      ).toBe(false);
    }
  });
});

describe("A3 — no se ofrece una capacidad que el sistema deniega", () => {
  it("el cierre del expediente no se ofrece como disponible", () => {
    // `fn_aims_close_technical_file` inserta `status='SEALED'` en
    // `evidence_bundles`, y el guard de Secretaría sólo admite evidencia
    // OPEN sin firmar desde un caller autenticado: falla SIEMPRE con 42501
    // (probado con ROLLBACK el 2026-08-29). Un botón que siempre da error
    // promete una capacidad que el sistema deniega por diseño.
    const src = read(DETALLE);
    const bloque = src.slice(src.indexOf("handleSealTechnicalFile(currentVersion.id)"));
    expect(/\bdisabled\b/.test(bloque.slice(0, 400)), "el botón de cierre no está deshabilitado").toBe(true);
    expect(/no disponible/i.test(src), "no se explica al usuario por qué no está disponible").toBe(true);
  });
});

describe("A3 — el documento descargable no afirma lo que no consta", () => {
  it("no imprime el estado del sistema como estado del expediente", () => {
    // `ai_systems.status` incluye el valor literal "Conforme": imprimirlo bajo
    // el rótulo "Estado del Expediente" afirmaría conformidad. Además es el
    // campo equivocado: el del expediente es `technical_file_status`.
    const src = read(DECLARACION);
    expect(/Estado del Expediente:\s*\$\{system\.status/.test(src),
      "imprime el estado del sistema como estado del expediente").toBe(false);
  });

  it("no declara conformidad ni identidad aseguradora", () => {
    const src = read(DECLARACION);
    // Case-insensitive y tolerante a puntuación: antes "entidad aseguradora"
    // o "Paseo de la Castellana, 259" esquivaban el literal exacto.
    for (const re of [/conforme y validado/i, /entidad\s+aseguradora/i,
                      /castellana,?\s*259/i, /worm sha-?512 verificado/i,
                      /[áa]mbito asegurador/i]) {
      expect(re.test(src), `la declaración sigue afirmando ${re}`).toBe(false);
    }
  });

  it("no afirma una firma electrónica", () => {
    expect(/Firma Electr[óo]nica\s*:/i.test(read(DECLARACION)),
      "la declaración afirma una firma que no existe").toBe(false);
  });

  it("el cuerpo renderizado tampoco declara cumplimiento ni oficialidad", () => {
    // Cazado por la verificación viva, no por regex: el modal tiene su propio
    // texto, distinto de la plantilla de descarga. Y el sello salía en
    // mayúsculas por CSS, así que un grep del literal en mayúsculas fallaba
    // (gotcha G4 nº11: innerText devuelve el texto ya transformado).
    const src = read(DECLARACION);
    expect(/documento oficial/i.test(src), "se sigue sellando como documento oficial").toBe(false);
    expect(/declara solemnemente/i.test(src), "declara solemnemente el cumplimiento").toBe(false);
    expect(/cumple con todos los requisitos/i.test(src), "afirma cumplimiento pleno").toBe(false);
    expect(/Imprimir Certificado/i.test(src), "llama certificado a un borrador").toBe(false);
  });

  it("un sistema sin clasificar NO se declara de alto riesgo del Anexo III", () => {
    // La falsedad va en las dos direcciones: un falso positivo regulatorio en un
    // papel con membrete del art. 47 es tan indefendible como un falso verde.
    const src = read(DECLARACION);
    expect(/risk_level\s*\|\|\s*"ALTO RIESGO/.test(src),
      "risk_level cae por defecto a ALTO RIESGO (Anexo III)").toBe(false);
  });
});

describe("A3 — contrato de columnas real", () => {
  // Columnas declaradas que NO existen en Cloud (verificado contra
  // information_schema el 2026-08-29).
  const FANTASMAS = [
    "section_key", "section_title", "content_summary", "evidence_doc_path",
    "evidence_doc_hash", "completeness_score",
    "version_tag", "target_readiness_score", "current_readiness_score",
    "sealed_at", "sealed_by",
    "indicator_type", "last_evaluated_at",
    "base_architecture", "parameters_count", "training_cutoff",
    "records_count", "contains_pii", "contains_special_categories",
    // Añadidas tras la review: la lista fija se quedaba corta y era una vía de
    // escape. `name`/`threshold` los cazó el typecheck, no el regex.
    "qseal_token", "provenance", "indicator_type", "last_evaluated_at",
  ];

  it("el hook no declara columnas inexistentes", () => {
    const src = read(HOOK);
    const vivas = FANTASMAS.filter((c) => new RegExp(`\\b${c}\\b`).test(src));
    expect(vivas, `columnas fantasma declaradas: ${vivas.join(", ")}`).toEqual([]);
  });

  it("la ficha no pinta columnas inexistentes", () => {
    const src = read(DETALLE);
    const vivas = FANTASMAS.filter((c) => new RegExp(`\\b${c}\\b`).test(src));
    expect(vivas, `columnas fantasma pintadas: ${vivas.join(", ")}`).toEqual([]);
  });

  it("no se afirma ausencia de PII: sin dato, no hay afirmación", () => {
    for (const f of superficieAims()) {
      const src = read(f);
      expect(
        /sin pii|no contiene datos personales|sin datos personales/i.test(src),
        `${f}: afirma ausencia de datos personales sin dato que lo respalde`,
      ).toBe(false);
    }
  });
});

describe("A3 — la RPC deja de estampar la atribución en el servidor", () => {
  it("existe la migración que sanea fn_aims_close_technical_file", () => {
    expect(() => read(RPC)).not.toThrow();
  });

  it("la RPC no estampa EAD Trust ni fabrica tokens", () => {
    // Se asierta sobre el SQL EJECUTABLE, no sobre los comentarios: documentar
    // por qué se retiró la atribución es valioso y no es una atribución.
    const sql = read(RPC).replace(/^\s*--.*$/gm, "");
    expect(/EAD Trust/.test(sql), "la RPC sigue estampando 'EAD Trust'").toBe(false);
    expect(/'QSEAL-AIMS-'|'TSQ-AIMS-'/.test(sql), "la RPC sigue fabricando tokens").toBe(false);
    expect(/fn_aims_close_technical_file/.test(sql), "la migración no redefine la función").toBe(true);
  });
});

describe("A4 — la pestaña FRIA lee el expediente real", () => {
  const src = () => read(DETALLE);

  /**
   * Recorta el bloque de la pestaña FRIA. Perseguir literales es una carrera
   * que se pierde —la review reintrodujo la prosa aseguradora con sinónimos y
   * el gate siguió verde—, así que estas aserciones miran ESTRUCTURA: de dónde
   * sale lo que se pinta, no qué palabras usa.
   */
  function bloqueFria(): string {
    const s = src();
    const ini = s.indexOf('activeTab === "FRIA"');
    expect(ini, "no se encuentra la pestaña FRIA").toBeGreaterThan(0);
    return s.slice(ini, s.indexOf("\n      {activeTab", ini + 10) + 1 || undefined);
  }

  it("cada bloque del art. 27 se sirve de friaDetails, no de literales", () => {
    const b = bloqueFria();
    const bloques = b.split("<FriaBlock").slice(1);
    expect(bloques.length, "no hay bloques del art. 27").toBeGreaterThanOrEqual(6);
    for (const [i, bl] of bloques.entries()) {
      const cuerpo = bl.slice(0, bl.indexOf("</FriaBlock>"));
      // El apartado (e) no tiene tabla en el modelo y lo declara: es el único
      // que puede no consumir dato, y a cambio debe decir por qué.
      const esE = /27\.1 \(e\)/.test(cuerpo);
      expect(
        esE ? /nota=/.test(cuerpo) : /friaDetails/.test(cuerpo),
        `bloque ${i + 1} del art. 27 no sale del dato ni declara su hueco`,
      ).toBe(true);
    }
  });

  it("la notificación a la autoridad se deriva del dato, nunca se rotula fija", () => {
    const b = bloqueFria();
    // Verde sólo si lo dice la columna. Antes era un literal en --status-success.
    for (const m of b.match(/status-success[\s\S]{0,400}?<\/span>/g) ?? []) {
      expect(
        /market_surveillance_notified/.test(m),
        `hay un rótulo en verde que no depende del dato: ${m.slice(0, 120)}`,
      ).toBe(true);
    }
  });

  it("no se afirma custodia ni hash en la cabecera de la FRIA", () => {
    // `aims_fria_assessments` no tiene ninguna columna de hash: cualquier
    // "SHA-512" ahí es un literal fabricado.
    const cab = bloqueFria().split("<FriaBlock")[0];
    expect(/SHA-?512/i.test(cab), "la cabecera de la FRIA afirma un hash que no existe").toBe(false);
  });

  it("el estado vacío está en el JSX, no sólo en un comentario", () => {
    expect(/friaLoading \|\| friaError \|\| !fria \?/.test(src()),
      "el estado vacío no está cableado en el render").toBe(true);
  });

  it("friaDetails no se desreferencia sin valor por defecto", () => {
    // Cuando `fria` pasa a truthy, la clave de `useFriaDetails` es nueva y su
    // data es undefined en ESE render: sin default, TypeError y el
    // ErrorBoundary global tumba la página entera.
    expect(/friaDetailsRaw \?\?/.test(src()),
      "friaDetails se usa sin valor por defecto").toBe(true);
  });

  it("no afirma notificación a la autoridad de vigilancia", () => {
    // `AESIA Notificada: SÍ` era un literal en verde, sin una sola fila detrás.
    // La notificación consta en `market_surveillance_notified`, o no consta.
    expect(/AESIA Notificada:\s*S[ÍI]/i.test(src()), "afirma notificación a AESIA sin dato").toBe(false);
    expect(/APROBADA\s*&(amp;)?\s*NOTIFICADA/i.test(src()), "estado de FRIA inventado").toBe(false);
  });

  it("no inventa firmantes ni versión de la evaluación", () => {
    for (const re of [/dpo@empresa\.com/i, /ai\.officer@empresa\.com/i,
                      /version_number\s*\|\|\s*"?1\.0/]) {
      expect(re.test(src()), `la FRIA sigue inventando un valor: ${re}`).toBe(false);
    }
  });

  it("no fabrica hashes de referencias cruzadas FRIA-EIPD", () => {
    expect(/SHA512:\s*[0-9a-f]{6}/i.test(src()), "hashes inventados en las referencias cruzadas").toBe(false);
    expect(/\d+\s+REFERENCIAS ACTIVAS/i.test(src()), "recuento de referencias hardcodeado").toBe(false);
  });

  it("los seis bloques del art. 27 salen del dato, no de prosa fija", () => {
    // El texto era de una aseguradora: suscripción de pólizas de salud y vida,
    // recargo actuarial, tomadores y asegurados, 45.000 evaluaciones anuales.
    for (const re of [/p[óo]lizas?/i, /actuarial/i, /tomadores/i, /asegurad[oa]s/i,
                      /45\.000 evaluaciones/i, /suscriptor/i]) {
      expect(re.test(src()), `la FRIA conserva prosa aseguradora: ${re}`).toBe(false);
    }
    // Y consume de verdad el detalle que ya pedía y no usaba.
    expect(/friaDetails/.test(src()), "friaDetails se pide y no se usa").toBe(true);
  });

  it("sin FRIA registrada hay estado vacío honesto, no una ficha aprobada", () => {
    // El copy pasó de «no tiene evaluación registrada» a la ausencia acreditada
    // por decisión del usuario: decir que falta un documento presupone que era
    // exigible, y eso es justamente lo que no consta.
    expect(/no consta acreditado que el art[íi]culo 27 alcance/i.test(src()),
      "falta el estado de ausencia acreditada cuando no hay FRIA").toBe(true);
  });

  it("un fallo de lectura NO se presenta como ausencia de evaluación", () => {
    // Los hooks ahora propagan el error. Sin distinguirlo, `fria` queda
    // undefined y la pestaña diría "no tiene evaluación registrada": estaría
    // afirmando una ausencia que no consta.
    const s = src();
    expect(/friaError/.test(s), "no se distingue el error de la ausencia").toBe(true);
    expect(/friaLoading/.test(s), "no se distingue la carga de la ausencia").toBe(true);
    expect(/no se ha podido consultar/i.test(s), "falta el estado de error explícito").toBe(true);
  });
});

describe("A2 — el formulario no preselecciona un nivel que nadie ha elegido", () => {
  const EVAL_NUEVA = "src/pages/ai-governance/EvaluacionNueva.tsx";

  it("ninguna medida arranca con un nivel de madurez por defecto", () => {
    // Cazado en verificación viva: el desplegable mostraba L5 en toda medida
    // sin contestar, y `updateEvaluation` creaba la entrada con `maturity:"L5"`
    // si el usuario tocaba SÓLO la dificultad — la medida quedaba contestada
    // con un nivel que nadie eligió. Es el gemelo del pre-relleno retirado.
    const src = read(EVAL_NUEVA);
    expect(/maturity:\s*"L[0-9]"/.test(src),
      "hay un nivel de madurez por defecto en el formulario").toBe(false);
    expect(/<option value="">Sin evaluar<\/option>/.test(src),
      "el selector no ofrece la opción explícita de sin evaluar").toBe(true);
  });

  it("no quedan pre-rellenos del catálogo", () => {
    const src = read(EVAL_NUEVA);
    expect(/prefill/i.test(src), "sigue habiendo un pre-relleno").toBe(false);
  });
});

describe("A6 — ninguna acción afirma un efecto que no produce", () => {
  const INCIDENTE = "src/pages/ai-governance/IncidenteDetalle.tsx";

  it("el cierre de subexpediente escribe ANTES de anunciar el éxito", () => {
    // Antes era un `try` VACÍO que lanzaba
    // `toast.success("… notificado y archivado con acuse")` sin tocar nada.
    // Ni siquiera había un 42501 que lo delatara: el toast salía igual.
    //
    // No basta con que ambos aparezcan: mover el toast ANTES del await lo
    // dejaba verde afirmando el éxito antes de conocer el resultado. Se
    // comprueba el ORDEN.
    const src = read(INCIDENTE);
    const fn = src.slice(src.indexOf("handleCloseRegimeSubcase = async"));
    const cuerpo = fn.slice(0, fn.indexOf("\n  };"));
    const iEscritura = cuerpo.search(/await\s+\w*[Mm]utation\.mutateAsync/);
    const iToast = cuerpo.indexOf("toast.success");
    expect(iEscritura, "el cierre no espera a ninguna escritura").toBeGreaterThan(-1);
    expect(iToast, "el cierre no informa del resultado").toBeGreaterThan(-1);
    expect(iToast, "anuncia el éxito antes de escribir").toBeGreaterThan(iEscritura);
  });

  it("no se promete notificación a la autoridad ni acuse de recibo", () => {
    const src = read(INCIDENTE);
    expect(/notificado y archivado con acuse/i.test(src), "promete acuse de recibo").toBe(false);
    expect(/Sellar Acuse/i.test(src), "promete sellar un acuse").toBe(false);
  });

  it("el riesgo del art. 73 DERIVA del dato, no es una constante", () => {
    // Comprobar que la clave existe no basta: `isAiHighRisk: true` la satisface
    // y reintroduce el defecto entero (todo incidente activa el plazo).
    const src = read(INCIDENTE);
    const m = src.match(/isAiHighRisk:\s*([\s\S]{0,220}?),\n/);
    expect(m, "no se pasa el riesgo del sistema al motor de relojes").not.toBeNull();
    const expresion = m![1];
    expect(/true|false/.test(expresion.replace(/\/\/.*$/gm, "")),
      `isAiHighRisk es una constante: ${expresion.trim()}`).toBe(false);
    expect(/risk_level/.test(expresion),
      "isAiHighRisk no deriva de la clasificación del sistema").toBe(true);
  });

  it("no se afirma un hash sobre una tabla que no lo tiene", () => {
    // Introducido POR A6: al retirar "Custodia documental (EAD Trust)" se puso
    // "Registro interno · hash SHA-512", y `ai_incidents` no tiene ninguna
    // columna de hash ni la pantalla calcula ninguno. Una falsedad por otra.
    expect(/SHA-?512/i.test(read(INCIDENTE)),
      "la ficha de incidente afirma un hash que no existe").toBe(false);
  });
});

describe("La puerta de entrada no promete lo que el producto oculta", () => {
  it("el acceso de Garrigues no anuncia DORA", async () => {
    // Era la primera pantalla que veía ese usuario, ofreciéndole un régimen
    // que `branding.modules` le oculta por dentro desde D-5 y que, por el
    // análisis de G6, no le alcanza. Un producto no puede prometer en la
    // puerta lo que niega en el pasillo.
    const { LOGIN_BRANDS, resolveLoginBrand } = await import("@/lib/login-brands");
    // Se resuelve por el camino del PRODUCTO, no leyendo el mapa a mano: si
    // `resolveLoginBrand` cayera a su fallback (que es ARGA), el gate estaría
    // mirando otra marca y aquí se ve.
    const garrigues = resolveLoginBrand("?tenant=garrigues");
    expect(garrigues.key, "resolveLoginBrand no devuelve la marca de Garrigues").toBe("garrigues");
    expect(garrigues.tenantId, "la marca de Garrigues apunta a otro tenant")
      .toBe("00000000-0000-0000-0000-000000000002");

    const texto = JSON.stringify(garrigues);
    expect(/\bDORA\b/i.test(texto), `el acceso de Garrigues sigue anunciando DORA: ${texto}`).toBe(false);

    // CONTROL DISCRIMINANTE. El anterior era `expect(LOGIN_BRANDS.arga).toBeDefined()`:
    // no discriminaba nada, pasaba con las dos marcas vacías y con las dos
    // idénticas. Se comprueba (a) que el objeto bajo examen NO está vacío —una
    // marca sin texto satisface trivialmente cualquier «no menciona X»— y (b)
    // que las dos marcas son REALMENTE distintas y el detector separa una de
    // otra: ARGA lleva su vocabulario asegurador y Garrigues no, así que un
    // gate que estuviera leyendo la marca equivocada caería aquí.
    expect(texto.length, "la marca de Garrigues está vacía: el gate sería vacuo").toBeGreaterThan(200);
    expect(/AI Governance|Secretaría Societaria/i.test(texto),
      "la marca de Garrigues no tiene su propio contenido").toBe(true);

    const argaTexto = JSON.stringify(LOGIN_BRANDS.arga);
    expect(/asegurador/i.test(argaTexto),
      "la marca de ARGA no es la de la aseguradora: el control no discrimina").toBe(true);
    expect(/asegurador/i.test(texto),
      "la marca de Garrigues trae el vocabulario de ARGA: se está leyendo la marca equivocada").toBe(false);
  });
});

describe("FRIA — ausencia acreditada, no ausencia a secas", () => {
  /**
   * Recorta el PANEL de ausencia, no el fichero entero. Asertar sobre las 1200
   * líneas es la misma trampa que tumbó el test del login: una cadena que
   * coincide en cualquier otro punto del fichero lo satisface, y el panel
   * podría haber desaparecido.
   */
  function panelAusencia(): string {
    const s = read(DETALLE);
    const ini = s.indexOf("No consta acreditado que el artículo 27");
    expect(ini, "el panel de ausencia acreditada no está en el fichero").toBeGreaterThan(0);
    const fin = s.indexOf("</div>\n          ) : (", ini);
    expect(fin, "no se encuentra el final del panel").toBeGreaterThan(ini);
    return s.slice(ini, fin);
  }
  const src = () => panelAusencia();

  it("no dictamina: dice que NO CONSTA, no que no aplique", () => {
    // La diferencia entre «no aplica» y «no consta» es la diferencia entre un
    // dictamen y un estado de conocimiento. Esta consola no tiene el dictamen.
    const s = src();
    expect(/no consta acreditad/i.test(s), "falta la fórmula de ausencia acreditada").toBe(true);
    // Las tres primeras no bastaban: una mutación que dictaminaba con «no
    // alcanza» y «no procede» pasaba el gate entero. Sigue siendo lista negra
    // —vigila formulaciones, no el sentido—; la garantía estructural es que la
    // cabecera diga «no consta», comprobada aparte.
    for (const re of [/\bno (le )?aplica\b/i, /no es exigible/i, /queda excluid/i,
                      /no alcanza/i, /no procede/i, /no resulta de aplicaci/i, /est[áa] exent/i]) {
      expect(re.test(s), `la pestaña dictamina en vez de constatar: ${re}`).toBe(false);
    }
  });

  it("enuncia las DOS condiciones del art. 27, numeradas y cada una con su asunto", () => {
    // Buscar «anexo III» suelto NO vale: aparece también dentro de la segunda
    // condición, así que borrar el encabezado de la primera dejaba el test
    // verde. Se exige la estructura: dos encabezados numerados, y cada uno
    // nombrando su propio asunto.
    const s = src();
    const c1 = s.match(/1 · ([^<]{10,120})/);
    const c2 = s.match(/2 · ([^<]{10,120})/);
    expect(c1, "falta el encabezado de la condición 1").not.toBeNull();
    expect(c2, "falta el encabezado de la condición 2").not.toBeNull();
    expect(c1![1], `la condición 1 no nombra el alto riesgo del anexo III: ${c1![1]}`)
      .toMatch(/alto riesgo.*anexo III/i);
    expect(c2![1], `la condición 2 no nombra al desplegador: ${c2![1]}`)
      .toMatch(/desplegador|categor[íi]as/i);
    // Y las tres alternativas del sujeto, que son las que el artículo enumera.
    expect(/organismo de Derecho p[úu]blico/i.test(s), "falta la categoría de organismo público").toBe(true);
    expect(/servicios p[úu]blicos/i.test(s), "falta la categoría de servicios públicos").toBe(true);
    expect(/punto 5[^<]{0,40}letras b\) y c\)/i.test(s), "falta la remisión al anexo III.5.b-c").toBe(true);
    // La cita a PI-30 se retiró: el panel se renderiza para cualquier tenant y
    // hoy los únicos `ai_systems` de Cloud son de ARGA, así que afirmaba a una
    // aseguradora la política interna de un despacho. Su sitio es una arista
    // leída de la política real del tenant, no un rótulo en el copy.
    expect(/PI-30/.test(s), "el panel vuelve a citar PI-30 sin puerta de tenant").toBe(false);
  });

  it("CADA condición, una por una, consta como NO acreditada", () => {
    // La invariante que importa no es que el texto esté: es que ninguna de las
    // dos condiciones aparezca alguna vez como acreditada mientras la cabecera
    // sigue diciendo que no consta. Se comprueba condición por condición, no
    // sobre el panel entero.
    // El fuente JSX parte las frases en varias líneas con sangría, así que se
    // normaliza el espacio antes de buscar: si no, un salto de línea en mitad
    // de la frase basta para que la invariante no se vea.
    const s = src().replace(/\s+/g, " ");
    // Cada bloque se corta en el cierre de SU div: sin esto el segundo abarca
    // hasta el final del panel y su "no consta" se satisface con cualquier frase
    // del cierre — el gate pasaba con la condición 2 afirmando lo contrario de
    // lo que dice la cabecera.
    const bloques = s.split(/\d · /).slice(1).map((b) => b.split("</div>")[0]);
    expect(bloques.length, "no hay dos bloques de condición").toBe(2);
    const NO_CONSTA = /no consta|no hay[^.]{0,140}acredite|sin acreditar/i;
    const ACREDITADA = /\bconsta acreditad|\bse acredita\b|\bqueda acreditad|\bconcurre/i;
    for (const [i, b] of bloques.entries()) {
      expect(NO_CONSTA.test(b), `la condición ${i + 1} no declara que NO consta`).toBe(true);
      expect(ACREDITADA.test(b), `la condición ${i + 1} aparece como ACREDITADA`).toBe(false);
    }
  });

  it("no afirma haber descartado lo que sólo no consta", () => {
    // El anexo III tiene ocho puntos y no se han cotejado uno a uno contra un
    // inventario que aún no está sembrado.
    const s = src();
    for (const re of [/descartad[oa]/i, /se ha comprobado que no/i]) {
      expect(re.test(s), `afirma un descarte no acreditado: ${re}`).toBe(false);
    }
  });
});
