// ============================================================
// HOOK DEL CANAL DE DENUNCIAS / SISTEMA INTERNO DE INFORMACIÓN (SII)
// Reactivo, persistido y conforme a la Ley 2/2023
// ============================================================

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenantContext } from "@/context/TenantContext";
import { siiStorageKey, siiQueryKey } from "@/lib/sii/tenant-scope";
import { toast } from "sonner";
import {
  type WhistleblowingReport,
  type WhistleblowingMessage,
  type WhistleblowingRecusation,
  type WhistleblowingEvidence,
  type WhistleblowingLibroRegistroEntry,
  type WhistleblowingStatus,
  type WhistleblowingSubcase,
  type SubcaseRegime,
  computeWhistleblowingDeadlines,
  evaluateSubcasePerimeter,
  ORGANOS_SII_POR_DEFECTO,
  sanitizeMetadata,
  validateCaseCloseoutGuard,
  generateLibroRegistroEntry,
  evaluateAntiRetaliationRisk,
} from "@/lib/sii/whistleblowing-engine";
import { SII_ORGANOS_GARRIGUES, SII_TENANT } from "../../scripts/garrigues/sii/canal-interno";
import { casosDemoGarrigues } from "../../scripts/garrigues/sii/casos-demo";



// ─── Datos Semilla Canónicos SII (Ley 2/2023) ────────────────────────────────

