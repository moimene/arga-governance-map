// src/lib/sii/roles-por-tenant.ts
//
// Quién instruye, quién es propietario del subexpediente y qué órgano resuelve
// una recusación — POR TENANT y en UN SOLO SITIO.
//
// POR QUÉ EXISTE: la instructora estaba cableada en tres sitios distintos
// (`useCreateWhistleblowingReport`, el `ownerName` del subexpediente y el
// `approvedBy` de la recusación) con el nombre de "Dña. Elena Navarro Pons",
// que es una fila real de `persons` del tenant ARGA — verificado en Cloud el
// 2026-09-05. Cualquier tenant que registrase una comunicación se la atribuía
// a ella. Y el selector de causas de recusación ofrecía la "Comisión de
// Auditoría", órgano que en Garrigues NO EXISTE.
//
// Regla: si para un tenant no consta designación, la pantalla dice que el rol
// está PENDIENTE DE DESIGNACIÓN. No se inventa una persona ni se hereda la de
// otro tenant.

import { ORGANOS_SII_POR_DEFECTO, type OrganosSii } from "./whistleblowing-engine";
import { SII_ORGANOS_GARRIGUES, SII_TENANT } from "../../../scripts/garrigues/sii/canal-interno";

const ARGA_TENANT = "00000000-0000-0000-0000-000000000001";

export interface SiiRolesTenant {
  /** Falso cuando el módulo no tiene designación para este tenant. */
  hayDesignacion: boolean;
  instructorId: string;
  /** Cargo o persona designada. Nunca la de otro tenant. */
  instructorName: string;
  /** Propietario por defecto de un subexpediente sin rol regulatorio propio. */
  ownerName: string;
  /** Quién resuelve la sustitución del instructor recusado. */
  organoAprobadorRecusacion: string;
  /** Etiqueta de la causa de recusación por afectación a la cúpula. */
  causaCupulaLabel: string;
  /** Política del tenant que designa los roles. `null` = no consta. */
  politicaDesignacion: string | null;
  organos: OrganosSii;
}

/** Órganos neutros para un tenant sin designación: nunca los de ARGA. */
const ORGANOS_SIN_DESIGNAR: OrganosSii = {
  comiteCumplimientoPenal: "Órgano de cumplimiento pendiente de designación / Posible remisión a Fiscalía",
  comiteCumplimiento: "Órgano de cumplimiento pendiente de designación",
  organoEscalado: "el órgano de administración, en tanto no conste designado el Responsable del Sistema",
};

export const SII_ROL_PENDIENTE = "Pendiente de designación";

export function siiRolesPara(tenantId: string | null | undefined): SiiRolesTenant {
  if (tenantId === ARGA_TENANT) {
    // Datos demo de ARGA. Se conservan tal cual estaban: cero cambio ARGA.
    return {
      hayDesignacion: true,
      instructorId: "inv-001",
      instructorName: "Dña. Elena Navarro Pons",
      ownerName: "Dña. Elena Navarro Pons",
      organoAprobadorRecusacion: "Comité de Cumplimiento e Independencia",
      // Literal de lo que ARGA ya veía. Cero cambio.
      causaCupulaLabel: "Afectación a Alta Dirección o Consejo (Comisión Auditoría)",
      politicaDesignacion: null,
      organos: ORGANOS_SII_POR_DEFECTO,
    };
  }

  if (tenantId === SII_TENANT) {
    // Literal de PI-31: el Instructor es un CARGO (Anexo §2.a) y el
    // Responsable es un órgano UNIPERSONAL, el Senior Partner (§4). No hay
    // comisión que apruebe nada.
    return {
      hayDesignacion: true,
      instructorId: "rol-instructor-sii",
      instructorName: "Directora de Cumplimiento Normativo (PI-31, Anexo §2.a)",
      ownerName: "Senior Partner (PI-31 §4)",
      organoAprobadorRecusacion: "Responsable del SII (Senior Partner) (PI-31, Anexo §2.a)",
      causaCupulaLabel: "Afectación al Responsable del SII o al órgano de administración (PI-31 §4)",
      politicaDesignacion: "PI-31 §4",
      organos: SII_ORGANOS_GARRIGUES,
    };
  }

  return {
    hayDesignacion: false,
    instructorId: "sin-designar",
    instructorName: SII_ROL_PENDIENTE,
    ownerName: SII_ROL_PENDIENTE,
    organoAprobadorRecusacion: SII_ROL_PENDIENTE,
    causaCupulaLabel: "Afectación al órgano de administración o a la alta dirección",
    politicaDesignacion: null,
    organos: ORGANOS_SIN_DESIGNAR,
  };
}
