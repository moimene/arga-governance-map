import { useState } from "react";
import { BookText, TrendingUp, TrendingDown, ArrowLeftRight, FolderOpen, Loader2, Building2 } from "lucide-react";
import { useCapitalMovements } from "@/hooks/useCapitalMovements";
import { useSecretariaScope } from "@/components/secretaria/shell";

const MOVEMENT_LABEL: Record<string, string> = {
  EMISION:          "Emisión",
  AMORTIZACION:     "Amortización",
  TRANSMISION:      "Transmisión",
  PIGNORACION:      "Pignoración",
  LIBERACION_PRENDA: "Liberación de prenda",
  SPLIT:            "Split",
  CONTRASPLIT:      "Contrasplit",
};

const MOVEMENT_ICON: Record<string, typeof TrendingUp> = {
  EMISION:          TrendingUp,
  AMORTIZACION:     TrendingDown,
  TRANSMISION:      ArrowLeftRight,
  PIGNORACION:      BookText,
  LIBERACION_PRENDA: BookText,
  SPLIT:            TrendingUp,
  CONTRASPLIT:      TrendingDown,
};

const MOVEMENT_COLOR: Record<string, string> = {
  EMISION:          "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  AMORTIZACION:     "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
  TRANSMISION:      "bg-[var(--status-info)] text-[var(--g-text-inverse)]",
  PIGNORACION:      "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  LIBERACION_PRENDA: "bg-[var(--g-sec-300)] text-[var(--g-brand-3308)]",
  SPLIT:            "bg-[var(--g-brand-bright)] text-[var(--g-text-inverse)]",
  CONTRASPLIT:      "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]",
};

