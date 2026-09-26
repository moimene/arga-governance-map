// src/test/aims/board-pack-titulos-legado.test.ts
//
// MOI-184: el Board Pack pintaba `requirement_title` guardado tal cual, con la
// numeración desplazada del seed («Política de IA (A.5)», cuando el catálogo
// vigente dice «Políticas relativas a la IA (A.2)»). Falla si `BPSistemasIA`
// vuelve a pintar el título guardado de un código legado sin traducirlo ni
// avisar.
import { afterEach, describe, expect, it } from "bun:test";
import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { BPSistemasIA } from "@/components/board-pack/BPSistemasIA";
import type { BoardPackAISystem } from "@/hooks/useBoardPackData";

afterEach(() => cleanup());

function sistema(checks: BoardPackAISystem["checks"]): BoardPackAISystem[] {
  return [
    {
      id: "sys-1",
      name: "Motor de triaje",
      risk_level: "Alto",
      vendor: "Interno",
      status: "En producción",
      checks,
      non_conformities: 0,
    },
  ];
}

describe("Board Pack: título de requisitos con numeración legado (MOI-184)", () => {
  it("ISO-05 con equivalente vigente: pinta el título del catálogo actual, no el guardado desplazado", () => {
    render(
      createElement(BPSistemasIA, {
        aiSystems: sistema([
          { requirement_code: "ISO-05", requirement_title: "Política de IA (A.5)", status: "Conforme" },
        ]),
      }),
    );
    // El defecto que este test vigila: el guardado ("A.5") ya NO se pinta tal cual.
    expect(screen.queryByText("Política de IA (A.5)")).toBeNull();
    expect(screen.getByText("Políticas relativas a la IA (A.2)")).toBeTruthy();
  });

  it("ISO-07 sin equivalente vigente: pinta el guardado con aviso de numeración antigua", () => {
    render(
      createElement(BPSistemasIA, {
        aiSystems: sistema([
          { requirement_code: "ISO-07", requirement_title: "Recursos de IA (A.7)", status: "Conforme" },
        ]),
      }),
    );
    expect(screen.getByText(/Recursos de IA \(A\.7\)/)).toBeTruthy();
    expect(screen.getByText(/numeración antigua/i)).toBeTruthy();
  });

  it("control positivo: un código ya vigente se pinta tal cual, sin aviso", () => {
    render(
      createElement(BPSistemasIA, {
        aiSystems: sistema([
          { requirement_code: "TRANSPARENCY", requirement_title: "Transparencia e información a usuarios", status: "Conforme" },
        ]),
      }),
    );
    expect(screen.getByText("Transparencia e información a usuarios")).toBeTruthy();
    expect(screen.queryByText(/numeración antigua/i)).toBeNull();
  });
});
