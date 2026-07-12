import { useMemo, useState, type ElementType, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Edit3,
  Lock,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Variable,
} from "lucide-react";
import { toast } from "sonner";
import {
  useUpdateContenidoPlantilla,
  type PlantillaProtegidaRow,
} from "@/hooks/usePlantillasProtegidas";
import {
  buildTemplateLayerGateCandidate,
  capa2RequirementPresentation,
  capa2SourceLabel,
  capa2UsagePresentation,
  extractCapa1VariableReferences,
  listCapa1VariableNames,
  normalizeCapa2Rows,
  normalizeCapa3Rows,
  serializeCapa2Rows,
  serializeCapa3Rows,
  templateFieldTypeLabel,
  tokenizeCapa1,
  validateCapa3Rows,
  type NormalizedCapa2Row,
  type NormalizedCapa3Row,
  type TemplateNamespaceFamily,
  type TemplateNamespacePresentation,
} from "@/lib/secretaria/template-layer-ux";
import { validateTemplateForActivation } from "@/lib/secretaria/template-admin/gate-pre";
import {
  gatePreIssueLabel,
  gatePreSeverityLabel,
} from "@/lib/secretaria/template-admin/gate-pre-issue-labels";
import type { GatePreIssue } from "@/lib/secretaria/template-admin/types";
import {
  SEMANTIC_TONE_CLASS,
  SEMANTIC_TONE_DOT_CLASS,
} from "@/lib/secretaria/template-admin/labels";

export type TriCapaAudienceMode = "legal" | "tecnica";

const OBLIGATORIEDAD_OPTIONS = [
  "OBLIGATORIO",
  "RECOMENDADO",
  "OPCIONAL",
  "OBLIGATORIO_SI_TELEMATICA",
] as const;

const NAMESPACE_CLASS: Record<TemplateNamespaceFamily, string> = {
  entity:
    "border-[var(--g-sec-300)] bg-[var(--g-sec-100)] text-[var(--g-brand-3308)]",
  body:
    "border-[var(--g-border-default)] bg-[var(--g-surface-subtle)] text-[var(--g-text-primary)]",
  meeting:
    "border-[var(--status-info)] bg-[var(--status-info)]/10 text-[var(--g-text-primary)]",
  case:
    "border-[var(--status-warning)] bg-[var(--status-warning)]/10 text-[var(--g-text-primary)]",
  system:
    "border-[var(--g-border-default)] bg-[var(--g-surface-muted)] text-[var(--g-text-primary)]",
  trust:
    "border-[var(--g-brand-3308)] bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]",
  manual:
    "border-[var(--g-border-default)] bg-[var(--g-surface-muted)] text-[var(--g-text-primary)]",
  other:
    "border-[var(--g-border-default)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)]",
};

function safeString(value: unknown) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function jsonPreview(value: unknown) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function textToOptions(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function SectionToggle({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
  count,
}: {
  title: string;
  icon: ElementType;
  children: ReactNode;
  defaultOpen?: boolean;
  count?: number;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-[var(--g-border-subtle)] last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex min-h-11 w-full items-center gap-2 px-5 py-3 text-left text-sm font-semibold text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)]/50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[var(--g-brand-3308)]"
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="h-4 w-4 text-[var(--g-brand-3308)]" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-4 w-4 text-[var(--g-text-secondary)]" aria-hidden="true" />
        )}
        <Icon className="h-4 w-4 text-[var(--g-brand-3308)]" aria-hidden="true" />
        <span>{title}</span>
        {count !== undefined ? (
          <span className="ml-auto text-xs text-[var(--g-text-secondary)]">{count}</span>
        ) : null}
      </button>
      {open ? <div className="px-5 pb-4">{children}</div> : null}
    </div>
  );
}

function issueTone(issue: GatePreIssue): "error" | "warning" | "info" {
  if (issue.severity === "BLOCKING") return "error";
  if (issue.severity === "WARNING") return "warning";
  return "info";
}

function severityChipLabel(severity: string, count: number) {
  const base = gatePreSeverityLabel(severity).toLocaleLowerCase("es");
  return count === 1 ? base : `${base}s`;
}

