import { describe, expect, it } from "vitest";
import {
  buildCapitalTransmissionPlan,
  type CapitalTransmissionSourceHolding,
} from "../capital-transmission-contract";

const sourceHolding: CapitalTransmissionSourceHolding = {
  id: "holding-1",
  tenant_id: "tenant-1",
  entity_id: "entity-1",
  holder_person_id: "person-origin",
  share_class_id: "class-ordinary",
  numero_titulos: 1000,
  porcentaje_capital: 69.69,
  voting_rights: true,
  is_treasury: false,
};

describe("capital transmission contract", () => {
  it("planifica cierre, remanente y destino conservando titulos y porcentaje", () => {
    const plan = buildCapitalTransmissionPlan({
      sourceHolding,
      destinationPersonId: "person-destination",
      titlesToTransfer: 300,
      effectiveFrom: "2026-05-04",
      motivo: "compraventa",
    });

    expect(plan.ok).toBe(true);
    expect(plan.closeSource).toEqual({ id: "holding-1", effective_to: "2026-05-04" });
    expect(plan.remnantInsert).toMatchObject({
      holder_person_id: "person-origin",
      numero_titulos: 700,
      porcentaje_capital: 48.783,
      is_treasury: false,
    });
    expect(plan.destinationInsert).toMatchObject({
      holder_person_id: "person-destination",
      numero_titulos: 300,
      porcentaje_capital: 20.907,
      is_treasury: false,
      metadata: {
        motivo: "compraventa",
        origen_holding_id: "holding-1",
      },
    });
    expect(
      (plan.remnantInsert?.numero_titulos ?? 0) + (plan.destinationInsert?.numero_titulos ?? 0),
    ).toBe(sourceHolding.numero_titulos);
    expect(
      (plan.remnantInsert?.porcentaje_capital ?? 0) + (plan.destinationInsert?.porcentaje_capital ?? 0),
    ).toBeCloseTo(sourceHolding.porcentaje_capital ?? 0, 6);
  });

  it("no crea remanente cuando se transmite toda la posicion", () => {
    const plan = buildCapitalTransmissionPlan({
      sourceHolding,
      destinationPersonId: "person-destination",
      titlesToTransfer: 1000,
      effectiveFrom: "2026-05-04",
    });

    expect(plan.ok).toBe(true);
    expect(plan.remnantInsert).toBeUndefined();
    expect(plan.destinationInsert).toMatchObject({
      numero_titulos: 1000,
      porcentaje_capital: 69.69,
      metadata: {
        motivo: "transmision_inter_vivos",
        origen_holding_id: "holding-1",
      },
    });
  });

  it("bloquea autocartera, sobretransmision y adquirente igual al transmitente", () => {
    const plan = buildCapitalTransmissionPlan({
      sourceHolding: { ...sourceHolding, is_treasury: true },
      destinationPersonId: "person-origin",
      titlesToTransfer: 1001,
      effectiveFrom: "",
    });

    expect(plan.ok).toBe(false);
    expect(plan.blockers).toEqual([
      "source_holding_is_treasury",
      "destination_must_differ_from_source_holder",
      "titles_to_transfer_exceed_source",
      "effective_from_required",
    ]);
  });
});
