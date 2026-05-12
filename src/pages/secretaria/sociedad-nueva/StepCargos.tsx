import { Plus, Trash2 } from "lucide-react";
import type { BodyKey, CargoInputDraft, FuenteDesignacion, TipoCondicionOnboarding, ValidationIssue } from "@/lib/secretaria/sociedad-onboarding/types";
import { Field } from "./shared/Field";
import { IssueList } from "./shared/IssueList";
import { issueForField } from "./shared/issues";
import { PersonaPicker } from "./shared/PersonaPicker";
import { SelectField } from "./shared/SelectField";

const CARGO_OPTIONS: Array<{ value: TipoCondicionOnboarding; label: string }> = [
  { value: "PRESIDENTE", label: "Presidente" },
  { value: "SECRETARIO", label: "Secretario" },
  { value: "VICEPRESIDENTE", label: "Vicepresidente" },
  { value: "CONSEJERO", label: "Consejero" },
  { value: "CONSEJERO_COORDINADOR", label: "Consejero coordinador" },
  { value: "ADMIN_UNICO", label: "Administrador unico" },
  { value: "ADMIN_SOLIDARIO", label: "Administrador solidario" },
  { value: "ADMIN_MANCOMUNADO", label: "Administrador mancomunado" },
  { value: "ADMIN_PJ", label: "Administrador PJ" },
];

const FUENTE_OPTIONS: Array<{ value: FuenteDesignacion; label: string }> = [
  { value: "ESCRITURA", label: "Escritura" },
  { value: "ACTA_NOMBRAMIENTO", label: "Acta nombramiento" },
  { value: "DECISION_UNIPERSONAL", label: "Decision unipersonal" },
  { value: "BOOTSTRAP", label: "Bootstrap demo" },
];

function defaultBodyKey(tipo: TipoCondicionOnboarding): BodyKey | null {
  return ["ADMIN_UNICO", "ADMIN_SOLIDARIO", "ADMIN_MANCOMUNADO", "ADMIN_PJ", "SOCIO"].includes(tipo) ? null : "CDA";
}

function emptyCargo(index: number): CargoInputDraft {
  return {
    key: `cargo-${Date.now()}-${index}`,
    tipo_condicion: "CONSEJERO",
    bodyKey: "CDA",
    persona: null,
    fecha_inicio: new Date().toISOString().slice(0, 10),
    fuente_designacion: "ESCRITURA",
  };
}

export function StepCargos({
  cargos,
  issues,
  onChange,
}: {
  cargos: CargoInputDraft[];
  issues?: ValidationIssue[];
  onChange: (cargos: CargoInputDraft[]) => void;
}) {
  const updateCargo = (index: number, patch: Partial<CargoInputDraft>) => {
    onChange(cargos.map((cargo, i) => (i === index ? { ...cargo, ...patch } : cargo)));
  };

  return (
    <div className="space-y-4">
      <IssueList issues={(issues ?? []).filter((issue) => ["CA-001", "CA-002", "CA-003", "AU-001", "AU-002", "PJ-001"].includes(issue.code))} />
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => onChange([...cargos, emptyCargo(cargos.length)])}
          className="inline-flex items-center gap-1.5 bg-[var(--g-brand-3308)] px-3 py-2 text-sm font-semibold text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <Plus className="h-4 w-4" />
          Anadir cargo
        </button>
      </div>

      {cargos.map((cargo, index) => (
        <div
          key={cargo.key}
          className="space-y-4 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-[var(--g-text-primary)]">{cargo.tipo_condicion}</div>
            <button
              type="button"
              aria-label="Eliminar cargo"
              onClick={() => onChange(cargos.filter((_, i) => i !== index))}
              className="inline-flex h-8 w-8 items-center justify-center border border-[var(--g-border-subtle)] text-[var(--g-text-secondary)] hover:bg-[var(--g-surface-subtle)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <SelectField
              label="Cargo"
              value={cargo.tipo_condicion}
              options={CARGO_OPTIONS}
              onChange={(value) => {
                const tipo = value as TipoCondicionOnboarding;
                updateCargo(index, { tipo_condicion: tipo, bodyKey: defaultBodyKey(tipo) });
              }}
            />
            <SelectField
              label="Fuente"
              value={cargo.fuente_designacion}
              options={FUENTE_OPTIONS}
              onChange={(value) => updateCargo(index, { fuente_designacion: value as FuenteDesignacion })}
            />
            <Field
              label="Fecha inicio"
              type="date"
              value={cargo.fecha_inicio}
              onChange={(fecha_inicio) => updateCargo(index, { fecha_inicio })}
            />
          </div>

          <PersonaPicker
            label="Persona"
            personType={cargo.tipo_condicion === "ADMIN_PJ" ? "PJ" : undefined}
            value={cargo.persona}
            onChange={(persona) => updateCargo(index, { persona })}
          />

          {cargo.tipo_condicion === "ADMIN_PJ" ? (
            <PersonaPicker
              label="Representante permanente PF"
              personType="PF"
              value={cargo.persona?.representante ?? null}
              onChange={(representante) => {
                if (!cargo.persona) return;
                updateCargo(index, { persona: { ...cargo.persona, representante } });
              }}
              issue={issueForField(issues, `cargos.${cargo.key}.persona.representante`)}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}
