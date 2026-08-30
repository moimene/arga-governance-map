/**
 * Orden del día real de la Junta General de Socios de J&A Garrigues, S.L.P.
 * celebrada el 6 de mayo de 2026. **Única fuente de verdad del expediente C1:**
 * lo consumen el seed de la convocatoria (Task 4) y la materialización de los
 * acuerdos (Task 6), que enlaza cada acuerdo con su punto por `numero`.
 *
 * Puro: sin red, sin Supabase, sin `fs`. Corre en cualquier entorno limpio.
 *
 * ## Procedencia
 *
 * Tabla vinculante «Los 12 puntos reales del orden del día y su tratamiento» de
 * `docs/superpowers/plans/2026-08-29-c1-junta-socios-garrigues-2026.md`, derivada
 * del certificado del acta (depósito de cuentas 2025, RM de Madrid) vía spec §3.6.
 * Los títulos se copian de esa tabla **verbatim**; no son una transcripción literal
 * del certificado, que no obra en el repo.
 *
 * **No son los puntos de una Junta ordinaria genérica de SA.** La descripción
 * «aprobación de cuentas, informe de gestión, reelección de consejeros» circuló en
 * un informe previo y es falsa: con esos puntos el caso canónico no ejercitaría
 * ninguna de las 6 materias SLP de G3 ni dispararía el gate del informe preceptivo
 * del Consejo de Socios.
 *
 * ## Alcance (decisión del usuario, 2026-08-29)
 *
 * Cobertura acreditada: **10 acuerdos**. Los 3 puntos sin materia acreditada
 * figuran en el orden del día con su nota visible y **no** materializan acuerdo.
 * Crear su materia exigiría clasificación legal nueva, que es dictamen del Comité
 * Legal y no seed.
 *
 * ## Etiqueta de alcance
 *
 * Reconstrucción demo sin efecto jurídico. El expediente real ya existe en el
 * Registro Mercantil; la plataforma lo reproduce, no lo sustituye. Ninguna
 * superficie de este módulo afirma envío, entrega, acuse ni interacción real con
 * EAD Trust: `CANAL_ESTATUTARIO` nombra el canal del acto real, nada más.
 */

export type PuntoOrdenDia = {
  /** "1.1", "1.2", "2".."12" y "acta". Clave de enlace con el acuerdo en Task 6. */
  numero: string;
  titulo: string;
  /** Código de `materia_catalog`, o `null` si la clasificación no está acreditada. */
  materia: string | null;
  /** `true` solo en los 10 puntos que se materializan como `agreements`. */
  materializa: boolean;
  /**
   * `DECISORIO` en los que materializan — `agreementsFromAgenda` filtra por este
   * valor. `null` en los que no: no clasificar es más honesto que llamarlos
   * INFORMATIVO, porque el certificado los recoge como puntos deliberados.
   */
  kind: "DECISORIO" | null;
  /** Visible en la ficha. Presente en los 3 sin materia y en el cierre del acta. */
  nota?: string;
};

/** Fecha de la carta de convocatoria (spec §3.6: enviada el 21/04/2026). */
export const FECHA_CARTA_CONVOCATORIA = "2026-04-21";
/** Fecha de celebración de la Junta (certificado del acta). */
export const FECHA_JUNTA = "2026-05-06";

/**
 * Identidad lógica del expediente. `convocatorias` **no tiene columna `slug`**
 * (verificado contra Cloud): la clave de idempotencia del seed es
 * `(tenant_id, body_id, fecha_1)`. Este valor rotula el expediente en informes.
 */
export const CONVOCATORIA_SLUG = "garrigues-junta-socios-2026-05-06";

/** Slug del órgano. Se resuelve por él; el UUID nunca se hardcodea. */
export const ORGANO_SLUG = "garrigues-junta-socios";

/**
 * Canal estatutario del acto real (art. 27.3 Estatutos). Coincide con
 * `convocatoria.canales.SLP` del pack `GARR_JUNTA_SOCIOS` v1.1.0.
 * **Es la descripción del canal, no evidencia de envío ni de acuse.**
 */
export const CANAL_ESTATUTARIO = "COMUNICACION_INDIVIDUAL_CON_ACUSE";

/**
 * Cita del plazo. La Ley 2/2007 **no regula la antelación** de la convocatoria:
 * la fijan los Estatutos, con la LSC como supletoria.
 */
