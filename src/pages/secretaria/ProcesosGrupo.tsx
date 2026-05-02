import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ClipboardList,
  ExternalLink,
  FileText,
  GitBranch,
  ListChecks,
  Play,
  Repeat2,
  Route,
  Scale,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSecretariaScope } from "@/components/secretaria/shell";
import { formatJurisdiction } from "@/hooks/useEntities";
import {
  useGroupCampaignWarRoom,
  useLaunchGroupCampaign,
  type GroupCampaignLiveRecord,
  type GroupCampaignWarRoomCampaign,
  type GroupCampaignWarRoomExpediente,
  type GroupCampaignWarRoomStep,
} from "@/hooks/useGroupCampaigns";
import { useSociedades, type SociedadRow } from "@/hooks/useSociedades";
import { statusLabel } from "@/lib/secretaria/status-labels";
import {
  GROUP_CAMPAIGN_TEMPLATES,
  addCampaignDays,
  buildGroupCampaignExpedientes,
  buildGroupCampaignLaunchInput,
  makeDefaultCampaignParams,
  uniqueCampaignJurisdictions,
  type CampaignParams,
  type CampaignType,
  type CampaignAdoptionMode,
  type CampaignStatus,
} from "@/lib/secretaria/group-campaign-engine";

function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function normalizeStatus(value: string | null | undefined) {
  return (value ?? "").toUpperCase();
}

function countBy<T extends string>(items: T[]) {
  return items.reduce<Record<T, number>>((acc, item) => {
    acc[item] = (acc[item] ?? 0) + 1;
    return acc;
  }, {} as Record<T, number>);
}

function statusTone(status: CampaignStatus) {
  if (status === "COMPLETADO") return "bg-[var(--status-success)] text-[var(--g-text-inverse)]";
  if (status === "BLOQUEADO") return "bg-[var(--status-error)] text-[var(--g-text-inverse)]";
  if (status === "EN_CURSO") return "bg-[var(--status-info)] text-[var(--g-text-inverse)]";
  return "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]";
}

function modeTone(mode: CampaignAdoptionMode) {
  if (mode === "MEETING" || mode === "NO_SESSION") return "bg-[var(--g-sec-100)] text-[var(--g-brand-3308)]";
  if (mode === "CO_APROBACION" || mode === "SOLIDARIO") return "bg-[var(--status-info)] text-[var(--g-text-inverse)]";
  if (mode === "POST_TASK") return "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]";
  return "bg-[var(--status-warning)] text-[var(--g-text-inverse)]";
}

const CAMPAIGN_STATUS_LABEL: Record<string, string> = {
  BORRADOR: "Borrador",
  LANZADA: "Lanzada",
  EN_CURSO: "En curso",
  COMPLETADA: "Completada",
  BLOQUEADA: "Bloqueada",
  CANCELADA: "Cancelada",
};

function displayStatus(status: string | null | undefined) {
  if (!status) return "—";
  return CAMPAIGN_STATUS_LABEL[status] ?? statusLabel(status).replace(/_/g, " ");
}

function recordStatusTone(status: string | null | undefined) {
  const value = normalizeStatus(status);
  if (["COMPLET", "ADOPTED", "CERTIFIED", "REGISTERED", "LEGALIZADO", "CONFIRMADA"].some((token) => value.includes(token))) {
    return "bg-[var(--status-success)] text-[var(--g-text-inverse)]";
  }
  if (["BLOQUE", "ERROR", "RECHAZ", "DENEG", "FAIL", "CANCEL"].some((token) => value.includes(token))) {
    return "bg-[var(--status-error)] text-[var(--g-text-inverse)]";
  }
  if (["EN_CURSO", "LANZADA", "OPEN", "ABIERTO", "VOTING", "ENVIADA", "PROPOSED"].some((token) => value.includes(token))) {
    return "bg-[var(--status-info)] text-[var(--g-text-inverse)]";
  }
  return "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]";
}

