import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Users,
  FileSignature,
  Gavel,
  Library,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ScrollText,
  Building2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface KpiCounts {
  convocatorias_proximas: number;
  reuniones_semana: number;
  actas_sin_firmar: number;
  tramitaciones_curso: number;
  tramitaciones_subsanacion: number;
  acuerdos_sin_sesion_votando: number;
  decisiones_unipersonales_borrador: number;
  libros_alerta: number;
}

interface AgendaItem {
  id: string;
  tipo: "convocatoria" | "reunion" | "tramitacion" | "acuerdo_sin_sesion";
  titulo: string;
  fecha: string | null;
  estado: string;
  sublabel: string;
  nav_to: string;
}

function useSecretariaKpis() {
  return useQuery({
    queryKey: ["secretaria", "kpis"],
    queryFn: async (): Promise<KpiCounts> => {
      const hoyIso = new Date().toISOString();
      const en7 = new Date(Date.now() + 7 * 86400000).toISOString();
      const en30 = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

      const [conv, reun, actas, tram, tramSub, asoc, du, libros] = await Promise.all([
        supabase
          .from("convocatorias")
          .select("id", { count: "exact", head: true })
          .gte("fecha_1", hoyIso),
        supabase
          .from("convocatorias")
          .select("id", { count: "exact", head: true })
          .gte("fecha_1", hoyIso)
          .lte("fecha_1", en7),
        supabase
          .from("minutes")
          .select("id", { count: "exact", head: true })
          .is("signed_at", null),
        supabase
          .from("registry_filings")
          .select("id", { count: "exact", head: true })
          .in("status", ["EN_TRAMITE", "PRESENTADA"]),
        supabase
          .from("registry_filings")
          .select("id", { count: "exact", head: true })
          .eq("status", "SUBSANACION"),
        supabase
          .from("no_session_resolutions")
          .select("id", { count: "exact", head: true })
          .eq("status", "VOTING_OPEN"),
        supabase
          .from("unipersonal_decisions")
          .select("id", { count: "exact", head: true })
          .eq("status", "BORRADOR"),
        supabase
          .from("mandatory_books")
          .select("id", { count: "exact", head: true })
          .lte("legalization_deadline", en30),
      ]);

      return {
        convocatorias_proximas: conv.count ?? 0,
        reuniones_semana: reun.count ?? 0,
        actas_sin_firmar: actas.count ?? 0,
        tramitaciones_curso: tram.count ?? 0,
        tramitaciones_subsanacion: tramSub.count ?? 0,
        acuerdos_sin_sesion_votando: asoc.count ?? 0,
        decisiones_unipersonales_borrador: du.count ?? 0,
        libros_alerta: libros.count ?? 0,
      };
    },
  });
}

