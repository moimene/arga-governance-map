import { describe, it, expect } from "vitest";
import { supabaseAdmin, hasAdminClient, DEMO_TENANT } from "@/test/helpers/supabase-test-client";
import { KNOWN_P0_TEMPLATES, isKnownP0 } from "../known-p0";

/**
 * GOTCHA MEDIDO (2026-09-05). `hasAdminClient()` es SIEMPRE false en este repo:
 * el helper lee `SUPABASE_SERVICE_ROLE_KEY` y `VITE_SUPABASE_URL`, y el `.env`
 * define `SERVICE_ROLE_SECRET` y `PROJECT_URL`. Estos bloques llevan meses
 * contándose entre los «skipped» sin que nadie pueda ejecutarlos: un skip
 * permanente no es una sonda, es un hueco con forma de sonda. Con `it.todo` la
 * ausencia de credenciales queda VISIBLE en el recuento, no en silencio.
 */
const ADMIN_DISPONIBLE = hasAdminClient();
const FALTAN_CREDENCIALES =
  "requiere SUPABASE_SERVICE_ROLE_KEY + VITE_SUPABASE_URL (el .env define SERVICE_ROLE_SECRET/PROJECT_URL)";

describe.skipIf(ADMIN_DISPONIBLE)("known-p0 Cloud existence — sin credenciales", () => {
  it.todo(`sonda Cloud de plantillas P0 no ejecutada: ${FALTAN_CREDENCIALES}`);
});

describe.skipIf(!ADMIN_DISPONIBLE)("known-p0 Cloud existence", () => {
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
