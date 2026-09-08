import { FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ChevronLeft, Cpu, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useCreateAiSystem, type AiSystem } from "@/hooks/useAiSystems";
import { usePersonasCanonical } from "@/hooks/usePersonasCanonical";
import { useAuth } from "@/context/AuthContext";
import { ESTADOS_SISTEMA, etiqueta } from "@/lib/aims/vocabulario";
import {
  PREGUNTAS_CLASIFICACION,
  PREGUNTAS_ROL,
  ROLES_REGULATORIOS,
  clasificacionCompleta,
  exigeMotivacionArt63,
  proponerNivel,
  rolQueImponeElArt25,
  type NivelRiesgo,
  type RespuestasClasificacion,
  type RolRegulatorio,
} from "@/lib/aims/rol-regulatorio";

type FormState = {
  name: string;
  system_type: string;
  risk_level: string;
  vendor: string;
  deployment_date: string;
  status: string;
  use_case: string;
  description: string;
  owner_id: string;
  regulatory_role: RolRegulatorio | "";
  motivacion: string;
};

const INPUT_CLASSES =
  "h-10 w-full px-3 text-sm bg-[var(--g-surface-card)] text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)]/60 border border-[var(--g-border-subtle)] focus:border-[var(--g-brand-3308)] focus:outline-none transition-colors";

const TEXTAREA_CLASSES =
  "w-full px-3 py-2 text-sm bg-[var(--g-surface-card)] text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)]/60 border border-[var(--g-border-subtle)] focus:border-[var(--g-brand-3308)] focus:outline-none transition-colors resize-none";

const SELECT_CLASSES =
  "h-10 w-full px-3 text-sm bg-[var(--g-surface-card)] text-[var(--g-text-primary)] border border-[var(--g-border-subtle)] focus:border-[var(--g-brand-3308)] focus:outline-none transition-colors";

const LABEL_CLASSES = "block text-sm font-medium text-[var(--g-text-primary)] mb-1";