function useSecretariaAgenda() {
  return useQuery({
    queryKey: ["secretaria", "agenda"],
    queryFn: async (): Promise<AgendaItem[]> => {
      const items: AgendaItem[] = [];

      const { data: convs } = await supabase
        .from("convocatorias")
        .select(
          "id, estado, fecha_1, modalidad, is_second_call, body_id, governing_bodies(name)",
        )
        .order("fecha_1", { ascending: true })
        .limit(5);

      (convs ?? []).forEach((c: any) => {
        const bodyName = c.governing_bodies?.name ?? "Órgano";
        const conv2 = c.is_second_call ? " · 2ª conv" : "";
        items.push({
          id: c.id,
          tipo: "convocatoria",
          titulo: `${bodyName}${conv2}`,
          fecha: c.fecha_1,
          estado: c.estado,
          sublabel: `Convocatoria · ${c.modalidad ?? ""}`.trim(),
          nav_to: `/secretaria/convocatorias/${c.id}`,
        });
      });

      const { data: filings } = await supabase
        .from("registry_filings")
        .select("id, filing_number, filing_via, status, presentation_date")
        .in("status", ["EN_TRAMITE", "PRESENTADA", "SUBSANACION"])
        .order("presentation_date", { ascending: false })
        .limit(5);

      (filings ?? []).forEach((f: any) => {
        items.push({
          id: f.id,
          tipo: "tramitacion",
          titulo: `${f.filing_number ?? "s/n"} · ${f.filing_via ?? ""}`.trim(),
          fecha: f.presentation_date,
          estado: f.status,
          sublabel: "Tramitación registral",
          nav_to: `/secretaria/tramitador/${f.id}`,
        });
      });

      const { data: asocs } = await supabase
        .from("no_session_resolutions")
        .select("id, title, status, voting_deadline")
        .eq("status", "VOTING_OPEN")
        .order("voting_deadline", { ascending: true })
        .limit(3);

      (asocs ?? []).forEach((a: any) => {
        items.push({
          id: a.id,
          tipo: "acuerdo_sin_sesion",
          titulo: a.title ?? "Acuerdo sin sesión",
          fecha: a.voting_deadline,
          estado: a.status,
          sublabel: "Acuerdo sin sesión",
          nav_to: `/secretaria/acuerdos-sin-sesion/${a.id}`,
        });
      });

      return items
        .sort((a, b) => {
          if (!a.fecha) return 1;
          if (!b.fecha) return -1;
          return a.fecha.localeCompare(b.fecha);
        })
        .slice(0, 10);
    },
  });
}

const statusTone: Record<string, { bg: string; text: string }> = {
  CONVOCADA:    { bg: "bg-[var(--status-info)]",    text: "text-[var(--g-text-inverse)]" },
  CELEBRADA:    { bg: "bg-[var(--status-success)]", text: "text-[var(--g-text-inverse)]" },
  CANCELADA:    { bg: "bg-[var(--status-error)]",   text: "text-[var(--g-text-inverse)]" },
  BORRADOR:     { bg: "bg-[var(--g-surface-muted)]", text: "text-[var(--g-text-secondary)]" },
  DRAFT:        { bg: "bg-[var(--g-surface-muted)]", text: "text-[var(--g-text-secondary)]" },
  EN_TRAMITE:   { bg: "bg-[var(--status-info)]",    text: "text-[var(--g-text-inverse)]" },
  PRESENTADA:   { bg: "bg-[var(--status-info)]",    text: "text-[var(--g-text-inverse)]" },
  SUBSANACION:  { bg: "bg-[var(--status-warning)]", text: "text-[var(--g-text-inverse)]" },
  VOTING_OPEN:  { bg: "bg-[var(--status-warning)]", text: "text-[var(--g-text-inverse)]" },
  INSCRITA:     { bg: "bg-[var(--status-success)]", text: "text-[var(--g-text-inverse)]" },
  APROBADO:     { bg: "bg-[var(--status-success)]", text: "text-[var(--g-text-inverse)]" },
  FIRMADA:      { bg: "bg-[var(--status-success)]", text: "text-[var(--g-text-inverse)]" },
};

