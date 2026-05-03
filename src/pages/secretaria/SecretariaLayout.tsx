import { useState } from "react";
import { Outlet } from "react-router-dom";
import {
  SecretariaHeader,
  SecretariaMobileSidebar,
  SecretariaSidebar,
  useSecretariaScope,
} from "@/components/secretaria/shell";

export function SecretariaLayout() {
  const scope = useSecretariaScope();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div
      className="garrigues-module flex min-h-screen w-full"
      style={{ fontFamily: "'Montserrat', 'Inter', sans-serif" }}
    >
      <SecretariaSidebar scope={scope} />
      <SecretariaMobileSidebar scope={scope} open={mobileNavOpen} onOpenChange={setMobileNavOpen} />

      <main className="min-w-0 flex-1 overflow-auto bg-[var(--g-surface-page)]">
        <SecretariaHeader scope={scope} onOpenMobileNav={() => setMobileNavOpen(true)} />
        <Outlet />
      </main>
    </div>
  );
}
