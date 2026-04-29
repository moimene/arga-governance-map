import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  Plus,
  Save,
  Trash2,
  Users,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useTenantContext } from "@/context/TenantContext";
import { useActiveConflicts } from "@/hooks/useConflicts";
import { usePactosVigentes } from "@/hooks/usePactosParasociales";
import { useRuleResolutions } from "@/hooks/useRuleResolution";
import {
  useBodyMembers,
  useGenerarActa,
  useMeetingAgendaSources,
  useOpenMeeting,
  useReplaceAttendees,
  useReunionAttendees,
  useReunionById,
  useReunionResolutions,
  useSaveMeetingResolutions,
  useUpdateQuorumData,
  type BodyMember,
  type MeetingResolution,
} from "@/hooks/useReunionSecretaria";
import { supabase } from "@/integrations/supabase/client";
import {
  buildMeetingAdoptionSnapshot,
  evaluateMeetingVoteCompleteness,
  evaluarConstitucion,
  type MeetingAdoptionSnapshot,
  type MateriaClase,
  type RulePack,
  type RuleParamOverride,
  type RuleResolution,
  type TipoOrgano,
  type TipoSocial,
} from "@/lib/rules-engine";
import {
  AGENDA_ORIGIN_LABELS,
  newSessionAgendaPoint,
  type AgendaPointOrigin,
} from "@/lib/secretaria/meeting-agenda";
import {
  patchQuorumDataSourceLinks,
  sourceLinksFromAgendaPoints,
} from "@/lib/secretaria/meeting-links";
import { StepperShell, StepDef } from "./_shared/StepperShell";

// ── Tipos locales ────────────────────────────────────────────────────────────

type VoteValue = "FAVOR" | "CONTRA" | "ABSTENCION" | "";

interface VoterRow {
  id: string;
  person_id: string | null;
  name: string;
  attendance_type?: string | null;
  capital_representado?: number | null;
  shares_represented?: number | null;
  voting_rights?: number | null;
  vote: VoteValue;
  conflict_flag: boolean;
  conflict_reason: string;
}

const DEMO_VOTERS: VoterRow[] = [
  { id: "v1", person_id: null, name: "Carlos Ruiz (Presidente)", vote: "", conflict_flag: false, conflict_reason: "" },
  { id: "v2", person_id: null, name: "Lucía Martín (Secretaria)", vote: "", conflict_flag: false, conflict_reason: "" },
  { id: "v3", person_id: null, name: "Ana García", vote: "", conflict_flag: false, conflict_reason: "" },
  { id: "v4", person_id: null, name: "Pedro López", vote: "", conflict_flag: false, conflict_reason: "" },
  { id: "v5", person_id: null, name: "Isabel Sánchez", vote: "", conflict_flag: false, conflict_reason: "" },
];

interface MeetingVoterRow {
  id: string;
  person_id: string | null;
  attendance_type: string | null;
  capital_representado: number | null;
  shares_represented: number | null;
  voting_rights: number | null;
  person_name: string | null;
}

function formatMeetingVoterName(voter: MeetingVoterRow) {
  return voter.person_name?.trim() || "Miembro sin identificar";
}

const AGENDA_MATERIAS = [
  { value: "APROBACION_CUENTAS", label: "Aprobación de cuentas", tipo: "ORDINARIA" },
  { value: "DISTRIBUCION_DIVIDENDOS", label: "Distribución de dividendos", tipo: "ORDINARIA" },
  { value: "NOMBRAMIENTO_CONSEJERO", label: "Nombramiento de consejero", tipo: "ORDINARIA" },
  { value: "NOMBRAMIENTO_AUDITOR", label: "Nombramiento de auditor", tipo: "ORDINARIA" },
  { value: "MODIFICACION_ESTATUTOS", label: "Modificación de estatutos", tipo: "ESTATUTARIA" },
  { value: "AUMENTO_CAPITAL", label: "Aumento de capital", tipo: "ESTATUTARIA" },
  { value: "AUTORIZACION_GARANTIA", label: "Garantía intragrupo", tipo: "ESTRUCTURAL" },
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRulePackPayload(payload: unknown): payload is RulePack {
  return (
    isRecord(payload) &&
    isRecord(payload.convocatoria) &&
    isRecord(payload.constitucion) &&
    isRecord(payload.votacion)
  );
}

function uniqueOverrides(overrides: RuleParamOverride[]): RuleParamOverride[] {
  const seen = new Set<string>();
  const out: RuleParamOverride[] = [];
  for (const override of overrides) {
    const key = override.id || `${override.entity_id}:${override.materia}:${override.clave}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(override);
  }
  return out;
}

function toTipoSocial(value: unknown): TipoSocial {
  const raw = String(value ?? "").toUpperCase();
  if (raw.includes("SLU")) return "SLU";
  if (raw.includes("SAU")) return "SAU";
  if (raw.includes("SL")) return "SL";
  return "SA";
}

function toTipoOrgano(value: unknown): TipoOrgano {
  const raw = String(value ?? "").toUpperCase();
  if (raw.includes("CDA") || raw.includes("CONSEJO")) return "CONSEJO";
  if (raw.includes("COMISION") || raw.includes("COMIT")) return "COMISION_DELEGADA";
  return "JUNTA_GENERAL";
}

function normalizeMateriaClase(value: unknown): MateriaClase {
  const raw = String(value ?? "").toUpperCase();
  if (raw === "ESTATUTARIA") return "ESTATUTARIA";
  if (raw === "ESTRUCTURAL") return "ESTRUCTURAL";
  if (raw === "ESPECIAL") return "ESPECIAL";
  return "ORDINARIA";
}

function defaultMateriaForTitle(title: string) {
  const raw = title.toUpperCase();
  if (raw.includes("ESTATUT")) return "MODIFICACION_ESTATUTOS";
  if (raw.includes("CAPITAL")) return "AUMENTO_CAPITAL";
  if (raw.includes("AUDITOR")) return "NOMBRAMIENTO_AUDITOR";
  if (raw.includes("DIVIDENDO") || raw.includes("RESULTADO")) return "DISTRIBUCION_DIVIDENDOS";
  if (raw.includes("CONSEJ") || raw.includes("CARGO")) return "NOMBRAMIENTO_CONSEJERO";
  return "APROBACION_CUENTAS";
}

function materiaClaseFromMateria(materia: string): MateriaClase {
  return normalizeMateriaClase(AGENDA_MATERIAS.find((m) => m.value === materia)?.tipo);
}

function labelMateria(materia: string) {
  return AGENDA_MATERIAS.find((m) => m.value === materia)?.label ?? materia;
}

function selectedRulePacks(resolutions: RuleResolution[]) {
  return resolutions.map((resolution) => resolution.rulePack?.payload).filter(isRulePackPayload);
}

function selectedOverrides(resolutions: RuleResolution[]) {
  return uniqueOverrides(resolutions.flatMap((resolution) => resolution.applicableOverrides));
}

function votingWeightFor(voter: VoterRow, organoTipo: TipoOrgano) {
  if (organoTipo === "CONSEJO" || organoTipo === "COMISION_DELEGADA") return 1;
  const raw = voter.voting_rights ?? voter.capital_representado ?? voter.shares_represented;
  return typeof raw === "number" && Number.isFinite(raw) && raw > 0 ? raw : 1;
}

function votoCalidadHabilitadoPorOrgano(organoTipo: TipoOrgano, quorumRule?: Record<string, unknown> | null) {
  if (organoTipo === "COMISION_DELEGADA") return false;
  const explicit = quorumRule?.voto_calidad_presidente;
  if (typeof explicit === "boolean") return explicit;
  return organoTipo === "CONSEJO";
}

function snapshotBadgeClass(snapshot?: MeetingAdoptionSnapshot) {
  if (!snapshot) return "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]";
  return snapshot.societary_validity.ok
    ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
    : "bg-[var(--status-error)] text-[var(--g-text-inverse)]";
}

function formatVoteWeight(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function agreementOriginForPoint(point: DebatePunto) {
  if (point.agreement_id || point.origin === "PREPARED_AGREEMENT") return "PREPARED" as const;
  if (point.origin === "CONVOCATORIA" || point.origin === "MEETING_AGENDA") return "AGENDA_ITEM" as const;
  return "MEETING_FLOOR" as const;
}

// ── Paso 1: Constitución ─────────────────────────────────────────────────────

function ConstitutionStep({ meetingId }: { meetingId?: string }) {
  const { data: meeting, isLoading } = useReunionById(meetingId);
  const openMeeting = useOpenMeeting(meetingId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-[var(--g-text-secondary)]">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Cargando datos de la reunión…</span>
      </div>
    );
  }

  if (!meeting) {
    return <p className="text-sm text-[var(--g-text-secondary)]">Reunión no encontrada.</p>;
  }

  const m = meeting as {
    status: string | null;
    meeting_type: string | null;
    scheduled_start: string | null;
    scheduled_end: string | null;
    location: string | null;
    confidentiality_level: string | null;
    governing_bodies?: { name?: string | null; entities?: { common_name?: string | null } | null } | null;
  };

  const isOpen = m.status === "CELEBRADA";
  const bodyName = m.governing_bodies?.name ?? "—";
  const entityName = m.governing_bodies?.entities?.common_name ?? "—";

  const fields: [string, string][] = [
    ["Entidad", entityName],
    ["Órgano", bodyName],
    ["Tipo de sesión", m.meeting_type ?? "—"],
    [
      "Inicio previsto",
      m.scheduled_start
        ? new Date(m.scheduled_start).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" })
        : "—",
    ],
    [
      "Fin previsto",
      m.scheduled_end
        ? new Date(m.scheduled_end).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" })
        : "—",
    ],
    ["Lugar / Modalidad", m.location ?? "—"],
    ["Confidencialidad", m.confidentiality_level ?? "NORMAL"],
  ];

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--g-text-secondary)]">
        Verifica los datos de la sesión antes de declararla abierta. Al abrir la sesión el estado
        pasa a <span className="font-medium text-[var(--g-text-primary)]">CELEBRADA</span> y se activan
        los pasos de asistentes y quórum.
      </p>

      <div
        className="divide-y divide-[var(--g-border-subtle)] border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        {fields.map(([label, value]) => (
          <div key={label} className="flex items-start gap-4 px-5 py-3">
            <span className="w-36 shrink-0 text-xs font-medium text-[var(--g-text-secondary)]">
              {label}
            </span>
            <span className="text-sm text-[var(--g-text-primary)]">{value}</span>
          </div>
        ))}
        <div className="flex items-start gap-4 px-5 py-3">
          <span className="w-36 shrink-0 text-xs font-medium text-[var(--g-text-secondary)]">
            Estado actual
          </span>
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[var(--g-text-inverse)] ${
              isOpen ? "bg-[var(--status-success)]" : "bg-[var(--status-info)]"
            }`}
            style={{ borderRadius: "var(--g-radius-full)" }}
          >
            {isOpen ? <CheckCircle2 className="h-3 w-3" /> : null}
            {m.status ?? "SCHEDULED"}
          </span>
        </div>
      </div>

      {isOpen ? (
        <div
          className="flex items-center gap-3 border border-[var(--status-success)] bg-[var(--g-sec-100)] p-4"
          style={{ borderRadius: "var(--g-radius-lg)" }}
        >
          <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--status-success)]" />
          <p className="text-sm font-semibold text-[var(--g-text-primary)]">
            Sesión declarada abierta. Continúa al paso de asistentes.
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() =>
            openMeeting.mutate(undefined, {
              onSuccess: () => toast.success("Sesión abierta"),
              onError: (e) => toast.error(e instanceof Error ? e.message : "Error al abrir sesión"),
            })
          }
          disabled={openMeeting.isPending}
          aria-busy={openMeeting.isPending}
          className="inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-5 py-2.5 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] disabled:opacity-50"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          {openMeeting.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          Declarar apertura de la sesión
        </button>
      )}
    </div>
  );
}

