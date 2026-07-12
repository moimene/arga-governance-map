export type SearchParamPatchValue = string | number | boolean | null | undefined;

export type TemplateCycleParam = "vigentes" | "preparacion" | "historico" | "todas";

export type TemplateRouteScope = "grupo" | "sociedad";

export const TEMPLATE_CYCLE_PARAMS: readonly TemplateCycleParam[] = [
  "vigentes",
  "preparacion",
  "historico",
  "todas",
];

export const TEMPLATE_HANDOFF_PARAMS = [
  "plantilla",
  "tipo",
  "materia",
  "certificacion",
  "agreement",
  "scope",
  "entity",
] as const;

type SearchParamsInput = URLSearchParams | string;

function toSearchParams(input: SearchParamsInput) {
  return input instanceof URLSearchParams ? new URLSearchParams(input) : new URLSearchParams(input);
}

export function patchSearchParams(
  current: SearchParamsInput,
  patch: Record<string, SearchParamPatchValue>,
) {
  const next = toSearchParams(current);
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      next.delete(key);
    } else if (value !== undefined) {
      next.set(key, String(value));
    }
  }
  return next;
}

export function pickSearchParams(current: SearchParamsInput, keys: readonly string[]) {
  const source = toSearchParams(current);
  const picked = new URLSearchParams();
  for (const key of keys) {
    for (const value of source.getAll(key)) picked.append(key, value);
  }
  return picked;
}

/**
 * Conserva el ámbito explícito sin permitir combinaciones ambiguas:
 * `entity` solo viaja con `scope=sociedad`; un entity legacy sin scope se
 * normaliza a sociedad y `scope=grupo` elimina cualquier entity residual.
 */
export function normalizeScopeSearchParams(current: SearchParamsInput) {
  const next = toSearchParams(current);
  const scope = next.get("scope");
  const entityId = next.get("entity");

  if (scope === "grupo") {
    next.delete("entity");
    return next;
  }

  if (scope === "sociedad") {
    if (!entityId) next.delete("entity");
    return next;
  }

  if (entityId) {
    next.set("scope", "sociedad");
  } else {
    next.delete("scope");
    next.delete("entity");
  }
  return next;
}

export function pickTemplateHandoffSearchParams(current: SearchParamsInput) {
  return normalizeScopeSearchParams(pickSearchParams(current, TEMPLATE_HANDOFF_PARAMS));
}

export function buildUrlWithSearchParams(pathname: string, params: SearchParamsInput) {
  const search = toSearchParams(params).toString();
  return `${pathname}${search ? `?${search}` : ""}`;
}

/**
 * Conserva el contexto de navegación actual y aplica encima los parámetros
 * explícitos del destino. Es útil para saltos internos del Gestor: cambiar de
 * tab no debe borrar sociedad, materia, plantilla ni filtros recuperables.
 */
export function mergeUrlSearchParams(target: string, current: SearchParamsInput) {
  const parsed = new URL(target, "https://tgms.local");
  const merged = toSearchParams(current);
  for (const [key, value] of parsed.searchParams) merged.set(key, value);
  return `${buildUrlWithSearchParams(parsed.pathname, merged)}${parsed.hash}`;
}

function appendRouteScope(
  params: URLSearchParams,
  input: { scope?: TemplateRouteScope | null; entityId?: string | null },
) {
  const scope = input.scope ?? (input.entityId ? "sociedad" : null);
  if (!scope) return;

  params.set("scope", scope);
  if (scope === "sociedad" && input.entityId) {
    params.set("entity", input.entityId);
  } else {
    params.delete("entity");
  }
}

export function applyTemplateRouteScope(
  target: string,
  scope: TemplateRouteScope,
  entityId?: string | null,
) {
  const parsed = new URL(target, "https://tgms.local");
  appendRouteScope(parsed.searchParams, { scope, entityId });
  return buildUrlWithSearchParams(parsed.pathname, parsed.searchParams);
}

export function isTemplateCycleParam(value?: string | null): value is TemplateCycleParam {
  return TEMPLATE_CYCLE_PARAMS.includes(value as TemplateCycleParam);
}

export function templateCycleForEstado(estado?: string | null): Exclude<TemplateCycleParam, "todas"> {
  const normalized = (estado ?? "").trim().toUpperCase();
  if (normalized === "ACTIVA") return "vigentes";
  if (normalized === "ARCHIVADA" || normalized === "DEPRECADA") return "historico";
  return "preparacion";
}

export function buildTemplateLibraryUrl(input: {
  materia?: string | null;
  tipo?: string | null;
  plantilla?: string | null;
  ciclo?: TemplateCycleParam | null;
  scope?: TemplateRouteScope | null;
  entityId?: string | null;
}) {
  const params = new URLSearchParams();
  if (input.materia) params.set("materia", input.materia);
  if (input.tipo) params.set("tipo", input.tipo);
  if (input.plantilla) params.set("plantilla", input.plantilla);
  if (input.ciclo) params.set("ciclo", input.ciclo);
  appendRouteScope(params, input);
  return buildUrlWithSearchParams("/secretaria/plantillas", params);
}

export function buildTemplateGovernanceUrl(input: {
  tab?: string | null;
  materia?: string | null;
  plantilla?: string | null;
  estado?: string | null;
  scope?: TemplateRouteScope | null;
  entityId?: string | null;
}) {
  const params = new URLSearchParams();
  params.set("tab", input.tab ?? "catalogo");
  if (input.materia) params.set("materia", input.materia);
  if (input.plantilla) params.set("plantilla", input.plantilla);
  if (input.estado) params.set("estado", input.estado);
  appendRouteScope(params, input);
  return buildUrlWithSearchParams("/secretaria/gestor-plantillas", params);
}

export function buildMatterCatalogUrl(input: {
  materia?: string | null;
  vista?: string | null;
  scope?: TemplateRouteScope | null;
  entityId?: string | null;
}) {
  const params = new URLSearchParams();
  if (input.materia) params.set("materia", input.materia);
  if (input.vista) params.set("vista", input.vista);
  appendRouteScope(params, input);
  return buildUrlWithSearchParams("/secretaria/catalogo-materias", params);
}
