/**
 * Cuestionario guiado de calificación regulatoria (spec v1.1 del equipo legal,
 * 2026-09-08) — el CRITERIO, sin React y sin imports.
 *
 * Módulo hoja porque lo consumen el alta, la ficha del sistema, el wizard del
 * autodiagnóstico y el informe: si el criterio viviera en una pantalla, una
 * corrección llegaría a esa y sus hermanas seguirían pintando lo contrario.
 *
 * QUÉ DECIDE Y QUÉ NO
 * -------------------
 * El árbol DERIVA rol, nivel, dependencia GPAI, marcos aplicables y perfil de
 * catálogo a partir de las respuestas. Nadie elige el nivel de un desplegable.
 * Lo que no decide el producto (validación de la spec, S-1…S-9):
 *   - sólo alcanza dos roles (PROVEEDOR / RESPONSABLE_DESPLIEGUE): importador y
 *     distribuidor no tienen preguntas en la spec y no se inventan;
 *   - el vocabulario persistido no cambia: «Inaceptable», no «PROHIBIDO»;
 *     «RESPONSABLE_DESPLIEGUE» (art. 3.4 en su versión española), no «DESPLEGADOR»;
 *   - los marcos van con la numeración FINAL del Reglamento (UE) 2024/1689 y la
 *     `nota` conserva la cita de la spec donde ésta usaba numeración de borrador;
 *   - «el nivel puede reducirse si la justificación es suficiente» (art. 6.3) no
 *     lo juzga el producto: con la excepción invocada y motivada, el árbol sigue
 *     y la motivación queda registrada y revisable por la autoridad.
 *
 * Las preguntas y su ayuda viven aquí, versionadas, y cada cuestionario
 * persistido guarda `questionnaire_version`: uno antiguo sigue siendo
 * interpretable cuando cambien las preguntas.
 */

export const CUESTIONARIO_VERSION = "1.1";

export type IdPregunta = "Q1_1" | "Q1_2" | "Q1_3" | "Q1_4" | "Q2_1" | "Q2_2" | "Q2_3" | "Q2_4" | "Q2_5";
export type Respuestas = Partial<Record<IdPregunta, boolean>>;

export type Ayuda = { queSignifica: string; ejemplos: string[]; comoSaberlo: string };

export type PreguntaGuiada = {
  id: IdPregunta;
  fase: 1 | 2;
  titulo: string;
  articulo: string;
  /** Qué citaba la spec cuando el artículo se corrigió, para que Legal vea el cambio. */
  notaSpec?: string;
  ayuda: Ayuda;
  siImplica: string;
  noImplica: string;
  /** Q2.3 sólo existe cuando el caso está en el anexo III. */
  visibleSi?: (r: Respuestas) => boolean;
};

