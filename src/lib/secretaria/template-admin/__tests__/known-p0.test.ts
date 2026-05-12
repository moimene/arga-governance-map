import { describe, it, expect } from "vitest";
import { supabaseAdmin, hasAdminClient, DEMO_TENANT } from "@/test/helpers/supabase-test-client";
import { KNOWN_P0_TEMPLATES, isKnownP0 } from "../known-p0";

describe.skipIf(!hasAdminClient())("known-p0 Cloud existence", () => {
  it("cada ID conocido existe en plantillas_protegidas y está ACTIVA", async () => {
    for (const p of KNOWN_P0_TEMPLATES) {
      const { data, error } = await supabaseAdmin!
        .from("plantillas_protegidas")
        .select("id, estado, materia, materia_acuerdo, organo_tipo")
        .eq("id", p.id)
        .eq("tenant_id", DEMO_TENANT)
        .maybeSingle();

      expect(error, `lookup error for ${p.id}`).toBeNull();
      expect(data, `${p.id} (${p.materia}) no encontrada en Cloud`).not.toBeNull();
      expect(data?.estado, `${p.id} debe estar ACTIVA`).toBe("ACTIVA");
      const materia = (data?.materia_acuerdo ?? data?.materia) as string;
      expect(materia).toBe(p.materia);
      expect(data?.organo_tipo).toBe(p.organo);
    }
  });

  it("isKnownP0 reconoce los IDs y rechaza otros", () => {
    expect(isKnownP0("e3697ad9-e0c2-4baf-9144-c80a11808c07")).toBe(true);
    expect(isKnownP0("edd5c389-0187-476c-9592-c020058fdc69")).toBe(true);
    expect(isKnownP0("00000000-0000-0000-0000-000000000000")).toBe(false);
  });
});
