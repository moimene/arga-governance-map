import { forwardRef } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { BookOpen, ChevronLeft } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { GlobalSearch } from "@/components/secretaria/GlobalSearch";
import {
  getVisibleSidebarSections,
  isItemDisabled,
} from "@/lib/secretaria/sidebar-visibility";
import { getNavGroups } from "./navigation";
import { ScopeSwitcher } from "./ScopeSwitcher";
import { useSidebarVisibility } from "./useSidebarVisibilityContext";
import type { SecretariaScopeController } from "./types";

interface SecretariaSidebarProps {
  scope: SecretariaScopeController;
}

interface SecretariaSidebarContentProps {
  scope: SecretariaScopeController;
  onNavigate?: () => void;
}

/**
 * Skeleton "honesto" — sólo renderiza placeholders para items que NO tienen
 * filtros entity-dependent, evitando el height jump cuando el render real
 * filtra items con `requiresCollegiateBody`, `requiresUnipersonalAdmin`, etc.
 *
 * Items que SÍ aparecen en skeleton:
 *   - Sin `visibility` rule (siempre visibles)
 *   - Sólo con `requiresEntity: true` (visible si modo sociedad + entidad)
 *
 * Items que NO aparecen en skeleton (estructura puede o no incluirlos):
 *   - `requiresCollegiateBody`, `requiresUnipersonalAdmin`, `requiresCotizada`,
 *     `excludesIfCotizada`, `requiresBodyType` → depende de la entidad
 *   - `requiresCapability` → depende de capability_matrix + rol
 *   - `excludesIfReferenceOnly` → depende de readiness
 *
 * Esto produce un skeleton menor o igual que el render final, sin saltos
 * estructurales hacia arriba al hidratar.
 */
function isEntityIndependentItem(item: { visibility?: { requiresCollegiateBody?: boolean; requiresUnipersonalAdmin?: boolean; requiresCotizada?: boolean; excludesIfCotizada?: boolean; requiresBodyType?: string[]; requiresAdoptionMode?: string[]; requiresCapability?: string; excludesIfReferenceOnly?: boolean } }): boolean {
  const v = item.visibility;
  if (!v) return true;
  if (v.requiresCollegiateBody) return false;
  if (v.requiresUnipersonalAdmin) return false;
  if (v.requiresCotizada) return false;
  if (v.excludesIfCotizada) return false;
  if (v.requiresBodyType && v.requiresBodyType.length > 0) return false;
  if (v.requiresAdoptionMode && v.requiresAdoptionMode.length > 0) return false;
  if (v.requiresCapability) return false;
  if (v.excludesIfReferenceOnly) return false;
  return true;
}

