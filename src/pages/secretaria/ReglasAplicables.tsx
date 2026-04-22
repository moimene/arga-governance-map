import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { BookMarked, ChevronLeft, ShieldCheck, ScrollText, GitBranch, Scale } from "lucide-react";
import { useSociedad } from "@/hooks/useSociedades";
import { useReglasAplicables, type ReglasPack } from "@/hooks/useReglasAplicables";

export default function ReglasAplicables() {
  const { id: entityId } = useParams<{ id: string }>();
  const { data: sociedad } = useSociedad(entityId);
  const { data: reglas, isLoading } = useReglasAplicables(entityId);

  const packs = useMemo(() => reglas ?? [], [reglas]);
  const count = {
    LEY: packs.filter((p) => p.source === "LEY").length,
    ESTATUTOS: packs.filter((p) => p.source === "ESTATUTOS").length,
    PACTO: packs.filter((p) => p.source === "PACTO").length,
    REGLAMENTO: packs.filter((p) => p.source === "REGLAMENTO").length,
  };

  return (
    <div className="mx-auto max-w-[1200px] p-6">
      <div className="mb-4">
        <Link
          to={entityId ? `/secretaria/sociedades/${entityId}` : "/secretaria/sociedades"}
          className="inline-flex items-center gap-1 text-xs text-[var(--g-text-secondary)] hover:text-[var(--g-brand-3308)]"
        >
          <ChevronLeft className="h-3 w-3" /> {sociedad?.common_name ?? "Sociedad"}
        </Link>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
          <BookMarked className="h-3.5 w-3.5" />
          Secretaría · Reglas aplicables
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
          Reglas aplicables a {sociedad?.common_name ?? sociedad?.legal_name ?? "…"}
        </h1>
        <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
          Jerarquía: LEY → ESTATUTOS → PACTO PARASOCIAL → REGLAMENTO. Los niveles inferiores pueden
          reforzar (mayor quórum, mayor mayoría) pero no pueden contradecir la ley imperativa.
        </p>
      </div>

      {/* Resumen por fuente */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <SourceCard icon={Scale} label="LEY (LSC)" n={count.LEY} tone="brand" />
        <SourceCard icon={ScrollText} label="ESTATUTOS" n={count.ESTATUTOS} tone="default" />
        <SourceCard icon={GitBranch} label="PACTO" n={count.PACTO} tone="default" />
        <SourceCard icon={ShieldCheck} label="REGLAMENTO" n={count.REGLAMENTO} tone="default" />
      </div>

      {isLoading ? (
        <div className="p-6 text-sm text-[var(--g-text-secondary)]">Cargando reglas aplicables…</div>
      ) : packs.length === 0 ? (
        <div className="rounded-md border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-6 text-sm text-[var(--g-text-secondary)]">
          No hay packs resueltos para esta sociedad todavía. Ejecuta el motor LSC desde cualquier
          materia (convocatoria, reunión, acuerdo) para que los packs queden materializados.
        </div>
      ) : (
        <div
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <table className="w-full">
            <thead>
              <tr className="bg-[var(--g-surface-subtle)]">
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                  Fuente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                  Pack
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                  Versión
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                  Jurisdicción
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                  Materia
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                  Nota
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--g-border-subtle)]">
              {packs.map((p) => (
                <tr key={`${p.source}-${p.pack_id}-${p.version ?? "v?"}`} className="hover:bg-[var(--g-surface-subtle)]/50">
                  <td className="px-6 py-3 text-sm">
                    <SourceBadge source={p.source} />
                  </td>
                  <td className="px-6 py-3 text-sm font-semibold text-[var(--g-text-primary)]">{p.pack_code}</td>
                  <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">{p.version ?? "—"}</td>
                  <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">{p.jurisdiction ?? "—"}</td>
                  <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">{p.materia ?? "—"}</td>
                  <td className="px-6 py-3 text-sm text-[var(--g-text-secondary)]">{p.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 rounded-md border border-[var(--g-border-subtle)] bg-[var(--g-sec-100)] p-4 text-xs text-[var(--g-text-primary)]">
        <p className="font-semibold text-[var(--g-brand-3308)]">Cómo se resuelve la regla efectiva</p>
        <ol className="mt-2 list-decimal pl-5 text-[var(--g-text-secondary)]">
          <li>
            <strong>LEY (LSC)</strong> fija el mínimo imperativo y el régimen supletorio.
          </li>
          <li>
            <strong>ESTATUTOS</strong> puede elevar o concretar dentro de los límites legales.
          </li>
          <li>
            <strong>PACTO PARASOCIAL</strong> añade cláusulas obligacionales (veto, refuerzos de mayoría).
          </li>
          <li>
            <strong>REGLAMENTO</strong> ordena aspectos internos sin vincular a terceros.
          </li>
        </ol>
      </div>
    </div>
  );
}

function SourceCard({
  icon: Icon,
  label,
  n,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  n: number;
  tone: "brand" | "default";
}) {
  return (
    <div
      className={`border p-4 ${
        tone === "brand"
          ? "border-[var(--g-brand-3308)]/20 bg-[var(--g-sec-100)]"
          : "border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
      }`}
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-[var(--g-brand-3308)]" />
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
          {label}
        </div>
      </div>
      <div className="mt-1 text-2xl font-semibold text-[var(--g-text-primary)]">{n}</div>
      <div className="text-[11px] text-[var(--g-text-secondary)]">pack{n === 1 ? "" : "s"} activos</div>
    </div>
  );
}

function SourceBadge({ source }: { source: ReglasPack["source"] }) {
  const styles: Record<ReglasPack["source"], string> = {
    LEY: "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]",
    ESTATUTOS: "bg-[var(--g-sec-100)] text-[var(--g-brand-3308)]",
    PACTO: "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
    REGLAMENTO: "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium ${styles[source]}`}
      style={{ borderRadius: "var(--g-radius-sm)" }}
    >
      {source}
    </span>
  );
}
