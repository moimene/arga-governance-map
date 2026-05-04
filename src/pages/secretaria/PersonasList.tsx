import { Building2, Users, Search, Plus, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { useSecretariaScope } from "@/components/secretaria/shell";
import { usePersonasEnriquecidas, type PersonType } from "@/hooks/usePersonasCanonical";
import { useSociedades } from "@/hooks/useSociedades";
import { CARGO_LABELS, type TipoCondicion } from "@/hooks/useCargos";

const CARGO_OPTIONS: { value: TipoCondicion; label: string }[] = (
  Object.keys(CARGO_LABELS) as TipoCondicion[]
).map((k) => ({ value: k, label: CARGO_LABELS[k] }));

const PERSON_TYPE_CHIP: Record<PersonType, string> = {
  PF: "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]",
  PJ: "bg-[var(--g-sec-100)] text-[var(--g-brand-3308)]",
};

function personTypeLabel(type: PersonType | null): string {
  if (type === "PF") return "Persona física";
  if (type === "PJ") return "Persona jurídica";
  return "Tipo pendiente";
}

function formatCapital(value: number | null): string {
  return value == null ? "Participación pendiente" : `${Number(value).toFixed(2)}%`;
}

export default function PersonasList() {
  const scope = useSecretariaScope();
  const [personType, setPersonType] = useState<PersonType | "">("");
  const [search, setSearch] = useState("");
  const [tipoCondicion, setTipoCondicion] = useState<TipoCondicion | "">("");
  const [entityId, setEntityId] = useState<string>("");

  const isSociedadMode = scope.mode === "sociedad";
  const selectedEntity = scope.selectedEntity;
  const scopedEntityId = isSociedadMode ? selectedEntity?.id ?? "" : entityId;
  const selectedEntityName = selectedEntity?.legalName ?? selectedEntity?.name ?? "Sociedad seleccionada";

  const { data: sociedades } = useSociedades();
  const { data, isLoading } = usePersonasEnriquecidas({
    person_type: personType || undefined,
    search,
    tipo_condicion: tipoCondicion || undefined,
    entity_id: scopedEntityId || undefined,
  });

  const hasAnyFilter = !!search || !!personType || !!tipoCondicion || (!isSociedadMode && !!entityId);
  const resultCount = data?.length ?? 0;
  const sociedadMetrics = useMemo(() => {
    if (!isSociedadMode || !scopedEntityId || !data) return null;

    const cargosVigentes = data.reduce(
      (total, persona) =>
        total + persona.cargos_vigentes.filter((cargo) => cargo.entity_id === scopedEntityId).length,
      0,
    );
    const socios = data.filter((persona) =>
      persona.holdings_vigentes.some((holding) => holding.entity_id === scopedEntityId),
    ).length;
    const miembrosOrganos = data.filter((persona) =>
      persona.cargos_vigentes.some((cargo) => cargo.entity_id === scopedEntityId && cargo.body_id),
    ).length;

    return {
      personas: data.length,
      cargosVigentes,
      socios,
      miembrosOrganos,
    };
  }, [data, isSociedadMode, scopedEntityId]);

  const clearFilters = () => {
    setSearch("");
    setPersonType("");
    setTipoCondicion("");
    if (!isSociedadMode) setEntityId("");
  };

  return (
    <div className="mx-auto max-w-[1440px] p-4 sm:p-6">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
            <Users className="h-3.5 w-3.5" />
            Secretaría · Gestión societaria
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
            {isSociedadMode ? "Personas y cargos" : "Personas"}
          </h1>
          <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
            {isSociedadMode
              ? `Socios, administradores, miembros de órganos y representantes vinculados a ${selectedEntityName}.`
              : "Personas físicas y jurídicas del modelo canónico: socios, administradores, miembros de órganos y representantes."}
          </p>
        </div>
        <Link
          to={scope.createScopedTo("/secretaria/personas/nueva")}
          className="inline-flex w-full items-center justify-center gap-1.5 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-semibold text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] sm:w-auto"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <Plus className="h-4 w-4" />
          Nueva persona
        </Link>
      </div>

      {isSociedadMode && (
        <div
          className="mb-4 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-4 py-3"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
                <Building2 className="h-3.5 w-3.5" />
                Sociedad en contexto
              </div>
              <div className="mt-1 text-base font-semibold text-[var(--g-text-primary)]">
                {selectedEntityName}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--g-text-secondary)]">
                <span>{selectedEntity?.legalForm ?? "Tipo social pendiente"}</span>
                <span aria-hidden="true">·</span>
                <span>{selectedEntity?.jurisdiction ?? "Jurisdicción pendiente"}</span>
                <span aria-hidden="true">·</span>
                <span>{selectedEntity?.status ?? "Estado pendiente"}</span>
              </div>
            </div>

            {sociedadMetrics && (
              <dl className="grid min-w-full grid-cols-1 gap-3 text-sm sm:min-w-[420px] sm:grid-cols-3 lg:min-w-[480px]">
                <div className="border-l border-[var(--g-border-subtle)] pl-3">
                  <dt className="text-xs font-medium text-[var(--g-text-secondary)]">Personas</dt>
                  <dd className="mt-1 text-lg font-semibold text-[var(--g-text-primary)]">
                    {sociedadMetrics.personas}
                  </dd>
                </div>
                <div className="border-l border-[var(--g-border-subtle)] pl-3">
                  <dt className="text-xs font-medium text-[var(--g-text-secondary)]">Cargos vigentes</dt>
                  <dd className="mt-1 text-lg font-semibold text-[var(--g-text-primary)]">
                    {sociedadMetrics.cargosVigentes}
                  </dd>
                </div>
                <div className="border-l border-[var(--g-border-subtle)] pl-3">
                  <dt className="text-xs font-medium text-[var(--g-text-secondary)]">Socios</dt>
                  <dd className="mt-1 text-lg font-semibold text-[var(--g-text-primary)]">
                    {sociedadMetrics.socios}
                  </dd>
                </div>
              </dl>
            )}
          </div>
          {sociedadMetrics && (
            <div className="mt-3 text-xs text-[var(--g-text-secondary)]">
              {sociedadMetrics.miembrosOrganos} persona
              {sociedadMetrics.miembrosOrganos === 1 ? "" : "s"} con cargo vigente en órganos de esta sociedad.
            </div>
          )}
        </div>
      )}

      {/* Fila 1: buscador + tipo de persona */}
      <div className="mb-3 grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div
          className="flex min-w-0 items-center gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 focus-within:ring-2 focus-within:ring-[var(--g-border-focus)] focus-within:ring-offset-2 focus-within:ring-offset-[var(--g-surface-page)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <Search className="h-4 w-4 shrink-0 text-[var(--g-text-secondary)]" />
          <input
            aria-label="Buscar persona"
            type="search"
            placeholder="Buscar por nombre, NIF, email o denominación"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm text-[var(--g-text-primary)] outline-none placeholder:text-[var(--g-text-secondary)]"
          />
        </div>
        <div className="grid grid-cols-3 gap-1 sm:flex">
          {(["", "PF", "PJ"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setPersonType(t as "" | PersonType)}
              className={`px-3 py-2 text-xs font-semibold transition-colors ${
                personType === t
                  ? "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]"
                  : "border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
              }`}
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              {t === "" ? "Todas" : t === "PF" ? "Físicas" : "Jurídicas"}
            </button>
          ))}
        </div>
      </div>

      {/* Fila 2: filtros por cargo + sociedad */}
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center">
        <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-[var(--g-text-secondary)] sm:flex-row sm:items-center sm:gap-2">
          <span>Cargo</span>
          <select
            aria-label="Filtrar por cargo"
            value={tipoCondicion}
            onChange={(e) => setTipoCondicion(e.target.value as TipoCondicion | "")}
            className="min-w-0 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] outline-none focus:border-[var(--g-brand-3308)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <option value="">Cualquier cargo</option>
            {CARGO_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        {isSociedadMode ? (
          <div
            className="flex min-w-0 flex-wrap items-center gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-xs text-[var(--g-text-secondary)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <span className="font-medium">Sociedad</span>
            <span className="break-words font-semibold text-[var(--g-text-primary)]">{selectedEntityName}</span>
            <span className="text-[var(--g-text-secondary)]">fijada por el modo sociedad</span>
          </div>
        ) : (
          <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-[var(--g-text-secondary)] sm:flex-row sm:items-center sm:gap-2">
            <span>Sociedad</span>
            <select
              aria-label="Filtrar por sociedad"
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              className="min-w-0 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] outline-none focus:border-[var(--g-brand-3308)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <option value="">Cualquier sociedad</option>
              {(sociedades ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.common_name ?? s.legal_name}
                </option>
              ))}
            </select>
          </label>
        )}

        {hasAnyFilter && (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-1 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-xs font-semibold text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <X className="h-3.5 w-3.5" />
            Limpiar filtros
          </button>
        )}
        <span className="flex items-center text-xs text-[var(--g-text-secondary)] sm:col-span-2 lg:col-span-1">
          {resultCount} persona{resultCount === 1 ? "" : "s"} en la vista
        </span>
      </div>

      <div
        data-testid="personas-mobile-list"
        className="space-y-3 lg:hidden"
      >
        {isLoading ? (
          <div
            className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-4 py-6 text-center text-sm text-[var(--g-text-secondary)]"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            Cargando personas...
          </div>
        ) : !data || data.length === 0 ? (
          <div
            className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-4 py-6 text-center text-sm text-[var(--g-text-secondary)]"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            {hasAnyFilter
              ? "Ninguna persona coincide con los filtros."
              : isSociedadMode
                ? "No hay personas vinculadas a esta sociedad."
                : "No hay personas registradas."}
          </div>
        ) : (
          data.map((p) => {
            const cargosVisibles =
              isSociedadMode && scopedEntityId
                ? p.cargos_vigentes.filter((c) => c.entity_id === scopedEntityId)
                : p.cargos_vigentes;
            const holdingsVisibles =
              isSociedadMode && scopedEntityId
                ? p.holdings_vigentes.filter((h) => h.entity_id === scopedEntityId)
                : p.holdings_vigentes;

            return (
              <Link
                key={p.id}
                to={scope.createScopedTo(`/secretaria/personas/${p.id}`)}
                className="block border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-4 py-4 transition-colors hover:bg-[var(--g-surface-subtle)]/50"
                style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="break-words text-sm font-semibold text-[var(--g-text-primary)]">
                      {p.full_name}
                    </h2>
                    <p className="mt-1 break-words text-xs text-[var(--g-text-secondary)]">
                      {p.tax_id ?? "Documento fiscal pendiente"}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 px-2 py-1 text-[11px] font-medium ${
                      p.person_type ? PERSON_TYPE_CHIP[p.person_type] : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
                    }`}
                    style={{ borderRadius: "var(--g-radius-sm)" }}
                  >
                    {personTypeLabel(p.person_type)}
                  </span>
                </div>

                <div className="mt-4 grid gap-3">
                  <div>
                    <div className="text-xs font-medium text-[var(--g-text-secondary)]">
                      {isSociedadMode ? "Vínculo con la sociedad" : "Cargos vigentes"}
                    </div>
                    {cargosVisibles.length === 0 ? (
                      <p className="mt-1 text-sm text-[var(--g-text-secondary)]">Sin cargo vigente</p>
                    ) : (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {cargosVisibles.map((c, i) => (
                          <span
                            key={`${p.id}-mobile-cargo-${i}`}
                            className="inline-flex max-w-full items-center gap-1 bg-[var(--g-sec-100)] px-2 py-0.5 text-[11px] font-medium text-[var(--g-brand-3308)]"
                            style={{ borderRadius: "var(--g-radius-sm)" }}
                          >
                            <span className="truncate">
                              {CARGO_LABELS[c.tipo_condicion as TipoCondicion] ?? c.tipo_condicion.replace(/_/g, " ")}
                            </span>
                            {(isSociedadMode ? c.body_name : c.entity_name) ? (
                              <span className="truncate font-normal">
                                · {isSociedadMode ? c.body_name : c.entity_name}
                              </span>
                            ) : null}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="text-xs font-medium text-[var(--g-text-secondary)]">
                      {isSociedadMode ? "Participación" : "Participaciones"}
                    </div>
                    {holdingsVisibles.length === 0 ? (
                      <p className="mt-1 text-sm text-[var(--g-text-secondary)]">Sin participación vigente</p>
                    ) : (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {holdingsVisibles.map((h, i) => (
                          <span
                            key={`${p.id}-mobile-hold-${i}`}
                            className="inline-flex max-w-full items-center gap-1 border border-[var(--g-border-subtle)] bg-[var(--g-surface-muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--g-text-primary)]"
                            style={{ borderRadius: "var(--g-radius-sm)" }}
                          >
                            <span className="truncate">{isSociedadMode ? "Socio" : h.entity_name}</span>
                            <span className="font-normal">· {formatCapital(h.porcentaje_capital)}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {p.email ? (
                  <p className="mt-4 break-words text-xs text-[var(--g-text-secondary)]">{p.email}</p>
                ) : null}
              </Link>
            );
          })
        )}
      </div>

      <div
        data-testid="personas-desktop-table"
        className="hidden overflow-hidden border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] lg:block"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <table className="w-full">
          <thead>
            <tr className="bg-[var(--g-surface-subtle)]">
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Nombre</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Tipo</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Documento fiscal</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                {isSociedadMode ? "Vínculo con la sociedad" : "Cargos vigentes"}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                {isSociedadMode ? "Participación" : "Es socio en"}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Correo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--g-border-subtle)]">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-sm text-[var(--g-text-secondary)]">
                  Cargando…
                </td>
              </tr>
            ) : !data || data.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-sm text-[var(--g-text-secondary)]">
                  {hasAnyFilter
                    ? "Ninguna persona coincide con los filtros."
                    : isSociedadMode
                      ? "No hay personas vinculadas a esta sociedad."
                      : "No hay personas registradas."}
                </td>
              </tr>
            ) : (
              data.map((p) => {
                const cargosVisibles =
                  isSociedadMode && scopedEntityId
                    ? p.cargos_vigentes.filter((c) => c.entity_id === scopedEntityId)
                    : p.cargos_vigentes;
                const holdingsVisibles =
                  isSociedadMode && scopedEntityId
                    ? p.holdings_vigentes.filter((h) => h.entity_id === scopedEntityId)
                    : p.holdings_vigentes;

                return (
                  <tr key={p.id} className="align-top hover:bg-[var(--g-surface-subtle)]/50">
                    <td className="px-6 py-3 text-sm">
                      <Link
                        to={scope.createScopedTo(`/secretaria/personas/${p.id}`)}
                        className="font-semibold text-[var(--g-text-primary)] hover:text-[var(--g-brand-3308)]"
                      >
                        {p.full_name}
                      </Link>
                    </td>
                    <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium ${
                          p.person_type ? PERSON_TYPE_CHIP[p.person_type] : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
                        }`}
                        style={{ borderRadius: "var(--g-radius-sm)" }}
                      >
                        {personTypeLabel(p.person_type)}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">{p.tax_id ?? "—"}</td>

                    {/* Cargos vigentes */}
                    <td className="px-6 py-3 text-sm">
                      {cargosVisibles.length === 0 ? (
                        <span className="text-[var(--g-text-secondary)]">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {cargosVisibles.map((c, i) => (
                            <span
                              key={`${p.id}-cargo-${i}`}
                              className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium bg-[var(--g-sec-100)] text-[var(--g-brand-3308)]"
                              style={{ borderRadius: "var(--g-radius-sm)" }}
                              title={c.body_name ? `${c.entity_name} · ${c.body_name}` : c.entity_name}
                            >
                              {CARGO_LABELS[c.tipo_condicion as TipoCondicion] ?? c.tipo_condicion.replace(/_/g, " ")}
                              {(isSociedadMode ? c.body_name : c.entity_name) && (
                                <>
                                  <span className="mx-1 opacity-50">·</span>
                                  <span className="font-normal">
                                    {isSociedadMode ? c.body_name : c.entity_name}
                                  </span>
                                </>
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Holdings (es socio en) */}
                    <td className="px-6 py-3 text-sm">
                      {holdingsVisibles.length === 0 ? (
                        <span className="text-[var(--g-text-secondary)]">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {holdingsVisibles.map((h, i) => (
                            <span
                              key={`${p.id}-hold-${i}`}
                              className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium bg-[var(--g-surface-muted)] text-[var(--g-text-primary)] border border-[var(--g-border-subtle)]"
                              style={{ borderRadius: "var(--g-radius-sm)" }}
                            >
                              {isSociedadMode ? "Socio" : h.entity_name}
                              {h.porcentaje_capital != null && (
                                <>
                                  <span className="mx-1 opacity-50">·</span>
                                  <span className="font-normal">{Number(h.porcentaje_capital).toFixed(2)}%</span>
                                </>
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                    <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">{p.email ?? "—"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {data && data.length > 0 && (
        <div className="mt-3 text-xs text-[var(--g-text-secondary)]">
          {data.length} persona{data.length === 1 ? "" : "s"}
          {isSociedadMode ? " vinculadas a la sociedad" : hasAnyFilter ? " con los filtros aplicados" : ""}
        </div>
      )}
    </div>
  );
}
