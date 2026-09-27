// src/test/schema/secretaria-dictamen-ia.test.ts
//
// MOI-175 F5.T13 — SOLO el mecanismo de registro
// (`fn_secretaria_registrar_dictamen_ia`) y el endurecimiento GC-139 de
// `secretaria_document_artifacts`. Ningún dictamen real: el Comité de
// Gobernanza de la IA de Garrigues resuelve MOI-178/MOI-182 primero.
//
// QUÉ PRUEBA, Y CÓMO
// ------------------
// Solo las rutas de VALIDACIÓN de la RPC (asunto, tenant del sistema/entidad/
// órgano, autor miembro vigente, decisor con cargo vigente): ninguna crea un
// artefacto real. El camino positivo (la RPC aprueba un dictamen y queda
// inmutable frente a UPDATE/DELETE, incluso para la misma sesión con
// capacidad de escritura) ya está probado con login real y CERO residuo en
// `supabase/migrations/proposed/20260928121000_secretaria_dictamen_ia.probe.sql`
// (`python3 /tmp/probe_rollback.py ...` exit=0) y en el bloque de
// verificación de la propia migración (subtransacciones P0176/P0177 que se
// deshacen). Repetir el alta aquí crearía un `INFORME_PRECEPTIVO` APPROVED
// PERMANENTE en ARGA en cada corrida de la suite: `secretaria_document_artifacts`
// no admite DELETE de un artefacto `ai_system` desde APPROVED (esa es
// exactamente la garantía que GC-139 pide), así que no habría forma de
// deshacerlo desde un test de aplicación.
//
// PUERTA HUMANA: la migración está escrita y ensayada en reversa, pero
// aplicarla en Cloud exige autorización humana que este agente no tiene.
// Mientras no esté aplicada, el único error tolerado es "la función no
// existe" (mismo patrón que `risks-ai-system-link.test.ts`); cualquier otro
// error hace fallar el test.
import { describe, expect, it } from "bun:test";
import { sesionDe } from "../helpers/supabase-test-client";

const NO_APLICADO = /could not find the function|does not exist|schema cache/i;

const ARGA_SYSTEM = "90000000-0000-0000-0000-000000000001"; // Motor de triaje de siniestros auto
const ARGA_ENTITY = "6d7ed736-f263-4531-a59d-c6ca0cd41602"; // ARGA Seguros, S.A.
const CATIT_BODY = "08a4156b-a814-4dc6-b953-fafac1b5b840"; // órgano de IA de ARGA (D-U2)
const ARGA_BRASIL_BODY = "00000000-0000-0000-0000-000000000040"; // órgano de ARGA donde el autor NO es miembro
const GARRIGUES_BODY = "432e420b-4db1-44f1-81da-e3575b1d3dec"; // Comité de Gobernanza de la IA (otro tenant)
const PRESIDENTE_VIGENTE = "4b5b1326-63ee-4e84-983b-5c8220be4157"; // Sofía Herrera Ramos, cargo vigente

describe("MOI-175 F5.T13 — fn_secretaria_registrar_dictamen_ia (solo mecanismo)", () => {
  it("un asunto no reconocido se rechaza", async () => {
    const arga = await sesionDe("ARGA");
    const { error } = await arga.rpc("fn_secretaria_registrar_dictamen_ia", {
      p_system_id: ARGA_SYSTEM,
      p_entity_id: ARGA_ENTITY,
      p_body_id: CATIT_BODY,
      p_asunto: "ASUNTO_INVENTADO",
      p_contenido: "no debe llegar a registrarse",
      p_decisor_person_id: PRESIDENTE_VIGENTE,
    });
    expect(error).not.toBeNull();
    if (NO_APLICADO.test(error!.message)) return; // puerta humana aún cerrada
    expect(error!.message).toMatch(/no reconocido/);
  });

  it("un órgano de otro tenant se rechaza (el órgano tiene que ser del tenant de sesión)", async () => {
    const arga = await sesionDe("ARGA");
    const { error } = await arga.rpc("fn_secretaria_registrar_dictamen_ia", {
      p_system_id: ARGA_SYSTEM,
      p_entity_id: ARGA_ENTITY,
      p_body_id: GARRIGUES_BODY,
      p_asunto: "CLASIFICACION",
      p_contenido: "no debe llegar a registrarse",
      p_decisor_person_id: PRESIDENTE_VIGENTE,
    });
    expect(error).not.toBeNull();
    if (NO_APLICADO.test(error!.message)) return;
    expect(error!.message).toMatch(/órgano.*ajeno al tenant de sesión/);
  });

  it("un autor que no es miembro vigente del órgano se rechaza (G-VIVO-NEG)", async () => {
    const arga = await sesionDe("ARGA");
    const { error } = await arga.rpc("fn_secretaria_registrar_dictamen_ia", {
      p_system_id: ARGA_SYSTEM,
      p_entity_id: ARGA_ENTITY,
      p_body_id: ARGA_BRASIL_BODY,
      p_asunto: "CLASIFICACION",
      p_contenido: "no debe llegar a registrarse",
      p_decisor_person_id: PRESIDENTE_VIGENTE,
    });
    expect(error).not.toBeNull();
    if (NO_APLICADO.test(error!.message)) return;
    expect(error!.message).toMatch(/AUTOR_NO_MIEMBRO_ORGANO/);
  });

  it("un decisor sin ningún cargo vigente se rechaza (G-VIVO-NEG)", async () => {
    const arga = await sesionDe("ARGA");
    const { error } = await arga.rpc("fn_secretaria_registrar_dictamen_ia", {
      p_system_id: ARGA_SYSTEM,
      p_entity_id: ARGA_ENTITY,
      p_body_id: CATIT_BODY,
      p_asunto: "CLASIFICACION",
      p_contenido: "no debe llegar a registrarse",
      p_decisor_person_id: "99999999-9999-9999-9999-999999999999",
    });
    expect(error).not.toBeNull();
    if (NO_APLICADO.test(error!.message)) return;
    expect(error!.message).toMatch(/DECISOR_SIN_CARGO_VIGENTE/);
  });
});
