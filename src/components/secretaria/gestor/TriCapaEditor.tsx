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
  validateTemplateForActivation,
  VARIABLE_PATTERN,
} from "@/lib/secretaria/template-admin/gate-pre";
import type {
  GatePreIssue,
  PlantillaCandidate,
} from "@/lib/secretaria/template-admin/types";

type Capa2Draft = {
  variable: string;
  fuente: string;
  condicion: string;
};

type Capa3Draft = {
  campo: string;
  obligatoriedad: string;
  descripcion: string;
  default?: string;
  opciones?: string[];
  extras?: Record<string, unknown>;
};

const OBLIGATORIEDAD_OPTIONS = [
  "OBLIGATORIO",
  "RECOMENDADO",
  "OPCIONAL",
  "OBLIGATORIO_SI_TELEMATICA",
] as const;

function safeString(value: unknown, fallback = "") {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function normalizeCapa2(value: unknown): Capa2Draft[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => item !== null && typeof item === "object")
    .map((item) => ({
      variable: safeString(item.variable),
      fuente: safeString(item.fuente, "entities.*"),
      condicion: safeString(item.condicion, "SIEMPRE"),
    }));
}

function normalizeCapa3(value: unknown): Capa3Draft[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => item !== null && typeof item === "object")
    .map((item) => {
      const { campo, obligatoriedad, descripcion, default: defaultValue, opciones, ...extras } = item;
      return {
        campo: safeString(campo),
        obligatoriedad: safeString(obligatoriedad, "OPCIONAL"),
        descripcion: safeString(descripcion, "Sin descripción jurídica."),
        default: defaultValue === null || defaultValue === undefined ? undefined : safeString(defaultValue),
        opciones: Array.isArray(opciones) ? opciones.map((v) => safeString(v)).filter(Boolean) : undefined,
        extras,
      };
    });
}

function serializeCapa2(rows: Capa2Draft[]) {
  return rows
    .map((row) => ({
      variable: row.variable.trim(),
      fuente: row.fuente.trim(),
      condicion: row.condicion.trim() || "SIEMPRE",
    }))
    .filter((row) => row.variable);
}

function serializeCapa3(rows: Capa3Draft[]) {
  return rows
    .map((row) => ({
      ...(row.extras ?? {}),
      campo: row.campo.trim(),
      obligatoriedad: row.obligatoriedad.trim() || "OPCIONAL",
      descripcion: row.descripcion.trim() || "Sin descripción jurídica.",
      ...(row.default !== undefined && row.default !== "" ? { default: row.default } : {}),
      ...(row.opciones && row.opciones.length > 0 ? { opciones: row.opciones } : {}),
    }))
    .filter((row) => row.campo);
}

function extractVariables(text: string) {
  const used = new Set<string>();
  const re = new RegExp(VARIABLE_PATTERN.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const name = match[1];
    if (!["else", "this"].includes(name) && !name.startsWith("this.")) {
      used.add(name);
    }
  }
  return [...used].sort();
}

function uniq<T>(items: T[]) {
  return [...new Set(items)];
}

function buildCandidate(
  plantilla: PlantillaProtegidaRow,
  capa1: string,
  capa2: Capa2Draft[],
  capa3: Capa3Draft[],
): PlantillaCandidate {
  return {
    id: plantilla.id,
    tipo: plantilla.tipo,
    materia: plantilla.materia,
    materia_acuerdo: plantilla.materia_acuerdo,
    jurisdiccion: plantilla.jurisdiccion,
    version: plantilla.version,
    estado: plantilla.estado,
    organo_tipo: plantilla.organo_tipo,
    adoption_mode: plantilla.adoption_mode,
    aprobada_por: plantilla.aprobada_por,
    fecha_aprobacion: plantilla.fecha_aprobacion,
    referencia_legal: plantilla.referencia_legal,
    capa1_inmutable: capa1,
    capa2_variables: serializeCapa2(capa2),
    capa3_editables: serializeCapa3(capa3),
  };
}

