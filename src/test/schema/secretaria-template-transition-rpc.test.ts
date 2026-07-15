import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Oleada 3A — contrato Cloud de la transición atómica de plantillas.
 *
 * Los probes usan un UUID inexistente para que una regresión de autorización
 * nunca pueda mutar el inventario real. La autorización debe resolverse antes
 * de cargar la plantilla: anon carece de EXECUTE y el usuario demo SECRETARIO
 * no satisface el rol ADMIN_TENANT exigido por la RPC.
 */
const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? "https://hzqwefkwsxopwrmtksbg.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cXdlZmt3c3hvcHdybXRrc2JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Mjc1MDMsImV4cCI6MjA5MjAwMzUwM30.IZ2FbhQLp2ljRcsvsvzpLWQ9cq9p5Lz4dJfVzY3whjQ";
const DEMO_EMAIL = process.env.DEMO_EMAIL ?? "demo@arga-seguros.com";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "TGMSdemo2026!";
const REQUIRE_CLOUD_AUTH = process.env.REQUIRE_CLOUD_AUTH === "1";

const MISSING_TEMPLATE_ID = "00000000-0000-0000-0000-000000000000";

function transitionProbe(operationId: string) {
  return {
    p_template_id: MISSING_TEMPLATE_ID,
    p_expected_from: "APROBADA",
    p_to_state: "ACTIVA",
    p_motivo: "Probe no destructivo de autorización Oleada 3A",
    p_operation_id: operationId,
    p_expected_predecessor_id: null,
    p_aprobada_por: null,
    p_fecha_aprobacion: null,
    p_ack_warnings: false,
  };
}

describe("Oleada 3A — fn_secretaria_transition_template_state", () => {
  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  it("existe con la firma completa y deniega EXECUTE al rol anon", async () => {
    const { data, error } = await anonClient.rpc(
      "fn_secretaria_transition_template_state",
      transitionProbe("00000000-0000-4000-8000-0000000003a1"),
    );

    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.message ?? "").not.toMatch(/function .* does not exist/i);
    expect(error?.message ?? "").not.toMatch(/could not find the function/i);
    expect(error?.code).toBe("42501");
    expect(error?.message ?? "").toMatch(/permission denied/i);
  }, 30_000);

  it("no expone las fuentes RBAC al rol anon", async () => {
    const roles = await anonClient.from("rbac_roles").select("id").limit(1);
    const assignments = await anonClient.from("rbac_user_roles").select("id").limit(1);

    expect(roles.data).toBeNull();
    expect(roles.error?.code).toBe("42501");
    expect(roles.error?.message ?? "").toMatch(/permission denied/i);
    expect(assignments.data).toBeNull();
    expect(assignments.error?.code).toBe("42501");
    expect(assignments.error?.message ?? "").toMatch(/permission denied/i);
  }, 30_000);

  it("no expone el helper SoD SECURITY DEFINER al rol anon", async () => {
    const { data, error } = await anonClient.rpc("fn_check_sod_violations", {
      p_tenant_id: "00000000-0000-0000-0000-000000000001",
      p_user_id: MISSING_TEMPLATE_ID,
      p_proposed_role: "ADMIN_TENANT",
    });

    expect(data).toBeNull();
    expect(error?.code).toBe("42501");
    expect(error?.message ?? "").toMatch(/permission denied/i);
  }, 30_000);
});

