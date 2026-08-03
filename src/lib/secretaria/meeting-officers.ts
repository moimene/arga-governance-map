export interface MeetingOfficerCandidate {
  person_id: string;
  cargo: string;
  fecha_inicio?: string | null;
}

export interface MeetingOfficerSelection {
  president_id: string | null;
  secretary_id: string | null;
}

function newestFirst(a: MeetingOfficerCandidate, b: MeetingOfficerCandidate) {
  return String(b.fecha_inicio ?? "").localeCompare(String(a.fecha_inicio ?? ""));
}

/** Resuelve la mesa desde cargos vigentes del órgano, con suplencia explícita. */
export function selectMeetingOfficers(
  candidates: MeetingOfficerCandidate[],
): MeetingOfficerSelection {
  const ordered = [...candidates].sort(newestFirst);
  const president =
    ordered.find((candidate) => candidate.cargo === "PRESIDENTE") ??
    ordered.find((candidate) => candidate.cargo === "VICEPRESIDENTE");
  const secretary =
    ordered.find((candidate) => candidate.cargo === "SECRETARIO") ??
    ordered.find((candidate) => candidate.cargo === "VICESECRETARIO");

  return {
    president_id: president?.person_id ?? null,
    secretary_id: secretary?.person_id ?? null,
  };
}
