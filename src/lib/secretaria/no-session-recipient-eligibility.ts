export interface NoSessionParticipantLike {
  id: string;
  body_id: string | null;
  person_id: string;
  role: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  source_status?: string | null;
  seat_semantics?: string | null;
}

function effectiveAtLocalToday(value: string | null, endOfDay = false) {
  if (!value) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T${endOfDay ? "23:59:59" : "00:00:00"}`)
    : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isEligibleNoSessionRecipient(
  participant: NoSessionParticipantLike,
  bodyType: string | null | undefined,
  targetBodyId: string | null | undefined,
) {
  const normalized = (bodyType ?? "").trim().toUpperCase();
  const role = (participant.role ?? "").trim().toUpperCase();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startsAt = effectiveAtLocalToday(participant.start_date);
  const endsAt = effectiveAtLocalToday(participant.end_date, true);
  const isCurrent = (participant.source_status ?? participant.status ?? "").toUpperCase()
    .replace("ACTIVO", "VIGENTE") === "VIGENTE";

  if (!isCurrent || (startsAt && startsAt > today) || (endsAt && endsAt < today)) return false;

  if (
    ["CDA", "CONSEJO", "CONSEJO_ADMIN", "CONSEJO_ADMINISTRACION"].includes(normalized)
    || normalized.includes("CONSEJO")
    || ["COMISION", "COMISION_DELEGADA", "COMITE"].includes(normalized)
    || normalized.includes("COMISION")
    || normalized.includes("COMITE")
  ) {
    return participant.body_id === targetBodyId
      && ["CONSEJERO", "PRESIDENTE", "VICEPRESIDENTE", "CONSEJERO_COORDINADOR"].includes(role)
      && (participant.seat_semantics ?? "PRIMARY").toUpperCase() !== "ACCESSORY";
  }
  if (
    ["JGA", "JUNTA", "JUNTA_GENERAL", "SOCIO_UNICO", "DECISION_UNIPERSONAL"].includes(normalized)
    || normalized.includes("JUNTA")
  ) {
    return role === "SOCIO";
  }
  if (["ADMIN_UNICO", "ADMINISTRADOR_UNICO"].includes(normalized)) return role === "ADMIN_UNICO";
  if (["ADMIN_CONJUNTA", "ADMINISTRADORES_MANCOMUNADOS"].includes(normalized)) {
    return role === "ADMIN_MANCOMUNADO";
  }
  if (["ADMIN_SOLIDARIOS", "ADMINISTRADORES_SOLIDARIOS"].includes(normalized)) {
    return role === "ADMIN_SOLIDARIO";
  }
  return false;
}

export function authoritativeNoSessionRecipients<T extends NoSessionParticipantLike>(
  participants: T[],
  bodyType: string | null | undefined,
  targetBodyId: string | null | undefined,
) {
  const byPersonId = new Map<string, T>();
  for (const participant of participants) {
    if (
      isEligibleNoSessionRecipient(participant, bodyType, targetBodyId)
      && !byPersonId.has(participant.person_id)
    ) {
      byPersonId.set(participant.person_id, participant);
    }
  }
  return [...byPersonId.values()];
}