export const PREGUNTAS: PreguntaGuiada[] = [
  {
    id: "Q1_1",
    fase: 1,
    titulo: "¿Su organización ha creado o entrenado este sistema de IA?",
    articulo: "Art. 3.3 (definición de proveedor)",
    notaSpec: "La spec cita el art. 3.1; en el texto final la definición de proveedor es el art. 3.3.",
    ayuda: {
      queSignifica:
        "Responda «Sí» si su organización (o alguien contratado por ella) diseñó, programó o entrenó el sistema desde cero. Responda «No» si su organización compró, contrató o usa un sistema desarrollado por un tercero.",
      ejemplos: [
        "Desarrollo interno de un chatbot.",
        "Entrenamiento de un modelo de aprendizaje automático con datos propios.",
        "«No»: Harvey, ChatGPT o Copilot contratados a su fabricante.",
      ],
      comoSaberlo:
        "Pregunte quién escribió el código o entrenó el modelo. Si fue un proveedor externo, la respuesta es «No».",
    },
    siImplica: "Posible proveedor",
    noImplica: "Continuar",
  },
  {
    id: "Q1_2",
    fase: 1,
    titulo:
      "¿Su organización ha cambiado de forma importante el funcionamiento del sistema respecto a lo que el fabricante diseñó?",
    articulo: "Art. 3.23 y art. 25.1 (modificación sustancial y cambio de finalidad)",
    notaSpec: "La spec cita el art. 3.3; la modificación sustancial se define en el art. 3.23 y sus efectos sobre el rol están en el art. 25.1 (alto riesgo).",
    ayuda: {
      queSignifica:
        "Responda «Sí» si ha modificado el sistema de manera que ahora hace algo diferente de lo previsto originalmente. Responda «No» si lo usa tal como lo entregó el proveedor, aunque lo haya configurado o personalizado con sus datos.",
      ejemplos: [
        "Un sistema diseñado para resumir documentos que ahora se usa para valorar el riesgo de un cliente.",
        "«No»: ajustar plantillas, permisos o el idioma de un producto contratado.",
      ],
      comoSaberlo:
        "Si el proveedor no reconocería el uso actual como parte de su producto, probablemente es una modificación sustancial.",
    },
    siImplica: "Proveedor por modificación sustancial (art. 25.1)",
    noImplica: "Continuar",
  },
  {
    id: "Q1_3",
    fase: 1,
    titulo: "¿Su organización ofrece o vende este sistema a terceros con su propio nombre o marca?",
    articulo: "Arts. 3.3 y 16 (proveedor); art. 25.1 a)",
    ayuda: {
      queSignifica:
        "Responda «Sí» si comercializa el sistema a clientes, socios o entidades del grupo como producto o servicio propio, aunque el motor tecnológico sea de otro proveedor. Responda «No» si el sistema sólo se usa internamente.",
      ejemplos: [
        "Un asistente ofrecido a clientes bajo la marca del despacho.",
        "«No»: la herramienta la usan sólo los profesionales de la organización.",
      ],
      comoSaberlo:
        "Si un cliente externo ve el nombre de su organización como proveedor del sistema, la respuesta es «Sí».",
    },
    siImplica: "Proveedor",
    noImplica: "Continuar",
  },
  {
    id: "Q1_4",
    fase: 1,
    titulo: "¿Su organización decide qué hace el sistema con sus resultados? (pregunta complementaria)",
    articulo: "Arts. 3.4 y 26 (responsable del despliegue)",
    ayuda: {
      queSignifica:
        "Esta pregunta no determina el rol por sí sola, pero ayuda a entender el nivel de control. Responda «Sí» si su organización decide cómo se usan los resultados, qué datos se introducen y puede modificar o detener su funcionamiento.",
      ejemplos: [
        "Los profesionales revisan y deciden sobre cada salida antes de usarla.",
        "«No»: los resultados los gestiona otra entidad o no hay capacidad de intervenir en su operación.",
      ],
      comoSaberlo:
        "Pregunte quién puede apagar el sistema o cambiar para qué se usa. Si es su organización, la respuesta es «Sí».",
    },
    siImplica: "Complementaria (refuerza un rol activo)",
    noImplica: "Continuar",
  },
  {
    id: "Q2_1",
    fase: 2,
    titulo: "¿El sistema realiza alguna actividad que la ley considera inaceptable?",
    articulo: "Art. 5 (prácticas prohibidas)",
    ayuda: {
      queSignifica:
        "Se refiere a usos de IA que la Unión Europea ha prohibido completamente. Marque «Sí» SOLO si el sistema hace alguna de estas cosas: puntúa o clasifica a personas por su comportamiento social para perjudicarlas; las manipula de forma inconsciente; explota vulnerabilidades (edad, discapacidad, situación económica); o identifica personas por biometría en espacios públicos en tiempo real, salvo excepciones policiales.",
      ejemplos: [
        "Puntuación social que perjudica a las personas.",
        "Identificación biométrica remota en tiempo real en espacios de acceso público.",
      ],
      comoSaberlo:
        "Si tiene dudas, la respuesta casi seguro es «No». Estas prácticas son excepcionales y evidentes.",
    },
    siImplica: "Inaceptable — flujo bloqueado",
    noImplica: "Continuar",
  },
  {
    id: "Q2_2",
    fase: 2,
    titulo: "¿El sistema se usa para alguna de estas finalidades consideradas de alto riesgo?",
    articulo: "Arts. 6.1 y 6.2, anexo III",
    ayuda: {
      queSignifica:
        "Marque «Sí» si el sistema se usa para: (1) identificación biométrica o categorización de personas; (2) gestión de infraestructuras críticas; (3) educación (admisión, evaluación); (4) empleo (selección, evaluación de trabajadores); (5) acceso a servicios esenciales (crédito, seguros de vida y salud, prestaciones sociales); (6) aplicación de la ley; (7) migración y control de fronteras; (8) administración de justicia y procesos democráticos.",
      ejemplos: [
        "Un sistema que sólo ayuda a buscar jurisprudencia o a redactar documentos probablemente NO es de alto riesgo.",
        "Un sistema que evalúa la solvencia de clientes para decidir si se les presta un servicio SÍ podría serlo.",
      ],
      comoSaberlo:
        "Revise la lista del anexo III. Si la finalidad prevista del sistema encaja en una de sus ocho áreas, marque «Sí».",
    },
    siImplica: "Candidato a alto riesgo",
    noImplica: "Continuar",
  },
  {
    id: "Q2_3",
    fase: 2,
    titulo:
      "¿Considera que, a pesar de estar en la lista anterior, este sistema concreto no genera un riesgo real para las personas?",
    articulo: "Art. 6.3 (excepción motivada)",
    ayuda: {
      queSignifica:
        "Es una excepción legal: si puede demostrar que el sistema, aunque pertenece a una categoría de alto riesgo, no supone en la práctica un peligro significativo para la salud, la seguridad o los derechos de las personas, puede documentar una clasificación inferior. Si marca «Sí» deberá escribir una justificación detallada, que queda registrada y puede ser revisada por la autoridad competente.",
      ejemplos: [
        "Un sistema de scoring crediticio usado sólo para operaciones internas de bajo importe y sin decisiones automatizadas sobre personas.",
      ],
      comoSaberlo:
        "Pregúntese si el sistema influye de forma material en una decisión sobre una persona. Si no lo hace, la excepción puede aplicar; motívelo por escrito.",
    },
    siImplica: "Motivación obligatoria (art. 6.3) — puede reducir la clasificación",
    noImplica: "Alto riesgo confirmado",
    visibleSi: (r) => r.Q2_2 === true,
  },
  {
    id: "Q2_4",
    fase: 2,
    titulo:
      "¿El sistema habla, responde o interactúa directamente con personas, o genera textos, imágenes, audio o vídeo?",
    articulo: "Art. 50 (transparencia)",
    ayuda: {
      queSignifica:
        "Responda «Sí» si el sistema se comunica con personas (chatbot, asistente virtual, atención), genera contenido que podría parecer creado por una persona (textos, imágenes, audio sintético) o toma decisiones que se comunican directamente a la persona afectada.",
      ejemplos: [
        "Un asistente de IA que interactúa directamente con abogados → «Sí».",
        "Un sistema de procesamiento de datos en segundo plano sin interfaz de usuario → «No».",
      ],
      comoSaberlo:
        "Si alguien puede escribirle al sistema o leer algo que el sistema ha escrito, la respuesta es «Sí».",
    },
    siImplica: "Riesgo limitado (art. 50)",
    noImplica: "Continuar",
  },
  {
    id: "Q2_5",
    fase: 2,
    titulo: "¿El sistema utiliza un modelo de inteligencia artificial de uso general (GPT, Claude, Gemini, Llama u otro LLM)?",
    articulo: "Cap. V, arts. 51–56 (modelos de IA de uso general)",
    ayuda: {
      queSignifica:
        "Los modelos de uso general son sistemas muy potentes que pueden realizar muchas tareas distintas. Responda «Sí» si el sistema usa alguno como base, aunque sea a través de una API o integrado en un producto de un tercero.",
      ejemplos: [
        "Un producto que usa modelos de OpenAI, Anthropic o Google → «Sí».",
        "Una hoja de cálculo con fórmulas automatizadas → «No».",
      ],
      comoSaberlo:
        "Si el proveedor menciona «IA generativa», «LLM» o «modelo fundacional» en su documentación, probablemente la respuesta es «Sí».",
    },
    siImplica: "Dependencia GPAI = sí",
    noImplica: "Dependencia GPAI = no",
  },
];

