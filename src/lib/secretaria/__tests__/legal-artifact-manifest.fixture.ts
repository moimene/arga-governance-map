import {
  LEGAL_ARTIFACT_MANIFEST_SCHEMA,
  type LegalArtifactEvidence,
  type LegalArtifactManifest,
  type LegalArtifactParticipant,
} from "../legal-artifact-manifest";

const boardMembers = [
  ["p-01", "Antonio Ríos Valverde", "Presidente"],
  ["p-02", "Ana Bravo Salas", "Vicepresidenta"],
  ["p-03", "Beatriz Cano Ruiz", "Vocal independiente"],
  ["p-04", "Carlos Díaz Mora", "Vocal independiente"],
  ["p-05", "Diana Esteve Gil", "Vocal independiente"],
  ["p-06", "Eduardo Ferrer León", "Vocal independiente"],
  ["p-07", "Fernanda Gómez Paz", "Vocal independiente"],
  ["p-08", "Gabriel Herrera Sol", "Vocal independiente"],
  ["p-09", "Helena Iglesias Mar", "Vocal independiente"],
  ["p-10", "Ignacio Jiménez Rey", "Vocal independiente"],
  ["p-11", "Julia Llorente Puig", "Vocal ejecutiva"],
  ["p-12", "Luis Martín Sanz", "Vocal ejecutivo"],
  ["p-13", "Marta Navarro Vela", "Vocal ejecutiva"],
  ["p-14", "Nicolás Ortega Cruz", "Vocal ejecutivo"],
  ["p-15", "Olivia Pérez Alba", "Vocal dominical"],
] as const;

function evidence(
  id: string,
  type: LegalArtifactEvidence["type"],
  hashCharacter: string,
  issuedAtISO: string,
): LegalArtifactEvidence {
  return {
    id,
    type,
    hashAlgorithm: "SHA-256",
    hash: hashCharacter.repeat(64),
    issuedAtISO,
    uri: `evidence://arga/${id}`,
  };
}

