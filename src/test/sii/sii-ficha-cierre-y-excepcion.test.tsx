// src/test/sii/sii-ficha-cierre-y-excepcion.test.tsx
//
// Lo que la ficha del expediente ESCRIBE cuando el instructor pulsa. No lo que
// enseña mientras tanto.
//
// Dos defectos de la misma familia, medidos el 2026-09-06:
//
//  1. La excepción del acuse del art. 9.2.c —«salvo que ello pueda poner en
//     peligro la confidencialidad de la comunicación», literal del consolidado
//     BOE-A-2023-4513— estaba modelada en el hook y CONTADA como cumplimiento
//     por el KPI del panel, pero ninguna superficie podía registrarla: el único
//     camino de la pantalla emitía el acuse siempre.
//  2. El cierre asentaba en el Libro-registro (art. 26) unas actuaciones de
//     fábrica —«Investigación completada, entrevistas finalizadas y plan de
//     remediación activado.»— sin campo donde cambiarlas, y la transferencia a
//     remediación enlazaba un plan cableado, «PLAN-REM-2026-01», que no existe.
//
// El asiento del Libro-registro es el registro oficial del expediente: que dé
// por practicadas diligencias que nadie escribió es el daño caro.
import { afterAll, afterEach, beforeEach, describe, expect, it } from "bun:test";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { mockearModulos } from "../garrigues/_mock-restaurable";
import type { WhistleblowingReport } from "@/lib/sii/whistleblowing-engine";

const ARGA = "00000000-0000-0000-0000-000000000001";

if (typeof globalThis.getComputedStyle === "undefined" && typeof window !== "undefined") {
  globalThis.getComputedStyle = window.getComputedStyle.bind(window);
}
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// El expediente REAL del catálogo, capturado antes de mockear el módulo.
const { initialReportsFor } = await import("@/hooks/useWhistleblowing");
const BASE = initialReportsFor(ARGA)[0];

let expediente: WhistleblowingReport = BASE;
let acuseRecibido: Record<string, unknown> | null = null;
let cierreRecibido: Record<string, unknown> | null = null;
let subexpedienteRecibido: Record<string, unknown> | null = null;

const captura = (destino: (v: Record<string, unknown>) => void) => () => ({
  mutateAsync: async (args: Record<string, unknown>) => {
    destino(args);
    return { report: expediente, enPlazo: null, limiteAcuse: null };
  },
  isPending: false,
});

const restaurarMocks = await mockearModulos([
  ["@/context/TenantContext", () => ({ useTenantContext: () => ({ tenantId: ARGA }) })],
  [
    "@/hooks/useWhistleblowing",
    () => ({
      useWhistleblowingReportById: () => ({ data: expediente, isLoading: false }),
      useEmitAcknowledgment: captura((v) => { acuseRecibido = v; }),
      useCloseRootCase: captura((v) => { cierreRecibido = v; }),
      useUpdateSubcaseStatus: captura((v) => { subexpedienteRecibido = v; }),
      useApproveExtension: captura(() => {}),
      useFormalizeRecusation: captura(() => {}),
      useSendSafeInboxMessage: captura(() => {}),
    }),
  ],
]);
afterAll(restaurarMocks);

beforeEach(() => {
  acuseRecibido = null;
  cierreRecibido = null;
  subexpedienteRecibido = null;
});
afterEach(() => cleanup());

