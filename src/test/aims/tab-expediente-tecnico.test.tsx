// src/test/aims/tab-expediente-tecnico.test.tsx
//
// F1.T7 (GC-51) — la ARISTA del selector de estado del expediente técnico.
//
// Se retiró el cierre del expediente, pero el selector de cada sección seguía
// ofreciendo «Conforme» y «Cerrada» sin revisor: una retirada a medias. La hoja
// ya no los ofrece (`expediente-tecnico.test.ts`); aquí se comprueba que la
// pestaña USA esa lista, abriendo la edición de una sección como las que ARGA
// tiene sembradas en «Conforme» (medido el 2026-09-19: 4 de 5, sin revisor).
//
// Sin `mock.module` (global en bun y dependiente del orden de carga): la
// pestaña y el hook de escritura son los REALES, dentro de los proveedores
// reales, y lo único sustituido es `supabase.from` en el propio objeto del
// cliente. Así se mide lo que llega al UPDATE, no lo que recibe un doble del
// hook, y el rechazo de APPROVED/SEALED se EJECUTA en vez de buscarse en el
// texto del hook (ese grep, en `no-fabricated-claims`, queda como respaldo).
import { afterAll, afterEach, beforeAll, describe, expect, it } from "bun:test";
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { supabase } from "@/integrations/supabase/client";
import Expediente from "@/components/ai-governance/sistema/TabExpedienteTecnico";
import { useUpdateTechnicalFileSection } from "@/hooks/useAimsTechnicalFile";
import { conProveedoresReales } from "./_proveedores-reales";

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
const CERRADA = { ...base, id: "sec-cerrada", section_code: "AIV-08", title: "Declaración", status: "SEALED" };
/** Un `reviewed_at` que no corresponde a ninguna revisión: estado de trabajo. */
const PENDIENTE_CON_FECHA = {
  ...base, id: "sec-pendiente", section_code: "AIV-01", title: "Descripción", status: "Pendiente",
  reviewed_at: "2026-04-24T00:00:00Z",
};
type Seccion = typeof CONFORME | typeof EN_REVISION | typeof CERRADA | typeof PENDIENTE_CON_FECHA;

// ── Doble de `supabase.from`, restaurable y ajeno al orden de carga ─────────
type Update = { tabla: string; valores: Record<string, unknown>; filtros: Array<[string, unknown]> };
const updates: Update[] = [];
const cliente = supabase as unknown as Record<string, unknown>;

beforeAll(() => {
  cliente.from = (tabla: string) => {
    const filtros: Array<[string, unknown]> = [];
    let valores: Record<string, unknown> | null = null;
    const q = {
      select: () => q,
      eq: (col: string, v: unknown) => { filtros.push([col, v]); return q; },
      update: (v: Record<string, unknown>) => { valores = v; updates.push({ tabla, valores: v, filtros }); return q; },
      maybeSingle: async () => ({
        data: valores ? { ...base, id: filtros.find(([c]) => c === "id")?.[1], ...valores } : null,
        error: null,
      }),
    };
    return q;
  };
});
// `from` es un método del prototipo: borrar la propiedad propia lo repone.
afterAll(() => { delete cliente.from; });
afterEach(() => { cleanup(); updates.length = 0; });

function pintar(secciones: Seccion[]) {
  render(
    conProveedoresReales(
      <Expediente
        systemId={base.system_id}
        rol={null}
        nivel={null}
        secciones={secciones as never}
        versiones={[]}
        onClasificar={() => undefined}
      />,
    ),
  );
}

function abrirEdicion(seccion: Seccion) {
  pintar([seccion]);
  fireEvent.click(screen.getByRole("button", { name: "Editar" }));
  return screen.getByLabelText("Estado") as HTMLSelectElement;
}

