import { forwardRef } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { BookOpen, ChevronLeft } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { GlobalSearch } from "@/components/secretaria/GlobalSearch";
import { getNavGroups } from "./navigation";
import { ScopeSwitcher } from "./ScopeSwitcher";
import type { SecretariaScopeController } from "./types";

interface SecretariaSidebarProps {
  scope: SecretariaScopeController;
}

interface SecretariaSidebarContentProps {
  scope: SecretariaScopeController;
  onNavigate?: () => void;
}

function SecretariaSidebarContent({ scope, onNavigate }: SecretariaSidebarContentProps) {
  const navigate = useNavigate();
  const groups = getNavGroups(scope.mode);
  const hasSelectedEntity = Boolean(scope.selectedEntity);

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

      <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Navegación de Secretaría Societaria">
        <div className="mb-3">
          <GlobalSearch scope={scope} />
        </div>

        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.label} className="space-y-1">
              <span className="block px-3 text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--sidebar-foreground))]/55">
                {group.label}
              </span>

              {group.items.map((item) => {
                const Icon = item.icon;
                const disabled = scope.mode === "sociedad" && item.requiresEntity && !hasSelectedEntity;
                const itemTo =
                  item.selectedEntityRoute && scope.selectedEntity
                    ? `/secretaria/sociedades/${scope.selectedEntity.id}`
                    : item.to;

                if (disabled) {
                  return (
                    <span
                      key={item.to}
                      aria-disabled="true"
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
                    key={item.to}
                    to={scope.createScopedTo(itemTo)}
                    end={item.end}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        "mb-0.5 flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--g-border-focus)]",
                        isActive
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
        className="garrigues-module w-[min(320px,calc(100vw-2rem))] border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-background))] p-0 text-[hsl(var(--sidebar-foreground))]"
      >
        <SheetTitle className="sr-only">Navegación de Secretaría Societaria</SheetTitle>
        <SecretariaSidebarContent scope={scope} onNavigate={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}
