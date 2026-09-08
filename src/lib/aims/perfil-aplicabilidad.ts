/**
 * Qué medidas aplican a QUIÉN.
 *
 * EL PROBLEMA QUE RESUELVE
 * ------------------------
 * El autodiagnóstico medía a todo el mundo contra las mismas 84 medidas guía,
 * que desarrollan los arts. 9 a 15, 17, 72 y 73 del Reglamento (UE) 2024/1689
 * — es decir, las obligaciones del **proveedor de un sistema de alto riesgo**.
 * En el primer piloto real, un despacho que es **responsable del despliegue de
 * un sistema de riesgo limitado** salió al 49 %. Ese número no dice que cumpla
 * a medias: dice que se le ha medido contra obligaciones que no le vinculan.
 *
 * Las obligaciones del Reglamento se determinan por POSICIÓN REGULATORIA y por
 * NIVEL DE RIESGO, no por taxonomía técnica. De ahí el perfil.
 *
 * COBERTURA PROVISIONAL — PENDIENTE DEL COMITÉ DE IA
 * --------------------------------------------------
 * El catálogo del responsable del despliegue de más abajo NO es un dictamen.
 * Sus medidas se derivan de las fuentes que la validación regulatoria del
 * 2026-09-07 nombra expresamente —art. 4, art. 50.1 y 50.4, arts. 28 y 35 del
 * RGPD, gestión de proveedor y cadena de suministro, deontología profesional, y
 * los controles del anexo A de ISO/IEC 42001— y **cada medida dice de dónde
 * sale y con qué carácter**:
 *
 *   - `OBLIGACION`: la norma citada vincula a este rol y nivel de riesgo.
 *   - `MARCO_OPERATIVO`: buena práctica o control de madurez. ISO/IEC 42001 y
 *     las guías de la AESIA se usan como marco de madurez y documentación,
 *     pero **no son obligaciones jurídicas autónomas**; las ejecutables se
 *     anclan en el RIA, el RGPD y el derecho aplicable.
 *
 * La composición final del catálogo es criterio del Comité de IA. Hasta que lo
 * valide, la pantalla lo declara provisional.
 */

import type { RequirementDef } from "./catalog-aesia";
import { ROLES_DE_DESPLIEGUE, perfilCatalogo, type PerfilCatalogo } from "./cuestionario-calificacion";

export type FuenteMedida = "RIA" | "RGPD" | "ISO_42001" | "DEONTOLOGIA";
export type CaracterMedida = "OBLIGACION" | "MARCO_OPERATIVO";

/** Metadatos de procedencia de una medida del perfil. Clave: código de medida. */
export type ProcedenciaMedida = {
  fuente: FuenteMedida;
  caracter: CaracterMedida;
  norma: string;
};

export const AVISO_COBERTURA_PROVISIONAL =
  "Cobertura provisional — pendiente de validación del Comité de IA";

export const AVISO_SIN_ROL =
  "Este sistema no declara rol regulatorio, así que se mide contra el catálogo del proveedor de un sistema de alto riesgo. Declara el rol en la ficha del sistema para acotar las medidas aplicables.";

export const AVISO_ISO_NO_ES_OBLIGACION =
  "Los controles de ISO/IEC 42001 se presentan como marco operativo de madurez y documentación, no como obligaciones jurídicas autónomas.";

const p = (fuente: FuenteMedida, caracter: CaracterMedida, norma: string): ProcedenciaMedida => ({
  fuente,
  caracter,
  norma,
});

/**
 * Procedencia de cada medida del perfil de responsable del despliegue.
 *
 * Vive en un mapa aparte del catálogo para no ensuciar `RequirementDef`, que es
 * la forma que consumen el wizard y el informe sin cambios.
 */
