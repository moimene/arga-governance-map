import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260720143000_secretaria_governed_rectification_cancel_gate.sql",
  ),
  "utf8",
);
const lifecycleMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260720142000_secretaria_manifest_recipients_and_rectification_cleanup.sql",
  ),
  "utf8",
);
const legacyTolerance = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260720144000_secretaria_legacy_rectification_metadata_tolerance.sql",
  ),
  "utf8",
);

describe("Secretaría — cancelación gobernada durante rectificación", () => {
  it("solo habilita BORRADOR/PROGRAMADA -> CANCELADA dentro de la RPC autoritativa", () => {
    expect(migration).toContain("TG_OP = 'UPDATE'");
    expect(migration).toContain(
      "current_setting('app.secretaria_convocation_lifecycle_rpc', true) = 'on'",
    );
    expect(migration).toContain("OLD.estado IN ('BORRADOR', 'PROGRAMADA')");
    expect(migration).toContain("NEW.estado = 'CANCELADA'");
    expect(migration).toContain("IF v_governed_cancel THEN");
    expect(migration).toContain("IF NEW.estado <> 'BORRADOR'");
    expect(migration).not.toContain("AND NOT v_governed_cancel");
  });

  it("preserva exactamente el agregado salvo estado y updated_at", () => {
    expect(migration).toContain("to_jsonb(NEW) - 'estado' - 'updated_at'");
    expect(migration).toContain("to_jsonb(OLD) - 'estado' - 'updated_at'");
    expect(migration).toContain(
      "GOVERNED_CONVOCATION_CANCELLATION_MAY_ONLY_CHANGE_STATE_AND_UPDATED_AT",
    );
    const governedBranch = migration.slice(
      migration.indexOf("IF v_governed_cancel THEN"),
      migration.indexOf("IF NEW.tipo_comunicacion = 'CONVOCATORIA' THEN"),
    );
    expect(governedBranch).toContain("RETURN NEW;");
    expect(governedBranch).not.toContain("NEW.metadata :=");
  });

  it("mantiene el sandbox sin fechas, dispatch, proveedor, firma ni ERDS", () => {
    expect(migration).toContain("NEW.fecha_programada IS NOT NULL");
    expect(migration).toContain("NEW.fecha_envio_efectiva IS NOT NULL");
    expect(migration).toContain("NEW.fecha_limite_respuesta IS NOT NULL");
    expect(migration).toContain("NEW.metadata -> 'dispatch_allowed' IS DISTINCT FROM 'false'::jsonb");
    expect(migration).toContain("NEW.metadata -> 'dispatcher_triggered' IS DISTINCT FROM 'false'::jsonb");
    expect(migration).toContain("NEW.metadata -> 'provider_interaction' IS DISTINCT FROM 'false'::jsonb");
    expect(migration).toContain("fn_secretaria_jsonb_has_forbidden_signature_claim");
    expect(migration).toContain("'{ead_service,signature_claim}'");
    expect(migration).toContain("'{ead_service,erds_claim}'");
    expect(migration).toContain(
      "GOVERNED_CONVOCATION_CANCELLATION_REQUIRES_SANDBOX_WITHOUT_EXTERNALITY",
    );
  });

  it("la función de ciclo activa y retira el GUC alrededor de la limpieza", () => {
    const flagOn = lifecycleMigration.indexOf(
      "set_config('app.secretaria_convocation_lifecycle_rpc', 'on', true)",
    );
    const communicationCancel = lifecycleMigration.indexOf(
      "UPDATE public.communications communication",
      flagOn,
    );
    const flagOff = lifecycleMigration.indexOf(
      "set_config('app.secretaria_convocation_lifecycle_rpc', 'off', true)",
      communicationCancel,
    );
    expect(flagOn).toBeGreaterThan(0);
    expect(communicationCancel).toBeGreaterThan(flagOn);
    expect(flagOff).toBeGreaterThan(communicationCancel);
  });

  it("separa el trigger de cancelación legacy sin relajar altas ni updates ordinarios", () => {
    expect(legacyTolerance).toContain(
      "CREATE TRIGGER trg_secretaria_guard_ead_sandbox_communication_insert",
    );
    expect(legacyTolerance).toContain(
      "CREATE TRIGGER trg_secretaria_guard_ead_sandbox_communication_update",
    );
    expect(legacyTolerance).toContain(
      "CREATE TRIGGER trg_secretaria_guard_ead_sandbox_governed_cancel",
    );
    expect(legacyTolerance).toContain("WHEN (NOT (");
    expect(legacyTolerance).toContain(
      "EXECUTE FUNCTION public.fn_secretaria_guard_ead_sandbox_communication()",
    );
    expect(legacyTolerance).toContain(
      "EXECUTE FUNCTION secretaria_private.fn_guard_governed_communication_cancel()",
    );
  });

  it("tolera flags negativos legacy ausentes, pero nunca valores positivos", () => {
    for (const key of [
      "delivery_allowed",
      "dispatch_allowed",
      "dispatcher_triggered",
      "provider_interaction",
    ]) {
      expect(legacyTolerance).toContain(`NEW.metadata ? '${key}'`);
      expect(legacyTolerance).toContain(
        `NEW.metadata -> '${key}' IS DISTINCT FROM 'false'::jsonb`,
      );
    }
    expect(legacyTolerance).toContain("NEW.metadata -> 'dispatch_forbidden' = 'true'::jsonb");
    expect(legacyTolerance).toContain("to_jsonb(NEW) - 'estado' - 'updated_at'");
    expect(legacyTolerance).toContain("fn_secretaria_jsonb_has_forbidden_signature_claim");
    expect(legacyTolerance).toContain("'{ead_service,signature_claim}'");
    expect(legacyTolerance).toContain("'{ead_service,erds_claim}'");
  });
});
