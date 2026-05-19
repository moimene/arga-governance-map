import { Plus, Trash2 } from "lucide-react";
import { deriveCapitalPct } from "@/lib/secretaria/sociedad-onboarding/builders";
import type { CapTableEntryDraft, PersonaDraft, ShareClassDraft, ValidationIssue } from "@/lib/secretaria/sociedad-onboarding/types";
import { CheckboxField } from "./shared/CheckboxField";
import { IssueList } from "./shared/IssueList";
import { issueForField } from "./shared/issues";
import { NumberField } from "./shared/NumberField";
import { PersonaPicker } from "./shared/PersonaPicker";
import { SelectField } from "./shared/SelectField";

function emptyHolding(index: number, shareClasses: ShareClassDraft[]): CapTableEntryDraft {
  return {
    key: `holding-${Date.now()}-${index}`,
    holder: null,
    share_class_code: shareClasses[0]?.class_code ?? "",
    numero_titulos: "",
    voting_rights: true,
    is_treasury: false,
  };
}

export function StepCapTable({
  entries,
  shareClasses,
  totalTitles,
  issues,
  onChange,
}: {
  entries: CapTableEntryDraft[];
  shareClasses: ShareClassDraft[];
  totalTitles: string;
  issues?: ValidationIssue[];
  onChange: (entries: CapTableEntryDraft[]) => void;
}) {
  const updateEntry = (index: number, patch: Partial<CapTableEntryDraft>) => {
    onChange(entries.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  };

  const classOptions = shareClasses.map((shareClass) => ({
    value: shareClass.class_code,
    label: `${shareClass.class_code} - ${shareClass.name}`,
  }));

  return (
    <div className="space-y-4">
      <IssueList issues={(issues ?? []).filter((issue) => issue.code.startsWith("CT-") || issue.code === "P-001")} />
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => onChange([...entries, emptyHolding(entries.length, shareClasses)])}
          className="inline-flex items-center gap-1.5 bg-[var(--g-brand-3308)] px-3 py-2 text-sm font-semibold text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <Plus className="h-4 w-4" />
          Anadir socio
        </button>
      </div>

      {entries.map((entry, index) => (
        <div
          key={entry.key}
          data-testid={`cap-table-card-${index}`}
          className="space-y-4 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-[var(--g-text-primary)]">
              {entry.is_treasury ? "Autocartera" : entry.holder?.full_name || "Socio"}
            </div>
            <button
              type="button"
              aria-label="Eliminar socio"
              onClick={() => onChange(entries.filter((_, i) => i !== index))}
              className="inline-flex h-8 w-8 items-center justify-center border border-[var(--g-border-subtle)] text-[var(--g-text-secondary)] hover:bg-[var(--g-surface-subtle)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          <CheckboxField
            id={`cap-table-${index}-autocartera`}
            label="Autocartera"
            checked={entry.is_treasury}
            onChange={(is_treasury) => updateEntry(index, { is_treasury, holder: is_treasury ? null : entry.holder, voting_rights: is_treasury ? false : entry.voting_rights })}
          />

          {!entry.is_treasury ? (
            <PersonaPicker
              label="Socio"
              idPrefix={`cap-table-${index}-socio`}
              value={entry.holder}
              onChange={(holder) => updateEntry(index, { holder })}
              issue={issueForField(issues, `capTable.${entry.key}.holder`)}
            />
          ) : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <SelectField
              id={`cap-table-${index}-clase`}
              label="Clase"
              value={entry.share_class_code}
              options={classOptions}
              onChange={(share_class_code) => updateEntry(index, { share_class_code })}
            />
            <NumberField
              id={`cap-table-${index}-titulos`}
              label="Titulos"
              value={entry.numero_titulos}
              onChange={(numero_titulos) => updateEntry(index, { numero_titulos })}
            />
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">% Capital</span>
              <div className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-muted)] px-3 py-2 text-sm text-[var(--g-text-primary)]" style={{ borderRadius: "var(--g-radius-md)" }}>
                {deriveCapitalPct(entry.numero_titulos, totalTitles)?.toFixed(2) ?? "0.00"}%
              </div>
            </div>
            <CheckboxField
              id={`cap-table-${index}-derechos-voto`}
              label="Derechos de voto"
              checked={entry.voting_rights}
              disabled={entry.is_treasury}
              onChange={(voting_rights) => updateEntry(index, { voting_rights })}
            />
          </div>

          {!entry.is_treasury && entry.holder?.person_type === "PJ" && entry.voting_rights ? (
            <PersonaPicker
              label="Representante de junta"
              idPrefix={`cap-table-${index}-representante-junta`}
              personType="PF"
              value={(entry.representante_junta as PersonaDraft | null) ?? null}
              onChange={(representante_junta) => updateEntry(index, { representante_junta })}
              issue={issueForField(issues, `capTable.${entry.key}.representante_junta`)}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}
