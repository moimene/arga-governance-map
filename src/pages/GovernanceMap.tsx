import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeMouseHandler,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { GovNode, type GovNodeData } from "@/components/governance-map/GovNode";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StatusBadge } from "@/components/StatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";

const nodeTypes = { gov: GovNode };

const initialNodes: Node<GovNodeData>[] = [
  // Root
  { id: "arga-seguros",  type: "gov", position: { x: 540, y: 0 },   data: { label: "ARGA Seguros, S.A.", type: "entity", status: { label: "Crítica", tone: "critical" } } },
  // Holdings
  { id: "arga-espana",   type: "gov", position: { x: 100, y: 160 }, data: { label: "ARGA España", type: "entity", status: { label: "Crítica", tone: "critical" } } },
  { id: "arga-latam",    type: "gov", position: { x: 360, y: 160 }, data: { label: "ARGA LATAM Holdings", type: "entity" } },
  { id: "arga-re",       type: "gov", position: { x: 620, y: 160 }, data: { label: "ARGA Reaseguros", type: "entity" } },
  { id: "arga-turquia",  type: "gov", position: { x: 880, y: 160 }, data: { label: "ARGA Turquía", type: "entity", status: { label: "Excepción", tone: "warning" } } },
  { id: "arga-usa",      type: "gov", position: { x: 1140, y: 160 }, data: { label: "ARGA USA", type: "entity" } },
  // Sub
  { id: "arga-brasil",   type: "gov", position: { x: 360, y: 320 }, data: { label: "ARGA Brasil", type: "entity", status: { label: "HALL-008", tone: "critical" }, emphasized: true } },
  // Órganos (left branch from root)
  { id: "consejo",       type: "gov", position: { x: 540, y: 480 }, data: { label: "Consejo de Administración", type: "organ" } },
  { id: "auditoria",     type: "gov", position: { x: 280, y: 640 }, data: { label: "Comisión de Auditoría", type: "organ" } },
  { id: "riesgos",       type: "gov", position: { x: 540, y: 640 }, data: { label: "Comité de Riesgos", type: "organ" } },
  // Personas
  { id: "antonio-rios",   type: "gov", position: { x: 800, y: 480 }, data: { label: "D. Antonio Ríos", type: "person" } },
  { id: "carmen-delgado", type: "gov", position: { x: 1020, y: 480 }, data: { label: "Dña. Carmen Delgado", type: "person" } },
  { id: "fernando-lopez", type: "gov", position: { x: 30, y: 640 }, data: { label: "D. Fernando López", type: "person" } },
  // Policies / obligations / findings
  { id: "pr-008",        type: "gov", position: { x: 800, y: 640 }, data: { label: "PR-008 — DORA", type: "policy", status: { label: "Pendiente", tone: "pending" } } },
  { id: "obl-dora-003",  type: "gov", position: { x: 800, y: 800 }, data: { label: "OBL-DORA-003 — Resiliencia operativa", type: "obligation", status: { label: "Sin control", tone: "critical" }, emphasized: true } },
  { id: "ghost-control", type: "gov", position: { x: 1060, y: 800 }, data: { label: "(Ningún control asignado)", type: "obligation", status: { label: "Vacío", tone: "critical" } } },
  { id: "ctr-004",       type: "gov", position: { x: 540, y: 960 }, data: { label: "CTR-004 — Pruebas resiliencia TIC", type: "control", status: { label: "Deficiente", tone: "warning" } } },
  { id: "hall-008",      type: "gov", position: { x: 100, y: 320 }, data: { label: "HALL-008 — Conflicto interés Brasil", type: "finding", status: { label: "Crítico", tone: "critical" }, emphasized: true } },
  { id: "andre-barbosa", type: "gov", position: { x: 100, y: 480 }, data: { label: "D. André Barbosa", type: "person" } },
  { id: "carlos-vaz",    type: "gov", position: { x: 360, y: 480 }, data: { label: "D. Carlos Eduardo Vaz", type: "person" } },
  { id: "del-001",       type: "gov", position: { x: 360, y: 800 }, data: { label: "DEL-001 — Poderes LATAM", type: "delegation", status: { label: "Caducada", tone: "critical" }, emphasized: true } },
  { id: "con-sit-002",   type: "gov", position: { x: 100, y: 800 }, data: { label: "CON-SIT-002 — No declarado", type: "finding", status: { label: "No declarado", tone: "critical" }, emphasized: true } },
  { id: "caso-sii-001",  type: "gov", position: { x: 100, y: 960 }, data: { label: "CASO-SII-001 — Canal SII", type: "sii", status: { label: "Investigación", tone: "warning" }, emphasized: true } },
];

