import { describe, expect, it } from "vitest";
import { sesionDe } from "../helpers/supabase-test-client";

describe("MOI-219 — fn_promover_sociedad_operativa live behavioral probe", () => {
  const TENANT_NUEVO = "00000000-0000-0000-0000-000000000003";
  const ID_FILIAL_A = "7ea1d208-6c67-4021-baf4-ecb9de2abacd"; // Servicios Nuevos Integrales, S.L.U. (ADMIN_UNICO)
  const ID_FILIAL_B = "9d209ef6-ca87-44d4-a12c-86f12a0ea368"; // Tecnología e Innovación Nueva, S.L. (ADMIN_SOLIDARIOS)
  const ID_NON_EXISTENT = "00000000-0000-0000-0000-ffffffffffff";

  it("idempotently handles Filial A (ADMINISTRADOR_UNICO) already OPERATIVA and returns its forma_administracion", async () => {
    const client = await sesionDe("NUEVO");
    const { data, error } = await client.rpc("fn_promover_sociedad_operativa", {
      p_tenant_id: TENANT_NUEVO,
      p_entity_id: ID_FILIAL_A,
    });

    expect(error).toBeNull();
    expect(data).toMatchObject({
      ok: true,
      already_operativa: true,
      entity_id: ID_FILIAL_A,
      forma_administracion: "ADMINISTRADOR_UNICO",
    });
  });

  it("idempotently handles Filial B (ADMINISTRADORES_SOLIDARIOS) already OPERATIVA and returns its forma_administracion", async () => {
    const client = await sesionDe("NUEVO");
    const { data, error } = await client.rpc("fn_promover_sociedad_operativa", {
      p_tenant_id: TENANT_NUEVO,
      p_entity_id: ID_FILIAL_B,
    });

    expect(error).toBeNull();
    expect(data).toMatchObject({
      ok: true,
      already_operativa: true,
      entity_id: ID_FILIAL_B,
      forma_administracion: "ADMINISTRADORES_SOLIDARIOS",
    });
  });

  it("rejects promotion of a non-existent entity with no_data_found", async () => {
    const client = await sesionDe("NUEVO");
    const { data, error } = await client.rpc("fn_promover_sociedad_operativa", {
      p_tenant_id: TENANT_NUEVO,
      p_entity_id: ID_NON_EXISTENT,
    });

    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/entity .* not found in tenant/);
  });
});
