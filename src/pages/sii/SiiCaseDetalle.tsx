import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import {
  useWhistleblowingReportById,
  useEmitAcknowledgment,
  useApproveExtension,
  useFormalizeRecusation,
  useUpdateSubcaseStatus,
  useCloseRootCase,
  useSendSafeInboxMessage,
} from "@/hooks/useWhistleblowing";
import {
  computeWhistleblowingDeadlines,
  validateCaseCloseoutGuard,
  SII_AVISO_EXPEDIENTE_SIMULADO,
  SII_ETIQUETA_SIMULADO,
  type WhistleblowingSubcase,
  type WhistleblowingRecusation,
} from "@/lib/sii/whistleblowing-engine";
import { siiRolesPara } from "@/lib/sii/roles-por-tenant";
import { useTenantContext } from "@/context/TenantContext";
import {
  ChevronRight,
  Lock,
  Eye,
  Clock,
  ShieldCheck,
  AlertTriangle,
  FileText,
  Send,
  UserCheck,
  Scale,
  ShieldAlert,
  FolderOpen,
  CheckCircle2,
  Share2,
  Users,
  Layers,
  ArrowUpRight,
  Gavel,
  History,
} from "lucide-react";

export default function SiiCaseDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { tenantId } = useTenantContext();
  // Mismo resolutor que usa el hook para estampar instructora y aprobador: la
  // causa de recusación nombraba la «Comisión Auditoría», órgano que Garrigues
  // no tiene.
  const roles = siiRolesPara(tenantId);
  const { data: report, isLoading } = useWhistleblowingReportById(id);

  // Mutations
  const ackMutation = useEmitAcknowledgment();
  const extMutation = useApproveExtension();
  const recMutation = useFormalizeRecusation();
  const subcaseMutation = useUpdateSubcaseStatus();
  const closeMutation = useCloseRootCase();
  const sendMsgMutation = useSendSafeInboxMessage();

  // Modal States
  const [showAckModal, setShowAckModal] = useState(false);
  const [showExtModal, setShowExtModal] = useState(false);
  const [extReason, setExtReason] = useState("");
  const [showRecusationModal, setShowRecusationModal] = useState(false);
  const [recReason, setRecReason] = useState<WhistleblowingRecusation["reason"]>("UNIDAD_DENUNCIADA");
  const [recDetails, setRecDetails] = useState("");
  const [recSubstitute, setRecSubstitute] = useState("D. Carlos Mendieta (Instructor Independiente)");
  
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeStatus, setCloseStatus] = useState<"RESUELTO_MEDIDAS" | "ARCHIVADO_MOTIVADO">("RESUELTO_MEDIDAS");
  const [closeReason, setCloseReason] = useState("");
  const [closeActions, setCloseActions] = useState("Investigación completada, entrevistas finalizadas y plan de remediación activado.");

  const [newChatMsg, setNewChatMsg] = useState("");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-20 text-[var(--t-text-secondary)]">
        Cargando expediente del Sistema Interno de Información...
      </div>
    );
  }

  if (!report) {
    return (
      <div className="mx-auto max-w-[800px] p-6 text-center">
        <Card className="p-8">
          <h2 className="text-base font-bold text-[var(--t-text-primary)]">Expediente no encontrado</h2>
          <p className="text-xs text-[var(--t-text-secondary)] mt-2">
            No se localiza el caso solicitado. Verifique la referencia.
          </p>
          <Button variant="outline" onClick={() => navigate("/sii")} className="mt-4">
            Volver al listado
          </Button>
        </Card>
      </div>
    );
  }

  const deadlines = computeWhistleblowingDeadlines(report.intakeDate, report.acknowledgmentSentDate, report.extensionApproved);
  const closeGuard = validateCaseCloseoutGuard(report);

  const handleEmitAck = async () => {
    try {
      await ackMutation.mutateAsync({ reportId: report.id });
      setShowAckModal(false);
      toast.success("Acuse de recibo formal emitido en plazo legal (Art. 9.2.c Ley 2/2023).");
    } catch (e) {
      toast.error("Error al emitir acuse.");
    }
  };

  const handleApproveExt = async () => {
    if (!extReason.trim()) {
      toast.error("Indique la motivación jurídica o técnica de la prórroga.");
      return;
    }
    try {
      await extMutation.mutateAsync({ reportId: report.id, reason: extReason.trim() });
      setShowExtModal(false);
      setExtReason("");
      toast.success("Prórroga motivada de 3 meses aprobada y notificada al informante.");
    } catch (e) {
      toast.error("Error al aprobar prórroga.");
    }
  };

  const handleFormalizeRecusation = async () => {
    if (!recDetails.trim() || !recSubstitute.trim()) {
      toast.error("Complete los fundamentos y el instructor sustituto.");
      return;
    }
    try {
      await recMutation.mutateAsync({
        reportId: report.id,
        reason: recReason,
        details: recDetails.trim(),
        substitutedByName: recSubstitute.trim(),
      });
      setShowRecusationModal(false);
      toast.success("Recusación formalizada. Nuevo instructor asignado.");
    } catch (e) {
      toast.error("Error al formalizar recusación.");
    }
  };

  const handleSendInternalMsg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChatMsg.trim()) return;
    try {
      await sendMsgMutation.mutateAsync({
        reportId: report.id,
        content: newChatMsg.trim(),
        sender: "INSTRUCTOR",
      });
      setNewChatMsg("");
      toast.success("Mensaje transmitido al Safe Inbox del informante.");
    } catch (e) {
      toast.error("Error al enviar mensaje.");
    }
  };

  const handleCloseCase = async () => {
    if (!closeReason.trim()) {
      toast.error("Indique el fundamento del cierre.");
      return;
    }
    try {
      await closeMutation.mutateAsync({
        reportId: report.id,
        status: closeStatus,
        closingReason: closeReason.trim(),
        actionsTaken: [closeActions],
      });
      setShowCloseModal(false);
      toast.success("Expediente raíz cerrado y registrado en el Libro-Registro oficial.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
    }
  };

  return (
    <div className="mx-auto max-w-[1440px] p-6 space-y-6 animate-fade-in">
      {/* Breadcrumb & Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <nav className="flex items-center gap-1 text-xs text-[var(--t-text-secondary)]">
          <Link to="/sii" className="hover:text-[var(--t-text-primary)]">SII — Canal Interno</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="font-mono font-bold text-[var(--t-text-primary)]">{report.code}</span>
        </nav>

        <div className="flex items-center gap-2">
          {!report.acknowledgmentSentDate && (
            <Button
              size="sm"
              onClick={() => setShowAckModal(true)}
              className="bg-[var(--t-brand)] text-white hover:bg-[var(--t-brand)]/90 text-xs"
            >
              Emitir Acuse (7 días)
            </Button>
          )}

          {!report.extensionApproved && report.status !== "RESUELTO_MEDIDAS" && report.status !== "ARCHIVADO_MOTIVADO" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowExtModal(true)}
              className="text-xs text-[var(--t-text-primary)]"
            >
              Aprobar Prórroga Motivada
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowRecusationModal(true)}
            className="text-xs text-[var(--status-warning)] border-[var(--status-warning)] hover:bg-[var(--status-warning)]/10"
          >
            Gestionar Conflicto / Recusación
          </Button>

          {report.status !== "RESUELTO_MEDIDAS" && report.status !== "ARCHIVADO_MOTIVADO" && (
            <Button
              size="sm"
              onClick={() => setShowCloseModal(true)}
              className="bg-[var(--status-success)] text-white hover:bg-[var(--status-success)]/90 text-xs"
            >
              Cerrar Expediente Raíz
            </Button>
          )}
        </div>
      </div>

      {/* Header Principal del Caso */}
      <Card className="border-[var(--t-border-default)] bg-[var(--t-surface-card)] p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-[var(--t-brand)] bg-[var(--t-surface-subtle)] px-2 py-0.5 rounded border border-[var(--t-border-default)]">
                {report.code}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--t-surface-muted)] text-[var(--t-text-primary)] border border-[var(--t-border-default)]">
                {report.anonymityMode === "ANONIMO_ESTRICTO" ? "Anónimo Estricto" : "Confidencial"}
              </span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${report.severity === "MUY_GRAVE" || report.severity === "DELITO_FLAGRANTE" ? "bg-[var(--status-error)] text-white" : "bg-[var(--status-warning)] text-white"}`}>
                {report.severity}
              </span>
              {report.firmeza === "DEMO_PILOTO" && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--status-warning)]/10 text-[var(--status-warning)] border border-[var(--status-warning)]">
                  {SII_ETIQUETA_SIMULADO}
                </span>
              )}
            </div>
            {report.firmeza === "DEMO_PILOTO" && (
              <p className="text-[11px] leading-relaxed text-[var(--status-warning)]">
                {SII_AVISO_EXPEDIENTE_SIMULADO}
              </p>
            )}
            <h1 className="text-xl font-bold text-[var(--t-text-primary)] mt-1">
              {report.category} — {report.entityName}
            </h1>
            <p className="text-xs text-[var(--t-text-secondary)]">
              Recibido el {new Date(report.intakeDate).toLocaleDateString("es-ES")} vía {report.channel} · Instructora: <strong>{report.assignedInvestigatorName}</strong>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-3 bg-[var(--t-surface-subtle)] rounded-lg border border-[var(--t-border-default)] text-right text-xs">
              <span className="text-[10px] uppercase font-bold text-[var(--t-text-secondary)] block">Estado del Caso:</span>
              <span className="font-bold text-sm text-[var(--t-brand)]">{report.status.replace(/_/g, " ")}</span>
            </div>
          </div>
        </div>

        {/* Relojes y Plazos Estatutarios */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border-t border-[var(--t-border-default)] pt-4 text-xs">
          <div className="p-3 bg-[var(--t-surface-card)] border border-[var(--t-border-default)] rounded">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-[var(--t-text-secondary)]">Acuse de Recibo (7d)</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${report.acknowledgmentSentDate ? "bg-[var(--status-success)]/10 text-[var(--status-success)]" : deadlines.ackIsOverdue ? "bg-[var(--status-error)]/10 text-[var(--status-error)]" : "bg-[var(--status-warning)]/10 text-[var(--status-warning)]"}`}>
                {report.acknowledgmentSentDate ? "Cumplido" : `${deadlines.ackDaysRemaining} días restantes`}
              </span>
            </div>
            <span className="text-[11px] text-[var(--t-text-secondary)]">
              {report.acknowledgmentSentDate ? `Emitido: ${new Date(report.acknowledgmentSentDate).toLocaleDateString("es-ES")}` : `Límite: ${deadlines.ackDeadline7d.toLocaleDateString("es-ES")}`}
            </span>
          </div>

          <div className="p-3 bg-[var(--t-surface-card)] border border-[var(--t-border-default)] rounded">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-[var(--t-text-secondary)]">Resolución Ordinaria (3m)</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[var(--status-success)]/10 text-[var(--status-success)]">
                {deadlines.resolutionDaysRemaining} días restantes
              </span>
            </div>
            <span className="text-[11px] text-[var(--t-text-secondary)]">
              Vencimiento: {new Date(report.resolutionDeadline).toLocaleDateString("es-ES")}
            </span>
          </div>

          <div className="p-3 bg-[var(--t-surface-card)] border border-[var(--t-border-default)] rounded">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-[var(--t-text-secondary)]">Prórroga de Complejidad (+3m)</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${report.extensionApproved ? "bg-[var(--status-warning)]/10 text-[var(--status-warning)]" : "bg-[var(--t-surface-muted)] text-[var(--t-text-secondary)]"}`}>
                {report.extensionApproved ? "Activa" : "No solicitada"}
              </span>
            </div>
            <span className="text-[11px] text-[var(--t-text-secondary)]">
              {report.extensionApproved ? `Límite máx: ${deadlines.maxExtendedDeadline6m.toLocaleDateString("es-ES")}` : "Disponible hasta 6 meses total"}
            </span>
          </div>
        </div>
      </Card>

      {/* Tabs de Gestión del Caso */}
      <Tabs defaultValue="subcases" className="space-y-4">
        <TabsList className="bg-[var(--t-surface-subtle)] border border-[var(--t-border-default)] p-1">
          <TabsTrigger value="subcases" className="text-xs gap-1.5">
            <Layers className="h-3.5 w-3.5" /> Subexpedientes Autónomos ({report.subcases.length})
          </TabsTrigger>
          <TabsTrigger value="hechos" className="text-xs gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Hechos y Diligencias
          </TabsTrigger>
          <TabsTrigger value="safe-inbox" className="text-xs gap-1.5">
            <Lock className="h-3.5 w-3.5" /> Safe Inbox Informante ({report.messages.length})
          </TabsTrigger>
          <TabsTrigger value="evidencias" className="text-xs gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" /> Evidencias ({report.evidences.length})
          </TabsTrigger>
          <TabsTrigger value="retaliation" className="text-xs gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5" /> Protección Anti-Represalias
          </TabsTrigger>
          <TabsTrigger value="libro-registro" className="text-xs gap-1.5">
            <Gavel className="h-3.5 w-3.5" /> Asiento Libro-Registro (Art. 26)
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Subexpedientes Autónomos (Patrón Harvey) */}
        <TabsContent value="subcases">
          <div className="space-y-4">
            <div className="p-4 bg-[var(--t-surface-subtle)] border border-[var(--t-border-default)] rounded text-xs text-[var(--t-text-secondary)] leading-relaxed">
              <div className="font-bold text-[var(--t-brand)] mb-1">
                Arquitectura de Subexpedientes Autónomos por Régimen Regulatorio
              </div>
              Una misma denuncia raíz genera subexpedientes independientes con autoridades, plazos y responsables separados. El cierre del expediente general queda estrictamente bloqueado hasta que cada subexpediente sea resuelto o transferido a un plan de remediación.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {report.subcases.map((sub) => (
                <Card key={sub.id} className="border-[var(--t-border-default)] bg-[var(--t-surface-card)] p-5 space-y-3 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-[10px] font-bold text-[var(--t-brand)] block uppercase">
                        {sub.regime}
                      </span>
                      <h3 className="font-bold text-sm text-[var(--t-text-primary)] mt-0.5">
                        {sub.label}
                      </h3>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${sub.status === "CERRADO" ? "bg-[var(--status-success)]/10 text-[var(--status-success)]" : "bg-[var(--status-warning)]/10 text-[var(--status-warning)]"}`}>
                      {sub.status}
                    </span>
                  </div>

                  <div className="space-y-1.5 border-t border-[var(--t-border-default)] pt-2 text-[11px]">
                    <div><span className="text-[var(--t-text-secondary)]">Autoridad Destinataria:</span> <strong>{sub.authorityTarget}</strong></div>
                    <div><span className="text-[var(--t-text-secondary)]">Responsable Asignado:</span> <strong>{sub.ownerName} ({sub.ownerRole})</strong></div>
                    <div><span className="text-[var(--t-text-secondary)]">Fecha Apertura:</span> {new Date(sub.createdAt).toLocaleDateString("es-ES")}</div>
                    {sub.closedAt && (
                      <div><span className="text-[var(--t-text-secondary)]">Fecha Cierre:</span> {new Date(sub.closedAt).toLocaleDateString("es-ES")}</div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 border-t border-[var(--t-border-default)] pt-3">
                    {sub.status !== "CERRADO" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          await subcaseMutation.mutateAsync({
                            reportId: report.id,
                            subcaseId: sub.id,
                            status: "CERRADO",
                            closingReason: "Instrucción finalizada conforme a protocolo sectorial.",
                          });
                          toast.success(`Subexpediente ${sub.regime} cerrado con éxito.`);
                        }}
                        className="text-[11px] h-7"
                      >
                        Cerrar Subexpediente
                      </Button>
                    )}
                    {sub.status !== "TRANSFERIDO_REMEDIACION" && sub.status !== "CERRADO" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          await subcaseMutation.mutateAsync({
                            reportId: report.id,
                            subcaseId: sub.id,
                            status: "TRANSFERIDO_REMEDIACION",
                            remediationPlanId: "PLAN-REM-2026-01",
                          });
                          toast.success(`Subexpediente ${sub.regime} transferido a Plan de Remediación.`);
                        }}
                        className="text-[11px] h-7"
                      >
                        Transferir a Remediación
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: Hechos y Diligencias */}
        <TabsContent value="hechos">
          <Card className="border-[var(--t-border-default)] bg-[var(--t-surface-card)] p-6 space-y-4 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-[var(--t-text-secondary)] block">Resumen Inicial:</span>
              <p className="text-sm font-semibold text-[var(--t-text-primary)] mt-1">{report.summary}</p>
            </div>

            <div className="border-t border-[var(--t-border-default)] pt-3">
              <span className="text-[10px] uppercase font-bold text-[var(--t-text-secondary)] block">Descripción Detallada:</span>
              <p className="text-[var(--t-text-primary)] mt-1 leading-relaxed whitespace-pre-wrap">{report.detailedDescription}</p>
            </div>

            {/* Recusaciones registradas */}
            {report.recusations.length > 0 && (
              <div className="border-t border-[var(--t-border-default)] pt-3 space-y-2">
                <span className="text-[10px] uppercase font-bold text-[var(--status-warning)] block">
                  Historial de Recusaciones e Incompatibilidades
                </span>
                {report.recusations.map((rec) => (
                  <div key={rec.id} className="p-3 bg-[var(--status-warning)]/10 border border-[var(--status-warning)] rounded space-y-1">
                    <div className="font-bold text-[var(--t-text-primary)]">
                      Recusación de {rec.investigatorName} → Sustituido por {rec.substitutedByName}
                    </div>
                    <p className="text-[11px] text-[var(--t-text-secondary)]">{rec.details}</p>
                    <div className="text-[10px] text-[var(--t-text-secondary)]">Fecha: {new Date(rec.recusedAt).toLocaleString("es-ES")} · Aprobado por: {rec.approvedBy}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* TAB 3: Safe Inbox Interno */}
        <TabsContent value="safe-inbox">
          <Card className="border-[var(--t-border-default)] bg-[var(--t-surface-card)] flex flex-col h-[500px] overflow-hidden">
            <div className="p-4 border-b border-[var(--t-border-default)] bg-[var(--t-surface-subtle)] flex items-center justify-between text-xs">
              <div className="font-bold text-[var(--t-text-primary)]">
                Buzón Bidireccional con el Informante (Token: {report.trackingToken})
              </div>
              <span className="text-[10px] font-mono text-[var(--t-text-secondary)]">Entorno de validación funcional — sin cifrado de transporte propio</span>
            </div>

            <div className="flex-1 p-5 overflow-y-auto space-y-3 text-xs">
              {report.messages.map((m) => {
                const isInvestigator = m.sender === "INSTRUCTOR";
                return (
                  <div key={m.id} className={`flex flex-col ${isInvestigator ? "items-end" : "items-start"}`}>
                    <span className="text-[10px] text-[var(--t-text-secondary)] mb-0.5">
                      {m.senderAlias ?? m.sender} · {new Date(m.sentAt).toLocaleString("es-ES")}
                    </span>
                    <div className={`p-3 rounded-lg max-w-[80%] leading-relaxed ${isInvestigator ? "bg-[var(--t-brand)] text-white" : "bg-[var(--t-surface-subtle)] text-[var(--t-text-primary)] border border-[var(--t-border-default)]"}`}>
                      {m.content}
                    </div>
                  </div>
                );
              })}
            </div>

            <form onSubmit={handleSendInternalMsg} className="p-4 border-t border-[var(--t-border-default)] flex gap-2">
              <input
                type="text"
                value={newChatMsg}
                onChange={(e) => setNewChatMsg(e.target.value)}
                placeholder="Escriba un mensaje formal o requerimiento de información al informante..."
                className="flex-1 px-3 py-2 border border-[var(--t-border-default)] rounded text-xs bg-[var(--t-surface-card)] text-[var(--t-text-primary)]"
              />
              <Button type="submit" size="sm" className="bg-[var(--t-brand)] text-white">
                Enviar al Safe Inbox
              </Button>
            </form>
          </Card>
        </TabsContent>

        {/* TAB 4: Evidencias aportadas */}
        <TabsContent value="evidencias">
          <Card className="border-[var(--t-border-default)] bg-[var(--t-surface-card)] overflow-hidden">
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="bg-[var(--t-surface-subtle)]">
                  <TableHead className="font-bold">ID / Título</TableHead>
                  <TableHead className="font-bold">Tipo</TableHead>
                  <TableHead className="font-bold">Referencia interna</TableHead>
                  <TableHead className="font-bold">Postura probatoria</TableHead>
                  <TableHead className="font-bold">Confidencialidad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.evidences.map((ev) => (
                  <TableRow key={ev.id}>
                    <TableCell className="font-medium text-[var(--t-text-primary)]">
                      {ev.title}
                    </TableCell>
                    <TableCell>{ev.type}</TableCell>
                    <TableCell className="font-mono text-[10px] text-[var(--t-text-secondary)]">
                      {(ev.referenciaInterna ?? "").substring(0, 16)}…
                    </TableCell>
                    <TableCell>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--g-surface-muted)] text-[var(--t-text-secondary)] border border-[var(--t-border-default)] w-fit">
                        Sin sello cualificado
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--status-warning)]/10 text-[var(--status-warning)]">
                        {ev.confidentiality}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* TAB 5: Protección Anti-Represalias */}
        <TabsContent value="retaliation">
          <Card className="border-[var(--t-border-default)] bg-[var(--t-surface-card)] p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-[var(--status-warning)]" />
                <h3 className="font-bold text-sm text-[var(--t-text-primary)]">
                  Protocolo de Protección Frente a Represalias (Ley 2/2023 Título VII)
                </h3>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full font-bold text-xs ${report.retaliationRecord?.riskLevel === "CRITICO" ? "bg-[var(--status-error)] text-white" : "bg-[var(--status-warning)] text-white"}`}>
                Nivel de Riesgo: {report.retaliationRecord?.riskLevel ?? "BAJO"}
              </span>
            </div>

            <div className="space-y-2 border-t border-[var(--t-border-default)] pt-3">
              <span className="text-[10px] uppercase font-bold text-[var(--t-text-secondary)] block">Medidas Cautelares Activas:</span>
              <ul className="list-disc pl-4 space-y-1 text-[var(--t-text-primary)]">
                {(report.retaliationRecord?.preventiveMeasuresActive ?? [
                  "Preservación estricta del anonimato en Safe Inbox",
                ]).map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>

            <div className="border-t border-[var(--t-border-default)] pt-3 text-[11px] text-[var(--t-text-secondary)]">
              Frecuencia de seguimiento: <strong>{report.retaliationRecord?.monitoringSchedule ?? "TRIMESTRAL"}</strong> · Incidentes reportados: <strong>{report.retaliationRecord?.incidentsReported ?? 0}</strong>
            </div>
          </Card>
        </TabsContent>

        {/* TAB 6: Libro-Registro Oficial */}
        <TabsContent value="libro-registro">
          <Card className="border-[var(--t-border-default)] bg-[var(--t-surface-card)] p-6 space-y-4 text-xs font-mono">
            <div className="border-b border-[var(--t-border-default)] pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[var(--t-brand)]">
                <Gavel className="h-5 w-5" />
                <span className="font-bold text-sm">Asiento del Libro-Registro Oficial (Art. 26 Ley 2/2023)</span>
              </div>
              <span className="text-[10px] bg-[var(--t-surface-subtle)] px-2 py-0.5 rounded">
                Retención máx: 10 años
              </span>
            </div>

            <div className="space-y-2 text-[11px] text-[var(--t-text-primary)]">
              <div><strong>Nº Registro:</strong> REG-SII-{report.code.replace("SII-", "")}</div>
              <div><strong>Código de Expediente:</strong> {report.code}</div>
              <div><strong>Fecha de Entrada:</strong> {new Date(report.intakeDate).toISOString()}</div>
              <div><strong>Canal de Recepción:</strong> {report.channel}</div>
              <div><strong>Materia:</strong> {report.category}</div>
              <div><strong>Investigadora Responsable:</strong> {report.assignedInvestigatorName}</div>
              <div><strong>Postura probatoria:</strong> entorno de validación funcional — sin eficacia jurídica cualificada productiva</div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal Acuse de Recibo */}
      {showAckModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <Card className="p-6 max-w-md w-full space-y-4 border-[var(--t-brand)]">
            <h3 className="font-bold text-sm text-[var(--t-text-primary)]">Emitir Acuse de Recibo Oficial (7 Días)</h3>
            <p className="text-xs text-[var(--t-text-secondary)] leading-relaxed">
              Se emitirá el acuse formal acreditando la recepción de la comunicación y el inicio de las diligencias previas conforme al Art. 9.2.c de la Ley 2/2023.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowAckModal(false)}>Cancelar</Button>
              <Button onClick={handleEmitAck} className="bg-[var(--t-brand)] text-white">Emitir y Notificar</Button>
            </div>
          </Card>
        </div>
      )}

      {/* Modal Prórroga Motivada */}
      {showExtModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <Card className="p-6 max-w-lg w-full space-y-4 border-[var(--status-warning)]">
            <h3 className="font-bold text-sm text-[var(--t-text-primary)]">Aprobar Prórroga Motivada (3 Meses Adicionales)</h3>
            <p className="text-xs text-[var(--t-text-secondary)] leading-relaxed">
              Conforme al Art. 9.2.d de la Ley 2/2023, el plazo de 3 meses podrá prorrogarse hasta un máximo de otros 3 meses adicionales en casos de especial complejidad.
            </p>
            <div>
              <label className="block text-xs font-bold uppercase text-[var(--t-text-secondary)] mb-1">
                Motivación jurídica/técnica de la complejidad:
              </label>
              <textarea
                rows={3}
                value={extReason}
                onChange={(e) => setExtReason(e.target.value)}
                placeholder="Ej. Diligencias periciales informáticas complejas y solicitud de información internacional a filial."
                className="w-full px-3 py-2 border border-[var(--t-border-default)] rounded text-xs"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowExtModal(false)}>Cancelar</Button>
              <Button onClick={handleApproveExt} className="bg-[var(--status-warning)] text-white">Aprobar Prórroga</Button>
            </div>
          </Card>
        </div>
      )}

      {/* Modal Recusación */}
      {showRecusationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <Card className="p-6 max-w-lg w-full space-y-4 border-[var(--status-warning)]">
            <h3 className="font-bold text-sm text-[var(--t-text-primary)]">Formalizar Recusación e Incompatibilidad del Instructor</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold uppercase text-[var(--t-text-secondary)] mb-1">Causa de Recusación:</label>
                <select
                  value={recReason}
                  onChange={(e) => setRecReason(e.target.value as WhistleblowingRecusation["reason"])}
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="UNIDAD_DENUNCIADA">Pertenencia a la misma unidad o departamento investigado</option>
                  <option value="RELACION_JERARQUICA">Relación jerárquica con las personas afectadas</option>
                  <option value="INTERVENCION_PREVIA">Intervención previa en la operación objeto de comunicación</option>
                  <option value="BENEFICIO_DIRECTO">Interés personal o beneficio directo en el resultado</option>
                  <option value="CONSEJO_ALTA_DIRECCION">{roles.causaCupulaLabel}</option>
                </select>
              </div>

              <div>
                <label className="block font-bold uppercase text-[var(--t-text-secondary)] mb-1">Fundamentos del Conflicto:</label>
                <textarea
                  rows={2}
                  value={recDetails}
                  onChange={(e) => setRecDetails(e.target.value)}
                  placeholder="Detalle los motivos que comprometen la imparcialidad del instructor actual..."
                  className="w-full px-3 py-2 border rounded"
                />
              </div>

              <div>
                <label className="block font-bold uppercase text-[var(--t-text-secondary)] mb-1">Instructor Sustituto Designado:</label>
                <input
                  type="text"
                  value={recSubstitute}
                  onChange={(e) => setRecSubstitute(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowRecusationModal(false)}>Cancelar</Button>
              <Button onClick={handleFormalizeRecusation} className="bg-[var(--status-warning)] text-white">Formalizar Sustitución</Button>
            </div>
          </Card>
        </div>
      )}

      {/* Modal Cierre con Guardrail Bloqueante */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <Card className="p-6 max-w-lg w-full space-y-4 border-[var(--status-success)]">
            <h3 className="font-bold text-sm text-[var(--t-text-primary)]">Cierre del Expediente Raíz (Ley 2/2023)</h3>
            
            {!closeGuard.canClose ? (
              <div className="p-4 bg-[var(--status-error)]/10 border border-[var(--status-error)] rounded text-xs text-[var(--status-error)] space-y-2">
                <div className="font-bold flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4 shrink-0" /> Cierre Bloqueado por Requisitos Pendientes:
                </div>
                <ul className="list-disc pl-4 space-y-1">
                  {closeGuard.blockingReasons.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <p className="text-[var(--t-text-secondary)]">
                  Todos los subexpedientes autónomos han sido resueltos. Indique la resolución formal para generar el asiento oficial en el Libro-Registro.
                </p>
                <div>
                  <label className="block font-bold uppercase text-[var(--t-text-secondary)] mb-1">Resultado Final:</label>
                  <select
                    value={closeStatus}
                    onChange={(e) => setCloseStatus(e.target.value as "RESUELTO_MEDIDAS" | "ARCHIVADO_MOTIVADO")}
                    className="w-full px-3 py-2 border rounded"
                  >
                    <option value="RESUELTO_MEDIDAS">Resuelto con Medidas y Plan de Acción</option>
                    <option value="ARCHIVADO_MOTIVADO">Archivado Motivado (Inadmisibilidad / Carencia de Prueba)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold uppercase text-[var(--t-text-secondary)] mb-1">Fundamento del Cierre:</label>
                  <textarea
                    rows={3}
                    value={closeReason}
                    onChange={(e) => setCloseReason(e.target.value)}
                    placeholder="Detalle la motivación de la resolución final del expediente..."
                    className="w-full px-3 py-2 border rounded"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowCloseModal(false)}>Cancelar</Button>
              <Button
                onClick={handleCloseCase}
                disabled={!closeGuard.canClose || closeMutation.isPending}
                className="bg-[var(--status-success)] text-white"
              >
                Confirmar y Asentar en Libro-Registro
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
