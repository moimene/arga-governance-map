import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Network,
  Building2,
  Users2,
  FileText,
  Scale,
  GitBranch,
  AlertTriangle,
  AlertOctagon,
  Compass,
  ClipboardList,
  Brain,
  BookOpen,
  Sparkles,
  Menu,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TourPanel } from "@/components/tour/TourPanel";
import { NotificationsBell } from "@/components/shell/NotificationsBell";
import { ScopeSwitcher } from "@/components/shell/ScopeSwitcher";
import { GlobalSearch } from "@/components/shell/GlobalSearch";
import { UserMenu } from "@/components/shell/UserMenu";
import { useTour } from "@/context/TourContext";
import { useTenantBranding } from "@/context/TenantBrandContext";
import { isModuleEnabled } from "@/lib/tenant-modules";
import { brandName, shellLabel } from "@/lib/tenant-brand-labels";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  module?: boolean;
  moduleKey?: string;
}

const govItems: NavItem[] = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard },
  { label: "Governance Map", to: "/governance-map", icon: Network, moduleKey: "governance-map" },
  { label: "Entidades", to: "/entidades", icon: Building2, moduleKey: "entidades" },
  { label: "Órganos", to: "/organos", icon: Users2, moduleKey: "organos" },
  { label: "Políticas", to: "/politicas", icon: FileText, moduleKey: "politicas" },
  { label: "Obligaciones", to: "/obligaciones", icon: Scale, moduleKey: "obligaciones" },
  { label: "Delegaciones", to: "/delegaciones", icon: GitBranch, moduleKey: "delegaciones" },
  { label: "Hallazgos", to: "/hallazgos", icon: AlertTriangle, moduleKey: "hallazgos" },
  { label: "Conflictos", to: "/conflictos", icon: AlertOctagon, moduleKey: "conflictos" },
];

const moduleItems: NavItem[] = [
  { label: "GRC Compass", to: "/grc", icon: Compass, module: true, moduleKey: "grc" },
  { label: "Secretaría", to: "/secretaria", icon: ClipboardList, module: true, moduleKey: "secretaria" },
  { label: "AI Governance", to: "/ai-governance", icon: Brain, module: true, moduleKey: "ai-governance" },
];

const siiItem: NavItem = { label: "SII — Canal Interno", to: "/sii", icon: AlertOctagon, moduleKey: "sii" };

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/governance-map": "Governance Map",
  "/entidades": "Entidades",
  "/organos": "Órganos",
  "/politicas": "Políticas",
  "/obligaciones": "Obligaciones",
  "/delegaciones": "Delegaciones",
  "/hallazgos": "Hallazgos",
  "/conflictos": "Conflictos",
  "/grc": "GRC Compass",
  "/secretaria": "Secretaría",
  "/ai-governance": "AI Governance",
  "/sii": "SII — Canal Interno",
  "/documentacion": "Documentación",
};

function NavRow({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      onClick={onNavigate}
      style={({ isActive }) => ({
        background: isActive ? "var(--t-sidebar-active)" : "transparent",
        fontWeight: isActive ? 700 : 500,
        color: "#FFFFFF",
        marginLeft: item.module ? 6 : 0,
        paddingLeft: item.module ? 10 : 8,
        borderLeft: item.module ? "2px solid rgba(255,255,255,0.6)" : undefined,
        fontSize: item.module ? 10 : 11,
      })}
      className={cn(
        "flex items-center gap-2 rounded-md transition-colors",
      )}
      onMouseEnter={(e) => {
        if (!e.currentTarget.style.background || e.currentTarget.style.background === "transparent") {
          e.currentTarget.dataset.hovering = "1";
          e.currentTarget.style.background = "var(--t-sidebar-hover)";
        }
      }}
      onMouseLeave={(e) => {
        if (e.currentTarget.dataset.hovering === "1") {
          e.currentTarget.style.background = "transparent";
          delete e.currentTarget.dataset.hovering;
        }
      }}
    >
      <span
        style={{
          padding: "7px 0",
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          paddingRight: 8,
        }}
      >
        <Icon className="h-[14px] w-[14px] shrink-0" />
        <span className="truncate">{item.label}</span>
      </span>
    </NavLink>
  );
}

