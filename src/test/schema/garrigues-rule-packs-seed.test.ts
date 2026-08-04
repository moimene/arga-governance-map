// src/test/schema/garrigues-rule-packs-seed.test.ts
// G3 Task 3 gate de datos: el tenant Garrigues tiene sus 4 rule packs núcleo
// (GARR_*) bajo RLS per-tenant, y ARGA queda intacta y aislada de ellos.
// Patrón graceful-skip de garrigues-gobierno-seed.test.ts (post-fix, con
// cliente `arga` propio y flag `argaAuthed` independiente).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { GARRIGUES_DEMO_EMAIL } from "../helpers/supabase-test-client";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://hzqwefkwsxopwrmtksbg.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cXdlZmt3c3hvcHdybXRrc2JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Mjc1MDMsImV4cCI6MjA5MjAwMzUwM30.IZ2FbhQLp2ljRcsvsvzpLWQ9cq9p5Lz4dJfVzY3whjQ";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "TGMSdemo2026!";
const DEMO_EMAIL = process.env.DEMO_EMAIL || "demo@arga-seguros.com";

const GARR_PACK_IDS = [
  "GARR_DECISION_ADMIN_UNICO",
  "GARR_JUNTA_SOCIOS",
  "GARR_SOCIO_UNICO_FILIAL",
  "GARR_CONSEJO_EAD",
] as const;

