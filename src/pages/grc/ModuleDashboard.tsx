import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";

type ModuleNavRow = {
  id: string;
  module_id: string;
  section: string;
  label: string;
  route: string;
  display_order: number | null;
};

const MODULE_LABEL: Record<string, string> = {
  dora: "DORA / Resiliencia ICT",
  gdpr: "GDPR / Protección de datos",
  cyber: "Ciberseguridad",
  audit: "Auditoría Interna",
};

function useModuleNav(moduleId: string) {
  return useQuery({
    queryKey: ["grc", "module-nav", moduleId],
    enabled: !!moduleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grc_module_nav")
        .select("id, module_id, section, label, route, display_order")
        .eq("tenant_id", DEMO_TENANT)
        .eq("module_id", moduleId)
        .eq("is_enabled", true)
        .order("section")
        .order("display_order");
      if (error) throw error;
      return (data ?? []) as ModuleNavRow[];
    },
  });
}

const SECTION_LABEL: Record<string, string> = {
  operate: "Operativa",
  governance: "Gobierno",
  config: "Configuración",
};

export default function ModuleDashboard() {
  const { moduleId = "" } = useParams();
  const { data: nav = [] } = useModuleNav(moduleId);

  const grouped = nav.reduce<Record<string, ModuleNavRow[]>>((acc, item) => {
    (acc[item.section] ??= []).push(item);
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-[var(--g-text-primary)]">
          {MODULE_LABEL[moduleId] ?? moduleId.toUpperCase()}
        </h1>
        <p className="text-sm text-[var(--g-text-secondary)]">
          Selecciona una vista del módulo.
        </p>
      </header>

      {(["operate", "governance", "config"] as const).map((section) => {
        const items: ModuleNavRow[] = grouped[section] ?? [];
        if (items.length === 0) return null;
        return (
          <div key={section}>
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-secondary)] mb-3">
              {SECTION_LABEL[section]}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map((item) => (
                <Link
                  key={item.id}
                  to={item.route}
                  className="flex flex-col gap-1 p-4 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] hover:border-[var(--g-brand-3308)] hover:bg-[var(--g-surface-subtle)] transition-all"
                  style={{
                    borderRadius: "var(--g-radius-lg)",
                    boxShadow: "var(--g-shadow-card)",
                  }}
                >
                  <span className="text-sm font-semibold text-[var(--g-text-primary)]">
                    {item.label}
                  </span>
                  <span className="text-xs text-[var(--g-text-secondary)]">
                    {SECTION_LABEL[section]}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
