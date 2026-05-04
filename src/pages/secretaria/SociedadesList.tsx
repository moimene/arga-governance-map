import { Building2, Plus, Search, X } from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { useState } from "react";
import { useSecretariaScope } from "@/components/secretaria/shell";
import { useSociedades } from "@/hooks/useSociedades";

const STATUS_CHIP: Record<string, string> = {
  Active:   "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  Activa:   "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  Inactive: "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]",
  Inactiva: "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]",
};

function entityStatusLabel(status: string | null): string {
  if (!status) return "Activa";
  return (
    {
      Active: "Activa",
      Activa: "Activa",
      Inactive: "Inactiva",
      Inactiva: "Inactiva",
    } as Record<string, string>
  )[status] ?? status.replace(/_/g, " ");
}

function tipoSocialLabel(s: string | null): string {
  if (!s) return "—";
  return (
    {
      SA: "S.A.",
      SL: "S.L.",
      SLU: "S.L.U. (unipersonal)",
      SAU: "S.A.U. (unipersonal)",
    } as Record<string, string>
  )[s] ?? s;
}

function tipoOrganoLabel(s: string | null): string {
  if (!s) return "—";
  return (
    {
      ADMIN_UNICO: "Administrador único",
      SOLIDARIO: "Solidarios",
      MANCOMUNADO: "Mancomunados",
      CONSEJO: "Consejo de Administración",
    } as Record<string, string>
  )[s] ?? s;
}

