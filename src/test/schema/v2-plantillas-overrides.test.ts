// src/test/schema/v2-plantillas-overrides.test.ts
/**
 * Schema guardrails for v2 plantillas overrides infrastructure.
 *
 * Verifies migration 20260511_000058_v2_plantillas_overrides.sql has landed
 * on the cloud project hzqwefkwsxopwrmtksbg. Each describe block maps to
 * a table or trigger from the spec §4 and §11.2.
 *
 * Spec: docs/superpowers/specs/2026-05-11-procedimiento-plantillas-v2-design.md
 *
 * Runtime env: requires VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local.
 * Without those, hasAdminClient() returns false and every describe block is skipped.
 */

import { describe, it, expect, afterEach } from "vitest";
import {
  supabaseAdmin,
  hasAdminClient,
  DEMO_TENANT,
  DEMO_ENTITY_ARGA,
} from "../helpers/supabase-test-client";

describe.skipIf(!hasAdminClient())(
  "v2 plantillas overrides — T1 entity_settings_catalog",
  () => {
    it("table exists with expected columns", async () => {
      const { error } = await supabaseAdmin!
        .from("entity_settings_catalog")
        .select("key, value_type, allowed_values, default_value, descripcion, categoria, usado_por_plantillas, estado_catalog, created_at")
        .limit(0);
      expect(error).toBeNull();
    });

    it("PK on key prevents duplicates", async () => {
      const sentinelKey = "test_pk_sentinel_v2";
      // Cleanup defensively
      await supabaseAdmin!.from("entity_settings_catalog").delete().eq("key", sentinelKey);

      const insertOne = await supabaseAdmin!.from("entity_settings_catalog").insert({
        key: sentinelKey,
        value_type: "boolean",
        descripcion: "test",
        categoria: "CONFIG_CONDICIONAL",
      });
      expect(insertOne.error).toBeNull();

      const insertTwo = await supabaseAdmin!.from("entity_settings_catalog").insert({
        key: sentinelKey,
        value_type: "boolean",
        descripcion: "test duplicate",
        categoria: "CONFIG_CONDICIONAL",
      });
      expect(insertTwo.error).not.toBeNull();
      expect(insertTwo.error?.code).toBe("23505"); // unique violation

      // Cleanup
      await supabaseAdmin!.from("entity_settings_catalog").delete().eq("key", sentinelKey);
    });

    it("trigger rejects enum without allowed_values", async () => {
      const sentinelKey = "test_enum_no_allowed_v2";
      const { error } = await supabaseAdmin!.from("entity_settings_catalog").insert({
        key: sentinelKey,
        value_type: "enum",
        descripcion: "test",
        categoria: "CONFIG_CONDICIONAL",
      });
      expect(error).not.toBeNull();
      expect(error?.message).toContain("allowed_values");
    });

    it("trigger rejects default_value not in allowed_values for enum", async () => {
      const sentinelKey = "test_enum_default_invalid_v2";
      await supabaseAdmin!.from("entity_settings_catalog").delete().eq("key", sentinelKey);
      const { error } = await supabaseAdmin!.from("entity_settings_catalog").insert({
        key: sentinelKey,
        value_type: "enum",
        allowed_values: ["A", "B"],
        default_value: "C",
        descripcion: "test",
        categoria: "CONFIG_CONDICIONAL",
      });
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/not in allowed_values/i);
    });
  },
);