export const INITIAL_SII_REPORTS: WhistleblowingReport[] = [
  {
    id: "rep-sii-001",
    code: "SII-2026-04-001",
    trackingToken: "SEC-9F8A-72B1-K82M",
    trackingTokenHash: "SHA256:TOKEN:9F8A72B1K82M",
    intakeDate: "2026-04-10T10:30:00Z",
    channel: "WEB_ANONIMO",
    anonymityMode: "ANONIMO_ESTRICTO",
    informantContact: null,
    entityId: "6d7ed736-f263-4531-a59d-c6ca0cd41602",
    entityName: "ARGA Seguros S.A.",
    jurisdiction: "ES",
    category: "Conflicto de Interés y Operación Irregular",
    severity: "GRAVE",
    status: "EN_INVESTIGACION",
    summary: "Denuncia sobre posible conflicto de interés no declarado en decisión de inversión inmobiliaria internacional. Un directivo habría participado activamente en la aprobación sin formular abstención.",
    detailedDescription: "Se señala que en el Comité de Inversiones del primer trimestre se aprobó la adquisición de activos sin declarar la vinculación societaria previa del titular con la entidad vendedora.",
    acknowledgmentSentDate: "2026-04-11T12:00:00Z",
    resolutionDeadline: "2026-07-11T12:00:00Z",
    extensionApproved: false,
    assignedInvestigatorId: "inv-001",
    assignedInvestigatorName: "Dña. Elena Navarro Pons",
    isEscalatedToBoardCommittee: false,
    subcases: [
      {
        id: "sub-001-a",
        reportId: "rep-sii-001",
        regime: "PENAL_31BIS",
        label: "Subexpediente Penal y Fraude Corporativo (Art. 31 bis CP)",
        authorityTarget: "Comité de Cumplimiento / Fiscalía",
        ownerRole: "Responsable de Cumplimiento Penal",
        ownerName: "Dña. Elena Navarro Pons",
        status: "EN_INSTRUCCION",
        createdAt: "2026-04-11T12:00:00Z",
        requiresIndependentClose: true,
      },
      {
        id: "sub-001-b",
        reportId: "rep-sii-001",
        regime: "LABOR_DISCIPLINARY",
        label: "Subexpediente de Responsabilidad Directiva y Conflicto",
        authorityTarget: "Comisión de Auditoría y Control",
        ownerRole: "Dirección de Personas y Gobernanza",
        ownerName: "Dña. Elena Navarro Pons",
        status: "EN_INSTRUCCION",
        createdAt: "2026-04-11T12:00:00Z",
        requiresIndependentClose: true,
      },
    ],
    messages: [
      {
        id: "msg-001-1",
        reportId: "rep-sii-001",
        sender: "INFORMANTE",
        senderAlias: "Informante Anónimo",
        content: "Adjunto referencia documental donde constan los socios de la mercantil vendedora en el Registro Mercantil correspondiente.",
        sentAt: "2026-04-10T10:35:00Z",
        hasAttachment: true,
        attachmentName: "EVIDENCIA_REGISTRO_MERCANTIL_EXTRACTO.pdf",
      },
      {
        id: "msg-001-2",
        reportId: "rep-sii-001",
        sender: "INSTRUCTOR",
        senderAlias: "Dña. Elena Navarro Pons (Investigadora SII)",
        content: "Acuse de recibo formal emitido en plazo legal (Art. 9.2.c Ley 2/2023). La información ha sido admitida a trámite y se encuentra en fase de investigación reservada. Puede consultar este buzón para aportar aclaraciones.",
        sentAt: "2026-04-11T12:00:00Z",
        readAt: "2026-04-12T09:00:00Z",
      },
      {
        id: "msg-001-3",
        reportId: "rep-sii-001",
        sender: "INSTRUCTOR",
        senderAlias: "Dña. Elena Navarro Pons",
        content: "¿Dispone de copia de las actas de la sesión preliminar donde se fijó la valoración del activo?",
        sentAt: "2026-04-14T15:20:00Z",
        readAt: "2026-04-15T11:00:00Z",
      },
    ],
    recusations: [],
    retaliationRecord: {
      id: "ret-001",
      reportId: "rep-sii-001",
      riskLevel: "BAJO",
      riskFactors: ["Canal web estrictamente anónimo sin metadatos"],
      preventiveMeasuresActive: ["Preservación absoluta de IP y huella en Safe Inbox"],
      monitoringSchedule: "TRIMESTRAL",
      lastReviewDate: "2026-04-15T00:00:00Z",
      incidentsReported: 0,
      retaliationReportedViaInbox: false,
      notes: "Informante anónimo con credencial segura activa.",
    },
    evidences: [
      {
        id: "ev-001-a",
        reportId: "rep-sii-001",
        title: "Transcripción y relato de hechos saneado",
        type: "DOCUMENTO_SANEADO",
        referenciaInterna: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        confidentiality: "RESTRINGIDO_SII",
        sanitized: true,
        uploadedAt: "2026-04-10T10:30:00Z",
      },
      {
        id: "ev-001-b",
        reportId: "rep-sii-001",
        title: "Extracto societario y poderes de representación",
        type: "DOCUMENTO_SANEADO",
        referenciaInterna: "a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e",
        confidentiality: "RESTRINGIDO_SII",
        sanitized: true,
        uploadedAt: "2026-04-14T15:55:00Z",
      },
    ],
  },
  {
    id: "rep-sii-002",
    code: "SII-2026-03-002",
    trackingToken: "SEC-3D4E-91A8-L19V",
    trackingTokenHash: "SHA256:TOKEN:3D4E91A8L19V",
    intakeDate: "2026-03-02T14:15:00Z",
    channel: "EMAIL_CONFIDENCIAL",
    anonymityMode: "CONFIDENCIAL_IDENTIFICADO",
    informantContact: {
      pseudonym: "Empleado Depto. Compras",
      emailNotificationOnly: "aviso.informante@empresa.com",
    },
    entityId: "6d7ed736-f263-4531-a59d-c6ca0cd41602",
    entityName: "ARGA Seguros S.A.",
    jurisdiction: "ES",
    category: "Irregularidad en Contratación de Proveedores TIC",
    severity: "GRAVE",
    status: "EN_INVESTIGACION",
    summary: "Comunicación confidencial sobre presunto direccionamiento y favoritismo en la licitación de servicios Cloud de infraestructura TIC.",
    detailedDescription: "Se aportan correos donde un evaluador técnico habría facilitado los pliegos antes de la publicación oficial de la licitación a un licitador concreto.",
    acknowledgmentSentDate: "2026-03-03T10:00:00Z",
    resolutionDeadline: "2026-06-03T10:00:00Z",
    extensionApproved: true,
    extensionReason: "Especial complejidad probatoria: solicitud de auditoría forense externa sobre servidores de correo y peritaje informático.",
    extensionApprovedAt: "2026-05-20T11:00:00Z",
    assignedInvestigatorId: "inv-001",
    assignedInvestigatorName: "Dña. Elena Navarro Pons",
    isEscalatedToBoardCommittee: false,
    subcases: [
      {
        id: "sub-002-a",
        reportId: "rep-sii-002",
        regime: "PENAL_31BIS",
        label: "Subexpediente de Corrupción entre Particulares (Art. 286 bis CP)",
        authorityTarget: "Comité de Cumplimiento Penal",
        ownerRole: "Responsable Penal",
        ownerName: "Dña. Elena Navarro Pons",
        status: "EN_INSTRUCCION",
        createdAt: "2026-03-03T10:00:00Z",
        requiresIndependentClose: true,
      },
      {
        id: "sub-002-b",
        reportId: "rep-sii-002",
        regime: "DORA_ICT",
        label: "Subexpediente de Contratación de Terceros TIC (DORA Art. 28)",
        authorityTarget: "CISO / Dirección de Compras",
        ownerRole: "Chief Information Security Officer",
        ownerName: "Director de Seguridad TIC",
        status: "EN_INSTRUCCION",
        createdAt: "2026-03-03T10:00:00Z",
        requiresIndependentClose: true,
      },
    ],
    messages: [
      {
        id: "msg-002-1",
        reportId: "rep-sii-002",
        sender: "INSTRUCTOR",
        senderAlias: "Dña. Elena Navarro Pons",
        content: "Acuse de recibo conforme a Ley 2/2023. Se confirma apertura de expediente y asignación de instructora.",
        sentAt: "2026-03-03T10:00:00Z",
        readAt: "2026-03-03T11:00:00Z",
      },
      {
        id: "msg-002-2",
        reportId: "rep-sii-002",
        sender: "INSTRUCTOR",
        senderAlias: "Dña. Elena Navarro Pons",
        content: "Notificación de Prórroga Motivada: Dada la necesidad de peritaje informático forense de correos, el plazo de resolución se amplía excepcionalmente en 3 meses adicionales (vencimiento: 03/09/2026).",
        sentAt: "2026-05-20T11:05:00Z",
      },
    ],
    recusations: [],
    retaliationRecord: {
      id: "ret-002",
      reportId: "rep-sii-002",
      riskLevel: "ALTO",
      riskFactors: ["Informante empleado del departamento evaluado", "Mando intermedio implicado"],
      preventiveMeasuresActive: [
        "Inmunidad laboral formal frente a modificaciones contractuales (Art. 36)",
        "Aislamiento de la identidad del informante",
        "Seguimiento mensual por el Responsable del Sistema",
      ],
      monitoringSchedule: "MENSUAL",
      lastReviewDate: "2026-05-15T00:00:00Z",
      incidentsReported: 0,
      retaliationReportedViaInbox: false,
      notes: "El informante no ha reportado presiones ni alteraciones laborales.",
    },
    evidences: [
      {
        id: "ev-002-a",
        reportId: "rep-sii-002",
        title: "Copia de correos electrónicos saneados (cadena técnica)",
        type: "DOCUMENTO_SANEADO",
        referenciaInterna: "b4c2e64298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b112",
        confidentiality: "RESTRINGIDO_SII",
        sanitized: true,
        uploadedAt: "2026-03-02T14:18:00Z",
      },
    ],
  },
  {
    id: "rep-sii-003",
    code: "SII-2026-05-003",
    trackingToken: "SEC-7A2B-55K1-P99X",
    trackingTokenHash: "SHA256:TOKEN:7A2B55K1P99X",
    intakeDate: "2026-05-08T16:40:00Z",
    channel: "REUNION_PRESENCIAL",
    anonymityMode: "CONFIDENCIAL_IDENTIFICADO",
    informantContact: {
      pseudonym: "Científico de Datos Senior",
      emailNotificationOnly: "data.whistleblower@empresa.com",
    },
    entityId: "6d7ed736-f263-4531-a59d-c6ca0cd41602",
    entityName: "ARGA Seguros S.A.",
    jurisdiction: "ES",
    category: "Sesgo Algorítmico Crítico en Modelo de IA y Brecha RGPD",
    severity: "MUY_GRAVE",
    status: "EN_INVESTIGACION",
    summary: "Comunicación verbal formalizada en reunión presencial sobre inclusión no auditada de variables protegidas (salud y género) en el modelo de fijación dinámica de primas de decesos y vida.",
    detailedDescription: "En la reunión presencial con la investigadora se aportó transcripción revisada y firmada de la sesión técnica donde se forzó el uso de datos especiales para optimizar el ratio de conversión.",
    acknowledgmentSentDate: "2026-05-08T18:00:00Z",
    resolutionDeadline: "2026-08-08T18:00:00Z",
    extensionApproved: false,
    assignedInvestigatorId: "inv-001",
    assignedInvestigatorName: "Dña. Elena Navarro Pons",
    isEscalatedToBoardCommittee: false,
    subcases: [
      {
        id: "sub-003-a",
        reportId: "rep-sii-003",
        regime: "AIMS_AI",
        label: "Subexpediente AI Act / ISO 42001 (Sesgo Algorítmico en Sistema de Alto Riesgo)",
        authorityTarget: "AESIA / Oficina Europea de IA",
        ownerRole: "Líder de Gobernanza de IA (AIMS 360)",
        ownerName: "Responsable AIMS 360",
        status: "EN_INSTRUCCION",
        createdAt: "2026-05-08T18:00:00Z",
        requiresIndependentClose: true,
      },
      {
        id: "sub-003-b",
        reportId: "rep-sii-003",
        regime: "RGPD_BREACH",
        label: "Subexpediente de Tratamiento Ilícito de Categorías Especiales (Art. 9 RGPD)",
        authorityTarget: "AEPD",
        ownerRole: "Data Protection Officer (DPO)",
        ownerName: "Oficina del DPO",
        status: "EN_INSTRUCCION",
        createdAt: "2026-05-08T18:00:00Z",
        requiresIndependentClose: true,
      },
    ],
    messages: [
      {
        id: "msg-003-1",
        reportId: "rep-sii-003",
        sender: "INSTRUCTOR",
        senderAlias: "Dña. Elena Navarro Pons",
        content: "Acta de comparecencia y reunión presencial formalizada. Se adjunta copia transcrita con consentimiento del informante y conforme a las garantías del Art. 7.2 de la Ley 2/2023.",
        sentAt: "2026-05-08T18:05:00Z",
      },
    ],
    recusations: [],
    retaliationRecord: {
      id: "ret-003",
      reportId: "rep-sii-003",
      riskLevel: "CRITICO",
      riskFactors: ["Informante con puesto técnico especializado clave", "Presiones para no documentar la incidencia"],
      preventiveMeasuresActive: [
        "Inmunidad laboral formal (Art. 36)",
        "Prohibición de aislamiento en proyectos técnicos",
        "Seguimiento quincenal de carrera y condiciones",
      ],
      monitoringSchedule: "QUINCENAL",
      lastReviewDate: "2026-05-22T00:00:00Z",
      incidentsReported: 0,
      retaliationReportedViaInbox: false,
      notes: "Plan de protección activo sin incidentes registrados.",
    },
    evidences: [
      {
        id: "ev-003-a",
        reportId: "rep-sii-003",
        title: "Acta de comparecencia y transcripción revisada con consentimiento",
        type: "AUDIO_TRANSCRIPCION",
        referenciaInterna: "f7d3a44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852c999",
        confidentiality: "RESTRINGIDO_SII",
        sanitized: true,
        uploadedAt: "2026-05-08T18:08:00Z",
      },
      {
        id: "ev-003-b",
        reportId: "rep-sii-003",
        title: "Informe pericial de pesos de variables del modelo de suscripción",
        type: "INFORME_FORENSE",
        referenciaInterna: "cc88b44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852d444",
        confidentiality: "RESTRINGIDO_SII",
        sanitized: true,
        uploadedAt: "2026-05-15T11:50:00Z",
      },
    ],
  },
];

