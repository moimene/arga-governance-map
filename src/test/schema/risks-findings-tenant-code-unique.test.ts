// MOI-190: risks y findings deben exigir código único DENTRO de cada grupo
// (tenant_id, code), no globalmente. Antes de la migración
// 20260926119000_grc_risks_findings_tenant_code_unique.sql, `risks.code` no
// tenía ninguna unicidad y `findings.code` tenía un UNIQUE global
// (findings_code_key) que impedía a un segundo tenant reutilizar el código de
// otro. Mismo patrón admin-gated que persons-tax-id-unique.test.ts: sin
// SUPABASE_SERVICE_ROLE_KEY el test se salta limpio (no muta Cloud); con él,
// escribe y limpia sus propias filas de sonda.
import { describe, it, expect } from "vitest";
import { supabaseAdmin, hasAdminClient, DEMO_TENANT, GARRIGUES_TENANT } from "@/test/helpers/supabase-test-client";

describe.skipIf(!hasAdminClient())("unicidad de code por grupo en risks/findings (migración 20260926119000)", () => {
  it("risks: rechaza código duplicado en el mismo tenant, permite el mismo código en otro tenant", async () => {
    const code = `TEST-DUP-RISK-${Date.now()}`;
    try {
      const { error: e1 } = await supabaseAdmin!
        .from("risks")
        .insert({ tenant_id: DEMO_TENANT, code, title: "Sonda MOI-190 ARGA" });
      expect(e1).toBeNull();

      const { error: eDup } = await supabaseAdmin!
        .from("risks")
        .insert({ tenant_id: DEMO_TENANT, code, title: "Sonda MOI-190 ARGA duplicada" });
      expect(eDup).not.toBeNull();
      expect(eDup!.code).toBe("23505");
      expect(eDup!.message).toMatch(/ux_risks_tenant_code/i);

      const { error: eOtroTenant } = await supabaseAdmin!
        .from("risks")
        .insert({ tenant_id: GARRIGUES_TENANT, code, title: "Sonda MOI-190 Garrigues" });
      expect(eOtroTenant).toBeNull();
    } finally {
      await supabaseAdmin!.from("risks").delete().eq("code", code);
    }
  });

  it("findings: rechaza código duplicado en el mismo tenant, permite el mismo código en otro tenant (ya no hay UNIQUE global)", async () => {
    const code = `TEST-DUP-FINDING-${Date.now()}`;
    try {
      const { error: e1 } = await supabaseAdmin!
        .from("findings")
        .insert({ tenant_id: DEMO_TENANT, code, title: "Sonda MOI-190 ARGA" });
      expect(e1).toBeNull();

      const { error: eDup } = await supabaseAdmin!
        .from("findings")
        .insert({ tenant_id: DEMO_TENANT, code, title: "Sonda MOI-190 ARGA duplicada" });
      expect(eDup).not.toBeNull();
      expect(eDup!.code).toBe("23505");
      expect(eDup!.message).toMatch(/ux_findings_tenant_code/i);
      expect(eDup!.message).not.toMatch(/findings_code_key/i);

      // Antes de esta migración esto fallaba con findings_code_key (UNIQUE global).
      const { error: eOtroTenant } = await supabaseAdmin!
        .from("findings")
        .insert({ tenant_id: GARRIGUES_TENANT, code, title: "Sonda MOI-190 Garrigues" });
      expect(eOtroTenant).toBeNull();
    } finally {
      await supabaseAdmin!.from("findings").delete().eq("code", code);
    }
  });
});
