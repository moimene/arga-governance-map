/**
 * Ola 6 (MOI-15, H-52 y H-53) — contrato estático de las migraciones
 * `20260928170000_secretaria_acta_punto_nacido_en_sesion.sql` y
 * `20260928171000_secretaria_punto_sesion_materia_propuesta.sql`.
 *
 * Como en `secretaria-punto-nacido-en-sesion.test.ts` (H-27), este test no
 * ejercita la BD: el ensayo revertido vive en
 * `supabase/migrations/proposed/*.probe.sql` y su salida en
 * `docs/superpowers/reviews/2026-09-26-ensayos-cloud/ola6-ensayo.txt`. Aquí
 * se fijan las invariantes que las dos migraciones declaran, para que una
 * regresión del fichero SQL se detecte sin correr contra Cloud.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const h53 = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260928170000_secretaria_acta_punto_nacido_en_sesion.sql"),
  "utf8",
);
const h52 = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260928171000_secretaria_punto_sesion_materia_propuesta.sql"),
  "utf8",
);

describe("H-53 — 20260928170000: el manifiesto del acta distingue CONVOCATORIA de MEETING_FLOOR", () => {
  it("parchea por sustitución anclada el cuerpo VIVO de las dos funciones (no reescribe H-33/MOI-143)", () => {
    expect(h53).toContain("pg_get_functiondef(p.oid)");
    expect(h53).toMatch(/proname = 'fn_secretaria_build_minute_legal_manifest'/);
    expect(h53).toMatch(/proname = 'fn_secretaria_render_authoritative_minute'/);
    // Cada ancla tiene que aparecer exactamente una vez o se aborta.
    expect(h53).toMatch(/IF n <> 1 THEN RAISE EXCEPTION 'ancla 1/);
    expect(h53).toMatch(/IF n <> 1 THEN RAISE EXCEPTION 'ancla 2/);
    expect(h53).toMatch(/IF n <> 1 THEN RAISE EXCEPTION 'ancla \(agenda point header\)/);
  });

  it("solo exime de contraparte en `called` al punto nacido en sesión; el punto de convocatoria sigue comparándose campo a campo", () => {
    expect(h53).toContain("held.source_convocatoria_id IS NOT NULL");
    for (const campo of ["title", "matter_code", "kind", "decision_subtype", "proposal_text", "requires_attachments"]) {
      expect(h53).toContain(`called.${campo} IS DISTINCT FROM held.${campo}`);
    }
    // Un punto convocado que falte en la agenda celebrada sigue siendo error.
    expect(h53).toMatch(/WHERE held\.order_number IS NULL\s*\n\s*OR \(/);
    expect(h53).toContain("RAISE EXCEPTION 'authoritative minute: held agenda differs from the immutable convocation'");
  });

  it("declara el origen de cada punto en el manifiesto y la procedencia en el texto del acta", () => {
    expect(h53).toContain("'origin', CASE WHEN ai.source_convocatoria_id IS NOT NULL THEN 'CONVOCATORIA' ELSE 'MEETING_FLOOR' END");
    expect(h53).toContain("Procedencia: punto no incluido en el orden del día convocado; incorporado en el curso de la propia sesión.");
  });

  it("es idempotente y verifica al final que no se perdieron MOI-143 ni la comparación exacta", () => {
    expect(h53).toMatch(/RAISE NOTICE 'ya parcheada; nada que hacer'/);
    expect(h53).toContain("VERIFICACION: se perdió el evaluador de Junta MOI-143 al parchear");
    expect(h53).toContain("VERIFICACION: se perdió la comparación exacta con la convocatoria");
  });

  it("no decide el criterio jurídico sobre puntos fuera del orden del día (arts. 223.1/238.3 LSC)", () => {
    expect(h53).toMatch(/223\.1/);
    expect(h53).toMatch(/238\.3/);
    expect(h53).toMatch(/Comité Legal/);
  });
});

describe("H-52 — 20260928171000: fn_secretaria_add_session_agenda_item persiste materia y propuesta", () => {
  const start = h52.indexOf("CREATE OR REPLACE FUNCTION public.fn_secretaria_add_session_agenda_item(");
  const end = h52.indexOf("$function$;", h52.indexOf("AS $function$", start));
  const fn = h52.slice(start, end + "$function$;".length);

  it("elimina la sobrecarga de 5 argumentos antes de crear la de 7 (PostgREST no admite ambigüedad)", () => {
    expect(h52).toContain("DROP FUNCTION IF EXISTS public.fn_secretaria_add_session_agenda_item(uuid, integer, text, text, text);");
    expect(fn).toMatch(/p_matter_code text DEFAULT NULL,\s*\n\s*p_proposal_text text DEFAULT NULL/);
    expect(h52).toContain("la sobrecarga antigua de 5 argumentos sigue existiendo");
  });

  it("DECISORIO exige materia catalogada (misma condición que el manifiesto) y propuesta no vacía", () => {
    expect(fn).toContain("SESSION_AGENDA_ITEM_MATTER_NOT_CATALOGUED");
    expect(fn).toContain("SESSION_AGENDA_ITEM_PROPOSAL_REQUIRED");
    expect(fn).toMatch(/FROM public\.materia_catalog mc\s*\n\s*WHERE mc\.materia = v_matter_code\s*\n\s*AND COALESCE\(btrim\(mc\.materia_label_es\), ''\) <> ''/);
  });

  it("un punto no decisorio no escribe una materia sin catálogo ni lleva propuesta", () => {
    expect(fn).toMatch(/ELSE\s*\n\s*IF NOT v_matter_catalogued THEN\s*\n\s*v_matter_code := NULL;/);
    expect(fn).toMatch(/v_proposal_text := NULL;/);
  });

  it("camino idempotente: sincroniza SOLO el punto nacido en sesión y nunca borra la materia con un valor vacío", () => {
    expect(fn).toMatch(/UPDATE public\.agenda_items\s*\n\s*SET title = v_title,/);
    expect(fn).toContain("matter_code = COALESCE(v_matter_code, matter_code)");
    expect(fn).toMatch(/AND source_convocatoria_id IS NULL;\s*\n\s*RETURN v_existing\.id;/);
    // El orden del día emitido sigue intocable.
    expect(fn).toContain("SESSION_AGENDA_ITEM_ORDER_TAKEN_BY_CONVOCATION");
    const insertBlock = fn.slice(fn.indexOf("INSERT INTO public.agenda_items"));
    expect(insertBlock).not.toMatch(/source_convocatoria_id/);
    expect(fn).not.toMatch(/UPDATE public\.meetings/i);
  });

  it("conserva tenant/rol, EN_CURSO, SECURITY DEFINER sin OWNER TO y los grants de H-27", () => {
    expect(fn).toMatch(/LANGUAGE plpgsql\s+SECURITY DEFINER/);
    expect(h52).not.toMatch(/ALTER FUNCTION[^;]*OWNER TO/i);
    expect(fn).toContain("SESSION_AGENDA_ITEM_TENANT_MISMATCH");
    expect(fn).toContain("SESSION_AGENDA_ITEM_MEETING_NOT_OPEN");
    expect(h52).toMatch(
      /REVOKE ALL ON FUNCTION public\.fn_secretaria_add_session_agenda_item\(uuid, integer, text, text, text, text, text\)\s*\n\s*FROM PUBLIC, anon;/,
    );
    expect(h52).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.fn_secretaria_add_session_agenda_item\(uuid, integer, text, text, text, text, text\)\s*\n\s*TO authenticated, service_role;/,
    );
  });

  it("trae verificación que aborta y control positivo en subtransacción deshecha", () => {
    expect(h52).toContain("DO $verificacion$");
    expect(h52).toMatch(/RAISE EXCEPTION\s+'VERIFICACION: el propietario de la RPC/);
    expect(h52).toContain("DO $control_positivo$");
    expect(h52).toMatch(/RAISE EXCEPTION USING ERRCODE = 'P0927'/);
    expect(h52).toMatch(/WHEN SQLSTATE 'P0927' THEN\s*\n\s*NULL;/);
    expect(h52).toContain("la segunda llamada no fue idempotente");
  });
});
