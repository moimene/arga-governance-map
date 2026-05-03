import { useContext } from "react";
import {
  SidebarMobileContext,
  type SidebarMobileContextValue,
} from "./sidebar-mobile-context-value";

export function useSidebarMobile() {
  const ctx = useContext(SidebarMobileContext);
  if (!ctx) {
    return { open: false, setOpen: () => {}, toggle: () => {} } satisfies SidebarMobileContextValue;
  }
  return ctx;
}
