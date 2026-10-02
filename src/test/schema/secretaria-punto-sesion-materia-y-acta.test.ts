/**
 * H-52 y H-53 (MOI-15, recorrido 4.1 del grupo nuevo) — contrato estático de
 * `20261002100000_secretaria_punto_sesion_materia_y_acta.sql`.
 *
 * H-52: el punto nacido en sesión perdía su materia y su propuesta.
 * H-53: el manifiesto del acta exigía que TODA la agenda celebrada fuese el
 * espejo exacto de la convocatoria, así que un punto nacido en sesión lo
 * bloqueaba siempre.
 *
 * El ensayo revertido contra Cloud (docs/superpowers/reviews/
 * 2026-10-02-ensayo-moi15-h52-h53.md) prueba el comportamiento; este test fija
 * en el repo que el manifiesto nuevo es el anterior con EXACTAMENTE dos
 * cambios, y que la comparación con la convocatoria sigue siendo total en Junta.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) =>
  readFileSync(resolve(process.cwd(), "supabase/migrations", file), "utf8");

const migration = read("20261002100000_secretaria_punto_sesion_materia_y_acta.sql");
const previous = read("20260928160000_secretaria_junta_capital_evaluator.sql");

function body(source: string, name: string) {
  const start = source.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  expect(start, `${name} debe existir`).toBeGreaterThanOrEqual(0);
  const open = source.indexOf("AS $function$", start) + "AS $function$".length;
  const close = source.indexOf("$function$", open);
  return source.slice(open, close);
}

const JUNTA_GUARD = "AND (v_is_junta OR ai.source_convocatoria_id IS NOT NULL)";

describe("H-52 — fn_secretaria_add_session_agenda_item guarda materia y propuesta", () => {
  const rpc = body(migration, "fn_secretaria_add_session_agenda_item");

  it("retira la firma de 5 argumentos y crea la de 7", () => {
    expect(migration).toContain(
      "DROP FUNCTION IF EXISTS public.fn_secretaria_add_session_agenda_item(uuid, integer, text, text, text);",
    );
    expect(migration).toMatch(/p_matter_code text DEFAULT NULL,\s+p_proposal_text text DEFAULT NULL/);
  });

  it("valida la materia contra materia_catalog con etiqueta", () => {
    expect(rpc).toContain("SESSION_AGENDA_ITEM_MATTER_NOT_CATALOGUED");
    expect(rpc).toContain("FROM public.materia_catalog mc");
  });

  it("no toca nunca un punto de la convocatoria ni reescribe uno ya votado", () => {
    expect(rpc).toContain("SESSION_AGENDA_ITEM_ORDER_TAKEN_BY_CONVOCATION");
    expect(rpc).toContain("SESSION_AGENDA_ITEM_ALREADY_VOTED");
    expect(rpc).not.toMatch(/source_convocatoria_id\s*=/);
  });

  it("solo se concede a authenticated y service_role", () => {
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.fn_secretaria_add_session_agenda_item\(uuid, integer, text, text, text, text, text\)\s+FROM PUBLIC, anon;/,
    );
  });
});

describe("H-53 — el manifiesto del acta admite puntos nacidos en sesión en el Consejo", () => {
  const nuevo = body(migration, "fn_secretaria_build_minute_legal_manifest");
  const anterior = body(previous, "fn_secretaria_build_minute_legal_manifest");

  it("es el manifiesto anterior con exactamente los dos cambios marcados", () => {
    const sinCambioA = nuevo.replace(
      /\n {8}-- H-53 \(MOI-15\)[\s\S]*?AND \(v_is_junta OR ai\.source_convocatoria_id IS NOT NULL\)/,
      "",
    );
    const sinCambios = sinCambioA.replace(
      /,\n {10}-- H-53: procedencia declarada[\s\S]*?\n {10}END\n/,
      "\n",
    );
    expect(sinCambios).toBe(anterior);
  });

  it("en Junta la comparación con la convocatoria sigue siendo total", () => {
    expect(nuevo.split(JUNTA_GUARD)).toHaveLength(2);
    expect(nuevo).toContain("held agenda differs from the immutable convocation");
  });

  it("declara la procedencia de cada punto", () => {
    expect(nuevo).toContain("WHEN ai.source_convocatoria_id IS NULL THEN 'MEETING_FLOOR'");
  });

  it("la migración aborta si los cambios no quedaron aplicados", () => {
    expect(migration).toContain("VERIFICACION H-53");
    expect(migration).toContain("VERIFICACION H-52");
  });
});
