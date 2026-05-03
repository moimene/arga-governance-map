import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ScrollText, CheckCircle2, XCircle, MinusCircle, Mail, Loader2, AlertTriangle } from "lucide-react";
import {
  useAcuerdoSinSesionById,
  useAdoptNoSessionAgreement,
  useAgreementForNoSessionResolution,
  useCastVote,
} from "@/hooks/useAcuerdosSinSesion";
import { useERDSNotification } from "@/hooks/useERDSNotification";
import { statusLabel } from "@/lib/secretaria/status-labels";
import { ProcessDocxButton } from "@/components/secretaria/ProcessDocxButton";
import { useSecretariaScope } from "@/components/secretaria/shell";

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

export default function AcuerdoSinSesionDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const scope = useSecretariaScope();
  const { data, isLoading } = useAcuerdoSinSesionById(id);
  const { data: linkedAgreement } = useAgreementForNoSessionResolution(id);
  const { sendAndTrackNotification } = useERDSNotification();
  const castVote = useCastVote(id);
  const adoptAgreement = useAdoptNoSessionAgreement();
  const [erdsStatus, setErdsStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [erdsError, setErdsError] = useState<string | null>(null);
  const [erdsRef, setErdsRef] = useState<string | null>(null);

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
  const body = r.governing_bodies?.name ?? "Órgano";
  const entity = r.governing_bodies?.entities?.common_name ?? "—";
  const jurisdiction = r.governing_bodies?.entities?.jurisdiction ?? null;
  const docVariables = buildNoSessionVariables(r, body, entity);
  const docFallback = buildNoSessionFallback(r, body, entity);
  const canGenerateFinalDoc = Boolean(linkedAgreement?.id);

  function handleClose(decision: "APROBADO" | "RECHAZADO") {
    const entityId = r.entity_id ?? r.governing_bodies?.entity_id ?? null;
    if (!entityId) {
      return;
    }
    adoptAgreement.mutate({
      resolutionId: r.id,
      bodyId: r.body_id,
      entityId,
      matterClass: r.matter_class,
      agreementKind: r.agreement_kind,
      resultado: decision,
    });
  }

  const handleSendERDS = async () => {
    if (!r.id) return;
    setErdsStatus("sending");
    setErdsError(null);
    try {
      const result = await sendAndTrackNotification.mutateAsync({
        notificationId: r.id,
        recipientEmail: "destinatario@arga-seguros.com",
        subject: `Notificación certificada: ${r.title}`,
        body: r.proposal_text ?? "Se adjunta la propuesta de acuerdo para su votación.",
      });
      setErdsRef(result.certification.deliveryRef);
      setErdsStatus("sent");
    } catch (e) {
      setErdsError(e instanceof Error ? e.message : "Error desconocido");
      setErdsStatus("error");
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
          <ProcessDocxButton
            label="Acuerdo DOCX"
            variant="primary"
            input={{
              kind: "ACUERDO_SIN_SESION",
              recordId: r.id,
              title: `Acuerdo sin sesión: ${r.title}`,
              subtitle: `${body} · ${entity}`,
              entityName: entity,
              templateTypes: ["ACTA_ACUERDO_ESCRITO", "MODELO_ACUERDO", "INFORME_DOCUMENTAL_PRE"],
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
            </div>
            {castVote.isPending && (
              <div className="flex items-center gap-2 text-xs text-[var(--g-text-secondary)]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Registrando voto…
              </div>
            )}
            <div className="border-t border-[var(--g-border-subtle)] pt-4">
              <p className="mb-3 text-xs text-[var(--g-text-secondary)]">
                Cierre manual de la votación (Secretaría):
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleClose("APROBADO")}
                  disabled={adoptAgreement.isPending}
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

      {/* Panel ERDS — Notificación certificada */}
      <div
        className="mt-6 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="border-b border-[var(--g-border-subtle)] px-5 py-3">
          <h2 className="text-sm font-semibold text-[var(--g-text-primary)] flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Notificación certificada ERDS
          </h2>
        </div>
        <div className="p-5">
          {erdsStatus === "idle" && (
            <>
              <p className="mb-4 text-xs text-[var(--g-text-secondary)]">
                Envíe una notificación certificada (ERDS) a los destinatarios del acuerdo con evidencia electrónica cualificada.
              </p>
              <button
                type="button"
                onClick={handleSendERDS}
                disabled={sendAndTrackNotification.isPending}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] transition-colors disabled:opacity-50"
                style={{ borderRadius: "var(--g-radius-md)" }}
                aria-busy={sendAndTrackNotification.isPending}
              >
                <Mail className="h-4 w-4" />
                Enviar notificación ERDS
              </button>
            </>
          )}

          {erdsStatus === "sending" && (
            <div className="flex items-center gap-2 py-2 text-sm text-[var(--g-text-secondary)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Enviando notificación certificada…
            </div>
          )}

          {erdsStatus === "sent" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-[var(--status-success)]">
                <Mail className="h-4 w-4" />
                <span className="font-medium">Notificación ERDS enviada correctamente</span>
              </div>
              {erdsRef && (
                <p className="text-xs text-[var(--g-text-secondary)]">
                  Referencia de entrega: <span className="font-mono font-medium text-[var(--g-text-primary)]">{erdsRef}</span>
                </p>
              )}
            </div>
          )}

          {erdsStatus === "error" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-[var(--status-error)]">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-medium">Error al enviar la notificación</span>
              </div>
              {erdsError && <p className="text-xs text-[var(--status-error)]">{erdsError}</p>}
              <button
                type="button"
                onClick={() => setErdsStatus("idle")}
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
