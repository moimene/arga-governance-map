import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft, Check, ChevronRight, FileText,
  ThumbsUp, ThumbsDown, Minus, Users, AlertTriangle,
} from "lucide-react";
import { useEntitiesList } from "@/hooks/useEntities";
import { useBodiesByEntity } from "@/hooks/useBodies";
import { useBodyMandates } from "@/hooks/useBodies";
import {
  useCreateNoSessionResolution,
  useAdoptNoSessionAgreement,
  useCastVote,
  useAcuerdoSinSesionById,
  type VoteChoice,
} from "@/hooks/useAcuerdosSinSesion";
import { evaluarMayoria } from "@/lib/rules-engine/majority-evaluator";
import { useSecretariaScope } from "@/components/secretaria/shell";

const STEPS = [
  { n: 1, label: "Tipo y órgano",    hint: "Seleccionar sociedad, órgano y tipo de acuerdo" },
  { n: 2, label: "Propuesta",         hint: "Redacción del texto del acuerdo y fundamento jurídico" },
  { n: 3, label: "Participantes",     hint: "Miembros con derecho a voto y plazo de respuesta" },
  { n: 4, label: "Votación",          hint: "Recogida de votos por escrito de cada miembro" },
  { n: 5, label: "Cierre y acuerdo",  hint: "Resultado final — si aprobado, genera acuerdo ADOPTED" },
];

const JURIS_FLAGS: Record<string, string> = { ES: "🇪🇸", PT: "🇵🇹", BR: "🇧🇷", MX: "🇲🇽" };

const MATTER_CLASSES = [
  { value: "ORDINARIA",   label: "Ordinaria",   desc: "Mayoría simple de votos emitidos" },
  { value: "ESTATUTARIA", label: "Estatutaria", desc: "Mayoría cualificada según estatutos" },
  { value: "ESTRUCTURAL", label: "Estructural", desc: "Mayoría reforzada — inscribible en RM" },
] as const;

const AGREEMENT_KINDS: Record<string, string[]> = {
  ORDINARIA:   ["APROBACION_CUENTAS", "NOMBRAMIENTO_CONSEJERO", "CESE_CONSEJERO", "DELEGACION_FACULTADES", "DISTRIBUCION_DIVIDENDOS"],
  ESTATUTARIA: ["MODIFICACION_ESTATUTOS", "CAMBIO_DENOMINACION", "CAMBIO_DOMICILIO", "MODIFICACION_OBJETO"],
  ESTRUCTURAL: ["AUMENTO_CAPITAL", "REDUCCION_CAPITAL", "DISOLUCION", "FUSION", "ESCISION", "NOMBRAMIENTO_AUDITOR"],
};

const AGREEMENT_KIND_LABELS: Record<string, string> = {
  APROBACION_CUENTAS:    "Aprobación de cuentas anuales",
  NOMBRAMIENTO_CONSEJERO:"Nombramiento de consejero/administrador",
  CESE_CONSEJERO:        "Cese de consejero/administrador",
  DELEGACION_FACULTADES: "Delegación de facultades",
  DISTRIBUCION_DIVIDENDOS:"Distribución de dividendos",
  MODIFICACION_ESTATUTOS:"Modificación de estatutos",
  CAMBIO_DENOMINACION:   "Cambio de denominación social",
  CAMBIO_DOMICILIO:      "Cambio de domicilio social",
  MODIFICACION_OBJETO:   "Modificación del objeto social",
  AUMENTO_CAPITAL:       "Aumento de capital",
  REDUCCION_CAPITAL:     "Reducción de capital",
  DISOLUCION:            "Disolución de la sociedad",
  FUSION:                "Fusión",
  ESCISION:              "Escisión",
  NOMBRAMIENTO_AUDITOR:  "Nombramiento de auditor",
};

const BODY_TYPE_LABELS: Record<string, string> = {
  JUNTA:   "Junta General / Asamblea",
  CDA:     "Consejo de Administración",
  COMISION:"Comisión",
  COMITE:  "Comité",
};

const TALLY_COUNT_CLASS = {
  FOR: "text-[var(--status-success)]",
  AGAINST: "text-[var(--status-error)]",
  ABSTAIN: "text-[var(--g-text-secondary)]",
} as const;

