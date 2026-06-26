import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Building2, ChevronLeft, Coins, Layers, Users, Gavel, UserCheck,
  ShieldCheck, Scroll, UserPlus, ArrowRightLeft, BookOpen,
  Bell, CalendarDays, CheckCircle2, ClipboardList, FileText,
  Landmark, Route, ScrollText, Scale, GitBranch, HelpCircle, FileCheck2,
  AlertTriangle,
} from "lucide-react";
import { useSecretariaScope } from "@/components/secretaria/shell";
import { useSociedad } from "@/hooks/useSociedades";
import { useCapitalProfile, useShareClasses } from "@/hooks/useCapitalProfile";
import { useCapitalHoldings } from "@/hooks/useCapitalHoldings";
import { useAdministradoresSocietarios, CARGO_LABELS } from "@/hooks/useCargos";
import { useEntityBodies } from "@/hooks/useEntities";
import { useCloseRepresentacionPuntual, useRepresentaciones, SCOPE_LABELS } from "@/hooks/useRepresentacionesCanonical";
import { useAuthorityEvidence, CARGO_CERT_LABELS } from "@/hooks/useAuthorityEvidence";
import { useEntityNormativeProfile } from "@/hooks/useNormativeFramework";
import { useMateriaCatalogoSocietario } from "@/hooks/useMesaControlSocietaria";
import { useEffectiveRuleMatrix } from "@/hooks/useNormativeGovernance";
import { useReglasAplicables } from "@/hooks/useReglasAplicables";
import { RmStatusChip } from "@/components/secretaria/RmStatusChip";
import { buildNormativeMatrixRows, displaySocietyLegalForm } from "@/lib/secretaria/mesa-control-societaria";
import type { TipoCondicionCargo } from "@/lib/secretaria/cargo-validation";
import { isAuthorityRole } from "@/lib/secretaria/cargo-validation";
import type { EntityNormativeProfile, NormativeFrameworkStatus } from "@/lib/secretaria/normative-framework";

type TabId =
  | "perfil"
  | "capital"
  | "socios"
  | "organos"
  | "admins"
  | "representaciones"
  | "autoridad"
  | "marco";

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "perfil",           label: "Perfil",              icon: Building2 },
  { id: "capital",          label: "Capital",             icon: Coins },
  { id: "socios",           label: "Socios",              icon: Users },
  { id: "organos",          label: "Órganos",             icon: Gavel },
  { id: "admins",           label: "Administradores",     icon: UserCheck },
  { id: "representaciones", label: "Representaciones",    icon: Scroll },
  { id: "autoridad",        label: "Autoridad",           icon: ShieldCheck },
  { id: "marco",            label: "Marco normativo",     icon: Scale },
];

function tipoSocialLabel(value: string | null | undefined, jurisdiction?: string | null, legalForm?: string | null) {
  if (!value) return "Tipo social pendiente";
  if (jurisdiction && jurisdiction !== "ES") {
    return displaySocietyLegalForm({ jurisdiction, tipoSocial: value, legalForm });
  }
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
    socialLabel: tipoSocialLabel(s.tipo_social ?? s.legal_form, s.jurisdiction, s.legal_form),
    adminFlow,
    juntaFlow,
    evidenceFlow,
    facts: [
      { label: "Tipo social", value: tipoSocialLabel(s.tipo_social ?? s.legal_form, s.jurisdiction, s.legal_form) },
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
            {s.legal_name} · {fiscalId(s)} · {s.jurisdiction ?? "—"}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <SociedadBadge label={model.socialLabel} />
            <SociedadBadge label={model.admin} />
            {s.es_unipersonal ? <SociedadBadge label="Unipersonal" tone="accent" /> : null}
            {s.es_cotizada ? <SociedadBadge label="Cotizada" tone="accent" /> : null}
            {s.onboarding_status ? <SociedadOnboardingBadge status={s.onboarding_status} /> : null}
          </div>
        </div>
        <Link
          to={`/secretaria/catalogo-materias?entity=${s.id}`}
          className="inline-flex shrink-0 items-center gap-1.5 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm font-semibold text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <BookOpen className="h-3.5 w-3.5" />
          Materias y reglas
        </Link>
      </div>

      {s.onboarding_status && s.onboarding_status !== "OPERATIVA" ? (
        <div
          className="mb-5 flex items-start gap-3 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4 text-sm text-[var(--g-text-secondary)]"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-warning)]" />
          <div>
            <p className="font-semibold text-[var(--g-text-primary)]">
              Alta pendiente: {onboardingStatusLabel(s.onboarding_status)}
            </p>
            <p className="mt-1">
              La ficha existe y es navegable, pero todavía quedan datos o cargos iniciales por completar antes de tratarla como operativa.
            </p>
          </div>
        </div>
      ) : null}

      <SociedadOperationalOverview entityId={s.id} s={s} model={model} />

      <SociedadDecisionModel s={s} model={model} />

      <SociedadNormativeOverview entityId={s.id} onOpen={() => setTab("marco")} />

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
        {tab === "socios"           && <TabSocios entityId={s.id} />}
        {tab === "organos"          && <TabOrganos entityId={s.id} />}
        {tab === "admins"           && <TabAdmins entityId={s.id} />}
        {tab === "representaciones" && <TabRepresentaciones entityId={s.id} />}
        {tab === "autoridad"        && <TabAutoridad entityId={s.id} />}
        {tab === "marco"            && <TabMarcoNormativo entityId={s.id} />}
      </div>
    </div>
  );
}

