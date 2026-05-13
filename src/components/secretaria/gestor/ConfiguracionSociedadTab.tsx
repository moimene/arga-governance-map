import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, RotateCcw, Save, Settings2, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { useSecretariaScope } from "@/components/secretaria/shell";
import {
  useEntitySettingsCatalog,
  type EntitySettingsCatalogRow,
} from "@/hooks/useEntitySettingsCatalog";
import {
  parseEntitySettingInput,
  settingValueToDraft,
  useDeleteEntitySetting,
  useEntitySettings,
  useUpsertEntitySetting,
  type EntitySettingRow,
} from "@/hooks/useEntitySettings";
import { Capa3OverridesPanel } from "./Capa3OverridesPanel";

const CATEGORY_LABEL: Record<EntitySettingsCatalogRow["categoria"], string> = {
  CARGO: "Cargos y firmantes",
  CONFIG_CONDICIONAL: "Configuración condicional",
  PERFIL_SOCIETARIO: "Perfil societario",
  PERFIL_SECTORIAL: "Perfil sectorial",
};

function valuePreview(value: unknown) {
  if (value === null || value === undefined || value === "") return "Sin valor";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return String(value);
}

function allowedValues(row: EntitySettingsCatalogRow) {
  return Array.isArray(row.allowed_values) ? row.allowed_values.map((value) => String(value)) : [];
}

function SettingRow({
  catalog,
  current,
  entityId,
}: {
  catalog: EntitySettingsCatalogRow;
  current?: EntitySettingRow;
  entityId: string;
}) {
  const effectiveValue = current?.value ?? catalog.default_value;
  const [draft, setDraft] = useState(() => settingValueToDraft(effectiveValue, catalog));
  const [error, setError] = useState<string | null>(null);
  const upsert = useUpsertEntitySetting();
  const deleteSetting = useDeleteEntitySetting();

  useEffect(() => {
    setDraft(settingValueToDraft(effectiveValue, catalog));
    setError(null);
  }, [catalog, effectiveValue]);

  const isOverride = !!current;
  const dirty = draft !== settingValueToDraft(effectiveValue, catalog);
  const inputId = `entity-setting-${catalog.key}`;
  const errorId = `${inputId}-error`;
  const describedBy = error ? errorId : undefined;
  const fieldClassName =
    "border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm font-normal normal-case tracking-normal text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] focus:ring-offset-2 focus:ring-offset-[var(--g-surface-card)]";

  const save = async () => {
    const parsed = parseEntitySettingInput(catalog, draft);
    if (parsed.ok !== true) {
      setError(parsed.message);
      return;
    }
    try {
      await upsert.mutateAsync({ entityId, key: catalog.key, value: parsed.value });
      setError(null);
      toast.success("Configuración guardada");
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo guardar la configuración";
      setError(message);
      toast.error(message);
    }
  };

  const restoreDefault = async () => {
    if (!isOverride) return;
    try {
      await deleteSetting.mutateAsync({ entityId, key: catalog.key });
      setError(null);
      toast.success("Override eliminado; se usará el default del catálogo");
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo restaurar el default";
      setError(message);
      toast.error(message);
    }
  };

  return (
    <div
      className="grid gap-3 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(220px,0.7fr)_auto]"
      style={{ borderRadius: "var(--g-radius-lg)" }}
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-mono text-sm font-semibold text-[var(--g-brand-3308)]">
            {catalog.key}
          </h3>
          <span
            className={`px-2 py-0.5 text-[11px] font-medium ${
              isOverride
                ? "bg-[var(--g-sec-100)] text-[var(--g-brand-3308)]"
                : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
            }`}
            style={{ borderRadius: "var(--g-radius-full)" }}
          >
            {isOverride ? "Override sociedad" : "Default catálogo"}
          </span>
          <span
            className="px-2 py-0.5 text-[11px] font-medium bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
            style={{ borderRadius: "var(--g-radius-full)" }}
          >
            {catalog.value_type}
          </span>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-[var(--g-text-secondary)]">
          {catalog.descripcion}
        </p>
        <p className="mt-2 text-xs text-[var(--g-text-secondary)]">
          Valor efectivo:{" "}
          <span className="font-medium text-[var(--g-text-primary)]">
            {valuePreview(effectiveValue)}
          </span>
        </p>
        {catalog.usado_por_plantillas && catalog.usado_por_plantillas.length > 0 ? (
          <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
            Usado por: {catalog.usado_por_plantillas.join(", ")}
          </p>
        ) : null}
      </div>

      <label
        htmlFor={inputId}
        className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]"
      >
        Valor sociedad
        {catalog.value_type === "boolean" ? (
          <select
            id={inputId}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-invalid={!!error}
            aria-describedby={describedBy}
            className={fieldClassName}
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <option value="">Sin valor</option>
            <option value="true">Sí</option>
            <option value="false">No</option>
          </select>
        ) : null}
        {catalog.value_type === "enum" ? (
          <select
            id={inputId}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-invalid={!!error}
            aria-describedby={describedBy}
            className={fieldClassName}
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <option value="">Sin valor</option>
            {allowedValues(catalog).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        ) : null}
        {catalog.value_type === "text" || catalog.value_type === "number" ? (
          <input
            id={inputId}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            type={catalog.value_type === "number" ? "number" : "text"}
            aria-invalid={!!error}
            aria-describedby={describedBy}
            className={fieldClassName}
            style={{ borderRadius: "var(--g-radius-md)" }}
          />
        ) : null}
        {error ? (
          <span id={errorId} className="text-xs normal-case tracking-normal text-[var(--status-error)]">
            {error}
          </span>
        ) : null}
      </label>

      <div className="flex flex-wrap items-end gap-2 lg:justify-end">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || upsert.isPending || deleteSetting.isPending}
          className="inline-flex items-center gap-1.5 bg-[var(--g-brand-3308)] px-3 py-2 text-sm font-medium text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] focus:ring-offset-2 focus:ring-offset-[var(--g-surface-card)] disabled:opacity-50"
          style={{ borderRadius: "var(--g-radius-md)" }}
          aria-busy={upsert.isPending}
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          Guardar
        </button>
        <button
          type="button"
          onClick={restoreDefault}
          disabled={!isOverride || upsert.isPending || deleteSetting.isPending}
          className="inline-flex items-center gap-1.5 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm font-medium text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] focus:ring-offset-2 focus:ring-offset-[var(--g-surface-card)] disabled:opacity-50"
          style={{ borderRadius: "var(--g-radius-md)" }}
          aria-busy={deleteSetting.isPending}
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Restaurar default
        </button>
      </div>
    </div>
  );
}