export const PROCEDENCIA_DESPLIEGUE: Record<string, ProcedenciaMedida> = {
  // Art. 4: vincula a proveedores Y responsables del despliegue, de CUALQUIER
  // nivel de riesgo. Es la obligación más clara del perfil.
  MD_ALF_01: p("RIA", "OBLIGACION", "Art. 4"),
  MD_ALF_02: p("RIA", "OBLIGACION", "Art. 4"),
  MD_ALF_03: p("RIA", "OBLIGACION", "Art. 4"),
  MD_ALF_04: p("RIA", "OBLIGACION", "Art. 4"),
  MD_ALF_05: p("ISO_42001", "MARCO_OPERATIVO", "ISO/IEC 42001, anexo A"),

  MD_TRA_01: p("RIA", "OBLIGACION", "Art. 50.1"),
  MD_TRA_02: p("RIA", "OBLIGACION", "Art. 50.4"),
  MD_TRA_03: p("DEONTOLOGIA", "MARCO_OPERATIVO", "Deontología profesional"),
  MD_TRA_04: p("DEONTOLOGIA", "MARCO_OPERATIVO", "Deontología profesional"),
  MD_TRA_05: p("DEONTOLOGIA", "MARCO_OPERATIVO", "Deontología profesional"),

  MD_PD_01: p("RGPD", "OBLIGACION", "Art. 28 RGPD"),
  MD_PD_02: p("RGPD", "OBLIGACION", "Art. 35 RGPD"),
  MD_PD_03: p("RGPD", "OBLIGACION", "Arts. 5 y 6 RGPD"),
  MD_PD_04: p("RGPD", "OBLIGACION", "Cap. V RGPD"),
  MD_PD_05: p("RGPD", "OBLIGACION", "Art. 30 RGPD"),
  MD_PD_06: p("RGPD", "OBLIGACION", "Arts. 13 y 14 RGPD"),

  MD_CS_01: p("RIA", "OBLIGACION", "Cap. V"),
  MD_CS_02: p("RIA", "OBLIGACION", "Cap. V y anexo XII"),
  MD_CS_03: p("DEONTOLOGIA", "MARCO_OPERATIVO", "Gestión de proveedor"),
  MD_CS_04: p("DEONTOLOGIA", "MARCO_OPERATIVO", "Gestión de proveedor"),
  // Art. 25.1: es la vigilancia que impide convertirse en proveedor sin saberlo.
  MD_CS_05: p("RIA", "OBLIGACION", "Art. 25.1"),
  MD_CS_06: p("DEONTOLOGIA", "MARCO_OPERATIVO", "Gestión de proveedor"),
  MD_CS_07: p("DEONTOLOGIA", "MARCO_OPERATIVO", "Gestión de proveedor"),

  // El art. 26 (obligaciones del responsable del despliegue) vincula sólo en
  // ALTO riesgo. En riesgo limitado estas medidas son marco operativo, y se
  // dice: presentarlas como obligación sería fabricar un deber que no existe.
  MD_SU_01: p("RIA", "MARCO_OPERATIVO", "Art. 26 (aplica en alto riesgo)"),
  MD_SU_02: p("RIA", "MARCO_OPERATIVO", "Art. 26 (aplica en alto riesgo)"),
  MD_SU_03: p("ISO_42001", "MARCO_OPERATIVO", "ISO/IEC 42001, anexo A"),
  MD_SU_04: p("ISO_42001", "MARCO_OPERATIVO", "ISO/IEC 42001, anexo A"),
  MD_SU_05: p("ISO_42001", "MARCO_OPERATIVO", "ISO/IEC 42001, anexo A"),

  MD_GOB_01: p("ISO_42001", "MARCO_OPERATIVO", "ISO/IEC 42001, cláusula 5"),
  MD_GOB_02: p("ISO_42001", "MARCO_OPERATIVO", "ISO/IEC 42001, cláusula 5"),
  MD_GOB_03: p("ISO_42001", "MARCO_OPERATIVO", "ISO/IEC 42001, anexo A"),
  MD_GOB_04: p("ISO_42001", "MARCO_OPERATIVO", "ISO/IEC 42001, anexo A"),
  MD_GOB_05: p("ISO_42001", "MARCO_OPERATIVO", "ISO/IEC 42001, anexo A"),
  MD_GOB_06: p("ISO_42001", "MARCO_OPERATIVO", "ISO/IEC 42001, anexo A"),
  MD_GOB_07: p("ISO_42001", "MARCO_OPERATIVO", "ISO/IEC 42001, anexo A"),
  MD_GOB_08: p("ISO_42001", "MARCO_OPERATIVO", "ISO/IEC 42001, anexo A"),
  MD_GOB_09: p("ISO_42001", "MARCO_OPERATIVO", "ISO/IEC 42001, anexo A"),
  MD_GOB_10: p("ISO_42001", "MARCO_OPERATIVO", "ISO/IEC 42001, cláusula 9.3"),

  MD_INC_01: p("ISO_42001", "MARCO_OPERATIVO", "ISO/IEC 42001, anexo A"),
  MD_INC_02: p("ISO_42001", "MARCO_OPERATIVO", "ISO/IEC 42001, anexo A"),
  MD_INC_03: p("RIA", "MARCO_OPERATIVO", "Arts. 73 RIA y 33 RGPD (según el caso)"),
  MD_INC_04: p("RGPD", "OBLIGACION", "Art. 33 RGPD"),
  MD_INC_05: p("ISO_42001", "MARCO_OPERATIVO", "ISO/IEC 42001, anexo A"),
};

