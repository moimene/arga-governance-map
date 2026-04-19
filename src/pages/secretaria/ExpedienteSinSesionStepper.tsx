import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Shield,
  Send,
} from "lucide-react";

const STEPS = [
  {
    n: 1,
    label: "Propuesta",
    hint: "Seleccionar materia, redactar propuesta, adjuntar documentación",
  },
  {
    n: 2,
    label: "Destinatarios y notificación",
    hint: "Censo de socios/consejeros y envío de notificación fehaciente",
  },
  {
    n: 3,
    label: "Ventana de consentimiento",
    hint: "Recogida de respuestas y seguimiento en tiempo real",
  },
  {
    n: 4,
    label: "Evaluación",
    hint: "Motor de reglas evalúa condición de adopción",
  },
  {
    n: 5,
    label: "Acta y firma",
    hint: "Generación de acta de acuerdo escrito y firma QES",
  },
  {
    n: 6,
    label: "Tramitación",
    hint: "Inscripción, instrumento y publicación si procede",
  },
];

// Demo data — en producción vendrían del estado/DB
const DEMO_MATTERS = [
  { code: "APROBACION_CUENTAS", name: "Aprobación cuentas anuales" },
  { code: "NOMBRAMIENTO_CESE", name: "Nombramiento / Cese consejeros" },
  { code: "MOD_ESTATUTOS", name: "Modificación estatutos" },
  { code: "DISTRIBUCION_DIVIDENDOS", name: "Distribución de dividendos" },
];

const DEMO_RECIPIENTS = [
  {
    id: "1",
    name: "Carlos Ruiz",
    capital: "25%",
    canal: "NOTIFICACION_CERTIFICADA",
    status: "ENTREGADA",
  },
  {
    id: "2",
    name: "Lucía Martín",
    capital: "20%",
    canal: "NOTIFICACION_CERTIFICADA",
    status: "ENTREGADA",
  },
  {
    id: "3",
    name: "Ana García",
    capital: "15%",
    canal: "BUROFAX",
    status: "PENDIENTE",
  },
  {
    id: "4",
    name: "Pedro López",
    capital: "15%",
    canal: "EMAIL_CON_ACUSE",
    status: "ENVIADA",
  },
  {
    id: "5",
    name: "ARGA Capital",
    capital: "25%",
    canal: "NOTIFICACION_CERTIFICADA",
    status: "ENTREGADA",
  },
];

const DEMO_RESPONSES = [
  {
    name: "Carlos Ruiz",
    sentido: "CONSENTIMIENTO",
    fecha: "16/04/2026",
    firma_qes: true,
  },
  {
    name: "Lucía Martín",
    sentido: "CONSENTIMIENTO",
    fecha: "17/04/2026",
    firma_qes: true,
  },
  {
    name: "Ana García",
    sentido: "CONSENTIMIENTO",
    fecha: "18/04/2026",
    firma_qes: true,
  },
  { name: "Pedro López", sentido: null, fecha: null, firma_qes: false },
  {
    name: "ARGA Capital",
    sentido: "CONSENTIMIENTO",
    fecha: "19/04/2026",
    firma_qes: true,
  },
];

// Motor de Reglas V2 — evaluación de condición de adopción
interface GateResult {
  gate: number;
  name: string;
  severity: "ok" | "warning" | "error";
  message: string;
}

function evaluateMotorV2(): {
  gates: GateResult[];
  overall: "CERRADO_OK" | "CERRADO_FAIL";
} {
  const responses = DEMO_RESPONSES.filter((r) => r.sentido);
  const totalCapital = 100;
  const respondingCapital = responses.length > 0 ? responses.length * 20 : 0; // Simplificado
  const consentCapital = DEMO_RESPONSES.filter((r) => r.sentido === "CONSENTIMIENTO").length * 20;

  const gates: GateResult[] = [
    {
      gate: 0,
      name: "Habilitación",
      severity: "ok",
      message: "Habilitado por estatutos (Artículo 159 LSRSP)",
    },
    {
      gate: 1,
      name: "Materia",
      severity: "ok",
      message: "Modo NO_SESSION permitido para esta materia",
    },
    {
      gate: 2,
      name: "Notificación",
      severity: "warning",
      message: "1 notificación pendiente (Ana García BUROFAX), 4 entregadas",
    },
    {
      gate: 3,
      name: "Ventana",
      severity: "ok",
      message: "Cierre anticipado por unanimidad: 80% de capital ha consentido",
    },
    {
      gate: 4,
      name: "Condición",
      severity: "ok",
      message: `Unanimidad capital (${consentCapital}% ≥ 50% requerido)`,
    },
  ];

  // Overall: OK si no hay "error" (warning es tolerable)
  const hasError = gates.some((g) => g.severity === "error");
  const overall = hasError ? "CERRADO_FAIL" : "CERRADO_OK";

  return { gates, overall };
}

