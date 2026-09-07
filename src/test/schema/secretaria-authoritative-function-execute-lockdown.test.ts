import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260720130000_secretaria_authoritative_function_execute_lockdown.sql",
  ),
  "utf8",
);

const internalHelpers = [
  "fn_secretaria_qtsp_request_source_guard",
  "fn_secretaria_evidence_bundle_insert_guard",
  "fn_secretaria_freeze_minute_source_facts",
  "fn_secretaria_annual_accounts_append_only_guard",
  "fn_secretaria_annual_accounts_minute_gate",
  "fn_secretaria_guard_convocation_agenda_binding",
];

describe("authoritative trigger function EXECUTE lockdown", () => {
  it.each(internalHelpers)("removes browser-facing EXECUTE from %s", (name) => {
    expect(sql).toContain(`REVOKE ALL ON FUNCTION public.${name}()`);
    expect(sql).toMatch(
      new RegExp(
        `REVOKE ALL ON FUNCTION public\\.${name}\\(\\)[\\s\\S]*?FROM PUBLIC, anon, authenticated`,
      ),
    );
    expect(sql).toContain(`GRANT EXECUTE ON FUNCTION public.${name}()`);
  });

  it("fails closed if anon/authenticated retain access or service_role loses it", () => {
    expect(sql).toContain("has_function_privilege('anon', v_function, 'EXECUTE')");
    expect(sql).toContain("has_function_privilege('authenticated', v_function, 'EXECUTE')");
    expect(sql).toContain("NOT has_function_privilege('service_role', v_function, 'EXECUTE')");
    expect(sql).toContain("authoritative helper EXECUTE lockdown failed");
  });
});

/**
 * LA CUSTODIA FINAL DE EAD TRUST ESTÁ CERRADA A PROPÓSITO, Y ESTO LO FIJA.
 *
 * Certificar un acuerdo exige un acta en `APPROVED_SIGNED`, que exige un
 * ARTEFACTO FINAL registrado en servidor. Ese registro solo puede nacer de
 * `fn_secretaria_register_custodied_legal_artifact`, y esa función está
 * fail-closed en TRES capas independientes, puestas el 2026-07-20 para impedir
 * que un resultado del proveedor se eleve a artefacto autoritativo:
 *
 *   1. UI      — `EADInterpositionControl` no tiene handler: el botón está
 *                cableado a `disabled` y declara «Pendiente de renderer
 *                autoritativo». (Lo fija e2e/18.)
 *   2. EDGE    — `qtsp-proxy` corta antes con `AUTHORITATIVE_BINARY_REQUIRED`.
 *                (Lo fija secretaria-ead-closeout-hardening.test.ts, que exige
 *                que los efectos vengan DESPUÉS del gate.)
 *   3. SQL     — el EXECUTE está revocado de PUBLIC, anon, authenticated y
 *                **service_role**. Medido en Cloud el 2026-09-07: el ACL es
 *                `{postgres=X/postgres}`, así que ni siquiera el Edge Function
 *                que la invoca puede alcanzarla.
 *
 * La capa 3 era la ÚNICA sin gate propio: lo único que la vigilaba era un
 * regex sobre el texto de UNA migración de julio, y eso se derrota con una
 * migración posterior que reconceda el privilegio — el fichero viejo seguiría
 * casando y el gate seguiría verde con la puerta abierta.
 *
 * Reabrir esto no es una mejora pendiente: sin renderer autoritativo que
 * produzca el binario, conceder el privilegio solo permite acuñar «artefactos
 * finales» que nadie ha producido. Es decir, fabricar evidencia de un QTSP.
 * Si algún día se contrata y se construye, este test tiene que caer y hay que
 * actualizarlo A PROPÓSITO.
 */
describe("2026-09-07 — la custodia final sigue fail-closed en el privilegio, no solo en el texto de una migración", () => {
  const CUSTODIA = "fn_secretaria_register_custodied_legal_artifact";

  it("ninguna migración posterior reabre el EXECUTE de la custodia", () => {
    // Barrido COMPLETO y en orden: no vale mirar solo el fichero que lo revocó.
    const dir = resolve(process.cwd(), "supabase/migrations");
    const ficheros = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
    expect(ficheros.length, "sin migraciones el barrido sería vacuo").toBeGreaterThan(50);

    let ultimaConcesion: string | null = null;
    let revocadoEn: string | null = null;
    for (const f of ficheros) {
      const cuerpo = readFileSync(resolve(dir, f), "utf8");
      if (!cuerpo.includes(CUSTODIA)) continue;
      // Se mira el ÚLTIMO gesto sobre el privilegio, no el primero.
      if (new RegExp(`GRANT\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.${CUSTODIA}`, "i").test(cuerpo)) {
        ultimaConcesion = f;
      }
      if (new RegExp(`REVOKE\\s+ALL\\s+ON\\s+FUNCTION\\s+public\\.${CUSTODIA}`, "i").test(cuerpo)) {
        revocadoEn = f;
        ultimaConcesion = null; // el revoke posterior anula la concesión previa
      }
    }
    expect(revocadoEn, "no se encuentra el REVOKE: el barrido no está mirando donde cree").not.toBeNull();
    expect(
      ultimaConcesion,
      `una migración posterior (${ultimaConcesion}) reconcede EXECUTE sobre la custodia final: ` +
        "sin renderer autoritativo eso permite acuñar artefactos finales que nadie ha producido",
    ).toBeNull();
  });

  it("y el revoke alcanza a service_role, no solo al navegador", () => {
    // CONTROL DISCRIMINANTE: revocar de anon/authenticated y dejárselo a
    // service_role dejaría el camino abierto para el Edge Function, que es
    // justo quien lo invoca (qtsp-proxy/index.ts). El revoke tiene que
    // nombrarlo.
    const dir = resolve(process.cwd(), "supabase/migrations");
    const conRevoke = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => readFileSync(resolve(dir, f), "utf8"))
      .filter((c) => new RegExp(`REVOKE\\s+ALL\\s+ON\\s+FUNCTION\\s+public\\.${CUSTODIA}`, "i").test(c));
    expect(conRevoke.length, "no hay ninguna migración con el revoke").toBeGreaterThan(0);
    const alcanzaServiceRole = conRevoke.some((c) =>
      new RegExp(
        `REVOKE\\s+ALL\\s+ON\\s+FUNCTION\\s+public\\.${CUSTODIA}\\([^)]*\\)\\s*FROM[^;]*service_role`,
        "i",
      ).test(c),
    );
    expect(alcanzaServiceRole, "el revoke no nombra a service_role: el Edge Function podría alcanzarla").toBe(true);
  });
});
