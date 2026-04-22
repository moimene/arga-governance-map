import { Users, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { usePersonasCanonical, type PersonType } from "@/hooks/usePersonasCanonical";

export default function PersonasList() {
  const [personType, setPersonType] = useState<PersonType | "">("");
  const [search, setSearch] = useState("");
  const { data, isLoading } = usePersonasCanonical({
    person_type: personType || undefined,
    search,
  });

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <div className="mb-6">
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

      <div className="mb-4 flex items-center gap-2">
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
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Denominación</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--g-border-subtle)]">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-[var(--g-text-secondary)]">
                  Cargando…
                </td>
              </tr>
            ) : !data || data.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-[var(--g-text-secondary)]">
                  {search || personType
                    ? "Ninguna persona coincide con los filtros."
                    : "No hay personas registradas."}
                </td>
              </tr>
            ) : (
              data.map((p) => (
                <tr key={p.id} className="hover:bg-[var(--g-surface-subtle)]/50">
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
                  <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">{p.email ?? "—"}</td>
                  <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">
                    {p.denomination ?? "—"}
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
