/**
 * Expediente técnico del art. 11 y anexo IV del Reglamento (UE) 2024/1689.
 *
 * Un solo criterio, en un sitio, para las tres cosas que la ficha del sistema
 * necesita saber: qué secciones tiene un expediente que nace vacío, a quién
 * vincula el art. 11, y cómo se lee el estado de una sección.
 *
 * El esqueleto sigue los nueve puntos del anexo IV con el prefijo `AIV-` que ya
 * usan las filas sembradas de ARGA (`AIV-01`…`AIV-04`); esas filas no se tocan.
 */
import { derivarMarcos } from "./cuestionario-calificacion";

export type SeccionAnexoIV = { code: string; titulo: string; anexo: string };

export const ANEXO_IV_SECCIONES: SeccionAnexoIV[] = [
  { code: "AIV-01", anexo: "Anexo IV.1", titulo: "Descripción general del sistema de IA" },
  { code: "AIV-02", anexo: "Anexo IV.2", titulo: "Descripción detallada de los elementos y del proceso de desarrollo" },
  { code: "AIV-03", anexo: "Anexo IV.3", titulo: "Seguimiento, funcionamiento y control del sistema" },
  { code: "AIV-04", anexo: "Anexo IV.4", titulo: "Adecuación de las métricas de rendimiento" },
  { code: "AIV-05", anexo: "Anexo IV.5", titulo: "Sistema de gestión de riesgos (art. 9)" },
  { code: "AIV-06", anexo: "Anexo IV.6", titulo: "Cambios a lo largo del ciclo de vida" },
  { code: "AIV-07", anexo: "Anexo IV.7", titulo: "Normas armonizadas y especificaciones aplicadas" },
  { code: "AIV-08", anexo: "Anexo IV.8", titulo: "Declaración UE de conformidad (art. 47)" },
  { code: "AIV-09", anexo: "Anexo IV.9", titulo: "Sistema de vigilancia poscomercialización (art. 72)" },
];

/**
 * ¿El art. 11 (documentación técnica) vincula a este sistema?
 *
 * `true`: proveedor de un sistema de alto riesgo (los marcos derivados incluyen
 * los arts. 9–15). `false`: rol y nivel declarados y no es ese caso: el
 * expediente es marco operativo, no obligación. `null`: sin rol o sin nivel no
 * se afirma nada — la pantalla lo dice y ofrece clasificar.
 */
export function vinculaArt11(
  rol: string | null | undefined,
  nivel: string | null | undefined,
): boolean | null {
  if (!rol || !nivel) return null;
  return derivarMarcos(rol, nivel, false).some((m) => m.code === "RIA_ARTS_9_15");
}

/**
 * `aims_technical_file_sections.status` no tiene CHECK y en Cloud conviven el
 * inglés del diseño y el castellano que el seed escribió. Se reconocen los dos,
 * normalizados; lo desconocido se devuelve tal cual y la pantalla lo pinta
 * neutro — nunca como borrador ni como conforme, que afirmarían un estado.
 */
export const ESTADOS_SECCION = ["PENDING", "IN_REVIEW", "APPROVED", "NON_CONFORMING", "SEALED"] as const;
export type EstadoSeccion = (typeof ESTADOS_SECCION)[number];

const ALIAS_ESTADO_SECCION: Record<string, EstadoSeccion> = {
  PENDIENTE: "PENDING",
  DRAFT: "PENDING",
  EN_REVISION: "IN_REVIEW",
  CONFORME: "APPROVED",
  NO_CONFORME: "NON_CONFORMING",
};

export function normalizarEstadoSeccion(status: string | null | undefined): EstadoSeccion | string {
  const s = (status ?? "").trim().toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "_");
  if ((ESTADOS_SECCION as readonly string[]).includes(s)) return s as EstadoSeccion;
  return ALIAS_ESTADO_SECCION[s] ?? (status ?? "");
}

export const ETIQUETA_ESTADO_SECCION: Record<EstadoSeccion, string> = {
  PENDING: "Pendiente",
  IN_REVIEW: "En revisión",
  APPROVED: "Conforme",
  NON_CONFORMING: "No conforme",
  SEALED: "Cerrada",
};

export function etiquetaEstadoSeccion(status: string | null | undefined): string {
  const n = normalizarEstadoSeccion(status);
  return (ETIQUETA_ESTADO_SECCION as Record<string, string>)[n] ?? (status ?? "Sin estado");
}
