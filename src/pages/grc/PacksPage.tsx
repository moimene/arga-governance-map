import { useCountryPacks } from "@/hooks/useCountryPacks";
import { Link } from "react-router-dom";
import { Globe2 } from "lucide-react";

const FLAG: Record<string, string> = { ES: "🇪🇸", BR: "🇧🇷", MX: "🇲🇽" };

export default function PacksPage() {
  const { data: packs = [], isLoading } = useCountryPacks();

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center gap-2">
        <Globe2 className="h-5 w-5 text-[var(--g-brand-3308)]" />
        <div>
          <h1 className="text-2xl font-bold text-[var(--g-text-primary)]">Packs por País</h1>
          <p className="text-sm text-[var(--g-text-secondary)]">
            Rule packs y dashboards locales de cumplimiento regulatorio por geografía.
          </p>
        </div>
      </header>

      {isLoading && (
        <div className="text-sm text-[var(--g-text-secondary)] animate-pulse">Cargando packs…</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {packs.map((p) => (
          <Link key={p.id} to={`/grc/packs/${p.country_code}`}>
            <div
              className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-5 hover:border-[var(--g-brand-3308)] transition-all"
              style={{
                borderRadius: "var(--g-radius-lg)",
                boxShadow: "var(--g-shadow-card)",
              }}
            >
              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">{FLAG[p.country_code] || "🏳"}</span>
                <div>
                  <div className="text-base font-bold text-[var(--g-text-primary)]">
                    {p.pack_name}
                  </div>
                  <div className="text-xs text-[var(--g-text-secondary)]">{p.country_code}</div>
                </div>
                <span
                  className={`ml-auto text-xs font-medium px-2 py-0.5 ${
                    p.is_active
                      ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
                      : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]"
                  }`}
                  style={{ borderRadius: "var(--g-radius-full)" }}
                >
                  {p.is_active ? "Activo" : "Inactivo"}
                </span>
              </div>

              {/* Módulos */}
              <div className="mb-3">
                <div className="text-xs font-semibold uppercase text-[var(--g-text-secondary)] mb-2">
                  Módulos activos
                </div>
                <div className="flex flex-wrap gap-1">
                  {(p.active_modules ?? []).map((m: string) => (
                    <span
                      key={m}
                      className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]"
                      style={{ borderRadius: "var(--g-radius-full)" }}
                    >
                      {m.toUpperCase()}
                    </span>
                  ))}
                </div>
              </div>

              {/* Frameworks */}
              <div>
                <div className="text-xs font-semibold uppercase text-[var(--g-text-secondary)] mb-2">
                  Frameworks
                </div>
                <div className="flex flex-wrap gap-1">
                  {(p.pack_rules ?? []).map((r) => (
                    <span
                      key={r.framework_code}
                      className="inline-flex items-center px-2 py-0.5 text-xs font-medium border border-[var(--g-border-default)] text-[var(--g-text-primary)] bg-transparent"
                      style={{ borderRadius: "var(--g-radius-full)" }}
                    >
                      {r.framework_code}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
