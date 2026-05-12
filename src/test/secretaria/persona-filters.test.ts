import { describe, it, expect } from "vitest";
import { isProductionPerson } from "@/lib/secretaria/persona-filters";

describe("persona-filters.isProductionPerson", () => {
  const baseRow = {
    id: "x",
    tenant_id: "t",
    person_type: "PF" as const,
    email: null,
    denomination: null,
    representative_person_id: null,
    created_at: null,
  };

  it("accepts real persons", () => {
    expect(
      isProductionPerson({
        ...baseRow,
        full_name: "Lucía Martín",
        tax_id: "12345678A",
      }),
    ).toBe(true);
    expect(
      isProductionPerson({
        ...baseRow,
        full_name: "Cartera ARGA S.L.U.",
        tax_id: "B-99999902",
        person_type: "PJ",
      }),
    ).toBe(true);
  });

  it("rejects [E2E REAL] prefix names", () => {
    expect(
      isProductionPerson({
        ...baseRow,
        full_name: "[E2E REAL] Adquirente test",
        tax_id: "E2E-B-8-test",
      }),
    ).toBe(false);
  });

  it("rejects E2E- tax_id", () => {
    expect(
      isProductionPerson({
        ...baseRow,
        full_name: "Some name",
        tax_id: "E2E-12345",
      }),
    ).toBe(false);
  });

  it("rejects PENDIENTE- tax_id", () => {
    expect(
      isProductionPerson({
        ...baseRow,
        full_name: "Pending entity",
        tax_id: "PENDIENTE-abc-123",
      }),
    ).toBe(false);
  });

  it("rejects PRUEBA/test names", () => {
    expect(
      isProductionPerson({
        ...baseRow,
        full_name: "PRUEBA 1",
        tax_id: "B88888888",
      }),
    ).toBe(false);
    expect(
      isProductionPerson({
        ...baseRow,
        full_name: "PEDRO PRUEBA PRUEBA",
        tax_id: "1111111111-A",
      }),
    ).toBe(false);
  });

  it("rejects ARCHIVED- tax_id (soft-archived duplicates)", () => {
    expect(
      isProductionPerson({
        ...baseRow,
        full_name: "[ARCHIVED] Cartera ARGA dup",
        tax_id: "ARCHIVED-12345-B-99999902",
      }),
    ).toBe(false);
  });
});
