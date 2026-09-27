/**
 * H-27 (MOI-15) — contrato estático de la migración
 * `20260928151000_secretaria_punto_nacido_en_sesion.sql`.
 *
 * El defecto: `useMaterializeAgendaItem` insertaba directamente en
 * `agenda_items`, y `fn_secretaria_guard_emitted_agenda_dml`
 * (20260720122100) rechaza con 42501 AGENDA_EMITIDA_RPC_REQUIRED cualquier
 * escritura directa en una reunión vinculada a una convocatoria EMITIDA e
 * inmutable, salvo la que corra dentro de una RPC SECURITY DEFINER cuyo
 * `current_user` coincida con el propietario de
 * `fn_secretaria_materialize_convocation_agenda`.
 *
 * Este test no ejercita la BD (eso lo hace el ensayo revertido en
 * supabase/migrations/proposed/*.probe.sql, verificado contra Cloud); fija
 * en el repo las propiedades que el disparador exige y las invariantes de
 * negocio que la RPC declara, para que una regresión futura del fichero
 * SQL se detecte sin depender de correr contra Cloud.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260928151000_secretaria_punto_nacido_en_sesion.sql",
  ),
  "utf8",
);

function sqlFunction(source: string, name: string) {
  const start = source.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  expect(start, `${name} debe existir en la migración`).toBeGreaterThanOrEqual(0);
  const end = source.indexOf("$function$;", source.indexOf("AS $function$", start));
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end + "$function$;".length);
}

describe("H-27 — fn_secretaria_add_session_agenda_item (migración estática)", () => {
  const fn = sqlFunction(migration, "fn_secretaria_add_session_agenda_item");

  it("es SECURITY DEFINER sin OWNER TO explícito — hereda el rol de quien migra (postgres), igual que fn_secretaria_materialize_convocation_agenda", () => {
    expect(fn).toMatch(/LANGUAGE plpgsql\s+SECURITY DEFINER/);
    // Sin "ALTER FUNCTION ... OWNER TO" en el fichero: el propietario efectivo
    // es el rol que ejecuta la migración, igual que el resto de RPCs de
    // Secretaría (comprobado en Cloud contra fn_secretaria_materialize_convocation_agenda,
    // pg_get_functiondef confirma ambas propiedad "postgres").
    expect(migration).not.toMatch(/ALTER FUNCTION[^;]*OWNER TO/i);
  });

  it("nunca escribe source_convocatoria_id: el orden del día emitido de la convocatoria no se toca", () => {
    const insertBlock = fn.slice(fn.indexOf("INSERT INTO public.agenda_items"));
    expect(insertBlock).not.toMatch(/source_convocatoria_id/);
    expect(fn).not.toMatch(/UPDATE public\.agenda_items/i);
    expect(fn).not.toMatch(/UPDATE public\.meetings/i);
  });

  it("rechaza kind no reconocido antes de tocar meetings (mismo dominio que agenda_items_kind_check)", () => {
    expect(fn).toContain("SESSION_AGENDA_ITEM_KIND_INVALID");
    for (const kind of [
      "DECISORIO",
      "INFORMATIVO",
      "TOMA_DE_RAZON",
      "DELIBERATIVO",
      "ACEPTACION_INFORME",
      "RUEGOS_PREGUNTAS",
    ]) {
      expect(fn).toContain(kind);
    }
  });

  it("solo DECISORIO conserva decision_subtype (espejo de agenda_items_decision_subtype_only_for_decisorio)", () => {
    expect(fn).toMatch(/v_decision_subtype := CASE WHEN v_kind = 'DECISORIO'/);
  });

  it("exige la reunión EN_CURSO (abierta) antes de materializar", () => {
    expect(fn).toContain("SESSION_AGENDA_ITEM_MEETING_NOT_OPEN");
    expect(fn).toMatch(/v_meeting\.status <> 'EN_CURSO'/);
  });

  it("comprueba tenant y rol salvo service_role, con las mismas funciones que fn_secretaria_materialize_convocation_agenda", () => {
    expect(fn).toContain("fn_secretaria_is_service_role()");
    expect(fn).toContain("fn_assert_current_tenant_id()");
    expect(fn).toContain("SESSION_AGENDA_ITEM_TENANT_MISMATCH");
    expect(fn).toMatch(/fn_secretaria_assert_role_allowed\(\s*v_meeting\.tenant_id,\s*ARRAY\['SECRETARIO', 'ADMIN_TENANT'\]/);
  });

  it("un número ya ocupado por un punto de convocatoria se rechaza en vez de reescribirlo", () => {
    expect(fn).toContain("SESSION_AGENDA_ITEM_ORDER_TAKEN_BY_CONVOCATION");
    expect(fn).toMatch(/v_existing\.source_convocatoria_id IS NOT NULL/);
  });

  it("es idempotente: mismo (meeting_id, order_number) ya materializado devuelve su id sin volver a insertar", () => {
    expect(fn).toMatch(/RETURN v_existing\.id;/);
  });

  it("revoca PUBLIC/anon y concede a authenticated/service_role", () => {
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.fn_secretaria_add_session_agenda_item\([^)]*\)\s*\n\s*FROM PUBLIC, anon;/,
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.fn_secretaria_add_session_agenda_item\([^)]*\)\s*\n\s*TO authenticated, service_role;/,
    );
  });

  it("trae un bloque de verificación que aborta si el propietario no coincide con fn_secretaria_materialize_convocation_agenda", () => {
    expect(migration).toContain("DO $verificacion$");
    expect(migration).toMatch(/RAISE EXCEPTION\s+'VERIFICACION: el propietario de la RPC nueva/);
  });

  it("trae un control positivo en subtransacción deshecha (no deja residuo en ARGA)", () => {
    expect(migration).toContain("DO $control_positivo$");
    expect(migration).toMatch(/RAISE EXCEPTION USING ERRCODE = 'P0927'/);
    expect(migration).toMatch(/WHEN SQLSTATE 'P0927' THEN\s*\n\s*NULL;/);
  });

  it("declara el punto abierto de criterio jurídico (arts. 223.1/238.3 LSC) para el Comité Legal, no lo decide", () => {
    expect(migration).toMatch(/223\.1/);
    expect(migration).toMatch(/238\.3/);
    expect(migration).toMatch(/Comité Legal/);
  });
});
