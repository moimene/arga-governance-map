import { createContext } from "react";

export interface SidebarMobileContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

export const SidebarMobileContext = createContext<SidebarMobileContextValue | null>(null);
