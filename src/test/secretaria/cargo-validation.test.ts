import { describe, it, expect } from "vitest";
import {
  requiresBodyId,
  requiresRepresentative,
  isAuthorityRole,
  isAuthorityRoleInscribable,
} from "@/lib/secretaria/cargo-validation";

describe("cargo-validation helpers", () => {
  it("requiresBodyId: cargos de órgano colegiado need body_id", () => {
    expect(requiresBodyId("CONSEJERO")).toBe(true);
    expect(requiresBodyId("PRESIDENTE")).toBe(true);
    expect(requiresBodyId("SECRETARIO")).toBe(true);
    expect(requiresBodyId("VICEPRESIDENTE")).toBe(true);
    expect(requiresBodyId("VICESECRETARIO")).toBe(true);
    expect(requiresBodyId("CONSEJERO_COORDINADOR")).toBe(true);
  });

  it("requiresBodyId: cargos no colegiados do NOT need body_id", () => {
    expect(requiresBodyId("SOCIO")).toBe(false);
    expect(requiresBodyId("ADMIN_UNICO")).toBe(false);
    expect(requiresBodyId("ADMIN_SOLIDARIO")).toBe(false);
    expect(requiresBodyId("ADMIN_MANCOMUNADO")).toBe(false);
    expect(requiresBodyId("ADMIN_PJ")).toBe(false);
  });

  it("requiresRepresentative: PJ con cargo admin requires representante (L2 art. 212bis)", () => {
    const pj = { person_type: "PJ" as const };
    expect(requiresRepresentative(pj, "ADMIN_UNICO")).toBe(true);
    expect(requiresRepresentative(pj, "ADMIN_SOLIDARIO")).toBe(true);
    expect(requiresRepresentative(pj, "ADMIN_MANCOMUNADO")).toBe(true);
    expect(requiresRepresentative(pj, "ADMIN_PJ")).toBe(true);
    expect(requiresRepresentative(pj, "CONSEJERO")).toBe(true);
  });

  it("requiresRepresentative: PJ socio (no admin) does NOT require representante (L1 art. 184)", () => {
    const pj = { person_type: "PJ" as const };
    expect(requiresRepresentative(pj, "SOCIO")).toBe(false);
  });

  it("requiresRepresentative: PF never requires representante", () => {
    const pf = { person_type: "PF" as const };
    expect(requiresRepresentative(pf, "ADMIN_UNICO")).toBe(false);
    expect(requiresRepresentative(pf, "CONSEJERO")).toBe(false);
    expect(requiresRepresentative(pf, "SOCIO")).toBe(false);
  });

  it("requiresRepresentative: person_type null does NOT require representante (defensive)", () => {
    const unknown = { person_type: null };
    expect(requiresRepresentative(unknown, "ADMIN_UNICO")).toBe(false);
    expect(requiresRepresentative(unknown, "CONSEJERO")).toBe(false);
  });

  it("isAuthorityRole: cargos certificantes (incluye VICESECRETARIO L17, excluye CONSEJERO_COORDINADOR L15)", () => {
    expect(isAuthorityRole("PRESIDENTE")).toBe(true);
    expect(isAuthorityRole("VICEPRESIDENTE")).toBe(true);
    expect(isAuthorityRole("SECRETARIO")).toBe(true);
    expect(isAuthorityRole("VICESECRETARIO")).toBe(true);
    expect(isAuthorityRole("ADMIN_UNICO")).toBe(true);
    expect(isAuthorityRole("ADMIN_SOLIDARIO")).toBe(true);
    expect(isAuthorityRole("ADMIN_MANCOMUNADO")).toBe(true);
  });

  it("isAuthorityRole: cargos NO certificantes (incluye CONSEJERO_COORDINADOR — fix W1#6)", () => {
    expect(isAuthorityRole("CONSEJERO")).toBe(false);
    expect(isAuthorityRole("SOCIO")).toBe(false);
    expect(isAuthorityRole("ADMIN_PJ")).toBe(false);
    // CONSEJERO_COORDINADOR NO certifica societariamente (L15: presidentes de comisiones
    // NO certifican). Coherente con v_cargos_certificantes del trigger en
    // 20260513_000064 + cleanup en W1 commit 63a8639.
    expect(isAuthorityRole("CONSEJERO_COORDINADOR")).toBe(false);
  });

  it("isAuthorityRoleInscribable: requiere referencia RM para certificar (L22, L17)", () => {
    expect(isAuthorityRoleInscribable("PRESIDENTE")).toBe(true);
    expect(isAuthorityRoleInscribable("SECRETARIO")).toBe(true);
    expect(isAuthorityRoleInscribable("VICESECRETARIO")).toBe(true);
    expect(isAuthorityRoleInscribable("ADMIN_UNICO")).toBe(true);
    expect(isAuthorityRoleInscribable("ADMIN_SOLIDARIO")).toBe(true);
    expect(isAuthorityRoleInscribable("ADMIN_MANCOMUNADO")).toBe(true);
    expect(isAuthorityRoleInscribable("VICEPRESIDENTE")).toBe(true);
  });

  it("isAuthorityRoleInscribable: cargos no certificantes no son inscribibles para emitir cert", () => {
    expect(isAuthorityRoleInscribable("CONSEJERO")).toBe(false);
    expect(isAuthorityRoleInscribable("CONSEJERO_COORDINADOR")).toBe(false);
    expect(isAuthorityRoleInscribable("SOCIO")).toBe(false);
    expect(isAuthorityRoleInscribable("ADMIN_PJ")).toBe(false);
  });
});