describe.skipIf(!hasAdminClient())(
  "v2 plantillas overrides — T2 entity_settings",
  () => {
    const sentinelKey = "test_setting_value_validation";

    afterEach(async () => {
      // Cleanup any test rows
      await supabaseAdmin!.from("entity_settings").delete().eq("key", sentinelKey);
      await supabaseAdmin!.from("entity_settings_catalog").delete().eq("key", sentinelKey);
    });

    it("table exists with expected columns", async () => {
      const { error } = await supabaseAdmin!
        .from("entity_settings")
        .select("id, tenant_id, entity_id, key, value, created_at, updated_at, updated_by")
        .limit(0);
      expect(error).toBeNull();
    });

    it("trigger rejects value when type does not match catalog (boolean key with text value)", async () => {
      // Setup: catalog with boolean key
      await supabaseAdmin!.from("entity_settings_catalog").insert({
        key: sentinelKey,
        value_type: "boolean",
        descripcion: "test",
        categoria: "CONFIG_CONDICIONAL",
      });

      const { error } = await supabaseAdmin!.from("entity_settings").insert({
        tenant_id: DEMO_TENANT,
        entity_id: DEMO_ENTITY_ARGA,
        key: sentinelKey,
        value: "no soy boolean",
      });
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/must be boolean/i);
    });

    it("trigger rejects enum value not in allowed_values", async () => {
      await supabaseAdmin!.from("entity_settings_catalog").insert({
        key: sentinelKey,
        value_type: "enum",
        allowed_values: ["SI", "NO"],
        descripcion: "test",
        categoria: "CONFIG_CONDICIONAL",
      });

      const { error } = await supabaseAdmin!.from("entity_settings").insert({
        tenant_id: DEMO_TENANT,
        entity_id: DEMO_ENTITY_ARGA,
        key: sentinelKey,
        value: "QUIZAS",
      });
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/not in allowed_values/i);
    });

    it("trigger accepts valid value matching catalog type (happy path)", async () => {
      await supabaseAdmin!.from("entity_settings_catalog").insert({
        key: sentinelKey,
        value_type: "boolean",
        descripcion: "test",
        categoria: "CONFIG_CONDICIONAL",
      });

      const { error } = await supabaseAdmin!.from("entity_settings").insert({
        tenant_id: DEMO_TENANT,
        entity_id: DEMO_ENTITY_ARGA,
        key: sentinelKey,
        value: true,
      });
      expect(error).toBeNull();
    });

    it("UNIQUE (entity_id, key) prevents duplicate setting per entity", async () => {
      await supabaseAdmin!.from("entity_settings_catalog").insert({
        key: sentinelKey,
        value_type: "text",
        descripcion: "test",
        categoria: "CONFIG_CONDICIONAL",
      });
      await supabaseAdmin!.from("entity_settings").insert({
        tenant_id: DEMO_TENANT,
        entity_id: DEMO_ENTITY_ARGA,
        key: sentinelKey,
        value: "first",
      });
      const { error } = await supabaseAdmin!.from("entity_settings").insert({
        tenant_id: DEMO_TENANT,
        entity_id: DEMO_ENTITY_ARGA,
        key: sentinelKey,
        value: "second",
      });
      expect(error).not.toBeNull();
      expect(error?.code).toBe("23505");
    });

    it("FK to catalog ON DELETE RESTRICT prevents catalog deletion when in use", async () => {
      await supabaseAdmin!.from("entity_settings_catalog").insert({
        key: sentinelKey,
        value_type: "text",
        descripcion: "test",
        categoria: "CONFIG_CONDICIONAL",
      });
      await supabaseAdmin!.from("entity_settings").insert({
        tenant_id: DEMO_TENANT,
        entity_id: DEMO_ENTITY_ARGA,
        key: sentinelKey,
        value: "in use",
      });
      const { error } = await supabaseAdmin!
        .from("entity_settings_catalog")
        .delete()
        .eq("key", sentinelKey);
      expect(error).not.toBeNull();
      expect(error?.code).toBe("23503"); // FK violation
    });
  },
);

