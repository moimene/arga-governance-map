import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const migration = read(
  "supabase/migrations/20260720135000_secretaria_convocation_dispatch_hardening.sql",
);
const dispatcher = read("supabase/functions/comms-dispatcher/index.ts");
const qtspProxy = read("supabase/functions/qtsp-proxy/index.ts");

function sqlFunction(source: string, name: string): string {
  const start = source.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  expect(start, `${name} must exist`).toBeGreaterThanOrEqual(0);
  const body = source.indexOf("AS $function$", start);
  const end = source.indexOf("$function$;", body);
  expect(body).toBeGreaterThan(start);
  expect(end).toBeGreaterThan(body);
  return source.slice(start, end + "$function$;".length);
}

describe("cierre fail-closed de RBAC y EAD", () => {
  it("trata el rol NULL como inactivo y persiste is_active como booleano obligatorio", () => {
    expect(migration).toMatch(
      /UPDATE public\.rbac_user_roles\s+SET is_active = false\s+WHERE is_active IS NULL;/,
    );
    expect(migration).toMatch(
      /ALTER TABLE public\.rbac_user_roles\s+ALTER COLUMN is_active SET DEFAULT true,\s+ALTER COLUMN is_active SET NOT NULL;/,
    );

    const operatorGuard = sqlFunction(
      migration,
      "fn_secretaria_assert_communication_operator",
    );
    expect(operatorGuard).toContain("user_role.is_active IS TRUE");
    expect(operatorGuard).not.toMatch(/COALESCE\(user_role\.is_active,\s*true\)/i);
  });

  it("rechaza asignaciones expiradas tanto en SQL como en el dispatcher", () => {
    const operatorGuard = sqlFunction(
      migration,
      "fn_secretaria_assert_communication_operator",
    );
    expect(operatorGuard).toContain(
      "user_role.expires_at IS NULL OR user_role.expires_at > clock_timestamp()",
    );

    const authStart = dispatcher.indexOf("async function authorizeCaller");
    const authEnd = dispatcher.indexOf("async function resendSend", authStart);
    const authorization = dispatcher.slice(authStart, authEnd);
    expect(authorization).toContain("r.is_active === true");
    expect(authorization).toContain(
      "!r.expires_at || Date.parse(r.expires_at) > authorizationTime",
    );
    expect(authorization).not.toContain("r.is_active ?? true");
  });

  it("exige el secreto dedicado de Notice Manager antes de cualquier fetch", () => {
    expect(dispatcher).toContain(
      "const EAD_NOTICE_MANAGER_API_KEY = Deno.env.get('EAD_NOTICE_MANAGER_API_KEY') ?? '';",
    );
    expect(dispatcher).not.toMatch(
      /EAD_NOTICE_MANAGER_API_KEY\s*=\s*[^;]*EAD_TRUST_KEY/,
    );

    const sendStart = dispatcher.indexOf("async function eadTrustErdsSend");
    const sendEnd = dispatcher.indexOf("serve(async", sendStart);
    const send = dispatcher.slice(sendStart, sendEnd);
    const missingSecretGuard = send.indexOf(
      "if (!endpoint || !EAD_NOTICE_MANAGER_API_KEY)",
    );
    const providerFetch = send.indexOf("fetch(endpoint");
    expect(missingSecretGuard).toBeGreaterThanOrEqual(0);
    expect(providerFetch).toBeGreaterThan(missingSecretGuard);
  });

  it("cierra la reconciliación antes de leer proveedor, descargar o custodiar", () => {
    const start = qtspProxy.indexOf(
      "async function handleReconcileVerifiedSignature",
    );
    const end = qtspProxy.indexOf(
      "// ─── Cuentas anuales",
      start,
    );
    const handler = qtspProxy.slice(start, end);
    const authentication = handler.indexOf("authenticateEdgeRequest(req)");
    const hardGate = handler.indexOf(
      "const authoritativeBinaryFinalizationEnabled = false",
    );
    expect(authentication).toBeGreaterThanOrEqual(0);
    expect(hardGate).toBeGreaterThan(authentication);
    for (const sideEffect of [
      "parseLegalArtifactCoordinates(body)",
      "readProviderCompletion",
      "downloadProviderBytes",
      "archiveProviderInterpositionOutput",
      "fn_secretaria_register_custodied_legal_artifact",
    ]) {
      expect(handler.indexOf(sideEffect), sideEffect).toBeGreaterThan(hardGate);
    }
    expect(handler).toContain('code: "AUTHORITATIVE_BINARY_REQUIRED"');
    expect(handler).toContain("custodyCreated: false");
    expect(handler).toContain("finalArtifactCreated: false");
  });
});
