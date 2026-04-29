import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { StepperShell, type StepDef } from "./_shared/StepperShell";
import { useAgreementsList, useAgreementById, type AgreementListRow } from "@/hooks/useAgreementsList";
import { useEntitiesList } from "@/hooks/useEntities";
import { useRulePackForMateria } from "@/hooks/useRulePackForMateria";
import { useModelosAcuerdo } from "@/hooks/useModelosAcuerdo";
import { useCertificationRegistryIntake } from "@/hooks/useTramitador";
import { useTenantContext } from "@/context/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { ProcessDocxButton } from "@/components/secretaria/ProcessDocxButton";
import { Capa3CaptureDialog } from "@/components/secretaria/Capa3CaptureDialog";
import { validateCapa3 } from "@/components/secretaria/Capa3Form";
import type { PlantillaProtegidaRow } from "@/hooks/usePlantillasProtegidas";
import { resolveTemplateProcessMatrix } from "@/lib/secretaria/template-process-matrix";
import { statusLabel } from "@/lib/secretaria/status-labels";
import { persistRegistryFilingCertificationLink } from "@/lib/secretaria/registry-certification-link";

const STEPS: StepDef[] = [
  {
    n: 1,
    label: "Seleccionar acuerdo",
    hint: "El acuerdo debe estar certificado o adoptado para tramitación",
  },
  {
    n: 2,
    label: "Vía de presentación",
    hint: "Análisis del instrumento requerido (escritura/instancia) según motor de reglas",
  },
  {
    n: 3,
    label: "Datos del instrumento",
    hint: "Notaría, fecha de escritura y datos registrales",
  },
  {
    n: 4,
    label: "Presentación",
    hint: "Envío a BORME, PSM, SIGER, JUCERJA o CONSERVATORIA según jurisdicción",
  },
  {
    n: 5,
    label: "Seguimiento",
    hint: "Monitorización de estado, subsanaciones y publicación",
  },
];

function buildRegistryVariables({
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
}: {
  agreement: AgreementListRow;
  entityName: string;
  legalName: string;
  instrumentData: { notary: string; deedDate: string; protocolNumber: string };
  filingChannel: string;
  filingStatus: string;
  filingType: string | null;
  instrumentRequired: string;
  registryFilingId?: string | null;
  isSubsanacion?: boolean;
  subsanacionMotivo?: string;
  subsanacionDocs?: string;
}) {
  const documentosDisponibles = [
    agreement.status ? `Acuerdo en estado ${statusLabel(agreement.status)}` : null,
    instrumentData.protocolNumber ? `Protocolo ${instrumentData.protocolNumber}` : null,
    instrumentData.notary ? `Notaría ${instrumentData.notary}` : null,
    filingChannel ? `Canal ${filingChannel}` : null,
    subsanacionDocs?.trim() ? subsanacionDocs.trim() : null,
  ].filter(Boolean);
  const datosPresentacion = [
    filingType,
    filingChannel,
    instrumentData.protocolNumber ? `protocolo ${instrumentData.protocolNumber}` : null,
  ].filter(Boolean).join(" · ");
  const textoDecision = [
    `Materia: ${agreement.agreement_kind}`,
    `Clase: ${agreement.matter_class}`,
    `Modo: ${agreement.adoption_mode}`,
  ].join("\n");

  return {
    denominacion_social: legalName || entityName,
    materia: agreement.agreement_kind,
    materia_acuerdo: agreement.agreement_kind,
    clase_materia: agreement.matter_class,
    agreement_id: agreement.id,
    modo_adopcion: agreement.adoption_mode,
    estado_acuerdo: statusLabel(agreement.status),
    instrumento_requerido: instrumentRequired,
    tipo_presentacion: filingType ?? "",
    canal_presentacion: filingChannel || "No asignado",
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
    fecha: new Date().toLocaleDateString("es-ES"),
    expediente_registral_ref: registryFilingId ?? "",
    documento_registral_ref: registryFilingId ?? "",
    fecha_requerimiento: "",
    motivo_subsanacion: subsanacionMotivo ?? "",
    respuesta_subsanacion: subsanacionMotivo ?? "",
    documentos_subsanacion: subsanacionDocs ?? "",
  };
}

function buildRegistryFallback({
  agreement,
  entityName,
  legalName,
  instrumentData,
  filingChannel,
  filingStatus,
  filingType,
  instrumentRequired,
}: {
  agreement: AgreementListRow;
  entityName: string;
  legalName: string;
  instrumentData: { notary: string; deedDate: string; protocolNumber: string };
  filingChannel: string;
  filingStatus: string;
  filingType: string | null;
  instrumentRequired: string;
}) {
  return [
    "DOCUMENTO REGISTRAL",
    "",
    `Sociedad: ${legalName || entityName}`,
    `Acuerdo: ${agreement.agreement_kind}`,
    `Clase: ${agreement.matter_class}`,
    `Modo de adopcion: ${agreement.adoption_mode}`,
    `Estado del acuerdo: ${statusLabel(agreement.status)}`,
    "",
    "INSTRUMENTO",
    `Instrumento requerido: ${instrumentRequired}`,
    `Tipo de presentacion: ${filingType ?? "No consta"}`,
    `Notaria: ${instrumentData.notary || "No consta"}`,
    `Fecha de escritura: ${instrumentData.deedDate || "No consta"}`,
    `Numero de protocolo: ${instrumentData.protocolNumber || "No consta"}`,
    "",
    "TRAMITE",
    `Canal: ${filingChannel || "No asignado"}`,
    `Estado: ${statusLabel(filingStatus)}`,
  ].join("\n");
}

function buildSubsanacionFallback({
  agreement,
  entityName,
  legalName,
  subsanacionMotivo,
  subsanacionDocs,
}: {
  agreement: AgreementListRow;
  entityName: string;
  legalName: string;
  subsanacionMotivo: string;
  subsanacionDocs: string;
}) {
  return [
    "RESPUESTA DE SUBSANACION REGISTRAL",
    "",
    `Sociedad: ${legalName || entityName}`,
    `Acuerdo: ${agreement.agreement_kind}`,
    "",
    "MOTIVO",
    subsanacionMotivo || "Sin motivo informado.",
    "",
    "DOCUMENTOS ADJUNTOS",
    subsanacionDocs || "Sin documentos informados.",
  ].join("\n");
}