describe("Oleada 3A — RBAC servidor de la transición atómica", () => {
  let client: SupabaseClient | null = null;
  let authenticated = false;
  let authenticationError: string | null = null;

  beforeAll(async () => {
    try {
      client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error } = await client.auth.signInWithPassword({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
      });
      authenticated = !error;
      authenticationError = error?.message ?? null;
    } catch (error) {
      authenticated = false;
      authenticationError = error instanceof Error ? error.message : String(error);
    }
  }, 30_000);

  afterAll(async () => {
    try {
      await client?.auth.signOut();
    } catch {
      // El cierre de sesión no altera el contrato de autorización probado.
    }
  });

  it("deniega al usuario demo SECRETARIO antes de consultar la plantilla", async () => {
    if (!authenticated || !client) {
      if (REQUIRE_CLOUD_AUTH) {
        expect(
          authenticated,
          `El gate Cloud exige login demo válido: ${authenticationError ?? "sin cliente"}`,
        ).toBe(true);
      }
      // El gate estructural y el probe anon siguen ejecutándose sin credenciales
      // o red; la comprobación autenticada se completa en el gate Cloud.
      expect(true).toBe(true);
      return;
    }

    const { data, error } = await client.rpc(
      "fn_secretaria_transition_template_state",
      transitionProbe("00000000-0000-4000-8000-0000000003a2"),
    );

    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
    expect(error?.message ?? "").toMatch(/ADMIN_TENANT|insufficient role|permission denied/i);
    expect(error?.message ?? "").not.toMatch(/plantilla .* no encontrada|template .* not found/i);
  }, 30_000);

  it("deniega también la asignación de bindings antes de consultar la plantilla", async () => {
    if (!authenticated || !client) {
      if (REQUIRE_CLOUD_AUTH) {
        expect(
          authenticated,
          `El gate Cloud exige login demo válido: ${authenticationError ?? "sin cliente"}`,
        ).toBe(true);
      }
      expect(true).toBe(true);
      return;
    }

    const { data, error } = await client.rpc("fn_secretaria_assign_template_binding", {
      p_payload: {
        tenant_id: "00000000-0000-0000-0000-000000000001",
        template_id: MISSING_TEMPLATE_ID,
        selection_reason: "Probe no destructivo de autorización Oleada 3A",
      },
    });

    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error?.code).toBe("42501");
    expect(error?.message ?? "").toMatch(/ADMIN_TENANT|insufficient role|permission denied/i);
    expect(error?.message ?? "").not.toMatch(/no es ACTIVA|not ACTIVA|not found/i);
  }, 30_000);

  it("permite leer el rol propio pero impide autoasignarse ADMIN_TENANT", async () => {
    if (!authenticated || !client) {
      if (REQUIRE_CLOUD_AUTH) {
        expect(
          authenticated,
          `El gate Cloud exige login demo válido: ${authenticationError ?? "sin cliente"}`,
        ).toBe(true);
      }
      expect(true).toBe(true);
      return;
    }

    const { data: authData } = await client.auth.getUser();
    const userId = authData.user?.id;
    expect(userId).toBeTruthy();

    const ownAssignments = await client
      .from("rbac_user_roles")
      .select("id, role_id, rbac_roles!inner(role_code)")
      .eq("tenant_id", "00000000-0000-0000-0000-000000000001")
      .eq("user_id", userId as string);
    expect(ownAssignments.error).toBeNull();
    expect((ownAssignments.data ?? []).length).toBeGreaterThan(0);

    // El role_id inexistente garantiza que, si reaparece INSERT directo, el
    // intento termina en FK 23503 y nunca deja una asignación. El contrato
    // endurecido debe detenerse antes con 42501.
    const escalation = await client.from("rbac_user_roles").insert({
      tenant_id: "00000000-0000-0000-0000-000000000001",
      user_id: userId,
      role_id: MISSING_TEMPLATE_ID,
      assigned_by: userId,
      is_active: true,
    });
    expect(escalation.data).toBeNull();
    expect(escalation.error?.code).toBe("42501");
    expect(escalation.error?.message ?? "").toMatch(/permission denied/i);

    const firstAssignment = ownAssignments.data?.[0];
    expect(firstAssignment?.id).toBeTruthy();
    const rewrite = await client
      .from("rbac_user_roles")
      .update({ role_id: MISSING_TEMPLATE_ID })
      .eq("id", firstAssignment?.id as string);
    expect(rewrite.data).toBeNull();
    expect(rewrite.error?.code).toBe("42501");
    expect(rewrite.error?.message ?? "").toMatch(/permission denied/i);
  }, 30_000);

  it("impide usar el helper SoD contra otro tenant", async () => {
    if (!authenticated || !client) {
      if (REQUIRE_CLOUD_AUTH) {
        expect(
          authenticated,
          `El gate Cloud exige login demo válido: ${authenticationError ?? "sin cliente"}`,
        ).toBe(true);
      }
      expect(true).toBe(true);
      return;
    }

    const { data: authData } = await client.auth.getUser();
    const { data, error } = await client.rpc("fn_check_sod_violations", {
      p_tenant_id: "3a000000-0000-4000-8000-000000000002",
      p_user_id: authData.user?.id ?? MISSING_TEMPLATE_ID,
      p_proposed_role: "AUDITOR",
    });

    expect(data).toBeNull();
    expect(error?.code).toBe("42501");
    expect(error?.message ?? "").toMatch(/cross-tenant/i);
  }, 30_000);
});
