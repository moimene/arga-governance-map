import { describe, expect, it } from "vitest";
import { bodyOptionLabel, bodyTypeLabel } from "../body-labels";

describe("body-labels", () => {
  it("normaliza aliases históricos de órganos societarios", () => {
    expect(bodyTypeLabel("CONSEJO_ADMINISTRACION")).toBe("Consejo de Administración");
    expect(bodyTypeLabel("CONSEJO_ADMIN")).toBe("Consejo de Administración");
    expect(bodyTypeLabel("JUNTA_GENERAL")).toBe("Junta General");
    expect(bodyTypeLabel("ADMIN_SOLIDARIOS")).toBe("Administradores solidarios");
  });

  it("construye opciones legibles para selects filtrados por sociedad", () => {
    expect(bodyOptionLabel({ body_type: "CDA", name: "Consejo de Administración" })).toBe(
      "Consejo de Administración",
    );
    expect(bodyOptionLabel({ body_type: "COMITE", name: "Comité de Auditoría" })).toBe(
      "Comité — Comité de Auditoría",
    );
  });
});
