import { describe, it, expect } from "bun:test";
import { mapEtapasACumplimiento } from "@/hooks/useAgreementCompliance";
import type { EtapaEvaluacion } from "@/lib/rules-engine";

const e = (etapa: EtapaEvaluacion, ok: boolean) => ({ etapa, ok });

describe("mapEtapasACumplimiento — los tres ✓ de la ficha del acuerdo", () => {
  it("lee las etapas tal y como las emiten los motores: en MAYUSCULA", () => {
    // Este es el defecto que vivio meses: el mapeo comparaba en minuscula.
    const r = mapEtapasACumplimiento([
      e("CONVOCATORIA", true), e("CONSTITUCION", true), e("VOTACION", true),
    ]);
    expect(r).toEqual({ convocatoria: true, constitucion: true, votacion: true });
  });

  it("una etapa que dice BLOCKING no se pinta como cumplida", () => {
    const r = mapEtapasACumplimiento([
      e("CONVOCATORIA", true), e("CONSTITUCION", false), e("VOTACION", true),
    ]);
    expect(r.constitucion).toBe(false);
  });

  it("una etapa AUSENTE es false, no true", () => {
    // El caso real de la Junta de Garrigues: constitucion en BLOCKING corta el
    // orquestador, la votacion no llega a correr, y la ficha coronaba con
    // «Mayoria ✓» sobre una sesion sin un solo voto registrado.
    const r = mapEtapasACumplimiento([e("CONVOCATORIA", true)]);
    expect(r).toEqual({ convocatoria: true, constitucion: false, votacion: false });
    expect(mapEtapasACumplimiento([])).toEqual({
      convocatoria: false, constitucion: false, votacion: false,
    });
  });

  it("las etapas *_skip SI cuentan: son «no requerida», no «no comprobada»", () => {
    // El orquestador las emite con ok:true en unipersonal y junta universal.
    const r = mapEtapasACumplimiento([
      e("convocatoria_skip", true), e("constitucion_skip", true), e("VOTACION", true),
    ]);
    expect(r).toEqual({ convocatoria: true, constitucion: true, votacion: true });
  });

  it("no confunde etapas: `documentacion` y `agenda_item` no cuentan por ninguna", () => {
    const r = mapEtapasACumplimiento([e("documentacion", true), e("agenda_item", true)]);
    expect(r).toEqual({ convocatoria: false, constitucion: false, votacion: false });
  });
});
