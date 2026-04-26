import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft, Check, ChevronDown, ChevronRight,
  Globe, Plus, Trash2, Users, FileText, Send,
} from "lucide-react";
import { evaluarConvocatoria } from "@/lib/rules-engine/convocatoria-engine";
import type { ConvocatoriaInput } from "@/lib/rules-engine/types";
import { checkNoticePeriodByType, useEntityRules } from "@/hooks/useJurisdiccionRules";
import { useEntitiesList } from "@/hooks/useEntities";
import { useBodiesByEntity } from "@/hooks/useBodies";
import { useBodyMandates } from "@/hooks/useBodies";
import { useCreateConvocatoria, type AgendaItem } from "@/hooks/useConvocatorias";

const STEPS = [
  { n: 1, label: "Sociedad y órgano",      hint: "Seleccionar sociedad, órgano convocante y tipo de reunión" },
  { n: 2, label: "Fecha y plazo legal",     hint: "Calcular antelación según jurisdicción y forma jurídica" },
  { n: 3, label: "Orden del día",           hint: "Clasificar ítems en ordinaria / estatutaria / estructural" },
  { n: 4, label: "Destinatarios",           hint: "Miembros del órgano que recibirán la convocatoria" },
  { n: 5, label: "Canales de publicación",  hint: "BORME / PSM / JORNAL / web corporativa / ERDS" },
  { n: 6, label: "Adjuntos",               hint: "Documentos de referencia y propuestas que se adjuntan" },
  { n: 7, label: "Revisión y emisión",      hint: "Verificación de compliance y emisión definitiva" },
];

const JURIS_FLAGS: Record<string, string> = { ES: "🇪🇸", PT: "🇵🇹", BR: "🇧🇷", MX: "🇲🇽" };

const CHANNEL_OPTIONS: Record<string, { value: string; label: string; recommended?: boolean }[]> = {
  ES: [
    { value: "WEB_CORPORATIVA",    label: "Web corporativa (art. 173 LSC)", recommended: true },
    { value: "BORME",              label: "BORME" },
    { value: "ERDS",               label: "Notificación ERDS (EAD Trust)", recommended: true },
    { value: "CORREO_CERTIFICADO", label: "Correo certificado" },
    { value: "BUROFAX",            label: "Burofax" },
  ],
  PT: [
    { value: "JORNAL_OFICIAL",  label: "Diário da República", recommended: true },
    { value: "JORNAL_DIARIO",   label: "Jornal diário de grande circulação" },
    { value: "WEB_CORPORATIVA", label: "Site corporativo" },
    { value: "ERDS",            label: "Notificação ERDS certificada (EAD Trust)" },
  ],
  BR: [
    { value: "DIARIO_OFICIAL",    label: "Diário Oficial do Estado", recommended: true },
    { value: "JORNAL_CIRCULACAO", label: "Jornal de grande circulação" },
    { value: "WEB_CORPORATIVA",   label: "Site corporativo" },
  ],
  MX: [
    { value: "DOF",                label: "Diario Oficial de la Federación", recommended: true },
    { value: "CORREO_CERTIFICADO", label: "Correo certificado a socios" },
    { value: "WEB_CORPORATIVA",    label: "Sitio corporativo" },
    { value: "ERDS",               label: "Notificación ERDS (EAD Trust)" },
  ],
};

const AGENDA_TIPOS = [
  { value: "ORDINARIA",    label: "Ordinaria" },
  { value: "ESTATUTARIA",  label: "Estatutaria" },
  { value: "ESTRUCTURAL",  label: "Estructural (inscribible)" },
] as const;

const BODY_TYPE_LABELS: Record<string, string> = {
  JUNTA: "Junta General / Asamblea",
  CDA: "Consejo de Administración",
  COMISION: "Comisión",
  COMITE: "Comité",
};

function newAgendaItem(): AgendaItem {
  return { id: crypto.randomUUID(), titulo: "", tipo: "ORDINARIA", inscribible: false };
}

