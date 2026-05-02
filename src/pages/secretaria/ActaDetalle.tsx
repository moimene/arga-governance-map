import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, FileSignature, Gavel, Link2, Loader2, Shield, Stamp, Lock, Unlock } from "lucide-react";
import {
  useActaById,
  useCertificationsByMinute,
  useCertificationPlanForMinute,
  useMaterializeMeetingPointAgreement,
} from "@/hooks/useActas";
import { EmitirCertificacionButton } from "@/components/secretaria/EmitirCertificacionButton";
import { useCurrentUserRole } from "@/hooks/useCurrentUser";
import { ProcessDocxButton } from "@/components/secretaria/ProcessDocxButton";
import { useSecretariaScope } from "@/components/secretaria/shell";
import { isUuidReference } from "@/lib/secretaria/certification-registry-intake";
import { statusLabel } from "@/lib/secretaria/status-labels";
import type { MeetingAdoptionSnapshot } from "@/lib/rules-engine";

function buildActaFallback(params: {
  body: string;
  entity: string;
  content?: string | null;
  createdAt: string;
}) {
  return [
    `ACTA DE ${params.body}`,
    "",
    `Sociedad: ${params.entity}`,
    `Fecha de generación: ${new Date(params.createdAt).toLocaleString("es-ES")}`,
    "",
    params.content ?? "Sin contenido de acta registrado.",
  ].join("\n");
}

function buildCertificationFallback(params: {
  entity: string;
  body: string;
  content?: string | null;
  agreementsCount: number;
  signatureStatus?: string | null;
}) {
  return [
    "CERTIFICACIÓN DE ACUERDOS",
    "",
    `Sociedad: ${params.entity}`,
    `Órgano: ${params.body}`,
    `Acuerdos certificados: ${params.agreementsCount}`,
    `Estado de firma: ${params.signatureStatus ?? "—"}`,
    "",
    params.content ?? "Sin contenido de certificación registrado.",
  ].join("\n");
}

function formatVoteWeight(value: number | undefined) {
  return typeof value === "number" ? value.toLocaleString("es-ES", { maximumFractionDigits: 2 }) : "0";
}

function snapshotStatusClass(snapshot: MeetingAdoptionSnapshot) {
  return snapshot.societary_validity.ok && snapshot.status_resolucion === "ADOPTED"
    ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
    : "bg-[var(--status-warning)] text-[var(--g-text-inverse)]";
}

function readinessLabel(value?: string) {
  switch (value) {
    case "FINAL_READY":
      return "Expediente Acuerdo 360 enlazado; evidencia demo/operativa, no final productiva";
    case "CERTIFIABLE_WITH_POINT_REFS":
      return "Certificable con enlace pendiente";
    case "BLOCKED":
      return "No certificable";
    default:
      return "Pendiente";
  }
}

