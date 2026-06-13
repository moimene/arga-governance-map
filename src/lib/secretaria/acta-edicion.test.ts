import { describe, it, expect } from "vitest";
import { isActaBorradorEditable } from "./acta-edicion";

describe("isActaBorradorEditable", () => {
  it("permite editar un acta en borrador (sin firmar y no bloqueada)", () => {
    expect(isActaBorradorEditable({ is_locked: false, signed_at: null })).toBe(true);
  });

  it("no permite editar un acta firmada (signed_at presente)", () => {
    expect(
      isActaBorradorEditable({ is_locked: false, signed_at: "2026-06-13T10:44:00Z" }),
    ).toBe(false);
  });

  it("no permite editar un acta bloqueada (is_locked)", () => {
    expect(isActaBorradorEditable({ is_locked: true, signed_at: null })).toBe(false);
  });

  it("no permite editar un acta firmada y bloqueada", () => {
    expect(
      isActaBorradorEditable({ is_locked: true, signed_at: "2026-06-13T10:44:00Z" }),
    ).toBe(false);
  });

  it("trata is_locked nulo/ausente como no bloqueada", () => {
    expect(isActaBorradorEditable({ signed_at: null })).toBe(true);
  });
});
