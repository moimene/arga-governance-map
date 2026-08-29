import { useState } from "react";
import { Building2, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useScope } from "@/context/ScopeContext";
import { cn } from "@/lib/utils";

interface ScopeSwitcherProps {
  variant?: "header" | "sidebar";
  className?: string;
}

export function ScopeSwitcher({ variant = "header", className }: ScopeSwitcherProps) {
  const { scope, setScope, scopes } = useScope();
  const [open, setOpen] = useState(false);

  if (variant === "sidebar") {
    return (
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex w-full items-center justify-between gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/50",
              className
            )}
            style={{
              background: "var(--t-sidebar-scope-bg, rgba(255,255,255,0.12))",
            }}
          >
            <span className="flex items-center gap-1.5 truncate">
              <span className="text-white/70">Scope:</span>
              <span className="font-bold truncate">{scope}</span>
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-80" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {scopes.map((s) => (
            <DropdownMenuItem
              key={s}
              onClick={() => setScope(s)}
              className={cn("flex items-center justify-between cursor-pointer text-xs", scope === s && "bg-accent font-semibold")}
            >
              <span>{s}</span>
              {scope === s && <Check className="h-3.5 w-3.5 text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={cn("h-9 gap-2 font-medium", className)}>
          <Building2 className="h-4 w-4 text-primary" />
          <span className="text-foreground">{scope}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {scopes.map((s) => (
          <DropdownMenuItem
            key={s}
            onClick={() => setScope(s)}
            className={cn("flex items-center justify-between cursor-pointer", scope === s && "bg-accent")}
          >
            <span>{s}</span>
            {scope === s && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
