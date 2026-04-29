import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Building2 } from "lucide-react";
import { useDecisionUnipersById } from "@/hooks/useDecisionesUnipers";
import { statusLabel } from "@/lib/secretaria/status-labels";
import { ProcessDocxButton } from "@/components/secretaria/ProcessDocxButton";
import { useSecretariaScope } from "@/components/secretaria/shell";

function decisionTypeLabel(type: string) {
  if (type === "SOCIO_UNICO") return "Socio único";
  if (type === "ADMINISTRADOR_UNICO") return "Administrador único";
  return type;
}

function decisionAdoptionMode(type: string) {
  if (type === "SOCIO_UNICO") return "UNIPERSONAL_SOCIO";
  if (type === "ADMINISTRADOR_UNICO") return "UNIPERSONAL_ADMIN";
  return null;
}

function buildDecisionVariables(
  d: NonNullable<ReturnType<typeof useDecisionUnipersById>["data"]>,
  entity: string,
  jurisdiction: string,
  legalForm: string,
) {
  const adoptionMode = decisionAdoptionMode(d.decision_type);
  return {
    denominacion_social: entity,
    jurisdiccion: jurisdiction,
    tipo_social: legalForm,
    tipo_decision: decisionTypeLabel(d.decision_type),
    modo_adopcion: adoptionMode ?? "",
    titulo_acuerdo: d.title,
    contenido_acuerdo: d.content ?? "",
    texto_decision: d.content ?? "",
    fecha_decision: d.decision_date ?? "",
    fecha: d.decision_date ?? "",
    decisor: d.persons?.full_name ?? "",
    identidad_decisor: d.persons?.full_name ?? "",
    ciudad_emision: "",
    estado: statusLabel(d.status),
    requiere_registro: d.requires_registry ? "Sí" : "No",
  };
}

function buildDecisionFallback(
  d: NonNullable<ReturnType<typeof useDecisionUnipersById>["data"]>,
  entity: string,
  jurisdiction: string,
  legalForm: string,
) {
  return [
    "DECISION UNIPERSONAL",
    "",
    `Sociedad: ${entity}`,
    `Jurisdiccion: ${jurisdiction || "No consta"}`,
    `Tipo social: ${legalForm || "No consta"}`,
    `Tipo de decision: ${decisionTypeLabel(d.decision_type)}`,
    `Titulo: ${d.title}`,
    `Decisor: ${d.persons?.full_name ?? "No consta"}`,
    `Fecha: ${d.decision_date ? new Date(d.decision_date).toLocaleDateString("es-ES") : "No consta"}`,
    `Estado: ${statusLabel(d.status)}`,
    `Requiere registro: ${d.requires_registry ? "Si" : "No"}`,
    "",
    "CONTENIDO",
    d.content ?? "Sin texto de decision registrado.",
  ].join("\n");
}

export default function DecisionDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const scope = useSecretariaScope();
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
  const entity = d.entities?.common_name ?? "—";
  const jurisdiction = d.entities?.jurisdiction ?? "";
  const legalForm = d.entities?.legal_form ?? "";
  const docVariables = buildDecisionVariables(d, entity, jurisdiction, legalForm);
  const docFallback = buildDecisionFallback(d, entity, jurisdiction, legalForm);
  const adoptionMode = decisionAdoptionMode(d.decision_type);

  return (
    <div className="mx-auto max-w-[1200px] p-6">
      <button
        type="button"
        onClick={() => navigate(scope.createScopedTo("/secretaria/decisiones-unipersonales"))}
        className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--g-text-secondary)] hover:text-[var(--g-brand-3308)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver
      </button>

      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
            <Building2 className="h-3.5 w-3.5" />
            Decisión unipersonal · {decisionTypeLabel(d.decision_type)}
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
            {d.title}
          </h1>
          <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
            {entity} · {jurisdiction} · {legalForm}
          </p>
        </div>
        <ProcessDocxButton
          label="Decisión DOCX"
          variant="primary"
          input={{
            kind: "DECISION_UNIPERSONAL",
            recordId: d.id,
            title: `Decisión unipersonal: ${d.title}`,
            subtitle: entity,
            entityName: entity,
            templateTypes: ["ACTA_CONSIGNACION", "ACTA_ACUERDO_ESCRITO", "MODELO_ACUERDO"],
            variables: docVariables,
            templateCriteria: {
              jurisdiction,
              adoptionMode,
            },
            fallbackText: docFallback,
            filenamePrefix: "decision_unipersonal",
          }}
        />
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
            <KV label="Estado" value={statusLabel(d.status)} />
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