const ARGA_TENANT = "00000000-0000-0000-0000-000000000001";

/**
 * Set inicial por tenant, y ÚNICO sitio donde se decide.
 *
 * getStoredReports tenía TRES caminos que devolvían las denuncias de ARGA:
 * el guard de SSR, el bucket vacío y el `catch` de JSON corrupto. Cambiar solo
 * la clave no habría cerrado la fuga: con bucket propio, Garrigues habría
 * estrenado uno vacío y el código le habría copiado dentro los casos de ARGA.
 * Y el `catch` los devuelve SIN sembrar, así que no deja rastro en el almacén
 * y es el más difícil de reproducir de los tres. Las tres puertas pasan por
 * aquí.
 *
 * Los expedientes demo de Garrigues (materia de despacho) los siembra la
 * Tarea 7; hasta entonces arranca vacío, que es honesto: no tiene ninguno.
 */
function initialReportsFor(tenantId: string): WhistleblowingReport[] {
  if (tenantId === ARGA_TENANT) return INITIAL_SII_REPORTS;
  // Los tres de Garrigues son SIMULADOS y se dice en pantalla; su materia sí
  // es la que la normativa del despacho contempla. Cualquier otro tenant
  // arranca vacío, que es lo honesto: no tiene ninguno.
  if (tenantId === SII_TENANT) {
    return casosDemoGarrigues("J&A Garrigues, S.L.P.") as WhistleblowingReport[];
  }
  return [];
}

