import { deriveNominalValue } from "@/lib/secretaria/sociedad-onboarding/defaults";
import type { CapitalDraft, ValidationIssue } from "@/lib/secretaria/sociedad-onboarding/types";
import { NumberField } from "./shared/NumberField";
import { SelectField } from "./shared/SelectField";
import { issueForField } from "./shared/issues";

const TITLE_TYPE_OPTIONS = [
  { value: "ACCION", label: "Accion" },
  { value: "PARTICIPACION", label: "Participacion" },
];

export function StepCapital({
  draft,
  issues,
  onChange,
}: {
  draft: CapitalDraft;
  issues?: ValidationIssue[];
  onChange: (patch: Partial<CapitalDraft>) => void;
}) {
  const updateWithNominal = (patch: Partial<CapitalDraft>) => {
    const next = { ...draft, ...patch };
    const nominal = draft.valor_nominal ? draft.valor_nominal : deriveNominalValue(next.capital_escriturado, next.numero_titulos);
    onChange({ ...patch, valor_nominal: nominal });
  };

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <SelectField
        label="Tipo de titulo"
        value={draft.tipo_titulo}
        options={TITLE_TYPE_OPTIONS}
        onChange={(value) => onChange({ tipo_titulo: value as CapitalDraft["tipo_titulo"] })}
      />
      <NumberField
        label="Capital escriturado"
        value={draft.capital_escriturado}
        onChange={(value) => updateWithNominal({ capital_escriturado: value })}
        issue={issueForField(issues, "capital.capital_escriturado")}
      />
      <NumberField
        label="Capital desembolsado"
        value={draft.capital_desembolsado}
        onChange={(value) => onChange({ capital_desembolsado: value })}
        issue={issueForField(issues, "capital.capital_desembolsado")}
      />
      <NumberField
        label="Numero total de titulos"
        value={draft.numero_titulos}
        onChange={(value) => updateWithNominal({ numero_titulos: value })}
        issue={issueForField(issues, "capital.numero_titulos")}
      />
      <NumberField
        label="Valor nominal"
        value={draft.valor_nominal}
        onChange={(value) => onChange({ valor_nominal: value })}
        step="0.000001"
        issue={issueForField(issues, "capital.valor_nominal")}
      />
      <NumberField
        label="Fecha vigencia"
        type="date"
        value={draft.effective_from}
        onChange={(value) => onChange({ effective_from: value })}
      />
    </div>
  );
}
