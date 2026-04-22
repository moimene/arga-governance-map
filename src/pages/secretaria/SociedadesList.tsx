import { Building2, Plus, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { useSociedades } from "@/hooks/useSociedades";

const STATUS_CHIP: Record<string, string> = {
  Active:   "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  Activa:   "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  Inactive: "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]",
  Inactiva: "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]",
};

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
  const { data, isLoading } = useSociedades();
  const [search, setSearch] = useState("");
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

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <div className="mb-6 flex items-end justify-between gap-4">
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
          className="inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-semibold text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <Plus className="h-4 w-4" />
          Nueva sociedad
        </Link>
      </div>

      <div
        className="mb-4 flex items-center gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        <Search className="h-4 w-4 text-[var(--g-text-secondary)]" />
        <input
          aria-label="Buscar sociedad"
          type="search"
          placeholder="Buscar por nombre, NIF o jurisdicción…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-transparent text-sm text-[var(--g-text-primary)] outline-none placeholder:text-[var(--g-text-secondary)]"
        />
      </div>

      <div
        className="overflow-hidden border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
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
                      <span className="ml-2 inline-flex items-center rounded-full bg-[var(--g-sec-100)] px-2 py-0.5 text-[10px] font-medium text-[var(--g-brand-3308)]">
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
                      {s.entity_status ?? "Active"}
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
