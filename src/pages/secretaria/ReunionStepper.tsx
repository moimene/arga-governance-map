import { useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { StepperShell, StepDef } from "./_shared/StepperShell";
import { evaluarConstitucion, evaluarMayoria } from "@/lib/rules-engine";

// ── Tipos locales ────────────────────────────────────────────────────────────

type VoteValue = "FAVOR" | "CONTRA" | "ABSTENCION" | "";

interface VoterRow {
  id: string;
  name: string;
  vote: VoteValue;
  conflict_flag: boolean;
  conflict_reason: string;
}

const DEMO_VOTERS: VoterRow[] = [
  { id: "v1", name: "Carlos Ruiz (Presidente)", vote: "", conflict_flag: false, conflict_reason: "" },
  { id: "v2", name: "Lucía Martín (Secretaria)", vote: "", conflict_flag: false, conflict_reason: "" },
  { id: "v3", name: "Ana García", vote: "", conflict_flag: false, conflict_reason: "" },
  { id: "v4", name: "Pedro López", vote: "", conflict_flag: false, conflict_reason: "" },
  { id: "v5", name: "Isabel Sánchez", vote: "", conflict_flag: false, conflict_reason: "" },
];

// ── Paso 5: Votaciones ───────────────────────────────────────────────────────

const ENGINE_V2 = true; // V2 motor de reglas activo (T20 — switch definitivo)

function VotacionesStep() {
  const [voters, setVoters] = useState<VoterRow[]>(DEMO_VOTERS);

  function update(id: string, patch: Partial<VoterRow>) {
    setVoters((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  }

  const favor = voters.filter((v) => v.vote === "FAVOR").length;
  const contra = voters.filter((v) => v.vote === "CONTRA").length;
  const abstencion = voters.filter((v) => v.vote === "ABSTENCION").length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--g-text-secondary)]">
        Registra el sentido del voto de cada miembro. Marca «Conflicto de interés» si el miembro
        tiene un interés que debe declararse. El campo «Motivo» es obligatorio en abstenciones y
        conflictos declarados.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-[var(--g-surface-subtle)]">
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Miembro
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Voto
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Conflicto
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Motivo
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--g-border-subtle)]">
            {voters.map((v) => {
              const needsReason = v.vote === "ABSTENCION" || v.conflict_flag;
              return (
                <tr key={v.id} className="transition-colors hover:bg-[var(--g-surface-subtle)]/30">
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-[var(--g-text-primary)]">
                        {v.name}
                      </span>
                      {v.conflict_flag && (
                        <span
                          className="inline-flex w-fit items-center gap-1 border border-[var(--g-border-subtle)] bg-[var(--g-surface-muted)] px-2 py-0.5 text-xs font-medium text-[var(--status-warning)]"
                          style={{ borderRadius: "var(--g-radius-sm)" }}
                        >
                          <AlertTriangle className="h-3 w-3" />
                          Conflicto declarado
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={v.vote}
                      onChange={(e) => update(v.id, { vote: e.target.value as VoteValue })}
                      className="rounded border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-2 py-1.5 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                      style={{ borderRadius: "var(--g-radius-md)" }}
                    >
                      <option value="">— Sin votar —</option>
                      <option value="FAVOR">A favor</option>
                      <option value="CONTRA">En contra</option>
                      <option value="ABSTENCION">Abstención</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <label className="flex items-center gap-2 text-sm text-[var(--g-text-secondary)]">
                      <input
                        type="checkbox"
                        checked={v.conflict_flag}
                        onChange={(e) => update(v.id, { conflict_flag: e.target.checked })}
                        className="h-4 w-4 accent-[var(--g-brand-3308)]"
                      />
                      Conflicto de interés
                    </label>
                  </td>
                  <td className="px-4 py-3">
                    {needsReason ? (
                      <input
                        type="text"
                        value={v.conflict_reason}
                        onChange={(e) => update(v.id, { conflict_reason: e.target.value })}
                        placeholder={
                          v.vote === "ABSTENCION"
                            ? "Motivo de la abstención…"
                            : "Motivo del conflicto declarado…"
                        }
                        className="w-full rounded border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-2 py-1.5 text-sm text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                        style={{ borderRadius: "var(--g-radius-md)" }}
                      />
                    ) : (
                      <span className="text-xs text-[var(--g-text-secondary)]">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Resumen */}
      <div
        className="flex items-center gap-6 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-4 py-3 text-sm"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        <span className="font-medium text-[var(--g-text-primary)]">Resumen:</span>
        <span className="text-[var(--status-success)]">
          {favor} a favor
        </span>
        <span className="text-[var(--status-error)]">
          {contra} en contra
        </span>
        <span className="text-[var(--g-text-secondary)]">
          {abstencion} abstenciones
        </span>
        {voters.filter((v) => v.conflict_flag).length > 0 && (
          <span className="text-[var(--status-warning)]">
            {voters.filter((v) => v.conflict_flag).length} conflicto(s) declarado(s)
          </span>
        )}
      </div>

      {/* V2 Motor de Reglas Explain Panel */}
      {ENGINE_V2 && (
        <div className="mt-6 space-y-4">
          <div
            className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
            style={{ borderRadius: "var(--g-radius-lg)" }}
          >
            <h3 className="mb-3 text-sm font-semibold text-[var(--g-text-primary)]">
              Evaluación de Mayoría (V2)
            </h3>
            {(() => {
              const result = evaluarMayoria(
                {
                  formula: 'favor > contra',
                  fuente: 'LEY',
                  referencia: 'art. 201 LSC',
                },
                {
                  favor,
                  contra,
                  abstenciones: abstencion,
                  en_blanco: 0,
                  capital_presente: voters.length,
                  capital_total: voters.length,
                  total_miembros: voters.length,
                  miembros_presentes: voters.length,
                }
              );
              return (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {result.alcanzada ? (
                      <CheckCircle2 className="h-4 w-4 text-[var(--status-success)]" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-[var(--status-error)]" />
                    )}
                    <span
                      className={`inline-flex px-2.5 py-1 text-[11px] font-semibold ${
                        result.alcanzada
                          ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
                          : "bg-[var(--status-error)] text-[var(--g-text-inverse)]"
                      }`}
                      style={{ borderRadius: "var(--g-radius-full)" }}
                    >
                      {result.alcanzada ? "OK" : "RECHAZADO"}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--g-text-secondary)]">
                    <span className="font-mono">{result.formula}</span> — Fuente: LSC art. 201
                  </p>
                  <p className="text-xs text-[var(--g-text-primary)]">
                    {result.explain.mensaje}
                  </p>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Steps ────────────────────────────────────────────────────────────────────

const STEPS: StepDef[] = [
  { n: 1, label: "Constitución",  hint: "Verificación de convocatoria previa y validación de presidencia/secretaría" },
  { n: 2, label: "Asistentes",    hint: "Registro de presentes, representados y ausentes — cálculo de capital representado" },
  { n: 3, label: "Quórum",        hint: "Evaluación automática contra regla jurisdiccional aplicable" },
  { n: 4, label: "Debates",       hint: "Puntos del orden del día discutidos y anotaciones del secretario" },
  { n: 5, label: "Votaciones",    hint: "Por cada propuesta aprobada se genera un agreement en estado ADOPTED", body: <VotacionesStep /> },
  { n: 6, label: "Cierre",        hint: "Generación del acta en borrador y firmas pendientes" },
];

export default function ReunionStepper() {
  return (
    <StepperShell
      eyebrow="Secretaría · Reunión"
      title="Asistente de sesión societaria"
      backTo="/secretaria/reuniones"
      steps={STEPS}
      placeholderNote="Formulario del paso pendiente. En el demo se usa la reunión cda-22-04-2026 ya sembrada."
    />
  );
}