// ── Paso 2: Asistentes ───────────────────────────────────────────────────────

type AttendanceEntry = {
  attendance_type: "PRESENCIAL" | "REPRESENTADO" | "AUSENTE";
  represented_by_id: string;
  capital_representado: string;
  via_representante: boolean;
};

const ATTENDANCE_LABELS: Record<string, string> = {
  PRESENCIAL: "Presencial",
  REPRESENTADO: "Representado",
  AUSENTE: "Ausente",
};

const TIPO_CONDICION_LABELS: Record<string, string> = {
  CONSEJERO: "Consejero",
  PRESIDENTE: "Presidente",
  SECRETARIO: "Secretario",
  VICEPRESIDENTE: "Vicepresidente",
  CONSEJERO_COORDINADOR: "Coordinador independiente",
  SOCIO: "Socio",
  ADMIN_UNICO: "Administrador único",
  ADMIN_SOLIDARIO: "Administrador solidario",
  ADMIN_MANCOMUNADO: "Administrador mancomunado",
  ADMIN_PJ: "Administrador persona jurídica",
};

function AsistentesStep({ meetingId }: { meetingId?: string }) {
  const { data: meeting } = useReunionById(meetingId);
  const bodyId = (meeting as { body_id?: string } | null)?.body_id;

  const { data: members = [], isLoading: membersLoading } = useBodyMembers(bodyId);
  const { data: existingAttendees = [] } = useReunionAttendees(meetingId);
  const replaceAttendees = useReplaceAttendees(meetingId);

  const [attendance, setAttendance] = useState<Record<string, AttendanceEntry>>({});
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (initialized) return;
    if (members.length === 0) return;

    const map: Record<string, AttendanceEntry> = {};
    if (existingAttendees.length > 0) {
      for (const a of existingAttendees) {
        if (a.person_id) {
          map[a.person_id] = {
            attendance_type: (a.attendance_type as "PRESENCIAL" | "REPRESENTADO" | "AUSENTE") ?? "PRESENCIAL",
            represented_by_id: a.represented_by_id ?? "",
            capital_representado:
              a.capital_representado === null || a.capital_representado === undefined
                ? ""
                : String(a.capital_representado),
            via_representante: Boolean(a.via_representante),
          };
        }
      }
    }
    for (const m of members) {
      if (!map[m.person_id]) {
        map[m.person_id] = {
          attendance_type: "PRESENCIAL",
          represented_by_id: "",
          capital_representado: "",
          via_representante: false,
        };
      }
    }
    setAttendance(map);
    setInitialized(true);
  }, [initialized, members, existingAttendees]);

  function setType(personId: string, type: AttendanceEntry["attendance_type"]) {
    setAttendance((prev) => ({
      ...prev,
      [personId]: {
        ...prev[personId],
        attendance_type: type,
        represented_by_id: type === "REPRESENTADO" ? prev[personId]?.represented_by_id ?? "" : "",
        via_representante: type === "REPRESENTADO",
      },
    }));
  }

  function setRepr(personId: string, val: string) {
    setAttendance((prev) => ({
      ...prev,
      [personId]: { ...prev[personId], represented_by_id: val },
    }));
  }

  function setCapital(personId: string, val: string) {
    setAttendance((prev) => ({
      ...prev,
      [personId]: { ...prev[personId], capital_representado: val },
    }));
  }

  function handleSave() {
    const missingRepresentative = members.find((m) => {
      const entry = attendance[m.person_id];
      return entry?.attendance_type === "REPRESENTADO" && !entry.represented_by_id;
    });
    if (missingRepresentative) {
      toast.error(`Selecciona representante para ${missingRepresentative.full_name}`);
      return;
    }

    const rows = members.map((m) => {
      const entry = attendance[m.person_id];
      const attendanceType = entry?.attendance_type ?? "PRESENCIAL";
      const capitalValue = entry?.capital_representado === "" ? null : Number(entry?.capital_representado ?? 0);
      return {
        person_id: m.person_id,
        attendance_type: attendanceType,
        represented_by_id: attendanceType === "REPRESENTADO" ? entry?.represented_by_id || null : null,
        capital_representado: Number.isFinite(capitalValue) ? capitalValue : null,
        via_representante: attendanceType === "REPRESENTADO",
      };
    });
    replaceAttendees.mutate(rows, {
      onSuccess: () => toast.success(`Asistencia de ${rows.length} miembros guardada`),
      onError: (e) => toast.error(e instanceof Error ? e.message : "Error al guardar asistencia"),
    });
  }

  const presentes = members.filter(
    (m) => (attendance[m.person_id]?.attendance_type ?? "PRESENCIAL") !== "AUSENTE"
  ).length;

  if (membersLoading) {
    return (
      <div className="flex items-center gap-2 text-[var(--g-text-secondary)]">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Cargando miembros del órgano…</span>
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div
        className="border-l-4 border-[var(--status-warning)] bg-[var(--g-surface-muted)] p-4"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        <p className="text-sm text-[var(--g-text-secondary)]">
          No hay miembros vigentes en este órgano. Verifica que el órgano tenga condiciones de
          persona activas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--g-text-secondary)]">
        Registra la modalidad de asistencia de cada miembro. Los representados requieren indicar
        quién actúa en su nombre.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-[var(--g-surface-subtle)]">
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Miembro
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Cargo
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Asistencia
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Representado por
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Capital / votos
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Vía
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--g-border-subtle)]">
            {members.map((m: BodyMember) => {
              const entry = attendance[m.person_id] ?? {
                attendance_type: "PRESENCIAL",
                represented_by_id: "",
                capital_representado: "",
                via_representante: false,
              };
              const needsRepr = entry.attendance_type === "REPRESENTADO";
              const representativeOptions = members.filter((member) => {
                if (member.person_id === m.person_id) return false;
                const candidateAttendance = attendance[member.person_id]?.attendance_type ?? "PRESENCIAL";
                return candidateAttendance !== "AUSENTE";
              });
              return (
                <tr key={m.id} className="transition-colors hover:bg-[var(--g-surface-subtle)]/30">
                  <td className="px-4 py-3 text-sm font-medium text-[var(--g-text-primary)]">
                    {m.full_name}
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--g-text-secondary)]">
                    {TIPO_CONDICION_LABELS[m.tipo_condicion] ?? m.tipo_condicion}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={entry.attendance_type}
                      onChange={(e) =>
                        setType(m.person_id, e.target.value as AttendanceEntry["attendance_type"])
                      }
                      aria-label={`Tipo de asistencia de ${m.full_name}`}
                      className="rounded border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-2 py-1.5 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                      style={{ borderRadius: "var(--g-radius-md)" }}
                    >
                      {(["PRESENCIAL", "REPRESENTADO", "AUSENTE"] as const).map((t) => (
                        <option key={t} value={t}>
                          {ATTENDANCE_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    {needsRepr ? (
                      <select
                        value={entry.represented_by_id}
                        onChange={(e) => setRepr(m.person_id, e.target.value)}
                        aria-label={`Representante de ${m.full_name}`}
                        className="w-full rounded border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-2 py-1.5 text-sm text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                        style={{ borderRadius: "var(--g-radius-md)" }}
                      >
                        <option value="">Seleccionar representante</option>
                        {representativeOptions.map((representative) => (
                          <option key={representative.person_id} value={representative.person_id}>
                            {representative.full_name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-[var(--g-text-secondary)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={entry.capital_representado}
                      onChange={(e) => setCapital(m.person_id, e.target.value)}
                      aria-label={`Capital o votos de ${m.full_name}`}
                      className="w-28 rounded border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-2 py-1.5 text-sm text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                      style={{ borderRadius: "var(--g-radius-md)" }}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium ${
                        entry.via_representante
                          ? "bg-[var(--g-sec-100)] text-[var(--g-text-primary)]"
                          : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
                      }`}
                      style={{ borderRadius: "var(--g-radius-full)" }}
                    >
                      {entry.via_representante ? "Representante" : "Directa"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div
        className="flex items-center gap-6 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-4 py-3 text-sm"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        <Users className="h-4 w-4 text-[var(--g-text-secondary)]" />
        <span className="font-medium text-[var(--g-text-primary)]">
          {presentes} / {members.length} presentes o representados
        </span>
        <span className="text-[var(--g-text-secondary)]">
          {members.length - presentes} ausentes
        </span>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={replaceAttendees.isPending}
        aria-busy={replaceAttendees.isPending}
        className="inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2.5 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] disabled:opacity-50"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        {replaceAttendees.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        Guardar asistencia
      </button>
    </div>
  );
}

// ── Paso 3: Quórum ───────────────────────────────────────────────────────────

function QuorumStep({ meetingId }: { meetingId?: string }) {
  const { data: meeting } = useReunionById(meetingId);
  const bodyId = (meeting as { body_id?: string } | null)?.body_id;
  const existingQuorum = (meeting as { quorum_data?: Record<string, unknown> | null } | null)?.quorum_data;
  const meetingRaw = meeting as
    | {
        governing_bodies?: {
          body_type?: string | null;
          entity_id?: string | null;
          quorum_rule?: Record<string, unknown> | null;
          entities?: { legal_form?: string | null; tipo_social?: string | null } | null;
        } | null;
      }
    | null;

  const { data: attendees = [] } = useReunionAttendees(meetingId);
  const { data: members = [] } = useBodyMembers(bodyId);
  const updateQuorum = useUpdateQuorumData(meetingId);

  const debates = ((existingQuorum?.debates ?? []) as DebatePunto[]).map((debate) => {
    const materia = debate.materia ?? defaultMateriaForTitle(debate.punto);
    return {
      ...debate,
      materia,
      tipo: debate.tipo ?? materiaClaseFromMateria(materia),
    };
  });
  const ruleSpecs =
    debates.length > 0
      ? debates.map((debate) => ({
          materia: debate.materia ?? "APROBACION_CUENTAS",
          clase: normalizeMateriaClase(debate.tipo),
        }))
      : [{ materia: "APROBACION_CUENTAS", clase: "ORDINARIA" as MateriaClase }];
  const tipoSocial = toTipoSocial(
    meetingRaw?.governing_bodies?.entities?.tipo_social ??
      meetingRaw?.governing_bodies?.entities?.legal_form
  );
  const organoTipo = toTipoOrgano(meetingRaw?.governing_bodies?.body_type);
  const entityId = meetingRaw?.governing_bodies?.entity_id ?? null;
  const { data: ruleResolutions = [], isLoading: rulesLoading } = useRuleResolutions({
    materias: ruleSpecs,
    entityId,
    organoTipo,
  });
  const packs = selectedRulePacks(ruleResolutions);
  const overrides = selectedOverrides(ruleResolutions);
  const presentes = attendees.filter((a) => a.attendance_type !== "AUSENTE").length;
  const total = members.length > 0 ? members.length : attendees.length;
  const attendeeCapital = attendees.reduce(
    (sum, attendee) =>
      attendee.attendance_type === "AUSENTE" ? sum : sum + Number(attendee.capital_representado ?? 0),
    0
  );
  const hasCapitalData = attendeeCapital > 0;
  const capitalTotal = hasCapitalData ? 100 : Math.max(total, 1);
  const capitalPresente = hasCapitalData ? attendeeCapital : presentes;
  const materiaClase = ruleSpecs.some((spec) => spec.clase === "ESTRUCTURAL")
    ? "ESTRUCTURAL"
    : ruleSpecs.some((spec) => spec.clase === "ESTATUTARIA")
    ? "ESTATUTARIA"
    : "ORDINARIA";
  const constitutionResult = evaluarConstitucion(
    {
      tipoSocial,
      organoTipo,
      adoptionMode: "MEETING",
      primeraConvocatoria: true,
      materiaClase,
      capitalConDerechoVoto: capitalTotal,
      capitalPresenteRepresentado: capitalPresente,
      asistentesPresentes: presentes,
      totalMiembros: total,
    },
    packs,
    overrides
  );
  const pct = constitutionResult.quorumPresente * 100;
  const quorumReached = constitutionResult.quorumCubierto;

  const savedQuorum = existingQuorum?.quorum as
    | {
        present: number;
        total: number;
        pct: string;
        reached: boolean;
        evaluated_at: string;
        rule_pack_ids?: string[];
        materia_clase?: MateriaClase;
      }
    | undefined;

  function handleConfirm() {
    const quorumData: Record<string, unknown> = {
      ...(existingQuorum ?? {}),
      quorum: {
        present: presentes,
        total,
        pct: pct.toFixed(1),
        reached: quorumReached,
        engine: "evaluarConstitucion",
        organo_tipo: organoTipo,
        tipo_social: tipoSocial,
        materia_clase: materiaClase,
        rule_pack_ids: ruleResolutions
          .map((resolution) => resolution.rulePack?.packId)
          .filter((packId): packId is string => Boolean(packId)),
        explain: constitutionResult.explain,
        warnings: constitutionResult.warnings,
        blocking_issues: constitutionResult.blocking_issues,
        evaluated_at: new Date().toISOString(),
      },
    };
    updateQuorum.mutate(quorumData, {
      onSuccess: () => toast.success("Quórum registrado en el acta"),
      onError: (e) => toast.error(e instanceof Error ? e.message : "Error al guardar quórum"),
    });
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-[var(--g-text-secondary)]">
        El quórum se calcula con el motor de constitución según órgano, tipo social y materias
        debatidas. En juntas se usa capital/derechos de voto cuando existe dato disponible; en
        consejo se usa mayoría de miembros.
      </p>

      <div
        className="grid grid-cols-3 gap-4 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-5"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="text-center">
          <p className="text-3xl font-bold text-[var(--g-text-primary)]">{presentes}</p>
          <p className="mt-1 text-xs text-[var(--g-text-secondary)]">Presentes / representados</p>
        </div>
        <div className="text-center">
          <p className="text-3xl font-bold text-[var(--g-text-primary)]">{total}</p>
          <p className="mt-1 text-xs text-[var(--g-text-secondary)]">Total miembros</p>
        </div>
        <div className="text-center">
          <p
            className={`text-3xl font-bold ${
              quorumReached ? "text-[var(--status-success)]" : "text-[var(--status-error)]"
            }`}
          >
            {pct.toFixed(1)}%
          </p>
          <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
            {organoTipo === "JUNTA_GENERAL" ? "Capital/derecho de voto" : "Miembros presentes"}
          </p>
        </div>
      </div>

      {organoTipo === "JUNTA_GENERAL" && !hasCapitalData && (
        <div
          className="flex items-start gap-3 border-l-4 border-[var(--status-warning)] bg-[var(--g-surface-card)] p-4"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-warning)]" />
          <p className="text-xs text-[var(--g-text-secondary)]">
            No hay capital/derechos de voto informados en la lista de asistentes. El motor usa el
            número de asistentes como aproximación demo; para una junta real debe cargarse capital,
            derechos de voto y clases afectadas.
          </p>
        </div>
      )}

      <div
        className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
        style={{ borderRadius: "var(--g-radius-lg)" }}
      >
        <h3 className="mb-3 text-sm font-semibold text-[var(--g-text-primary)]">
          Materias y rule packs aplicados
        </h3>
        <div className="space-y-2">
          {ruleSpecs.map((spec, index) => (
            <div
              key={`${spec.materia}-${index}`}
              className="flex flex-wrap items-center gap-2 text-xs text-[var(--g-text-secondary)]"
            >
              <span className="font-medium text-[var(--g-text-primary)]">
                {labelMateria(spec.materia)}
              </span>
              <span>{spec.clase}</span>
              <span>
                {ruleResolutions.find((resolution) => resolution.rulePack?.materia === spec.materia)?.rulePack
                  ? "pack resuelto"
                  : "pack pendiente"}
              </span>
            </div>
          ))}
          {rulesLoading && (
            <p className="text-xs text-[var(--g-text-secondary)]">Cargando reglas aplicables…</p>
          )}
        </div>
      </div>

      <div
        className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
        style={{ borderRadius: "var(--g-radius-lg)" }}
      >
        <h3 className="mb-3 text-sm font-semibold text-[var(--g-text-primary)]">
          Evaluación Motor V2 — Quórum de constitución
        </h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {quorumReached ? (
              <CheckCircle2 className="h-4 w-4 text-[var(--status-success)]" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-[var(--status-error)]" />
            )}
            <span
              className={`inline-flex px-2.5 py-1 text-[11px] font-semibold text-[var(--g-text-inverse)] ${
                quorumReached ? "bg-[var(--status-success)]" : "bg-[var(--status-error)]"
              }`}
              style={{ borderRadius: "var(--g-radius-full)" }}
            >
              {quorumReached ? "QUÓRUM ALCANZADO" : "SIN QUÓRUM"}
            </span>
          </div>
          <p className="text-xs text-[var(--g-text-secondary)]">
            <span className="font-mono">
              {constitutionResult.explain[0]?.regla ?? "Quórum requerido"}
            </span>
          </p>
          <p className="text-xs text-[var(--g-text-primary)]">
            {constitutionResult.explain[0]?.mensaje ?? "Sin explicación disponible."}
          </p>
          {constitutionResult.warnings.length > 0 && (
            <ul className="mt-2 space-y-1">
              {constitutionResult.warnings.map((warning) => (
                <li key={warning} className="text-xs text-[var(--status-warning)]">
                  {warning}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {savedQuorum && (
        <div
          className="flex items-center gap-3 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-4 py-3"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <CheckCircle2 className="h-4 w-4 text-[var(--status-success)]" />
          <p className="text-xs text-[var(--g-text-secondary)]">
            Quórum ya registrado: {savedQuorum.pct}% · {savedQuorum.materia_clase ?? "sin clase"} —{" "}
            {new Date(savedQuorum.evaluated_at).toLocaleString("es-ES", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={handleConfirm}
        disabled={updateQuorum.isPending || !quorumReached}
        aria-busy={updateQuorum.isPending}
        title={!quorumReached ? "No hay quórum suficiente para abrir la sesión" : undefined}
        className="inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2.5 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] disabled:bg-[var(--g-surface-muted)] disabled:text-[var(--g-text-secondary)] disabled:opacity-100"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        {updateQuorum.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )}
        Confirmar quórum y continuar
      </button>
    </div>
  );
}

// ── Paso 4: Debates ──────────────────────────────────────────────────────────

interface DebatePunto {
  punto: string;
  notas: string;
  materia?: string;
  tipo?: MateriaClase;
  origin?: AgendaPointOrigin;
  source_table?: string | null;
  source_id?: string | null;
  source_index?: number | null;
  agreement_id?: string | null;
  group_campaign_id?: string | null;
  group_campaign_step?: string | null;
}

function DebatesStep({ meetingId }: { meetingId?: string }) {
  const { data: meeting } = useReunionById(meetingId);
  const { data: agendaSources = [], isLoading: agendaSourcesLoading } = useMeetingAgendaSources(meetingId);
  const existingQD = (meeting as { quorum_data?: Record<string, unknown> | null } | null)?.quorum_data;
  const existingDebates = (existingQD?.debates ?? []) as DebatePunto[];

  const updateQuorum = useUpdateQuorumData(meetingId);

  const [debates, setDebates] = useState<DebatePunto[]>([newSessionAgendaPoint()]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (initialized) return;
    if (meeting === undefined) return;
    if (agendaSourcesLoading) return;
    const initialDebates = agendaSources.length > 0 ? agendaSources : existingDebates;
    if (initialDebates.length > 0) {
      setDebates(
        initialDebates.map((debate) => {
          const materia = debate.materia ?? defaultMateriaForTitle(debate.punto);
          return {
            ...debate,
            materia,
            tipo: debate.tipo ?? materiaClaseFromMateria(materia),
            origin: debate.origin ?? "MEETING_FLOOR",
          };
        })
      );
    }
    setInitialized(true);
  }, [agendaSources, agendaSourcesLoading, initialized, meeting, existingDebates]);

  function addPunto() {
    setDebates((prev) => [...prev, newSessionAgendaPoint()]);
  }

  function removePunto(idx: number) {
    setDebates((prev) => prev.filter((_, i) => i !== idx));
  }

  function updatePunto(idx: number, field: keyof DebatePunto, val: string) {
    setDebates((prev) =>
      prev.map((d, i) => {
        if (i !== idx) return d;
        if (field === "materia") {
          return { ...d, materia: val, tipo: materiaClaseFromMateria(val) };
        }
        if (field === "tipo") {
          return { ...d, tipo: normalizeMateriaClase(val) };
        }
        return { ...d, [field]: val };
      })
    );
  }

  function handleSave() {
    const debatesForSave = debates
      .filter((debate) => debate.punto.trim())
      .map((debate, index) => ({
        ...debate,
        origin: debate.origin ?? "MEETING_FLOOR",
        source_index: debate.source_index ?? index + 1,
      }));
    const qd: Record<string, unknown> = {
      ...patchQuorumDataSourceLinks(existingQD ?? null, sourceLinksFromAgendaPoints(debatesForSave)),
      debates: debatesForSave,
    };
    updateQuorum.mutate(qd, {
      onSuccess: () => toast.success("Agenda y debate guardados"),
      onError: (e) => toast.error(e instanceof Error ? e.message : "Error al guardar debates"),
    });
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-[var(--g-text-secondary)]">
        Revisa la agenda formal, las propuestas preparadas y los puntos que nazcan durante la sesión.
        El origen queda guardado para explicar si el acuerdo venía preparado, de convocatoria o nació en sala.
      </p>

      {agendaSourcesLoading && (
        <div className="flex items-center gap-2 text-sm text-[var(--g-text-secondary)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando agenda preparada…
        </div>
      )}

      <div className="space-y-4">
        {debates.map((d, idx) => (
          <div
            key={idx}
            className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
            style={{ borderRadius: "var(--g-radius-lg)" }}
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--g-brand-3308)]">
                  Punto {idx + 1}
                </span>
                <span
                  className="bg-[var(--g-sec-100)] px-2 py-0.5 text-[11px] font-semibold text-[var(--g-brand-3308)]"
                  style={{ borderRadius: "var(--g-radius-full)" }}
                >
                  {AGENDA_ORIGIN_LABELS[d.origin ?? "MEETING_FLOOR"]}
                </span>
                {d.agreement_id ? (
                  <span
                    className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-muted)] px-2 py-0.5 text-[11px] font-semibold text-[var(--g-text-secondary)]"
                    style={{ borderRadius: "var(--g-radius-full)" }}
                  >
                    Propuesta vinculada
                  </span>
                ) : null}
              </div>
              {debates.length > 1 && (d.origin ?? "MEETING_FLOOR") === "MEETING_FLOOR" && (
                <button
                  type="button"
                  onClick={() => removePunto(idx)}
                  aria-label={`Eliminar punto ${idx + 1}`}
                  className="inline-flex items-center gap-1 text-xs text-[var(--g-text-secondary)] hover:text-[var(--status-error)]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Eliminar
                </button>
              )}
            </div>
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--g-text-secondary)]">
                    Materia jurídica
                  </label>
                  <select
                    value={d.materia ?? "APROBACION_CUENTAS"}
                    onChange={(e) => updatePunto(idx, "materia", e.target.value)}
                    className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    {AGENDA_MATERIAS.map((materia) => (
                      <option key={materia.value} value={materia.value}>
                        {materia.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--g-text-secondary)]">
                    Clase de acuerdo
                  </label>
                  <select
                    value={d.tipo ?? materiaClaseFromMateria(d.materia ?? "APROBACION_CUENTAS")}
                    onChange={(e) => updatePunto(idx, "tipo", e.target.value)}
                    className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    <option value="ORDINARIA">Ordinaria</option>
                    <option value="ESTATUTARIA">Estatutaria</option>
                    <option value="ESTRUCTURAL">Estructural</option>
                    <option value="ESPECIAL">Especial</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--g-text-secondary)]">
                  Título / descripción del punto
                </label>
                <input
                  type="text"
                  value={d.punto}
                  onChange={(e) => updatePunto(idx, "punto", e.target.value)}
                  placeholder="p.ej. Aprobación de cuentas anuales ejercicio 2025"
                  className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--g-text-secondary)]">
                  Notas del secretario
                </label>
                <textarea
                  value={d.notas}
                  onChange={(e) => updatePunto(idx, "notas", e.target.value)}
                  rows={3}
                  placeholder="Resumen del debate, intervenciones relevantes, acuerdos adoptados en este punto…"
                  className="w-full border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                  style={{ borderRadius: "var(--g-radius-md)" }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addPunto}
        className="inline-flex items-center gap-2 border border-[var(--g-border-subtle)] px-4 py-2 text-sm text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)]"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        <Plus className="h-4 w-4" />
        Añadir punto nacido en sesión
      </button>

      <button
        type="button"
        onClick={handleSave}
        disabled={updateQuorum.isPending || debates.every((d) => !d.punto.trim())}
        aria-busy={updateQuorum.isPending}
        className="inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2.5 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] disabled:opacity-50"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        {updateQuorum.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        Guardar debates
      </button>
    </div>
  );
}

// ── Paso 5: Votaciones ───────────────────────────────────────────────────────

const ENGINE_V2 = true;

function VotacionesStep({ meetingId }: { meetingId?: string }) {
  const { tenantId } = useTenantContext();
  const { data: meetingForDebates } = useReunionById(meetingId);
  const { data: agendaSources = [] } = useMeetingAgendaSources(meetingId);
  const { data: existingResolutions = [] } = useReunionResolutions(meetingId);
  const saveResolutions = useSaveMeetingResolutions(meetingId);
  const updateQuorumData = useUpdateQuorumData(meetingId);
  const [resolutionsSaved, setResolutionsSaved] = useState(false);
  const [selectedPointIndex, setSelectedPointIndex] = useState(0);
  const [votesByPoint, setVotesByPoint] = useState<
    Record<number, Record<string, Pick<VoterRow, "vote" | "conflict_flag" | "conflict_reason">>>
  >({});

  const { data: meetingContext } = useQuery({
    enabled: !!meetingId && !!tenantId,
    queryKey: ["secretaria", tenantId, "meetings", meetingId, "votaciones"],
    staleTime: 60_000,
    queryFn: async (): Promise<{ entityId: string | null; voters: MeetingVoterRow[] }> => {
      const [meetingRes, attendeesRes] = await Promise.all([
        supabase
          .from("meetings")
          .select("governing_bodies(entity_id)")
          .eq("tenant_id", tenantId!)
          .eq("id", meetingId!)
          .maybeSingle(),
        supabase
          .from("meeting_attendees")
          .select("id, person_id, attendance_type, capital_representado, shares_represented, voting_rights, person:person_id(full_name)")
          .eq("tenant_id", tenantId!)
          .eq("meeting_id", meetingId!)
          .order("attendance_type", { ascending: true }),
      ]);

      if (meetingRes.error) throw meetingRes.error;
      if (attendeesRes.error) throw attendeesRes.error;

      type MeetingRaw = { governing_bodies?: { entity_id?: string | null } | null } | null;
      type AttendeeRaw = {
        id: string;
        person_id: string | null;
        attendance_type: string | null;
        capital_representado: number | null;
        shares_represented: number | null;
        voting_rights: number | null;
        person?: { full_name?: string | null } | null;
      };

      const voters = ((attendeesRes.data ?? []) as AttendeeRaw[]).map((a) => ({
        id: a.id,
        person_id: a.person_id,
        attendance_type: a.attendance_type ?? null,
        capital_representado: a.capital_representado ?? null,
        shares_represented: a.shares_represented ?? null,
        voting_rights: a.voting_rights ?? null,
        person_name: a.person?.full_name ?? null,
      }));
      const presentVoters = voters.filter((v) => v.attendance_type !== "AUSENTE");

      return {
        entityId: ((meetingRes.data as MeetingRaw)?.governing_bodies?.entity_id ?? null),
        voters: presentVoters.length > 0 ? presentVoters : voters,
      };
    },
  });

  const activeConflictScope = meetingId ? (meetingContext?.entityId ?? null) : undefined;
  const { data: activeConflicts = [], isLoading: activeConflictsLoading } = useActiveConflicts(activeConflictScope);
  const [voters, setVoters] = useState<VoterRow[]>(DEMO_VOTERS);
  const activeConflictPersonIds = useMemo(
    () =>
      new Set(
        activeConflicts
          .map((c) => c.person_id)
          .filter((pid): pid is string => Boolean(pid))
      ),
    [activeConflicts]
  );

  useEffect(() => {
    const nextVoters =
      meetingContext && meetingContext.voters.length > 0
        ? meetingContext.voters.map((v) => ({
            id: v.id,
            person_id: v.person_id,
            name: formatMeetingVoterName(v),
            attendance_type: v.attendance_type,
            capital_representado: v.capital_representado,
            shares_represented: v.shares_represented,
            voting_rights: v.voting_rights,
            vote: "" as VoteValue,
            conflict_flag: false,
            conflict_reason: "",
          }))
        : DEMO_VOTERS;

    setVoters((prev) =>
      nextVoters.map((next) => {
        const existing = prev.find(
          (cur) =>
            cur.id === next.id ||
            (next.person_id !== null && cur.person_id === next.person_id)
        );
        return existing
          ? { ...next, vote: existing.vote, conflict_flag: existing.conflict_flag, conflict_reason: existing.conflict_reason }
          : next;
      })
    );
  }, [meetingContext]);

  const agendaPoints = useMemo(() => {
    const debates = (
      (meetingForDebates as { quorum_data?: Record<string, unknown> | null } | null)?.quorum_data
        ?.debates ?? []
    ) as DebatePunto[];
    const normalized =
      debates.length > 0
        ? debates.map((debate) => {
            const materia = debate.materia ?? defaultMateriaForTitle(debate.punto);
            return {
              ...debate,
              punto: debate.punto || "Acuerdo de la sesión",
              materia,
              tipo: debate.tipo ?? materiaClaseFromMateria(materia),
              origin: debate.origin ?? "MEETING_FLOOR",
            };
          })
        : agendaSources.length > 0
          ? agendaSources.map((point) => ({
              ...point,
              punto: point.punto || "Acuerdo de la sesión",
              materia: point.materia ?? defaultMateriaForTitle(point.punto),
              tipo: point.tipo ?? materiaClaseFromMateria(point.materia ?? defaultMateriaForTitle(point.punto)),
              origin: point.origin ?? "MEETING_FLOOR",
            }))
        : [
            {
              punto: "Acuerdo de la sesión",
              notas: "",
              materia: "APROBACION_CUENTAS",
              tipo: "ORDINARIA" as MateriaClase,
              origin: "MEETING_FLOOR" as AgendaPointOrigin,
            },
          ];
    return normalized;
  }, [agendaSources, meetingForDebates]);

  const meetingRaw = meetingForDebates as
    | {
        quorum_data?: Record<string, unknown> | null;
        governing_bodies?: {
          body_type?: string | null;
          entity_id?: string | null;
          entities?: { legal_form?: string | null; tipo_social?: string | null } | null;
        } | null;
      }
    | null;
  const tipoSocial = toTipoSocial(
    meetingRaw?.governing_bodies?.entities?.tipo_social ??
      meetingRaw?.governing_bodies?.entities?.legal_form
  );
  const organoTipo = toTipoOrgano(meetingRaw?.governing_bodies?.body_type);
  const entityId = meetingRaw?.governing_bodies?.entity_id ?? meetingContext?.entityId ?? null;
  const votoCalidadHabilitado = votoCalidadHabilitadoPorOrgano(
    organoTipo,
    meetingRaw?.governing_bodies?.quorum_rule ?? null
  );
  const quorumData = meetingRaw?.quorum_data ?? null;
  const savedQuorumForVote = quorumData?.quorum as { reached?: boolean } | undefined;
  const quorumReachedForVote = savedQuorumForVote?.reached === true;
  const ruleSpecsForVotes = agendaPoints.map((point) => ({
    materia: point.materia ?? defaultMateriaForTitle(point.punto),
    clase: normalizeMateriaClase(point.tipo),
  }));
  const { data: ruleResolutions = [] } = useRuleResolutions({
    materias: ruleSpecsForVotes,
    entityId,
    organoTipo,
  });
  const { data: pactosVigentes = [] } = usePactosVigentes(entityId ?? undefined);
  const votePacks = selectedRulePacks(ruleResolutions);
  const voteOverrides = selectedOverrides(ruleResolutions);

  const selectedPoint = agendaPoints[selectedPointIndex] ?? agendaPoints[0];

  useEffect(() => {
    if (selectedPointIndex > agendaPoints.length - 1) {
      setSelectedPointIndex(Math.max(agendaPoints.length - 1, 0));
    }
  }, [agendaPoints.length, selectedPointIndex]);

  function rowForPoint(voter: VoterRow, pointIndex = selectedPointIndex): VoterRow {
    const pointState = votesByPoint[pointIndex]?.[voter.id];
    return pointState ? { ...voter, ...pointState } : voter;
  }

  function pointRows(pointIndex = selectedPointIndex) {
    return voters.map((voter) => rowForPoint(voter, pointIndex));
  }

  function update(id: string, patch: Partial<VoterRow>) {
    setVotesByPoint((prev) => {
      const currentPoint = prev[selectedPointIndex] ?? {};
      const existing = currentPoint[id] ?? { vote: "" as VoteValue, conflict_flag: false, conflict_reason: "" };
      return {
        ...prev,
        [selectedPointIndex]: {
          ...currentPoint,
          [id]: {
            vote: patch.vote ?? existing.vote,
            conflict_flag: patch.conflict_flag ?? existing.conflict_flag,
            conflict_reason: patch.conflict_reason ?? existing.conflict_reason,
          },
        },
      };
    });
  }

  const currentVoters = pointRows();

  function buildSnapshotForPoint(pointIndex: number) {
    const point = agendaPoints[pointIndex] ?? agendaPoints[0];
    const rowsForPoint = pointRows(pointIndex);
    const materia = point.materia ?? defaultMateriaForTitle(point.punto);
    const explicitVotingData = rowsForPoint.some((voter) => {
      const raw = voter.voting_rights ?? voter.capital_representado ?? voter.shares_represented;
      return typeof raw === "number" && Number.isFinite(raw) && raw > 0;
    });
    const totalWeight = rowsForPoint.reduce(
      (sum, voter) => sum + votingWeightFor(voter, organoTipo),
      0
    );
    const capitalTotal =
      organoTipo === "JUNTA_GENERAL"
        ? explicitVotingData
          ? Math.max(100, totalWeight)
          : Math.max(totalWeight, 1)
        : Math.max(rowsForPoint.length, 1);

    return buildMeetingAdoptionSnapshot({
      agendaItemIndex: pointIndex + 1,
      resolutionText: point.punto || "Acuerdo de la sesión",
      materia,
      materiaClase: normalizeMateriaClase(point.tipo),
      tipoSocial,
      organoTipo,
      adoptionMode: "MEETING",
      primeraConvocatoria: true,
      quorumReached: quorumReachedForVote,
      voters: rowsForPoint.map((voter) => ({
        id: voter.id,
        person_id: voter.person_id,
        name: voter.name,
        vote: voter.vote,
        conflict_flag: voter.conflict_flag,
        conflict_reason: voter.conflict_reason,
        voting_weight: votingWeightFor(voter, organoTipo),
      })),
      totalMiembros: Math.max(voters.length, rowsForPoint.length, 1),
      capitalTotal,
      packs: votePacks,
      overrides: voteOverrides,
      pactos: pactosVigentes,
      votoCalidadHabilitado,
    });
  }

  const currentSnapshot = buildSnapshotForPoint(selectedPointIndex);
  const currentVoteCompleteness = evaluateMeetingVoteCompleteness(currentVoters);
  const favor = currentSnapshot.vote_summary.favor;
  const contra = currentSnapshot.vote_summary.contra;
  const abstencion = currentSnapshot.vote_summary.abstenciones;
  const allPointsHaveVotes = agendaPoints.every((_, index) =>
    evaluateMeetingVoteCompleteness(pointRows(index)).complete
  );

  const hasResolutions = existingResolutions.length > 0 || resolutionsSaved;

  async function handleSaveResolutions() {
    const snapshots = agendaPoints.map((_, i) => buildSnapshotForPoint(i));
    const rows = agendaPoints.map((point, i) => {
      const rowsForPoint = pointRows(i);
      const snapshot = snapshots[i];
      const materia = point.materia ?? defaultMateriaForTitle(point.punto);
      const tipo = normalizeMateriaClase(point.tipo);
      return {
        agenda_item_index: i + 1,
        resolution_text: point.punto,
        resolution_type: tipo,
        status: snapshot.status_resolucion,
        required_majority_code: `${materia}:${tipo}`,
        agreement_id: point.agreement_id ?? null,
        agreement_origin: agreementOriginForPoint(point),
        adoption_snapshot: snapshot,
        votes: rowsForPoint
          .filter((v) => v.vote !== "")
          .map((v) => ({
            attendee_id: v.id,
            vote_value: v.vote,
            conflict_flag: v.conflict_flag,
            reason: v.conflict_reason.trim() || null,
          })),
      };
    });

    try {
      await updateQuorumData.mutateAsync({
        ...patchQuorumDataSourceLinks(
          (quorumData ?? {}) as Record<string, unknown>,
          sourceLinksFromAgendaPoints(
            agendaPoints.map((point, index) => ({
              punto: point.punto,
              notas: point.notas ?? "",
              materia: point.materia ?? defaultMateriaForTitle(point.punto),
              tipo: normalizeMateriaClase(point.tipo),
              origin: point.origin ?? "MEETING_FLOOR",
              source_table: point.source_table ?? null,
              source_id: point.source_id ?? null,
              source_index: point.source_index ?? index + 1,
              agreement_id: point.agreement_id ?? null,
              group_campaign_id: point.group_campaign_id ?? null,
              group_campaign_step: point.group_campaign_step ?? null,
            }))
          )
        ),
        point_snapshots: snapshots,
      });
      await saveResolutions.mutateAsync(rows);
      const materialized = snapshots.filter((snapshot) => snapshot.societary_validity.ok && snapshot.status_resolucion === "ADOPTED").length;
      toast.success(
        `${rows.length} resolución(es) registrada(s); ${materialized} acuerdo(s) 360 materializado(s)`
      );
      setResolutionsSaved(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al registrar resoluciones");
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--g-text-secondary)]">
        Registra el sentido del voto por cada punto del orden del día. La materia y clase del punto
        se guardan con la resolución para que el motor pueda explicar denominador, mayoría y regla
        aplicable sin mezclar acuerdos distintos.
      </p>

      <div className="flex flex-wrap gap-2">
        {agendaPoints.map((point, index) => {
          const hasVotes = pointRows(index).some((v) => v.vote !== "");
          const active = index === selectedPointIndex;
          const linkedAgreement = existingResolutions.find(
            (resolution) => resolution.agenda_item_index === index + 1 && Boolean(resolution.agreement_id)
          );
          return (
            <button
              key={`${point.punto}-${index}`}
              type="button"
              onClick={() => setSelectedPointIndex(index)}
              className={`inline-flex items-center gap-2 border px-3 py-2 text-xs font-medium transition-colors ${
                active
                  ? "border-[var(--g-brand-3308)] bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]"
                  : "border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
              }`}
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              Punto {index + 1}
              {hasVotes && <CheckCircle2 className="h-3.5 w-3.5" />}
              {linkedAgreement && (
                <span
                  className={`px-1.5 py-0.5 text-[10px] font-semibold ${
                    active
                      ? "bg-[var(--g-text-inverse)] text-[var(--g-brand-3308)]"
                      : "bg-[var(--g-sec-100)] text-[var(--g-brand-3308)]"
                  }`}
                  style={{ borderRadius: "var(--g-radius-sm)" }}
                >
                  360
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div
        className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-3"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        <p className="text-sm font-semibold text-[var(--g-text-primary)]">
          {selectedPoint?.punto ?? "Acuerdo de la sesión"}
        </p>
        <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
          {labelMateria(selectedPoint?.materia ?? "APROBACION_CUENTAS")} ·{" "}
          {normalizeMateriaClase(selectedPoint?.tipo)} ·{" "}
          {AGENDA_ORIGIN_LABELS[selectedPoint?.origin ?? "MEETING_FLOOR"]}
          {selectedPoint?.agreement_id ? " · propuesta preparada vinculada" : ""}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-[var(--g-surface-subtle)]">
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Miembro
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Voto
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Conflicto
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                Motivo
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--g-border-subtle)]">
            {currentVoters.map((v) => {
              const hasActiveConflict =
                !activeConflictsLoading && v.person_id ? activeConflictPersonIds.has(v.person_id) : false;
              const needsReason = v.vote === "ABSTENCION" || v.conflict_flag;
              return (
                <tr key={v.id} className="transition-colors hover:bg-[var(--g-surface-subtle)]/30">
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-[var(--g-text-primary)]">
                          {v.name}
                        </span>
                        {hasActiveConflict && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--status-warning)]">
                            <AlertTriangle className="h-3 w-3" />
                            Conflicto de interés activo — abstención recomendada
                          </span>
                        )}
                      </div>
                      {v.conflict_flag && (
                        <span
                          className="inline-flex w-fit items-center gap-1 border border-[var(--g-border-subtle)] bg-[var(--g-surface-muted)] px-2 py-0.5 text-xs font-medium text-[var(--status-warning)]"
                          style={{ borderRadius: "var(--g-radius-sm)" }}
                        >
                          <AlertTriangle className="h-3 w-3" />
                          Conflicto declarado
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={v.vote}
                      onChange={(e) => update(v.id, { vote: e.target.value as VoteValue })}
                      className="rounded border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-2 py-1.5 text-sm text-[var(--g-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                      style={{ borderRadius: "var(--g-radius-md)" }}
                    >
                      <option value="">— Sin votar —</option>
                      <option value="FAVOR">A favor</option>
                      <option value="CONTRA">En contra</option>
                      <option value="ABSTENCION">Abstención</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <label className="flex items-center gap-2 text-sm text-[var(--g-text-secondary)]">
                      <input
                        type="checkbox"
                        checked={v.conflict_flag}
                        onChange={(e) => update(v.id, { conflict_flag: e.target.checked })}
                        className="h-4 w-4 accent-[var(--g-brand-3308)]"
                      />
                      Conflicto de interés
                    </label>
                  </td>
                  <td className="px-4 py-3">
                    {needsReason ? (
                      <input
                        type="text"
                        value={v.conflict_reason}
                        onChange={(e) => update(v.id, { conflict_reason: e.target.value })}
                        placeholder={
                          v.vote === "ABSTENCION"
                            ? "Motivo de la abstención…"
                            : "Motivo del conflicto declarado…"
                        }
                        className="w-full rounded border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-2 py-1.5 text-sm text-[var(--g-text-primary)] placeholder:text-[var(--g-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)]"
                        style={{ borderRadius: "var(--g-radius-md)" }}
                      />
                    ) : (
                      <span className="text-xs text-[var(--g-text-secondary)]">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div
        className="flex items-center gap-6 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-4 py-3 text-sm"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        <span className="font-medium text-[var(--g-text-primary)]">Resumen:</span>
        <span className="text-[var(--status-success)]">{formatVoteWeight(favor)} a favor</span>
        <span className="text-[var(--status-error)]">{formatVoteWeight(contra)} en contra</span>
        <span className="text-[var(--g-text-secondary)]">{formatVoteWeight(abstencion)} abstenciones</span>
        {currentVoters.filter((v) => v.conflict_flag).length > 0 && (
          <span className="text-[var(--status-warning)]">
            {currentVoters.filter((v) => v.conflict_flag).length} conflicto(s) declarado(s)
          </span>
        )}
      </div>

      {!currentVoteCompleteness.complete || currentVoteCompleteness.ignored_conflict_vote_ids.length > 0 ? (
        <div
          className="space-y-1 border border-[var(--status-warning)] bg-[var(--g-surface-muted)] px-4 py-3 text-xs text-[var(--g-text-secondary)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          {currentVoteCompleteness.missing_vote_ids.length > 0 ? (
            <p className="font-medium text-[var(--status-warning)]">
              Faltan {currentVoteCompleteness.missing_vote_ids.length} voto(s) expresos en este punto.
            </p>
          ) : null}
          {currentVoteCompleteness.missing_conflict_reason_ids.length > 0 ? (
            <p className="font-medium text-[var(--status-warning)]">
              Faltan motivos en {currentVoteCompleteness.missing_conflict_reason_ids.length} conflicto(s) declarado(s).
            </p>
          ) : null}
          {currentVoteCompleteness.ignored_conflict_vote_ids.length > 0 ? (
            <p>
              Los votos de personas conflictuadas se conservan en pantalla como dato operativo, pero el motor los excluye del denominador legal.
            </p>
          ) : null}
        </div>
      ) : null}

      {ENGINE_V2 && (
        <div className="mt-6 space-y-4">
          <div
            className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
            style={{ borderRadius: "var(--g-radius-lg)" }}
          >
            <h3 className="mb-3 text-sm font-semibold text-[var(--g-text-primary)]">
              Evaluación de adopción por punto
            </h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div
                className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] p-3"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <p className="text-xs font-semibold uppercase text-[var(--g-text-secondary)]">
                  Validez societaria
                </p>
                <span
                  className={`mt-2 inline-flex px-2.5 py-1 text-[11px] font-semibold ${snapshotBadgeClass(currentSnapshot)}`}
                  style={{ borderRadius: "var(--g-radius-full)" }}
                >
                  {currentSnapshot.societary_validity.ok ? "PROCLAMABLE" : "NO PROCLAMABLE"}
                </span>
                <p className="mt-2 text-xs text-[var(--g-text-primary)]">
                  {currentSnapshot.societary_validity.explain[
                    currentSnapshot.societary_validity.explain.length - 1
                  ]?.mensaje ??
                    currentSnapshot.societary_validity.explain[0]?.mensaje ??
                    "Sin explicación disponible."}
                </p>
                <p className="mt-2 text-xs text-[var(--g-text-secondary)]">
                  Voto de calidad: {votoCalidadHabilitado ? "habilitado" : "no habilitado"}
                  {currentSnapshot.societary_validity.voting.votoCalidadUsado ? " · usado para desempate" : ""}
                </p>
              </div>
              <div
                className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] p-3"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <p className="text-xs font-semibold uppercase text-[var(--g-text-secondary)]">
                  Denominador y conflictos
                </p>
                <p className="mt-2 text-sm font-semibold text-[var(--g-text-primary)]">
                  {formatVoteWeight(currentSnapshot.vote_summary.voting_weight)} computable
                </p>
                <p className="mt-1 text-xs text-[var(--g-text-secondary)]">
                  Excluido por conflicto: {formatVoteWeight(currentSnapshot.vote_summary.conflict_excluded)}
                </p>
              </div>
              <div
                className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] p-3"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <p className="text-xs font-semibold uppercase text-[var(--g-text-secondary)]">
                  Pactos parasociales
                </p>
                <span
                  className={`mt-2 inline-flex px-2.5 py-1 text-[11px] font-semibold ${
                    currentSnapshot.pacto_compliance.ok
                      ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
                      : "bg-[var(--status-warning)] text-[var(--g-text-inverse)]"
                  }`}
                  style={{ borderRadius: "var(--g-radius-full)" }}
                >
                  {currentSnapshot.pacto_compliance.ok ? "SIN INCUMPLIMIENTO" : "INCUMPLIMIENTO CONTRACTUAL"}
                </span>
                <p className="mt-2 text-xs text-[var(--g-text-secondary)]">
                  {currentSnapshot.pacto_compliance.pactos_aplicables} pacto(s) aplicable(s);
                  no alteran la validez societaria salvo estatutarización.
                </p>
              </div>
            </div>

            {(currentSnapshot.societary_validity.blocking_issues.length > 0 ||
              currentSnapshot.pacto_compliance.blocking_issues.length > 0) && (
              <div className="mt-3 space-y-1 border-t border-[var(--g-border-subtle)] pt-3">
                {currentSnapshot.societary_validity.blocking_issues.map((issue) => (
                  <p key={`soc-${issue}`} className="text-xs text-[var(--status-error)]">
                    Societario: {issue}
                  </p>
                ))}
                {currentSnapshot.pacto_compliance.blocking_issues.map((issue) => (
                  <p key={`pacto-${issue}`} className="text-xs text-[var(--status-warning)]">
                    Pacto: {issue}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="border-t border-[var(--g-border-subtle)] pt-4">
        {hasResolutions ? (
          <div
            className="flex items-center gap-3 border border-[var(--status-success)] bg-[var(--g-sec-100)] px-4 py-3"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--status-success)]" />
            <p className="text-sm font-medium text-[var(--g-text-primary)]">
              {existingResolutions.length > 0 ? existingResolutions.length : "Las"} resoluciones
              ya están registradas; {existingResolutions.filter((resolution) => resolution.agreement_id).length} acuerdo(s)
              360 vinculado(s). Continúa al paso de cierre.
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleSaveResolutions}
            disabled={saveResolutions.isPending || updateQuorumData.isPending || !allPointsHaveVotes}
            aria-busy={saveResolutions.isPending || updateQuorumData.isPending}
            title={
              !allPointsHaveVotes
                ? "Registra voto expreso de cada votante elegible y motivo de cada conflicto"
                : undefined
            }
            className="inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2.5 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] disabled:opacity-50"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            {saveResolutions.isPending || updateQuorumData.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Registrar resolución y materializar acuerdo 360
          </button>
        )}
      </div>
    </div>
  );
}

// ── Paso 6: Cierre ───────────────────────────────────────────────────────────

function buildActaContent(
  meeting: ReturnType<typeof useReunionById>["data"],
  attendees: ReturnType<typeof useReunionAttendees>["data"],
  resolutions: MeetingResolution[]
): string {
  const m = meeting as {
    meeting_type?: string | null;
    scheduled_start?: string | null;
    location?: string | null;
    quorum_data?: Record<string, unknown> | null;
    governing_bodies?: {
      name?: string | null;
      entities?: { common_name?: string | null } | null;
    } | null;
  } | null;

  const lines: string[] = [];
  lines.push("ACTA DE REUNIÓN");
  lines.push("================");
  lines.push(`Entidad: ${m?.governing_bodies?.entities?.common_name ?? "—"}`);
  lines.push(`Órgano: ${m?.governing_bodies?.name ?? "—"}`);
  lines.push(`Tipo de sesión: ${m?.meeting_type ?? "—"}`);
  if (m?.scheduled_start) {
    lines.push(
      `Fecha: ${new Date(m.scheduled_start).toLocaleString("es-ES", {
        dateStyle: "long",
        timeStyle: "short",
      })}`
    );
  }
  if (m?.location) lines.push(`Lugar: ${m.location}`);
  lines.push("");

  const safeAttendees = attendees ?? [];
  const present = safeAttendees.filter((a) => a.attendance_type !== "AUSENTE").length;
  lines.push(`ASISTENTES: ${present}/${safeAttendees.length} presentes o representados`);
  lines.push("");

  const qd = m?.quorum_data as Record<string, unknown> | null;
  const quorum = qd?.quorum as
    | { present?: number; total?: number; pct?: string; reached?: boolean }
    | undefined;
  if (quorum) {
    lines.push(
      `QUÓRUM: ${quorum.present}/${quorum.total} (${quorum.pct}%) — ${quorum.reached ? "ALCANZADO" : "NO ALCANZADO"}`
    );
    lines.push("");
  }

  const debates = (qd?.debates ?? []) as DebatePunto[];
  if (debates.length > 0) {
    lines.push("PUNTOS DEL ORDEN DEL DÍA:");
    debates.forEach((d, i) => {
      const origin = AGENDA_ORIGIN_LABELS[d.origin ?? "MEETING_FLOOR"];
      lines.push(`${i + 1}. ${d.punto} — origen: ${origin}`);
      if (d.agreement_id) lines.push(`   Propuesta preparada: ${d.agreement_id}`);
      if (d.notas?.trim()) lines.push(`   ${d.notas}`);
    });
    lines.push("");
  }

  if (resolutions.length > 0) {
    lines.push("RESOLUCIONES Y ACUERDOS 360:");
    resolutions.forEach((r, i) => {
      const label =
      r.status === "ADOPTED" ? "APROBADO" : r.status === "REJECTED" ? "RECHAZADO" : r.status;
      lines.push(`${i + 1}. ${r.resolution_text} — ${label}`);
      if (r.agreement_id) {
        lines.push(`   Acuerdo 360: ${r.agreement_id}`);
      }
    });
    lines.push("");
  }

  const snapshots = (qd?.point_snapshots ?? []) as MeetingAdoptionSnapshot[];
  if (snapshots.length > 0) {
    lines.push("SNAPSHOT DE ADOPCIÓN:");
    snapshots.forEach((snapshot) => {
      lines.push(
        `${snapshot.agenda_item_index}. ${snapshot.materia} — validez societaria: ${
          snapshot.societary_validity.ok ? "PROCLAMABLE" : "NO PROCLAMABLE"
        }`
      );
      lines.push(
        `   Votos computables: favor ${formatVoteWeight(snapshot.vote_summary.favor)}, contra ${formatVoteWeight(snapshot.vote_summary.contra)}, abstenciones ${formatVoteWeight(snapshot.vote_summary.abstenciones)}`
      );
      if (snapshot.vote_completeness && !snapshot.vote_completeness.complete) {
        lines.push(
          `   Votación incompleta: ${snapshot.vote_completeness.missing_vote_ids.length} voto(s) pendiente(s), ${snapshot.vote_completeness.missing_conflict_reason_ids.length} motivo(s) de conflicto pendiente(s).`
        );
      }
      if (snapshot.vote_completeness?.ignored_conflict_vote_ids.length) {
        lines.push(
          `   Conflictos: ${snapshot.vote_completeness.ignored_conflict_vote_ids.length} voto(s) de conflictuados excluido(s) del denominador.`
        );
      }
      if (!snapshot.pacto_compliance.ok) {
        lines.push("   Pactos: incumplimiento contractual advertido; no altera la validez societaria salvo estatutarización.");
      }
    });
    lines.push("");
  }

  lines.push(
    `Generado el ${new Date().toLocaleString("es-ES", { dateStyle: "long", timeStyle: "short" })}`
  );
  return lines.join("\n");
}

function CierreStep({ meetingId }: { meetingId?: string }) {
  const navigate = useNavigate();
  const { data: meeting } = useReunionById(meetingId);
  const { data: attendees } = useReunionAttendees(meetingId);
  const { data: resolutions = [], isLoading: resLoading } = useReunionResolutions(meetingId);
  const generarActa = useGenerarActa();
  const [minuteId, setMinuteId] = useState<string | null>(null);
  const materializedAgreementCount = resolutions.filter((resolution) => resolution.agreement_id).length;

  function handleConfirmar() {
    if (!meetingId) return;
    const content = buildActaContent(meeting, attendees, resolutions);
    generarActa.mutate(
      { meetingId, content },
      {
        onSuccess: (id) => {
          setMinuteId(id);
          toast.success("Acta generada en borrador");
        },
        onError: (e) =>
          toast.error(e instanceof Error ? e.message : "Error al generar el acta"),
      }
    );
  }

  if (minuteId) {
    return (
      <div className="space-y-4">
        <div
          className="flex items-center gap-3 border border-[var(--status-success)] bg-[var(--g-sec-100)] p-4"
          style={{ borderRadius: "var(--g-radius-lg)" }}
        >
          <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--status-success)]" />
          <div>
            <p className="text-sm font-semibold text-[var(--g-text-primary)]">
              Acta generada en borrador
            </p>
            <p className="mt-0.5 text-xs text-[var(--g-text-secondary)]">
              {resolutions.length} resolución(es) registrada(s), {materializedAgreementCount} acuerdo(s)
              360 vinculados. Procede a firmar el acta y emitir la certificación.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate(`/secretaria/actas/${minuteId}`)}
          className="inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2.5 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <FileText className="h-4 w-4" />
          Ver acta
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-[var(--g-text-secondary)]">
        Revisa las resoluciones y sus acuerdos 360 vinculados antes de confirmar el cierre. Al confirmar, se generará el
        acta en borrador mediante{" "}
        <span className="font-medium text-[var(--g-text-primary)]">fn_generar_acta</span>.
      </p>

      {resLoading ? (
        <div className="flex items-center gap-2 text-[var(--g-text-secondary)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Cargando acuerdos…</span>
        </div>
      ) : resolutions.length === 0 ? (
        <div
          className="flex items-start gap-3 border-l-4 border-[var(--status-warning)] bg-[var(--g-surface-muted)] p-4"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-warning)]" />
          <p className="text-xs text-[var(--g-text-secondary)]">
            No hay resoluciones registradas. Vuelve al paso de votaciones y usa «Registrar resolución
            y materializar acuerdo 360» antes de cerrar la sesión.
          </p>
        </div>
      ) : (
        <div
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <div className="border-b border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-4 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-primary)]">
              Resoluciones y acuerdos 360 ({resolutions.length})
            </p>
          </div>
          <ul className="divide-y divide-[var(--g-border-subtle)]">
            {resolutions.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <span className="text-sm text-[var(--g-text-primary)]">{r.resolution_text}</span>
                <div className="flex shrink-0 flex-wrap justify-end gap-2">
                  {r.agreement_id && (
                    <span
                      className="bg-[var(--g-sec-100)] px-2.5 py-1 text-[11px] font-semibold text-[var(--g-brand-3308)]"
                      style={{ borderRadius: "var(--g-radius-full)" }}
                    >
                      Acuerdo 360
                    </span>
                  )}
                  <span
                    className={`px-2.5 py-1 text-[11px] font-semibold text-[var(--g-text-inverse)] ${
                      r.status === "ADOPTED" ? "bg-[var(--status-success)]" : "bg-[var(--status-error)]"
                    }`}
                    style={{ borderRadius: "var(--g-radius-full)" }}
                  >
                    {r.status === "ADOPTED" ? "APROBADO" : "RECHAZADO"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div
        className="flex items-start gap-3 border-l-4 border-[var(--status-warning)] bg-[var(--g-surface-muted)] p-4"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-warning)]" />
        <p className="text-xs text-[var(--g-text-secondary)]">
          Esta acción no se puede deshacer desde la interfaz. El acta quedará en estado BORRADOR
          hasta que sea firmada por la Secretaria.
        </p>
      </div>

      <button
        type="button"
        onClick={handleConfirmar}
        disabled={generarActa.isPending || resolutions.length === 0}
        aria-busy={generarActa.isPending}
        className="inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2.5 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] disabled:opacity-50"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        {generarActa.isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Generando acta…
          </>
        ) : (
          <>
            <FileText className="h-4 w-4" />
            Confirmar cierre y generar acta
          </>
        )}
      </button>
    </div>
  );
}

// ── Steps ────────────────────────────────────────────────────────────────────

function buildSteps(meetingId?: string): StepDef[] {
  return [
    {
      n: 1,
      label: "Constitución",
      hint: "Verificación de convocatoria previa y declaración de apertura de la sesión",
      body: <ConstitutionStep meetingId={meetingId} />,
    },
    {
      n: 2,
      label: "Asistentes",
      hint: "Registro de presentes, representados y ausentes — cálculo de capital representado",
      body: <AsistentesStep meetingId={meetingId} />,
    },
    {
      n: 3,
      label: "Quórum",
      hint: "Evaluación automática del quórum de constitución contra la regla jurisdiccional aplicable",
      body: <QuorumStep meetingId={meetingId} />,
    },
    {
      n: 4,
      label: "Agenda y debate",
      hint: "Agenda formal, propuestas preparadas y puntos nacidos durante la sesión",
      body: <DebatesStep meetingId={meetingId} />,
    },
    {
      n: 5,
      label: "Votaciones",
      hint: "Resultado por punto con mayoría, conflictos, vetos, pactos y snapshot legal",
      body: <VotacionesStep meetingId={meetingId} />,
    },
    {
      n: 6,
      label: "Cierre",
      hint: "Revisión de acuerdos adoptados y generación del acta en borrador",
      body: <CierreStep meetingId={meetingId} />,
    },
  ];
}

export default function ReunionStepper() {
  const { id } = useParams();
  return (
    <StepperShell
      eyebrow="Secretaría · Reunión"
      title="Asistente de sesión societaria"
      backTo="/secretaria/reuniones"
      steps={buildSteps(id)}
    />
  );
}