export const STATUTORY_BASIS =
  "arts. 27.3 y 27.4 de los Estatutos; art. 176 LSC (supletoria)";

/** Domicilio social inscrito (RM de Madrid, hoja M-190538). */
export const LUGAR_JUNTA = "Domicilio social: Plaza de Colón, 2, 28046 Madrid";

/**
 * Identidad lógica de la reunión materializada. `meetings.slug` SÍ existe y es
 * UNIQUE global, así que este valor es la clave de idempotencia del seed de la
 * reunión — a diferencia de la convocatoria, que no tiene columna `slug`.
 */
export const MEETING_SLUG = "garrigues-junta-socios-06-05-2026";

/**
 * Mesa de la Junta (spec §3.6, del certificado del acta).
 *
 * Ninguno de los dos es un cargo permanente del órgano: la Presidenta lo es
 * **como socia y senior partner** (art. 29.2 de los Estatutos) y el Secretario
 * fue **elegido por unanimidad de los asistentes en la propia sesión**. Por eso
 * no existe —ni se fabrica— `authority_evidence` de la Junta para ninguno de
 * los dos: la mesa de una Junta se constituye en la sesión, no viene de un
 * nombramiento previo inscrito.
 */
export const MESA_PRESIDENTA = "Rosa Zarza Jimeno";
export const MESA_SECRETARIO = "Roberto Delgado Gil";

/**
 * Los 3 socios que asistieron con presencia física, y el único representante.
 *
 * El certificado dice literalmente que «los socios que asistieron representados
 * lo fueron por el socio D. Roberto Delgado Gil», que exhibió las cartas de
 * delegación a la Presidenta. Son 343 delegaciones a **una misma persona**, no
 * un reparto entre varios representantes.
 *
 * Estos nombres se contrastan en el preflight del seed contra la transcripción
 * `scripts/garrigues/censo/socios-acta-2026-05-06.json` y contra los titulares
 * reales de `capital_holdings` en Cloud: tres fuentes que deben coincidir.
 */
export const SOCIOS_PRESENCIALES = ["Fernando Vives Ruiz", MESA_PRESIDENTA, MESA_SECRETARIO];
export const REPRESENTANTE_UNICO = MESA_SECRETARIO;

/**
 * La hora **no consta** en la fuente disponible, y esta constante no puede
 * hacerla constar: `fecha_1` es `timestamptz` y toda la UI pinta algo.
 *
 * Historia de dos intentos, para que nadie repita el segundo:
 *   1. `00:00:00.000Z` — la ficha lo renderiza con `toLocaleString('es-ES')` y en
 *      `Europe/Madrid` sale **«6/5/2026, 2:00:00»**, propagado además a cuatro
 *      variables del documento (`hora`, `hora_junta`, `hora_sesion`,
 *      `hora_primera_convocatoria`). Decir «no se inventa» y guardar esto era
 *      falso: la pantalla inventaba una hora, y de madrugada.
 *   2. `00:00:00+02:00` — arregla el renderizado (sale `0:00`) y **rompe la
 *      fecha**: se almacena como `2026-05-05 22:00:00+00`, así que cualquier
 *      consumidor que corte la cadena UTC (`slice(0, 10)`, que es lo que hace
 *      media base de código) lee **5 de mayo**. Peor el remedio.
 *
 * Se vuelve al (1) porque la FECHA es el dato que no puede fallar, y se corrige
 * la afirmación en vez del valor: **la hora que se ve es un artefacto de
 * renderizado, no un dato del expediente**. El texto de la carta lo dice
 * expresamente, y ese es el sitio donde consta.
 */
export const FECHA_1_ISO = `${FECHA_JUNTA}T00:00:00.000Z`;

export const NOTA_SIN_MATERIA =
  "Punto del orden del día sin acuerdo materializado: la clasificación de materia no está acreditada y crearla exige dictamen del Comité Legal.";

export const NOTA_APROBACION_ACTA =
  "Aprobación del acta en la propia sesión (art. 97 RRM): es el cierre de la reunión, no un acuerdo materializable.";

/**
 * 13 puntos del orden del día + el cierre del acta = 14 entradas.
 *
 * **12 puntos numerados, 13 entradas:** el punto 1 del certificado tiene dos
 * subpuntos (1.1 y 1.2) con materias distintas que producen dos acuerdos
 * distintos. Fundirlos en una entrada dejaría el caso en 9 acuerdos, no 10.
 */
