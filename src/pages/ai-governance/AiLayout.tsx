import { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Cpu,
  ClipboardCheck,
  AlertTriangle,
  ChevronLeft,
  Brain,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

interface NavItem {
  label: string;
  to: string;
  icon: React.ElementType;
  end?: boolean;
}

const navItems: NavItem[] = [
  { label: "Dashboard",    to: "/ai-governance",              icon: LayoutDashboard, end: true },
  { label: "Sistemas IA",  to: "/ai-governance/sistemas",     icon: Cpu },
  { label: "Evaluaciones", to: "/ai-governance/evaluaciones", icon: ClipboardCheck },
  { label: "Incidentes IA",to: "/ai-governance/incidentes",   icon: AlertTriangle },
];

function AiSidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate();

  return (
    <>
      <div className="flex h-14 items-center gap-2 border-b border-[hsl(var(--sidebar-border))] px-4">
        <Brain className="h-5 w-5 text-[hsl(var(--sidebar-foreground))]" />
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-[13px] font-bold tracking-wide text-[hsl(var(--sidebar-foreground))]">
            AI Governance
          </span>
          <span className="truncate text-[10px] text-[hsl(var(--sidebar-foreground))]/60">
            by Garrigues
          </span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Navegación de AI Governance">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
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

export function AiLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div
      className="garrigues-module flex min-h-screen w-full"
      style={{ fontFamily: "'Montserrat', 'Inter', sans-serif" }}
    >
      <aside
        className="hidden w-[var(--sidebar-width)] shrink-0 flex-col bg-[hsl(var(--sidebar-background))] lg:flex"
        aria-label="Navegación de AI Governance"
      >
        <AiSidebarContent />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="garrigues-module w-[min(320px,calc(100vw-2rem))] border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-background))] p-0 text-[hsl(var(--sidebar-foreground))]"
        >
          <SheetTitle className="sr-only">Navegación de AI Governance</SheetTitle>
          <AiSidebarContent onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <main className="min-w-0 flex-1 overflow-auto bg-[var(--g-surface-page)]">
        <div className="flex min-h-12 items-center gap-3 border-b border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-4 text-[12px] text-[var(--g-text-secondary)] sm:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir navegación de AI Governance"
            className="flex h-9 w-9 shrink-0 items-center justify-center border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--g-border-focus)] lg:hidden"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <Menu className="h-5 w-5" />
          </button>
          <span>TGMS</span>
          <span aria-hidden="true">›</span>
          <span className="font-semibold text-[var(--g-brand-3308)]">AI Governance</span>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
