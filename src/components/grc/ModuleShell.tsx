import { Outlet } from "react-router-dom";
import { ModuleSidebar } from "./ModuleSidebar";

export function ModuleShell() {
  return (
    <div className="flex min-h-[calc(100vh-2.5rem)]">
      <ModuleSidebar />
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
