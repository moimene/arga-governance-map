import { useParams } from "react-router-dom";
import { lazy, Suspense } from "react";

const VIEWS: Record<string, React.LazyExoticComponent<React.ComponentType>> = {
  "dora/operate/incidents":    lazy(() => import("@/pages/grc/modules/dora/Incidents")),
  "dora/operate/bcm":          lazy(() => import("@/pages/grc/modules/dora/BCM")),
  "dora/operate/rto":          lazy(() => import("@/pages/grc/modules/dora/RTO")),
  "dora/governance/policies":  lazy(() => import("@/pages/grc/modules/dora/PoliciesLink")),
  "dora/config/thresholds":    lazy(() => import("@/pages/grc/modules/dora/Thresholds")),
  "gdpr/operate/ropa":         lazy(() => import("@/pages/grc/modules/gdpr/ROPA")),
  "gdpr/operate/dpias":        lazy(() => import("@/pages/grc/modules/gdpr/DPIAs")),
  "gdpr/operate/dsars":        lazy(() => import("@/pages/grc/modules/gdpr/DSARs")),
  "gdpr/governance/dpo":       lazy(() => import("@/pages/grc/modules/gdpr/DPO")),
  "cyber/operate/vulnerabilities": lazy(() => import("@/pages/grc/modules/cyber/Vulnerabilities")),
  "cyber/operate/incidents":   lazy(() => import("@/pages/grc/modules/cyber/Incidents")),
  "cyber/governance/soc":      lazy(() => import("@/pages/grc/modules/cyber/SOC")),
  "audit/operate/findings":    lazy(() => import("@/pages/grc/modules/audit/Findings")),
  "audit/operate/plans":       lazy(() => import("@/pages/grc/modules/audit/ActionPlans")),
  "audit/governance/program":  lazy(() => import("@/pages/grc/modules/audit/Program")),
};

function NotFound({ viewKey }: { viewKey: string }) {
  return (
    <div className="p-6">
      <div
        className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-5"
        style={{ borderRadius: "var(--g-radius-lg)" }}
      >
        <div className="text-sm font-semibold text-[var(--g-text-primary)] mb-1">
          Vista no disponible
        </div>
        <div className="text-xs text-[var(--g-text-secondary)]">
          No hay una vista registrada para{" "}
          <code className="font-mono bg-[var(--g-surface-muted)] px-1 py-0.5" style={{ borderRadius: "var(--g-radius-sm)" }}>
            {viewKey}
          </code>
          .
        </div>
      </div>
    </div>
  );
}

export function SectionRouter() {
  const { moduleId = "", section = "", viewKey = "" } = useParams();
  const key = `${moduleId}/${section}/${viewKey}`;
  const View = VIEWS[key];

  if (!View) return <NotFound viewKey={key} />;

  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-[var(--g-text-secondary)] animate-pulse">
          Cargando vista…
        </div>
      }
    >
      <View />
    </Suspense>
  );
}
