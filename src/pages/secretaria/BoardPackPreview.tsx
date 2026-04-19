import { useParams, Link } from "react-router-dom";
import { ArrowLeft, FileText, Printer } from "lucide-react";
import { useBoardPackData } from "@/hooks/useBoardPackData";
import { BPPortada } from "@/components/board-pack/BPPortada";
import { BPAgenda } from "@/components/board-pack/BPAgenda";
import { BPAcuerdos } from "@/components/board-pack/BPAcuerdos";
import { BPRiesgos } from "@/components/board-pack/BPRiesgos";
import { BPObligaciones } from "@/components/board-pack/BPObligaciones";
import { BPHallazgos } from "@/components/board-pack/BPHallazgos";
import { BPIdoneidad } from "@/components/board-pack/BPIdoneidad";
import { BPDelegaciones } from "@/components/board-pack/BPDelegaciones";
import { BPSistemasIA } from "@/components/board-pack/BPSistemasIA";

// ─── Estados de carga / error ────────────────────────────────────────────────

function BoardPackSkeleton() {
  return (
    <div className="mx-auto max-w-4xl p-8 space-y-6 animate-pulse">
      <div className="h-10 w-64 rounded bg-[var(--g-surface-subtle)]" style={{ borderRadius: "var(--g-radius-md)" }} />
      <div className="h-40 w-full rounded bg-[var(--g-surface-subtle)]" style={{ borderRadius: "var(--g-radius-md)" }} />
      <div className="h-32 w-full rounded bg-[var(--g-surface-subtle)]" style={{ borderRadius: "var(--g-radius-md)" }} />
      <div className="h-48 w-full rounded bg-[var(--g-surface-subtle)]" style={{ borderRadius: "var(--g-radius-md)" }} />
    </div>
  );
}

function BoardPackError({ message }: { message?: string }) {
  return (
    <div className="mx-auto max-w-4xl p-8">
      <div
        className="flex flex-col items-center gap-4 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-12 text-center"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <FileText className="h-10 w-10 text-[var(--g-text-secondary)]" />
        <h2 className="text-lg font-semibold text-[var(--g-text-primary)]">
          No se pudo generar el Board Pack
        </h2>
        <p className="text-sm text-[var(--g-text-secondary)]">
          {message ?? "La reunión no existe o no tiene datos suficientes."}
        </p>
        <Link
          to="/secretaria/reuniones"
          className="inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a reuniones
        </Link>
      </div>
    </div>
  );
}


// ─── Página principal ────────────────────────────────────────────────────────

export default function BoardPackPreview() {
  const { id = "" } = useParams<{ id: string }>();
  const { data, isLoading, error } = useBoardPackData(id);

  if (isLoading) return <BoardPackSkeleton />;
  if (error || !data?.meeting) {
    return <BoardPackError message={error?.message} />;
  }

  return (
    <div className="min-h-screen bg-[var(--g-surface-page)]">
      {/* Barra de acciones — oculta al imprimir */}
      <div
        className="print:hidden sticky top-0 z-10 flex items-center justify-between border-b border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-6 py-3"
        style={{ boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="flex items-center gap-3">
          <Link
            to="/secretaria/reuniones"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--g-text-secondary)] transition-colors hover:text-[var(--g-text-primary)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Reuniones
          </Link>
          <span className="text-[var(--g-border-default)]">/</span>
          <span className="text-sm font-medium text-[var(--g-text-primary)]">Board Pack</span>
          <span className="text-[var(--g-border-default)]">/</span>
          <span className="text-sm text-[var(--g-text-secondary)]">
            {data.meeting.body?.name ?? "—"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-4 py-2 text-sm font-medium text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <Printer className="h-4 w-4" />
            Exportar PDF
          </button>
        </div>
      </div>

      {/* Contenido del Board Pack */}
      <div
        className="mx-auto my-6 max-w-4xl bg-[var(--g-surface-card)] p-8 print:my-0 print:max-w-none print:shadow-none"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        {/* Banner cotizada — DL-2 */}
        {data.cotizadaWarnings.length > 0 && (
          <div
            className="mb-6 border border-[var(--status-warning)] bg-[var(--g-surface-subtle)] p-3 text-sm text-[var(--g-text-primary)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <strong className="text-[var(--status-warning)]">⚠ Entidad cotizada:</strong>{" "}
            {data.cotizadaWarnings.join(" · ")}
          </div>
        )}

        {/* S1: Portada */}
        <BPPortada meeting={data.meeting} generatedAt={data.generatedAt} />

        {/* S2: Agenda */}
        <BPAgenda items={data.meeting.agenda_items} />

        {/* S3: Acuerdos */}
        <BPAcuerdos
          agreements={data.agreements}
          votoCalidadPresidente={data.meeting.body?.quorum_rule?.["voto_calidad_presidente"] === true}
        />

        {/* S4: Riesgos */}
        <BPRiesgos risks={data.risks} />

        {/* S5: Obligaciones */}
        <BPObligaciones obligations={data.obligations} />

        {/* S6: Hallazgos abiertos */}
        <BPHallazgos findings={data.findings} />

        {/* S7: Idoneidad F&P */}
        <BPIdoneidad attestations={data.attestations} />

        {/* S8: Delegaciones */}
        <BPDelegaciones delegations={data.delegations} />

        {/* S9: Sistemas IA — EU AI Act */}
        <BPSistemasIA aiSystems={data.aiSystems} />
      </div>
    </div>
  );
}
