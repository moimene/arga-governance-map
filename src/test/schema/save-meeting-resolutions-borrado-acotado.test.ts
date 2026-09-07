// src/test/schema/save-meeting-resolutions-borrado-acotado.test.ts
//
// ORDEN VIGENTE 2026-09-07: el dato sembrado del tenant Garrigues PERSISTE.
//
// `fn_save_meeting_resolutions` borraba TODAS las resoluciones de la reunión y
// TODOS sus votos, y reinsertaba sólo lo que trajera el cliente. Medido en
// Cloud el 2026-09-07: la Junta de socios de Garrigues
// (e0beed92-60f0-49e7-81c3-0ae5a54c9d56) tiene 10 `meeting_resolutions`
// sembradas, todas con `agreement_id`, en los índices 1,2,3,4,5,7,8,11,12,13.
// Un guardado desde el stepper se las llevaba con el enlace al acuerdo dentro.
//
// LO QUE ESTE GATE PUEDE Y NO PUEDE. Fija el contenido de la migración, no el
// cuerpo vivo en Cloud: la migración la aplica el orquestador. Lo que sí
// protege del drift es la propia migración, que ancla sobre el cuerpo vivo y
// aborta si no lo encuentra exactamente una vez — comprobado por lectura contra
// governance_OS antes de escribirla: el ancla aparece 1 vez y la función aún no
// está acotada.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const RUTA =
  "supabase/migrations/20260907120000_save_meeting_resolutions_borrado_acotado_a_puntos_enviados.sql";
const sql = readFileSync(join(process.cwd(), RUTA), "utf8");

/** El texto de reemplazo: lo que quedará en la función tras el parche. */
const reemplazo = (() => {
  const desde = sql.indexOf("r1 text := $a$");
  const hasta = sql.indexOf("$a$;", desde);
  expect(desde, "la migración define el reemplazo r1").toBeGreaterThan(-1);
  expect(hasta, "el reemplazo r1 está cerrado").toBeGreaterThan(desde);
  return sql.slice(desde, hasta);
})();

describe("la sustitución de resoluciones sólo alcanza los puntos enviados", () => {
  it("acota los DOS borrados por agenda_item_index", () => {
    // Control positivo: el reemplazo sigue conteniendo los dos borrados. Si
    // alguien los quitara, las aserciones de acotamiento pasarían en el vacío.
    expect(reemplazo).toContain("DELETE FROM meeting_votes mv");
    expect(reemplazo).toContain("DELETE FROM meeting_resolutions mr");

    const acotados = reemplazo.match(/AND mr\.agenda_item_index IN \(/g) ?? [];
    expect(acotados, "votos y resoluciones, ambos acotados").toHaveLength(2);

    // Y el conjunto por el que se acota son los puntos que el cliente envía.
    const porPrepared = reemplazo.match(/FROM jsonb_array_elements\(v_prepared\)/g) ?? [];
    expect(porPrepared).toHaveLength(2);
  });

  it("y no deja ningún borrado que barra la reunión entera", () => {
    // El borrado sin acotar es exactamente el defecto: tenant + meeting y nada
    // más. Si sobrevive en el reemplazo, el parche no arregla nada.
    expect(reemplazo).not.toMatch(
      /AND mr\.meeting_id = p_meeting_id;\s*$/m,
    );
  });

  it("ancla sobre el cuerpo vivo y aborta si no lo reconoce", () => {
    // Sin esto, el parche podría aplicarse sobre una función que ya cambió por
    // otro camino y dejar el resultado a medias.
    expect(sql).toContain("pg_get_functiondef");
    expect(sql).toMatch(/IF n <> 1 THEN RAISE EXCEPTION 'el ancla del borrado aparece % veces/);
    // Verificación del propio parche: dos borrados acotados o excepción.
    expect(sql).toMatch(/IF n <> 2 THEN RAISE EXCEPTION 'tras el parche hay % borrados acotados/);
    // Idempotente: re-aplicarla no vuelve a parchear.
    expect(sql).toContain("ya acotada; nada que hacer");
  });

  it("no toca el parche append-only de rule_evaluation_results", () => {
    // 20260906101026 dejó ese INSERT condicionado por evaluation_hash. Una
    // reescritura de la función entera lo habría perdido; por eso se ancla.
    expect(sql).not.toContain("CREATE OR REPLACE FUNCTION");
    expect(sql).not.toContain("DELETE FROM rule_evaluation_results");
  });
});