function getSentidoBadgeColor(
  sentido: string | null
): "success" | "error" | "warning" | "muted" {
  if (!sentido) return "muted";
  if (sentido === "CONSENTIMIENTO") return "success";
  if (sentido.includes("OBJECION")) return "error";
  return "warning";
}

function getStatusBadgeColor(status: string): "success" | "info" | "warning" | "error" {
  switch (status) {
    case "ENTREGADA":
      return "success";
    case "ENVIADA":
      return "info";
    case "PENDIENTE":
      return "warning";
    case "FALLIDA":
      return "error";
    default:
      return "muted";
  }
}

function BadgeColor(color: string, label: string) {
  const bgMap = {
    success: "bg-[var(--status-success)]",
    error: "bg-[var(--status-error)]",
    warning: "bg-[var(--status-warning)]",
    info: "bg-[var(--status-info)]",
    muted: "bg-[var(--g-surface-muted)]",
  };
  const textMap = {
    success: "text-[var(--g-text-inverse)]",
    error: "text-[var(--g-text-inverse)]",
    warning: "text-[var(--g-text-inverse)]",
    info: "text-[var(--g-text-inverse)]",
    muted: "text-[var(--g-text-secondary)]",
  };
  const bg = bgMap[color as keyof typeof bgMap] || bgMap.muted;
  const text = textMap[color as keyof typeof textMap] || textMap.muted;
  return (
    <span
      className={`inline-block px-2 py-1 text-xs font-medium ${bg} ${text}`}
      style={{ borderRadius: "var(--g-radius-sm)" }}
    >
      {label}
    </span>
  );
}

