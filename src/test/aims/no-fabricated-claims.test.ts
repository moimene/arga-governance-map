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
    const src = read(DETALLE);
    expect(/Precintad|WORM Sealing|Precintar Expediente/i.test(src),
      "sigue diciendo 'precintado/sellado' donde solo hay un registro interno").toBe(false);
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
    const { LOGIN_BRANDS } = await import("@/lib/login-brands");
    const garrigues = LOGIN_BRANDS.garrigues;
    expect(garrigues, "no existe la marca de Garrigues").toBeDefined();
    const texto = JSON.stringify(garrigues);
    expect(/DORA/i.test(texto), `el acceso de Garrigues sigue anunciando DORA: ${texto}`).toBe(false);
    // Control discriminante: ARGA es la aseguradora, y a ella DORA sí le
    // alcanza. Si el gate estuviera mirando el tenant equivocado, esto lo
    // delataría en vez de taparlo.
    expect(LOGIN_BRANDS.arga, "no existe la marca de ARGA").toBeDefined();
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
    for (const re of [/\bno (le )?aplica\b/i, /no es exigible/i, /queda excluid/i]) {
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
    expect(/PI-30/.test(s), "no cita la fuente interna que sostiene lo que sí consta").toBe(true);
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
    const bloques = s.split(/\d · /).slice(1);
    expect(bloques.length, "no hay dos bloques de condición").toBe(2);
    const NO_CONSTA = /no consta|no hay[^.]{0,140}acredite|sin acreditar/i;
    const ACREDITADA = /\bconsta acreditad|\bse acredita\b|\bqueda acreditad|\bs[íi] concurre/i;
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