export function preguntasVisibles(r: Respuestas): PreguntaGuiada[] {
  return PREGUNTAS.filter((p) => (p.visibleSi ? p.visibleSi(r) : true));
}

export type RolDerivado = "PROVEEDOR" | "RESPONSABLE_DESPLIEGUE";
export type NivelDerivado = "Inaceptable" | "Alto" | "Limitado" | "Mínimo";
export type PerfilCatalogo = "PROFILE_A" | "PROFILE_B" | "PROFILE_C";

/**
 * S-1 de la validación: la spec no trae preguntas para importador ni
 * distribuidor y no se inventan. Se dice en pantalla, no sólo aquí.
 */
export const AVISO_ROLES_NO_DERIVABLES =
  "Este cuestionario sólo distingue proveedor y responsable del despliegue. No contempla importador ni distribuidor (arts. 3.6 y 3.7): esos roles quedan para el equipo legal.";

export const ETIQUETA_PERFIL: Record<PerfilCatalogo, string> = {
  PROFILE_A: "Perfil A — alto riesgo, proveedor",
  PROFILE_B: "Perfil B — alto riesgo, responsable del despliegue",
  PROFILE_C: "Perfil C — riesgo limitado o mínimo",
};

export function derivarRol(r: Respuestas): { rol: RolDerivado; motivo: string } | null {
  const afirmadas = (["Q1_1", "Q1_2", "Q1_3"] as const).filter((id) => r[id] === true);
  if (afirmadas.length > 0) {
    const motivos: Record<string, string> = {
      Q1_1: "ha creado o entrenado el sistema (art. 3.3)",
      Q1_2: "lo ha modificado sustancialmente o cambiado su finalidad (art. 3.23; en alto riesgo, art. 25.1 b) y c))",
      Q1_3: "lo introduce en el mercado con su nombre o marca (art. 3.3; en alto riesgo, art. 25.1 a))",
    };
    return { rol: "PROVEEDOR", motivo: `Proveedor: ${afirmadas.map((id) => motivos[id]).join("; ")}.` };
  }
  const todasNegadas = (["Q1_1", "Q1_2", "Q1_3"] as const).every((id) => r[id] === false);
  if (!todasNegadas) return null;
  return {
    rol: "RESPONSABLE_DESPLIEGUE",
    motivo:
      "Responsable del despliegue (art. 3.4): usa el sistema bajo su propia autoridad sin haberlo creado, modificado sustancialmente ni comercializado con su marca. Q1.4 no determina el rol por sí sola.",
  };
}

