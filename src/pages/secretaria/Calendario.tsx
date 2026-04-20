// Calendario de vencimientos — Sprint E (E-D7)
// Fuentes: convocatorias, libros, acuerdos sin sesión, mandatos (renovación)

import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Calendar, AlertTriangle, Clock, BookOpen, ScrollText, Users, Gavel } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";

type DeadlineKind =
  | "CONVOCATORIA"
  | "LEGALIZACION_LIBRO"
  | "VOTO_SIN_SESION"
  | "RENOVACION_MANDATO"
  | "TRAMITACION";

interface DeadlineItem {
  id: string;
  kind: DeadlineKind;
  label: string;
  sublabel: string;
  deadline: string;          // ISO date
  daysLeft: number;
  urgency: "critical" | "warning" | "normal";
  nav_to: string;
}

const KIND_META: Record<DeadlineKind, { icon: React.ElementType; color: string; label: string }> = {
  CONVOCATORIA:      { icon: Users,       color: "text-[var(--status-info)]",    label: "Convocatoria" },
  LEGALIZACION_LIBRO:{ icon: BookOpen,    color: "text-[var(--status-error)]",   label: "Legalización libro" },
  VOTO_SIN_SESION:   { icon: ScrollText,  color: "text-[var(--status-warning)]", label: "Votación sin sesión" },
  RENOVACION_MANDATO:{ icon: Users,       color: "text-[var(--g-brand-3308)]",   label: "Renovación mandato" },
  TRAMITACION:       { icon: Gavel,       color: "text-[var(--status-info)]",    label: "Tramitación registral" },
};

