import { describe, it, expect } from "vitest";
import {
  computePlantillasMetrics,
  PlantillaProtegidaRow,
} from "@/lib/plantillas-metrics";

describe("plantillas-metrics", () => {
  // ============================================================================
  // Test 1: All templates ACTIVA → brechaDisponibilidad = 0, no brecha alert
  // ============================================================================
  it("All templates ACTIVA → brechaDisponibilidad=0, no alerts", () => {
    const baseDate = new Date("2026-04-01T00:00:00Z").toISOString();
    const plantillas: PlantillaProtegidaRow[] = [
      {
        id: "p1",
        tipo: "ACTA_SESION",
        adoption_mode: "MEETING",
        estado: "ACTIVA",
        created_at: baseDate,
      },
      {
        id: "p2",
        tipo: "CERTIFICACION",
        adoption_mode: "UNIVERSAL",
        estado: "ACTIVA",
        created_at: baseDate,
      },
      {
        id: "p3",
        tipo: "CONVOCATORIA",
        adoption_mode: "NO_SESSION",
        estado: "ACTIVA",
        created_at: baseDate,
      },
    ];

    const result = computePlantillasMetrics(plantillas);

    expect(result.leading.brechaDisponibilidad).toBe(0);
    expect(result.lagging.totalActivas).toBe(3);
    // Should NOT have brecha availability warning (since it's 0%)
    const brechaAlerts = result.alertas.filter((a) =>
      a.mensaje.includes("50%")
    );
    expect(brechaAlerts).toHaveLength(0);
  });

  // ============================================================================
  // Test 2: Template in BORRADOR for 31+ days → ERROR alert
  // ============================================================================
  it("Template in BORRADOR > 30 days → ERROR alert", () => {
    const now = new Date().toISOString();
    const thirtyTwoDaysAgo = new Date(
      Date.now() - 32 * 24 * 60 * 60 * 1000
    ).toISOString();

    const plantillas: PlantillaProtegidaRow[] = [
      {
        id: "old-draft",
        tipo: "ACTA_SESION",
        adoption_mode: "MEETING",
        estado: "BORRADOR",
        created_at: thirtyTwoDaysAgo,
      },
    ];

    const result = computePlantillasMetrics(plantillas);

    const errorAlerts = result.alertas.filter((a) => a.tipo === "ERROR");
    expect(errorAlerts.length).toBeGreaterThan(0);
    expect(errorAlerts[0].mensaje).toContain("borrador");
    expect(errorAlerts[0].plantilla_id).toBe("old-draft");
  });

  // ============================================================================
  // Test 3: coberturaModos < 80% → WARNING alert
  // ============================================================================
  it("coberturaModos < 80% → WARNING alert", () => {
    const baseDate = new Date("2026-04-01T00:00:00Z").toISOString();
    // Only MEETING and UNIVERSAL modes have ACTIVA templates
    // Missing: NO_SESSION, UNIPERSONAL_SOCIO, UNIPERSONAL_ADMIN
    // Coverage = 2/5 = 40%
    const plantillas: PlantillaProtegidaRow[] = [
      {
        id: "p1",
        tipo: "ACTA_SESION",
        adoption_mode: "MEETING",
        estado: "ACTIVA",
        created_at: baseDate,
      },
      {
        id: "p2",
        tipo: "CERTIFICACION",
        adoption_mode: "UNIVERSAL",
        estado: "ACTIVA",
        created_at: baseDate,
      },
      // Others not ACTIVA
      {
        id: "p3",
        tipo: "CONVOCATORIA",
        adoption_mode: "NO_SESSION",
        estado: "BORRADOR",
        created_at: baseDate,
      },
    ];

    const result = computePlantillasMetrics(plantillas);

    expect(result.leading.coberturaModos).toBe(2 / 5); // 40%
    const coberturAlert = result.alertas.find((a) =>
      a.mensaje.includes("Cobertura de modos")
    );
    expect(coberturAlert).toBeDefined();
    expect(coberturAlert?.tipo).toBe("WARNING");
  });

  // ============================================================================
  // Test 4: No templates → all zeros, brecha = 100%
  // ============================================================================
  it("No templates → zeros and 100% brecha", () => {
    const plantillas: PlantillaProtegidaRow[] = [];

    const result = computePlantillasMetrics(plantillas);

    expect(result.lagging.totalActivas).toBe(0);
    expect(result.lagging.totalBorradores).toBe(0);
    expect(result.lagging.totalAprobadas).toBe(0);
    expect(result.leading.velocidadRedaccion).toBe(0);
    expect(result.leading.brechaDisponibilidad).toBe(1.0); // 100%
  });

  // ============================================================================
  // Test 5: Mixed statuses → correct counts and cobertura
  // ============================================================================
  it("Mixed statuses → correct lagging metrics and coverage", () => {
    const baseDate = new Date("2026-04-01T00:00:00Z").toISOString();
    const plantillas: PlantillaProtegidaRow[] = [
      {
        id: "p1",
        tipo: "ACTA_SESION",
        adoption_mode: "MEETING",
        estado: "ACTIVA",
        created_at: baseDate,
      },
      {
        id: "p2",
        tipo: "CERTIFICACION",
        adoption_mode: "UNIVERSAL",
        estado: "APROBADA",
        created_at: baseDate,
      },
      {
        id: "p3",
        tipo: "CONVOCATORIA",
        adoption_mode: "NO_SESSION",
        estado: "BORRADOR",
        created_at: baseDate,
      },
      {
        id: "p4",
        tipo: "ACTA_ACUERDO_ESCRITO",
        adoption_mode: "UNIPERSONAL_SOCIO",
        estado: "BORRADOR",
        created_at: baseDate,
      },
    ];

    const result = computePlantillasMetrics(plantillas);

    expect(result.lagging.totalActivas).toBe(1);
    expect(result.lagging.totalAprobadas).toBe(1);
    expect(result.lagging.totalBorradores).toBe(2);
    expect(result.leading.brechaDisponibilidad).toBe(3 / 4); // 75% not active
    // Coverage is 1/5: only MEETING has ACTIVA template
    // (UNIVERSAL is APROBADA, NO_SESSION and UNIPERSONAL_SOCIO are BORRADOR, UNIPERSONAL_ADMIN missing)
    expect(result.leading.coberturaModos).toBe(1 / 5);
  });

  // ============================================================================
  // Test 6: velocidadRedaccion computed correctly from dates
  // ============================================================================
  it("velocidadRedaccion = avg days from created_at to fecha_aprobacion", () => {
    const baseDate = new Date("2026-03-22T00:00:00Z").toISOString(); // March 22
    const aprDate = new Date("2026-04-01T00:00:00Z").toISOString(); // April 1 (10 days later)
    const aprDate2 = new Date("2026-04-11T00:00:00Z").toISOString(); // April 11 (20 days later)

    const plantillas: PlantillaProtegidaRow[] = [
      {
        id: "p1",
        tipo: "ACTA_SESION",
        adoption_mode: "MEETING",
        estado: "APROBADA",
        created_at: baseDate,
        fecha_aprobacion: aprDate,
      },
      {
        id: "p2",
        tipo: "CERTIFICACION",
        adoption_mode: "UNIVERSAL",
        estado: "ACTIVA",
        created_at: baseDate,
        fecha_aprobacion: aprDate2,
      },
    ];

    const result = computePlantillasMetrics(plantillas);

    // Average of (10 + 20) / 2 = 15 days
    expect(result.leading.velocidadRedaccion).toBe(15);
  });

  // ============================================================================
  // Test 7: ratioRetroceso always 0 (placeholder)
  // ============================================================================
  it("ratioRetroceso is always 0 (hardcoded)", () => {
    const baseDate = new Date("2026-04-01T00:00:00Z").toISOString();
    const plantillas: PlantillaProtegidaRow[] = [
      {
        id: "p1",
        tipo: "ACTA_SESION",
        adoption_mode: "MEETING",
        estado: "ACTIVA",
        created_at: baseDate,
      },
    ];

    const result = computePlantillasMetrics(plantillas);

    expect(result.leading.ratioRetroceso).toBe(0);
  });

  // ============================================================================
  // Test 8: tiempoEnEstado computed per template
  // ============================================================================
  it("tiempoEnEstado computed for each template", () => {
    // Use run-relative dates — the metric function computes `Date.now() -
    // created_at`, so hardcoded ISO strings drift into flakiness as the
    // calendar advances past the hardcoded "today".
    const baseDate = new Date().toISOString(); // Today, whenever the test runs
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

    const plantillas: PlantillaProtegidaRow[] = [
      {
        id: "p1",
        tipo: "ACTA_SESION",
        adoption_mode: "MEETING",
        estado: "ACTIVA",
        created_at: baseDate,
      },
      {
        id: "p2",
        tipo: "CERTIFICACION",
        adoption_mode: "UNIVERSAL",
        estado: "BORRADOR",
        created_at: fiveDaysAgo,
      },
    ];

    const result = computePlantillasMetrics(plantillas);

    // p1 was created today → should be a small positive number (depends on when test runs)
    expect(result.leading.tiempoEnEstado["p1"]).toBeGreaterThanOrEqual(0);
    // p2 was created 5 days ago → ~5 days (allow ±2 days for rounding/time drift)
    expect(result.leading.tiempoEnEstado["p2"]).toBeLessThanOrEqual(7);
    expect(result.leading.tiempoEnEstado["p2"]).toBeGreaterThanOrEqual(4);
  });

  // ============================================================================
  // Test 9: All adoption modes covered → 100% cobertura
  // ============================================================================
  it("All 5 adoption modes with ACTIVA → coberturaModos = 100%", () => {
    const baseDate = new Date("2026-04-01T00:00:00Z").toISOString();
    const plantillas: PlantillaProtegidaRow[] = [
      {
        id: "p1",
        tipo: "ACTA_SESION",
        adoption_mode: "MEETING",
        estado: "ACTIVA",
        created_at: baseDate,
      },
      {
        id: "p2",
        tipo: "CERTIFICACION",
        adoption_mode: "UNIVERSAL",
        estado: "ACTIVA",
        created_at: baseDate,
      },
      {
        id: "p3",
        tipo: "CONVOCATORIA",
        adoption_mode: "NO_SESSION",
        estado: "ACTIVA",
        created_at: baseDate,
      },
      {
        id: "p4",
        tipo: "ACTA_CONSIGNACION",
        adoption_mode: "UNIPERSONAL_SOCIO",
        estado: "ACTIVA",
        created_at: baseDate,
      },
      {
        id: "p5",
        tipo: "ACTA_ACUERDO_ESCRITO",
        adoption_mode: "UNIPERSONAL_ADMIN",
        estado: "ACTIVA",
        created_at: baseDate,
      },
    ];

    const result = computePlantillasMetrics(plantillas);

    expect(result.leading.coberturaModos).toBe(1.0); // 100%
    // Should NOT have coverage warning
    const coberturAlert = result.alertas.find((a) =>
      a.mensaje.includes("Cobertura de modos")
    );
    expect(coberturAlert).toBeUndefined();
  });

  // ============================================================================
  // Test 9b: Modos extra (CO_APROBACION/SOLIDARIO) no inflan la cobertura
  // ============================================================================
  it("5 modos core + CO_APROBACION + SOLIDARIO en ACTIVA → coberturaModos = 100% (no 140%)", () => {
    const baseDate = new Date("2026-04-01T00:00:00Z").toISOString();
    const modes = [
      "MEETING",
      "UNIVERSAL",
      "NO_SESSION",
      "UNIPERSONAL_SOCIO",
      "UNIPERSONAL_ADMIN",
      "CO_APROBACION",
      "SOLIDARIO",
    ];
    const plantillas: PlantillaProtegidaRow[] = modes.map((mode, i) => ({
      id: `p${i + 1}`,
      tipo: "MODELO_ACUERDO",
      adoption_mode: mode,
      estado: "ACTIVA",
      created_at: baseDate,
    }));

    const result = computePlantillasMetrics(plantillas);

    // El numerador se intersecta con el universo de 5 modos core: 5/5, no 7/5
    expect(result.leading.coberturaModos).toBe(1.0);
    const coberturAlert = result.alertas.find((a) =>
      a.mensaje.includes("Cobertura de modos")
    );
    expect(coberturAlert).toBeUndefined();
  });

  // ============================================================================
  // Test 9c: Caso Cloud actual — 6 modos ACTIVA sin UNIVERSAL → 80% + alerta
  // ============================================================================
  it("Caso Cloud: 6 modos ACTIVA sin UNIVERSAL → coberturaModos = 80% y WARNING dispara", () => {
    const baseDate = new Date("2026-04-01T00:00:00Z").toISOString();
    // Estado real de Cloud: MEETING, NO_SESSION, UNIPERSONAL_SOCIO,
    // UNIPERSONAL_ADMIN, CO_APROBACION, SOLIDARIO — falta UNIVERSAL.
    // Sin intersección el bug daba 6/5 = 120% y silenciaba la alerta <80%.
    const modes = [
      "MEETING",
      "NO_SESSION",
      "UNIPERSONAL_SOCIO",
      "UNIPERSONAL_ADMIN",
      "CO_APROBACION",
      "SOLIDARIO",
    ];
    const plantillas: PlantillaProtegidaRow[] = modes.map((mode, i) => ({
      id: `p${i + 1}`,
      tipo: "MODELO_ACUERDO",
      adoption_mode: mode,
      estado: "ACTIVA",
      created_at: baseDate,
    }));

    const result = computePlantillasMetrics(plantillas);

    // 4 de los 5 modos core cubiertos (falta UNIVERSAL) = 80%
    expect(result.leading.coberturaModos).toBe(4 / 5);
    // La alerta dispara en cuanto falta CUALQUIER modo core, nombrándolo
    // (el umbral <80% anterior dejaba el gap de UNIVERSAL sin señal).
    const coberturAlertAt80 = result.alertas.find((a) =>
      a.mensaje.includes("Cobertura de modos")
    );
    expect(coberturAlertAt80).toBeDefined();
    expect(coberturAlertAt80?.tipo).toBe("WARNING");
    expect(coberturAlertAt80?.mensaje).toContain("80%");
    expect(coberturAlertAt80?.mensaje).toContain("junta universal");

    // Al perder un modo core más (quitamos MEETING), cae a 60% y los nombra a ambos
    const sinMeeting = plantillas.filter((p) => p.adoption_mode !== "MEETING");
    const result2 = computePlantillasMetrics(sinMeeting);
    expect(result2.leading.coberturaModos).toBe(3 / 5);
    const coberturAlert = result2.alertas.find((a) =>
      a.mensaje.includes("Cobertura de modos")
    );
    expect(coberturAlert).toBeDefined();
    expect(coberturAlert?.tipo).toBe("WARNING");
    expect(coberturAlert?.mensaje).toContain("60%");
    expect(coberturAlert?.mensaje).toContain("sesión formal");
    expect(coberturAlert?.mensaje).toContain("junta universal");
  });

  // ============================================================================
  // Test 10: Template with null adoption_mode doesn't break coverage calc
  // ============================================================================
  it("Template with null adoption_mode handled gracefully", () => {
    const baseDate = new Date("2026-04-01T00:00:00Z").toISOString();
    const plantillas: PlantillaProtegidaRow[] = [
      {
        id: "p1",
        tipo: "ACTA_SESION",
        adoption_mode: "MEETING",
        estado: "ACTIVA",
        created_at: baseDate,
      },
      {
        id: "p2",
        tipo: "CERTIFICACION",
        adoption_mode: null,
        estado: "ACTIVA",
        created_at: baseDate,
      },
    ];

    const result = computePlantillasMetrics(plantillas);

    // Should not throw, coverage is 1/5 (only MEETING)
    expect(result.leading.coberturaModos).toBe(1 / 5);
    expect(result.alertas.length).toBeGreaterThan(0);
  });

  // ============================================================================
  // Test 11: Brecha > 50% triggers WARNING
  // ============================================================================
  it("Brecha > 50% → WARNING alert", () => {
    const baseDate = new Date("2026-04-01T00:00:00Z").toISOString();
    // 1 ACTIVA, 3 not ACTIVA = 75% brecha > 50%
    const plantillas: PlantillaProtegidaRow[] = [
      {
        id: "p1",
        tipo: "ACTA_SESION",
        adoption_mode: "MEETING",
        estado: "ACTIVA",
        created_at: baseDate,
      },
      {
        id: "p2",
        tipo: "CERTIFICACION",
        adoption_mode: "UNIVERSAL",
        estado: "BORRADOR",
        created_at: baseDate,
      },
      {
        id: "p3",
        tipo: "CONVOCATORIA",
        adoption_mode: "NO_SESSION",
        estado: "BORRADOR",
        created_at: baseDate,
      },
      {
        id: "p4",
        tipo: "ACTA_CONSIGNACION",
        adoption_mode: "UNIPERSONAL_SOCIO",
        estado: "BORRADOR",
        created_at: baseDate,
      },
    ];

    const result = computePlantillasMetrics(plantillas);

    expect(result.leading.brechaDisponibilidad).toBe(0.75);
    const brechaAlert = result.alertas.find((a) =>
      a.mensaje.includes("50%")
    );
    expect(brechaAlert?.tipo).toBe("WARNING");
  });

  // ============================================================================
  // Test 12: Multiple ERROR and WARNING alerts can coexist
  // ============================================================================
  it("Multiple alerts can coexist", () => {
    const baseDate = new Date("2026-04-01T00:00:00Z").toISOString();
    const thirtyTwoDaysAgo = new Date(
      Date.now() - 32 * 24 * 60 * 60 * 1000
    ).toISOString();

    const plantillas: PlantillaProtegidaRow[] = [
      {
        id: "p1",
        tipo: "ACTA_SESION",
        adoption_mode: "MEETING",
        estado: "BORRADOR",
        created_at: thirtyTwoDaysAgo, // 32 days → ERROR
      },
      {
        id: "p2",
        tipo: "CERTIFICACION",
        adoption_mode: "UNIVERSAL",
        estado: "BORRADOR",
        created_at: baseDate,
      },
      {
        id: "p3",
        tipo: "CONVOCATORIA",
        adoption_mode: null,
        estado: "BORRADOR",
        created_at: baseDate,
      },
    ];

    const result = computePlantillasMetrics(plantillas);

    // Should have:
    // 1. ERROR for p1 in BORRADOR > 30 days
    // 2. WARNING for coberturaModos < 80% (only 1 mode covered)
    // 3. WARNING for brecha > 50% (0 ACTIVA out of 3)
    expect(result.alertas.length).toBeGreaterThanOrEqual(2);
    const hasError = result.alertas.some((a) => a.tipo === "ERROR");
    const hasWarning = result.alertas.some((a) => a.tipo === "WARNING");
    expect(hasError).toBe(true);
    expect(hasWarning).toBe(true);
  });
});
