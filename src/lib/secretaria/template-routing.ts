import type { PlantillaProtegidaRow } from "@/hooks/usePlantillasProtegidas";
import { resolveAdoptionRoute } from "./adoption-routing";
import { selectTemplateProcessEntry } from "./template-process-matrix";

export interface TemplateUsageTarget {
  to: string;
  label: string;
  hint: string;
}

function safeString(value: unknown, fallback = "") {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return fallback;
  return String(value);
}

export function getTemplateUsageTarget(plantilla: PlantillaProtegidaRow): TemplateUsageTarget {
  const templateParam = `plantilla=${encodeURIComponent(plantilla.id)}`;
  const tipo = safeString(plantilla.tipo, "PLANTILLA");
  const entry = selectTemplateProcessEntry(plantilla);

  if (entry?.processId === "tramitador_acuerdo") {
    // Un MODELO_ACUERDO alimenta la ADOPCIÓN del acuerdo (convocatoria, sin
    // sesión o decisión unipersonal según su forma de adopción), no la fase
    // registral: el tramitador exige un acuerdo ya adoptado o certificado.
    const target = resolveAdoptionRoute({
      materia: plantilla.materia_acuerdo ?? plantilla.materia ?? "",
      adoptionModes: plantilla.adoption_mode ? [plantilla.adoption_mode] : null,
      plantillaId: plantilla.id,
    });
    return {
      to: target.to,
      label: "Iniciar adopción",
      hint: `${target.hint} El modelo se aplicará como propuesta de acuerdo.`,
    };
  }

  if (entry?.processId === "convocatoria") {
    return {
      to: `/secretaria/convocatorias/nueva?${templateParam}`,
      label: "Preparar convocatoria",
      hint: "Abre el flujo de convocatoria, donde la plantilla se aplica con órgano, plazos y orden del día.",
    };
  }

  if (entry?.processId === "certificacion") {
    return {
      to: `/secretaria/actas?${templateParam}&tipo=${encodeURIComponent(tipo)}`,
      label: "Elegir acta",
      hint: "Las certificaciones se generan desde el acta o expediente que certifica acuerdos concretos.",
    };
  }

  if (entry?.processId === "decision_unipersonal") {
    return {
      to: `/secretaria/decisiones-unipersonales?${templateParam}&tipo=${encodeURIComponent(tipo)}`,
      label: "Elegir decisión",
      hint: "Las actas de consignación nacen desde una decisión del socio único o del administrador único.",
    };
  }

  if (entry?.processId === "acuerdo_sin_sesion") {
    const adoptionMode = safeString(plantilla.adoption_mode).trim().toUpperCase();
    const route =
      adoptionMode === "CO_APROBACION"
        ? "/secretaria/acuerdos-sin-sesion/co-aprobacion"
        : adoptionMode === "SOLIDARIO"
          ? "/secretaria/acuerdos-sin-sesion/solidario"
          : "/secretaria/acuerdos-sin-sesion/nuevo";
    return {
      to: `${route}?${templateParam}&tipo=${encodeURIComponent(tipo)}`,
      label: "Elegir acuerdo",
      hint: "El acta escrita se genera desde el expediente sin sesión para conservar respuestas, plazos y traza.",
    };
  }

  if (entry?.processId === "acta") {
    return {
      to: `/secretaria/actas?${templateParam}&tipo=${encodeURIComponent(tipo)}`,
      label: "Elegir acta",
      hint: "Las actas necesitan una reunión, decisión o acuerdo ya registrado para resolver variables y evidencia.",
    };
  }

  if (entry?.processId === "tramitador_registral") {
    return {
      to: `/secretaria/tramitador?${templateParam}&tipo=${encodeURIComponent(tipo)}`,
      label: "Elegir trámite",
      hint: "Los documentos registrales se preparan desde un acuerdo 360 certificado o adoptado.",
    };
  }

  if (entry?.processId === "informe_pre") {
    return {
      to: `/secretaria/convocatorias?${templateParam}&tipo=${encodeURIComponent(tipo)}`,
      label: "Elegir convocatoria",
      hint: "El informe PRE se genera desde una convocatoria o expediente con traza de reglas y documentos.",
    };
  }

  if (tipo === "INFORME_GESTION") {
    return {
      to: `/secretaria/actas?${templateParam}&tipo=${encodeURIComponent(tipo)}`,
      label: "Elegir expediente",
      hint: "El informe de gestión requiere expediente o acta con datos de cierre y cuentas.",
    };
  }

  return {
    to: `/secretaria/tramitador?${templateParam}&tipo=${encodeURIComponent(tipo)}`,
    label: "Elegir expediente",
    hint: "Selecciona el proceso concreto antes de generar el documento final.",
  };
}
