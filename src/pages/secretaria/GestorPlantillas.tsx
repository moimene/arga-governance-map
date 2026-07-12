/**
 * GestorPlantillas — shell de la consola unificada del Gestor de Plantillas.
 *
 * La página entera vive como tabs por query param (`?tab=...`) con RBAC
 * por pestaña. La lógica concreta se distribuye en componentes en
 * `components/secretaria/gestor/*Tab.tsx`. Esta página queda como un
 * orquestador del shell responsable de:
 *
 * - Leer la pestaña pedida del query param.
 * - Resolver permisos vía `useTabAccess`.
 * - Si la pestaña pedida no es accesible, redirigir a Salud documental con
 *   toast informativo.
 * - Renderizar la pestaña activa.
 *
 * Sprint 1 — Task 5.5.
 */
import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  useTabAccess,
  TAB_LABELS,
  TAB_ORDER,
  type TabId,
} from "@/components/secretaria/gestor/tab-guards";
import { DashboardTab } from "@/components/secretaria/gestor/DashboardTab";
import { CatalogoTab } from "@/components/secretaria/gestor/CatalogoTab";
import { CoberturaLegalTab } from "@/components/secretaria/gestor/CoberturaLegalTab";
import { ImportarTab } from "@/components/secretaria/gestor/ImportarTab";
import { MetricasTab } from "@/components/secretaria/gestor/MetricasTab";
import { AuditoriaTab } from "@/components/secretaria/gestor/AuditoriaTab";
import { ValidacionTab } from "@/components/secretaria/gestor/ValidacionTab";
import { ConfiguracionSociedadTab } from "@/components/secretaria/gestor/ConfiguracionSociedadTab";
import { patchSearchParams } from "@/lib/secretaria/template-configuration-routing";

const VALID_TABS: ReadonlySet<TabId> = new Set(TAB_ORDER);

function isTabId(value: string | null): value is TabId {
  return value !== null && VALID_TABS.has(value as TabId);
}

function renderTabContent(tab: TabId) {
  if (tab === "dashboard") return <DashboardTab />;
  if (tab === "catalogo") return <CatalogoTab />;
  if (tab === "cobertura") return <CoberturaLegalTab />;
  if (tab === "metricas") return <MetricasTab />;
  if (tab === "auditoria") return <AuditoriaTab />;
  if (tab === "importar") return <ImportarTab />;
  if (tab === "validacion") return <ValidacionTab />;
  return <ConfiguracionSociedadTab />;
}

export default function GestorPlantillas() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { canAccess, visibleTabs, isLoading } = useTabAccess();
  const tabRefs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({});

  const rawTab = searchParams.get("tab");
  const requestedTab: TabId = isTabId(rawTab) ? rawTab : "dashboard";
  const activeTab: TabId = !isLoading && canAccess(requestedTab)
    ? requestedTab
    : "dashboard";

  useEffect(() => {
    if (isTabId(rawTab)) return;

    setSearchParams(
      patchSearchParams(searchParams, {
        tab: "dashboard",
        focus: null,
      }),
      { replace: true },
    );
  }, [rawTab, searchParams, setSearchParams]);

  useEffect(() => {
    if (isLoading || !isTabId(rawTab) || rawTab === "dashboard" || canAccess(rawTab)) {
      return;
    }

    toast.warning(
      `Sin permisos para "${TAB_LABELS[rawTab]}"; redirigido a Salud documental`,
    );
    setSearchParams(
      patchSearchParams(searchParams, {
        tab: "dashboard",
        focus: null,
      }),
      { replace: true },
    );
  }, [rawTab, canAccess, isLoading, searchParams, setSearchParams]);

  const selectTab = (tab: TabId) =>
    setSearchParams(
      patchSearchParams(searchParams, {
        tab,
        focus: tab === "auditoria" ? undefined : null,
      }),
      { replace: true },
    );

  const handleTabKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    currentTab: TabId,
  ) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;

    const currentIndex = visibleTabs.indexOf(currentTab);
    if (currentIndex < 0) return;

    let targetIndex: number | null = null;
    if (event.key === "ArrowRight") {
      targetIndex = (currentIndex + 1) % visibleTabs.length;
    } else if (event.key === "ArrowLeft") {
      targetIndex = (currentIndex - 1 + visibleTabs.length) % visibleTabs.length;
    } else if (event.key === "Home") {
      targetIndex = 0;
    } else if (event.key === "End") {
      targetIndex = visibleTabs.length - 1;
    }

    if (targetIndex === null) return;
    event.preventDefault();

    const targetTab = visibleTabs[targetIndex];
    tabRefs.current[targetTab]?.focus();
    selectTab(targetTab);
  };

  const canRenderActiveTab = !isLoading && canAccess(activeTab);

  return (
    <main className="p-6 max-w-[1600px] mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-[var(--g-text-primary)]">
          Gobierno de plantillas
        </h1>
        <p className="text-sm text-[var(--g-text-secondary)]">
          Consola de gobierno legal, versión, cobertura y auditoría de plantillas protegidas.
        </p>
      </header>

      <nav
        className="mb-6 flex flex-nowrap gap-1 overflow-x-auto border-b border-[var(--g-border-subtle)]"
        role="tablist"
        aria-label="Pestañas del gestor de plantillas"
        aria-orientation="horizontal"
      >
        {isLoading ? null : visibleTabs.map((tab) => {
          const isActive = tab === activeTab;
          return (
            <button
              key={tab}
              ref={(node) => {
                tabRefs.current[tab] = node;
              }}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${tab}`}
              id={`tab-${tab}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => selectTab(tab)}
              onKeyDown={(event) => handleTabKeyDown(event, tab)}
              className={`-mb-px min-h-11 shrink-0 whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2 ${
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

      {isLoading ? (
        <section
          role="status"
          aria-live="polite"
          className="flex min-h-28 items-center justify-center border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-6 text-sm text-[var(--g-text-secondary)]"
          style={{ borderRadius: "var(--g-radius-lg)" }}
        >
          Comprobando acceso a las secciones…
        </section>
      ) : canRenderActiveTab ? (
        <>
          {visibleTabs.map((tab) => (
            <section
              key={tab}
              role="tabpanel"
              id={`panel-${tab}`}
              aria-labelledby={`tab-${tab}`}
              hidden={tab !== activeTab}
            >
              {tab === activeTab ? renderTabContent(tab) : null}
            </section>
          ))}
        </>
      ) : (
        <section
          role="status"
          className="flex min-h-28 items-center justify-center border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-6 text-sm text-[var(--g-text-secondary)]"
          style={{ borderRadius: "var(--g-radius-lg)" }}
        >
          No hay secciones disponibles para tu rol actual.
        </section>
      )}
    </main>
  );
}
