/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";
import { useTenantBranding } from "@/context/TenantBrandContext";
import { scopesForTenant } from "@/lib/tenant-scopes";

interface ScopeContextValue {
  scope: string;
  setScope: (s: string) => void;
  scopes: readonly string[];
}

const ScopeContext = createContext<ScopeContextValue | undefined>(undefined);

export function ScopeProvider({ children }: { children: ReactNode }) {
  const branding = useTenantBranding();
  const scopeList = useMemo(() => scopesForTenant(branding), [branding]);
  const [scope, setScope] = useState<string>(scopeList[0]);

  useEffect(() => {
    if (!scopeList.includes(scope)) {
      setScope(scopeList[0]);
    }
  }, [scopeList, scope]);

  return (
    <ScopeContext.Provider value={{ scope, setScope, scopes: scopeList }}>
      {children}
    </ScopeContext.Provider>
  );
}

export function useScope() {
  const ctx = useContext(ScopeContext);
  if (!ctx) throw new Error("useScope must be used inside ScopeProvider");
  return ctx;
}
