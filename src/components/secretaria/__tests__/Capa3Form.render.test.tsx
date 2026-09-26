// MOI-206 — gate de render por tipo: un campo `boolean`/`booleano` o
// `number`/`numero` nunca puede volver a pintarse como `<textarea>` libre.
// Este test falla si alguien reintroduce esa regresión (p.ej. reordenando
// las ramas de Capa3Form o quitando el chequeo de tipo).
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Capa3Form, type Capa3Field } from "../Capa3Form";

function renderForm(fields: Capa3Field[], values: Record<string, unknown> = {}) {
  return render(<Capa3Form fields={fields} values={values} onChange={() => {}} />);
}

describe("Capa3Form — render por tipo (MOI-206)", () => {
  it("un campo boolean se pinta como <select> de tres estados, nunca como textarea", () => {
    renderForm([
      { campo: "entidad_cotizada", tipo: "boolean", obligatoriedad: "OBLIGATORIO", descripcion: "¿Cotizada?" },
    ]);

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    const optionLabels = Array.from(select.options).map((o) => o.textContent);
    expect(optionLabels).toEqual(["Sin contestar", "Sí", "No"]);
  });

  it("un campo booleano (grafía castellana) también evita el textarea", () => {
    renderForm([
      { campo: "es_parte_vinculada", tipo: "booleano", obligatoriedad: "OPCIONAL", descripcion: "¿Vinculada?" },
    ]);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("un campo number se pinta como <input type=number> con min/max, nunca como textarea", () => {
    renderForm([
      {
        campo: "importe_operacion",
        tipo: "number",
        obligatoriedad: "OBLIGATORIO",
        descripcion: "Importe",
        min: 0,
        max: 1000000,
      },
    ]);

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    const input = screen.getByRole("spinbutton") as HTMLInputElement;
    expect(input.type).toBe("number");
    expect(input.min).toBe("0");
    expect(input.max).toBe("1000000");
  });

  it("un campo numero (grafía castellana) también evita el textarea", () => {
    renderForm([
      { campo: "plazo_mandato", tipo: "numero", obligatoriedad: "OPCIONAL", descripcion: "Plazo" },
    ]);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByRole("spinbutton")).toBeInTheDocument();
  });

  it("un campo de texto sin tipo declarado sigue usando textarea (no regresión)", () => {
    renderForm([
      { campo: "observaciones", obligatoriedad: "OPCIONAL", descripcion: "Observaciones libres" },
    ]);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("el valor real (true/false) refleja la selección del control tri-estado", () => {
    renderForm(
      [{ campo: "entidad_cotizada", tipo: "boolean", obligatoriedad: "OPCIONAL", descripcion: "Cotizada" }],
      { entidad_cotizada: false },
    );
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("false");
  });

  it("un default legacy en texto ('No') se muestra correctamente en el select tri-estado", () => {
    renderForm(
      [{ campo: "entidad_cotizada", tipo: "boolean", obligatoriedad: "OPCIONAL", descripcion: "Cotizada" }],
      { entidad_cotizada: "No" },
    );
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("false");
  });

  it("un default legacy en texto ('150000') se muestra correctamente en el input numérico", () => {
    renderForm(
      [{ campo: "importe_operacion", tipo: "number", obligatoriedad: "OPCIONAL", descripcion: "Importe" }],
      { importe_operacion: "150000" },
    );
    const input = screen.getByRole("spinbutton") as HTMLInputElement;
    expect(input.value).toBe("150000");
  });

  it("un valor numérico ya guardado se muestra en el input", () => {
    renderForm(
      [{ campo: "importe_operacion", tipo: "number", obligatoriedad: "OPCIONAL", descripcion: "Importe" }],
      { importe_operacion: 42 },
    );
    const input = screen.getByRole("spinbutton") as HTMLInputElement;
    expect(input.value).toBe("42");
  });
});
