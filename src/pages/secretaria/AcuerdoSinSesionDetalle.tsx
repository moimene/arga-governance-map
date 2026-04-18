import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ScrollText, CheckCircle2, XCircle, MinusCircle } from "lucide-react";
import { useAcuerdoSinSesionById } from "@/hooks/useAcuerdosSinSesion";

export default function AcuerdoSinSesionDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useAcuerdoSinSesionById(id);

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

  const r: any = data;
  const body = r.governing_bodies?.name ?? "Órgano";
  const entity = r.governing_bodies?.entities?.common_name ?? "—";

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
          Acuerdo sin sesión · {r.status}
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
