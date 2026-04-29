import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Building2, ChevronLeft, Coins, Layers, Users, Gavel, UserCheck,
  ShieldCheck, Scroll, UserPlus, ArrowRightLeft, BookOpen,
  Bell, CalendarDays, CheckCircle2, ClipboardList, FileText,
  Landmark, Route, ScrollText,
} from "lucide-react";
import { useSecretariaScope } from "@/components/secretaria/shell";
import { useSociedad } from "@/hooks/useSociedades";
import { useCapitalProfile, useShareClasses } from "@/hooks/useCapitalProfile";
import { useCapitalHoldings } from "@/hooks/useCapitalHoldings";
import { useAdministradores, CARGO_LABELS } from "@/hooks/useCargos";
import { useEntityBodies } from "@/hooks/useEntities";
import { useRepresentaciones, SCOPE_LABELS } from "@/hooks/useRepresentacionesCanonical";
import { useAuthorityEvidence, CARGO_CERT_LABELS } from "@/hooks/useAuthorityEvidence";

type TabId =
  | "perfil"
  | "capital"
  | "clases"
  | "socios"
  | "organos"
  | "admins"
  | "representaciones"
  | "autoridad";

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "perfil",           label: "Perfil",              icon: Building2 },
  { id: "capital",          label: "Capital",             icon: Coins },
  { id: "clases",           label: "Clases",              icon: Layers },
  { id: "socios",           label: "Socios",              icon: Users },
  { id: "organos",          label: "Órganos",             icon: Gavel },
  { id: "admins",           label: "Administradores",     icon: UserCheck },
  { id: "representaciones", label: "Representaciones",    icon: Scroll },
  { id: "autoridad",        label: "Autoridad",           icon: ShieldCheck },
];

function tipoSocialLabel(value: string | null | undefined) {
  if (!value) return "Tipo social pendiente";
  return (
    {
      SA: "Sociedad Anónima",
      SAU: "Sociedad Anónima Unipersonal",
      SL: "Sociedad Limitada",
      SLU: "Sociedad Limitada Unipersonal",
    } as Record<string, string>
  )[value] ?? value;
}

function normalizeAdminForm(value: string | null | undefined, fallback: string | null | undefined) {
  const joined = `${value ?? ""} ${fallback ?? ""}`.toUpperCase();
  if (joined.includes("MANCOMUN")) return "Administradores mancomunados";
  if (joined.includes("SOLIDAR")) return "Administradores solidarios";
  if (joined.includes("UNICO") || joined.includes("ÚNICO")) return "Administrador único";
  if (joined.includes("CONSEJO")) return "Consejo de Administración";
  return value ?? fallback ?? "Forma de administración pendiente";
}

function getSociedadModel(s: NonNullable<ReturnType<typeof useSociedad>["data"]>) {
  const admin = normalizeAdminForm(s.forma_administracion, s.tipo_organo_admin);
  const social = s.tipo_social ?? s.legal_form ?? "";
  const isSa = social.includes("SA");
  const isSl = social.includes("SL");

  const adminFlow = admin.includes("mancomunados")
    ? "Co-aprobación: requiere las firmas mancomunadas vigentes antes de documentar el acuerdo."
    : admin.includes("solidarios")
      ? "Administrador solidario: el expediente puede cerrarse con actuación de un administrador vigente."
      : admin.includes("único")
        ? "Administrador único: no hay sesión ni convocatoria; se documenta la decisión del cargo vigente."
        : "Consejo: el sistema propone sesión formal o acuerdo sin sesión según materia, urgencia y estatutos.";

  const juntaFlow = s.es_unipersonal
    ? "Socio único: las materias de junta se documentan como decisión unipersonal, sin convocatoria formal."
    : isSa
      ? "Junta SA: convocatoria con antelación legal reforzada y control documental desde la convocatoria."
      : isSl
        ? "Junta SL: convocatoria individual a socios con evidencia del canal utilizado."
        : "Junta: se aplican reglas de constitución, mayoría y documentación según jurisdicción y estatutos.";

  const evidenceFlow = s.es_cotizada
    ? "Cotizada: el motor evalúa LSC y añade advertencias LMV sin bloquear automáticamente el flujo."
    : "No cotizada: el flujo se centra en LSC, estatutos, evidencias y trazabilidad registral.";

  return {
    admin,
    socialLabel: tipoSocialLabel(s.tipo_social ?? s.legal_form),
    adminFlow,
    juntaFlow,
    evidenceFlow,
    facts: [
      { label: "Tipo social", value: tipoSocialLabel(s.tipo_social ?? s.legal_form) },
      { label: "Administración", value: admin },
      { label: "Unipersonal", value: s.es_unipersonal ? "Sí" : "No" },
      { label: "Cotizada", value: s.es_cotizada ? "Sí" : "No" },
    ],
  };
}

