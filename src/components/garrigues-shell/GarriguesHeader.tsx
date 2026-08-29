import { forwardRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { useTenantBranding } from "@/context/TenantBrandContext";
import { brandName, groupFullLabel } from "@/lib/tenant-brand-labels";
import { NotificationsBell } from "@/components/shell/NotificationsBell";
import { GarriguesUserMenu } from "./GarriguesUserMenu";
import { getActiveGarriguesModule } from "./navigation";
import type { SecretariaScopeController } from "@/components/secretaria/shell/types";

interface GarriguesHeaderProps {
  scope?: SecretariaScopeController;
  onOpenMobileNav?: () => void;
}

export const GarriguesHeader = forwardRef<HTMLElement, GarriguesHeaderProps>(
  ({ scope, onOpenMobileNav }, ref) => {
    const location = useLocation();
    const branding = useTenantBranding();
    const activeModule = getActiveGarriguesModule(location.pathname);

    const rootBrand = brandName(branding);
    const moduleLabel = activeModule?.label ?? "Garrigues";
    const modulePath = activeModule?.basePath ?? "/secretaria";

    // Scope labels
    const isSociedad = scope?.mode === "sociedad";
    const scopeLabel = isSociedad
      ? scope?.selectedEntity?.legalName ?? "Sociedad"
      : groupFullLabel(branding);

    const modeLabel = isSociedad
      ? "Modo Sociedad · vista filtrada a la sociedad"
      : "Modo Grupo · visión multi-sociedad";

    return (
      <header
        ref={ref}
        className="sticky top-0 z-30 flex min-h-14 items-center justify-between border-b border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-4 py-2 sm:px-6"
      >
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onOpenMobileNav}
            aria-label="Abrir navegación móvil"
            className="flex h-9 w-9 shrink-0 items-center justify-center border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--g-border-focus)] lg:hidden"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <Menu className="h-5 w-5" />
          </button>

          <nav
            aria-label="Ruta de navegación"
            className="flex flex-wrap items-center gap-1.5 text-[12px] text-[var(--g-text-secondary)]"
          >
            <span>{rootBrand}</span>
            <span aria-hidden="true">›</span>
            <Link
              to={modulePath}
              className="font-semibold text-[var(--g-brand-3308)] transition-colors hover:text-[var(--g-sec-700)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--g-border-focus)]"
            >
              {moduleLabel}
            </Link>

            {scope ? (
              <>
                <span aria-hidden="true">›</span>
                <span className="truncate font-medium text-[var(--g-text-primary)]">
                  {scopeLabel}
                </span>
                {scope.currentSection && scope.currentSection !== "Mesa" && (
                  <>
                    <span aria-hidden="true">›</span>
                    <span className="truncate text-[var(--g-text-secondary)]">
                      {scope.currentSection}
                    </span>
                  </>
                )}
              </>
            ) : null}
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {scope ? (
            <span
              className="hidden items-center gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-page)] px-2.5 py-1 text-[11px] font-medium text-[var(--g-text-primary)] md:inline-flex"
              style={{ borderRadius: "var(--g-radius-full)" }}
            >
              <span
                className="h-2 w-2 bg-[var(--status-success)]"
                style={{ borderRadius: "var(--g-radius-full)" }}
                aria-hidden="true"
              />
              {modeLabel}
            </span>
          ) : null}

          <div className="flex items-center gap-1.5">
            <NotificationsBell />
            <GarriguesUserMenu />
          </div>
        </div>
      </header>
    );
  }
);

GarriguesHeader.displayName = "GarriguesHeader";
