import { NavLink, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import * as icons from "lucide-react";
import { Dot, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTenantContext } from "@/context/TenantContext";

type NavItem = {
  id: string;
  module_id: string;
  section: string;
  view_key: string;
  label: string;
  route: string;
  icon: string | null;
  display_order: number | null;
};

const MODULE_LABEL: Record<string, string> = {
  dora: "DORA / Resiliencia",
  gdpr: "GDPR / Datos personales",
  cyber: "Ciberseguridad",
  audit: "Auditoría Interna",
};

const SECTION_LABEL: Record<string, string> = {
  operate: "Operativa",
  governance: "Gobierno",
  config: "Configuración",
};

function useModuleNav(moduleId: string) {
  const { tenantId } = useTenantContext();
  return useQuery({
    queryKey: ["grc", "module-nav", tenantId, moduleId],
    enabled: !!moduleId && !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grc_module_nav")
        .select("id, module_id, section, view_key, label, route, icon, display_order")
        .eq("tenant_id", tenantId!)
        .eq("module_id", moduleId)
        .eq("is_enabled", true)
        .order("section")
        .order("display_order");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function ModuleSidebar() {
  const { moduleId = "" } = useParams();
  const { data: nav = [] } = useModuleNav(moduleId);

  const grouped = (nav as NavItem[]).reduce<Record<string, NavItem[]>>((acc, item) => {
    (acc[item.section] ??= []).push(item);
    return acc;
  }, {});

  return (
    <aside
      className="w-[200px] shrink-0 border-r border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
    >
      {/* Module title */}
      <div className="px-4 py-3 border-b border-[var(--g-border-subtle)]">
        <div className="text-[10px] uppercase tracking-wider text-[var(--g-text-secondary)] mb-0.5">
          Módulo
        </div>
        <div className="text-sm font-bold text-[var(--g-brand-3308)]">
          {MODULE_LABEL[moduleId] ?? moduleId}
        </div>
      </div>

      {/* Nav sections */}
      {(["operate", "governance", "config"] as const).map((section) => {
        const items: NavItem[] = grouped[section] ?? [];
        if (items.length === 0) return null;
        return (
          <div key={section} className="py-1">
            <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
              {SECTION_LABEL[section]}
            </div>
            {items.map((item) => {
              const Icon: LucideIcon =
                (item.icon && (icons as unknown as Record<string, LucideIcon>)[item.icon]) ?? Dot;
              return (
                <NavLink
                  key={item.id}
                  to={item.route}
                  className={({ isActive }) =>
                    cn(
                      "mx-2 mb-0.5 flex items-center gap-2 px-3 py-2 text-[13px] transition-colors",
                      isActive
                        ? "bg-[var(--g-surface-subtle)] font-semibold text-[var(--g-brand-3308)]"
                        : "text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]/60"
                    )
                  }
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        );
      })}
    </aside>
  );
}
