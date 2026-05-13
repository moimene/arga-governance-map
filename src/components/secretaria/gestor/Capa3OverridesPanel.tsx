import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Layers, RotateCcw, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { usePlantillasProtegidas, type PlantillaProtegidaRow } from "@/hooks/usePlantillasProtegidas";
import {
  buildCapa3OverridePayload,
  useCapa3Overrides,
  useDeleteCapa3Override,
  useUpsertCapa3Override,
  type Capa3OverrideAdminRow,
  type Capa3OverrideDraft,
  type ObligatoriedadOverride,
} from "@/hooks/useCapa3Overrides";

const OBLIGATORIEDAD_OPTIONS: ObligatoriedadOverride[] = ["OBLIGATORIO", "RECOMENDADO", "OPCIONAL"];
const FIELD_CLASS_NAME =
  "border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm font-normal normal-case tracking-normal text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] focus:ring-offset-2 focus:ring-offset-[var(--g-surface-card)]";
const PRIMARY_BUTTON_CLASS_NAME =
  "inline-flex items-center gap-1.5 bg-[var(--g-brand-3308)] px-3 py-2 text-sm font-medium text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] focus:ring-offset-2 focus:ring-offset-[var(--g-surface-card)] disabled:opacity-50";
const SECONDARY_BUTTON_CLASS_NAME =
  "inline-flex items-center gap-1.5 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm font-medium text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] focus:ring-offset-2 focus:ring-offset-[var(--g-surface-card)] disabled:opacity-50";

type Capa3Field = NonNullable<PlantillaProtegidaRow["capa3_editables"]>[number];

function valueText(value: unknown) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map((item) => String(item)).join(", ");
  return String(value);
}

function buildInitialDraft(current?: Capa3OverrideAdminRow): Capa3OverrideDraft {
  return {
    defaultValue: valueText(current?.default_value_override),
    opciones: valueText(current?.opciones_override),
    obligatoriedad: current?.obligatoriedad_override ?? "",
    motivo: current?.motivo ?? "",
  };
}

