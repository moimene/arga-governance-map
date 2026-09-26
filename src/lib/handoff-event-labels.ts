/**
 * Nombre legible de un evento de derivación cross-módulo (AIMS/GRC/Secretaría).
 *
 * Módulo HOJA compartido: no importa nada, para que GRC (`Dashboard.tsx`,
 * `Risk360.tsx`) y Secretaría (`ReunionStepper.tsx`) puedan pintar el mismo
 * nombre legible sin arrastrar el código crudo (`GRC_INCIDENT_MATERIAL`,
 * `AIMS_TECHNICAL_FILE_GAP`…) a pantalla. MOI-157: la jerga se llama
 * «derivación», nunca «intake» ni «handoff», en las pantallas que la reciben.
 */
const HANDOFF_EVENT_LABELS: Record<string, string> = {
  GRC_INCIDENT_MATERIAL: "incidente material",
  GRC_FINDING_BOARD_ESCALATION: "hallazgo crítico",
  GRC_EXCEPTION_MATERIAL: "excepción material",
  AIMS_TECHNICAL_FILE_GAP: "brecha en expediente técnico",
  AIMS_INCIDENT_MATERIAL: "incidente de IA material",
  AIMS_SYSTEM_CONFORMITY: "conformidad de sistema IA",
  SECRETARIA_CERTIFICATION_ISSUED: "certificación emitida",
};

export function handoffEventLabel(code?: string | null): string {
  if (!code) return "señal recibida";
  if (HANDOFF_EVENT_LABELS[code]) return HANDOFF_EVENT_LABELS[code];
  return code
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