/**
 * Catálogo del responsable del despliegue.
 *
 * Misma forma que `AESIA_RIA_REQUIREMENTS` a propósito: el wizard y el informe
 * lo consumen sin cambiar una línea.
 */
export const DESPLIEGUE_REQUIREMENTS: RequirementDef[] = [
  {
    code: "ALFABETIZACION",
    title: "Alfabetización en materia de IA",
    articleRef: "Art. 4",
    description:
      "Garantizar un nivel suficiente de alfabetización en IA del personal que usa el sistema, teniendo en cuenta sus conocimientos técnicos, su experiencia, su formación, el contexto de uso y las personas sobre las que se usa. Vincula a proveedores y a responsables del despliegue de CUALQUIER nivel de riesgo.",
    subparts: [
      { subpartId: "ALF.PROGRAMA", articleNumber: "Art. 4", titleShort: "Programa de formación", orderIndex: 1 },
      { subpartId: "ALF.CONTEXTO", articleNumber: "Art. 4", titleShort: "Adecuación al perfil y al contexto", orderIndex: 2 },
    ],
    measures: [
      { id: "MD_ALF_01", code: "MD_ALF_01", description: "Programa de formación en IA para todo el personal que usa el sistema, con alcance nominal", subpartId: "ALF.PROGRAMA" },
      { id: "MD_ALF_02", code: "MD_ALF_02", description: "Adecuación del programa a los conocimientos técnicos, la experiencia y la formación previa de cada perfil", subpartId: "ALF.CONTEXTO" },
      { id: "MD_ALF_03", code: "MD_ALF_03", description: "Formación específica del contexto de uso del sistema y de sus límites conocidos", subpartId: "ALF.CONTEXTO" },
      { id: "MD_ALF_04", code: "MD_ALF_04", description: "Consideración de las personas o colectivos sobre los que se usa el sistema", subpartId: "ALF.CONTEXTO" },
      { id: "MD_ALF_05", code: "MD_ALF_05", description: "Registro de asistencia y de aprovechamiento conservado como evidencia", subpartId: "ALF.PROGRAMA" },
    ],
  },
  {
    code: "TRANSPARENCIA",
    title: "Transparencia frente a las personas",
    articleRef: "Art. 50",
    description:
      "Obligaciones de transparencia de determinados sistemas de IA: informar de que se interactúa con una IA y marcar el contenido generado o manipulado artificialmente.",
    subparts: [
      { subpartId: "TRA.INTERACCION", articleNumber: "Art. 50.1", titleShort: "Interacción con personas físicas", orderIndex: 1 },
      { subpartId: "TRA.CONTENIDO", articleNumber: "Art. 50.4", titleShort: "Marcado del contenido generado", orderIndex: 2 },
      { subpartId: "TRA.CLIENTE", articleNumber: "Deontología", titleShort: "Información al cliente y revisión humana", orderIndex: 3 },
    ],
    measures: [
      { id: "MD_TRA_01", code: "MD_TRA_01", description: "Aviso de interacción con un sistema de IA en las superficies en que atiende a personas físicas", subpartId: "TRA.INTERACCION" },
      { id: "MD_TRA_02", code: "MD_TRA_02", description: "Marcado del contenido generado o manipulado que se publique para informar al público sobre asuntos de interés público", subpartId: "TRA.CONTENIDO" },
      { id: "MD_TRA_03", code: "MD_TRA_03", description: "Información al cliente sobre el uso de IA generativa en el servicio prestado", subpartId: "TRA.CLIENTE" },
      { id: "MD_TRA_04", code: "MD_TRA_04", description: "Revisión humana acreditada antes de cualquier entrega, con constancia de quién revisa", subpartId: "TRA.CLIENTE" },
      { id: "MD_TRA_05", code: "MD_TRA_05", description: "Criterio interno de cuándo la asistencia por IA debe declararse en el propio entregable", subpartId: "TRA.CLIENTE" },
    ],
  },
  {
    code: "PROTECCION_DATOS",
    title: "Protección de datos personales",
    articleRef: "RGPD",
    description:
      "El Reglamento de IA no sustituye al RGPD. Cuando el sistema trata datos personales, la base jurídica, el encargo de tratamiento y la evaluación de impacto siguen siendo exigibles por su propia norma.",
    subparts: [
      { subpartId: "PD.ENCARGO", articleNumber: "Art. 28 RGPD", titleShort: "Encargo de tratamiento", orderIndex: 1 },
      { subpartId: "PD.EIPD", articleNumber: "Art. 35 RGPD", titleShort: "Evaluación de impacto", orderIndex: 2 },
      { subpartId: "PD.LICITUD", articleNumber: "RGPD", titleShort: "Licitud, registro e información", orderIndex: 3 },
    ],
    measures: [
      { id: "MD_PD_01", code: "MD_PD_01", description: "Encargo de tratamiento suscrito con el proveedor del sistema", subpartId: "PD.ENCARGO" },
      { id: "MD_PD_02", code: "MD_PD_02", description: "Evaluación de la necesidad de EIPD y, si procede, su realización antes del tratamiento", subpartId: "PD.EIPD" },
      { id: "MD_PD_03", code: "MD_PD_03", description: "Base jurídica y categorías de datos tratados a través del sistema, documentadas", subpartId: "PD.LICITUD" },
      { id: "MD_PD_04", code: "MD_PD_04", description: "Transferencias internacionales identificadas y amparadas por una garantía adecuada", subpartId: "PD.LICITUD" },
      { id: "MD_PD_05", code: "MD_PD_05", description: "Registro de actividades de tratamiento actualizado con el uso del sistema", subpartId: "PD.LICITUD" },
      { id: "MD_PD_06", code: "MD_PD_06", description: "Información a los interesados sobre el tratamiento asistido por IA", subpartId: "PD.LICITUD" },
    ],
  },
  {
    code: "CADENA_SUMINISTRO",
    title: "Cadena de suministro y gestión del proveedor",
    articleRef: "Cap. V y art. 25",
    description:
      "Trazabilidad del proveedor y de los modelos de uso general en que se apoya el sistema, y vigilancia de las circunstancias que convertirían a la entidad en proveedora.",
    subparts: [
      { subpartId: "CS.MODELOS", articleNumber: "Cap. V", titleShort: "Modelos y documentación del proveedor", orderIndex: 1 },
      { subpartId: "CS.CONTRATO", articleNumber: "Gestión de proveedor", titleShort: "Condiciones y continuidad", orderIndex: 2 },
      { subpartId: "CS.ROL", articleNumber: "Art. 25.1", titleShort: "Vigilancia del cambio de rol", orderIndex: 3 },
    ],
    measures: [
      { id: "MD_CS_01", code: "MD_CS_01", description: "Identificación del proveedor y de los modelos de uso general en que se apoya el sistema", subpartId: "CS.MODELOS" },
      { id: "MD_CS_02", code: "MD_CS_02", description: "Documentación recibida del proveedor sobre capacidades, limitaciones y usos excluidos", subpartId: "CS.MODELOS" },
      { id: "MD_CS_03", code: "MD_CS_03", description: "Condiciones contractuales sobre el uso de los datos aportados para entrenamiento", subpartId: "CS.CONTRATO" },
      { id: "MD_CS_04", code: "MD_CS_04", description: "Seguimiento de los cambios de modelo y de versión del servicio contratado", subpartId: "CS.CONTRATO" },
      { id: "MD_CS_05", code: "MD_CS_05", description: "Vigilancia de las tres circunstancias que convertirían a la entidad en proveedora", subpartId: "CS.ROL" },
      { id: "MD_CS_06", code: "MD_CS_06", description: "Niveles de servicio, disponibilidad y plan ante la interrupción del proveedor", subpartId: "CS.CONTRATO" },
      { id: "MD_CS_07", code: "MD_CS_07", description: "Certificaciones e informes de seguridad del proveedor, con su fecha de vigencia", subpartId: "CS.CONTRATO" },
    ],
  },
  {
    code: "SUPERVISION_USO",
    title: "Supervisión humana y uso conforme a la finalidad prevista",
    articleRef: "Art. 26",
    description:
      "El art. 26 vincula al responsable del despliegue de un sistema de ALTO riesgo. En riesgo limitado estas medidas son marco operativo de madurez, no obligación exigible: se conservan porque sostienen la revisión humana que sí exige la deontología profesional.",
    subparts: [
      { subpartId: "SU.FINALIDAD", articleNumber: "Art. 26", titleShort: "Uso conforme a la finalidad prevista", orderIndex: 1 },
      { subpartId: "SU.CALIDAD", articleNumber: "Marco operativo", titleShort: "Calidad y trazabilidad de las salidas", orderIndex: 2 },
    ],
    measures: [
      { id: "MD_SU_01", code: "MD_SU_01", description: "Finalidad prevista declarada y usos excluidos comunicados a quien usa el sistema", subpartId: "SU.FINALIDAD" },
      { id: "MD_SU_02", code: "MD_SU_02", description: "Revisión humana efectiva antes de cualquier decisión o entrega al cliente", subpartId: "SU.FINALIDAD" },
      { id: "MD_SU_03", code: "MD_SU_03", description: "Muestreo periódico de la calidad de las salidas y métricas de error", subpartId: "SU.CALIDAD" },
      { id: "MD_SU_04", code: "MD_SU_04", description: "Canal interno para comunicar fallos, alucinaciones o usos indebidos", subpartId: "SU.CALIDAD" },
      { id: "MD_SU_05", code: "MD_SU_05", description: "Trazabilidad de los documentos y consultas enviados al sistema", subpartId: "SU.CALIDAD" },
    ],
  },
  {
    code: "GOBERNANZA_AIMS",
    title: "Gobernanza del sistema de gestión de IA",
    articleRef: "ISO/IEC 42001",
    description:
      "Marco operativo de madurez y documentación. NO son obligaciones jurídicas autónomas: las exigibles se anclan en el Reglamento de IA, el RGPD y el derecho aplicable.",
    subparts: [
      { subpartId: "GOB.DIRECCION", articleNumber: "Cláusula 5", titleShort: "Política y responsabilidades", orderIndex: 1 },
      { subpartId: "GOB.OPERACION", articleNumber: "Anexo A", titleShort: "Operación del sistema de gestión", orderIndex: 2 },
      { subpartId: "GOB.REVISION", articleNumber: "Cláusula 9.3", titleShort: "Revisión por la dirección", orderIndex: 3 },
    ],
    measures: [
      { id: "MD_GOB_01", code: "MD_GOB_01", description: "Política de uso de IA aprobada por el órgano competente", subpartId: "GOB.DIRECCION" },
      { id: "MD_GOB_02", code: "MD_GOB_02", description: "Roles y responsabilidades sobre el sistema de gestión de IA asignados nominalmente", subpartId: "GOB.DIRECCION" },
      { id: "MD_GOB_03", code: "MD_GOB_03", description: "Inventario de sistemas de IA mantenido y actualizado", subpartId: "GOB.OPERACION" },
      { id: "MD_GOB_04", code: "MD_GOB_04", description: "Evaluación del impacto del sistema sobre las personas afectadas", subpartId: "GOB.OPERACION" },
      { id: "MD_GOB_05", code: "MD_GOB_05", description: "Gestión del ciclo de vida del sistema, con control de versiones", subpartId: "GOB.OPERACION" },
      { id: "MD_GOB_06", code: "MD_GOB_06", description: "Gobierno de los datos que se usan con el sistema", subpartId: "GOB.OPERACION" },
      { id: "MD_GOB_07", code: "MD_GOB_07", description: "Información a las partes interesadas sobre el uso de IA", subpartId: "GOB.OPERACION" },
      { id: "MD_GOB_08", code: "MD_GOB_08", description: "Definición del uso responsable y aceptable del sistema", subpartId: "GOB.OPERACION" },
      { id: "MD_GOB_09", code: "MD_GOB_09", description: "Gestión de proveedores y terceros del sistema de gestión de IA", subpartId: "GOB.OPERACION" },
      { id: "MD_GOB_10", code: "MD_GOB_10", description: "Revisión por la dirección y auditoría interna del sistema de gestión", subpartId: "GOB.REVISION" },
    ],
  },
  {
    code: "INCIDENTES_IA",
    title: "Incidentes y respuesta",
    articleRef: "Art. 73 RIA y art. 33 RGPD",
    description:
      "Registro y respuesta ante incidentes del sistema. El art. 73 impone la notificación de incidentes graves al PROVEEDOR de un sistema de alto riesgo; el art. 33 del RGPD impone la notificación de brechas de datos personales en 72 horas a quien sea responsable del tratamiento.",
    subparts: [
      { subpartId: "INC.PROCESO", articleNumber: "Marco operativo", titleShort: "Registro y escalado", orderIndex: 1 },
      { subpartId: "INC.NOTIFICACION", articleNumber: "Art. 33 RGPD", titleShort: "Notificación cuando procede", orderIndex: 2 },
    ],
    measures: [
      { id: "MD_INC_01", code: "MD_INC_01", description: "Procedimiento de registro de incidentes de IA integrado con el registro general", subpartId: "INC.PROCESO" },
      { id: "MD_INC_02", code: "MD_INC_02", description: "Criterio de escalado y responsables designados", subpartId: "INC.PROCESO" },
      { id: "MD_INC_03", code: "MD_INC_03", description: "Evaluación, por incidente, de qué régimen activa: Reglamento de IA, RGPD u otro", subpartId: "INC.NOTIFICACION" },
      { id: "MD_INC_04", code: "MD_INC_04", description: "Notificación de brecha de datos personales dentro de las 72 horas cuando proceda", subpartId: "INC.NOTIFICACION" },
      { id: "MD_INC_05", code: "MD_INC_05", description: "Registro de causa raíz y de acción correctiva de cada incidente", subpartId: "INC.PROCESO" },
    ],
  },
];

