// ============================================================
// HOOK DEL CANAL DE DENUNCIAS / SISTEMA INTERNO DE INFORMACIÓN (SII)
// Reactivo, persistido y conforme a la Ley 2/2023
// ============================================================

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenantContext } from "@/context/TenantContext";
import { siiQueryKey } from "@/lib/sii/tenant-scope";
import { selectReports, upsertReports, type FilaExpediente } from "@/lib/sii/store";
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
  WHISTLEBLOWING_STATUSES,
  computeWhistleblowingDeadlines,
  evaluateSubcasePerimeter,
  sanitizeMetadata,
  validateCaseCloseoutGuard,
  generateLibroRegistroEntry,
  evaluateAntiRetaliationRisk,
} from "@/lib/sii/whistleblowing-engine";
import { siiRolesPara } from "@/lib/sii/roles-por-tenant";
import { SII_TENANT } from "../../scripts/garrigues/sii/canal-interno";
import { casosDemoGarrigues } from "../../scripts/garrigues/sii/casos-demo";



// ─── Datos Semilla Canónicos SII (Ley 2/2023) ────────────────────────────────

export const INITIAL_SII_REPORTS: WhistleblowingReport[] = [
  {
    id: "rep-sii-001",
    code: "SII-2026-04-001",
    trackingToken: "SEC-9F8A-72B1-K82M",
    firmeza: "DEMO_PILOTO",
    trackingTokenReference: "REF-TOKEN-9F8A72B1K82M",
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
    resolutionDeadline: "2026-07-10T10:30:00Z",
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
        content: "Acuse de recibo emitido dentro de los siete días naturales siguientes a la recepción (art. 9.2.c Ley 2/2023). La comunicación está en instrucción reservada. Puede consultar este buzón para aportar aclaraciones.",
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
      riskFactors: ["Comunicación web sin datos de contacto en el expediente"],
      // Decía "Preservación absoluta de IP y huella": ni se trata la IP ni hay
      // huella que preservar, y la sesión que abre el portal está autenticada.
      preventiveMeasuresActive: ["El expediente no recoge datos de contacto del informante"],
      monitoringSchedule: "TRIMESTRAL",
      lastReviewDate: "2026-04-15T00:00:00Z",
      incidentsReported: 0,
      retaliationReportedViaInbox: false,
      notes: "Comunicación sin datos de contacto; código de seguimiento activo.",
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
    firmeza: "DEMO_PILOTO",
    trackingTokenReference: "REF-TOKEN-3D4E91A8L19V",
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
    resolutionDeadline: "2026-09-02T14:15:00Z",
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
        content: "Notificación de Prórroga Motivada: Dada la necesidad de peritaje informático forense de correos, el plazo de resolución se amplía excepcionalmente en 3 meses adicionales (vencimiento: 02/09/2026).",
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
    firmeza: "DEMO_PILOTO",
    trackingTokenReference: "REF-TOKEN-7A2B55K1P99X",
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
    resolutionDeadline: "2026-08-08T16:40:00Z",
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
 * Es la semilla del almacén: `leerFilas` la escribe la primera vez que un
 * tenant abre el canal, y a partir de ahí manda la tabla. Un tenant sin
 * expedientes declarados arranca VACÍO, que es lo honesto: no tiene ninguno.
 * Que esta función sea el único sitio donde se decide es lo que impide que un
 * tenant estrene el almacén con las denuncias de otro.
 *
 * Exportada para poder PROBARLA invocándola. El guard de aislamiento anterior
 * recortaba el cuerpo del lector y lo comparaba como texto: un
 * `initialReportsFor` que devolviera siempre los casos de ARGA lo satisfacía.
 * Ver `src/test/sii/sii-tenant-scope.test.ts`.
 */
export function initialReportsFor(tenantId: string): WhistleblowingReport[] {
  if (tenantId === ARGA_TENANT) return INITIAL_SII_REPORTS;
  // Los tres de Garrigues son SIMULADOS y se dice en pantalla; su materia sí
  // es la que la normativa del despacho contempla. Cualquier otro tenant
  // arranca vacío, que es lo honesto: no tiene ninguno.
  if (tenantId === SII_TENANT) {
    // Sin cast: `casosDemoGarrigues` ya devuelve `WhistleblowingReport[]`. El
    // cast era lo que dejaba pasar estados fuera de la unión.
    return casosDemoGarrigues("J&A Garrigues, S.L.P.");
  }
  return [];
}

/**
 * Los campos que fija el CATÁLOGO, no el almacén.
 *
 * El catálogo puede corregirse después de sembrar —ya pasó con `firmeza`, cuyo
 * badge «Simulado» desaparecía, y con `channel`, al pasar los dos casos
 * anónimos de `WEB_ANONIMO` a `POSTAL` por el art. 3.c del PI-31—. Una fila ya
 * escrita no se entera de esa corrección, así que se reaplica al leer.
 *
 * QUÉ CAMBIÓ AL PERSISTIR EN CLOUD (2026-09-07). Antes esto se aplicaba a
 * CUALQUIER expediente cuyo `code` coincidiera con uno del catálogo. Que hoy no
 * pisara nada era una coincidencia de dos hechos frágiles: los códigos de alta
 * llevan el mes `08` y los del catálogo no, y ninguna mutación toca estos siete
 * campos. Con el almacén compartido entre equipos ninguna de las dos cosas es
 * garantía, así que la reaplicación se limita a las filas cuyo `origen` es
 * `CATALOGO` — las que el catálogo posee de verdad—. Una edición sobre un
 * expediente dado de alta ya no puede ser pisada, ni por coincidencia de código
 * ni por un cambio futuro del catálogo.
 *
 * QUÉ ENTRA Y QUÉ NO. Entra lo que decide el CATÁLOGO y la aplicación no deja
 * cambiar: la marca de simulado, el canal, la modalidad de anonimato, la
 * categoría, la severidad y los dos textos.
 *
 * NO entra `status`, aunque el catálogo lo declare: lo mueve el instructor
 * —`useEmitAcknowledgment` escribe ACUSE_EMITIDO, `useApproveExtension`
 * PRORROGA_ACTIVA y `useCloseRootCase` RESUELTO_MEDIDAS o ARCHIVADO_MOTIVADO—.
 * Reaplicarlo devolvería un expediente cerrado a "en investigación", que es un
 * daño mayor que el que se venía a evitar. Lo que sí se descarta es un estado
 * que el motor NO TIENE: eso no es tramitación, es un valor viciado del almacén.
 * Tampoco entra `assignedInvestigatorName`, que la recusación sustituye.
 */
const CAMPOS_DEL_CATALOGO = [
  "firmeza",
  "channel",
  "anonymityMode",
  "category",
  "severity",
  "summary",
  "detailedDescription",
] as const;

function reaplicarCamposDelCatalogo(tenantId: string, filas: FilaExpediente[]): FilaExpediente[] {
  const catalogo = new Map(initialReportsFor(tenantId).map((r) => [r.code, r]));
  return filas.map((fila) => {
    // Solo las filas que el catálogo posee. Un alta del usuario no se toca.
    if (fila.origen !== "CATALOGO") return fila;
    const delCatalogo = catalogo.get(fila.code);
    if (!delCatalogo) return fila;
    const parche: Partial<WhistleblowingReport> = {};
    for (const campo of CAMPOS_DEL_CATALOGO) {
      (parche as Record<string, unknown>)[campo] = delCatalogo[campo];
    }
    // El estado lo mueve el instructor y por eso no se reaplica; pero uno que
    // el motor no reconoce no es un estado avanzado, es basura del almacén.
    if (!(WHISTLEBLOWING_STATUSES as readonly string[]).includes(fila.report.status)) {
      parche.status = delCatalogo.status;
    }
    return { ...fila, report: { ...fila.report, ...parche } };
  });
}

/**
 * Lee las filas del tenant. Si no tiene ninguna, siembra el catálogo.
 *
 * La siembra es idempotente por `(tenant_id, code)` y se pide con
 * `ignorarDuplicados`: dos pestañas abriendo el módulo a la vez no se pisan.
 */
export async function leerFilas(tenantId: string): Promise<FilaExpediente[]> {
  const filas = await selectReports(tenantId);
  if (filas.length > 0) return reaplicarCamposDelCatalogo(tenantId, filas);

  const semilla: FilaExpediente[] = initialReportsFor(tenantId).map((report, i) => ({
    code: report.code,
    origen: "CATALOGO",
    // El orden del catálogo es el orden en que está escrito: los tres de ARGA
    // no están ordenados por fecha de entrada, así que ordenarlos por fecha
    // movería de sitio las tres fichas de la demo.
    orden: i,
    report,
  }));
  if (semilla.length === 0) return [];
  await upsertReports(tenantId, semilla, { ignorarDuplicados: true });
  // Se relee en vez de devolver la semilla: si otra pestaña ganó la carrera,
  // lo que vale es lo que hay en la tabla.
  return reaplicarCamposDelCatalogo(tenantId, await selectReports(tenantId));
}

/** Los expedientes del tenant, en el orden en que la pantalla los espera. */
export async function getStoredReports(tenantId: string): Promise<WhistleblowingReport[]> {
  return (await leerFilas(tenantId)).map((f) => f.report);
}

/** Guarda UNA fila. Las mutaciones tocan un expediente, no la colección. */
async function guardarFila(tenantId: string, fila: FilaExpediente): Promise<void> {
  await upsertReports(tenantId, [fila]);
}

// ─── Hooks Principales ───────────────────────────────────────────────────────

export function useWhistleblowingReports() {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: siiQueryKey(tenantId, "reports", "list"),
    enabled: !!tenantId,
    queryFn: async (): Promise<WhistleblowingReport[]> => {
      return await getStoredReports(tenantId!);
    },
  });
}