function ShellSidebarContent({
  onNavigate,
  onStartTour,
  tourLabel,
}: {
  onNavigate?: () => void;
  onStartTour: () => void;
  tourLabel: string;
}) {
  const branding = useTenantBranding();
  return (
    <>
      {/* Logo */}
      <div
        style={{
          color: "#FFFFFF",
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: 1.5,
          paddingBottom: 12,
          marginBottom: 12,
          borderBottom: "1px solid rgba(255,255,255,0.15)",
        }}
      >
        {shellLabel(branding)}
      </div>

      {/* Scope switcher */}
      <div className="mb-3.5">
        <ScopeSwitcher variant="sidebar" />
      </div>

      {/* Gobernanza */}
      <SectionLabel>Gobernanza</SectionLabel>
      <nav className="space-y-[1px] mb-3">
        {govItems
          .filter((it) => !it.moduleKey || isModuleEnabled(branding, it.moduleKey))
          .map((it) => <NavRow key={it.to} item={it} onNavigate={onNavigate} />)}
      </nav>

      {/* Módulos */}
      <SectionLabel>Módulos</SectionLabel>
      <nav className="space-y-[1px] mb-3">
        {moduleItems
          .filter((it) => !it.moduleKey || isModuleEnabled(branding, it.moduleKey))
          .map((it) => <NavRow key={it.to} item={it} onNavigate={onNavigate} />)}
      </nav>

      {/* SII — zona segregada */}
      <SectionLabel>Canal interno</SectionLabel>
      <nav className="space-y-[1px]">
        {(!siiItem.moduleKey || isModuleEnabled(branding, siiItem.moduleKey)) && (
          <NavRow item={siiItem} onNavigate={onNavigate} />
        )}
      </nav>

      {/* Spacer empuja la sección de ayuda al final */}
      <div className="flex-1" />

      {/* Ayuda — Documentación + Relanzar tour */}
      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,0.15)",
          paddingTop: 12,
          marginTop: 12,
        }}
      >
        <SectionLabel>Ayuda</SectionLabel>
        <nav className="space-y-[1px] mb-2">
          <NavRow item={{ label: "Documentación", to: "/documentacion", icon: BookOpen }} onNavigate={onNavigate} />
        </nav>
        <button
          onClick={() => {
            onNavigate?.();
            onStartTour();
          }}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 11,
            fontWeight: 700,
            color: "#FFFFFF",
            background: "var(--t-brand)",
            border: "none",
            borderRadius: 6,
            padding: "8px 10px",
            cursor: "pointer",
          }}
        >
          <Sparkles size={14} />
          <span className="truncate">{tourLabel}</span>
        </button>
      </div>
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 9,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: 1,
        color: "var(--t-sidebar-label)",
        padding: "0 8px",
        marginBottom: 4,
      }}
    >
      {children}
    </div>
  );
}

export function ShellLayout() {
  const { pathname } = useLocation();
  const { start: startTour, step, completed } = useTour();
  const [mobileOpen, setMobileOpen] = useState(false);
  const branding = useTenantBranding();
  const tourLabel = step > 0 ? "Continuar tour" : completed ? "Repetir tour" : "Iniciar tour";
  const title =
    pageTitles[pathname] ??
    Object.entries(pageTitles).find(([k]) => k !== "/" && pathname.startsWith(k))?.[1] ??
    brandName(branding);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-screen w-full">
      {/* SIDEBAR */}
      <aside
        aria-label="Navegación principal"
        data-testid="desktop-sidebar"
        style={{
          width: 220,
          background: "var(--t-sidebar-bg)",
          color: "#FFFFFF",
          padding: "16px 12px",
          flexShrink: 0,
        }}
        className="hidden flex-col lg:flex"
      >
        <ShellSidebarContent onStartTour={startTour} tourLabel={tourLabel} />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="w-[min(320px,86vw)] border-r border-[var(--t-sidebar-hover)] bg-[var(--t-sidebar-bg)] p-3 text-white"
        >
          <SheetTitle className="sr-only">Navegación principal</SheetTitle>
          <SheetDescription className="sr-only">
            Menú móvil de navegación TGMS.
          </SheetDescription>
          <div className="flex h-full flex-col">
            <ShellSidebarContent
              onNavigate={() => setMobileOpen(false)}
              onStartTour={startTour}
              tourLabel={tourLabel}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* RIGHT COLUMN */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* TOPBAR */}
        <header
          style={{
            height: 56,
            background: "#FFFFFF",
            borderBottom: "1px solid var(--t-border-default)",
            padding: "0 24px",
          }}
          className="flex items-center justify-between gap-3"
        >
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label="Abrir menú de navegación"
              onClick={() => setMobileOpen(true)}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[var(--t-text-primary)] hover:bg-[var(--t-surface-muted)] lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="truncate" style={{ fontSize: 15, fontWeight: 700, color: "var(--t-text-primary)" }}>
              {title}
            </div>
          </div>

          <div className="hidden md:block">
            <GlobalSearch />
          </div>

          <div className="flex items-center gap-3">
            <NotificationsBell />
            <UserMenu />
          </div>
        </header>

        {/* CONTENT */}
        <main
          style={{
            flex: 1,
            overflowY: "auto",
            padding: 24,
            background: "var(--t-surface-page)",
          }}
        >
          <Outlet />
        </main>
      </div>
      <TourPanel />
    </div>
  );
}
