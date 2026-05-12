import type { RegistryDraft, ValidationIssue } from "@/lib/secretaria/sociedad-onboarding/types";
import { Field } from "./shared/Field";
import { issueForField } from "./shared/IssueList";

export function StepDomicilioCnaeRegistro({
  draft,
  issues,
  onChange,
}: {
  draft: RegistryDraft;
  issues?: ValidationIssue[];
  onChange: (patch: Partial<RegistryDraft>) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Calle" value={draft.address_street} onChange={(value) => onChange({ address_street: value })} issue={issueForField(issues, "registry.address")} />
        <Field label="Numero" value={draft.address_number} onChange={(value) => onChange({ address_number: value })} issue={issueForField(issues, "registry.address")} />
        <Field label="Piso" value={draft.address_floor} onChange={(value) => onChange({ address_floor: value })} />
        <Field label="Codigo postal" value={draft.postal_code} onChange={(value) => onChange({ postal_code: value })} issue={issueForField(issues, "registry.address")} />
        <Field label="Ciudad" value={draft.city} onChange={(value) => onChange({ city: value })} issue={issueForField(issues, "registry.address")} />
        <Field label="Provincia" value={draft.province} onChange={(value) => onChange({ province: value })} />
        <Field label="Pais" value={draft.country} onChange={(value) => onChange({ country: value })} issue={issueForField(issues, "registry.address")} />
        <Field label="CNAE principal" value={draft.cnae_primary} onChange={(value) => onChange({ cnae_primary: value })} issue={issueForField(issues, "registry.cnae_primary")} />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="CNAE secundarios" value={draft.cnae_secondary.join(", ")} onChange={(value) => onChange({ cnae_secondary: value.split(",").map((item) => item.trim()).filter(Boolean) })} />
        <Field label="Registro Mercantil" value={draft.registry_location} onChange={(value) => onChange({ registry_location: value })} />
        <Field label="Tomo" value={draft.registry_volume} onChange={(value) => onChange({ registry_volume: value })} />
        <Field label="Folio" value={draft.registry_folio} onChange={(value) => onChange({ registry_folio: value })} />
        <Field label="Hoja" value={draft.registry_sheet} onChange={(value) => onChange({ registry_sheet: value })} />
        <Field label="Inscripcion" value={draft.registry_inscription} onChange={(value) => onChange({ registry_inscription: value })} />
        <Field label="LEI" value={draft.lei_code} onChange={(value) => onChange({ lei_code: value })} />
        <Field label="Cierre fiscal" value={draft.fiscal_year_close} onChange={(value) => onChange({ fiscal_year_close: value })} issue={issueForField(issues, "registry.fiscal_year_close")} />
        <Field label="Duracion" value={draft.duration} onChange={(value) => onChange({ duration: value })} />
        <Field label="Web" value={draft.website} onChange={(value) => onChange({ website: value })} />
        <Field label="Email corporativo" type="email" value={draft.corporate_email} onChange={(value) => onChange({ corporate_email: value })} />
      </div>
      <Field
        label="Objeto social"
        value={draft.corporate_purpose}
        onChange={(value) => onChange({ corporate_purpose: value })}
      />
    </div>
  );
}
