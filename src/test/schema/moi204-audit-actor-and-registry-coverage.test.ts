import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// MOI-204 — autor en la cadena WORM (receta versionada, decisión D-16 opción a)
// + cobertura de auditoría de actas (minutes) y expedientes registrales
// (registry_filings). Test estático sobre el texto de la migración, mismo
// patrón que src/test/schema/secretaria-p0-capital-movement-audit.test.ts y
// src/test/schema/f2-surface-hardening.test.ts: no hay RPC de solo lectura
// para leer pg_get_functiondef desde `bun test` (no expuesta como client-side
// PostgREST), así que el gate vive sobre la fuente versionada que se aplica
// tal cual a Cloud.
const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260926120400_moi204_audit_actor_and_registry_coverage.sql",
  ),
  "utf8",
);

describe("MOI-204 — actor en audit_log + cobertura minutes/registry_filings", () => {
  it("versiona la receta del hash en vez de reescribir huellas históricas", () => {
    expect(migration).toMatch(/ADD COLUMN IF NOT EXISTS hash_recipe_version smallint/i);
    // audit_log es de solo anexión: la migración no hace NINGÚN UPDATE sobre
    // ella. Las filas ya escritas quedan con hash_recipe_version NULL, que el
    // verificador lee como receta 1.
    expect(migration).not.toMatch(/UPDATE public\.audit_log/i);
    expect(migration).not.toMatch(/ALTER COLUMN hash_recipe_version SET NOT NULL/i);
    expect(migration).toMatch(/CHECK \(hash_recipe_version IN \(1, 2\)\)/);
    expect(migration).toMatch(/ALTER COLUMN hash_recipe_version SET DEFAULT 2/i);
  });

  it("prueba, dentro de la propia migración, que ninguna huella histórica cambió", () => {
    // Control positivo real (no solo un comentario que lo declare): snapshot
    // ANTES de tocar nada + comparación DESPUÉS, con RAISE EXCEPTION si algo
    // cambió. Sin este par la migración podría reescribir hashes en silencio.
    expect(migration).toMatch(/CREATE TEMP TABLE _moi204_pre_hashes[\s\S]*SELECT id, hash_sha512 FROM public\.audit_log/i);
    expect(migration).toMatch(/JOIN _moi204_pre_hashes p ON p\.id = a\.id/);
    expect(migration).toMatch(/WHERE a\.hash_sha512 IS DISTINCT FROM p\.hash_sha512/);
    expect(migration).toMatch(/RAISE EXCEPTION 'MOI-204: % huellas históricas de audit_log fueron reescritas/);
  });

  it("fn_audit_worm escribe actor_id desde el sub del JWT de sesión", () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.fn_audit_worm\(\)/);
    expect(migration).toMatch(
      /NULLIF\(current_setting\('request\.jwt\.claims', true\), ''\)::jsonb ->> 'sub'/,
    );
    // Una conexión que ya usó set_config local deja la clave en '' (no NULL):
    // el cast directo a jsonb tumbaría toda escritura auditada.
    expect(migration).toMatch(/NULLIF\(current_setting\('request\.jwt\.claims', true\), ''\)::jsonb->>'email'/);
    expect(migration).toMatch(
      /INSERT INTO public\.audit_log \(\s*tenant_id, table_name, record_id, action,\s*actor_email, actor_id, delta, hash_sha512, created_at\s*\)/,
    );
  });

  it("fn_audit_log_chain incluye actor_id en la huella v2 y fn_verify_audit_chain la reconoce por fila", () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.fn_audit_log_chain\(\)/);
    expect(migration).toMatch(/IF NEW\.hash_recipe_version >= 2 THEN/);
    expect(migration).toMatch(
      /COALESCE\(NEW\.record_id::text, ''\) \|\| '\|' \|\|\s*COALESCE\(NEW\.actor_id::text, ''\) \|\| '\|' \|\|\s*COALESCE\(NEW\.delta::text, '\{\}'\)/,
    );

    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.fn_verify_audit_chain\(p_tenant_id uuid\)/);
    expect(migration).toMatch(/IF COALESCE\(v_row\.hash_recipe_version, 1\) >= 2 THEN/);
    expect(migration).toMatch(
      /COALESCE\(v_row\.record_id::text, ''\) \|\| '\|' \|\|\s*COALESCE\(v_row\.actor_id::text, ''\) \|\| '\|' \|\|\s*COALESCE\(v_row\.delta::text, '\{\}'\)/,
    );
  });

  it("añade cobertura de auditoría a minutes y a registry_filings", () => {
    expect(migration).toMatch(
      /CREATE OR REPLACE TRIGGER trg_audit_worm_minutes\s+AFTER INSERT OR UPDATE OR DELETE ON public\.minutes\s+FOR EACH ROW EXECUTE FUNCTION public\.fn_audit_worm\(\)/,
    );
    expect(migration).toMatch(
      /CREATE OR REPLACE TRIGGER trg_audit_worm_registry_filings\s+AFTER INSERT OR UPDATE OR DELETE ON public\.registry_filings\s+FOR EACH ROW EXECUTE FUNCTION public\.fn_audit_worm\(\)/,
    );
  });

  it("aborta la migración si la cadena no queda válida para cada tenant, incluidos los tres del issue", () => {
    expect(migration).toMatch(/FOR v_tenant IN SELECT DISTINCT tenant_id FROM public\.audit_log LOOP/);
    expect(migration).toMatch(
      /RAISE EXCEPTION 'MOI-204: fn_verify_audit_chain no da chain_valid=true para tenant % \(total=%\)'/,
    );
    expect(migration).toMatch(/RAISE EXCEPTION 'MOI-204: verificación vacua/);
    for (const tenant of [
      "00000000-0000-0000-0000-000000000001",
      "00000000-0000-0000-0000-000000000002",
      "00000000-0000-0000-0000-000000000003",
    ]) {
      expect(migration).toContain(tenant);
    }
  });

  it("no toca los 6 guards existentes de minutes ni añade DELETE/TRUNCATE de saneado", () => {
    expect(migration).not.toMatch(/DROP TRIGGER[\s\S]*lock_guard/i);
    expect(migration).not.toMatch(/DROP TRIGGER[\s\S]*book_link_guard/i);
    expect(migration).not.toMatch(/DROP TRIGGER[\s\S]*authoritative_domain_guard/i);
    expect(migration).not.toMatch(/DROP TRIGGER[\s\S]*authoritative_insert_guard/i);
    expect(migration).not.toMatch(/DROP TRIGGER[\s\S]*annual_accounts_gate/i);
    expect(migration).not.toMatch(/DROP TRIGGER[\s\S]*interposition_domain_guard/i);
    expect(migration).not.toMatch(/\bTRUNCATE\b/i);
    expect(migration).not.toMatch(/DELETE FROM public\.audit_log/i);
    expect(migration).not.toMatch(/DELETE FROM public\.minutes/i);
    expect(migration).not.toMatch(/DELETE FROM public\.registry_filings/i);
  });
});

