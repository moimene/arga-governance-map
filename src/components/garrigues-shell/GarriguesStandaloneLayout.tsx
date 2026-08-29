import { useState } from "react";
import { Outlet } from "react-router-dom";
import { useSecretariaScope } from "@/components/secretaria/shell";
import { useTenantBranding } from "@/context/TenantBrandContext";
import { GarriguesHeader } from "./GarriguesHeader";
import { GarriguesSidebar, GarriguesMobileSidebar } from "./GarriguesSidebar";

export interface GarriguesStandaloneLayoutProps {
  /** Mode: "standalone" (no TGMS exit) or "embedded" (with return link to parent shell) */
  mode?: "standalone" | "embedded";
  /** Optional custom URL for returning to the host/parent app */
  parentAppUrl?: string;
  /** Optional custom label for returning to the host/parent app */
  parentAppLabel?: string;
  /** Optional children override instead of Outlet */
  children?: React.ReactNode;
}

export function GarriguesStandaloneLayout({
  mode = "standalone",
  parentAppUrl,
  parentAppLabel,
  children,
}: GarriguesStandaloneLayoutProps) {
  const scope = useSecretariaScope();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const isExplicitStandalone =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("mode") === "standalone";

  const effectiveMode = isExplicitStandalone ? "standalone" : mode;

  return (
    <div
      className="garrigues-module flex min-h-screen w-full"
      style={{ fontFamily: "'Montserrat', 'Inter', sans-serif" }}
    >
      <GarriguesSidebar
        scope={scope}
        mode={effectiveMode}
        parentAppUrl={parentAppUrl}
        parentAppLabel={parentAppLabel}
      />
      <GarriguesMobileSidebar
        scope={scope}
        mode={effectiveMode}
        parentAppUrl={parentAppUrl}
        parentAppLabel={parentAppLabel}
        open={mobileNavOpen}
        onOpenChange={setMobileNavOpen}
      />

      <main className="min-w-0 flex-1 overflow-auto bg-[var(--g-surface-page)]">
        <GarriguesHeader
          scope={scope}
          onOpenMobileNav={() => setMobileNavOpen(true)}
        />
        {children ?? <Outlet />}
      </main>
    </div>
  );
}

export default GarriguesStandaloneLayout;