function normativeStatusClass(status: NormativeFrameworkStatus | null | undefined) {
  if (status === "COMPLETO") return "bg-[var(--status-success)] text-[var(--g-text-inverse)]";
  if (status === "CONFLICTO") return "bg-[var(--status-error)] text-[var(--g-text-inverse)]";
  if (status === "DESACTUALIZADO") return "bg-[var(--status-warning)] text-[var(--g-text-inverse)]";
  return "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]";
}

function NormativeStatusBadge({ status }: { status: NormativeFrameworkStatus | null | undefined }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold ${normativeStatusClass(status)}`}
      style={{ borderRadius: "var(--g-radius-full)" }}
    >
      {status ?? "PENDIENTE"}
    </span>
  );
}

function sourceLabel(source: string) {
  if (source === "LEY") return "Ley";
  if (source === "ESTATUTOS") return "Estatutos";
  if (source === "REGLAMENTO") return "Reglamento";
  if (source === "PACTO") return "Pacto parasocial";
  return source;
}

function SociedadNormativeOverview({ entityId, onOpen }: { entityId: string; onOpen: () => void }) {
  const { data: profile, isLoading } = useEntityNormativeProfile(entityId);
  const activeSources = profile?.sources.filter((source) => source.status === "ACTIVE").length ?? 0;
  const sourceLayers = profile
    ? Array.from(new Set(profile.sources.map((source) => source.layer))).join(" · ")
    : "—";

  return (
    <section
      className="mb-5 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-5"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <Scale className="mt-0.5 h-5 w-5 shrink-0 text-[var(--g-brand-3308)]" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">
                Marco normativo societario
              </h2>
              <NormativeStatusBadge status={profile?.status ?? (isLoading ? undefined : "INCOMPLETO")} />
            </div>
            <p className="mt-1 text-sm leading-6 text-[var(--g-text-secondary)]">
              Cada acuerdo queda anclado a fuentes legales, estatutos, pactos, reglamentos y
              requisitos de formalización. Fuentes activas: {activeSources}.
            </p>
            <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
              {sourceLayers}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex items-center justify-center gap-1.5 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm font-semibold text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <GitBranch className="h-3.5 w-3.5" />
          Ver ancla normativa
        </button>
      </div>
    </section>
  );
}

function TabMarcoNormativo({ entityId }: { entityId: string }) {
  const { data: profile, isLoading, error } = useEntityNormativeProfile(entityId);
  const { data: reglas = [], isLoading: reglasLoading } = useReglasAplicables(entityId);
  const { data: effectiveMatrix = [], isLoading: matrixLoading } = useEffectiveRuleMatrix(entityId);

  if (isLoading) return <div className="p-4 text-sm text-[var(--g-text-secondary)]">Cargando marco normativo…</div>;
  if (error) {
    return (
      <div className="p-4 text-sm text-[var(--status-error)]">
        No se pudo cargar el marco normativo.
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="p-4 text-sm text-[var(--g-text-secondary)]">
        No hay perfil normativo proyectable para esta sociedad.
      </div>
    );
  }

  return (
    <NormativeFrameworkPanel
      profile={profile}
      reglas={reglas}
      reglasLoading={reglasLoading || matrixLoading}
      effectiveMatrix={effectiveMatrix}
    />
  );
}

function NormativeFrameworkPanel({
  profile,
  reglas,
  reglasLoading,
  effectiveMatrix,
}: {
  profile: EntityNormativeProfile;
  reglas: NonNullable<ReturnType<typeof useReglasAplicables>["data"]>;
  reglasLoading: boolean;
  effectiveMatrix: NonNullable<ReturnType<typeof useEffectiveRuleMatrix>["data"]>;
}) {
  const ruleRows = reglas.filter((rule) => rule.source === "LEY" && rule.materia && rule.materia !== "GENERAL");
  const { data: materias = [], isLoading: materiasLoading } = useMateriaCatalogoSocietario();
  const sourceByMateria = reglas.reduce<Record<string, Set<string>>>((acc, rule) => {
    if (!rule.materia || rule.materia === "GENERAL") return acc;
    acc[rule.materia] = acc[rule.materia] ?? new Set<string>();
    acc[rule.materia].add(sourceLabel(rule.source));
    return acc;
  }, {});
  const matrixRows = buildNormativeMatrixRows(materias, { tipoSocial: profile.company_form })
    .map((row) => ({
      ...row,
      formalizacion: `${row.notaria} · ${row.registro} · ${row.publicacion} · ${row.plazos}`,
      fuente: sourceByMateria[row.materia] ? Array.from(sourceByMateria[row.materia]).join(" · ") : row.fuente,
    }));
  const persistedRows = effectiveMatrix.map((row) => ({
    materia: row.matter_code,
    label: row.matter_code.split("_").map((part) => part.charAt(0) + part.slice(1).toLowerCase()).join(" "),
    organo: row.organo_tipo,
    mayoria: row.majority_rule,
    quorum: row.quorum_rule,
    documentos: row.documents_required.join(", "),
    formalizacion: [
      row.formalization?.notary_required ? "Escritura pública" : "Sin escritura",
      row.formalization?.registry_required ? "Inscripción requerida" : "No inscribible",
      row.formalization?.publication_required ? "Publicación requerida" : "Sin publicación",
    ].join(" · "),
    fuente: row.source_layers.map((source) => source.reference ?? source.type ?? "Fuente").join(" · "),
  }));
  return (
    <div
      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-6"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-[var(--g-text-primary)]">Ancla normativa de sociedad</h2>
            <NormativeStatusBadge status={profile.status} />
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--g-text-secondary)]">
            {profile.jurisdiction ?? "sin jurisdicción"} · {profile.company_form ?? "sin tipo social"} ·
            versión del perfil {profile.profile_version}
          </p>
        </div>
        <div className="text-right text-xs text-[var(--g-text-secondary)]">
          <div>Fuentes: {profile.sources.length}</div>
          <div>Normativa base: {profile.rule_trace.rule_pack_version_ids.length}</div>
          <div>Pactos: {profile.rule_trace.pacto_ids.length}</div>
        </div>
      </div>

      {(profile.blockers.length > 0 || profile.warnings.length > 0) && (
        <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <NormativeNotice title="Bloqueos" items={profile.blockers} empty="Sin bloqueos estructurales." tone="error" />
          <NormativeNotice title="Advertencias" items={profile.warnings} empty="Sin advertencias." tone="warning" />
        </div>
      )}

      <div className="mt-6 overflow-hidden border border-[var(--g-border-subtle)]" style={{ borderRadius: "var(--g-radius-md)" }}>
        <table className="min-w-full divide-y divide-[var(--g-border-subtle)]">
          <thead>
            <tr className="bg-[var(--g-surface-subtle)]">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--g-text-primary)]">Prioridad</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--g-text-primary)]">Fuente</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--g-text-primary)]">Plano</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--g-text-primary)]">Referencia</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--g-text-primary)]">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--g-border-subtle)]">
            {profile.sources.map((source) => (
              <tr key={source.id} className="hover:bg-[var(--g-surface-subtle)]/50">
                <td className="px-4 py-3 text-sm text-[var(--g-text-secondary)]">{source.priority}</td>
                <td className="px-4 py-3">
                  <div className="text-sm font-semibold text-[var(--g-text-primary)]">{source.layer}</div>
                  <div className="text-xs text-[var(--g-text-secondary)]">{source.label}</div>
                </td>
                <td className="px-4 py-3 text-sm text-[var(--g-text-secondary)]">{source.plane}</td>
                <td className="px-4 py-3 text-sm text-[var(--g-text-secondary)]">
                  {source.reference ?? source.materia ?? "—"}
                </td>
                <td className="px-4 py-3 text-sm text-[var(--g-text-secondary)]">{source.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6">
        <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[var(--g-text-primary)]">
              Matriz materia × requisitos
            </h3>
            <p className="mt-1 max-w-4xl text-sm leading-6 text-[var(--g-text-secondary)]">
              Proyección práctica de lo que puede tratar la sociedad: órgano competente,
              mayoría, quórum, documentos obligatorios, formalización, inscripción y fuente aplicable.
            </p>
          </div>
          <span
            className="inline-flex items-center gap-1.5 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm font-semibold text-[var(--g-text-primary)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            {matrixRows.length || ruleRows.length} materias configuradas
          </span>
        </div>
        <Table
          isLoading={reglasLoading || materiasLoading}
          empty="Sin materias societarias configuradas."
          headers={["Materia", "Órgano", "Mayoría", "Quórum", "Documentos", "Formalización", "Fuente"]}
        >
          {(persistedRows.length > 0 ? persistedRows : matrixRows.length > 0 ? matrixRows : ruleRows.map((rule) => ({
            materia: rule.materia ?? "—",
            label: rule.materia ?? "—",
            organo: rule.organo_tipo ?? "—",
            mayoria: "Según ley y estatutos",
            quorum: "Según ley y estatutos",
            documentos: rule.note ?? "—",
            formalizacion: "Según materia",
            fuente: sourceLabel(rule.source),
          }))).slice(0, 18).map((row) => (
            <tr key={`${row.materia}-${row.fuente}`} className="hover:bg-[var(--g-surface-subtle)]/50">
              <td className="px-6 py-3 text-sm font-semibold text-[var(--g-text-primary)]">{row.label}</td>
              <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">{row.organo}</td>
              <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">{row.mayoria}</td>
              <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">{row.quorum}</td>
              <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">{row.documentos}</td>
              <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">{row.formalizacion}</td>
              <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">{row.fuente}</td>
            </tr>
          ))}
        </Table>
      </div>
    </div>
  );
}

function NormativeNotice({
  title,
  items,
  empty,
  tone,
}: {
  title: string;
  items: string[];
  empty: string;
  tone: "warning" | "error";
}) {
  const markerClass = tone === "error" ? "bg-[var(--status-error)]" : "bg-[var(--status-warning)]";
  return (
    <div className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4" style={{ borderRadius: "var(--g-radius-md)" }}>
      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--g-text-primary)]">
        <span className={`h-2 w-2 ${markerClass}`} style={{ borderRadius: "var(--g-radius-full)" }} />
        {title}
      </div>
      <ul className="mt-2 space-y-1 text-sm text-[var(--g-text-secondary)]">
        {(items.length > 0 ? items : [empty]).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
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

function onboardingStatusLabel(status: string | null | undefined) {
  if (!status) return "Sin estado";
  return (
    {
      OPERATIVA: "Operativa",
      INCOMPLETA_CARGOS: "Incompleta: cargos",
      INCOMPLETA_DATOS: "Incompleta: datos",
      BORRADOR: "Borrador",
    } as Record<string, string>
  )[status] ?? status.replace(/_/g, " ");
}

function onboardingStatusClass(status: string | null | undefined) {
  if (status === "OPERATIVA") return "bg-[var(--status-success)] text-[var(--g-text-inverse)]";
  if (status === "INCOMPLETA_DATOS" || status === "INCOMPLETA_CARGOS") {
    return "bg-[var(--status-warning)] text-[var(--g-text-inverse)]";
  }
  return "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]";
}

function SociedadOnboardingBadge({ status }: { status: string | null | undefined }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold ${onboardingStatusClass(status)}`}
      style={{ borderRadius: "var(--g-radius-full)" }}
    >
      {onboardingStatusLabel(status)}
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
  const { data: administradores = [] } = useAdministradoresSocietarios(entityId);
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
    { label: "Informes", icon: FileText, to: `/secretaria/informes?entity=${entityId}` },
    { label: "Certificaciones", icon: FileCheck2, to: `/secretaria/certificaciones?entity=${entityId}` },
    { label: "Materias y reglas", icon: ClipboardList, to: `/secretaria/catalogo-materias?entity=${entityId}` },
    { label: "Activar marco", icon: Scale, to: `/secretaria/sociedades/${entityId}/marco-normativo/activar` },
  ];

  return (
    <section className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-4 xl:grid-cols-8">
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
function FieldHint({ text }: { text: string }) {
  return (
    <span
      className="inline-flex items-center text-[var(--g-text-secondary)]"
      title={text}
      aria-label={text}
    >
      <HelpCircle className="h-3.5 w-3.5" />
    </span>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-ES");
}

function formatVigencia(from: string | null | undefined, to: string | null | undefined) {
  return `${formatDate(from)} → ${to ? formatDate(to) : "vigente"}`;
}

function fiscalId(s: NonNullable<ReturnType<typeof useSociedad>["data"]>) {
  return s.person?.tax_id ?? s.registration_number ?? "—";
}

function domicilioSociedad(s: NonNullable<ReturnType<typeof useSociedad>["data"]>) {
  if (s.address) return s.address;
  const parts = [
    s.address_street,
    s.address_number,
    s.address_floor,
    s.postal_code,
    s.city,
    s.province,
    s.country,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "—";
}

function registroMercantil(s: NonNullable<ReturnType<typeof useSociedad>["data"]>) {
  const parts = [
    s.registry_location,
    s.registry_volume ? `Tomo ${s.registry_volume}` : "",
    s.registry_folio ? `Folio ${s.registry_folio}` : "",
    s.registry_sheet ? `Hoja ${s.registry_sheet}` : "",
    s.registry_inscription ? `Inscripcion ${s.registry_inscription}` : "",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : s.registration_number ?? "—";
}

function bodyTypeLabel(bodyType: string | null | undefined) {
  const value = String(bodyType ?? "").toUpperCase();
  if (value === "JUNTA") return "Junta general";
  if (value === "CDA" || value === "CONSEJO") return "Consejo de administración";
  if (value === "COMISION") return "Comisión del Consejo";
  if (value === "COMITE") return "Comité";
  return bodyType ?? "—";
}

function technicalValue(value: React.ReactNode) {
  return <code className="text-xs text-[var(--g-text-secondary)]">{value}</code>;
}

function TabPerfil({ id, s }: { id: string; s: NonNullable<ReturnType<typeof useSociedad>["data"]> }) {
  const fields: Array<{ label: string; value: React.ReactNode; help: string; technical?: boolean }> = [
    {
      label: "Denominación social",
      value: s.legal_name,
      help: "Nombre jurídico que se usa en convocatorias, actas, certificaciones y expedientes.",
    },
    {
      label: "NIF / CIF",
      value: fiscalId(s),
      help: "Identificador fiscal de la persona jurídica canónica en persons.",
    },
    {
      label: "Domicilio social",
      value: domicilioSociedad(s),
      help: "Domicilio estructurado informado durante el alta D6.",
    },
    {
      label: "LEI",
      value: s.lei_code ?? "—",
      help: "Identificador LEI si aplica a sociedad cotizada o entidad supervisada.",
    },
    {
      label: "CNAE principal",
      value: s.cnae_primary ?? "—",
      help: "Actividad principal usada en perfil societario y documentación.",
    },
    {
      label: "CNAE secundarios",
      value: s.cnae_secondary?.length ? s.cnae_secondary.join(", ") : "—",
      help: "Actividades secundarias declaradas en el alta.",
    },
    {
      label: "Registro Mercantil",
      value: registroMercantil(s),
      help: "Datos registrales estructurados de tomo, folio, hoja e inscripción.",
    },
    {
      label: "Tipo social",
      value: tipoSocialLabel(s.tipo_social ?? s.legal_form),
      help: "Determina órgano competente, quórums, mayorías, convocatorias y plantillas disponibles.",
    },
    {
      label: "Forma jurídica",
      value: s.legal_form ?? "—",
      help: "Literal registral o forma societaria mostrada en documentos.",
    },
    {
      label: "Forma administración",
      value: normalizeAdminForm(s.forma_administracion, s.tipo_organo_admin),
      help: "Decide si el flujo usa Consejo, administrador único, solidarios o mancomunados.",
    },
    {
      label: "Órgano admin.",
      value: s.tipo_organo_admin ?? "—",
      help: "Código funcional normalizado para seleccionar órgano y plantillas. Debe leerse como contrato interno de aplicación.",
    },
    {
      label: "Unipersonal",
      value: s.es_unipersonal ? "Sí" : "No",
      help: "Si es unipersonal, las materias de junta se documentan como decisión del socio único.",
    },
    {
      label: "Cotizada",
      value: s.es_cotizada ? "Sí" : "No",
      help: "Activa especialidades de convocatoria, publicidad, voto a distancia y advertencias LMV/CNMV.",
    },
    {
      label: "Sector regulado",
      value: s.regulated_sector ?? "—",
      help: "Sector regulado declarado para obligaciones y reporting.",
    },
    {
      label: "Rol en grupo",
      value: s.group_role ?? "—",
      help: "Rol societario dentro del grupo: matriz, filial, participada o independiente.",
    },
    {
      label: "Jurisdicción",
      value: s.jurisdiction ?? "—",
      help: "País/ordenamiento usado para resolver el marco normativo.",
    },
    {
      label: "Fecha constitución",
      value: formatDate(s.constitution_date),
      help: "Fecha de constitución persistida en la ficha legal.",
    },
    {
      label: "Fecha registro",
      value: formatDate(s.registration_date),
      help: "Fecha de inscripción registral si se conoce.",
    },
    {
      label: "Duración",
      value: s.duration ?? "—",
      help: "Duración societaria declarada en estatutos.",
    },
    {
      label: "Cierre fiscal",
      value: s.fiscal_year_close ?? "—",
      help: "Día y mes de cierre fiscal en formato DD-MM.",
    },
    {
      label: "Web",
      value: s.website ?? "—",
      help: "Sitio web corporativo declarado.",
    },
    {
      label: "Email corporativo",
      value: s.corporate_email ?? "—",
      help: "Canal corporativo informado para documentación y notificaciones.",
    },
    {
      label: "Estado",
      value: s.entity_status ?? "—",
      help: "Estado operativo de la sociedad dentro del demo.",
    },
    {
      label: "Estado alta",
      value: onboardingStatusLabel(s.onboarding_status),
      help: "Estado derivado del alta D6. Solo se promueve a operativa cuando TX2 confirma cargos y representaciones.",
    },
    {
      label: "Objeto social",
      value: s.corporate_purpose ?? "—",
      help: "Objeto social persistido para plantillas y expedientes.",
    },
    {
      label: "Matriz",
      value: s.parent?.common_name ?? s.parent?.legal_name ?? "—",
      help: "Sociedad matriz directa si está modelada en entities.",
    },
    {
      label: "% Propiedad matriz",
      value: s.ownership_percentage != null ? `${s.ownership_percentage}%` : "—",
      help: "Porcentaje de control directo desde la matriz en el modelo de grupo.",
    },
    {
      label: "PJ canónica",
      value: s.person ? `${s.person.full_name} · ${s.person.tax_id ?? "sin NIF"}` : "—",
      help: "Vínculo técnico a la fila persons que representa la persona jurídica de la sociedad.",
    },
    {
      label: "ID interno",
      value: technicalValue(id),
      help: "UUID técnico de la aplicación. No debe aparecer como dato registral en documentos de negocio.",
      technical: true,
    },
    {
      label: "Slug interno",
      value: technicalValue(s.slug),
      help: "Identificador de URL. Es técnico y no sustituye denominación ni NIF.",
      technical: true,
    },
  ];
  return (
    <div
      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-6"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <div className="mb-5 rounded-lg border border-[var(--g-border-subtle)] bg-[var(--g-sec-100)] p-4 text-sm text-[var(--g-text-primary)]">
        <p className="font-semibold text-[var(--g-brand-3308)]">Ficha maestra para generación documental</p>
        <p className="mt-1 text-[var(--g-text-secondary)]">
          Los campos fiscales, registrales y de perfil legal alimentan Capa 2. Los códigos internos se muestran separados para no mezclarlos con datos societarios.
        </p>
      </div>
      <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {fields.map((field) => (
          <div
            key={field.label}
            className={`flex flex-col gap-0.5 ${field.technical ? "opacity-80" : ""}`}
          >
            <dt className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">
              {field.label}
              <FieldHint text={field.help} />
            </dt>
            <dd className="text-sm text-[var(--g-text-primary)]">{field.value}</dd>
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
  const scope = useSecretariaScope();
  const { data: cap, isLoading } = useCapitalProfile(entityId);
  const { data: classes = [], isLoading: classesLoading } = useShareClasses(entityId);
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
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-3xl text-sm leading-6 text-[var(--g-text-secondary)]">
          Capital social y clases de acciones forman una unidad funcional: el motor usa estas cifras
          para calcular censo, quórum, derechos de voto y mayorías de Junta.
        </div>
        <Link
          to={scope.createScopedTo(`/secretaria/sociedades/${entityId}/transmision`)}
          className="inline-flex items-center gap-1.5 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm font-semibold text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <ArrowRightLeft className="h-3.5 w-3.5" />
          Transmisión
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Kpi label="Capital escriturado" value={`${cap.capital_escriturado.toLocaleString()} ${cap.currency}`} />
        <Kpi label="Capital desembolsado" value={cap.capital_desembolsado ? `${Number(cap.capital_desembolsado).toLocaleString()} ${cap.currency}` : "Pendiente"} sub={pct != null ? `${pct}% de escriturado` : "Debe quedar informado para SA golden path"} />
        <Kpi label="Número de títulos" value={cap.numero_titulos != null ? Number(cap.numero_titulos).toLocaleString() : "—"} />
        <Kpi label="Valor nominal" value={cap.valor_nominal != null ? `${Number(cap.valor_nominal).toLocaleString()} ${cap.currency}` : "—"} />
        <Kpi label="Vigente desde" value={cap.effective_from} />
        <Kpi label="Estado" value={cap.estado} />
      </div>
      <div
        className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--g-text-primary)]">
          <Layers className="h-4 w-4 text-[var(--g-brand-3308)]" />
          Clases de acciones / participaciones
        </div>
        <ShareClassesInlineTable data={classes} isLoading={classesLoading} />
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

function ShareClassesInlineTable({
  data,
  isLoading,
}: {
  data: NonNullable<ReturnType<typeof useShareClasses>["data"]>;
  isLoading: boolean;
}) {
  const preferenceLabel = (restrictions: Record<string, unknown> | null) => {
    if (restrictions?.preferred_dividend !== true) return "—";
    const description = restrictions.preferred_dividend_description;
    return typeof description === "string" && description.trim() ? description : "Dividendo preferente";
  };

  return (
    <Table isLoading={isLoading} empty="Sin clases definidas." headers={["Código", "Nombre", "Votos/título", "Coef. económico", "Preferencia", "Derechos voto", "Veto"]}>
      {(data ?? []).map((c) => (
        <tr key={c.id} className="hover:bg-[var(--g-surface-subtle)]/50">
          <td className="px-6 py-3 text-sm font-semibold text-[var(--g-text-primary)]">{c.class_code}</td>
          <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">{c.name}</td>
          <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">{c.votes_per_title}</td>
          <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">{c.economic_rights_coeff}</td>
          <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">{preferenceLabel(c.restrictions)}</td>
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
  const scope = useSecretariaScope();
  const { data, isLoading } = useCapitalHoldings(entityId);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link
          to={scope.createScopedTo(`/secretaria/sociedades/${entityId}/transmision`)}
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
    {(data ?? []).some((h) => !h.voting_rights && !h.is_treasury) ? (
      <p className="mt-2 text-xs text-[var(--status-warning)]">
        Participación registrada sin derechos de voto computables.
      </p>
    ) : null}
    </div>
  );
}

// ------------------------------------------------------------
// Tab: Órganos
// ------------------------------------------------------------
function TabOrganos({ entityId }: { entityId: string }) {
  const { data, isLoading } = useEntityBodies(entityId);
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-[var(--g-border-subtle)] bg-[var(--g-sec-100)] p-4 text-sm text-[var(--g-text-secondary)]">
        La sociedad debe tener una Junta General y, para esta forma de administración, un único Consejo de Administración.
        Las comisiones y comités son órganos internos o delegados del Consejo; los residuos de pruebas quedan ocultos.
      </div>
    <Table isLoading={isLoading} empty="Sin órganos." headers={["Órgano", "Tipo funcional", "Reglas operativas"]}>
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
          <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">{bodyTypeLabel(b.body_type)}</td>
          <td className="px-6 py-3 text-xs text-[var(--g-text-secondary)]">
            {String(b.config?.organo_tipo ?? b.body_type ?? "—")}
          </td>
        </tr>
      ))}
    </Table>
    </div>
  );
}

// ------------------------------------------------------------
// Tab: Administradores societarios
// ------------------------------------------------------------
function TabAdmins({ entityId }: { entityId: string }) {
  const { data, isLoading } = useAdministradoresSocietarios(entityId);
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-3xl text-sm leading-6 text-[var(--g-text-secondary)]">
          En sociedades administradas por Consejo, esta pestaña muestra la composición vigente del
          Consejo de Administración. En sociedades con administrador único, solidario o mancomunado,
          muestra esos cargos no colegiados.
        </div>
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
      empty="Sin administradores vigentes."
      headers={["Persona", "Cargo", "Órgano", "Vigencia", "Fuente", "RM"]}
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
          <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">
            {c.body?.name ?? "No colegiado"}
          </td>
          <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">
            {formatVigencia(c.fecha_inicio, c.fecha_fin)}
          </td>
          <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">
            {c.fuente_designacion ?? "—"}
          </td>
          <td className="px-6 py-3 text-xs text-[var(--g-text-secondary)]">
            <RmStatusChip
              tipoCondicion={c.tipo_condicion as TipoCondicionCargo}
              referencia={c.inscripcion_rm_referencia}
            />
          </td>
        </tr>
      ))}
    </Table>
    {(data ?? []).some((c) => isAuthorityRole(c.tipo_condicion) && !c.inscripcion_rm_referencia) ? (
      <p className="mt-2 text-xs text-[var(--status-warning)]">
        Cargo vigente pendiente de referencia registral. Puede limitar certificaciones frente a terceros.
      </p>
    ) : null}
    </div>
  );
}

// ------------------------------------------------------------
// Tab: Representaciones
// ------------------------------------------------------------
function TabRepresentaciones({ entityId }: { entityId: string }) {
  const { data, isLoading } = useRepresentaciones(entityId);
  const closeRepresentacion = useCloseRepresentacionPuntual();

  const handleClose = async (id: string) => {
    const ok = window.confirm("Cerrar esta representación puntual sin borrar el histórico?");
    if (!ok) return;
    try {
      await closeRepresentacion.mutateAsync({
        id,
        effective_to: new Date().toISOString().slice(0, 10),
        reason: "Cierre manual desde ficha de sociedad",
      });
      toast.success("Representación cerrada");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo cerrar la representación";
      toast.error(message);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-[var(--g-text-secondary)]">
          Delegaciones vigentes vinculadas a reuniones y representantes permanentes de personas jurídicas.
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            to={`/secretaria/representaciones/nueva?entityId=${entityId}&scope=JUNTA_PROXY`}
            className="inline-flex items-center justify-center gap-2 bg-[var(--g-brand-3308)] px-3 py-2 text-xs font-semibold text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <UserPlus className="h-3.5 w-3.5" />
            Delegación Junta
          </Link>
          <Link
            to={`/secretaria/representaciones/nueva?entityId=${entityId}&scope=CONSEJO_DELEGACION`}
            className="inline-flex items-center justify-center gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-xs font-semibold text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <Scroll className="h-3.5 w-3.5" />
            Delegación Consejo
          </Link>
        </div>
      </div>
      <div className="rounded-lg border border-[var(--g-border-subtle)] bg-[var(--g-sec-100)] p-4 text-sm text-[var(--g-text-secondary)]">
        Esta tabla recoge representaciones permanentes de personas jurídicas y delegaciones puntuales.
        En una representación permanente, el porcentaje indica el alcance representado, no una nueva
        participación económica.
      </div>
    <Table
      isLoading={isLoading}
      empty="Sin representaciones vigentes."
      headers={["Ámbito", "Representado", "Representante", "Alcance", "Vigencia", "Evidencia", "Acciones"]}
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
            {r.porcentaje_delegado != null
              ? `${Number(r.porcentaje_delegado).toFixed(2)}% representado`
              : "Completa / no porcentual"}
          </td>
          <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">
            {formatVigencia(r.effective_from, r.effective_to)}
          </td>
          <td className="px-6 py-3 text-xs text-[var(--g-text-secondary)]">
            {typeof r.evidence?.documento_ref === "string" ? r.evidence.documento_ref : "—"}
          </td>
          <td className="px-6 py-3 text-right text-xs">
            {r.scope === "JUNTA_PROXY" || r.scope === "CONSEJO_DELEGACION" ? (
              <button
                type="button"
                onClick={() => handleClose(r.id)}
                disabled={closeRepresentacion.isPending}
                aria-busy={closeRepresentacion.isPending}
                className="inline-flex items-center border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-2.5 py-1 font-semibold text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)] disabled:pointer-events-none disabled:opacity-50"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                Cerrar
              </button>
            ) : (
              <span className="text-[var(--g-text-secondary)]">—</span>
            )}
          </td>
        </tr>
      ))}
    </Table>
    </div>
  );
}

// ------------------------------------------------------------
// Tab: Autoridad (authority_evidence)
// ------------------------------------------------------------
function TabAutoridad({ entityId }: { entityId: string }) {
  const { data, isLoading } = useAuthorityEvidence(entityId);
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-[var(--g-border-subtle)] bg-[var(--g-sec-100)] p-4 text-sm text-[var(--g-text-secondary)]">
        Autoridad no es la lista completa de miembros del órgano. Es la evidencia de cargos con
        capacidad para firmar, certificar, dar Vº Bº o representar la sociedad en el pipeline documental.
        La composición completa está en Órganos y Administradores.
      </div>
    <Table
      isLoading={isLoading}
      empty="Sin evidencias de autoridad vigentes."
      headers={["Persona", "Cargo certificante", "Órgano", "Fuente", "Vigencia", "Inscripción RM"]}
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
          <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">
            {formatVigencia(a.fecha_inicio, a.fecha_fin)}
          </td>
          <td className="px-6 py-3 text-xs text-[var(--g-text-secondary)]">
            <RmStatusChip
              tipoCondicion={a.cargo as TipoCondicionCargo}
              referencia={a.inscripcion_rm_referencia}
            />
          </td>
        </tr>
      ))}
    </Table>
    </div>
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
