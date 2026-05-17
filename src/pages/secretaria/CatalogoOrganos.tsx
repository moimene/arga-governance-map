import { useMemo, useState, type ElementType, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Landmark,
  Scale,
  ScrollText,
  Users,
} from "lucide-react";
import { useCurrentUserRole } from "@/hooks/useCurrentUser";
import { useBodiesByEntity, useBodyMandates, type BodySlim } from "@/hooks/useBodies";
import {
  useMaterializeEffectiveRuleMatrix,
  useOrganRules,
  useUpsertOrganRule,
} from "@/hooks/useNormativeGovernance";
import { useSociedades } from "@/hooks/useSociedades";
import {
  canPerformNormativeAction,
  displaySocietyLegalForm,
  normativeRoleFromAppRole,
  sanitizeBusinessLabel,
} from "@/lib/secretaria/mesa-control-societaria";

const BODY_TYPE_LABEL: Record<string, string> = {
  JUNTA: "Junta General",
  CDA: "Consejo de Administración",
  CONSEJO: "Consejo de Administración",
  COMISION: "Comisión delegada",
  COMITE: "Comité",
};

function normalize(value?: string | null) {
  return String(value ?? "").trim().toUpperCase();
}

function bodyTypeLabel(type?: string | null) {
  const normalized = normalize(type);
  return BODY_TYPE_LABEL[normalized] ?? sanitizeBusinessLabel(type);
}

function organStatus(body: BodySlim): "activo" | "incompleto" | "sin_reglamento" {
  if (!body.regulation_id && normalize(body.body_type) !== "JUNTA") return "sin_reglamento";
  if (!body.quorum && !body.config) return "incompleto";
  return "activo";
}

function organCompetences(body: BodySlim) {
  const type = normalize(body.body_type);
  if (type === "JUNTA") {
    return [
      "Aprobación de cuentas",
      "Aplicación del resultado",
      "Modificación de estatutos",
      "Aumento y reducción de capital",
      "Operaciones estructurales",
    ];
  }
  if (type === "CDA" || type === "CONSEJO") {
    return [
      "Formulación de cuentas",
      "Convocatoria de junta",
      "Delegación de facultades",
      "Seguimiento estratégico",
      "Políticas corporativas",
    ];
  }
  return [
    "Informe al órgano competente",
    "Seguimiento especializado",
    "Recomendaciones y constancias",
  ];
}

function organMajority(body: BodySlim) {
  const type = normalize(body.body_type);
  if (type === "JUNTA") return "Según materia: simple, reforzada o estatutaria";
  if (type === "CDA" || type === "CONSEJO") return "Mayoría del órgano salvo regla estatutaria o reglamentaria";
  return "No decisoria salvo delegación expresa";
}

function organQuorum(body: BodySlim) {
  return body.quorum ?? "Pendiente de parametrizar";
}

