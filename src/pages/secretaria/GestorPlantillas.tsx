/**
 * GestorPlantillas — shell de la consola unificada del Gestor de Plantillas.
 *
 * La página entera vive como tabs por query param (`?tab=...`) con RBAC
 * por pestaña. La lógica concreta se distribuye en componentes en
 * `components/secretaria/gestor/*Tab.tsx`. Esta página queda como un
 * orquestador delgado (≤100 líneas) responsable de:
 *
 * - Leer la pestaña pedida del query param.
 * - Resolver permisos vía `useTabAccess`.
 * - Si la pestaña pedida no es accesible, redirigir a Dashboard con
 *   toast informativo.
 * - Renderizar la pestaña activa.
 *
 * Sprint 1 — Task 5.5.
 */
import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  useTabAccess,
  TAB_LABELS,
  type TabId,
} from "@/components/secretaria/gestor/tab-guards";
import { DashboardTab } from "@/components/secretaria/gestor/DashboardTab";
import { CatalogoTab } from "@/components/secretaria/gestor/CatalogoTab";
import { CoberturaLegalTab } from "@/components/secretaria/gestor/CoberturaLegalTab";
import { ImportarTab } from "@/components/secretaria/gestor/ImportarTab";
import { MetricasTab } from "@/components/secretaria/gestor/MetricasTab";
import { AuditoriaTab } from "@/components/secretaria/gestor/AuditoriaTab";
import { ValidacionTab } from "@/components/secretaria/gestor/ValidacionTab";

const VALID_TABS: ReadonlySet<TabId> = new Set([
  "dashboard",
  "catalogo",
  "cobertura",
  "importar",
  "metricas",
  "auditoria",
  "validacion",
]);

function isTabId(value: string | null): value is TabId {
  return value !== null && VALID_TABS.has(value as TabId);
}

export default function GestorPlantillas() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { canAccess, visibleTabs, isLoading } = useTabAccess();

  const rawTab = searchParams.get("tab");
  const requestedTab: TabId = isTabId(rawTab) ? rawTab : "dashboard";

  const activeTab: TabId = useMemo(() => {
    if (isLoading) return requestedTab;
    if (!canAccess(requestedTab)) return "dashboard";
    return requestedTab;
  }, [requestedTab, canAccess, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    if (requestedTab !== activeTab) {
      toast.warning(
        `Sin permisos para "${TAB_LABELS[requestedTab]}"; redirigido a Dashboard`,
      );
      setSearchParams({ tab: activeTab }, { replace: true });
    }
  }, [requestedTab, activeTab, isLoading, setSearchParams]);

  const selectTab = (tab: TabId) => setSearchParams({ tab }, { replace: true });

  return (
    <main className="p-6 max-w-[1600px] mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-[var(--g-text-primary)]">
          Gestor de Plantillas
        </h1>
        <p className="text-sm text-[var(--g-text-secondary)]">
          Consola operativa de administración legal de plantillas protegidas.
        </p>
      </header>

      <nav
        className="flex flex-wrap gap-1 mb-6 border-b border-[var(--g-border-subtle)]"
        role="tablist"
        aria-label="Pestañas del gestor de plantillas"
      >
        {visibleTabs.map((tab) => {
          const isActive = tab === activeTab;
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${tab}`}
              id={`tab-${tab}`}
              onClick={() => selectTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                isActive
                  ? "border-[var(--g-brand-3308)] text-[var(--g-brand-3308)]"
                  : "border-transparent text-[var(--g-text-secondary)] hover:text-[var(--g-text-primary)]"
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          );
        })}
      </nav>

      <section
        role="tabpanel"
        id={`panel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
      >
        {activeTab === "dashboard" ? <DashboardTab /> : null}
        {activeTab === "catalogo" ? <CatalogoTab /> : null}
        {activeTab === "cobertura" ? <CoberturaLegalTab /> : null}
        {activeTab === "importar" ? <ImportarTab /> : null}
        {activeTab === "metricas" ? <MetricasTab /> : null}
        {activeTab === "auditoria" ? <AuditoriaTab /> : null}
        {activeTab === "validacion" ? <ValidacionTab /> : null}
      </section>
    </main>
  );
}
