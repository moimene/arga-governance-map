import { useParams, Link } from "react-router-dom";
import { ChevronLeft, Users, Building2 } from "lucide-react";
import { usePersonaCanonical } from "@/hooks/usePersonasCanonical";
import { useCargosPersona, CARGO_LABELS } from "@/hooks/useCargos";
import { useHoldingsPersona } from "@/hooks/useCapitalHoldings";

export default function PersonaDetalle() {
  const { id } = useParams<{ id: string }>();
  const { data: p, isLoading } = usePersonaCanonical(id);
  const { data: cargos } = useCargosPersona(id);
  const { data: holdings } = useHoldingsPersona(id);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1440px] p-6 text-sm text-[var(--g-text-secondary)]">Cargando…</div>
    );
  }
  if (!p) {
    return (
      <div className="mx-auto max-w-[1440px] p-6 text-sm text-[var(--g-text-secondary)]">
        Persona no encontrada.{" "}
        <Link to="/secretaria/personas" className="text-[var(--g-brand-3308)] underline">
          Volver
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <div className="mb-4">
        <Link
          to="/secretaria/personas"
          className="inline-flex items-center gap-1 text-xs text-[var(--g-text-secondary)] hover:text-[var(--g-brand-3308)]"
        >
          <ChevronLeft className="h-3 w-3" /> Personas
        </Link>
      </div>

      <div className="mb-6 flex items-center gap-3">
        <div className="rounded-full bg-[var(--g-sec-100)] p-3">
          <Users className="h-5 w-5 text-[var(--g-brand-3308)]" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
            {p.full_name}
          </h1>
          <p className="text-sm text-[var(--g-text-secondary)]">
            {p.person_type === "PJ" ? "Persona jurídica" : "Persona física"} · {p.tax_id ?? "sin NIF"}
          </p>
        </div>
      </div>

      <section
        className="mb-6 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-6"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--g-text-primary)]">
          Datos de identidad
        </h2>
        <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="ID" value={<code className="text-xs">{p.id}</code>} />
          <Field label="Nombre" value={p.full_name} />
          <Field label="Tipo" value={p.person_type ?? "—"} />
          <Field label="NIF/CIF" value={p.tax_id ?? "—"} />
          <Field label="Email" value={p.email ?? "—"} />
          <Field label="Denominación" value={p.denomination ?? "—"} />
          {p.person_type === "PJ" ? (
            <Field
              label="Representante"
              value={p.representative?.full_name ?? "—"}
            />
          ) : null}
        </dl>
      </section>

      <section
        className="mb-6 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="border-b border-[var(--g-border-subtle)] px-6 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--g-text-primary)]">
            Cargos y condiciones
          </h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="bg-[var(--g-surface-subtle)]">
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Cargo</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Sociedad</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Órgano</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Desde</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Hasta</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--g-border-subtle)]">
            {!cargos || cargos.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-sm text-[var(--g-text-secondary)]">
                  Sin cargos registrados.
                </td>
              </tr>
            ) : (
              cargos.map((c) => {
                const sociedadNombre = c.entity?.common_name ?? c.entity?.legal_name ?? "—";
                return (
                  <tr key={c.id} className="hover:bg-[var(--g-surface-subtle)]/50">
                    <td className="px-6 py-3 text-sm font-semibold text-[var(--g-text-primary)]">
                      {CARGO_LABELS[c.tipo_condicion] ?? c.tipo_condicion}
                    </td>
                    <td className="px-6 py-3 text-sm">
                      {c.entity?.id ? (
                        <Link
                          to={`/secretaria/sociedades/${c.entity.id}`}
                          className="text-[var(--g-brand-3308)] hover:underline"
                        >
                          {sociedadNombre}
                        </Link>
                      ) : (
                        <span className="text-[var(--g-text-secondary)]">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">
                      {c.body?.name ?? "—"}
                    </td>
                    <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">{c.fecha_inicio}</td>
                    <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">
                      {c.fecha_fin ?? "—"}
                    </td>
                    <td className="px-6 py-3 text-sm">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium ${
                          c.estado === "VIGENTE"
                            ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
                            : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
                        }`}
                        style={{ borderRadius: "var(--g-radius-sm)" }}
                      >
                        {c.estado}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      {/* G3: Es socio en — capital_holdings vigentes de esta persona */}
      <section
        className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="border-b border-[var(--g-border-subtle)] px-6 py-3 flex items-center gap-2">
          <Building2 className="h-4 w-4 text-[var(--g-brand-3308)]" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--g-text-primary)]">
            Es socio en
          </h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="bg-[var(--g-surface-subtle)]">
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Sociedad</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Clase</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Títulos</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">% capital</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Desde</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--g-border-subtle)]">
            {!holdings || holdings.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-[var(--g-text-secondary)]">
                  No figura como socio en ninguna sociedad gestionada.
                </td>
              </tr>
            ) : (
              holdings.map((h) => {
                const sociedadNombre = h.entity?.common_name ?? h.entity?.legal_name ?? "—";
                return (
                  <tr key={h.id} className="hover:bg-[var(--g-surface-subtle)]/50">
                    <td className="px-6 py-3 text-sm font-semibold">
                      {h.entity?.id ? (
                        <Link
                          to={`/secretaria/sociedades/${h.entity.id}`}
                          className="text-[var(--g-brand-3308)] hover:underline"
                        >
                          {sociedadNombre}
                        </Link>
                      ) : (
                        <span className="text-[var(--g-text-primary)]">{sociedadNombre}</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">
                      {h.share_class?.class_code ? (
                        <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium bg-[var(--g-sec-100)] text-[var(--g-brand-3308)]"
                          style={{ borderRadius: "var(--g-radius-sm)" }}
                          title={h.share_class.name ?? undefined}
                        >
                          {h.share_class.class_code}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-6 py-3 text-sm text-right text-[var(--g-text-secondary)] tabular-nums">
                      {h.numero_titulos != null ? Number(h.numero_titulos).toLocaleString("es-ES") : "—"}
                    </td>
                    <td className="px-6 py-3 text-sm text-right font-semibold text-[var(--g-text-primary)] tabular-nums">
                      {h.porcentaje_capital != null ? `${Number(h.porcentaje_capital).toFixed(2)}%` : "—"}
                    </td>
                    <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">
                      {h.effective_from ?? "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs uppercase tracking-wider text-[var(--g-text-secondary)]">{label}</dt>
      <dd className="text-sm text-[var(--g-text-primary)]">{value}</dd>
    </div>
  );
}
