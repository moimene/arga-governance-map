import { X } from "lucide-react";
import { useScope } from "@/context/ScopeContext";
import { scopes } from "@/data/scopes";

/** Small chip shown OUTSIDE the dashboard when scope ≠ Group, to remind the user. */
export function ScopeNotice() {
  const { scope, setScope } = useScope();
  if (scope === scopes[0]) return null;
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-status-warning/40 bg-status-warning-bg px-2.5 py-1 text-[12px] font-medium text-status-warning">
      Ámbito: {scope}
      <button
        type="button"
        onClick={() => setScope(scopes[0])}
        className="rounded-full p-0.5 hover:bg-status-warning/20"
        aria-label="Volver a Grupo"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
