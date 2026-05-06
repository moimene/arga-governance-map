import { forwardRef, useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Building2, Network } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SecretariaMode, SecretariaScopeController } from "./types";

interface ScopeSwitcherProps {
  scope: SecretariaScopeController;
}

const MODE_OPTIONS: Array<{ mode: SecretariaMode; label: string; icon: typeof Network }> = [
  { mode: "grupo", label: "Grupo", icon: Network },
  { mode: "sociedad", label: "Sociedad", icon: Building2 },
];

export const ScopeSwitcher = forwardRef<HTMLDivElement, ScopeSwitcherProps>(({ scope }, ref) => {
  const location = useLocation();
  const navigate = useNavigate();
  const selectValue = scope.selectedEntity?.id ?? "";
  const selectedEntityInList = scope.entities.some((entity) => entity.id === selectValue);
  const currentSearchParams = new URLSearchParams(location.search);
  const currentScopeParam = currentSearchParams.get("scope");
  const currentEntityParam = currentSearchParams.get("entity");

  const getSociedadPath = useCallback((entityId: string) => {
    if (location.pathname === "/secretaria/sociedades" || /^\/secretaria\/sociedades\/[^/]+/.test(location.pathname)) {
      return `/secretaria/sociedades/${entityId}`;
    }
    return location.pathname;
  }, [location.pathname]);

  const navigateToSociedad = useCallback((entityId: string) => {
    const params = new URLSearchParams(location.search);
    params.set("scope", "sociedad");
    params.set("entity", entityId);
    navigate(`${getSociedadPath(entityId)}?${params.toString()}`);
  }, [getSociedadPath, location.search, navigate]);

  useEffect(() => {
    if (scope.mode !== "sociedad") return;

    const entityId = scope.selectedEntity?.id;
    if (!entityId) return;
    if (currentScopeParam === "sociedad" && currentEntityParam === entityId) return;

    navigateToSociedad(entityId);
  }, [
    currentEntityParam,
    currentScopeParam,
    navigateToSociedad,
    scope.mode,
    scope.selectedEntity?.id,
  ]);

  const selectMode = (mode: SecretariaMode) => {
    scope.setMode(mode);

    if (mode === "sociedad") {
      const entityId = scope.selectedEntity?.id ?? scope.entities[0]?.id;
      if (entityId) navigateToSociedad(entityId);
      return;
    }

    const params = new URLSearchParams(location.search);
    params.delete("scope");
    params.delete("entity");
    const pathname = /^\/secretaria\/sociedades\/[^/]+/.test(location.pathname)
      ? "/secretaria/sociedades"
      : location.pathname;
    const search = params.toString();
    navigate(`${pathname}${search ? `?${search}` : ""}`);
  };

  const selectEntity = (entityId: string) => {
    scope.setEntity(entityId);
    navigateToSociedad(entityId);
  };

  const helperCopy =
    scope.mode === "sociedad"
      ? "Navegación y búsqueda centradas en la sociedad seleccionada."
      : "Visión multi-sociedad para campañas, sociedades y control de grupo.";

  return (
    <div ref={ref} className="space-y-3">
      <div className="space-y-1.5">
        <span className="block text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--sidebar-foreground))]/65">
          Ámbito
        </span>
        <div className="grid grid-cols-2 gap-1">
          {MODE_OPTIONS.map((option) => {
            const Icon = option.icon;
            const active = scope.mode === option.mode;

            return (
              <button
                key={option.mode}
                type="button"
                onClick={() => selectMode(option.mode)}
                aria-pressed={active}
                className={cn(
                  "inline-flex h-9 items-center justify-center gap-1.5 border px-2 text-[12px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--g-border-focus)]",
                  active
                    ? "border-[hsl(var(--sidebar-accent))] bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-foreground))]"
                    : "border-[hsl(var(--sidebar-border))] bg-transparent text-[hsl(var(--sidebar-foreground))]/75 hover:bg-[hsl(var(--sidebar-accent))]/50 hover:text-[hsl(var(--sidebar-foreground))]"
                )}
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {scope.mode === "sociedad" ? (
        <label className="block space-y-1.5">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--sidebar-foreground))]/65">
            Sociedad
          </span>
          <select
            value={selectValue}
            onChange={(event) => selectEntity(event.target.value)}
            disabled={scope.isLoadingEntities || scope.entities.length === 0}
            aria-label="Sociedad seleccionada"
            className="h-10 w-full border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-background))] px-2 text-[12px] font-medium text-[hsl(var(--sidebar-foreground))] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--g-border-focus)] disabled:cursor-not-allowed disabled:opacity-70"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <option value="" disabled>
              {scope.isLoadingEntities ? "Cargando sociedades" : "Seleccionar sociedad"}
            </option>
            {selectValue && scope.selectedEntity && !selectedEntityInList ? (
              <option value={selectValue}>{scope.selectedEntity.legalName}</option>
            ) : null}
            {scope.entities.map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.legalName}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <p className="text-[11px] leading-snug text-[hsl(var(--sidebar-foreground))]/65">
        {helperCopy}
      </p>
    </div>
  );
});

ScopeSwitcher.displayName = "ScopeSwitcher";
