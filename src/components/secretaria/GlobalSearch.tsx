// GlobalSearch — command palette Cmd+K para Secretaría (Sprint E, E-D9)
// Busca cross-module: acuerdos, convocatorias, políticas, hallazgos, acuerdos sin sesión, puntos de agenda

import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileCheck2,
  Bell,
  ScrollText,
  Scale,
  AlertTriangle,
  Search,
  ListChecks,
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
import {
  normalizeAgendaItemKind,
  type AgendaItemKind,
} from "@/lib/secretaria/agenda-kind";
import {
  AGENDA_KIND_BADGE_LABEL,
  AGENDA_KIND_CHIP,
  AGENDA_KIND_HUMAN_LABEL,
  getAgendaResultRoute,
} from "@/lib/secretaria/agenda-search-routing";

interface SearchResult {
  id: string;
  label: string;
  sublabel: string;
  kind: "agreement" | "convocatoria" | "nosession" | "policy" | "finding" | "agenda_item";
  nav_to: string;
  agendaKind?: AgendaItemKind;
  pendingMaterialization?: boolean;
}

type MaybeJoin<T> = T | T[] | null | undefined;
type BodyNameJoin = MaybeJoin<{ name?: string | null }>;

type AgreementRow = {
  id: string;
  agreement_kind: string;
  status: string;
  proposal_text?: string | null;
  decision_date?: string | null;
  governing_bodies?: BodyNameJoin;
};
type ConvocatoriaRow = {
  id: string;
  estado: string;
  fecha_1?: string | null;
  tipo_convocatoria?: string | null;
  agenda_items?: unknown;
  governing_bodies?: BodyNameJoin;
};
type NoSessionRow = { id: string; title?: string; status: string };
type PolicyRow = { id: string; name: string; status: string };
type FindingRow = { id: string; code: string; title: string; severity?: string };
type AgendaItemJoin = MaybeJoin<{ kind?: string | null; order_number?: number | null; title?: string | null }>;
type ResolutionRow = {
  id: string;
  meeting_id: string;
  agreement_id: string | null;
  agenda_item_index: number;
  resolution_text: string;
  required_majority_code: string | null;
  status: string;
  kind_resolution?: string | null;
  agenda_items?: AgendaItemJoin;
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
  agenda_item: { icon: ListChecks,    group: "Puntos del orden del día" },
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

function firstJoin<T>(value: MaybeJoin<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
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
    return ((data ?? []) as unknown as AgreementRow[])
      .filter((agreement) => {
        const body = firstJoin(agreement.governing_bodies);
        return [
          agreement.id,
          agreement.agreement_kind,
          agreement.status,
          agreement.proposal_text,
          agreement.decision_date,
          body?.name,
        ].some((value) => includesQuery(value, rawQuery));
      })
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
    return ((data ?? []) as unknown as ConvocatoriaRow[])
      .filter((convocatoria) => {
        const body = firstJoin(convocatoria.governing_bodies);
        return [
          convocatoria.id,
          convocatoria.estado,
          convocatoria.fecha_1,
          convocatoria.tipo_convocatoria,
          body?.name,
          JSON.stringify(convocatoria.agenda_items ?? ""),
        ].some((value) => includesQuery(value, rawQuery));
      })
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

    // Codex P2 round 10: UNION agenda_items.title + meeting_resolutions.text.
    // agenda_items sigue siendo fuente primaria (preserva INFO/DELIB sin
    // resolución), pero también unificamos resultados cuando el texto matchea
    // resolution_text/required_majority_code/status. El producto cartesiano
    // se deduplica por (meeting_id, order_number/agenda_item_index).
    //
    // Pipeline:
    //   1a. agenda_items por title ilike (primary)
    //   1b. meeting_resolutions por resolution_text/required_majority_code/status (paralela)
    //   2. Resolver agenda_items para las resolutions que matchearon (enrich kind)
    //   3. Resolver resolutions para los agenda_items que matchearon (enrich agreement_id)
    //   4. Merge dedupe
    let agendaRequest = supabase
      .from("agenda_items")
      .select("id, meeting_id, order_number, title, kind, decision_subtype")
      .eq("tenant_id", tenantId)
      .ilike("title", q);
    if (meetingIds) agendaRequest = agendaRequest.in("meeting_id", meetingIds);

    let resolutionRequest = supabase
      .from("meeting_resolutions")
      .select("id, meeting_id, agreement_id, agenda_item_index, resolution_text, required_majority_code, status, kind_resolution")
      .eq("tenant_id", tenantId)
      .or(`resolution_text.ilike.${q},required_majority_code.ilike.${q},status.ilike.${q}`);
    if (meetingIds) resolutionRequest = resolutionRequest.in("meeting_id", meetingIds);

    const [agendaResp, resoTextResp] = await Promise.all([
      agendaRequest.limit(8),
      resolutionRequest.limit(8),
    ]);
    if (agendaResp.error) throw agendaResp.error;

    const agendaItems = (agendaResp.data ?? []) as Array<{
      id: string;
      meeting_id: string;
      order_number: number;
      title: string;
      kind: string | null;
      decision_subtype: string | null;
    }>;
    const matchedResolutions = (resoTextResp.data ?? []) as Array<{
      id: string;
      meeting_id: string;
      agreement_id: string | null;
      agenda_item_index: number;
      resolution_text: string;
      required_majority_code: string | null;
      status: string;
      kind_resolution: string | null;
    }>;
    if (agendaItems.length === 0 && matchedResolutions.length === 0) return [];

    // Para resolutions que matchearon por texto: cargar sus agenda_items
    const meetingIdsForReso = Array.from(new Set(matchedResolutions.map((r) => r.meeting_id)));
    const agendaEnrichResp =
      meetingIdsForReso.length > 0
        ? await supabase
            .from("agenda_items")
            .select("meeting_id, order_number, kind, title")
            .in("meeting_id", meetingIdsForReso)
        : { data: [] as Array<{ meeting_id: string; order_number: number; kind: string | null; title: string | null }> };
    const agendaByKey = new Map<string, { kind: string | null; title: string | null }>();
    for (const ai of (agendaEnrichResp.data ?? []) as Array<{
      meeting_id: string;
      order_number: number;
      kind: string | null;
      title: string | null;
    }>) {
      agendaByKey.set(`${ai.meeting_id}:${ai.order_number}`, { kind: ai.kind, title: ai.title });
    }

    // Para agenda_items primaries: cargar resolutions matching (puede coincidir
    // o no con matchedResolutions; siempre query separada para no perder agenda
    // sin texto match en resolution).
    const meetingIdsForAgenda = Array.from(new Set(agendaItems.map((a) => a.meeting_id)));
    const resoEnrichResp =
      meetingIdsForAgenda.length > 0
        ? await supabase
            .from("meeting_resolutions")
            .select("id, meeting_id, agreement_id, agenda_item_index, resolution_text, required_majority_code, status, kind_resolution")
            .eq("tenant_id", tenantId)
            .in("meeting_id", meetingIdsForAgenda)
        : { data: [] as typeof matchedResolutions };
    const resolutionByKey = new Map<string, (typeof matchedResolutions)[number]>();
    for (const r of (resoEnrichResp.data ?? []) as typeof matchedResolutions) {
      resolutionByKey.set(`${r.meeting_id}:${r.agenda_item_index}`, r);
    }

    // Merge + dedupe por (meeting_id, agenda_item_index/order_number)
    const seen = new Set<string>();
    const out: Array<{
      id: string;
      meeting_id: string;
      agreement_id: string | null;
      agenda_item_index: number;
      resolution_text: string;
      required_majority_code: string | null;
      status: string;
      kind_resolution: string | null;
      agenda_items: { kind: string | null; order_number: number; title: string | null } | null;
    }> = [];

    // Primero agenda_items hits (preservan INFO/DELIB sin resolution)
    for (const ai of agendaItems) {
      const key = `${ai.meeting_id}:${ai.order_number}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const r = resolutionByKey.get(key);
      out.push(
        r
          ? { ...r, agenda_items: { kind: ai.kind, order_number: ai.order_number, title: ai.title } }
          : {
              id: ai.id,
              meeting_id: ai.meeting_id,
              agreement_id: null,
              agenda_item_index: ai.order_number,
              resolution_text: ai.title,
              required_majority_code: null,
              status: "DRAFT",
              kind_resolution: null,
              agenda_items: { kind: ai.kind, order_number: ai.order_number, title: ai.title },
            },
      );
    }
    // Luego resolutions que matchearon por texto pero su agenda_item no
    // estaba en la query primaria
    for (const r of matchedResolutions) {
      const key = `${r.meeting_id}:${r.agenda_item_index}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const ai = agendaByKey.get(key);
      out.push({
        ...r,
        agenda_items: ai
          ? { kind: ai.kind, order_number: r.agenda_item_index, title: ai.title }
          : null,
      });
    }

    return out as unknown as ResolutionRow[];
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
      const body = firstJoin(a.governing_bodies);
      results.push({
        id: a.id,
        label: a.agreement_kind.replace(/_/g, " "),
        sublabel: [a.status, a.decision_date, body?.name, a.proposal_text?.substring(0, 60)]
          .filter(Boolean)
          .join(" · "),
        kind: "agreement",
        nav_to: `/secretaria/acuerdos/${a.id}`,
      });
    });
  }

  if (convocatorias.status === "fulfilled") {
    convocatorias.value.forEach((c) => {
      const body = firstJoin(c.governing_bodies);
      results.push({
        id: c.id,
        label: body?.name ?? "Convocatoria",
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
      const agendaJoin = firstJoin(resolution.agenda_items);
      // Authoritative source: agenda_items.kind (P4 SSOT v3.1). Defensive default DELIBERATIVO.
      const effectiveKind: AgendaItemKind = normalizeAgendaItemKind(agendaJoin?.kind ?? "DELIBERATIVO");
      const orderNumber = agendaJoin?.order_number ?? resolution.agenda_item_index;
      const agendaTitle = agendaJoin?.title ?? null;

      // DECISORIO con agreement materializado → result tipo agreement (route /acuerdos/:id).
      // DECISORIO sin agreement → agenda_item con badge "pendiente materialización".
      // No decisorios → agenda_item (route /reuniones/:id#punto-N).
      const isDecisorio = effectiveKind === "DECISORIO";
      const hasAgreement = Boolean(resolution.agreement_id);

      if (isDecisorio && hasAgreement) {
        const resultId = resolution.agreement_id!;
        const key = `agreement:${resultId}`;
        if (existing.has(key)) return;
        existing.add(key);
        const navRoute = getAgendaResultRoute({
          type: "agenda_item",
          meeting_id: resolution.meeting_id,
          order_number: orderNumber,
          kind: effectiveKind,
          agreement_id: resolution.agreement_id ?? undefined,
          title: agendaTitle ?? "",
        });
        results.push({
          id: resultId,
          label: agendaTitle ?? resolution.required_majority_code?.replace(/_/g, " ") ?? `Punto ${orderNumber}`,
          sublabel: `${AGENDA_KIND_HUMAN_LABEL[effectiveKind]} · ${resolution.status} · ${resolution.resolution_text.substring(0, 80)}`,
          kind: "agreement",
          nav_to: navRoute,
          agendaKind: effectiveKind,
        });
        return;
      }

      // Agenda item result (DELIBERATIVO, INFORMATIVO, o DECISORIO pendiente).
      const resultId = `${resolution.meeting_id}:${orderNumber}`;
      const key = `agenda_item:${resultId}`;
      if (existing.has(key)) return;
      existing.add(key);

      const pendingMaterialization = isDecisorio && !hasAgreement;
      const sublabelParts = [
        AGENDA_KIND_HUMAN_LABEL[effectiveKind],
        pendingMaterialization ? "pendiente materialización" : null,
        resolution.status,
        resolution.resolution_text.substring(0, 80),
      ].filter(Boolean);

      results.push({
        id: resultId,
        label: agendaTitle ?? `Punto ${orderNumber}`,
        sublabel: sublabelParts.join(" · "),
        kind: "agenda_item",
        nav_to: getAgendaResultRoute({
          type: "agenda_item",
          meeting_id: resolution.meeting_id,
          order_number: orderNumber,
          kind: effectiveKind,
          agreement_id: resolution.agreement_id ?? undefined,
          title: agendaTitle ?? "",
        }),
        agendaKind: effectiveKind,
        pendingMaterialization,
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
                  const badgeKind = item.agendaKind;
                  return (
                    <CommandItem
                      key={`${item.kind}:${item.id}`}
                      value={`${item.label} ${item.sublabel}`}
                      onSelect={() => handleSelect(item.nav_to)}
                    >
                      <Icon className="mr-2 h-4 w-4 shrink-0 text-[var(--g-text-secondary)]" />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="flex items-center gap-2">
                          <span className="font-medium truncate">{item.label}</span>
                          {badgeKind && (
                            <span
                              className={`shrink-0 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${AGENDA_KIND_CHIP[badgeKind]}`}
                              style={{ borderRadius: "var(--g-radius-sm)" }}
                              aria-label={`Tipo de punto: ${AGENDA_KIND_HUMAN_LABEL[badgeKind]}`}
                            >
                              {AGENDA_KIND_BADGE_LABEL[badgeKind]}
                            </span>
                          )}
                          {item.pendingMaterialization && (
                            <span
                              className="shrink-0 px-1.5 py-0.5 text-[10px] font-medium bg-[var(--status-warning)] text-[var(--g-text-inverse)]"
                              style={{ borderRadius: "var(--g-radius-sm)" }}
                              aria-label="Acuerdo pendiente de materialización"
                            >
                              pendiente materialización
                            </span>
                          )}
                        </span>
                        {item.sublabel && (
                          <span className="text-xs text-[var(--g-text-secondary)] truncate">{item.sublabel}</span>
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
