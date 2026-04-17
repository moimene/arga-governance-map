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
  ShieldCheck,
  ClipboardList,
  Bot,
  Bell,
  Search,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TourPanel } from "@/components/tour/TourPanel";

interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  module?: boolean;
}

const govItems: NavItem[] = [
  { label: "Dashboard", to: "/", icon: LayoutDashboard },
  { label: "Governance Map", to: "/governance-map", icon: Network },
  { label: "Entidades", to: "/entidades", icon: Building2 },
  { label: "Órganos", to: "/organos", icon: Users2 },
  { label: "Políticas", to: "/politicas", icon: FileText },
  { label: "Obligaciones", to: "/obligaciones", icon: Scale },
  { label: "Delegaciones", to: "/delegaciones", icon: GitBranch },
  { label: "Hallazgos", to: "/hallazgos", icon: AlertTriangle },
  { label: "Conflictos", to: "/conflictos", icon: AlertOctagon },
];

const moduleItems: NavItem[] = [
  { label: "GRC Compass", to: "/sii", icon: ShieldCheck, module: true },
  { label: "Secretaría", to: "/documentacion", icon: ClipboardList, module: true },
  { label: "AI Governance", to: "/ai-governance", icon: Bot, module: true },
];

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
  "/sii": "GRC Compass",
  "/documentacion": "Secretaría",
  "/ai-governance": "AI Governance",
};

function NavRow({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.to === "/"}
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
  const title =
    pageTitles[pathname] ??
    Object.entries(pageTitles).find(([k]) => k !== "/" && pathname.startsWith(k))?.[1] ??
    "TGMS";

  return (
    <div className="flex min-h-screen w-full">
      {/* SIDEBAR */}
      <aside
        style={{
          width: 220,
          background: "var(--t-sidebar-bg)",
          color: "#FFFFFF",
          padding: "16px 12px",
          flexShrink: 0,
        }}
        className="flex flex-col"
      >
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
          TGMS PLATFORM
        </div>

        {/* Scope switcher */}
        <div
          style={{
            background: "var(--t-sidebar-scope-bg)",
            borderRadius: 6,
            padding: "6px 8px",
            marginBottom: 14,
            fontSize: 10,
            color: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span>Scope:</span>
          <span style={{ fontWeight: 700 }}>Grupo ARGA ▾</span>
        </div>

        {/* Gobernanza */}
        <SectionLabel>Gobernanza</SectionLabel>
        <nav className="space-y-[1px] mb-3">
          {govItems.map((it) => <NavRow key={it.to} item={it} />)}
        </nav>

        {/* Módulos */}
        <SectionLabel>Módulos</SectionLabel>
        <nav className="space-y-[1px]">
          {moduleItems.map((it) => <NavRow key={it.to} item={it} />)}
        </nav>
      </aside>

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
          className="flex items-center justify-between"
        >
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--t-text-primary)" }}>
            {title}
          </div>

          <div className="relative" style={{ width: 280 }}>
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              size={14}
            />
            <input
              placeholder="Buscar..."
              style={{
                width: "100%",
                borderRadius: 8,
                border: "1px solid var(--t-border-default)",
                fontSize: 13,
                padding: "7px 10px 7px 30px",
                background: "#FFFFFF",
                outline: "none",
              }}
            />
          </div>

          <div className="flex items-center gap-3">
            <button className="relative" aria-label="Notificaciones">
              <Bell size={18} className="text-foreground" />
              <span
                style={{
                  position: "absolute",
                  top: -4,
                  right: -6,
                  background: "var(--t-brand)",
                  color: "#FFFFFF",
                  fontSize: 9,
                  fontWeight: 700,
                  borderRadius: 999,
                  padding: "1px 5px",
                  lineHeight: 1.2,
                }}
              >
                7
              </span>
            </button>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 999,
                background: "var(--t-surface-muted)",
                color: "var(--t-text-primary)",
                fontSize: 11,
                fontWeight: 700,
              }}
              className="flex items-center justify-center"
            >
              AG
            </div>
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