function useTriCapaDiagnostics(
  plantilla: PlantillaProtegidaRow,
  capa1: string,
  capa2: Capa2Draft[],
  capa3: Capa3Draft[],
) {
  return useMemo(() => {
    const candidate = buildCandidate(plantilla, capa1, capa2, capa3);
    const gate = validateTemplateForActivation(candidate, {
      tenantId: plantilla.tenant_id,
      existingActiveTemplates: [],
      targetEstado: "BORRADOR",
    });
    const duplicateVariables = uniq(
      capa2.map((row) => row.variable.trim()).filter(Boolean),
    ).filter((variable) => capa2.filter((row) => row.variable.trim() === variable).length > 1);
    const duplicateCampos = uniq(
      capa3.map((row) => row.campo.trim()).filter(Boolean),
    ).filter((campo) => capa3.filter((row) => row.campo.trim() === campo).length > 1);
    const localIssues: GatePreIssue[] = [
      ...duplicateVariables.map((variable) => ({
        severity: "BLOCKING" as const,
        code: "CAPA2_DUPLICATE_VARIABLE",
        message: `variable '${variable}' duplicada en capa2`,
        field: "capa2_variables",
      })),
      ...duplicateCampos.map((campo) => ({
        severity: "BLOCKING" as const,
        code: "CAPA3_DUPLICATE_FIELD",
        message: `campo '${campo}' duplicado en capa3`,
        field: "capa3_editables",
      })),
    ];
    const issues = [...gate.issues, ...localIssues];
    return {
      issues,
      blocking: issues.filter((issue) => issue.severity === "BLOCKING").length,
      warning: issues.filter((issue) => issue.severity === "WARNING").length,
      info: issues.filter((issue) => issue.severity === "INFO").length,
    };
  }, [plantilla, capa1, capa2, capa3]);
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
        className="flex w-full items-center gap-2 px-5 py-3 text-left text-sm font-semibold text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]/50 transition-colors"
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

function issueTone(issue: GatePreIssue) {
  if (issue.severity === "BLOCKING") return "text-[var(--status-error)]";
  if (issue.severity === "WARNING") return "text-[var(--status-warning)]";
  return "text-[var(--status-info)]";
}

function optionsToText(options?: string[]) {
  return options?.join(", ") ?? "";
}

function textToOptions(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function TriCapaEditor({
  plantilla,
  readOnlyReason,
}: {
  plantilla: PlantillaProtegidaRow;
  readOnlyReason?: string | null;
}) {
  const updateContenido = useUpdateContenidoPlantilla();
  const canEdit = plantilla.estado === "BORRADOR" && !readOnlyReason;
  const initial = useMemo(
    () => ({
      capa1: plantilla.capa1_inmutable ?? "",
      capa2: normalizeCapa2(plantilla.capa2_variables),
      capa3: normalizeCapa3(plantilla.capa3_editables),
      notas: plantilla.notas_legal ?? "",
    }),
    [plantilla],
  );

  const [capa1, setCapa1] = useState(initial.capa1);
  const [capa2, setCapa2] = useState<Capa2Draft[]>(initial.capa2);
  const [capa3, setCapa3] = useState<Capa3Draft[]>(initial.capa3);
  const [notas, setNotas] = useState(initial.notas);

  const usedVariables = useMemo(() => extractVariables(capa1), [capa1]);
  const diagnostics = useTriCapaDiagnostics(plantilla, capa1, capa2, capa3);

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
    if (!canEdit || dirtyLayers.length === 0 || diagnostics.blocking > 0) return;
    try {
      await updateContenido.mutateAsync({
        id: plantilla.id,
        capa1_inmutable: capa1,
        capa2_variables: serializeCapa2(capa2),
        capa3_editables: serializeCapa3(capa3),
        notas_legal: notas,
        motivo: `Editor tri-capa (${dirtyLayers.join(", ")})`,
      });
      toast.success("Plantilla guardada con changelog");
    } catch {
      toast.error("No se pudo guardar la plantilla");
    }
  };

  return (
    <div className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--g-border-subtle)] px-5 py-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--g-text-primary)]">
            Editor tri-capa
          </h3>
          <p className="text-xs text-[var(--g-text-secondary)]">
            Edición auditada de borradores con validación Gate PRE.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dirtyLayers.length > 0 ? (
            <span
              className="px-2 py-1 text-xs font-medium bg-[var(--g-sec-100)] text-[var(--g-brand-3308)]"
              style={{ borderRadius: "var(--g-radius-full)" }}
            >
              Cambios: {dirtyLayers.join(", ")}
            </span>
          ) : null}
          <button
            type="button"
            onClick={reset}
            disabled={!canEdit || dirtyLayers.length === 0 || updateContenido.isPending}
            className="inline-flex items-center gap-1.5 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-1.5 text-xs font-medium text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] disabled:opacity-50"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Cancelar
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!canEdit || dirtyLayers.length === 0 || diagnostics.blocking > 0 || updateContenido.isPending}
            className="inline-flex items-center gap-1.5 bg-[var(--g-brand-3308)] px-3 py-1.5 text-xs font-medium text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] disabled:opacity-50"
            style={{ borderRadius: "var(--g-radius-md)" }}
            aria-busy={updateContenido.isPending}
          >
            <Save className="h-3.5 w-3.5" aria-hidden="true" />
            {updateContenido.isPending ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>

      {!canEdit ? (
        <div className="border-b border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)]/50 px-5 py-3 text-xs text-[var(--g-text-secondary)]">
          {readOnlyReason ?? "Solo las plantillas en BORRADOR admiten edición tri-capa."}
        </div>
      ) : null}

      <SectionToggle title="Capa 1 — Contenido Handlebars" icon={Lock} defaultOpen={true}>
        <textarea
          value={capa1}
          onChange={(e) => setCapa1(e.target.value)}
          readOnly={!canEdit}
          rows={16}
          className="w-full resize-y border border-[var(--g-border-default)] bg-[var(--g-surface-card)] p-3 font-mono text-[12px] leading-relaxed text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] disabled:opacity-70"
          style={{ borderRadius: "var(--g-radius-md)" }}
          aria-label="Editor de contenido capa 1"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {usedVariables.length === 0 ? (
            <span className="text-xs text-[var(--g-text-secondary)]">Sin variables Handlebars detectadas.</span>
          ) : (
            usedVariables.map((variable) => (
              <span
                key={variable}
                className="font-mono text-[11px] bg-[var(--g-sec-100)] px-2 py-1 text-[var(--g-brand-3308)]"
                style={{ borderRadius: "var(--g-radius-sm)" }}
              >
                {`{{${variable}}}`}
              </span>
            ))
          )}
        </div>
      </SectionToggle>

      <SectionToggle title="Capa 2 — Variables del motor" icon={Variable} count={capa2.length}>
        <div className="space-y-2">
          {capa2.length > 0 ? (
            <div className="hidden gap-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--g-text-secondary)] md:grid md:grid-cols-[1.4fr_1fr_1fr_auto]">
              <span>Variable</span>
              <span>Fuente</span>
              <span>Condición</span>
              <span>Acción</span>
            </div>
          ) : null}
          {capa2.map((row, index) => (
            <div
              key={`${index}-${row.variable}`}
              className="grid gap-2 md:grid-cols-[1.4fr_1fr_1fr_auto]"
            >
              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--g-text-secondary)] md:block">
                <span className="md:hidden">Variable</span>
                <input
                  value={row.variable}
                  onChange={(e) => {
                    const next = [...capa2];
                    next[index] = { ...row, variable: e.target.value };
                    setCapa2(next);
                  }}
                  readOnly={!canEdit}
                  className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 font-mono text-xs font-normal normal-case tracking-normal text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                  aria-label={`Variable capa 2 ${index + 1}`}
                />
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--g-text-secondary)] md:block">
                <span className="md:hidden">Fuente</span>
                <input
                  value={row.fuente}
                  onChange={(e) => {
                    const next = [...capa2];
                    next[index] = { ...row, fuente: e.target.value };
                    setCapa2(next);
                  }}
                  readOnly={!canEdit}
                  className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-xs font-normal normal-case tracking-normal text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                  aria-label={`Fuente capa 2 ${index + 1}`}
                />
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--g-text-secondary)] md:block">
                <span className="md:hidden">Condición</span>
                <input
                  value={row.condicion}
                  onChange={(e) => {
                    const next = [...capa2];
                    next[index] = { ...row, condicion: e.target.value };
                    setCapa2(next);
                  }}
                  readOnly={!canEdit}
                  className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-xs font-normal normal-case tracking-normal text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                  aria-label={`Condición capa 2 ${index + 1}`}
                />
              </label>
              <button
                type="button"
                onClick={() => setCapa2(capa2.filter((_, i) => i !== index))}
                disabled={!canEdit}
                className="inline-flex items-center justify-center border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] disabled:opacity-50"
                style={{ borderRadius: "var(--g-radius-md)" }}
                aria-label={`Eliminar variable ${index + 1}`}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setCapa2([...capa2, { variable: "", fuente: "entities.*", condicion: "SIEMPRE" }])}
            disabled={!canEdit}
            className="inline-flex items-center gap-1.5 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-1.5 text-xs font-medium text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] disabled:opacity-50"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Añadir variable
          </button>
        </div>
      </SectionToggle>

      <SectionToggle title="Capa 3 — Campos editables" icon={Edit3} count={capa3.length}>
        <div className="space-y-3">
          {capa3.map((row, index) => (
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
                    onChange={(e) => {
                      const next = [...capa3];
                      next[index] = { ...row, campo: e.target.value };
                      setCapa3(next);
                    }}
                    readOnly={!canEdit}
                    className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 font-mono text-xs font-normal normal-case tracking-normal text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                    aria-label={`Campo capa 3 ${index + 1}`}
                  />
                </label>
                <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
                  Obligatoriedad
                  <select
                    value={row.obligatoriedad}
                    onChange={(e) => {
                      const next = [...capa3];
                      next[index] = { ...row, obligatoriedad: e.target.value };
                      setCapa3(next);
                    }}
                    disabled={!canEdit}
                    className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-xs font-normal normal-case tracking-normal text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                    aria-label={`Obligatoriedad capa 3 ${index + 1}`}
                  >
                    {OBLIGATORIEDAD_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => setCapa3(capa3.filter((_, i) => i !== index))}
                  disabled={!canEdit}
                  className="inline-flex items-center justify-center border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] disabled:opacity-50"
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
                  onChange={(e) => {
                    const next = [...capa3];
                    next[index] = { ...row, descripcion: e.target.value };
                    setCapa3(next);
                  }}
                  readOnly={!canEdit}
                  rows={2}
                  className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-xs font-normal normal-case tracking-normal text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                  aria-label={`Descripción capa 3 ${index + 1}`}
                />
              </label>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
                  Valor por defecto
                  <input
                    value={row.default ?? ""}
                    onChange={(e) => {
                      const next = [...capa3];
                      next[index] = { ...row, default: e.target.value };
                      setCapa3(next);
                    }}
                    readOnly={!canEdit}
                    className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-xs font-normal normal-case tracking-normal text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                    aria-label={`Default capa 3 ${index + 1}`}
                  />
                </label>
                <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
                  Opciones
                  <input
                    value={optionsToText(row.opciones)}
                    onChange={(e) => {
                      const next = [...capa3];
                      next[index] = { ...row, opciones: textToOptions(e.target.value) };
                      setCapa3(next);
                    }}
                    readOnly={!canEdit}
                    className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-xs font-normal normal-case tracking-normal text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                    aria-label={`Opciones capa 3 ${index + 1}`}
                  />
                </label>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setCapa3([
                ...capa3,
                { campo: "", obligatoriedad: "OPCIONAL", descripcion: "Sin descripción jurídica." },
              ])
            }
            disabled={!canEdit}
            className="inline-flex items-center gap-1.5 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-1.5 text-xs font-medium text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] disabled:opacity-50"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Añadir campo
          </button>
        </div>
      </SectionToggle>

      <SectionToggle title="Notas para Legal" icon={Edit3}>
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          readOnly={!canEdit}
          rows={4}
          className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
          aria-label="Notas legales de la plantilla"
        />
      </SectionToggle>

      <div className="px-5 py-4">
        <div className="flex flex-wrap gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium ${
              diagnostics.blocking > 0
                ? "bg-[var(--status-error)] text-[var(--g-text-inverse)]"
                : "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
            }`}
            style={{ borderRadius: "var(--g-radius-full)" }}
          >
            {diagnostics.blocking > 0 ? (
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {diagnostics.blocking} blocking
          </span>
          <span
            className="px-2 py-1 text-xs font-medium bg-[var(--status-warning)] text-[var(--g-text-inverse)]"
            style={{ borderRadius: "var(--g-radius-full)" }}
          >
            {diagnostics.warning} warning
          </span>
          <span
            className="px-2 py-1 text-xs font-medium bg-[var(--status-info)] text-[var(--g-text-inverse)]"
            style={{ borderRadius: "var(--g-radius-full)" }}
          >
            {diagnostics.info} info
          </span>
        </div>
        {diagnostics.issues.length > 0 ? (
          <ul className="mt-3 space-y-1 text-xs">
            {diagnostics.issues.map((issue, index) => (
              <li key={`${issue.code}-${index}`} className={issueTone(issue)}>
                <span className="font-semibold">{issue.code}</span>: {issue.message}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-xs text-[var(--g-text-secondary)]">
            Sin incidencias Gate PRE para guardar el borrador.
          </p>
        )}
      </div>
    </div>
  );
}