export type PerfilAplicabilidad = {
  /** El catálogo que hay que evaluar. */
  requirements: RequirementDef[];
  /** Etiqueta corta del perfil, para la pantalla. */
  etiqueta: string;
  /** Por qué se aplica este catálogo y no otro. */
  motivo: string;
  /** `true` cuando el catálogo no está validado por el Comité de IA. */
  provisional: boolean;
  /** `true` cuando no hay rol declarado y se cae al catálogo de proveedor. */
  sinRolDeclarado: boolean;
  /**
   * Perfil A/B/C del cuestionario guiado (spec v1.1). `null` sin rol, sin nivel
   * o en Inaceptable. El perfil dice QUIÉN es y CUÁNTO riesgo hay; el catálogo
   * que se mide sale de aquí y del criterio de abajo, no al revés.
   */
  catalogProfile: PerfilCatalogo | null;
};


/**
 * Elige el catálogo aplicable a un sistema.
 *
 * FAIL-OPEN A PROPÓSITO: sin rol declarado se cae al catálogo COMPLETO del
 * proveedor de alto riesgo, no a uno reducido. Medir de más y decirlo es
 * conservador; medir de menos por un dato que falta esconde obligaciones.
 */
export function perfilAplicable(
  sistema: { regulatory_role?: string | null; risk_level?: string | null } | null | undefined,
  catalogoProveedor: RequirementDef[],
): PerfilAplicabilidad {
  const rol = (sistema?.regulatory_role ?? "").trim();
  const nivel = (sistema?.risk_level ?? "").trim();

  if (!rol) {
    return {
      requirements: catalogoProveedor,
      etiqueta: "Proveedor de sistema de alto riesgo",
      motivo: AVISO_SIN_ROL,
      provisional: false,
      sinRolDeclarado: true,
      catalogProfile: null,
    };
  }

  // Alto riesgo o inaceptable: el catálogo completo, sea cual sea el rol. No se
  // reduce nada donde el Reglamento es más exigente.
  if (nivel === "Alto" || nivel === "Inaceptable" || nivel === "") {
    const perfilB = nivel === "Alto" && ROLES_DE_DESPLIEGUE.has(rol);
    return {
      requirements: catalogoProveedor,
      etiqueta: "Proveedor de sistema de alto riesgo",
      motivo:
        nivel === ""
          ? "El sistema no declara nivel de riesgo: se mide contra el catálogo completo."
          : perfilB
            // S-6 de la validación de la spec: no hay catálogo validado para el
            // responsable del despliegue de alto riesgo (arts. 26 y 27, RGPD) y
            // componerlo es del Comité de IA. Medir de más y decirlo es conservador.
            ? "Responsable del despliegue de alto riesgo: no hay catálogo validado para este perfil, así que se mide contra el catálogo completo del proveedor (arts. 9 a 15 y 17) y se dice."
            : `Nivel de riesgo «${nivel}»: se mide contra el catálogo completo de los arts. 9 a 15 y 17.`,
      provisional: false,
      sinRolDeclarado: false,
      catalogProfile: perfilCatalogo(rol, nivel),
    };
  }

  if (ROLES_DE_DESPLIEGUE.has(rol)) {
    return {
      requirements: DESPLIEGUE_REQUIREMENTS,
      etiqueta: `Responsable del despliegue · riesgo ${nivel.toLowerCase()}`,
      motivo:
        "Las 84 medidas guía desarrollan las obligaciones del PROVEEDOR de un sistema de alto riesgo (arts. 9 a 15, 17, 72 y 73). Este perfil se mide contra las que sí vinculan a esta posición regulatoria.",
      provisional: true,
      sinRolDeclarado: false,
      catalogProfile: perfilCatalogo(rol, nivel),
    };
  }

  // Proveedor —de sistema o de modelo— en riesgo limitado o mínimo: el catálogo
  // completo sigue siendo el suyo, aunque muchas medidas queden en L8.
  return {
    requirements: catalogoProveedor,
    etiqueta: "Proveedor de sistema de alto riesgo",
    motivo:
      "El rol declarado es de proveedor: se mide contra el catálogo completo, aunque parte de las medidas puedan resultar no aplicables al caso.",
    provisional: false,
    sinRolDeclarado: false,
    catalogProfile: perfilCatalogo(rol, nivel),
  };
}