function OverrideFieldRow({
  entityId,
  plantilla,
  field,
  current,
}: {
  entityId: string;
  plantilla: PlantillaProtegidaRow;
  field: Capa3Field;
  current?: Capa3OverrideAdminRow;
}) {
  const [draft, setDraft] = useState<Capa3OverrideDraft>(() => buildInitialDraft(current));
  const [error, setError] = useState<string | null>(null);
  const upsert = useUpsertCapa3Override();
  const deleteOverride = useDeleteCapa3Override();

  useEffect(() => {
    setDraft(buildInitialDraft(current));
    setError(null);
  }, [current]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(buildInitialDraft(current));
  const compatible = !current || current.compatible_with_canonical_version === plantilla.version;
  const rowId = `capa3-${plantilla.id}-${field.campo}`;
  const errorId = `${rowId}-error`;
  const describedBy = error ? errorId : undefined;

  const save = async () => {
    const parsed = buildCapa3OverridePayload(draft);
    if (parsed.ok !== true) {
      setError(parsed.message);
      return;
    }

    try {
      await upsert.mutateAsync({
        entityId,
        plantillaId: plantilla.id,
        campo: field.campo,
        canonicalVersion: plantilla.version,
        ...parsed.payload,
      });
      setError(null);
      toast.success("Override Capa 3 guardado");
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo guardar el override";
      setError(message);
      toast.error(message);
    }
  };

  const remove = async () => {
    if (!current) return;
    try {
      await deleteOverride.mutateAsync({ entityId, plantillaId: plantilla.id, campo: field.campo });
      setError(null);
      toast.success("Override Capa 3 eliminado");
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo eliminar el override";
      setError(message);
      toast.error(message);
    }
  };

  return (
    <div
      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
      style={{ borderRadius: "var(--g-radius-lg)" }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-mono text-sm font-semibold text-[var(--g-brand-3308)]">{field.campo}</h3>
            <span
              className={`px-2 py-0.5 text-[11px] font-medium ${
                current
                  ? "bg-[var(--g-sec-100)] text-[var(--g-brand-3308)]"
                  : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
              }`}
              style={{ borderRadius: "var(--g-radius-full)" }}
            >
              {current ? "Override activo" : "Canónico"}
            </span>
            {!compatible ? (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium bg-[var(--status-warning)] text-[var(--g-text-inverse)]"
                style={{ borderRadius: "var(--g-radius-full)" }}
              >
                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                Versión obsoleta
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
            {field.descripcion ?? "Campo editable sin descripción jurídica."}
          </p>
          <p className="mt-2 text-xs text-[var(--g-text-secondary)]">
            Canónico: obligatoriedad {field.obligatoriedad}
            {field.default !== undefined ? ` · default ${valueText(field.default)}` : ""}
            {field.opciones ? ` · opciones ${valueText(field.opciones)}` : ""}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
          Default override
          <input
            id={`${rowId}-default`}
            value={draft.defaultValue}
            onChange={(e) => setDraft((currentDraft) => ({ ...currentDraft, defaultValue: e.target.value }))}
            aria-invalid={!!error}
            aria-describedby={describedBy}
            className={FIELD_CLASS_NAME}
            style={{ borderRadius: "var(--g-radius-md)" }}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
          Opciones override
          <input
            id={`${rowId}-opciones`}
            value={draft.opciones}
            onChange={(e) => setDraft((currentDraft) => ({ ...currentDraft, opciones: e.target.value }))}
            aria-invalid={!!error}
            aria-describedby={describedBy}
            className={FIELD_CLASS_NAME}
            style={{ borderRadius: "var(--g-radius-md)" }}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
          Obligatoriedad override
          <select
            id={`${rowId}-obligatoriedad`}
            value={draft.obligatoriedad}
            onChange={(e) =>
              setDraft((currentDraft) => ({
                ...currentDraft,
                obligatoriedad: e.target.value as ObligatoriedadOverride | "",
              }))
            }
            aria-invalid={!!error}
            aria-describedby={describedBy}
            className={FIELD_CLASS_NAME}
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <option value="">Mantener canónico</option>
            {OBLIGATORIEDAD_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-3 flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
        Motivo
        <textarea
          id={`${rowId}-motivo`}
          value={draft.motivo}
          onChange={(e) => setDraft((currentDraft) => ({ ...currentDraft, motivo: e.target.value }))}
          rows={2}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={FIELD_CLASS_NAME}
          style={{ borderRadius: "var(--g-radius-md)" }}
        />
      </label>

      {error ? (
        <p id={errorId} className="mt-2 text-xs text-[var(--status-error)]">
          {error}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || upsert.isPending || deleteOverride.isPending}
          className={PRIMARY_BUTTON_CLASS_NAME}
          style={{ borderRadius: "var(--g-radius-md)" }}
          aria-busy={upsert.isPending}
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          Guardar override
        </button>
        <button
          type="button"
          onClick={() => setDraft(buildInitialDraft(current))}
          disabled={!dirty || upsert.isPending || deleteOverride.isPending}
          className={SECONDARY_BUTTON_CLASS_NAME}
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Cancelar
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={!current || upsert.isPending || deleteOverride.isPending}
          className={SECONDARY_BUTTON_CLASS_NAME}
          style={{ borderRadius: "var(--g-radius-md)" }}
          aria-busy={deleteOverride.isPending}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Eliminar
        </button>
      </div>
    </div>
  );
}

export function Capa3OverridesPanel({ entityId }: { entityId: string }) {
  const plantillas = usePlantillasProtegidas();
  const activeTemplates = useMemo(
    () =>
      (plantillas.data ?? []).filter(
        (plantilla) => plantilla.estado === "ACTIVA" && (plantilla.capa3_editables?.length ?? 0) > 0,
      ),
    [plantillas.data],
  );
  const [plantillaId, setPlantillaId] = useState<string>("");

  useEffect(() => {
    if (!plantillaId && activeTemplates[0]) {
      setPlantillaId(activeTemplates[0].id);
    }
  }, [activeTemplates, plantillaId]);

  const selected = activeTemplates.find((plantilla) => plantilla.id === plantillaId) ?? null;
  const overrides = useCapa3Overrides(entityId, selected?.id ?? null);
  const overridesByCampo = useMemo(() => {
    const map = new Map<string, Capa3OverrideAdminRow>();
    for (const row of overrides.data ?? []) {
      map.set(row.campo, row);
    }
    return map;
  }, [overrides.data]);

  return (
    <section
      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-5"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-[var(--g-brand-3308)]" aria-hidden="true" />
            <h2 className="text-lg font-semibold text-[var(--g-text-primary)]">
              Overrides Capa 3 por sociedad
            </h2>
          </div>
          <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
            Defaults, opciones y obligatoriedad por campo sin modificar la plantilla canónica.
          </p>
        </div>

        <label className="flex min-w-[320px] flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
          Plantilla activa
          <select
            value={plantillaId}
            onChange={(e) => setPlantillaId(e.target.value)}
            disabled={plantillas.isLoading || activeTemplates.length === 0}
            className={FIELD_CLASS_NAME}
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <option value="">Selecciona plantilla</option>
            {activeTemplates.map((plantilla) => (
              <option key={plantilla.id} value={plantilla.id}>
                {plantilla.tipo} · {plantilla.materia ?? "Sin materia"} · v{plantilla.version}
              </option>
            ))}
          </select>
        </label>
      </div>

      {plantillas.isLoading ? (
        <p className="mt-4 text-sm text-[var(--g-text-secondary)]">Cargando plantillas activas...</p>
      ) : null}

      {!plantillas.isLoading && activeTemplates.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--g-text-secondary)]">
          No hay plantillas activas con campos Capa 3 para configurar.
        </p>
      ) : null}

      {selected && overrides.isLoading ? (
        <p className="mt-4 text-sm text-[var(--g-text-secondary)]">Cargando overrides...</p>
      ) : null}

      {selected && !overrides.isLoading ? (
        <div className="mt-5 space-y-3">
          {(selected.capa3_editables ?? []).map((field) => (
            <OverrideFieldRow
              key={field.campo}
              entityId={entityId}
              plantilla={selected}
              field={field}
              current={overridesByCampo.get(field.campo)}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