export const ORDEN_DEL_DIA: PuntoOrdenDia[] = [
  {
    numero: "1.1",
    titulo: "Modificación del art. 36 y disposición transitoria de conversión a Consejo",
    materia: "MODIFICACION_ESTATUTOS",
    materializa: true,
    kind: "DECISORIO",
  },
  {
    numero: "1.2",
    titulo: "Cese y reelección de Fernando Vives como administrador único hasta 30/06/2032",
    materia: "NOMBRAMIENTO_ADMINISTRADOR_UNICO",
    materializa: true,
    kind: "DECISORIO",
  },
  {
    numero: "2",
    titulo: "Exclusión estatutaria de socios (retiro a los 60, art. 21.1.e)",
    materia: "EXCLUSION_SOCIO_ESTATUTARIA",
    materializa: true,
    kind: "DECISORIO",
  },
  {
    numero: "3",
    titulo: "Continuidad de socios tras los 60",
    materia: "CONTINUIDAD_SOCIO_POST_60",
    materializa: true,
    kind: "DECISORIO",
  },
  {
    numero: "4",
    titulo: "Admisión de socios de cuota",
    materia: "ADMISION_SOCIO_CUOTA",
    materializa: true,
    kind: "DECISORIO",
  },
  {
    numero: "5",
    titulo: "Centro de Estudios — operación de toma de participación",
    materia: null,
    materializa: false,
    kind: null,
    nota: NOTA_SIN_MATERIA,
  },
  {
    numero: "6",
    titulo: "Integración de BSVV con aumento de capital sin derecho de preferencia",
    materia: "INTEGRACION_DESPACHO_AUMENTO_SIN_PREFERENCIA",
    materializa: true,
    kind: "DECISORIO",
  },
  {
    numero: "7",
    titulo: "Cuentas anuales 2025 (individuales y consolidadas)",
    materia: "APROBACION_CUENTAS",
    materializa: true,
    kind: "DECISORIO",
  },
  {
    numero: "8",
    titulo: "Estado de información sobre sostenibilidad",
    materia: null,
    materializa: false,
    kind: null,
    nota: NOTA_SIN_MATERIA,
  },
  {
    numero: "9",
    titulo: "Informe de gestión",
    materia: null,
    materializa: false,
    kind: null,
    nota: NOTA_SIN_MATERIA,
  },
  {
    numero: "10",
    titulo: "Reelección del auditor (Lillo Auditores Asociados SL)",
    materia: "NOMBRAMIENTO_AUDITOR",
    materializa: true,
    kind: "DECISORIO",
  },
  {
    numero: "11",
    titulo: "Retribución de prestaciones accesorias",
    materia: "RETRIBUCION_PRESTACIONES_ACCESORIAS",
    materializa: true,
    kind: "DECISORIO",
  },
  {
    numero: "12",
    titulo: "Delegación de facultades para elevar a público",
    materia: "DELEGACION_FACULTADES",
    materializa: true,
    kind: "DECISORIO",
  },
  {
    numero: "acta",
    titulo: "Aprobación del acta en la propia sesión (art. 97 RRM)",
    materia: null,
    materializa: false,
    kind: null,
    nota: NOTA_APROBACION_ACTA,
  },
];

/** Los 10 que se materializan como `agreements` en Task 6. */
export const puntosQueMaterializan = (): PuntoOrdenDia[] =>
  ORDEN_DEL_DIA.filter((p) => p.materializa);

/** Los 3 sin clasificación acreditada. El cierre del acta no cuenta aquí. */
export const puntosSinMateriaAcreditada = (): PuntoOrdenDia[] =>
  ORDEN_DEL_DIA.filter((p) => p.materia === null && p.numero !== "acta");

