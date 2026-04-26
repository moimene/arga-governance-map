import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, ChevronRight, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/context/TenantContext";
import { evaluarCoAprobacion } from "@/lib/rules-engine/votacion-engine";
import type { CoAprobacionConfig } from "@/lib/rules-engine/types";

// ─── Steps ──────────────────────────────────────────────────────────────────

const STEPS = [
  { n: 1, label: "Tipo de acuerdo", hint: "Materia, clase y texto de la propuesta" },
  { n: 2, label: "Configuración k de n", hint: "Número mínimo de administradores y ventana temporal" },
  { n: 3, label: "Firmas", hint: "Registro de firmas de los administradores que aprueban" },
  { n: 4, label: "Evaluación motor", hint: "Verificación de validez por el motor LSC" },
  { n: 5, label: "Registrar", hint: "Crear acuerdo y emitir certificación" },
];

// ─── Types ───────────────────────────────────────────────────────────────────

interface FirmaLocal {
  adminId: string;
  adminNombre: string;
  fechaFirma: string;
}

// ─── Step bodies ─────────────────────────────────────────────────────────────

function StepTipoAcuerdo({
  materia, setMateria,
  texto, setTexto,
}: {
  materia: string; setMateria: (v: string) => void;
  texto: string; setTexto: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-[var(--g-text-primary)] mb-1">
          Clase de materia
        </label>
        <select
          value={materia}
          onChange={(e) => setMateria(e.target.value)}
          className="w-full border border-[var(--g-border-default)] px-3 py-2 text-sm text-[var(--g-text-primary)] bg-[var(--g-surface-card)] focus:outline-none focus:border-[var(--g-border-focus)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <option value="">Seleccionar…</option>
          <option value="APROBACION_CUENTAS">Aprobación de cuentas</option>
          <option value="NOMBRAMIENTO_CESE">Nombramiento / cese</option>
          <option value="MOD_ESTATUTOS">Modificación de estatutos</option>
          <option value="OPERACION_ESTRUCTURAL">Operación estructural</option>
          <option value="DELEGACION_FACULTADES">Delegación de facultades</option>
          <option value="OTROS">Otros</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--g-text-primary)] mb-1">
          Texto de la propuesta
        </label>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={5}
          placeholder="Redactar el texto del acuerdo que se adoptará por co-aprobación…"
          className="w-full border border-[var(--g-border-default)] px-3 py-2 text-sm text-[var(--g-text-primary)] bg-[var(--g-surface-card)] focus:outline-none focus:border-[var(--g-border-focus)] resize-none"
          style={{ borderRadius: "var(--g-radius-md)" }}
        />
      </div>
    </div>
  );
}