function daysFromNow(isoDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(isoDate);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function urgencyFor(days: number): DeadlineItem["urgency"] {
  if (days <= 7) return "critical";
  if (days <= 30) return "warning";
  return "normal";
}

function useCalendarioDeadlines() {
  return useQuery({
    queryKey: ["secretaria", "calendario"],
    queryFn: async (): Promise<DeadlineItem[]> => {
      const items: DeadlineItem[] = [];
      const today = new Date().toISOString();
      const en90 = new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0];

      const [convs, libros, asocs, mandates, filings] = await Promise.all([
        supabase
          .from("convocatorias")
          .select("id, fecha_1, estado, governing_bodies(name)")
          .gte("fecha_1", today)
          .lte("fecha_1", en90)
          .order("fecha_1", { ascending: true })
          .limit(20),
        supabase
          .from("mandatory_books")
          .select("id, book_type, legalization_deadline, status")
          .lte("legalization_deadline", en90)
          .not("status", "eq", "LEGALIZADO")
          .order("legalization_deadline", { ascending: true })
          .limit(10),
        supabase
          .from("no_session_resolutions")
          .select("id, title, voting_deadline, status")
          .eq("status", "VOTING_OPEN")
          .gte("voting_deadline", today)
          .order("voting_deadline", { ascending: true })
          .limit(10),
        supabase
          .from("mandates")
          .select("id, end_date, role, persons(full_name)")
          .eq("tenant_id", DEMO_TENANT)
          .gte("end_date", today)
          .lte("end_date", en90)
          .order("end_date", { ascending: true })
          .limit(10),
        supabase
          .from("registry_filings")
          .select("id, filing_number, filing_via, status, deadline")
          .in("status", ["EN_TRAMITE", "PRESENTADA", "SUBSANACION"])
          .not("deadline", "is", null)
          .lte("deadline", en90)
          .order("deadline", { ascending: true })
          .limit(10),
      ]);

      // Convocatorias
      ((convs.data ?? []) as any[]).forEach((c) => {
        if (!c.fecha_1) return;
        const days = daysFromNow(c.fecha_1);
        items.push({
          id: c.id,
          kind: "CONVOCATORIA",
          label: c.governing_bodies?.name ?? "Órgano",
          sublabel: c.estado ?? "",
          deadline: c.fecha_1,
          daysLeft: days,
          urgency: urgencyFor(days),
          nav_to: `/secretaria/convocatorias/${c.id}`,
        });
      });

      // Libros obligatorios
      ((libros.data ?? []) as any[]).forEach((b) => {
        if (!b.legalization_deadline) return;
        const days = daysFromNow(b.legalization_deadline);
        items.push({
          id: b.id,
          kind: "LEGALIZACION_LIBRO",
          label: b.book_type ?? "Libro obligatorio",
          sublabel: `Plazo: ${new Date(b.legalization_deadline).toLocaleDateString("es-ES")}`,
          deadline: b.legalization_deadline,
          daysLeft: days,
          urgency: urgencyFor(days),
          nav_to: "/secretaria/libros",
        });
      });

      // Acuerdos sin sesión — deadline de votación
      ((asocs.data ?? []) as any[]).forEach((a) => {
        if (!a.voting_deadline) return;
        const days = daysFromNow(a.voting_deadline);
        items.push({
          id: a.id,
          kind: "VOTO_SIN_SESION",
          label: a.title ?? "Acuerdo sin sesión",
          sublabel: "Cierre de votación",
          deadline: a.voting_deadline,
          daysLeft: days,
          urgency: urgencyFor(days),
          nav_to: `/secretaria/acuerdos-sin-sesion/${a.id}`,
        });
      });

      // Mandatos próximos a vencer
      ((mandates.data ?? []) as any[]).forEach((m) => {
        if (!m.end_date) return;
        const days = daysFromNow(m.end_date);
        const personName = (m.persons as any)?.full_name ?? "Consejero/a";
        items.push({
          id: m.id,
          kind: "RENOVACION_MANDATO",
          label: `${personName} — ${m.role ?? "Cargo"}`,
          sublabel: "Vencimiento de mandato",
          deadline: m.end_date,
          daysLeft: days,
          urgency: urgencyFor(days),
          nav_to: "/secretaria",
        });
      });

      // Tramitaciones con deadline
      ((filings.data ?? []) as any[]).forEach((f) => {
        if (!f.deadline) return;
        const days = daysFromNow(f.deadline);
        items.push({
          id: f.id,
          kind: "TRAMITACION",
          label: f.filing_number ?? "Tramitación",
          sublabel: `${f.filing_via ?? ""} · ${f.status}`.trim(),
          deadline: f.deadline,
          daysLeft: days,
          urgency: urgencyFor(days),
          nav_to: `/secretaria/tramitador/${f.id}`,
        });
      });

      return items.sort((a, b) => a.deadline.localeCompare(b.deadline));
    },
    staleTime: 120_000,
  });
}

function UrgencyBadge({ days }: { days: number }) {
  if (days < 0) {
    return (
      <span
        className="px-2 py-0.5 text-[10px] font-semibold bg-[var(--status-error)] text-[var(--g-text-inverse)]"
        style={{ borderRadius: "var(--g-radius-sm)" }}
      >
        Vencido
      </span>
    );
  }
  if (days === 0) {
    return (
      <span
        className="px-2 py-0.5 text-[10px] font-semibold bg-[var(--status-error)] text-[var(--g-text-inverse)]"
        style={{ borderRadius: "var(--g-radius-sm)" }}
      >
        Hoy
      </span>
    );
  }
  if (days <= 7) {
    return (
      <span
        className="px-2 py-0.5 text-[10px] font-semibold bg-[var(--status-warning)] text-[var(--g-text-inverse)]"
        style={{ borderRadius: "var(--g-radius-sm)" }}
      >
        {days}d
      </span>
    );
  }
  return (
    <span
      className="px-2 py-0.5 text-[10px] font-medium bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
      style={{ borderRadius: "var(--g-radius-sm)" }}
    >
      {days}d
    </span>
  );
}

