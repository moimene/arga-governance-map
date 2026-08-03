import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260719140000_secretaria_book_entries_foundation.sql",
  ),
  "utf8",
);

describe("Secretaría — book entries foundation", () => {
  it("persiste secciones, asientos y cierres sin sustituir mandatory_books", () => {
    for (const table of [
      "societary_book_sections",
      "societary_book_entries",
      "societary_book_closures",
      "societary_book_routing_incidents",
    ]) {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`);
      expect(migration).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
    }

    expect(migration).toMatch(/book_id\s+uuid NOT NULL REFERENCES public\.mandatory_books/i);
    expect(migration).toMatch(/section_id\s+uuid NOT NULL REFERENCES public\.societary_book_sections/i);
    expect(migration).toContain("UNIQUE (book_id, ordinal_number)");
    expect(migration).toContain("UNIQUE (tenant_id, source_domain, source_id)");
    expect(migration).toContain("UNIQUE (book_id)");
  });

  it("añade a minutes vínculos compatibles y no reinterpreta actas legacy", () => {
    expect(migration).toMatch(/ALTER TABLE public\.minutes[\s\S]*book_section_id uuid/i);
    expect(migration).toMatch(/ALTER TABLE public\.minutes[\s\S]*book_entry_id uuid/i);
    expect(migration).toContain("book_destination_status");
    expect(migration).toContain("'UNRESOLVED'");
    expect(migration).toContain("requiere remediación legacy gobernada");

    expect(migration).not.toMatch(
      /INSERT INTO public\.societary_book_entries[\s\S]+SELECT[\s\S]+FROM public\.minutes/i,
    );
    expect(migration).not.toContain("CREATE OR REPLACE FUNCTION public.fn_generar_acta");
    expect(migration).not.toContain("CREATE OR REPLACE FUNCTION fn_generar_acta");
  });

  it("hace append-only los asientos y cierres y protege las proyecciones", () => {
    expect(migration).toContain("fn_secretaria_book_append_only_guard");
    expect(migration).toMatch(
      /BEFORE UPDATE OR DELETE ON public\.societary_book_entries/i,
    );
    expect(migration).toMatch(
      /BEFORE UPDATE OR DELETE ON public\.societary_book_closures/i,
    );
    expect(migration).toContain("fn_minutes_book_link_guard");
    expect(migration).toContain("fn_mandatory_books_entry_projection_guard");
    expect(migration).toContain("app.secretaria_book_entries_rpc");
    expect(migration).toMatch(
      /BEFORE UPDATE OR DELETE ON public\.societary_book_routing_incidents/i,
    );
    expect(migration).toMatch(
      /REVOKE EXECUTE ON FUNCTION public\.fn_secretaria_book_append_only_guard\(\)[\s\S]*FROM PUBLIC, anon, authenticated/i,
    );
  });

  it("audita cada asiento y cierre mediante el writer WORM central", () => {
    expect(migration).toMatch(
      /AFTER INSERT ON public\.societary_book_entries[\s\S]*EXECUTE FUNCTION public\.fn_audit_worm\(\)/i,
    );
    expect(migration).toMatch(
      /AFTER INSERT ON public\.societary_book_closures[\s\S]*EXECUTE FUNCTION public\.fn_audit_worm\(\)/i,
    );
  });

  it("valida scope, ordinal y hashes incluso en inserciones privilegiadas", () => {
    expect(migration).toContain("fn_secretaria_book_entry_integrity_guard");
    expect(migration).toContain("fn_secretaria_book_closure_integrity_guard");
    expect(migration).toMatch(/BEFORE INSERT ON public\.societary_book_entries/i);
    expect(migration).toMatch(/BEFORE INSERT ON public\.societary_book_closures/i);
    expect(migration).toContain("source_hash no coincide con el acta canónica");
    expect(migration).toContain("ordinal esperado");
    expect(migration).toContain("manifiesto o rango no coincide");
    expect(migration).toContain("la inserción solo se permite mediante RPC gobernada");
  });

  it("resuelve un destino configurado sin heurísticas ni ambigüedad", () => {
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.fn_secretaria_resolve_minute_book_destination",
    );
    expect(migration).toContain("s.body_id = v_minute.resolved_body_id");
    expect(migration).toContain("s.routing_status = 'ACTIVE'");
    expect(migration).toContain("b.status = 'OPEN'");
    expect(migration).toContain("v_candidate_count > 1");
    expect(migration).not.toContain("fn_acta_book_kind_for_body(");
  });

  it("configura explícitamente una sección MINUTES con idempotencia exacta", () => {
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.fn_secretaria_configure_minute_book_section",
    );
    expect(migration).toContain("v_book.status <> 'OPEN'");
    expect(migration).toContain("v_body.tenant_id <> v_book.tenant_id");
    expect(migration).toContain("v_body.entity_id IS DISTINCT FROM v_book.entity_id");
    expect(migration).toContain("v_book.body_id <> p_body_id");
    expect(migration).toContain("v_section.section_label = v_section_label");
    expect(migration).toContain("v_section.section_kind = 'MINUTES'");
    expect(migration).toContain("already_configured");
    expect(migration).toContain("app.secretaria_book_section_rpc");
    const configureRpc = migration.match(
      /CREATE OR REPLACE FUNCTION public\.fn_secretaria_configure_minute_book_section[\s\S]*?\$function\$;/i,
    )?.[0];
    expect(configureRpc).toContain("INSERT INTO public.societary_book_sections");
    expect(configureRpc).not.toMatch(/INSERT INTO public\.societary_book_sections[\s\S]+SELECT/i);
  });

  it("persiste incidencias de routing sin revertirlas con una excepción", () => {
    expect(migration).toContain("societary_book_routing_incidents");
    expect(migration).toContain("'NO_CANDIDATE'");
    expect(migration).toContain("'AMBIGUOUS'");
    expect(migration).toContain("candidate_fingerprint");
    expect(migration).toContain("ON CONFLICT (tenant_id, minute_id, incident_type, candidate_fingerprint)");
    expect(migration).toContain("'incident_id', v_incident_id");
    expect(migration).toContain("'resolved', false");

    const resolverRpc = migration.match(
      /CREATE OR REPLACE FUNCTION public\.fn_secretaria_resolve_minute_book_destination[\s\S]*?\$function\$;/i,
    )?.[0];
    expect(resolverRpc).toContain("INSERT INTO public.societary_book_routing_incidents");
    expect(resolverRpc).toContain("'resolved', false");
    expect(resolverRpc).not.toContain("sin sección activa configurada");
    expect(resolverRpc).not.toContain("con destino ambiguo");
  });

  it("registra exactamente un asiento solo para actas firmadas y atribuidas", () => {
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.fn_secretaria_register_minute_book_entry",
    );
    expect(migration).toContain("v_minute.signed_at IS NULL");
    expect(migration).toContain("v_minute.is_locked IS NOT TRUE");
    expect(migration).toContain("v_minute.signed_by_president_id IS NULL");
    expect(migration).toContain("v_minute.signed_by_secretary_id IS NULL");
    expect(migration).toContain("v_minute.canonical_minutes_hash");
    expect(migration).toContain("already_recorded");
    expect(migration).toContain("GET DIAGNOSTICS v_affected = ROW_COUNT");

    // El lote valida atribuciones existentes; no inventa ni muta firmantes.
    expect(migration).not.toMatch(/SET[\s\S]{0,250}signed_by_president_id\s*=/i);
    expect(migration).not.toMatch(/SET[\s\S]{0,250}signed_by_secretary_id\s*=/i);
  });

  it("cierra con manifiesto determinista sin declarar legalización", () => {
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.fn_secretaria_close_book_volume",
    );
    expect(migration).toContain("string_agg(");
    expect(migration).toContain("'sha256'");
    expect(migration).toContain("manifest_hash");
    expect(migration).not.toContain("legalization_status =");
    expect(migration).not.toContain("legalization_evidence_url =");
  });

  it("retira los writers legacy que podían cerrar o legalizar sin manifiesto", () => {
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.fn_libro_cerrar_volumen\(uuid\)[\s\S]*FROM PUBLIC, anon, authenticated/i,
    );
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.fn_libro_legalizacion_transicion\(uuid, text, text\)[\s\S]*FROM PUBLIC, anon, authenticated/i,
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.fn_libro_cerrar_volumen\(uuid\)[\s\S]*TO service_role/i,
    );
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.fn_libro_legalizacion_transicion\(uuid, text, text\)[\s\S]*TO service_role/i,
    );
  });

  it("aplica tenant, roles y RLS fail-closed a toda escritura", () => {
    for (const functionName of [
      "fn_secretaria_configure_minute_book_section",
      "fn_secretaria_resolve_minute_book_destination",
      "fn_secretaria_register_minute_book_entry",
      "fn_secretaria_close_book_volume",
    ]) {
      expect(migration).toContain(`CREATE OR REPLACE FUNCTION public.${functionName}`);
      expect(migration).toMatch(
        new RegExp(`REVOKE ALL ON FUNCTION public\\.${functionName}\\([\\s\\S]*FROM PUBLIC, anon`, "i"),
      );
      expect(migration).toMatch(
        new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${functionName}\\([\\s\\S]*TO authenticated, service_role`, "i"),
      );
    }

    expect(migration.match(/public\.fn_assert_current_tenant_id\(\)/g)?.length).toBeGreaterThanOrEqual(4);
    expect(migration.match(/public\.fn_secretaria_assert_role_allowed/g)?.length).toBeGreaterThanOrEqual(4);
    expect(migration).toContain("ARRAY['SECRETARIO', 'ADMIN_TENANT']::text[]");
    expect(migration).toContain("USING (tenant_id = public.fn_current_tenant_id())");
    expect(migration).toContain(
      "REVOKE ALL ON TABLE public.societary_book_entries FROM PUBLIC, anon, authenticated",
    );
  });

  it("permanece separado del lifecycle registral y de acuerdos", () => {
    expect(migration).not.toContain("registry_filings");
    expect(migration).not.toContain("registry_filing_events");
    expect(migration).not.toMatch(/UPDATE public\.agreements/i);
    expect(migration).not.toMatch(/REGISTERED|PUBLISHED/);
    expect(migration).not.toContain("evidence_bundle");
  });
});
