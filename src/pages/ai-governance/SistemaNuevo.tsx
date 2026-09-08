import { FormEvent, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Cpu, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import ClasificacionGuiada, {
  type ClasificacionConfirmada,
} from "@/components/ai-governance/clasificacion/ClasificacionGuiada";
import ResumenClasificacionConfirmada from "@/components/ai-governance/clasificacion/ResumenClasificacionConfirmada";
import { usePersonasCanonical } from "@/hooks/usePersonasCanonical";
import { aPayloadCuestionario, useRegistrarSistemaClasificado } from "@/hooks/useAimsClasificacion";
import { type Respuestas } from "@/lib/aims/cuestionario-calificacion";
import { ESTADOS_SISTEMA, etiqueta } from "@/lib/aims/vocabulario";

/**
 * Alta de un sistema de IA.
 *
 * El rol y el nivel NO se eligen aquí: los deriva el cuestionario guiado a
 * partir de las preguntas del Reglamento, y esta pantalla sólo recoge lo que
 * confirmó. Antes había un desplegable de nivel con «Alto» preseleccionado y un
 * radio de rol: dos calificaciones jurídicas puestas a mano en un formulario.
 *
 * Sin clasificación confirmada no hay alta, y el alta entera va por
 * `fn_aims_registrar_sistema`: sistema y cuestionario en la misma transacción,
 * con el tenant de la sesión. El borrador no se persiste — vive en memoria
 * hasta que se registra.
 */

type FormState = {
  name: string;
  system_type: string;
  vendor: string;
  deployment_date: string;
  status: string;
  use_case: string;
  description: string;
  owner_id: string;
};

const INPUT_CLASSES =
  "h-10 w-full px-3 text-sm bg-[var(--g-surface-card)] text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)]/60 border border-[var(--g-border-subtle)] focus:border-[var(--g-brand-3308)] focus:outline-none transition-colors";

const TEXTAREA_CLASSES =
  "w-full px-3 py-2 text-sm bg-[var(--g-surface-card)] text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)]/60 border border-[var(--g-border-subtle)] focus:border-[var(--g-brand-3308)] focus:outline-none transition-colors resize-none";

const SELECT_CLASSES =
  "h-10 w-full px-3 text-sm bg-[var(--g-surface-card)] text-[var(--g-text-primary)] border border-[var(--g-border-subtle)] focus:border-[var(--g-brand-3308)] focus:outline-none transition-colors";

const LABEL_CLASSES = "block text-sm font-medium text-[var(--g-text-primary)] mb-1";

const BOTON_SECUNDARIO =
  "inline-flex items-center justify-center border border-[var(--g-border-subtle)] bg-transparent px-4 py-2 text-sm font-medium text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)]";

const emptyToNull = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export default function SistemaNuevo() {
  const navigate = useNavigate();
  const registrar = useRegistrarSistemaClasificado();
  const { data: personas = [] } = usePersonasCanonical({ person_type: "PF" });
  const bloqueRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState<FormState>({
    name: "",
    system_type: "Modelo predictivo",
    vendor: "",
    deployment_date: "",
    status: "EN_EVALUACION",
    use_case: "",
    description: "",
    owner_id: "",
  });
  const [borrador, setBorrador] = useState<{ respuestas: Respuestas; justificacion: string }>({
    respuestas: {},
    justificacion: "",
  });
  const [confirmada, setConfirmada] = useState<ClasificacionConfirmada | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const nameError = useMemo(() => {
    if (!submitted) return "";
    if (form.name.trim().length < 3) return "El nombre debe tener al menos 3 caracteres.";
    return "";
  }, [form.name, submitted]);

  /** Lo que impide guardar. La calificación la juzga el cuestionario, no esta lista. */
  const bloqueos = useMemo(() => {
    const b: string[] = [];
    if (form.name.trim().length < 3) b.push("Falta el nombre del sistema.");
    if (!confirmada) b.push("Falta confirmar la clasificación guiada.");
    return b;
  }, [form.name, confirmada]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const hayRespuestas = Object.keys(borrador.respuestas).length > 0;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);

    if (bloqueos.length > 0 || !confirmada) {
      toast.error(bloqueos[0] ?? "Falta confirmar la clasificación guiada.");
      return;
    }

    try {
      const fila = await registrar.mutateAsync({
        sistema: {
          name: form.name.trim(),
          system_type: emptyToNull(form.system_type),
          vendor: emptyToNull(form.vendor),
          deployment_date: emptyToNull(form.deployment_date),
          status: form.status,
          use_case: emptyToNull(form.use_case),
          description: emptyToNull(form.description),
          owner_id: emptyToNull(form.owner_id),
        },
        cuestionario: aPayloadCuestionario(confirmada),
      });
      toast.success("Sistema registrado con su clasificación guiada.");
      navigate(`/ai-governance/sistemas/${fila.system_id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`No se pudo registrar el sistema: ${message}`);
    }
  };

  const resultado = confirmada?.resultado;

  return (
    <div className="p-6 max-w-[920px] mx-auto">
      <button
        type="button"
        onClick={() => navigate("/ai-governance/sistemas")}
        className="mb-4 flex items-center gap-1.5 text-sm text-[var(--g-text-secondary)] transition-colors hover:text-[var(--g-brand-3308)]"
      >
        <ChevronLeft className="h-4 w-4" />
        Inventario de Sistemas IA
      </button>

      <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Cpu className="h-5 w-5 text-[var(--g-brand-3308)]" />
            <h1 className="text-xl font-bold text-[var(--g-text-primary)]">Nuevo sistema IA</h1>
          </div>
          <p className="text-sm text-[var(--g-text-secondary)]">
            El alta no se guarda sin clasificación guiada confirmada.
          </p>
        </div>
        <div
          className="inline-flex items-center gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-3 py-2 text-xs font-semibold text-[var(--g-text-primary)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <ShieldCheck className="h-4 w-4 text-[var(--g-brand-3308)]" />
          Sistema y cuestionario en una sola transacción
        </div>
      </header>

      <form
        onSubmit={handleSubmit}
        className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)]"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="border-b border-[var(--g-border-subtle)] px-6 py-4">
          <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">
            Identificación del sistema
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-5 p-6 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="ai-system-name" className={LABEL_CLASSES}>
              Nombre del sistema *
            </label>
            <input
              id="ai-system-name"
              type="text"
              value={form.name}
              onChange={(event) => set("name", event.target.value)}
              placeholder="Ej. Motor de tarificación predictiva"
              aria-invalid={!!nameError}
              aria-describedby={nameError ? "ai-system-name-error" : undefined}
              className={INPUT_CLASSES}
              style={{ borderRadius: "var(--g-radius-md)" }}
            />
            {nameError && (
              <p id="ai-system-name-error" className="mt-1 text-xs text-[var(--status-error)]">
                {nameError}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="ai-system-type" className={LABEL_CLASSES}>
              Tipo
            </label>
            <select
              id="ai-system-type"
              value={form.system_type}
              onChange={(event) => set("system_type", event.target.value)}
              className={SELECT_CLASSES}
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <option value="Modelo predictivo">Modelo predictivo</option>
              <option value="Asistente generativo">Asistente generativo</option>
              <option value="Scoring automatizado">Scoring automatizado</option>
              <option value="Motor de decisión">Motor de decisión</option>
              <option value="Monitorización">Monitorización</option>
            </select>
          </div>

          <div>
            <label htmlFor="ai-owner" className={LABEL_CLASSES}>
              Responsable del sistema
            </label>
            <select
              id="ai-owner"
              value={form.owner_id}
              onChange={(event) => set("owner_id", event.target.value)}
              className={SELECT_CLASSES}
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <option value="">Sin asignar</option>
              {personas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
              Sin responsable no hay a quién atribuir la rendición de cuentas del sistema.
            </p>
          </div>

          <div>
            <label htmlFor="ai-vendor" className={LABEL_CLASSES}>
              Vendor / proveedor
            </label>
            <input
              id="ai-vendor"
              type="text"
              value={form.vendor}
              onChange={(event) => set("vendor", event.target.value)}
              placeholder="Equipo interno, proveedor o plataforma"
              className={INPUT_CLASSES}
              style={{ borderRadius: "var(--g-radius-md)" }}
            />
          </div>

          <div>
            <label htmlFor="ai-deployment-date" className={LABEL_CLASSES}>
              Fecha de despliegue
            </label>
            <input
              id="ai-deployment-date"
              type="date"
              value={form.deployment_date}
              onChange={(event) => set("deployment_date", event.target.value)}
              className={INPUT_CLASSES}
              style={{ borderRadius: "var(--g-radius-md)" }}
            />
          </div>

          <div>
            <label htmlFor="ai-status" className={LABEL_CLASSES}>
              Estado
            </label>
            <select
              id="ai-status"
              value={form.status}
              onChange={(event) => set("status", event.target.value)}
              className={SELECT_CLASSES}
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              {ESTADOS_SISTEMA.map((v) => (
                <option key={v} value={v}>{etiqueta("estadoSistema", v)}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="ai-use-case" className={LABEL_CLASSES}>
              Caso de uso
            </label>
            <textarea
              id="ai-use-case"
              value={form.use_case}
              onChange={(event) => set("use_case", event.target.value)}
              placeholder="Describe el uso operativo del sistema"
              rows={3}
              className={TEXTAREA_CLASSES}
              style={{ borderRadius: "var(--g-radius-md)" }}
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="ai-description" className={LABEL_CLASSES}>
              Descripción técnica
            </label>
            <textarea
              id="ai-description"
              value={form.description}
              onChange={(event) => set("description", event.target.value)}
              placeholder="Alcance, datos usados, supervisión humana o límites conocidos"
              rows={4}
              className={TEXTAREA_CLASSES}
              style={{ borderRadius: "var(--g-radius-md)" }}
            />
          </div>
        </div>

        <div className="border-t border-[var(--g-border-subtle)] px-6 py-4">
          <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">
            Clasificación guiada de calificación regulatoria *
          </h2>
          <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
            El rol, el nivel, los marcos y el perfil se derivan de las respuestas. No se eligen.
          </p>
        </div>

        <div className="px-6 pb-6" ref={bloqueRef} tabIndex={-1}>
          {confirmada && resultado ? (
            <ResumenClasificacionConfirmada
              resultado={resultado}
              onVolverAClasificar={() => setConfirmada(null)}
            />
          ) : (
            <ClasificacionGuiada
              modo="alta"
              respuestasIniciales={borrador.respuestas}
              justificacionInicial={borrador.justificacion}
              tieneOwner={!!form.owner_id}
              onCambio={(respuestas, justificacion) => setBorrador({ respuestas, justificacion })}
              onConfirmar={(c) => {
                setBorrador({ respuestas: c.respuestas, justificacion: c.justificacionArt63 });
                setConfirmada(c);
              }}
            />
          )}

          {submitted && bloqueos.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-[var(--status-error)]" role="alert">
              {bloqueos.map((b) => (
                <li key={b}>· {b}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-[var(--g-border-subtle)] px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => navigate("/ai-governance/sistemas")}
            className={BOTON_SECUNDARIO}
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            Cancelar
          </button>
          {confirmada ? (
            <button
              type="submit"
              aria-busy={registrar.isPending}
              disabled={registrar.isPending}
              className="inline-flex items-center justify-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] disabled:cursor-not-allowed disabled:opacity-70"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <Save className="h-4 w-4" />
              {registrar.isPending ? "Registrando..." : "Registrar sistema"}
            </button>
          ) : (
            /* Sin clasificación confirmada el submit no existe: este botón sólo
               lleva al cuestionario. El bloqueo de `handleSubmit` se queda
               igualmente, porque un formulario también se envía con Intro. */
            <button
              type="button"
              onClick={() => bloqueRef.current?.focus()}
              className="inline-flex items-center justify-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              {hayRespuestas ? "Continuar clasificación" : "Iniciar clasificación guiada"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