function groupByWeek(items: DeadlineItem[]): Array<{ label: string; items: DeadlineItem[] }> {
  const groups: Record<string, DeadlineItem[]> = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  items.forEach((item) => {
    const d = new Date(item.deadline);
    d.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((d.getTime() - today.getTime()) / 86400000);
    let key: string;
    if (diffDays < 0) key = "Vencidos";
    else if (diffDays === 0) key = "Hoy";
    else if (diffDays <= 7) key = "Esta semana";
    else if (diffDays <= 14) key = "Próxima semana";
    else if (diffDays <= 30) key = "Este mes";
    else key = "Próximos 90 días";

    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });

  const order = ["Vencidos", "Hoy", "Esta semana", "Próxima semana", "Este mes", "Próximos 90 días"];
  return order.filter((k) => groups[k]).map((k) => ({ label: k, items: groups[k] }));
}

export default function Calendario() {
  const navigate = useNavigate();
  const { data: deadlines = [], isLoading } = useCalendarioDeadlines();

  const groups = groupByWeek(deadlines);
  const criticalCount = deadlines.filter((d) => d.urgency === "critical").length;
  const warningCount = deadlines.filter((d) => d.urgency === "warning").length;

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
          <Calendar className="h-3.5 w-3.5" />
          Secretaría · Calendario
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
          Calendario de vencimientos
        </h1>
        <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
          Próximos 90 días — convocatorias, legalizaciones de libros, plazos de votación y renovaciones de mandato.
        </p>
      </div>

      {/* Summary bar */}
      {!isLoading && (
        <div className="mb-6 flex flex-wrap gap-3">
          {criticalCount > 0 && (
            <div
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-[var(--status-error)]/10 text-[var(--status-error)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <AlertTriangle className="h-4 w-4" />
              {criticalCount} plazo(s) urgente(s) — menos de 7 días
            </div>
          )}
          {warningCount > 0 && (
            <div
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-[var(--status-warning)]/10 text-[var(--status-warning)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <Clock className="h-4 w-4" />
              {warningCount} plazo(s) en los próximos 30 días
            </div>
          )}
          {criticalCount === 0 && warningCount === 0 && deadlines.length > 0 && (
            <div
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-[var(--status-success)]"
              style={{ borderRadius: "var(--g-radius-md)", background: "hsl(var(--status-success) / 0.08)" }}
            >
              Sin plazos urgentes en los próximos 30 días
            </div>
          )}
        </div>
      )}

      {/* Timeline */}
      {isLoading ? (
        <div className="text-sm text-[var(--g-text-secondary)]">Cargando calendario…</div>
      ) : deadlines.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-3 p-12 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
          style={{ borderRadius: "var(--g-radius-lg)" }}
        >
          <Calendar className="h-10 w-10 text-[var(--g-text-secondary)] opacity-40" />
          <p className="text-sm text-[var(--g-text-secondary)]">Sin vencimientos en los próximos 90 días.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.label}>
              {/* Group header */}
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
                  {group.label}
                </span>
                <span
                  className="px-2 py-0.5 text-[10px] font-medium bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
                  style={{ borderRadius: "var(--g-radius-sm)" }}
                >
                  {group.items.length}
                </span>
              </div>

              {/* Items */}
              <div
                className="overflow-hidden border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
                style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
              >
                {group.items.map((item, i) => {
                  const meta = KIND_META[item.kind];
                  const Icon = meta.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => navigate(item.nav_to)}
                      className={`flex w-full items-center justify-between px-5 py-3 text-left transition-colors hover:bg-[var(--g-surface-subtle)]/50 ${
                        i > 0 ? "border-t border-[var(--g-border-subtle)]" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center ${meta.color}`}
                          style={{ background: "var(--g-surface-subtle)", borderRadius: "var(--g-radius-sm)" }}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-[var(--g-text-primary)]">
                            {item.label}
                          </div>
                          <div className="text-xs text-[var(--g-text-secondary)]">
                            <span
                              className="mr-1.5 text-[10px] font-medium text-[var(--g-text-secondary)] uppercase tracking-wide"
                            >
                              {meta.label}
                            </span>
                            · {item.sublabel}
                            {" · "}
                            {new Date(item.deadline).toLocaleDateString("es-ES", {
                              weekday: "short",
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </div>
                        </div>
                      </div>
                      <UrgencyBadge days={item.daysLeft} />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
