import { describe, expect, it } from "vitest";
import {
  buildNoSessionIdempotencyKey,
  extractNoSessionResolutionId,
  planNoSessionAgreementIdempotency,
  type NoSessionResolutionSource,
} from "../no-session-idempotency-contract";

const source: NoSessionResolutionSource = {
  id: "resolution-1",
  tenant_id: "tenant-1",
  entity_id: "entity-1",
  body_id: "body-1",
  status: "APROBADO",
  resultado: "APROBADO",
  materia: "AUMENTO_CAPITAL",
};

describe("no-session idempotency contract", () => {
  it("construye una clave estable por tenant, sociedad y resolucion sin sesion", () => {
    expect(buildNoSessionIdempotencyKey(source)).toBe(
      "no-session-idempotency.v1:tenant-1:entity-1:no_session_resolutions:resolution-1",
    );
  });

  it("reusa el agreement existente cuando execution_mode apunta a la misma fuente", () => {
    const plan = planNoSessionAgreementIdempotency({
      source,
      existingAgreements: [
        {
          id: "agreement-1",
          tenant_id: "tenant-1",
          entity_id: "entity-1",
          adoption_mode: "NO_SESSION",
          execution_mode: {
            mode: "NO_SESSION",
            source: "no_session_resolutions",
            source_id: "resolution-1",
          },
        },
      ],
    });

    expect(plan).toMatchObject({
      action: "REUSE",
      agreementId: "agreement-1",
      reason: "existing_agreement_matches_no_session_source",
    });
  });

  it("extrae la resolucion desde execution_mode plano o agreement_360 anidado", () => {
    expect(extractNoSessionResolutionId({ source: "no_session_resolutions", source_id: "resolution-2" })).toBe(
      "resolution-2",
    );
    expect(
      extractNoSessionResolutionId({
        agreement_360: {
          origin: "NO_SESSION",
          no_session_resolution_id: "resolution-3",
        },
      }),
    ).toBe("resolution-3");
  });

  it("bloquea duplicados si mas de un agreement representa la misma resolucion", () => {
    const plan = planNoSessionAgreementIdempotency({
      source,
      existingAgreements: [
        { id: "agreement-1", execution_mode: { mode: "NO_SESSION", source_id: "resolution-1" } },
        { id: "agreement-2", execution_mode: { agreement_360: { origin: "NO_SESSION", source_id: "resolution-1" } } },
      ],
    });

    expect(plan.action).toBe("BLOCK");
    expect(plan.reason).toBe("multiple_agreements_for_same_no_session_source");
    expect(plan.warnings).toEqual(["duplicate_agreement:agreement-1", "duplicate_agreement:agreement-2"]);
  });

  it("crea solo cuando no existe agreement ni enlace previo y bloquea rechazados", () => {
    expect(planNoSessionAgreementIdempotency({ source }).action).toBe("CREATE");
    expect(
      planNoSessionAgreementIdempotency({
        source: { ...source, status: "RECHAZADO", resultado: "RECHAZADO" },
      }),
    ).toMatchObject({
      action: "BLOCK",
      reason: "rejected_no_session_resolution_cannot_materialize",
    });
  });
});