export function useWhistleblowingReportById(idOrCode: string | undefined) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: siiQueryKey(tenantId, "report", idOrCode),
    enabled: !!idOrCode && !!tenantId,
    queryFn: async (): Promise<WhistleblowingReport | null> => {
      const reports = await getStoredReports(tenantId!);
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
      const reports = await getStoredReports(tenantId!);
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
      const reports = await getStoredReports(tenantId!);
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
      const filas = await leerFilas(tenantId!);
      // El correlativo se deriva del MÁXIMO ya usado, no del número de filas:
      // con el almacén compartido entre equipos, contar filas repite código en
      // cuanto dos altas se cruzan. Sigue habiendo carrera —dos altas
      // simultáneas piden el mismo número—, pero el índice único
      // `(tenant_id, code)` la convierte en un error visible en vez de en un
      // duplicado silencioso.
      const usados = filas
        .map((f) => Number(f.code.match(/^SII-2026-08-(\d+)$/)?.[1] ?? 0))
        .filter((n) => Number.isFinite(n));
      const nextNum = Math.max(filas.length, ...usados, 0) + 1;
      const code = `SII-2026-08-${String(nextNum).padStart(3, "0")}`;

      // Identidad del circuito POR TENANT. Estaba cableada a una persona real
      // del censo de ARGA y se estampaba en cualquier tenant.
      const roles = siiRolesPara(tenantId);

      // Código de seguimiento. Se generaba con Math.random(), que es
      // predecible: para un código que da acceso a un expediente, el generador
      // criptográfico del navegador cuesta lo mismo. Lo que NO cambia es que el
      // expediente se guarda sin cifrar, y eso lo dice la pantalla.
      const bloque = () => {
        const b = new Uint8Array(3);
        globalThis.crypto.getRandomValues(b);
        return Array.from(b, (n) => n.toString(16).padStart(2, "0")).join("").toUpperCase();
      };
      const trackingToken = `SEC-${bloque()}-${bloque()}`;

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
        // Los órganos por tenant, del mismo resolutor que la instructora.
        // ARGA ve exactamente lo mismo que antes; Garrigues ve los suyos, que
        // además no son colegiados; un tenant sin designación NO hereda los de
        // ARGA.
        organos: roles.organos,
      });

      const subcases = perimeter.subcasesToCreate.map((s, idx) => ({
        id: `sub-${nextNum}-${String.fromCharCode(97 + idx)}`,
        reportId: `rep-sii-${nextNum}`,
        regime: s.regime,
        label: s.label,
        authorityTarget: s.authorityTarget,
        ownerRole: s.ownerRole,
        ownerName: s.regime === "AIMS_AI" ? "Responsable AIMS 360" : s.regime === "DORA_ICT" ? "CISO" : roles.ownerName,
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
        trackingTokenReference: `REF-${trackingToken}`,
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
        assignedInvestigatorId: roles.instructorId,
        assignedInvestigatorName: roles.instructorName,
        isEscalatedToBoardCommittee: perimeter.escalationRequired,
        subcases,
        messages: [
          {
            id: `msg-${nextNum}-1`,
            reportId: `rep-sii-${nextNum}`,
            sender: "SISTEMA",
            content: `Comunicación recibida y registrada con el código ${code}. Conserve el código de seguimiento para consultar este buzón. El acuse de recibo debe emitirse dentro de los siete días naturales siguientes a la recepción (art. 9.2.c Ley 2/2023).`,
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

      // El asiento se conserva desde la recepción: número de entrada y fecha.
      // Antes solo se creaba al CERRAR, y hasta entonces la tabla lo recalculaba
      // en cada render.
      newReport.libroRegistroEntry = {
        ...generateLibroRegistroEntry(newReport),
        numeroEntradaAsignadoAt: now.toISOString(),
      };

      // Delante de todo, como hacía el almacén anterior al anteponerlo al
      // array. `orden` es lo que conserva esa colocación entre sesiones.
      const primero = Math.min(0, ...filas.map((f) => f.orden));
      await guardarFila(tenantId!, {
        code,
        origen: "ALTA",
        orden: primero - 1,
        report: newReport,
      });
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
      const filas = await leerFilas(tenantId!);
      const fila = filas.find((f) => f.report.id === reportId);
      if (!fila) throw new Error("Expediente no encontrado.");
      const rep = fila.report;

      const newMsg: WhistleblowingMessage = {
        id: `msg-${Date.now()}`,
        reportId,
        sender,
        senderAlias: senderAlias ?? (sender === "INSTRUCTOR" ? rep.assignedInvestigatorName : "Informante"),
        content,
        sentAt: new Date().toISOString(),
      };

      rep.messages.push(newMsg);
      await guardarFila(tenantId!, fila);
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
      const filas = await leerFilas(tenantId!);
      const fila = filas.find((f) => f.report.id === reportId);
      if (!fila) throw new Error("Expediente no encontrado.");
      const rep = fila.report;

      const now = new Date();
      let enPlazo: boolean | null = null;
      let limiteAcuse: Date | null = null;
      if (isExempt) {
        rep.acknowledgmentExemptReason = exemptReason ?? "Riesgo acreditado para la confidencialidad de la comunicación.";
      } else {
        rep.acknowledgmentSentDate = now.toISOString();
        rep.status = "ACUSE_EMITIDO";
        // Dos afirmaciones falsas en una línea: se decía "en plazo legal" sin
        // compararlo con nada, y se afirmaba una admisión formal que no existe
        // —el estado que se escribe es ACUSE_EMITIDO—. El plazo lo calcula el
        // motor; la admisión no se afirma porque no ocurre.
        const { ackDeadline7d } = computeWhistleblowingDeadlines(rep.intakeDate, now);
        limiteAcuse = ackDeadline7d;
        enPlazo = now.getTime() <= ackDeadline7d.getTime();
        rep.messages.push({
          id: `msg-ack-${Date.now()}`,
          reportId,
          sender: "INSTRUCTOR",
          senderAlias: rep.assignedInvestigatorName,
          content: enPlazo
            ? `Acuse de recibo emitido dentro de los siete días naturales siguientes a la recepción (art. 9.2.c Ley 2/2023; límite ${ackDeadline7d.toLocaleDateString("es-ES")}). La comunicación queda registrada; la decisión sobre su tramitación es posterior.`
            : `Acuse de recibo emitido FUERA del plazo de siete días naturales del art. 9.2.c Ley 2/2023 (límite ${ackDeadline7d.toLocaleDateString("es-ES")}). La comunicación queda registrada; la decisión sobre su tramitación es posterior.`,
          sentAt: now.toISOString(),
        });
      }

      await guardarFila(tenantId!, fila);
      queryClient.invalidateQueries({ queryKey: siiQueryKey(tenantId) });
      // `enPlazo` es `null` cuando el acuse quedó exceptuado: no hay plazo que
      // juzgar. Quien lo consuma no puede confundir "exceptuado" con "en plazo".
      return { report: rep, enPlazo, limiteAcuse };
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
      const filas = await leerFilas(tenantId!);
      const fila = filas.find((f) => f.report.id === reportId);
      if (!fila) throw new Error("Expediente no encontrado.");
      const rep = fila.report;

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

      await guardarFila(tenantId!, fila);
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
      const filas = await leerFilas(tenantId!);
      const fila = filas.find((f) => f.report.id === reportId);
      if (!fila) throw new Error("Expediente no encontrado.");
      const rep = fila.report;

      const recusation: WhistleblowingRecusation = {
        id: `rec-${Date.now()}`,
        reportId,
        investigatorId: rep.assignedInvestigatorId,
        investigatorName: rep.assignedInvestigatorName,
        reason,
        details,
        substitutedById: `inv-${Date.now()}`,
        substitutedByName,
        approvedBy: siiRolesPara(tenantId).organoAprobadorRecusacion,
        recusedAt: new Date().toISOString(),
        status: "RECUSACION_FORMALIZADA",
      };

      rep.recusations.push(recusation);
      rep.assignedInvestigatorName = substitutedByName;

      await guardarFila(tenantId!, fila);
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
      const filas = await leerFilas(tenantId!);
      const fila = filas.find((f) => f.report.id === reportId);
      if (!fila) throw new Error("Expediente no encontrado.");
      const rep = fila.report;

      const sub = rep.subcases.find((s) => s.id === subcaseId);
      if (!sub) throw new Error("Subexpediente no encontrado.");

      sub.status = status;
      if (status === "CERRADO" || status === "TRANSFERIDO_REMEDIACION") {
        sub.closedAt = new Date().toISOString();
        sub.closingReason = closingReason;
        sub.remediationPlanId = remediationPlanId;
      }

      await guardarFila(tenantId!, fila);
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
      const filas = await leerFilas(tenantId!);
      const fila = filas.find((f) => f.report.id === reportId);
      if (!fila) throw new Error("Expediente no encontrado.");
      const rep = fila.report;

      const guard = validateCaseCloseoutGuard(rep);
      if (!guard.canClose) {
        throw new Error(`No es posible cerrar el expediente raíz: ${guard.blockingReasons.join(". ")}`);
      }

      const now = new Date();
      rep.status = status;
      rep.closedAt = now.toISOString();
      rep.closingReason = closingReason;

      // Completar el asiento con el resultado. La identidad del asiento
      // —número de entrada, fecha y referencia— es la que se asignó en el alta:
      // regenerarla entera daría un asiento distinto del que se registró.
      const asientoPrevio = rep.libroRegistroEntry;
      rep.libroRegistroEntry = {
        ...generateLibroRegistroEntry(rep, { outcome: closingReason, actionsTaken }),
        ...(asientoPrevio
          ? {
              recordNumber: asientoPrevio.recordNumber,
              entryDate: asientoPrevio.entryDate,
              referenciaAsiento: asientoPrevio.referenciaAsiento,
              numeroEntradaAsignadoAt: asientoPrevio.numeroEntradaAsignadoAt ?? null,
            }
          : {}),
      };

      await guardarFila(tenantId!, fila);
      queryClient.invalidateQueries({ queryKey: siiQueryKey(tenantId) });
      return rep;
    },
  });
}
