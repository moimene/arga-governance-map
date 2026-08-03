import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const hook = readFileSync(
  resolve(process.cwd(), "src/hooks/useReunionSecretaria.ts"),
  "utf8",
);
const communicationStep = readFileSync(
  resolve(
    process.cwd(),
    "src/components/secretaria/comunicaciones/PasoEnvioMiembros.tsx",
  ),
  "utf8",
);

describe("Secretaría UI — fronteras atómicas de convocatoria", () => {
  it("no divide la creación de reunión y agenda en dos escrituras cliente", () => {
    const start = hook.indexOf("export function useCreateMeetingFromConvocatoria");
    const end = hook.indexOf("export type CreateUniversalMeetingInput", start);
    const create = hook.slice(start, end);
    expect(create).toContain(
      '"fn_secretaria_create_or_reuse_meeting_from_convocation"',
    );
    expect(create).toContain("p_convocatoria_id: convocatoria.id");
    expect(create).not.toContain('fn_secretaria_materialize_convocation_agenda');
    expect(create).not.toContain('.from("meetings")');
    expect(create).not.toContain('.from("agenda_items")');
    expect(create).not.toContain("buildMeetingScheduleFromConvocatoria");
  });

  it("el lookup legacy tampoco confunde reuniones del mismo día a otra hora", () => {
    expect(hook).toContain("sameTimestamp(meeting.scheduled_start, convocatoria.fecha_1)");
    expect(hook).toContain('.eq("scheduled_start", convocatoria.fecha_1)');
  });

  it("envía la intención EAD sandbox explícita para que el servidor la valide", () => {
    expect(communicationStep).toContain("sandbox_only: sandboxDraft");
    expect(communicationStep).toContain("delivery_disabled: sandboxDraft");
    expect(communicationStep).toContain("mode: EAD_INTERPOSITION_CHANNEL");
    expect(communicationStep).toContain(
      "policy_scope: ['BASIC_MESSAGING', 'CUSTODY', 'EARCHIVING']",
    );
    expect(communicationStep).toContain("environment: sandboxDraft ? 'SANDBOX' : 'UNAVAILABLE'");
    expect(communicationStep).toContain("delivery_allowed: false");
    expect(communicationStep).toContain("provider_interaction: false");
    expect(communicationStep).toContain("signature_claim: false");
    expect(communicationStep).toContain("erds_claim: false");
  });

  it("no despierta el dispatcher en sandbox ni solicita PROGRAMADA", () => {
    expect(communicationStep).toContain(
      "const requestedState = sandboxDraft ? 'BORRADOR' : 'PROGRAMADA'",
    );
    expect(communicationStep).toContain(
      "fecha_programada: sandboxDraft ? null : fechaProgramada.toISOString()",
    );
    expect(communicationStep).toContain("if (!sandboxDraft) {");
    expect(communicationStep).toContain("await triggerDispatcher()");
  });
});