async function montar(patch: Partial<WhistleblowingReport> = {}) {
  expediente = { ...BASE, ...patch };
  const { default: SiiCaseDetalle } = await import("@/pages/sii/SiiCaseDetalle");
  render(
    <MemoryRouter initialEntries={[`/sii/${expediente.code}`]}>
      <Routes>
        <Route path="/sii/:id" element={<SiiCaseDetalle />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("SII — la excepción del acuse del art. 9.2.c se puede registrar", () => {
  const SIN_ACUSE = { acknowledgmentSentDate: null, acknowledgmentExemptReason: null };

  it("marcada y motivada, la ficha la envía como excepción y NO como acuse emitido", async () => {
    await montar(SIN_ACUSE);
    fireEvent.click(screen.getByText(/Emitir Acuse/));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.change(screen.getByPlaceholderText(/Motive el riesgo/), {
      target: { value: "La persona denunciada tiene acceso al buzón de entrada." },
    });
    await act(async () => {
      fireEvent.click(screen.getByText(/Registrar excepción motivada/));
    });

    expect(acuseRecibido).not.toBeNull();
    expect(acuseRecibido!.isExempt).toBe(true);
    expect(acuseRecibido!.exemptReason).toBe("La persona denunciada tiene acceso al buzón de entrada.");
  });

  it("sin motivar NO se registra: la salvedad la sostiene el motivo, no la casilla", async () => {
    await montar(SIN_ACUSE);
    fireEvent.click(screen.getByText(/Emitir Acuse/));
    fireEvent.click(screen.getByRole("checkbox"));
    await act(async () => {
      fireEvent.click(screen.getByText(/Registrar excepción motivada/));
    });
    expect(acuseRecibido).toBeNull();
  });

  it("CONTROL: sin marcar la casilla se emite el acuse de siempre, sin excepción", async () => {
    // Sin esto, mandar SIEMPRE `isExempt` pasaría el primer caso.
    await montar(SIN_ACUSE);
    fireEvent.click(screen.getByText(/Emitir Acuse/));
    await act(async () => {
      fireEvent.click(screen.getByText(/Emitir y Notificar/));
    });
    expect(acuseRecibido).not.toBeNull();
    expect(acuseRecibido!.isExempt).toBeUndefined();
  });

  it("y una vez registrada, la ficha la muestra en lugar de una cuenta atrás", async () => {
    await montar({
      acknowledgmentSentDate: null,
      acknowledgmentExemptReason: "Riesgo acreditado para la confidencialidad.",
    });
    expect(screen.getByText(/Excepción registrada/)).toBeTruthy();
    expect(screen.getByText(/Excepción del art\. 9\.2\.c/)).toBeTruthy();
    // Y ya no se ofrece emitirlo: el expediente no está pendiente de acuse.
    expect(screen.queryByText(/Emitir Acuse/)).toBeNull();
  });
});

describe("SII — el asiento del Libro-registro no da por practicadas actuaciones ajenas", () => {
  const CERRABLE = {
    status: "EN_INVESTIGACION" as const,
    subcases: BASE.subcases.map((s) => ({ ...s, status: "CERRADO" as const })),
  };

  it("el campo de actuaciones arranca VACÍO: nada se afirma por defecto", async () => {
    await montar(CERRABLE);
    fireEvent.click(screen.getByText(/Cerrar Expediente Raíz/));
    const campo = screen.getByPlaceholderText(/actuaciones realmente practicadas/) as HTMLTextAreaElement;
    expect(campo.value).toBe("");
    // Y el texto de fábrica que había no aparece por ningún lado.
    expect(screen.queryByText(/entrevistas finalizadas/)).toBeNull();
  });

  it("se asienta lo que se escribe, y en blanco no se asienta ninguna", async () => {
    await montar(CERRABLE);
    fireEvent.click(screen.getByText(/Cerrar Expediente Raíz/));
    fireEvent.change(screen.getByPlaceholderText(/Detalle la motivación/), {
      target: { value: "Se archiva por falta de indicios." },
    });
    await act(async () => {
      fireEvent.click(screen.getByText(/Confirmar y Asentar/));
    });
    expect(cierreRecibido).not.toBeNull();
    expect(cierreRecibido!.actionsTaken).toEqual([]);

    cleanup();
    await montar(CERRABLE);
    fireEvent.click(screen.getByText(/Cerrar Expediente Raíz/));
    fireEvent.change(screen.getByPlaceholderText(/Detalle la motivación/), {
      target: { value: "Se archiva por falta de indicios." },
    });
    fireEvent.change(screen.getByPlaceholderText(/actuaciones realmente practicadas/), {
      target: { value: "Dos entrevistas y revisión del expediente de aceptación." },
    });
    await act(async () => {
      fireEvent.click(screen.getByText(/Confirmar y Asentar/));
    });
    expect(cierreRecibido!.actionsTaken).toEqual([
      "Dos entrevistas y revisión del expediente de aceptación.",
    ]);
  });

  it("la transferencia a remediación no enlaza un plan que no existe", async () => {
    await montar({ subcases: BASE.subcases.map((s) => ({ ...s, status: "ABIERTO" as const })) });
    await act(async () => {
      fireEvent.click(screen.getAllByText(/Transferir a Remediación/)[0]);
    });
    expect(subexpedienteRecibido).not.toBeNull();
    expect(subexpedienteRecibido!.status).toBe("TRANSFERIDO_REMEDIACION");
    expect(subexpedienteRecibido!.remediationPlanId).toBeUndefined();
  });
});

describe("SII — la ficha no pinta en verde un plazo del art. 9.2.d ya agotado", () => {
  it("el expediente sembrado, con el plazo pasado, se lee como vencido", async () => {
    // El primero del catálogo se recibió el 10/04/2026 y su plazo ordinario
    // venció el 10/07/2026. La ficha lo enseñaba con el token de éxito y el
    // texto «-N días restantes»: verde sobre un incumplimiento.
    await montar({});
    expect(new Date(expediente.resolutionDeadline).getTime()).toBeLessThan(Date.now());
    expect(screen.getByText(/^Vencido hace \d+ días?$/)).toBeTruthy();
    expect(screen.queryByText(/días restantes/)).toBeNull();
  });

  it("CONTROL: con el plazo por delante vuelve a leerse como plazo restante", async () => {
    // Sin esto, escribir «Vencido» siempre pasaría el caso anterior.
    const dentroDePlazo = new Date(Date.now() + 40 * 24 * 3600 * 1000).toISOString();
    await montar({ intakeDate: dentroDePlazo, resolutionDeadline: dentroDePlazo });
    expect(screen.getByText(/días restantes/)).toBeTruthy();
    expect(screen.queryByText(/Vencido hace/)).toBeNull();
  });
});
