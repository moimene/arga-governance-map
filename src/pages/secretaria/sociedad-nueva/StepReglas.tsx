import { FileText, Landmark, Layers, Scale, ShieldCheck } from "lucide-react";
import {
  LEGAL_BASELINE_BY_TIPO_SOCIAL,
  validateNormativeOverrideDraft,
} from "@/lib/secretaria/mesa-control-societaria";
import type { RulesDraft, TipoSocial, ValidationIssue } from "@/lib/secretaria/sociedad-onboarding/types";
import { CheckboxField } from "./shared/CheckboxField";
import { Field } from "./shared/Field";
import { IssueList } from "./shared/IssueList";
import { issueForField } from "./shared/issues";
import { NumberField } from "./shared/NumberField";

const OVERRIDE_MATERIAS = [
  { value: "MODIFICACION_ESTATUTOS", label: "Modificación de estatutos" },
  { value: "AUMENTO_CAPITAL", label: "Aumento de capital" },
  { value: "REDUCCION_CAPITAL", label: "Reducción de capital" },
  { value: "FUSION", label: "Fusión" },
  { value: "NOMBRAMIENTO_CONSEJERO", label: "Nombramiento de consejero" },
  { value: "APROBACION_CUENTAS", label: "Aprobación de cuentas" },
];

