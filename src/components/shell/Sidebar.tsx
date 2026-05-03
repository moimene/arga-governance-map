import { NavLink } from "react-router-dom";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useEffect, useState } from "react";
import { useTour } from "@/context/TourContext";
import { useSidebarMobile } from "./useSidebarMobile";
import {
  topItems,
  moduleItems,
  siiItems,
  adminItems,
  helpItems,
  type SidebarItem,
} from "./sidebar-nav-items";

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

function ItemRow({ item, collapsed }: { item: SidebarItem; collapsed: boolean }) {
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

function SidebarBody({ collapsed }: { collapsed: boolean }) {
  const { start, step, completed } = useTour();
  const tourLabel = step > 0 ? "Continuar tour" : completed ? "Repetir tour" : "Iniciar tour";

  const replayBtn = (
    <button
      onClick={start}
      className={cn(
        "group relative flex w-full items-center gap-3 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover",
        collapsed && "justify-center px-0",
      )}
    >
      <Sparkles className="h-[18px] w-[18px] shrink-0" />
      {!collapsed && <span className="flex-1 truncate text-left">{tourLabel}</span>}
    </button>
  );

  return (
    <>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3 scrollbar-thin">
        {topItems.map((it) => <ItemRow key={it.to} item={it} collapsed={collapsed} />)}

        {!collapsed && (
          <div className="px-3 pb-1 pt-4 text-[10px] font-bold uppercase tracking-widest text-sidebar-muted">
            Módulos
          </div>
        )}
        {collapsed && <div className="my-2 mx-3 border-t border-sidebar-border" />}
        {moduleItems.map((it) => <ItemRow key={it.to} item={it} collapsed={collapsed} />)}

        <div className="my-2 mx-3 border-t border-sidebar-border" />
        {siiItems.map((it) => <ItemRow key={it.to} item={it} collapsed={collapsed} />)}
        <div className="my-2 mx-3 border-t border-sidebar-border" />

        {adminItems.map((it) => <ItemRow key={it.to} item={it} collapsed={collapsed} />)}
      </nav>

      <div className="border-t border-sidebar-border bg-sidebar/60 px-2 py-3">
        {!collapsed && (
          <div className="mb-2 px-2 text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground-active/80">
            Ayuda y Onboarding
          </div>
        )}
        <div className="space-y-1">
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>{replayBtn}</TooltipTrigger>
              <TooltipContent side="right">{tourLabel}</TooltipContent>
            </Tooltip>
          ) : (
            replayBtn
          )}
          {helpItems.map((it) => <ItemRow key={it.to} item={it} collapsed={collapsed} />)}
        </div>
      </div>

      {!collapsed && (
        <div className="border-t border-sidebar-border px-4 py-3 text-[12px] text-sidebar-muted">
          v1.0 beta
        </div>
      )}
    </>
  );
}

export function MobileSidebar() {
  const { open, setOpen } = useSidebarMobile();
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="left"
        className="w-[280px] border-r border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
      >
        <TooltipProvider delayDuration={0}>
          <div className="flex h-full flex-col">
            <SidebarBody collapsed={false} />
          </div>
        </TooltipProvider>
      </SheetContent>
    </Sheet>
  );
}

export function Sidebar() {
  const { collapsed, toggle } = useCollapsed();
  return (
    <TooltipProvider delayDuration={0}>
      <aside
        data-testid="desktop-sidebar"
        aria-label="Navegación principal"
        className={cn(
          "hidden lg:flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200",
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
        <SidebarBody collapsed={collapsed} />
      </aside>
    </TooltipProvider>
  );
}
