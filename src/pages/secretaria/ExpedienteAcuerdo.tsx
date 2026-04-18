import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  FileCheck2,
  CheckCircle2,
  AlertTriangle,
  Circle,
  Scale,
  FileSignature,
  Building2,
  Gavel,
  Megaphone,
} from "lucide-react";
import { useAgreement, useAgreementCompliance } from "@/hooks/useAgreementCompliance";

const STATUS_TONE: Record<string, string> = {
  DRAFT:              "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]",
  PROPOSED:           "bg-[var(--status-info)] text-[var(--g-text-inverse)]",
  ADOPTED:            "bg-[var(--g-sec-300)] text-[var(--g-brand-3308)]",
  CERTIFIED:          "bg-[var(--g-brand-bright)] text-[var(--g-text-inverse)]",
  INSTRUMENTED:       "bg-[var(--g-sec-700)] text-[var(--g-text-inverse)]",
  FILED:              "bg-[var(--status-info)] text-[var(--g-text-inverse)]",
  REGISTERED:         "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  REJECTED_REGISTRY:  "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
  PUBLISHED:          "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
};

const TIMELINE = [
  "DRAFT",
  "PROPOSED",
  "ADOPTED",
  "CERTIFIED",
  "INSTRUMENTED",
  "FILED",
  "REGISTERED",
  "PUBLISHED",
];

const TIMELINE_LABEL: Record<string, string> = {
  DRAFT:        "Borrador",
  PROPOSED:     "Propuesto",
  ADOPTED:      "Adoptado",
  CERTIFIED:    "Certificado",
  INSTRUMENTED: "Instrumentado",
  FILED:        "Presentado al registro",
  REGISTERED:   "Inscrito",
  PUBLISHED:    "Publicado",
};

