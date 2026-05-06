// GlobalSearch — command palette Cmd+K para Secretaría (Sprint E, E-D9)
// Busca cross-module: acuerdos, convocatorias, políticas, hallazgos, acuerdos sin sesión

import { useState, useEffect, useCallback, useMemo } from "react";
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
import { useTenantContext } from "@/context/TenantContext";
import { getSecretariaScopedIds } from "@/lib/secretaria/scope-filters";
import { getNavGroups } from "@/components/secretaria/shell/navigation";
import type { SecretariaNavItem, SecretariaScopeController } from "@/components/secretaria/shell";

interface SearchResult {
  id: string;
  label: string;
  sublabel: string;
  kind: "agreement" | "convocatoria" | "nosession" | "policy" | "finding";
  nav_to: string;
}

type AgreementRow = {
  id: string;
  agreement_kind: string;
  status: string;
  proposal_text?: string | null;
  decision_date?: string | null;
  governing_bodies?: { name?: string | null } | null;
};
type ConvocatoriaRow = {
  id: string;
  estado: string;
  fecha_1?: string | null;
  tipo_convocatoria?: string | null;
  agenda_items?: unknown;
  governing_bodies: { name: string } | null;
};
type NoSessionRow = { id: string; title?: string; status: string };
type PolicyRow = { id: string; name: string; status: string };
type FindingRow = { id: string; code: string; title: string; severity?: string };
type ResolutionRow = {
  id: string;
  meeting_id: string;
  agreement_id: string | null;
  agenda_item_index: number;
  resolution_text: string;
  required_majority_code: string | null;
  status: string;
};

interface GlobalSearchProps {
  scope: SecretariaScopeController;
}

interface QuickNavItem {
  label: string;
  nav: string;
  icon: typeof FileCheck2;
}

const KIND_META = {
  agreement:   { icon: FileCheck2,    group: "Acuerdos" },
  convocatoria:{ icon: Bell,          group: "Convocatorias" },
  nosession:   { icon: ScrollText,    group: "Acuerdos sin sesión" },
  policy:      { icon: Scale,         group: "Políticas" },
  finding:     { icon: AlertTriangle, group: "Hallazgos" },
};