/** Días naturales entre dos fechas ISO (`YYYY-MM-DD`), en UTC. */
export function diasEntre(desde: string, hasta: string): number {
  return Math.round(
    (Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000,
  );
}

/**
 * Antelación real **derivada** de las dos fechas del acta. No hay ningún `15`
 * literal en este módulo: si alguien cambia una fecha, este número cambia y el
 * contraste con `antelacionDias.SLP` del pack `GARR_JUNTA_SOCIOS` se rompe.
 *
 * Nota sobre `reglaEspecifica.antelacionAmpliada` del pack (30 días si el orden
 * del día incluye **modificación estructural**): el punto 6 tiene
 * `matter_class = 'ESTRUCTURAL'` en `materia_catalog`, que es la clase de materia
 * de la plataforma y **no** el concepto legal de modificación estructural
 * (fusión, escisión, transformación, cesión global). Un aumento de capital con
 * supresión del derecho de preferencia no lo es, así que los 15 días del acta no
 * contradicen el pack. Si el motor llega a emitir un aviso por esta vía, es un
 * falso positivo de nomenclatura y no un defecto del dato.
 */
export const ANTELACION_DIAS = diasEntre(FECHA_CARTA_CONVOCATORIA, FECHA_JUNTA);

/**
 * Texto de la carta de convocatoria como capa 1 del expediente.
 *
 * **Reconstrucción etiquetada, no transcripción.** De la carta real solo consta
 * acreditado el encabezamiento «Querido socio:» (spec §3.6); el cuerpo se
 * reconstruye a partir del orden del día y de los artículos citados, y el propio
 * texto lo dice. No se afirma remisión, entrega, acuse ni actuación de EAD Trust.
 */
export function convocatoriaText(): string {
  // Se numera por `p.numero`, NUNCA por posición: el punto 2 del certificado es
  // el tercero del array (1.1, 1.2, 2…), así que `index + 1` desplazaba todo a
  // partir del segundo y una certificación que dijera «punto 2» no habría casado
  // con el documento.
  const puntos = ORDEN_DEL_DIA.filter((p) => p.numero !== "acta")
    .map((p) => `${p.numero}. ${p.titulo}${p.nota ? `\n   (${p.nota})` : ""}`)
    .join("\n");

  return [
    "RECONSTRUCCIÓN DEMO / SIN EFECTO JURÍDICO",
    "",
    "Este documento reproduce la convocatoria de la Junta General de Socios de J&A Garrigues, S.L.P. de 6 de mayo de 2026, cuyo expediente real consta en el Registro Mercantil de Madrid. De la carta original solo está acreditado el encabezamiento; el resto del cuerpo es una reconstrucción a partir del orden del día del certificado del acta y de los artículos estatutarios citados.",
    "",
    "Madrid, 21 de abril de 2026",
    "",
    "Querido socio:",
    "",
    `Por la presente se te convoca a la Junta General de Socios de J&A Garrigues, S.L.P., que se celebrará el 6 de mayo de 2026 en el domicilio social (Plaza de Colón, 2, 28046 Madrid). La hora de la sesión no consta en la fuente disponible y no se reconstruye.`,
    "",
    "ORDEN DEL DÍA",
    "",
    puntos,
    "",
    `Finalizado el orden del día se someterá a aprobación el acta de la sesión conforme al artículo 97 del Reglamento del Registro Mercantil.`,
    "",
    "PLAZO Y FORMA DE LA CONVOCATORIA",
    "",
    `El acto real se cursó por el canal del artículo 27.3 de los Estatutos —comunicación individual y por escrito que asegure la recepción— con ${ANTELACION_DIAS} días de antelación sobre la fecha de la sesión, conforme a los artículos 27.3 y 27.4 de los Estatutos, siendo el artículo 176 LSC supletorio. La Ley 2/2007 no regula la antelación de la convocatoria.`,
    "",
    "ALCANCE DE ESTE REGISTRO",
    "",
    "Registro técnico realizado por la Secretaría Societaria en el entorno DEMO. No constituye una convocatoria emitida ni evidencia final productiva. Esta reconstrucción no produce remisión, entrega ni acuse, y no afirma ninguna actuación, interposición, mensajería ni custodia de EAD Trust sobre este documento.",
  ].join("\n");
}

// ─────────────────────────────────────────── Task 6: los acuerdos y su regla ──

/**
 * El punto 1.1 estuvo bloqueado en Task 6 y **dejó de estarlo el 2026-08-30**.
 *
 * Task 6 no lo materializó por dos motivos, y hoy ninguno de los dos se sostiene:
 *
 *  1. *«El art. 36 no consta en el texto entregado; la numeración salta de 35 a
 *     37.»* **Falso, y se pudo comprobar sin fuente nueva.** El cotejo del Comité
 *     Legal sobre el texto vigente
 *     (`docs/legal/2026-08-04-decisiones-comite-legal-slp-garrigues.md`, apartado
 *     del 2026-08-05) dice literalmente: «Mandato administradores (art. 36, Insc.
 *     960ª): 6 años reelegibles», que además cuadra con el mandato de Vives
 *     30/06/2026 → 30/06/2032. Y el BORME lo corrobora por segunda vía: anuncio
 *     338618/2026, I/A 960, «se modifica el artículo 36 … por el cambio del plazo
 *     de duración de los administradores».
 *  2. *«Sin artículo que cotejar no hay mayoría que citar.»* Eso sí era cierto: la
 *     mayoría no salía de una cita. **Sigue sin salir de una cita** — sale de una
 *     SUBSUNCIÓN decidida por el usuario, y por eso va etiquetada. Ver
 *     `SUBSUNCION_ART36`.
 *
 * Lo que cambió no es el dato: es que ahora hay una decisión, y está fechada,
 * atribuida y contrastable, con su lectura alternativa al lado.
 */
export type Subsuncion = {
  /** NO es `Fuente` (tipo cerrado, sin 'INFERIDO'): lo inferido es la subsunción. */
  procedencia: "INFERIDO";
  decididoPor: string;
  objeto: string;
  lecturaAplicada: string;
  lecturaAlternativa: string;
  efectoSiSeRevisa: string;
  consecuenciaNoAplicada: string;
  registroCanonico: string;
};

/**
 * La subsunción del punto 1.1 en el art. 30.2.a), **etiquetada `INFERIDO`**.
 *
 * Copia fiel de `reglaEspecifica.subsuncionArt36` del pack
 * `GARR_MODIFICACION_ESTATUTOS` (migración `20260830120000`). Se duplica aquí a
 * propósito: el pack la lleva al dato y este módulo la lleva al
 * `compliance_explain` del acuerdo, que es lo que la ficha enseña. La sonda
 * contrasta las dos copias, así que una divergencia se ve.
 *
 * **La `fuente` de la mayoría es `ESTATUTOS` y eso es correcto** — la mayoría sale
 * de los Estatutos. Lo `INFERIDO` es el paso de razonamiento que lleva ESTE
 * acuerdo a ESE artículo, y por eso vive en su propia clave.
 */
export const SUBSUNCION_ART36: Subsuncion = {
  procedencia: "INFERIDO",
  decididoPor: "el usuario, 2026-08-30",
  objeto:
    "el art. 36 regula el plazo de duración de los administradores (BORME 338618/2026, I/A 960; y cotejo del Comité Legal de 2026-08-05: mandato de 6 años reelegibles)",
  lecturaAplicada:
    "El art. 30.2.a) —nombramiento, reelección y separación de los administradores— alcanza a modificar el artículo que regula su plazo, de modo que la modificación del art. 36 se adopta por la mayoría reforzada de 2/3.",
  lecturaAlternativa:
    "el art. 30.2.f) tasa quince artículos (1, 2, 9, 10, 11, 12, 13, 17, 18, 19, 20, 21, 26, 42 y 47) y el 36 no figura; por esa vía la modificación iría por la mayoría general del art. 30.1",
  efectoSiSeRevisa:
    "Si el Comité Legal acoge la lectura alternativa, cambia la mayoría de este pack (2/3 → art. 30.1) y decae el perímetro del art. 39.5.b.i para este acuerdo. No hay captura emitida que rectificar: la ficha enseña las dos lecturas.",
  consecuenciaNoAplicada:
    "Bajo la lectura aplicada, el art. 39.5.b.i llevaría este acuerdo al informe preceptivo del Consejo de Socios. El gate demo NO se amplía sobre una subsunción INFERIDA: su config son 4 materias FIRMES y sigue disparando en 4.",
  registroCanonico: "docs/legal/2026-08-30-modificacion-art-36-mayoria-aplicada.md",
};

/** Los puntos cuyo contenido descansa en una subsunción etiquetada, por número. */
export const SUBSUNCION_POR_PUNTO: Record<string, Subsuncion> = {
  "1.1": SUBSUNCION_ART36,
};

/** La subsunción del punto, o `null` si su regla sale de una cita directa. */
export const subsuncionDe = (numero: string): Subsuncion | null =>
  SUBSUNCION_POR_PUNTO[numero] ?? null;

/**
 * Los puntos que producen un `agreements`. **Hoy son los 10 que materializan**:
 * desde que cayó el bloqueo del 1.1 no hay ninguno excluido.
 *
 * No se colapsa contra `puntosQueMaterializan` aunque devuelvan lo mismo: son dos
 * preguntas distintas —«¿está en el orden del día como decisorio?» y «¿tiene
 * acuerdo en el expediente?»— y la segunda ya divergió una vez. Mantenerla
 * separada es lo que permitió bloquear y desbloquear sin tocar Task 4.
 */
export const puntosConAcuerdo = (): PuntoOrdenDia[] => puntosQueMaterializan();

/**
 * Ordinal 1-based del punto dentro de `ORDEN_DEL_DIA`.
 *
 * Es el mismo entero que la plataforma usaría en
 * `agenda_items.source_convocatoria_item_index` para apuntar al elemento del
 * array `convocatorias.agenda_items`. Aquí ese vínculo por FK **no puede
 * escribirse** —`fn_secretaria_guard_convocation_agenda_binding` exige que la
 * convocatoria esté EMITIDA e inmutable y ésta está en BORRADOR—, así que el
 * ordinal se conserva en `agenda_items.order_number`, que es la columna que la
 * arista real (`agreements.agenda_item_id`) alcanza.
 *
 * Los huecos (1, 6, 9, 10, 14) son los puntos sin acuerdo: no se renumera, para
 * que el ordinal siga apuntando al mismo elemento de la convocatoria.
 */
export function ordinalEnOrdenDelDia(numero: string): number {
  const idx = ORDEN_DEL_DIA.findIndex((p) => p.numero === numero);
  if (idx < 0) throw new Error(`ordinal: el punto ${numero} no está en el orden del día`);
  return idx + 1;
}

/**
 * Texto del acuerdo por punto.
 *
 * `contenido` califica **el contenido del acuerdo**, no su redacción: ningún
 * literal del certificado obra en el repo, así que todos los textos son
 * reconstrucción y todos lo dicen.
 *
 *  - `ACREDITADO` — lo decidido consta en fuente externa (tabla vinculante del
 *    plan, confirmada por BORME para 1.1, 1.2, 6 y 10; art. 31.3 de los Estatutos
 *    para el 12).
 *  - `INFERIDO` — el certificado recoge el punto pero no lo que se decidió.
 *    Estos textos **no identifican a ninguna persona**: nombrar a un socio
 *    excluido o admitido a partir de un punto del orden del día sería inventar
 *    el contenido de un acuerdo sobre una persona concreta.
 */
export type TextoAcuerdo = {
  contenido: "ACREDITADO" | "INFERIDO";
  propuesta: string;
  decision: string;
};

const DISCLAIMER =
  "Reconstrucción demo sin efecto jurídico: el certificado del acta no transcribe el literal del acuerdo.";

export const TEXTOS_ACUERDO: Record<string, TextoAcuerdo> = {
  "1.1": {
    // ACREDITADO por dos vías independientes: el BORME (qué artículo y qué
    // regula) y el cotejo del Comité Legal de 2026-08-05 (el plazo: 6 años).
    // Lo que NO está acreditado es la disposición transitoria que enuncia el
    // título del punto, y el texto lo dice en vez de reconstruirla.
    contenido: "ACREDITADO",
    propuesta:
      "Modificar el artículo 36 de los Estatutos Sociales, que regula el plazo de duración del cargo de administrador, fijándolo en seis años reelegibles.",
    decision:
      `Se acuerda modificar el artículo 36 de los Estatutos Sociales, relativo al plazo de duración del cargo de administrador, que queda fijado en seis años reelegibles. La modificación quedó inscrita el 13 de julio de 2026 (BORME, anuncio 338618/2026, inscripción 960 de la hoja M-190538). El orden del día enuncia además una disposición transitoria de conversión a Consejo de Administración que la fuente disponible no acredita, y este texto no la reconstruye. La mayoría aplicada es la reforzada de dos tercios del artículo 30.2.a de los Estatutos, por subsunción etiquetada INFERIDO cuya lectura alternativa consta en el expediente. ${DISCLAIMER}`,
  },
  "1.2": {
    contenido: "ACREDITADO",
    propuesta:
      "Cesar y reelegir a D. Fernando Vives Ruiz como Administrador Único de J&A Garrigues, S.L.P., con mandato hasta el 30 de junio de 2032, previo informe preceptivo del Consejo de Socios.",
    decision:
      `Se acuerda el cese y la reelección de D. Fernando Vives Ruiz como Administrador Único de J&A Garrigues, S.L.P., con mandato hasta el 30 de junio de 2032. ${DISCLAIMER}`,
  },
  "2": {
    contenido: "INFERIDO",
    propuesta:
      "Declarar la exclusión estatutaria de los socios incursos en la causa de retiro por edad del artículo 21.1.e de los Estatutos, previo informe preceptivo del Consejo de Socios.",
    decision:
      `Se acuerda la exclusión estatutaria de los socios afectados por la causa del artículo 21.1.e de los Estatutos. El certificado no transcribe el acuerdo ni identifica a los socios afectados, y este texto no los identifica. ${DISCLAIMER}`,
  },
  "3": {
    contenido: "INFERIDO",
    propuesta:
      "Aprobar la continuidad como socios de quienes han alcanzado la edad de retiro, a propuesta del Órgano de Administración y previo informe preceptivo del Consejo de Socios.",
    decision:
      `Se acuerda la continuidad de los socios afectados conforme al artículo 21.1.e de los Estatutos. El certificado no transcribe el acuerdo ni identifica a los socios afectados, y este texto no los identifica. ${DISCLAIMER}`,
  },
  "4": {
    contenido: "INFERIDO",
    propuesta:
      "Admitir como Socios de Cuota a los profesionales propuestos por el Órgano de Administración, previo informe preceptivo del Consejo de Socios.",
    decision:
      `Se acuerda la admisión como Socios de Cuota de los profesionales propuestos. El certificado no transcribe el acuerdo ni identifica a los admitidos, y este texto no los identifica. ${DISCLAIMER}`,
  },
  "6": {
    contenido: "ACREDITADO",
    propuesta:
      "Aprobar la integración del despacho BSVV mediante aumento del capital social con supresión del derecho de preferencia, previo informe del Administrador Único sobre la supresión.",
    decision:
      `Se acuerda la integración del despacho BSVV mediante aumento del capital social con supresión del derecho de preferencia. ${DISCLAIMER}`,
  },
  "7": {
    contenido: "INFERIDO",
    propuesta:
      "Examinar y aprobar las cuentas anuales individuales y consolidadas del ejercicio 2025.",
    decision:
      `Se acuerda aprobar las cuentas anuales individuales y consolidadas del ejercicio 2025. El certificado del acta se expidió para el depósito de esas cuentas, pero no transcribe el acuerdo ni su aplicación del resultado. ${DISCLAIMER}`,
  },
  "10": {
    contenido: "ACREDITADO",
    propuesta:
      "Reelegir a Lillo Auditores Asociados, S.L. como auditor de cuentas de la sociedad.",
    decision:
      `Se acuerda la reelección de Lillo Auditores Asociados, S.L. como auditor de cuentas. ${DISCLAIMER}`,
  },
  "11": {
    contenido: "INFERIDO",
    propuesta:
      "Aprobar la retribución de las prestaciones accesorias del ejercicio, a propuesta del Órgano de Administración y previo informe del Consejo de Socios.",
    decision:
      `Se acuerda la retribución de las prestaciones accesorias. El certificado no transcribe el acuerdo ni sus importes, y este texto no los reconstruye. ${DISCLAIMER}`,
  },
  "12": {
    contenido: "ACREDITADO",
    propuesta:
      "Delegar las facultades necesarias para elevar a instrumento público los acuerdos adoptados.",
    decision:
      `Se acuerda delegar las facultades para elevar a instrumento público los acuerdos adoptados. Es un acuerdo de cobertura: conforme al artículo 31.3 de los Estatutos, la elevación corresponde a quien tiene facultad de certificar y «también podrá realizarse por cualquiera de los administradores sin necesidad de delegación expresa», de modo que con Administrador Único que además certifica la delegación no es necesaria. ${DISCLAIMER}`,
  },
};

/** El texto del punto, o error: un acuerdo sin texto no se escribe en blanco. */
export function textoAcuerdo(numero: string): TextoAcuerdo {
  const t = TEXTOS_ACUERDO[numero];
  if (!t) throw new Error(`texto de acuerdo: falta el punto ${numero}`);
  return t;
}
