import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { GovNode, type GovNodeData } from "@/components/governance-map/GovNode";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StatusBadge } from "@/components/StatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Filter, Info, Loader2, RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";
import { useGovernanceMapData } from "@/hooks/useGovernanceMapData";

const nodeTypes = { gov: GovNode };
const EMPTY_NODES: Node<GovNodeData>[] = [];
const EMPTY_EDGES = [];

const filterTypeLabels: Record<string, string> = {
  entity: "Entidad",
  organ: "Órgano",
  person: "Persona",
  policy: "Política",
  obligation: "Obligación",
  finding: "Hallazgo",
  control: "Control",
  delegation: "Delegación",
  sii: "Caso SII",
};

const jurisdictionLabels: Record<string, string> = {
  ES: "España",
  BR: "Brasil",
  MX: "México",
  TR: "Turquía",
  US: "EE.UU.",
  IT: "Italia",
};

const knownJurisdictions = ["ES", "BR", "MX", "TR", "US", "IT"];

const mapGuide = [
  "Entidad → órgano muestra dónde se toman decisiones.",
  "Política → obligación conecta norma interna con cumplimiento.",
  "Hallazgos y delegaciones señalan riesgo operativo.",
];

function parseJurisdiction(label: string) {
  const parts = label.split(" · ");
  const candidate = parts[parts.length - 1]?.trim();
  return candidate && /^[A-Z]{2,3}$/.test(candidate) ? candidate : null;
}