export function derivarNivel(
  r: Respuestas,
): { nivel: NivelDerivado; motivo: string; exigeArt63: boolean } | null {
  if (r.Q2_1 === true) {
    return { nivel: "Inaceptable", motivo: "Incurre en una práctica prohibida del art. 5.", exigeArt63: false };
  }
  if (r.Q2_1 !== false) return null;
  if (r.Q2_2 === undefined) return null;
  if (r.Q2_2 === true && r.Q2_3 === undefined) return null;
  if (r.Q2_2 === true && r.Q2_3 === false) {
    return { nivel: "Alto", motivo: "Caso del anexo III sin invocar la excepción del art. 6.3 (art. 6.2).", exigeArt63: false };
  }
  const excepcion = r.Q2_2 === true && r.Q2_3 === true;
  if (r.Q2_4 === undefined) return null;
  if (r.Q2_4 === true) {
    return {
      nivel: "Limitado",
      motivo: excepcion
        ? "Caso del anexo III con la excepción del art. 6.3 invocada y motivada; interactúa con personas o genera contenido (art. 50)."
        : "Interactúa con personas o genera contenido (art. 50); no es de alto riesgo.",
      exigeArt63: excepcion,
    };
  }
  return {
    nivel: "Mínimo",
    motivo: excepcion
      ? "Caso del anexo III con la excepción del art. 6.3 invocada y motivada; sin supuesto del art. 50."
      : "Ni práctica prohibida, ni anexo III, ni supuesto del art. 50.",
    exigeArt63: excepcion,
  };
}

export type MarcoNormativo = {
  code: string;
  norma: "RIA" | "RGPD" | "DEONTOLOGIA";
  articulos: string;
  titulo: string;
  /** Qué decía la spec cuando la numeración o el alcance difieren, para que Legal vea el cambio. */
  nota?: string;
};

