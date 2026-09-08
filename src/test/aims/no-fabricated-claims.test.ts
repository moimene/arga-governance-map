import { describe, it, expect } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { sinComentarios } from "../helpers/sin-comentarios";

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
// La ficha se descompuso el 2026-09-08 (1387 → 166 líneas de composición). Los
// invariantes de abajo no cambian: apuntan a donde vive hoy cada render. Seguir
// leyendo `DETALLE` los habría dejado verdes SIN MIRAR NADA, que es la forma
// nº7 de gate vacuo — la aserción de ausencia que ya no tiene sujeto.
const CABECERA = "src/components/ai-governance/sistema/CabeceraSistema.tsx";
const TAB_EVALUACIONES = "src/components/ai-governance/sistema/TabEvaluaciones.tsx";
const TAB_VIGILANCIA = "src/components/ai-governance/sistema/TabVigilancia.tsx";
const ESCALADO = "src/components/ai-governance/sistema/EscaladoSecretariaModal.tsx";
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
    //
    // ESTRECHADO, NO RELAJADO (2026-09-07): desde
    // `20260907190000_aims_evidencias_por_medida` hay UNA tabla que sí lo
    // guarda — `aims_evidence_items.content_hash`, medido en Cloud junto con
    // `hash_algorithm` y `hash_computed_in`. Nombrar el hash ahí no es
    // fabricar: es describir una columna que existe. Lo que sigue prohibido es
    // nombrarlo en cualquier otra superficie, y lo que se AÑADE es que donde se
    // nombre haya que decir DÓNDE se calcula: un hash de navegador acredita
    // integridad, no fecha cierta ni identidad, y presentarlo a secas sería la
    // misma sobreafirmación por otra puerta.
    //
    // TRES columnas reales, medidas en Cloud:
    //   `aims_evidence_items.content_hash`             → NAVEGADOR (2026-09-07)
    //   `ai_risk_assessments.content_hash`             → SERVIDOR al congelar (2026-09-07)
    //   `aims_classification_questionnaires.content_hash` → SERVIDOR, lo calcula
    //      la RPC al completar el cuestionario guiado (2026-09-08)
    //
    // Los tres pueden nombrarse, y los tres tienen que decir **dónde se calculan
    // y qué NO acreditan**. Un hash de navegador no prueba autoría; ninguno de
    // los tres prueba fecha cierta, porque no hay sello de tiempo cualificado.
    // Presentarlos a secas sería la misma sobreafirmación que el módulo ya tuvo
    // con los sellos de EAD Trust, por otra puerta.
    //
    // Se asierta sobre el fuente SIN COMENTARIOS: la prosa que explica qué
    // acredita una huella no es la huella pintada en pantalla, en las dos
    // direcciones — ni satisface la exigencia de decir dónde se calcula, ni
    // dispara la prohibición del resto de ficheros.
    const CON_COLUMNA_MEDIDA: Record<string, RegExp> = {
      "src/hooks/useAimsEvidence.ts": /hash_computed_in|calculada? en el navegador|en CLIENTE/i,
      // La custodia del informe se extrajo el 2026-09-08: el hash se pinta ahí.
      "src/components/ai-governance/evaluacion-detalle/CabeceraInforme.tsx":
        /calculada en servidor|EN SERVIDOR/i,
      // Y la clasificación regulatoria vigente, desde la misma descomposición.
      "src/components/ai-governance/sistema/ClasificacionVigentePanel.tsx":
        /SHA-512 de servidor|EN SERVIDOR/i,
      // El historial pinta la misma huella y hasta el 2026-09-08 no decía qué
      // acredita: la columna «Huella» a secas se lee como sello de tiempo.
      "src/components/ai-governance/clasificacion/HistorialClasificaciones.tsx":
        /SHA-512 de servidor|EN SERVIDOR/i,
    };
    for (const f of superficieAims()) {
      const src = sinComentarios(read(f));
      const menciones = src.match(/[^\n]*SHA-?512[^\n]*/gi) ?? [];
      const exigeDonde = CON_COLUMNA_MEDIDA[f];
      if (exigeDonde) {
        expect(menciones.length, `${f} ya no menciona el hash: revisa este invariante`).toBeGreaterThan(0);
        expect(exigeDonde.test(src), `${f}: nombra el hash sin decir dónde se calcula`).toBe(true);
        expect(
          /No acredita fecha cierta|no prueba fecha cierta/i.test(src),
          `${f}: presenta el hash sin decir lo que NO acredita`,
        ).toBe(true);
        continue;
      }
      // En el resto se permite nombrarlo sólo para NEGARLO.
      for (const m of menciones) {
        expect(
          /\bsin hash\b|no lleva hash|no calcula|no tienen? columna/i.test(m),
          `${f}: afirma un hash que su tabla no guarda → ${m.trim()}`,
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
    // El historial de autodiagnósticos se extrajo el 2026-09-08: la nota se
    // pinta en su pestaña, y la ficha sólo la compone.
    const src = sinComentarios(read(TAB_EVALUACIONES));
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
  it("el cierre del expediente no se ofrece en ninguna superficie", () => {
    // INVERTIDO (2026-09-08, D-1 del ledger de refactor). Antes se exigía que
    // el botón existiera deshabilitado y explicara su bloqueo; el botón y su
    // hook se RETIRARON, así que la aserción anterior no tenía sujeto y habría
    // pasado midiendo el vacío. El invariante que queda es de ausencia: la
    // capacidad no se ofrece, ni habilitada ni con un rótulo muerto.
    //
    // `fn_aims_close_technical_file` inserta `status='SEALED'` en
    // `evidence_bundles`, y el guard de Secretaría sólo admite evidencia OPEN
    // sin firmar desde un caller autenticado: falla SIEMPRE con 42501 (probado
    // con ROLLBACK el 2026-08-29). La RPC y el hook los vigila
    // `src/test/aims/frontera-backbone.test.ts`; aquí se vigila el RÓTULO, que
    // es lo que el usuario ve y lo que un refactor puede reintroducir suelto.
    const ficheros = superficieAims();
    // Control positivo: el barrido tiene que ver una superficie de verdad, o
    // «no aparece en ningún sitio» pasaría a significar «no he mirado».
    expect(ficheros.length, "el barrido se ha quedado corto: la ausencia sería vacua")
      .toBeGreaterThanOrEqual(30);
    for (const f of ficheros) {
      const src = sinComentarios(read(f));
      for (const re of [/useCloseAimsTechnicalFile/, /fn_aims_close_technical_file/,
                        /Cerrar\s+expediente/i, /Sellar\s+expediente/i]) {
        expect(re.test(src), `${f}: vuelve a ofrecerse el cierre del expediente → ${re}`).toBe(false);
      }
    }
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

// RENOMBRADO (2026-09-07, gate vacuo nº11): se llamaba «contrato de columnas
// real» y no consulta Cloud ni una vez — compara contra la lista congelada de
// abajo. Eso caza la REINTRODUCCIÓN de un fantasma conocido, que es útil y
// barato, pero no el defecto de 1028: un fantasma NUEVO en un hook nuevo. Ese
// lo cubre `src/test/aims/aims-column-contract.test.ts`, que pregunta a Cloud
// por cada columna declarada (PostgREST responde 42703 antes de aplicar RLS).
// Comprobado por mutación: declarar `qtsp_custody_ref` en un tipo del hook deja
// este fichero en verde y pone el otro en rojo.
describe("A3 — los 19 fantasmas conocidos no vuelven (lista congelada, no cotejo)", () => {
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

  it("ninguna superficie pinta columnas inexistentes", () => {
    // AMPLIADO (2026-09-08) de la ficha a toda la superficie: tras la
    // descomposición, `SistemaDetalle.tsx` son 166 líneas de composición y no
    // pinta ni una columna, así que leerla sola pasaba por vacuidad — el
    // fantasma se habría mudado a cualquiera de los nueve bloques nuevos sin
    // que este gate se enterase.
    const ficheros = superficieAims();
    expect(ficheros.length, "el barrido se ha quedado corto: la ausencia sería vacua")
      .toBeGreaterThanOrEqual(30);
    for (const f of ficheros) {
      const src = read(f);
      const vivas = FANTASMAS.filter((c) => new RegExp(`\\b${c}\\b`).test(src));
      expect(vivas, `${f}: columnas fantasma pintadas: ${vivas.join(", ")}`).toEqual([]);
    }
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

describe("2026-09-08 — la FRIA se retiró (destino b): no queda ni pestaña ni hook, y el art. 27 sólo aparece como marco derivado", () => {
  // SUSTITUYE a cuatro bloques (A4 «la pestaña FRIA lee el expediente real»,
  // «FRIA — ausencia acreditada», «el órgano de la FRIA es una ARISTA» y «la
  // cabecera de la FRIA no generaliza el alcance del art. 27»). Todos medían
  // una pestaña y un hook que se RETIRARON el 2026-09-08 por D-1 del ledger
  // `docs/superpowers/plans/2026-09-08-ledger-refactor-aims.md`: sus tablas no
  // tenían un solo camino de escritura y estaban vacías en los dos tenants.
  // Sin sujeto, aquellas aserciones medían el vacío. El invariante que queda es
  // de AUSENCIA, y una excepción acotada para lo único que sobrevive: la nota
  // que acota el art. 27 al 27.1, que hoy es un marco derivado del cuestionario
  // guiado y no una pestaña. Las tablas y la RPC las vigila
  // `src/test/aims/frontera-backbone.test.ts`; aquí, el RÓTULO y el ALCANCE.

  // Los dos únicos sitios donde el art. 27 puede nombrarse: la hoja que declara
  // el marco derivado, y el panel que lo pinta.
  const EXCEPCION_ART_27 = [
    "src/lib/aims/cuestionario-calificacion.ts",
    "src/components/ai-governance/sistema/ClasificacionVigentePanel.tsx",
  ];

  it("el hook de la FRIA no existe", () => {
    expect(existsSync("src/hooks/useAimsFria.ts"), "vuelve el hook de la FRIA").toBe(false);
  });

  it("ninguna superficie la nombra, ni como tabla ni como rótulo de pestaña", () => {
    const ficheros = superficieAims();
    // Control positivo del barrido: sin él, «no aparece» sería «no he mirado».
    expect(ficheros.length, "el barrido se ha quedado corto: la ausencia sería vacua")
      .toBeGreaterThanOrEqual(30);
    for (const f of ficheros) {
      const src = sinComentarios(read(f));
      // NO se prohíbe «derechos fundamentales» a secas: es el nombre de la
      // obligación que el art. 27 crea y que el catálogo ISO describe en dos
      // medidas. Prohibirlo obligaría al producto a dejar de nombrar una
      // obligación real, que es lo contrario de lo que vigila este fichero. Lo
      // retirado son las TABLAS y la PESTAÑA, y eso es lo que se prohíbe.
      for (const re of [/aims_fria_/, /\bFRIA\b/]) {
        expect(re.test(src), `${f}: vuelve la FRIA a la superficie → ${re}`).toBe(false);
      }
      // Y el art. 27 sólo donde va su nota. En cualquier otro sitio sería la
      // generalización que la cabecera de la pestaña ya hizo una vez:
      // presentarlo como obligación de todo sistema de alto riesgo, cuando el
      // 27.1 exige además una condición sobre el desplegador.
      if (EXCEPCION_ART_27.includes(f)) continue;
      const art27 = src.match(/[Aa]rt[íi]?c?u?l?o?\.?\s*27\b/);
      expect(art27, `${f}: el art. 27 vuelve fuera de su marco derivado → ${art27?.[0]}`).toBeNull();
    }
  });

  it("control positivo: la nota del 27.1 sigue existiendo y el panel la pinta", () => {
    // Las dos aserciones de arriba son de ausencia. Si la nota desapareciera
    // del catálogo, o el panel dejara de pintar los marcos derivados, pasarían
    // por vacuidad y el art. 27 se habría perdido en silencio.
    const hoja = read("src/lib/aims/cuestionario-calificacion.ts");
    expect(/27\.1/.test(hoja), "la hoja ya no acota el art. 27 a su apartado 1").toBe(true);
    expect(/organismos de Derecho p[úu]blico/i.test(hoja),
      "la nota del 27.1 pierde la condición sobre el desplegador").toBe(true);
    const panel = sinComentarios(read("src/components/ai-governance/sistema/ClasificacionVigentePanel.tsx"));
    expect(/applicable_frameworks/.test(panel), "el panel ya no lee los marcos derivados").toBe(true);
    expect(/m\.nota/.test(panel), "el panel pinta el marco sin su nota: el alcance se pierde").toBe(true);
  });
});

describe("A2 — el formulario no preselecciona un nivel que nadie ha elegido", () => {
  const EVAL_NUEVA = "src/pages/ai-governance/EvaluacionNueva.tsx";
  // El wizard se descompuso el 2026-09-08: el desplegable de madurez y el
  // estado vacío de una medida viven en su componente de controles.
  const CONTROLES = "src/components/ai-governance/evaluacion/ControlesDeMedida.tsx";

  it("ninguna medida arranca con un nivel de madurez por defecto", () => {
    // Cazado en verificación viva: el desplegable mostraba L5 en toda medida
    // sin contestar, y `updateEvaluation` creaba la entrada con `maturity:"L5"`
    // si el usuario tocaba SÓLO la dificultad — la medida quedaba contestada
    // con un nivel que nadie eligió. Es el gemelo del pre-relleno retirado.
    // El defecto se busca en TODO el wizard, no en el fichero donde hoy está
    // el estado vacío: el mapa de evaluaciones lo compone la página, el estado
    // inicial vive en un módulo hoja y los cuatro pasos pueden escribirlo. Un
    // `maturity: "L5"` en cualquiera de ellos reintroduce el defecto entero, y
    // fijar un fichero concreto lo perdería en cuanto se mueva otra vez.
    const src =
      readdirSync("src/components/ai-governance/evaluacion")
        .filter((f) => /\.tsx?$/.test(f))
        .map((f) => read(`src/components/ai-governance/evaluacion/${f}`))
        .join("\n") + read(EVAL_NUEVA);
    expect(/maturity:\s*"L[0-9]"/.test(src),
      "hay un nivel de madurez por defecto en el formulario").toBe(false);
    // Control positivo del barrido: si el directorio dejara de tener el estado
    // de una medida, la ausencia de arriba no significaría nada.
    expect(/maturity:\s*""/.test(src),
      "el wizard ya no declara el estado vacío de una medida: la ausencia sería vacua").toBe(true);
    expect(/<option value="">Sin evaluar<\/option>/.test(read(CONTROLES)),
      "el selector no ofrece la opción explícita de sin evaluar").toBe(true);
  });

  it("no quedan pre-rellenos del catálogo", () => {
    const src = read(EVAL_NUEVA);
    expect(/prefill/i.test(src), "sigue habiendo un pre-relleno").toBe(false);
  });
});

describe("A6 — ninguna acción afirma un efecto que no produce", () => {
  const INCIDENTE = "src/pages/ai-governance/IncidenteDetalle.tsx";
  // La ficha se descompuso el 2026-09-08: el panel de regímenes y sus dos
  // escrituras viven en su componente. Los invariantes siguen siendo los
  // mismos, pero apuntan a donde está el código: leer la página tras el
  // traslado los habría dejado verdes sin mirar nada.
  const SUBEXPEDIENTES = "src/components/ai-governance/incidente/SubexpedientesRegimen.tsx";
  const SUPERFICIE_INCIDENTE = [
    INCIDENTE,
    SUBEXPEDIENTES,
    "src/components/ai-governance/incidente/CabeceraIncidente.tsx",
    "src/components/ai-governance/incidente/RelojesRegulatorios.tsx",
    "src/components/ai-governance/incidente/EdicionIncidente.tsx",
  ];

  it("el cierre de subexpediente escribe ANTES de anunciar el éxito", () => {
    // Antes era un `try` VACÍO que lanzaba
    // `toast.success("… notificado y archivado con acuse")` sin tocar nada.
    // Ni siquiera había un 42501 que lo delatara: el toast salía igual.
    //
    // No basta con que ambos aparezcan: mover el toast ANTES del await lo
    // dejaba verde afirmando el éxito antes de conocer el resultado. Se
    // comprueba el ORDEN.
    const src = read(SUBEXPEDIENTES);
    const fn = src.slice(src.indexOf("handleCloseRegimeSubcase = async"));
    const cuerpo = fn.slice(0, fn.indexOf("\n  };"));
    const iEscritura = cuerpo.search(/await\s+\w*[Mm]utation\.mutateAsync/);
    const iToast = cuerpo.indexOf("toast.success");
    expect(iEscritura, "el cierre no espera a ninguna escritura").toBeGreaterThan(-1);
    expect(iToast, "el cierre no informa del resultado").toBeGreaterThan(-1);
    expect(iToast, "anuncia el éxito antes de escribir").toBeGreaterThan(iEscritura);
  });

  it("no se promete notificación a la autoridad ni acuse de recibo", () => {
    for (const f of SUPERFICIE_INCIDENTE) {
      const src = read(f);
      expect(/notificado y archivado con acuse/i.test(src), `${f} promete acuse de recibo`).toBe(false);
      expect(/Sellar Acuse/i.test(src), `${f} promete sellar un acuse`).toBe(false);
    }
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
    for (const f of SUPERFICIE_INCIDENTE) {
      expect(/SHA-?512/i.test(read(f)),
        `${f} afirma un hash que no existe`).toBe(false);
    }
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


// ─────────────────────────────────────────────────────────────────────────────
// Cierre 2026-09-06 — lo que se corrigió sin nada que lo sujetara.
//
// Cuatro retiradas y una arista quedaron aplicadas en el árbol sin un solo test
// detrás. Un cambio sin guard dura hasta el próximo refactor, y el sesgo del
// producto ya está catalogado: el hueco se rellena con la lectura optimista.
// ─────────────────────────────────────────────────────────────────────────────

/** Fuente sin comentarios NI líneas de import: lo que la pantalla dice. */
function textoDe(f: string): string {
  return sinComentarios(read(f)).replace(/^\s*import[\s\S]*?;\s*$/gm, " ");
}

const ALTA_EVAL = "src/pages/ai-governance/EvaluacionNueva.tsx";

describe("2026-09-06 — el alta de la evaluación no atribuye el método a una guía", () => {
  it("ninguna de sus superficies de texto nombra una guía numerada de la Agencia", () => {
    const t = textoDe(ALTA_EVAL);
    // La fuente de un requisito del Reglamento es el ARTÍCULO. Una guía de la
    // Agencia es material de apoyo no vinculante, y esta atribución concreta
    // nunca se cotejó contra publicación oficial — mientras que su hermana, la
    // atribución POR REQUISITO, resultó equivocada en diez de doce.
    for (const patron of [
      /Gu[íi]as?\s+\d+/i,
      /Gu[íi]as?\s+T[ée]cnicas/i,
      /Regla\s+Gu[íi]a/i,
      /Medidas\s+Gu[íi]a/i,
      /Autodiagn[óo]stico\s+AESIA/i,
    ]) {
      expect(patron.test(t), `${ALTA_EVAL}: vuelve la atribución → ${patron}`).toBe(false);
    }
  });

  it("la nota que se PERSISTE tampoco la lleva", () => {
    // Ésta es la peor de las siete: no se queda en pantalla, se escribe en
    // `ai_risk_assessments.notes` y sobrevive a cualquier corrección de copy.
    const t = textoDe(ALTA_EVAL);
    const nota = t.match(/`Autodiagn[óo]stico[^`]*`/);
    expect(nota, "desaparece la nota por defecto del autodiagnóstico").not.toBeNull();
    expect(/Gu[íi]a/i.test(nota![0]), `la nota persistida atribuye una guía: ${nota![0]}`).toBe(false);
  });

  it("y lo que SÍ se cita sigue en pie: el Reglamento y su catálogo", () => {
    // Control positivo. Sin esto, vaciar la pantalla satisfaría las dos
    // aserciones de arriba y «no atribuye» pasaría a significar «no dice nada».
    const t = textoDe(ALTA_EVAL);
    expect(/2024\/1689/.test(t), "se ha perdido la cita del Reglamento").toBe(true);
    expect(/ISO\/IEC 42001/.test(t), "se ha perdido el marco ISO").toBe(true);
    // El catálogo se sigue consumiendo: lo que se retiró es la procedencia, no
    // los 12 requisitos ni las 84 medidas.
    // El catálogo se consume por la función que lo resuelve, no por un import
    // muerto que sólo existía para satisfacer este gate (revisión 2026-09-08).
    expect(read(ALTA_EVAL)).toContain("getRequirementsForFramework(");
  });
});

describe("2026-09-06 — un solo vocabulario para el estado de un sistema", () => {
  it("un estado fuera del vocabulario va NEUTRO, no en aviso", async () => {
    // `ai_systems.status` no tiene CHECK y en Cloud conviven cinco grafías. La
    // ficha comparaba contra 'ACTIVO' con su propia lista de dos entradas, así
    // que pintaba de ÁMBAR un sistema 'Conforme' sólo por no estar en ella.
    const { systemStatusChipClass, systemStatusLabel } = await import("@/lib/aims/readiness");

    const neutro = systemStatusChipClass("Conforme");
    expect(/status-warning|status-error/.test(neutro), "un estado desconocido se pinta como alarma")
      .toBe(false);
    expect(/status-success/.test(neutro), "un estado desconocido se pinta como bueno").toBe(false);
    // Control discriminante: los conocidos SÍ reciben su color, o el neutro
    // sería un «todo gris» que tampoco informa.
    expect(/status-success/.test(systemStatusChipClass("ACTIVO"))).toBe(true);
    expect(/status-warning/.test(systemStatusChipClass("EN_EVALUACION"))).toBe(true);

    // Y la etiqueta: sin traducción conocida se pinta el literal de la base.
    expect(systemStatusLabel("Conforme")).toBe("Conforme");
    expect(systemStatusLabel("EN_EVALUACION")).toBe("En evaluación");
    expect(systemStatusLabel(null)).toBe("Sin estado");
  });

  it("ninguna pantalla se monta su propio mapa de estados", () => {
    // Dos vocabularios divergen: es literalmente lo que pasó. El mapa vive en
    // el módulo HOJA `vocabulario.ts`, junto a `normalizeAimsStatus`, que
    // existe por esto mismo; `readiness.ts` lo re-exporta.
    for (const f of superficieAims()) {
      if (f === "src/lib/aims/vocabulario.ts" || f === "src/lib/aims/readiness.ts") continue;
      const src = sinComentarios(read(f));
      // Se busca la CLAVE de un mapa (`EN_EVALUACION:` al principio de línea),
      // no el nombre de la constante: `Incidentes.tsx` tiene su propio
      // `STATUS_CHIP` para ABIERTO/CERRADO, que es otro vocabulario y está
      // bien. Y no se prohíbe el valor —`value: "EN_EVALUACION"` en un
      // `<option>` o en un filtro es un camino de escritura legítimo—.
      expect(
        /^\s*EN_EVALUACION\s*:/m.test(src),
        `${f}: vuelve a declarar un mapa del estado de un sistema`,
      ).toBe(false);
      expect(
        /\bsystem\.status\s*===|\bsys\.status\s*===/.test(src),
        `${f}: compara el estado del sistema a mano en vez de usar el predicado`,
      ).toBe(false);
    }
  });
});

describe("2026-09-06 — conformidad y severidad, un predicado cada una", () => {
  it("ninguna pantalla compara la conformidad con un literal", () => {
    // `assessmentAcreditaConformidad` acepta el vocabulario que se ESCRIBE y el
    // legado. Comparar a mano contra "CONFORME" deja fuera las filas antiguas
    // en 'APROBADO' — que es la mitad del inventario de ARGA.
    for (const f of superficieAims()) {
      if (f === "src/lib/aims/readiness.ts") continue;
      const src = sinComentarios(read(f));
      for (const m of src.match(/status\s*===\s*"(CONFORME|APROBADO)"/g) ?? []) {
        expect(false, `${f}: conformidad comparada a mano → ${m}`).toBe(true);
      }
    }
  });

  it("ninguna pantalla compara la severidad con grafías que nadie escribe", () => {
    // 'CRITICA'/'ALTA' no las produce ningún camino de escritura: el alta y la
    // lista escriben 'CRITICO'/'ALTO'. El chip nunca se encendía.
    for (const f of superficieAims()) {
      const src = sinComentarios(read(f));
      for (const m of src.match(/[Ss]everity\s*===\s*"(CRITICA|ALTA)"/g) ?? []) {
        expect(false, `${f}: severidad comparada con una grafía inexistente → ${m}`).toBe(true);
      }
    }
  });

  it("los dos predicados discriminan de verdad", async () => {
    // Control positivo de los predicados en sí: uno que devolviera siempre
    // `true` satisfaría cualquier pantalla que lo llamara.
    const { assessmentAcreditaConformidad, isMaterialSeverity } = await import("@/lib/aims/readiness");
    expect(assessmentAcreditaConformidad("CONFORME")).toBe(true);
    expect(assessmentAcreditaConformidad("APROBADO")).toBe(true);
    expect(assessmentAcreditaConformidad("CON_GAPS")).toBe(false);
    expect(assessmentAcreditaConformidad(null)).toBe(false);

    // Las grafías que el producto escribe de verdad.
    expect(isMaterialSeverity("CRITICO")).toBe(true);
    expect(isMaterialSeverity("ALTO")).toBe(true);
    expect(isMaterialSeverity("MEDIO")).toBe(false);
    expect(isMaterialSeverity(null)).toBe(false);
  });
});


/**
 * 2026-09-06 — La misma familia, once veces: un NULL o un estado que no se sabe
 * leer se rellena con un hecho.
 *
 * Todas las aserciones de este bloque se hacen sobre el fuente SIN COMENTARIOS.
 * Cada corrección de abajo dejó escrito el motivo, y el motivo cita por fuerza
 * la frase retirada: sin esto el gate se dispara contra su propia justificación
 * y la salida fácil pasa a ser borrar la explicación.
 */
describe("2026-09-06 — la ausencia de dato se dice, no se rellena", () => {
  const INCIDENTE = "src/pages/ai-governance/IncidenteDetalle.tsx";
  const SISTEMAS = "src/pages/ai-governance/Sistemas.tsx";
  const DASHBOARD = "src/pages/ai-governance/Dashboard.tsx";
  const EVAL_DETALLE = "src/pages/ai-governance/EvaluacionDetalle.tsx";

  it("una fecha de despliegue ausente no se convierte en un estado del sistema", () => {
    // `deployment_date` es nullable y el alta la deja pasar vacía. La ficha
    // rellenaba el hueco con «En validación», que no es la ausencia de una
    // fecha: es una fase del ciclo de vida que nadie ha declarado.
    // La metadata de la ficha se extrajo a la cabecera el 2026-09-08.
    const src = sinComentarios(read(CABECERA));
    const m = src.match(/deployment_date[\s\S]{0,220}?\}/);
    expect(m, "la ficha ya no pinta la fecha de despliegue").not.toBeNull();
    expect(
      /En validaci[óo]n/.test(m![0]),
      `la fecha de despliegue ausente vuelve a fabricar un estado → ${m![0].trim()}`,
    ).toBe(false);
    expect(
      /Sin fecha de despliegue registrada/.test(m![0]),
      "el hueco de fecha de despliegue no dice que no consta",
    ).toBe(true);
  });

  it("un indicador de vigilancia con estado desconocido no se pinta como aviso", () => {
    // La columna tiene DEFAULT 'OK' y el único indicador de Cloud está en 'OK'
    // (medido 2026-09-06); la ficha comparaba con 'OPTIMAL', un literal que
    // nadie escribe, y lo mandaba todo a ámbar. Lo desconocido va a NEUTRO.
    // La pestaña de vigilancia se extrajo el 2026-09-08 y el mapa se renombró
    // (`INDICATOR_STATUS_CHIP` → `CHIP_INDICADOR`, `SECTION_STATUS_CHIP_NEUTRO`
    // → `CHIP_NEUTRO`): el invariante no cambia, sólo dónde se mide.
    const src = sinComentarios(read(TAB_VIGILANCIA));
    expect(
      /ind\.status\s*===\s*"OPTIMAL"/.test(src),
      "vuelve la igualdad estricta que pinta de aviso cualquier estado no previsto",
    ).toBe(false);
    expect(src).toContain("CHIP_INDICADOR");
    // …y el mapa reconoce lo que el producto escribe de verdad.
    const mapa = src.slice(src.indexOf("const CHIP_INDICADOR"));
    const cuerpo = mapa.slice(0, mapa.indexOf("};"));
    expect(/\bOK:/.test(cuerpo), "el estado 'OK', que es el DEFAULT de la columna, no se reconoce").toBe(true);
    // El fallback es el chip neutro, no el de aviso ni el de éxito.
    const uso = src.slice(src.indexOf("CHIP_INDICADOR[normalizeAimsStatus(ind.status)]"));
    expect(/\?\?\s*CHIP_NEUTRO/.test(uso.slice(0, 160)),
      "el estado desconocido de un indicador ya no cae al chip neutro").toBe(true);
    // Control positivo del propio chip neutro: mapearlo a un color de éxito o
    // de aviso lo devolvería al defecto por la puerta de al lado.
    const neutro = src.slice(src.indexOf("const CHIP_NEUTRO"), src.indexOf("const CHIP_NEUTRO") + 220);
    expect(/status-(success|warning|error)/.test(neutro),
      "el chip neutro se pinta con un color que afirma algo").toBe(false);
  });

  it("la distribución por nivel de riesgo suma el inventario entero", () => {
    // Tres filas contando tres literales dejaban fuera a los sistemas sin
    // `risk_level`: una «distribución» que no sumaba el total, y un sistema sin
    // clasificar que desaparecía en vez de figurar como hueco.
    const src = sinComentarios(read(DASHBOARD));
    const i = src.indexOf("Distribución por nivel de riesgo");
    expect(i, "no se encuentra la distribución por nivel de riesgo").toBeGreaterThan(0);
    const bloque = src.slice(i, i + 1800);
    expect(/label: "Sin clasificar"/.test(bloque),
      "la distribución vuelve a esconder los sistemas sin nivel de riesgo declarado").toBe(true);
    expect(/systems\.length - sistemasClasificados/.test(bloque),
      "«Sin clasificar» no se deriva del inventario: es un número suelto").toBe(true);
  });

  it("el inventario no afirma su estado cuando no hay inventario", () => {
    // Con 0 sistemas la tarjeta decía «Demo AIMS conectada» y pintaba 0/0 y un
    // 0 en rojo: tres ceros que se leen como medición. Mismo gate que
    // Incidentes.tsx, que ya lo hacía bien.
    const src = sinComentarios(read(SISTEMAS));
    const i = src.indexOf('aria-label="Estado del inventario AIMS"');
    expect(i, "ha desaparecido la tarjeta de estado del inventario").toBeGreaterThan(0);
    const antes = src.slice(Math.max(0, i - 500), i);
    expect(/systems\.length > 0 &&/.test(antes),
      "la tarjeta de estado del inventario vuelve a pintarse sin inventario").toBe(true);
  });

  it("el plazo del art. 73 dice que su tipología no se guarda", () => {
    // El vencimiento se calcula desde estado de UI que se pierde al recargar.
    // El control de edición ya lo advertía; en modo lectura no lo decía nadie.
    // Los relojes viven en su componente desde la descomposición del
    // 2026-09-08. Se leen los dos: si el panel volviera a la página, el
    // invariante lo seguiría encontrando; si desapareciera, cae.
    const src = sinComentarios(
      read(INCIDENTE) + read("src/components/ai-governance/incidente/RelojesRegulatorios.tsx"),
    );
    const i = src.indexOf("formatDeadline(clocks.ria?.deadlineDate)");
    expect(i, "el reloj del art. 73 ya no pinta vencimiento").toBeGreaterThan(0);
    const ventana = src.slice(i, i + 700);
    expect(/no registrada/.test(ventana),
      "el vencimiento del art. 73 se presenta sin decir que su tipología no consta").toBe(true);
    expect(/grave ordinario/i.test(ventana),
      "no se dice qué tipología se está asumiendo para calcular el plazo").toBe(true);
  });

  it("los regímenes distinguen el catálogo de lo registrado, y la apertura se motiva", () => {
    // POSTURA ANTERIOR (2026-09-06): `aims_incident_regimes` no tenía un solo
    // camino de escritura, así que el panel tenía que decir que la apertura no
    // se podía hacer desde aquí. Desde el 2026-09-08 SÍ existe el camino, y ese
    // aviso pasaría a ser falso: el invariante que queda no es «no se puede
    // abrir» sino «lo de referencia no se hace pasar por registrado, y abrir
    // exige motivar por qué el régimen alcanza al caso».
    const src = sinComentarios(
      read("src/components/ai-governance/incidente/SubexpedientesRegimen.tsx"),
    );
    expect(/Subexpedientes Regulatorios/.test(src),
      "el panel vuelve a titularse como registro de subexpedientes").toBe(false);
    expect(/Regímenes potencialmente aplicables/.test(src),
      "el panel no dice que es un catálogo de regímenes, no un registro").toBe(true);
    // Y el dato de la fila manda sobre el del catálogo cuando existe.
    expect(/fila\?\.target_authority \?\? reg\.authority/.test(src),
      "la autoridad se pinta del catálogo aunque haya subexpediente registrado").toBe(true);
    expect(/fila\?\.lead_role \?\? reg\.role/.test(src),
      "el responsable se pinta del catálogo aunque haya subexpediente registrado").toBe(true);
    expect(/Valor de referencia, no registrado/.test(src),
      "un régimen sin fila deja de decir que su valor es de referencia").toBe(true);
    // La apertura no es un botón suelto: registra una afirmación motivada.
    expect(/Motivación de aplicabilidad/.test(src),
      "se abre subexpediente sin pedir por qué el régimen alcanza al caso").toBe(true);
    expect(/MOTIVACION_MINIMA/.test(src),
      "la motivación no tiene mínimo exigido").toBe(true);
  });

  it("el escalado a Risk 360 usa el contrato que Risk 360 lee", () => {
    // `origen=aims&assessment_id=` no lo lee nadie: Risk360 pinta la entrada
    // desde AIMS con `source` + `handoff`. El enlace llegaba mudo.
    const risk360 = sinComentarios(read("src/pages/grc/Risk360.tsx"));
    expect(/params\.get\("source"\)/.test(risk360), "Risk 360 ya no lee `source`").toBe(true);
    expect(/params\.get\("handoff"\)/.test(risk360), "Risk 360 ya no lee `handoff`").toBe(true);
    for (const f of superficieAims()) {
      const src = sinComentarios(read(f));
      for (const m of src.match(/risk-360\?[^`"']*/g) ?? []) {
        expect(
          /source=aims/.test(m) && /handoff=/.test(m),
          `${f}: enlace a Risk 360 con un contrato que la pantalla destino no lee → ${m}`,
        ).toBe(true);
      }
    }
  });

  it("no se atribuye a la AESIA un corpus de guías numerado y cotejado", () => {
    // El documento que el usuario DESCARGA enumeraba «AESIA Guías 1 a 16» entre
    // sus marcos normativos de referencia, sin cotejo. El gate anterior sólo
    // vigilaba la forma «Guía N AESIA», y ésta se le escapaba.
    for (const f of superficieAims()) {
      const src = sinComentarios(read(f));
      const hit = src.match(/Gu[íi]as?\s+\d+\s*(?:a|-|–)\s*\d+/i);
      expect(hit, `${f}: vuelve el rango numerado de guías AESIA → ${hit?.[0]}`).toBeNull();
      expect(/directrices AESIA/i.test(src),
        `${f}: vuelve a declararse conformidad «y directrices AESIA» sin cotejo`).toBe(false);
    }
  });


  // RETIRADO (2026-09-08, D-1 del ledger de refactor): «el cierre del
  // expediente no ofrece sello ni firmante» exigía que el hook de cierre
  // EXISTIERA sin mandar token ni firmante, y ese hook se retiró entero. Sin
  // sujeto la aserción medía el vacío. Lo cubre ahora, como ausencia sobre toda
  // la superficie, «el cierre del expediente no se ofrece en ninguna
  // superficie», arriba; y la RPC, `frontera-backbone.test.ts`.

  it("no queda declarado un hook de mutación que nadie usa", () => {
    // Un `useXxxMutation()` colgado en el cuerpo del componente hace creer que
    // la pantalla escribe. Ninguna de estas dos lo hacía.
    const detalle = sinComentarios(read(DETALLE));
    expect(/useUpdateTechnicalFileSection/.test(detalle),
      "vuelve la mutación de secciones declarada y nunca invocada").toBe(false);
    for (const f of superficieAims()) {
      expect(/useCreateIncidentReport/.test(sinComentarios(read(f))),
        `${f}: vuelve el informe «con acuse» que ningún camino envía`).toBe(false);
    }
  });

  it("el enlace de escalado sigue existiendo (control positivo)", () => {
    // Las dos aserciones de arriba sobre Risk 360 son de ausencia dentro de un
    // bucle: si el enlace desapareciera, pasarían por vacuidad.
    // La cabecera del informe se extrajo el 2026-09-08: el enlace vive ahí.
    const src = sinComentarios(
      read(EVAL_DETALLE) + read("src/components/ai-governance/evaluacion-detalle/CabeceraInforme.tsx"),
    );
    expect(/risk-360\?source=aims/.test(src), "ha desaparecido el escalado a Risk 360").toBe(true);
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// 2026-09-07 — n=1008: el WRITE PATH del escalado.
//
// El selector de órgano se corrigió, pero el prerrelleno de la justificación
// seguía redactando en nombre del oficial —«Se solicita al Consejo evaluar la
// conformidad … bajo el marco RIA / AESIA»— y ese texto VIAJA al intake de
// Secretaría como `rationale` del handoff. AESIA es la autoridad de vigilancia
// de mercado, no un marco normativo; el marco es el Reglamento.
describe("2026-09-07 — el escalado no redacta la justificación por el oficial", () => {
  it("ninguna superficie AIMS encuadra una propuesta en un «marco AESIA»", () => {
    for (const f of superficieAims()) {
      const src = sinComentarios(read(f));
      expect(
        /marco\s+RIA\s*\/\s*AESIA|marco\s+AESIA/i.test(src),
        `${f}: vuelve a presentarse AESIA como marco normativo`,
      ).toBe(false);
    }
  });

  it("el prerrelleno del escalado no inventa ni justificación ni órgano", () => {
    // El modal se extrajo el 2026-09-08 y con él su estado: el abridor de la
    // ficha ya no existe, así que leerla habría dejado el invariante sin
    // sujeto. Ahora el estado NACE en el propio modal, que es donde se mide.
    const src = sinComentarios(read(ESCALADO));
    expect(
      /useState\(\s*""\s*\)/.test(src),
      "el escalado vuelve a prerrellenar la justificación que viaja al expediente",
    ).toBe(true);
    expect(
      /bodies\[0\]/.test(src),
      "vuelve el órgano preseleccionado por posición: nadie lo ha elegido",
    ).toBe(false);
    // Ni la justificación ni el órgano nacen con valor: las dos entradas del
    // handoff que el usuario tiene que escribir arrancan vacías.
    for (const campo of ["justificacion", "organo"]) {
      const m = src.match(new RegExp(`\\[${campo},\\s*set\\w+\\]\\s*=\\s*useState\\(([^)]*)\\)`, "i"));
      expect(m, `ha desaparecido el estado de ${campo} en el modal de escalado`).not.toBeNull();
      expect(m![1].trim(), `${campo} nace con un valor que nadie ha elegido → ${m![1]}`).toBe('""');
    }
    // Control positivo: los dos campos siguen existiendo y siguen viajando. Si
    // el handoff dejara de llevarlos, las aserciones de arriba pasarían por
    // vacuidad y el escalado se habría quedado mudo sin que nadie lo viera.
    expect(/rationale:\s*justificacion/.test(src),
      "el escalado ya no manda la justificación: este bloque no vigila nada").toBe(true);
    expect(/organ:\s*organo/.test(src),
      "el escalado ya no manda el órgano destino").toBe(true);
    expect(/buildMeetingHandoffPath/.test(src),
      "el escalado ya no construye el handoff de Secretaría").toBe(true);
  });
});