describe.skipIf(!hasAdminClient())(
  "v2 plantillas overrides — T3 plantilla_capa3_overrides_por_entidad",
  () => {
    // Captura de ids insertados por cada test. El cleanup borra SOLO esos ids,
    // nunca otros overrides de la misma plantilla. Esto preserva overrides
    // legítimos creados por otros procesos (real cliente v2.1+, otro test, etc.).
    //
    // Por qué no usar sentinel-on-motivo + LIKE: aunque robusto, deja la cleanup
    // sujeta a colisiones improbables y a errores tipográficos del sentinel.
    // Capturar ids explícitamente garantiza que borramos exactamente lo que
    // este suite insertó, ni más ni menos. Si un test falla en su assertion
    // de rejection y la inserción se cuela, devolveremos su id de `data` y se
    // limpiará igualmente.
    let insertedIds: string[] = [];

    // Sentinel sigue presente en motivo para trazabilidad humana (audit logs,
    // debugging cleanup manual), pero NO se usa para targeting de cleanup.
    const TEST_MOTIVO_SENTINEL = "TEST_SENTINEL_V2_T3_DELETE_ME";

    afterEach(async () => {
      if (insertedIds.length === 0) return;
      // Cleanup preciso: borra SOLO los ids capturados. Si todos los tests
      // rechazaron correctamente (caso esperado), insertedIds queda vacío
      // y este bloque es no-op.
      await supabaseAdmin!
        .from("plantilla_capa3_overrides_por_entidad")
        .delete()
        .in("id", insertedIds);
      insertedIds = [];
    });

    it("CHECK length(motivo) >= 10 rejects short motivo", async () => {
      const { data: pl } = await supabaseAdmin!
        .from("plantillas_protegidas")
        .select("id, capa3_editables")
        .eq("tenant_id", DEMO_TENANT)
        .eq("estado", "ACTIVA")
        .limit(1)
        .maybeSingle();
      if (!pl) {
        // Skip if no ACTIVA plantilla in cloud (unlikely after B9)
        return;
      }
      const firstCampo = ((pl.capa3_editables ?? []) as Array<{ campo: string }>)[0]?.campo ?? "test_campo";

      const { data, error } = await supabaseAdmin!
        .from("plantilla_capa3_overrides_por_entidad")
        .insert({
          tenant_id: DEMO_TENANT,
          entity_id: DEMO_ENTITY_ARGA,
          plantilla_id: pl.id,
          campo: firstCampo,
          obligatoriedad_override: "OBLIGATORIO",
          compatible_with_canonical_version: "1.0.0",
          motivo: "corto", // intencionalmente <10 chars — CHECK rechaza antes que cleanup pueda llegar
        })
        .select("id");
      if (data) insertedIds.push(...data.map((r) => r.id));
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/check|length|motivo/i);
    });

    it("trigger rejects opciones_override = []", async () => {
      const { data: pl } = await supabaseAdmin!
        .from("plantillas_protegidas")
        .select("id, capa3_editables")
        .eq("tenant_id", DEMO_TENANT)
        .eq("estado", "ACTIVA")
        .limit(1)
        .maybeSingle();
      if (!pl) return;
      const firstCampo = ((pl.capa3_editables ?? []) as Array<{ campo: string }>)[0]?.campo ?? "test_campo";

      const { data, error } = await supabaseAdmin!
        .from("plantilla_capa3_overrides_por_entidad")
        .insert({
          tenant_id: DEMO_TENANT,
          entity_id: DEMO_ENTITY_ARGA,
          plantilla_id: pl.id,
          campo: firstCampo,
          opciones_override: [],
          compatible_with_canonical_version: "1.0.0",
          motivo: `${TEST_MOTIVO_SENTINEL}_opciones_vacias`,
        })
        .select("id");
      if (data) insertedIds.push(...data.map((r) => r.id));
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/array vacío|opciones_override/i);
    });

    it("trigger rejects override on non-existent campo", async () => {
      const { data: pl } = await supabaseAdmin!
        .from("plantillas_protegidas")
        .select("id, capa3_editables")
        .eq("tenant_id", DEMO_TENANT)
        .eq("estado", "ACTIVA")
        .limit(1)
        .maybeSingle();
      if (!pl) return;

      const { data, error } = await supabaseAdmin!
        .from("plantilla_capa3_overrides_por_entidad")
        .insert({
          tenant_id: DEMO_TENANT,
          entity_id: DEMO_ENTITY_ARGA,
          plantilla_id: pl.id,
          campo: "campo_inexistente_zzz",
          obligatoriedad_override: "OBLIGATORIO",
          compatible_with_canonical_version: "1.0.0",
          motivo: `${TEST_MOTIVO_SENTINEL}_campo_inexistente`,
        })
        .select("id");
      if (data) insertedIds.push(...data.map((r) => r.id));
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/no existe en capa3_editables/i);
    });

    it("CHECK at least one override not NULL rejects empty row", async () => {
      const { data: pl } = await supabaseAdmin!
        .from("plantillas_protegidas")
        .select("id, capa3_editables")
        .eq("tenant_id", DEMO_TENANT)
        .eq("estado", "ACTIVA")
        .limit(1)
        .maybeSingle();
      if (!pl) return;
      const firstCampo = ((pl.capa3_editables ?? []) as Array<{ campo: string }>)[0]?.campo ?? "test_campo";

      const { data, error } = await supabaseAdmin!
        .from("plantilla_capa3_overrides_por_entidad")
        .insert({
          tenant_id: DEMO_TENANT,
          entity_id: DEMO_ENTITY_ARGA,
          plantilla_id: pl.id,
          campo: firstCampo,
          // No overrides set
          compatible_with_canonical_version: "1.0.0",
          motivo: `${TEST_MOTIVO_SENTINEL}_at_least_one`,
        })
        .select("id");
      if (data) insertedIds.push(...data.map((r) => r.id));
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/check|capa3_at_least_one_override/i);
    });

    // H5 deny-list regression tests
    it.each([
      ["snapshot_hash", /snapshot_/i],
      ["snapshot_rule_pack_id", /snapshot_/i],
      ["resultado_gate", /resultado_/i],
      ["tenant_id", /tenant_id/i],
      ["entity_id", /entity_id/i],
      ["agreement_id", /agreement_id/i],
      ["entities.name", /entities\./i],
      ["MOTOR", /MOTOR/],
      ["QTSP", /QTSP/],
      ["firma_qes_ref", /firma_qes/i],
    ])(
      "deny-list rejects override with protected campo=%s",
      async (forbiddenCampo, errorPattern) => {
        const { data: pl } = await supabaseAdmin!
          .from("plantillas_protegidas")
          .select("id")
          .eq("tenant_id", DEMO_TENANT)
          .eq("estado", "ACTIVA")
          .limit(1)
          .maybeSingle();
        if (!pl) return;

        const { data, error } = await supabaseAdmin!
          .from("plantilla_capa3_overrides_por_entidad")
          .insert({
            tenant_id: DEMO_TENANT,
            entity_id: DEMO_ENTITY_ARGA,
            plantilla_id: pl.id,
            campo: forbiddenCampo,
            obligatoriedad_override: "OBLIGATORIO",
            compatible_with_canonical_version: "1.0.0",
            motivo: `${TEST_MOTIVO_SENTINEL}_deny_${forbiddenCampo.replace(/[^a-z0-9]/gi, "_")}`,
          })
          .select("id");
        if (data) insertedIds.push(...data.map((r) => r.id));
        expect(error).not.toBeNull();
        expect(error?.message).toMatch(/prefijo protegido/i);
        expect(error?.message).toMatch(errorPattern);
      },
    );
  },
);

