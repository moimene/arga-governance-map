// src/test/schema/garrigues-admin-unico-certificacion.test.ts
// G3 Task 6 (Step 5, controller) — contrato de la cadena de certificación del
// administrador único (art. 109 RRM; art. 31.3 Estatutos: cualquier
// administrador sin delegación expresa).
//
// La RPC vigente fn_generar_certificacion (20260720120000:3736) valida en este
// orden: capability → acta apta (signed/locked/APPROVED_SIGNED/posted) →
// autoridad del certificante → VºBº. Hoy NO existe ningún acta apta de la
// matriz Garrigues, así que la rama del VºBº no es alcanzable end-to-end; el
// contrato que SÍ podemos afirmar sin fabricar dato: la llamada con
// p_certificante_role='ADMIN_UNICO' y p_visto_bueno_persona_id=NULL es
// aceptada en forma (la RPC existe con esa firma y el fallo es del acta
// inexistente, NUNCA de VºBº). El positivo de la rama (rechazo de VºBº
// no-nulo para no-secretarios) queda para la verificación viva de Task 9
// cuando exista acta apta. Patrón graceful-skip de garrigues-gobierno-seed.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { GARRIGUES_DEMO_EMAIL, sesionDe } from "../helpers/supabase-test-client";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://hzqwefkwsxopwrmtksbg.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cXdlZmt3c3hvcHdybXRrc2JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Mjc1MDMsImV4cCI6MjA5MjAwMzUwM30.IZ2FbhQLp2ljRcsvsvzpLWQ9cq9p5Lz4dJfVzY3whjQ";

// UUID sintáctico válido que no existe como acta (probe de contrato, no de dato).
const DUMMY_MINUTE_ID = "00000000-dead-4bee-8000-000000000001";

describe("G3 — contrato RPC de certificación del administrador único", () => {
  let garr: SupabaseClient | null = null;
  let authed = false;

  beforeAll(async () => {
    try {
      // Sesión COMPARTIDA: 2 logins en toda la suite, storageKey por cuenta.
      garr = await sesionDe("GARRIGUES");
      authed = true;
    } catch (error) {
      authed = false;
      // UN LOGIN FALLIDO NO ES «NADA QUE COMPROBAR». Al tragarse la excepción,
      // cada `it` de abajo caía en `if (!authed) { expect(true).toBe(true); return; }`
      // y la sonda Cloud terminaba VERDE sin asertar nada: rotar una contraseña
      // o caerse Cloud dejaba el gate en verde mudo. `sesionDe` ya lanza con el
      // motivo; aquí se propaga para que el fichero se ponga ROJO.
      throw error;
    }
  }, 30_000);

  // SIN afterAll con signOut: la sesión es COMPARTIDA. Cerrarla aquí dejaría sin
  // autenticar a las sondas posteriores, y el síntoma serían consultas vacías
  // en un fichero que no ha hecho nada mal.

  it("ADMIN_UNICO con VºBº NULL no es rechazado por VºBº (falla por acta, nunca por 'approval')", async () => {
    if (!authed || !garr) { expect(true).toBe(true); return; }
    const { error } = await garr.rpc("fn_generar_certificacion", {
      p_minute_id: DUMMY_MINUTE_ID,
      p_tipo: "CERTIFICACION_ACTA",
      p_agreements_certified: [],
      p_certificante_role: "ADMIN_UNICO",
      p_visto_bueno_persona_id: null,
    });
    // El acta dummy no existe: DEBE fallar — pero por el acta, no por el VºBº.
    expect(error).not.toBeNull();
    const msg = (error?.message ?? "").toLowerCase();
    expect(msg).not.toContain("approval required");
    expect(msg).not.toContain("unexpected approval person");
    // Y no puede ser "function does not exist": la firma de 5 args es la vigente.
    expect(msg).not.toContain("does not exist");
  });
});
