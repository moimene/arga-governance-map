import { Users, Search, Plus, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { usePersonasEnriquecidas, type PersonType } from "@/hooks/usePersonasCanonical";
import { useSociedades } from "@/hooks/useSociedades";
import { CARGO_LABELS, type TipoCondicion } from "@/hooks/useCargos";

const CARGO_OPTIONS: { value: TipoCondicion; label: string }[] = (
  Object.keys(CARGO_LABELS) as TipoCondicion[]
).map((k) => ({ value: k, label: CARGO_LABELS[k] }));

export default function PersonasList() {
  const [personType, setPersonType] = useState<PersonType | "">("");
  const [search, setSearch] = useState("");
  const [tipoCondicion, setTipoCondicion] = useState<TipoCondicion | "">("");
  const [entityId, setEntityId] = useState<string>("");

  const { data: sociedades } = useSociedades();
  const { data, isLoading } = usePersonasEnriquecidas({
    person_type: personType || undefined,
    search,
    tipo_condicion: tipoCondicion || undefined,
    entity_id: entityId || undefined,
  });

  const hasAnyFilter = !!search || !!personType || !!tipoCondicion || !!entityId;

  const clearFilters = () => {
    setSearch("");
    setPersonType("");
    setTipoCondicion("");
    setEntityId("");
  };

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
            <Users className="h-3.5 w-3.5" />
            Secretaría · Gestión societaria
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
            Personas
          </h1>
          <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
            Personas físicas (PF) y jurídicas (PJ) del modelo canónico: socios, administradores,
            miembros de órganos, representantes.
          </p>
        </div>
        <Link
          to="/secretaria/personas/nueva"
          className="inline-flex items-center gap-1.5 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-semibold text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <Plus className="h-4 w-4" />
          Nueva persona
        </Link>
      </div>

      {/* Fila 1: buscador + PF/PJ */}
      <div className="mb-3 flex items-center gap-2">
        <div
          className="flex flex-1 items-center gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <Search className="h-4 w-4 text-[var(--g-text-secondary)]" />
          <input
            aria-label="Buscar persona"
            type="search"
            placeholder="Buscar por nombre, NIF, email, denominación…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm text-[var(--g-text-primary)] outline-none placeholder:text-[var(--g-text-secondary)]"
          />
        </div>
        <div className="flex gap-1">
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
              {t === "" ? "Todas" : t === "PF" ? "Personas físicas" : "Personas jurídicas"}
            </button>
          ))}
        </div>
      </div>

      {/* Fila 2: filtros por cargo + sociedad */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs font-medium text-[var(--g-text-secondary)]">
          <span>Cargo</span>
          <select
            aria-label="Filtrar por cargo"
            value={tipoCondicion}
            onChange={(e) => setTipoCondicion(e.target.value as TipoCondicion | "")}
            className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] outline-none focus:border-[var(--g-brand-3308)]"
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

        <label className="flex items-center gap-2 text-xs font-medium text-[var(--g-text-secondary)]">
          <span>Sociedad</span>
          <select
            aria-label="Filtrar por sociedad"
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] outline-none focus:border-[var(--g-brand-3308)]"
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
      </div>

      <div
        className="overflow-hidden border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <table className="w-full">
          <thead>
            <tr className="bg-[var(--g-surface-subtle)]">
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Nombre</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Tipo</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">NIF/CIF</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Cargos vigentes</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Es socio en</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Email</th>
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
                    : "No hay personas registradas."}
                </td>
              </tr>
            ) : (
              data.map((p) => (
                <tr key={p.id} className="align-top hover:bg-[var(--g-surface-subtle)]/50">
                  <td className="px-6 py-3 text-sm">
                    <Link
                      to={`/secretaria/personas/${p.id}`}
                      className="font-semibold text-[var(--g-text-primary)] hover:text-[var(--g-brand-3308)]"
                    >
                      {p.full_name}
                    </Link>
                  </td>
                  <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium ${
                        p.person_type === "PJ"
                          ? "bg-[var(--g-sec-100)] text-[var(--g-brand-3308)]"
                          : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
                      }`}
                      style={{ borderRadius: "var(--g-radius-sm)" }}
                    >
                      {p.person_type ?? "—"}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">{p.tax_id ?? "—"}</td>

                  {/* Cargos vigentes */}
                  <td className="px-6 py-3 text-sm">
                    {p.cargos_vigentes.length === 0 ? (
                      <span className="text-[var(--g-text-secondary)]">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {p.cargos_vigentes.map((c, i) => (
                          <span
                            key={`${p.id}-cargo-${i}`}
                            className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium bg-[var(--g-sec-100)] text-[var(--g-brand-3308)]"
                            style={{ borderRadius: "var(--g-radius-sm)" }}
                            title={c.body_name ? `${c.entity_name} · ${c.body_name}` : c.entity_name}
                          >
                            {CARGO_LABELS[c.tipo_condicion as TipoCondicion] ?? c.tipo_condicion}
                            <span className="mx-1 opacity-50">·</span>
                            <span className="font-normal">{c.entity_name}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </td>

                  {/* Holdings (es socio en) */}
                  <td className="px-6 py-3 text-sm">
                    {p.holdings_vigentes.length === 0 ? (
                      <span className="text-[var(--g-text-secondary)]">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {p.holdings_vigentes.map((h, i) => (
                          <span
                            key={`${p.id}-hold-${i}`}
                            className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium bg-[var(--g-surface-muted)] text-[var(--g-text-primary)] border border-[var(--g-border-subtle)]"
                            style={{ borderRadius: "var(--g-radius-sm)" }}
                          >
                            {h.entity_name}
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
              ))
            )}
          </tbody>
        </table>
      </div>

      {data && data.length > 0 && (
        <div className="mt-3 text-xs text-[var(--g-text-secondary)]">
          {data.length} persona{data.length === 1 ? "" : "s"}
          {hasAnyFilter ? " con los filtros aplicados" : ""}
        </div>
      )}
    </div>
  );
}