export default function CatalogoOrganos() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: sociedades = [] } = useSociedades();
  const selectedEntityId = searchParams.get("entity") ?? sociedades[0]?.id ?? "";
  const selectedSociedad = sociedades.find((sociedad) => sociedad.id === selectedEntityId) ?? null;
  const { data: bodies = [], isLoading } = useBodiesByEntity(selectedEntityId || undefined);
  const [localBodyId, setLocalBodyId] = useState("");
  const selectedBodyId = searchParams.get("body") || localBodyId || bodies[0]?.id || "";
  const selectedBody = bodies.find((body) => body.id === selectedBodyId) ?? bodies[0] ?? null;
  const { data: members = [] } = useBodyMandates(selectedBody?.id);
  const { primaryRole } = useCurrentUserRole();
  const normativeRole = normativeRoleFromAppRole(primaryRole);
  const { data: organRules = [], isLoading: organRulesLoading } = useOrganRules(selectedEntityId || undefined);
  const upsertOrganRule = useUpsertOrganRule();
  const materializeMatrix = useMaterializeEffectiveRuleMatrix();
  const matter = searchParams.get("matter");
  const selectedBodyRules = organRules.filter((rule) => rule.body_id === selectedBody?.id);
  const canChangeOrgan = canPerformNormativeAction(normativeRole, "change_organ");

  const bodyRows = useMemo(
    () =>
      bodies.map((body) => ({
        body,
        status: organStatus(body),
        competences: organCompetences(body),
      })),
    [bodies],
  );

  function handleSociety(next: string) {
    const params = new URLSearchParams(searchParams);
    if (next) params.set("entity", next);
    else params.delete("entity");
    params.delete("body");
    setLocalBodyId("");
    setSearchParams(params, { replace: true });
  }

  function handleBody(next: string) {
    setLocalBodyId(next);
    const params = new URLSearchParams(searchParams);
    params.set("body", next);
    if (selectedEntityId) params.set("entity", selectedEntityId);
    setSearchParams(params, { replace: true });
  }

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
            <Landmark className="h-3.5 w-3.5" />
            Secretaría · Catálogo de órganos societarios
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
            Órganos, competencias y reglamentos
          </h1>
          <p className="mt-1 max-w-4xl text-sm leading-6 text-[var(--g-text-secondary)]">
            Consulta la composición de cada órgano, sus competencias por materia, el quórum de
            constitución, las mayorías aplicables y el reglamento vinculado.
          </p>
          {selectedSociedad ? (
            <p className="mt-2 text-xs text-[var(--g-text-secondary)]">
              {selectedSociedad.common_name ?? selectedSociedad.legal_name} · Jurisdicción{" "}
              {selectedSociedad.jurisdiction ?? "no informada"} · Forma{" "}
              {displaySocietyLegalForm({
                jurisdiction: selectedSociedad.jurisdiction,
                tipoSocial: selectedSociedad.tipo_social,
                legalForm: selectedSociedad.legal_form,
              })}
            </p>
          ) : null}
        </div>

        <label className="min-w-[280px] text-xs font-semibold uppercase tracking-wider text-[var(--g-text-primary)]">
          Sociedad
          <select
            value={selectedEntityId}
            onChange={(event) => handleSociety(event.target.value)}
            className="mt-1 w-full border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-3 py-2 text-sm font-normal normal-case tracking-normal text-[var(--g-text-primary)] focus:border-[var(--g-brand-3308)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <option value="">Selecciona sociedad</option>
            {sociedades.map((sociedad) => (
              <option key={sociedad.id} value={sociedad.id}>
                {sociedad.common_name ?? sociedad.legal_name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {matter ? (
        <div
          className="mb-6 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] p-4 text-sm text-[var(--g-text-primary)]"
          style={{ borderRadius: "var(--g-radius-lg)" }}
        >
          Revisión iniciada desde una materia concreta. Si cambias el órgano competente para{" "}
          <strong>{sanitizeBusinessLabel(matter)}</strong>, la regla efectiva deberá recalcular quórum,
          mayoría y fuentes.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,420px)_1fr]">
        <section className="space-y-3">
          {isLoading ? (
            <Panel>Cargando órganos…</Panel>
          ) : bodyRows.length === 0 ? (
            <Panel>
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-[var(--status-warning)]" />
                <div>
                  <div className="font-semibold text-[var(--g-text-primary)]">
                    No hay órganos definidos para esta sociedad.
                  </div>
                  <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
                    La regla efectiva no puede resolver órgano competente hasta crear o importar el
                    órgano correspondiente.
                  </p>
                </div>
              </div>
            </Panel>
          ) : (
            bodyRows.map(({ body, status, competences }) => (
              <button
                key={body.id}
                type="button"
                onClick={() => handleBody(body.id)}
                className={`w-full border bg-[var(--g-surface-card)] p-4 text-left transition-colors hover:bg-[var(--g-surface-subtle)] ${
                  selectedBody?.id === body.id ? "border-[var(--g-brand-3308)]" : "border-[var(--g-border-subtle)]"
                }`}
                style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-[var(--g-text-primary)]">{body.name}</div>
                    <div className="mt-1 text-xs text-[var(--g-text-secondary)]">{bodyTypeLabel(body.body_type)}</div>
                  </div>
                  <StatusChip status={status} />
                </div>
                <div className="mt-3 text-xs text-[var(--g-text-secondary)]">
                  {competences.slice(0, 2).join(" · ")}
                </div>
              </button>
            ))
          )}
        </section>

        <section>
          {selectedBody ? (
            <div
              className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-5"
              style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-[var(--g-brand-3308)]">
                    {bodyTypeLabel(selectedBody.body_type)}
                  </div>
                  <h2 className="mt-1 text-xl font-semibold text-[var(--g-text-primary)]">{selectedBody.name}</h2>
                  <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
                    Estado del órgano: {organStatusLabel(organStatus(selectedBody))}.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <ActionLink to={`/secretaria/sociedades/${selectedEntityId}/admin/nuevo`} label="Gestionar miembros" />
                  <ActionLink to={`/secretaria/catalogo-materias?entity=${selectedEntityId}`} label="Asignar competencia" />
                  <ActionLink to={`/secretaria/sociedades/${selectedEntityId}/marco-normativo/activar`} label="Vincular reglamento" />
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <InfoBlock icon={Scale} title="Quórum de constitución" value={organQuorum(selectedBody)} />
                <InfoBlock icon={CheckCircle2} title="Mayorías" value={organMajority(selectedBody)} />
                <InfoBlock
                  icon={ScrollText}
                  title="Reglamento vinculado"
                  value={selectedBody.regulation_id ? "Reglamento registrado" : "Sin reglamento vinculado"}
                />
                <InfoBlock icon={Users} title="Miembros vigentes" value={`${members.length}`} />
              </div>

              <div className="mt-6">
                <h3 className="text-sm font-semibold text-[var(--g-text-primary)]">Competencias por materia</h3>
                <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                  {organCompetences(selectedBody).map((competence) => (
                    <div
                      key={competence}
                      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] p-3 text-sm text-[var(--g-text-primary)]"
                      style={{ borderRadius: "var(--g-radius-md)" }}
                    >
                      {competence}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 border-t border-[var(--g-border-subtle)] pt-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--g-text-primary)]">
                      Reglas persistidas del órgano
                    </h3>
                    <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
                      Estas reglas alimentan la matriz de regla efectiva por sociedad y materia.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!selectedEntityId || !matter || !canChangeOrgan.allowed || upsertOrganRule.isPending}
                      aria-disabled={!selectedEntityId || !matter || !canChangeOrgan.allowed}
                      aria-busy={upsertOrganRule.isPending}
                      onClick={() => {
                        if (!selectedEntityId || !selectedBody || !matter) return;
                        upsertOrganRule.mutate({
                          entityId: selectedEntityId,
                          bodyId: selectedBody.id,
                          matterCode: matter,
                          competenceType: "DECISION",
                          quorumRule: organQuorum(selectedBody),
                          majorityRule: organMajority(selectedBody),
                          sourceType: selectedBody.regulation_id ? "REGLAMENTO" : "ESTATUTOS",
                          sourceRef: selectedBody.regulation_id
                            ? `Reglamento del órgano ${selectedBody.name}`
                            : `Estatutos sociales · competencia ${selectedBody.name}`,
                          userRole: normativeRole,
                        });
                      }}
                      className="inline-flex items-center gap-1 bg-[var(--g-brand-3308)] px-3 py-2 text-xs font-semibold text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] disabled:cursor-not-allowed disabled:bg-[var(--g-surface-muted)] disabled:text-[var(--g-text-secondary)]"
                      style={{ borderRadius: "var(--g-radius-md)" }}
                    >
                      Publicar competencia base <ArrowRight className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      disabled={!selectedEntityId || materializeMatrix.isPending}
                      aria-busy={materializeMatrix.isPending}
                      onClick={() => materializeMatrix.mutate({ entityId: selectedEntityId })}
                      className="inline-flex items-center gap-1 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-xs font-semibold text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] disabled:cursor-not-allowed disabled:opacity-60"
                      style={{ borderRadius: "var(--g-radius-md)" }}
                    >
                      Recalcular matriz
                    </button>
                  </div>
                </div>
                {!matter ? (
                  <p className="mt-3 text-xs text-[var(--g-text-secondary)]">
                    Abre el catálogo desde una materia concreta para publicar una competencia específica.
                  </p>
                ) : !canChangeOrgan.allowed ? (
                  <p className="mt-3 text-xs text-[var(--g-text-secondary)]">{canChangeOrgan.reason}</p>
                ) : null}
                {upsertOrganRule.error ? (
                  <InlineError message={upsertOrganRule.error instanceof Error ? upsertOrganRule.error.message : "No se pudo publicar la competencia."} />
                ) : null}
                {materializeMatrix.data ? (
                  <p className="mt-3 text-xs text-[var(--g-text-secondary)]">
                    Matriz recalculada: {materializeMatrix.data.rows_materialized} filas.
                  </p>
                ) : null}
                {organRulesLoading ? (
                  <p className="mt-3 text-sm text-[var(--g-text-secondary)]">Cargando reglas persistidas…</p>
                ) : selectedBodyRules.length === 0 ? (
                  <p className="mt-3 text-sm text-[var(--g-text-secondary)]">
                    No hay reglas persistidas para este órgano. La regla efectiva usará inferencia legal
                    hasta publicar una fuente documental.
                  </p>
                ) : (
                  <ul className="mt-3 divide-y divide-[var(--g-border-subtle)] border border-[var(--g-border-subtle)]" style={{ borderRadius: "var(--g-radius-md)" }}>
                    {selectedBodyRules.map((rule) => (
                      <li key={rule.id} className="px-3 py-2 text-sm">
                        <div className="font-semibold text-[var(--g-text-primary)]">{sanitizeBusinessLabel(rule.matter_code)}</div>
                        <div className="text-xs text-[var(--g-text-secondary)]">
                          Quórum: {rule.quorum_rule} · Mayoría: {rule.majority_rule}
                        </div>
                        <div className="text-xs text-[var(--g-text-secondary)]">
                          Fuente: {sanitizeBusinessLabel(rule.source_type)} · {rule.source_ref}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-6">
                <h3 className="text-sm font-semibold text-[var(--g-text-primary)]">Miembros</h3>
                {members.length === 0 ? (
                  <p className="mt-2 text-sm text-[var(--g-text-secondary)]">
                    No hay miembros vigentes cargados en este órgano.
                  </p>
                ) : (
                  <ul className="mt-2 divide-y divide-[var(--g-border-subtle)] border border-[var(--g-border-subtle)]" style={{ borderRadius: "var(--g-radius-md)" }}>
                    {members.map((member) => (
                      <li key={member.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                        <span className="font-medium text-[var(--g-text-primary)]">{member.full_name ?? "Persona sin nombre"}</span>
                        <span className="text-xs text-[var(--g-text-secondary)]">{sanitizeBusinessLabel(member.role)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : (
            <Panel>Selecciona una sociedad y un órgano para consultar la ficha.</Panel>
          )}
        </section>
      </div>
    </div>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <div
      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-5 text-sm text-[var(--g-text-secondary)]"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      {children}
    </div>
  );
}

function StatusChip({ status }: { status: ReturnType<typeof organStatus> }) {
  const cls =
    status === "activo"
      ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
      : status === "sin_reglamento"
        ? "bg-[var(--status-warning)] text-[var(--g-text-inverse)]"
        : "bg-[var(--status-error)] text-[var(--g-text-inverse)]";
  return (
    <span className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cls}`} style={{ borderRadius: "var(--g-radius-full)" }}>
      {organStatusLabel(status)}
    </span>
  );
}

function organStatusLabel(status: ReturnType<typeof organStatus>) {
  if (status === "activo") return "Activo";
  if (status === "sin_reglamento") return "Sin reglamento";
  return "Incompleto";
}

function ActionLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-xs font-semibold text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
      style={{ borderRadius: "var(--g-radius-md)" }}
    >
      {label} <ArrowRight className="h-3 w-3" />
    </Link>
  );
}

function InfoBlock({
  icon: Icon,
  title,
  value,
}: {
  icon: ElementType;
  title: string;
  value: string;
}) {
  return (
    <div
      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] p-4"
      style={{ borderRadius: "var(--g-radius-md)" }}
    >
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
        <Icon className="h-3.5 w-3.5 text-[var(--g-brand-3308)]" />
        {title}
      </div>
      <div className="mt-2 text-sm font-semibold text-[var(--g-text-primary)]">{value}</div>
    </div>
  );
}

function InlineError({ message }: { message: string }) {
  return (
    <div
      className="mt-3 border border-[var(--status-error)] bg-[var(--g-surface-card)] p-3 text-xs text-[var(--g-text-secondary)]"
      role="alert"
      style={{ borderRadius: "var(--g-radius-md)" }}
    >
      <span className="font-semibold text-[var(--status-error)]">No se pudo completar la acción.</span>{" "}
      {message}
    </div>
  );
}