export default function ActaDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const scope = useSecretariaScope();
  const { data: acta, isLoading } = useActaById(id);
  const { data: certs } = useCertificationsByMinute(id);
  const { data: certificationPlan, isLoading: certificationPlanLoading } = useCertificationPlanForMinute(id);
  const materializeAgreement = useMaterializeMeetingPointAgreement(id);
  const { primaryRole } = useCurrentUserRole();
  const requestedPlantillaId = searchParams.get("plantilla");
  const requestedTemplateType = searchParams.get("tipo");
  const [materializingPoint, setMaterializingPoint] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1200px] p-6 text-sm text-[var(--g-text-secondary)]">
        Cargando…
      </div>
    );
  }
  if (!acta) {
    return (
      <div className="mx-auto max-w-[1200px] p-6 text-sm text-[var(--g-text-secondary)]">
        Acta no encontrada.
      </div>
    );
  }

  const m = acta;
  const body = m.meetings?.governing_bodies?.name ?? "Órgano";
  const entity = m.meetings?.governing_bodies?.entities?.common_name ?? "—";
  const jurisdiction = m.meetings?.governing_bodies?.entities?.jurisdiction ?? null;
  const certificationRefs = certificationPlan?.refs ?? [];
  const certificationAgreementRefs = certificationPlan?.agreementRefs ?? [];
  const certificationPointRefs = certificationPlan?.pointRefs ?? [];
  const referenceByPoint = new Map(
    (certificationPlan?.referenceDetails ?? []).map((reference) => [
      reference.agenda_item_index,
      reference,
    ])
  );
  const pointSnapshots = certificationPlan
    ? [
        ...certificationPlan.certifiableSnapshots,
        ...certificationPlan.blockedSnapshots,
      ].sort((a, b) => a.agenda_item_index - b.agenda_item_index)
    : [];
  const certificationDisabledReason = certificationPlanLoading
    ? "Cargando snapshot legal de la reunión"
    : !certificationPlan?.hasPointSnapshots
      ? "Falta snapshot legal por punto. Vuelve a Votaciones y registra el resultado con motor."
      : certificationRefs.length === 0
        ? "No hay acuerdos societariamente proclamables para certificar"
        : null;
  const actaVariables = {
    denominacion_social: entity,
    organo_nombre: body,
    organo_convocante: body,
    jurisdiccion: jurisdiction ?? "",
    fecha: m.created_at,
    fecha_generacion: new Date().toISOString(),
    contenido_acta: m.content ?? "",
    acuerdos_certificados: certificationRefs,
    acuerdos_certificados_count: certificationRefs.length,
    agreement_ids: certificationAgreementRefs,
    canonical_agreement_ids: certificationAgreementRefs,
    certification_point_refs: certificationPointRefs,
    certification_reference_details: certificationPlan?.referenceDetails ?? [],
    snapshot_puntos: pointSnapshots,
    snapshot_certificables: certificationPlan?.certifiableSnapshots ?? [],
    snapshot_bloqueados: certificationPlan?.blockedSnapshots ?? [],
    pactos_warnings: certificationPlan?.contractualWarnings ?? [],
    firma_estado: m.signed_at ? "FIRMADA" : "BORRADOR",
  };
  const actaFallback = buildActaFallback({
    body,
    entity,
    content: m.content,
    createdAt: m.created_at,
  });

  async function handleMaterializePoint(snapshot: MeetingAdoptionSnapshot) {
    setMaterializingPoint(snapshot.agenda_item_index);
    try {
      const result = await materializeAgreement.mutateAsync({
        meetingId: m.meeting_id,
        bodyId: m.body_id,
        entityId: m.entity_id,
        scheduledStart: m.meetings?.scheduled_start,
        snapshot,
        origin: "MEETING_FLOOR",
      });
      toast.success("Expediente Acuerdo 360 creado", {
        description: `Expediente ${result.agreementId.slice(0, 8)} enlazado al punto ${result.agendaItemIndex}.`,
      });
    } catch (error) {
      const description = error instanceof Error ? error.message : String(error);
      toast.error("No se pudo crear el expediente Acuerdo 360", { description });
    } finally {
      setMaterializingPoint(null);
    }
  }

  return (
    <div className="mx-auto max-w-[1200px] p-6">
      <button
        type="button"
        onClick={() => navigate(scope.createScopedTo("/secretaria/actas"))}
        className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--g-text-secondary)] hover:text-[var(--g-brand-3308)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al listado
      </button>

      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
            <FileSignature className="h-3.5 w-3.5" />
            Acta · {m.meetings?.meeting_type ?? ""}
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
            {body}
          </h1>
          <p className="mt-1 text-sm text-[var(--g-text-secondary)]">{entity}</p>
          {requestedPlantillaId ? (
            <p className="mt-2 text-xs text-[var(--g-text-secondary)]">
              Plantilla seleccionada:
              <span className="ml-1 font-mono">{requestedPlantillaId.slice(0, 8)}</span>
              {requestedTemplateType ? ` · ${requestedTemplateType}` : ""}
            </p>
          ) : null}
        </div>
        <ProcessDocxButton
          label={requestedPlantillaId && requestedTemplateType !== "CERTIFICACION" ? "Generar con plantilla" : "Acta DOCX"}
          variant="primary"
          input={{
            kind: "ACTA",
            recordId: m.id,
            title: `Acta de ${body}`,
            subtitle: entity,
            entityName: entity,
            templateTypes: ["ACTA_SESION", "ACTA_CONSIGNACION", "ACTA_ACUERDO_ESCRITO"],
            variables: actaVariables,
            templateCriteria: {
              jurisdiction,
            },
            preferredTemplateId: requestedTemplateType === "CERTIFICACION" ? null : requestedPlantillaId,
            fallbackText: actaFallback,
            filenamePrefix: "acta",
          }}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div
            className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="flex items-center gap-2 border-b border-[var(--g-border-subtle)] px-5 py-3">
              <FileSignature className="h-4 w-4 text-[var(--g-brand-3308)]" />
              <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">
                Contenido del acta
              </h2>
            </div>
            <div className="p-5">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-[var(--g-text-primary)]">
                {m.content ?? "— Sin contenido —"}
              </pre>
            </div>
          </div>

          <div
            className="mt-6 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="flex items-center gap-2 border-b border-[var(--g-border-subtle)] px-5 py-3">
              <Shield className="h-4 w-4 text-[var(--g-brand-3308)]" />
              <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">
                Revisión legal para certificación
              </h2>
            </div>
            <div className="space-y-3 p-5">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Metric label="Certificables" value={certificationPlan?.certifiableSnapshots.length ?? 0} />
                <Metric label="Acuerdo 360" value={certificationAgreementRefs.length} />
                <Metric label="Refs. por punto" value={certificationPointRefs.length} />
                <Metric label="Pactos" value={certificationPlan?.contractualWarnings.length ?? 0} />
              </div>

              <div
                className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-3 text-xs text-[var(--g-text-secondary)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Link2 className="h-3.5 w-3.5 text-[var(--g-brand-3308)]" />
                  <span className="font-semibold text-[var(--g-text-primary)]">
                    Estado Acuerdo 360:
                  </span>
                  <span>{readinessLabel(certificationPlan?.evidenceReadiness)}</span>
                </div>
                {certificationPointRefs.length > 0 ? (
                  <div className="mt-2 flex gap-2 text-[var(--g-text-secondary)]">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--status-warning)]" />
                    <span>
                      Hay acuerdos adoptados sin expediente Acuerdo 360 canónico. La certificación conserva una referencia temporal del punto, pero la tramitación registral o la postura probatoria documental explicable debe enlazarse al expediente Acuerdo 360.
                    </span>
                  </div>
                ) : null}
              </div>

              {certificationPlanLoading ? (
                <div className="text-sm text-[var(--g-text-secondary)]">
                  Cargando snapshot legal…
                </div>
              ) : pointSnapshots.length > 0 ? (
                pointSnapshots.map((snapshot) => {
                  const reference = referenceByPoint.get(snapshot.agenda_item_index);
                  const issues = [
                    ...snapshot.societary_validity.blocking_issues,
                    ...snapshot.societary_validity.warnings,
                  ];
                  const pactoIssues = [
                    ...snapshot.pacto_compliance.blocking_issues,
                    ...snapshot.pacto_compliance.warnings,
                  ];
                  const isCertifiable = snapshot.societary_validity.ok && snapshot.status_resolucion === "ADOPTED";
                  return (
                    <div
                      key={snapshot.agenda_item_index}
                      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
                      style={{ borderRadius: "var(--g-radius-md)" }}
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
                              Punto {snapshot.agenda_item_index}
                            </span>
                            <span
                              className="bg-[var(--g-sec-100)] px-2 py-0.5 text-[11px] font-medium text-[var(--g-brand-3308)]"
                              style={{ borderRadius: "var(--g-radius-sm)" }}
                            >
                              {snapshot.materia}
                            </span>
                            <span
                              className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--g-text-secondary)]"
                              style={{ borderRadius: "var(--g-radius-sm)" }}
                            >
                              {snapshot.materia_clase}
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-medium text-[var(--g-text-primary)]">
                            {snapshot.resolution_text}
                          </p>
                        </div>
                        <span
                          className={`inline-flex shrink-0 items-center justify-center px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${snapshotStatusClass(snapshot)}`}
                          style={{ borderRadius: "var(--g-radius-full)" }}
                        >
                          {isCertifiable ? "Certificable" : "Excluido"}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
                        <KV label="A favor" value={formatVoteWeight(snapshot.vote_summary.favor)} />
                        <KV label="En contra" value={formatVoteWeight(snapshot.vote_summary.contra)} />
                        <KV label="Excluido" value={formatVoteWeight(snapshot.vote_summary.conflict_excluded)} />
                        <KV label="Base voto" value={formatVoteWeight(snapshot.vote_summary.voting_weight)} />
                      </div>

                      {reference ? (
                        <div
                          className="mt-4 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-3 text-xs text-[var(--g-text-secondary)]"
                          style={{ borderRadius: "var(--g-radius-md)" }}
                        >
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div>
                              <span className="font-semibold text-[var(--g-text-primary)]">
                                {reference.materializedAgreement ? "Acuerdo 360" : "Referencia temporal del punto"}
                              </span>
                              <span className="ml-2 font-mono">{reference.ref}</span>
                              {!reference.materializedAgreement ? (
                                <div className="mt-1">
                              Pendiente de crear o enlazar como expediente Acuerdo 360; no constituye evidencia final productiva.
                                </div>
                              ) : null}
                            </div>
                            {reference.materializedAgreement ? (
                              <button
                                type="button"
                                onClick={() => navigate(scope.createScopedTo(`/secretaria/acuerdos/${reference.ref}`))}
                                className="inline-flex shrink-0 items-center justify-center gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-1.5 text-xs font-medium text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
                                style={{ borderRadius: "var(--g-radius-md)" }}
                              >
                                <Link2 className="h-3.5 w-3.5" />
                                Abrir acuerdo
                              </button>
                            ) : isCertifiable ? (
                              <button
                                type="button"
                                onClick={() => handleMaterializePoint(snapshot)}
                                disabled={materializingPoint === snapshot.agenda_item_index}
                                aria-busy={materializingPoint === snapshot.agenda_item_index}
                                className="inline-flex shrink-0 items-center justify-center gap-2 bg-[var(--g-brand-3308)] px-3 py-1.5 text-xs font-medium text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] disabled:bg-[var(--g-surface-muted)] disabled:text-[var(--g-text-secondary)]"
                                style={{ borderRadius: "var(--g-radius-md)" }}
                              >
                                {materializingPoint === snapshot.agenda_item_index ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Link2 className="h-3.5 w-3.5" />
                                )}
                                {materializingPoint === snapshot.agenda_item_index
                                  ? "Creando..."
                                  : "Crear expediente Acuerdo 360"}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ) : null}

                      {issues.length > 0 ? (
                        <div
                          className="mt-4 border border-[var(--g-border-subtle)] bg-[var(--g-surface-muted)] p-3 text-xs text-[var(--g-text-secondary)]"
                          style={{ borderRadius: "var(--g-radius-md)" }}
                        >
                          <div className="font-semibold text-[var(--g-text-primary)]">
                            Incidencias societarias
                          </div>
                          <div className="mt-1">{issues.slice(0, 3).join(" · ")}</div>
                        </div>
                      ) : null}

                      {pactoIssues.length > 0 ? (
                        <div
                          className="mt-4 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] p-3 text-xs text-[var(--g-text-secondary)]"
                          style={{ borderRadius: "var(--g-radius-md)" }}
                        >
                          <div className="font-semibold text-[var(--g-brand-3308)]">
                            Alerta contractual por pacto parasocial
                          </div>
                          <div className="mt-1">{pactoIssues.slice(0, 3).join(" · ")}</div>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <div
                  className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-muted)] p-4 text-sm text-[var(--g-text-secondary)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  Esta acta no tiene snapshot legal por punto. Registra la votación desde la reunión para que la certificación incorpore quórum, mayorías, conflictos, vetos y pactos.
                </div>
              )}
            </div>
          </div>

          <div
            className="mt-6 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="flex items-center justify-between border-b border-[var(--g-border-subtle)] px-5 py-3">
              <div className="flex items-center gap-2">
                <Stamp className="h-4 w-4 text-[var(--g-brand-3308)]" />
                <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">
                  Certificaciones emitidas
                </h2>
              </div>
              {id && acta.entity_id ? (
                <EmitirCertificacionButton
                  minuteId={id}
                  entityId={acta.entity_id}
                  bodyId={acta.body_id}
                  agreementIds={certificationRefs}
                  userRole={primaryRole}
                  disabledReason={certificationDisabledReason}
                />
              ) : null}
            </div>
            <div className="divide-y divide-[var(--g-border-subtle)]">
              {certs && certs.length > 0 ? (
                certs.map((c) => {
                  const tramitadorAgreementId =
                    certificationAgreementRefs[0] ??
                    [c.agreement_id, ...(c.agreements_certified ?? [])].find(isUuidReference) ??
                    null;
                  const certFallback = buildCertificationFallback({
                    entity,
                    body,
                    content: c.content,
                    agreementsCount: c.agreements_certified?.length ?? 0,
                    signatureStatus: c.signature_status,
                  });
                  return (
                  <div key={c.id} className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm font-medium text-[var(--g-text-primary)]">
                          Certificación #{c.id.slice(0, 8)}
                        </div>
                        <div className="mt-0.5 text-xs text-[var(--g-text-secondary)]">
                          {c.agreements_certified?.length ?? 0} acuerdo(s) certificados ·
                          {c.requires_qualified_signature ? " firma cualificada" : " firma simple"}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <span
                            className={`px-2 py-0.5 text-[11px] font-medium ${
                              c.signature_status === "SIGNED"
                                ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
                                : "bg-[var(--status-warning)] text-[var(--g-text-inverse)]"
                            }`}
                            style={{ borderRadius: "var(--g-radius-sm)" }}
                          >
                            Firma: {statusLabel(c.signature_status)}
                          </span>
                          <span
                            className={`px-2 py-0.5 text-[11px] font-medium ${
                              c.evidence_id
                                ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
                                : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
                            }`}
                            style={{ borderRadius: "var(--g-radius-sm)" }}
                          >
                            {c.evidence_id ? "Evidencia demo/operativa vinculada" : "Evidencia operativa pendiente"}
                          </span>
                        </div>
                        {c.signature_status === "SIGNED" && !c.evidence_id ? (
                          <div className="max-w-[260px] text-right text-[11px] leading-relaxed text-[var(--g-text-secondary)]">
                            Genere la certificación DOCX para vincular evidencia demo/operativa antes de continuar la tramitación. Pendiente de controles productivos de auditoría, conservación y legal hold.
                          </div>
                        ) : null}
                        <ProcessDocxButton
                          label={requestedPlantillaId && requestedTemplateType === "CERTIFICACION" ? "Generar con plantilla" : "Certificación DOCX"}
                          input={{
                            kind: "CERTIFICACION",
                            recordId: c.id,
                            title: "Certificación de acuerdos",
                            subtitle: entity,
                            entityName: entity,
                            templateTypes: ["CERTIFICACION"],
                            variables: {
                              ...actaVariables,
                              contenido_certificacion: c.content ?? "",
                              acuerdos_certificados_count: c.agreements_certified?.length ?? 0,
                              agreement_ids: c.agreements_certified ?? [],
                              certified_agreement_ids: c.agreements_certified ?? [],
                              signature_status: c.signature_status,
                              certification_id: c.id,
                            },
                            templateCriteria: {
                              jurisdiction,
                            },
                            preferredTemplateId: requestedTemplateType === "CERTIFICACION" ? requestedPlantillaId : null,
                            fallbackText: certFallback,
                            filenamePrefix: "certificacion",
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const agreementParam = tramitadorAgreementId
                              ? `&agreement=${encodeURIComponent(tramitadorAgreementId)}`
                              : "";
                            const target = acta.entity_id
                              ? `/secretaria/tramitador/nuevo?certificacion=${encodeURIComponent(c.id)}${agreementParam}&scope=sociedad&entity=${encodeURIComponent(acta.entity_id)}`
                              : scope.createScopedTo(`/secretaria/tramitador/nuevo?certificacion=${encodeURIComponent(c.id)}${agreementParam}`);
                            navigate(target);
                          }}
                          className="inline-flex items-center gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-1.5 text-xs font-medium text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
                          style={{ borderRadius: "var(--g-radius-md)" }}
                        >
                          <Gavel className="h-3.5 w-3.5" />
                          Abrir en tramitador
                        </button>
                      </div>
                    </div>
                  </div>
                  );
                })
              ) : (
                <div className="p-5 text-sm text-[var(--g-text-secondary)]">
                  Sin certificaciones emitidas.
                </div>
              )}
            </div>
          </div>
        </div>

        <div>
          <div
            className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="flex items-center gap-2 border-b border-[var(--g-border-subtle)] px-5 py-3">
              <Shield className="h-4 w-4 text-[var(--g-brand-3308)]" />
              <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">Firma y registro</h2>
            </div>
            <div className="space-y-3 p-5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[var(--g-text-secondary)]">Estado</span>
                {m.signed_at && m.is_locked ? (
                  <span
                    className="inline-flex items-center gap-1 bg-[var(--status-success)] px-2 py-0.5 text-[11px] font-medium text-[var(--g-text-inverse)]"
                    style={{ borderRadius: "var(--g-radius-sm)" }}
                  >
                    <Lock className="h-3 w-3" />
                    Firmada y cerrada
                  </span>
                ) : m.signed_at ? (
                  <span
                    className="inline-flex items-center gap-1 bg-[var(--status-info)] px-2 py-0.5 text-[11px] font-medium text-[var(--g-text-inverse)]"
                    style={{ borderRadius: "var(--g-radius-sm)" }}
                  >
                    <Lock className="h-3 w-3" />
                    Firmada
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1 bg-[var(--g-surface-muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--g-text-secondary)]"
                    style={{ borderRadius: "var(--g-radius-sm)" }}
                  >
                    <Unlock className="h-3 w-3" />
                    Borrador
                  </span>
                )}
              </div>
              <KV label="Firmada" value={m.signed_at ? new Date(m.signed_at).toLocaleString("es-ES") : "—"} />
              <KV label="Registrada" value={m.registered_at ? new Date(m.registered_at).toLocaleString("es-ES") : "—"} />
              <KV label="Creada" value={new Date(m.created_at).toLocaleString("es-ES")} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-[var(--g-text-secondary)]">{label}</span>
      <span className="font-medium text-[var(--g-text-primary)]">{value}</span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border-l-2 border-[var(--g-sec-300)] py-1 pl-3">
      <div className="text-[11px] font-semibold uppercase text-[var(--g-brand-3308)]">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-[var(--g-text-primary)]">
        {value}
      </div>
    </div>
  );
}
