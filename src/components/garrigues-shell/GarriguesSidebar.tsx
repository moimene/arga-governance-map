import { forwardRef } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  Scale,
  Sparkles,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { GlobalSearch } from "@/components/secretaria/GlobalSearch";
import {
  getVisibleSidebarSections,
  isItemDisabled,
} from "@/lib/secretaria/sidebar-visibility";
import { getNavGroups } from "@/components/secretaria/shell/navigation";
import { ScopeSwitcher } from "@/components/secretaria/shell/ScopeSwitcher";
import { useSidebarVisibility } from "@/components/secretaria/shell/useSidebarVisibilityContext";
import { useTenantBranding } from "@/context/TenantBrandContext";
import { brandName } from "@/lib/tenant-brand-labels";
import { isModuleEnabled } from "@/lib/tenant-modules";
import { GarriguesModuleSwitcher } from "./GarriguesModuleSwitcher";
import {
  getActiveGarriguesModule,
  GRC_NAV_ITEMS,
  AI_NAV_ITEMS,
  type GarriguesSimpleNavItem,
} from "./navigation";
import type { SecretariaScopeController } from "@/components/secretaria/shell/types";

export interface GarriguesSidebarProps {
  scope: SecretariaScopeController;
  mode?: "standalone" | "embedded";
  parentAppUrl?: string;
  parentAppLabel?: string;
  onNavigate?: () => void;
}

type GarriguesSidebarContentProps = GarriguesSidebarProps;