/**
 * Agrupación de los seis roles persistidos por su posición. Única copia: la
 * importa también `perfil-aplicabilidad.ts`. Importador y distribuidor se
 * agrupan con el despliegue SOLO a efectos de qué catálogo de medidas medir
 * (falla abierto hacia el catálogo más exigente disponible); sus obligaciones
 * propias (arts. 23 y 24) no se derivan aquí (DA-1).
 */
export const ROLES_DE_DESPLIEGUE = new Set(["RESPONSABLE_DESPLIEGUE", "IMPORTADOR", "DISTRIBUIDOR"]);
export const ROLES_DE_PROVEEDOR = new Set(["PROVEEDOR", "PROVEEDOR_GPAI", "PROVEEDOR_POSTERIOR"]);

export function derivarMarcos(
  rol: string | null | undefined,
  nivel: string | null | undefined,
  gpai: boolean,
): MarcoNormativo[] {
  if (!rol || !nivel) return [];
  const out: MarcoNormativo[] = [
    { code: "RIA_ART_4", norma: "RIA", articulos: "Art. 4", titulo: "Alfabetización en materia de IA (todos los sistemas)" },
  ];
  if (rol === "IMPORTADOR" || rol === "DISTRIBUIDOR") {
    out.push({
      code: "RIA_ARTS_23_24",
      norma: "RIA",
      articulos: rol === "IMPORTADOR" ? "Art. 23" : "Art. 24",
      titulo: rol === "IMPORTADOR" ? "Obligaciones de los importadores" : "Obligaciones de los distribuidores",
      nota: "El cuestionario no deriva este rol (la spec no trae preguntas para él): sus obligaciones específicas quedan para el equipo legal. Se cita el artículo y no se desarrolla.",
    });
  }
  if (nivel === "Alto" && rol === "RESPONSABLE_DESPLIEGUE") {
    out.push(
      { code: "RIA_ART_26", norma: "RIA", articulos: "Art. 26", titulo: "Obligaciones del responsable del despliegue de sistemas de alto riesgo" },
      {
        code: "RIA_ART_27",
        norma: "RIA",
        articulos: "Art. 27",
        titulo: "Evaluación de impacto sobre los derechos fundamentales",
        nota: "Sólo si concurre uno de los supuestos del art. 27.1 (organismos de Derecho público, entidades privadas que prestan servicios públicos, anexo III 5 b) y c)). La spec lo lista para todo responsable del despliegue de alto riesgo; a quién alcanza lo decide el equipo legal.",
      },
      { code: "RGPD_ARTS_28_35", norma: "RGPD", articulos: "Arts. 28 y 35", titulo: "Encargado de tratamiento y evaluación de impacto" },
    );
  }
  if (nivel === "Alto" && ROLES_DE_PROVEEDOR.has(rol)) {
    out.push(
      { code: "RIA_ARTS_9_15", norma: "RIA", articulos: "Arts. 9–15", titulo: "Requisitos de los sistemas de alto riesgo" },
      { code: "RIA_ARTS_17_47", norma: "RIA", articulos: "Arts. 17 y 47", titulo: "Sistema de gestión de la calidad y declaración UE de conformidad" },
      { code: "RIA_ARTS_72_73", norma: "RIA", articulos: "Arts. 72 y 73", titulo: "Vigilancia poscomercialización y notificación de incidentes graves" },
    );
  }
  if (nivel === "Limitado") {
    out.push({ code: "RIA_ART_50", norma: "RIA", articulos: "Art. 50", titulo: "Obligaciones de transparencia" });
  }
  if (nivel === "Mínimo") {
    out.push({
      code: "RIA_ART_95",
      norma: "RIA",
      articulos: "Art. 95",
      titulo: "Códigos de conducta de aplicación voluntaria",
      nota: "La spec cita el art. 69, numeración de la propuesta de la Comisión; en el texto final es el art. 95.",
    });
  }
  if (gpai) {
    out.push({
      code: "RIA_CAP_V_GPAI",
      norma: "RIA",
      articulos: "Cap. V, arts. 51–56",
      titulo: "Modelos de IA de uso general",
      nota:
        ROLES_DE_PROVEEDOR.has(rol)
          ? "La spec cita «Capítulo V-A (arts. 51–55)», numeración de borrador; en el texto final es el capítulo V, arts. 51–56."
          : "Las obligaciones del cap. V vinculan al PROVEEDOR del modelo de uso general; para el responsable del despliegue este marco es la trazabilidad del modelo y del proveedor en la cadena de suministro. La spec lo lista para todo sistema con dependencia GPAI; el alcance lo decide el equipo legal. (Numeración: la spec cita «cap. V-A, arts. 51–55»; en el texto final es el cap. V, arts. 51–56.)",
    });
  }
  out.push(
    { code: "RGPD_TRANSVERSAL", norma: "RGPD", articulos: "RGPD", titulo: "Protección de datos personales (transversal)" },
    { code: "DEONTOLOGIA", norma: "DEONTOLOGIA", articulos: "—", titulo: "Deontología profesional aplicable al sector" },
  );
  return out;
}