export function buildCompleteArgaLegalArtifactManifest(): LegalArtifactManifest {
  const participants: LegalArtifactParticipant[] = boardMembers.map(([id, name, role], index) => ({
    id,
    name,
    role,
    personKind: "NATURAL_PERSON",
    votingEligible: true,
    attendance: index === 13 ? "REPRESENTED" : index === 14 ? "ABSENT" : "PRESENT",
    representedBy: index === 13
      ? { id: "p-03", name: "Beatriz Cano Ruiz", role: "Vocal representante", personKind: "NATURAL_PERSON" }
      : null,
    capitalPercentage: null,
  }));
  participants.push({
    id: "p-secretary",
    name: "Lucía Paredes Vega",
    role: "Secretaria no consejera",
    personKind: "NATURAL_PERSON",
    votingEligible: false,
    attendance: "INVITED",
    representedBy: null,
    capitalPercentage: null,
  });

  return {
    schemaVersion: LEGAL_ARTIFACT_MANIFEST_SCHEMA,
    artifactId: "minute-arga-board-20260808",
    generatedAtISO: "2026-08-09T12:00:00Z",
    entity: {
      id: "6d7ed736-f263-4531-a59d-c6ca0cd41602",
      name: "ARGA Seguros, S.A.",
      legalForm: "SA",
      listed: true,
    },
    organ: {
      id: "body-arga-board",
      name: "Consejo de Administración",
      kind: "BOARD",
    },
    meeting: {
      id: "meeting-arga-20260808",
      modality: "IN_PERSON",
      startAtISO: "2026-08-08T10:00:00Z",
      endAtISO: "2026-08-08T12:00:00Z",
      place: "Domicilio social de ARGA Seguros, Madrid",
    },
    convocation: {
      dateISO: "2026-08-01T09:00:00Z",
      mode: "correo electrónico certificado a cada vocal",
      author: {
        id: "p-secretary",
        name: "Lucía Paredes Vega",
        role: "Secretaria no consejera",
        personKind: "NATURAL_PERSON",
      },
      fullText: "Convocatoria del Consejo de Administración para el 8 de agosto de 2026 a las 10:00, en el domicilio social, con el orden del día incorporado en esta comunicación.",
      evidenceIds: ["ev-convocation"],
    },
    census: {
      method: "lista nominativa cerrada contra mandatos vigentes y confirmaciones de asistencia",
      closedAtISO: "2026-08-08T10:05:00Z",
      evidenceId: "ev-census",
      participants,
    },
    quorum: {
      denominatorKind: "BOARD_SEATS",
      eligibleCount: 15,
      presentCount: 13,
      representedCount: 1,
      absentCount: 1,
      requiredCount: 8,
      capitalPercentage: null,
    },
    chair: {
      president: {
        id: "p-01",
        name: "Antonio Ríos Valverde",
        role: "Presidente del Consejo",
        personKind: "NATURAL_PERSON",
      },
      secretary: {
        id: "p-secretary",
        name: "Lucía Paredes Vega",
        role: "Secretaria no consejera",
        personKind: "NATURAL_PERSON",
      },
      appointmentBasis: "cargos vigentes inscritos y comprobados al constituirse la sesión",
      evidenceIds: ["ev-chair"],
    },
    agenda: [
      {
        id: "agenda-1",
        order: 1,
        title: "Aprobación de la política de continuidad operativa",
        kind: "DECISION",
        deliberation: "La Presidencia expone el informe de Riesgos y los vocales deliberan sobre alcance, métricas y fecha de entrada en vigor.",
        interventionsStatus: "RECORDED",
        requestedInterventions: ["Beatriz Cano solicita que conste la revisión anual de métricas de recuperación."],
        exactResolution: "Aprobar la Política de Continuidad Operativa versión 3.0, con entrada en vigor el 1 de septiembre de 2026 y revisión anual por la Comisión de Riesgos.",
        vote: {
          eligibleVoters: 14,
          favor: 13,
          against: 1,
          abstentions: 0,
          excludedForConflict: 0,
          majorityRule: "mayoría absoluta de los vocales concurrentes con derecho de voto",
          adopted: true,
          proclamation: "La Presidencia declara aprobado el acuerdo por trece votos a favor y uno en contra.",
          evidenceId: "ev-vote",
        },
        conflicts: [],
        evidenceIds: ["ev-deliberation"],
      },
    ],
    approval: {
      status: "APPROVED",
      method: "aprobación al término de la reunión por el propio Consejo",
      dateISO: "2026-08-08T12:15:00Z",
      approvedBy: ["p-01", "p-secretary"],
      evidenceIds: ["ev-approval"],
    },
    signatures: [
      {
        person: {
          id: "p-01",
          name: "Antonio Ríos Valverde",
          role: "Presidente del Consejo",
          personKind: "NATURAL_PERSON",
        },
        capacity: "PRESIDENT",
        status: "SIGNED",
        signedAtISO: "2026-08-08T12:30:00Z",
        evidenceId: "ev-sign-president",
      },
      {
        person: {
          id: "p-secretary",
          name: "Lucía Paredes Vega",
          role: "Secretaria no consejera",
          personKind: "NATURAL_PERSON",
        },
        capacity: "SECRETARY",
        status: "SIGNED",
        signedAtISO: "2026-08-08T12:31:00Z",
        evidenceId: "ev-sign-secretary",
      },
    ],
    bookEntry: {
      bookId: "book-board-2026",
      bookTitle: "Libro de actas del Consejo de Administración 2026",
      sectionId: "section-board",
      entryId: "entry-2026-008",
      ordinalNumber: 8,
      recordedAtISO: "2026-08-08T13:00:00Z",
      sourceHash: "9".repeat(64),
      evidenceId: "ev-book-entry",
    },
    annexes: [
      {
        id: "annex-attendance",
        order: 1,
        title: "Lista nominativa de asistentes, representados y ausentes",
        type: "ATTENDANCE_LIST",
        hash: "8".repeat(64),
        evidenceId: "ev-annex",
      },
    ],
    evidences: [
      evidence("ev-convocation", "CONVOCATION", "a", "2026-08-01T09:01:00Z"),
      evidence("ev-census", "CENSUS", "b", "2026-08-08T10:05:00Z"),
      evidence("ev-chair", "OTHER", "4", "2026-08-08T10:06:00Z"),
      evidence("ev-deliberation", "DELIBERATION", "c", "2026-08-08T11:00:00Z"),
      evidence("ev-vote", "VOTE", "d", "2026-08-08T11:45:00Z"),
      evidence("ev-approval", "APPROVAL", "e", "2026-08-08T12:15:00Z"),
      evidence("ev-sign-president", "SIGNATURE", "f", "2026-08-08T12:30:00Z"),
      evidence("ev-sign-secretary", "SIGNATURE", "1", "2026-08-08T12:31:00Z"),
      evidence("ev-book-entry", "BOOK_ENTRY", "2", "2026-08-08T13:00:00Z"),
      evidence("ev-annex", "ANNEX", "3", "2026-08-08T12:00:00Z"),
    ],
  };
}

export function buildPreSignatureArgaLegalArtifactManifest(): LegalArtifactManifest {
  const manifest = buildCompleteArgaLegalArtifactManifest();
  manifest.generatedAtISO = "2026-08-08T12:05:00Z";
  manifest.approval = {
    status: "PENDING",
    method: "aprobación prevista al término de la reunión por el propio Consejo",
    dateISO: null,
    approvedBy: [],
    evidenceIds: [],
  };
  manifest.signatures = manifest.signatures.map((signature) => ({
    ...signature,
    status: "PENDING",
    signedAtISO: null,
    evidenceId: null,
  }));
  manifest.bookEntry = null;
  manifest.evidences = manifest.evidences.filter((evidenceItem) =>
    !["ev-approval", "ev-sign-president", "ev-sign-secretary", "ev-book-entry"].includes(evidenceItem.id),
  );
  return manifest;
}

export function buildDefectiveArgaLegalArtifactManifest(): LegalArtifactManifest {
  const manifest = buildCompleteArgaLegalArtifactManifest();
  manifest.generatedAtISO = "2026-07-20T12:00:00Z";
  manifest.quorum.denominatorKind = "VOTING_CAPITAL";
  manifest.quorum.capitalPercentage = 100;
  manifest.census.participants[1] = {
    ...manifest.census.participants[1],
    name: "ARGA Capital Inversiones, S.L.",
    personKind: "LEGAL_PERSON",
    capitalPercentage: 6.5,
  };
  manifest.agenda[0].vote = {
    ...manifest.agenda[0].vote!,
    eligibleVoters: 16,
    favor: 16,
    against: 0,
  };
  manifest.convocation.fullText = "La convocatoria consta en el expediente.";
  return manifest;
}
