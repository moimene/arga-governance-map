import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useEntitiesList, type EntityWithParent } from "@/hooks/useEntities";
import { getSecretariaSectionLabel } from "./navigation";
import type { SecretariaEntityOption, SecretariaMode, SecretariaScopeController } from "./types";

const STORAGE_KEY = "secretaria-shell-scope-v1";
const SCOPE_PARAM = "scope";
const ENTITY_PARAM = "entity";

interface StoredScope {
  mode?: SecretariaMode;
  entityId?: string;
}

function readStoredScope(): StoredScope {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredScope) : {};
  } catch {
    return {};
  }
}

function writeStoredScope(scope: StoredScope) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(scope));
}

function toEntityOption(entity: EntityWithParent): SecretariaEntityOption {
  return {
    id: entity.id,
    name: entity.common_name || entity.legal_name,
    legalName: entity.legal_name || entity.common_name,
    jurisdiction: entity.jurisdiction,
    legalForm: entity.legal_form || "Sociedad",
    status: entity.entity_status,
    materiality: entity.materiality,
    tipoSocial: entity.tipo_social ?? null,
  };
}

function extractSociedadId(pathname: string) {
  const match = pathname.match(/^\/secretaria\/sociedades\/([^/]+)/);
  const id = match?.[1] ? decodeURIComponent(match[1]) : "";
  return id && id !== "nueva" ? id : null;
}

function readQueryMode(searchParams: URLSearchParams): SecretariaMode | null {
  const scope = searchParams.get(SCOPE_PARAM);
  if (scope === "grupo" || scope === "sociedad") return scope;
  return searchParams.get(ENTITY_PARAM) ? "sociedad" : null;
}

function getPreferredEntity(entities: SecretariaEntityOption[]) {
  return (
    entities.find((entity) => entity.legalName === "ARGA Seguros, S.A.") ??
    entities.find((entity) => entity.name === "ARGA Seguros, S.A.") ??
    entities.find((entity) => entity.legalName.startsWith("ARGA Seguros,")) ??
    entities.find((entity) => entity.name.startsWith("ARGA Seguros,")) ??
    entities[0] ??
    null
  );
}

export function useSecretariaScope(): SecretariaScopeController {
  const location = useLocation();
  const pathEntityId = useMemo(() => extractSociedadId(location.pathname), [location.pathname]);
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const queryMode = useMemo(() => readQueryMode(searchParams), [searchParams]);
  const queryEntityId = searchParams.get(ENTITY_PARAM) || null;
  const routeEntityId = pathEntityId ?? queryEntityId;
  const { data: entityRows = [], isLoading } = useEntitiesList({ sociedadesOnly: true });
  const entities = useMemo(() => entityRows.map(toEntityOption), [entityRows]);
  const preferredEntity = useMemo(() => getPreferredEntity(entities), [entities]);

  const [scope, setScope] = useState<StoredScope>(() => {
    const stored = readStoredScope();
    return {
      mode: queryMode ?? stored.mode ?? "grupo",
      entityId: routeEntityId ?? stored.entityId,
    };
  });

  useEffect(() => {
    if (routeEntityId) {
      setScope((current) => {
        if (current.mode === "sociedad" && current.entityId === routeEntityId) return current;
        return { mode: "sociedad", entityId: routeEntityId };
      });
      return;
    }

    if (queryMode === "grupo") {
      setScope((current) => (current.mode === "grupo" ? current : { mode: "grupo", entityId: current.entityId }));
    }
  }, [queryMode, routeEntityId]);

  useEffect(() => {
    if (scope.mode !== "sociedad" || scope.entityId || !preferredEntity) return;
    setScope({ mode: "sociedad", entityId: preferredEntity.id });
  }, [preferredEntity, scope.entityId, scope.mode]);

  useEffect(() => {
    writeStoredScope(scope);
  }, [scope]);

  const mode = scope.mode ?? "grupo";
  const selectedEntityId = mode === "sociedad" ? routeEntityId ?? scope.entityId ?? null : null;
  const selectedEntity =
    entities.find((entity) => entity.id === selectedEntityId) ??
    (selectedEntityId
      ? {
          id: selectedEntityId,
          name: "Sociedad seleccionada",
          legalName: "Sociedad seleccionada",
          jurisdiction: "Jurisdicción pendiente",
          legalForm: "Sociedad",
          status: "Activa",
          materiality: "Pendiente",
        }
      : null);

  const setMode = useCallback(
    (nextMode: SecretariaMode) => {
      setScope((current) => {
        if (nextMode === "grupo") return { mode: "grupo", entityId: current.entityId };
        return { mode: "sociedad", entityId: current.entityId ?? preferredEntity?.id };
      });
    },
    [preferredEntity?.id]
  );

  const setEntity = useCallback((entityId: string) => {
    setScope({ mode: "sociedad", entityId });
  }, []);

  const createScopedTo = useCallback(
    (to: string) => {
      // Codex P2 round 11: hash-aware splitting.
      // Antes: `to.split("?")` solo separaba query, dejando `#hash` dentro
      // del pathname → al re-appendar `?params`, el resultado era
      // `/path#hash?params` y React Router metía todos los params dentro
      // del fragment.
      //
      // Ahora: extraer hash primero, luego query del path puro.
      // Resultado canónico: `pathname?query#hash` (RFC 3986).
      const [pathAndSearch, hash = ""] = to.split("#");
      const [pathname, existingSearch = ""] = pathAndSearch.split("?");
      const params = new URLSearchParams(existingSearch);
      if (mode === "grupo") {
        params.set(SCOPE_PARAM, "grupo");
        params.delete(ENTITY_PARAM);
      } else {
        const entityId = selectedEntity?.id ?? selectedEntityId;
        if (!entityId) return to;
        params.set(SCOPE_PARAM, "sociedad");
        params.set(ENTITY_PARAM, entityId);
      }
      const search = `?${params.toString()}`;
      const hashSuffix = hash ? `#${hash}` : "";
      return `${pathname}${search}${hashSuffix}`;
    },
    [mode, selectedEntity?.id, selectedEntityId]
  );

  return {
    mode,
    selectedEntity,
    entities,
    isLoadingEntities: isLoading,
    currentSection: getSecretariaSectionLabel(location.pathname, mode),
    setMode,
    setEntity,
    createScopedTo,
  };
}
