import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Building2 } from "lucide-react";
import { useDecisionUnipersById } from "@/hooks/useDecisionesUnipers";

export default function DecisionDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useDecisionUnipersById(id);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1200px] p-6 text-sm text-[var(--g-text-secondary)]">
        Cargando…
      </div>
    );
  }
  if (!data) {
    return (
      <div className="mx-auto max-w-[1200px] p-6 text-sm text-[var(--g-text-secondary)]">
        Decisión no encontrada.
      </div>
    );
  }
  const d = data;

  return (
    <div className="mx-auto max-w-[1200px] p-6">
      <button
        type="button"
        onClick={() => navigate("/secretaria/decisiones-unipersonales")}
        className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--g-text-secondary)] hover:text-[var(--g-brand-3308)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver
      </button>

      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
          <Building2 className="h-3.5 w-3.5" />
          Decisión unipersonal · {d.decision_type}
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
          {d.title}
        </h1>
        <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
          {d.entities?.common_name ?? "—"} · {d.entities?.jurisdiction ?? ""} ·{" "}
          {d.entities?.legal_form ?? ""}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div
          className="lg:col-span-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <div className="border-b border-[var(--g-border-subtle)] px-5 py-3">
            <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">Texto de la decisión</h2>
          </div>
          <div className="p-5">
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-[var(--g-text-primary)]">
              {d.content ?? "— Sin texto —"}
            </pre>
          </div>
        </div>

        <div
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <div className="border-b border-[var(--g-border-subtle)] px-5 py-3">
            <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">Metadatos</h2>
          </div>
          <div className="space-y-2 p-5 text-sm">
            <KV label="Decisor" value={d.persons?.full_name ?? "—"} />
            <KV
              label="Fecha decisión"
              value={d.decision_date ? new Date(d.decision_date).toLocaleDateString("es-ES") : "—"}
            />
            <KV label="Estado" value={d.status} />
            <KV label="Requiere registro" value={d.requires_registry ? "Sí" : "No"} />
            <KV label="Creada" value={new Date(d.created_at).toLocaleString("es-ES")} />
          </div>
        </div>
      </div>
    </div>
  );
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-[var(--g-text-secondary)]">{label}</span>
      <span className="font-medium text-[var(--g-text-primary)]">{value}</span>
    </div>
  );
}
