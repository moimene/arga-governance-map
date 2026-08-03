import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ScrollText, CheckCircle2, XCircle, MinusCircle, Mail, Loader2, AlertTriangle } from "lucide-react";
import {
  useAcuerdoSinSesionById,
  useAdoptNoSessionAgreement,
  useAgreementForNoSessionResolution,
  useCastVote,
} from "@/hooks/useAcuerdosSinSesion";
import { useEADInterpositionCommunication } from "@/hooks/useERDSNotification";
import { statusLabel } from "@/lib/secretaria/status-labels";
import { EmitirCertificacionAcuerdoButton } from "@/components/secretaria/EmitirCertificacionAcuerdoButton";
import { ProcessDocxButton } from "@/components/secretaria/ProcessDocxButton";
import { useSecretariaScope } from "@/components/secretaria/shell";
import { useCurrentUserRole } from "@/hooks/useCurrentUser";
import { evaluateNoSessionResult } from "@/lib/secretaria/no-session-client-guards";
import { useNoSessionParticipants } from "@/hooks/useBodies";
import { authoritativeNoSessionRecipients } from "@/lib/secretaria/no-session-recipient-eligibility";

function buildNoSessionVariables(
  r: NonNullable<ReturnType<typeof useAcuerdoSinSesionById>["data"]>,
  body: string,
  entity: string,
) {
  const fechaApertura = r.opened_at ? new Date(r.opened_at).toLocaleDateString("es-ES") : "";
  const fechaCierre = r.closed_at ? new Date(r.closed_at).toLocaleDateString("es-ES") : "";
  const votosFavor = r.votes_for ?? 0;
  const votosContra = r.votes_against ?? 0;
  const abstenciones = r.abstentions ?? 0;
  const tipoProceso = r.requires_unanimity ? "UNANIMIDAD_CAPITAL_SL" : "CIRCULACION_CONSEJO";
  const condicionAdopcion = r.requires_unanimity
    ? "Unanimidad requerida de los destinatarios legitimados."
    : "Adopción conforme a la mayoría aplicable y a las respuestas recibidas.";
  const relacionRespuestas = [
    `A favor: ${votosFavor}`,
    `En contra: ${votosContra}`,
    `Abstenciones: ${abstenciones}`,
  ].join("\n");

  return {
    entity_id: r.entity_id ?? r.governing_bodies?.entity_id ?? "",
    denominacion_social: entity,
    organo_convocante: body,
    organo_nombre: body,
    organo_tipo: r.governing_bodies?.body_type ?? "",
    modo_adopcion: "NO_SESSION",
    titulo_acuerdo: r.title,
    contenido_acuerdo: r.proposal_text ?? "",
    propuesta_acuerdo: r.proposal_text ?? "",
    propuesta_texto: r.proposal_text ?? "",
    texto_decision: r.proposal_text ?? "",
    tipo_proceso: tipoProceso,
    condicion_adopcion: condicionAdopcion,
    relacion_respuestas_texto: relacionRespuestas,
    resultado_evaluacion: condicionAdopcion,
    estado: statusLabel(r.status),
    votes_for: votosFavor,
    votes_against: votosContra,
    abstentions: abstenciones,
    requiere_unanimidad: r.requires_unanimity ? "Sí" : "No",
    fecha_apertura: fechaApertura,
    fecha_circulacion: fechaApertura,
    fecha_limite_voto: r.voting_deadline ? new Date(r.voting_deadline).toLocaleDateString("es-ES") : "",
    fecha_cierre: fechaCierre,
    fecha_cierre_expediente: fechaCierre,
    ciudad_emision: "",
    jurisdiccion: r.governing_bodies?.entities?.jurisdiction ?? "",
  };
}

function buildNoSessionFallback(
  r: NonNullable<ReturnType<typeof useAcuerdoSinSesionById>["data"]>,
  body: string,
  entity: string,
) {
  return [
    "ACTA DE ACUERDO ESCRITO SIN SESION",
    "",
    `Sociedad: ${entity}`,
    `Organo: ${body}`,
    `Titulo: ${r.title}`,
    `Estado: ${statusLabel(r.status)}`,
    "",
    "PROPUESTA",
    r.proposal_text ?? "Sin texto de propuesta registrado.",
    "",
    "RESULTADO DE VOTACION",
    `A favor: ${r.votes_for ?? 0}`,
    `En contra: ${r.votes_against ?? 0}`,
    `Abstenciones: ${r.abstentions ?? 0}`,
    `Unanimidad requerida: ${r.requires_unanimity ? "Si" : "No"}`,
    "",
    "FECHAS",
    `Apertura: ${r.opened_at ? new Date(r.opened_at).toLocaleString("es-ES") : "No consta"}`,
    `Plazo: ${r.voting_deadline ? new Date(r.voting_deadline).toLocaleString("es-ES") : "No consta"}`,
    `Cierre: ${r.closed_at ? new Date(r.closed_at).toLocaleString("es-ES") : "No consta"}`,
  ].join("\n");
}