function getStoredReports(tenantId: string): WhistleblowingReport[] {
  if (typeof window === "undefined") return initialReportsFor(tenantId);   // puerta 1
  const raw = localStorage.getItem(siiStorageKey(tenantId));
  if (!raw) {                                                              // puerta 2
    const inicial = initialReportsFor(tenantId);
    localStorage.setItem(siiStorageKey(tenantId), JSON.stringify(inicial));
    return inicial;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return initialReportsFor(tenantId);                                    // puerta 3
  }
}

function saveStoredReports(tenantId: string, reports: WhistleblowingReport[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(siiStorageKey(tenantId), JSON.stringify(reports));
  }
}

// ─── Hooks Principales ───────────────────────────────────────────────────────

export function useWhistleblowingReports() {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: siiQueryKey(tenantId, "reports", "list"),
    enabled: !!tenantId,
    queryFn: async (): Promise<WhistleblowingReport[]> => {
      return getStoredReports(tenantId!);
    },
  });
}

export function useWhistleblowingReportById(idOrCode: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: siiQueryKey(tenantId, "report", idOrCode),
    enabled: !!idOrCode && !!tenantId,
    queryFn: async (): Promise<WhistleblowingReport | null> => {
      const reports = getStoredReports(tenantId!);
      return reports.find((r) => r.id === idOrCode || r.code === idOrCode) ?? null;
    },
  });
}

