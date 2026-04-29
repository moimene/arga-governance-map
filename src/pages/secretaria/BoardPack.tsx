import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  TrendingUp,
  AlertCircle,
  Shield,
  Briefcase,
  Users,
  Calendar,
  Printer,
  Building2,
} from "lucide-react";
import { useBoardPackData, type BoardPackData } from "@/hooks/useBoardPackData";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useTenantContext } from "@/context/TenantContext";
import { useSecretariaScope } from "@/components/secretaria/shell";

// ─── KPI Card ───────────────────────────────────────────────────────────────

interface KPICardProps {
  icon: React.ElementType;
  label: string;
  value: number | string;
  variant?: "default" | "warning" | "danger";
}

function KPICard({ icon: Icon, label, value, variant = "default" }: KPICardProps) {
  const bgClass = {
    default: "bg-[var(--g-surface-subtle)]",
    warning: "bg-[var(--status-warning)]/10",
    danger: "bg-[var(--status-error)]/10",
  }[variant];

  const textClass = {
    default: "text-[var(--g-text-primary)]",
    warning: "text-[var(--status-warning)]",
    danger: "text-[var(--status-error)]",
  }[variant];

  return (
    <div className={cn("rounded-lg border border-[var(--g-border-subtle)] p-4", bgClass)}>
      <div className="flex items-start gap-3">
        <Icon className={cn("h-5 w-5 mt-0.5", textClass)} />
        <div className="flex-1">
          <p className="text-xs font-medium text-[var(--g-text-secondary)]">{label}</p>
          <p className={cn("mt-1 text-2xl font-bold", textClass)}>{value}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Agreement Badge ─────────────────────────────────────────────────────────

interface AgreementBadgeProps {
  status: string;
}

function AgreementBadge({ status }: AgreementBadgeProps) {
  const variants: Record<string, { bg: string; text: string; label: string }> = {
    DRAFT: { bg: "bg-[var(--status-info)]/10", text: "text-[var(--status-info)]", label: "Borrador" },
    PROPOSED: { bg: "bg-[var(--status-warning)]/10", text: "text-[var(--status-warning)]", label: "Propuesto" },
    ADOPTED: { bg: "bg-[var(--status-success)]/10", text: "text-[var(--status-success)]", label: "Adoptado" },
    CERTIFIED: { bg: "bg-[var(--status-success)]/10", text: "text-[var(--status-success)]", label: "Certificado" },
    INSTRUMENTED: { bg: "bg-[var(--status-success)]/10", text: "text-[var(--status-success)]", label: "Instrumentado" },
    FILED: { bg: "bg-[var(--g-surface-subtle)]", text: "text-[var(--g-text-secondary)]", label: "Presentado" },
    PUBLISHED: { bg: "bg-[var(--g-surface-subtle)]", text: "text-[var(--g-text-secondary)]", label: "Publicado" },
  };

  const variant = variants[status] || {
    bg: "bg-[var(--g-surface-subtle)]",
    text: "text-[var(--g-text-secondary)]",
    label: status,
  };

  return (
    <span className={cn("inline-block px-2 py-1 rounded text-xs font-medium", variant.bg, variant.text)}>
      {variant.label}
    </span>
  );
}

// ─── Finding Severity Badge ─────────────────────────────────────────────────

interface FindingSeverityBadgeProps {
  severity: string;
}

function FindingSeverityBadge({ severity }: FindingSeverityBadgeProps) {
  const variants: Record<string, { bg: string; text: string; label: string }> = {
    CRITICO: { bg: "bg-[var(--status-error)]/10", text: "text-[var(--status-error)]", label: "Crítico" },
    ALTO: { bg: "bg-[var(--status-warning)]/10", text: "text-[var(--status-warning)]", label: "Alto" },
    MEDIO: { bg: "bg-[var(--status-info)]/10", text: "text-[var(--status-info)]", label: "Medio" },
    BAJO: { bg: "bg-[var(--status-success)]/10", text: "text-[var(--status-success)]", label: "Bajo" },
  };

  const variant = variants[severity] || {
    bg: "bg-[var(--g-surface-subtle)]",
    text: "text-[var(--g-text-secondary)]",
    label: severity,
  };

  return (
    <span className={cn("inline-block px-2 py-1 rounded text-xs font-medium", variant.bg, variant.text)}>
      {variant.label}
    </span>
  );
}

// ─── Recent Agreements Table ─────────────────────────────────────────────────

interface RecentAgreementsProps {
  agreements: BoardPackData["agreements"];
}

function RecentAgreements({ agreements }: RecentAgreementsProps) {
  if (!agreements.length) {
    return (
      <div className="rounded-lg border border-[var(--g-border-subtle)] p-6 text-center">
        <FileText className="mx-auto mb-2 h-8 w-8 text-[var(--g-text-secondary)]" />
        <p className="text-sm text-[var(--g-text-secondary)]">Sin acuerdos registrados</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)]">
            <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--g-text-primary)]">
              Tipo
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--g-text-primary)]">
              Estado
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--g-text-primary)]">
              Fecha
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--g-border-subtle)]">
          {agreements.slice(0, 5).map((agreement) => (
            <tr key={agreement.id} className="hover:bg-[var(--g-surface-subtle)]/30 transition-colors">
              <td className="px-4 py-3">
                <span className="text-sm font-medium text-[var(--g-text-primary)]">
                  {agreement.agreement_kind.replace(/_/g, " ")}
                </span>
              </td>
              <td className="px-4 py-3">
                <AgreementBadge status={agreement.status} />
              </td>
              <td className="px-4 py-3 text-sm text-[var(--g-text-secondary)]">
                {agreement.decision_date
                  ? new Date(agreement.decision_date).toLocaleDateString("es-ES")
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Critical Findings ───────────────────────────────────────────────────────

interface CriticalFindingsProps {
  findings: BoardPackData["findings"];
}

function CriticalFindings({ findings }: CriticalFindingsProps) {
  const critical = findings.filter(
    (f) => f.severity === "CRITICO" || f.severity === "ALTO"
  );

  if (!critical.length) {
    return (
      <div className="rounded-lg border border-[var(--g-border-subtle)] bg-[var(--status-success)]/10 p-6 text-center">
        <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-[var(--status-success)]" />
        <p className="text-sm text-[var(--g-text-secondary)]">Sin hallazgos críticos o altos</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {critical.slice(0, 5).map((finding) => (
        <div
          key={finding.id}
          className="rounded-lg border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 mt-0.5 text-[var(--status-error)]" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm text-[var(--g-text-primary)]">{finding.code}</p>
                <FindingSeverityBadge severity={finding.severity} />
              </div>
              <p className="text-xs text-[var(--g-text-secondary)] mt-1 line-clamp-2">{finding.title}</p>
              {finding.due_date && (
                <p className="text-xs text-[var(--g-text-secondary)] mt-2">
                  Vencimiento: {new Date(finding.due_date).toLocaleDateString("es-ES")}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Evidence Trail ──────────────────────────────────────────────────────────

interface EvidenceTrailProps {
  aiSystems: BoardPackData["aiSystems"];
  delegations: BoardPackData["delegations"];
}

function EvidenceTrail({ aiSystems, delegations }: EvidenceTrailProps) {
  const expiringDelegations = delegations.filter((d) => d.days_to_expiry <= 30 && d.days_to_expiry > 0);
  const criticalAiSystems = aiSystems.filter((s) => s.non_conformities > 0);

  return (
    <div className="space-y-4">
      {/* AI Systems */}
      {criticalAiSystems.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-[var(--g-text-primary)] mb-2">
            Sistemas IA con incumplimientos
          </h4>
          <div className="space-y-2">
            {criticalAiSystems.slice(0, 3).map((system) => (
              <div
                key={system.id}
                className="flex items-center gap-2 rounded border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-2 text-xs"
              >
                <Shield className="h-4 w-4 text-[var(--status-error)]" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[var(--g-text-primary)]">{system.name}</p>
                  <p className="text-[var(--g-text-secondary)]">
                    {system.non_conformities} incumplimiento(s)
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expiring Delegations */}
      {expiringDelegations.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-[var(--g-text-primary)] mb-2">
            Delegaciones por vencer
          </h4>
          <div className="space-y-2">
            {expiringDelegations.slice(0, 3).map((delegation) => (
              <div
                key={delegation.code}
                className="flex items-center gap-2 rounded border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-2 text-xs"
              >
                <Clock
                  className={cn(
                    "h-4 w-4",
                    delegation.days_to_expiry <= 7
                      ? "text-[var(--status-error)]"
                      : "text-[var(--status-warning)]"
                  )}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[var(--g-text-primary)]">{delegation.code}</p>
                  <p className="text-[var(--g-text-secondary)]">
                    {delegation.days_to_expiry} días
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!criticalAiSystems.length && !expiringDelegations.length && (
        <div className="rounded-lg border border-[var(--g-border-subtle)] bg-[var(--status-success)]/10 p-6 text-center">
          <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-[var(--status-success)]" />
          <p className="text-sm text-[var(--g-text-secondary)]">
            Pista de evidencia limpia
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Meeting Summary ─────────────────────────────────────────────────────────

interface MeetingSummaryProps {
  meeting: BoardPackData["meeting"];
}

function MeetingSummary({ meeting }: MeetingSummaryProps) {
  if (!meeting) {
    return (
      <div className="rounded-lg border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-6 text-center">
        <AlertCircle className="mx-auto mb-2 h-8 w-8 text-[var(--g-text-secondary)]" />
        <p className="text-sm text-[var(--g-text-secondary)]">Sin información de reunión</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-6 space-y-4">
      <div>
        <p className="text-xs font-semibold text-[var(--g-text-secondary)] uppercase">Entidad</p>
        <p className="text-sm font-medium text-[var(--g-text-primary)] mt-1">
          {meeting.body?.entity_name}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-semibold text-[var(--g-text-secondary)] uppercase">Órgano</p>
          <p className="text-sm font-medium text-[var(--g-text-primary)] mt-1">
            {meeting.body?.name}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold text-[var(--g-text-secondary)] uppercase">Tipo</p>
          <p className="text-sm font-medium text-[var(--g-text-primary)] mt-1">
            {meeting.meeting_type.replace(/_/g, " ")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-semibold text-[var(--g-text-secondary)] uppercase">Presidente</p>
          <p className="text-sm text-[var(--g-text-primary)] mt-1">
            {meeting.president?.full_name || "—"}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold text-[var(--g-text-secondary)] uppercase">Secretario</p>
          <p className="text-sm text-[var(--g-text-primary)] mt-1">
            {meeting.secretary?.full_name || "—"}
          </p>
        </div>
      </div>

      {meeting.scheduled_start && (
        <div>
          <p className="text-xs font-semibold text-[var(--g-text-secondary)] uppercase">Fecha</p>
          <p className="text-sm text-[var(--g-text-primary)] mt-1">
            {new Date(meeting.scheduled_start).toLocaleDateString("es-ES", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      )}

      {meeting.agenda_items.length > 0 && (
        <div className="pt-4 border-t border-[var(--g-border-subtle)]">
          <p className="text-xs font-semibold text-[var(--g-text-secondary)] uppercase mb-2">
            Orden del día ({meeting.agenda_items.length})
          </p>
          <ul className="space-y-1">
            {meeting.agenda_items.slice(0, 5).map((item) => (
              <li key={item.order_number} className="text-xs text-[var(--g-text-secondary)]">
                <span className="font-medium">{item.order_number}.</span> {item.title}
              </li>
            ))}
            {meeting.agenda_items.length > 5 && (
              <li className="text-xs font-medium text-[var(--g-brand-3308)]">
                +{meeting.agenda_items.length - 5} más
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Cotizada Warnings ───────────────────────────────────────────────────────

interface CotizadaWarningsProps {
  warnings: string[];
}

function CotizadaWarnings({ warnings }: CotizadaWarningsProps) {
  if (!warnings.length) return null;

  return (
    <div className="rounded-lg border border-[var(--status-warning)] bg-[var(--status-warning)]/5 p-4">
      <div className="flex gap-3">
        <AlertTriangle className="h-5 w-5 text-[var(--status-warning)] mt-0.5 shrink-0" />
        <div>
          <h3 className="text-sm font-semibold text-[var(--status-warning)] mb-2">
            Advertencias LMV — Entidad cotizada
          </h3>
          <ul className="space-y-1">
            {warnings.map((warning, idx) => (
              <li key={idx} className="text-xs text-[var(--g-text-secondary)]">
                • {warning}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function BoardPackPage() {
  const { id: paramId } = useParams<{ id: string }>();
  const { tenantId } = useTenantContext();
  const scope = useSecretariaScope();
  // Guard contra `:id` literal (NavLinks mal formados) y valores vacíos.
  const validParamId = paramId && paramId !== ":id" ? paramId : undefined;
  const isSociedadMode = scope.mode === "sociedad";
  const selectedEntity = scope.selectedEntity;
  const selectedEntityName = selectedEntity?.legalName ?? selectedEntity?.name ?? "Sociedad seleccionada";
  const scopedEntityId = isSociedadMode ? selectedEntity?.id ?? null : null;

  // Fallback: si no viene un id válido en la URL, resolvemos la reunión
  // más reciente del ámbito actual para que el sidebar "Board Pack" funcione
  // sin necesidad de elegir reunión previamente.
  const { data: fallbackMeeting, isLoading: loadingFallback } = useQuery({
    queryKey: ["board-pack", "fallback-meeting", tenantId, scopedEntityId ?? "grupo"],
    enabled: !validParamId && !!tenantId && (!isSociedadMode || !!scopedEntityId),
    queryFn: async () => {
      let query = supabase
        .from("meetings")
        .select("id, scheduled_start, governing_bodies!inner(body_type, entity_id, name)")
        .eq("tenant_id", tenantId!);

      if (scopedEntityId) {
        query = query.eq("governing_bodies.entity_id", scopedEntityId);
      } else {
        query = query.eq("governing_bodies.body_type", "CDA");
      }

      const { data, error } = await query
        .order("scheduled_start", { ascending: false })
        .limit(scopedEntityId ? 20 : 1);
      if (error) throw error;
      type FallbackBody = { body_type: string | null; entity_id: string | null; name: string | null };
      type FallbackMeetingRow = {
        id: string;
        scheduled_start: string | null;
        governing_bodies: FallbackBody[] | FallbackBody | null;
      };
      const rows = (data ?? []) as FallbackMeetingRow[];
      if (!scopedEntityId) return rows[0] ?? null;
      return (
        rows.find((row) => {
          const body = Array.isArray(row.governing_bodies)
            ? row.governing_bodies[0]
            : row.governing_bodies;
          return body?.body_type === "CDA";
        }) ??
        rows[0] ??
        null
      );
    },
  });

  const meetingId = validParamId ?? fallbackMeeting?.id ?? "";
  const { data: boardPackData, isLoading, error } = useBoardPackData(meetingId, scopedEntityId);

  if (isLoading || loadingFallback) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-[var(--g-text-secondary)]">Cargando Board Pack...</p>
      </div>
    );
  }

  if (!meetingId) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-2 h-8 w-8 text-[var(--g-text-secondary)]" />
          <p className="text-sm text-[var(--g-text-secondary)]">
            {isSociedadMode
              ? `No hay reuniones registradas para ${selectedEntityName}.`
              : "No hay reuniones del Consejo de Administración registradas."}
          </p>
        </div>
      </div>
    );
  }

  if (error || !boardPackData) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-2 h-8 w-8 text-[var(--status-error)]" />
          <p className="text-sm text-[var(--status-error)]">
            Error al cargar el Board Pack
          </p>
        </div>
      </div>
    );
  }

  const agreementsCount = boardPackData.agreements.length;
  const criticalFindingsCount = boardPackData.findings.filter(
    (f) => f.severity === "CRITICO" || f.severity === "ALTO"
  ).length;
  const incidentsCount = boardPackData.obligations.reduce(
    (sum, o) => sum + o.incidents_count,
    0
  );
  const evidenceCount = boardPackData.aiSystems.length + boardPackData.delegations.length;

  return (
    <main className="flex-1 overflow-auto bg-[var(--g-surface-page)]">
      {/* Header */}
      <div className="border-b border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-6 py-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--g-text-primary)]">
              {isSociedadMode ? "Board Pack de sociedad" : "Board Pack"}
            </h1>
            <p className="text-sm text-[var(--g-text-secondary)] mt-1">
              {isSociedadMode
                ? `${selectedEntityName} — Informe ejecutivo del órgano seleccionado`
                : "Consejo de Administración — Informe ejecutivo"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-xs text-[var(--g-text-secondary)]">
              Generado: {new Date(boardPackData.generatedAt).toLocaleDateString("es-ES")}
            </p>
            <button
              type="button"
              onClick={() => window.print()}
              className="print:hidden flex items-center gap-2 px-3 py-2 text-sm font-medium border border-[var(--g-border-subtle)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] transition-colors"
              style={{ borderRadius: "var(--g-radius-md)" }}
              aria-label="Imprimir o exportar como PDF"
            >
              <Printer className="h-4 w-4" />
              Imprimir / PDF
            </button>
          </div>
        </div>

        {isSociedadMode && selectedEntity ? (
          <div
            className="mt-4 flex flex-col gap-3 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-4 py-3 text-sm text-[var(--g-text-secondary)] lg:flex-row lg:items-center lg:justify-between"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <div className="flex items-start gap-3">
              <Building2 className="mt-0.5 h-4 w-4 text-[var(--g-brand-3308)]" />
              <div>
                <div className="font-semibold text-[var(--g-text-primary)]">{selectedEntityName}</div>
                <div>
                  {selectedEntity.legalForm} · {selectedEntity.jurisdiction} · {selectedEntity.status}
                </div>
              </div>
            </div>
            <div className="max-w-2xl">
              Reunión, acuerdos, riesgos, hallazgos y delegaciones se resuelven para la sociedad seleccionada cuando el dato maestro permite filtrarlo por entidad.
            </div>
          </div>
        ) : null}
      </div>

      <div className="p-6 space-y-6">
        {/* Cotizada Warnings */}
        {boardPackData.cotizadaWarnings.length > 0 && (
          <CotizadaWarnings warnings={boardPackData.cotizadaWarnings} />
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            icon={FileText}
            label="Acuerdos activos"
            value={agreementsCount}
          />
          <KPICard
            icon={AlertTriangle}
            label="Hallazgos críticos/altos"
            value={criticalFindingsCount}
            variant={criticalFindingsCount > 0 ? "danger" : "default"}
          />
          <KPICard
            icon={AlertCircle}
            label="Incidentes"
            value={incidentsCount}
            variant={incidentsCount > 0 ? "warning" : "default"}
          />
          <KPICard
            icon={Shield}
            label="Evidencias registradas"
            value={evidenceCount}
          />
        </div>

        {/* Cotizada notice removed to show attestations instead */}
        {boardPackData.attestations.total > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4">
              <p className="text-xs font-medium text-[var(--g-text-secondary)]">Campaña actual</p>
              <p className="text-lg font-bold text-[var(--g-text-primary)] mt-1">
                {boardPackData.attestations.campaign}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--g-border-subtle)] bg-[var(--status-success)]/10 p-4">
              <p className="text-xs font-medium text-[var(--g-text-secondary)]">Completadas</p>
              <p className="text-lg font-bold text-[var(--status-success)] mt-1">
                {boardPackData.attestations.completed} de{" "}
                {boardPackData.attestations.total}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--g-border-subtle)] bg-[var(--status-warning)]/10 p-4">
              <p className="text-xs font-medium text-[var(--g-text-secondary)]">Pendientes</p>
              <p className="text-lg font-bold text-[var(--status-warning)] mt-1">
                {boardPackData.attestations.pending.length}
              </p>
            </div>
          </div>
        )}

        {/* Two-column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Recent Agreements */}
            <div>
              <h2 className="text-lg font-bold text-[var(--g-text-primary)] mb-4">
                <FileText className="inline-block h-5 w-5 mr-2" />
                Últimos acuerdos
              </h2>
              <RecentAgreements agreements={boardPackData.agreements} />
            </div>

            {/* Critical Findings */}
            <div>
              <h2 className="text-lg font-bold text-[var(--g-text-primary)] mb-4">
                <AlertTriangle className="inline-block h-5 w-5 mr-2" />
                Hallazgos críticos y altos
              </h2>
              <CriticalFindings findings={boardPackData.findings} />
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {/* Meeting Summary */}
            <div>
              <h2 className="text-lg font-bold text-[var(--g-text-primary)] mb-4">
                <Users className="inline-block h-5 w-5 mr-2" />
                Reunión
              </h2>
              <MeetingSummary meeting={boardPackData.meeting} />
            </div>

            {/* Evidence Trail */}
            <div>
              <h2 className="text-lg font-bold text-[var(--g-text-primary)] mb-4">
                <Shield className="inline-block h-5 w-5 mr-2" />
                Alertas
              </h2>
              <EvidenceTrail
                aiSystems={boardPackData.aiSystems}
                delegations={boardPackData.delegations}
              />
            </div>
          </div>
        </div>

        {/* Risks Overview */}
        {boardPackData.risks.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-[var(--g-text-primary)] mb-4">
              <TrendingUp className="inline-block h-5 w-5 mr-2" />
              Riesgos principales
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {boardPackData.risks.slice(0, 6).map((risk) => (
                <div
                  key={risk.code}
                  className="rounded-lg border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-[var(--g-text-primary)]">
                        {risk.code}
                      </p>
                      <p className="text-xs text-[var(--g-text-secondary)] mt-1 line-clamp-2">
                        {risk.title}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-4">
                    <div>
                      <p className="text-xs text-[var(--g-text-secondary)]">Inherente</p>
                      <p className="text-sm font-semibold text-[var(--g-text-primary)]">
                        {risk.inherent_score}
                      </p>
                    </div>
                    {risk.residual_score !== null && (
                      <div>
                        <p className="text-xs text-[var(--g-text-secondary)]">Residual</p>
                        <p className="text-sm font-semibold text-[var(--g-text-primary)]">
                          {risk.residual_score}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
