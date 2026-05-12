import { applyTipoSocialDefaults } from "@/lib/secretaria/sociedad-onboarding/defaults";
import type { IdentificationDraft, SociedadOnboardingDraft, TipoSocial, ValidationIssue } from "@/lib/secretaria/sociedad-onboarding/types";
import { Field } from "./shared/Field";
import { SelectField } from "./shared/SelectField";
import { issueForField } from "./shared/issues";

const TIPO_SOCIAL_OPTIONS = [
  { value: "SA", label: "S.A. - Sociedad Anonima" },
  { value: "SL", label: "S.L. - Sociedad Limitada" },
  { value: "SAU", label: "S.A.U. - Sociedad Anonima unipersonal" },
  { value: "SLU", label: "S.L.U. - Sociedad Limitada unipersonal" },
];

export function StepIdentificacionLegal({
  draft,
  fullDraft,
  issues,
  onChange,
  onDraftChange,
}: {
  draft: IdentificationDraft;
  fullDraft: SociedadOnboardingDraft;
  issues?: ValidationIssue[];
  onChange: (patch: Partial<IdentificationDraft>) => void;
  onDraftChange: (draft: SociedadOnboardingDraft) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Field
        label="Denominacion legal"
        value={draft.legal_name}
        onChange={(value) => onChange({ legal_name: value })}
        issue={issueForField(issues, "identification.legal_name")}
      />
      <Field
        label="Nombre comun"
        value={draft.common_name}
        onChange={(value) => onChange({ common_name: value })}
      />
      <Field
        label="NIF/CIF"
        value={draft.tax_id}
        onChange={(value) => onChange({ tax_id: value })}
        issue={issueForField(issues, "identification.tax_id")}
      />
      <SelectField
        label="Tipo social"
        value={draft.tipo_social}
        options={TIPO_SOCIAL_OPTIONS}
        onChange={(value) => onDraftChange(applyTipoSocialDefaults(fullDraft, value as TipoSocial))}
        issue={issueForField(issues, "identification.tipo_social")}
      />
      <Field
        label="Jurisdiccion"
        value={draft.jurisdiction}
        onChange={(value) => onChange({ jurisdiction: value })}
        issue={issueForField(issues, "identification.jurisdiction")}
      />
      <Field
        label="Fecha constitucion"
        type="date"
        value={draft.constitution_date}
        onChange={(value) => onChange({ constitution_date: value })}
      />
      <Field
        label="Fecha registro"
        type="date"
        value={draft.registration_date}
        onChange={(value) => onChange({ registration_date: value })}
      />
    </div>
  );
}