export function useWhistleblowingReportByToken(token: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: siiQueryKey(tenantId, "safe-inbox", token),
    enabled: !!token && token.trim().length > 0 && !!tenantId,
    queryFn: async (): Promise<WhistleblowingReport | null> => {
      const reports = getStoredReports(tenantId!);
      return reports.find((r) => r.trackingToken.toUpperCase() === token.trim().toUpperCase()) ?? null;
    },
  });
}

export function useWhistleblowingLibroRegistro() {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: siiQueryKey(tenantId, "libro-registro"),
    enabled: !!tenantId,
    queryFn: async (): Promise<WhistleblowingLibroRegistroEntry[]> => {
      const reports = getStoredReports(tenantId!);
      return reports.map((r) => {
        if (r.libroRegistroEntry) return r.libroRegistroEntry;
        return generateLibroRegistroEntry(r);
      });
    },
  });
}

// ─── Mutaciones ─────────────────────────────────────────────────────────────

export function useCreateWhistleblowingReport() {
  const { tenantId } = useTenantContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      channel: WhistleblowingReport["channel"];
      anonymityMode: WhistleblowingReport["anonymityMode"];
      informantContact?: WhistleblowingReport["informantContact"];
      entityId: string;
      entityName: string;
      jurisdiction: string;
      category: string;
      severity: WhistleblowingReport["severity"];
      summary: string;
      detailedDescription: string;
      affectsAI?: boolean;
      affectsICT?: boolean;
      affectsPersonalData?: boolean;
      isBoardOrExecutiveTarget?: boolean;
      attachments?: Array<{ name: string; size: number }>;
    }): Promise<{ report: WhistleblowingReport; trackingToken: string; code: string }> => {
      const reports = getStoredReports(tenantId!);
      const nextNum = reports.length + 1;
      const code = `SII-2026-08-${String(nextNum).padStart(3, "0")}`;
      
      // Token de alta entropía
      const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase();
      const randomHex2 = Math.random().toString(36).substring(2, 6).toUpperCase();
      const trackingToken = `SEC-${randomHex}-${randomHex2}`;

      const now = new Date();
      const deadlines = computeWhistleblowingDeadlines(now);

      // Evaluación de perímetro de subexpedientes autónomos
      const perimeter = evaluateSubcasePerimeter({
        category: payload.category,
        summary: payload.summary,
        detailedDescription: payload.detailedDescription,
        affectsAI: payload.affectsAI,
        affectsICT: payload.affectsICT,
        affectsPersonalData: payload.affectsPersonalData,
        isBoardOrExecutiveTarget: payload.isBoardOrExecutiveTarget,
        // Los órganos por tenant. El defecto es lo que el motor tenía
        // cableado, así que ARGA ve exactamente lo mismo que antes; Garrigues
        // ve los suyos, que además no son colegiados.
        organos: tenantId === SII_TENANT ? SII_ORGANOS_GARRIGUES : ORGANOS_SII_POR_DEFECTO,
      });

      const subcases = perimeter.subcasesToCreate.map((s, idx) => ({
        id: `sub-${nextNum}-${String.fromCharCode(97 + idx)}`,
        reportId: `rep-sii-${nextNum}`,
        regime: s.regime,
        label: s.label,
        authorityTarget: s.authorityTarget,
        ownerRole: s.ownerRole,
        ownerName: s.regime === "AIMS_AI" ? "Responsable AIMS 360" : s.regime === "DORA_ICT" ? "CISO" : "Dña. Elena Navarro Pons",
        status: "ABIERTO" as const,
        createdAt: now.toISOString(),
        requiresIndependentClose: true,
      }));

      // Saneamiento de evidencias iniciales
      const evidences: WhistleblowingEvidence[] = (payload.attachments ?? []).map((att, idx) => {
        const sanitized = sanitizeMetadata(att.name);
        return {
          id: `ev-${nextNum}-${String.fromCharCode(97 + idx)}`,
          reportId: `rep-sii-${nextNum}`,
          title: sanitized.sanitizedFilename,
          type: "DOCUMENTO_SANEADO",
          referenciaInterna: `REF-EV-${Date.now().toString(36)}`,
          confidentiality: "RESTRINGIDO_SII",
          sanitized: true,
          uploadedAt: now.toISOString(),
        };
      });

      const retaliationRecord = evaluateAntiRetaliationRisk({
        isAnonymous: payload.anonymityMode === "ANONIMO_ESTRICTO",
        informantRole: "EMPLEADO",
        reportedTargetSeniority: payload.isBoardOrExecutiveTarget ? "ALTA_DIRECCION" : "MANDO_INTERMEDIO",
      });

      const newReport: WhistleblowingReport = {
        id: `rep-sii-${nextNum}`,
        code,
        trackingToken,
        trackingTokenHash: `SHA256:${trackingToken}`,
        intakeDate: now.toISOString(),
        channel: payload.channel,
        anonymityMode: payload.anonymityMode,
        informantContact: payload.informantContact,
        entityId: payload.entityId,
        entityName: payload.entityName,
        jurisdiction: payload.jurisdiction,
        category: payload.category,
        severity: payload.severity,
        status: "RECIBIDO",
        summary: payload.summary,
        detailedDescription: payload.detailedDescription,
        resolutionDeadline: deadlines.resolutionDeadline3m.toISOString(),
        extensionApproved: false,
        assignedInvestigatorId: "inv-001",
        assignedInvestigatorName: "Dña. Elena Navarro Pons",
        isEscalatedToBoardCommittee: perimeter.escalationRequired,
        subcases,
        messages: [
          {
            id: `msg-${nextNum}-1`,
            reportId: `rep-sii-${nextNum}`,
            sender: "SISTEMA",
            content: `Comunicación recibida y registrada con código oficial ${code}. Su credencial segura ha sido activada. Dispone de un plazo legal de acuse de 7 días naturales.`,
            sentAt: now.toISOString(),
          },
        ],
        recusations: [],
        retaliationRecord: {
          id: `ret-${nextNum}`,
          reportId: `rep-sii-${nextNum}`,
          riskLevel: retaliationRecord.riskLevel,
          riskFactors: ["Nueva comunicación registrada"],
          preventiveMeasuresActive: retaliationRecord.recommendedMeasures,
          monitoringSchedule: retaliationRecord.monitoringFrequency,
          lastReviewDate: now.toISOString(),
          incidentsReported: 0,
          retaliationReportedViaInbox: false,
          notes: "Evaluación inicial de riesgo anti-represalias.",
        },
        evidences,
      };

      const updated = [newReport, ...reports];
      saveStoredReports(tenantId!, updated);
      queryClient.invalidateQueries({ queryKey: siiQueryKey(tenantId) });

      return { report: newReport, trackingToken, code };
    },
  });
}

