import { describe, it, expect } from "vitest";
import { hasDemoCredentials, sesionDe, DEMO_TENANT } from "@/test/helpers/supabase-test-client";
import { KNOWN_P0_TEMPLATES, isKnownP0 } from "../known-p0";

/**
 * MOI-192 (2026-09-26). Era `it.todo` por pedir `supabaseAdmin` (service_role,
 * ausente del `.env` de este repo — GOTCHA medido 2026-09-05) y la regla del
 * proyecto prohíbe correr tests con service_role contra `governance_OS`
 * (memoria `feedback_no_vitest_admin_cloud.md`). Decisión A del issue: sonda
 * de SOLO LECTURA con la sesión demo autenticada, no `service_role`.
 *
 * `KNOWN_P0_TEMPLATES` está vacía desde el 2026-05-14 (las dos P0 históricas
 * se corrigieron), así que iterar sobre ella —como hacía la versión original—
 * ejecuta CERO aserciones y pasa en vacío. El control positivo real es
 * comprobar en Cloud que esas dos plantillas siguen existiendo, ACTIVAS, y que
 * `isKnownP0` sigue diciendo que ya NO se toleran: si alguna desaparece, deja
 * de estar ACTIVA, o `isKnownP0` regresa a `true`, esta sonda debe caer.
 */
const CREDENCIALES_DISPONIBLES = hasDemoCredentials("ARGA");
const FALTAN_CREDENCIALES = "requiere DEMO_PASSWORD_ARGA en .env";
const P0_HISTORICOS = [
  { id: "e3697ad9-e0c2-4baf-9144-c80a11808c07", materia: "FUSION_ESCISION" },
  { id: "edd5c389-0187-476c-9592-c020058fdc69", materia: "RATIFICACION_ACTOS" },
] as const;

describe.skipIf(CREDENCIALES_DISPONIBLES)("known-p0 Cloud existence — sin credenciales", () => {
  it.todo(`sonda Cloud de plantillas P0 no ejecutada: ${FALTAN_CREDENCIALES}`);
});

describe.skipIf(!CREDENCIALES_DISPONIBLES)("known-p0 Cloud existence (solo lectura, sesión demo)", () => {
  it("las dos P0 históricas siguen ACTIVA en Cloud y ya no se toleran como P0", async () => {
    const arga = await sesionDe("ARGA");
    for (const p of P0_HISTORICOS) {
      const { data, error } = await arga
        .from("plantillas_protegidas")
        .select("id, estado, materia, materia_acuerdo")
        .eq("id", p.id)
        .eq("tenant_id", DEMO_TENANT)
        .maybeSingle();

      expect(error, `lookup error for ${p.id}`).toBeNull();
      expect(data, `${p.id} (${p.materia}) ya no existe en Cloud`).not.toBeNull();
      expect(data?.estado, `${p.id} debe estar ACTIVA`).toBe("ACTIVA");
      const materia = (data?.materia_acuerdo ?? data?.materia) as string;
      expect(materia).toBe(p.materia);
      expect(isKnownP0(p.id), `${p.id} no debe volver a tolerarse como P0`).toBe(false);
    }
    expect(KNOWN_P0_TEMPLATES).toHaveLength(0);
  });
});

/**
 * FUERA del bloque con credenciales, y con las aserciones al derecho.
 *
 * `isKnownP0` es una función pura: no necesita Cloud. Estaba dentro del
 * `describe.skipIf(!ADMIN_DISPONIBLE)`, que en este repo **nunca** se ejecuta
 * (ver el GOTCHA de arriba), y ahí dentro afirmaba que
 * `e3697ad9…` y `edd5c389…` eran P0 tolerados. Hoy `KNOWN_P0_TEMPLATES` está
 * VACÍA —las dos plantillas se corrigieron el 2026-05-14 y dejaron de tolerarse—
 * así que esas dos aserciones eran **falsas**: el test estaba rojo y el skip
 * permanente lo tapaba. Un skip no es una sonda; es un hueco con su forma.
 */
describe("known-p0 — función pura (sin Cloud)", () => {
  it("hoy no hay ninguna plantilla P0 tolerada", () => {
    expect(KNOWN_P0_TEMPLATES).toHaveLength(0);
  });

  it("las dos plantillas históricas ya no se toleran, y una desconocida tampoco", () => {
    // FUSION_ESCISION y RATIFICACION_ACTOS: se corrigieron, no se indultan.
    expect(isKnownP0("e3697ad9-e0c2-4baf-9144-c80a11808c07")).toBe(false);
    expect(isKnownP0("edd5c389-0187-476c-9592-c020058fdc69")).toBe(false);
    expect(isKnownP0("00000000-0000-0000-0000-000000000000")).toBe(false);
  });
});
