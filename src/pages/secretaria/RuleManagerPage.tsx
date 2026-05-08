import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  BookMarked,
  CheckCircle2,
  ChevronLeft,
  Gavel,
  PauseCircle,
  Scale,
  Shield,
  ShieldAlert,
  Users,
  XCircle,
} from "lucide-react";
import { useSociedades } from "@/hooks/useSociedades";
import { useRulePacks } from "@/hooks/useRulePacks";
import {
  useAgreementRulePreview,
  useRuleManagerProfile,
  type AgreementRulePreviewInput,
} from "@/hooks/useRuleManager";
import type {
  EffectiveAgreementRule,
  EffectiveRuleConsequence,
  LegalConsequence,
} from "@/lib/secretaria/rule-manager-contract";
import type { PactoParasocial } from "@/lib/rules-engine/pactos-engine";

// ── Catálogo de materias y modos de adopción para el simulador ─────────────

type MatterEntry = {
  matter: string;
  label: string;
  matter_class: "ORDINARIA" | "ESTATUTARIA" | "ESTRUCTURAL";
  inscribable: boolean;
};

const MATTER_DEFAULTS: MatterEntry[] = [
  { matter: "APROBACION_CUENTAS", label: "Aprobación de cuentas anuales", matter_class: "ORDINARIA", inscribable: false },
  { matter: "DELEGACION_FACULTADES", label: "Delegación de facultades", matter_class: "ORDINARIA", inscribable: true },
  { matter: "NOMBRAMIENTO_CONSEJERO", label: "Nombramiento de consejero", matter_class: "ORDINARIA", inscribable: true },
  { matter: "CESE_CONSEJERO", label: "Cese de consejero", matter_class: "ORDINARIA", inscribable: true },
  { matter: "NOMBRAMIENTO_AUDITOR", label: "Nombramiento de auditor", matter_class: "ORDINARIA", inscribable: true },
  { matter: "MODIFICACION_ESTATUTOS", label: "Modificación de estatutos", matter_class: "ESTATUTARIA", inscribable: true },
  { matter: "AUMENTO_CAPITAL", label: "Aumento de capital", matter_class: "ESTRUCTURAL", inscribable: true },
  { matter: "REDUCCION_CAPITAL", label: "Reducción de capital", matter_class: "ESTRUCTURAL", inscribable: true },
  { matter: "FUSION", label: "Fusión", matter_class: "ESTRUCTURAL", inscribable: true },
  { matter: "ESCISION", label: "Escisión", matter_class: "ESTRUCTURAL", inscribable: true },
  { matter: "DISOLUCION", label: "Disolución", matter_class: "ESTRUCTURAL", inscribable: true },
  { matter: "TRANSFORMACION", label: "Transformación", matter_class: "ESTRUCTURAL", inscribable: true },
];