export default function ConvocatoriasStepper() {
  const navigate = useNavigate();
  const createConvocatoria = useCreateConvocatoria();

  const [current, setCurrent] = useState(1);
  const [expandExplain, setExpandExplain] = useState(false);
  const [emitidoId, setEmitidoId] = useState<string | null>(null);

  // ── Step 1 ──
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [selectedBodyId, setSelectedBodyId] = useState<string | null>(null);
  const [tipoConvocatoria, setTipoConvocatoria] = useState<"ORDINARIA" | "EXTRAORDINARIA" | "UNIVERSAL">("ORDINARIA");

  const { data: entities = [] } = useEntitiesList();
  const { data: bodies = [] } = useBodiesByEntity(selectedEntityId ?? undefined);
  const selectedEntity = entities.find((e) => e.id === selectedEntityId) ?? null;
  const selectedBody = bodies.find((b) => b.id === selectedBodyId) ?? null;
  const jurisdiction = (selectedEntity as any)?.jurisdiction ?? "ES";
  const tipoSocial = (selectedEntity as any)?.tipo_social ?? "SA";

  const { data: ruleSets = [] } = useEntityRules(
    selectedEntityId ? jurisdiction : undefined,
    selectedEntityId ? tipoSocial : undefined,
  );
  const activeRuleSet = ruleSets.find((r) => r.is_active) ?? ruleSets[0] ?? null;
  const liveNoticeDays = activeRuleSet?.rule_config?.notice_min_days_first_call ?? null;

  // ── Step 2 ──
  const [fechaReunion, setFechaReunion] = useState("");
  const [horaReunion, setHoraReunion] = useState("10:00");
  const [lugar, setLugar] = useState("");
  const [formatoReunion, setFormatoReunion] = useState<"PRESENCIAL" | "TELEMATICA" | "MIXTA">("PRESENCIAL");
  const [habilitarSegunda, setHabilitarSegunda] = useState(false);
  const [fechaReunion2, setFechaReunion2] = useState("");
  const [horaReunion2, setHoraReunion2] = useState("10:30");

  const meetingIso = fechaReunion
    ? new Date(`${fechaReunion}T${horaReunion}:00`).toISOString()
    : new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();

  const noticeOkV1 = checkNoticePeriodByType({
    meetingDate: meetingIso,
    jurisdiction,
    convocationType: tipoConvocatoria,
    tipoSocial,
  });

  const convocatoriaInput: ConvocatoriaInput = {
    tipoSocial: tipoSocial as any,
    organoTipo: selectedBody?.body_type === "CDA" ? "CONSEJO_ADMINISTRACION" : "JUNTA_GENERAL",
    adoptionMode: "MEETING",
    fechaJunta: meetingIso,
    esCotizada: false,
    webInscrita: true,
    primeraConvocatoria: true,
    esJuntaUniversal: tipoConvocatoria === "UNIVERSAL",
    materias: agendaItems.map((i) => i.tipo === "ESTRUCTURAL" ? "MOD_ESTATUTOS" : "APROBACION_CUENTAS"),
  };
  const evaluacionV2 = evaluarConvocatoria(convocatoriaInput, []);
  const noticeOk = tipoConvocatoria === "UNIVERSAL" ? true : (evaluacionV2 ? evaluacionV2.ok : noticeOkV1);

  // ── Step 3 ──
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([newAgendaItem()]);

  function addAgendaItem() {
    setAgendaItems((prev) => [...prev, newAgendaItem()]);
  }
  function removeAgendaItem(id: string) {
    setAgendaItems((prev) => prev.filter((i) => i.id !== id));
  }
  function updateAgendaItem(id: string, patch: Partial<AgendaItem>) {
    setAgendaItems((prev) => prev.map((i) => i.id === id ? { ...i, ...patch } : i));
  }

  // ── Step 4 ──
  const { data: mandates = [] } = useBodyMandates(selectedBodyId ?? undefined);
  const activeMandates = mandates.filter((m) => m.status === "Activo");
  const [excludedPersonIds, setExcludedPersonIds] = useState<Set<string>>(new Set());
  function toggleExclude(personId: string) {
    setExcludedPersonIds((prev) => {
      const next = new Set(prev);
      next.has(personId) ? next.delete(personId) : next.add(personId);
      return next;
    });
  }

  // ── Step 5 ──
  const channelOpts = CHANNEL_OPTIONS[jurisdiction] ?? CHANNEL_OPTIONS["ES"];
  const [channels, setChannels] = useState<string[]>([]);
  function toggleChannel(val: string) {
    setChannels((prev) =>
      prev.includes(val) ? prev.filter((c) => c !== val) : [...prev, val],
    );
  }

  // ── Step 6 ──
  const [adjuntos, setAdjuntos] = useState<{ id: string; nombre: string; descripcion: string }[]>([]);
  function addAdjunto() {
    setAdjuntos((prev) => [...prev, { id: crypto.randomUUID(), nombre: "", descripcion: "" }]);
  }
  function removeAdjunto(id: string) {
    setAdjuntos((prev) => prev.filter((a) => a.id !== id));
  }
  function updateAdjunto(id: string, field: "nombre" | "descripcion", val: string) {
    setAdjuntos((prev) => prev.map((a) => a.id === id ? { ...a, [field]: val } : a));
  }

  // ── Validation gates ──
  function canAdvance(): boolean {
    switch (current) {
      case 1: return !!selectedEntityId && !!selectedBodyId;
      case 2: return !!fechaReunion && !!lugar && (tipoConvocatoria === "UNIVERSAL" || noticeOk);
      case 3: return agendaItems.some((i) => i.titulo.trim().length > 0);
      default: return true;
    }
  }

  // ── Submit ──
  async function handleEmitir() {
    if (!selectedBodyId || !fechaReunion || createConvocatoria.isPending) return;
    const fecha2Iso = habilitarSegunda && fechaReunion2
      ? new Date(`${fechaReunion2}T${horaReunion2}:00`).toISOString()
      : null;
    try {
      const created = await createConvocatoria.mutateAsync({
        body_id: selectedBodyId,
        tipo_convocatoria: tipoConvocatoria,
        fecha_1: meetingIso,
        fecha_2: fecha2Iso,
        modalidad: formatoReunion,
        lugar,
        junta_universal: tipoConvocatoria === "UNIVERSAL",
        is_second_call: false,
        publication_channels: channels,
        agenda_items: agendaItems
          .filter((i) => i.titulo.trim().length > 0)
          .map(({ titulo, tipo, inscribible }) => ({ titulo, tipo, inscribible })),
        statutory_basis: activeRuleSet?.legal_reference ?? null,
      });
      setEmitidoId(created.id);
      toast.success("Convocatoria emitida correctamente");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      toast.error("No se pudo emitir la convocatoria", { description: msg });
    }
  }

  const isLastStep = current === STEPS.length;

  // ── Success screen ──
  if (emitidoId) {
    return (
      <div className="mx-auto max-w-[640px] p-6">
        <div
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-8 text-center"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <div
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center bg-[var(--status-success)]"
            style={{ borderRadius: "var(--g-radius-full)" }}
          >
            <Check className="h-6 w-6 text-[var(--g-text-inverse)]" />
          </div>
          <h2 className="text-xl font-semibold text-[var(--g-text-primary)]">
            Convocatoria emitida
          </h2>
          <p className="mt-2 text-sm text-[var(--g-text-secondary)]">
            La convocatoria ha quedado registrada. Los destinatarios recibirán la notificación
            según los canales seleccionados.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/secretaria/convocatorias")}
              className="bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              Ver convocatorias
            </button>
            <button
              type="button"
              onClick={() => navigate("/secretaria/reuniones")}
              className="border border-[var(--g-border-subtle)] px-4 py-2 text-sm text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              Ir a reuniones
            </button>
          </div>
        </div>
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
        Cancelar y volver
      </button>

      <div className="mb-6">
        <div className="text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
          Secretaría · Nueva convocatoria
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
          Asistente de convocatoria
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
                onClick={() => s.n < current && setCurrent(s.n)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${
                  active
                    ? "bg-[var(--g-surface-subtle)] font-semibold text-[var(--g-brand-3308)]"
                    : done
                    ? "text-[var(--g-text-secondary)] hover:bg-[var(--g-surface-subtle)]/50 cursor-pointer"
                    : "text-[var(--g-text-secondary)] opacity-50 cursor-default"
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

          {/* ── PASO 1: Sociedad y órgano ── */}
          {current === 1 && (
            <div className="mt-6 space-y-5">
              {/* Entidad */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--g-text-primary)]">
                  Sociedad convocante
                </label>
                <select
                  value={selectedEntityId ?? ""}
                  onChange={(e) => {
                    setSelectedEntityId(e.target.value || null);
                    setSelectedBodyId(null);
                  }}
                  className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <option value="">— Seleccionar sociedad —</option>
                  {entities.map((e) => (
                    <option key={e.id} value={e.id}>
                      {JURIS_FLAGS[(e as any).jurisdiction ?? "ES"] ?? "🏢"} {e.legal_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Órgano */}
              {selectedEntityId && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--g-text-primary)]">
                    Órgano convocante
                  </label>
                  {bodies.length === 0 ? (
                    <p className="text-xs text-[var(--g-text-secondary)]">
                      No hay órganos registrados para esta sociedad.
                    </p>
                  ) : (
                    <select
                      value={selectedBodyId ?? ""}
                      onChange={(e) => setSelectedBodyId(e.target.value || null)}
                      className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                      style={{ borderRadius: "var(--g-radius-md)" }}
                    >
                      <option value="">— Seleccionar órgano —</option>
                      {bodies.map((b) => (
                        <option key={b.id} value={b.id}>
                          {BODY_TYPE_LABELS[b.body_type] ?? b.body_type} — {b.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Tipo de convocatoria */}
              {selectedBodyId && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--g-text-primary)]">
                    Tipo de reunión
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {(["ORDINARIA", "EXTRAORDINARIA", "UNIVERSAL"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTipoConvocatoria(t)}
                        className={`px-3 py-1.5 text-xs font-medium border transition-colors ${
                          tipoConvocatoria === t
                            ? "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] border-[var(--g-brand-3308)]"
                            : "border-[var(--g-border-subtle)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
                        }`}
                        style={{ borderRadius: "var(--g-radius-md)" }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  {tipoConvocatoria === "UNIVERSAL" && (
                    <p className="text-xs text-[var(--g-text-secondary)] mt-1">
                      Junta universal: todos los socios presentes y de acuerdo en celebrarla. No requiere plazo de convocatoria.
                    </p>
                  )}
                </div>
              )}

              {/* Jurisdicción info badge */}
              {selectedEntity && (
                <div
                  className="flex items-center gap-3 p-3 bg-[var(--g-sec-100)] border border-[var(--g-sec-300)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <Globe className="h-4 w-4 shrink-0 text-[var(--g-brand-3308)]" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--g-text-primary)]">
                      {JURIS_FLAGS[jurisdiction] ?? "🏢"} {jurisdiction}
                      {(selectedEntity as any).tipo_social && (
                        <span className="ml-2 text-xs text-[var(--g-text-secondary)]">
                          {(selectedEntity as any).tipo_social}
                        </span>
                      )}
                    </p>
                    {liveNoticeDays != null && (
                      <p className="text-xs text-[var(--g-text-secondary)] mt-0.5">
                        Preaviso mínimo (TGMS):{" "}
                        <span className="font-semibold text-[var(--g-brand-3308)]">
                          {liveNoticeDays} días
                        </span>
                        {activeRuleSet?.legal_reference && (
                          <span className="ml-1 text-[10px]">· {activeRuleSet.legal_reference}</span>
                        )}
                      </p>
                    )}
                    {activeRuleSet?.statutory_override && (
                      <p className="text-xs text-[var(--status-warning)] mt-0.5">
                        ⚠ statutory_override — confirmar plazos con estatutos de la entidad
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── PASO 2: Fecha y plazo legal ── */}
          {current === 2 && (
            <div className="mt-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--g-text-primary)]">
                    Fecha de la reunión
                  </label>
                  <input
                    type="date"
                    value={fechaReunion}
                    onChange={(e) => setFechaReunion(e.target.value)}
                    className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--g-text-primary)]">
                    Hora
                  </label>
                  <input
                    type="time"
                    value={horaReunion}
                    onChange={(e) => setHoraReunion(e.target.value)}
                    className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--g-text-primary)]">
                  Lugar / enlace de acceso
                </label>
                <input
                  type="text"
                  value={lugar}
                  onChange={(e) => setLugar(e.target.value)}
                  placeholder="Ej. Sede social C/ Gran Vía 1, Madrid"
                  className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--g-text-primary)]">
                  Formato
                </label>
                <div className="flex gap-2">
                  {(["PRESENCIAL", "TELEMATICA", "MIXTA"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFormatoReunion(f)}
                      className={`px-3 py-1.5 text-xs font-medium border transition-colors ${
                        formatoReunion === f
                          ? "bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] border-[var(--g-brand-3308)]"
                          : "border-[var(--g-border-subtle)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
                      }`}
                      style={{ borderRadius: "var(--g-radius-md)" }}
                    >
                      {f === "PRESENCIAL" ? "Presencial" : f === "TELEMATICA" ? "Telemática" : "Mixta"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Engine V2 compliance panel */}
              {tipoConvocatoria !== "UNIVERSAL" && evaluacionV2 && (
                <div
                  className="border-l-4 border-[var(--g-sec-300)] bg-[var(--g-sec-100)] p-4"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-[var(--g-text-primary)]">
                        Evaluación de antelación — Motor LSC v2
                      </p>
                      {fechaReunion && (
                        <p className="mt-0.5 text-xs text-[var(--g-text-secondary)]">
                          {evaluacionV2.antelacionDiasRequerida} días requeridos
                        </p>
                      )}
                    </div>
                    <span
                      className="inline-flex h-6 items-center px-2.5 text-[11px] font-semibold text-[var(--g-text-inverse)]"
                      style={{
                        borderRadius: "var(--g-radius-full)",
                        backgroundColor: evaluacionV2.ok ? "var(--status-success)" : "var(--status-error)",
                      }}
                    >
                      {evaluacionV2.ok ? "OK" : "ERROR"}
                    </span>
                  </div>

                  {!evaluacionV2.ok && fechaReunion && (
                    <p className="mt-2 text-xs text-[var(--status-error)]">
                      El plazo mínimo no está cumplido. Ajusta la fecha de la reunión.
                    </p>
                  )}
                  {!fechaReunion && (
                    <p className="mt-2 text-xs text-[var(--g-text-secondary)]">
                      Selecciona la fecha para calcular el plazo.
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => setExpandExplain(!expandExplain)}
                    className="mt-3 flex items-center gap-1 text-xs font-medium text-[var(--g-brand-3308)] hover:text-[var(--g-sec-700)]"
                  >
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expandExplain ? "rotate-180" : ""}`} />
                    {expandExplain ? "Ocultar detalles" : "Ver detalles de evaluación"}
                  </button>

                  {expandExplain && (
                    <div className="mt-3 space-y-2 border-t border-[var(--g-border-subtle)] pt-3">
                      {evaluacionV2.explain.map((node, idx) => (
                        <div key={idx} className="text-xs text-[var(--g-text-secondary)]">
                          <p className="font-medium text-[var(--g-text-primary)]">{node.regla}</p>
                          <p>{node.mensaje}</p>
                          {node.referencia && (
                            <p className="text-[11px]">{node.fuente}: {node.referencia}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Segunda convocatoria */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={habilitarSegunda}
                    onChange={(e) => setHabilitarSegunda(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm text-[var(--g-text-primary)]">
                    Habilitar segunda convocatoria
                  </span>
                </label>
                {habilitarSegunda && (
                  <div className="mt-3 grid grid-cols-2 gap-4 pl-6">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-[var(--g-text-primary)]">
                        Fecha segunda convocatoria
                      </label>
                      <input
                        type="date"
                        value={fechaReunion2}
                        onChange={(e) => setFechaReunion2(e.target.value)}
                        min={fechaReunion}
                        className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                        style={{ borderRadius: "var(--g-radius-md)" }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-[var(--g-text-primary)]">Hora</label>
                      <input
                        type="time"
                        value={horaReunion2}
                        onChange={(e) => setHoraReunion2(e.target.value)}
                        className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                        style={{ borderRadius: "var(--g-radius-md)" }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── PASO 3: Orden del día ── */}
          {current === 3 && (
            <div className="mt-6 space-y-4">
              <p className="text-xs text-[var(--g-text-secondary)]">
                Añade los puntos del orden del día. Clasifica cada punto para que el motor
                aplique el quórum y mayoría correspondientes.
              </p>

              <div className="space-y-3">
                {agendaItems.map((item, idx) => (
                  <div
                    key={item.id}
                    className="border border-[var(--g-border-subtle)] p-3"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold text-[var(--g-text-secondary)]">
                        {idx + 1}.
                      </span>
                      <input
                        type="text"
                        value={item.titulo}
                        onChange={(e) => updateAgendaItem(item.id, { titulo: e.target.value })}
                        placeholder="Descripción del punto del orden del día"
                        className="flex-1 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-1.5 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                        style={{ borderRadius: "var(--g-radius-md)" }}
                      />
                      {agendaItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeAgendaItem(item.id)}
                          aria-label="Eliminar punto"
                          className="text-[var(--g-text-secondary)] hover:text-[var(--status-error)]"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-3 pl-5">
                      <select
                        value={item.tipo}
                        onChange={(e) => updateAgendaItem(item.id, { tipo: e.target.value as any })}
                        className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-2 py-1 text-xs text-[var(--g-text-primary)] focus:outline-none"
                        style={{ borderRadius: "var(--g-radius-sm)" }}
                      >
                        {AGENDA_TIPOS.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={item.inscribible}
                          onChange={(e) => updateAgendaItem(item.id, { inscribible: e.target.checked })}
                          className="h-3.5 w-3.5"
                        />
                        <span className="text-xs text-[var(--g-text-secondary)]">Inscribible en RM</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addAgendaItem}
                className="inline-flex items-center gap-1.5 border border-[var(--g-border-subtle)] px-3 py-1.5 text-xs text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <Plus className="h-3.5 w-3.5" />
                Añadir punto
              </button>
            </div>
          )}

          {/* ── PASO 4: Destinatarios ── */}
          {current === 4 && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[var(--g-brand-3308)]" />
                <p className="text-sm font-medium text-[var(--g-text-primary)]">
                  Miembros del órgano convocante
                </p>
              </div>

              {activeMandates.length === 0 ? (
                <div
                  className="bg-[var(--g-sec-100)] border border-[var(--g-sec-300)] p-4"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <p className="text-sm text-[var(--g-text-secondary)]">
                    No hay miembros vigentes registrados para este órgano.
                    La convocatoria se enviará sin destinatarios predefinidos.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeMandates.map((m) => {
                    const excluded = excludedPersonIds.has(m.person_id);
                    return (
                      <div
                        key={m.id}
                        className={`flex items-center justify-between p-3 border ${
                          excluded
                            ? "border-[var(--g-border-subtle)] opacity-50"
                            : "border-[var(--g-sec-300)] bg-[var(--g-sec-100)]"
                        }`}
                        style={{ borderRadius: "var(--g-radius-md)" }}
                      >
                        <div>
                          <p className="text-sm font-medium text-[var(--g-text-primary)]">
                            {m.full_name ?? "—"}
                          </p>
                          <p className="text-xs text-[var(--g-text-secondary)]">
                            {m.role ?? "Miembro"}{m.email ? ` · ${m.email}` : ""}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleExclude(m.person_id)}
                          className={`text-xs px-2 py-1 border ${
                            excluded
                              ? "border-[var(--g-border-subtle)] text-[var(--g-text-secondary)] hover:bg-[var(--g-sec-100)]"
                              : "border-[var(--status-error)] text-[var(--status-error)] hover:bg-[var(--g-surface-card)]"
                          }`}
                          style={{ borderRadius: "var(--g-radius-sm)" }}
                        >
                          {excluded ? "Incluir" : "Excluir"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <p className="text-xs text-[var(--g-text-secondary)]">
                {activeMandates.length - excludedPersonIds.size} destinatario(s) seleccionado(s).
                Las notificaciones se enviarán por los canales que configures en el paso siguiente.
              </p>
            </div>
          )}

          {/* ── PASO 5: Canales de publicación ── */}
          {current === 5 && (
            <div className="mt-6 space-y-4">
              <p className="text-xs text-[var(--g-text-secondary)]">
                Selecciona los canales de publicación y notificación. Los canales recomendados
                se resaltan según la jurisdicción ({jurisdiction}).
              </p>

              <div className="space-y-2">
                {channelOpts.map((ch) => (
                  <label
                    key={ch.value}
                    className={`flex items-center gap-3 p-3 border cursor-pointer transition-colors ${
                      channels.includes(ch.value)
                        ? "border-[var(--g-brand-3308)] bg-[var(--g-sec-100)]"
                        : "border-[var(--g-border-subtle)] hover:bg-[var(--g-surface-subtle)]"
                    }`}
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    <input
                      type="checkbox"
                      checked={channels.includes(ch.value)}
                      onChange={() => toggleChannel(ch.value)}
                      className="h-4 w-4 shrink-0"
                    />
                    <span className="text-sm text-[var(--g-text-primary)] flex-1">{ch.label}</span>
                    {ch.recommended && (
                      <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]"
                        style={{ borderRadius: "var(--g-radius-sm)" }}
                      >
                        Recomendado
                      </span>
                    )}
                  </label>
                ))}
              </div>

              {channels.length === 0 && (
                <p className="text-xs text-[var(--status-warning)]">
                  Sin canales seleccionados la convocatoria se archivará pero no generará notificaciones.
                </p>
              )}
            </div>
          )}

          {/* ── PASO 6: Adjuntos ── */}
          {current === 6 && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[var(--g-brand-3308)]" />
                <p className="text-sm font-medium text-[var(--g-text-primary)]">
                  Documentos adjuntos a la convocatoria
                </p>
              </div>
              <p className="text-xs text-[var(--g-text-secondary)]">
                Registra los documentos que se remiten junto con la convocatoria
                (informe de gestión, propuestas de acuerdo, cuentas anuales, etc.).
              </p>

              {adjuntos.length === 0 ? (
                <div
                  className="border border-dashed border-[var(--g-border-subtle)] p-6 text-center"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <p className="text-sm text-[var(--g-text-secondary)]">No hay adjuntos añadidos.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {adjuntos.map((a) => (
                    <div
                      key={a.id}
                      className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center border border-[var(--g-border-subtle)] p-2"
                      style={{ borderRadius: "var(--g-radius-md)" }}
                    >
                      <input
                        type="text"
                        value={a.nombre}
                        onChange={(e) => updateAdjunto(a.id, "nombre", e.target.value)}
                        placeholder="Nombre del documento"
                        className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--g-brand-3308)]"
                        style={{ borderRadius: "var(--g-radius-sm)" }}
                      />
                      <input
                        type="text"
                        value={a.descripcion}
                        onChange={(e) => updateAdjunto(a.id, "descripcion", e.target.value)}
                        placeholder="Descripción (opcional)"
                        className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--g-brand-3308)]"
                        style={{ borderRadius: "var(--g-radius-sm)" }}
                      />
                      <button
                        type="button"
                        onClick={() => removeAdjunto(a.id)}
                        aria-label="Eliminar adjunto"
                        className="text-[var(--g-text-secondary)] hover:text-[var(--status-error)]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={addAdjunto}
                className="inline-flex items-center gap-1.5 border border-[var(--g-border-subtle)] px-3 py-1.5 text-xs text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <Plus className="h-3.5 w-3.5" />
                Añadir adjunto
              </button>
            </div>
          )}

          {/* ── PASO 7: Revisión y emisión ── */}
          {current === 7 && (
            <div className="mt-6 space-y-5">
              {/* Summary grid */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <SummaryCard label="Sociedad" value={selectedEntity?.legal_name ?? "—"} />
                <SummaryCard label="Órgano" value={selectedBody?.name ?? "—"} />
                <SummaryCard label="Tipo" value={tipoConvocatoria} />
                <SummaryCard label="Formato" value={formatoReunion} />
                <SummaryCard
                  label="Primera convocatoria"
                  value={fechaReunion ? `${fechaReunion} ${horaReunion}` : "—"}
                />
                {habilitarSegunda && (
                  <SummaryCard
                    label="Segunda convocatoria"
                    value={fechaReunion2 ? `${fechaReunion2} ${horaReunion2}` : "—"}
                  />
                )}
                <SummaryCard label="Lugar" value={lugar || "—"} />
                <SummaryCard
                  label="Canales"
                  value={channels.length > 0 ? channels.join(", ") : "Ninguno seleccionado"}
                />
              </div>

              {/* Orden del día summary */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--g-text-secondary)] mb-2">
                  Orden del día ({agendaItems.filter((i) => i.titulo.trim()).length} puntos)
                </p>
                {agendaItems.filter((i) => i.titulo.trim()).length === 0 ? (
                  <p className="text-xs text-[var(--status-warning)]">Sin puntos definidos.</p>
                ) : (
                  <ol className="space-y-1">
                    {agendaItems
                      .filter((i) => i.titulo.trim())
                      .map((item, idx) => (
                        <li key={item.id} className="text-sm text-[var(--g-text-primary)]">
                          <span className="text-[var(--g-text-secondary)]">{idx + 1}. </span>
                          {item.titulo}
                          <span className="ml-2 text-xs text-[var(--g-text-secondary)]">
                            [{item.tipo}{item.inscribible ? " · inscribible" : ""}]
                          </span>
                        </li>
                      ))}
                  </ol>
                )}
              </div>

              {/* Compliance badge */}
              <div
                className={`p-3 border-l-4 ${
                  tipoConvocatoria === "UNIVERSAL" || noticeOk
                    ? "border-[var(--status-success)] bg-[var(--g-sec-100)]"
                    : "border-[var(--status-error)] bg-[var(--g-surface-card)]"
                }`}
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <p className="text-sm font-medium text-[var(--g-text-primary)]">
                  {tipoConvocatoria === "UNIVERSAL"
                    ? "Junta universal — no requiere plazo de convocatoria"
                    : noticeOk
                    ? "Plazo de convocatoria cumplido"
                    : "Plazo de convocatoria NO cumplido — revisa la fecha en el paso 2"}
                </p>
              </div>

              {/* Destinatarios count */}
              <p className="text-xs text-[var(--g-text-secondary)]">
                <span className="font-semibold">{activeMandates.length - excludedPersonIds.size}</span> destinatario(s)
                {adjuntos.filter((a) => a.nombre.trim()).length > 0 && (
                  <> · <span className="font-semibold">{adjuntos.filter((a) => a.nombre.trim()).length}</span> adjunto(s)</>
                )}
              </p>
            </div>
          )}

          {/* ── Navigation ── */}
          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrent((n) => Math.max(1, n - 1))}
              disabled={current === 1}
              className="inline-flex items-center gap-1 border border-[var(--g-border-subtle)] px-4 py-2 text-sm text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] disabled:opacity-40"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              Anterior
            </button>

            {isLastStep ? (
              <button
                type="button"
                disabled={createConvocatoria.isPending || (!noticeOk && tipoConvocatoria !== "UNIVERSAL")}
                onClick={handleEmitir}
                aria-busy={createConvocatoria.isPending}
                className="inline-flex items-center gap-1.5 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] disabled:cursor-not-allowed disabled:opacity-50"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <Send className="h-4 w-4" />
                {createConvocatoria.isPending ? "Emitiendo…" : "Emitir convocatoria"}
              </button>
            ) : (
              <button
                type="button"
                disabled={!canAdvance()}
                onClick={() => setCurrent((n) => Math.min(STEPS.length, n + 1))}
                className="inline-flex items-center gap-1.5 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] disabled:cursor-not-allowed disabled:opacity-50"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                Siguiente
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[var(--g-border-subtle)] p-3" style={{ borderRadius: "var(--g-radius-md)" }}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--g-text-secondary)]">{label}</p>
      <p className="mt-0.5 text-sm text-[var(--g-text-primary)] truncate">{value}</p>
    </div>
  );
}