// El ensayo revertido vive junto a la migración, en supabase/migrations/proposed/
// como *.probe.sql (begin; ... rollback;), tal y como exige el protocolo de
// ejecución para este issue. Este test comprueba que el fichero existe y que
// de verdad prueba una escritura real (no solo relee la migración) antes de
// revertir — si alguien lo vacía a "begin; rollback;" sin probar nada, este
// gate lo detecta.
describe("MOI-204 — ensayo revertido (proposed/*.probe.sql)", () => {
  const probe = readFileSync(
    join(
      process.cwd(),
      "supabase/migrations/proposed/20260926120400_moi204_audit_actor_and_registry_coverage.probe.sql",
    ),
    "utf8",
  );

  it("empieza en begin y termina en rollback, sin dejar nada persistido", () => {
    expect(probe.trimStart().slice(0, 6).toLowerCase()).toBe("begin;");
    expect(probe.trimEnd().slice(-9).toLowerCase()).toBe("rollback;");
  });

  it("inserta de verdad en minutes y en registry_filings dentro del ensayo", () => {
    expect(probe).toMatch(/INSERT INTO public\.minutes \(id, tenant_id\)/);
    expect(probe).toMatch(/INSERT INTO public\.registry_filings \(id, tenant_id\)/);
  });

  it("comprueba actor_id de sesión y receta v2 sobre las filas insertadas, y su ausencia sin sesión", () => {
    expect(probe).toMatch(/request\.jwt\.claims[\s\S]*11111111-1111-1111-1111-111111111111/);
    expect(probe).toMatch(/actor_id = '11111111-1111-1111-1111-111111111111'/);
    expect(probe).toMatch(/hash_recipe_version = 2/);
    expect(probe).toMatch(/PROBE MOI-204: escritura sin sesión no debería tener actor_id/);
  });
});
