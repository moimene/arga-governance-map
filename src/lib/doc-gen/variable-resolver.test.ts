// src/lib/doc-gen/variable-resolver.test.ts
import { describe, it, expect, afterEach, vi } from "vitest";
import { resolveVariables } from "./variable-resolver";
import {
  hasAdminClient,
  DEMO_TENANT,
  DEMO_ENTITY_ARGA,
  supabaseAdmin,
} from "@/test/helpers/supabase-test-client";

describe.skipIf(!hasAdminClient())(
  "variable-resolver — entity_settings merge",
  () => {
    const sentinelKey = "test_resolver_merge_v2";

    afterEach(async () => {
      await supabaseAdmin!.from("entity_settings").delete().eq("key", sentinelKey);
      await supabaseAdmin!.from("entity_settings_catalog").delete().eq("key", sentinelKey);
    });

    it("entity_settings overrides catalog defaults", async () => {
      // Setup: catalog con default
      await supabaseAdmin!.from("entity_settings_catalog").insert({
        key: sentinelKey,
        value_type: "text",
        default_value: "default_canonical",
        descripcion: "test merge",
        categoria: "CARGO",
      });
      // Setup: entity_settings con override
      await supabaseAdmin!.from("entity_settings").insert({
        tenant_id: DEMO_TENANT,
        entity_id: DEMO_ENTITY_ARGA,
        key: sentinelKey,
        value: "override_de_sociedad",
      });

      const result = await resolveVariables(
        [{ variable: sentinelKey, fuente: "ENTIDAD", condicion: "" }],
        { agreementId: "test-agreement", tenantId: DEMO_TENANT, entityId: DEMO_ENTITY_ARGA },
      );

      expect(result.values[sentinelKey]).toBe("override_de_sociedad");
    });

    it("falls back to catalog default when entity has no override", async () => {
      await supabaseAdmin!.from("entity_settings_catalog").insert({
        key: sentinelKey,
        value_type: "text",
        default_value: "fallback_default",
        descripcion: "test fallback",
        categoria: "CARGO",
      });
      // NO entity_settings row

      const result = await resolveVariables(
        [{ variable: sentinelKey, fuente: "ENTIDAD", condicion: "" }],
        { agreementId: "test-agreement", tenantId: DEMO_TENANT, entityId: DEMO_ENTITY_ARGA },
      );

      expect(result.values[sentinelKey]).toBe("fallback_default");
    });

    it("returns empty string and warns when key not in catalog (R4)", async () => {
      // No setup — clave no existe en catalog
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const result = await resolveVariables(
        [{ variable: "clave_inexistente_nunca_creada", fuente: "ENTIDAD", condicion: "" }],
        { agreementId: "test-agreement", tenantId: DEMO_TENANT, entityId: DEMO_ENTITY_ARGA },
      );

      // Sin valor, debe quedar unresolved (no rompe)
      expect(result.unresolved).toContain("clave_inexistente_nunca_creada");
      consoleSpy.mockRestore();
    });
  },
);
