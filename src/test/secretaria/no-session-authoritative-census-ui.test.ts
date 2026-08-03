import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const stepper = readFileSync(
  join(process.cwd(), "src/pages/secretaria/AcuerdoSinSesionStepper.tsx"),
  "utf8",
);
const detail = readFileSync(
  join(process.cwd(), "src/pages/secretaria/AcuerdoSinSesionDetalle.tsx"),
  "utf8",
);
const hook = readFileSync(
  join(process.cwd(), "src/hooks/useAcuerdosSinSesion.ts"),
  "utf8",
);

describe("acuerdo sin sesión · censo autoritativo", () => {
  it("reutiliza el clasificador en apertura y comunicación", () => {
    expect(stepper).toContain("authoritativeNoSessionRecipients");
    expect(detail).toContain("authoritativeNoSessionRecipients");
    expect(stepper).toContain("useNoSessionParticipants");
    expect(detail).toContain("useNoSessionParticipants");
  });

  it("no permite excluir arbitrariamente votantes", () => {
    expect(stepper).not.toContain("excludedPersonIds");
    expect(stepper).not.toContain("toggleExclude");
    expect(stepper).not.toContain('"Excluir"');
    expect(stepper).toContain("Censo autoritativo");
    expect(stepper).not.toContain("total_members: includedMembers.length");
    expect(hook).toContain('supabase.rpc("fn_create_no_session_resolution"');
  });

  it("reintenta la apertura con una clave estable y deja el censo al servidor", () => {
    expect(hook).toContain("open_idempotency_key: string");
    expect(hook).toContain("p_open_idempotency_key: input.open_idempotency_key");
    expect(stepper).toContain("const openingVotingIdempotencyKeyRef = useRef(crypto.randomUUID())");
    expect(stepper).toContain("open_idempotency_key: openingVotingIdempotencyKeyRef.current");
  });
});