export function useSendSafeInboxMessage() {
  const { tenantId } = useTenantContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      reportId,
      content,
      sender,
      senderAlias,
    }: {
      reportId: string;
      content: string;
      sender: "INFORMANTE" | "INSTRUCTOR";
      senderAlias?: string;
    }) => {
      const reports = getStoredReports(tenantId!);
      const rep = reports.find((r) => r.id === reportId);
      if (!rep) throw new Error("Expediente no encontrado.");

      const newMsg: WhistleblowingMessage = {
        id: `msg-${Date.now()}`,
        reportId,
        sender,
        senderAlias: senderAlias ?? (sender === "INSTRUCTOR" ? rep.assignedInvestigatorName : "Informante"),
        content,
        sentAt: new Date().toISOString(),
      };

      rep.messages.push(newMsg);
      saveStoredReports(tenantId!, reports);
      queryClient.invalidateQueries({ queryKey: siiQueryKey(tenantId) });
      return newMsg;
    },
  });
}

export function useEmitAcknowledgment() {
  const { tenantId } = useTenantContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      reportId,
      isExempt,
      exemptReason,
    }: {
      reportId: string;
      isExempt?: boolean;
      exemptReason?: string;
    }) => {
      const reports = getStoredReports(tenantId!);
      const rep = reports.find((r) => r.id === reportId);
      if (!rep) throw new Error("Expediente no encontrado.");

      const now = new Date();
      if (isExempt) {
        rep.acknowledgmentExemptReason = exemptReason ?? "Riesgo acreditado para la confidencialidad de la comunicación.";
      } else {
        rep.acknowledgmentSentDate = now.toISOString();
        rep.status = "ACUSE_EMITIDO";
        rep.messages.push({
          id: `msg-ack-${Date.now()}`,
          reportId,
          sender: "INSTRUCTOR",
          senderAlias: rep.assignedInvestigatorName,
          content: "Acuse de recibo formal emitido en plazo legal (Art. 9.2.c Ley 2/2023). El expediente se encuentra admitido a trámite.",
          sentAt: now.toISOString(),
        });
      }

      saveStoredReports(tenantId!, reports);
      queryClient.invalidateQueries({ queryKey: siiQueryKey(tenantId) });
      return rep;
    },
  });
}

