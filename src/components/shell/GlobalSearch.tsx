import { useState } from "react";
import { Search, Building, FileText, AlertTriangle, Users, Key } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Suggestion {
  label: string;
  type: string;
  icon: React.ComponentType<{ className?: string }>;
  to: string;
}

const groups: { title: string; items: Suggestion[] }[] = [
  {
    title: "Entidades",
    items: [
      { label: "ARGA Seguros, S.A.", type: "Entidad", icon: Building, to: "/entidades/arga-seguros" },
      { label: "ARGA Brasil Seguros S.A.", type: "Entidad", icon: Building, to: "/entidades/arga-brasil" },
    ],
  },
  {
    title: "Hallazgos",
    items: [
      { label: "HALL-008 — Conflicto de interés ARGA Brasil", type: "Hallazgo", icon: AlertTriangle, to: "/hallazgos" },
    ],
  },
  {
    title: "Políticas",
    items: [{ label: "PR-008 — DORA", type: "Política", icon: FileText, to: "/politicas" }],
  },
  {
    title: "Personas",
    items: [{ label: "Dña. Lucía Paredes Vega", type: "Persona", icon: Users, to: "/entidades/arga-seguros" }],
  },
  {
    title: "Delegaciones",
    items: [{ label: "Delegación D. Carlos Eduardo Vaz (caducada)", type: "Delegación", icon: Key, to: "/delegaciones" }],
  },
];

export function GlobalSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open && q.length > 0} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative w-[400px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar entidades, políticas, órganos, personas..."
            className="h-9 pl-9 bg-secondary/40 border-border"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(e.target.value.length > 0);
            }}
            onFocus={() => q.length > 0 && setOpen(true)}
          />
        </div>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[480px] p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="max-h-[400px] overflow-auto p-1">
          {groups.map((g) => (
            <div key={g.title} className="py-1">
              <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g.title}</div>
              {g.items.map((it) => (
                <Link
                  key={it.label}
                  to={it.to}
                  onClick={() => {
                    setOpen(false);
                    setQ("");
                  }}
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-accent"
                >
                  <it.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 text-foreground">{it.label}</span>
                  <span className="text-[11px] text-muted-foreground">{it.type}</span>
                </Link>
              ))}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
