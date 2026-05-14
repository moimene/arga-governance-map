import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, FileText, Search, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { useSociedad } from "@/hooks/useSociedades";
import { useReunionesList } from "@/hooks/useReunionSecretaria";
import { usePersonasCanonical } from "@/hooks/usePersonasCanonical";
import {
  SCOPE_LABELS,
  useUpsertRepresentacionPuntual,
  type RepresentationScope,
} from "@/hooks/useRepresentacionesCanonical";

type PuntualScope = Extract<RepresentationScope, "JUNTA_PROXY" | "CONSEJO_DELEGACION">;

const SCOPES: { value: PuntualScope; title: string; description: string }[] = [
  {
    value: "JUNTA_PROXY",
    title: "Delegación de voto en Junta",
    description: "Representación puntual de socio para una reunión concreta.",
  },
  {
    value: "CONSEJO_DELEGACION",
    title: "Delegación en Consejo",
    description: "Delegación puntual entre miembros vigentes del órgano.",
  },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatMeetingLabel(value: {
  scheduled_start?: string | null;
  body_name?: string | null;
  meeting_type?: string | null;
  status?: string | null;
}) {
  const date = value.scheduled_start ? new Date(value.scheduled_start).toLocaleDateString("es-ES") : "Sin fecha";
  return `${date} · ${value.body_name ?? "Órgano pendiente"} · ${value.meeting_type ?? "Sesión"}`;
}

export default function RepresentacionPuntualStepper() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const entityId = searchParams.get("entityId") ?? "";
  const initialScope = searchParams.get("scope") === "CONSEJO_DELEGACION" ? "CONSEJO_DELEGACION" : "JUNTA_PROXY";

  const [scope, setScope] = useState<PuntualScope>(initialScope);
  const [meetingId, setMeetingId] = useState(searchParams.get("meetingId") ?? "");
  const [representedSearch, setRepresentedSearch] = useState("");
  const [representativeSearch, setRepresentativeSearch] = useState("");
  const [representedId, setRepresentedId] = useState("");
  const [representativeId, setRepresentativeId] = useState("");
  const [porcentaje, setPorcentaje] = useState("100");
  const [effectiveFrom, setEffectiveFrom] = useState(todayIso());
  const [documentoRef, setDocumentoRef] = useState("");
  const [notas, setNotas] = useState("");

  const { data: sociedad, isLoading: isSociedadLoading } = useSociedad(entityId || undefined);
  const { data: meetings, isLoading: isMeetingsLoading } = useReunionesList(entityId || undefined);
  const { data: representedOptions, isLoading: isRepresentedLoading } = usePersonasCanonical({
    search: representedSearch,
    limit: 25,
  });
  const { data: representativeOptions, isLoading: isRepresentativeLoading } = usePersonasCanonical({
    search: representativeSearch,
    limit: 25,
  });
  const upsert = useUpsertRepresentacionPuntual();

  const selectedMeeting = useMemo(
    () => (meetings ?? []).find((meeting) => meeting.id === meetingId) ?? null,
    [meetings, meetingId],
  );

  const canSubmit =
    !!entityId &&
    !!meetingId &&
    !!representedId &&
    !!representativeId &&
    !!effectiveFrom &&
    Number(porcentaje) > 0 &&
    Number(porcentaje) <= 100 &&
    !upsert.isPending;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    try {
      await upsert.mutateAsync({
        entity_id: entityId,
        meeting_id: meetingId,
        represented_person_id: representedId,
        representative_person_id: representativeId,
        scope,
        porcentaje_delegado: Number(porcentaje),
        effective_from: effectiveFrom,
        documento_ref: documentoRef,
        notas,
      });
      toast.success("Representación puntual registrada");
      navigate(`/secretaria/sociedades/${entityId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo registrar la representación";
      toast.error(message);
    }
  };

  if (!entityId) {
    return (
      <div className="mx-auto max-w-[960px] p-6">
        <div
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-5 text-sm text-[var(--g-text-secondary)]"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          Falta la sociedad de contexto. Vuelve a una ficha de sociedad para iniciar la representación.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1120px] p-4 sm:p-6">
      <Link
        to={`/secretaria/sociedades/${entityId}`}
        className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--g-brand-3308)] hover:text-[var(--g-sec-700)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a la sociedad
      </Link>

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
            <ShieldCheck className="h-3.5 w-3.5" />
            Secretaría · Representaciones
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
            Nueva representación puntual
          </h1>
          <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
            {isSociedadLoading ? "Cargando sociedad..." : sociedad?.legal_name ?? "Sociedad en contexto"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <section
            className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">Tipo de representación</h2>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {SCOPES.map((option) => {
                const active = scope === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setScope(option.value)}
                    className={`border px-3 py-3 text-left transition-colors ${
                      active
                        ? "border-[var(--g-brand-3308)] bg-[var(--g-sec-100)] text-[var(--g-text-primary)]"
                        : "border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] text-[var(--g-text-secondary)] hover:bg-[var(--g-surface-subtle)]"
                    }`}
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    <span className="block text-sm font-semibold">{option.title}</span>
                    <span className="mt-1 block text-xs">{option.description}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section
            className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">Sesión y alcance</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs font-medium text-[var(--g-text-secondary)]">
                <span>Reunión</span>
                <select
                  value={meetingId}
                  onChange={(event) => setMeetingId(event.target.value)}
                  className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] outline-none focus:border-[var(--g-brand-3308)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                  aria-busy={isMeetingsLoading}
                >
                  <option value="">Seleccionar reunión</option>
                  {(meetings ?? []).map((meeting) => (
                    <option key={meeting.id} value={meeting.id}>
                      {formatMeetingLabel(meeting)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-[var(--g-text-secondary)]">
                <span>Fecha de efecto</span>
                <input
                  type="date"
                  value={effectiveFrom}
                  onChange={(event) => setEffectiveFrom(event.target.value)}
                  className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] outline-none focus:border-[var(--g-brand-3308)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-[var(--g-text-secondary)]">
                <span>Porcentaje delegado</span>
                <input
                  type="number"
                  min="0.01"
                  max="100"
                  step="0.01"
                  value={porcentaje}
                  onChange={(event) => setPorcentaje(event.target.value)}
                  className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] outline-none focus:border-[var(--g-brand-3308)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-[var(--g-text-secondary)]">
                <span>Referencia documental</span>
                <input
                  value={documentoRef}
                  onChange={(event) => setDocumentoRef(event.target.value)}
                  placeholder="Poder, delegación firmada o acta"
                  className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] outline-none placeholder:text-[var(--g-text-secondary)] focus:border-[var(--g-brand-3308)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </label>
            </div>
          </section>

          <PersonSelector
            title="Representado"
            search={representedSearch}
            onSearch={setRepresentedSearch}
            value={representedId}
            onChange={setRepresentedId}
            options={representedOptions ?? []}
            isLoading={isRepresentedLoading}
          />

          <PersonSelector
            title="Representante"
            search={representativeSearch}
            onSearch={setRepresentativeSearch}
            value={representativeId}
            onChange={setRepresentativeId}
            options={representativeOptions ?? []}
            isLoading={isRepresentativeLoading}
          />
        </div>

        <aside
          className="h-fit border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">Revisión</h2>
          <dl className="mt-3 space-y-3 text-sm">
            <ReviewItem label="Ámbito" value={SCOPE_LABELS[scope]} />
            <ReviewItem label="Sesión" value={selectedMeeting ? formatMeetingLabel(selectedMeeting) : "Pendiente"} />
            <ReviewItem label="Alcance" value={`${Number(porcentaje || 0).toFixed(2)}%`} />
            <ReviewItem label="Evidencia" value={documentoRef || "Pendiente"} />
          </dl>
          <label className="mt-4 flex flex-col gap-1 text-xs font-medium text-[var(--g-text-secondary)]">
            <span>Notas internas</span>
            <textarea
              value={notas}
              onChange={(event) => setNotas(event.target.value)}
              rows={4}
              className="resize-none border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] outline-none focus:border-[var(--g-brand-3308)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            />
          </label>
          <button
            type="submit"
            disabled={!canSubmit}
            aria-busy={upsert.isPending}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-semibold text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] disabled:pointer-events-none disabled:opacity-50"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <CheckCircle2 className="h-4 w-4" />
            Registrar representación
          </button>
        </aside>
      </form>
    </div>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-[var(--g-text-secondary)]">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-[var(--g-text-primary)]">{value}</dd>
    </div>
  );
}

function PersonSelector({
  title,
  search,
  onSearch,
  value,
  onChange,
  options,
  isLoading,
}: {
  title: string;
  search: string;
  onSearch: (value: string) => void;
  value: string;
  onChange: (value: string) => void;
  options: Array<{
    id: string;
    full_name: string;
    tax_id: string | null;
    person_type: string | null;
  }>;
  isLoading: boolean;
}) {
  return (
    <section
      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--g-text-primary)]">
        <Users className="h-4 w-4 text-[var(--g-brand-3308)]" />
        {title}
      </h2>
      <div
        className="mt-3 flex items-center gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 focus-within:ring-2 focus-within:ring-[var(--g-border-focus)] focus-within:ring-offset-2 focus-within:ring-offset-[var(--g-surface-page)]"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        <Search className="h-4 w-4 shrink-0 text-[var(--g-text-secondary)]" />
        <input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Buscar por nombre, NIF o email"
          className="min-w-0 flex-1 bg-transparent text-sm text-[var(--g-text-primary)] outline-none placeholder:text-[var(--g-text-secondary)]"
        />
      </div>
      <div className="mt-3 grid max-h-64 gap-2 overflow-auto pr-1">
        {isLoading ? (
          <div className="text-sm text-[var(--g-text-secondary)]">Buscando...</div>
        ) : options.length === 0 ? (
          <div className="text-sm text-[var(--g-text-secondary)]">Sin resultados.</div>
        ) : (
          options.map((person) => {
            const active = value === person.id;
            return (
              <button
                key={person.id}
                type="button"
                onClick={() => onChange(person.id)}
                className={`flex items-start justify-between gap-3 border px-3 py-2 text-left transition-colors ${
                  active
                    ? "border-[var(--g-brand-3308)] bg-[var(--g-sec-100)]"
                    : "border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] hover:bg-[var(--g-surface-subtle)]"
                }`}
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-[var(--g-text-primary)]">
                    {person.full_name}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2 text-xs text-[var(--g-text-secondary)]">
                    <FileText className="h-3 w-3" />
                    {person.tax_id ?? "Documento pendiente"} · {person.person_type ?? "Tipo pendiente"}
                  </span>
                </span>
                {active ? <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--status-success)]" /> : null}
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}