export function useApproveExtension() {
  const { tenantId } = useTenantContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      reportId,
      reason,
    }: {
      reportId: string;
      reason: string;
    }) => {
      const reports = getStoredReports(tenantId!);
      const rep = reports.find((r) => r.id === reportId);
      if (!rep) throw new Error("Expediente no encontrado.");

      const now = new Date();
      rep.extensionApproved = true;
      rep.extensionReason = reason;
      rep.extensionApprovedAt = now.toISOString();
      rep.status = "PRORROGA_ACTIVA";

      // Recalcular resolución a 6 meses
      const deadlines = computeWhistleblowingDeadlines(rep.intakeDate, rep.acknowledgmentSentDate, true);
      rep.resolutionDeadline = deadlines.maxExtendedDeadline6m.toISOString();

      rep.messages.push({
        id: `msg-ext-${Date.now()}`,
        reportId,
        sender: "INSTRUCTOR",
        senderAlias: rep.assignedInvestigatorName,
        content: `Notificación de Prórroga Motivada: Por causas de especial complejidad, el plazo de resolución se prorroga hasta el ${new Date(rep.resolutionDeadline).toLocaleDateString("es-ES")} (Art. 9.2.d Ley 2/2023). Motivo: ${reason}`,
        sentAt: now.toISOString(),
      });

      saveStoredReports(tenantId!, reports);
      queryClient.invalidateQueries({ queryKey: siiQueryKey(tenantId) });
      return rep;
    },
  });
}