function useTriCapaDiagnostics(
  plantilla: PlantillaProtegidaRow,
  capa1: string,
  capa2: NormalizedCapa2Row[],
  capa3: NormalizedCapa3Row[],
) {
  return useMemo(() => {
    const candidate = buildTemplateLayerGateCandidate(plantilla, capa1, capa2, capa3);
    const gate = validateTemplateForActivation(candidate, {
      tenantId: plantilla.tenant_id,
      existingActiveTemplates: [],
      targetEstado: "BORRADOR",
    });
    const variableCounts = new Map<string, number>();
    for (const row of capa2) {
      const key = row.variable.trim();
      if (key) variableCounts.set(key, (variableCounts.get(key) ?? 0) + 1);
    }
    const localIssues: GatePreIssue[] = [];
    for (const row of capa2) {
      const variable = row.variable.trim();
      if (!variable) {
        localIssues.push({
          severity: "BLOCKING",
          code: "CAPA2_VARIABLE_REQUIRED",
          message: "Indica el identificador de la variable automática.",
          field: "capa2_variables",
        });
      } else if ((variableCounts.get(variable) ?? 0) > 1) {
        localIssues.push({
          severity: "BLOCKING",
          code: "CAPA2_DUPLICATE_VARIABLE",
          message: `La variable '${variable}' está duplicada en Capa 2.`,
          field: "capa2_variables",
        });
      }
    }
    for (const validation of validateCapa3Rows(capa3)) {
      for (const issue of validation.issues) {
        localIssues.push({
          severity: issue.severity,
          code: issue.code,
          message: issue.message,
          field: "capa3_editables",
        });
      }
    }
    const deduped = new Map<string, GatePreIssue>();
    for (const issue of [...gate.issues, ...localIssues]) {
      deduped.set(`${issue.code}:${issue.message}`, issue);
    }
    const issues = [...deduped.values()];
    const blockingIssues = issues.filter((issue) => issue.severity === "BLOCKING");
    return {
      issues,
      blocking: blockingIssues.length,
      blockingForSave: blockingIssues.filter((issue) => !issue.code.startsWith("META_")).length,
      warning: issues.filter((issue) => issue.severity === "WARNING").length,
      info: issues.filter((issue) => issue.severity === "INFO").length,
    };
  }, [plantilla, capa1, capa2, capa3]);
}

function LegalCapa1({ capa1, capa2 }: { capa1: string; capa2: NormalizedCapa2Row[] }) {
  const tokens = useMemo(() => tokenizeCapa1(capa1, capa2), [capa1, capa2]);
  const namespaces = useMemo(() => {
    const byCode = new Map<string, TemplateNamespacePresentation>();
    for (const token of tokens) {
      if (token.kind === "expression" && token.namespace) {
        byCode.set(token.namespace.code, token.namespace);
      }
    }
    return [...byCode.values()];
  }, [tokens]);

  return (
    <div className="space-y-3">
      {namespaces.length > 0 ? (
        <div className="flex flex-wrap gap-2" aria-label="Leyenda de fuentes de variables">
          {namespaces.map((namespace) => (
            <span
              key={namespace.code}
              className={`inline-flex items-center border px-2 py-1 text-[11px] font-semibold ${NAMESPACE_CLASS[namespace.family]}`}
              style={{ borderRadius: "var(--g-radius-sm)" }}
            >
              {namespace.label}
            </span>
          ))}
        </div>
      ) : null}
      <pre
        className="max-h-[34rem] overflow-auto whitespace-pre-wrap border border-[var(--g-border-default)] bg-[var(--g-surface-card)] p-4 font-mono text-xs leading-relaxed text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
        style={{ borderRadius: "var(--g-radius-md)" }}
        aria-label="Vista legal del texto protegido"
        role="region"
        tabIndex={0}
      >
        {tokens.length === 0 ? (
          <span className="text-[var(--g-text-secondary)]">Sin texto protegido.</span>
        ) : (
          tokens.map((token) =>
            token.kind === "text" ? (
              <span key={`text-${token.start}`}>{token.text}</span>
            ) : (
              <span
                key={`expression-${token.start}`}
                className={`inline border px-1 py-0.5 font-semibold ${
                  token.namespace
                    ? NAMESPACE_CLASS[token.namespace.family]
                    : NAMESPACE_CLASS.other
                }`}
                style={{ borderRadius: "var(--g-radius-sm)" }}
                title={token.namespace?.label ?? "Expresión de plantilla"}
              >
                {token.text}
              </span>
            ),
          )
        )}
      </pre>
    </div>
  );
}

