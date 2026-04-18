import { Link, useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { StatusBadgeTip } from "@/components/StatusBadgeTip";
import {
  useEntityBySlug,
  useEntityChildren,
  useEntityParent,
  useEntityBodies,
  useAllPolicies,
  useEntityDelegations,
  useEntityFindings,
  formatJurisdiction,
  formatMateriality,
  formatEntityStatus,
} from "@/hooks/useEntities";
import { Brain, ChevronRight, Download, Edit3, ExternalLink, Network } from "lucide-react";
import { useAiSystemsList } from "@/hooks/useAiSystems";

const matTone = (m: string): "critical" | "warning" | "info" | "neutral" => {
  const l = formatMateriality(m);
  return l === "Crítica" ? "critical" : l === "Alta" ? "warning" : l === "Media" ? "info" : "neutral";
};

export default function EntidadDetalle() {
  const { id } = useParams();
  const { data: entity, isLoading } = useEntityBySlug(id);
  const { data: children = [] } = useEntityChildren(entity?.id);
  const { data: parent } = useEntityParent(entity?.parent_entity_id);
  const { data: bodies = [] } = useEntityBodies(entity?.id);
  const { data: policies = [] } = useAllPolicies();
  const { data: delegations = [] } = useEntityDelegations(entity?.id);
  const { data: entityFindings = [] } = useEntityFindings(entity?.id);
  const { data: allAiSystems = [] } = useAiSystemsList();

  if (isLoading) {
    return <div className="p-10 text-center text-muted-foreground">Cargando…</div>;
  }

  if (!entity) {
    return (
      <div className="p-10 text-center text-muted-foreground">
        Entidad no encontrada. <Link to="/entidades" className="text-primary underline">Volver al listado</Link>
      </div>
    );
  }

  const materialityLabel = formatMateriality(entity.materiality);
  const statusLabel = formatEntityStatus(entity.entity_status);

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      {/* Breadcrumb */}
      <nav className="mb-3 flex items-center gap-1 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-foreground">Inicio</Link>
        <ChevronRight className="h-3 w-3" />
        <Link to="/entidades" className="hover:text-foreground">Entidades</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">{entity.legal_name}</span>
      </nav>

      {/* Object header */}
      <Card className="p-6 tour-target" data-tour="entity-header">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <StatusBadgeTip label={statusLabel} />
              <StatusBadgeTip label={materialityLabel} tone={matTone(entity.materiality)} />
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{entity.legal_name}</h1>
            <div className="mt-1 text-sm text-muted-foreground">
              {formatJurisdiction(entity.jurisdiction)} · <span className="font-mono text-xs">{entity.registration_number ?? "—"}</span>
            </div>
            <div className="mt-3 text-sm">
              Forma legal: <span className="font-medium text-foreground">{entity.legal_form ?? "—"}</span>
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
        <TabsList className="grid w-full max-w-4xl grid-cols-7">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="relaciones">Relaciones</TabsTrigger>
          <TabsTrigger value="normativa">Normativa</TabsTrigger>
          <TabsTrigger value="delegaciones">Delegaciones</TabsTrigger>
          <TabsTrigger value="hallazgos">Hallazgos</TabsTrigger>
          <TabsTrigger value="auditoria">Auditoría</TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center gap-1">
            <Brain className="h-3.5 w-3.5" />AI Gov
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="mt-4">
          <Card className="p-6">
            <dl className="grid grid-cols-2 gap-x-12 gap-y-4 text-sm">
              <Field k="Denominación legal" v={entity.legal_name} />
              <Field k="Nombre común" v={entity.common_name} />
              <Field k="Jurisdicción" v={formatJurisdiction(entity.jurisdiction)} />
              <Field k="Forma legal" v={entity.legal_form ?? "—"} />
              <Field k="Nº registro" v={<span className="font-mono text-xs">{entity.registration_number ?? "—"}</span>} />
              <Field k="Entidad matriz" v={parent ? <Link to={`/entidades/${parent.slug}`} className="text-primary hover:underline">{parent.common_name}</Link> : "— (top-level)"} />
              <Field k="% Participación" v={entity.ownership_percentage != null ? `${entity.ownership_percentage}%` : "—"} />
              <Field k="Materialidad" v={materialityLabel} />
              <Field k="Estado" v={statusLabel} />
              <Field k="Slug" v={<span className="font-mono text-xs">{entity.slug}</span>} />
              <div className="col-span-2">
                <Field k="Órganos vinculados" v={
                  bodies.length === 0
                    ? "—"
                    : (
                        <div className="flex flex-wrap gap-2">
                          {bodies.map((b) => (
                            <Link
                              key={b.id}
                              to={`/organos/${b.slug}`}
                              className="rounded-md border border-border bg-accent/40 px-2 py-1 text-xs text-foreground hover:bg-accent"
                            >
                              {b.name}
                            </Link>
                          ))}
                        </div>
                      )
                } />
              </div>
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
                {children.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">Sin filiales directas</TableCell></TableRow>
                ) : children.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell><Link to={`/entidades/${c.slug}`} className="font-medium text-foreground hover:text-primary hover:underline">{c.legal_name}</Link></TableCell>
                    <TableCell>{formatJurisdiction(c.jurisdiction)}</TableCell>
                    <TableCell>{c.ownership_percentage != null ? `${c.ownership_percentage}%` : "—"}</TableCell>
                    <TableCell><StatusBadge label={formatMateriality(c.materiality)} tone={matTone(c.materiality)} /></TableCell>
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
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.policy_code}</TableCell>
                    <TableCell>{p.title}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.owner_function ?? "—"}</TableCell>
                    <TableCell><StatusBadge label={p.status} /></TableCell>
                    <TableCell className="font-mono text-xs">{p.next_review_date ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="delegaciones" className="mt-4">
          <Card>
            <div className="border-b border-border px-5 py-3 text-sm font-semibold">Delegaciones ({delegations.length})</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Código</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Inicio</TableHead>
                  <TableHead>Fin</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {delegations.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">Sin delegaciones asociadas</TableCell></TableRow>
                ) : delegations.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-xs">
                      <Link to={`/delegaciones/${d.slug}`} className="text-primary hover:underline">{d.code}</Link>
                    </TableCell>
                    <TableCell>{d.delegation_type}</TableCell>
                    <TableCell className="font-mono text-xs">{d.start_date ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{d.end_date ?? "—"}</TableCell>
                    <TableCell><StatusBadge label={d.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="hallazgos" className="mt-4">
          <Card>
            <div className="border-b border-border px-5 py-3 text-sm font-semibold">Hallazgos vinculados ({entityFindings.length})</div>
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
                ) : entityFindings.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-mono text-xs">
                      <Link to={`/hallazgos/${f.code}`} className="text-primary hover:underline">{f.code}</Link>
                    </TableCell>
                    <TableCell>{f.title}</TableCell>
                    <TableCell><StatusBadge label={f.severity} /></TableCell>
                    <TableCell><StatusBadge label={f.status} /></TableCell>
                    <TableCell className="font-mono text-xs">{f.due_date ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="auditoria" className="mt-4">
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Trazabilidad de cambios — pendiente de habilitar.
          </Card>
        </TabsContent>

        <TabsContent value="ai" className="mt-4">
          <Card className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Sistemas IA de esta entidad</h3>
              <Link to="/ai-governance/sistemas" className="ml-auto text-xs text-primary hover:underline flex items-center gap-1">
                <ExternalLink className="h-3 w-3" />Ver inventario completo
              </Link>
            </div>
            {allAiSystems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Brain className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No hay sistemas IA registrados en el inventario.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sistema</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Riesgo EU AI Act</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Ficha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allAiSystems.map((sys) => (
                    <TableRow key={sys.id}>
                      <TableCell>
                        <div className="font-medium text-sm text-foreground">{sys.name}</div>
                        <div className="text-xs text-muted-foreground">{sys.use_case}</div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{sys.system_type ?? "—"}</TableCell>
                      <TableCell>
                        {sys.risk_level && (
                          <StatusBadge
                            label={sys.risk_level}
                            tone={
                              sys.risk_level === "Alto" || sys.risk_level === "Inaceptable"
                                ? "critical"
                                : sys.risk_level === "Limitado"
                                ? "warning"
                                : "active"
                            }
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{sys.vendor ?? "—"}</TableCell>
                      <TableCell>
                        <StatusBadge
                          label={sys.status}
                          tone={sys.status === "ACTIVO" ? "active" : sys.status === "EN_EVALUACION" ? "warning" : "neutral"}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          to={`/ai-governance/sistemas/${sys.id}`}
                          className="text-xs text-primary hover:underline flex items-center justify-end gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />Ver
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
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
