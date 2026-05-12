import { Plus, Trash2 } from "lucide-react";
import type { ShareClassDraft, ValidationIssue } from "@/lib/secretaria/sociedad-onboarding/types";
import { CheckboxField } from "./shared/CheckboxField";
import { Field } from "./shared/Field";
import { IssueList } from "./shared/IssueList";
import { issueForField } from "./shared/issues";
import { NumberField } from "./shared/NumberField";

function emptyClass(index: number): ShareClassDraft {
  const code = String.fromCharCode(65 + index);
  return {
    key: `class-${Date.now()}-${index}`,
    class_code: code,
    name: `Clase ${code}`,
    numero_titulos: "",
    votes_per_title: "1",
    economic_rights_coeff: "1",
    voting_rights: true,
    veto_rights: false,
    restrictions: {},
  };
}

export function StepClasesSeries({
  classes,
  issues,
  onChange,
}: {
  classes: ShareClassDraft[];
  issues?: ValidationIssue[];
  onChange: (classes: ShareClassDraft[]) => void;
}) {
  const updateClass = (index: number, patch: Partial<ShareClassDraft>) => {
    onChange(classes.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  return (
    <div className="space-y-4">
      <IssueList issues={(issues ?? []).filter((issue) => issue.code.startsWith("CL-"))} />
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => onChange([...classes, emptyClass(classes.length)])}
          className="inline-flex items-center gap-1.5 bg-[var(--g-brand-3308)] px-3 py-2 text-sm font-semibold text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <Plus className="h-4 w-4" />
          Anadir clase
        </button>
      </div>

      <div className="space-y-3">
        {classes.map((shareClass, index) => (
          <div
            key={shareClass.key}
            className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-[var(--g-text-primary)]">
                {shareClass.class_code || `Clase ${index + 1}`}
              </div>
              <button
                type="button"
                aria-label="Eliminar clase"
                onClick={() => onChange(classes.filter((_, i) => i !== index))}
                className="inline-flex h-8 w-8 items-center justify-center border border-[var(--g-border-subtle)] text-[var(--g-text-secondary)] hover:bg-[var(--g-surface-subtle)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field
                label="Codigo"
                value={shareClass.class_code}
                onChange={(value) => updateClass(index, { class_code: value })}
                issue={issueForField(issues, `shareClasses.${index}.class_code`)}
              />
              <Field
                label="Nombre"
                value={shareClass.name}
                onChange={(value) => updateClass(index, { name: value })}
              />
              <NumberField
                label="Titulos emitidos"
                value={shareClass.numero_titulos}
                onChange={(value) => updateClass(index, { numero_titulos: value })}
                issue={issueForField(issues, "shareClasses.numero_titulos")}
              />
              <NumberField
                label="Votos por titulo"
                value={shareClass.votes_per_title}
                onChange={(value) => updateClass(index, { votes_per_title: value })}
                step="0.000001"
              />
              <NumberField
                label="Coeficiente economico"
                value={shareClass.economic_rights_coeff}
                onChange={(value) => updateClass(index, { economic_rights_coeff: value })}
                step="0.000001"
              />
              <div className="flex flex-col gap-3 pt-5">
                <CheckboxField
                  label="Derechos de voto"
                  checked={shareClass.voting_rights}
                  onChange={(value) => updateClass(index, { voting_rights: value })}
                />
                <CheckboxField
                  label="Derecho de veto"
                  checked={shareClass.veto_rights}
                  onChange={(value) => updateClass(index, { veto_rights: value })}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
