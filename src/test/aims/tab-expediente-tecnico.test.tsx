// src/test/aims/tab-expediente-tecnico.test.tsx
//
// F1.T7 (GC-51) — la ARISTA del selector de estado del expediente técnico.
//
// Se retiró el cierre del expediente, pero el selector de cada sección seguía
// ofreciendo «Conforme» y «Cerrada» sin revisor: una retirada a medias. La hoja
// ya no los ofrece (`expediente-tecnico.test.ts`); aquí se comprueba que la
// pestaña USA esa lista, abriendo la edición de una sección como las que ARGA
// tiene sembradas en «Conforme» (medido el 2026-09-19: 4 de 5, sin revisor).
import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { mockRestaurable } from "@/test/garrigues/_mock-restaurable";
import type TipoExpediente from "@/components/ai-governance/sistema/TabExpedienteTecnico";

const base = {
  tenant_id: "00000000-0000-0000-0000-000000000001",
  system_id: "11111111-1111-1111-1111-111111111111",
  created_at: "2026-04-24T00:00:00Z",
  updated_at: "2026-04-24T00:00:00Z",
};
const CONFORME = {
  ...base, id: "sec-conforme", section_code: "AIV-03", title: "Seguimiento", status: "Conforme",
  reviewed_at: "2026-04-24T00:00:00Z", reviewed_by_id: null,
};
// En revisión y no Pendiente: PENDING es también el valor de reserva, y no discriminaría.
const EN_REVISION = { ...base, id: "sec-revision", section_code: "AIV-05", title: "Riesgos", status: "En revisión" };

let restaurar = () => undefined;
let Expediente: typeof TipoExpediente;
const guardados: Array<{ id: string; status: string }> = [];

beforeAll(async () => {
  const real = await import("@/hooks/useAimsTechnicalFile");
  restaurar = await mockRestaurable("@/hooks/useAimsTechnicalFile", () => ({
    ...real,
    useIniciarExpedienteTecnico: () => ({ mutateAsync: async () => undefined, isPending: false }),
    useUpdateTechnicalFileSection: () => ({
      mutateAsync: async (v: { id: string; status: string }) => { guardados.push(v); },
      isPending: false,
    }),
    useRegistrarVersion: () => ({ mutateAsync: async () => undefined, isPending: false }),
  }));
  Expediente = (await import("@/components/ai-governance/sistema/TabExpedienteTecnico")).default;
});
afterAll(() => restaurar());
afterEach(() => { cleanup(); guardados.length = 0; });

function abrirEdicion(seccion: typeof CONFORME | typeof EN_REVISION) {
  render(
    <Expediente
      systemId={base.system_id}
      rol={null}
      nivel={null}
      secciones={[seccion] as never}
      versiones={[]}
      onClasificar={() => undefined}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Editar" }));
  return screen.getByLabelText("Estado") as HTMLSelectElement;
}

describe("F1.T7 — el selector de la sección no ofrece estados que exigen revisor", () => {
  it("una sección «Conforme» se edita sin ofrecer Conforme ni Cerrada", () => {
    const select = abrirEdicion(CONFORME);
    const opciones = within(select).getAllByRole("option") as HTMLOptionElement[];
    // Control del instrumento: el selector existe y ofrece los estados de trabajo.
    expect(opciones.map((o) => o.value)).toEqual(["PENDING", "IN_REVIEW", "NON_CONFORMING"]);
    for (const o of opciones) {
      expect(["APPROVED", "SEALED"]).not.toContain(o.value);
      expect(["Conforme", "Cerrada"]).not.toContain(o.textContent);
    }
    // El valor inicial es uno que el selector ofrece, no el «Conforme» registrado.
    expect(select.value).toBe("PENDING");
  });

  it("guardar no reescribe «Conforme»: la sección queda en el estado de trabajo elegido", () => {
    const select = abrirEdicion(CONFORME);
    fireEvent.change(select, { target: { value: "IN_REVIEW" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar sección" }));
    expect(guardados).toEqual([expect.objectContaining({ id: "sec-conforme", status: "IN_REVIEW" })]);
  });

  it("control positivo: una sección en revisión conserva su estado al abrirla", () => {
    expect(abrirEdicion(EN_REVISION).value).toBe("IN_REVIEW");
  });
});
