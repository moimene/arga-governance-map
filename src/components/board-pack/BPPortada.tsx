import { BoardPackMeeting } from "@/hooks/useBoardPackData";

interface BPPortadaProps {
  meeting: BoardPackMeeting;
  generatedAt: string;
}

const MONTH_NAMES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function formatMeetingDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return `${d.getDate()} de ${MONTH_NAMES[d.getMonth()]} de ${d.getFullYear()}`;
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

const STATUS_CHIP: Record<string, string> = {
  CONVOCADA: "bg-[var(--status-info)] text-[var(--g-text-inverse)]",
  CELEBRADA: "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  EN_CURSO:  "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  BORRADOR:  "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]",
};

export function BPPortada({ meeting, generatedAt }: BPPortadaProps) {
  return (
    <div className="mb-8 pb-8 border-b-2 border-[var(--g-brand-3308)]">
      {/* Cabecera institucional */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
            Grupo ARGA Seguros
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[var(--g-text-primary)]">
            Board Pack
          </h1>
          <p className="mt-1 text-lg text-[var(--g-text-secondary)]">
            {meeting.body?.name ?? "Órgano de gobierno"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold text-[var(--g-text-primary)]">
            {formatMeetingDate(meeting.scheduled_start)}
          </p>
          <p className="text-sm text-[var(--g-text-secondary)]">
            {formatTime(meeting.scheduled_start)}
            {meeting.location ? ` · ${meeting.location}` : ""}
          </p>
          <span
            className={`mt-2 inline-flex items-center px-2 py-0.5 text-[11px] font-medium ${
              STATUS_CHIP[meeting.status] ??
              "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]"
            }`}
            style={{ borderRadius: "var(--g-radius-sm)" }}
          >
            {meeting.status}
          </span>
        </div>
      </div>

      {/* Ficha de convocatoria */}
      <div
        className="mt-6 grid grid-cols-2 gap-4 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] p-4"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
            Entidad
          </p>
          <p className="mt-0.5 text-sm text-[var(--g-text-primary)]">
            {meeting.body?.entity_name ?? "—"}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
            Tipo de sesión
          </p>
          <p className="mt-0.5 text-sm text-[var(--g-text-primary)]">
            {meeting.meeting_type}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
            Presidente/a
          </p>
          <p className="mt-0.5 text-sm text-[var(--g-text-primary)]">
            {meeting.president?.full_name ?? "—"}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--g-text-secondary)]">
            Secretario/a
          </p>
          <p className="mt-0.5 text-sm text-[var(--g-text-primary)]">
            {meeting.secretary?.full_name ?? "—"}
          </p>
        </div>
      </div>

      <p className="mt-4 text-[11px] text-[var(--g-text-secondary)]">
        Generado el {new Date(generatedAt).toLocaleString("es-ES")} · Datos en tiempo real · TGMS Platform
      </p>
    </div>
  );
}
