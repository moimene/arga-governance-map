// Fija el defecto medido el 2026-09-06 sobre la reunión canónica `ac961a00`:
// resoluciones ADOPTED con sus acuerdos vinculados, cero votos y cero
// snapshots. La pantalla la daba por terminada y escondía el único control que
// podía regenerar los snapshots, mientras el servidor rechazaba cerrar el acta.
import { describe, expect, it } from "vitest";
import type { MeetingAdoptionSnapshot } from "@/lib/rules-engine/meeting-adoption-snapshot";
import {
  haySnapshotCertificable,
  puedeRecalcularResoluciones,
} from "../meeting-resolution-recalc";

const snap = (ok: boolean, status: string) =>
  ({ societary_validity: { ok }, status_resolucion: status } as unknown as MeetingAdoptionSnapshot);

const adoptadaConAcuerdo = { agreement_id: "a1", status: "ADOPTED" } as const;

describe("puedeRecalcularResoluciones", () => {
  it("EL DEFECTO: con resoluciones completas pero CERO snapshots, sigue habiendo que recalcular", () => {
    expect(
      puedeRecalcularResoluciones({ resoluciones: [adoptadaConAcuerdo], snapshots: [] }),
    ).toBe(true);
    // `undefined` es el mismo caso: quorum_data sin la clave.
    expect(
      puedeRecalcularResoluciones({ resoluciones: [adoptadaConAcuerdo], snapshots: undefined }),
    ).toBe(true);
  });

  it("con un snapshot certificable y todo vinculado y adoptado, el paso está terminado", () => {
    expect(
      puedeRecalcularResoluciones({
        resoluciones: [adoptadaConAcuerdo],
        snapshots: [snap(true, "ADOPTED")],
      }),
    ).toBe(false);
  });

  it("un snapshot no certificable no cierra el paso", () => {
    expect(
      puedeRecalcularResoluciones({
        resoluciones: [adoptadaConAcuerdo],
        snapshots: [snap(false, "ADOPTED")],
      }),
    ).toBe(true);
    expect(
      puedeRecalcularResoluciones({
        resoluciones: [adoptadaConAcuerdo],
        snapshots: [snap(true, "REJECTED")],
      }),
    ).toBe(true);
  });

  it("sin acuerdo vinculado, o con alguna no adoptada, también hay que recalcular", () => {
    expect(
      puedeRecalcularResoluciones({
        resoluciones: [{ agreement_id: null, status: "ADOPTED" }],
        snapshots: [snap(true, "ADOPTED")],
      }),
    ).toBe(true);
    expect(
      puedeRecalcularResoluciones({
        resoluciones: [adoptadaConAcuerdo, { agreement_id: "a2", status: "REJECTED" }],
        snapshots: [snap(true, "ADOPTED")],
      }),
    ).toBe(true);
  });

  it("sin resoluciones no hay nada que recalcular: el paso aún no ha ocurrido", () => {
    expect(puedeRecalcularResoluciones({ resoluciones: [], snapshots: [] })).toBe(false);
  });

  it("haySnapshotCertificable exige AMBAS condiciones", () => {
    expect(haySnapshotCertificable([snap(true, "ADOPTED")])).toBe(true);
    expect(haySnapshotCertificable([snap(true, "REJECTED"), snap(false, "ADOPTED")])).toBe(false);
    expect(haySnapshotCertificable([])).toBe(false);
  });
});
