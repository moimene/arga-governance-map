import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, ChevronRight, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenantContext } from "@/hooks/useTenantContext";
import { evaluarSolidario } from "@/lib/rules-engine/votacion-engine";
import type { SolidarioConfig } from "@/lib/rules-engine/types";

// ─── Steps ──────────────────────────────────────────────────────────────────

const STEPS = [
  { n: 1, label: "Tipo de acuerdo", hint: "Materia, clase y texto de la propuesta" },
  { n: 2, label: "Administrador actuante", hint: "Identificar el administrador solidario que adopta el acuerdo" },
  { n: 3, label: "Evaluación motor", hint: "Verificación de validez por el motor LSC" },
  { n: 4, label: "Registrar", hint: "Crear acuerdo con adoption_mode = SOLIDARIO" },
];

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
          placeholder="Redactar el texto del acuerdo que adoptará el administrador solidario actuante…"
          className="w-full border border-[var(--g-border-default)] px-3 py-2 text-sm text-[var(--g-text-primary)] bg-[var(--g-surface-card)] focus:outline-none focus:border-[var(--g-border-focus)] resize-none"
          style={{ borderRadius: "var(--g-radius-md)" }}
        />
      </div>
    </div>
  );
}

function StepAdminActuante({
  adminId, setAdminId,
  adminNombre, setAdminNombre,
  vigenciaDesde, setVigenciaDesde,
  materiasRestringidas, setMateriasRestringidas,
}: {
  adminId: string; setAdminId: (v: string) => void;
  adminNombre: string; setAdminNombre: (v: string) => void;
  vigenciaDesde: string; setVigenciaDesde: (v: string) => void;
  materiasRestringidas: string[]; setMateriasRestringidas: (v: string[]) => void;
}) {
  const [newMateria, setNewMateria] = useState("");

  function addMateria() {
    if (!newMateria.trim()) return;
    setMateriasRestringidas([...materiasRestringidas, newMateria.trim()]);
    setNewMateria("");
  }

  return (
    <div className="space-y-4">
      <div
        className="border border-[var(--g-border-subtle)] bg-[var(--g-sec-100)] p-4 text-sm text-[var(--g-text-secondary)]"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        El administrador solidario puede actuar individualmente para adoptar acuerdos de gestión
        ordinaria. Materias estructurales pueden requerir cofirma estatutaria (art. 210 LSC).
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--g-text-primary)] mb-1">
          ID del administrador actuante
        </label>
        <input
          type="text"
          value={adminId}
          onChange={(e) => setAdminId(e.target.value)}
          placeholder="Ej: admin-solid-1"
          className="w-full border border-[var(--g-border-default)] px-3 py-2 text-sm text-[var(--g-text-primary)] bg-[var(--g-surface-card)] focus:outline-none focus:border-[var(--g-border-focus)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--g-text-primary)] mb-1">
          Nombre del administrador
        </label>
        <input
          type="text"
          value={adminNombre}
          onChange={(e) => setAdminNombre(e.target.value)}
          placeholder="Nombre completo"
          className="w-full border border-[var(--g-border-default)] px-3 py-2 text-sm text-[var(--g-text-primary)] bg-[var(--g-surface-card)] focus:outline-none focus:border-[var(--g-border-focus)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--g-text-primary)] mb-1">
          Vigencia del cargo desde
        </label>
        <input
          type="date"
          value={vigenciaDesde}
          onChange={(e) => setVigenciaDesde(e.target.value)}
          className="w-full border border-[var(--g-border-default)] px-3 py-2 text-sm text-[var(--g-text-primary)] bg-[var(--g-surface-card)] focus:outline-none focus:border-[var(--g-border-focus)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--g-text-primary)] mb-1">
          Materias con restricción estatutaria (requieren cofirma)
        </label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={newMateria}
            onChange={(e) => setNewMateria(e.target.value)}
            placeholder="Ej: OPERACION_ESTRUCTURAL"
            className="flex-1 border border-[var(--g-border-default)] px-3 py-2 text-sm text-[var(--g-text-primary)] bg-[var(--g-surface-card)] focus:outline-none focus:border-[var(--g-border-focus)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          />
          <button
            type="button"
            onClick={addMateria}
            disabled={!newMateria.trim()}
            className="border border-[var(--g-border-subtle)] px-4 py-2 text-sm text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] disabled:opacity-40"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            Añadir
          </button>
        </div>
        {materiasRestringidas.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {materiasRestringidas.map((m, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-2 py-0.5 text-xs text-[var(--g-text-secondary)]"
                style={{ borderRadius: "var(--g-radius-full)" }}
              >
                {m}
                <button
                  type="button"
                  onClick={() => setMateriasRestringidas(materiasRestringidas.filter((_, j) => j !== i))}
                  className="ml-0.5 text-[var(--status-error)]"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        {materiasRestringidas.length === 0 && (
          <p className="text-xs text-[var(--g-text-secondary)]">Sin restricciones estatutarias</p>
        )}
      </div>
    </div>
  );
}

function StepEvaluacion({ result }: { result: ReturnType<typeof evaluarSolidario> | null }) {
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
        className={`flex items-center gap-3 p-4 ${result.ok ? "bg-[var(--g-sec-100)]" : "bg-red-50"}`}
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        {result.ok ? (
          <CheckCircle2 className="h-5 w-5 text-[var(--status-success)]" />
        ) : (
          <XCircle className="h-5 w-5 text-[var(--status-error)]" />
        )}
        <div>
          <div className="text-sm font-semibold text-[var(--g-text-primary)]">
            {result.ok ? "Acuerdo solidario válido" : "Acuerdo solidario inválido"}
          </div>
          <div className="text-xs text-[var(--g-text-secondary)]">Severity: {result.severity}</div>
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
        <div
          className="border border-[var(--g-border-subtle)] p-3 text-xs text-[var(--g-text-secondary)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
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

export default function SolidarioStepper() {
  const navigate = useNavigate();
  const { tenantId } = useTenantContext();
  const [current, setCurrent] = useState(1);

  // Step 1
  const [materia, setMateria] = useState("");
  const [texto, setTexto] = useState("");

  // Step 2
  const [adminId, setAdminId] = useState("");
  const [adminNombre, setAdminNombre] = useState("");
  const [vigenciaDesde, setVigenciaDesde] = useState(
    new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [materiasRestringidas, setMateriasRestringidas] = useState<string[]>([]);

  // Step 3 — computed result
  const motorResult: ReturnType<typeof evaluarSolidario> | null =
    adminId.trim()
      ? evaluarSolidario(
          {
            adminActuante: adminId,
            restriccionesEstatutarias: materiasRestringidas.map((m) => ({
              materia: m,
              requiereCofirma: true,
            })),
            vigenciaDesde: `${vigenciaDesde}T00:00:00Z`,
          } satisfies SolidarioConfig,
          [adminId],
          new Date().toISOString()
        )
      : null;

  // Step 4
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
          agreement_kind: "SOLIDARIO",
          matter_class: materia || "OTROS",
          adoption_mode: "SOLIDARIO",
          proposal_text: texto,
          status: motorResult.ok ? "ADOPTED" : "DRAFT",
          decision_date: new Date().toISOString().split("T")[0],
          execution_mode: {
            tipo: "SOLIDARIO",
            config: {
              adminActuante: adminId,
              restriccionesEstatutarias: materiasRestringidas.map((m) => ({
                materia: m,
                requiereCofirma: true,
              })),
              vigenciaDesde: `${vigenciaDesde}T00:00:00Z`,
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
          <StepAdminActuante
            adminId={adminId} setAdminId={setAdminId}
            adminNombre={adminNombre} setAdminNombre={setAdminNombre}
            vigenciaDesde={vigenciaDesde} setVigenciaDesde={setVigenciaDesde}
            materiasRestringidas={materiasRestringidas}
            setMateriasRestringidas={setMateriasRestringidas}
          />
        );
      case 3:
        return <StepEvaluacion result={motorResult} />;
      case 4:
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
                  Se creará un acuerdo con <strong>adoption_mode = SOLIDARIO</strong> adoptado por{" "}
                  <strong>{adminNombre || adminId || "—"}</strong>. Estado:{" "}
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
          Secretaría · Decisión solidaria
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
          Asistente de acuerdo por administrador solidario
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