export default function SociedadDetalle() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<TabId>("perfil");
  const scope = useSecretariaScope();
  const { data: s, isLoading } = useSociedad(id);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1440px] p-6 text-sm text-[var(--g-text-secondary)]">Cargando…</div>
    );
  }
  if (!s) {
    return (
      <div className="mx-auto max-w-[1440px] p-6 text-sm text-[var(--g-text-secondary)]">
        Sociedad no encontrada.{" "}
        <Link to="/secretaria/sociedades" className="text-[var(--g-brand-3308)] underline">
          Volver
        </Link>
      </div>
    );
  }

  const model = getSociedadModel(s);

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <div className="mb-4">
        <Link
          to="/secretaria/sociedades?scope=grupo"
          className="inline-flex items-center gap-1 text-xs text-[var(--g-text-secondary)] hover:text-[var(--g-brand-3308)]"
        >
          <ChevronLeft className="h-3 w-3" /> Cartera de sociedades
        </Link>
      </div>

      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
            <Building2 className="h-3.5 w-3.5" />
            Secretaría · Ficha societaria
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
            {s.common_name ?? s.legal_name}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-[var(--g-text-secondary)]">
            {s.legal_name} · {s.registration_number ?? "sin NIF"} · {s.jurisdiction ?? "—"}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <SociedadBadge label={model.socialLabel} />
            <SociedadBadge label={model.admin} />
            {s.es_unipersonal ? <SociedadBadge label="Unipersonal" tone="accent" /> : null}
            {s.es_cotizada ? <SociedadBadge label="Cotizada" tone="accent" /> : null}
          </div>
        </div>
        <Link
          to={`/secretaria/sociedades/${s.id}/reglas`}
          className="inline-flex shrink-0 items-center gap-1.5 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm font-semibold text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <BookOpen className="h-3.5 w-3.5" />
          Reglas aplicables
        </Link>
      </div>

      <SociedadOperationalOverview entityId={s.id} s={s} model={model} />

      <SociedadDecisionModel s={s} model={model} />

      <SociedadQuickActions entityId={s.id} scopedTo={scope.createScopedTo} />

      {/* Tabs */}
      <div className="mb-4 mt-6 flex gap-1 overflow-x-auto border-b border-[var(--g-border-subtle)]">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors ${
                active
                  ? "border-[var(--g-brand-3308)] font-semibold text-[var(--g-brand-3308)]"
                  : "border-transparent text-[var(--g-text-secondary)] hover:text-[var(--g-text-primary)]"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div>
        {tab === "perfil"           && <TabPerfil id={s.id} s={s} />}
        {tab === "capital"          && <TabCapital entityId={s.id} />}
        {tab === "clases"           && <TabClases entityId={s.id} />}
        {tab === "socios"           && <TabSocios entityId={s.id} />}
        {tab === "organos"          && <TabOrganos entityId={s.id} />}
        {tab === "admins"           && <TabAdmins entityId={s.id} />}
        {tab === "representaciones" && <TabRepresentaciones entityId={s.id} />}
        {tab === "autoridad"        && <TabAutoridad entityId={s.id} />}
      </div>
    </div>
  );
}