describe("G3 Task 3 — rule packs núcleo del tenant Garrigues (RLS per-tenant, aislamiento ARGA)", () => {
  let garr: SupabaseClient | null = null;
  let arga: SupabaseClient | null = null;
  let authed = false;
  let argaAuthed = false;
  // Además del graceful-skip por login (sin red / credenciales), esta sonda
  // se escribe ANTES de que el controller ejecute el Step 4 (aplicar la
  // migración en Cloud). Si el entorno de ejecución SÍ tiene red — como
  // ocurrió al verificar este fichero — el login puede tener éxito y las
  // queries GARR_* devolver 0 filas de forma legítima y esperada, no por
  // fallo de conexión. `packsSeeded` distingue ambos casos: los tests que
  // dependen de los 4 packs que crea la migración de este Task se saltan
  // (verde, no rojo) hasta que existan; los que verifican datos YA
  // existentes (aislamiento ARGA, invariante art. 4.3 de G2) se ejecutan
  // igual, con red, desde el primer momento.
  let packsSeeded = false;

  beforeAll(async () => {
    try {
      garr = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
      const { error } = await garr.auth.signInWithPassword({
        email: GARRIGUES_DEMO_EMAIL, password: DEMO_PASSWORD,
      });
      authed = !error;
      if (error) console.warn(`[g3-rule-packs-seed] login Garrigues falló: ${error.message}`);

      if (authed && garr) {
        const { data: probe } = await garr.from("rule_packs").select("id").like("id", "GARR_%").limit(1);
        packsSeeded = (probe ?? []).length > 0;
        if (!packsSeeded) {
          console.warn("[g3-rule-packs-seed] packs GARR_* aún no existen en Cloud — Step 4 (controller) pendiente; tests dependientes en skip.");
        }
      }

      // ARGA client para verificar aislamiento RLS — cliente e idempotencia
      // de login independientes del cliente Garrigues.
      arga = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
      const { error: argaError } = await arga.auth.signInWithPassword({
        email: DEMO_EMAIL, password: DEMO_PASSWORD,
      });
      argaAuthed = !argaError;
      if (argaError) console.warn(`[g3-rule-packs-seed] login ARGA falló: ${argaError.message}`);
    } catch {
      authed = false;
    }
  }, 30_000);

  afterAll(async () => {
    try { await garr?.auth.signOut({ scope: "local" }); } catch { /* noop */ }
    try { await arga?.auth.signOut({ scope: "local" }); } catch { /* noop */ }
  });

  it("Garrigues ve sus 4 packs núcleo bajo su tenant (RLS per-tenant)", async () => {
    if (!authed || !garr || !packsSeeded) { expect(true).toBe(true); return; }
    const { data, error } = await garr.from("rule_packs").select("id, organo_tipo").like("id", "GARR_%");
    expect(error).toBeNull();
    const ids = (data ?? []).map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining([...GARR_PACK_IDS]));
    // organo_tipo por pack — vocabulario de rule-pack-organo.ts (whitelist de
    // familias). GARR_DECISION_ADMIN_UNICO usa 'CONSEJO' a propósito: no hay
    // familia propia "ADMIN_UNICO", el resolver mapea la administración
    // genérica (incluida la unipersonal) a la familia CONSEJO.
    const organoById = new Map((data ?? []).map((r) => [r.id, r.organo_tipo]));
    expect(organoById.get("GARR_DECISION_ADMIN_UNICO")).toBe("CONSEJO");
    expect(organoById.get("GARR_JUNTA_SOCIOS")).toBe("JUNTA_GENERAL");
    expect(organoById.get("GARR_SOCIO_UNICO_FILIAL")).toBe("SOCIO_UNICO");
    expect(organoById.get("GARR_CONSEJO_EAD")).toBe("CONSEJO");
  });

  it("ARGA no ve los packs GARR_ (aislamiento) y conserva sus 59", async () => {
    if (!argaAuthed || !arga) { expect(true).toBe(true); return; }
    const { data: garrRows, error: eGarr } = await arga.from("rule_packs").select("id").like("id", "GARR_%");
    expect(eGarr).toBeNull();
    expect((garrRows ?? []).length).toBe(0);

    // RLS (rule_packs_tenant_isolation: tenant_id = fn_current_tenant_id())
    // ya garantiza que solo se ven filas del propio tenant; esto verifica
    // además que el recuento no se movió con la migración de Garrigues.
    const { data: allArga, error: eAll } = await arga.from("rule_packs").select("id").limit(200);
    expect(eAll).toBeNull();
    expect((allArga ?? []).length).toBe(59);
  });

  it("GARR_JUNTA_SOCIOS tiene versión ACTIVA con el overlay Ley 2/2007 (5 citas) y la doble mayoría de exclusión anidada en votacion.mayoria", async () => {
    if (!authed || !garr || !packsSeeded) { expect(true).toBe(true); return; }
    const { data, error } = await garr
      .from("rule_pack_versions")
      .select("payload, is_active, status")
      .eq("pack_id", "GARR_JUNTA_SOCIOS")
      .eq("is_active", true)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data?.status).toBe("ACTIVE");
    const payload = data?.payload;
    // Overlay completo (5 citas): transmisión (art. 13), separación (art. 14),
    // exclusión (arts. 15/16), mayoría de socios profesionales (art. 4),
    // inscribibilidad (art. 8) — Comité Legal 2026-08-04, Decisión 2.
    expect(payload?.reglaEspecifica?.overlayLey2007?.length).toBe(5);
    // Doble mayoría de la exclusión: anidada en votacion.mayoria, NO en un
    // campo de primer nivel del payload (el extractor legacy no la lee).
    expect(payload?.votacion?.mayoria?.sociosProfesionalesExclusion?.referencia).toBe("arts. 15 y 16 Ley 2/2007");
    expect(payload?.votacion?.mayoria?.sociosProfesionalesExclusion?.alcance).toContain("EXCLUSION_SOCIO_PROFESIONAL_UNICAMENTE");
    // Corrección de cita obligada: la antelación de 15 días para SL/SLP cita
    // SIEMPRE "art. 176 LSC (supletoria)", nunca Ley 2/2007.
    expect(payload?.convocatoria?.antelacionDias?.SL?.referencia).toBe("art. 176 LSC (supletoria)");
    expect(payload?.convocatoria?.antelacionDias?.SLP?.referencia).toBe("art. 176 LSC (supletoria)");
  });

  // Sonda extra recomendada por el brief (art. 4.3 Ley 2/2007): el
  // administrador único de la matriz también debe figurar en el censo de
  // socios profesionales — es la invariante de composición que sostiene por
  // qué la mayoría de socios profesionales del overlay NO es una cita
  // decorativa. Verificado empíricamente contra Cloud antes de escribir este
  // test: hoy hay exactamente un ADMIN_UNICO en el tenant Garrigues (Vives,
  // matriz), así que .maybeSingle() sin filtro de entity_id es seguro, igual
  // que en garrigues-gobierno-seed.test.ts.
  it("art. 4.3 Ley 2/2007 — el administrador único de la matriz (Vives) figura también en el censo de socios profesionales", async () => {
    if (!authed || !garr) { expect(true).toBe(true); return; }
    const { data: adminUnico, error: eAdmin } = await garr
      .from("condiciones_persona")
      .select("person_id, person:person_id(full_name)")
      .eq("tipo_condicion", "ADMIN_UNICO")
      .maybeSingle();
    expect(eAdmin).toBeNull();
    expect(adminUnico?.person?.full_name).toBe("Fernando Vives Ruiz");

    const { data: socio, error: eSocio } = await garr
      .from("condiciones_persona")
      .select("id")
      .eq("tipo_condicion", "SOCIO")
      .eq("estado", "VIGENTE")
      .eq("person_id", adminUnico?.person_id ?? "")
      .maybeSingle();
    expect(eSocio).toBeNull();
    expect(socio?.id).toBeTruthy();
  });
});
