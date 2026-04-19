import { BPSection } from "./BPSection";
import { BoardPackAISystem } from "@/hooks/useBoardPackData";

interface BPSistemasIAProps {
  aiSystems: BoardPackAISystem[];
}

// Normaliza los valores de status del DB (mezcla de formatos)
function normalizeCheckStatus(raw: string): "Conforme" | "No conforme" | "En revisión" {
  const s = raw.toUpperCase().replace(" ", "_");
  if (s === "CONFORME") return "Conforme";
  if (s === "NO_CONFORME") return "No conforme";
  return "En revisión";
}

const CHECK_CHIP: Record<"Conforme" | "No conforme" | "En revisión", string> = {
  "Conforme":    "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  "No conforme": "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
  "En revisión": "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
};

function systemNonConformities(system: BoardPackAISystem): number {
  return system.checks.filter(
    (c) => normalizeCheckStatus(c.status) === "No conforme"
  ).length;
}

export function BPSistemasIA({ aiSystems }: BPSistemasIAProps) {
  if (aiSystems.length === 0) {
    return (
      <BPSection title="9. Sistemas IA — EU AI Act">
        <p className="text-sm text-[var(--g-text-secondary)]">
          Sin sistemas de IA de alto riesgo registrados.
        </p>
      </BPSection>
    );
  }

  // Ordenar: más no-conformidades primero
  const sorted = [...aiSystems].sort(
    (a, b) => systemNonConformities(b) - systemNonConformities(a)
  );

  const totalNonConf = sorted.reduce((s, sys) => s + systemNonConformities(sys), 0);

  return (
    <BPSection title="9. Sistemas IA — EU AI Act (Alto Riesgo)">
      {/* Resumen ejecutivo */}
      <div
        className="mb-4 grid grid-cols-3 gap-3 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] p-4"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        <div className="text-center">
          <p className="text-2xl font-bold text-[var(--g-text-primary)]">{sorted.length}</p>
          <p className="text-xs text-[var(--g-text-secondary)]">Sistemas Alto Riesgo</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-[var(--g-text-primary)]">
            {sorted.reduce((s, sys) => s + sys.checks.length, 0)}
          </p>
          <p className="text-xs text-[var(--g-text-secondary)]">Checks EU AI Act</p>
        </div>
        <div className="text-center">
          <p
            className={`text-2xl font-bold ${
              totalNonConf > 0 ? "text-[var(--status-error)]" : "text-[var(--status-success)]"
            }`}
          >
            {totalNonConf}
          </p>
          <p className="text-xs text-[var(--g-text-secondary)]">No conformidades</p>
        </div>
      </div>

      {/* Sistemas */}
      <div className="space-y-4">
        {sorted.map((sys) => {
          const nonConf = systemNonConformities(sys);
          const sortedChecks = [...sys.checks].sort((a, b) => {
            const order = { "No conforme": 0, "En revisión": 1, "Conforme": 2 };
            return (
              (order[normalizeCheckStatus(a.status)] ?? 3) -
              (order[normalizeCheckStatus(b.status)] ?? 3)
            );
          });

          return (
            <div
              key={sys.id}
              className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] overflow-hidden"
              style={{ borderRadius: "var(--g-radius-md)", boxShadow: "var(--g-shadow-card)" }}
            >
              {/* Cabecera sistema */}
              <div className="flex items-center justify-between gap-3 bg-[var(--g-surface-subtle)] px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--g-text-primary)]">{sys.name}</p>
                  <p className="text-xs text-[var(--g-text-secondary)]">
                    {sys.vendor} · {sys.status}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {nonConf > 0 && (
                    <span
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold bg-[var(--status-error)] text-[var(--g-text-inverse)]"
                      style={{ borderRadius: "var(--g-radius-sm)" }}
                    >
                      {nonConf} no conforme{nonConf > 1 ? "s" : ""}
                    </span>
                  )}
                  {nonConf === 0 && (
                    <span
                      className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium bg-[var(--status-success)] text-[var(--g-text-inverse)]"
                      style={{ borderRadius: "var(--g-radius-sm)" }}
                    >
                      Sin no conformidades
                    </span>
                  )}
                  <span className="text-xs font-medium text-[var(--g-brand-3308)]">
                    Alto Riesgo
                  </span>
                </div>
              </div>

              {/* Checks */}
              <div className="divide-y divide-[var(--g-border-subtle)]">
                {sortedChecks.map((c, i) => {
                  const normalized = normalizeCheckStatus(c.status);
                  return (
                    <div key={i} className="flex items-center justify-between gap-3 px-4 py-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="shrink-0 font-mono text-[10px] text-[var(--g-text-secondary)]">
                          {c.requirement_code}
                        </span>
                        <p className="text-xs text-[var(--g-text-primary)] truncate">
                          {c.requirement_title}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 inline-flex items-center px-2 py-0.5 text-[10px] font-medium ${CHECK_CHIP[normalized]}`}
                        style={{ borderRadius: "var(--g-radius-sm)" }}
                      >
                        {normalized}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-[var(--g-text-secondary)]">
        Marco: EU AI Act (Reglamento UE 2024/1689) · Órgano asesor: CATIT
      </p>
    </BPSection>
  );
}