export function ConfiguracionSociedadTab() {
  const scope = useSecretariaScope();
  const selectedEntityId = scope.selectedEntity?.id ?? null;
  const catalog = useEntitySettingsCatalog();
  const settings = useEntitySettings(selectedEntityId);

  const grouped = useMemo(() => {
    const groups = new Map<EntitySettingsCatalogRow["categoria"], EntitySettingsCatalogRow[]>();
    for (const row of catalog.data ?? []) {
      const list = groups.get(row.categoria) ?? [];
      list.push(row);
      groups.set(row.categoria, list);
    }
    return [...groups.entries()];
  }, [catalog.data]);

  const isLoading = scope.isLoadingEntities || catalog.isLoading || settings.isLoading;

  return (
    <div className="space-y-5">
      <section
        className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-5"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-[var(--g-brand-3308)]" aria-hidden="true" />
              <h2 className="text-lg font-semibold text-[var(--g-text-primary)]">
                Configuración por sociedad
              </h2>
            </div>
            <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
              Valores ENTIDAD.* para condicionales de capa 1 y firmantes textuales.
            </p>
          </div>

          <label className="flex min-w-[280px] flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
            Sociedad
            <select
              value={selectedEntityId ?? ""}
              onChange={(e) => {
                if (e.target.value) scope.setEntity(e.target.value);
              }}
              disabled={scope.isLoadingEntities}
              className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm font-normal normal-case tracking-normal text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] focus:ring-offset-2 focus:ring-offset-[var(--g-surface-card)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <option value="">Selecciona sociedad</option>
              {scope.entities.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.legalName}
                </option>
              ))}
            </select>
          </label>
        </div>

        {scope.mode !== "sociedad" ? (
          <div
            className="mt-4 flex items-start gap-2 bg-[var(--g-surface-subtle)] p-3 text-sm text-[var(--g-text-secondary)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <SlidersHorizontal className="mt-0.5 h-4 w-4 text-[var(--g-brand-3308)]" aria-hidden="true" />
            Selecciona una sociedad para pasar el Gestor al contexto societario y editar sus overrides.
          </div>
        ) : null}
      </section>

      {!selectedEntityId ? (
        <div className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-6 text-sm text-[var(--g-text-secondary)]">
          No hay sociedad seleccionada.
        </div>
      ) : null}

      {selectedEntityId && isLoading ? (
        <div className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-6 text-sm text-[var(--g-text-secondary)]">
          Cargando configuración de sociedad...
        </div>
      ) : null}

      {selectedEntityId && !isLoading && grouped.length === 0 ? (
        <div className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-6 text-sm text-[var(--g-text-secondary)]">
          No hay claves activas en el catálogo de configuración.
        </div>
      ) : null}

      {selectedEntityId && !isLoading
        ? grouped.map(([category, rows]) => (
            <section key={category} className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[var(--status-success)]" aria-hidden="true" />
                <h2 className="text-base font-semibold text-[var(--g-text-primary)]">
                  {CATEGORY_LABEL[category]}
                </h2>
                <span className="text-xs text-[var(--g-text-secondary)]">{rows.length}</span>
              </div>
              <div className="space-y-3">
                {rows.map((row) => (
                  <SettingRow
                    key={row.key}
                    catalog={row}
                    current={settings.byKey.get(row.key)}
                    entityId={selectedEntityId}
                  />
                ))}
              </div>
            </section>
          ))
        : null}

      {selectedEntityId && !isLoading ? <Capa3OverridesPanel entityId={selectedEntityId} /> : null}
    </div>
  );
}
