import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import {
  useEntitiesList,
  formatJurisdiction,
  formatMateriality,
  formatEntityStatus,
  type EntityWithParent,
} from "@/hooks/useEntities";
import { ChevronDown, ChevronRight, LayoutGrid, List, Search } from "lucide-react";
import { cn } from "@/lib/utils";

type Mode = "table" | "tree";

const materialityTone = (m: string): "critical" | "warning" | "info" | "neutral" => {
  const label = formatMateriality(m);
  return label === "Crítica" ? "critical" : label === "Alta" ? "warning" : label === "Media" ? "info" : "neutral";
};

function TreeNode({
  entity,
  depth,
  childrenByParent,
}: {
  entity: EntityWithParent;
  depth: number;
  childrenByParent: Map<string, EntityWithParent[]>;
}) {
  const children = childrenByParent.get(entity.id) ?? [];
  const [open, setOpen] = useState(depth < 1);
  return (
    <div>
      <div
        className={cn("flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent")}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        {children.length > 0 ? (
          <button onClick={() => setOpen((o) => !o)} className="text-muted-foreground">
            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <span className="w-3.5" />
        )}
        <Link to={`/entidades/${entity.slug}`} className="flex-1 text-sm font-medium text-foreground hover:underline">
          {entity.common_name}
        </Link>
        <span className="text-xs text-muted-foreground">{formatJurisdiction(entity.jurisdiction)}</span>
        <StatusBadge label={formatMateriality(entity.materiality)} tone={materialityTone(entity.materiality)} />
      </div>
      {open && children.map((c) => (
        <TreeNode key={c.id} entity={c} depth={depth + 1} childrenByParent={childrenByParent} />
      ))}
    </div>
  );
}

export default function EntidadesList() {
  const [mode, setMode] = useState<Mode>("table");
  const [q, setQ] = useState("");
  const [jur, setJur] = useState("all");
  const [mat, setMat] = useState("all");

  const { data: entities = [], isLoading } = useEntitiesList();

  const jurisdictions = useMemo(
    () => Array.from(new Set(entities.map((e) => formatJurisdiction(e.jurisdiction)))).sort(),
    [entities],
  );

  const filtered = useMemo(() => {
    return entities.filter((e) => {
      if (q && !`${e.legal_name} ${e.common_name}`.toLowerCase().includes(q.toLowerCase())) return false;
      if (jur !== "all" && formatJurisdiction(e.jurisdiction) !== jur) return false;
      if (mat !== "all" && formatMateriality(e.materiality) !== mat) return false;
      return true;
    });
  }, [entities, q, jur, mat]);

  const childrenByParent = useMemo(() => {
    const m = new Map<string, EntityWithParent[]>();
    for (const e of entities) {
      if (!e.parent_entity_id) continue;
      const arr = m.get(e.parent_entity_id) ?? [];
      arr.push(e);
      m.set(e.parent_entity_id, arr);
    }
    return m;
  }, [entities]);

  const roots = useMemo(() => entities.filter((e) => !e.parent_entity_id), [entities]);

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Entidades del Grupo</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {entities.length} entidades en {jurisdictions.length} jurisdicciones
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-md border border-border bg-card p-1">
          <Button variant={mode === "table" ? "secondary" : "ghost"} size="sm" onClick={() => setMode("table")} className="gap-1.5 h-8">
            <List className="h-3.5 w-3.5" /> Tabla
          </Button>
          <Button variant={mode === "tree" ? "secondary" : "ghost"} size="sm" onClick={() => setMode("tree")} className="gap-1.5 h-8">
            <LayoutGrid className="h-3.5 w-3.5" /> Árbol
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="mb-4 flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar entidad..." className="h-9 pl-9" />
          </div>
          <Select value={jur} onValueChange={setJur}>
            <SelectTrigger className="h-9 w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las jurisdicciones</SelectItem>
              {jurisdictions.map((j) => <SelectItem key={j} value={j}>{j}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={mat} onValueChange={setMat}>
            <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas materialidades</SelectItem>
              <SelectItem value="Crítica">Crítica</SelectItem>
              <SelectItem value="Alta">Alta</SelectItem>
              <SelectItem value="Media">Media</SelectItem>
              <SelectItem value="Baja">Baja</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {mode === "table" ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Jurisdicción</TableHead>
                <TableHead>Forma legal</TableHead>
                <TableHead>Matriz</TableHead>
                <TableHead>Materialidad</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">Cargando…</TableCell></TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">Sin resultados</TableCell></TableRow>
              )}
              {filtered.map((e) => (
                <TableRow key={e.id} className="cursor-pointer">
                  <TableCell>
                    <Link to={`/entidades/${e.slug}`} className="font-medium text-foreground hover:text-primary hover:underline">
                      {e.legal_name}
                    </Link>
                    <div className="text-xs text-muted-foreground">{e.common_name}</div>
                  </TableCell>
                  <TableCell>{formatJurisdiction(e.jurisdiction)}</TableCell>
                  <TableCell><span className="font-mono text-xs">{e.legal_form ?? "—"}</span></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{e.parent_name ?? "—"}</TableCell>
                  <TableCell><StatusBadge label={formatMateriality(e.materiality)} tone={materialityTone(e.materiality)} /></TableCell>
                  <TableCell><StatusBadge label={formatEntityStatus(e.entity_status)} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="rounded-md border border-border bg-card p-2">
            {roots.map((r) => (
              <TreeNode key={r.id} entity={r} depth={0} childrenByParent={childrenByParent} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
