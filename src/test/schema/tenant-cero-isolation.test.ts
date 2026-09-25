// src/test/schema/tenant-cero-isolation.test.ts
//
// Gate de salida del `tenant-bootstrap`: el tenant en blanco queda AISLADO de
// ARGA y de Garrigues en las dos direcciones, y nace con su suelo jurídico.
//
// ESTADO DECLARADO, NO SONDEADO. El tenant solo existe en Cloud después de
// ejecutar el bootstrap con `--commit`. Mientras `spec.cloud` diga PENDIENTE, el
// gate se reporta como `todo` —visible en la corrida, con su motivo— en vez de
// saltarse en verde o de poner en rojo una suite compartida por algo que nadie
// ha ejecutado todavía. Cuando diga PROVISIONADO corre de verdad, y `sesionDe`
// LANZA si no puede autenticar: a partir de ahí, no poder mirar es un rojo.
import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEMO_TENANT,
  GARRIGUES_TENANT,
  NUEVO_DEMO_EMAIL,
  NUEVO_TENANT,
  sesionDe,
} from "../helpers/supabase-test-client";
import { TENANT_SPECS } from "../../../scripts/tenants/tenant-spec";
import { cargarPackBase, packIdPara } from "../../../scripts/tenants/bootstrap-lib";

const spec = TENANT_SPECS.nuevo;
const PROVISIONADO = spec.cloud === "PROVISIONADO";

describe("tenant cero — coherencia del instrumento", () => {
  it("las constantes del helper de tests no divergen del catálogo", () => {
    expect(NUEVO_TENANT).toBe(spec.tenantId);
    expect(spec.users.find((u) => u.role === "SECRETARIO")?.email).toBe(NUEVO_DEMO_EMAIL);
  });

  it("el estado del tenant en Cloud está declarado", () => {
    expect(["PENDIENTE", "PROVISIONADO"]).toContain(spec.cloud);
  });
});

// Tablas con `tenant_id` que el tenant en blanco NO debe poder leer de otros.
// ARGA tiene filas en todas: «el tenant nuevo no ve nada ajeno» asierta de verdad.
const TABLAS_AJENAS = [
  "entities", "persons", "governing_bodies", "agreements", "rule_packs",
  "plantillas_protegidas", "jurisdiction_rule_sets", "policies", "obligations",
  "controls", "risks", "findings", "delegations", "ai_systems", "grc_modules",
];

// Tablas donde el bootstrap deja dato PROPIO del tenant: ahí la dirección
// contraria («ARGA y Garrigues no ven lo del tenant nuevo») deja de ser vacua.
const TABLAS_CON_DATO_PROPIO = ["rule_packs", "plantillas_protegidas", "jurisdiction_rule_sets", "grc_modules"];

if (!PROVISIONADO) {
  describe("tenant cero — aislamiento RLS a tres tenants", () => {
    it.todo(
      `pendiente de \`bun run scripts/tenant-bootstrap.ts --tenant ${spec.key} --commit\`; ` +
        "después, declarar cloud: \"PROVISIONADO\" en scripts/tenants/tenant-spec.ts",
    );
  });
} else {
  describe("tenant cero — aislamiento RLS a tres tenants", () => {
    let nuevo: SupabaseClient;
    let arga: SupabaseClient;
    let garr: SupabaseClient;
    const pack = cargarPackBase();

    beforeAll(async () => {
      [nuevo, arga, garr] = await Promise.all([sesionDe("NUEVO"), sesionDe("ARGA"), sesionDe("GARRIGUES")]);
    }, 45_000);

    it("el perfil de la cuenta resuelve a su tenant, como SECRETARIO", async () => {
      const { data, error } = await nuevo.from("user_profiles").select("tenant_id, role_code").maybeSingle();
      expect(error).toBeNull();
      expect(data?.tenant_id).toBe(NUEVO_TENANT);
      expect(data?.role_code).toBe("SECRETARIO");
    });

    for (const tabla of TABLAS_AJENAS) {
      it(`${tabla}: el tenant nuevo no ve filas de ARGA ni de Garrigues`, async () => {
        const { data, error } = await nuevo.from(tabla).select("tenant_id").neq("tenant_id", NUEVO_TENANT).limit(5);
        expect(error).toBeNull();
        expect(data ?? []).toEqual([]);
      });
    }

    for (const tabla of TABLAS_CON_DATO_PROPIO) {
      it(`${tabla}: ARGA y Garrigues no ven filas del tenant nuevo (con control positivo)`, async () => {
        // Control positivo: el propio tenant SÍ ve filas suyas. Sin él, «los
        // otros no ven nada» pasaría igual con la tabla vacía.
        const propias = await nuevo.from(tabla).select("tenant_id").eq("tenant_id", NUEVO_TENANT).limit(1);
        expect(propias.error).toBeNull();
        expect((propias.data ?? []).length, `${tabla} sin dato propio: el bootstrap no terminó`).toBe(1);
        for (const [quien, cliente] of [["ARGA", arga], ["Garrigues", garr]] as const) {
          const { data, error } = await cliente.from(tabla).select("tenant_id").eq("tenant_id", NUEVO_TENANT).limit(1);
          expect(error, quien).toBeNull();
          expect(data ?? [], `${quien} ve filas del tenant nuevo en ${tabla}`).toEqual([]);
        }
      });
    }

    it("el tenant nace con el pack base completo y con MATERIAS canónicas", async () => {
      const { data, error } = await nuevo
        .from("rule_packs")
        .select("id, materia, rule_pack_versions!inner(version, is_active)")
        .eq("rule_pack_versions.is_active", true);
      expect(error).toBeNull();
      const filas = data ?? [];
      expect(filas.length).toBe(pack.rulePacks.length);
      const porId = new Map(filas.map((f) => [f.id as string, f.materia as string]));
      for (const p of pack.rulePacks) {
        // Id con prefijo, materia SIN prefijo: el motor resuelve por materia.
        expect(porId.get(packIdPara(spec, p.source_id)), p.source_id).toBe(p.materia);
      }
      const activas = await nuevo.from("plantillas_protegidas").select("id", { count: "exact", head: true }).eq("estado", "ACTIVA");
      expect(activas.error).toBeNull();
      expect(activas.count).toBe(pack.plantillas.length);
    });

    it("una escritura cruzada no muta nada (RLS la filtra sin error)", async () => {
      // Se intenta reescribir un pack de ARGA CON SU MISMO VALOR: si el
      // aislamiento fallase, el test lo detecta (la UPDATE devolvería la fila)
      // sin haber alterado el dato de ARGA. GOTCHA: un write filtrado por RLS
      // devuelve 0 filas SIN error, no 42501.
      const original = await arga.from("rule_packs").select("id, descripcion").eq("tenant_id", DEMO_TENANT).limit(1).maybeSingle();
      expect(original.error).toBeNull();
      expect(original.data?.id).toBeTruthy();
      const intento = await nuevo
        .from("rule_packs")
        .update({ descripcion: original.data!.descripcion })
        .eq("id", original.data!.id)
        .select("id");
      expect(intento.data ?? []).toEqual([]);
    });

    it("Garrigues sigue sin ver a ARGA: añadir un tenant no abrió nada", async () => {
      const { data, error } = await garr.from("entities").select("tenant_id").neq("tenant_id", GARRIGUES_TENANT).limit(1);
      expect(error).toBeNull();
      expect(data ?? []).toEqual([]);
    });
  });
}
