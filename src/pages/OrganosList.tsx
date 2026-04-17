import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { bodies } from "@/data/bodies";
import { entities, getEntityById } from "@/data/entities";
import { AlertTriangle, Plus, Users } from "lucide-react";

export default function OrganosList() {
  const [entityFilter, setEntityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() =>
    bodies.filter((b) =>
      (entityFilter === "all" || b.entityId === entityFilter) &&
      (typeFilter === "all" || b.type === typeFilter) &&
      (statusFilter === "all" || b.status === statusFilter)
    ), [entityFilter, typeFilter, statusFilter]);

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Users className="h-6 w-6 text-primary" />Órganos y Reuniones
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{bodies.length} órganos de gobierno en el grupo</p>
        </div>
        <Button className="gap-1.5"><Plus className="h-4 w-4" />Crear órgano</Button>
      </div>

      <Card className="mb-5 p-4">
        <div className="grid grid-cols-4 gap-3">
          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger><SelectValue placeholder="Entidad" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las entidades</SelectItem>
              {entities.map((e) => <SelectItem key={e.id} value={e.id}>{e.commonName}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              <SelectItem value="Consejo">Consejo</SelectItem>
              <SelectItem value="Comisión delegada">Comisión delegada</SelectItem>
              <SelectItem value="Comité ejecutivo">Comité ejecutivo</SelectItem>
              <SelectItem value="Junta General">Junta General</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="Activo">Activo</SelectItem>
              <SelectItem value="Inactivo">Inactivo</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Buscar órgano..." />
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Entidad</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Reglamento</TableHead>
              <TableHead>Frecuencia</TableHead>
              <TableHead>Secretario</TableHead>
              <TableHead>Próxima reunión</TableHead>
              <TableHead className="w-32">Alertas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((b) => {
              const ent = getEntityById(b.entityId);
              return (
                <TableRow key={b.id} className="cursor-pointer">
                  <TableCell>
                    <Link to={`/organos/${b.id}`} className="font-medium text-foreground hover:text-primary hover:underline">{b.name}</Link>
                  </TableCell>
                  <TableCell className="text-sm">{ent?.commonName ?? "—"}</TableCell>
                  <TableCell className="text-sm">{b.type}</TableCell>
                  <TableCell className="font-mono text-xs">{b.regulationId ?? "—"}</TableCell>
                  <TableCell className="text-sm">{b.frequency}</TableCell>
                  <TableCell className="text-sm">{b.secretary}</TableCell>
                  <TableCell className="font-mono text-xs">{b.nextMeetingDate ?? "—"}</TableCell>
                  <TableCell>
                    {b.alertsCount ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-status-warning/30 bg-status-warning-bg px-2 py-0.5 text-[11px] font-semibold text-status-warning">
                        <AlertTriangle className="h-3 w-3" />{b.alertsCount} mandato{b.alertsCount > 1 ? "s" : ""}
                      </span>
                    ) : <StatusBadge label={b.status === "Activo" ? "VIGENTE" : "INACTIVA"} />}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
