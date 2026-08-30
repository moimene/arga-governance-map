// scripts/garrigues/sii/casos-demo.ts
//
// Tres comunicaciones demo del Canal Interno de Garrigues.
//
// **Los tres son SIMULADOS y se dice en pantalla.** La materia sí es real —son
// las tres vías que la normativa del despacho contempla de verdad—, pero los
// hechos no han ocurrido: ni PI-31 ni el Manual PBC/FT publican un registro de
// comunicaciones, y no lo van a publicar, porque la Ley 2/2023 impone
// confidencialidad reforzada sobre ellas.
//
// Ninguno nombra a una persona. El informante es anónimo o un alias, y las
// personas implicadas se describen por rol. El censo de Garrigues son 406
// personas físicas con nombre real: atribuirle a una de ellas una denuncia
// —aunque fuera «de mentira»— es exactamente el daño que este carril tiene
// prohibido causar.
//
// Materias, con su fundamento:
//  1. PBC/FT — Garrigues es sujeto obligado por la Ley 10/2010, y PI-31 §3
//     nombra el SEPBLAC como canal externo para esos hechos.
//  2. Conflicto de intereses con cliente — PI-02 §2.1 «en sentido estricto».
//  3. Acoso — hay protocolo propio, el de medidas para la igualdad de las
//     personas LGTBI, ya sembrado en G4.

import { SII_ORGANOS_GARRIGUES } from "./canal-interno";

export const CASOS_DEMO_TENANT = "00000000-0000-0000-0002-000000000001";

/** Marca de procedencia. La pantalla la muestra; el test la exige. */
export const CASOS_DEMO_FIRMEZA = "DEMO_PILOTO" as const;

export const CASOS_DEMO_AVISO =
  "Comunicaciones simuladas. La materia de las tres corresponde a vías que la normativa del " +
  "despacho contempla, pero los hechos no han ocurrido: ni la Política del SII ni el Manual de " +
  "PBC/FT publican un registro de comunicaciones, y la Ley 2/2023 impone confidencialidad " +
  "reforzada sobre ellas. Ninguna se atribuye a una persona identificada.";

type CasoDemo = {
  readonly code: string;
  readonly materia: string;
  readonly fundamento: string;
  readonly category: string;
  readonly severity: "LEVE" | "GRAVE" | "MUY_GRAVE";
  readonly status: string;
  readonly channel: string;
  readonly anonymityMode: string;
  readonly summary: string;
  readonly detailedDescription: string;
  /** Destinatario del subexpediente, de los órganos reales de PI-31. */
  readonly destino: string;
  readonly firmeza: typeof CASOS_DEMO_FIRMEZA;
};

export const CASOS_DEMO_GARRIGUES: readonly CasoDemo[] = [
  {
    code: "SII-GARR-2026-001",
    materia: "PBC/FT",
    fundamento: "Ley 10/2010; canal externo SEPBLAC (PI-31 §3)",
    category: "Prevención del blanqueo de capitales",
    severity: "GRAVE",
    status: "EN_INVESTIGACION",
    channel: "WEB_ANONIMO",
    anonymityMode: "ANONIMO_ESTRICTO",
    summary:
      "Se comunica que en un encargo no se completó la diligencia debida sobre el titular real " +
      "antes de iniciar la prestación del servicio.",
    detailedDescription:
      "La comunicación señala que la documentación de identificación se solicitó con el encargo " +
      "ya en curso. Se recuerda que la vía externa ante el SEPBLAC está abierta y no requiere " +
      "agotar antes el canal interno.",
    destino: SII_ORGANOS_GARRIGUES.comiteCumplimiento,
    firmeza: CASOS_DEMO_FIRMEZA,
  },
  {
    code: "SII-GARR-2026-002",
    materia: "Conflicto de intereses",
    fundamento: "PI-02 §2.1, conflicto en sentido estricto",
    category: "Conflicto de interés con cliente",
    severity: "GRAVE",
    status: "EN_INVESTIGACION",
    channel: "WEB_IDENTIFICADO",
    anonymityMode: "CONFIDENCIAL",
    summary:
      "Se comunica que un encargo se aceptó sin que constara el chequeo de conflictos, siendo " +
      "la contraparte cliente del despacho en otro asunto en curso.",
    detailedDescription:
      "La comunicación afecta al procedimiento de aceptación, no a una persona concreta: lo que " +
      "se cuestiona es que el chequeo previsto en la política no dejó rastro documental.",
    destino: SII_ORGANOS_GARRIGUES.comiteCumplimiento,
    firmeza: CASOS_DEMO_FIRMEZA,
  },
  {
    code: "SII-GARR-2026-003",
    materia: "Acoso",
    fundamento:
      "Protocolo de medidas para la igualdad de las personas LGTBI y prevención del acoso",
    category: "Conducta y clima laboral",
    severity: "MUY_GRAVE",
    status: "ADMITIDA",
    channel: "WEB_ANONIMO",
    anonymityMode: "ANONIMO_ESTRICTO",
    summary:
      "Se comunican comentarios reiterados de contenido discriminatorio en un equipo, con " +
      "solicitud expresa de tramitación por el protocolo específico.",
    detailedDescription:
      "El protocolo aplicable tiene procedimiento propio. La comunicación se registra en el " +
      "Canal Interno y se deriva sin que ello suspenda los plazos de la Ley 2/2023.",
    // El acoso puede afectar a personas del propio circuito, así que el
    // escalado con su salida por conflicto es el destino correcto.
    destino: SII_ORGANOS_GARRIGUES.organoEscalado,
    firmeza: CASOS_DEMO_FIRMEZA,
  },
] as const;