export default function GovernanceMap() {
  const { data: mapData, isLoading } = useGovernanceMapData();
  const allNodes = mapData?.nodes ?? EMPTY_NODES;
  const allEdges = mapData?.edges ?? EMPTY_EDGES;

  const [selected, setSelected] = useState<Node<GovNodeData> | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterJurisdiction, setFilterJurisdiction] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const nodeJurisdictions = useMemo(() => {
    const map = new Map<string, Set<string>>();
    const nodeTypeById = new Map(allNodes.map((n) => [n.id, n.data.type]));

    const ensure = (id: string) => {
      if (!map.has(id)) map.set(id, new Set());
      return map.get(id)!;
    };

    const propagate = (fromId: string, toId: string) => {
      const from = map.get(fromId);
      if (!from || from.size === 0) return;
      const to = ensure(toId);
      from.forEach((jurisdiction) => to.add(jurisdiction));
    };

    allNodes.forEach((node) => {
      if (node.data.type !== "entity") return;
      const jurisdiction = parseJurisdiction(node.data.label);
      if (jurisdiction) ensure(node.id).add(jurisdiction);
    });

    allEdges.forEach((edge) => {
      const sourceType = nodeTypeById.get(edge.source);
      const targetType = nodeTypeById.get(edge.target);
      if (sourceType === "entity") propagate(edge.source, edge.target);
      if (targetType === "entity") propagate(edge.target, edge.source);
    });

    allEdges.forEach((edge) => {
      const sourceType = nodeTypeById.get(edge.source);
      const targetType = nodeTypeById.get(edge.target);
      if (sourceType === "finding" && targetType === "policy") propagate(edge.source, edge.target);
      if (targetType === "finding" && sourceType === "policy") propagate(edge.target, edge.source);
    });

    allEdges.forEach((edge) => {
      const sourceType = nodeTypeById.get(edge.source);
      const targetType = nodeTypeById.get(edge.target);
      if (sourceType === "policy" && targetType === "obligation") propagate(edge.source, edge.target);
      if (targetType === "policy" && sourceType === "obligation") propagate(edge.target, edge.source);
    });

    return map;
  }, [allEdges, allNodes]);

  const jurisdictionOptions = useMemo(() => {
    const dynamic = Array.from(nodeJurisdictions.values()).flatMap((values) => Array.from(values));
    const unique = Array.from(new Set([...knownJurisdictions, ...dynamic]));
    return unique.map((value) => ({ value, label: jurisdictionLabels[value] ?? value }));
  }, [nodeJurisdictions]);

  const filteredNodes = useMemo(() => {
    return allNodes.filter((n) => {
      if (filterType !== "all" && n.data.type !== filterType) return false;
      if (filterJurisdiction !== "all" && !nodeJurisdictions.get(n.id)?.has(filterJurisdiction)) return false;
      if (filterStatus !== "all") {
        const tone = n.data.status?.tone;
        if (filterStatus === "critical" && tone !== "critical") return false;
        if (filterStatus === "warning" && tone !== "warning") return false;
        if (filterStatus === "active" && tone !== "active") return false;
      }
      return true;
    });
  }, [allNodes, filterType, filterJurisdiction, filterStatus, nodeJurisdictions]);

  const filteredIds = useMemo(() => new Set(filteredNodes.map((n) => n.id)), [filteredNodes]);
  const filteredEdges = useMemo(
    () => allEdges.filter((e) => filteredIds.has(e.source) && filteredIds.has(e.target)),
    [allEdges, filteredIds],
  );

  const onNodeClick = useCallback<NodeMouseHandler>((_, node) => {
    setSelected(node as Node<GovNodeData>);
  }, []);

  const reset = () => {
    setFilterType("all");
    setFilterJurisdiction("all");
    setFilterStatus("all");
  };

  const activeFilters = [
    filterType !== "all" ? filterTypeLabels[filterType] ?? filterType : null,
    filterJurisdiction !== "all" ? jurisdictionLabels[filterJurisdiction] ?? filterJurisdiction : null,
    filterStatus !== "all"
      ? ({ active: "Vigente", warning: "En revisión", critical: "Crítico" } as Record<string, string>)[filterStatus]
      : null,
  ].filter(Boolean);

  return (
    <div className="flex min-h-[calc(100vh-3.5rem-2.75rem)] flex-col overflow-hidden bg-[var(--t-surface-page)]">
      <section className="border-b border-[var(--t-border-default)] bg-[var(--t-surface-card)] px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--t-brand)]">
              <Filter className="h-3.5 w-3.5" />
              Mapa explicable
            </div>
            <h1 className="mt-1 flex items-center gap-2 text-xl font-semibold tracking-tight text-[var(--t-text-primary)] sm:text-2xl">
              Governance Map
              {isLoading && <Loader2 className="h-4 w-4 animate-spin text-[var(--t-text-secondary)]" />}
            </h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--t-text-secondary)]">
              Explora entidades, órganos, normas, obligaciones y riesgos como relaciones trazables. Filtra por tipo, jurisdicción o estado para aislar el contexto que aplica a una decisión.
            </p>
          </div>

          <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:w-[680px] xl:grid-cols-[1fr_1fr_1fr_auto]">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger aria-label="Filtrar por tipo de nodo" className="h-10 w-full border-[var(--t-border-default)] bg-[var(--t-surface-card)]">
                <SelectValue placeholder="Tipo de nodo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                {Object.entries(filterTypeLabels).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterJurisdiction} onValueChange={setFilterJurisdiction}>
              <SelectTrigger aria-label="Filtrar por jurisdicción" className="h-10 w-full border-[var(--t-border-default)] bg-[var(--t-surface-card)]">
                <SelectValue placeholder="Jurisdicción" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las jurisdicciones</SelectItem>
                {jurisdictionOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger aria-label="Filtrar por estado" className="h-10 w-full border-[var(--t-border-default)] bg-[var(--t-surface-card)]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Vigente</SelectItem>
                <SelectItem value="warning">En revisión</SelectItem>
                <SelectItem value="critical">Crítico</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={reset}
              className="h-10 gap-1.5 border-[var(--t-border-default)] bg-[var(--t-surface-card)] text-[var(--t-text-primary)] hover:bg-[var(--t-surface-subtle)]"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Resetear
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2 text-xs text-[var(--t-text-secondary)] sm:flex-row sm:items-center sm:justify-between">
          <span>
            Relaciones visibles: <strong className="text-[var(--t-text-primary)]">{filteredNodes.length}</strong> nodos y{" "}
            <strong className="text-[var(--t-text-primary)]">{filteredEdges.length}</strong> vínculos.
          </span>
          <span>
            Filtro: <strong className="text-[var(--t-text-primary)]">{activeFilters.length > 0 ? activeFilters.join(" · ") : "Todo el grupo"}</strong>
          </span>
        </div>
      </section>

      <div
        data-testid="governance-map-canvas"
        className="tour-target relative min-h-[620px] flex-1 bg-[var(--t-surface-muted)]"
        data-tour="map-canvas"
      >
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Skeleton className="h-[70%] w-[80%] max-w-[980px]" />
          </div>
        ) : (
          <ReactFlow
            nodes={filteredNodes}
            edges={filteredEdges}
            nodeTypes={nodeTypes}
            onNodeClick={onNodeClick}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="var(--t-border-subtle)" gap={20} />
            <Controls className="!shadow-md" />
            <MiniMap
              pannable
              zoomable
              nodeColor={(n) => {
                const d = n.data as GovNodeData;
                if (d.type === "finding") return "var(--t-status-error)";
                if (d.type === "policy") return "var(--t-status-warning)";
                if (d.type === "obligation") return "var(--t-status-success)";
                return "var(--t-brand)";
              }}
              maskColor="var(--t-surface-page)"
            />
          </ReactFlow>
        )}

        {!isLoading && filteredNodes.length === 0 && (
          <Card className="absolute left-1/2 top-1/2 z-20 w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 border-[var(--t-border-default)] bg-[var(--t-surface-card)] p-5 text-center">
            <h2 className="text-base font-semibold text-[var(--t-text-primary)]">Sin nodos para este filtro</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--t-text-secondary)]">
              Ajusta tipo, jurisdicción o estado para recuperar relaciones del mapa.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={reset}
              className="mt-4 border-[var(--t-border-default)] bg-[var(--t-surface-card)] text-[var(--t-text-primary)] hover:bg-[var(--t-surface-subtle)]"
            >
              Resetear filtros
            </Button>
          </Card>
        )}

        <Card className="absolute bottom-4 left-4 right-4 z-10 max-h-[230px] overflow-y-auto border-[var(--t-border-default)] bg-[var(--t-surface-card)] p-3 sm:right-auto sm:w-[360px]">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--t-brand)]">
            <Info className="h-3.5 w-3.5" />
            Cómo leer el mapa
          </div>
          <ul className="mt-2 space-y-1.5 text-xs leading-5 text-[var(--t-text-secondary)]">
            {mapGuide.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[var(--t-text-primary)]">
            {Object.entries(filterTypeLabels).map(([key, label]) => (
              <span key={key} className="rounded-md border border-[var(--t-border-subtle)] bg-[var(--t-surface-page)] px-2 py-1">
                {label}
              </span>
            ))}
          </div>
        </Card>
      </div>

      {/* Side panel */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full max-w-full sm:max-w-[420px]">
          {selected && (
            <>
              <SheetHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge label={selected.data.type} tone="info" />
                  {selected.data.status && <StatusBadge label={selected.data.status.label} tone={selected.data.status.tone} />}
                </div>
                <SheetTitle className="mt-2 break-words text-xl text-[var(--t-text-primary)]">{selected.data.label}</SheetTitle>
              </SheetHeader>

              <div className="mt-6 space-y-4">
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--t-text-secondary)]">Datos clave</h3>
                  <dl className="space-y-1.5 text-sm">
                    <div className="flex min-w-0 justify-between gap-4"><dt className="text-[var(--t-text-secondary)]">ID</dt><dd className="break-all font-mono text-xs text-[var(--t-text-primary)]">{selected.id}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-[var(--t-text-secondary)]">Tipo</dt><dd className="text-[var(--t-text-primary)]">{selected.data.type}</dd></div>
                    {selected.data.status && (
                      <div className="flex justify-between gap-4"><dt className="text-[var(--t-text-secondary)]">Estado</dt><dd className="text-[var(--t-text-primary)]">{selected.data.status.label}</dd></div>
                    )}
                    {nodeJurisdictions.get(selected.id)?.size ? (
                      <div className="flex justify-between gap-4">
                        <dt className="text-[var(--t-text-secondary)]">Jurisdicción</dt>
                        <dd className="text-[var(--t-text-primary)]">
                          {Array.from(nodeJurisdictions.get(selected.id) ?? [])
                            .map((value) => jurisdictionLabels[value] ?? value)
                            .join(", ")}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                </section>

                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--t-text-secondary)]">Relaciones</h3>
                  <ul className="space-y-1 text-sm">
                    {allEdges
                      .filter((e) => e.source === selected.id || e.target === selected.id)
                      .slice(0, 8)
                      .map((e) => {
                        const otherId = e.source === selected.id ? e.target : e.source;
                        const other = allNodes.find((n) => n.id === otherId);
                        return (
                          <li key={e.id} className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 hover:bg-[var(--t-surface-subtle)]">
                            <span className="shrink-0 text-xs text-[var(--t-text-secondary)]">{String(e.label)}</span>
                            <span className="ml-auto truncate text-[var(--t-text-primary)]">{other?.data.label}</span>
                          </li>
                        );
                      })}
                    {allEdges.filter((e) => e.source === selected.id || e.target === selected.id).length === 0 && (
                      <li className="rounded-md border border-[var(--t-border-subtle)] bg-[var(--t-surface-page)] px-3 py-2 text-sm text-[var(--t-text-secondary)]">
                        Sin relaciones directas visibles.
                      </li>
                    )}
                  </ul>
                </section>

                {(() => {
                  const href = selected.data.href as string | undefined;
                  if (!href) return null;
                  const t = selected.data.type;
                  const label = t === "sii" ? "Acceder al caso (zona SII)" : "Ver ficha completa";
                  return (
                    <div className="space-y-3">
                      {t === "sii" && (
                        <div className="flex items-start gap-2 rounded-md border border-[var(--t-status-warning)] bg-[var(--t-surface-subtle)] px-3 py-2 text-xs text-[var(--t-text-primary)]">
                          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--t-status-warning)]" />
                          <span>Al acceder se registrará en el log de auditoría independiente.</span>
                        </div>
                      )}
                      <Button asChild className="w-full gap-1.5 bg-[var(--t-brand)] text-[var(--t-text-inverse)] hover:bg-[var(--t-brand-hover)]">
                        <Link to={href}>{label} <ArrowRight className="h-4 w-4" /></Link>
                      </Button>
                    </div>
                  );
                })()}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
