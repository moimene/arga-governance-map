import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { SidebarMobileContext } from "./sidebar-mobile-context-value";

export function SidebarMobileProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  // Auto-cierre al cambiar de ruta
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const toggle = useCallback(() => setOpen((v) => !v), []);

  return (
    <SidebarMobileContext.Provider value={{ open, setOpen, toggle }}>
      {children}
    </SidebarMobileContext.Provider>
  );
}
