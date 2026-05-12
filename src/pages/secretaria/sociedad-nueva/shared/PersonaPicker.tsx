import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { usePersonasCanonical } from "@/hooks/usePersonasCanonical";
import type { PersonaDraft, PersonType, ValidationIssue } from "@/lib/secretaria/sociedad-onboarding/types";
import { Field } from "./Field";
import { SelectField } from "./SelectField";

export function PersonaPicker({
  label,
  value,
  onChange,
  personType,
  issue,
}: {
  label: string;
  value: PersonaDraft | null;
  onChange: (value: PersonaDraft | null) => void;
  personType?: PersonType;
  issue?: ValidationIssue;
}) {
  const [mode, setMode] = useState<"existing" | "new">(value?.key?.startsWith("new-") ? "new" : "existing");
  const [search, setSearch] = useState("");
  const { data = [], isLoading } = usePersonasCanonical({ person_type: personType, search });

  const options = useMemo(
    () => [
      { value: "", label: isLoading ? "Cargando personas..." : "Seleccionar persona" },
      ...data.map((person) => ({
        value: person.id,
        label: `${person.denomination ?? person.full_name} · ${person.tax_id ?? "sin NIF"}`,
      })),
    ],
    [data, isLoading],
  );

  const selectedId = value && !value.key.startsWith("new-") ? value.key : "";

  const selectExisting = (id: string) => {
    if (!id) {
      onChange(null);
      return;
    }
    const person = data.find((item) => item.id === id);
    if (!person) return;
    onChange({
      key: person.id,
      tax_id: person.tax_id ?? "",
      full_name: person.full_name,
      denomination: person.denomination,
      email: person.email,
      person_type: person.person_type ?? personType ?? "PF",
    });
  };

  const updateNew = (patch: Partial<PersonaDraft>) => {
    onChange({
      key: value?.key?.startsWith("new-") ? value.key : `new-${Date.now()}`,
      tax_id: value?.tax_id ?? "",
      full_name: value?.full_name ?? "",
      denomination: value?.denomination ?? "",
      email: value?.email ?? "",
      person_type: personType ?? value?.person_type ?? "PF",
      ...patch,
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">{label}</div>
        <div className="inline-flex border border-[var(--g-border-subtle)]" style={{ borderRadius: "var(--g-radius-md)" }}>
          <button
            type="button"
            onClick={() => setMode("existing")}
            className={`inline-flex items-center gap-1 px-2 py-1 text-xs ${
              mode === "existing"
                ? "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]"
                : "bg-[var(--g-surface-card)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
            }`}
          >
            <Search className="h-3 w-3" />
            Existente
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("new");
              if (!value?.key?.startsWith("new-")) updateNew({});
            }}
            className={`inline-flex items-center gap-1 px-2 py-1 text-xs ${
              mode === "new"
                ? "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]"
                : "bg-[var(--g-surface-card)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
            }`}
          >
            <Plus className="h-3 w-3" />
            Nueva
          </button>
        </div>
      </div>

      {mode === "existing" ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <Field label="Buscar" value={search} onChange={setSearch} />
          <SelectField label="Persona" value={selectedId} options={options} onChange={selectExisting} issue={issue} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Nombre" value={value?.full_name ?? ""} onChange={(full_name) => updateNew({ full_name })} issue={issue} />
          <Field label="NIF/CIF" value={value?.tax_id ?? ""} onChange={(tax_id) => updateNew({ tax_id })} />
          {personType === "PJ" ? (
            <Field label="Denominacion" value={value?.denomination ?? ""} onChange={(denomination) => updateNew({ denomination })} />
          ) : null}
          <Field label="Email" type="email" value={value?.email ?? ""} onChange={(email) => updateNew({ email })} />
        </div>
      )}
    </div>
  );
}
