import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260720147000_secretaria_rectified_package_immutability.sql",
  ),
  "utf8",
);

function sqlFunction(qualifiedName: string) {
  const start = migration.indexOf(`CREATE OR REPLACE FUNCTION ${qualifiedName}()`);
  expect(start, `${qualifiedName} must exist`).toBeGreaterThanOrEqual(0);
  const body = migration.indexOf("AS $function$", start);
  const end = migration.indexOf("$function$;", body);
  expect(body).toBeGreaterThan(start);
  expect(end).toBeGreaterThan(body);
  return migration.slice(start, end + "$function$;".length);
}

describe("Secretaría — contrato histórico 147 supersedido por el binding WORM 149", () => {
  it("serializa el alta con el mismo lock que emisión y lifecycle", () => {
    const guard = sqlFunction(
      "secretaria_private.fn_supporting_attachment_open_guard",
    );
    const advisory = guard.indexOf("pg_advisory_xact_lock");
    const rootLock = guard.indexOf("FOR UPDATE");

    expect(advisory).toBeGreaterThan(0);
    expect(rootLock).toBeGreaterThan(advisory);
    expect(guard).toContain("COMMUNICATION:CONVOCATORIA:");
    expect(guard).toContain("SUPPORTING_ATTACHMENT_CONVOCATORIA_TENANT_MISMATCH");
  });

  it("rechaza convocatorias terminales y manifiestos WORM", () => {
    const guard = sqlFunction(
      "secretaria_private.fn_supporting_attachment_open_guard",
    );

    expect(guard).toContain("v_convocatoria_state IN ('RECTIFICADA', 'CANCELADA')");
    expect(guard).toContain("TERMINAL_CONVOCATION_SUPPORTING_ATTACHMENTS_ARE_IMMUTABLE");
    expect(guard).toContain("FROM public.convocation_manifests manifest");
    expect(guard).toContain("manifest.immutable_at IS NOT NULL");
    expect(guard).toContain("IMMUTABLE_CONVOCATION_MANIFEST_FREEZES_SUPPORTING_ATTACHMENTS");
  });

  it("mantiene congelado el paquete aunque su comunicación quede cancelada", () => {
    const guard = sqlFunction(
      "secretaria_private.fn_supporting_attachment_open_guard",
    );

    expect(guard).toContain("FROM public.communications communication");
    expect(guard).toContain("communication.tipo_comunicacion = 'CONVOCATORIA'");
    expect(guard).toContain("ASSEMBLED_CONVOCATION_PACKAGE_FREEZES_SUPPORTING_ATTACHMENTS");
    expect(guard).not.toContain("communication.estado <> 'CANCELADA'");
    expect(guard).not.toContain("communication.estado NOT IN");
  });

  it("cubre altas y rebindings sin romper actualizaciones técnicas idempotentes", () => {
    const guard = sqlFunction(
      "secretaria_private.fn_supporting_attachment_open_guard",
    );

    expect(migration).toContain("BEFORE INSERT ON public.attachments");
    expect(migration).toContain(
      "BEFORE UPDATE OF tenant_id, convocatoria_id, artifact_kind ON public.attachments",
    );
    expect(guard).toContain("TG_OP = 'UPDATE'");
    expect(guard).toContain("NEW.convocatoria_id IS NOT DISTINCT FROM OLD.convocatoria_id");
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION secretaria_private.fn_supporting_attachment_open_guard()",
    );
  });
});