/**
 * Los tres casos en la forma que consume el módulo.
 *
 * Se construyen desde el catálogo de arriba y no al revés: la materia, el
 * fundamento y la marca de simulado viven en un solo sitio, así que no pueden
 * desincronizarse de lo que se muestra.
 *
 * `assignedInvestigatorName` es el CARGO —la Directora de Cumplimiento
 * Normativo, PI-31 Anexo §2.a—, no un nombre de persona. Es el rol el que
 * instruye, y en un expediente simulado poner un nombre sería atribuirle a
 * alguien la instrucción de una denuncia que no existe.
 */
export function casosDemoGarrigues(entityName: string) {
  const INTAKE = "2026-08-14T09:00:00.000Z";
  const ACUSE = "2026-08-18T09:00:00.000Z";      // dentro de los 7 días naturales (art. 9.2.c)
  const LIMITE = "2026-11-14T09:00:00.000Z";     // 3 meses (art. 9.2.d)

  return CASOS_DEMO_GARRIGUES.map((c, i) => ({
    id: `rep-garr-${String(i + 1).padStart(3, "0")}`,
    code: c.code,
    trackingToken: `SEC-GARR-${String(i + 1).padStart(4, "0")}`,
    trackingTokenHash: `SHA256:DEMO:GARR:${String(i + 1).padStart(4, "0")}`,
    intakeDate: INTAKE,
    channel: c.channel,
    anonymityMode: c.anonymityMode,
    informantContact: null,
    entityId: CASOS_DEMO_TENANT,
    entityName,
    jurisdiction: "ES",
    category: c.category,
    severity: c.severity,
    status: c.status,
    summary: c.summary,
    detailedDescription: c.detailedDescription,
    acknowledgmentSentDate: ACUSE,
    resolutionDeadline: LIMITE,
    extensionApproved: false,
    // El cargo, no una persona. Ver comentario de arriba.
    assignedInvestigatorId: "rol-instructor-sii",
    assignedInvestigatorName: "Directora de Cumplimiento Normativo (PI-31, Anexo §2.a)",
    isEscalatedToBoardCommittee: false,
    subcases: [
      {
        id: `sub-garr-${i + 1}-a`,
        reportId: `rep-garr-${String(i + 1).padStart(3, "0")}`,
        regime: "COMPLIANCE_GENERAL",
        label: `Subexpediente — ${c.materia}`,
        authorityTarget: c.destino,
        ownerRole: "Responsable del Sistema Interno de Información",
        ownerName: "Senior Partner (PI-31 §4)",
        status: "EN_INSTRUCCION",
        createdAt: ACUSE,
        requiresIndependentClose: false,
      },
    ],
    messages: [],
    recusations: [],
    evidences: [],
  }));
}
