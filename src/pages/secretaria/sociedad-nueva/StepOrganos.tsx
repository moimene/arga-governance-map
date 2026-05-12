import type { OrganosDraft, ValidationIssue } from "@/lib/secretaria/sociedad-onboarding/types";
import { CheckboxField } from "./shared/CheckboxField";
import { NumberField } from "./shared/NumberField";
import { issueForField } from "./shared/IssueList";

export function StepOrganos({
  draft,
  isConsejo,
  issues,
  onChange,
}: {
  draft: OrganosDraft;
  isConsejo: boolean;
  issues?: ValidationIssue[];
  onChange: (patch: Partial<OrganosDraft>) => void;
}) {
  const updateComisiones = (patch: Partial<OrganosDraft["comisiones"]>) => {
    onChange({ comisiones: { ...draft.comisiones, ...patch } });
  };

  return (
    <div className="space-y-5">
      <CheckboxField
        label="Junta General / Socio Unico"
        checked={draft.junta_enabled}
        onChange={(junta_enabled) => onChange({ junta_enabled })}
      />
      {issueForField(issues, "organos.junta_enabled") ? (
        <div className="text-sm font-medium text-[var(--status-error)]">
          {issueForField(issues, "organos.junta_enabled")?.message}
        </div>
      ) : null}

      {isConsejo ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <NumberField label="Consejeros minimo" value={draft.consejo_min} onChange={(consejo_min) => onChange({ consejo_min })} />
          <NumberField label="Consejeros maximo" value={draft.consejo_max} onChange={(consejo_max) => onChange({ consejo_max })} />
        </div>
      ) : null}

      {isConsejo ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <CheckboxField label="Comision de Auditoria" checked={draft.comisiones.auditoria} onChange={(auditoria) => updateComisiones({ auditoria })} />
          <CheckboxField label="Comision de Nombramientos" checked={draft.comisiones.nombramientos} onChange={(nombramientos) => updateComisiones({ nombramientos })} />
          <CheckboxField label="Comision de Retribuciones" checked={draft.comisiones.retribuciones} onChange={(retribuciones) => updateComisiones({ retribuciones })} />
          <CheckboxField label="Comision de Riesgos" checked={draft.comisiones.riesgos} onChange={(riesgos) => updateComisiones({ riesgos })} />
        </div>
      ) : null}
    </div>
  );
}
