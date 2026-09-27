import { describe, it, expect } from "bun:test";
import {
  proveedorDeSistema,
  responsableInternoDeSistema,
  monitorResponsableInterno,
  type SujetoResponsable,
} from "../readiness";

/**
 * F2.T8 — el proveedor y el responsable interno se separan por sujeto
 * (`aims_ria_subjects`), no por el `vendor` de texto libre. Con 0 sujetos hoy
 * en los dos tenants, el fallback debe reproducir EXACTAMENTE lo que la
 * ficha mostraba antes de F2.T8 (nunca inventa proveedor ni responsable).
 */
describe("proveedorDeSistema", () => {
  it("sin sujetos, cae al vendor legado (0 sujetos hoy en ARGA y Garrigues)", () => {
    expect(proveedorDeSistema("sys-1", [], "Vendor SL")).toBe("Vendor SL");
  });

  it("sin sujetos y sin vendor, lo declara en vez de inventar", () => {
    expect(proveedorDeSistema("sys-1", [], null)).toBe("Sin proveedor declarado");
  });

  it("con un sujeto PROVEEDOR, la sociedad manda sobre el vendor legado", () => {
    const subjects: SujetoResponsable[] = [
      { systemId: "sys-1", role: "PROVEEDOR", entityLabel: "ARGA España Seguros y Reaseguros, S.A." },
    ];
    expect(proveedorDeSistema("sys-1", subjects, "Vendor legado SL")).toBe("ARGA España Seguros y Reaseguros, S.A.");
  });

  it("un sujeto RESPONSABLE_DESPLIEGUE no cuenta como proveedor", () => {
    const subjects: SujetoResponsable[] = [
      { systemId: "sys-1", role: "RESPONSABLE_DESPLIEGUE", entityLabel: "ARGA Vida y Pensiones, S.A." },
    ];
    expect(proveedorDeSistema("sys-1", subjects, "Vendor legado")).toBe("Vendor legado");
  });

  it("no mezcla sujetos de otro sistema", () => {
    const subjects: SujetoResponsable[] = [
      { systemId: "sys-2", role: "PROVEEDOR", entityLabel: "Otra sociedad" },
    ];
    expect(proveedorDeSistema("sys-1", subjects, "Vendor de sys-1")).toBe("Vendor de sys-1");
  });
});

describe("responsableInternoDeSistema", () => {
  it("sin sujetos, declara la ausencia (0 sujetos hoy)", () => {
    expect(responsableInternoDeSistema("sys-1", [])).toBe("Sin responsable interno asignado");
  });

  it("con un sujeto con responsable, pinta el nombre", () => {
    const subjects: SujetoResponsable[] = [
      { systemId: "sys-1", role: "PROVEEDOR", ownerPersonId: "p-1", ownerName: "Isabel Redel" },
    ];
    expect(responsableInternoDeSistema("sys-1", subjects)).toBe("Isabel Redel");
  });

  it("un sujeto sin responsable asignado no cuenta como tenerlo", () => {
    const subjects: SujetoResponsable[] = [{ systemId: "sys-1", role: "PROVEEDOR", ownerPersonId: null, ownerName: null }];
    expect(responsableInternoDeSistema("sys-1", subjects)).toBe("Sin responsable interno asignado");
  });
});

describe("monitorResponsableInterno", () => {
  it("0 sujetos es 'unmeasured', nunca 'gap' (no hay brecha en lo que no existe)", () => {
    expect(monitorResponsableInterno([])).toEqual({ total: 0, conResponsable: 0, status: "unmeasured" });
  });

  it("todos los sujetos con responsable: 'ok'", () => {
    const subjects: SujetoResponsable[] = [
      { systemId: "s1", role: "PROVEEDOR", ownerPersonId: "p1" },
      { systemId: "s2", role: "RESPONSABLE_DESPLIEGUE", ownerPersonId: "p2" },
    ];
    expect(monitorResponsableInterno(subjects)).toEqual({ total: 2, conResponsable: 2, status: "ok" });
  });

  it("algún sujeto sin responsable: 'gap', con el recuento real", () => {
    const subjects: SujetoResponsable[] = [
      { systemId: "s1", role: "PROVEEDOR", ownerPersonId: "p1" },
      { systemId: "s2", role: "RESPONSABLE_DESPLIEGUE", ownerPersonId: null },
    ];
    expect(monitorResponsableInterno(subjects)).toEqual({ total: 2, conResponsable: 1, status: "gap" });
  });
});