const VOTE_BADGE_CLASS: Record<VoteChoice, string> = {
  FOR: "bg-[var(--status-success)]",
  AGAINST: "bg-[var(--status-error)]",
  ABSTAIN: "bg-[var(--status-warning)]",
};

function evaluarResultado(
  votesFor: number,
  votesAgainst: number,
  abstentions: number,
  total: number,
  matterClass: string,
  requiresUnanimity: boolean,
): { aprobado: boolean; motivo: string } {
  if (requiresUnanimity) {
    const aprobado = votesFor === total && votesAgainst === 0 && abstentions === 0;
    return {
      aprobado,
      motivo: aprobado
        ? "Unanimidad alcanzada"
        : `Unanimidad requerida — ${votesAgainst} voto(s) en contra o ${abstentions} abstención(es)`,
    };
  }
  const emitidos = votesFor + votesAgainst;
  if (emitidos === 0) return { aprobado: false, motivo: "Sin votos emitidos" };
  const pctFor = (votesFor / emitidos) * 100;
  const threshold = matterClass === "ESTRUCTURAL" ? 66.67 : matterClass === "ESTATUTARIA" ? 60 : 50;
  const aprobado = pctFor > threshold;
  return {
    aprobado,
    motivo: aprobado
      ? `Aprobado con ${pctFor.toFixed(1)}% de votos a favor (umbral: >${threshold}%)`
      : `Rechazado — ${pctFor.toFixed(1)}% de votos a favor (umbral: >${threshold}%)`,
  };
}