type SociedadModel = ReturnType<typeof getSociedadModel>;

function SociedadBadge({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "accent" }) {
  return (
    <span
      className={
        tone === "accent"
          ? "inline-flex items-center px-2.5 py-1 text-xs font-semibold bg-[var(--g-sec-100)] text-[var(--g-brand-3308)]"
          : "inline-flex items-center px-2.5 py-1 text-xs font-semibold bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]"
      }
      style={{ borderRadius: "var(--g-radius-full)" }}
    >
      {label}
    </span>
  );
}

function SociedadOperationalOverview({
  entityId,
  s,
  model,
}: {
  entityId: string;
  s: NonNullable<ReturnType<typeof useSociedad>["data"]>;
  model: SociedadModel;
}) {
  const { data: capital } = useCapitalProfile(entityId);
  const { data: socios = [] } = useCapitalHoldings(entityId);
  const { data: organos = [] } = useEntityBodies(entityId);
  const { data: administradores = [] } = useAdministradores(entityId);
  const { data: autoridad = [] } = useAuthorityEvidence(entityId);

  const capitalValue = capital
    ? `${Number(capital.capital_escriturado).toLocaleString("es-ES")} ${capital.currency}`
    : "Pendiente";

  return (
    <section className="mb-5">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-5"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <div className="flex items-start gap-3">
            <Landmark className="mt-0.5 h-5 w-5 shrink-0 text-[var(--g-brand-3308)]" />
            <div>
              <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">
                Identidad operativa de la sociedad
              </h2>
              <p className="mt-1 text-sm leading-6 text-[var(--g-text-secondary)]">
                Esta ficha concentra los datos maestros que gobiernan sus expedientes:
                tipo social, forma de administración, unipersonalidad, capital, órganos y evidencias
                de autoridad.
              </p>
            </div>
          </div>

          <dl className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
            {[
              ["Denominación legal", s.legal_name],
              ["Jurisdicción", s.jurisdiction ?? "—"],
              ["Forma social", model.socialLabel],
              ["Administración", model.admin],
              ["Matriz", s.parent?.common_name ?? s.parent?.legal_name ?? "—"],
              ["Participación matriz", s.ownership_percentage != null ? `${s.ownership_percentage}%` : "—"],
            ].map(([label, value]) => (
              <div key={label} className="border-l-2 border-[var(--g-sec-300)] pl-3">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-[var(--g-text-secondary)]">
                  {label}
                </dt>
                <dd className="mt-0.5 text-sm font-medium text-[var(--g-text-primary)]">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <MiniMetric icon={Coins} label="Capital" value={capitalValue} />
          <MiniMetric icon={Users} label="Socios" value={socios.length} />
          <MiniMetric icon={Gavel} label="Órganos" value={organos.length} />
          <MiniMetric icon={UserCheck} label="Admins." value={administradores.length} />
          <MiniMetric icon={ShieldCheck} label="Autoridad" value={autoridad.length} />
          <MiniMetric icon={CheckCircle2} label="Estado" value={s.entity_status ?? "Activa"} />
        </div>
      </div>
    </section>
  );
}

function MiniMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div
      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-[var(--g-brand-3308)]" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--g-text-secondary)]">
          {label}
        </span>
      </div>
      <div className="mt-2 text-lg font-semibold text-[var(--g-text-primary)]">{value}</div>
    </div>
  );
}

function SociedadDecisionModel({
  s,
  model,
}: {
  s: NonNullable<ReturnType<typeof useSociedad>["data"]>;
  model: SociedadModel;
}) {
  return (
    <section
      className="mb-5 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-5"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <div className="flex flex-col gap-5 lg:flex-row">
        <div className="lg:w-[300px]">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--g-text-primary)]">
            <Route className="h-4 w-4 text-[var(--g-brand-3308)]" />
            Modelo de decisión
          </div>
          <p className="mt-2 text-sm leading-6 text-[var(--g-text-secondary)]">
            El sistema usa estos datos para decidir si crea una reunión, una decisión unipersonal,
            una co-aprobación, una actuación solidaria o una tarea posterior.
          </p>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-3 xl:grid-cols-3">
          <DecisionRule
            icon={Gavel}
            title="Órgano de administración"
            body={model.adminFlow}
          />
          <DecisionRule
            icon={Users}
            title={s.es_unipersonal ? "Socio único" : "Junta general"}
            body={model.juntaFlow}
          />
          <DecisionRule
            icon={ShieldCheck}
            title="Evidencia y alertas"
            body={model.evidenceFlow}
          />
        </div>
      </div>
    </section>
  );
}

