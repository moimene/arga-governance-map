import { CheckCircle2 } from "lucide-react";
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
  onCreate,
}: {
  draft: SociedadOnboardingDraft;
  validation: ValidationResult;
  saving: boolean;
  onCreate: () => void;
}) {
  const status = projectedStatus(validation);
  const canCreate = validation.blocking.length === 0;
  const allIssues = [...validation.blocking, ...validation.blockingOperational, ...validation.warnings];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Summary label="Denominacion" value={draft.identification.legal_name || "-"} />
        <Summary label="NIF/CIF" value={draft.identification.tax_id || "-"} />
        <Summary label="Estado proyectado" value={status} />
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
