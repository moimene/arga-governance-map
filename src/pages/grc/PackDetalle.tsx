import { useParams, Link } from "react-router-dom";
import { useCountryPackDetail } from "@/hooks/useCountryPacks";
import { ArrowLeft } from "lucide-react";

const FLAG: Record<string, string> = { ES: "🇪🇸", BR: "🇧🇷", MX: "🇲🇽" };

export default function PackDetalle() {
  const { countryCode = "ES" } = useParams();
  const { data, isLoading } = useCountryPackDetail(countryCode);

  if (isLoading) {
    return (
      <div className="p-6 text-sm text-[var(--g-text-secondary)] animate-pulse">
        Cargando pack…
      </div>
    );
  }

  if (!data?.pack) {
    return (
      <div className="p-6">
        <p className="text-sm text-[var(--g-text-secondary)]">Pack no encontrado para {countryCode}.</p>
        <Link to="/grc/packs" className="text-sm text-[var(--g-link)] underline mt-2 inline-block">
          ← Volver a packs
        </Link>
      </div>
    );
  }

  const { pack, kpis } = data;

  const moduleTarget: Record<string, string> = {
    dora: "/grc/m/dora/operate/incidents",
    gdpr: "/grc/m/gdpr/operate/ropa",
    cyber: "/grc/m/cyber/operate/vulnerabilities",
    audit: "/grc/m/audit/operate/findings",
  };

  return (
    <div className="p-6 space-y-6">
      {/* Back + header */}
      <header>
        <Link
          to="/grc/packs"
          className="inline-flex items-center gap-1 text-sm text-[var(--g-link)] hover:text-[var(--g-link-hover)] mb-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Packs por País
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-4xl">{FLAG[pack.country_code] || "🏳"}</span>
          <div>
            <h1 className="text-2xl font-bold text-[var(--g-text-primary)]">{pack.pack_name}</h1>
            <p className="text-sm text-[var(--g-text-secondary)]">
              Cumplimiento local · {pack.country_code}
            </p>
          </div>
          <span
            className={`ml-auto text-xs font-medium px-2.5 py-1 ${
              pack.is_active
                ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
                : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]"
            }`}
            style={{ borderRadius: "var(--g-radius-full)" }}
          >
            {pack.is_active ? "Activo" : "Inactivo"}
          </span>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            label: `Incidentes abiertos (${pack.country_code})`,
            value: kpis.incidentsOpen,
            tone: "warning",
          },
          { label: "Riesgos altos (grupo)", value: kpis.risksHigh, tone: "danger" },
          {
            label: `Notif. pendientes`,
            value: kpis.regNotsPending,
            tone: "danger",
          },
        ].map((k) => (
          <div
            key={k.label}
            className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-4"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="text-xs text-[var(--g-text-secondary)] uppercase tracking-wider mb-1">
              {k.label}
            </div>
            <div className="text-3xl font-bold text-[var(--g-text-primary)]">{k.value}</div>
          </div>
        ))}
      </div>

      {/* Módulos activos */}
      <div
        className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-5"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <h2 className="text-sm font-semibold text-[var(--g-text-primary)] mb-3">
          Módulos activos
        </h2>
        <div className="flex flex-wrap gap-2">
          {(pack.active_modules ?? []).map((m: string) => (
            <Link
              key={m}
              to={moduleTarget[m] ?? `/grc/m/${m}`}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] transition-colors"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              {m.toUpperCase()}
            </Link>
          ))}
        </div>
      </div>

      {/* Frameworks table */}
      <div
        className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)]"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="px-5 py-4 border-b border-[var(--g-border-subtle)]">
          <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">
            Frameworks regulatorios
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--g-surface-subtle)]">
                <th className="px-5 py-3 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">
                  Framework
                </th>
                <th className="px-5 py-3 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">
                  Vigente desde
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--g-border-subtle)]">
              {(pack.pack_rules ?? []).map((r) => (
                <tr
                  key={r.framework_code}
                  className="hover:bg-[var(--g-surface-subtle)]/50 transition-colors"
                >
                  <td className="px-5 py-3 font-medium text-[var(--g-text-primary)]">
                    {r.framework_code}
                  </td>
                  <td className="px-5 py-3 text-[var(--g-text-secondary)]">
                    {r.effective_date ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