export function perfilCatalogo(
  rol: string | null | undefined,
  nivel: string | null | undefined,
): PerfilCatalogo | null {
  if (!rol || !nivel) return null;
  if (nivel === "Inaceptable") return null;
  if (nivel === "Alto") {
    if (ROLES_DE_PROVEEDOR.has(rol)) return "PROFILE_A";
    if (ROLES_DE_DESPLIEGUE.has(rol)) return "PROFILE_B";
    return null;
  }
  if (nivel === "Limitado" || nivel === "Mínimo") return "PROFILE_C";
  return null;
}

export type ResultadoCuestionario = {
  rol: RolDerivado | null;
  motivoRol: string;
  nivel: NivelDerivado | null;
  motivoNivel: string;
  gpai: boolean;
  exigeArt63: boolean;
  /** Práctica prohibida: el sistema no puede registrarse. */
  bloqueado: boolean;
  marcos: MarcoNormativo[];
  perfil: PerfilCatalogo | null;
  /** Preguntas visibles aún sin responder. */
  pendientes: IdPregunta[];
};

export function resultadoProvisional(r: Respuestas): ResultadoCuestionario {
  const rol = derivarRol(r);
  const nivel = derivarNivel(r);
  const gpai = r.Q2_5 === true;
  return {
    rol: rol?.rol ?? null,
    motivoRol: rol?.motivo ?? "",
    nivel: nivel?.nivel ?? null,
    motivoNivel: nivel?.motivo ?? "",
    gpai,
    exigeArt63: nivel?.exigeArt63 ?? false,
    bloqueado: r.Q2_1 === true,
    marcos: derivarMarcos(rol?.rol ?? null, nivel?.nivel ?? null, gpai),
    perfil: perfilCatalogo(rol?.rol ?? null, nivel?.nivel ?? null),
    pendientes: preguntasVisibles(r)
      .filter((p) => typeof r[p.id] !== "boolean")
      .map((p) => p.id),
  };
}

/** Mínimo que la spec exige para que una motivación del art. 6.3 cuente como tal. */
export const MINIMO_MOTIVACION_ART63 = 40;

export function bloqueosParaConfirmar(
  r: Respuestas,
  justificacionArt63: string,
  tieneOwner: boolean,
): { bloqueos: string[]; avisos: string[] } {
  const res = resultadoProvisional(r);
  const bloqueos: string[] = [];
  const avisos: string[] = [];
  if (res.bloqueado) {
    bloqueos.push("Este sistema realiza una práctica prohibida por el art. 5 del Reglamento. No puede registrarse.");
  }
  if (res.pendientes.length > 0) {
    bloqueos.push(`Quedan ${res.pendientes.length} preguntas pendientes de responder.`);
  }
  if (res.exigeArt63 && justificacionArt63.trim().length < MINIMO_MOTIVACION_ART63) {
    bloqueos.push(
      "Complete la motivación del art. 6.3: apartarse del anexo III exige documentar la evaluación antes de introducir el sistema en el mercado o ponerlo en servicio.",
    );
  }
  if (!tieneOwner) {
    avisos.push("Este sistema no tiene propietario asignado.");
  }
  return { bloqueos, avisos };
}
