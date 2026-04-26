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
import {
  useBodyMembers,
  useGenerarActa,
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
import { evaluarMayoria } from "@/lib/rules-engine";
import { StepperShell, StepDef } from "./_shared/StepperShell";

// ── Tipos locales ────────────────────────────────────────────────────────────

type VoteValue = "FAVOR" | "CONTRA" | "ABSTENCION" | "";

interface VoterRow {
  id: string;
  person_id: string | null;
  name: string;
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
  person_name: string | null;
}

function formatMeetingVoterName(voter: MeetingVoterRow) {
  return voter.person_name?.trim() || "Miembro sin identificar";
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

  const isOpen = m.status === "OPEN";
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
        pasa a <span className="font-medium text-[var(--g-text-primary)]">OPEN</span> y se activan
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
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[var(--g-text-inverse)]`}
            style={{
              borderRadius: "var(--g-radius-full)",
              backgroundColor: isOpen ? "var(--status-success)" : "var(--status-info)",
            }}
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

type AttendanceEntry = { attendance_type: "PRESENCIAL" | "REPRESENTADO" | "AUSENTE"; represented_by_id: string };

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
          };
        }
      }
    }
    for (const m of members) {
      if (!map[m.person_id]) {
        map[m.person_id] = { attendance_type: "PRESENCIAL", represented_by_id: "" };
      }
    }
    setAttendance(map);
    setInitialized(true);
  }, [initialized, members, existingAttendees]);

  function setType(personId: string, type: AttendanceEntry["attendance_type"]) {
    setAttendance((prev) => ({
      ...prev,
      [personId]: { ...prev[personId], attendance_type: type },
    }));
  }

  function setRepr(personId: string, val: string) {
    setAttendance((prev) => ({
      ...prev,
      [personId]: { ...prev[personId], represented_by_id: val },
    }));
  }

  function handleSave() {
    const rows = members.map((m) => ({
      person_id: m.person_id,
      attendance_type: attendance[m.person_id]?.attendance_type ?? "PRESENCIAL",
      represented_by_id: attendance[m.person_id]?.represented_by_id || null,
    }));
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
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--g-border-subtle)]">
            {members.map((m: BodyMember) => {
              const entry = attendance[m.person_id] ?? { attendance_type: "PRESENCIAL", represented_by_id: "" };
              const needsRepr = entry.attendance_type === "REPRESENTADO";
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
                      <input
                        type="text"
                        value={entry.represented_by_id}
                        onChange={(e) => setRepr(m.person_id, e.target.value)}
                        placeholder="Nombre del representante…"
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

  const { data: attendees = [] } = useReunionAttendees(meetingId);
  const { data: members = [] } = useBodyMembers(bodyId);
  const updateQuorum = useUpdateQuorumData(meetingId);

  const presentes = attendees.filter((a) => a.attendance_type !== "AUSENTE").length;
  const total = members.length > 0 ? members.length : attendees.length;
  const pct = total > 0 ? (presentes / total) * 100 : 0;
  const quorumReached = pct > 50;

  const savedQuorum = existingQuorum?.quorum as
    | { present: number; total: number; pct: string; reached: boolean; evaluated_at: string }
    | undefined;

  function handleConfirm() {
    const quorumData: Record<string, unknown> = {
      ...(existingQuorum ?? {}),
      quorum: {
        present: presentes,
        total,
        pct: pct.toFixed(1),
        reached: quorumReached,
        evaluated_at: new Date().toISOString(),
      },
    };
    updateQuorum.mutate(quorumData, {
      onSuccess: () => toast.success("Quórum registrado en el acta"),
      onError: (e) => toast.error(e instanceof Error ? e.message : "Error al guardar quórum"),
    });
  }

  const engineResult = evaluarMayoria(
    { formula: "presentes > 50%", fuente: "LEY", referencia: "art. 193 LSC (quórum ordinario)" },
    {
      favor: presentes,
      contra: 0,
      abstenciones: 0,
      en_blanco: 0,
      capital_presente: presentes,
      capital_total: total,
      total_miembros: total,
      miembros_presentes: presentes,
    }
  );

  return (
    <div className="space-y-5">
      <p className="text-sm text-[var(--g-text-secondary)]">
        El quórum de constitución se calcula sobre los miembros del órgano. Confirma para
        registrarlo en el acta y desbloquear el paso de debates.
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
            className="text-3xl font-bold"
            style={{ color: quorumReached ? "var(--status-success)" : "var(--status-error)" }}
          >
            {pct.toFixed(1)}%
          </p>
          <p className="mt-1 text-xs text-[var(--g-text-secondary)]">Representación</p>
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
              className="inline-flex px-2.5 py-1 text-[11px] font-semibold text-[var(--g-text-inverse)]"
              style={{
                borderRadius: "var(--g-radius-full)",
                backgroundColor: quorumReached ? "var(--status-success)" : "var(--status-error)",
              }}
            >
              {quorumReached ? "QUÓRUM ALCANZADO" : "SIN QUÓRUM"}
            </span>
          </div>
          <p className="text-xs text-[var(--g-text-secondary)]">
            <span className="font-mono">presentes / total &gt; 50%</span> — Fuente: LSC art. 193
          </p>
          <p className="text-xs text-[var(--g-text-primary)]">{engineResult.explain.mensaje}</p>
        </div>
      </div>

      {savedQuorum && (
        <div
          className="flex items-center gap-3 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-4 py-3"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <CheckCircle2 className="h-4 w-4 text-[var(--status-success)]" />
          <p className="text-xs text-[var(--g-text-secondary)]">
            Quórum ya registrado: {savedQuorum.pct}% —{" "}
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
}

function DebatesStep({ meetingId }: { meetingId?: string }) {
  const { data: meeting } = useReunionById(meetingId);
  const existingQD = (meeting as { quorum_data?: Record<string, unknown> | null } | null)?.quorum_data;
  const existingDebates = (existingQD?.debates ?? []) as DebatePunto[];

  const updateQuorum = useUpdateQuorumData(meetingId);

  const [debates, setDebates] = useState<DebatePunto[]>([{ punto: "", notas: "" }]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (initialized) return;
    if (meeting === undefined) return;
    if (existingDebates.length > 0) {
      setDebates(existingDebates);
    }
    setInitialized(true);
  }, [initialized, meeting, existingDebates]);

  function addPunto() {
    setDebates((prev) => [...prev, { punto: "", notas: "" }]);
  }

  function removePunto(idx: number) {
    setDebates((prev) => prev.filter((_, i) => i !== idx));
  }

  function updatePunto(idx: number, field: keyof DebatePunto, val: string) {
    setDebates((prev) => prev.map((d, i) => (i === idx ? { ...d, [field]: val } : d)));
  }

  function handleSave() {
    const qd: Record<string, unknown> = {
      ...(existingQD ?? {}),
      debates,
    };
    updateQuorum.mutate(qd, {
      onSuccess: () => toast.success("Debates guardados"),
      onError: (e) => toast.error(e instanceof Error ? e.message : "Error al guardar debates"),
    });
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-[var(--g-text-secondary)]">
        Registra los puntos del orden del día debatidos y las notas del secretario para cada uno.
        Estos datos se incorporarán al acta.
      </p>

      <div className="space-y-4">
        {debates.map((d, idx) => (
          <div
            key={idx}
            className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
            style={{ borderRadius: "var(--g-radius-lg)" }}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--g-brand-3308)]">
                Punto {idx + 1}
              </span>
              {debates.length > 1 && (
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
        Añadir punto del orden del día
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
  const { data: existingResolutions = [] } = useReunionResolutions(meetingId);
  const saveResolutions = useSaveMeetingResolutions(meetingId);
  const [resolutionsSaved, setResolutionsSaved] = useState(false);

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
          .select("id, person_id, attendance_type, person:person_id(full_name)")
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
        person?: { full_name?: string | null } | null;
      };

      const voters = ((attendeesRes.data ?? []) as AttendeeRaw[]).map((a) => ({
        id: a.id,
        person_id: a.person_id,
        attendance_type: a.attendance_type ?? null,
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

  function update(id: string, patch: Partial<VoterRow>) {
    setVoters((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  }

  const favor = voters.filter((v) => v.vote === "FAVOR").length;
  const contra = voters.filter((v) => v.vote === "CONTRA").length;
  const abstencion = voters.filter((v) => v.vote === "ABSTENCION").length;

  const hasResolutions = existingResolutions.length > 0 || resolutionsSaved;

  function handleSaveResolutions() {
    const debates = (
      (meetingForDebates as { quorum_data?: Record<string, unknown> | null } | null)?.quorum_data
        ?.debates ?? []
    ) as Array<{ punto: string; notas: string }>;

    const approved = favor > contra;
    const rows =
      debates.length > 0
        ? debates.map((d, i) => ({
            agenda_item_index: i + 1,
            resolution_text: d.punto,
            resolution_type: "ORDINARIA",
            status: approved ? "ADOPTED" : "REJECTED",
            required_majority_code: null,
          }))
        : [
            {
              agenda_item_index: 1,
              resolution_text: "Acuerdo de la sesión",
              resolution_type: "ORDINARIA",
              status: approved ? "ADOPTED" : "REJECTED",
              required_majority_code: null,
            },
          ];

    saveResolutions.mutate(rows, {
      onSuccess: () => {
        toast.success(`${rows.length} resolución(es) registrada(s)`);
        setResolutionsSaved(true);
      },
      onError: (e) =>
        toast.error(e instanceof Error ? e.message : "Error al registrar resoluciones"),
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--g-text-secondary)]">
        Registra el sentido del voto de cada miembro. Marca «Conflicto de interés» si el miembro
        tiene un interés que debe declararse. El campo «Motivo» es obligatorio en abstenciones y
        conflictos declarados.
      </p>

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
            {voters.map((v) => {
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
        <span className="text-[var(--status-success)]">{favor} a favor</span>
        <span className="text-[var(--status-error)]">{contra} en contra</span>
        <span className="text-[var(--g-text-secondary)]">{abstencion} abstenciones</span>
        {voters.filter((v) => v.conflict_flag).length > 0 && (
          <span className="text-[var(--status-warning)]">
            {voters.filter((v) => v.conflict_flag).length} conflicto(s) declarado(s)
          </span>
        )}
      </div>

      {ENGINE_V2 && (
        <div className="mt-6 space-y-4">
          <div
            className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
            style={{ borderRadius: "var(--g-radius-lg)" }}
          >
            <h3 className="mb-3 text-sm font-semibold text-[var(--g-text-primary)]">
              Evaluación de Mayoría (V2)
            </h3>
            {(() => {
              const result = evaluarMayoria(
                { formula: "favor > contra", fuente: "LEY", referencia: "art. 201 LSC" },
                {
                  favor,
                  contra,
                  abstenciones: abstencion,
                  en_blanco: 0,
                  capital_presente: voters.length,
                  capital_total: voters.length,
                  total_miembros: voters.length,
                  miembros_presentes: voters.length,
                }
              );
              return (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {result.alcanzada ? (
                      <CheckCircle2 className="h-4 w-4 text-[var(--status-success)]" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-[var(--status-error)]" />
                    )}
                    <span
                      className={`inline-flex px-2.5 py-1 text-[11px] font-semibold ${
                        result.alcanzada
                          ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
                          : "bg-[var(--status-error)] text-[var(--g-text-inverse)]"
                      }`}
                      style={{ borderRadius: "var(--g-radius-full)" }}
                    >
                      {result.alcanzada ? "OK" : "RECHAZADO"}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--g-text-secondary)]">
                    <span className="font-mono">{result.formula}</span> — Fuente: LSC art. 201
                  </p>
                  <p className="text-xs text-[var(--g-text-primary)]">{result.explain.mensaje}</p>
                </div>
              );
            })()}
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
              ya están registradas. Continúa al paso de cierre.
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleSaveResolutions}
            disabled={saveResolutions.isPending || voters.every((v) => v.vote === "")}
            aria-busy={saveResolutions.isPending}
            title={
              voters.every((v) => v.vote === "")
                ? "Registra al menos un voto antes de continuar"
                : undefined
            }
            className="inline-flex items-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2.5 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] disabled:opacity-50"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            {saveResolutions.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Registrar resultado de la votación
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

  const debates = (qd?.debates ?? []) as Array<{ punto: string; notas: string }>;
  if (debates.length > 0) {
    lines.push("PUNTOS DEL ORDEN DEL DÍA:");
    debates.forEach((d, i) => {
      lines.push(`${i + 1}. ${d.punto}`);
      if (d.notas?.trim()) lines.push(`   ${d.notas}`);
    });
    lines.push("");
  }

  if (resolutions.length > 0) {
    lines.push("ACUERDOS:");
    resolutions.forEach((r, i) => {
      const label =
        r.status === "ADOPTED" ? "APROBADO" : r.status === "REJECTED" ? "RECHAZADO" : r.status;
      lines.push(`${i + 1}. ${r.resolution_text} — ${label}`);
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
              {resolutions.length} acuerdo(s) registrado(s). Procede a firmar el acta y emitir la
              certificación.
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
        Revisa los acuerdos adoptados antes de confirmar el cierre. Al confirmar, se generará el
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
            No hay acuerdos registrados. Vuelve al paso de votaciones y usa «Registrar resultado de
            la votación» antes de cerrar la sesión.
          </p>
        </div>
      ) : (
        <div
          className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <div className="border-b border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-4 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--g-text-primary)]">
              Acuerdos a registrar ({resolutions.length})
            </p>
          </div>
          <ul className="divide-y divide-[var(--g-border-subtle)]">
            {resolutions.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <span className="text-sm text-[var(--g-text-primary)]">{r.resolution_text}</span>
                <span
                  className="shrink-0 px-2.5 py-1 text-[11px] font-semibold text-[var(--g-text-inverse)]"
                  style={{
                    borderRadius: "var(--g-radius-full)",
                    backgroundColor:
                      r.status === "ADOPTED"
                        ? "var(--status-success)"
                        : "var(--status-error)",
                  }}
                >
                  {r.status === "ADOPTED" ? "APROBADO" : "RECHAZADO"}
                </span>
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
      label: "Debates",
      hint: "Puntos del orden del día discutidos y anotaciones del secretario",
      body: <DebatesStep meetingId={meetingId} />,
    },
    {
      n: 5,
      label: "Votaciones",
      hint: "Por cada propuesta aprobada se genera un agreement en estado ADOPTED",
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