export function StepReglas({
  draft,
  tipoSocial,
  jurisdiction,
  issues,
  onChange,
}: {
  draft: RulesDraft;
  tipoSocial: TipoSocial;
  jurisdiction: string;
  issues?: ValidationIssue[];
  onChange: (patch: Partial<RulesDraft>) => void;
}) {
  const baseline = LEGAL_BASELINE_BY_TIPO_SOCIAL[tipoSocial] ?? LEGAL_BASELINE_BY_TIPO_SOCIAL.SL;
  const normativeValidation = validateNormativeOverrideDraft({
    tipoSocial,
    estatutosModelados: draft.estatutos_modelados,
    reglamentoModelado: draft.reglamento_organo_modelado,
    pactosModelados: draft.pactos_modelados || draft.pactos_no_modelados_ack,
    statutoryMajorityPct: draft.override_mayoria_reforzada_pct,
    statutoryQuorumPct: draft.override_quorum_primera_pct,
    noticeDays: draft.override_convocatoria_dias,
    sourceReference: draft.override_referencia,
    sourceJustification: draft.override_justificacion,
  });

  return (
    <div className="space-y-6">
      <section
        className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="flex items-start gap-3">
          <Landmark className="mt-0.5 h-5 w-5 text-[var(--g-brand-3308)]" />
          <div>
            <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">
              Suelo legal aplicable
            </h2>
            <p className="mt-1 text-sm leading-6 text-[var(--g-text-secondary)]">
              Al crear la sociedad se asigna automáticamente el régimen legal de {jurisdiction || "la jurisdicción indicada"} para {tipoSocial}.
              Los estatutos o reglamentos pueden elevar requisitos, pero no rebajar mínimos imperativos.
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <BaselineCard label="Convocatoria" value={`${baseline.noticeDays} días`} />
          <BaselineCard label="Mayoría ordinaria" value={`${baseline.ordinaryMajorityPct}%`} />
          <BaselineCard label="Mayoría reforzada" value={`${baseline.reinforcedMajorityPct}%`} />
          <BaselineCard label="Quórum referencia" value={`${baseline.firstQuorumPct}%`} />
        </div>
        <p className="mt-3 text-xs text-[var(--g-text-secondary)]">{baseline.legalReference}</p>
      </section>

      <section
        className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--g-text-primary)]">
          <Scale className="h-4 w-4 text-[var(--g-brand-3308)]" />
          Reglas iniciales de funcionamiento
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <NumberField label="Quórum primera convocatoria" value={draft.quorum_primera_pct} onChange={(quorum_primera_pct) => onChange({ quorum_primera_pct })} />
          <NumberField label="Quórum segunda convocatoria" value={draft.quorum_segunda_pct} onChange={(quorum_segunda_pct) => onChange({ quorum_segunda_pct })} />
          <NumberField label="Mayoría simple" value={draft.mayoria_simple_pct} onChange={(mayoria_simple_pct) => onChange({ mayoria_simple_pct })} />
          <NumberField
            label="Mayoría reforzada general"
            value={draft.mayoria_reforzada_pct}
            onChange={(mayoria_reforzada_pct) => onChange({ mayoria_reforzada_pct })}
            issue={issueForField(issues, "rules.mayoria_reforzada_pct")}
          />
          <NumberField label="Días de convocatoria" value={draft.convocatoria_dias} onChange={(convocatoria_dias) => onChange({ convocatoria_dias })} />
          <Field label="Medio de convocatoria" value={draft.convocatoria_medio} onChange={(convocatoria_medio) => onChange({ convocatoria_medio })} />
          <CheckboxField label="Voto de calidad del presidente" checked={draft.voto_calidad_presidente} onChange={(voto_calidad_presidente) => onChange({ voto_calidad_presidente })} />
          <Field label="Restricciones de transmisión" value={draft.restricciones_transmision} onChange={(restricciones_transmision) => onChange({ restricciones_transmision })} />
        </div>
      </section>

      <section
        className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--g-text-primary)]">
          <ShieldCheck className="h-4 w-4 text-[var(--g-brand-3308)]" />
          Fuentes normativas de la sociedad
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <CheckboxField
            label="Estatutos modelados"
            checked={draft.estatutos_modelados}
            onChange={(estatutos_modelados) => onChange({ estatutos_modelados })}
            help={draft.estatutos_modelados ? "Se registrarán reglas estatutarias añadidas si las informas abajo." : "Estatutos no modelados: aplican reglas legales por defecto."}
          />
          <CheckboxField
            label="Reglamento de órgano modelado"
            checked={draft.reglamento_organo_modelado}
            onChange={(reglamento_organo_modelado) => onChange({ reglamento_organo_modelado })}
            help="Permite añadir reglas internas del órgano competente."
          />
          <CheckboxField
            label="Pactos parasociales modelados"
            checked={draft.pactos_modelados}
            onChange={(pactos_modelados) => onChange({ pactos_modelados, pactos_no_modelados_ack: pactos_modelados ? false : draft.pactos_no_modelados_ack })}
            help="Si no se modelan, el sistema mostrará advertencia contractual."
          />
        </div>
        {!draft.pactos_modelados ? (
          <div className="mt-4 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] p-3" style={{ borderRadius: "var(--g-radius-md)" }}>
            <CheckboxField
              label="Confirmo que los pactos no quedan modelados en el alta"
              checked={draft.pactos_no_modelados_ack}
              onChange={(pactos_no_modelados_ack) => onChange({ pactos_no_modelados_ack })}
              help="La sociedad podrá operar con advertencia hasta registrar las cláusulas vigentes."
            />
          </div>
        ) : null}
      </section>

      <section
        className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--g-text-primary)]">
          <Layers className="h-4 w-4 text-[var(--g-brand-3308)]" />
          Reglas estatutarias o reglamentarias añadidas
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SelectField
            label="Materia afectada"
            value={draft.override_materia}
            options={OVERRIDE_MATERIAS}
            onChange={(override_materia) => onChange({ override_materia })}
          />
          <SelectField
            label="Fuente documental"
            value={draft.override_fuente}
            options={[
              { value: "ESTATUTOS", label: "Estatutos sociales" },
              { value: "REGLAMENTO", label: "Reglamento de órgano" },
            ]}
            onChange={(override_fuente) => onChange({ override_fuente: override_fuente as RulesDraft["override_fuente"] })}
          />
          <NumberField
            label="Mayoría reforzada estatutaria"
            value={draft.override_mayoria_reforzada_pct}
            onChange={(override_mayoria_reforzada_pct) => onChange({ override_mayoria_reforzada_pct })}
            issue={issueForField(issues, "rules.override_mayoria_reforzada_pct")}
            help="Debe ser igual o superior al mínimo legal."
          />
          <NumberField
            label="Quórum estatutario"
            value={draft.override_quorum_primera_pct}
            onChange={(override_quorum_primera_pct) => onChange({ override_quorum_primera_pct })}
            issue={issueForField(issues, "rules.override_quorum_primera_pct")}
            help="Debe ser igual o superior al suelo legal de referencia."
          />
          <NumberField
            label="Plazo de convocatoria estatutario"
            value={draft.override_convocatoria_dias}
            onChange={(override_convocatoria_dias) => onChange({ override_convocatoria_dias })}
            issue={issueForField(issues, "rules.override_convocatoria_dias")}
            help="No puede rebajar el plazo legal."
          />
          <Field
            label="Referencia documental"
            value={draft.override_referencia}
            onChange={(override_referencia) => onChange({ override_referencia })}
            issue={issueForField(issues, "rules.override_referencia")}
            help="Artículo estatutario o cláusula de reglamento."
          />
          <TextAreaField
            label="Justificación"
            value={draft.override_justificacion}
            onChange={(override_justificacion) => onChange({ override_justificacion })}
            issue={issueForField(issues, "rules.override_justificacion")}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Vigencia desde" type="date" value={draft.override_vigencia_desde} onChange={(override_vigencia_desde) => onChange({ override_vigencia_desde })} />
            <Field label="Vigencia hasta" type="date" value={draft.override_vigencia_hasta} onChange={(override_vigencia_hasta) => onChange({ override_vigencia_hasta })} />
          </div>
        </div>
        <div className="mt-4">
          <IssueList issues={issues?.filter((item) => item.code === "R-003" || item.code === "R-004") ?? []} />
          {normativeValidation.ok ? (
            <p className="mt-3 text-sm text-[var(--status-success)]">
              La configuración inicial respeta el suelo legal aplicable.
            </p>
          ) : null}
        </div>
      </section>

      <section
        className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--g-text-primary)]">
          <FileText className="h-4 w-4 text-[var(--g-brand-3308)]" />
          Configuración documental inicial
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field
            label="Área responsable"
            value={draft.capa3_area_responsable}
            onChange={(capa3_area_responsable) => onChange({ capa3_area_responsable })}
            help="Valor inicial para campos editables de documentos de esta sociedad."
          />
          <Field
            label="Firmante preferente"
            value={draft.capa3_firmante_preferente}
            onChange={(capa3_firmante_preferente) => onChange({ capa3_firmante_preferente })}
            help="Se puede ajustar después desde el editor documental."
          />
        </div>
      </section>
    </div>
  );
}
function BaselineCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] p-3" style={{ borderRadius: "var(--g-radius-md)" }}>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">{label}</div>
      <div className="mt-1 text-sm font-semibold text-[var(--g-text-primary)]">{value}</div>
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  const inputId = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <label className="flex flex-col gap-1" htmlFor={inputId}>
      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
        {label}
      </span>
      <select
        id={inputId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] outline-none focus:border-[var(--g-brand-3308)] focus:ring-2 focus:ring-[var(--g-brand-3308)]/20"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  issue,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  issue?: ValidationIssue;
}) {
  const inputId = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <label className="flex flex-col gap-1 md:col-span-2" htmlFor={inputId}>
      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
        {label}
      </span>
      <textarea
        id={inputId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={issue ? true : undefined}
        aria-describedby={issue ? `${inputId}-error` : undefined}
        rows={3}
        className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] outline-none focus:border-[var(--g-brand-3308)] focus:ring-2 focus:ring-[var(--g-brand-3308)]/20"
        style={{ borderRadius: "var(--g-radius-md)" }}
      />
      {issue ? (
        <span id={`${inputId}-error`} className="text-xs font-medium text-[var(--status-error)]">
          {issue.message}
        </span>
      ) : null}
    </label>
  );
}
