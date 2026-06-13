import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import {
  evaluarPactosParasociales,
  type PactoParasocial,
  type PactosEvalInput,
} from "@/lib/rules-engine/pactos-engine";

// ITEM-113 — Panel de cumplimiento de pactos parasociales para los flujos SIN
// SESIÓN (acuerdo sin sesión, co-aprobación, administrador solidario). Hasta
// ahora los pactos solo se evaluaban en el Flujo A (reunión) porque los
// steppers sin sesión no pasaban inputs.pactos. Este panel cablea
// usePactosVigentes → evaluarPactosParasociales con la materia normalizada
// (la normalización vive en materia-pacto-mapping.ts) para que un veto de
// operación estructural (p. ej. Fundación ARGA sobre FUSION/ESCISION) dispare
// su advertencia/bloqueo contractual también en estos flujos.
//
// El incumplimiento de un pacto es CONTRACTUAL (art. 29 LSC), no invalidez
// societaria: se reporta como advertencia, en canal separado del veredicto
// societario del motor LSC.

interface PactosCompliancePanelProps {
  pactos: PactoParasocial[];
  /** Materia del acuerdo (grafía operativa; se normaliza internamente). */
  materia: string;
  /**
   * Capital presente/representado en el proceso. En flujos sin sesión el
   * capital no siempre es relevante (consejo k-de-n); por defecto se usa un
   * proxy 100/100 que basta para evaluar VETO/CONSENTIMIENTO (basados en
   * materia), aunque MAYORIA_REFORZADA_PACTADA requeriría cifras reales.
   */
  capitalPresente?: number;
  capitalTotal?: number;
  votosFavor?: number;
  votosContra?: number;
  consentimientosPrevios?: string[];
  vetoRenunciado?: string[];
}

export function PactosCompliancePanel({
  pactos,
  materia,
  capitalPresente = 100,
  capitalTotal = 100,
  votosFavor = 0,
  votosContra = 0,
  consentimientosPrevios = [],
  vetoRenunciado = [],
}: PactosCompliancePanelProps) {
  const result = useMemo(() => {
    if (!pactos || pactos.length === 0 || !materia) return null;
    const input: PactosEvalInput = {
      materias: [materia],
      capitalPresente,
      capitalTotal,
      votosFavor,
      votosContra,
      consentimientosPrevios,
      vetoRenunciado,
    };
    return evaluarPactosParasociales(pactos, input);
  }, [
    pactos,
    materia,
    capitalPresente,
    capitalTotal,
    votosFavor,
    votosContra,
    consentimientosPrevios,
    vetoRenunciado,
  ]);

  if (!result || result.pactos_aplicables === 0) {
    return null;
  }

  const incumple = !result.pacto_ok || result.blocking_issues.length > 0;

  return (
    <div
      className={`space-y-2 border p-4 ${
        incumple
          ? "border-[var(--status-warning)] bg-[var(--g-surface-muted)]"
          : "border-[var(--g-border-subtle)] bg-[var(--g-sec-100)]"
      }`}
      style={{ borderRadius: "var(--g-radius-md)" }}
    >
      <div className="flex items-center gap-2">
        {incumple ? (
          <ShieldAlert className="h-5 w-5 text-[var(--status-warning)]" />
        ) : (
          <CheckCircle2 className="h-5 w-5 text-[var(--status-success)]" />
        )}
        <div className="text-sm font-semibold text-[var(--g-text-primary)]">
          {incumple
            ? "Incumplimiento de pacto parasocial (contractual)"
            : "Pactos parasociales cumplidos"}
        </div>
      </div>
      <p className="text-xs text-[var(--g-text-secondary)]">
        {result.pactos_aplicables} pacto(s) aplicable(s) a esta materia;{" "}
        {result.pactos_incumplidos} incumplimiento(s) contractual(es). El
        incumplimiento de un pacto no invalida el acuerdo societario (art. 29
        LSC), pero genera responsabilidad inter partes.
      </p>

      {result.blocking_issues.length > 0 && (
        <div className="space-y-1">
          {result.blocking_issues.map((issue, i) => (
            <div
              key={i}
              className="flex items-start gap-2 text-sm text-[var(--g-text-primary)]"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-warning)]" />
              {issue}
            </div>
          ))}
        </div>
      )}

      {result.warnings.length > 0 && (
        <div className="space-y-1">
          {result.warnings.map((w, i) => (
            <div
              key={i}
              className="flex items-start gap-2 text-xs text-[var(--g-text-secondary)]"
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--status-warning)]" />
              {w}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