const initialEdges: Edge[] = [
  { id: "e1", source: "arga-seguros", target: "arga-espana", label: "controla 100%", type: "smoothstep" },
  { id: "e2", source: "arga-seguros", target: "arga-latam", label: "controla 100%", type: "smoothstep" },
  { id: "e3", source: "arga-seguros", target: "arga-re", label: "controla 100%", type: "smoothstep" },
  { id: "e4", source: "arga-seguros", target: "arga-turquia", label: "controla 80%", type: "smoothstep" },
  { id: "e5", source: "arga-seguros", target: "arga-usa", label: "controla 100%", type: "smoothstep" },
  { id: "e6", source: "arga-latam", target: "arga-brasil", label: "controla 100%", type: "smoothstep" },
  { id: "e7", source: "arga-seguros", target: "consejo", label: "gobierna", type: "smoothstep", style: { stroke: "hsl(var(--primary))", strokeWidth: 1.5 } },
  { id: "e8", source: "consejo", target: "auditoria", label: "delegación", type: "smoothstep" },
  { id: "e9", source: "consejo", target: "riesgos", label: "delegación", type: "smoothstep" },
  { id: "e10", source: "antonio-rios", target: "consejo", label: "preside", type: "smoothstep" },
  { id: "e11", source: "carmen-delgado", target: "consejo", label: "miembro", type: "smoothstep" },
  { id: "e12", source: "fernando-lopez", target: "auditoria", label: "preside", type: "smoothstep" },
  { id: "e13", source: "pr-008", target: "obl-dora-003", label: "regula", type: "smoothstep" },
  {
    id: "e14",
    source: "obl-dora-003",
    target: "ghost-control",
    label: "SIN CONTROL ⚠",
    type: "smoothstep",
    style: { stroke: "hsl(var(--destructive))", strokeWidth: 2, strokeDasharray: "6 4" },
    labelStyle: { fill: "hsl(var(--destructive))", fontWeight: 700 },
    labelBgStyle: { fill: "hsl(var(--status-critical-bg))" },
    markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(var(--destructive))" },
  },
  {
    id: "e15", source: "hall-008", target: "arga-brasil", label: "afecta", type: "smoothstep",
    style: { stroke: "hsl(var(--destructive))", strokeWidth: 1.5 },
    labelStyle: { fill: "hsl(var(--destructive))", fontWeight: 600 },
  },
  {
    id: "e16", source: "hall-008", target: "andre-barbosa", label: "involucra", type: "smoothstep",
    style: { stroke: "hsl(var(--destructive))", strokeWidth: 1.5 },
    labelStyle: { fill: "hsl(var(--destructive))", fontWeight: 600 },
  },
  // CTR-004 (deficient control attempted on OBL-DORA-003)
  {
    id: "e17", source: "obl-dora-003", target: "ctr-004", label: "control deficiente", type: "smoothstep",
    style: { stroke: "hsl(var(--status-warning))", strokeWidth: 1.5, strokeDasharray: "4 3" },
    labelStyle: { fill: "hsl(var(--status-warning))", fontWeight: 600 },
  },
  // DEL-001 caducada → Carlos Vaz, vinculada a ARGA LATAM
  { id: "e18", source: "carlos-vaz", target: "del-001", label: "titular", type: "smoothstep" },
  {
    id: "e19", source: "del-001", target: "arga-latam", label: "CADUCADA ⚠", type: "smoothstep",
    style: { stroke: "hsl(var(--destructive))", strokeWidth: 2, strokeDasharray: "6 4" },
    labelStyle: { fill: "hsl(var(--destructive))", fontWeight: 700 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(var(--destructive))" },
  },
  // CON-SIT-002 ↔ HALL-008 ↔ André Barbosa
  {
    id: "e20", source: "con-sit-002", target: "andre-barbosa", label: "afecta", type: "smoothstep",
    style: { stroke: "hsl(var(--destructive))", strokeWidth: 1.5 },
    labelStyle: { fill: "hsl(var(--destructive))", fontWeight: 600 },
  },
  {
    id: "e21", source: "hall-008", target: "con-sit-002", label: "origina", type: "smoothstep",
    style: { stroke: "hsl(var(--destructive))", strokeWidth: 1.5, strokeDasharray: "4 3" },
    labelStyle: { fill: "hsl(var(--destructive))", fontWeight: 600 },
  },
  // CASO-SII-001 correlacionado con HALL-008
  {
    id: "e22", source: "caso-sii-001", target: "hall-008", label: "correlaciona", type: "smoothstep",
    style: { stroke: "hsl(var(--status-warning))", strokeWidth: 2, strokeDasharray: "8 4" },
    labelStyle: { fill: "hsl(35 92% 33%)", fontWeight: 700 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(var(--status-warning))" },
  },
];

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
  const [selected, setSelected] = useState<Node<GovNodeData> | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterJurisdiction, setFilterJurisdiction] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const filteredNodes = useMemo(() => {
    return initialNodes.filter((n) => {
      if (filterType !== "all" && n.data.type !== filterType) return false;
      return true;
    });
  }, [filterType]);

  const filteredIds = useMemo(() => new Set(filteredNodes.map((n) => n.id)), [filteredNodes]);
  const filteredEdges = useMemo(
    () => initialEdges.filter((e) => filteredIds.has(e.source) && filteredIds.has(e.target)),
    [filteredIds],
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
        <h1 className="mr-auto text-lg font-semibold">Governance Map</h1>

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
                    {initialEdges
                      .filter((e) => e.source === selected.id || e.target === selected.id)
                      .slice(0, 8)
                      .map((e) => {
                        const otherId = e.source === selected.id ? e.target : e.source;
                        const other = initialNodes.find((n) => n.id === otherId);
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
                  const t = selected.data.type;
                  const id = selected.id;
                  const targetMap: Partial<Record<typeof t, string>> = {
                    entity: `/entidades/${id}`,
                    organ: `/organos/${id}`,
                    policy: `/politicas/${id.toUpperCase()}`,
                    obligation: id.startsWith("obl-") ? `/obligaciones/${id.toUpperCase()}` : undefined,
                    finding: id.startsWith("hall-") ? `/hallazgos/${id.toUpperCase()}` : undefined,
                    delegation: "/delegaciones/carlos-vaz-latam",
                    control: "/obligaciones/controles/CTR-004",
                    sii: `/sii/${id.toUpperCase()}`,
                  };
                  const href = targetMap[t];
                  if (!href) return null;
                  const label = t === "sii" ? "Acceder al caso (zona SII)" : "Ver ficha completa";
                  return (
                    <Button asChild className="w-full gap-1.5">
                      <Link to={href}>{label} <ArrowRight className="h-4 w-4" /></Link>
                    </Button>
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
