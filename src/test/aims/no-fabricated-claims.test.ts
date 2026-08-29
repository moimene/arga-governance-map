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
    expect(/no tiene evaluaci[óo]n de impacto/i.test(src()),
      "falta el estado vacío honesto cuando no hay FRIA").toBe(true);
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
