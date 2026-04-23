import { useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
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
  ChevronDown,
  ChevronUp,
  Shield,
  Handshake,
  UserCheck,
  ClipboardCheck,
  Lock,
} from "lucide-react";
import { useAgreement, useAgreementCompliance } from "@/hooks/useAgreementCompliance";
import { useQTSPVerification } from "@/hooks/useQTSPVerification";
import { usePactosVigentes } from "@/hooks/usePactosParasociales";
import { evaluarPactosParasociales } from "@/lib/rules-engine/pactos-engine";
import type { PactosEvalInput } from "@/lib/rules-engine/pactos-engine";
import { supabase } from "@/integrations/supabase/client";

interface RuleEvaluationResult {
  id: string;
  etapa: string;
  ok: boolean;
  severity: "OK" | "WARNING" | "BLOCKING";
  explain_json: Record<string, unknown> | null;
  blocking_issues: string[] | null;
  warnings: string[] | null;
}

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
  const { data: verification, isLoading: verificationLoading } = useQTSPVerification(id);

  const { data: ruleEvaluations = [] } = useQuery({
    queryKey: ["rule_evaluations", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rule_evaluation_results")
        .select("*")
        .eq("agreement_id", id);
      if (error) throw error;
      return (data ?? []) as RuleEvaluationResult[];
    },
    enabled: !!id,
  });

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

  const a = agreement;
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
        {/* Generar documento — visible when ADOPTED or later */}
        {statusIndex >= TIMELINE.indexOf("ADOPTED") && (
          <button
            type="button"
            onClick={() => navigate(`/secretaria/acuerdos/${id}/generar`)}
            className="mt-3 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] transition-colors"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <FileSignature className="h-4 w-4" />
            Generar documento
          </button>
        )}
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

          {ruleEvaluations.length > 0 && (
            <Card icon={<Scale className="h-4 w-4" />} title="Validación normativa">
              <div className="space-y-2">
                {(() => {
                  const grouped = ruleEvaluations.reduce(
                    (acc, r) => {
                      if (!acc[r.etapa]) acc[r.etapa] = [];
                      acc[r.etapa].push(r);
                      return acc;
                    },
                    {} as Record<string, RuleEvaluationResult[]>
                  );
                  return Object.entries(grouped).map(([etapa, results]) => (
                    <RuleValidationRow key={etapa} etapa={etapa} results={results} />
                  ));
                })()}
              </div>
            </Card>
          )}

          <PactosParasocialesCard agreement={a} />

          <ApprovalWorkflowCard
            agreementId={a.id}
            onNavigateGenerar={() => navigate(`/secretaria/acuerdos/${id}/generar`)}
          />

          {/* Trust Center — Evidencias de confianza */}
          <div
            className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-5"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="mb-4 flex items-center gap-2">
              <Shield className="h-4 w-4 text-[var(--g-brand-3308)]" />
              <h3 className="text-sm font-semibold text-[var(--g-text-primary)]">
                Evidencias de confianza
              </h3>
              {verification?.ok && (
                <span
                  className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-[var(--status-success)] text-[var(--g-text-inverse)]"
                  style={{ borderRadius: "var(--g-radius-full)" }}
                >
                  Verificación OK
                </span>
              )}
            </div>

            {verificationLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-start gap-3 py-2">
                    <div className="h-4 w-4 mt-0.5 rounded-full bg-[var(--g-surface-muted)] animate-pulse" />
                    <div className="flex-1 space-y-1">
                      <div className="h-3 w-1/3 bg-[var(--g-surface-muted)] animate-pulse" style={{ borderRadius: "var(--g-radius-sm)" }} />
                      <div className="h-3 w-2/3 bg-[var(--g-surface-muted)] animate-pulse" style={{ borderRadius: "var(--g-radius-sm)" }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : verification?.checks && verification.checks.length > 0 ? (
              <div className="space-y-3">
                {verification.checks.map((check, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 py-2 border-b border-[var(--g-border-subtle)] last:border-0"
                  >
                    {check.passed ? (
                      <CheckCircle2 className="h-4 w-4 mt-0.5 text-[var(--status-success)]" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 mt-0.5 text-[var(--status-error)]" />
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[var(--g-text-primary)]">
                        {check.label}
                      </p>
                      <p className="text-xs text-[var(--g-text-secondary)]">
                        {check.detail}
                      </p>
                    </div>
                    {check.timestamp && (
                      <span className="text-xs text-[var(--g-text-secondary)] whitespace-nowrap">
                        {new Date(check.timestamp).toLocaleString("es-ES")}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--g-text-secondary)]">
                No hay artefactos de confianza para verificar
              </p>
            )}

            {verification?.errors && verification.errors.length > 0 && (
              <div
                className="mt-4 bg-[var(--status-error)]/10 border border-[var(--status-error)]/30 p-3 text-xs text-[var(--g-text-primary)]"
                style={{ borderRadius: "var(--g-radius-sm)" }}
              >
                <div className="flex items-center gap-1 font-semibold text-[var(--status-error)] mb-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Errores detectados
                </div>
                <ul className="list-inside list-disc space-y-0.5 ml-1">
                  {verification.errors.map((error, i) => (
                    <li key={i} className="text-[11px]">{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
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

function RuleValidationRow({
  etapa,
  results,
}: {
  etapa: string;
  results: RuleEvaluationResult[];
}) {
  const [expanded, setExpanded] = useState(false);
  const ok = results.every((r) => r.ok);
  const severity = results.some((r) => r.severity === "BLOCKING")
    ? "BLOCKING"
    : results.some((r) => r.severity === "WARNING")
    ? "WARNING"
    : "OK";

  return (
    <div
      className="border border-[var(--g-border-subtle)]"
      style={{ borderRadius: "var(--g-radius-md)" }}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-[var(--g-surface-subtle)]/50"
      >
        <div className="flex items-center gap-2">
          {ok ? (
            <CheckCircle2 className="h-4 w-4 text-[var(--status-success)]" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-[var(--status-error)]" />
          )}
          <span className="text-xs font-semibold text-[var(--g-text-primary)]">
            {etapa}
          </span>
          <span
            className={`inline-flex px-2 py-0.5 text-[10px] font-semibold ${
              severity === "BLOCKING"
                ? "bg-[var(--status-error)] text-[var(--g-text-inverse)]"
                : severity === "WARNING"
                ? "bg-[var(--status-warning)] text-[var(--g-text-inverse)]"
                : "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
            }`}
            style={{ borderRadius: "var(--g-radius-full)" }}
          >
            {severity}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-[var(--g-text-secondary)]" />
        ) : (
          <ChevronDown className="h-4 w-4 text-[var(--g-text-secondary)]" />
        )}
      </button>

      {expanded && (
        <div className="space-y-1 border-t border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)]/30 p-3">
          {results.map((r) => (
            <div key={r.id} className="text-xs text-[var(--g-text-secondary)]">
              {r.explain_json ? (
                <>
                  {typeof r.explain_json === "object" &&
                    Object.entries(r.explain_json).map(([key, value]) => (
                      <div key={key} className="ml-2">
                        <span className="font-mono text-[10px]">{key}:</span>{" "}
                        <span className="text-[var(--g-text-primary)]">
                          {String(value)}
                        </span>
                      </div>
                    ))}
                </>
              ) : (
                <div className="text-[var(--g-text-primary)]">
                  Sin detalles de evaluación
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface AgreementRow {
  id: string;
  agreement_kind: string;
  entity_id: string;
  entities?: { common_name?: string };
}

function PactosParasocialesCard({ agreement }: { agreement: AgreementRow }) {
  const { data: pactos = [] } = usePactosVigentes(agreement.entity_id);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Material mapping: agreement_kind → materias for evaluation
  const MATERIA_MAP: Record<string, string[]> = {
    FUSION: ["FUSION"],
    ESCISION: ["ESCISION"],
    DISOLUCION: ["DISOLUCION"],
    TRANSFORMACION: ["TRANSFORMACION"],
    AMPLIACION_CAPITAL: ["AMPLIACION_CAPITAL"],
    EMISION_CONVERTIBLES: ["EMISION_CONVERTIBLES"],
    OPERACION_VINCULADA: ["OPERACION_VINCULADA"],
    MOD_ESTATUTOS: ["MOD_ESTATUTOS"],
    APROBACION_CUENTAS: ["APROBACION_CUENTAS"],
  };

  if (pactos.length === 0) {
    return (
      <Card icon={<Handshake className="h-4 w-4" />} title="Pactos parasociales">
        <p className="text-sm text-[var(--g-text-secondary)]">
          No hay pactos parasociales vigentes para esta entidad.
        </p>
      </Card>
    );
  }

  // Prepare evaluation input
  const evalInput: PactosEvalInput = {
    materias: MATERIA_MAP[agreement.agreement_kind] ?? [agreement.agreement_kind],
    capitalPresente: 100,
    capitalTotal: 100,
    votosFavor: 70,
    votosContra: 30,
    consentimientosPrevios: [],
    vetoRenunciado: [],
  };

  // Run evaluation
  const evalResult = evaluarPactosParasociales(pactos, evalInput);

  // Color mapping for severity
  const severityClass = (severity: string) => {
    switch (severity) {
      case "OK":
        return "bg-[var(--status-success)] text-[var(--g-text-inverse)]";
      case "WARNING":
        return "bg-[var(--status-warning)] text-[var(--g-text-inverse)]";
      case "BLOCKING":
        return "bg-[var(--status-error)] text-[var(--g-text-inverse)]";
      default:
        return "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]";
    }
  };

  const severityIcon = (severity: string) => {
    switch (severity) {
      case "OK":
        return <CheckCircle2 className="h-4 w-4 text-[var(--status-success)]" />;
      case "WARNING":
        return <AlertTriangle className="h-4 w-4 text-[var(--status-warning)]" />;
      case "BLOCKING":
        return <AlertTriangle className="h-4 w-4 text-[var(--status-error)]" />;
      default:
        return <Circle className="h-4 w-4 text-[var(--g-text-secondary)]" />;
    }
  };

  return (
    <Card icon={<Handshake className="h-4 w-4" />} title="Pactos parasociales">
      <div className="mb-4 grid grid-cols-3 gap-3 text-sm">
        <div className="border border-[var(--g-border-subtle)] p-3" style={{ borderRadius: "var(--g-radius-md)" }}>
          <div className="text-[11px] font-semibold text-[var(--g-text-secondary)] uppercase">Evaluados</div>
          <div className="mt-1 text-lg font-bold text-[var(--g-text-primary)]">{evalResult.pactos_evaluados}</div>
        </div>
        <div className="border border-[var(--g-border-subtle)] p-3" style={{ borderRadius: "var(--g-radius-md)" }}>
          <div className="text-[11px] font-semibold text-[var(--g-text-secondary)] uppercase">Aplicables</div>
          <div className="mt-1 text-lg font-bold text-[var(--g-text-primary)]">{evalResult.pactos_aplicables}</div>
        </div>
        <div className="border border-[var(--g-border-subtle)] p-3" style={{ borderRadius: "var(--g-radius-md)" }}>
          <div className="text-[11px] font-semibold text-[var(--g-text-secondary)] uppercase">Cumplidos</div>
          <div className="mt-1 text-lg font-bold text-[var(--g-text-primary)]">{evalResult.pactos_cumplidos}</div>
        </div>
      </div>

      {evalResult.resultados.length > 0 && (
        <div className="space-y-2">
          {evalResult.resultados.map((result) => (
            <div
              key={result.pacto_id}
              className="border border-[var(--g-border-subtle)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <button
                type="button"
                onClick={() =>
                  setExpanded(expanded === result.pacto_id ? null : result.pacto_id)
                }
                className="flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-[var(--g-surface-subtle)]/50"
              >
                <div className="flex items-center gap-2 flex-1">
                  {severityIcon(result.severity)}
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-[var(--g-text-primary)]">
                      {result.pacto_titulo}
                    </p>
                    <p className="text-[11px] text-[var(--g-text-secondary)]">
                      {result.tipo}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex px-2 py-0.5 text-[10px] font-semibold ${severityClass(
                        result.severity
                      )}`}
                      style={{ borderRadius: "var(--g-radius-full)" }}
                    >
                      {result.severity}
                    </span>
                    {result.aplica && !result.cumple && (
                      <span className="text-[10px] font-semibold text-[var(--status-error)]">
                        INCUMPLE
                      </span>
                    )}
                    {!result.aplica && (
                      <span className="text-[10px] text-[var(--g-text-secondary)]">
                        No aplica
                      </span>
                    )}
                  </div>
                </div>
                {expanded === result.pacto_id ? (
                  <ChevronUp className="h-4 w-4 text-[var(--g-text-secondary)] ml-2" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-[var(--g-text-secondary)] ml-2" />
                )}
              </button>

              {expanded === result.pacto_id && (
                <div className="border-t border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)]/30 p-3 space-y-2">
                  <div className="text-sm text-[var(--g-text-primary)]">
                    {result.explain.mensaje}
                  </div>
                  {result.explain.hijos && result.explain.hijos.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-[var(--g-border-subtle)] text-xs space-y-1">
                      {result.explain.hijos.map((hijo, idx) => (
                        <div key={idx} className="flex flex-col gap-1">
                          <span className="font-semibold text-[var(--g-text-primary)]">{hijo.regla}</span>
                          <span className="text-[11px] text-[var(--g-text-secondary)]">{hijo.mensaje}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {evalResult.blocking_issues.length > 0 && (
        <div
          className="mt-4 bg-[var(--status-error)]/10 border border-[var(--status-error)]/30 p-3 text-xs text-[var(--g-text-primary)]"
          style={{ borderRadius: "var(--g-radius-sm)" }}
        >
          <div className="flex items-center gap-1 font-semibold text-[var(--status-error)] mb-1">
            <AlertTriangle className="h-3.5 w-3.5" />
            Incumplimientos detectados
          </div>
          <ul className="list-inside list-disc space-y-0.5 ml-1">
            {evalResult.blocking_issues.map((issue, i) => (
              <li key={i} className="text-[11px]">{issue}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

// ─── Approval Workflow Card (E-D8) ──────────────────────────────────────────

interface ApprovalStep {
  id: string;
  label: string;
  role: string;
  approvedAt: string | null;
  approvedBy: string | null;
}

const DEMO_APPROVERS: Record<string, string> = {
  SECRETARIO:    "Lucía Martín (Secretaria CdA)",
  COMITE_LEGAL:  "Garrigues — Comité Legal",
  PRESIDENTE:    "Antonio García (Presidente)",
};

function makeDefaultSteps(): ApprovalStep[] {
  return [
    { id: "SECRETARIO",   label: "Revisión Secretaría",         role: "SECRETARIO",   approvedAt: null, approvedBy: null },
    { id: "COMITE_LEGAL", label: "Validación comité legal",     role: "COMITE_LEGAL", approvedAt: null, approvedBy: null },
    { id: "PRESIDENTE",   label: "Aprobación Presidente",        role: "PRESIDENTE",   approvedAt: null, approvedBy: null },
    { id: "QES_FIRMA",    label: "Firma QES cualificada",        role: "QES_FIRMA",    approvedAt: null, approvedBy: null },
  ];
}

function ApprovalWorkflowCard({ agreementId, onNavigateGenerar }: { agreementId: string; onNavigateGenerar: () => void }) {
  const storageKey = `approval-workflow-${agreementId}`;

  const [steps, setSteps] = useState<ApprovalStep[]>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : makeDefaultSteps();
    } catch {
      return makeDefaultSteps();
    }
  });

  const currentIdx = steps.findIndex((s) => s.approvedAt === null);
  const allApproved = currentIdx === -1;

  const approveStep = useCallback((idx: number) => {
    if (idx === steps.length - 1) {
      // QES step — navigate to document generator
      onNavigateGenerar();
      return;
    }
    const next = steps.map((s, i) =>
      i === idx
        ? { ...s, approvedAt: new Date().toISOString(), approvedBy: DEMO_APPROVERS[s.role] ?? s.role }
        : s
    );
    setSteps(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
  }, [steps, storageKey, onNavigateGenerar]);

  const resetWorkflow = useCallback(() => {
    const fresh = makeDefaultSteps();
    setSteps(fresh);
    localStorage.removeItem(storageKey);
  }, [storageKey]);

  const stepIcons = [UserCheck, ClipboardCheck, CheckCircle2, Lock];

  return (
    <Card icon={<ClipboardCheck className="h-4 w-4 text-[var(--g-brand-3308)]" />} title="Flujo de aprobación">
      {allApproved ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-[var(--status-success)]">
            <CheckCircle2 className="h-5 w-5" />
            Acuerdo totalmente aprobado y firmado
          </div>
          <button
            type="button"
            onClick={resetWorkflow}
            className="text-xs text-[var(--g-text-secondary)] hover:text-[var(--g-brand-3308)] underline"
          >
            Reiniciar flujo (demo)
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {steps.map((step, i) => {
            const StepIcon = stepIcons[i] ?? CheckCircle2;
            const isActive = i === currentIdx;
            const isDone = step.approvedAt !== null;
            const isPending = !isDone && !isActive;

            return (
              <div
                key={step.id}
                className={`flex items-start gap-3 p-3 transition-colors ${
                  isActive
                    ? "bg-[var(--g-sec-100)] border border-[var(--g-brand-3308)]"
                    : isDone
                    ? "bg-[var(--status-success)]/5 border border-[var(--status-success)]/20"
                    : "bg-[var(--g-surface-subtle)] border border-[var(--g-border-subtle)]"
                }`}
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <StepIcon
                  className={`mt-0.5 h-4 w-4 shrink-0 ${
                    isDone
                      ? "text-[var(--status-success)]"
                      : isActive
                      ? "text-[var(--g-brand-3308)]"
                      : "text-[var(--g-text-secondary)]"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold ${isActive ? "text-[var(--g-brand-3308)]" : "text-[var(--g-text-primary)]"}`}>
                      {step.label}
                    </span>
                    {isDone && (
                      <span
                        className="px-1.5 py-0.5 text-[9px] font-semibold bg-[var(--status-success)] text-[var(--g-text-inverse)]"
                        style={{ borderRadius: "var(--g-radius-sm)" }}
                      >
                        APROBADO
                      </span>
                    )}
                    {isPending && (
                      <span
                        className="px-1.5 py-0.5 text-[9px] font-medium bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
                        style={{ borderRadius: "var(--g-radius-sm)" }}
                      >
                        PENDIENTE
                      </span>
                    )}
                  </div>
                  {isDone && step.approvedAt && (
                    <p className="text-[11px] text-[var(--g-text-secondary)] mt-0.5">
                      {step.approvedBy} · {new Date(step.approvedAt).toLocaleString("es-ES")}
                    </p>
                  )}
                  {isActive && (
                    <button
                      type="button"
                      onClick={() => approveStep(i)}
                      className={`mt-2 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                        step.id === "QES_FIRMA"
                          ? "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)]"
                          : "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)]"
                      }`}
                      style={{ borderRadius: "var(--g-radius-md)" }}
                    >
                      {step.id === "QES_FIRMA" ? (
                        <>
                          <Lock className="h-3 w-3" />
                          Firmar con QES
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-3 w-3" />
                          Aprobar
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