export default function SociedadesList() {
  const scope = useSecretariaScope();
  const { data, isLoading } = useSociedades();
  const [search, setSearch] = useState("");

  if (scope.mode === "sociedad" && scope.selectedEntity) {
    return (
      <Navigate
        replace
        to={scope.createScopedTo(`/secretaria/sociedades/${scope.selectedEntity.id}`)}
      />
    );
  }

  const filtered = (data ?? []).filter((s) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      (s.common_name ?? "").toLowerCase().includes(q) ||
      s.legal_name.toLowerCase().includes(q) ||
      (s.registration_number ?? "").toLowerCase().includes(q) ||
      (s.jurisdiction ?? "").toLowerCase().includes(q)
    );
  });
  const totalSociedades = data?.length ?? 0;
  const cotizadasCount = (data ?? []).filter((s) => s.es_cotizada).length;
  const clearSearch = () => setSearch("");

  return (
    <div className="mx-auto max-w-[1440px] p-4 sm:p-6">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
            <Building2 className="h-3.5 w-3.5" />
            Secretaría · Gestión societaria
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
            Sociedades
          </h1>
          <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
            Catálogo de sociedades del grupo con modelo canónico de identidad, capital y órganos.
          </p>
        </div>
        <Link
          to="/secretaria/sociedades/nueva"
          className="inline-flex w-full items-center justify-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-semibold text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] sm:w-auto"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <Plus className="h-4 w-4" />
          Nueva sociedad
        </Link>
      </div>

      <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div
          className="flex min-w-0 items-center gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 focus-within:ring-2 focus-within:ring-[var(--g-border-focus)] focus-within:ring-offset-2 focus-within:ring-offset-[var(--g-surface-page)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <Search className="h-4 w-4 shrink-0 text-[var(--g-text-secondary)]" />
          <input
            aria-label="Buscar sociedad"
            type="search"
            placeholder="Buscar por nombre, NIF o jurisdicción"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm text-[var(--g-text-primary)] outline-none placeholder:text-[var(--g-text-secondary)]"
          />
          {search ? (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Limpiar búsqueda de sociedades"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-[var(--g-text-secondary)] transition-colors hover:bg-[var(--g-surface-subtle)] hover:text-[var(--g-text-primary)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--g-text-secondary)]">
          <span
            className="inline-flex items-center border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-2.5 py-1"
            style={{ borderRadius: "var(--g-radius-full)" }}
          >
            {filtered.length} de {totalSociedades} sociedades
          </span>
          <span
            className="inline-flex items-center bg-[var(--g-sec-100)] px-2.5 py-1 font-medium text-[var(--g-brand-3308)]"
            style={{ borderRadius: "var(--g-radius-full)" }}
          >
            {cotizadasCount} cotizada{cotizadasCount === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <div
        data-testid="sociedades-mobile-list"
        className="space-y-3 lg:hidden"
      >
        {isLoading ? (
          <div
            className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-4 py-6 text-center text-sm text-[var(--g-text-secondary)]"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            Cargando sociedades...
          </div>
        ) : filtered.length === 0 ? (
          <div
            className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-4 py-6 text-center text-sm text-[var(--g-text-secondary)]"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            {search ? "Ninguna sociedad coincide con la búsqueda." : "No hay sociedades registradas."}
          </div>
        ) : (
          filtered.map((s) => (
            <Link
              key={s.id}
              to={`/secretaria/sociedades/${s.id}`}
              className="block border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-4 py-4 transition-colors hover:bg-[var(--g-surface-subtle)]/50"
              style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="break-words text-sm font-semibold text-[var(--g-text-primary)]">
                    {s.common_name ?? s.legal_name}
                  </h2>
                  <p className="mt-1 break-words text-xs text-[var(--g-text-secondary)]">
                    {s.legal_name}
                  </p>
                </div>
                <span
                  className={`shrink-0 px-2 py-1 text-[11px] font-medium ${
                    STATUS_CHIP[s.entity_status ?? "Active"] ?? STATUS_CHIP.Active
                  }`}
                  style={{ borderRadius: "var(--g-radius-sm)" }}
                >
                  {entityStatusLabel(s.entity_status)}
                </span>
              </div>

              <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium text-[var(--g-text-secondary)]">Tipo social</dt>
                  <dd className="mt-1 text-[var(--g-text-primary)]">{tipoSocialLabel(s.tipo_social)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-[var(--g-text-secondary)]">Jurisdicción</dt>
                  <dd className="mt-1 text-[var(--g-text-primary)]">{s.jurisdiction ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-[var(--g-text-secondary)]">Órgano de administración</dt>
                  <dd className="mt-1 text-[var(--g-text-primary)]">{tipoOrganoLabel(s.tipo_organo_admin)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-[var(--g-text-secondary)]">Registro</dt>
                  <dd className="mt-1 break-words text-[var(--g-text-primary)]">{s.registration_number ?? "—"}</dd>
                </div>
              </dl>

              {s.es_cotizada ? (
                <span
                  className="mt-4 inline-flex items-center bg-[var(--g-sec-100)] px-2 py-0.5 text-[11px] font-medium text-[var(--g-brand-3308)]"
                  style={{ borderRadius: "var(--g-radius-full)" }}
                >
                  Sociedad cotizada
                </span>
              ) : null}
            </Link>
          ))
        )}
      </div>

      <div
        data-testid="sociedades-desktop-table"
        className="hidden overflow-hidden border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] lg:block"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <table className="w-full">
          <thead>
            <tr className="bg-[var(--g-surface-subtle)]">
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Denominación</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Tipo social</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Jurisdicción</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Órgano admin.</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Estado</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Registro</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--g-border-subtle)]">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-sm text-[var(--g-text-secondary)]">
                  Cargando…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-sm text-[var(--g-text-secondary)]">
                  {search ? "Ninguna sociedad coincide con la búsqueda." : "No hay sociedades registradas."}
                </td>
              </tr>
            ) : (
              filtered.map((s) => (
                <tr
                  key={s.id}
                  className="hover:bg-[var(--g-surface-subtle)]/50 transition-colors"
                >
                  <td className="px-6 py-4 text-sm">
                    <Link
                      to={`/secretaria/sociedades/${s.id}`}
                      className="font-semibold text-[var(--g-text-primary)] hover:text-[var(--g-brand-3308)]"
                    >
                      {s.common_name ?? s.legal_name}
                    </Link>
                    <div className="text-xs text-[var(--g-text-secondary)]">{s.legal_name}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">
                    {tipoSocialLabel(s.tipo_social)}
                    {s.es_cotizada ? (
                      <span
                        className="ml-2 inline-flex items-center bg-[var(--g-sec-100)] px-2 py-0.5 text-[10px] font-medium text-[var(--g-brand-3308)]"
                        style={{ borderRadius: "var(--g-radius-full)" }}
                      >
                        Cotizada
                      </span>
                    ) : null}
                  </td>
                  <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">{s.jurisdiction ?? "—"}</td>
                  <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">
                    {tipoOrganoLabel(s.tipo_organo_admin)}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`inline-flex items-center px-2 py-1 text-[11px] font-medium ${
                        STATUS_CHIP[s.entity_status ?? "Active"] ?? STATUS_CHIP.Active
                      }`}
                      style={{ borderRadius: "var(--g-radius-sm)" }}
                    >
                      {entityStatusLabel(s.entity_status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">
                    {s.registration_number ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
