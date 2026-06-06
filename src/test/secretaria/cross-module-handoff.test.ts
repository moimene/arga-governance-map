import { describe, expect, it } from "vitest";
import {
  buildMeetingHandoffSearch,
  buildMeetingHandoffPath,
  readMeetingHandoff,
  MEETING_INTAKE_PATH,
} from "@/lib/secretaria/cross-module-handoff";

// Codex review: el handoff read-only debe preservar el contexto completo de la propuesta
// (source_id, organ, matter, rationale) entre el emisor (GRC/AIMS) y el receptor
// (ReunionIntake), sin escribir governance_module_*. Estos tests bloquean el contrato de
// claves (el bug `sourceId` vs `source_id` que se coló antes) y prueban el round-trip.
describe("cross-module handoff contract", () => {
  const ctx = {
    source: "grc",
    event: "GRC_INCIDENT_MATERIAL",
    sourceId: "incident-123",
    organ: "CDA",
    matter: "Revisión del incidente material",
    rationale: "Impacto material a evaluar por el Consejo",
  };

  it("usa la clave snake_case source_id (no sourceId) que lee el intake", () => {
    const search = buildMeetingHandoffSearch(ctx);
    expect(search).toContain("source_id=incident-123");
    expect(search).not.toContain("sourceId=");
  });

  it("round-trip: build → parse → read preserva todos los campos", () => {
    const search = buildMeetingHandoffSearch(ctx);
    const sp = new URLSearchParams(search);
    const read = readMeetingHandoff((k) => sp.get(k));

    expect(read.source).toBe("grc");
    expect(read.event).toBe("GRC_INCIDENT_MATERIAL");
    expect(read.sourceId).toBe("incident-123");
    expect(read.organ).toBe("CDA");
    expect(read.matter).toBe("Revisión del incidente material");
    expect(read.rationale).toBe("Impacto material a evaluar por el Consejo");
    expect(read.isCrossModule).toBe(true);
  });

  it("buildMeetingHandoffPath apunta al intake de Secretaría", () => {
    const path = buildMeetingHandoffPath(ctx);
    expect(path.startsWith(`${MEETING_INTAKE_PATH}?`)).toBe(true);
  });

  it("readMeetingHandoff acepta los alias handoff y ai_incident", () => {
    const sp = new URLSearchParams("source=aims&handoff=AIMS_SYSTEM_CONFORMITY&ai_incident=sys-9");
    const read = readMeetingHandoff((k) => sp.get(k));
    expect(read.event).toBe("AIMS_SYSTEM_CONFORMITY");
    expect(read.sourceId).toBe("sys-9");
    expect(read.isCrossModule).toBe(true);
  });

  it("omite claves vacías y marca isCrossModule=false para origen secretaría", () => {
    const search = buildMeetingHandoffSearch({ source: "secretaria", event: "INTERNAL" });
    expect(search).not.toContain("source_id");
    expect(search).not.toContain("organ");
    const sp = new URLSearchParams(search);
    const read = readMeetingHandoff((k) => sp.get(k));
    expect(read.isCrossModule).toBe(false);
    expect(read.organ).toBeNull();
  });

  it("preserva caracteres especiales (acentos, espacios) en matter/rationale", () => {
    const search = buildMeetingHandoffSearch(ctx);
    const sp = new URLSearchParams(search);
    const read = readMeetingHandoff((k) => sp.get(k));
    expect(read.matter).toBe(ctx.matter);
    expect(read.rationale).toBe(ctx.rationale);
  });
});