function humanizeMatter(slug: string) {
  return slug
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function mergeMattersWithRulePacks(
  defaults: MatterEntry[],
  rulePackMatters: Array<{ materia?: string }>,
): MatterEntry[] {
  const byMatter = new Map(defaults.map((m) => [m.matter, m]));
  for (const pack of rulePackMatters) {
    if (!pack.materia || byMatter.has(pack.materia)) continue;
    byMatter.set(pack.materia, {
      matter: pack.materia,
      label: humanizeMatter(pack.materia),
      // Defaults seguros para materias del rule pack que no están en hardcoded.
      // Legal puede ajustar con el dropdown de matter_class si lo añadimos en el futuro.
      matter_class: "ESTATUTARIA",
      inscribable: true,
    });
  }
  return Array.from(byMatter.values()).sort((a, b) => a.label.localeCompare(b.label));
}

const ADOPTION_MODES: Array<{ value: string; label: string }> = [
  { value: "MEETING", label: "Acuerdo en sesión" },
  { value: "UNIVERSAL", label: "Junta universal" },
  { value: "NO_SESSION", label: "Acuerdo sin sesión" },
  { value: "CO_APROBACION", label: "Co-aprobación de administradores" },
  { value: "SOLIDARIO", label: "Decisión de administrador solidario" },
  { value: "UNIPERSONAL_SOCIO", label: "Decisión de socio único" },
  { value: "UNIPERSONAL_ADMIN", label: "Decisión de administrador único" },
];

// ── Tabla de consecuencias jurídicas a etiqueta humana ─────────────────────

const CONSEQUENCE_META: Record<
  LegalConsequence,
  { label: string; tone: "block" | "breach" | "hold" | "warning" | "ok"; description: string }
> = {
  VALIDITY_BLOCK: {
    label: "Bloqueo societario",
    tone: "block",
    description: "El acuerdo no podría proclamarse válidamente sin remediar la causa.",
  },
  CONTRACTUAL_BREACH: {
    label: "Incumplimiento contractual",
    tone: "breach",
    description: "El acuerdo es válido societariamente pero rompe un pacto.",
  },
  OPERATIONAL_HOLD: {
    label: "Hold operativo",
    tone: "hold",
    description: "Parar ejecución/registro hasta obtener waiver o consentimiento.",
  },
  WARNING: {
    label: "Advertencia",
    tone: "warning",
    description: "Información a tener en cuenta sin bloqueo automático.",
  },
  NO_EFFECT: {
    label: "Sin efecto",
    tone: "ok",
    description: "La fuente no aplica al acuerdo evaluado.",
  },
};

const CONSEQUENCE_TONE_CLASS: Record<typeof CONSEQUENCE_META[LegalConsequence]["tone"], string> = {
  block:
    "bg-[var(--status-error)] text-[var(--g-text-inverse)] border border-[var(--status-error)]",
  breach:
    "bg-[var(--status-warning)] text-[var(--g-text-inverse)] border border-[var(--status-warning)]",
  hold:
    "bg-[var(--g-surface-subtle)] text-[var(--g-text-primary)] border border-[var(--g-border-default)]",
  warning:
    "bg-[var(--g-sec-100)] text-[var(--g-text-primary)] border border-[var(--g-border-subtle)]",
  ok:
    "bg-[var(--g-surface-card)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]",
};

const STATUS_TONE: Record<EffectiveAgreementRule["status"], { label: string; chip: string }> = {
  PROCLAMABLE_AND_EXECUTABLE: {
    label: "Proclamable y ejecutable",
    chip: "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  },
  PROCLAMABLE_HELD: {
    label: "Proclamable con hold/breach",
    chip: "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  },
  BLOCKED: {
    label: "Bloqueado societariamente",
    chip: "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
  },
};

// ── Componente principal ────────────────────────────────────────────────────

export default function RuleManagerPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const entityId = searchParams.get("entity");
  const initialMatter = searchParams.get("matter") ?? "MODIFICACION_ESTATUTOS";
  const initialAdoption = searchParams.get("adoption") ?? "MEETING";

  const sociedadesQuery = useSociedades();
  const rulePacksQuery = useRulePacks();
  const [matter, setMatter] = useState<string>(initialMatter);
  const [adoptionMode, setAdoptionMode] = useState<string>(initialAdoption);

  // Hipótesis de votación / waivers / consentimientos / estatutarización.
  // Por defecto el simulador trabaja en modo PRE_VOTE (sin cifras de votación).
  const [skipVotes, setSkipVotes] = useState<boolean>(true);
  const [capitalPresenteRaw, setCapitalPresenteRaw] = useState<string>("");
  const [votosFavorRaw, setVotosFavorRaw] = useState<string>("");
  const [vetoRenunciado, setVetoRenunciado] = useState<Set<string>>(new Set());
  const [consentimientosPrevios, setConsentimientosPrevios] = useState<Set<string>>(new Set());
  const [statutoryPactoIds, setStatutoryPactoIds] = useState<Set<string>>(new Set());

  // Materias: hardcoded defaults + materias únicas de rule packs activos en Cloud.
  const matters = useMemo(
    () => mergeMattersWithRulePacks(MATTER_DEFAULTS, rulePacksQuery.data ?? []),
    [rulePacksQuery.data],
  );
  const matterMeta = matters.find((m) => m.matter === matter) ?? matters[0] ?? MATTER_DEFAULTS[0];
  const matterUnknown = !matters.find((m) => m.matter === matter);

  const profileQuery = useRuleManagerProfile(entityId ?? undefined);
  const pactosVigentes = profileQuery.pactos;

  const previewInput: AgreementRulePreviewInput = {
    entityId: entityId ?? undefined,
    matter,
    matterClass: matterMeta.matter_class,
    adoptionMode,
    inscribable: matterMeta.inscribable,
    pactosEval: skipVotes
      ? {
          skipVoteDependentEvaluations: true,
          vetoRenunciado: Array.from(vetoRenunciado),
          consentimientosPrevios: Array.from(consentimientosPrevios),
        }
      : {
          capitalPresente: Number(capitalPresenteRaw) || 0,
          votosFavor: Number(votosFavorRaw) || 0,
          vetoRenunciado: Array.from(vetoRenunciado),
          consentimientosPrevios: Array.from(consentimientosPrevios),
        },
    statutoryEnshrinedPactoIds: Array.from(statutoryPactoIds),
  };
  const previewQuery = useAgreementRulePreview(previewInput);

  const sociedades = useMemo(
    () => sociedadesQuery.data ?? [],
    [sociedadesQuery.data],
  );
  const sociedad = useMemo(
    () => sociedades.find((s) => s.id === entityId) ?? null,
    [entityId, sociedades],
  );
  const sociedadMissing = !!entityId && !sociedadesQuery.isLoading && !sociedad;

  const handleEntityChange = (next: string) => {
    const params = new URLSearchParams(searchParams);
    if (next) params.set("entity", next);
    else params.delete("entity");
    setSearchParams(params, { replace: true });
    // Reset hipótesis al cambiar de sociedad — los pactos cambian.
    setVetoRenunciado(new Set());
    setConsentimientosPrevios(new Set());
    setStatutoryPactoIds(new Set());
  };

  const handleMatterChange = (next: string) => {
    setMatter(next);
    const params = new URLSearchParams(searchParams);
    params.set("matter", next);
    setSearchParams(params, { replace: true });
  };

  const handleAdoptionChange = (next: string) => {
    setAdoptionMode(next);
    const params = new URLSearchParams(searchParams);
    params.set("adoption", next);
    setSearchParams(params, { replace: true });
  };

  const togglePactoSet = (
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    pactoId: string,
  ) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(pactoId)) next.delete(pactoId);
      else next.add(pactoId);
      return next;
    });
  };

  return (
    <div className="mx-auto max-w-[1200px] p-6">
      <div className="mb-6">
        <Link
          to="/secretaria"
          className="inline-flex items-center gap-1 text-xs text-[var(--g-text-secondary)] hover:text-[var(--g-brand-3308)]"
        >
          <ChevronLeft className="h-3 w-3" /> Volver al panel
        </Link>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
          <BookMarked className="h-3.5 w-3.5" /> Secretaría · Gestor de Reglas Acuerdo360
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
          Regla efectiva por sociedad y materia
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-[var(--g-text-secondary)]">
          Lectura legal del marco normativo aplicable a un acuerdo: ley → estatutos → reglamento →
          pactos parasociales. Separa los tres planos jurídicos relevantes (validez societaria,
          cumplimiento contractual, hold operativo). Esta vista es <strong>read-only</strong>: no
          materializa acuerdos ni edita reglas.
        </p>
      </div>

      {/* ── Selector de sociedad ──────────────────────────────────────────── */}
      <div
        className="mb-6 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <label className="block text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
          Sociedad
        </label>
        <select
          aria-label="Sociedad"
          value={entityId ?? ""}
          onChange={(event) => handleEntityChange(event.target.value)}
          className="mt-1 w-full border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:border-[var(--g-brand-3308)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <option value="">— Selecciona una sociedad —</option>
          {sociedades.map((s) => (
            <option key={s.id} value={s.id}>
              {s.common_name ?? s.legal_name} ({s.tipo_social ?? s.legal_form ?? "?"})
            </option>
          ))}
        </select>
        {sociedad && (
          <p className="mt-2 text-xs text-[var(--g-text-secondary)]">
            Jurisdicción: {sociedad.jurisdiction ?? "—"} · Forma:{" "}
            {sociedad.tipo_social ?? sociedad.legal_form ?? "—"}
            {sociedad.es_cotizada ? " · Cotizada" : ""}
          </p>
        )}
      </div>

      {!entityId && (
        <div className="rounded-md border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-6 text-sm text-[var(--g-text-secondary)]">
          Selecciona una sociedad para ver su marco normativo y simular un acuerdo.
        </div>
      )}

      {sociedadMissing && (
        <ErrorBanner
          title="Sociedad no encontrada"
          message={`No hay ninguna sociedad con identificador ${entityId} en este tenant.`}
        />
      )}

      {entityId && !sociedadMissing && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* ── Marco normativo ─────────────────────────────────────────── */}
          <NormativeFrameworkCard
            isLoading={profileQuery.isLoading}
            profile={profileQuery.data}
            error={profileQuery.error}
          />

          {/* ── Pactos vigentes ─────────────────────────────────────────── */}
          <PactosVigentesCard
            isLoading={profileQuery.isLoading}
            pactos={pactosVigentes}
            error={profileQuery.error}
            statutoryIds={statutoryPactoIds}
            onToggleStatutory={(id) => togglePactoSet(setStatutoryPactoIds, id)}
            vetoRenunciado={vetoRenunciado}
            onToggleVetoRenunciado={(id) => togglePactoSet(setVetoRenunciado, id)}
            consentimientosPrevios={consentimientosPrevios}
            onToggleConsentimiento={(id) => togglePactoSet(setConsentimientosPrevios, id)}
          />

          {/* ── Simulador (full width) ──────────────────────────────────── */}
          <div className="lg:col-span-2">
            <SimuladorReglaCard
              matter={matter}
              adoptionMode={adoptionMode}
              matters={matters}
              matterUnknown={matterUnknown}
              onMatterChange={handleMatterChange}
              onAdoptionChange={handleAdoptionChange}
              previewQuery={previewQuery}
              skipVotes={skipVotes}
              onSkipVotesChange={setSkipVotes}
              capitalPresenteRaw={capitalPresenteRaw}
              onCapitalPresenteChange={setCapitalPresenteRaw}
              votosFavorRaw={votosFavorRaw}
              onVotosFavorChange={setVotosFavorRaw}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── ErrorBanner ─────────────────────────────────────────────────────────────

function ErrorBanner({ title, message }: { title: string; message: string }) {
  return (
    <div
      className="flex items-start gap-2 border border-[var(--status-error)] bg-[var(--g-surface-card)] p-3 text-sm text-[var(--g-text-primary)]"
      role="alert"
      style={{ borderRadius: "var(--g-radius-md)" }}
    >
      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-error)]" aria-hidden />
      <div>
        <div className="font-medium uppercase tracking-wider text-[10px] text-[var(--status-error)]">
          {title}
        </div>
        <div className="mt-0.5 text-xs text-[var(--g-text-secondary)]">{message}</div>
      </div>
    </div>
  );
}

