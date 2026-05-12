import type { RulesDraft, ValidationIssue } from "@/lib/secretaria/sociedad-onboarding/types";
import { CheckboxField } from "./shared/CheckboxField";
import { Field } from "./shared/Field";
import { issueForField } from "./shared/issues";
import { NumberField } from "./shared/NumberField";

export function StepReglas({
  draft,
  issues,
  onChange,
}: {
  draft: RulesDraft;
  issues?: ValidationIssue[];
  onChange: (patch: Partial<RulesDraft>) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <NumberField label="Quorum primera convocatoria" value={draft.quorum_primera_pct} onChange={(quorum_primera_pct) => onChange({ quorum_primera_pct })} />
      <NumberField label="Quorum segunda convocatoria" value={draft.quorum_segunda_pct} onChange={(quorum_segunda_pct) => onChange({ quorum_segunda_pct })} />
      <NumberField label="Mayoria simple" value={draft.mayoria_simple_pct} onChange={(mayoria_simple_pct) => onChange({ mayoria_simple_pct })} />
      <NumberField
        label="Mayoria reforzada"
        value={draft.mayoria_reforzada_pct}
        onChange={(mayoria_reforzada_pct) => onChange({ mayoria_reforzada_pct })}
        issue={issueForField(issues, "rules.mayoria_reforzada_pct")}
      />
      <NumberField label="Dias convocatoria" value={draft.convocatoria_dias} onChange={(convocatoria_dias) => onChange({ convocatoria_dias })} />
      <Field label="Medio convocatoria" value={draft.convocatoria_medio} onChange={(convocatoria_medio) => onChange({ convocatoria_medio })} />
      <CheckboxField label="Voto de calidad presidente" checked={draft.voto_calidad_presidente} onChange={(voto_calidad_presidente) => onChange({ voto_calidad_presidente })} />
      <Field label="Restricciones transmision" value={draft.restricciones_transmision} onChange={(restricciones_transmision) => onChange({ restricciones_transmision })} />
    </div>
  );
}