function SecretariaSidebarSkeleton({ groups }: { groups: ReturnType<typeof getNavGroups> }) {
  const stableGroups = groups
    .map((group) => ({ ...group, items: group.items.filter(isEntityIndependentItem) }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="space-y-4" aria-busy="true" aria-label="Cargando estructura del menú">
      {stableGroups.map((group) => (
        <div key={group.label} className="space-y-1" data-sidebar-skeleton-section={group.label}>
          <span className="block px-3 text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--sidebar-foreground))]/35">
            {group.label}
          </span>
          {group.items.map((item, idx) => (
            <span
              key={`${group.label}-${item.to}-${idx}`}
              className="mb-0.5 flex h-9 items-center gap-2.5 px-3"
              style={{ borderRadius: "var(--g-radius-md)" }}
              aria-hidden="true"
            >
              <span className="h-4 w-4 shrink-0 bg-[hsl(var(--sidebar-foreground))]/15" style={{ borderRadius: "2px" }} />
              <span
                className="h-3 bg-[hsl(var(--sidebar-foreground))]/10"
                style={{
                  borderRadius: "var(--g-radius-sm)",
                  width: `${Math.min(80, 40 + (item.label.length * 4))}%`,
                }}
              />
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function isSidebarLinkActive(pathname: string, search: string, to: string, end?: boolean): boolean {
  const [pathAndSearch] = to.split("#");
  const [targetPathname, targetSearch = ""] = pathAndSearch.split("?");
  const targetParams = new URLSearchParams(targetSearch);
  const currentParams = new URLSearchParams(search);

  const pathMatches = end
    ? pathname === targetPathname
    : pathname === targetPathname || pathname.startsWith(`${targetPathname}/`);
  if (!pathMatches) return false;

  for (const key of ["vista", "estado"]) {
    if (targetParams.has(key)) {
      if (currentParams.get(key) !== targetParams.get(key)) return false;
    } else if (currentParams.has(key)) {
      return false;
    }
  }

  return true;
}

function SecretariaSidebarContent({ scope, onNavigate }: SecretariaSidebarContentProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const allGroups = getNavGroups(scope.mode);
  const { context: visibilityCtx, isInitialLoading } = useSidebarVisibility(scope);
  const groups = getVisibleSidebarSections(allGroups, visibilityCtx);

  return (
    <>
      <div className="flex min-h-16 items-center gap-3 border-b border-[hsl(var(--sidebar-border))] px-4">
        <BookOpen className="h-5 w-5 text-[hsl(var(--sidebar-foreground))]" />
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-[13px] font-bold tracking-wide text-[hsl(var(--sidebar-foreground))]">
            Secretaría
          </span>
          <span className="truncate text-[10px] text-[hsl(var(--sidebar-foreground))]/65">
            by Garrigues
          </span>
        </div>
      </div>

      <div className="border-b border-[hsl(var(--sidebar-border))] p-3">
        <ScopeSwitcher scope={scope} />
      </div>

      <nav
        className="flex-1 overflow-y-auto px-2 py-3"
        aria-label="Navegación de Secretaría Societaria"
        data-sidebar-mode={scope.mode}
      >
        <div className="mb-3">
          <GlobalSearch scope={scope} />
        </div>

        {isInitialLoading ? <SecretariaSidebarSkeleton groups={allGroups} /> : null}

        <div className="space-y-4" hidden={isInitialLoading}>
          {groups.map((group) => (
            <div key={group.label} className="space-y-1" data-sidebar-section={group.label}>
              <span className="block px-3 text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--sidebar-foreground))]/55">
                {group.label}
              </span>

              {group.items.map((item) => {
                const Icon = item.icon;
                const disabled = isItemDisabled(item, visibilityCtx);
                const itemTo =
                  item.selectedEntityRoute && scope.selectedEntity
                    ? `/secretaria/sociedades/${scope.selectedEntity.id}`
                    : item.to;
                const scopedTo = scope.createScopedTo(itemTo);
                const active = isSidebarLinkActive(location.pathname, location.search, scopedTo, item.end);

                if (disabled) {
                  // Item disabled: usamos role="link" + aria-disabled + tabIndex=-1
                  // para que sea anunciado correctamente por screen readers como
                  // "enlace deshabilitado" sin entrar en el tab order.
                  return (
                    <span
                      key={`${group.label}-${item.to}-${item.label}`}
                      role="link"
                      aria-disabled="true"
                      tabIndex={-1}
                      data-sidebar-item={item.label}
                      data-sidebar-item-disabled="true"
                      className="mb-0.5 flex cursor-not-allowed items-center gap-2.5 px-3 py-2 text-[13px] text-[hsl(var(--sidebar-foreground))]/45"
                      style={{ borderRadius: "var(--g-radius-md)" }}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </span>
                  );
                }

                return (
                  <NavLink
                    key={`${group.label}-${item.to}-${item.label}`}
                    to={scopedTo}
                    end={item.end}
                    onClick={onNavigate}
                    data-sidebar-item={item.label}
                    className={() =>
                      cn(
                        "mb-0.5 flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--g-border-focus)]",
                        active
                          ? "bg-[hsl(var(--sidebar-accent))] font-semibold text-[hsl(var(--sidebar-foreground))]"
                          : "text-[hsl(var(--sidebar-foreground))]/80 hover:bg-[hsl(var(--sidebar-accent))]/60 hover:text-[hsl(var(--sidebar-foreground))]"
                      )
                    }
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          ))}
        </div>
      </nav>

      <div className="border-t border-[hsl(var(--sidebar-border))] p-2">
        <button
          type="button"
          onClick={() => {
            onNavigate?.();
            navigate("/");
          }}
          aria-label="Volver al shell TGMS"
          className="flex w-full items-center gap-2 px-3 py-2 text-[12px] text-[hsl(var(--sidebar-foreground))]/70 transition-colors hover:bg-[hsl(var(--sidebar-accent))]/60 hover:text-[hsl(var(--sidebar-foreground))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--g-border-focus)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Volver a TGMS</span>
        </button>
      </div>
    </>
  );
}

export const SecretariaSidebar = forwardRef<HTMLElement, SecretariaSidebarProps>(({ scope }, ref) => {
  return (
    <aside
      ref={ref}
      className="hidden w-[var(--sidebar-width)] shrink-0 flex-col bg-[hsl(var(--sidebar-background))] lg:flex"
      aria-label="Navegación de Secretaría Societaria"
    >
      <SecretariaSidebarContent scope={scope} />
    </aside>
  );
});

SecretariaSidebar.displayName = "SecretariaSidebar";

interface SecretariaMobileSidebarProps {
  scope: SecretariaScopeController;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SecretariaMobileSidebar({ scope, open, onOpenChange }: SecretariaMobileSidebarProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="garrigues-module flex h-full w-[min(320px,calc(100vw-2rem))] flex-col overflow-hidden border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-background))] p-0 text-[hsl(var(--sidebar-foreground))]"
      >
        <SheetTitle className="sr-only">Navegación de Secretaría Societaria</SheetTitle>
        <SecretariaSidebarContent scope={scope} onNavigate={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}