function isEntityIndependentItem(item: {
  visibility?: {
    requiresCollegiateBody?: boolean;
    requiresUnipersonalAdmin?: boolean;
    requiresCotizada?: boolean;
    excludesIfCotizada?: boolean;
    requiresBodyType?: string[];
    requiresAdoptionMode?: string[];
    requiresCapability?: string;
    excludesIfReferenceOnly?: boolean;
    requiresFeatureFlag?: string;
  };
}): boolean {
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
  if (v.requiresFeatureFlag) return false;
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
              <span
                className="h-4 w-4 shrink-0 bg-[hsl(var(--sidebar-foreground))]/15"
                style={{ borderRadius: "2px" }}
              />
              <span
                className="h-3 bg-[hsl(var(--sidebar-foreground))]/10"
                style={{
                  borderRadius: "var(--g-radius-sm)",
                  width: `${Math.min(80, 40 + item.label.length * 4)}%`,
                }}
              />
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function isSidebarLinkActive(
  pathname: string,
  search: string,
  to: string,
  end?: boolean
): boolean {
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

export function GarriguesSidebarContent({
  scope,
  mode = "standalone",
  parentAppUrl = "/",
  parentAppLabel,
  onNavigate,
}: GarriguesSidebarContentProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const branding = useTenantBranding();

  const activeModule = getActiveGarriguesModule(location.pathname);
  const moduleId = activeModule?.id ?? "secretaria";

  // Secretaria items
  const allSecretariaGroups = getNavGroups(scope.mode);
  const { context: visibilityCtx, isInitialLoading } = useSidebarVisibility(scope);
  const secretariaGroups = getVisibleSidebarSections(allSecretariaGroups, visibilityCtx);

  // GRC items
  const grcItems = GRC_NAV_ITEMS.filter(
    (item) => !item.moduleKey || isModuleEnabled(branding, item.moduleKey)
  );

  // AI items
  const aiItems = AI_NAV_ITEMS;

  const returnLabel = parentAppLabel || `Volver a ${brandName(branding)}`;

  return (
    <>
      {/* Brand Header */}
      <div className="flex min-h-16 items-center justify-between border-b border-[hsl(var(--sidebar-border))] px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center bg-[hsl(var(--sidebar-accent))] text-[var(--g-brand-bright)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <Scale className="h-5 w-5" />
          </div>
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-[14px] font-bold tracking-tight text-[hsl(var(--sidebar-foreground))]">
              Garrigues
            </span>
            <span className="truncate text-[10px] uppercase tracking-wider text-[var(--g-brand-bright)]">
              Corporate Solutions
            </span>
          </div>
        </div>
      </div>

      {/* Module Switcher */}
      <div className="border-b border-[hsl(var(--sidebar-border))] p-3">
        <GarriguesModuleSwitcher
          onNavigate={onNavigate}
          createScopedTo={scope.createScopedTo}
        />
      </div>

      {/* Scope Switcher (only for secretaria and grc) */}
      {moduleId === "secretaria" || moduleId === "grc" ? (
        <div className="border-b border-[hsl(var(--sidebar-border))] p-3">
          <ScopeSwitcher scope={scope} />
        </div>
      ) : null}

      {/* Contextual Navigation */}
      <nav
        className="flex-1 overflow-y-auto px-2 py-3"
        aria-label={`Navegación de ${activeModule?.label ?? "Garrigues"}`}
        data-sidebar-module={moduleId}
      >
        {moduleId === "secretaria" ? (
          <>
            <div className="mb-3">
              <GlobalSearch scope={scope} />
            </div>

            {isInitialLoading ? (
              <SecretariaSidebarSkeleton groups={allSecretariaGroups} />
            ) : null}

            <div className="space-y-4" hidden={isInitialLoading}>
              {secretariaGroups.map((group) => (
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
                    const active = isSidebarLinkActive(
                      location.pathname,
                      location.search,
                      scopedTo,
                      item.end
                    );

                    if (disabled) {
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
          </>
        ) : moduleId === "grc" ? (
          <div className="space-y-1">
            <span className="block px-3 text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--sidebar-foreground))]/55">
              Navegación GRC
            </span>
            {grcItems.map((item: GarriguesSimpleNavItem) => {
              const Icon = item.icon;
              const scopedTo = scope.createScopedTo(item.to);
              const active = isSidebarLinkActive(
                location.pathname,
                location.search,
                scopedTo,
                item.end
              );

              return (
                <NavLink
                  key={item.to}
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
        ) : (
          <div className="space-y-1">
            <span className="block px-3 text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--sidebar-foreground))]/55">
              Navegación AI Governance
            </span>
            {aiItems.map((item: GarriguesSimpleNavItem) => {
              const Icon = item.icon;
              const active = isSidebarLinkActive(
                location.pathname,
                location.search,
                item.to,
                item.end
              );

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
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
        )}
      </nav>

      {/* Sidebar Footer */}
      <div className="border-t border-[hsl(var(--sidebar-border))] p-2">
        {mode === "embedded" ? (
          <button
            type="button"
            onClick={() => {
              onNavigate?.();
              navigate(parentAppUrl);
            }}
            aria-label={returnLabel}
            className="flex w-full items-center gap-2 px-3 py-2 text-[12px] text-[hsl(var(--sidebar-foreground))]/70 transition-colors hover:bg-[hsl(var(--sidebar-accent))]/60 hover:text-[hsl(var(--sidebar-foreground))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--g-border-focus)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="truncate">{returnLabel}</span>
          </button>
        ) : (
          <div className="flex items-center justify-between px-3 py-2 text-[11px] text-[hsl(var(--sidebar-foreground))]/50">
            <span className="flex items-center gap-1.5 font-medium">
              <Sparkles className="h-3 w-3 text-[var(--g-brand-bright)]" />
              Garrigues Suite
            </span>
            <span className="text-[10px]">v2.0</span>
          </div>
        )}
      </div>
    </>
  );
}

export const GarriguesSidebar = forwardRef<HTMLElement, GarriguesSidebarProps>(
  (props, ref) => {
    return (
      <aside
        ref={ref}
        className="hidden w-[var(--sidebar-width)] shrink-0 flex-col bg-[hsl(var(--sidebar-background))] lg:flex"
        aria-label="Navegación de la Suite Garrigues"
      >
        <GarriguesSidebarContent {...props} />
      </aside>
    );
  }
);

GarriguesSidebar.displayName = "GarriguesSidebar";

interface GarriguesMobileSidebarProps extends GarriguesSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GarriguesMobileSidebar({
  open,
  onOpenChange,
  ...props
}: GarriguesMobileSidebarProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="garrigues-module w-[min(320px,calc(100vw-2rem))] border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-background))] p-0 text-[hsl(var(--sidebar-foreground))]"
      >
        <SheetTitle className="sr-only">Navegación de la Suite Garrigues</SheetTitle>
        <GarriguesSidebarContent
          {...props}
          onNavigate={() => {
            onOpenChange(false);
            props.onNavigate?.();
          }}
        />
      </SheetContent>
    </Sheet>
  );
}