function formatOptionalDate(date: string | null | undefined) {
  if (!date) return "—";
  const dateOnly = date.slice(0, 10);
  const parsed = new Date(`${dateOnly}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function campaignTemplateName(campaignType: string) {
  return GROUP_CAMPAIGN_TEMPLATES.find((template) => template.type === campaignType)?.name ?? campaignType.replace(/_/g, " ");
}

function liveTableLabel(table: string | null | undefined) {
  if (table === "agreements") return "Expediente acuerdo";
  if (table === "convocatorias") return "Convocatoria";
  if (table === "no_session_expedientes") return "Acuerdo sin sesión";
  if (table === "unipersonal_decisions") return "Decisión unipersonal";
  if (table === "group_campaign_post_tasks") return "Tarea post";
  return "Registro";
}

function shortRef(id: string | null | undefined) {
  return id ? id.slice(0, 8) : "—";
}

export default function ProcesosGrupo() {
  const navigate = useNavigate();
  const scope = useSecretariaScope();
  const { data: sociedades = [], isLoading } = useSociedades();
  const launchMutation = useLaunchGroupCampaign();
  const {
    data: launchedCampaigns = [],
    error: warRoomError,
    isLoading: isWarRoomLoading,
  } = useGroupCampaignWarRoom();
  const [params, setParams] = useState<CampaignParams>(() => makeDefaultCampaignParams());
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  const template = GROUP_CAMPAIGN_TEMPLATES.find((item) => item.type === params.type) ?? GROUP_CAMPAIGN_TEMPLATES[0];
  const jurisdictions = useMemo(() => uniqueCampaignJurisdictions(sociedades), [sociedades]);

  const sociedadesScope = useMemo(
    () =>
      sociedades.filter((sociedad) => {
        if (sociedad.entity_status && !["Active", "Activa"].includes(sociedad.entity_status)) return false;
        if (sociedad.jurisdiction && !params.selectedJurisdictions.includes(sociedad.jurisdiction)) return false;
        if (!params.includeCotizada && sociedad.es_cotizada) return false;
        return true;
      }),
    [params.includeCotizada, params.selectedJurisdictions, sociedades],
  );

  const expedientes = useMemo(
    () => buildGroupCampaignExpedientes(sociedadesScope, template, params),
    [params, sociedadesScope, template],
  );
  const selectedCampaign = useMemo(
    () => launchedCampaigns.find((campaign) => campaign.id === selectedCampaignId) ?? launchedCampaigns[0] ?? null,
    [launchedCampaigns, selectedCampaignId],
  );
  const warRoomErrorMessage = warRoomError
    ? warRoomError instanceof Error
      ? warRoomError.message
      : String(warRoomError)
    : null;

  const statusCounts = useMemo(() => countBy(expedientes.map((item) => item.estado)), [expedientes]);
  const modeCounts = useMemo(() => countBy(expedientes.map((item) => item.adoptionMode)), [expedientes]);
  const earliestDeadline = expedientes
    .map((item) => item.deadline)
    .sort((a, b) => a.localeCompare(b))[0];

  useEffect(() => {
    if (launchedCampaigns.length === 0) {
      if (selectedCampaignId) setSelectedCampaignId(null);
      return;
    }

    if (!selectedCampaignId || !launchedCampaigns.some((campaign) => campaign.id === selectedCampaignId)) {
      setSelectedCampaignId(launchedCampaigns[0].id);
    }
  }, [launchedCampaigns, selectedCampaignId]);

  const updateParam = <Key extends keyof CampaignParams>(key: Key, value: CampaignParams[Key]) => {
    setParams((current) => ({ ...current, [key]: value }));
  };

  const toggleJurisdiction = (jurisdiction: string) => {
    setParams((current) => {
      const exists = current.selectedJurisdictions.includes(jurisdiction);
      return {
        ...current,
        selectedJurisdictions: exists
          ? current.selectedJurisdictions.filter((item) => item !== jurisdiction)
          : [...current.selectedJurisdictions, jurisdiction],
      };
    });
  };

  const launchCampaign = async () => {
    try {
      const payload = buildGroupCampaignLaunchInput(params, template, sociedadesScope, expedientes);
      const result = await launchMutation.mutateAsync(payload);
      setSelectedCampaignId(result.id);
      toast.success("Campaña lanzada", {
        description: `${payload.expedientes.length} expediente(s) generados y vinculados.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error("No se pudo lanzar la campaña", { description: message });
    }
  };

  if (scope.mode !== "grupo") {
    return (
      <div className="mx-auto max-w-[960px] p-6">
        <div
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-6"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-1 h-5 w-5 shrink-0 text-[var(--status-warning)]" />
            <div>
              <h1 className="text-2xl font-semibold text-[var(--g-text-primary)]">Campañas de grupo</h1>
              <p className="mt-2 text-sm text-[var(--g-text-secondary)]">
                Las campañas operan sobre un perímetro multi-sociedad. Cambia a modo Grupo para lanzar y monitorizar expedientes coordinados.
              </p>
              <button
                type="button"
                onClick={() => {
                  scope.setMode("grupo");
                  navigate("/secretaria/procesos-grupo?scope=grupo");
                }}
                className="mt-4 inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-semibold text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                Cambiar a modo Grupo
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
            <GitBranch className="h-3.5 w-3.5" />
            Secretaría · War Room de grupo
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
            Campañas de grupo
          </h1>
          <p className="mt-1 max-w-4xl text-sm text-[var(--g-text-secondary)]">
            Lanza una instrucción única y descompón automáticamente expedientes por sociedad según tipo social, forma de administración, unipersonalidad y reglas aplicables.
          </p>
        </div>

        <button
          type="button"
          onClick={launchCampaign}
          disabled={expedientes.length === 0 || launchMutation.isPending}
          aria-busy={launchMutation.isPending}
          className="inline-flex items-center justify-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-semibold text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] disabled:cursor-not-allowed disabled:bg-[var(--g-surface-muted)] disabled:text-[var(--g-text-secondary)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <Play className="h-4 w-4" />
          {launchMutation.isPending ? "Lanzando..." : "Lanzar campaña"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <MetricCard icon={Building2} label="Sociedades" value={expedientes.length} />
        <MetricCard icon={CheckCircle2} label="Completadas" value={statusCounts.COMPLETADO ?? 0} />
        <MetricCard icon={Repeat2} label="En curso" value={statusCounts.EN_CURSO ?? 0} />
        <MetricCard icon={AlertTriangle} label="Bloqueadas" value={statusCounts.BLOQUEADO ?? 0} tone="warning" />
        <MetricCard icon={CalendarDays} label="Primer plazo" value={earliestDeadline ? formatDate(earliestDeadline) : "—"} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[380px_1fr]">
        <section
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <div className="border-b border-[var(--g-border-subtle)] px-5 py-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--g-text-primary)]">
              <Settings2 className="h-4 w-4 text-[var(--g-brand-3308)]" />
              Lanzamiento
            </div>
          </div>

          <div className="space-y-5 p-5">
            <div>
              <label htmlFor="campaign-type" className="text-xs font-semibold uppercase tracking-wide text-[var(--g-text-primary)]">
                Tipo de campaña
              </label>
              <select
                id="campaign-type"
                value={params.type}
                onChange={(event) => updateParam("type", event.target.value as CampaignType)}
                className="mt-1 w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--g-border-focus)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                {GROUP_CAMPAIGN_TEMPLATES.map((item) => (
                  <option key={item.type} value={item.type}>
                    {item.name}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-[var(--g-text-secondary)]">{template.summary}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="campaign-ejercicio" className="text-xs font-semibold uppercase tracking-wide text-[var(--g-text-primary)]">
                  Ejercicio
                </label>
                <input
                  id="campaign-ejercicio"
                  type="number"
                  min="2020"
                  max="2035"
                  value={params.ejercicio}
                  onChange={(event) => updateParam("ejercicio", event.target.value)}
                  className="mt-1 w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--g-border-focus)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </div>

              <div>
                <label htmlFor="campaign-cierre" className="text-xs font-semibold uppercase tracking-wide text-[var(--g-text-primary)]">
                  Cierre
                </label>
                <input
                  id="campaign-cierre"
                  type="date"
                  value={params.fechaCierre}
                  onChange={(event) => updateParam("fechaCierre", event.target.value)}
                  className="mt-1 w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--g-border-focus)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </div>
            </div>

            <div>
              <label htmlFor="campaign-launch" className="text-xs font-semibold uppercase tracking-wide text-[var(--g-text-primary)]">
                Fecha de lanzamiento
              </label>
              <input
                id="campaign-launch"
                type="date"
                value={params.fechaLanzamiento}
                onChange={(event) => updateParam("fechaLanzamiento", event.target.value)}
                className="mt-1 w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--g-border-focus)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-[var(--g-text-primary)]">
                <input
                  type="checkbox"
                  checked={params.includeCotizada}
                  onChange={(event) => updateParam("includeCotizada", event.target.checked)}
                  className="h-4 w-4 accent-[var(--g-brand-3308)]"
                />
                Incluir dominante cotizada
              </label>
              <label className="flex items-center gap-2 text-sm text-[var(--g-text-primary)]">
                <input
                  type="checkbox"
                  checked={params.preferNoSession}
                  onChange={(event) => updateParam("preferNoSession", event.target.checked)}
                  className="h-4 w-4 accent-[var(--g-brand-3308)]"
                />
                Preferir acuerdos sin sesión cuando sea posible
              </label>
            </div>

            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--g-text-primary)]">
                Jurisdicciones
              </div>
              <div className="flex flex-wrap gap-2">
                {jurisdictions.map((jurisdiction) => {
                  const active = params.selectedJurisdictions.includes(jurisdiction);
                  return (
                    <button
                      key={jurisdiction}
                      type="button"
                      onClick={() => toggleJurisdiction(jurisdiction)}
                      className={cn(
                        "border px-3 py-1.5 text-xs font-semibold transition-colors",
                        active
                          ? "border-[var(--g-brand-3308)] bg-[var(--g-sec-100)] text-[var(--g-brand-3308)]"
                          : "border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] text-[var(--g-text-secondary)] hover:bg-[var(--g-surface-subtle)]",
                      )}
                      style={{ borderRadius: "var(--g-radius-full)" }}
                    >
                      {formatJurisdiction(jurisdiction)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <div className="space-y-6">
          <section
            className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="flex flex-col gap-3 border-b border-[var(--g-border-subtle)] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--g-text-primary)]">
                <Route className="h-4 w-4 text-[var(--g-brand-3308)]" />
                Cadena de acuerdos
              </div>
              <span className="text-xs text-[var(--g-text-secondary)]">{template.legalAnchor}</span>
            </div>
            <div className="grid grid-cols-1 gap-3 p-5 lg:grid-cols-4">
              {template.agreements.map((agreement, index) => (
                <div
                  key={agreement.code}
                  className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-[var(--g-brand-3308)]">
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span className="text-[11px] text-[var(--g-text-secondary)]">{agreement.organ}</span>
                  </div>
                  <h2 className="mt-2 text-sm font-semibold text-[var(--g-text-primary)]">{agreement.label}</h2>
                  <p className="mt-2 text-xs text-[var(--g-text-secondary)]">
                    {agreement.dependency ? `Depende de ${agreement.dependency}` : "Primer hito de campaña"}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-[var(--g-text-primary)]">
                    Plazo: {formatDate(addCampaignDays(params.fechaCierre, agreement.deadlineDays))}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section
            className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="flex flex-col gap-3 border-b border-[var(--g-border-subtle)] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--g-text-primary)]">
                <ClipboardList className="h-4 w-4 text-[var(--g-brand-3308)]" />
                Expedientes derivados
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] text-[var(--g-text-secondary)]">
                {Object.entries(modeCounts).map(([mode, count]) => (
                  <span key={mode} className="border border-[var(--g-border-subtle)] px-2 py-1" style={{ borderRadius: "var(--g-radius-sm)" }}>
                    {mode}: {count}
                  </span>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px]">
                <thead>
                  <tr className="bg-[var(--g-surface-subtle)]">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--g-text-primary)]">Sociedad</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--g-text-primary)]">Fase</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--g-text-primary)]">Estado</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--g-text-primary)]">Modo</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--g-text-primary)]">Rule pack</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--g-text-primary)]">Plazo</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--g-text-primary)]">Alertas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--g-border-subtle)]">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-[var(--g-text-secondary)]">
                        Cargando sociedades...
                      </td>
                    </tr>
                  ) : expedientes.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-[var(--g-text-secondary)]">
                        No hay sociedades en el alcance seleccionado.
                      </td>
                    </tr>
                  ) : (
                    expedientes.map((item) => (
                      <tr key={item.id} className="hover:bg-[var(--g-surface-subtle)]/50">
                        <td className="px-4 py-3 text-sm">
                          <div className="font-semibold text-[var(--g-text-primary)]">{item.sociedad}</div>
                          <div className="text-xs text-[var(--g-text-secondary)]">
                            {formatJurisdiction(item.jurisdiction)} · {item.formaSocial} · {item.formaAdministracion}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-[var(--g-text-secondary)]">{item.faseActual}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={cn("inline-flex px-2 py-1 text-[11px] font-semibold", statusTone(item.estado))} style={{ borderRadius: "var(--g-radius-sm)" }}>
                            {item.estado.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={cn("inline-flex px-2 py-1 text-[11px] font-semibold", modeTone(item.adoptionMode))} style={{ borderRadius: "var(--g-radius-sm)" }}>
                            {item.adoptionMode}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-[var(--g-text-secondary)]">{item.rulePack}</td>
                        <td className="px-4 py-3 text-sm font-medium text-[var(--g-text-primary)]">{formatDate(item.deadline)}</td>
                        <td className="px-4 py-3 text-xs text-[var(--g-text-secondary)]">
                          {item.alertas.length > 0 ? item.alertas.join(" · ") : "Sin alertas"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      <WarRoomSection
        campaigns={launchedCampaigns}
        selectedCampaign={selectedCampaign}
        selectedCampaignId={selectedCampaignId}
        onSelectCampaign={setSelectedCampaignId}
        isLoading={isWarRoomLoading}
        errorMessage={warRoomErrorMessage}
      />

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <InfoPanel
          icon={ShieldCheck}
          title="Motor de enrutamiento"
          body="Cada expediente lee forma social, forma de administración y unipersonalidad para asignar el AdoptionMode y el rule pack aplicable."
        />
        <InfoPanel
          icon={Scale}
          title="Expedientes diferenciados"
          body="La campaña es única, pero el resultado no lo es: consejo, admin único, mancomunados, solidarios y socio único generan flujos distintos."
        />
        <InfoPanel
          icon={ListChecks}
          title="Dependencias y POST"
          body="La cadena conserva dependencias temporales y tareas posteriores como firma, inscripción, depósito y evidencias."
        />
      </div>
    </div>
  );
}

function WarRoomSection({
  campaigns,
  selectedCampaign,
  selectedCampaignId,
  onSelectCampaign,
  isLoading,
  errorMessage,
}: {
  campaigns: GroupCampaignWarRoomCampaign[];
  selectedCampaign: GroupCampaignWarRoomCampaign | null;
  selectedCampaignId: string | null;
  onSelectCampaign: (campaignId: string) => void;
  isLoading: boolean;
  errorMessage: string | null;
}) {
  return (
    <section
      className="mt-6 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <div className="flex flex-col gap-3 border-b border-[var(--g-border-subtle)] px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--g-text-primary)]">
            <ClipboardList className="h-4 w-4 text-[var(--g-brand-3308)]" />
            War Room de campañas lanzadas
          </div>
          <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
            Seguimiento real de campañas persistidas, sociedades afectadas, fases, tareas y enlaces operativos.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-[var(--g-text-secondary)]">
          <WarRoomMetric label="Campañas" value={campaigns.length} />
          <WarRoomMetric label="Sociedades" value={selectedCampaign?.expedientes_count ?? 0} />
          <WarRoomMetric label="Tareas" value={selectedCampaign?.steps_count ?? 0} />
          <WarRoomMetric label="Live records" value={selectedCampaign?.live_links_count ?? 0} />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr]">
        <div className="border-b border-[var(--g-border-subtle)] xl:border-b-0 xl:border-r">
          <div className="max-h-[560px] space-y-2 overflow-y-auto p-4">
            {isLoading ? (
              <WarRoomState title="Cargando campañas..." body="Consultando campañas, expedientes y tareas generadas." />
            ) : campaigns.length === 0 ? (
              <WarRoomState title="Sin campañas lanzadas" body="Lanza una campaña para activar el seguimiento por sociedad." />
            ) : (
              campaigns.map((campaign) => {
                const active = campaign.id === selectedCampaignId || (!selectedCampaignId && campaign.id === selectedCampaign?.id);
                return (
                  <button
                    key={campaign.id}
                    type="button"
                    onClick={() => onSelectCampaign(campaign.id)}
                    className={cn(
                      "w-full border p-3 text-left transition-colors",
                      active
                        ? "border-[var(--g-brand-3308)] bg-[var(--g-sec-100)]"
                        : "border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] hover:bg-[var(--g-surface-subtle)]",
                    )}
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-[var(--g-text-primary)]">{campaign.name}</div>
                        <div className="mt-1 text-xs text-[var(--g-text-secondary)]">
                          {campaignTemplateName(campaign.campaign_type)} · {campaign.expedientes_count} sociedades
                        </div>
                      </div>
                      <StatusChip status={campaign.status} />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[var(--g-text-secondary)]">
                      <span>Ejercicio {campaign.ejercicio ?? "N/D"}</span>
                      <span>{formatOptionalDate(campaign.fecha_lanzamiento)}</span>
                      <span>Plazo {formatOptionalDate(campaign.first_deadline ?? campaign.plazo_limite)}</span>
                      <span>{campaign.live_links_count} enlaces</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="min-w-0 p-4">
          {errorMessage ? (
            <WarRoomState title="No se pudo cargar el War Room" body={errorMessage} tone="error" />
          ) : selectedCampaign ? (
            <WarRoomCampaignDetail campaign={selectedCampaign} />
          ) : (
            <WarRoomState title="Campaña no seleccionada" body="Selecciona una campaña lanzada para ver sociedades, fases y tareas." />
          )}
        </div>
      </div>
    </section>
  );
}

function WarRoomCampaignDetail({ campaign }: { campaign: GroupCampaignWarRoomCampaign }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-[var(--g-text-primary)]">{campaign.name}</h2>
            <StatusChip status={campaign.status} />
          </div>
          <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
            {campaignTemplateName(campaign.campaign_type)} · lanzada el {formatOptionalDate(campaign.fecha_lanzamiento)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-[var(--g-text-secondary)]">
          <WarRoomMetric label="Primer plazo" value={formatOptionalDate(campaign.first_deadline ?? campaign.plazo_limite)} />
          <WarRoomMetric label="Completadas" value={campaign.completed_steps} />
          <WarRoomMetric label="Bloqueadas" value={campaign.blocked_steps} />
        </div>
      </div>

      {campaign.expedientes.length === 0 ? (
        <WarRoomState title="Sin expedientes derivados" body="La campaña existe, pero todavía no hay sociedades vinculadas." />
      ) : (
        <div className="space-y-3">
          {campaign.expedientes.map((expediente) => (
            <WarRoomExpediente key={expediente.id} expediente={expediente} />
          ))}
        </div>
      )}
    </div>
  );
}

function WarRoomExpediente({ expediente }: { expediente: GroupCampaignWarRoomExpediente }) {
  return (
    <div
      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
      style={{ borderRadius: "var(--g-radius-md)" }}
    >
      <div className="flex flex-col gap-3 border-b border-[var(--g-border-subtle)] px-4 py-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-[var(--g-text-primary)]">{expediente.society_name}</h3>
            <StatusChip status={expediente.status} />
          </div>
          <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
            {formatJurisdiction(expediente.jurisdiction ?? "N/D")} · {expediente.forma_social ?? "N/D"} · {expediente.forma_administracion ?? "N/D"}
          </p>
          <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
            Fase actual: {expediente.fase_actual ?? "Sin fase"} · responsable: {expediente.responsable_label ?? "Secretaría de la sociedad"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-[var(--g-text-secondary)]">
          <WarRoomMetric label="Plazo" value={formatOptionalDate(expediente.deadline)} />
          <WarRoomMetric label="Modo" value={expediente.adoption_mode ?? "N/D"} />
          <WarRoomMetric label="Live" value={expediente.live_links_count} />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px]">
          <thead>
            <tr className="bg-[var(--g-surface-subtle)]">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--g-text-primary)]">Fase / tarea</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--g-text-primary)]">Estado</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--g-text-primary)]">Live record</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--g-text-primary)]">Deadline</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--g-text-primary)]">Expediente</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--g-border-subtle)]">
            {expediente.steps.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-5 text-center text-sm text-[var(--g-text-secondary)]">
                  Sin fases generadas para esta sociedad.
                </td>
              </tr>
            ) : (
              expediente.steps.map((step) => <WarRoomStepRow key={step.id} step={step} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WarRoomStepRow({ step }: { step: GroupCampaignWarRoomStep }) {
  const deadline = step.live_record?.deadline ?? step.deadline;
  return (
    <tr className="hover:bg-[var(--g-surface-subtle)]/50">
      <td className="px-4 py-3 text-sm">
        <div className="font-semibold text-[var(--g-text-primary)]">{step.step_order}. {step.label}</div>
        <div className="mt-1 text-xs text-[var(--g-text-secondary)]">
          {step.materia} · {step.organ} · {step.adoption_mode}
        </div>
        {step.dependency ? (
          <div className="mt-1 text-xs text-[var(--g-text-secondary)]">Depende de {step.dependency}</div>
        ) : null}
        {step.alertas.length > 0 ? (
          <div className="mt-2 text-xs text-[var(--status-warning)]">{step.alertas.join(" · ")}</div>
        ) : null}
      </td>
      <td className="px-4 py-3 text-sm">
        <StatusChip status={step.status} />
      </td>
      <td className="px-4 py-3 text-sm">
        {step.live_record ? (
          <div className="space-y-1">
            <StatusChip status={step.live_record.status ?? step.status} />
            <div className="text-xs text-[var(--g-text-secondary)]">
              {liveTableLabel(step.live_record.table)} · {step.live_record.label ?? step.live_record.logicalRef}
            </div>
          </div>
        ) : (
          <span className="text-xs text-[var(--g-text-secondary)]">Pendiente de vinculación</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-[var(--g-text-primary)]">
        <span className="inline-flex items-center gap-1">
          <Clock3 className="h-3.5 w-3.5 text-[var(--g-brand-3308)]" />
          {formatOptionalDate(deadline)}
        </span>
      </td>
      <td className="px-4 py-3 text-sm">
        <LiveRecordLink liveRecord={step.live_record} table={step.live_table} id={step.live_record_id} />
      </td>
    </tr>
  );
}

function LiveRecordLink({
  liveRecord,
  table,
  id,
}: {
  liveRecord: GroupCampaignLiveRecord | null;
  table: string | null;
  id: string | null;
}) {
  if (liveRecord?.href) {
    return (
      <Link
        to={liveRecord.href}
        className="inline-flex items-center gap-1 border border-[var(--g-border-subtle)] px-2 py-1 text-xs font-semibold text-[var(--g-brand-3308)] transition-colors hover:bg-[var(--g-surface-subtle)]"
        style={{ borderRadius: "var(--g-radius-sm)" }}
      >
        <ExternalLink className="h-3.5 w-3.5" />
        Abrir
      </Link>
    );
  }

  if (liveRecord?.logicalRef || (table && id)) {
    return (
      <span
        className="inline-flex border border-[var(--g-border-subtle)] bg-[var(--g-surface-muted)] px-2 py-1 text-xs font-semibold text-[var(--g-text-secondary)]"
        style={{ borderRadius: "var(--g-radius-sm)" }}
      >
        {liveTableLabel(liveRecord?.table ?? table)} · {shortRef(liveRecord?.id ?? id)}
      </span>
    );
  }

  return <span className="text-xs text-[var(--g-text-secondary)]">Sin expediente</span>;
}

function StatusChip({ status }: { status: string | null | undefined }) {
  return (
    <span
      className={cn("inline-flex px-2 py-1 text-[11px] font-semibold", recordStatusTone(status))}
      style={{ borderRadius: "var(--g-radius-sm)" }}
    >
      {displayStatus(status)}
    </span>
  );
}

function WarRoomMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <span
      className="inline-flex items-center gap-1 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-2 py-1"
      style={{ borderRadius: "var(--g-radius-sm)" }}
    >
      <span className="font-semibold text-[var(--g-text-primary)]">{value}</span>
      <span className="text-[var(--g-text-secondary)]">{label}</span>
    </span>
  );
}

function WarRoomState({
  title,
  body,
  tone = "default",
}: {
  title: string;
  body: string;
  tone?: "default" | "error";
}) {
  const Icon = tone === "error" ? AlertTriangle : FileText;
  const iconClass = tone === "error" ? "text-[var(--status-error)]" : "text-[var(--g-brand-3308)]";
  return (
    <div
      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
      style={{ borderRadius: "var(--g-radius-md)" }}
    >
      <div className="flex items-start gap-3">
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", iconClass)} />
        <div>
          <div className="text-sm font-semibold text-[var(--g-text-primary)]">{title}</div>
          <p className="mt-1 text-sm text-[var(--g-text-secondary)]">{body}</p>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  tone = "primary",
}: {
  icon: typeof Building2;
  label: string;
  value: number | string;
  tone?: "primary" | "warning";
}) {
  const iconClass = tone === "warning" ? "text-[var(--status-warning)]" : "text-[var(--g-brand-3308)]";
  return (
    <div
      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", iconClass)} />
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--g-text-secondary)]">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-bold text-[var(--g-text-primary)]">{value}</div>
    </div>
  );
}

function InfoPanel({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof FileText;
  title: string;
  body: string;
}) {
  return (
    <section
      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-5"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[var(--g-brand-3308)]" />
        <div>
          <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">{title}</h2>
          <p className="mt-1 text-sm text-[var(--g-text-secondary)]">{body}</p>
        </div>
      </div>
    </section>
  );
}
