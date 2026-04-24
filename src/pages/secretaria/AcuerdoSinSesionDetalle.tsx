import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ScrollText, CheckCircle2, XCircle, MinusCircle, Mail, Loader2, AlertTriangle } from "lucide-react";
import { useAcuerdoSinSesionById, useCastVote, useCloseVotacionManual } from "@/hooks/useAcuerdosSinSesion";
import { useERDSNotification } from "@/hooks/useERDSNotification";
import { statusLabel } from "@/lib/secretaria/status-labels";

export default function AcuerdoSinSesionDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useAcuerdoSinSesionById(id);
  const { sendAndTrackNotification } = useERDSNotification();
  const castVote = useCastVote(id);
  const closeVotacion = useCloseVotacionManual(id);
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
        onClick={() => navigate("/secretaria/acuerdos-sin-sesion")}
        className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--g-text-secondary)] hover:text-[var(--g-brand-3308)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver
      </button>

      <div className="mb-6">
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
                  onClick={() => closeVotacion.mutate("APROBADO")}
                  disabled={closeVotacion.isPending}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-medium border border-[var(--status-success)] text-[var(--status-success)] hover:bg-[var(--status-success)] hover:text-[var(--g-text-inverse)] transition-colors disabled:opacity-50"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Cerrar como Aprobado
                </button>
                <button
                  type="button"
                  onClick={() => closeVotacion.mutate("RECHAZADO")}
                  disabled={closeVotacion.isPending}
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
