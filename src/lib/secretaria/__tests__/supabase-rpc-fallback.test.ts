import { describe, expect, it } from "vitest";
import { getRpcJsonField, isMissingSupabaseRpcError } from "../supabase-rpc-fallback";

describe("supabase RPC fallback helpers", () => {
  it("detecta errores de RPC ausente en cache de esquema o firma inexistente", () => {
    expect(isMissingSupabaseRpcError({ message: "Could not find the function public.fn_x()" })).toBe(true);
    expect(isMissingSupabaseRpcError({ message: "function fn_x(uuid) does not exist" })).toBe(true);
    expect(isMissingSupabaseRpcError({ message: "The schema cache does not include fn_x" })).toBe(true);
  });

  it("no clasifica errores de negocio como fallback seguro", () => {
    expect(isMissingSupabaseRpcError({ message: "agreement not adopted" })).toBe(false);
    expect(isMissingSupabaseRpcError({ message: "p_tenant_id is required" })).toBe(false);
  });

  it("extrae campos string desde respuestas jsonb de RPC", () => {
    expect(getRpcJsonField({ agreement_id: "agreement-1" }, "agreement_id")).toBe("agreement-1");
    expect(getRpcJsonField({ agreement_id: "" }, "agreement_id")).toBeNull();
    expect(getRpcJsonField(null, "agreement_id")).toBeNull();
  });
});