function DecisionRule({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Building2;
  title: string;
  body: string;
}) {
  return (
    <div
      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
      style={{ borderRadius: "var(--g-radius-md)" }}
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--g-text-primary)]">
        <Icon className="h-4 w-4 text-[var(--g-brand-3308)]" />
        {title}
      </div>
      <p className="mt-2 text-sm leading-6 text-[var(--g-text-secondary)]">{body}</p>
    </div>
  );
}

function SociedadQuickActions({
  entityId,
  scopedTo,
}: {
  entityId: string;
  scopedTo: (to: string) => string;
}) {
  const actions = [
    { label: "Nueva convocatoria", icon: Bell, to: "/secretaria/convocatorias/nueva" },
    { label: "Nueva reunión", icon: CalendarDays, to: "/secretaria/reuniones/nueva" },
    { label: "Acuerdo sin sesión", icon: ScrollText, to: "/secretaria/acuerdos-sin-sesion/nuevo" },
    { label: "Generar documento", icon: FileText, to: "/secretaria/tramitador/nuevo" },
    { label: "Reglas aplicables", icon: ClipboardList, to: `/secretaria/sociedades/${entityId}/reglas` },
  ];

  return (
    <section className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-5">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Link
            key={action.label}
            to={scopedTo(action.to)}
            className="inline-flex min-h-11 items-center gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm font-semibold text-[var(--g-text-primary)] transition-colors hover:border-[var(--g-brand-3308)] hover:bg-[var(--g-sec-100)] hover:text-[var(--g-brand-3308)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--g-border-focus)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <Icon className="h-4 w-4 shrink-0 text-[var(--g-brand-3308)]" />
            <span>{action.label}</span>
          </Link>
        );
      })}
    </section>
  );
}

