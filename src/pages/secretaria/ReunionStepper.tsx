import { useState } from "react";
import { AlertTriangle, CheckCircle2, FileText, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { StepperShell, StepDef } from "./_shared/StepperShell";
import { evaluarMayoria } from "@/lib/rules-engine";

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

// ── Paso 6: Cierre ───────────────────────────────────────────────────────────

const DEMO_RESOLUTIONS = [
  { id: "r1", titulo: "Aprobación de cuentas anuales ejercicio 2025", resultado: "APROBADO" },
  { id: "r2", titulo: "Aplicación del resultado del ejercicio", resultado: "APROBADO" },
  { id: "r3", titulo: "Nombramiento auditor externo 2026", resultado: "APROBADO" },
];

function CierreStep() {
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  function handleConfirmar() {
    setConfirming(true);
    setTimeout(() => {
      setConfirming(false);
      setConfirmed(true);
    }, 1200);
  }

  if (confirmed) {
    return (
      <div className="space-y-4">
        <div
          className="flex items-center gap-3 border border-[var(--status-success)] bg-[var(--g-sec-100)] p-4"
          style={{ borderRadius: "var(--g-radius-lg)" }}
        >
          <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--status-success)]" />
          <div>
            <p className="text-sm font-semibold text-[var(--g-text-primary)]">
              Acta generada en borrador
            </p>
            <p className="mt-0.5 text-xs text-[var(--g-text-secondary)]">
              {DEMO_RESOLUTIONS.length} acuerdo(s) registrado(s) en estado ADOPTED. Procede a firmar
              el acta y emitir la certificación desde el módulo de Actas.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate("/secretaria/actas")}
          className="inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2.5 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <FileText className="h-4 w-4" />
          Ir a Actas
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-[var(--g-text-secondary)]">
        Revisa los acuerdos adoptados antes de confirmar el cierre. Al confirmar, se generará el
        acta en borrador y los acuerdos quedarán registrados en estado{" "}
        <span className="font-medium text-[var(--g-text-primary)]">ADOPTED</span>.
      </p>

      <div
        className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="border-b border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-4 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-primary)]">
            Acuerdos a registrar ({DEMO_RESOLUTIONS.length})
          </p>
        </div>
        <ul className="divide-y divide-[var(--g-border-subtle)]">
          {DEMO_RESOLUTIONS.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <span className="text-sm text-[var(--g-text-primary)]">{r.titulo}</span>
              <span
                className="shrink-0 px-2.5 py-1 text-[11px] font-semibold text-[var(--g-text-inverse)]"
                style={{
                  borderRadius: "var(--g-radius-full)",
                  backgroundColor: "var(--status-success)",
                }}
              >
                {r.resultado}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div
        className="flex items-start gap-3 border-l-4 border-[var(--status-warning)] bg-[var(--g-surface-muted)] p-4"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-warning)]" />
        <p className="text-xs text-[var(--g-text-secondary)]">
          Esta acción no se puede deshacer desde la interfaz. Si necesitas modificar algún acuerdo
          tras el cierre, contacta con el administrador del sistema.
        </p>
      </div>

      <button
        type="button"
        onClick={handleConfirmar}
        disabled={confirming}
        aria-busy={confirming}
        className="inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2.5 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] disabled:opacity-50"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        {confirming ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Generando acta…
          </>
        ) : (
          <>
            <FileText className="h-4 w-4" />
            Confirmar cierre y generar acta
          </>
        )}
      </button>
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
  { n: 6, label: "Cierre",        hint: "Revisión de acuerdos adoptados y generación del acta en borrador", body: <CierreStep /> },
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