function getSelectedTemplateId(executionMode: Record<string, unknown> | null | undefined) {
  if (!executionMode || typeof executionMode !== "object") return null;
  const direct = executionMode.selected_template_id;
  if (typeof direct === "string" && direct) return direct;
  const agreement360 = executionMode.agreement_360;
  if (agreement360 && typeof agreement360 === "object" && !Array.isArray(agreement360)) {
    const nested = (agreement360 as Record<string, unknown>).selected_template_id;
    if (typeof nested === "string" && nested) return nested;
  }
  return null;
}

export default function AcuerdoSinSesionDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const scope = useSecretariaScope();
  const { data, isLoading } = useAcuerdoSinSesionById(id);
  const { data: linkedAgreement } = useAgreementForNoSessionResolution(id);
  const { createInterpositionDraft } = useEADInterpositionCommunication();
  const sourceEntityCandidate = data?.entity_id ?? data?.governing_bodies?.entity_id ?? undefined;
  const { data: bodyParticipants = [] } = useNoSessionParticipants(
    data?.body_id,
    sourceEntityCandidate,
  );
  const castVote = useCastVote(id);
  const adoptAgreement = useAdoptNoSessionAgreement();
  const { primaryRole } = useCurrentUserRole();
  const [eadStatus, setEadStatus] = useState<"idle" | "saving" | "draft" | "error">("idle");
  const [eadError, setEadError] = useState<string | null>(null);
  const [communicationId, setCommunicationId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1200px] p-6 text-sm text-[var(--g-text-secondary)]">
        Cargando…
      </div>
    );
  }
  if (!data) {
    return (
      <div className="mx-auto max-w-[1200px] p-6 text-sm text-[var(--g-text-secondary)]">
        Acuerdo no encontrado.
      </div>
    );
  }

  const r = data;
  const eligibleRecipients = authoritativeNoSessionRecipients(
    bodyParticipants,
    r.governing_bodies?.body_type,
    r.body_id,
  );
  const recipientsWithoutEmail = eligibleRecipients.filter((participant) => !participant.email?.trim());
  const eadRecipients = eligibleRecipients.map((participant) => ({
    personId: participant.person_id,
    email: participant.email?.trim() ?? "",
  }));
  const sourceEntityId = r.entity_id ?? r.governing_bodies?.entity_id ?? null;
  const votingDeadline = r.voting_deadline ? new Date(r.voting_deadline) : null;
  const isOpenVotingWindow = r.status === "VOTING_OPEN"
    && Boolean(r.opened_at)
    && !r.closed_at
    && Boolean(votingDeadline && !Number.isNaN(votingDeadline.getTime()))
    && votingDeadline!.getTime() > Date.now();
  const eadDisabledReason = !isOpenVotingWindow
    ? "El borrador EAD solo puede registrarse durante una votación abierta y no vencida"
    : eligibleRecipients.length === 0
      ? "No existe un censo votante vigente para este órgano"
      : recipientsWithoutEmail.length > 0
        ? `Falta email en ${recipientsWithoutEmail.length} persona(s) del censo votante`
        : !sourceEntityId
          ? "No consta la sociedad de origen de la comunicación"
          : null;
  const body = r.governing_bodies?.name ?? "Órgano";
  const entity = r.governing_bodies?.entities?.common_name ?? "—";
  const jurisdiction = r.governing_bodies?.entities?.jurisdiction ?? null;
  const docVariables = buildNoSessionVariables(r, body, entity);
  const docFallback = buildNoSessionFallback(r, body, entity);
  const canGenerateFinalDoc = Boolean(linkedAgreement?.id);
  const selectedTemplateId = getSelectedTemplateId(linkedAgreement?.execution_mode) ?? searchParams.get("plantilla");
  const generatorPath = linkedAgreement?.id
    ? `/secretaria/acuerdos/${linkedAgreement.id}/generar${selectedTemplateId ? `?plantilla=${encodeURIComponent(selectedTemplateId)}` : ""}`
    : null;
  const voteResult = evaluateNoSessionResult({
    votesFor: r.votes_for ?? 0,
    votesAgainst: r.votes_against ?? 0,
    abstentions: r.abstentions ?? 0,
    totalMembers: r.total_members ?? 0,
    matterClass: r.matter_class,
    requiresUnanimity: r.requires_unanimity,
  });
  const canCloseApproved = voteResult.aprobado;

  function handleClose(decision: "APROBADO" | "RECHAZADO") {
    if (!(r.entity_id ?? r.governing_bodies?.entity_id)) {
      return;
    }
    if (decision === "APROBADO" && !canCloseApproved) return;
    adoptAgreement.mutate({
      resolutionId: r.id,
      resultado: decision,
      selectedTemplateId,
    });
  }

  const handleCreateEADDraft = async () => {
    if (!r.id) return;
    if (eadDisabledReason || !sourceEntityId) {
      setEadError(eadDisabledReason ?? "No se pudo resolver el origen de la comunicación.");
      setEadStatus("error");
      return;
    }
    setEadStatus("saving");
    setEadError(null);
    try {
      const result = await createInterpositionDraft.mutateAsync({
        entityId: sourceEntityId,
        bodyId: r.body_id,
        agreementId: linkedAgreement?.id ?? null,
        subject: `Comunicación societaria: ${r.title}`,
        body: r.proposal_text ?? "Se remite la propuesta de acuerdo para su votación.",
        recipients: eadRecipients,
        sourceDomain: "NO_SESSION_RESOLUTION",
        sourceId: r.id,
      });
      setCommunicationId(result.communicationId);
      setEadStatus("draft");
    } catch (e) {
      setEadError(e instanceof Error ? e.message : "Error desconocido");
      setEadStatus("error");
    }
  };

  return (
    <div className="mx-auto max-w-[1200px] p-6">
      <button
        type="button"
        onClick={() => navigate(scope.createScopedTo("/secretaria/acuerdos-sin-sesion"))}
        className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--g-text-secondary)] hover:text-[var(--g-brand-3308)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver
      </button>

      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
            <ScrollText className="h-3.5 w-3.5" />
            Acuerdo sin sesión · {statusLabel(r.status)}
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
            {r.title}
          </h1>
          <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
            {body} · {entity}
          </p>
        </div>
        {canGenerateFinalDoc ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => linkedAgreement?.id && navigate(scope.createScopedTo(`/secretaria/acuerdos/${linkedAgreement.id}`))}
              className="border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-4 py-2 text-sm font-medium text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              Ver expediente
            </button>
            {generatorPath ? (
              <button
                type="button"
                onClick={() => navigate(scope.createScopedTo(generatorPath))}
                className="border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-4 py-2 text-sm font-medium text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                Generar documento
              </button>
            ) : null}
            <EmitirCertificacionAcuerdoButton
              agreementId={linkedAgreement!.id}
              entityId={r.entity_id ?? r.governing_bodies?.entity_id ?? null}
              bodyId={r.body_id}
              userRole={primaryRole}
            />
            <ProcessDocxButton
              label="Acuerdo DOCX"
              variant="primary"
              input={{
                kind: "ACUERDO_SIN_SESION",
                recordId: r.id,
                title: `Acuerdo sin sesión: ${r.title}`,
                subtitle: `${body} · ${entity}`,
                entityName: entity,
                templateTypes: ["ACTA_ACUERDO_ESCRITO"],
                variables: {
                  ...docVariables,
                  agreement_id: linkedAgreement?.id ?? "",
                  agreement_ids: linkedAgreement?.id ? [linkedAgreement.id] : [],
                },
                templateCriteria: {
                  jurisdiction,
                  materia: r.agreement_kind,
                  adoptionMode: "NO_SESSION",
                  organoTipo: r.governing_bodies?.body_type,
                },
                fallbackText: docFallback,
                filenamePrefix: "acuerdo_sin_sesion",
                archive: { agreementId: linkedAgreement?.id },
              }}
            />
          </div>
        ) : (
          <div
            className="max-w-[260px] border border-[var(--g-border-subtle)] bg-[var(--g-surface-muted)] px-3 py-2 text-xs text-[var(--g-text-secondary)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            El DOCX final se habilita al cerrar la votación y crear el expediente del acuerdo.
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div
          className="lg:col-span-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <div className="border-b border-[var(--g-border-subtle)] px-5 py-3">
            <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">Propuesta</h2>
          </div>
          <div className="p-5">
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-[var(--g-text-primary)]">
              {r.proposal_text ?? "— Sin texto —"}
            </pre>
          </div>
        </div>

        <div className="space-y-6">
          <div
            className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="border-b border-[var(--g-border-subtle)] px-5 py-3">
              <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">Votación</h2>
            </div>
            <div className="space-y-2 p-5 text-sm">
              <div className="flex items-center gap-2 text-[var(--g-text-primary)]">
                <CheckCircle2 className="h-4 w-4 text-[var(--status-success)]" />
                A favor: <strong>{r.votes_for ?? 0}</strong>
              </div>
              <div className="flex items-center gap-2 text-[var(--g-text-primary)]">
                <XCircle className="h-4 w-4 text-[var(--status-error)]" />
                En contra: <strong>{r.votes_against ?? 0}</strong>
              </div>
              <div className="flex items-center gap-2 text-[var(--g-text-primary)]">
                <MinusCircle className="h-4 w-4 text-[var(--g-text-secondary)]" />
                Abstención: <strong>{r.abstentions ?? 0}</strong>
              </div>
              {r.requires_unanimity ? (
                <div
                  className="mt-3 border-l-4 border-[var(--status-warning)] bg-[var(--g-sec-100)] p-3 text-xs text-[var(--g-text-primary)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  Requiere <strong>unanimidad</strong> para aprobarse.
                </div>
              ) : null}
            </div>
          </div>

          <div
            className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="border-b border-[var(--g-border-subtle)] px-5 py-3">
              <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">Fechas</h2>
            </div>
            <div className="space-y-2 p-5 text-sm">
              <KV label="Abierto" value={r.opened_at ? new Date(r.opened_at).toLocaleString("es-ES") : "—"} />
              <KV label="Plazo" value={r.voting_deadline ? new Date(r.voting_deadline).toLocaleString("es-ES") : "—"} />
              <KV label="Cerrado" value={r.closed_at ? new Date(r.closed_at).toLocaleString("es-ES") : "—"} />
            </div>
          </div>
        </div>
      </div>

      {/* Panel de votación — sólo cuando VOTING_OPEN */}
      {r.status === "VOTING_OPEN" && (
        <div
          className="mt-6 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <div className="border-b border-[var(--g-border-subtle)] px-5 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--g-text-primary)]">
              <CheckCircle2 className="h-4 w-4 text-[var(--g-brand-3308)]" />
              Emitir voto
            </h2>
          </div>
          <div className="space-y-4 p-5">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => castVote.mutate("FOR")}
                disabled={castVote.isPending}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-[var(--status-success)] text-[var(--g-text-inverse)] hover:opacity-90 transition-opacity disabled:opacity-50"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <CheckCircle2 className="h-4 w-4" />
                Votar a favor
              </button>
              <button
                type="button"
                onClick={() => castVote.mutate("AGAINST")}
                disabled={castVote.isPending}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-[var(--status-error)] text-[var(--g-text-inverse)] hover:opacity-90 transition-opacity disabled:opacity-50"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <XCircle className="h-4 w-4" />
                Votar en contra
              </button>
              <button
                type="button"
                onClick={() => castVote.mutate("ABSTAIN")}
                disabled={castVote.isPending}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border border-[var(--g-border-default)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)] hover:border-[var(--g-brand-3308)] hover:text-[var(--g-brand-3308)] transition-colors disabled:opacity-50"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <MinusCircle className="h-4 w-4" />
                Abstenerme
              </button>
              {!r.requires_unanimity ? (
                <button
                  type="button"
                  onClick={() => castVote.mutate("OBJECT_PROCEDURE")}
                  disabled={castVote.isPending}
                  title="Art. 248.2 LSC: la votación por escrito solo es admisible si ningún consejero se opone al procedimiento. Una oposición cierra el expediente."
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border border-[var(--status-warning)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] transition-colors disabled:opacity-50"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <XCircle className="h-4 w-4 text-[var(--status-warning)]" />
                  Oponerme al procedimiento (art. 248.2 LSC)
                </button>
              ) : null}
            </div>
            {castVote.isPending && (
              <div className="flex items-center gap-2 text-xs text-[var(--g-text-secondary)]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Registrando voto…
              </div>
            )}
            {castVote.isError ? (
              <div
                className="border border-[var(--status-error)]/40 bg-[var(--g-surface-muted)] px-3 py-2 text-xs text-[var(--status-error)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                {castVote.error instanceof Error ? castVote.error.message : "No se pudo registrar el voto."}
              </div>
            ) : null}
            <div className="border-t border-[var(--g-border-subtle)] pt-4">
              <p className="mb-3 text-xs text-[var(--g-text-secondary)]">
                Cierre manual de la votación (Secretaría):
              </p>
              <div
                className={`mb-3 border-l-4 p-3 text-xs ${
                  voteResult.aprobado
                    ? "border-[var(--status-success)] bg-[var(--g-sec-100)] text-[var(--g-text-primary)]"
                    : "border-[var(--status-warning)] bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
                }`}
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                {voteResult.motivo}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleClose("APROBADO")}
                  disabled={adoptAgreement.isPending || !canCloseApproved}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-medium border border-[var(--status-success)] text-[var(--status-success)] hover:bg-[var(--status-success)] hover:text-[var(--g-text-inverse)] transition-colors disabled:opacity-50"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Cerrar como Aprobado
                </button>
                <button
                  type="button"
                  onClick={() => handleClose("RECHAZADO")}
                  disabled={adoptAgreement.isPending}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-medium border border-[var(--status-error)] text-[var(--status-error)] hover:bg-[var(--status-error)] hover:text-[var(--g-text-inverse)] transition-colors disabled:opacity-50"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Cerrar como Rechazado
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Interposición EAD: registro de borrador sin envío ni firma. */}
      <div
        className="mt-6 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="border-b border-[var(--g-border-subtle)] px-5 py-3">
          <h2 className="text-sm font-semibold text-[var(--g-text-primary)] flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Interposición EAD y custodia documental
          </h2>
        </div>
        <div className="p-5">
          {eadStatus === "idle" && (
            <>
              <p className="mb-4 text-xs text-[var(--g-text-secondary)]">
                Registra un borrador para mensajería básica y futura custodia/e-archiving. Esta acción
                no envía, no programa el dispatcher y no afirma firma, ERDS, entrega ni interacción
                efectiva con EAD Trust.
              </p>
              <button
                type="button"
                onClick={handleCreateEADDraft}
                disabled={createInterpositionDraft.isPending || Boolean(eadDisabledReason)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ borderRadius: "var(--g-radius-md)" }}
                aria-busy={createInterpositionDraft.isPending}
                aria-describedby={eadDisabledReason ? "ead-interposition-disabled-reason" : undefined}
                title={eadDisabledReason ?? undefined}
              >
                <Mail className="h-4 w-4" aria-hidden="true" />
                Registrar borrador EAD{eadRecipients.length > 0 ? ` (${eadRecipients.length})` : ""}
              </button>
              {eadDisabledReason ? (
                <p id="ead-interposition-disabled-reason" className="mt-2 text-xs text-[var(--g-text-secondary)]">
                  {eadDisabledReason}
                </p>
              ) : null}
            </>
          )}

          {eadStatus === "saving" && (
            <div className="flex items-center gap-2 py-2 text-sm text-[var(--g-text-secondary)]">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Registrando el borrador…
            </div>
          )}

          {eadStatus === "draft" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-[var(--status-info)]">
                <Mail className="h-4 w-4" aria-hidden="true" />
                <span className="font-medium">Borrador registrado; sin envío ni interacción con proveedor</span>
              </div>
              {communicationId && (
                <p className="text-xs text-[var(--g-text-secondary)]">
                  Expediente de comunicación:{" "}
                  <button
                    type="button"
                    onClick={() => navigate(scope.createScopedTo(`/secretaria/comunicaciones/${communicationId}`))}
                    className="font-mono font-medium text-[var(--g-brand-3308)] hover:underline"
                  >
                    {communicationId}
                  </button>
                </p>
              )}
            </div>
          )}

          {eadStatus === "error" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-[var(--status-error)]">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                <span className="font-medium">No se pudo registrar el borrador</span>
              </div>
              {eadError && <p className="text-xs text-[var(--status-error)]">{eadError}</p>}
              <button
                type="button"
                onClick={() => setEadStatus("idle")}
                className="text-xs text-[var(--g-brand-3308)] hover:underline"
              >
                Reintentar
              </button>
            </div>
          )}
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
