import { describe, expect, it } from "vitest";
import { mergeAuthoritativeAdoptionSnapshots } from "@/hooks/useActas";
import type { MeetingAdoptionSnapshot } from "@/lib/rules-engine";

/**
 * El acta lee el resultado de la votación del espejo cliente
 * `meetings.quorum_data.point_snapshots`. La copia autoritativa la escribe la
 * RPC `fn_save_meeting_resolutions` en `agreements.compliance_snapshot`. Si el
 * espejo se pierde, el acta se bloquea aunque el servidor tenga la votación
 * documentada, y la RPC no puede reejecutarse (su DELETE choca con el WORM de
 * `rule_evaluation_results`).
 */
function snapshot(index: number, overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "meeting-adoption-snapshot.v2",
    agenda_item_index: index,
    resolution_text: `Texto resolutivo del punto ${index}`,
    materia: "APROBACION_CUENTAS",
    materia_clase: "ORDINARIA",
    status_resolucion: "ADOPTED",
    vote_summary: { favor: 15, contra: 0, abstenciones: 0 },
    societary_validity: { ok: true, blocking_issues: [], warnings: [] },
    pacto_compliance: { ok: true, blocking_issues: [], warnings: [] },
    ...overrides,
  } as unknown as MeetingAdoptionSnapshot;
}

describe("recuperación del snapshot de adopción desde la fuente autoritativa", () => {
  it("completa los puntos que el espejo perdió con el snapshot del acuerdo", () => {
    const merged = mergeAuthoritativeAdoptionSnapshots(
      [],
      [
        { id: "a-3", compliance_snapshot: snapshot(3) },
        { id: "a-4", compliance_snapshot: snapshot(4) },
      ],
    );

    expect(merged.map((item) => item.agenda_item_index)).toEqual([3, 4]);
    expect(merged[0].status_resolucion).toBe("ADOPTED");
  });

  it("el espejo manda: un punto que ya trae snapshot no se sustituye ni se duplica", () => {
    const espejo = snapshot(3, { status_resolucion: "REJECTED" });
    const merged = mergeAuthoritativeAdoptionSnapshots(
      [espejo],
      [{ id: "a-3", compliance_snapshot: snapshot(3) }],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]).toBe(espejo);
  });

  it("no cuela como votación un compliance_snapshot de otra procedencia", () => {
    // Los acuerdos sembrados llevan `agreement-compliance-snapshot.seed.v1`, sin
    // vote_summary ni validez societaria: no son un resultado de votación y no
    // pueden desbloquear un acta.
    const merged = mergeAuthoritativeAdoptionSnapshots(
      [],
      [
        { id: "a-seed", compliance_snapshot: { schema_version: "agreement-compliance-snapshot.seed.v1", ok: true } },
        { id: "a-null", compliance_snapshot: null },
        { id: "a-sin-votos", compliance_snapshot: snapshot(9, { vote_summary: undefined }) },
        { id: "a-estado-raro", compliance_snapshot: snapshot(10, { status_resolucion: "PENDING" }) },
      ],
    );

    expect(merged).toEqual([]);
  });

  it("dos acuerdos del mismo punto no producen dos resultados de votación", () => {
    const merged = mergeAuthoritativeAdoptionSnapshots(
      [],
      [
        { id: "a-3", compliance_snapshot: snapshot(3) },
        { id: "a-3-bis", compliance_snapshot: snapshot(3, { status_resolucion: "REJECTED" }) },
      ],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].status_resolucion).toBe("ADOPTED");
  });
});