function StepConfiguracion({
  k, setK,
  n, setN,
  ventana, setVentana,
  estatutos, setEstatutos,
}: {
  k: number; setK: (v: number) => void;
  n: number; setN: (v: number) => void;
  ventana: string; setVentana: (v: string) => void;
  estatutos: boolean; setEstatutos: (v: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      <div
        className="border border-[var(--g-border-subtle)] bg-[var(--g-sec-100)] p-4 text-sm text-[var(--g-text-secondary)]"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        La co-aprobación requiere que al menos <strong>k</strong> administradores de los <strong>n</strong> vigentes
        aprueben el acuerdo dentro de la ventana temporal. Art. 210 LSC.
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[var(--g-text-primary)] mb-1">
            Mínimo de firmas requeridas (k)
          </label>
          <input
            type="number"
            min={1}
            max={n}
            value={k}
            onChange={(e) => setK(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-full border border-[var(--g-border-default)] px-3 py-2 text-sm text-[var(--g-text-primary)] bg-[var(--g-surface-card)] focus:outline-none focus:border-[var(--g-border-focus)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--g-text-primary)] mb-1">
            Total de administradores (n)
          </label>
          <input
            type="number"
            min={k}
            value={n}
            onChange={(e) => setN(Math.max(k, parseInt(e.target.value) || k))}
            className="w-full border border-[var(--g-border-default)] px-3 py-2 text-sm text-[var(--g-text-primary)] bg-[var(--g-surface-card)] focus:outline-none focus:border-[var(--g-border-focus)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--g-text-primary)] mb-1">
          Ventana de consenso
        </label>
        <select
          value={ventana}
          onChange={(e) => setVentana(e.target.value)}
          className="w-full border border-[var(--g-border-default)] px-3 py-2 text-sm text-[var(--g-text-primary)] bg-[var(--g-surface-card)] focus:outline-none focus:border-[var(--g-border-focus)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <option value="7d">7 días</option>
          <option value="15d">15 días</option>
          <option value="30d">30 días</option>
        </select>
      </div>
      <div className="flex items-center gap-2">
        <input
          id="estatutos"
          type="checkbox"
          checked={estatutos}
          onChange={(e) => setEstatutos(e.target.checked)}
          className="h-4 w-4 accent-[var(--g-brand-3308)]"
        />
        <label htmlFor="estatutos" className="text-sm text-[var(--g-text-primary)]">
          Los estatutos permiten adopción sin sesión (art. 160 LSC)
        </label>
      </div>
    </div>
  );
}

function StepFirmas({
  firmas, setFirmas,
}: {
  firmas: FirmaLocal[];
  setFirmas: (v: FirmaLocal[]) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);

  function addFirma() {
    if (!nombre.trim()) return;
    setFirmas([
      ...firmas,
      {
        adminId: `admin-${Date.now()}`,
        adminNombre: nombre.trim(),
        fechaFirma: `${fecha}T12:00:00Z`,
      },
    ]);
    setNombre("");
  }

  function removeFirma(idx: number) {
    setFirmas(firmas.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--g-text-secondary)]">
        Registra las firmas de los administradores que aprueban el acuerdo. Cada firma incluye la fecha de suscripción.
      </p>

      <div className="flex gap-2">
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre del administrador"
          className="flex-1 border border-[var(--g-border-default)] px-3 py-2 text-sm text-[var(--g-text-primary)] bg-[var(--g-surface-card)] focus:outline-none focus:border-[var(--g-border-focus)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        />
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="border border-[var(--g-border-default)] px-3 py-2 text-sm text-[var(--g-text-primary)] bg-[var(--g-surface-card)] focus:outline-none focus:border-[var(--g-border-focus)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        />
        <button
          type="button"
          onClick={addFirma}
          disabled={!nombre.trim()}
          className="bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] disabled:opacity-40"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          Añadir
        </button>
      </div>

      {firmas.length === 0 ? (
        <div className="py-6 text-center text-sm text-[var(--g-text-secondary)]">
          Ninguna firma registrada todavía
        </div>
      ) : (
        <div className="divide-y divide-[var(--g-border-subtle)] border border-[var(--g-border-subtle)]" style={{ borderRadius: "var(--g-radius-md)" }}>
          {firmas.map((f, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="text-sm font-medium text-[var(--g-text-primary)]">{f.adminNombre}</div>
                <div className="text-xs text-[var(--g-text-secondary)]">{f.fechaFirma.split("T")[0]}</div>
              </div>
              <button
                type="button"
                onClick={() => removeFirma(i)}
                className="text-xs text-[var(--status-error)] hover:underline"
              >
                Eliminar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StepEvaluacion({ result }: { result: ReturnType<typeof evaluarCoAprobacion> | null }) {
  if (!result) {
    return (
      <div className="py-8 text-center text-sm text-[var(--g-text-secondary)]">
        Completa los pasos anteriores para ver la evaluación del motor.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        className={`flex items-center gap-3 p-4 ${result.ok ? "bg-[var(--g-sec-100)]" : "bg-[var(--g-surface-muted)]"}`}
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        {result.ok ? (
          <CheckCircle2 className="h-5 w-5 text-[var(--status-success)]" />
        ) : (
          <XCircle className="h-5 w-5 text-[var(--status-error)]" />
        )}
        <div>
          <div className="text-sm font-semibold text-[var(--g-text-primary)]">
            {result.ok ? "Co-aprobación válida" : "Co-aprobación inválida"}
          </div>
          <div className="text-xs text-[var(--g-text-secondary)]">
            Severity: {result.severity}
          </div>
        </div>
      </div>

      {result.blocking_issues.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--status-error)]">
            Problemas bloqueantes
          </div>
          {result.blocking_issues.map((b, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-[var(--g-text-primary)]">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-error)]" />
              {b}
            </div>
          ))}
        </div>
      )}

      {result.warnings.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--status-warning)]">
            Advertencias
          </div>
          {result.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-[var(--g-text-primary)]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-warning)]" />
              {w}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--g-text-secondary)]">
          Árbol de evaluación
        </div>
        <div className="border border-[var(--g-border-subtle)] p-3 text-xs text-[var(--g-text-secondary)]" style={{ borderRadius: "var(--g-radius-md)" }}>
          <div className="flex items-center gap-2">
            {result.explain.resultado === 'OK' ? (
              <Check className="h-3.5 w-3.5 text-[var(--status-success)]" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-[var(--status-error)]" />
            )}
            <span className="font-medium">{result.explain.regla}</span>
            <span className="ml-auto">{result.explain.resultado}</span>
          </div>
          <p className="mt-1 pl-5">{result.explain.mensaje}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CoAprobacionStepper() {
  const navigate = useNavigate();
  const { tenantId } = useTenantContext();
  const [current, setCurrent] = useState(1);

  // Step 1 state
  const [materia, setMateria] = useState("");
  const [texto, setTexto] = useState("");

  // Step 2 state
  const [k, setK] = useState(2);
  const [n, setN] = useState(3);
  const [ventana, setVentana] = useState("15d");
  const [estatutos, setEstatutos] = useState(true);

  // Step 3 state
  const [firmas, setFirmas] = useState<FirmaLocal[]>([]);

  // Step 4 — computed result
  const motorResult: ReturnType<typeof evaluarCoAprobacion> | null =
    firmas.length > 0
      ? evaluarCoAprobacion(
          {
            k,
            n,
            ventanaConsenso: ventana,
            estatutosPermitenSinSesion: estatutos,
            firmas: firmas.map((f) => ({
              adminId: f.adminId,
              fechaFirma: f.fechaFirma,
              hashDocumento: `sha256-${f.adminId}`,
            })),
          } satisfies CoAprobacionConfig,
          firmas.map((f) => f.adminId),
          new Date().toISOString()
        )
      : null;

  // Step 5 state
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleRegistrar() {
    if (!tenantId || !motorResult) return;
    setSaving(true);
    setSaveError(null);
    try {
      const { data, error } = await supabase
        .from("agreements")
        .insert({
          tenant_id: tenantId,
          agreement_kind: "CO_APROBACION",
          matter_class: materia || "OTROS",
          adoption_mode: "CO_APROBACION",
          proposal_text: texto,
          status: motorResult.ok ? "ADOPTED" : "DRAFT",
          decision_date: new Date().toISOString().split("T")[0],
          execution_mode: {
            tipo: "CO_APROBACION",
            config: {
              k, n,
              ventanaConsenso: ventana,
              estatutosPermitenSinSesion: estatutos,
              firmas: firmas.map((f) => ({
                adminId: f.adminId,
                fechaFirma: f.fechaFirma,
                hashDocumento: `sha256-${f.adminId}`,
              })),
            },
          },
          compliance_snapshot: motorResult,
        })
        .select("id")
        .single();

      if (error) throw error;
      setSavedId(data.id);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  function renderStepBody() {
    switch (current) {
      case 1:
        return (
          <StepTipoAcuerdo
            materia={materia} setMateria={setMateria}
            texto={texto} setTexto={setTexto}
          />
        );
      case 2:
        return (
          <StepConfiguracion
            k={k} setK={setK}
            n={n} setN={setN}
            ventana={ventana} setVentana={setVentana}
            estatutos={estatutos} setEstatutos={setEstatutos}
          />
        );
      case 3:
        return <StepFirmas firmas={firmas} setFirmas={setFirmas} />;
      case 4:
        return <StepEvaluacion result={motorResult} />;
      case 5:
        return (
          <div className="space-y-4">
            {savedId ? (
              <div className="flex items-center gap-3 rounded-lg bg-[var(--g-sec-100)] p-4">
                <CheckCircle2 className="h-5 w-5 text-[var(--status-success)]" />
                <div>
                  <div className="text-sm font-semibold text-[var(--g-text-primary)]">
                    Acuerdo registrado
                  </div>
                  <div className="text-xs text-[var(--g-text-secondary)]">ID: {savedId}</div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/secretaria/acuerdos/${savedId}`)}
                  className="ml-auto text-sm text-[var(--g-brand-3308)] hover:underline"
                >
                  Ver expediente →
                </button>
              </div>
            ) : (
              <>
                <div className="text-sm text-[var(--g-text-secondary)]">
                  Se creará un acuerdo con <strong>adoption_mode = CO_APROBACION</strong> y
                  el snapshot del motor. Estado:{" "}
                  <strong>{motorResult?.ok ? "ADOPTED" : "DRAFT"}</strong>.
                </div>
                {saveError && (
                  <div className="text-sm text-[var(--status-error)]">{saveError}</div>
                )}
                <button
                  type="button"
                  onClick={handleRegistrar}
                  disabled={saving || !motorResult}
                  className="bg-[var(--g-brand-3308)] px-6 py-2 text-sm font-medium text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] disabled:opacity-40"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  {saving ? "Guardando…" : "Registrar acuerdo"}
                </button>
              </>
            )}
          </div>
        );
    }
  }

  const currentStep = STEPS.find((s) => s.n === current) ?? STEPS[0];

  return (
    <div className="mx-auto max-w-[1200px] p-6">
      <button
        type="button"
        onClick={() => navigate("/secretaria/acuerdos-sin-sesion")}
        className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--g-text-secondary)] hover:text-[var(--g-brand-3308)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Cancelar y volver
      </button>

      <div className="mb-6">
        <div className="text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
          Secretaría · Co-aprobación
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
          Asistente de acuerdo por co-aprobación (k de n)
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        <nav
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-2"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          aria-label="Pasos"
        >
          {STEPS.map((s) => {
            const done = s.n < current;
            const active = s.n === current;
            return (
              <button
                key={s.n}
                type="button"
                onClick={() => setCurrent(s.n)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${
                  active
                    ? "bg-[var(--g-surface-subtle)] font-semibold text-[var(--g-brand-3308)]"
                    : "text-[var(--g-text-secondary)] hover:bg-[var(--g-surface-subtle)]/50"
                }`}
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center text-[11px] font-bold ${
                    done
                      ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
                      : active
                      ? "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]"
                      : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
                  }`}
                  style={{ borderRadius: "var(--g-radius-full)" }}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : s.n}
                </span>
                <span className="flex-1 truncate">{s.label}</span>
              </button>
            );
          })}
        </nav>

        <div
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-6"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <h2 className="text-lg font-semibold text-[var(--g-text-primary)]">
            Paso {currentStep.n}. {currentStep.label}
          </h2>
          <p className="mt-1 text-sm text-[var(--g-text-secondary)]">{currentStep.hint}</p>

          <div className="mt-6">{renderStepBody()}</div>

          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrent((n) => Math.max(1, n - 1))}
              disabled={current === 1}
              className="inline-flex items-center gap-1 border border-[var(--g-border-subtle)] px-4 py-2 text-sm text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)] disabled:opacity-40"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => setCurrent((n) => Math.min(STEPS.length, n + 1))}
              disabled={current === STEPS.length}
              className="inline-flex items-center gap-1 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] disabled:opacity-40"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