/** Lo que llegó al UPDATE de la tabla de secciones. */
async function enviado() {
  await waitFor(() => expect(updates.length).toBe(1));
  expect(updates[0].tabla).toBe("aims_technical_file_sections");
  return updates[0];
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

  it("guardar sin tocar el selector no reescribe «Conforme»: llega PENDING al UPDATE", async () => {
    // `select.value` no basta: React muestra la primera opción cuando el estado
    // interno no casa con ninguna, así que un «Conforme» retenido en el estado
    // se vería «Pendiente» y se guardaría como APPROVED. Se mira lo que se ENVÍA.
    abrirEdicion(CONFORME);
    fireEvent.click(screen.getByRole("button", { name: "Guardar sección" }));
    const u = await enviado();
    expect(u.valores.status).toBe("PENDING");
    expect(u.filtros).toContainEqual(["id", "sec-conforme"]);
  });

  it("y con otro estado de trabajo elegido, se guarda ese", async () => {
    const select = abrirEdicion(CONFORME);
    fireEvent.change(select, { target: { value: "IN_REVIEW" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar sección" }));
    expect((await enviado()).valores.status).toBe("IN_REVIEW");
  });

  it("control positivo: una sección en revisión conserva su estado al abrirla", () => {
    expect(abrirEdicion(EN_REVISION).value).toBe("IN_REVIEW");
  });
});

describe("F1.T7 — editar una sección «Conforme» avisa de que el estado no se conserva", () => {
  const aviso = () => document.querySelector("[data-aviso-estado-revisor]");

  it("antes de guardar dice en qué estado queda y que «Conforme» se pierde", () => {
    const select = abrirEdicion(CONFORME);
    expect(aviso()?.textContent).toContain("Guardar deja esta sección en «Pendiente»");
    expect(aviso()?.textContent).toContain("«Conforme» no se conserva");
    // Sigue al selector: dice el estado que de verdad se enviará.
    fireEvent.change(select, { target: { value: "NON_CONFORMING" } });
    expect(aviso()?.textContent).toContain("Guardar deja esta sección en «No conforme»");
  });

  it("control positivo: una sección de trabajo no lleva el aviso (su estado se conserva)", () => {
    abrirEdicion(EN_REVISION);
    expect(screen.getByLabelText("Estado")).toBeTruthy(); // la edición se abrió
    expect(aviso()).toBeNull();
  });
});

describe("F1.T7 — «Revisada» solo acompaña a un estado de revisor", () => {
  it("una fecha de revisión junto a un estado de trabajo no se pinta; junto a «Conforme» con revisor, sí", () => {
    // Un «Conforme» sin revisor es legado (F1.T4, `rotuloSeccion`) y tampoco lleva fecha: el
    // control positivo necesita revisor.
    pintar([PENDIENTE_CON_FECHA, { ...CONFORME, reviewed_by_id: "p-1" }]);
    const tarjetas = screen.getAllByRole("heading", { level: 3 }).map((h) => h.closest("div.p-4") as HTMLElement);
    // Control del instrumento: dos secciones, dos tarjetas.
    expect(tarjetas.map((t) => t.querySelector(".font-mono")?.textContent)).toEqual(["AIV-01", "AIV-03"]);
    const [pendiente, conforme] = tarjetas;
    expect(pendiente.textContent).not.toContain("Revisada");
    expect(conforme.textContent).toContain("Revisada");
  });
});

describe("F1.T7 — una sección «Cerrada» no se reabre desde la aplicación", () => {
  it("no ofrece «Editar» en la cerrada y sí en la de trabajo", () => {
    pintar([CERRADA, EN_REVISION]);
    const botones = screen.getAllByRole("button", { name: "Editar" });
    // Control positivo: la sección de trabajo sí se puede editar.
    expect(botones.length).toBe(1);
    const tarjeta = botones[0].closest("div.p-4") as HTMLElement;
    expect(tarjeta.textContent).toContain("AIV-05");
    expect(tarjeta.textContent).not.toContain("AIV-08");
  });
});

describe("F1.T7 — el hook de escritura rechaza, EJECUTADO, los estados con revisor", () => {
  const wrapper = ({ children }: { children: ReactNode }) => conProveedoresReales(children);
  const payload = (status: string) => ({ id: "sec-x", content: { summary: "texto" }, status });

  it("APPROVED, SEALED y sus grafías se rechazan sin llegar al UPDATE", async () => {
    const { result } = renderHook(() => useUpdateTechnicalFileSection(), { wrapper });
    for (const status of ["APPROVED", "SEALED", "Conforme", "sealed"]) {
      await expect(result.current.mutateAsync(payload(status))).rejects.toThrow(/exige un revisor/);
    }
    expect(updates).toEqual([]);
  });

  it("control positivo: un estado de trabajo sí llega al UPDATE (el doble intercepta)", async () => {
    const { result } = renderHook(() => useUpdateTechnicalFileSection(), { wrapper });
    await result.current.mutateAsync(payload("IN_REVIEW"));
    expect(updates.length).toBe(1);
    expect(updates[0].valores.status).toBe("IN_REVIEW");
  });
});