export default function AcuerdoSinSesionStepper() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const scope = useSecretariaScope();
  const scopedEntityId =
    scope.mode === "sociedad"
      ? scope.selectedEntity?.id ?? searchParams.get("entity")
      : null;
  const isSociedadScoped = Boolean(scopedEntityId);
  const scopedListPath = scope.createScopedTo("/secretaria/acuerdos-sin-sesion");
  const createResolution = useCreateNoSessionResolution();
  const adoptAgreement = useAdoptNoSessionAgreement();

  const [current, setCurrent] = useState(1);

  // ── Step 1 ──
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(() => scopedEntityId);
  const [selectedBodyId, setSelectedBodyId] = useState<string | null>(null);
  const [matterClass, setMatterClass] = useState<"ORDINARIA" | "ESTATUTARIA" | "ESTRUCTURAL">("ORDINARIA");
  const [agreementKind, setAgreementKind] = useState("");
  const [requiresUnanimity, setRequiresUnanimity] = useState(false);

  useEffect(() => {
    if (!scopedEntityId) return;
    setSelectedEntityId((current) => (current === scopedEntityId ? current : scopedEntityId));
    setSelectedBodyId(null);
    setAgreementKind("");
  }, [scopedEntityId]);

  const { data: entities = [] } = useEntitiesList();
  const { data: bodies = [] } = useBodiesByEntity(selectedEntityId ?? undefined);
  const selectedEntity = entities.find((e) => e.id === selectedEntityId) ?? null;
  const selectedBody = bodies.find((b) => b.id === selectedBodyId) ?? null;
  const jurisdiction = selectedEntity?.jurisdiction ?? "ES";

  // ── Step 2 ──
  const [title, setTitle] = useState("");
  const [proposalText, setProposalText] = useState("");
  const [fundamentoJuridico, setFundamentoJuridico] = useState("");

  // ── Step 3 ──
  const { data: mandates = [] } = useBodyMandates(selectedBodyId ?? undefined);
  const activeMembers = mandates.filter((m) => m.status === "Activo");
  const [deadlineDays, setDeadlineDays] = useState(5);
  const [excludedPersonIds, setExcludedPersonIds] = useState<Set<string>>(new Set());
  const includedMembers = activeMembers.filter((m) => !excludedPersonIds.has(m.person_id));

  function toggleExclude(personId: string) {
    setExcludedPersonIds((prev) => {
      const next = new Set(prev);
      if (next.has(personId)) {
        next.delete(personId);
      } else {
        next.add(personId);
      }
      return next;
    });
  }

  // ── Step 4: voting ──
  const [resolutionId, setResolutionId] = useState<string | null>(null);
  const [memberVotes, setMemberVotes] = useState<Record<string, VoteChoice>>({});
  const castVote = useCastVote(resolutionId ?? undefined);
  const { data: resolution } = useAcuerdoSinSesionById(resolutionId ?? undefined);

  const votesFor = resolution?.votes_for ?? 0;
  const votesAgainst = resolution?.votes_against ?? 0;
  const abstentions = resolution?.abstentions ?? 0;
  const totalVoters = resolution ? resolution.total_members ?? includedMembers.length : includedMembers.length;
  const votadosCount = Object.keys(memberVotes).length;
  const pendingVoters = includedMembers.filter((m) => !memberVotes[m.person_id]);

  async function handleCastVote(personId: string, choice: VoteChoice) {
    if (memberVotes[personId]) return; // ya votó
    try {
      await castVote.mutateAsync(choice);
      setMemberVotes((prev) => ({ ...prev, [personId]: choice }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al registrar voto";
      toast.error(msg);
    }
  }

  // ── Step 3 → 4 transition: create resolution ──
  async function handleOpenVoting() {
    if (!selectedBodyId || !tenantEntityId || createResolution.isPending) return;
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + deadlineDays);
    try {
      const created = await createResolution.mutateAsync({
        body_id: selectedBodyId,
        title: title.trim() || `${AGREEMENT_KIND_LABELS[agreementKind] ?? agreementKind} — Acuerdo sin sesión`,
        proposal_text: proposalText + (fundamentoJuridico ? `\n\nFundamento jurídico: ${fundamentoJuridico}` : ""),
        matter_class: matterClass,
        agreement_kind: agreementKind,
        requires_unanimity: requiresUnanimity,
        total_members: includedMembers.length,
        voting_deadline: deadline.toISOString(),
      });
      setResolutionId(created.id);
      setCurrent(4);
      toast.success("Proceso de votación iniciado");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al crear el proceso";
      toast.error("No se pudo iniciar la votación", { description: msg });
    }
  }

  // ── Step 5: close ──
  const resultado = resolution
    ? evaluarResultado(votesFor, votesAgainst, abstentions, totalVoters, matterClass, requiresUnanimity)
    : null;
  const [adoptedAgreementId, setAdoptedAgreementId] = useState<string | null>(null);
  const [closeDone, setCloseDone] = useState(false);

  async function handleCerrar(decision: "APROBADO" | "RECHAZADO") {
    if (!resolutionId || !selectedBodyId || !tenantEntityId || adoptAgreement.isPending) return;
    try {
      const agreementId = await adoptAgreement.mutateAsync({
        resolutionId,
        bodyId: selectedBodyId,
        entityId: tenantEntityId,
        matterClass,
        agreementKind: agreementKind,
        resultado: decision,
      });
      if (agreementId) setAdoptedAgreementId(agreementId);
      setCloseDone(true);
      toast.success(
        decision === "APROBADO" ? "Acuerdo adoptado correctamente" : "Acuerdo rechazado — proceso cerrado",
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al cerrar";
      toast.error("No se pudo cerrar el proceso", { description: msg });
    }
  }

  const tenantEntityId = selectedEntityId ?? "";

  // ── Validation ──
  function canAdvance(): boolean {
    switch (current) {
      case 1: return !!selectedEntityId && !!selectedBodyId && !!agreementKind;
      case 2: return title.trim().length > 0 && proposalText.trim().length > 0;
      case 3: return includedMembers.length > 0;
      default: return true;
    }
  }

  // ── Success screen ──
  if (closeDone) {
    const approved = !!adoptedAgreementId;
    return (
      <div className="mx-auto max-w-[640px] p-6">
        <div
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-8 text-center"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <div
            className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center ${
              approved ? "bg-[var(--status-success)]" : "bg-[var(--g-surface-muted)]"
            }`}
            style={{ borderRadius: "var(--g-radius-full)" }}
          >
            {approved
              ? <Check className="h-6 w-6 text-[var(--g-text-inverse)]" />
              : <Minus className="h-6 w-6 text-[var(--g-text-secondary)]" />
            }
          </div>
          <h2 className="text-xl font-semibold text-[var(--g-text-primary)]">
            {approved ? "Acuerdo adoptado" : "Acuerdo rechazado"}
          </h2>
          <p className="mt-2 text-sm text-[var(--g-text-secondary)]">
            {approved
              ? "El acuerdo ha sido registrado en estado ADOPTED. Puedes tramitarlo en el Tramitador cuando sea necesario."
              : "El proceso ha sido cerrado sin adopción de acuerdo."}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            {adoptedAgreementId && (
              <button
                type="button"
                onClick={() => navigate(scope.createScopedTo(`/secretaria/acuerdos/${adoptedAgreementId}`))}
                className="bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                Ver expediente
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate(scopedListPath)}
              className="border border-[var(--g-border-subtle)] px-4 py-2 text-sm text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              Volver a la lista
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
        onClick={() => navigate(scopedListPath)}
        className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--g-text-secondary)] hover:text-[var(--g-brand-3308)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Cancelar y volver
      </button>

      <div className="mb-6">
        <div className="text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
          Secretaría · Acuerdo sin sesión
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--g-text-primary)]">
          Asistente de acuerdo escrito sin sesión
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
            const locked = s.n > current && s.n !== 4; // paso 4 se abre via handleOpenVoting
            return (
              <button
                key={s.n}
                type="button"
                onClick={() => done && setCurrent(s.n)}
                disabled={locked}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${
                  active
                    ? "bg-[var(--g-surface-subtle)] font-semibold text-[var(--g-brand-3308)]"
                    : done
                    ? "text-[var(--g-text-secondary)] hover:bg-[var(--g-surface-subtle)]/50 cursor-pointer"
                    : "text-[var(--g-text-secondary)] opacity-40 cursor-default"
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

          {/* ── PASO 1: Tipo y órgano ── */}
          {current === 1 && (
            <div className="mt-6 space-y-5">
              {/* Entidad */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--g-text-primary)]">Sociedad</label>
                {isSociedadScoped && (
                  <p className="text-xs text-[var(--g-text-secondary)]">
                    Modo Sociedad activo: el acuerdo sin sesión se abrirá para esta sociedad.
                  </p>
                )}
                <select
                  value={selectedEntityId ?? ""}
                  disabled={isSociedadScoped}
                  onChange={(e) => {
                    setSelectedEntityId(e.target.value || null);
                    setSelectedBodyId(null);
                    setAgreementKind("");
                  }}
                  className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] disabled:bg-[var(--g-surface-muted)] disabled:text-[var(--g-text-secondary)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <option value="">— Seleccionar sociedad —</option>
                  {entities.map((e) => (
                    <option key={e.id} value={e.id}>
                      {JURIS_FLAGS[e.jurisdiction ?? "ES"] ?? "🏢"} {e.legal_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Órgano */}
              {selectedEntityId && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--g-text-primary)]">Órgano</label>
                  {bodies.length === 0 ? (
                    <p className="text-xs text-[var(--g-text-secondary)]">No hay órganos registrados.</p>
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

              {/* Tipo de acuerdo */}
              {selectedBodyId && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[var(--g-text-primary)]">Clase de materia</label>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {MATTER_CLASSES.map((mc) => (
                        <button
                          key={mc.value}
                          type="button"
                          onClick={() => { setMatterClass(mc.value); setAgreementKind(""); }}
                          className={`p-3 text-left border transition-colors ${
                            matterClass === mc.value
                              ? "border-[var(--g-brand-3308)] bg-[var(--g-sec-100)]"
                              : "border-[var(--g-border-subtle)] hover:bg-[var(--g-surface-subtle)]"
                          }`}
                          style={{ borderRadius: "var(--g-radius-md)" }}
                        >
                          <p className={`text-sm font-medium ${matterClass === mc.value ? "text-[var(--g-brand-3308)]" : "text-[var(--g-text-primary)]"}`}>
                            {mc.label}
                          </p>
                          <p className="text-xs text-[var(--g-text-secondary)] mt-0.5">{mc.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[var(--g-text-primary)]">Tipo de acuerdo</label>
                    <select
                      value={agreementKind}
                      onChange={(e) => setAgreementKind(e.target.value)}
                      className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                      style={{ borderRadius: "var(--g-radius-md)" }}
                    >
                      <option value="">— Seleccionar tipo —</option>
                      {(AGREEMENT_KINDS[matterClass] ?? []).map((k) => (
                        <option key={k} value={k}>{AGREEMENT_KIND_LABELS[k] ?? k}</option>
                      ))}
                    </select>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requiresUnanimity}
                      onChange={(e) => setRequiresUnanimity(e.target.checked)}
                      className="h-4 w-4"
                    />
                    <span className="text-sm text-[var(--g-text-primary)]">Requiere unanimidad</span>
                    <span className="text-xs text-[var(--g-text-secondary)]">
                      (si desmarcado, se aplica mayoría según clase de materia)
                    </span>
                  </label>
                </>
              )}
            </div>
          )}

          {/* ── PASO 2: Propuesta ── */}
          {current === 2 && (
            <div className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--g-text-primary)]">
                  Título del acuerdo
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={`${AGREEMENT_KIND_LABELS[agreementKind] ?? "Acuerdo"} — ${selectedEntity?.legal_name ?? ""}`}
                  className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--g-text-primary)]">
                  Texto de la propuesta de acuerdo
                </label>
                <textarea
                  value={proposalText}
                  onChange={(e) => setProposalText(e.target.value)}
                  rows={8}
                  placeholder="Redacta aquí el texto completo de la propuesta de acuerdo que se somete a votación..."
                  className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] resize-none"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
                <p className="text-xs text-[var(--g-text-secondary)]">
                  {proposalText.length} caracteres
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--g-text-primary)]">
                  Fundamento jurídico (opcional)
                </label>
                <textarea
                  value={fundamentoJuridico}
                  onChange={(e) => setFundamentoJuridico(e.target.value)}
                  rows={3}
                  placeholder="Ej. Art. 168 LSC — competencia de la junta general para nombramiento de administradores..."
                  className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] resize-none"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </div>
            </div>
          )}

          {/* ── PASO 3: Participantes ── */}
          {current === 3 && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[var(--g-brand-3308)]" />
                <p className="text-sm font-medium text-[var(--g-text-primary)]">
                  Miembros con derecho a voto
                </p>
              </div>

              {activeMembers.length === 0 ? (
                <div
                  className="border border-[var(--g-sec-300)] bg-[var(--g-sec-100)] p-4"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <p className="text-sm text-[var(--g-text-secondary)]">
                    No hay miembros vigentes en este órgano. El proceso se iniciará con 1 votante por defecto.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeMembers.map((m) => {
                    const excluded = excludedPersonIds.has(m.person_id);
                    return (
                      <div
                        key={m.id}
                        className={`flex items-center justify-between p-3 border ${
                          excluded
                            ? "border-[var(--g-border-subtle)] opacity-40"
                            : "border-[var(--g-sec-300)] bg-[var(--g-sec-100)]"
                        }`}
                        style={{ borderRadius: "var(--g-radius-md)" }}
                      >
                        <div>
                          <p className="text-sm font-medium text-[var(--g-text-primary)]">
                            {m.full_name ?? "—"}
                          </p>
                          <p className="text-xs text-[var(--g-text-secondary)]">{m.role ?? "Miembro"}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleExclude(m.person_id)}
                          className={`text-xs px-2 py-1 border ${
                            excluded
                              ? "border-[var(--g-border-subtle)] text-[var(--g-text-secondary)]"
                              : "border-[var(--status-error)] text-[var(--status-error)]"
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

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--g-text-primary)]">
                  Plazo para votar (días hábiles)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={deadlineDays}
                    onChange={(e) => setDeadlineDays(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-24 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  />
                  <p className="text-xs text-[var(--g-text-secondary)]">
                    Deadline: {new Date(Date.now() + deadlineDays * 24 * 60 * 60 * 1000).toLocaleDateString("es-ES")}
                  </p>
                </div>
              </div>

              <div
                className="bg-[var(--g-sec-100)] border border-[var(--g-sec-300)] p-3"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <p className="text-sm text-[var(--g-text-primary)]">
                  <span className="font-semibold">{includedMembers.length}</span> votante(s) incluido(s) ·{" "}
                  {requiresUnanimity
                    ? "Se requiere unanimidad"
                    : `Mayoría requerida: ${matterClass === "ESTRUCTURAL" ? ">66.67%" : matterClass === "ESTATUTARIA" ? ">60%" : ">50%"}`}
                </p>
              </div>
            </div>
          )}

          {/* ── PASO 4: Votación ── */}
          {current === 4 && resolution && (
            <div className="mt-6 space-y-5">
              {/* Tally */}
              <div className="grid grid-cols-3 gap-3">
                {([
                  { label: "A favor", count: votesFor, tone: "FOR" },
                  { label: "En contra", count: votesAgainst, tone: "AGAINST" },
                  { label: "Abstenciones", count: abstentions, tone: "ABSTAIN" },
                ] as const).map((v) => (
                  <div
                    key={v.label}
                    className="border border-[var(--g-border-subtle)] p-4 text-center"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    <p className={`text-2xl font-bold ${TALLY_COUNT_CLASS[v.tone]}`}>{v.count}</p>
                    <p className="text-xs text-[var(--g-text-secondary)] mt-1">{v.label}</p>
                  </div>
                ))}
              </div>

              <p className="text-xs text-[var(--g-text-secondary)]">
                {votadosCount} de {includedMembers.length} miembro(s) han votado
              </p>

              {/* Per-member voting */}
              <div className="space-y-2">
                {includedMembers.map((m) => {
                  const vote = memberVotes[m.person_id];
                  return (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-3 border border-[var(--g-border-subtle)]"
                      style={{ borderRadius: "var(--g-radius-md)" }}
                    >
                      <div>
                        <p className="text-sm font-medium text-[var(--g-text-primary)]">
                          {m.full_name ?? "—"}
                        </p>
                        <p className="text-xs text-[var(--g-text-secondary)]">{m.role ?? "Miembro"}</p>
                      </div>
                      {vote ? (
                        <span
                          className={`text-xs font-semibold px-2.5 py-1 text-[var(--g-text-inverse)] ${VOTE_BADGE_CLASS[vote]}`}
                          style={{
                            borderRadius: "var(--g-radius-full)",
                          }}
                        >
                          {vote === "FOR" ? "A favor" : vote === "AGAINST" ? "En contra" : "Abstención"}
                        </span>
                      ) : (
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => handleCastVote(m.person_id, "FOR")}
                            disabled={castVote.isPending}
                            aria-label="Votar a favor"
                            className="flex h-8 w-8 items-center justify-center border border-[var(--status-success)] text-[var(--status-success)] hover:bg-[var(--g-sec-100)] disabled:opacity-40"
                            style={{ borderRadius: "var(--g-radius-sm)" }}
                          >
                            <ThumbsUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCastVote(m.person_id, "AGAINST")}
                            disabled={castVote.isPending}
                            aria-label="Votar en contra"
                            className="flex h-8 w-8 items-center justify-center border border-[var(--status-error)] text-[var(--status-error)] hover:bg-[var(--g-surface-card)] disabled:opacity-40"
                            style={{ borderRadius: "var(--g-radius-sm)" }}
                          >
                            <ThumbsDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCastVote(m.person_id, "ABSTAIN")}
                            disabled={castVote.isPending}
                            aria-label="Abstención"
                            className="flex h-8 w-8 items-center justify-center border border-[var(--g-border-subtle)] text-[var(--g-text-secondary)] hover:bg-[var(--g-surface-subtle)] disabled:opacity-40"
                            style={{ borderRadius: "var(--g-radius-sm)" }}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {pendingVoters.length > 0 && (
                <div
                  className="flex items-center gap-2 border border-[var(--g-border-subtle)] p-3 bg-[var(--g-surface-subtle)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--status-warning)]" />
                  <p className="text-xs text-[var(--g-text-secondary)]">
                    {pendingVoters.length} miembro(s) aún no han votado. Puedes cerrar la votación
                    en el siguiente paso aunque no todos hayan votado.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Paso 4 — sin resolution aún (no debería ocurrir) */}
          {current === 4 && !resolution && (
            <div className="mt-6">
              <p className="text-sm text-[var(--g-text-secondary)]">Cargando proceso de votación…</p>
            </div>
          )}

          {/* ── PASO 5: Cierre y acuerdo ── */}
          {current === 5 && (
            <div className="mt-6 space-y-5">
              {/* Resultado */}
              {resultado && (
                <div
                  className={`p-4 border-l-4 ${
                    resultado.aprobado
                      ? "border-[var(--status-success)] bg-[var(--g-sec-100)]"
                      : "border-[var(--status-error)] bg-[var(--g-surface-card)]"
                  }`}
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <p className="text-sm font-semibold text-[var(--g-text-primary)]">
                    {resultado.aprobado ? "Resultado: APROBADO" : "Resultado: RECHAZADO"}
                  </p>
                  <p className="text-xs text-[var(--g-text-secondary)] mt-1">{resultado.motivo}</p>
                </div>
              )}

              {/* Tally final */}
              <div className="grid grid-cols-4 gap-3 text-center">
                {[
                  { label: "A favor", count: votesFor },
                  { label: "En contra", count: votesAgainst },
                  { label: "Abstenciones", count: abstentions },
                  { label: "Total votantes", count: totalVoters },
                ].map((v) => (
                  <div
                    key={v.label}
                    className="border border-[var(--g-border-subtle)] p-3"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    <p className="text-xl font-bold text-[var(--g-text-primary)]">{v.count}</p>
                    <p className="text-[10px] text-[var(--g-text-secondary)] mt-0.5">{v.label}</p>
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div
                className="border border-[var(--g-border-subtle)] p-4 space-y-2"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--g-text-secondary)]">Tipo de acuerdo</span>
                  <span className="font-medium text-[var(--g-text-primary)]">
                    {AGREEMENT_KIND_LABELS[agreementKind] ?? agreementKind}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--g-text-secondary)]">Clase</span>
                  <span className="font-medium text-[var(--g-text-primary)]">{matterClass}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--g-text-secondary)]">Mayoría</span>
                  <span className="font-medium text-[var(--g-text-primary)]">
                    {requiresUnanimity ? "Unanimidad" :
                      matterClass === "ESTRUCTURAL" ? ">66.67%" :
                      matterClass === "ESTATUTARIA" ? ">60%" : ">50%"}
                  </span>
                </div>
              </div>

              {!resultado?.aprobado && (
                <div
                  className="flex items-start gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] p-3"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--status-warning)] mt-0.5" />
                  <p className="text-xs text-[var(--g-text-secondary)]">
                    El acuerdo no alcanza la mayoría requerida. Puedes cerrarlo como RECHAZADO
                    o volver al paso 4 para registrar votos pendientes.
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={adoptAgreement.isPending}
                  onClick={() => handleCerrar("APROBADO")}
                  className={`flex-1 py-2.5 text-sm font-medium text-[var(--g-text-inverse)] transition-colors disabled:opacity-50 ${
                    resultado?.aprobado
                      ? "bg-[var(--status-success)] hover:opacity-90"
                      : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] cursor-not-allowed"
                  }`}
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  <Check className="inline h-4 w-4 mr-1.5" />
                  Adoptar acuerdo
                </button>
                <button
                  type="button"
                  disabled={adoptAgreement.isPending}
                  onClick={() => handleCerrar("RECHAZADO")}
                  className="flex-1 border border-[var(--status-error)] py-2.5 text-sm font-medium text-[var(--status-error)] hover:bg-[var(--g-surface-card)] disabled:opacity-50"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                >
                  Cerrar como rechazado
                </button>
              </div>
            </div>
          )}

          {/* ── Navigation ── */}
          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrent((n) => Math.max(1, n - 1))}
              disabled={current === 1 || current === 4}
              className="inline-flex items-center gap-1 border border-[var(--g-border-subtle)] px-4 py-2 text-sm text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] disabled:opacity-40"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              Anterior
            </button>

            {current < 3 && (
              <button
                type="button"
                disabled={!canAdvance()}
                onClick={() => setCurrent((n) => n + 1)}
                className="inline-flex items-center gap-1.5 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                Siguiente <ChevronRight className="h-4 w-4" />
              </button>
            )}

            {current === 3 && (
              <button
                type="button"
                disabled={!canAdvance() || createResolution.isPending}
                onClick={handleOpenVoting}
                aria-busy={createResolution.isPending}
                className="inline-flex items-center gap-1.5 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <FileText className="h-4 w-4" />
                {createResolution.isPending ? "Iniciando…" : "Iniciar votación"}
              </button>
            )}

            {current === 4 && (
              <button
                type="button"
                onClick={() => setCurrent(5)}
                className="inline-flex items-center gap-1.5 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                Ir a cierre <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