// ------------------------------------------------------------
// Tab: Perfil
// ------------------------------------------------------------
function TabPerfil({ id, s }: { id: string; s: NonNullable<ReturnType<typeof useSociedad>["data"]> }) {
  const fields: [string, React.ReactNode][] = [
    ["ID", <code className="text-xs">{id}</code>],
    ["Slug", s.slug],
    ["Tipo social", s.tipo_social ?? "—"],
    ["Forma jurídica", s.legal_form ?? "—"],
    ["Forma administración", s.forma_administracion ?? "—"],
    ["Órgano admin.", s.tipo_organo_admin ?? "—"],
    ["Unipersonal", s.es_unipersonal ? "Sí" : "No"],
    ["Cotizada", s.es_cotizada ? "Sí" : "No"],
    ["Jurisdicción", s.jurisdiction ?? "—"],
    ["Materialidad", s.materiality ?? "—"],
    ["Estado", s.entity_status ?? "—"],
    ["Matriz", s.parent?.common_name ?? s.parent?.legal_name ?? "—"],
    ["% Propiedad matriz", s.ownership_percentage != null ? `${s.ownership_percentage}%` : "—"],
    ["PJ (persons)", s.person ? `${s.person.full_name} — ${s.person.tax_id ?? "—"}` : "—"],
  ];
  return (
    <div
      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-6"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {fields.map(([k, v], i) => (
          <div key={i} className="flex flex-col gap-0.5">
            <dt className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">{k}</dt>
            <dd className="text-sm text-[var(--g-text-primary)]">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ------------------------------------------------------------
// Tab: Capital
// ------------------------------------------------------------
function TabCapital({ entityId }: { entityId: string }) {
  const { data: cap, isLoading } = useCapitalProfile(entityId);
  if (isLoading) return <div className="p-4 text-sm text-[var(--g-text-secondary)]">Cargando…</div>;
  if (!cap) {
    return (
      <div className="p-4 text-sm text-[var(--g-text-secondary)]">
        Sin perfil de capital vigente. Registre capital desde el stepper de alta.
      </div>
    );
  }
  const pct =
    cap.capital_desembolsado && cap.capital_escriturado
      ? Math.round((Number(cap.capital_desembolsado) / Number(cap.capital_escriturado)) * 100)
      : null;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <Link
          to={`/secretaria/sociedades/${entityId}/transmision`}
          className="inline-flex items-center gap-1.5 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm font-semibold text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <ArrowRightLeft className="h-3.5 w-3.5" />
          Transmisión
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Kpi label="Capital escriturado" value={`${cap.capital_escriturado.toLocaleString()} ${cap.currency}`} />
        <Kpi label="Capital desembolsado" value={cap.capital_desembolsado ? `${Number(cap.capital_desembolsado).toLocaleString()} ${cap.currency}` : "—"} sub={pct != null ? `${pct}% de escriturado` : undefined} />
        <Kpi label="Número de títulos" value={cap.numero_titulos != null ? Number(cap.numero_titulos).toLocaleString() : "—"} />
        <Kpi label="Valor nominal" value={cap.valor_nominal != null ? `${Number(cap.valor_nominal).toLocaleString()} ${cap.currency}` : "—"} />
        <Kpi label="Vigente desde" value={cap.effective_from} />
        <Kpi label="Estado" value={cap.estado} />
      </div>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div
      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <div className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">{label}</div>
      <div className="mt-1 text-lg font-semibold text-[var(--g-text-primary)]">{value}</div>
      {sub ? <div className="mt-0.5 text-[11px] text-[var(--g-text-secondary)]">{sub}</div> : null}
    </div>
  );
}

// ------------------------------------------------------------
// Tab: Clases
// ------------------------------------------------------------
function TabClases({ entityId }: { entityId: string }) {
  const { data, isLoading } = useShareClasses(entityId);
  return (
    <Table isLoading={isLoading} empty="Sin clases definidas." headers={["Código", "Nombre", "Votos/título", "Coef. económico", "Derechos voto", "Veto"]}>
      {(data ?? []).map((c) => (
        <tr key={c.id} className="hover:bg-[var(--g-surface-subtle)]/50">
          <td className="px-6 py-3 text-sm font-semibold text-[var(--g-text-primary)]">{c.class_code}</td>
          <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">{c.name}</td>
          <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">{c.votes_per_title}</td>
          <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">{c.economic_rights_coeff}</td>
          <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">{c.voting_rights ? "Sí" : "No"}</td>
          <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">{c.veto_rights ? "Sí" : "No"}</td>
        </tr>
      ))}
    </Table>
  );
}

// ------------------------------------------------------------
// Tab: Socios (capital_holdings)
// ------------------------------------------------------------
function TabSocios({ entityId }: { entityId: string }) {
  const { data, isLoading } = useCapitalHoldings(entityId);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link
          to={`/secretaria/sociedades/${entityId}/transmision`}
          className="inline-flex items-center gap-1.5 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm font-semibold text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <ArrowRightLeft className="h-3.5 w-3.5" />
          Transmisión
        </Link>
        <Link
          to={`/secretaria/sociedades/${entityId}/socio/nuevo`}
          className="inline-flex items-center gap-1.5 bg-[var(--g-brand-3308)] px-3 py-2 text-sm font-semibold text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <UserPlus className="h-3.5 w-3.5" />
          Añadir socio
        </Link>
      </div>
    <Table
      isLoading={isLoading}
      empty="Sin socios registrados."
      headers={["Socio", "Clase", "Títulos", "% Capital", "Voto", "Autocartera"]}
    >
      {(data ?? []).map((h) => (
        <tr key={h.id} className="hover:bg-[var(--g-surface-subtle)]/50">
          <td className="px-6 py-3 text-sm text-[var(--g-text-primary)]">
            <div className="font-semibold">{h.holder?.denomination ?? h.holder?.full_name ?? "—"}</div>
            <div className="text-xs text-[var(--g-text-secondary)]">
              {h.holder?.tax_id ?? "—"} · {h.holder?.person_type ?? "?"}
            </div>
          </td>
          <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">
            {h.share_class ? `${h.share_class.class_code} — ${h.share_class.name}` : "—"}
          </td>
          <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">
            {Number(h.numero_titulos).toLocaleString()}
          </td>
          <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">
            {h.porcentaje_capital != null ? `${Number(h.porcentaje_capital).toFixed(2)}%` : "—"}
          </td>
          <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">{h.voting_rights ? "Sí" : "No"}</td>
          <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">
            {h.is_treasury ? (
              <span className="inline-flex items-center rounded-full bg-[var(--g-surface-muted)] px-2 py-0.5 text-[10px]">
                Autocartera
              </span>
            ) : (
              "—"
            )}
          </td>
        </tr>
      ))}
    </Table>
    </div>
  );
}