function normalizeSearchText(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function includesQuery(value: unknown, query: string) {
  return normalizeSearchText(value).includes(normalizeSearchText(query));
}

async function runSearch(query: string, tenantId?: string | null, entityId?: string | null): Promise<SearchResult[]> {
  if (query.trim().length < 2 || !tenantId) return [];
  const rawQuery = query.trim();
  const q = `%${rawQuery}%`;
  const results: SearchResult[] = [];
  const { bodyIds, agreementIds } = await getSecretariaScopedIds(tenantId, entityId);

  async function fetchAgreements(): Promise<AgreementRow[]> {
    if (agreementIds?.length === 0) return [];
    let request = supabase
      .from("agreements")
      .select("id, agreement_kind, status, proposal_text, decision_date, governing_bodies(name)")
      .eq("tenant_id", tenantId)
      .order("updated_at", { ascending: false });
    if (agreementIds) request = request.in("id", agreementIds);
    const { data, error } = await request.limit(80);
    if (error) throw error;
    return ((data ?? []) as AgreementRow[])
      .filter((agreement) =>
        [
          agreement.id,
          agreement.agreement_kind,
          agreement.status,
          agreement.proposal_text,
          agreement.decision_date,
          agreement.governing_bodies?.name,
        ].some((value) => includesQuery(value, rawQuery))
      )
      .slice(0, 8);
  }

  async function fetchConvocatorias(): Promise<ConvocatoriaRow[]> {
    if (bodyIds?.length === 0) return [];
    let request = supabase
      .from("convocatorias")
      .select("id, estado, fecha_1, tipo_convocatoria, agenda_items, governing_bodies(name)")
      .eq("tenant_id", tenantId)
      .order("fecha_1", { ascending: false });
    if (bodyIds) request = request.in("body_id", bodyIds);
    const { data, error } = await request.limit(80);
    if (error) throw error;
    return ((data ?? []) as ConvocatoriaRow[])
      .filter((convocatoria) =>
        [
          convocatoria.id,
          convocatoria.estado,
          convocatoria.fecha_1,
          convocatoria.tipo_convocatoria,
          convocatoria.governing_bodies?.name,
          JSON.stringify(convocatoria.agenda_items ?? ""),
        ].some((value) => includesQuery(value, rawQuery))
      )
      .slice(0, 8);
  }

  async function fetchNoSessions(): Promise<NoSessionRow[]> {
    if (bodyIds?.length === 0) return [];
    let request = supabase
      .from("no_session_resolutions")
      .select("id, title, status")
      .eq("tenant_id", tenantId)
      .or(`title.ilike.${q},status.ilike.${q}`);
    if (bodyIds) request = request.in("body_id", bodyIds);
    const { data, error } = await request.limit(5);
    if (error) throw error;
    return (data ?? []) as NoSessionRow[];
  }

  async function fetchPolicies(): Promise<PolicyRow[]> {
    if (bodyIds?.length === 0) return [];
    let request = supabase
      .from("policies")
      .select("id, name, status")
      .eq("tenant_id", tenantId)
      .ilike("name", q);
    if (bodyIds) request = request.in("approval_body_id", bodyIds);
    const { data, error } = await request.limit(5);
    if (error) throw error;
    return (data ?? []) as PolicyRow[];
  }

  async function fetchFindings(): Promise<FindingRow[]> {
    let request = supabase
      .from("findings")
      .select("id, code, title, severity")
      .eq("tenant_id", tenantId)
      .or(`title.ilike.${q},code.ilike.${q}`);
    if (entityId) request = request.eq("entity_id", entityId);
    const { data, error } = await request.limit(5);
    if (error) throw error;
    return (data ?? []) as FindingRow[];
  }

  async function fetchMeetingResolutions(): Promise<ResolutionRow[]> {
    if (bodyIds?.length === 0) return [];
    let meetingIds: string[] | null = null;
    if (bodyIds) {
      const { data: meetings, error: meetingsError } = await supabase
        .from("meetings")
        .select("id")
        .eq("tenant_id", tenantId)
        .in("body_id", bodyIds)
        .limit(200);
      if (meetingsError) throw meetingsError;
      meetingIds = (meetings ?? []).map((meeting) => meeting.id);
      if (meetingIds.length === 0) return [];
    }

    let request = supabase
      .from("meeting_resolutions")
      .select("id, meeting_id, agreement_id, agenda_item_index, resolution_text, required_majority_code, status")
      .eq("tenant_id", tenantId)
      .or(`resolution_text.ilike.${q},required_majority_code.ilike.${q},status.ilike.${q}`);
    if (meetingIds) request = request.in("meeting_id", meetingIds);
    const { data, error } = await request.limit(8);
    if (error) throw error;
    return (data ?? []) as ResolutionRow[];
  }

  const [agreements, convocatorias, nosessions, policies, findings, resolutions] = await Promise.allSettled([
    fetchAgreements(),
    fetchConvocatorias(),
    fetchNoSessions(),
    fetchPolicies(),
    fetchFindings(),
    fetchMeetingResolutions(),
  ]);

  if (agreements.status === "fulfilled") {
    agreements.value.forEach((a) => {
      results.push({
        id: a.id,
        label: a.agreement_kind.replace(/_/g, " "),
        sublabel: [a.status, a.decision_date, a.governing_bodies?.name, a.proposal_text?.substring(0, 60)]
          .filter(Boolean)
          .join(" · "),
        kind: "agreement",
        nav_to: `/secretaria/acuerdos/${a.id}`,
      });
    });
  }

  if (convocatorias.status === "fulfilled") {
    convocatorias.value.forEach((c) => {
      results.push({
        id: c.id,
        label: c.governing_bodies?.name ?? "Convocatoria",
        sublabel: `${c.estado} · ${c.fecha_1 ? new Date(c.fecha_1).toLocaleDateString("es-ES") : ""}`,
        kind: "convocatoria",
        nav_to: `/secretaria/convocatorias/${c.id}`,
      });
    });
  }

  if (nosessions.status === "fulfilled") {
    nosessions.value.forEach((n) => {
      results.push({
        id: n.id,
        label: n.title ?? "Acuerdo sin sesión",
        sublabel: n.status,
        kind: "nosession",
        nav_to: `/secretaria/acuerdos-sin-sesion/${n.id}`,
      });
    });
  }

  if (policies.status === "fulfilled") {
    policies.value.forEach((p) => {
      results.push({
        id: p.id,
        label: p.name,
        sublabel: p.status,
        kind: "policy",
        nav_to: `/politicas/${p.id}`,
      });
    });
  }

  if (findings.status === "fulfilled") {
    findings.value.forEach((f) => {
      results.push({
        id: f.id,
        label: `${f.code} — ${f.title}`,
        sublabel: f.severity ?? "",
        kind: "finding",
        nav_to: `/hallazgos/${f.id}`,
      });
    });
  }

  if (resolutions.status === "fulfilled") {
    const existing = new Set(results.map((result) => `${result.kind}:${result.id}`));
    resolutions.value.forEach((resolution) => {
      const resultId = resolution.agreement_id ?? resolution.id;
      const key = `agreement:${resultId}`;
      if (existing.has(key)) return;
      existing.add(key);
      results.push({
        id: resultId,
        label: resolution.required_majority_code?.replace(/_/g, " ") || `Punto ${resolution.agenda_item_index}`,
        sublabel: `${resolution.status} · ${resolution.resolution_text.substring(0, 80)}`,
        kind: "agreement",
        nav_to: resolution.agreement_id
          ? `/secretaria/acuerdos/${resolution.agreement_id}`
          : `/secretaria/reuniones/${resolution.meeting_id}`,
      });
    });
  }

  return results;
}

function getQuickNav(scope: SecretariaScopeController): QuickNavItem[] {
  const seen = new Set<string>();
  return getNavGroups(scope.mode)
    .flatMap((group) => group.items)
    .filter((item) => {
      if (scope.mode === "sociedad" && item.requiresEntity && !scope.selectedEntity) return false;
      const key = item.to;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((item: SecretariaNavItem) => ({
      label: item.label,
      nav:
        item.selectedEntityRoute && scope.selectedEntity
          ? `/secretaria/sociedades/${scope.selectedEntity.id}`
          : item.to,
      icon: item.icon,
    }));
}

export function GlobalSearch({ scope }: GlobalSearchProps) {
  const navigate = useNavigate();
  const { tenantId } = useTenantContext();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const entityId = scope.mode === "sociedad" ? scope.selectedEntity?.id ?? null : null;
  const quickNav = useMemo(() => getQuickNav(scope), [scope]);
  const searchPlaceholder =
    scope.mode === "sociedad" && scope.selectedEntity
      ? `Buscar en ${scope.selectedEntity.legalName}: acuerdos, convocatorias, políticas…`
      : "Buscar en Secretaría: acuerdos, convocatorias, políticas, hallazgos…";
  const quickNavHeading =
    scope.mode === "sociedad" ? "Navegación de la sociedad" : "Navegación de grupo";
  const triggerLabel = scope.mode === "sociedad" ? "Buscar en sociedad…" : "Buscar en Secretaría…";

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
        const found = await runSearch(query, tenantId, entityId);
        setResults(found);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [entityId, query, tenantId]);

  const handleSelect = useCallback((nav_to: string) => {
    setOpen(false);
    setQuery("");
    setResults([]);
    navigate(nav_to.startsWith("/secretaria") ? scope.createScopedTo(nav_to) : nav_to);
  }, [navigate, scope]);

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
        <span className="flex-1 text-left">{triggerLabel}</span>
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
          placeholder={searchPlaceholder}
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {query.length >= 2 && !searching && results.length === 0 && (
            <CommandEmpty>
              {scope.mode === "sociedad" ? "Sin resultados en esta sociedad" : "Sin resultados"} para "{query}".
            </CommandEmpty>
          )}
          {searching && (
            <div className="py-4 text-center text-sm text-[var(--g-text-secondary)]">Buscando…</div>
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
                      <Icon className="mr-2 h-4 w-4 shrink-0 text-[var(--g-text-secondary)]" />
                      <div className="flex flex-col">
                        <span className="font-medium">{item.label}</span>
                        {item.sublabel && (
                          <span className="text-xs text-[var(--g-text-secondary)]">{item.sublabel}</span>
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </span>
          ))}
          {query.length < 2 && (
            <CommandGroup heading={quickNavHeading}>
              {quickNav.map((nav) => {
                const Icon = nav.icon;
                return (
                  <CommandItem
                    key={nav.nav}
                    value={nav.label}
                    onSelect={() => handleSelect(nav.nav)}
                  >
                    <Icon className="mr-2 h-4 w-4 shrink-0 text-[var(--g-text-secondary)]" />
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