export default function TramitadorStepper() {
  const { tenantId } = useTenantContext();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const requestedMateria = searchParams.get("materia") || "";
  const requestedPlantillaId = searchParams.get("plantilla");
  const requestedTemplateType = searchParams.get("tipo");
  const requestedCertificationId = searchParams.get("certificacion");
  const scopedEntityId =
    searchParams.get("scope") === "sociedad" ? searchParams.get("entity") : null;
  const isSociedadScoped = Boolean(scopedEntityId);
  const scopedBackTo = isSociedadScoped && scopedEntityId
    ? `/secretaria/tramitador?scope=sociedad&entity=${encodeURIComponent(scopedEntityId)}`
    : "/secretaria/tramitador";
  const { data: entities = [] } = useEntitiesList();
  const { data: agreements = [], isLoading: agreementsLoading } = useAgreementsList([
    "CERTIFIED",
    "ADOPTED",
  ]);
  const scopedEntity = entities.find((entity) => entity.id === scopedEntityId) ?? null;
  const visibleAgreements = useMemo(
    () => scopedEntityId
      ? agreements.filter((agreement) => agreement.entity_id === scopedEntityId)
      : agreements,
    [agreements, scopedEntityId],
  );
  const materiaMatchedAgreements = useMemo(
    () => requestedMateria
      ? visibleAgreements.filter((agreement) => agreement.agreement_kind === requestedMateria)
      : [],
    [requestedMateria, visibleAgreements],
  );
  const baseDisplayedAgreements = requestedMateria && materiaMatchedAgreements.length > 0
    ? materiaMatchedAgreements
    : visibleAgreements;
  const requestedMateriaWithoutAgreement = Boolean(
    requestedMateria && !agreementsLoading && materiaMatchedAgreements.length === 0,
  );
  const {
    data: certificationIntake,
    isLoading: certificationLoading,
  } = useCertificationRegistryIntake(requestedCertificationId);
  const certifiedAgreementIds = useMemo(
    () => new Set(certificationIntake?.agreementIds ?? []),
    [certificationIntake?.agreementIds],
  );
  const displayedAgreements = requestedCertificationId
    ? certificationIntake
      ? baseDisplayedAgreements.filter((agreement) => certifiedAgreementIds.has(agreement.id))
      : []
    : baseDisplayedAgreements;
  const certificationWithoutRegistryAgreements = Boolean(
    requestedCertificationId &&
      certificationIntake &&
      certificationIntake.agreementIds.length === 0,
  );
  const certificationAgreementsOutOfScope = Boolean(
    requestedCertificationId &&
      certificationIntake &&
      certificationIntake.agreementIds.length > 0 &&
      displayedAgreements.length === 0,
  );

  const [selectedAgreementId, setSelectedAgreementId] = useState<string | null>(null);
  const { data: selectedAgreement } = useAgreementById(selectedAgreementId || undefined);

  const { data: rulePackData, isLoading: rulesLoading } = useRulePackForMateria(
    selectedAgreement?.agreement_kind
  );

  const [selectedModeloId, setSelectedModeloId] = useState<string | null>(null);
  const [modeloCapa3Open, setModeloCapa3Open] = useState(false);
  const [modeloCapa3Values, setModeloCapa3Values] = useState<Record<string, string>>({});
  const [modeloCapa3Errors, setModeloCapa3Errors] = useState<Record<string, string>>({});

  const materia = selectedAgreement?.agreement_kind ?? "";
  const { data: modelos = [], isLoading: modelosLoading } = useModelosAcuerdo(materia);
  const selectedModelo = useMemo(
    () => modelos.find((modelo) => modelo.id === selectedModeloId) ?? null,
    [modelos, selectedModeloId],
  );
  const requestedModeloAvailable = Boolean(
    requestedPlantillaId && modelos.some((modelo) => modelo.id === requestedPlantillaId),
  );
  const requestedModeloMissing = Boolean(
    requestedPlantillaId && selectedAgreement && !modelosLoading && modelos.length > 0 && !requestedModeloAvailable,
  );

  const [instrumentData, setInstrumentData] = useState({
    notary: "",
    deedDate: "",
    protocolNumber: "",
  });

  const [filingChannel, setFilingChannel] = useState<string>("");
  const [filingStatus, setFilingStatus] = useState<string>("DRAFT");
  const [deedSaved, setDeedSaved] = useState(false);
  const [deedSaving, setDeedSaving] = useState(false);
  const [subsanacionMotivo, setSubsanacionMotivo] = useState("");
  const [subsanacionDocs, setSubsanacionDocs] = useState("");
  const [subsanacionSaving, setSubsanacionSaving] = useState(false);
  const [subsanacionDone, setSubsanacionDone] = useState(false);
  const [registryLinkSaved, setRegistryLinkSaved] = useState(false);
  const [registryLinkMessage, setRegistryLinkMessage] = useState<string | null>(null);
  const [registryFilingId, setRegistryFilingId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedAgreementId) return;
    if (displayedAgreements.some((agreement) => agreement.id === selectedAgreementId)) return;
    setSelectedAgreementId(null);
    setSelectedModeloId(null);
    setInstrumentData({
      notary: "",
      deedDate: "",
      protocolNumber: "",
    });
    setFilingChannel("");
    setFilingStatus("DRAFT");
    setDeedSaved(false);
    setSubsanacionMotivo("");
    setSubsanacionDocs("");
    setSubsanacionDone(false);
    setRegistryLinkSaved(false);
    setRegistryLinkMessage(null);
    setRegistryFilingId(null);
  }, [displayedAgreements, selectedAgreementId]);

  useEffect(() => {
    if (requestedCertificationId) return;
    if (selectedAgreementId || materiaMatchedAgreements.length !== 1) return;
    setSelectedAgreementId(materiaMatchedAgreements[0].id);
  }, [materiaMatchedAgreements, requestedCertificationId, selectedAgreementId]);

  useEffect(() => {
    if (!certificationIntake || selectedAgreementId) return;
    const matches = displayedAgreements.filter((agreement) =>
      certificationIntake.agreementIds.includes(agreement.id)
    );
    if (matches.length === 1) {
      setSelectedAgreementId(matches[0].id);
    }
  }, [certificationIntake, displayedAgreements, selectedAgreementId]);

  useEffect(() => {
    if (!requestedPlantillaId || modelosLoading) return;
    if (modelos.some((modelo) => modelo.id === requestedPlantillaId)) {
      setSelectedModeloId(requestedPlantillaId);
    }
  }, [modelos, modelosLoading, requestedPlantillaId]);

  useEffect(() => {
    setModeloCapa3Values({});
    setModeloCapa3Errors({});
  }, [selectedModeloId]);

  const isDeedRequired = rulePackData?.payload.instrumentoRequerido === "ESCRITURA";
  const filingType = (() => {
    if (!rulePackData) return null;
    const payload = rulePackData.payload as Record<string, unknown>;
    if (typeof payload.filing_type === "string" && payload.filing_type.trim()) {
      return payload.filing_type;
    }
    if (
      Array.isArray(payload.registry_filing_types) &&
      typeof payload.registry_filing_types[0] === "string" &&
      payload.registry_filing_types[0].trim()
    ) {
      return payload.registry_filing_types[0];
    }
    return rulePackData.payload.instrumentoRequerido;
  })();
  const selectedAgreementEntity = selectedAgreement?.entity_id
    ? entities.find((entity) => entity.id === selectedAgreement.entity_id) ?? null
    : null;
  const selectedAgreementEntityName =
    selectedAgreementEntity?.common_name ??
    selectedAgreementEntity?.legal_name ??
    scopedEntity?.common_name ??
    scopedEntity?.legal_name ??
    "ARGA Seguros";
  const selectedAgreementLegalName =
    selectedAgreementEntity?.legal_name ??
    scopedEntity?.legal_name ??
    selectedAgreementEntityName;
  const selectedModeloTemplate = useMemo(() => selectedModelo
    ? ({
      ...selectedModelo,
      tenant_id: "cloud-modelo-acuerdo",
      tipo: "MODELO_ACUERDO",
      materia: selectedModelo.materia_acuerdo,
      jurisdiccion: selectedAgreementEntity?.jurisdiction ?? scopedEntity?.jurisdiction ?? "ES",
      aprobada_por: null,
      fecha_aprobacion: null,
      protecciones: {},
      snapshot_rule_pack_required: true,
      adoption_mode: selectedAgreement?.adoption_mode ?? null,
      organo_tipo: null,
      contrato_variables_version: null,
      created_at: "2026-04-29T00:00:00.000Z",
      approval_checklist: null,
      version_history: null,
      variables: [],
    } as PlantillaProtegidaRow)
    : null,
    [
      scopedEntity?.jurisdiction,
      selectedAgreement?.adoption_mode,
      selectedAgreementEntity?.jurisdiction,
      selectedModelo,
    ]);
  const selectedModeloMatrix = useMemo(
    () => resolveTemplateProcessMatrix(selectedModeloTemplate, {
      processHint: "tramitador_acuerdo",
      variables: {
        denominacion_social: selectedAgreementLegalName,
        materia_acuerdo: selectedAgreement?.agreement_kind ?? selectedModelo?.materia_acuerdo ?? "",
        estado_acuerdo: selectedAgreement ? statusLabel(selectedAgreement.status) : "",
        modo_adopcion: selectedAgreement?.adoption_mode ?? "",
        clase_materia: selectedAgreement?.matter_class ?? "",
        agreement_id: selectedAgreement?.id ?? "",
      },
      capa3Values: modeloCapa3Values,
    }),
    [
      modeloCapa3Values,
      selectedAgreement,
      selectedAgreementLegalName,
      selectedModelo?.materia_acuerdo,
      selectedModeloTemplate,
    ],
  );
  const selectedModeloCapa3Fields = selectedModeloMatrix?.capa3Fields ?? [];
  const selectedModeloPendingCapa3 = selectedModeloCapa3Fields.filter(
    (field) => field.obligatoriedad === "OBLIGATORIO" && !modeloCapa3Values[field.campo]?.trim(),
  ).length;

  function openModeloCapa3Capture() {
    if (!selectedAgreement || selectedModeloCapa3Fields.length === 0) return;
    setModeloCapa3Values((currentValues) =>
      Object.keys(currentValues).length > 0
        ? currentValues
        : selectedModeloMatrix?.initialCapa3Values ?? {},
    );
    setModeloCapa3Errors({});
    setModeloCapa3Open(true);
  }

  function submitModeloCapa3Capture() {
    const errors = validateCapa3(selectedModeloCapa3Fields, modeloCapa3Values);
    if (Object.keys(errors).length > 0) {
      setModeloCapa3Errors(errors);
      return;
    }
    setModeloCapa3Errors({});
    setModeloCapa3Open(false);
  }

  function preferredTemplateIdFor(processHint: string) {
    if (!requestedPlantillaId || !requestedTemplateType) return null;
    const probe = {
      ...(selectedModeloTemplate ?? {}),
      id: requestedPlantillaId,
      tipo: requestedTemplateType,
      tenant_id: "template-query-param",
      jurisdiccion: selectedAgreementEntity?.jurisdiction ?? scopedEntity?.jurisdiction ?? "ES",
      estado: "ACTIVA",
      version: "query",
      materia_acuerdo: selectedAgreement?.agreement_kind ?? (requestedMateria || null),
      adoption_mode: selectedAgreement?.adoption_mode ?? null,
      protecciones: {},
      variables: [],
      snapshot_rule_pack_required: true,
    } as PlantillaProtegidaRow;
    return resolveTemplateProcessMatrix(probe, { processHint }) ? requestedPlantillaId : null;
  }

  const certificationRegistryVariables = certificationIntake
    ? {
        certificacion_id: certificationIntake.id,
        certificacion_minute_id: certificationIntake.minuteId ?? "",
        certificacion_estado_firma: statusLabel(certificationIntake.signatureStatus),
        certificacion_referencias: certificationIntake.references,
        certificacion_acuerdos_enlazables: certificationIntake.agreementIds,
        certificacion_referencias_punto: certificationIntake.pointReferences,
        certificacion_evidence_id: certificationIntake.evidenceId ?? "",
        certificacion_gate_hash: certificationIntake.gateHash ?? "",
      }
    : {};
  const registryDocVariables = selectedAgreement && rulePackData
    ? {
        ...buildRegistryVariables({
          agreement: selectedAgreement,
          entityName: selectedAgreementEntityName,
          legalName: selectedAgreementLegalName,
          instrumentData,
          filingChannel,
          filingStatus,
          filingType,
          instrumentRequired: rulePackData.payload.instrumentoRequerido,
          registryFilingId,
        }),
        ...certificationRegistryVariables,
      }
    : null;
  const registryDocFallback = selectedAgreement && rulePackData
    ? buildRegistryFallback({
      agreement: selectedAgreement,
      entityName: selectedAgreementEntityName,
      legalName: selectedAgreementLegalName,
      instrumentData,
      filingChannel,
      filingStatus,
      filingType,
      instrumentRequired: rulePackData.payload.instrumentoRequerido,
    })
    : "";
  const subsanacionDocVariables = selectedAgreement && rulePackData
    ? {
        ...buildRegistryVariables({
          agreement: selectedAgreement,
          entityName: selectedAgreementEntityName,
          legalName: selectedAgreementLegalName,
          instrumentData,
          filingChannel,
          filingStatus,
          filingType,
          instrumentRequired: rulePackData.payload.instrumentoRequerido,
          registryFilingId,
          isSubsanacion: true,
          subsanacionMotivo,
          subsanacionDocs,
        }),
        ...certificationRegistryVariables,
      }
    : null;
  const subsanacionDocFallback = selectedAgreement
    ? buildSubsanacionFallback({
      agreement: selectedAgreement,
      entityName: selectedAgreementEntityName,
      legalName: selectedAgreementLegalName,
      subsanacionMotivo,
      subsanacionDocs,
    })
    : "";
  const selectedAgreementAllowedByCertification = !certificationIntake ||
    certifiedAgreementIds.has(selectedAgreement?.id ?? "");
  const certificationEvidenceReady = !certificationIntake || certificationIntake.hasEvidenceBundle;
  const selectedAgreementVisible = Boolean(
    selectedAgreement && displayedAgreements.some((agreement) => agreement.id === selectedAgreement.id),
  );
  const step1CanAdvance = Boolean(
    selectedAgreement &&
      selectedAgreementVisible &&
      selectedAgreementAllowedByCertification &&
      !agreementsLoading &&
      !certificationLoading &&
      !certificationWithoutRegistryAgreements &&
      !certificationAgreementsOutOfScope,
  );

  const canRegisterDeed = Boolean(
    tenantId &&
      selectedAgreement &&
      selectedAgreementAllowedByCertification &&
      certificationEvidenceReady &&
      isDeedRequired &&
      filingType &&
      instrumentData.notary.trim() &&
      instrumentData.deedDate &&
      instrumentData.protocolNumber.trim()
  );

  const handleSelectAgreement = (agreementId: string) => {
    if (certificationIntake && !certifiedAgreementIds.has(agreementId)) {
      toast.error("Ese acuerdo no está incluido en la certificación de entrada.");
      return;
    }
    setSelectedAgreementId(agreementId);
    setSelectedModeloId(null);
    setInstrumentData({
      notary: "",
      deedDate: "",
      protocolNumber: "",
    });
    setFilingChannel("");
    setFilingStatus("DRAFT");
    setDeedSaved(false);
    setSubsanacionMotivo("");
    setSubsanacionDocs("");
    setSubsanacionDone(false);
    setRegistryLinkSaved(false);
    setRegistryLinkMessage(null);
    setRegistryFilingId(null);
  };

  async function handleRegisterDeed() {
    if (!tenantId || !selectedAgreement || !rulePackData) {
      toast.error("No se pudo preparar la escritura para este acuerdo.");
      return;
    }

    if (!selectedAgreementAllowedByCertification) {
      toast.error("El acuerdo seleccionado no pertenece a la certificación de entrada.");
      return;
    }

    if (!certificationEvidenceReady) {
      toast.error("La certificación aún no tiene evidencia demo/operativa vinculada; no constituye evidencia final productiva.");
      return;
    }

    if (!isDeedRequired) {
      toast.error("Este acuerdo no requiere escritura pública.");
      return;
    }

    if (
      !instrumentData.notary.trim() ||
      !instrumentData.deedDate ||
      !instrumentData.protocolNumber.trim()
    ) {
      toast.error("Complete notaría, fecha de escritura y número de protocolo.");
      return;
    }

    const filingPayload = {
      tenant_id: tenantId,
      agreement_id: selectedAgreement.id,
      deed_reference: instrumentData.protocolNumber.trim(),
      deed_date: instrumentData.deedDate,
      notary_id: null,
      notary_name: instrumentData.notary.trim(),
      protocol_number: instrumentData.protocolNumber.trim(),
      elevated_at: new Date().toISOString(),
      status: "ELEVATED",
      filing_type: filingType,
      filing_via: filingChannel || null,
    };

    setDeedSaving(true);
    try {
      let registryFilingId: string | null = null;
      const { data: existingRows, error: existingError } = await supabase
        .from("registry_filings")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("agreement_id", selectedAgreement.id)
        .order("created_at", { ascending: false })
        .limit(1);
      if (existingError) throw existingError;

      const existingId = existingRows?.[0]?.id;
      if (existingId) {
        const { error: updateError } = await supabase
          .from("registry_filings")
          .update(filingPayload)
          .eq("id", existingId);
        if (updateError) throw updateError;
        registryFilingId = existingId;
      } else {
        const { data: insertedFiling, error: insertError } = await supabase
          .from("registry_filings")
          .insert(filingPayload)
          .select("id")
          .maybeSingle();
        if (insertError) throw insertError;
        registryFilingId = (insertedFiling as { id?: string } | null)?.id ?? null;
      }

      if (registryFilingId && certificationIntake) {
        const linkResult = await persistRegistryFilingCertificationLink({
          tenantId,
          registryFilingId,
          agreementId: selectedAgreement.id,
          certification: certificationIntake,
        });
        if (linkResult.auditLogged || linkResult.evidenceArtifactCreated) {
          setRegistryLinkSaved(true);
          setRegistryLinkMessage(
            linkResult.evidenceArtifactCreated
              ? "Vínculo certificación-tramitación añadido al bundle operativo demo, pendiente de audit/retention/legal hold."
              : "Vínculo certificación-tramitación registrado en audit_log.",
          );
        } else {
          setRegistryLinkSaved(false);
          setRegistryLinkMessage(
            linkResult.errors[0] ?? "La escritura se guardó, pero no se pudo registrar el vínculo probatorio.",
          );
          toast.warning("Escritura registrada con vínculo probatorio pendiente", {
            description: linkResult.errors[0],
          });
        }
      }

      setDeedSaved(true);
      setRegistryFilingId(registryFilingId);
      setFilingStatus("ELEVATED");
      await queryClient.invalidateQueries({ queryKey: ["registry_filings", tenantId] });
      await queryClient.invalidateQueries({ queryKey: ["evidence_bundles", tenantId] });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`No se pudo registrar la escritura: ${message}`);
    } finally {
      setDeedSaving(false);
    }
  }

  async function handleSubsanacionSubmit() {
    if (!selectedAgreementId || !tenantId) {
      toast.error("No se puede enviar la subsanación sin acuerdo y tenant activos.");
      return;
    }
    setSubsanacionSaving(true);
    try {
      let targetFilingId = registryFilingId;
      if (!targetFilingId) {
        const { data: existingRows, error: existingError } = await supabase
          .from("registry_filings")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("agreement_id", selectedAgreementId)
          .order("created_at", { ascending: false })
          .limit(1);
        if (existingError) throw existingError;
        targetFilingId = existingRows?.[0]?.id ?? null;
      }
      if (!targetFilingId) {
        throw new Error("No hay tramitación registral activa para subsanar.");
      }

      const { error } = await supabase
        .from("registry_filings")
        .update({ status: "SUBMITTED" })
        .eq("id", targetFilingId)
        .eq("tenant_id", tenantId);
      if (error) throw error;
      setRegistryFilingId(targetFilingId);
      setFilingStatus("SUBMITTED");
      setSubsanacionDone(true);
      await queryClient.invalidateQueries({ queryKey: ["registry_filings", tenantId] });
    } catch (error) {
      const description = error instanceof Error ? error.message : "Inténtelo de nuevo.";
      toast.error("No se pudo enviar la respuesta de subsanación", { description });
    } finally {
      setSubsanacionSaving(false);
    }
  }

  // Step 1: Select agreement
  const step1Body = (
    <div className="space-y-4">
      {isSociedadScoped && (
        <div
          className="border border-[var(--g-sec-300)] bg-[var(--g-sec-100)] px-4 py-3 text-sm text-[var(--g-text-primary)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          Modo Sociedad activo: el tramitador solo muestra acuerdos de{" "}
          <span className="font-semibold">
            {scopedEntity?.legal_name ?? scopedEntity?.common_name ?? "la sociedad seleccionada"}
          </span>
          .
        </div>
      )}
      {requestedCertificationId ? (
        <div
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-4 py-3 text-sm text-[var(--g-text-secondary)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="font-semibold text-[var(--g-text-primary)]">
                Entrada desde certificación
              </div>
              <div className="mt-1">
                {certificationLoading ? (
                  <span>Cargando certificación…</span>
                ) : certificationIntake ? (
                  <>
                    Certificación <span className="font-mono text-xs">{certificationIntake.id.slice(0, 8)}</span>
                    {" "}· firma {statusLabel(certificationIntake.signatureStatus)}
                    {" "}· {certificationIntake.references.length} referencia(s) certificada(s).
                  </>
                ) : (
                  <span>No se ha encontrado la certificación indicada en el tenant activo.</span>
                )}
              </div>
              {certificationIntake?.pointReferences.length ? (
                <div className="mt-2 text-xs text-[var(--g-text-secondary)]">
                  {certificationIntake.unresolvedPointReferences.length > 0 ? (
                    <>
                      Hay {certificationIntake.unresolvedPointReferences.length} referencia(s) por punto sin `agreement_id`.
                      Para presentar al registro, materialice el expediente canónico desde el acta.
                    </>
                  ) : (
                    <>
                      Las {certificationIntake.pointReferences.length} referencia(s) por punto ya se resuelven a Acuerdo 360 canónico sin alterar la certificación original.
                    </>
                  )}
                </div>
              ) : null}
            </div>
            {certificationIntake ? (
              <div className="flex flex-wrap gap-2">
                <span
                  className={`px-2 py-0.5 text-[11px] font-semibold ${
                    certificationIntake.signed
                      ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
                      : "bg-[var(--status-warning)] text-[var(--g-text-inverse)]"
                  }`}
                  style={{ borderRadius: "var(--g-radius-full)" }}
                >
                  {certificationIntake.signed ? "Firmada" : "Pendiente de firma"}
                </span>
                <span
                  className={`px-2 py-0.5 text-[11px] font-semibold ${
                    certificationIntake.hasEvidenceBundle
                      ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
                      : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
                  }`}
                  style={{ borderRadius: "var(--g-radius-full)" }}
                >
                  {certificationIntake.hasEvidenceBundle ? "Bundle demo vinculado" : "Evidencia operativa pendiente"}
                </span>
                {certificationIntake.resolvedPointAgreementIds.length > 0 ? (
                  <span
                    className="bg-[var(--g-sec-100)] px-2 py-0.5 text-[11px] font-semibold text-[var(--g-brand-3308)]"
                    style={{ borderRadius: "var(--g-radius-full)" }}
                  >
                    Refs resueltas
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      {(requestedMateria || requestedPlantillaId) && (
        <div
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-4 py-3 text-sm text-[var(--g-text-primary)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          Entrada desde plantilla
          {requestedMateria ? (
            <>
              {" "}para materia <span className="font-semibold">{requestedMateria}</span>
            </>
          ) : null}
          {requestedPlantillaId ? (
            <>
              {" "}· plantilla <span className="font-mono text-xs">{requestedPlantillaId.slice(0, 8)}</span>
            </>
          ) : null}
          . El asistente prioriza acuerdos compatibles certificados o adoptados.
          {materiaMatchedAgreements.length > 1 ? (
            <>
              {" "}Hay {materiaMatchedAgreements.length} acuerdos compatibles; seleccione el expediente concreto.
            </>
          ) : null}
        </div>
      )}
      {requestedMateriaWithoutAgreement && (
        <div
          className="flex items-start gap-2 px-4 py-3 text-sm text-[var(--status-warning)]"
          style={{ borderRadius: "var(--g-radius-md)", background: "var(--g-surface-muted)" }}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          No hay acuerdos disponibles de materia {requestedMateria} en el ámbito actual. Se muestran el resto de acuerdos tramitables.
        </div>
      )}
      {agreementsLoading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-[var(--g-text-secondary)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando acuerdos...
        </div>
      ) : displayedAgreements.length === 0 ? (
        <div
          className="flex items-start gap-2 px-4 py-3 text-sm text-[var(--status-warning)]"
          style={{
            borderRadius: "var(--g-radius-md)",
            background: "var(--g-surface-muted)",
          }}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {certificationLoading
              ? "Cargando acuerdos incluidos en la certificación…"
              : certificationWithoutRegistryAgreements
                ? "La certificación solo contiene referencias por punto y todavía no tiene un expediente de acuerdo inscribible enlazable."
                : certificationAgreementsOutOfScope
                  ? "La certificación contiene acuerdos, pero ninguno está disponible en el ámbito de sociedad actual."
                  : isSociedadScoped
                    ? "No hay acuerdos certificados o adoptados disponibles para esta sociedad"
                    : "No hay acuerdos certificados o adoptados disponibles"}
          </span>
        </div>
      ) : (
        <div className="space-y-2">
          {displayedAgreements.map((agreement) => {
            const includedInCertification = certifiedAgreementIds.has(agreement.id);
            return (
              <button
                key={agreement.id}
                type="button"
                onClick={() => handleSelectAgreement(agreement.id)}
                className={`w-full text-left flex items-center justify-between px-4 py-3 border transition-colors ${
                  selectedAgreementId === agreement.id
                    ? "border-[var(--g-brand-3308)] bg-[var(--g-sec-100)]"
                    : includedInCertification
                      ? "border-[var(--g-sec-300)] bg-[var(--g-surface-subtle)]"
                      : "border-[var(--g-border-subtle)] hover:border-[var(--g-brand-3308)] hover:bg-[var(--g-surface-subtle)]/50"
                }`}
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-[var(--g-text-primary)]">
                    {agreement.agreement_kind}
                    {includedInCertification ? (
                      <span
                        className="bg-[var(--g-sec-100)] px-2 py-0.5 text-[10px] font-semibold text-[var(--g-brand-3308)]"
                        style={{ borderRadius: "var(--g-radius-full)" }}
                      >
                        Incluido en certificación
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-[var(--g-text-secondary)] mt-0.5">
                    Clase: {agreement.matter_class} • Modo: {agreement.adoption_mode}
                  </div>
                </div>
                <span
                  className={`px-2 py-1 text-[10px] font-semibold rounded-full ${
                    agreement.status === "CERTIFIED"
                      ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
                      : "bg-[var(--g-brand-bright)] text-[var(--g-text-inverse)]"
                  }`}
                >
                  {statusLabel(agreement.status)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  // Step 2: Inscription analysis
  const step2Body = selectedAgreement && rulePackData ? (
    <div className="space-y-4">
      <div
        className="border border-[var(--g-border-subtle)] rounded-lg p-4 bg-[var(--g-surface-subtle)]"
      >
        <div className="text-sm font-semibold text-[var(--g-text-primary)] mb-3">
          Análisis de inscribibilidad
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--g-text-secondary)]">Inscribible:</span>
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                rulePackData.payload.inscribible
                  ? "bg-[var(--status-success)]/10 text-[var(--status-success)]"
                  : "bg-[var(--status-warning)]/10 text-[var(--status-warning)]"
              }`}
            >
              {rulePackData.payload.inscribible ? "Sí" : "No"}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--g-text-secondary)]">Instrumento requerido:</span>
            <span className="px-2 py-0.5 text-xs font-medium text-[var(--g-text-primary)]">
              {rulePackData.payload.instrumentoRequerido}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--g-text-secondary)]">Publicación requerida:</span>
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                rulePackData.payload.publicacionRequerida
                  ? "bg-[var(--status-warning)]/10 text-[var(--status-warning)]"
                  : "bg-[var(--status-success)]/10 text-[var(--status-success)]"
              }`}
            >
              {rulePackData.payload.publicacionRequerida ? "Sí" : "No"}
            </span>
          </div>
        </div>
      </div>

      {rulePackData.payload.plazoInscripcion && (
        <div
          className="px-4 py-2 text-sm text-[var(--g-text-secondary)] bg-[var(--g-surface-muted)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          Plazo de inscripción: {rulePackData.payload.plazoInscripcion} días
        </div>
      )}

      {/* Modelo de acuerdo */}
      <div className="border border-[var(--g-border-subtle)] p-4 space-y-3"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        <div className="text-sm font-semibold text-[var(--g-text-primary)]">
          Modelo de acuerdo (referencia)
        </div>

        {modelosLoading ? (
          <div className="flex items-center gap-2 text-sm text-[var(--g-text-secondary)]">
            <Loader2 className="h-3 w-3 animate-spin" />
            Cargando modelos...
          </div>
        ) : modelos.length === 0 ? (
          <div className="text-xs text-[var(--g-text-secondary)] px-3 py-2 bg-[var(--g-surface-muted)]"
            style={{ borderRadius: "var(--g-radius-sm)" }}
          >
            No hay modelo de acuerdo disponible para esta materia en este momento.
          </div>
        ) : (
          <div className="space-y-2">
            {requestedModeloMissing ? (
              <div
                className="flex items-start gap-2 px-3 py-2 text-xs text-[var(--status-warning)]"
                style={{ borderRadius: "var(--g-radius-sm)", background: "var(--g-surface-muted)" }}
              >
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                La plantilla indicada no corresponde a los modelos disponibles para esta materia. Seleccione un modelo alternativo.
              </div>
            ) : null}
            {modelos.map((m) => (
              <label key={m.id} className="flex items-start gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="modelo_acuerdo"
                  value={m.id}
                  checked={selectedModeloId === m.id}
                  onChange={() => setSelectedModeloId(m.id)}
                  className="mt-0.5 accent-[var(--g-brand-3308)]"
                />
                <div className="flex-1">
                  <span className="text-sm text-[var(--g-text-primary)]">
                    {m.contenido_template ?? m.materia_acuerdo}
                  </span>
                  {requestedPlantillaId === m.id && (
                    <span
                      className="ml-2 bg-[var(--g-sec-100)] px-2 py-0.5 text-[10px] font-semibold text-[var(--g-brand-3308)]"
                      style={{ borderRadius: "var(--g-radius-full)" }}
                    >
                      Plantilla indicada
                    </span>
                  )}
                  {m.referencia_legal && (
                    <span className="ml-2 text-xs text-[var(--g-text-secondary)]">
                      ({m.referencia_legal})
                    </span>
                  )}
                </div>
              </label>
            ))}
          </div>
        )}

        {selectedModelo?.capa1_inmutable ? (
            <div className="space-y-1">
              <div className="text-xs font-medium text-[var(--g-text-secondary)] uppercase tracking-wide">
                Texto del modelo
              </div>
              <textarea
                readOnly
                rows={6}
                value={selectedModelo.capa1_inmutable}
                className="w-full px-3 py-2 text-xs text-[var(--g-text-secondary)] bg-[var(--g-surface-muted)] border border-[var(--g-border-subtle)] resize-none"
                style={{ borderRadius: "var(--g-radius-sm)", fontFamily: "monospace" }}
              />
              <p className="text-xs text-[var(--g-text-secondary)]">
                El texto puede ser editado en la pantalla de redacción del acuerdo.
              </p>
              {selectedModeloCapa3Fields.length > 0 ? (
                <div
                  className="mt-3 flex flex-wrap items-center justify-between gap-3 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <div>
                    <p className="text-xs font-medium text-[var(--g-text-primary)]">
                      Capa 3 del modelo de acuerdo
                    </p>
                    <p className="text-xs text-[var(--g-text-secondary)]">
                      {selectedModeloCapa3Fields.length} campo(s) editable(s)
                      {selectedModeloPendingCapa3 > 0
                        ? ` · ${selectedModeloPendingCapa3} obligatorio(s) pendiente(s)`
                        : " · captura preparada"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={openModeloCapa3Capture}
                    className="border border-[var(--g-border-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)]"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    Completar Capa 3
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
      </div>

      {rulesLoading && (
        <div className="flex items-center gap-2 py-4 text-sm text-[var(--g-text-secondary)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando reglas...
        </div>
      )}
    </div>
  ) : (
    <div
      className="flex items-center gap-2 px-4 py-3 text-sm text-[var(--status-warning)]"
      style={{
        borderRadius: "var(--g-radius-md)",
        background: "var(--g-surface-muted)",
      }}
    >
      <AlertTriangle className="h-4 w-4" />
      Seleccione un acuerdo en el paso anterior
    </div>
  );

  // Step 3: Instrument data (only if ESCRITURA or INSTANCIA)
  const showInstrumentForm =
    rulePackData && rulePackData.payload.instrumentoRequerido !== "NINGUNO";

  const step3Body = showInstrumentForm ? (
    <div className="space-y-4">
      {rulePackData?.payload.instrumentoRequerido === "ESCRITURA" && (
        <>
          <div>
            <label className="block text-sm font-medium text-[var(--g-text-primary)] mb-2">
              Notaría
            </label>
            <input
              type="text"
              placeholder="Ej: Notaría López García, Madrid"
              value={instrumentData.notary}
              onChange={(e) => setInstrumentData({ ...instrumentData, notary: e.target.value })}
              className="w-full px-3 py-2 border border-[var(--g-border-subtle)] text-sm text-[var(--g-text-primary)] placeholder-[var(--g-text-secondary)] bg-[var(--g-surface-card)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--g-text-primary)] mb-2">
              Fecha de escritura
            </label>
            <input
              type="date"
              value={instrumentData.deedDate}
              onChange={(e) => setInstrumentData({ ...instrumentData, deedDate: e.target.value })}
              className="w-full px-3 py-2 border border-[var(--g-border-subtle)] text-sm text-[var(--g-text-primary)] bg-[var(--g-surface-card)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--g-text-primary)] mb-2">
              Número de protocolo
            </label>
            <input
              type="text"
              placeholder="Ej: 2026/5432"
              value={instrumentData.protocolNumber}
              onChange={(e) =>
                setInstrumentData({ ...instrumentData, protocolNumber: e.target.value })
              }
              className="w-full px-3 py-2 border border-[var(--g-border-subtle)] text-sm text-[var(--g-text-primary)] placeholder-[var(--g-text-secondary)] bg-[var(--g-surface-card)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            />
          </div>
        </>
      )}

      {rulePackData?.payload.instrumentoRequerido === "INSTANCIA" && (
        <div
          className="px-4 py-3 text-sm text-[var(--g-text-secondary)]"
          style={{
            borderRadius: "var(--g-radius-md)",
            background: "var(--g-surface-muted)",
          }}
        >
          Tramitación vía instancia notarial. Los datos se completarán en el paso siguiente.
        </div>
      )}
    </div>
  ) : (
    <div
      className="flex items-center gap-2 px-4 py-3 text-sm text-[var(--status-warning)]"
      style={{
        borderRadius: "var(--g-radius-md)",
        background: "var(--g-surface-muted)",
      }}
    >
      <AlertTriangle className="h-4 w-4" />
      Este acuerdo no requiere instrumento especial (NINGUNO)
    </div>
  );

  // Step 4: Filing submission
  const step4Body = (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-[var(--g-text-primary)] mb-2">
          Canal de presentación
        </label>
        <select
          value={filingChannel}
          onChange={(e) => setFilingChannel(e.target.value)}
          className="w-full px-3 py-2 border border-[var(--g-border-subtle)] text-sm text-[var(--g-text-primary)] bg-[var(--g-surface-card)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <option value="">Seleccionar canal</option>
          <option value="BORME">BORME (Boletín Oficial del Registro Mercantil)</option>
          <option value="PSM">PSM (Portal de Servicios del Ministerio)</option>
          <option value="SIGER">SIGER (Sistema de Gestión de Registros Mercantiles)</option>
          <option value="JUCERJA">JUCERJA (Junta Central del Registro Mercantil)</option>
          <option value="CONSERVATORIA">Conservatoria (Portugal)</option>
        </select>
      </div>

      {filingChannel && (
        <div
          className="px-4 py-3 text-sm text-[var(--g-text-secondary)]"
          style={{
            borderRadius: "var(--g-radius-md)",
            background: "var(--g-surface-subtle)",
          }}
        >
          Canal "{filingChannel}" seleccionado. La presentación se enviará automáticamente.
        </div>
      )}
    </div>
  );

  // Step 5: Tracking status
  const step5Body = (
    <div className="space-y-4">
      <div
        className={`flex items-center gap-2 px-4 py-3 rounded-lg ${
          deedSaved
            ? "bg-[var(--status-success)]/10 text-[var(--status-success)]"
            : isDeedRequired
              ? "bg-[var(--status-warning)]/10 text-[var(--status-warning)]"
              : "bg-[var(--status-success)]/10 text-[var(--status-success)]"
        }`}
      >
        <CheckCircle2 className="h-5 w-5" />
        <span className="text-sm font-medium">
          {deedSaved
            ? "Escritura registrada"
            : isDeedRequired
              ? "Pendiente de registrar escritura"
              : "Expediente en seguimiento"}
        </span>
      </div>

      {isDeedRequired && (
        <div
          className="border border-[var(--g-border-subtle)] rounded-lg p-4 bg-[var(--g-surface-card)]"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-[var(--g-text-primary)]">
                Escritura pública
              </div>
              <div className="mt-1 text-xs text-[var(--g-text-secondary)]">
                {certificationIntake && !certificationIntake.hasEvidenceBundle
                  ? "Antes de registrar, genere y archive la certificación DOCX para vincular evidencia demo/operativa; no constituye evidencia final productiva."
                  : "Se guardará en el tramitador registral como elevada a público."}
              </div>
            </div>

            {deedSaved ? (
              <div className="inline-flex items-center gap-2 rounded-full bg-[var(--g-sec-100)] px-3 py-1 text-xs font-semibold text-[var(--g-brand-3308)]">
                <CheckCircle2 className="h-4 w-4 text-[var(--status-success)]" />
                Persistida
              </div>
            ) : (
              <button
                type="button"
                onClick={handleRegisterDeed}
                disabled={!canRegisterDeed || deedSaving}
                className="inline-flex items-center justify-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] disabled:bg-[var(--g-surface-muted)] disabled:text-[var(--g-text-secondary)] disabled:opacity-100"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                {deedSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                {deedSaving ? "Guardando escritura..." : "Registrar escritura"}
              </button>
            )}
          </div>
          {certificationIntake ? (
            <div
              className="mt-4 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-3 py-2 text-xs text-[var(--g-text-secondary)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <div className="font-semibold text-[var(--g-text-primary)]">
                Vínculo probatorio operativo de certificación
              </div>
              <div className="mt-1">
                {!certificationIntake.hasEvidenceBundle
                  ? "Evidencia operativa pendiente: genere y archive la certificación DOCX desde el acta antes de registrar la escritura."
                  : registryLinkSaved
                  ? registryLinkMessage ?? "Vínculo registrado."
                  : "Al registrar la escritura se añadirá un evento en audit_log y, si existe bundle operativo demo, una referencia documental WORM pendiente de audit/retention/legal hold."}
              </div>
            </div>
          ) : null}
        </div>
      )}

      <div
        className="border border-[var(--g-border-subtle)] rounded-lg p-4 bg-[var(--g-surface-subtle)]"
      >
        <div className="text-sm font-semibold text-[var(--g-text-primary)] mb-3">
          Estado del trámite
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--g-text-secondary)]">Estado:</span>
            <span className="px-2 py-0.5 text-xs font-medium text-[var(--g-text-primary)]">
              {statusLabel(filingStatus)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--g-text-secondary)]">Canal:</span>
            <span className="px-2 py-0.5 text-xs font-medium text-[var(--g-text-primary)]">
              {filingChannel || "No asignado"}
            </span>
          </div>
        </div>

        {selectedAgreement && rulePackData && registryDocVariables && showInstrumentForm ? (
          <div className="mt-4 border-t border-[var(--g-border-subtle)] pt-4">
            <ProcessDocxButton
              label="Documento registral DOCX"
              variant="outline"
              input={{
                kind: "DOCUMENTO_REGISTRAL",
                recordId: selectedAgreement.id,
                title: `Documento registral: ${selectedAgreement.agreement_kind}`,
                subtitle: selectedAgreementLegalName,
                entityName: selectedAgreementLegalName,
                templateTypes: ["DOCUMENTO_REGISTRAL"],
                variables: registryDocVariables,
                templateCriteria: {
                  jurisdiction: selectedAgreementEntity?.jurisdiction ?? scopedEntity?.jurisdiction,
                  materia: selectedAgreement.agreement_kind,
                  adoptionMode: selectedAgreement.adoption_mode,
                },
                preferredTemplateId: preferredTemplateIdFor("DOCUMENTO_REGISTRAL"),
                fallbackText: registryDocFallback,
                filenamePrefix: "documento_registral",
              }}
            />
          </div>
        ) : null}
      </div>

      {filingStatus === "SUBSANACION" && (
        <div className="space-y-3 border border-[var(--status-warning)] bg-[var(--g-surface-muted)] p-4"
          style={{ borderRadius: "var(--g-radius-lg)" }}
        >
          {subsanacionDone ? (
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--status-success)]" />
              <div>
                <p className="text-sm font-semibold text-[var(--g-text-primary)]">Subsanación enviada</p>
                <p className="mt-0.5 text-xs text-[var(--g-text-secondary)]">
                  La respuesta ha sido registrada. El trámite vuelve a estado presentada.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--status-warning)]">
                <AlertTriangle className="h-4 w-4" />
                Subsanación requerida por el Registro
              </div>
              <p className="text-xs text-[var(--g-text-secondary)]">
                El Registro ha solicitado subsanación. Indique el motivo de la respuesta y los documentos adjuntos.
              </p>
              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--g-text-primary)]">
                  Motivo de la subsanación
                </label>
                <textarea
                  rows={3}
                  value={subsanacionMotivo}
                  onChange={(e) => setSubsanacionMotivo(e.target.value)}
                  placeholder="Describa la corrección realizada…"
                  className="w-full resize-none rounded border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-[var(--g-text-primary)]">
                  Documentos adjuntos (referencia)
                </label>
                <input
                  type="text"
                  value={subsanacionDocs}
                  onChange={(e) => setSubsanacionDocs(e.target.value)}
                  placeholder="Ej: Escritura corregida, certificado notarial…"
                  className="w-full rounded border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </div>
              <button
                type="button"
                onClick={handleSubsanacionSubmit}
                disabled={!subsanacionMotivo.trim() || subsanacionSaving}
                className="inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] disabled:opacity-50"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                {subsanacionSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                {subsanacionSaving ? "Enviando…" : "Enviar respuesta de subsanación"}
              </button>
              {selectedAgreement && subsanacionDocVariables ? (
                <ProcessDocxButton
                  label="Subsanación DOCX"
                  input={{
                    kind: "SUBSANACION_REGISTRAL",
                    recordId: selectedAgreement.id,
                    title: `Respuesta de subsanación: ${selectedAgreement.agreement_kind}`,
                    subtitle: selectedAgreementLegalName,
                    entityName: selectedAgreementLegalName,
                    templateTypes: ["SUBSANACION_REGISTRAL", "DOCUMENTO_REGISTRAL"],
                    variables: subsanacionDocVariables,
                    templateCriteria: {
                      jurisdiction: selectedAgreementEntity?.jurisdiction ?? scopedEntity?.jurisdiction,
                      materia: selectedAgreement.agreement_kind,
                      adoptionMode: selectedAgreement.adoption_mode,
                    },
                    preferredTemplateId: preferredTemplateIdFor("SUBSANACION_REGISTRAL"),
                    fallbackText: subsanacionDocFallback,
                    filenamePrefix: "subsanacion_registral",
                  }}
                />
              ) : null}
            </>
          )}
        </div>
      )}

      <div
        className="px-4 py-3 text-xs text-[var(--g-text-secondary)]"
        style={{
          borderRadius: "var(--g-radius-md)",
          background: "var(--g-surface-muted)",
        }}
      >
        El sistema monitorizará automáticamente el estado de la presentación y le notificará de
        cambios o subsanaciones requeridas.
      </div>
    </div>
  );

  return (
    <>
      <StepperShell
        eyebrow="Secretaría · Tramitación registral"
        title="Asistente de tramitación"
        backTo={scopedBackTo}
        steps={[
          { ...STEPS[0], body: step1Body, canAdvance: step1CanAdvance },
          { ...STEPS[1], body: step2Body },
          { ...STEPS[2], body: step3Body },
          { ...STEPS[3], body: step4Body },
          { ...STEPS[4], body: step5Body },
        ]}
      />
      <Capa3CaptureDialog
        open={modeloCapa3Open}
        title="Completar Capa 3 del modelo"
        subtitle={selectedModelo ? `${selectedModelo.materia_acuerdo} · ${selectedModelo.version}` : "Modelo de acuerdo"}
        fields={selectedModeloCapa3Fields}
        values={modeloCapa3Values}
        errors={modeloCapa3Errors}
        submitLabel="Guardar captura"
        onChange={(values) => {
          setModeloCapa3Values(values);
          setModeloCapa3Errors({});
        }}
        onClose={() => setModeloCapa3Open(false)}
        onSubmit={submitModeloCapa3Capture}
      />
    </>
  );
}