// ── Cards ───────────────────────────────────────────────────────────────────

function NormativeFrameworkCard({
  isLoading,
  profile,
  error,
}: {
  isLoading: boolean;
  profile: ReturnType<typeof useRuleManagerProfile>["data"];
  error: unknown;
}) {
  return (
    <Card title="Marco normativo" icon={Scale}>
      {error ? (
        <ErrorBanner
          title="No se pudo cargar el marco"
          message={error instanceof Error ? error.message : "Error desconocido al consultar Cloud."}
        />
      ) : isLoading ? (
        <Loading label="Cargando marco normativo…" />
      ) : !profile ? (
        <Empty label="Sin datos" />
      ) : (
        <div className="space-y-3 text-sm text-[var(--g-text-primary)]">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">
              Estado:
            </span>
            <FrameworkStatusChip status={profile.status} />
          </div>
          {profile.warnings.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-xs text-[var(--g-text-secondary)]">
              {profile.warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          )}
          <div className="border-t border-[var(--g-border-subtle)] pt-3">
            <div className="text-xs font-medium uppercase tracking-wider text-[var(--g-text-secondary)]">
              Fuentes ({profile.sources.length})
            </div>
            <ul className="mt-2 space-y-1 text-xs">
              {profile.sources.map((source) => (
                <li key={source.id} className="flex items-start gap-2">
                  <SourceStatusDot status={source.status} />
                  <div>
                    <div className="font-medium text-[var(--g-text-primary)]">{source.label}</div>
                    {source.reference && (
                      <div className="text-[var(--g-text-secondary)]">{source.reference}</div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Card>
  );
}

function PactosVigentesCard({
  isLoading,
  pactos,
  error,
  statutoryIds,
  onToggleStatutory,
  vetoRenunciado,
  onToggleVetoRenunciado,
  consentimientosPrevios,
  onToggleConsentimiento,
}: {
  isLoading: boolean;
  pactos: PactoParasocial[];
  error: unknown;
  statutoryIds: Set<string>;
  onToggleStatutory: (id: string) => void;
  vetoRenunciado: Set<string>;
  onToggleVetoRenunciado: (id: string) => void;
  consentimientosPrevios: Set<string>;
  onToggleConsentimiento: (id: string) => void;
}) {
  return (
    <Card title="Pactos parasociales vigentes" icon={Users}>
      {error ? (
        <ErrorBanner
          title="No se pudieron cargar los pactos"
          message={error instanceof Error ? error.message : "Error desconocido al consultar Cloud."}
        />
      ) : isLoading ? (
        <Loading label="Cargando pactos…" />
      ) : pactos.length === 0 ? (
        <p className="text-sm text-[var(--g-text-secondary)]">
          No hay pactos vigentes registrados para esta sociedad.
        </p>
      ) : (
        <ul className="space-y-3">
          {pactos.map((pacto) => {
            const isStatutory = statutoryIds.has(pacto.id);
            const isVetoRenunciado = vetoRenunciado.has(pacto.id);
            const isConsentObtenido = consentimientosPrevios.has(pacto.id);
            return (
              <li
                key={pacto.id}
                className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] p-3"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium text-[var(--g-text-primary)]">{pacto.titulo}</div>
                  <span
                    className="bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] px-2 py-0.5 text-[10px] uppercase tracking-wider"
                    style={{ borderRadius: "var(--g-radius-sm)" }}
                  >
                    {pacto.tipo_clausula}
                  </span>
                </div>
                {pacto.titular_veto && (
                  <div className="mt-1 text-xs text-[var(--g-text-secondary)]">
                    Titular: {pacto.titular_veto}
                  </div>
                )}
                {pacto.materias_aplicables.length > 0 && (
                  <div className="mt-1 text-xs text-[var(--g-text-secondary)]">
                    Materias: {pacto.materias_aplicables.join(", ")}
                  </div>
                )}
                {pacto.umbral_activacion !== undefined && (
                  <div className="mt-1 text-xs text-[var(--g-text-secondary)]">
                    Umbral pactado: {(pacto.umbral_activacion * 100).toFixed(1)}%
                  </div>
                )}
                <div className="mt-2 space-y-1 border-t border-[var(--g-border-subtle)] pt-2 text-xs">
                  <PactoToggle
                    checked={isStatutory}
                    onChange={() => onToggleStatutory(pacto.id)}
                    label="Estatutarizado (eleva a VALIDITY_BLOCK si incumple)"
                  />
                  {pacto.tipo_clausula === "VETO" && (
                    <PactoToggle
                      checked={isVetoRenunciado}
                      onChange={() => onToggleVetoRenunciado(pacto.id)}
                      label="Veto renunciado por el titular (waiver documentado)"
                    />
                  )}
                  {pacto.tipo_clausula === "CONSENTIMIENTO_INVERSOR" && (
                    <PactoToggle
                      checked={isConsentObtenido}
                      onChange={() => onToggleConsentimiento(pacto.id)}
                      label="Consentimiento previo obtenido"
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function PactoToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[var(--g-text-primary)]">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-3 w-3 cursor-pointer accent-[var(--g-brand-3308)]"
      />
      <span>{label}</span>
    </label>
  );
}

function SimuladorReglaCard({
  matter,
  adoptionMode,
  matters,
  matterUnknown,
  onMatterChange,
  onAdoptionChange,
  previewQuery,
  skipVotes,
  onSkipVotesChange,
  capitalPresenteRaw,
  onCapitalPresenteChange,
  votosFavorRaw,
  onVotosFavorChange,
}: {
  matter: string;
  adoptionMode: string;
  matters: MatterEntry[];
  matterUnknown: boolean;
  onMatterChange: (value: string) => void;
  onAdoptionChange: (value: string) => void;
  previewQuery: ReturnType<typeof useAgreementRulePreview>;
  skipVotes: boolean;
  onSkipVotesChange: (value: boolean) => void;
  capitalPresenteRaw: string;
  onCapitalPresenteChange: (value: string) => void;
  votosFavorRaw: string;
  onVotosFavorChange: (value: string) => void;
}) {
  const result = previewQuery.data;
  return (
    <Card title="Simulador de regla efectiva" icon={Gavel}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
            Materia
          </label>
          <select
            aria-label="Materia del acuerdo"
            value={matter}
            onChange={(event) => onMatterChange(event.target.value)}
            className="mt-1 w-full border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:border-[var(--g-brand-3308)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            {matters.map((m) => (
              <option key={m.matter} value={m.matter}>
                {m.label}
              </option>
            ))}
          </select>
          {matterUnknown && (
            <p className="mt-1 text-xs text-[var(--status-warning)]">
              Materia desconocida en el catálogo: usando defaults seguros (estatutaria, inscribible).
            </p>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
            Modo de adopción
          </label>
          <select
            aria-label="Modo de adopción"
            value={adoptionMode}
            onChange={(event) => onAdoptionChange(event.target.value)}
            className="mt-1 w-full border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:border-[var(--g-brand-3308)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            {ADOPTION_MODES.map((mode) => (
              <option key={mode.value} value={mode.value}>
                {mode.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Hipótesis de votación ───────────────────────────────────────── */}
      <div
        className="mt-4 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] p-3"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
            Hipótesis de votación
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--g-text-primary)]">
            <input
              type="checkbox"
              checked={skipVotes}
              onChange={(event) => onSkipVotesChange(event.target.checked)}
              className="h-3 w-3 cursor-pointer accent-[var(--g-brand-3308)]"
            />
            <span>Pre-votación (no evaluar mayoría pactada)</span>
          </label>
        </div>
        {!skipVotes && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-[10px] font-medium uppercase tracking-wider text-[var(--g-text-secondary)]">
                Capital presente (unidades)
              </label>
              <input
                type="number"
                min="0"
                value={capitalPresenteRaw}
                onChange={(event) => onCapitalPresenteChange(event.target.value)}
                placeholder="ej. 100"
                className="mt-1 w-full border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:border-[var(--g-brand-3308)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium uppercase tracking-wider text-[var(--g-text-secondary)]">
                Votos a favor
              </label>
              <input
                type="number"
                min="0"
                value={votosFavorRaw}
                onChange={(event) => onVotosFavorChange(event.target.value)}
                placeholder="ej. 75"
                className="mt-1 w-full border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:border-[var(--g-brand-3308)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              />
            </div>
          </div>
        )}
        <p className="mt-2 text-[10px] text-[var(--g-text-secondary)]">
          {skipVotes
            ? "Modo pre-votación: los pactos de mayoría reforzada se reportan como pendientes, no como incumplidos."
            : "Modo con cifras: los pactos de mayoría reforzada se evalúan con los votos suministrados."}
        </p>
      </div>

      {previewQuery.error ? (
        <div className="mt-4">
          <ErrorBanner
            title="No se pudo calcular la regla efectiva"
            message={
              previewQuery.error instanceof Error
                ? previewQuery.error.message
                : "Error desconocido al consultar Cloud."
            }
          />
        </div>
      ) : previewQuery.isLoading ? (
        <Loading label="Calculando regla efectiva…" />
      ) : !previewQuery.enabled ? (
        <p className="mt-4 text-sm text-[var(--g-text-secondary)]">
          Selecciona sociedad, materia y modo de adopción.
        </p>
      ) : !result ? (
        <p className="mt-4 text-sm text-[var(--g-text-secondary)]">
          No se pudo construir la regla efectiva con los datos disponibles.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          <ResultStatusBanner status={result.status} />
          <ConsequencesList consequences={result.consequences} />
          <RequirementsGrid requirements={result.requirements} />
        </div>
      )}
    </Card>
  );
}

// ── Subcomponentes ──────────────────────────────────────────────────────────

function Card({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div
      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[var(--g-brand-3308)]">
        <Icon className="h-3.5 w-3.5" /> {title}
      </div>
      {children}
    </div>
  );
}

function Loading({ label }: { label: string }) {
  return <div className="p-3 text-sm text-[var(--g-text-secondary)]">{label}</div>;
}

function Empty({ label }: { label: string }) {
  return <div className="p-3 text-sm text-[var(--g-text-secondary)]">{label}</div>;
}

function FrameworkStatusChip({ status }: { status: string }) {
  const tone =
    status === "COMPLETO"
      ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
      : status === "INCOMPLETO" || status === "DESACTUALIZADO"
        ? "bg-[var(--status-warning)] text-[var(--g-text-inverse)]"
        : "bg-[var(--status-error)] text-[var(--g-text-inverse)]";
  return (
    <span
      className={`px-2 py-0.5 text-[10px] uppercase tracking-wider ${tone}`}
      style={{ borderRadius: "var(--g-radius-sm)" }}
    >
      {status}
    </span>
  );
}

function SourceStatusDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    ACTIVE: "bg-[var(--status-success)]",
    MISSING: "bg-[var(--status-error)]",
    WARNING: "bg-[var(--status-warning)]",
    CONFLICT: "bg-[var(--status-error)]",
  };
  const tone = map[status] ?? "bg-[var(--g-border-default)]";
  return <span className={`mt-1 inline-block h-2 w-2 ${tone} rounded-full shrink-0`} aria-hidden />;
}

function ResultStatusBanner({ status }: { status: EffectiveAgreementRule["status"] }) {
  const meta = STATUS_TONE[status];
  const Icon =
    status === "PROCLAMABLE_AND_EXECUTABLE"
      ? CheckCircle2
      : status === "PROCLAMABLE_HELD"
        ? PauseCircle
        : ShieldAlert;
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 ${meta.chip}`}
      style={{ borderRadius: "var(--g-radius-md)" }}
    >
      <Icon className="h-4 w-4" aria-hidden />
      <span className="text-sm font-medium">{meta.label}</span>
    </div>
  );
}

function ConsequencesList({ consequences }: { consequences: EffectiveRuleConsequence[] }) {
  if (consequences.length === 0) {
    return (
      <div className="text-xs text-[var(--g-text-secondary)]">
        Sin consecuencias jurídicas pendientes para esta combinación.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium uppercase tracking-wider text-[var(--g-text-secondary)]">
        Consecuencias jurídicas
      </div>
      <ul className="space-y-2">
        {consequences.map((consequence, index) => (
          <li
            key={`${consequence.source_id ?? "x"}-${index}`}
            className={`flex items-start gap-2 px-3 py-2 ${CONSEQUENCE_TONE_CLASS[CONSEQUENCE_META[consequence.consequence].tone]}`}
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <Shield className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div className="text-xs">
              <div className="font-medium uppercase tracking-wider">
                {CONSEQUENCE_META[consequence.consequence].label}
              </div>
              <div className="mt-0.5">{consequence.reason}</div>
              {consequence.remediation_hint && (
                <div className="mt-1 italic">→ {consequence.remediation_hint}</div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RequirementsGrid({
  requirements,
}: {
  requirements: EffectiveAgreementRule["requirements"];
}) {
  return (
    <div className="border-t border-[var(--g-border-subtle)] pt-3">
      <div className="text-xs font-medium uppercase tracking-wider text-[var(--g-text-secondary)]">
        Requisitos por categoría
      </div>
      <div className="mt-2 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
        <RequirementRow label="Convocatoria" required={requirements.convocatoria?.required} notes={requirements.convocatoria?.notes} />
        <RequirementRow label="Quórum" required={requirements.quorum?.required} notes={requirements.quorum?.notes} />
        <RequirementRow
          label="Mayoría"
          required={requirements.majority?.code !== null}
          extra={
            requirements.majority?.effective_threshold !== null &&
            requirements.majority?.effective_threshold !== undefined
              ? `${(requirements.majority.effective_threshold * 100).toFixed(1)}% (${requirements.majority.effective_source ?? "—"})`
              : (requirements.majority?.code ?? "—")
          }
          notes={requirements.majority?.notes}
        />
        <RequirementRow
          label="Unanimidad"
          required={requirements.unanimity?.required}
          notes={requirements.unanimity?.notes}
        />
        <RequirementRow
          label="Veto pactado"
          required={requirements.veto?.applies}
          extra={requirements.veto?.titulares.join(", ") || undefined}
          notes={requirements.veto?.notes}
        />
        <RequirementRow
          label="Consentimiento previo"
          required={requirements.consent?.required}
          extra={requirements.consent?.from.join(", ") || undefined}
          notes={requirements.consent?.notes}
        />
        <RequirementRow
          label="Inscripción registral"
          required={requirements.registry?.required}
          notes={requirements.registry?.notes}
        />
        <RequirementRow
          label="Publicación supervisor"
          required={requirements.publication?.required}
          notes={requirements.publication?.notes}
        />
      </div>
      {requirements.documentation.length > 0 && (
        <div className="mt-3 border-t border-[var(--g-border-subtle)] pt-2">
          <div className="text-xs font-medium uppercase tracking-wider text-[var(--g-text-secondary)]">
            Documentación / formalización
          </div>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-[var(--g-text-secondary)]">
            {requirements.documentation.map((req, index) => (
              <li key={index}>
                <span className="font-medium text-[var(--g-text-primary)]">{req.label}</span>
                {req.status === "REQUIRED" ? " (requerido)" : req.status === "CONDITIONAL" ? " (condicional)" : " (informativo)"}
                {" — "}
                {req.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function RequirementRow({
  label,
  required,
  notes,
  extra,
}: {
  label: string;
  required?: boolean;
  notes?: string[];
  extra?: string;
}) {
  return (
    <div
      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] p-2"
      style={{ borderRadius: "var(--g-radius-md)" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-[var(--g-text-secondary)]">
          {label}
        </span>
        <span
          className={`px-2 py-0.5 text-[10px] uppercase tracking-wider ${
            required
              ? "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]"
              : "bg-[var(--g-surface-card)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]"
          }`}
          style={{ borderRadius: "var(--g-radius-sm)" }}
        >
          {required ? "Sí" : "No"}
        </span>
      </div>
      {extra && (
        <div className="mt-1 text-xs font-medium text-[var(--g-text-primary)]">{extra}</div>
      )}
      {notes && notes.length > 0 && (
        <ul className="mt-1 list-none space-y-0.5 text-xs text-[var(--g-text-secondary)]">
          {notes.map((note, index) => (
            <li key={index} className="flex items-start gap-1">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
              <span>{note}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
