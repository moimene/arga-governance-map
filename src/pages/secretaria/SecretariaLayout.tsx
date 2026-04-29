import { Outlet } from "react-router-dom";
import {
  SecretariaHeader,
  SecretariaSidebar,
  useSecretariaScope,
} from "@/components/secretaria/shell";

export function SecretariaLayout() {
  const scope = useSecretariaScope();

  return (
    <div
      className="garrigues-module flex min-h-screen w-full"
      style={{ fontFamily: "'Montserrat', 'Inter', sans-serif" }}
    >
      <SecretariaSidebar scope={scope} />

      <main className="flex-1 overflow-auto bg-[var(--g-surface-page)]">
        <SecretariaHeader scope={scope} />
        <Outlet />
      </main>
    </div>
  );
}
