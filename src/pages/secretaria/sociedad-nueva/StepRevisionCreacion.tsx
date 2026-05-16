import { CheckCircle2 } from "lucide-react";
import { LEGAL_BASELINE_BY_TIPO_SOCIAL } from "@/lib/secretaria/mesa-control-societaria";
import type { OnboardingStatus, SociedadOnboardingDraft, ValidationResult } from "@/lib/secretaria/sociedad-onboarding/types";
import { IssueList } from "./shared/IssueList";

function projectedStatus(result: ValidationResult): OnboardingStatus {
  if (result.blockingOperational.length > 0) return "INCOMPLETA_DATOS";
  return "INCOMPLETA_CARGOS";
}

export function StepRevisionCreacion({
  draft,
  validation,
  saving,
  disabled = false,
  onCreate,
}: {
  draft: SociedadOnboardingDraft;
  validation: ValidationResult;
  saving: boolean;
  disabled?: boolean;
  onCreate: () => void;
}) {
  const status = projectedStatus(validation);
  const canCreate = validation.blocking.length === 0 && !disabled;
  const allIssues = [...validation.blocking, ...validation.blockingOperational, ...validation.warnings];
  const baseline = LEGAL_BASELINE_BY_TIPO_SOCIAL[draft.identification.tipo_social];
  const overrides = [
    draft.rules.override_mayoria_reforzada_pct ? `Mayoría reforzada ${draft.rules.override_mayoria_reforzada_pct}%` : null,
    draft.rules.override_quorum_primera_pct ? `Quórum ${draft.rules.override_quorum_primera_pct}%` : null,
    draft.rules.override_convocatoria_dias ? `Convocatoria ${draft.rules.override_convocatoria_dias} días` : null,
  ].filter(Boolean);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Summary label="Denominacion" value={draft.identification.legal_name || "-"} />
        <Summary label="NIF/CIF" value={draft.identification.tax_id || "-"} />
        <Summary label="Estado proyectado" value={status} />
      </div>
      <div
        className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="text-sm font-semibold text-[var(--g-text-primary)]">
          Marco normativo inicial
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <Summary label="Suelo legal" value={`${draft.identification.jurisdiction} · ${draft.identification.tipo_social}`} />
          <Summary label="Convocatoria legal" value={`${baseline.noticeDays} días`} />
          <Summary label="Mayoría reforzada legal" value={`${baseline.reinforcedMajorityPct}%`} />
        </div>
        <div className="mt-3 text-sm text-[var(--g-text-secondary)]">
          {draft.rules.estatutos_modelados ? "Reglas estatutarias añadidas" : "Estatutos no modelados: aplican reglas legales por defecto"}
          {" · "}
          {draft.rules.reglamento_organo_modelado ? "Reglamento de órgano modelado" : "Sin reglamento de órgano modelado"}
          {" · "}
          {draft.rules.pactos_modelados ? "Pactos parasociales modelados" : "Pactos no modelados"}
        </div>
        <div className="mt-2 text-sm text-[var(--g-text-primary)]">
          {overrides.length > 0 ? overrides.join(" · ") : "Sin requisitos elevados en el alta."}
        </div>
      </div>
      <IssueList issues={allIssues} />
      <button
        type="button"
        onClick={onCreate}
        disabled={!canCreate || saving}
        aria-busy={saving}
        className="inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-semibold text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] disabled:opacity-40"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        <CheckCircle2 className="h-4 w-4" />
        {saving ? "Creando sociedad" : "Crear sociedad"}
      </button>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-3" style={{ borderRadius: "var(--g-radius-md)" }}>
      <div className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">{label}</div>
      <div className="mt-1 text-sm font-semibold text-[var(--g-text-primary)]">{value}</div>
    </div>
  );
}