export function useFormalizeRecusation() {
  const { tenantId } = useTenantContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      reportId,
      reason,
      details,
      substitutedByName,
    }: {
      reportId: string;
      reason: WhistleblowingRecusation["reason"];
      details: string;
      substitutedByName: string;
    }) => {
      const reports = getStoredReports(tenantId!);
      const rep = reports.find((r) => r.id === reportId);
      if (!rep) throw new Error("Expediente no encontrado.");

      const recusation: WhistleblowingRecusation = {
        id: `rec-${Date.now()}`,
        reportId,
        investigatorId: rep.assignedInvestigatorId,
        investigatorName: rep.assignedInvestigatorName,
        reason,
        details,
        substitutedById: `inv-${Date.now()}`,
        substitutedByName,
        approvedBy: "Comité de Cumplimiento e Independencia",
        recusedAt: new Date().toISOString(),
        status: "RECUSACION_FORMALIZADA",
      };

      rep.recusations.push(recusation);
      rep.assignedInvestigatorName = substitutedByName;

      saveStoredReports(tenantId!, reports);
      queryClient.invalidateQueries({ queryKey: siiQueryKey(tenantId) });
      return recusation;
    },
  });
}

export function useUpdateSubcaseStatus() {
  const { tenantId } = useTenantContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      reportId,
      subcaseId,
      status,
      closingReason,
      remediationPlanId,
    }: {
      reportId: string;
      subcaseId: string;
      status: WhistleblowingSubcase["status"];
      closingReason?: string;
      remediationPlanId?: string;
    }) => {
      const reports = getStoredReports(tenantId!);
      const rep = reports.find((r) => r.id === reportId);
      if (!rep) throw new Error("Expediente no encontrado.");

      const sub = rep.subcases.find((s) => s.id === subcaseId);
      if (!sub) throw new Error("Subexpediente no encontrado.");

      sub.status = status;
      if (status === "CERRADO" || status === "TRANSFERIDO_REMEDIACION") {
        sub.closedAt = new Date().toISOString();
        sub.closingReason = closingReason;
        sub.remediationPlanId = remediationPlanId;
      }

      saveStoredReports(tenantId!, reports);
      queryClient.invalidateQueries({ queryKey: siiQueryKey(tenantId) });
      return sub;
    },
  });
}

export function useCloseRootCase() {
  const { tenantId } = useTenantContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      reportId,
      status,
      closingReason,
      actionsTaken,
    }: {
      reportId: string;
      status: "RESUELTO_MEDIDAS" | "ARCHIVADO_MOTIVADO";
      closingReason: string;
      actionsTaken: string[];
    }) => {
      const reports = getStoredReports(tenantId!);
      const rep = reports.find((r) => r.id === reportId);
      if (!rep) throw new Error("Expediente no encontrado.");

      const guard = validateCaseCloseoutGuard(rep);
      if (!guard.canClose) {
        throw new Error(`No es posible cerrar el expediente raíz: ${guard.blockingReasons.join(". ")}`);
      }

      const now = new Date();
      rep.status = status;
      rep.closedAt = now.toISOString();
      rep.closingReason = closingReason;

      // Generar asiento oficial en Libro-Registro
      rep.libroRegistroEntry = generateLibroRegistroEntry(rep, {
        outcome: closingReason,
        actionsTaken,
      });

      saveStoredReports(tenantId!, reports);
      queryClient.invalidateQueries({ queryKey: siiQueryKey(tenantId) });
      return rep;
    },
  });
}