export default function LibroSocios() {
  const scope = useSecretariaScope();
  const isSociedadMode = scope.mode === "sociedad";
  const selectedEntity = scope.selectedEntity;
  const selectedEntityName = selectedEntity?.legalName ?? selectedEntity?.name ?? "Sociedad seleccionada";
  const scopedEntityId = isSociedadMode ? selectedEntity?.id ?? undefined : undefined;
  const { data = [], isLoading } = useCapitalMovements(scopedEntityId);
  const [filterType, setFilterType] = useState("ALL");

  const filtered = filterType === "ALL"
    ? data
    : data.filter((m) => m.movement_type === filterType);
  const transmissions = data.filter((m) => m.movement_type === "TRANSMISION").length;
  const netShares = data.reduce((sum, movement) => sum + Number(movement.delta_shares ?? 0), 0);
  const latestMovement = data[0]?.effective_date
    ? new Date(data[0].effective_date).toLocaleDateString("es-ES")
    : "—";

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
          <BookText className="h-3.5 w-3.5" />
          Secretaría · Libro de socios
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
          {isSociedadMode ? `Libro de socios de ${selectedEntityName}` : "Libro de socios — Movimientos de capital"}
        </h1>
        <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
          {isSociedadMode
            ? "Movimientos de capital, transmisiones y peso de voto asociados a la sociedad seleccionada."
            : "Registro WORM append-only de movimientos de capital. Cada fila es inmutable."}
        </p>
      </div>

      {isSociedadMode && selectedEntity ? (
        <div
          className="mb-5 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-4 py-4"
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
                <span>{selectedEntity.legalForm}</span>
                <span aria-hidden="true">·</span>
                <span>{selectedEntity.jurisdiction}</span>
                <span aria-hidden="true">·</span>
                <span>{selectedEntity.status}</span>
              </div>
              <p className="mt-2 max-w-3xl text-sm text-[var(--g-text-secondary)]">
                Cada movimiento queda ligado al expediente societario que lo origina, para reconstruir socios, participaciones y derechos de voto.
              </p>
            </div>
            <dl className="grid min-w-full grid-cols-1 gap-3 text-sm sm:min-w-[460px] sm:grid-cols-3 lg:min-w-[520px]">
              <div className="border-l border-[var(--g-border-subtle)] pl-3">
                <dt className="text-xs font-medium text-[var(--g-text-secondary)]">Movimientos</dt>
                <dd className="mt-1 text-lg font-semibold text-[var(--g-text-primary)]">{data.length}</dd>
              </div>
              <div className="border-l border-[var(--g-border-subtle)] pl-3">
                <dt className="text-xs font-medium text-[var(--g-text-secondary)]">Transmisiones</dt>
                <dd className="mt-1 text-lg font-semibold text-[var(--g-text-primary)]">{transmissions}</dd>
              </div>
              <div className="border-l border-[var(--g-border-subtle)] pl-3">
                <dt className="text-xs font-medium text-[var(--g-text-secondary)]">Último asiento</dt>
                <dd className="mt-1 text-lg font-semibold text-[var(--g-text-primary)]">{latestMovement}</dd>
              </div>
            </dl>
          </div>
          <div className="mt-3 text-xs text-[var(--g-text-secondary)]">
            Variación neta de participaciones en el histórico filtrado:{" "}
            <span className="font-semibold text-[var(--g-text-primary)]">
              {netShares.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      ) : null}

      <div className="mb-4">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-1.5 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <option value="ALL">Todos los tipos</option>
          {Object.keys(MOVEMENT_LABEL).map((k) => (
            <option key={k} value={k}>{MOVEMENT_LABEL[k]}</option>
          ))}
        </select>
      </div>

      <div
        className="overflow-x-auto border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="bg-[var(--g-surface-subtle)]">
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Tipo</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Fecha</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Persona / Entidad</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Δ Participaciones</th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Δ Peso voto</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Acuerdo</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">Notas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--g-border-subtle)]">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center">
                  <div className="flex items-center justify-center gap-2 text-sm text-[var(--g-text-secondary)]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando movimientos…
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
                    <FolderOpen className="mb-3 h-10 w-10 text-[var(--g-text-secondary)]/40" />
                    <p className="text-sm font-medium text-[var(--g-text-secondary)]">
                      Sin movimientos registrados.
                    </p>
                    <p className="mt-1 text-xs text-[var(--g-text-secondary)]/70">
                      Los movimientos se registran al completar el tramitador para acuerdos de capital inscribibles.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((m) => {
                const Icon = MOVEMENT_ICON[m.movement_type] ?? BookText;
                const colorClass = MOVEMENT_COLOR[m.movement_type] ?? "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]";
                const deltaShares = Number(m.delta_shares ?? 0);
                const deltaSharesClass =
                  deltaShares > 0
                    ? "text-[var(--status-success)]"
                    : deltaShares < 0
                    ? "text-[var(--status-error)]"
                    : "text-[var(--g-text-secondary)]";
                return (
                  <tr key={m.id} className="transition-colors hover:bg-[var(--g-surface-subtle)]/50">
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium ${colorClass}`}
                        style={{ borderRadius: "var(--g-radius-sm)" }}
                      >
                        <Icon className="h-3 w-3" />
                        {MOVEMENT_LABEL[m.movement_type] ?? m.movement_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">
                      {new Date(m.effective_date).toLocaleDateString("es-ES")}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-[var(--g-text-primary)]">
                        {m.persons?.full_name ?? "—"}
                      </div>
                      {m.persons?.tax_id && (
                        <div className="text-xs text-[var(--g-text-secondary)]">{m.persons.tax_id}</div>
                      )}
                    </td>
                    <td className={`px-6 py-4 text-right text-sm font-mono font-medium ${deltaSharesClass}`}>
                      {deltaShares > 0 ? "+" : ""}{deltaShares.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </td>
                    <td className={`px-6 py-4 text-right text-sm font-mono ${m.delta_voting_weight > 0 ? "text-[var(--status-success)]" : m.delta_voting_weight < 0 ? "text-[var(--status-error)]" : "text-[var(--g-text-secondary)]"}`}>
                      {m.delta_voting_weight > 0 ? "+" : ""}{m.delta_voting_weight.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                    </td>
                    <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">
                      {m.agreements?.agreement_kind ?? "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-[var(--g-text-secondary)]">
                      {m.notas ?? "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