// ------------------------------------------------------------
// Tab: Órganos
// ------------------------------------------------------------
function TabOrganos({ entityId }: { entityId: string }) {
  const { data, isLoading } = useEntityBodies(entityId);
  return (
    <Table isLoading={isLoading} empty="Sin órganos." headers={["Órgano", "Tipo", "Slug"]}>
      {(data ?? []).map((b) => (
        <tr key={b.id} className="hover:bg-[var(--g-surface-subtle)]/50">
          <td className="px-6 py-3 text-sm font-semibold text-[var(--g-text-primary)]">
            <Link
              to={`/organos/${b.slug}`}
              className="hover:text-[var(--g-brand-3308)]"
            >
              {b.name}
            </Link>
          </td>
          <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">{b.body_type}</td>
          <td className="px-6 py-3 text-xs text-[var(--g-text-secondary)]">{b.slug}</td>
        </tr>
      ))}
    </Table>
  );
}

// ------------------------------------------------------------
// Tab: Admins (no colegiados)
// ------------------------------------------------------------
function TabAdmins({ entityId }: { entityId: string }) {
  const { data, isLoading } = useAdministradores(entityId);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <Link
          to={`/secretaria/sociedades/${entityId}/admin/nuevo`}
          className="inline-flex items-center gap-1.5 bg-[var(--g-brand-3308)] px-3 py-2 text-sm font-semibold text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <UserCheck className="h-3.5 w-3.5" />
          Designar administrador
        </Link>
      </div>
    <Table
      isLoading={isLoading}
      empty="Sin administradores no colegiados."
      headers={["Persona", "Cargo", "Desde", "Fuente", "RM"]}
    >
      {(data ?? []).map((c) => (
        <tr key={c.id} className="hover:bg-[var(--g-surface-subtle)]/50">
          <td className="px-6 py-3 text-sm text-[var(--g-text-primary)]">
            <div className="font-semibold">{c.person?.denomination ?? c.person?.full_name ?? "—"}</div>
            <div className="text-xs text-[var(--g-text-secondary)]">{c.person?.tax_id ?? "—"}</div>
          </td>
          <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">
            {CARGO_LABELS[c.tipo_condicion] ?? c.tipo_condicion}
          </td>
          <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">{c.fecha_inicio}</td>
          <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">
            {c.fuente_designacion ?? "—"}
          </td>
          <td className="px-6 py-3 text-xs text-[var(--g-text-secondary)]">
            {c.inscripcion_rm_referencia ?? "—"}
          </td>
        </tr>
      ))}
    </Table>
    </div>
  );
}