export default function ExpedienteAcuerdo() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: agreement, isLoading } = useAgreement(id);
  const { data: compliance } = useAgreementCompliance(id);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1200px] p-6 text-sm text-[var(--g-text-secondary)]">
        Cargando expediente…
      </div>
    );
  }
  if (!agreement) {
    return (
      <div className="mx-auto max-w-[1200px] p-6 text-sm text-[var(--g-text-secondary)]">
        Acuerdo no encontrado.
      </div>
    );
  }

  const a: any = agreement;
  const statusIndex = TIMELINE.indexOf(a.status);

  return (
    <div className="mx-auto max-w-[1200px] p-6">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--g-text-secondary)] hover:text-[var(--g-brand-3308)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver
      </button>

      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
          <FileCheck2 className="h-3.5 w-3.5" />
          Expediente del acuerdo · {a.agreement_kind}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
            {a.proposal_text?.split("\n")[0] ?? a.agreement_kind}
          </h1>
          <span
            className={`inline-flex items-center px-2.5 py-1 text-[11px] font-semibold ${
              STATUS_TONE[a.status] ?? "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
            }`}
            style={{ borderRadius: "var(--g-radius-full)" }}
          >
            {TIMELINE_LABEL[a.status] ?? a.status}
          </span>
        </div>
        <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
          {a.entities?.common_name ?? "—"} · {a.entities?.jurisdiction ?? ""} ·{" "}
          {a.entities?.legal_form ?? ""} · {a.governing_bodies?.name ?? "—"}
        </p>
      </div>

      {/* Timeline */}
      <div
        className="mb-6 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-5"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <h2 className="mb-4 text-sm font-semibold text-[var(--g-text-primary)]">Ciclo del acuerdo</h2>
        <ol className="grid grid-cols-8 gap-2">
          {TIMELINE.map((s, i) => {
            const done = i <= statusIndex;
            const active = i === statusIndex;
            return (
              <li key={s} className="flex flex-col items-center text-center">
                <div
                  className={`flex h-7 w-7 items-center justify-center text-[11px] font-semibold ${
                    done
                      ? "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]"
                      : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
                  }`}
                  style={{ borderRadius: "var(--g-radius-full)" }}
                >
                  {i + 1}
                </div>
                <div
                  className={`mt-1.5 text-[11px] ${
                    active
                      ? "font-semibold text-[var(--g-brand-3308)]"
                      : done
                        ? "text-[var(--g-text-primary)]"
                        : "text-[var(--g-text-secondary)]"
                  }`}
                >
                  {TIMELINE_LABEL[s]}
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card icon={<Scale className="h-4 w-4" />} title="Propuesta">
            <pre className="whitespace-pre-wrap font-sans text-sm text-[var(--g-text-primary)]">
              {a.proposal_text ?? "— Sin propuesta —"}
            </pre>
          </Card>

          <Card icon={<Gavel className="h-4 w-4" />} title="Adopción">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <KV label="Modalidad" value={a.adoption_mode} />
              <KV label="Materia" value={a.matter_class} />
              <KV label="Quórum exigido" value={a.required_quorum_code ?? "—"} />
              <KV label="Mayoría exigida" value={a.required_majority_code ?? "—"} />
              <KV
                label="Fecha decisión"
                value={a.decision_date ? new Date(a.decision_date).toLocaleDateString("es-ES") : "—"}
              />
              <KV
                label="Efectos"
                value={a.effective_date ? new Date(a.effective_date).toLocaleDateString("es-ES") : "—"}
              />
            </div>
            {a.decision_text ? (
              <pre className="mt-4 whitespace-pre-wrap rounded bg-[var(--g-surface-subtle)] p-3 font-sans text-[12px] leading-relaxed text-[var(--g-text-primary)]">
                {a.decision_text}
              </pre>
            ) : null}
          </Card>

          <Card icon={<FileSignature className="h-4 w-4" />} title="Origen">
            {a.parent_meeting_id ? (
              <p className="text-sm text-[var(--g-text-primary)]">
                Adoptado en reunión{" "}
                <Link
                  to={`/secretaria/reuniones/${a.parent_meeting_id}`}
                  className="text-[var(--g-link)] underline-offset-2 hover:text-[var(--g-link-hover)] hover:underline"
                >
                  ver reunión
                </Link>
              </p>
            ) : a.unipersonal_decision_id ? (
              <p className="text-sm text-[var(--g-text-primary)]">
                Origen: decisión unipersonal{" "}
                <Link
                  to={`/secretaria/decisiones-unipersonales/${a.unipersonal_decision_id}`}
                  className="text-[var(--g-link)] underline-offset-2 hover:text-[var(--g-link-hover)] hover:underline"
                >
                  ver decisión
                </Link>
              </p>
            ) : a.no_session_resolution_id ? (
              <p className="text-sm text-[var(--g-text-primary)]">
                Origen: acuerdo sin sesión{" "}
                <Link
                  to={`/secretaria/acuerdos-sin-sesion/${a.no_session_resolution_id}`}
                  className="text-[var(--g-link)] underline-offset-2 hover:text-[var(--g-link-hover)] hover:underline"
                >
                  ver acuerdo
                </Link>
              </p>
            ) : (
              <p className="text-sm text-[var(--g-text-secondary)]">Sin origen registrado.</p>
            )}
            {a.statutory_basis ? (
              <p className="mt-2 text-xs text-[var(--g-text-secondary)]">
                Base estatutaria: <span className="font-mono">{a.statutory_basis}</span>
              </p>
            ) : null}
          </Card>

          <Card icon={<Building2 className="h-4 w-4" />} title="Instrumentación y registro">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <KV
                label="Inscribible"
                value={compliance?.inscribable ? "Sí" : "No"}
              />
              <KV
                label="Instrumento"
                value={compliance?.instrument_required ?? (a.inscribable ? "ESCRITURA" : "NINGUNO")}
              />
              <KV
                label="Requiere registro"
                value={compliance?.registry_required ? "Sí" : "No"}
              />
              <KV
                label="Publicación"
                value={
                  compliance?.publication_required
                    ? compliance?.publication_channel ?? "Requerida"
                    : "No requerida"
                }
              />
            </div>
          </Card>

          {compliance?.publication_required ? (
            <Card icon={<Megaphone className="h-4 w-4" />} title="Publicación">
              <p className="text-sm text-[var(--g-text-primary)]">
                Canal obligatorio:{" "}
                <span className="font-semibold">{compliance.publication_channel}</span>
              </p>
              <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
                El acuerdo {a.agreement_kind} exige publicación en boletín oficial para surtir efectos
                frente a terceros.
              </p>
            </Card>
          ) : null}
        </div>

        <aside className="space-y-6">
          <div
            className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="border-b border-[var(--g-border-subtle)] px-5 py-3">
              <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">
                Compliance snapshot
              </h2>
            </div>
            <div className="space-y-2 p-5 text-sm">
              {compliance ? (
                <>
                  <CheckRow ok={compliance.convocation_compliant} label="Convocatoria" />
                  <CheckRow ok={compliance.quorum_compliant} label="Quórum" />
                  <CheckRow ok={compliance.majority_compliant} label="Mayoría" />
                  <CheckRow ok={compliance.conflict_handled} label="Conflictos de interés" />
                  {compliance.blocking_issues.length > 0 ? (
                    <div
                      className="mt-3 bg-[var(--g-sec-100)]/60 p-3 text-xs text-[var(--g-text-primary)]"
                      style={{ borderRadius: "var(--g-radius-sm)" }}
                    >
                      <div className="flex items-center gap-1 font-semibold">
                        <AlertTriangle className="h-3.5 w-3.5 text-[var(--status-warning)]" />
                        Incidencias
                      </div>
                      <ul className="mt-1 list-inside list-disc space-y-0.5">
                        {compliance.blocking_issues.map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="mt-3 text-xs text-[var(--status-success)]">
                      Sin incidencias bloqueantes.
                    </div>
                  )}
                </>
              ) : (
                <p className="text-[var(--g-text-secondary)]">Calculando…</p>
              )}
            </div>
          </div>

          <div
            className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="border-b border-[var(--g-border-subtle)] px-5 py-3">
              <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">Metadatos</h2>
            </div>
            <div className="space-y-2 p-5 text-sm">
              <KV label="Entidad" value={a.entities?.common_name ?? "—"} />
              <KV label="Órgano" value={a.governing_bodies?.name ?? "—"} />
              <KV label="Creado" value={new Date(a.created_at).toLocaleString("es-ES")} />
              <KV label="ID" value={<span className="font-mono text-[11px]">{a.id}</span>} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Card({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <div className="flex items-center gap-2 border-b border-[var(--g-border-subtle)] px-5 py-3 text-[var(--g-text-primary)]">
        {icon}
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-[var(--g-text-secondary)]">{label}</span>
      <span className="text-right font-medium text-[var(--g-text-primary)]">{value}</span>
    </div>
  );
}

function CheckRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-[var(--status-success)]" />
      ) : (
        <Circle className="h-4 w-4 text-[var(--status-warning)]" />
      )}
      <span
        className={ok ? "text-[var(--g-text-primary)]" : "text-[var(--g-text-secondary)]"}
      >
        {label}
      </span>
    </div>
  );
}
