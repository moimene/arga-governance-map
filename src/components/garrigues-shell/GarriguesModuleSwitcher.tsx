import { useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTenantBranding } from "@/context/TenantBrandContext";
import {
  getActiveGarriguesModule,
  getEnabledGarriguesModules,
  type GarriguesModuleDef,
} from "./navigation";

interface GarriguesModuleSwitcherProps {
  onNavigate?: () => void;
  className?: string;
  createScopedTo?: (path: string) => string;
}

export function GarriguesModuleSwitcher({
  onNavigate,
  className = "",
  createScopedTo,
}: GarriguesModuleSwitcherProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const branding = useTenantBranding();

  const enabledModules = getEnabledGarriguesModules(branding);
  const activeModule = getActiveGarriguesModule(location.pathname) ?? enabledModules[0];

  const handleSelectModule = (mod: GarriguesModuleDef) => {
    onNavigate?.();
    const targetPath = createScopedTo ? createScopedTo(mod.basePath) : mod.basePath;
    navigate(targetPath);
  };

  const ActiveIcon = activeModule?.icon;

  return (
    <div className={`space-y-1 ${className}`}>
      <span className="block px-1 text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--sidebar-foreground))]/55">
        Módulo
      </span>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Módulo actual: ${activeModule?.label ?? "Seleccionar módulo"}`}
            className="flex w-full items-center justify-between gap-2 border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-accent))]/30 px-3 py-2 text-left text-[13px] font-medium text-[hsl(var(--sidebar-foreground))] transition-colors hover:bg-[hsl(var(--sidebar-accent))]/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--g-border-focus)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              {ActiveIcon ? (
                <ActiveIcon className="h-4 w-4 shrink-0 text-[var(--g-brand-bright)]" />
              ) : null}
              <span className="truncate font-semibold">{activeModule?.label}</span>
            </div>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          sideOffset={6}
          className="garrigues-module w-64 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-1.5 shadow-lg"
          style={{ borderRadius: "var(--g-radius-lg)" }}
        >
          <DropdownMenuLabel className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
            Módulos Garrigues
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="my-1 bg-[var(--g-border-subtle)]" />

          {enabledModules.map((mod) => {
            const ModIcon = mod.icon;
            const isSelected = activeModule?.id === mod.id;

            return (
              <DropdownMenuItem
                key={mod.id}
                onClick={() => handleSelectModule(mod)}
                className={`flex cursor-pointer items-center justify-between gap-2 px-2.5 py-2 text-[13px] transition-colors focus:bg-[var(--g-surface-subtle)] ${
                  isSelected
                    ? "bg-[var(--g-surface-subtle)] font-medium text-[var(--g-brand-3308)]"
                    : "text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
                }`}
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center ${
                      isSelected
                        ? "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]"
                        : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
                    }`}
                    style={{ borderRadius: "var(--g-radius-sm)" }}
                  >
                    <ModIcon className="h-4 w-4" />
                  </span>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate leading-snug">{mod.label}</span>
                    <span className="truncate text-[11px] text-[var(--g-text-secondary)]">
                      {mod.description}
                    </span>
                  </div>
                </div>
                {isSelected ? (
                  <Check className="h-4 w-4 shrink-0 text-[var(--g-brand-3308)]" />
                ) : null}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
