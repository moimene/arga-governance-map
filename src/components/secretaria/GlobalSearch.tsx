// GlobalSearch — command palette Cmd+K para Secretaría (Sprint E, E-D9)
// Busca cross-module: acuerdos, convocatorias, políticas, hallazgos, acuerdos sin sesión

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileCheck2,
  Bell,
  ScrollText,
  Scale,
  AlertTriangle,
  Search,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";

interface SearchResult {
  id: string;
  label: string;
  sublabel: string;
  kind: "agreement" | "convocatoria" | "nosession" | "policy" | "finding";
  nav_to: string;
}

type AgreementRow = { id: string; agreement_kind: string; status: string; proposal_text?: string };
type ConvocatoriaRow = { id: string; estado: string; fecha_1?: string; governing_bodies: { name: string } | null };
type NoSessionRow = { id: string; title?: string; status: string };
type PolicyRow = { id: string; name: string; status: string };
type FindingRow = { id: string; code: string; title: string; severity?: string };

const KIND_META = {
  agreement:   { icon: FileCheck2,    group: "Acuerdos" },
  convocatoria:{ icon: Bell,          group: "Convocatorias" },
  nosession:   { icon: ScrollText,    group: "Acuerdos sin sesión" },
  policy:      { icon: Scale,         group: "Políticas" },
  finding:     { icon: AlertTriangle, group: "Hallazgos" },
};

async function runSearch(query: string): Promise<SearchResult[]> {
  if (query.trim().length < 2) return [];
  const q = `%${query.trim()}%`;
  const results: SearchResult[] = [];

  const [agreements, convocatorias, nosessions, policies, findings] = await Promise.allSettled([
    supabase
      .from("agreements")
      .select("id, agreement_kind, status, proposal_text")
      .or(`proposal_text.ilike.${q},agreement_kind.ilike.${q}`)
      .limit(5),
    supabase
      .from("convocatorias")
      .select("id, estado, fecha_1, governing_bodies(name)")
      .ilike("estado", q)
      .limit(5),
    supabase
      .from("no_session_resolutions")
      .select("id, title, status")
      .ilike("title", q)
      .limit(5),
    supabase
      .from("policies")
      .select("id, name, status")
      .ilike("name", q)
      .limit(5),
    supabase
      .from("findings")
      .select("id, code, title, severity")
      .or(`title.ilike.${q},code.ilike.${q}`)
      .limit(5),
  ]);

  if (agreements.status === "fulfilled" && agreements.value.data) {
    (agreements.value.data as AgreementRow[]).forEach((a) => {
      results.push({
        id: a.id,
        label: a.agreement_kind.replace(/_/g, " "),
        sublabel: a.proposal_text?.substring(0, 60) ?? a.status,
        kind: "agreement",
        nav_to: `/secretaria/acuerdos/${a.id}`,
      });
    });
  }

  if (convocatorias.status === "fulfilled" && convocatorias.value.data) {
    (convocatorias.value.data as ConvocatoriaRow[]).forEach((c) => {
      results.push({
        id: c.id,
        label: c.governing_bodies?.name ?? "Convocatoria",
        sublabel: `${c.estado} · ${c.fecha_1 ? new Date(c.fecha_1).toLocaleDateString("es-ES") : ""}`,
        kind: "convocatoria",
        nav_to: `/secretaria/convocatorias/${c.id}`,
      });
    });
  }

  if (nosessions.status === "fulfilled" && nosessions.value.data) {
    (nosessions.value.data as NoSessionRow[]).forEach((n) => {
      results.push({
        id: n.id,
        label: n.title ?? "Acuerdo sin sesión",
        sublabel: n.status,
        kind: "nosession",
        nav_to: `/secretaria/acuerdos-sin-sesion/${n.id}`,
      });
    });
  }

  if (policies.status === "fulfilled" && policies.value.data) {
    (policies.value.data as PolicyRow[]).forEach((p) => {
      results.push({
        id: p.id,
        label: p.name,
        sublabel: p.status,
        kind: "policy",
        nav_to: `/politicas/${p.id}`,
      });
    });
  }

  if (findings.status === "fulfilled" && findings.value.data) {
    (findings.value.data as FindingRow[]).forEach((f) => {
      results.push({
        id: f.id,
        label: `${f.code} — ${f.title}`,
        sublabel: f.severity ?? "",
        kind: "finding",
        nav_to: `/hallazgos/${f.id}`,
      });
    });
  }

  return results;
}

export function GlobalSearch() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const found = await runSearch(query);
        setResults(found);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = useCallback((nav_to: string) => {
    setOpen(false);
    setQuery("");
    setResults([]);
    navigate(nav_to);
  }, [navigate]);

  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    const g = KIND_META[r.kind].group;
    if (!acc[g]) acc[g] = [];
    acc[g].push(r);
    return acc;
  }, {});

  return (
    <>
      {/* Trigger button in sidebar */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[hsl(var(--sidebar-foreground))]/70 hover:bg-[hsl(var(--sidebar-accent))]/50 hover:text-[hsl(var(--sidebar-foreground))] transition-colors"
        style={{ borderRadius: "var(--g-radius-md)" }}
        aria-label="Buscar (⌘K)"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">Buscar…</span>
        <kbd
          className="hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-foreground))]/60"
          style={{ borderRadius: "var(--g-radius-sm)" }}
        >
          ⌘K
        </kbd>
      </button>

      {/* Dialog */}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Buscar acuerdos, convocatorias, políticas, hallazgos…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {query.length >= 2 && !searching && results.length === 0 && (
            <CommandEmpty>Sin resultados para "{query}".</CommandEmpty>
          )}
          {searching && (
            <div className="py-4 text-center text-sm text-muted-foreground">Buscando…</div>
          )}
          {Object.entries(grouped).map(([group, items], gi) => (
            <span key={group}>
              {gi > 0 && <CommandSeparator />}
              <CommandGroup heading={group}>
                {items.map((item) => {
                  const Icon = KIND_META[item.kind].icon;
                  return (
                    <CommandItem
                      key={item.id}
                      value={`${item.label} ${item.sublabel}`}
                      onSelect={() => handleSelect(item.nav_to)}
                    >
                      <Icon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="flex flex-col">
                        <span className="font-medium">{item.label}</span>
                        {item.sublabel && (
                          <span className="text-xs text-muted-foreground">{item.sublabel}</span>
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </span>
          ))}
          {query.length < 2 && (
            <CommandGroup heading="Navegación rápida">
              {[
                { label: "Dashboard",          nav: "/secretaria",                    icon: FileCheck2 },
                { label: "Convocatorias",       nav: "/secretaria/convocatorias",      icon: Bell },
                { label: "Acuerdos sin sesión", nav: "/secretaria/acuerdos-sin-sesion", icon: ScrollText },
                { label: "Calendario",          nav: "/secretaria/calendario",         icon: Bell },
                { label: "Plantillas",          nav: "/secretaria/plantillas",         icon: Scale },
              ].map((nav) => {
                const Icon = nav.icon;
                return (
                  <CommandItem
                    key={nav.nav}
                    value={nav.label}
                    onSelect={() => handleSelect(nav.nav)}
                  >
                    <Icon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                    {nav.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