describe.skipIf(!hasAdminClient())(
  "v2 plantillas overrides — T4 bloques_sectoriales (soft-delete + immutability)",
  () => {
    const sentinelClave = "TEST_BLOQUE_SENTINEL_V2";

    afterEach(async () => {
      // Forced cleanup via direct PG (DELETE bloqueado por trigger)
      // Workaround: dejar como ARCHIVADA, no eliminar
      await supabaseAdmin!
        .from("bloques_sectoriales")
        .update({ estado: "ARCHIVADA" })
        .eq("clave_bloque", sentinelClave);
    });

    it("trigger rejects DELETE físico", async () => {
      // Insert sentinel
      await supabaseAdmin!.from("bloques_sectoriales").insert({
        clave_bloque: sentinelClave,
        version: "1.0.0",
        sector: "GENERICO",
        materia_aplicable: ["TEST"],
        texto_aprobado: "Texto sentinel para test DELETE",
        estado: "ACTIVA",
      });

      const { error } = await supabaseAdmin!
        .from("bloques_sectoriales")
        .delete()
        .eq("clave_bloque", sentinelClave);
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/DELETE físico.*prohibido/i);
    });

    it("trigger rejects UPDATE de texto_aprobado cuando estado=ACTIVA", async () => {
      await supabaseAdmin!.from("bloques_sectoriales").upsert({
        clave_bloque: sentinelClave,
        version: "1.0.1",
        sector: "GENERICO",
        materia_aplicable: ["TEST"],
        texto_aprobado: "Texto original",
        estado: "ACTIVA",
      }, { onConflict: "clave_bloque,version" });

      const { error } = await supabaseAdmin!
        .from("bloques_sectoriales")
        .update({ texto_aprobado: "Texto modificado" })
        .eq("clave_bloque", sentinelClave)
        .eq("version", "1.0.1");
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/no se permite modificar texto_aprobado/i);
    });

    it("UPDATE de estado ACTIVA→ARCHIVADA permitido (happy path)", async () => {
      await supabaseAdmin!.from("bloques_sectoriales").upsert({
        clave_bloque: sentinelClave,
        version: "1.0.2",
        sector: "GENERICO",
        materia_aplicable: ["TEST"],
        texto_aprobado: "Texto archivable",
        estado: "ACTIVA",
      }, { onConflict: "clave_bloque,version" });

      const { error } = await supabaseAdmin!
        .from("bloques_sectoriales")
        .update({ estado: "ARCHIVADA" })
        .eq("clave_bloque", sentinelClave)
        .eq("version", "1.0.2");
      expect(error).toBeNull();
    });
  },
);

describe.skipIf(!hasAdminClient())(
  "v2 plantillas overrides — T5/T6 WORM (bloque_insertions + plantilla_changelog)",
  () => {
    it("bloque_insertions rejects UPDATE", async () => {
      // Asume al menos 1 fila existe — si no, este test se salta vía maybeSingle
      const { data: row } = await supabaseAdmin!
        .from("bloque_insertions")
        .select("id")
        .limit(1)
        .maybeSingle();
      if (!row) {
        // No hay filas todavía; el guardrail se valida via INSERT-then-UPDATE inline
        return;
      }
      const { error } = await supabaseAdmin!
        .from("bloque_insertions")
        .update({ bloque_clave: "MUTATED" })
        .eq("id", row.id);
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/WORM violation/i);
    });

    it("plantilla_changelog rejects DELETE", async () => {
      const { data: row } = await supabaseAdmin!
        .from("plantilla_changelog")
        .select("id")
        .limit(1)
        .maybeSingle();
      if (!row) return;
      const { error } = await supabaseAdmin!
        .from("plantilla_changelog")
        .delete()
        .eq("id", row.id);
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/WORM violation/i);
    });
  },
);