// ------------------------------------------------------------
// Tab: Representaciones
// ------------------------------------------------------------
function TabRepresentaciones({ entityId }: { entityId: string }) {
  const { data, isLoading } = useRepresentaciones(entityId);
  return (
    <Table
      isLoading={isLoading}
      empty="Sin representaciones vigentes."
      headers={["Ámbito", "Representado", "Representante", "% Deleg.", "Desde"]}
    >
      {(data ?? []).map((r) => (
        <tr key={r.id} className="hover:bg-[var(--g-surface-subtle)]/50">
          <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">
            <span className="inline-flex items-center rounded-full bg-[var(--g-sec-100)] px-2 py-0.5 text-[10px] font-medium text-[var(--g-brand-3308)]">
              {SCOPE_LABELS[r.scope] ?? r.scope}
            </span>
          </td>
          <td className="px-6 py-3 text-sm text-[var(--g-text-primary)]">
            {r.represented?.full_name ?? "—"}
          </td>
          <td className="px-6 py-3 text-sm text-[var(--g-text-primary)]">
            {r.representative?.full_name ?? "—"}
          </td>
          <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">
            {r.porcentaje_delegado != null ? `${Number(r.porcentaje_delegado).toFixed(2)}%` : "—"}
          </td>
          <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">{r.effective_from}</td>
        </tr>
      ))}
    </Table>
  );
}

// ------------------------------------------------------------
// Tab: Autoridad (authority_evidence)
// ------------------------------------------------------------
function TabAutoridad({ entityId }: { entityId: string }) {
  const { data, isLoading } = useAuthorityEvidence(entityId);
  return (
    <Table
      isLoading={isLoading}
      empty="Sin evidencias de autoridad vigentes."
      headers={["Persona", "Cargo", "Órgano", "Fuente", "Desde", "Inscripción RM"]}
    >
      {(data ?? []).map((a) => (
        <tr key={a.id} className="hover:bg-[var(--g-surface-subtle)]/50">
          <td className="px-6 py-3 text-sm font-semibold text-[var(--g-text-primary)]">
            {a.person?.full_name ?? "—"}
          </td>
          <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">
            <span className="inline-flex items-center rounded-full bg-[var(--g-sec-100)] px-2 py-0.5 text-[10px] font-medium text-[var(--g-brand-3308)]">
              {CARGO_CERT_LABELS[a.cargo] ?? a.cargo}
            </span>
          </td>
          <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">{a.body?.name ?? "—"}</td>
          <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">{a.fuente_designacion}</td>
          <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">{a.fecha_inicio}</td>
          <td className="px-6 py-3 text-xs text-[var(--g-text-secondary)]">
            {a.inscripcion_rm_referencia ?? "—"}
          </td>
        </tr>
      ))}
    </Table>
  );
}

// ------------------------------------------------------------
// Helper table
// ------------------------------------------------------------
function Table({
  isLoading,
  empty,
  headers,
  children,
}: {
  isLoading: boolean;
  empty: string;
  headers: string[];
  children: React.ReactNode;
}) {
  const rowCount = Array.isArray(children) ? children.length : 0;
  return (
    <div
      className="overflow-hidden border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <table className="w-full">
        <thead>
          <tr className="bg-[var(--g-surface-subtle)]">
            {headers.map((h) => (
              <th
                key={h}
                className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--g-border-subtle)]">
          {isLoading ? (
            <tr>
              <td colSpan={headers.length} className="px-6 py-8 text-center text-sm text-[var(--g-text-secondary)]">
                Cargando…
              </td>
            </tr>
          ) : rowCount === 0 ? (
            <tr>
              <td colSpan={headers.length} className="px-6 py-8 text-center text-sm text-[var(--g-text-secondary)]">
                {empty}
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}