const emptyToNull = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export default function SistemaNuevo() {
  const navigate = useNavigate();
  const createSystem = useCreateAiSystem();
  const { user } = useAuth();
  const { data: personas = [] } = usePersonasCanonical({ person_type: "PF" });
  const [form, setForm] = useState<FormState>({
    name: "",
    system_type: "Modelo predictivo",
    // Sin preselección: venía en «Alto» y la clasificación la propone ahora el
    // cuestionario a partir de los artículos, no un valor por defecto.
    risk_level: "",
    vendor: "",
    deployment_date: "",
    status: "EN_EVALUACION",
    use_case: "",
    description: "",
    owner_id: "",
    regulatory_role: "",
    motivacion: "",
  });
  const [preguntasRol, setPreguntasRol] = useState<Record<string, boolean | undefined>>({});
  const [respuestas, setRespuestas] = useState<RespuestasClasificacion>({});
  const [submitted, setSubmitted] = useState(false);

  const completa = clasificacionCompleta(respuestas);
  const propuesta = useMemo(() => proponerNivel(respuestas), [respuestas]);
  const nivelElegido = (form.risk_level || (completa ? propuesta.nivel : "")) as NivelRiesgo | "";
  const necesitaArt63 = exigeMotivacionArt63(respuestas, nivelElegido);
  const avisoArt25 = form.regulatory_role !== "PROVEEDOR" && rolQueImponeElArt25(preguntasRol);

  const nameError = useMemo(() => {
    if (!submitted) return "";
    if (form.name.trim().length < 3) return "El nombre debe tener al menos 3 caracteres.";
    return "";
  }, [form.name, submitted]);

  /**
   * Lo que impide guardar. El alta anterior aceptaba un sistema sin
   * responsable, sin rol y con «Alto» puesto por el desplegable: tres datos que
   * el Reglamento pide y que nadie había decidido.
   */
  const bloqueos = useMemo(() => {
    const b: string[] = [];
    if (form.name.trim().length < 3) b.push("Falta el nombre del sistema.");
    if (!form.regulatory_role) b.push("Falta el rol de la entidad respecto al sistema.");
    if (!completa) b.push("El cuestionario de clasificación está incompleto.");
    if (!nivelElegido) b.push("Falta el nivel de riesgo.");
    if (!form.motivacion.trim()) b.push("Falta la motivación de la clasificación.");
    else if (necesitaArt63 && form.motivacion.trim().length < 40) {
      b.push(
        "Apartarse del anexo III exige documentar la evaluación (art. 6.3): la motivación es demasiado breve.",
      );
    }
    return b;
  }, [form.name, form.regulatory_role, form.motivacion, completa, nivelElegido, necesitaArt63]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);

    if (bloqueos.length > 0) {
      toast.error(bloqueos[0]);
      return;
    }

    const payload: Partial<AiSystem> = {
      name: form.name.trim(),
      system_type: emptyToNull(form.system_type),
      risk_level: emptyToNull(nivelElegido),
      vendor: emptyToNull(form.vendor),
      deployment_date: emptyToNull(form.deployment_date),
      status: form.status,
      use_case: emptyToNull(form.use_case),
      description: emptyToNull(form.description),
      owner_id: emptyToNull(form.owner_id),
      regulatory_role: form.regulatory_role || null,
      // Quién y cuándo: es lo que convierte una casilla marcada en una decisión
      // atribuible. El art. 6.3 exige que la evaluación esté documentada ANTES
      // de introducir el sistema en el mercado o ponerlo en servicio.
      regulatory_profile: {
        rol: form.regulatory_role,
        preguntasRol,
        clasificacion: {
          respuestas,
          nivelPropuesto: propuesta.nivel,
          nivelElegido,
          motivoAutomatico: propuesta.motivoAutomatico,
          motivacion: form.motivacion.trim(),
          exigeArt63: necesitaArt63,
          decidido_en: new Date().toISOString(),
          decidido_por: user?.email ?? null,
        },
      },
    };

    try {
      const created = await createSystem.mutateAsync(payload);
      toast.success("Sistema IA registrado en AIMS.");
      navigate(`/ai-governance/sistemas/${created.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`No se pudo registrar el sistema: ${message}`);
    }
  };

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
            <h1 className="text-xl font-bold text-[var(--g-text-primary)]">
              Nuevo sistema IA
            </h1>
          </div>
          <p className="text-sm text-[var(--g-text-secondary)]">
            Alta owner de AIMS sobre inventario operativo.
          </p>
        </div>
        <div
          className="inline-flex items-center gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-3 py-2 text-xs font-semibold text-[var(--g-text-primary)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <ShieldCheck className="h-4 w-4 text-[var(--g-brand-3308)]" />
          legacy_write · ai_systems
        </div>
      </header>

      <form
        onSubmit={handleSubmit}
        className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)]"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="border-b border-[var(--g-border-subtle)] px-6 py-4">
          <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">
            Identificación y clasificación
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

        {/* ---------------------------------------------------------------
            Rol regulatorio.

            Las obligaciones del Reglamento se determinan por POSICIÓN
            REGULATORIA —quién controla modelo, datos, registros y finalidad—,
            no por taxonomía técnica. Sin el rol no se sabe qué catálogo de
            medidas aplica, y medir a un responsable del despliegue contra el
            catálogo de un proveedor de alto riesgo da un porcentaje que no
            significa nada.
            --------------------------------------------------------------- */}
        <div className="border-t border-[var(--g-border-subtle)] px-6 py-4">
          <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">
            Rol de la entidad respecto al sistema *
          </h2>
          <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
            Reglamento (UE) 2024/1689. De aquí salen las obligaciones aplicables.
          </p>
        </div>
        <div className="space-y-3 px-6 pb-6">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {ROLES_REGULATORIOS.map((r) => (
              <label
                key={r.code}
                className={`flex cursor-pointer gap-3 border p-3 transition-colors ${
                  form.regulatory_role === r.code
                    ? "border-[var(--g-brand-3308)] bg-[var(--g-surface-subtle)]"
                    : "border-[var(--g-border-subtle)] hover:bg-[var(--g-surface-subtle)]/50"
                }`}
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <input
                  type="radio"
                  name="regulatory_role"
                  value={r.code}
                  checked={form.regulatory_role === r.code}
                  onChange={() => set("regulatory_role", r.code)}
                  className="mt-1"
                />
                <span className="space-y-0.5">
                  <span className="block text-sm font-semibold text-[var(--g-text-primary)]">
                    {r.label}{" "}
                    <span className="font-normal text-[var(--g-text-secondary)]">({r.articulo})</span>
                  </span>
                  <span className="block text-xs text-[var(--g-text-secondary)]">{r.ayuda}</span>
                </span>
              </label>
            ))}
          </div>

          <fieldset className="space-y-2 border border-[var(--g-border-subtle)] p-3" style={{ borderRadius: "var(--g-radius-md)" }}>
            <legend className="px-1 text-xs font-semibold text-[var(--g-text-primary)]">
              Calificación del rol (art. 25.1)
            </legend>
            {PREGUNTAS_ROL.map((q) => (
              <label key={q.id} className="flex items-start gap-2 text-xs text-[var(--g-text-primary)]">
                <input
                  type="checkbox"
                  checked={preguntasRol[q.id] === true}
                  onChange={(e) => setPreguntasRol((prev) => ({ ...prev, [q.id]: e.target.checked }))}
                  className="mt-0.5"
                />
                <span>{q.texto}</span>
              </label>
            ))}
            {avisoArt25 && (
              <p className="flex items-start gap-1.5 text-xs font-semibold text-[var(--status-warning)]">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  El art. 25.1 convierte en proveedor a quien responde que sí a cualquiera de estas
                  tres. Revísalo con Legal antes de mantener otro rol: no se cambia solo.
                </span>
              </p>
            )}
          </fieldset>
        </div>

        {/* ---------------------------------------------------------------
            Clasificación motivada.

            El desplegable venía con «Alto» preseleccionado y sin pedir un
            motivo. El art. 6.3 exige documentar la evaluación cuando se
            concluye que un sistema del anexo III no es de alto riesgo, ANTES
            de introducirlo en el mercado o ponerlo en servicio.

            El cuestionario PROPONE y obliga a motivar; no dictamina. La
            calificación jurídica la firma quien evalúa.
            --------------------------------------------------------------- */}
        <div className="border-t border-[var(--g-border-subtle)] px-6 py-4">
          <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">
            Clasificación de riesgo motivada *
          </h2>
          <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
            El cuestionario propone un nivel a partir de los artículos. La decisión, la motivación y
            su autoría son de quien evalúa.
          </p>
        </div>
        <div className="space-y-4 px-6 pb-6">
          <div className="space-y-2">
            {PREGUNTAS_CLASIFICACION.map((q) => (
              <div
                key={q.id}
                className="flex flex-wrap items-start justify-between gap-3 border border-[var(--g-border-subtle)] p-3"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <div className="max-w-xl space-y-0.5">
                  <p className="text-sm text-[var(--g-text-primary)]">{q.texto}</p>
                  <p className="text-xs text-[var(--g-text-secondary)]">{q.articulo}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {[
                    { v: true, l: "Sí" },
                    { v: false, l: "No" },
                  ].map((o) => (
                    <button
                      key={o.l}
                      type="button"
                      onClick={() => setRespuestas((prev) => ({ ...prev, [q.id]: o.v }))}
                      aria-pressed={respuestas[q.id] === o.v}
                      className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                        respuestas[q.id] === o.v
                          ? "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]"
                          : "border border-[var(--g-border-subtle)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
                      }`}
                      style={{ borderRadius: "var(--g-radius-md)" }}
                    >
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {completa && (
            <div
              className="space-y-3 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] p-4"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <p className="text-xs text-[var(--g-text-secondary)]">
                Nivel propuesto:{" "}
                <span className="font-semibold text-[var(--g-text-primary)]">{propuesta.nivel}</span> —{" "}
                {propuesta.motivoAutomatico}
              </p>
              <div>
                <label htmlFor="ai-risk-level" className={LABEL_CLASSES}>
                  Nivel de riesgo registrado *
                </label>
                <select
                  id="ai-risk-level"
                  value={nivelElegido}
                  onChange={(event) => set("risk_level", event.target.value)}
                  className={SELECT_CLASSES}
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <option value="">Sin clasificar</option>
                  <option value="Inaceptable">Inaceptable</option>
                  <option value="Alto">Alto</option>
                  <option value="Limitado">Limitado</option>
                  <option value="Mínimo">Mínimo</option>
                </select>
              </div>
              {necesitaArt63 && (
                <p className="flex items-start gap-1.5 text-xs font-semibold text-[var(--status-warning)]">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Se ha respondido que el caso está en el anexo III y se clasifica por debajo de
                    «Alto». El art. 6.3 obliga a documentar esa evaluación antes de introducir el
                    sistema en el mercado o ponerlo en servicio.
                  </span>
                </p>
              )}
              <div>
                <label htmlFor="ai-motivacion" className={LABEL_CLASSES}>
                  Motivación *
                </label>
                <textarea
                  id="ai-motivacion"
                  value={form.motivacion}
                  onChange={(event) => set("motivacion", event.target.value)}
                  rows={3}
                  placeholder="Por qué el sistema se clasifica así, con referencia a su finalidad prevista y a su alcance real."
                  className={TEXTAREA_CLASSES}
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
                <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
                  Se guarda con la fecha y la cuenta que la registra.
                </p>
              </div>
            </div>
          )}

          {submitted && bloqueos.length > 0 && (
            <ul className="space-y-1 text-xs text-[var(--status-error)]" role="alert">
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
            className="inline-flex items-center justify-center border border-[var(--g-border-subtle)] bg-transparent px-4 py-2 text-sm font-medium text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            aria-busy={createSystem.isPending}
            disabled={createSystem.isPending}
            className="inline-flex items-center justify-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] disabled:cursor-not-allowed disabled:opacity-70"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <Save className="h-4 w-4" />
            {createSystem.isPending ? "Registrando..." : "Registrar sistema"}
          </button>
        </div>
      </form>
    </div>
  );
}
