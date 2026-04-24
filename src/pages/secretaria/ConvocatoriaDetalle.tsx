import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Calendar, MapPin, FileText, Paperclip, Shield, CalendarPlus } from "lucide-react";
import { useConvocatoriaById, useConvocatoriaAttachments } from "@/hooks/useConvocatorias";
import { statusLabel } from "@/lib/secretaria/status-labels";

function generateIcs(convocatoria: {
  title: string;
  meeting_date: string;
  start_time?: string | null;
  location?: string | null;
  body_name?: string | null;
}): string {
  const dt = new Date(convocatoria.meeting_date);
  const dateStr = dt.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const uid = `convocatoria-${Date.now()}@arga-seguros.com`;
  const summary = convocatoria.title ?? "Reunión " + (convocatoria.body_name ?? "");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TGMS//Secretaría Societaria//ES",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dateStr}`,
    `DTSTART:${dateStr}`,
    `SUMMARY:${summary}`,
    convocatoria.location ? `LOCATION:${convocatoria.location}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
}

function downloadIcs(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ConvocatoriaDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: conv, isLoading } = useConvocatoriaById(id);
  const { data: attachments } = useConvocatoriaAttachments(id);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1200px] p-6 text-sm text-[var(--g-text-secondary)]">
        Cargando…
      </div>
    );
  }

  if (!conv) {
    return (
      <div className="mx-auto max-w-[1200px] p-6">
        <div className="text-sm text-[var(--g-text-secondary)]">Convocatoria no encontrada.</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] p-6">
      <button
        type="button"
        onClick={() => navigate("/secretaria/convocatorias")}
        className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--g-text-secondary)] hover:text-[var(--g-brand-3308)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al listado
      </button>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
            Convocatoria · {statusLabel(conv.estado)}
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
            {conv.body_name ?? "Órgano"}
          </h1>
          <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
            {conv.entity_name ?? "—"}
            {conv.jurisdiction ? ` · ${conv.jurisdiction}` : ""}
            {conv.legal_form ? ` · ${conv.legal_form}` : ""}
          </p>
        </div>
        {conv.fecha_1 ? (
          <button
            type="button"
            onClick={() => {
              const ics = generateIcs({
                title: `${conv.body_name ?? "Reunión"} — ${conv.entity_name ?? ""}`,
                meeting_date: conv.fecha_1!,
                location: null,
                body_name: conv.body_name,
              });
              downloadIcs(ics, `convocatoria-${conv.id}.ics`);
            }}
            className="inline-flex shrink-0 items-center gap-2 text-sm text-[var(--g-text-secondary)] hover:text-[var(--g-text-primary)] transition-colors"
          >
            <CalendarPlus className="h-4 w-4" />
            Añadir a calendario
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card title="Datos de la convocatoria" icon={Calendar}>
            <KV label="Fecha de emisión" value={conv.fecha_emision ? new Date(conv.fecha_emision).toLocaleDateString("es-ES") : "—"} />
            <KV label="Fecha 1ª convocatoria" value={conv.fecha_1 ? new Date(conv.fecha_1).toLocaleString("es-ES") : "—"} />
            <KV label="Fecha 2ª convocatoria" value={conv.fecha_2 ? new Date(conv.fecha_2).toLocaleString("es-ES") : "—"} />
            <KV label="Modalidad" value={conv.modalidad ?? "—"} />
            <KV label="Junta universal" value={conv.junta_universal ? "Sí" : "No"} />
            <KV label="2ª convocatoria reforzada" value={conv.is_second_call ? "Sí" : "No"} />
            <KV label="Urgente" value={conv.urgente ? "Sí" : "No"} />
            <KV label="Fundamento estatutario" value={conv.statutory_basis ?? "—"} />
          </Card>

          <Card title="Canales de publicación" icon={MapPin}>
            {conv.publication_channels && conv.publication_channels.length > 0 ? (
              <ul className="space-y-1 text-sm text-[var(--g-text-secondary)]">
                {conv.publication_channels.map((ch) => (
                  <li key={ch}>· {ch}</li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-[var(--g-text-secondary)]">Sin canales registrados.</div>
            )}
            {conv.publication_evidence_url ? (
              <a
                href={conv.publication_evidence_url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-sm text-[var(--g-link)] hover:text-[var(--g-link-hover)]"
              >
                <FileText className="h-3.5 w-3.5" />
                Evidencia de publicación
              </a>
            ) : null}
          </Card>

          <Card title="Adjuntos" icon={Paperclip}>
            {attachments && attachments.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {attachments.map((a) => (
                  <li key={a.id}>
                    <a
                      href={a.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[var(--g-link)] hover:text-[var(--g-link-hover)]"
                    >
                      {a.file_name}
                    </a>
                    {a.file_hash ? (
                      <span className="ml-2 font-mono text-[11px] text-[var(--g-text-secondary)]">
                        {a.file_hash.slice(0, 12)}…
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-[var(--g-text-secondary)]">Sin adjuntos.</div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Trazabilidad" icon={Shield}>
            <KV label="Creada" value={new Date(conv.created_at).toLocaleString("es-ES")} />
            <KV label="Actualizada" value={new Date(conv.updated_at).toLocaleString("es-ES")} />
            <KV
              label="Inmutable desde"
              value={conv.immutable_at ? new Date(conv.immutable_at).toLocaleString("es-ES") : "—"}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}

function Card({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div
      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <div className="flex items-center gap-2 border-b border-[var(--g-border-subtle)] px-5 py-3">
        <Icon className="h-4 w-4 text-[var(--g-brand-3308)]" />
        <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-start justify-between gap-4 text-sm last:mb-0">
      <span className="text-[var(--g-text-secondary)]">{label}</span>
      <span className="font-medium text-[var(--g-text-primary)]">{value}</span>
    </div>
  );
}
