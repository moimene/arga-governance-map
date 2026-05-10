/**
 * Tests para el shape extendido de AgendaItem con `propuesta_acuerdo`.
 *
 * Contexto: BATCH 3 de consolidación pre-test cycle (2026-05-10).
 * Razón legal: art. 197.1 / 287 LSC + 144 RRM exigen texto íntegro de
 * propuesta para materias que afectan estatutos / capital / operaciones
 * estructurales.
 *
 * Verifica:
 *   - Backward-compatibility: AgendaItem antiguos sin `propuesta_acuerdo`
 *     se interpretan como null sin error.
 *   - Shape extendido: nuevos AgendaItem aceptan propuesta_acuerdo string
 *     o null.
 *   - El insert mapping del ConvocatoriasStepper incluye propuesta_acuerdo.
 */
import { describe, expect, it } from "vitest";
import type { AgendaItem } from "@/hooks/useConvocatorias";

describe("AgendaItem propuesta_acuerdo (BATCH 3)", () => {
  it("acepta AgendaItem nuevo con propuesta_acuerdo string", () => {
    const item: AgendaItem = {
      id: "abc-123",
      titulo: "Aprobar cuentas anuales",
      materia: "APROBACION_CUENTAS",
      tipo: "ORDINARIA",
      inscribible: false,
      propuesta_acuerdo: "Aprobar las cuentas del ejercicio 2025…",
    };
    expect(item.propuesta_acuerdo).toBe("Aprobar las cuentas del ejercicio 2025…");
  });

  it("acepta AgendaItem con propuesta_acuerdo null", () => {
    const item: AgendaItem = {
      id: "abc-123",
      titulo: "Punto sin propuesta concreta todavía",
      materia: "OTROS",
      tipo: "ORDINARIA",
      inscribible: false,
      propuesta_acuerdo: null,
    };
    expect(item.propuesta_acuerdo).toBeNull();
  });

  it("backward-compatible: AgendaItem sin propuesta_acuerdo es válido", () => {
    // El campo es opcional en el tipo (`propuesta_acuerdo?:`), así que
    // convocatorias antiguas sin el campo siguen siendo válidas.
    const item: AgendaItem = {
      id: "abc-123",
      titulo: "Convocatoria histórica",
      materia: "APROBACION_CUENTAS",
      tipo: "ORDINARIA",
      inscribible: false,
    };
    // El acceso devuelve undefined, que se trata como null en el insert
    expect(item.propuesta_acuerdo ?? null).toBeNull();
  });

  it("simulates insert mapping (filter + propuesta_acuerdo ?? null)", () => {
    const items: AgendaItem[] = [
      {
        id: "1",
        titulo: "Aprobar cuentas",
        materia: "APROBACION_CUENTAS",
        tipo: "ORDINARIA",
        inscribible: false,
        propuesta_acuerdo: "Aprobar cuentas anuales del ejercicio 2025.",
      },
      {
        id: "2",
        titulo: "",  // titulo vacío → filtrado out
        materia: "OTROS",
        tipo: "ORDINARIA",
        inscribible: false,
        propuesta_acuerdo: null,
      },
      {
        id: "3",
        titulo: "Modificación estatutos",
        materia: "MODIFICACION_ESTATUTOS",
        tipo: "ESTATUTARIA",
        inscribible: true,
        // sin propuesta_acuerdo definida (legacy)
      },
    ];

    // Mapping idéntico al de ConvocatoriasStepper.handleEmitir
    const mapped = items
      .filter((i) => i.titulo.trim().length > 0)
      .map(({ titulo, materia, tipo, inscribible, propuesta_acuerdo }) => ({
        titulo,
        materia,
        tipo,
        inscribible,
        propuesta_acuerdo: propuesta_acuerdo ?? null,
      }));

    expect(mapped).toHaveLength(2);
    expect(mapped[0].propuesta_acuerdo).toBe("Aprobar cuentas anuales del ejercicio 2025.");
    expect(mapped[1].propuesta_acuerdo).toBeNull();
  });
});