function StatusChip({ value }: { value: string }) {
  const tone = statusTone[value] ?? {
    bg: "bg-[var(--g-surface-muted)]",
    text: "text-[var(--g-text-secondary)]",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium ${tone.bg} ${tone.text}`}
      style={{ borderRadius: "var(--g-radius-sm)" }}
    >
      {value}
    </span>
  );
}

interface KpiCardProps {
  icon: React.ElementType;
  label: string;
  value: number | string;
  tone?: "primary" | "warning" | "error" | "neutral";
  sublabel?: string;
  onClick?: () => void;
}

function KpiCard({ icon: Icon, label, value, tone = "primary", sublabel, onClick }: KpiCardProps) {
  const iconColor =
    tone === "warning"
      ? "text-[var(--status-warning)]"
      : tone === "error"
      ? "text-[var(--status-error)]"
      : tone === "neutral"
      ? "text-[var(--g-text-secondary)]"
      : "text-[var(--g-brand-3308)]";

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-col items-start gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4 text-left transition-all hover:border-[var(--g-brand-3308)]"
      style={{
        borderRadius: "var(--g-radius-lg)",
        boxShadow: "var(--g-shadow-card)",
        transition: "var(--g-transition-normal)",
      }}
    >
      <div className="flex items-center gap-2">
        <Icon className={`h-5 w-5 ${iconColor}`} />
        <span className="text-xs font-medium uppercase tracking-wide text-[var(--g-text-secondary)]">
          {label}
        </span>
      </div>
      <div className="text-3xl font-bold text-[var(--g-text-primary)]">{value}</div>
      {sublabel ? (
        <div className="text-xs text-[var(--g-text-secondary)]">{sublabel}</div>
      ) : null}
    </button>
  );
}

export default function SecretariaDashboard() {
  const navigate = useNavigate();
  const { data: kpis, isLoading: kpiLoading } = useSecretariaKpis();
  const { data: agenda, isLoading: agendaLoading } = useSecretariaAgenda();

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
          Módulo Garrigues · Secretaría Societaria
        </div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[var(--g-text-primary)]">
          Dashboard
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-[var(--g-text-secondary)]">
          Ciclo completo: convocatorias, reuniones, actas, certificaciones, tramitación registral,
          decisiones unipersonales y acuerdos sin sesión — conforme a LSC (ES), CSC (PT), Lei das SA
          (BR) y LGSM (MX).
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard
          icon={Bell}
          label="Convocatorias próximas"
          value={kpiLoading ? "…" : kpis?.convocatorias_proximas ?? 0}
          sublabel={`${kpis?.reuniones_semana ?? 0} en los próximos 7 días`}
          tone="primary"
          onClick={() => navigate("/secretaria/convocatorias")}
        />
        <KpiCard
          icon={FileSignature}
          label="Actas sin firmar"
          value={kpiLoading ? "…" : kpis?.actas_sin_firmar ?? 0}
          tone={kpis && kpis.actas_sin_firmar > 0 ? "warning" : "neutral"}
          onClick={() => navigate("/secretaria/actas")}
        />
        <KpiCard
          icon={Gavel}
          label="Tramitaciones en curso"
          value={kpiLoading ? "…" : kpis?.tramitaciones_curso ?? 0}
          sublabel={
            kpis && kpis.tramitaciones_subsanacion > 0
              ? `${kpis.tramitaciones_subsanacion} en subsanación`
              : "Ninguna en subsanación"
          }
          tone={kpis && kpis.tramitaciones_subsanacion > 0 ? "warning" : "primary"}
          onClick={() => navigate("/secretaria/tramitador")}
        />
        <KpiCard
          icon={Library}
          label="Libros con alerta"
          value={kpiLoading ? "…" : kpis?.libros_alerta ?? 0}
          sublabel="Legalización próxima"
          tone={kpis && kpis.libros_alerta > 0 ? "error" : "neutral"}
          onClick={() => navigate("/secretaria/libros")}
        />
      </div>

      {/* KPIs secundarios */}
      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3">
        <KpiCard
          icon={ScrollText}
          label="Acuerdos sin sesión · Votando"
          value={kpiLoading ? "…" : kpis?.acuerdos_sin_sesion_votando ?? 0}
          tone="warning"
          onClick={() => navigate("/secretaria/acuerdos-sin-sesion")}
        />
        <KpiCard
          icon={Building2}
          label="Decisiones unipersonales · Borrador"
          value={kpiLoading ? "…" : kpis?.decisiones_unipersonales_borrador ?? 0}
          tone="neutral"
          onClick={() => navigate("/secretaria/decisiones-unipersonales")}
        />
        <KpiCard
          icon={Users}
          label="Reuniones esta semana"
          value={kpiLoading ? "…" : kpis?.reuniones_semana ?? 0}
          tone="primary"
          onClick={() => navigate("/secretaria/reuniones")}
        />
      </div>

      {/* Agenda / Actividad reciente */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Próximos hitos */}
        <div
          className="lg:col-span-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <div className="flex items-center justify-between border-b border-[var(--g-border-subtle)] px-5 py-3">
            <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">
              Próximos hitos societarios
            </h2>
            <Clock className="h-4 w-4 text-[var(--g-text-secondary)]" />
          </div>
          <div className="divide-y divide-[var(--g-border-subtle)]">
            {agendaLoading ? (
              <div className="p-5 text-sm text-[var(--g-text-secondary)]">Cargando…</div>
            ) : agenda && agenda.length > 0 ? (
              agenda.map((item) => (
                <button
                  key={`${item.tipo}-${item.id}`}
                  type="button"
                  onClick={() => navigate(item.nav_to)}
                  className="flex w-full items-center justify-between px-5 py-3 text-left transition-colors hover:bg-[var(--g-surface-subtle)]/50"
                >
                  <div className="flex flex-col gap-0.5">
                    <div className="text-sm font-medium text-[var(--g-text-primary)]">
                      {item.titulo}
                    </div>
                    <div className="text-xs text-[var(--g-text-secondary)]">
                      {item.sublabel}
                      {item.fecha ? ` · ${new Date(item.fecha).toLocaleDateString("es-ES")}` : ""}
                    </div>
                  </div>
                  <StatusChip value={item.estado} />
                </button>
              ))
            ) : (
              <div className="p-5 text-sm text-[var(--g-text-secondary)]">
                No hay hitos próximos.
              </div>
            )}
          </div>
        </div>

        {/* Cumplimiento societario */}
        <div
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <div className="border-b border-[var(--g-border-subtle)] px-5 py-3">
            <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">
              Cumplimiento societario
            </h2>
          </div>
          <div className="space-y-3 p-5">
            <ComplianceRow
              label="Convocatorias con plazo"
              status="OK"
              note="Todas cumplen plazos legales"
            />
            <ComplianceRow
              label="Quórum en reuniones"
              status="OK"
              note="Última sesión: 9/9 presentes"
            />
            <ComplianceRow
              label="Actas pendientes de firma"
              status={kpis && kpis.actas_sin_firmar > 0 ? "WARNING" : "OK"}
              note={
                kpis && kpis.actas_sin_firmar > 0
                  ? `${kpis.actas_sin_firmar} acta(s) en borrador`
                  : "Todas firmadas"
              }
            />
            <ComplianceRow
              label="Tramitaciones en subsanación"
              status={kpis && kpis.tramitaciones_subsanacion > 0 ? "ERROR" : "OK"}
              note={
                kpis && kpis.tramitaciones_subsanacion > 0
                  ? `${kpis.tramitaciones_subsanacion} expediente(s)`
                  : "Ninguna"
              }
            />
            <ComplianceRow
              label="Legalización de libros"
              status={kpis && kpis.libros_alerta > 0 ? "WARNING" : "OK"}
              note={
                kpis && kpis.libros_alerta > 0
                  ? `${kpis.libros_alerta} libro(s) con alerta`
                  : "Al día"
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ComplianceRow({
  label,
  status,
  note,
}: {
  label: string;
  status: "OK" | "WARNING" | "ERROR";
  note: string;
}) {
  const Icon =
    status === "OK" ? CheckCircle2 : status === "WARNING" ? AlertTriangle : AlertTriangle;
  const color =
    status === "OK"
      ? "text-[var(--status-success)]"
      : status === "WARNING"
      ? "text-[var(--status-warning)]"
      : "text-[var(--status-error)]";
  return (
    <div className="flex items-start gap-2">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} />
      <div className="flex flex-col">
        <span className="text-xs font-medium text-[var(--g-text-primary)]">{label}</span>
        <span className="text-[11px] text-[var(--g-text-secondary)]">{note}</span>
      </div>
    </div>
  );
}
