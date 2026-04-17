import { Link, useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { entities, getChildren, getEntityById } from "@/data/entities";
import { policies } from "@/data/policies";
import { findings } from "@/data/findings";
import { ChevronRight, Download, Edit3, Network } from "lucide-react";

export default function EntidadDetalle() {
  const { id = "arga-seguros" } = useParams();
  const entity = getEntityById(id);

  if (!entity) {
    return (
      <div className="p-10 text-center text-muted-foreground">
        Entidad no encontrada. <Link to="/entidades" className="text-primary underline">Volver al listado</Link>
      </div>
    );
  }

  const children = getChildren(entity.id);
  const parent = entity.parentEntityId ? getEntityById(entity.parentEntityId) : null;
  const entityFindings = findings.filter((f) => f.entity.toLowerCase().includes(entity.commonName.toLowerCase().split(" ").pop() ?? "") || f.entity === entity.commonName);

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      {/* Breadcrumb */}
      <nav className="mb-3 flex items-center gap-1 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-foreground">Inicio</Link>
        <ChevronRight className="h-3 w-3" />
        <Link to="/entidades" className="hover:text-foreground">Entidades</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">{entity.legalName}</span>
      </nav>

      {/* Object header */}
      <Card className="p-6">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <StatusBadge label={entity.status} />
              <StatusBadge
                label={entity.materiality}
                tone={entity.materiality === "Crítica" ? "critical" : entity.materiality === "Alta" ? "warning" : entity.materiality === "Media" ? "info" : "neutral"}
              />
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{entity.legalName}</h1>
            <div className="mt-1 text-sm text-muted-foreground">
              {entity.jurisdiction} · <span className="font-mono text-xs">{entity.registrationNumber}</span>
            </div>
            <div className="mt-3 text-sm">
              Secretaría: <span className="font-medium text-foreground">{entity.secretary}</span>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="sm" className="gap-1.5"><Edit3 className="h-3.5 w-3.5" />Editar</Button>
            <Button variant="outline" size="sm" asChild className="gap-1.5">
              <Link to="/governance-map"><Network className="h-3.5 w-3.5" />Ver en mapa</Link>
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5"><Download className="h-3.5 w-3.5" />Exportar</Button>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="resumen" className="mt-6">
        <TabsList className="grid w-full max-w-3xl grid-cols-6">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="relaciones">Relaciones</TabsTrigger>
          <TabsTrigger value="normativa">Normativa</TabsTrigger>
          <TabsTrigger value="delegaciones">Delegaciones</TabsTrigger>
          <TabsTrigger value="hallazgos">Hallazgos</TabsTrigger>
          <TabsTrigger value="auditoria">Auditoría</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="mt-4">
          <Card className="p-6">
            <dl className="grid grid-cols-2 gap-x-12 gap-y-4 text-sm">
              <Field k="Denominación legal" v={entity.legalName} />
              <Field k="Nombre común" v={entity.commonName} />
              <Field k="Jurisdicción" v={entity.jurisdiction} />
              <Field k="Forma legal" v={entity.legalForm} />
              <Field k="Nº registro" v={<span className="font-mono text-xs">{entity.registrationNumber}</span>} />
              <Field k="Entidad matriz" v={parent ? <Link to={`/entidades/${parent.id}`} className="text-primary hover:underline">{parent.commonName}</Link> : "— (top-level)"} />
              <Field k="% Participación" v={entity.ownershipPercentage != null ? `${entity.ownershipPercentage}%` : "—"} />
              <Field k="Materialidad" v={entity.materiality} />
              <Field k="Estado" v={entity.status} />
              <Field k="Idioma por defecto" v="Español" />
              <Field k="Secretario owner" v={entity.secretary} />
              <Field k="Fecha de constitución" v="15/03/1933" />
              <div className="col-span-2"><Field k="Domicilio social" v="Paseo de Recoletos, 25 — 28004 Madrid" /></div>
            </dl>
          </Card>
        </TabsContent>

        <TabsContent value="relaciones" className="mt-4">
          <Card>
            <div className="border-b border-border px-5 py-3 text-sm font-semibold">Filiales directas ({children.length})</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Jurisdicción</TableHead>
                  <TableHead>% Participación</TableHead>
                  <TableHead>Materialidad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {children.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell><Link to={`/entidades/${c.id}`} className="font-medium text-foreground hover:text-primary hover:underline">{c.legalName}</Link></TableCell>
                    <TableCell>{c.jurisdiction}</TableCell>
                    <TableCell>{c.ownershipPercentage != null ? `${c.ownershipPercentage}%` : "—"}</TableCell>
                    <TableCell><StatusBadge label={c.materiality} tone={c.materiality === "Crítica" ? "critical" : c.materiality === "Alta" ? "warning" : c.materiality === "Media" ? "info" : "neutral"} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="normativa" className="mt-4">
          <Card>
            <div className="border-b border-border px-5 py-3 text-sm font-semibold">Políticas aplicables ({policies.length})</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Código</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Próxima revisión</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {policies.map((p) => (
                  <TableRow key={p.code}>
                    <TableCell className="font-mono text-xs">{p.code}</TableCell>
                    <TableCell>{p.title}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.owner}</TableCell>
                    <TableCell><StatusBadge label={p.status} /></TableCell>
                    <TableCell className="font-mono text-xs">{p.nextReview ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="delegaciones" className="mt-4">
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Delegaciones vigentes otorgadas por esta entidad — módulo Delegaciones se habilitará en la siguiente iteración.
          </Card>
        </TabsContent>

        <TabsContent value="hallazgos" className="mt-4">
          <Card>
            <div className="border-b border-border px-5 py-3 text-sm font-semibold">Hallazgos vinculados</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Código</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead>Severidad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Vence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entityFindings.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">Sin hallazgos asociados</TableCell></TableRow>
                ) : (
                  entityFindings.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-mono text-xs">{f.id}</TableCell>
                      <TableCell>{f.title}</TableCell>
                      <TableCell><StatusBadge label={f.severity} /></TableCell>
                      <TableCell><StatusBadge label={f.status} /></TableCell>
                      <TableCell className="font-mono text-xs">{f.dueDate}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="auditoria" className="mt-4">
          <Card className="p-6">
            <ul className="space-y-4">
              {[
                { date: "15/03/2026", actor: "D. Antonio Ríos Valverde", action: "Aprobó nuevo Reglamento del Comité de Riesgos" },
                { date: "10/03/2026", actor: "Dña. Lucía Paredes Vega", action: "Actualizó datos de Secretaría" },
                { date: "20/02/2026", actor: "Sistema", action: "Sincronización con Registro Mercantil" },
                { date: "01/01/2026", actor: "Dña. Lucía Paredes Vega", action: "Marcó la entidad como Materialidad Crítica" },
              ].map((e, i) => (
                <li key={i} className="flex items-start gap-4">
                  <div className="font-mono text-xs text-muted-foreground w-24 shrink-0">{e.date}</div>
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <div className="flex-1 text-sm">
                    <div className="text-foreground">{e.action}</div>
                    <div className="text-xs text-muted-foreground">por {e.actor}</div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{k}</dt>
      <dd className="mt-0.5 text-foreground">{v}</dd>
    </div>
  );
}
