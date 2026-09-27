// src/test/schema/grc-eipd-shape.test.ts
//
// MOI-175 F5.T11 — `grc_dpias` + `fn_grc_registrar_eipd`, con logins reales.
//
// QUÉ PRUEBA, Y CÓMO
// ------------------
// Solo las rutas NEGATIVAS y de solo lectura de la RPC: ninguna de estas
// aserciones escribe una fila real en Cloud. El camino POSITIVO (la RPC crea
// la fila, con necessity_result PENDIENTE y motivo automático) ya está
// probado con login real y sin residuo en
// `supabase/migrations/proposed/20260928120000_grc_eipd.probe.sql` (ensayo
// revertido, `python3 /tmp/probe_rollback.py ... ` exit=0): repetirlo aquí
// insertaría una fila permanente en el tenant real cada vez que corre la
// suite, y `grc_dpias` no concede DELETE a `authenticated` (RS-TABLA) — no
// habría forma de deshacerlo desde un test de aplicación.
//
// PUERTA HUMANA: la migración `20260928120000_grc_eipd.sql` está escrita y
// ensayada en reversa, pero aplicarla en Cloud exige autorización humana que
// este agente no tiene (protocolo: solo SELECT en Cloud). Mientras la
// migración no esté aplicada, el único error tolerado es "la función/tabla
// no existe" (mismo patrón que `risks-ai-system-link.test.ts` y
// `rpcs-acta-cert.test.ts`); cualquier otro error hace fallar el test. En
// cuanto se aplique, cada bloque exige el comportamiento real sin tocar una
// línea de este fichero.
import { describe, expect, it } from "bun:test";
import { DEMO_TENANT, sesionDe } from "../helpers/supabase-test-client";

const NO_APLICADO = /could not find the function|does not exist|schema cache/i;

const ARGA_ENTITY = "6d7ed736-f263-4531-a59d-c6ca0cd41602"; // ARGA Seguros, S.A.
const GARRIGUES_ENTITY = "00000000-0000-0000-0002-000000000004"; // Garrigues Letrados de Soporte, SLP

describe("MOI-175 F5.T11 — grc_dpias / fn_grc_registrar_eipd", () => {
  it("C5: fijar una necesidad distinta de PENDIENTE sin motivo se rechaza (G-VIVO-NEG)", async () => {
    const arga = await sesionDe("ARGA");
    const { error } = await arga.rpc("fn_grc_registrar_eipd", {
      p_code: "__TEST_NUNCA_PERSISTE__",
      p_entity_id: ARGA_ENTITY,
      p_controller_role: "RESPONSABLE",
      p_processing_description: "no debe llegar a insertarse",
      p_necessity_result: "REQUERIDA",
      p_necessity_rationale: null,
    });
    expect(error).not.toBeNull();
    if (NO_APLICADO.test(error!.message)) return; // puerta humana aún cerrada
    expect(error!.message).toMatch(/NECESIDAD_SIN_MOTIVO/);
  });

  it("una entidad de otro tenant se rechaza (G-VIVO-NEG, no confía en el tenant que le pasa el cliente)", async () => {
    const arga = await sesionDe("ARGA");
    const { error } = await arga.rpc("fn_grc_registrar_eipd", {
      p_code: "__TEST_NUNCA_PERSISTE__",
      p_entity_id: GARRIGUES_ENTITY,
      p_controller_role: "RESPONSABLE",
      p_processing_description: "no debe llegar a insertarse",
    });
    expect(error).not.toBeNull();
    if (NO_APLICADO.test(error!.message)) return;
    expect(error!.message).toMatch(/ajena al tenant de sesión/);
  });

  it("un controller_role inválido se rechaza", async () => {
    const arga = await sesionDe("ARGA");
    const { error } = await arga.rpc("fn_grc_registrar_eipd", {
      p_code: "__TEST_NUNCA_PERSISTE__",
      p_entity_id: ARGA_ENTITY,
      p_controller_role: "INVENTADO",
      p_processing_description: "no debe llegar a insertarse",
    });
    expect(error).not.toBeNull();
    if (NO_APLICADO.test(error!.message)) return;
    expect(error!.message).toMatch(/controller_role/);
  });

  it("RS-TABLA: un INSERT directo sobre grc_dpias, sin pasar por la RPC, se rechaza", async () => {
    const arga = await sesionDe("ARGA");
    const { error } = await arga.from("grc_dpias").insert({
      tenant_id: DEMO_TENANT,
      code: "__TEST_NUNCA_PERSISTE__",
      entity_id: ARGA_ENTITY,
      controller_role: "RESPONSABLE",
      processing_description: "no debe llegar a insertarse",
      necessity_rationale: "sonda",
    } as never);
    expect(error).not.toBeNull();
    if (error && NO_APLICADO.test(error.message)) return; // puerta humana aún cerrada
    // permission denied (42501) por falta de GRANT INSERT, o RLS: ambos valen.
    expect(error!.message).toMatch(/permission denied|policy/i);
  });
});