export default function ExpedienteSinSesionStepper() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedMateria, setSelectedMateria] = useState("APROBACION_CUENTAS");
  const [proposalText, setProposalText] = useState(
    "Se solicita la aprobación de las cuentas anuales ejercicio 2025."
  );
  const [notificationsSent, setNotificationsSent] = useState(false);

  const motorResult = evaluateMotorV2();
  const isLastStep = current === STEPS.length;

  function handleEmitir() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    // En producción: llamada a Supabase para crear acuerdo sin sesión
    setTimeout(() => {
      setIsSubmitting(false);
      navigate("/secretaria/acuerdos-sin-sesion");
    }, 1000);
  }

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
          Secretaría · Nuevo acuerdo sin sesión
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
          Asistente de acuerdo sin sesión
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        {/* Stepper rail */}
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

        {/* Step body */}
        <div
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-6"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <h2 className="text-lg font-semibold text-[var(--g-text-primary)]">
            Paso {current}. {STEPS[current - 1].label}
          </h2>
          <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
            {STEPS[current - 1].hint}
          </p>

          {/* ============ STEP 1: PROPUESTA ============ */}
          {current === 1 && (
            <div className="mt-6 space-y-6">
              <div
                className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] p-4"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <p className="text-sm font-medium text-[var(--g-text-primary)]">
                  ℹ Motor de reglas verificará la habilitación por estatutos/reglamento
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--g-text-primary)]">
                  Materia del acuerdo
                </label>
                <select
                  value={selectedMateria}
                  onChange={(e) => setSelectedMateria(e.target.value)}
                  className="mt-2 w-full rounded border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  {DEMO_MATTERS.map((m) => (
                    <option key={m.code} value={m.code}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--g-text-primary)]">
                  Texto de la propuesta
                </label>
                <textarea
                  value={proposalText}
                  onChange={(e) => setProposalText(e.target.value)}
                  rows={6}
                  className="mt-2 w-full rounded border border-[var(--g-border-default)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-[var(--g-text-secondary)]">
                  Modos permitidos para esta materia
                </p>
                <div className="mt-2 flex gap-2">
                  {BadgeColor("success", "MEETING")}
                  {BadgeColor("success", "NO_SESSION")}
                </div>
              </div>
            </div>
          )}

          {/* ============ STEP 2: DESTINATARIOS Y NOTIFICACION ============ */}
          {current === 2 && (
            <div className="mt-6 space-y-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[var(--g-surface-subtle)]">
                      <th className="px-4 py-3 text-left font-medium text-[var(--g-text-primary)]">
                        Nombre
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-[var(--g-text-primary)]">
                        Capital
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-[var(--g-text-primary)]">
                        Canal
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-[var(--g-text-primary)]">
                        Estado
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--g-border-subtle)]">
                    {DEMO_RECIPIENTS.map((r) => (
                      <tr key={r.id} className="hover:bg-[var(--g-surface-subtle)]/30">
                        <td className="px-4 py-3 text-[var(--g-text-primary)]">{r.name}</td>
                        <td className="px-4 py-3 text-[var(--g-text-secondary)]">{r.capital}</td>
                        <td className="px-4 py-3 text-[var(--g-text-secondary)]">
                          {r.canal === "NOTIFICACION_CERTIFICADA"
                            ? "Notif. certificada"
                            : r.canal === "EMAIL_CON_ACUSE"
                            ? "Email con acuse"
                            : r.canal}
                        </td>
                        <td className="px-4 py-3">
                          {BadgeColor(getStatusBadgeColor(r.status), r.status)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[var(--g-text-primary)]">
                  4 de 5 notificaciones entregadas
                </p>
                <button
                  type="button"
                  onClick={() => setNotificationsSent(true)}
                  disabled={notificationsSent}
                  className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium ${
                    notificationsSent
                      ? "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
                      : "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)]"
                  }`}
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <Send className="h-4 w-4" />
                  {notificationsSent ? "Notificaciones enviadas" : "Enviar notificaciones"}
                </button>
              </div>
            </div>
          )}

          {/* ============ STEP 3: VENTANA DE CONSENTIMIENTO ============ */}
          {current === 3 && (
            <div className="mt-6 space-y-6">
              <div className="flex items-center gap-2 text-sm text-[var(--g-text-primary)]">
                <Clock className="h-4 w-4 text-[var(--status-info)]" />
                <span className="font-medium">Ventana: 15/04/2026 – 30/04/2026</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[var(--g-surface-subtle)]">
                      <th className="px-4 py-3 text-left font-medium text-[var(--g-text-primary)]">
                        Socio
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-[var(--g-text-primary)]">
                        Sentido
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-[var(--g-text-primary)]">
                        Fecha
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-[var(--g-text-primary)]">
                        Firma QES
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--g-border-subtle)]">
                    {DEMO_RESPONSES.map((r, idx) => (
                      <tr key={idx} className="hover:bg-[var(--g-surface-subtle)]/30">
                        <td className="px-4 py-3 text-[var(--g-text-primary)]">{r.name}</td>
                        <td className="px-4 py-3">
                          {r.sentido ? (
                            BadgeColor(getSentidoBadgeColor(r.sentido), r.sentido)
                          ) : (
                            BadgeColor(
                              "muted",
                              "(pendiente)"
                            )
                          )}
                        </td>
                        <td className="px-4 py-3 text-[var(--g-text-secondary)]">
                          {r.fecha || "-"}
                        </td>
                        <td className="px-4 py-3">
                          {r.firma_qes ? (
                            <CheckCircle2 className="h-4 w-4 text-[var(--status-success)]" />
                          ) : (
                            <span className="text-[var(--g-text-secondary)]">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <p className="text-sm font-medium text-[var(--g-text-primary)]">
                  4 de 5 respuestas recibidas (80% capital)
                </p>
                <p className="mt-2 text-sm text-[var(--status-success)]">
                  ✓ Cierre anticipado posible: unanimidad alcanzada
                </p>
              </div>
            </div>
          )}

          {/* ============ STEP 4: EVALUACION ============ */}
          {current === 4 && (
            <div className="mt-6 space-y-6">
              <div className="space-y-3">
                {motorResult.gates.map((g) => (
                  <div
                    key={g.gate}
                    className="flex items-start gap-3 rounded border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    <div className="mt-0.5">
                      {g.severity === "ok" && (
                        <CheckCircle2 className="h-5 w-5 text-[var(--status-success)]" />
                      )}
                      {g.severity === "warning" && (
                        <AlertTriangle className="h-5 w-5 text-[var(--status-warning)]" />
                      )}
                      {g.severity === "error" && (
                        <AlertTriangle className="h-5 w-5 text-[var(--status-error)]" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-[var(--g-text-primary)]">
                        Gate {g.gate}: {g.name}
                      </p>
                      <p className="mt-1 text-sm text-[var(--g-text-secondary)]">{g.message}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div
                className={`rounded-lg p-4 ${
                  motorResult.overall === "CERRADO_OK"
                    ? "border-l-4 border-[var(--status-success)] bg-[var(--status-success)]"
                    : "border-l-4 border-[var(--status-error)] bg-[var(--status-error)]"
                }`}
              >
                <p className="font-semibold text-[var(--g-text-inverse)]">
                  {motorResult.overall === "CERRADO_OK"
                    ? "✓ Acuerdo cerrado correctamente (CERRADO_OK)"
                    : "✗ Acuerdo cerrado con fallos (CERRADO_FAIL)"}
                </p>
              </div>
            </div>
          )}

          {/* ============ STEP 5: ACTA Y FIRMA ============ */}
          {current === 5 && (
            <div className="mt-6 space-y-6">
              <div
                className="border-l-4 border-[var(--g-sec-300)] bg-[var(--g-sec-100)] p-4"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <p className="text-sm font-medium text-[var(--g-text-primary)]">
                  Se generará acta de acuerdo escrito con plantilla protegida
                </p>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-[var(--g-text-primary)]">
                  Contenido del acta
                </p>
                <ul className="space-y-1 text-sm text-[var(--g-text-secondary)]">
                  <li>✓ Propuesta aprobada</li>
                  <li>✓ Relación de respuestas (5 socios)</li>
                  <li>✓ Resultado de evaluación (Motor V2)</li>
                  <li>✓ Snapshot de compliance</li>
                </ul>
              </div>

              <div>
                <p className="mb-3 text-sm font-medium text-[var(--g-text-primary)]">Firmantes</p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-3 rounded bg-[var(--g-surface-subtle)] p-3">
                    <Shield className="h-4 w-4 text-[var(--g-brand-3308)]" />
                    <span className="text-[var(--g-text-primary)]">
                      Secretario: Lucía Martín{" "}
                      <span className="text-[var(--g-text-secondary)]">(QES pendiente)</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-3 rounded bg-[var(--g-surface-subtle)] p-3">
                    <Shield className="h-4 w-4 text-[var(--g-brand-3308)]" />
                    <span className="text-[var(--g-text-primary)]">
                      Presidente: Carlos Ruiz{" "}
                      <span className="text-[var(--g-text-secondary)]">(QES pendiente)</span>
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="w-full rounded bg-[var(--g-brand-3308)] px-4 py-2 font-medium text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                Firmar acta
              </button>
            </div>
          )}

          {/* ============ STEP 6: TRAMITACION ============ */}
          {current === 6 && (
            <div className="mt-6 space-y-6">
              <div className="rounded-lg bg-[var(--g-surface-subtle)] p-4">
                <p className="text-sm text-[var(--g-text-primary)]">
                  <span className="font-medium">Materia:</span> Aprobación de cuentas anuales
                </p>
                <p className="mt-2 text-sm text-[var(--g-text-primary)]">
                  <span className="font-medium">Inscribible:</span> Sí
                </p>
                <p className="mt-2 text-sm text-[var(--g-text-primary)]">
                  <span className="font-medium">Instrumento requerido:</span> Instancia
                </p>
                <p className="mt-2 text-sm text-[var(--g-text-primary)]">
                  <span className="font-medium">Publicación:</span> No requerida
                </p>
              </div>

              <div className="rounded-lg border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4">
                <p className="text-sm text-[var(--g-text-primary)]">
                  Proceder a tramitación notarial de acuerdo sin sesión
                </p>
                <button
                  type="button"
                  className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-[var(--g-brand-3308)] hover:text-[var(--g-sec-700)]"
                >
                  Iniciar tramitación →
                </button>
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="mt-8 flex justify-between pt-6 border-t border-[var(--g-border-subtle)]">
            <button
              type="button"
              onClick={() => setCurrent(Math.max(1, current - 1))}
              disabled={current === 1}
              className={`px-4 py-2 text-sm font-medium rounded ${
                current === 1
                  ? "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] cursor-not-allowed"
                  : "border border-[var(--g-border-default)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
              }`}
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              ← Anterior
            </button>

            {isLastStep ? (
              <button
                type="button"
                onClick={handleEmitir}
                disabled={isSubmitting}
                className={`px-6 py-2 text-sm font-medium rounded text-[var(--g-text-inverse)] ${
                  isSubmitting
                    ? "bg-[var(--g-surface-muted)] cursor-not-allowed"
                    : "bg-[var(--g-brand-3308)] hover:bg-[var(--g-sec-700)]"
                }`}
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                {isSubmitting ? "Guardando..." : "Completar"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setCurrent(Math.min(STEPS.length, current + 1))}
                className="inline-flex items-center gap-2 px-6 py-2 text-sm font-medium rounded bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                Siguiente →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
