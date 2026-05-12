import { ADMIN_BY_TIPO_ORGANO } from "@/lib/secretaria/sociedad-onboarding/defaults";
import type { ProfileDraft, TipoOrganoAdmin, ValidationIssue } from "@/lib/secretaria/sociedad-onboarding/types";
import { CheckboxField } from "./shared/CheckboxField";
import { Field } from "./shared/Field";
import { SelectField, type SelectOption } from "./shared/SelectField";
import { issueForField } from "./shared/IssueList";

const ORGANO_OPTIONS = [
  { value: "CDA", label: "Consejo de Administracion" },
  { value: "ADMIN_UNICO", label: "Administrador unico" },
  { value: "ADMIN_SOLIDARIOS", label: "Administradores solidarios" },
  { value: "ADMIN_MANCOMUNADOS", label: "Administradores mancomunados" },
];

const SECTOR_OPTIONS = [
  { value: "", label: "Sin sector regulado especifico" },
  { value: "SEGUROS", label: "Seguros" },
  { value: "BANCA", label: "Banca" },
  { value: "ENERGIA", label: "Energia" },
  { value: "TELECOM", label: "Telecom" },
  { value: "OTRO", label: "Otro" },
];

const GROUP_ROLE_OPTIONS = [
  { value: "INDEPENDIENTE", label: "Independiente" },
  { value: "MATRIZ", label: "Matriz" },
  { value: "FILIAL", label: "Filial" },
  { value: "PARTICIPADA", label: "Participada" },
];

export function StepPerfilGrupo({
  draft,
  issues,
  parentOptions = [],
  unipersonalLocked,
  onChange,
}: {
  draft: ProfileDraft;
  issues?: ValidationIssue[];
  parentOptions?: SelectOption[];
  unipersonalLocked: boolean;
  onChange: (patch: Partial<ProfileDraft>) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <SelectField
        label="Organo de administracion"
        value={draft.tipo_organo_admin}
        options={ORGANO_OPTIONS}
        onChange={(value) => {
          const tipo = value as TipoOrganoAdmin;
          onChange({ tipo_organo_admin: tipo, forma_administracion: ADMIN_BY_TIPO_ORGANO[tipo] });
        }}
        issue={issueForField(issues, "profile.tipo_organo_admin")}
      />
      <SelectField
        label="Sector regulado"
        value={draft.regulated_sector}
        options={SECTOR_OPTIONS}
        onChange={(value) => onChange({ regulated_sector: value as ProfileDraft["regulated_sector"] })}
      />
      <SelectField
        label="Rol en grupo"
        value={draft.group_role}
        options={GROUP_ROLE_OPTIONS}
        onChange={(value) => onChange({ group_role: value as ProfileDraft["group_role"] })}
      />
      <SelectField
        label="Matriz"
        value={draft.parent_entity_id}
        options={[{ value: "", label: "Sin matriz declarada" }, ...parentOptions]}
        onChange={(value) => onChange({ parent_entity_id: value })}
      />
      <Field
        label="Porcentaje ownership"
        type="number"
        value={draft.ownership_percentage}
        onChange={(value) => onChange({ ownership_percentage: value })}
      />
      <div className="flex flex-col gap-3">
        <CheckboxField
          label="Sociedad unipersonal"
          checked={draft.es_unipersonal}
          disabled={unipersonalLocked}
          onChange={(value) => onChange({ es_unipersonal: value })}
        />
        <CheckboxField
          label="Sociedad cotizada"
          checked={draft.es_cotizada}
          onChange={(value) => onChange({ es_cotizada: value })}
        />
      </div>
    </div>
  );
}
