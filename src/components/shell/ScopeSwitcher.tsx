import { useState } from "react";
import { Building2, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useScope } from "@/context/ScopeContext";
import { scopes } from "@/data/scopes";
import { cn } from "@/lib/utils";

export function ScopeSwitcher() {
  const { scope, setScope } = useScope();
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-9 gap-2 font-medium">
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
            className={cn("flex items-center justify-between", scope === s && "bg-accent")}
          >
            <span>{s}</span>
            {scope === s && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