/** Procedencia de una medida, si el perfil la declara. */
export function procedenciaDe(measureId: string): ProcedenciaMedida | null {
  return PROCEDENCIA_DESPLIEGUE[measureId] ?? null;
}

/**
 * Con qué catálogo se evaluó una fila ya guardada.
 *
 * El informe elegía el catálogo por `framework`, que sólo distingue RIA de ISO.
 * Desde que hay perfil por rol, dos evaluaciones con `framework = EU_AI_ACT`
 * pueden venir de catálogos distintos, y pintar la de un responsable del
 * despliegue contra las 84 medidas del proveedor mostraría 84 «Pendiente» y
 * ninguna de las 43 respondidas.
 *
 * Se resuelve por el DATO —qué códigos reconcilia cada candidato— y no por una
 * columna que no lo dice. Empate o cero coincidencias: el primero, que es el
 * que corresponde al marco.
 */
export function catalogoDeLosFindings(
  findings: { code?: string | null }[] | null | undefined,
  candidatos: RequirementDef[][],
): RequirementDef[] {
  const codigos = new Set((findings ?? []).map((f) => f.code).filter(Boolean) as string[]);
  if (codigos.size === 0 || candidatos.length === 0) return candidatos[0] ?? [];

  let mejor = candidatos[0];
  let mejorAciertos = -1;
  for (const cat of candidatos) {
    const aciertos = cat.reduce(
      (n, r) => n + r.measures.filter((m) => codigos.has(m.id)).length,
      0,
    );
    if (aciertos > mejorAciertos) {
      mejorAciertos = aciertos;
      mejor = cat;
    }
  }
  return mejor;
}
