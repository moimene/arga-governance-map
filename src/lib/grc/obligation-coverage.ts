// ───────── Marco prospectivo: criterio ÚNICO de cobertura de una obligación ─────────
//
// Vivía exportado desde `src/pages/ObligacionesList.tsx`, y por eso el arreglo
// llegó a UNA pantalla y no a sus dos hermanas: `ObligacionDetalle` seguía
// pintando «SIN COBERTURA» en rojo y la pestaña Obligaciones de
// `PoliticaDetalle` lo mismo, sobre LAS MISMAS dos filas. Es el patrón de
// retirada a medias por pantalla hermana, y la cura es que el criterio no
// tenga dueño: vive aquí y las tres lo importan.
//
// El seed marca así las obligaciones de un marco AÚN NO EXIGIBLE (las dos de
// NIS2 del tenant Garrigues, pendiente de transposición en España). El marcador
// viaja EN EL TÍTULO porque `obligations` no tiene columna para él: medido
// read-only contra Cloud el 2026-09-07, la tabla tiene 14 columnas y ninguna es
// `prospectiva`. Eso es deuda Cloud declarada, no elegancia. ARGA no tiene
// ninguna obligación marcada: cero cambio para ese tenant.
//
// MOI-160 (D-G1, decisión de producto, opción a): esto mide EFECTIVIDAD DE
// CONTROL de una obligación, no MADUREZ de una medida de AIMS
// (`@/lib/aims/conformidad`). Son dos medidas distintas a propósito — el
// mismo hecho (p. ej. el art. 4 RIA de alfabetización) puede salir "SIN
// CONTROL" aquí y acreditar allí sin que eso sea una contradicción que
// arreglar. No importar ese módulo desde aquí, ni al revés: fundirlos exige
// una decisión nueva, no un import.
// Vigilado por `src/test/grc/criterio-cubierto-aims-vs-grc.test.ts`.
const PROSPECTIVE_TITLE_RE = /^\s*\[Marco Prospectivo\]/i;

export const isProspectiveTitle = (title: string) => PROSPECTIVE_TITLE_RE.test(title);

export type ObligationCoverage = {
  label: string;
  tone: "active" | "warning" | "critical" | "neutral";
  pulse: boolean;
};

/** La decisión, sin React, para poder probarla contra los títulos reales. */
export function obligationCoverage(title: string, controlStatuses: string[]): ObligationCoverage {
  // Un marco no exigible todavía no se mide contra controles: ni cubierto ni
  // incumplido. Neutro y sin pulso; no entra en ningún KPI de cobertura.
  if (isProspectiveTitle(title)) return { label: "MARCO PROSPECTIVO", tone: "neutral", pulse: false };
  if (controlStatuses.length === 0) return { label: "SIN CONTROL", tone: "critical", pulse: true };
  // Deuda conocida y consciente (decisión del usuario): "Deficiente" no es un
  // valor real del CHECK de controls.status (real: Efectivo | Parcial |
  // Inefectivo), así que esta rama nunca se activa. ARGA tiene un control real
  // con status="Inefectivo" (CTR-008) que por eso cae en el fallback "EN
  // PROCESO" en vez de mostrarse como estado crítico propio. Se conserva
  // deliberadamente para no alterar la demo del 21/07; no es hallazgo nuevo.
  if (controlStatuses.some((st) => st === "Deficiente")) return { label: "DEFICIENTE", tone: "critical", pulse: false };
  if (controlStatuses.some((st) => st === "Parcial")) return { label: "EN REMEDIACIÓN", tone: "warning", pulse: false };
  if (controlStatuses.every((st) => st === "Efectivo")) return { label: "CUBIERTA", tone: "active", pulse: false };
  return { label: "EN PROCESO", tone: "warning", pulse: false };
}
