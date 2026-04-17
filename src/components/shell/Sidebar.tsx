import { NavLink } from "react-router-dom";
import {
  AlertOctagon,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Building,
  ChevronLeft,
  ChevronRight,
  FileText,
  Key,
  LayoutDashboard,
  Leaf,
  Network,
  Scale,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useEffect, useState } from "react";

interface Item {
  label: string;
  to: string;
  icon: LucideIcon;
  badge?: { text: string; tone: "critical" | "warning" };
  sii?: boolean;
}

const top: Item[] = [
  { label: "Inicio", to: "/", icon: LayoutDashboard },
  { label: "Governance Map", to: "/governance-map", icon: Network },
  { label: "Entidades", to: "/entidades", icon: Building },
  { label: "Órganos y Reuniones", to: "/organos", icon: Users },
  { label: "Políticas y Normativa", to: "/politicas", icon: FileText },
  { label: "Obligaciones y Controles", to: "/obligaciones", icon: ShieldCheck },
  { label: "Delegaciones y Poderes", to: "/delegaciones", icon: Key },
  { label: "Hallazgos y Acciones", to: "/hallazgos", icon: AlertTriangle, badge: { text: "10", tone: "critical" } },
  { label: "Conflictos / Attestations", to: "/conflictos", icon: Scale },
  { label: "ESG", to: "/esg", icon: Leaf },
  { label: "Dashboards", to: "/dashboards", icon: BarChart3 },
];

const sii: Item[] = [
  { label: "SII — Canal Interno", to: "/sii", icon: AlertOctagon, badge: { text: "2", tone: "warning" }, sii: true },
];

const bottom: Item[] = [
  { label: "Documentación", to: "/documentacion", icon: BookOpen },
  { label: "Administración", to: "/admin", icon: Settings },
];

const STORAGE_KEY = "sidebar_collapsed";

function useCollapsed() {
  const [manual, setManual] = useState<boolean | null>(() => {
    if (typeof window === "undefined") return null;
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === null ? null : v === "true";
  });
  const [auto, setAuto] = useState(false);
  useEffect(() => {
    const onResize = () => setAuto(window.innerWidth < 1200);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const collapsed = manual ?? auto;
  const toggle = () => {
    const next = !collapsed;
    setManual(next);
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, String(next));
  };
  return { collapsed, toggle };
}

function ItemRow({ item, collapsed }: { item: Item; collapsed: boolean }) {
  const Icon = item.icon;
  const content = (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      className={({ isActive }) =>
        cn(
          "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          item.sii && "border-l-[3px] border-sii-border pl-[9px]",
          isActive
            ? "bg-sidebar-active text-sidebar-foreground-active"
            : "text-sidebar-foreground hover:bg-sidebar-hover hover:text-sidebar-foreground-active",
        )
      }
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
      {!collapsed && item.badge && (
        <span
          className={cn(
            "ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold",
            item.badge.tone === "critical" && "bg-destructive text-destructive-foreground",
            item.badge.tone === "warning" && "bg-status-warning text-white",
          )}
        >
          {item.badge.text}
        </span>
      )}
    </NavLink>
  );

  if (!collapsed) return content;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

export function Sidebar() {
  const { collapsed, toggle } = useCollapsed();
  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200",
          collapsed ? "w-16" : "w-[260px]",
        )}
      >
        <div className={cn("flex items-center border-b border-sidebar-border px-2 py-2", collapsed ? "justify-center" : "justify-end")}>
          <button
            onClick={toggle}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-hover"
            aria-label={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3 scrollbar-thin">
          {top.map((it) => <ItemRow key={it.to} item={it} collapsed={collapsed} />)}

          <div className="my-2 mx-3 border-t border-sidebar-border" />
          {sii.map((it) => <ItemRow key={it.to} item={it} collapsed={collapsed} />)}
          <div className="my-2 mx-3 border-t border-sidebar-border" />

          {bottom.map((it) => <ItemRow key={it.to} item={it} collapsed={collapsed} />)}
        </nav>

        {!collapsed && (
          <div className="border-t border-sidebar-border px-4 py-3 text-[12px] text-sidebar-muted">
            v1.0 beta
          </div>
        )}
      </aside>
    </TooltipProvider>
  );
}
