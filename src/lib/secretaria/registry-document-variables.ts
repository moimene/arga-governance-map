import type { AgreementListRow } from "@/hooks/useAgreementsList";
import { adoptionModeBusinessLabel, matterClassBusinessLabel } from "./mesa-control-societaria";
import { statusLabel } from "./status-labels";
import { labelMateria } from "./agenda-materias";

export interface RegistryInstrumentData {
  notary: string;
  deedDate: string;
  protocolNumber: string;
}

export interface RegistryDocumentContext {
  agreement: AgreementListRow;
  entityName: string;
  legalName: string;
  instrumentData: RegistryInstrumentData;
  filingChannel: string;
  filingStatus: string;
  filingType: string | null;
  instrumentRequired: string;
  registryFilingId?: string | null;
  isSubsanacion?: boolean;
  subsanacionMotivo?: string;
  subsanacionDocs?: string;
}

function formatDateOnlyEs(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return value;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function registryDocumentGeneratedAt(instrumentData: RegistryInstrumentData) {
  return /^\d{4}-\d{2}-\d{2}$/.test(instrumentData.deedDate)
    ? instrumentData.deedDate
    : undefined;
}

export function registryNotaryLabel(notary: string) {
  const value = notary.trim();
  if (!value) return "";
  return /^notar[ií]a\b/i.test(value) ? value : `Notaría ${value}`;
}

function registryInstrumentLabel(value: string) {
  const labels: Record<string, string> = {
    ESCRITURA: "Escritura pública",
    INSTANCIA: "Instancia",
    CERTIFICACION: "Certificación",
  };
  return labels[value] ?? value;
}

function registryProcedureLabel(value: string | null) {
  const labels: Record<string, string> = {
    ESCRITURA: "Inscripción mediante escritura pública",
    INSTANCIA: "Presentación mediante instancia",
    CERTIFICACION: "Presentación mediante certificación",
    ACTO_INSCRIBIBLE: "Inscripción del acuerdo",
    DEPOSITO_CUENTAS: "Depósito de cuentas anuales",
    LEGALIZACION_LIBROS: "Legalización de libros",
  };
  return value ? labels[value] ?? value : "";
}

function registryChannelLabel(value: string) {
  const labels: Record<string, string> = {
    REGISTRO_MERCANTIL: "Registro Mercantil (España)",
    SIGER_PSM: "SIGER/PSM (México)",
    JUCERJA: "JUCERJA (Brasil)",
    CONSERVATORIA: "Conservatória (Portugal)",
  };
  return labels[value] ?? value;
}

export function buildRegistryVariables({
  agreement,
  entityName,
  legalName,
  instrumentData,
  filingChannel,
  filingStatus,
  filingType,
  instrumentRequired,
  registryFilingId,
  isSubsanacion,
  subsanacionMotivo,
  subsanacionDocs,
}: RegistryDocumentContext) {
  const notaryLabel = registryNotaryLabel(instrumentData.notary);
  const instrumentLabel = registryInstrumentLabel(instrumentRequired);
  const procedureLabel = registryProcedureLabel(filingType);
  const channelLabel = filingChannel ? registryChannelLabel(filingChannel) : "";
  const documentosDisponibles = [
    agreement.status ? `Acuerdo en estado ${statusLabel(agreement.status)}` : null,
    instrumentData.protocolNumber ? `Protocolo ${instrumentData.protocolNumber}` : null,
    notaryLabel || null,
    channelLabel ? `Canal ${channelLabel}` : null,
    subsanacionDocs?.trim() ? subsanacionDocs.trim() : null,
  ].filter(Boolean);
  const datosPresentacion = [
    procedureLabel,
    channelLabel,
    instrumentData.protocolNumber ? `protocolo ${instrumentData.protocolNumber}` : null,
  ].filter(Boolean).join(" · ");
  const textoDecision = agreement.decision_text?.trim()
    || agreement.proposal_text?.trim()
    || [
      `Materia: ${agreement.agreement_kind}`,
      `Tipo de materia: ${matterClassBusinessLabel(agreement.matter_class)}`,
      `Forma de adopción: ${adoptionModeBusinessLabel(agreement.adoption_mode)}`,
    ].join("\n");

  return {
    denominacion_social: legalName || entityName,
    materia: agreement.agreement_kind,
    materia_acuerdo: agreement.agreement_kind,
    materia_etiqueta: labelMateria(agreement.agreement_kind),
    clase_materia: matterClassBusinessLabel(agreement.matter_class),
    agreement_id: agreement.id,
    snapshot_hash: registryFilingId ?? agreement.id,
    modo_adopcion: adoptionModeBusinessLabel(agreement.adoption_mode),
    estado_acuerdo: statusLabel(agreement.status),
    propuesta_acuerdo: agreement.proposal_text ?? textoDecision,
    decision_acuerdo: agreement.decision_text ?? textoDecision,
    instrumento_requerido: instrumentRequired,
    instrumento_requerido_label: instrumentLabel,
    tipo_presentacion: filingType ?? "",
    tipo_presentacion_label: procedureLabel,
    canal_presentacion: filingChannel || "No asignado",
    canal_presentacion_label: channelLabel || "No asignado",
    estado_tramite: statusLabel(filingStatus),
    notaria: instrumentData.notary,
    fecha_escritura: instrumentData.deedDate,
    numero_protocolo: instrumentData.protocolNumber,
    datos_presentacion: datosPresentacion,
    texto_decision: textoDecision,
    documentos_requeridos: [instrumentRequired, filingType].filter(Boolean),
    documentos_disponibles: documentosDisponibles,
    documentacion_texto: documentosDisponibles.join("\n"),
    advertencias_aceptadas: isSubsanacion
      ? [{ message: "Respuesta de subsanación preparada por Secretaría." }]
      : [],
    fecha: instrumentData.deedDate
      ? formatDateOnlyEs(instrumentData.deedDate)
      : new Date().toLocaleDateString("es-ES"),
    expediente_registral_ref: registryFilingId ?? "",
    documento_registral_ref: registryFilingId ?? "",
    fecha_requerimiento: "",
    motivo_subsanacion: subsanacionMotivo ?? "",
    respuesta_subsanacion: subsanacionMotivo ?? "",
    documentos_subsanacion: subsanacionDocs ?? "",
  };
}

export function buildRegistryFallback({
  agreement,
  entityName,
  legalName,
  instrumentData,
  filingChannel,
  filingStatus,
  filingType,
  instrumentRequired,
}: RegistryDocumentContext) {
  return [
    "DOCUMENTO DEMO PREPARATORIO PARA TRAMITACIÓN REGISTRAL — NO OFICIAL",
    "",
    `Sociedad: ${legalName || entityName}`,
    `Acuerdo: ${labelMateria(agreement.agreement_kind)}`,
    `Contenido: ${agreement.decision_text || agreement.proposal_text || "No consta"}`,
    `Tipo de materia: ${matterClassBusinessLabel(agreement.matter_class)}`,
    `Forma de adopción: ${adoptionModeBusinessLabel(agreement.adoption_mode)}`,
    `Estado del acuerdo: ${statusLabel(agreement.status)}`,
    "",
    "INSTRUMENTO",
    `Instrumento requerido: ${registryInstrumentLabel(instrumentRequired)}`,
    `Tipo de presentación: ${registryProcedureLabel(filingType) || "No consta"}`,
    `Notaría: ${registryNotaryLabel(instrumentData.notary) || "No consta"}`,
    `Fecha de escritura: ${instrumentData.deedDate ? formatDateOnlyEs(instrumentData.deedDate) : "No consta"}`,
    `Número de protocolo: ${instrumentData.protocolNumber || "No consta"}`,
    "",
    "TRÁMITE",
    `Canal: ${filingChannel ? registryChannelLabel(filingChannel) : "No asignado"}`,
    `Estado: ${statusLabel(filingStatus)}`,
    "",
    "Este documento prepara el expediente interno. No acredita por sí solo el otorgamiento del instrumento público ni la presentación o inscripción registral.",
  ].join("\n");
}