function LegalCapa2({ capa1, rows }: { capa1: string; rows: NormalizedCapa2Row[] }) {
  const references = useMemo(() => extractCapa1VariableReferences(capa1), [capa1]);
  if (rows.length === 0) {
    return <p className="text-sm text-[var(--g-text-secondary)]">Sin variables automáticas declaradas.</p>;
  }
  return (
    <div
      className="overflow-x-auto focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
      role="region"
      aria-label="Variables automáticas de la plantilla"
      tabIndex={0}
    >
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="bg-[var(--g-surface-subtle)]">
            {[
              "Variable",
              "Fuente",
              "Uso en el texto",
              "Obligatoriedad",
            ].map((label) => (
              <th
                key={label}
                className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--g-border-subtle)]">
          {rows.map((row, index) => {
            const usage = capa2UsagePresentation(row, references);
            const requirement = capa2RequirementPresentation(row);
            return (
              <tr key={`${row.variable}-${index}`}>
                <td className="px-4 py-3 font-mono text-xs text-[var(--g-text-primary)]">
                  {row.variable || "Sin identificador"}
                </td>
                <td className="px-4 py-3 text-xs text-[var(--g-text-secondary)]">
                  {capa2SourceLabel(row)}
                </td>
                <td className="px-4 py-3 text-xs text-[var(--g-text-primary)]">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className={`h-2 w-2 ${
                        usage.used
                          ? "bg-[var(--status-success)]"
                          : "bg-[var(--status-warning)]"
                      }`}
                      style={{ borderRadius: "var(--g-radius-full)" }}
                      aria-hidden="true"
                    />
                    {usage.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-[var(--g-text-secondary)]">
                  {requirement.label}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Capa3ValidationList({
  issues,
  id,
}: {
  issues: ReturnType<typeof validateCapa3Rows>[number]["issues"];
  id: string;
}) {
  if (issues.length === 0) {
    return (
      <p id={id} className="mt-2 flex items-center gap-2 text-xs text-[var(--g-text-secondary)]">
        <CheckCircle2 className="h-3.5 w-3.5 text-[var(--status-success)]" aria-hidden="true" />
        Campo coherente
      </p>
    );
  }
  return (
    <ul id={id} className="mt-2 space-y-1">
      {issues.map((issue) => (
        <li key={`${issue.code}-${issue.message}`} className="flex items-start gap-2 text-xs text-[var(--g-text-primary)]">
          <span
            className={`mt-1 h-2 w-2 shrink-0 ${
              issue.severity === "BLOCKING"
                ? "bg-[var(--status-error)]"
                : "bg-[var(--status-warning)]"
            }`}
            style={{ borderRadius: "var(--g-radius-full)" }}
            aria-hidden="true"
          />
          {issue.message}
        </li>
      ))}
    </ul>
  );
}

function LegalCapa3({ rows }: { rows: NormalizedCapa3Row[] }) {
  const validations = useMemo(() => validateCapa3Rows(rows), [rows]);
  if (rows.length === 0) {
    return <p className="text-sm text-[var(--g-text-secondary)]">Sin campos editables declarados.</p>;
  }
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {rows.map((row, index) => {
        const validation = validations[index];
        return (
          <article
            key={`${row.campo}-${index}`}
            className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold text-[var(--g-text-primary)]">
                  {row.label || row.campo || "Campo sin identificar"}
                </h4>
              </div>
              <span
                className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-2 py-1 text-[11px] font-medium text-[var(--g-text-primary)]"
                style={{ borderRadius: "var(--g-radius-sm)" }}
              >
                {capa2RequirementPresentation({
                  obligatoriedad: row.obligatoriedad,
                  required: row.required,
                  condicion: "",
                }).label}
              </span>
            </div>
            <p className="mt-2 text-xs text-[var(--g-text-secondary)]">
              {row.descripcion || "Sin descripción jurídica."}
            </p>
            <p className="mt-2 text-[11px] text-[var(--g-text-secondary)]">
              Tipo de dato: {templateFieldTypeLabel(row.tipo)}
            </p>
            <Capa3ValidationList
              id={`capa3-legal-validation-${index}`}
              issues={validation.issues}
            />
          </article>
        );
      })}
    </div>
  );
}

export function TriCapaEditor({
  plantilla,
  readOnlyReason,
  readOnlyDetail,
  mode = "legal",
}: {
  plantilla: PlantillaProtegidaRow;
  readOnlyReason?: string | null;
  readOnlyDetail?: string | null;
  mode?: TriCapaAudienceMode;
}) {
  const updateContenido = useUpdateContenidoPlantilla();
  const readOnlyMessage =
    readOnlyReason ??
    (plantilla.estado !== "BORRADOR"
      ? "Solo las plantillas en BORRADOR admiten edición tri-capa."
      : null);
  const canEdit = !readOnlyMessage;
  const technical = mode === "tecnica";
  const initial = useMemo(
    () => ({
      capa1: plantilla.capa1_inmutable ?? "",
      capa2: normalizeCapa2Rows(plantilla.capa2_variables),
      capa3: normalizeCapa3Rows(plantilla.capa3_editables),
      notas: plantilla.notas_legal ?? "",
    }),
    [plantilla],
  );
  const [capa1, setCapa1] = useState(initial.capa1);
  const [capa2, setCapa2] = useState<NormalizedCapa2Row[]>(initial.capa2);
  const [capa3, setCapa3] = useState<NormalizedCapa3Row[]>(initial.capa3);
  const [notas, setNotas] = useState(initial.notas);
  const diagnostics = useTriCapaDiagnostics(plantilla, capa1, capa2, capa3);
  const capa2VariableCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of capa2) {
      const key = row.variable.trim();
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [capa2]);
  const usedVariables = useMemo(() => listCapa1VariableNames(capa1), [capa1]);
  const capa3Validations = useMemo(() => validateCapa3Rows(capa3), [capa3]);

  const dirtyLayers = useMemo(() => {
    const dirty: string[] = [];
    if (capa1 !== initial.capa1) dirty.push("capa1");
    if (JSON.stringify(capa2) !== JSON.stringify(initial.capa2)) dirty.push("capa2");
    if (JSON.stringify(capa3) !== JSON.stringify(initial.capa3)) dirty.push("capa3");
    if (notas !== initial.notas) dirty.push("notas_legal");
    return dirty;
  }, [capa1, capa2, capa3, notas, initial]);

  const reset = () => {
    setCapa1(initial.capa1);
    setCapa2(initial.capa2);
    setCapa3(initial.capa3);
    setNotas(initial.notas);
  };

  const save = async () => {
    if (!canEdit || !technical || dirtyLayers.length === 0 || diagnostics.blockingForSave > 0) {
      return;
    }
    try {
      const payload: {
        id: string;
        capa1_inmutable?: string;
        capa2_variables?: NonNullable<PlantillaProtegidaRow["capa2_variables"]>;
        capa3_editables?: NonNullable<PlantillaProtegidaRow["capa3_editables"]>;
        notas_legal?: string;
        motivo: string;
      } = {
        id: plantilla.id,
        motivo: `Editor tri-capa (${dirtyLayers.join(", ")})`,
      };
      if (dirtyLayers.includes("capa1")) payload.capa1_inmutable = capa1;
      if (dirtyLayers.includes("capa2")) {
        payload.capa2_variables = serializeCapa2Rows(capa2) as NonNullable<
          PlantillaProtegidaRow["capa2_variables"]
        >;
      }
      if (dirtyLayers.includes("capa3")) {
        payload.capa3_editables = serializeCapa3Rows(capa3) as NonNullable<
          PlantillaProtegidaRow["capa3_editables"]
        >;
      }
      if (dirtyLayers.includes("notas_legal")) payload.notas_legal = notas;

      await updateContenido.mutateAsync(payload);
      toast.success("Plantilla guardada con changelog");
    } catch {
      toast.error("No se pudo guardar la plantilla");
    }
  };

  const fieldStateClass = canEdit
    ? "bg-[var(--g-surface-card)] focus:ring-2 focus:ring-[var(--g-brand-3308)]"
    : "bg-[var(--g-surface-muted)]";

  return (
    <div className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]">
      {readOnlyMessage ? (
        <div
          className="flex items-start gap-3 border-b border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-5 py-4"
          role="note"
        >
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--g-brand-3308)]" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-[var(--g-text-primary)]">
              Modo solo lectura — {readOnlyMessage}
            </p>
            <p className="mt-0.5 text-xs text-[var(--g-text-secondary)]">
              {readOnlyDetail ?? "El contenido se muestra únicamente para consulta."}
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--g-border-subtle)] px-5 py-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--g-text-primary)]">Editor tri-capa</h3>
          <p className="text-xs text-[var(--g-text-secondary)]">
            {technical
              ? "Vista técnica de fuentes, condiciones e identificadores."
              : "Vista legal del texto protegido, variables automáticas y campos editables."}
          </p>
        </div>
        {canEdit && technical ? (
          <div className="flex flex-wrap items-center gap-2">
            {dirtyLayers.length > 0 ? (
              <span
                className="bg-[var(--g-sec-100)] px-2 py-1 text-xs font-medium text-[var(--g-brand-3308)]"
                style={{ borderRadius: "var(--g-radius-full)" }}
              >
                Cambios: {dirtyLayers.join(", ")}
              </span>
            ) : null}
            <button
              type="button"
              onClick={reset}
              disabled={dirtyLayers.length === 0 || updateContenido.isPending}
              className="inline-flex min-h-11 items-center gap-1.5 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 text-xs font-medium text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] disabled:opacity-50"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Cancelar
            </button>
            <button
              type="button"
              onClick={save}
              disabled={
                dirtyLayers.length === 0 ||
                diagnostics.blockingForSave > 0 ||
                updateContenido.isPending
              }
              className="inline-flex min-h-11 items-center gap-1.5 bg-[var(--g-brand-3308)] px-3 text-xs font-medium text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] disabled:opacity-50"
              style={{ borderRadius: "var(--g-radius-md)" }}
              aria-busy={updateContenido.isPending}
            >
              <Save className="h-3.5 w-3.5" aria-hidden="true" />
              {updateContenido.isPending ? "Guardando…" : "Guardar"}
            </button>
          </div>
        ) : canEdit ? (
          <p className="text-xs text-[var(--g-text-secondary)]">
            Cambia a Vista técnica para editar el borrador.
          </p>
        ) : null}
      </div>

      <SectionToggle title="Capa 1 — Texto jurídico y variables" icon={Lock} defaultOpen>
        {technical ? (
          <>
            <textarea
              value={capa1}
              onChange={(event) => setCapa1(event.target.value)}
              readOnly={!canEdit}
              tabIndex={canEdit ? 0 : -1}
              rows={16}
              className={`w-full resize-y border border-[var(--g-border-default)] p-3 font-mono text-xs leading-relaxed text-[var(--g-text-primary)] focus:outline-none ${fieldStateClass}`}
              style={{ borderRadius: "var(--g-radius-md)" }}
              aria-label="Editor de contenido capa 1"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {usedVariables.length === 0 ? (
                <span className="text-xs text-[var(--g-text-secondary)]">Sin variables dinámicas detectadas.</span>
              ) : (
                usedVariables.map((variable) => (
                  <span
                    key={variable}
                    className="bg-[var(--g-sec-100)] px-2 py-1 font-mono text-[11px] text-[var(--g-brand-3308)]"
                    style={{ borderRadius: "var(--g-radius-sm)" }}
                  >
                    {`{{${variable}}}`}
                  </span>
                ))
              )}
            </div>
          </>
        ) : (
          <LegalCapa1 capa1={capa1} capa2={capa2} />
        )}
      </SectionToggle>

      <SectionToggle title="Capa 2 — Variables automáticas" icon={Variable} count={capa2.length}>
        {technical ? (
          <div className="space-y-3">
            {capa2.map((row, index) => {
              const usage = capa2UsagePresentation(row, capa1);
              const normalizedVariable = row.variable.trim();
              const duplicated =
                !!normalizedVariable && (capa2VariableCounts.get(normalizedVariable) ?? 0) > 1;
              const invalidVariable = !normalizedVariable || duplicated;
              const validationId = `capa2-validation-${index}`;
              const usageId = `capa2-usage-${index}`;
              return (
                <div
                  key={`${index}-${row.variable}`}
                  className="grid gap-2 border border-[var(--g-border-subtle)] p-3 md:grid-cols-[1.2fr_1fr_1fr_auto]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
                    Variable
                    <input
                      value={row.variable}
                      onChange={(event) => {
                        const next = [...capa2];
                        next[index] = { ...row, variable: event.target.value };
                        setCapa2(next);
                      }}
                      readOnly={!canEdit}
                      tabIndex={canEdit ? 0 : -1}
                      aria-invalid={invalidVariable ? "true" : undefined}
                      aria-describedby={`${validationId} ${usageId}`}
                      className={`min-h-11 border border-[var(--g-border-subtle)] px-3 font-mono text-xs font-normal normal-case tracking-normal text-[var(--g-text-primary)] focus:outline-none ${fieldStateClass}`}
                      style={{ borderRadius: "var(--g-radius-md)" }}
                      aria-label={`Variable capa 2 ${index + 1}`}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
                    Fuente
                    <input
                      value={row.fuente}
                      onChange={(event) => {
                        const next = [...capa2];
                        next[index] = { ...row, fuente: event.target.value };
                        setCapa2(next);
                      }}
                      readOnly={!canEdit}
                      tabIndex={canEdit ? 0 : -1}
                      className={`min-h-11 border border-[var(--g-border-subtle)] px-3 text-xs font-normal normal-case tracking-normal text-[var(--g-text-primary)] focus:outline-none ${fieldStateClass}`}
                      style={{ borderRadius: "var(--g-radius-md)" }}
                      aria-label={`Fuente capa 2 ${index + 1}`}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
                    Condición técnica
                    <input
                      value={row.condicion}
                      onChange={(event) => {
                        const next = [...capa2];
                        next[index] = { ...row, condicion: event.target.value };
                        setCapa2(next);
                      }}
                      readOnly={!canEdit}
                      tabIndex={canEdit ? 0 : -1}
                      className={`min-h-11 border border-[var(--g-border-subtle)] px-3 text-xs font-normal normal-case tracking-normal text-[var(--g-text-primary)] focus:outline-none ${fieldStateClass}`}
                      style={{ borderRadius: "var(--g-radius-md)" }}
                      aria-label={`Condición capa 2 ${index + 1}`}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setCapa2(capa2.filter((_, rowIndex) => rowIndex !== index))}
                    disabled={!canEdit}
                    className="inline-flex min-h-11 items-center justify-center self-end border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] disabled:opacity-50"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                    aria-label={`Eliminar variable ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <p
                    id={validationId}
                    className={`text-xs md:col-span-4 ${
                      invalidVariable
                        ? "text-[var(--status-error)]"
                        : "text-[var(--g-text-secondary)]"
                    }`}
                  >
                    {!normalizedVariable
                      ? "Indica el identificador de la variable automática."
                      : duplicated
                        ? `La variable '${normalizedVariable}' está duplicada en Capa 2.`
                        : "Identificador de variable coherente."}
                  </p>
                  <p id={usageId} className="text-xs text-[var(--g-text-secondary)] md:col-span-4">
                    Uso: {usage.label} · Obligatoriedad: {capa2RequirementPresentation(row).label}
                  </p>
                </div>
              );
            })}
            <button
              type="button"
              onClick={() =>
                setCapa2([
                  ...capa2,
                  normalizeCapa2Rows([
                    { variable: "", fuente: "entities.*", condicion: "SIEMPRE" },
                  ])[0],
                ])
              }
              disabled={!canEdit}
              className="inline-flex min-h-11 items-center gap-1.5 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 text-xs font-medium text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] disabled:opacity-50"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Añadir variable
            </button>
          </div>
        ) : (
          <LegalCapa2 capa1={capa1} rows={capa2} />
        )}
      </SectionToggle>

      <SectionToggle title="Capa 3 — Campos editables" icon={Edit3} count={capa3.length}>
        {technical ? (
          <div className="space-y-3">
            {capa3.map((row, index) => {
              const validation = capa3Validations[index];
              const validationId = `capa3-validation-${index}`;
              const currentRequirementOptions = OBLIGATORIEDAD_OPTIONS.includes(
                row.obligatoriedad as (typeof OBLIGATORIEDAD_OPTIONS)[number],
              )
                ? OBLIGATORIEDAD_OPTIONS
                : ([row.obligatoriedad, ...OBLIGATORIEDAD_OPTIONS].filter(Boolean) as string[]);
              const structuredDefault =
                row.defaultValue !== null &&
                row.defaultValue !== undefined &&
                typeof row.defaultValue !== "string";
              const plainStringOptions =
                row.opciones === null ||
                row.opciones.every(
                  (option) => typeof option === "string" && !option.includes(","),
                );
              const defaultHelpId = `capa3-default-help-${index}`;
              const optionsHelpId = `capa3-options-help-${index}`;
              return (
                <div
                  key={`${index}-${row.campo}`}
                  className="border border-[var(--g-border-subtle)] p-3"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <div className="grid gap-2 md:grid-cols-[1.2fr_0.8fr_auto]">
                    <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
                      Campo
                      <input
                        value={row.campo}
                        onChange={(event) => {
                          const next = [...capa3];
                          next[index] = { ...row, campo: event.target.value };
                          setCapa3(next);
                        }}
                        readOnly={!canEdit}
                        tabIndex={canEdit ? 0 : -1}
                        aria-invalid={validation.invalid ? "true" : undefined}
                        aria-describedby={validationId}
                        className={`min-h-11 border border-[var(--g-border-subtle)] px-3 font-mono text-xs font-normal normal-case tracking-normal text-[var(--g-text-primary)] focus:outline-none ${fieldStateClass}`}
                        style={{ borderRadius: "var(--g-radius-md)" }}
                        aria-label={`Campo capa 3 ${index + 1}`}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
                      Obligatoriedad
                      <select
                        value={row.obligatoriedad}
                        onChange={(event) => {
                          const next = [...capa3];
                          next[index] = { ...row, obligatoriedad: event.target.value };
                          setCapa3(next);
                        }}
                        disabled={!canEdit}
                        className={`min-h-11 border border-[var(--g-border-subtle)] px-3 text-xs font-normal normal-case tracking-normal text-[var(--g-text-primary)] focus:outline-none ${fieldStateClass}`}
                        style={{ borderRadius: "var(--g-radius-md)" }}
                        aria-label={`Obligatoriedad capa 3 ${index + 1}`}
                      >
                        {currentRequirementOptions.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={() => setCapa3(capa3.filter((_, rowIndex) => rowIndex !== index))}
                      disabled={!canEdit}
                      className="inline-flex min-h-11 items-center justify-center self-end border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] disabled:opacity-50"
                      style={{ borderRadius: "var(--g-radius-md)" }}
                      aria-label={`Eliminar campo ${index + 1}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                  <label className="mt-2 flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
                    Descripción
                    <textarea
                      value={row.descripcion}
                      onChange={(event) => {
                        const next = [...capa3];
                        next[index] = { ...row, descripcion: event.target.value };
                        setCapa3(next);
                      }}
                      readOnly={!canEdit}
                      tabIndex={canEdit ? 0 : -1}
                      aria-describedby={validationId}
                      rows={2}
                      className={`w-full border border-[var(--g-border-subtle)] px-3 py-2 text-xs font-normal normal-case tracking-normal text-[var(--g-text-primary)] focus:outline-none ${fieldStateClass}`}
                      style={{ borderRadius: "var(--g-radius-md)" }}
                      aria-label={`Descripción capa 3 ${index + 1}`}
                    />
                  </label>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
                      Valor por defecto
                      <input
                        value={jsonPreview(row.defaultValue)}
                        onChange={(event) => {
                          if (structuredDefault) return;
                          const next = [...capa3];
                          next[index] = { ...row, defaultValue: event.target.value };
                          setCapa3(next);
                        }}
                        readOnly={!canEdit || structuredDefault}
                        tabIndex={canEdit && !structuredDefault ? 0 : -1}
                        aria-describedby={structuredDefault ? defaultHelpId : undefined}
                        className={`min-h-11 border border-[var(--g-border-subtle)] px-3 text-xs font-normal normal-case tracking-normal text-[var(--g-text-primary)] focus:outline-none ${
                          canEdit && !structuredDefault
                            ? fieldStateClass
                            : "bg-[var(--g-surface-muted)]"
                        }`}
                        style={{ borderRadius: "var(--g-radius-md)" }}
                        aria-label={`Default capa 3 ${index + 1}`}
                      />
                      {structuredDefault ? (
                        <span id={defaultHelpId} className="text-[10px] font-normal normal-case tracking-normal text-[var(--g-text-secondary)]">
                          Valor tipado conservado sin cambios; edítalo mediante importación JSON.
                        </span>
                      ) : null}
                    </label>
                    <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
                      Opciones
                      <input
                        value={
                          plainStringOptions
                            ? (row.opciones ?? []).map(safeString).join(", ")
                            : jsonPreview(row.opciones)
                        }
                        onChange={(event) => {
                          if (!plainStringOptions) return;
                          const next = [...capa3];
                          next[index] = { ...row, opciones: textToOptions(event.target.value) };
                          setCapa3(next);
                        }}
                        readOnly={!canEdit || !plainStringOptions}
                        tabIndex={canEdit && plainStringOptions ? 0 : -1}
                        aria-describedby={!plainStringOptions ? optionsHelpId : undefined}
                        className={`min-h-11 border border-[var(--g-border-subtle)] px-3 text-xs font-normal normal-case tracking-normal text-[var(--g-text-primary)] focus:outline-none ${
                          canEdit && plainStringOptions
                            ? fieldStateClass
                            : "bg-[var(--g-surface-muted)]"
                        }`}
                        style={{ borderRadius: "var(--g-radius-md)" }}
                        aria-label={`Opciones capa 3 ${index + 1}`}
                      />
                      {!plainStringOptions ? (
                        <span id={optionsHelpId} className="text-[10px] font-normal normal-case tracking-normal text-[var(--g-text-secondary)]">
                          Opciones tipadas conservadas sin cambios; edítalas mediante importación JSON.
                        </span>
                      ) : null}
                    </label>
                  </div>
                  <Capa3ValidationList id={validationId} issues={validation.issues} />
                </div>
              );
            })}
            <button
              type="button"
              onClick={() =>
                setCapa3([
                  ...capa3,
                  normalizeCapa3Rows([
                    {
                      campo: "",
                      obligatoriedad: "OPCIONAL",
                      descripcion: "Sin descripción jurídica.",
                    },
                  ])[0],
                ])
              }
              disabled={!canEdit}
              className="inline-flex min-h-11 items-center gap-1.5 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 text-xs font-medium text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] disabled:opacity-50"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Añadir campo
            </button>
          </div>
        ) : (
          <LegalCapa3 rows={capa3} />
        )}
      </SectionToggle>

      <SectionToggle title="Notas para Legal" icon={Edit3}>
        {technical ? (
          <textarea
            value={notas}
            onChange={(event) => setNotas(event.target.value)}
            readOnly={!canEdit}
            tabIndex={canEdit ? 0 : -1}
            rows={4}
            className={`w-full border border-[var(--g-border-subtle)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:outline-none ${fieldStateClass}`}
            style={{ borderRadius: "var(--g-radius-md)" }}
            aria-label="Notas legales de la plantilla"
          />
        ) : (
          <p className="whitespace-pre-wrap text-sm text-[var(--g-text-secondary)]">
            {notas || "Sin notas legales."}
          </p>
        )}
      </SectionToggle>

      <div className="px-5 py-4">
        <div className="flex flex-wrap gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium ${SEMANTIC_TONE_CLASS[diagnostics.blocking > 0 ? "error" : "success"]}`}
            style={{ borderRadius: "var(--g-radius-full)" }}
          >
            {diagnostics.blocking > 0 ? (
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {diagnostics.blocking} {severityChipLabel("BLOCKING", diagnostics.blocking)}
          </span>
          <span
            className={`px-2 py-1 text-xs font-medium ${SEMANTIC_TONE_CLASS.warning}`}
            style={{ borderRadius: "var(--g-radius-full)" }}
          >
            {diagnostics.warning} {severityChipLabel("WARNING", diagnostics.warning)}
          </span>
          <span
            className={`px-2 py-1 text-xs font-medium ${SEMANTIC_TONE_CLASS.info}`}
            style={{ borderRadius: "var(--g-radius-full)" }}
          >
            {diagnostics.info} {severityChipLabel("INFO", diagnostics.info)}
          </span>
        </div>
        {diagnostics.issues.length > 0 ? (
          <ul className="mt-3 space-y-1 text-xs">
            {diagnostics.issues.map((issue, index) => (
              <li key={`${issue.code}-${index}`} className="flex items-start gap-2 text-[var(--g-text-primary)]">
                <span
                  className={`mt-1 h-2 w-2 shrink-0 ${SEMANTIC_TONE_DOT_CLASS[issueTone(issue)]}`}
                  style={{ borderRadius: "var(--g-radius-full)" }}
                  aria-hidden="true"
                />
                <span>
                  <span className="font-semibold">{gatePreIssueLabel(issue.code)}</span>: {issue.message}{" "}
                  {technical ? (
                    <span className="font-mono text-[10px] text-[var(--g-text-secondary)]" title={issue.code}>
                      {issue.code}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-xs text-[var(--g-text-secondary)]">
            Sin incidencias en la comprobación documental para guardar el borrador.
          </p>
        )}
      </div>
    </div>
  );
}
