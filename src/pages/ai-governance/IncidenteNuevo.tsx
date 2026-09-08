import { FormEvent, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, ChevronLeft, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAiSystemsList } from "@/hooks/useAiSystems";
import { useCreateAiIncident, type AiIncident } from "@/hooks/useAiIncidents";
import FormularioIncidente, {
  type FormState,
} from "@/components/ai-governance/incidente/FormularioIncidente";

/** `""` es NO DECLARADO y no es lo mismo que «no». */
const aBooleano = (v: string): boolean | null => (v === "SI" ? true : v === "NO" ? false : null);

const emptyToNull = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const nowForInput = () => new Date().toISOString().slice(0, 16);

export default function IncidenteNuevo() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const createIncident = useCreateAiIncident();
  const { data: systems = [], isLoading: loadingSystems } = useAiSystemsList();
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState<FormState>({
    system_id: params.get("system_id") ?? "",
    title: "",
    severity: "ALTO",
    status: "ABIERTO",
    reported_at: nowForInput(),
    description: "",
    incident_type: "",
    knowledge_at: nowForInput(),
    ria_severity: "ORDINARY_SERIOUS",
    afecta_datos: "",
    alto_riesgo_interesados: "",
    affected_count: "",
    ict: "",
    root_cause: "",
    corrective_action: "",
  });

  const errors = useMemo(() => {
    if (!submitted) return { title: "", system_id: "" };
    return {
      title: form.title.trim().length < 3 ? "El título debe tener al menos 3 caracteres." : "",
      system_id: form.system_id ? "" : "Selecciona el sistema IA afectado.",
    };
  }, [form.system_id, form.title, submitted]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);

    if (form.title.trim().length < 3 || !form.system_id) {
      toast.error("Revisa los campos obligatorios.");
      return;
    }

    const payload: Partial<AiIncident> = {
      system_id: form.system_id,
      title: form.title.trim(),
      severity: form.severity,
      status: form.status,
      reported_at: new Date(form.reported_at).toISOString(),
      description: emptyToNull(form.description),
      root_cause: emptyToNull(form.root_cause),
      corrective_action: emptyToNull(form.corrective_action),
      // Perímetro regulatorio. Lo que aquí se declare enciende o apaga los
      // relojes de la ficha: nada se presume.
      incident_type: emptyToNull(form.incident_type),
      knowledge_at: form.knowledge_at ? new Date(form.knowledge_at).toISOString() : null,
      ria_severity: emptyToNull(form.ria_severity),
      affects_personal_data: aBooleano(form.afecta_datos),
      high_risk_to_subjects: aBooleano(form.alto_riesgo_interesados),
      affected_count: form.affected_count.trim() === "" ? null : Number(form.affected_count),
      ict_related: aBooleano(form.ict),
      affects_critical_function: aBooleano(form.ict),
    };

    try {
      const created = await createIncident.mutateAsync(payload);
      toast.success("Incidente IA registrado en AIMS.");
      navigate(created.system_id ? `/ai-governance/sistemas/${created.system_id}` : "/ai-governance/incidentes");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`No se pudo registrar el incidente: ${message}`);
    }
  };

  return (
    <div className="p-6 max-w-[920px] mx-auto">
      <button
        type="button"
        onClick={() => navigate("/ai-governance/incidentes")}
        className="mb-4 flex items-center gap-1.5 text-sm text-[var(--g-text-secondary)] transition-colors hover:text-[var(--g-brand-3308)]"
      >
        <ChevronLeft className="h-4 w-4" />
        Incidentes IA
      </button>

      <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-5 w-5 text-[var(--status-error)]" />
            <h1 className="text-xl font-bold text-[var(--g-text-primary)]">
              Nuevo incidente IA
            </h1>
          </div>
          <p className="text-sm text-[var(--g-text-secondary)]">
            Registro owner de AIMS; cualquier escalado a GRC o Secretaría se mantiene como handoff read-only.
          </p>
        </div>
        <div
          className="inline-flex items-center gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-3 py-2 text-xs font-semibold text-[var(--g-text-primary)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <ShieldCheck className="h-4 w-4 text-[var(--g-brand-3308)]" />
          legacy_write · ai_incidents
        </div>
      </header>

      <form
        onSubmit={handleSubmit}
        className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)]"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="border-b border-[var(--g-border-subtle)] px-6 py-4">
          <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">
            Señal, severidad y cierre operativo
          </h2>
        </div>

        <FormularioIncidente
          form={form}
          set={set}
          errors={errors}
          systems={systems}
          loadingSystems={loadingSystems}
        />

        <div className="flex flex-col-reverse gap-3 border-t border-[var(--g-border-subtle)] px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => navigate("/ai-governance/incidentes")}
            className="inline-flex items-center justify-center border border-[var(--g-border-subtle)] bg-transparent px-4 py-2 text-sm font-medium text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            aria-busy={createIncident.isPending}
            disabled={createIncident.isPending}
            className="inline-flex items-center justify-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] disabled:cursor-not-allowed disabled:opacity-70"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <Save className="h-4 w-4" />
            {createIncident.isPending ? "Registrando..." : "Registrar incidente"}
          </button>
        </div>
      </form>
    </div>
  );
}
