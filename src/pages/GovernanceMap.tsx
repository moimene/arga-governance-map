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
import { ArrowRight, RotateCcw, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useGovernanceMapData } from "@/hooks/useGovernanceMapData";

const nodeTypes = { gov: GovNode };

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

export default function GovernanceMap() {
  const { data: mapData, isLoading } = useGovernanceMapData();
  const allNodes = mapData?.nodes ?? [];
  const allEdges = mapData?.edges ?? [];

  const [selected, setSelected] = useState<Node<GovNodeData> | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterJurisdiction, setFilterJurisdiction] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const filteredNodes = useMemo(() => {
    return allNodes.filter((n) => {
      if (filterType !== "all" && n.data.type !== filterType) return false;
      if (filterStatus !== "all") {
        const tone = n.data.status?.tone;
        if (filterStatus === "critical" && tone !== "critical") return false;
        if (filterStatus === "warning" && tone !== "warning") return false;
        if (filterStatus === "active" && tone !== "active") return false;
      }
      return true;
    });
  }, [allNodes, filterType, filterStatus]);

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

  return (
    <div className="flex h-[calc(100vh-3.5rem-2.75rem)] flex-col">
      {/* Filters */}
      <div className="flex items-center gap-3 border-b border-border bg-card px-6 py-3">
        <h1 className="mr-auto text-lg font-semibold flex items-center gap-2">
          Governance Map
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </h1>

        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Tipo de nodo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {Object.entries(filterTypeLabels).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterJurisdiction} onValueChange={setFilterJurisdiction}>
          <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="Jurisdicción" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las jurisdicciones</SelectItem>
            <SelectItem value="ES">España</SelectItem>
            <SelectItem value="BR">Brasil</SelectItem>
            <SelectItem value="MX">México</SelectItem>
            <SelectItem value="TR">Turquía</SelectItem>
            <SelectItem value="US">EE.UU.</SelectItem>
            <SelectItem value="IT">Italia</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Vigente</SelectItem>
            <SelectItem value="warning">En revisión</SelectItem>
            <SelectItem value="critical">Crítico</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={reset} className="gap-1.5">
          <RotateCcw className="h-3.5 w-3.5" /> Resetear
        </Button>
      </div>

      {/* Map */}
      <div className="relative flex-1 bg-secondary/40 tour-target" data-tour="map-canvas">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Skeleton className="h-[70%] w-[80%]" />
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
            <Background color="hsl(var(--border))" gap={20} />
            <Controls className="!shadow-md" />
            <MiniMap
              pannable
              zoomable
              nodeColor={(n) => {
                const d = n.data as GovNodeData;
                if (d.type === "finding") return "hsl(var(--destructive))";
                if (d.type === "policy") return "hsl(var(--status-warning))";
                if (d.type === "obligation") return "hsl(var(--status-active))";
                return "hsl(var(--primary))";
              }}
              maskColor="hsl(var(--background) / 0.6)"
            />
          </ReactFlow>
        )}

        {/* Legend */}
        <Card className="absolute left-4 top-4 z-10 p-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Leyenda</div>
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-[#dbeafe] border border-blue-300" />Entidad</div>
            <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-[#e0e7ff] border border-indigo-300" />Órgano</div>
            <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-[#f3e8ff] border border-purple-300" />Persona</div>
            <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-[#fef3c7] border border-amber-300" />Política</div>
            <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-[#dcfce7] border border-green-300" />Obligación</div>
            <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-[#fee2e2] border border-red-300" />Hallazgo</div>
            <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-[#cffafe] border border-cyan-300" />Control</div>
            <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-[#ffedd5] border border-orange-300" />Delegación</div>
            <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-[#fef3c7] border border-amber-500" />Caso SII</div>
          </div>
        </Card>
      </div>

      {/* Side panel */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-[400px] sm:max-w-[400px]">
          {selected && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <StatusBadge label={selected.data.type} tone="info" />
                  {selected.data.status && <StatusBadge label={selected.data.status.label} tone={selected.data.status.tone} />}
                </div>
                <SheetTitle className="mt-2 text-xl">{selected.data.label}</SheetTitle>
              </SheetHeader>

              <div className="mt-6 space-y-4">
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Datos clave</h3>
                  <dl className="space-y-1.5 text-sm">
                    <div className="flex justify-between"><dt className="text-muted-foreground">ID</dt><dd className="font-mono text-xs">{selected.id}</dd></div>
                    <div className="flex justify-between"><dt className="text-muted-foreground">Tipo</dt><dd>{selected.data.type}</dd></div>
                    {selected.data.status && (
                      <div className="flex justify-between"><dt className="text-muted-foreground">Estado</dt><dd>{selected.data.status.label}</dd></div>
                    )}
                  </dl>
                </section>

                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Relaciones</h3>
                  <ul className="space-y-1 text-sm">
                    {allEdges
                      .filter((e) => e.source === selected.id || e.target === selected.id)
                      .slice(0, 8)
                      .map((e) => {
                        const otherId = e.source === selected.id ? e.target : e.source;
                        const other = allNodes.find((n) => n.id === otherId);
                        return (
                          <li key={e.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent">
                            <span className="text-xs text-muted-foreground">{String(e.label)}</span>
                            <span className="ml-auto truncate">{other?.data.label}</span>
                          </li>
                        );
                      })}
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
                        <div className="rounded-md border border-status-warning/40 bg-status-warning-bg px-3 py-2 text-xs text-status-warning-foreground">
                          ⚠ Al acceder se registrará en el log de auditoría independiente.
                        </div>
                      )}
                      <Button asChild className="w-full gap-1.5">
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
