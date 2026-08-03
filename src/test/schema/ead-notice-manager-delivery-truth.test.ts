import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dispatcher = readFileSync(
  join(process.cwd(), "supabase/functions/comms-dispatcher/index.ts"),
  "utf8",
);
const webhook = readFileSync(
  join(process.cwd(), "supabase/functions/webhook-ead-trust/index.ts"),
  "utf8",
);
const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260720124000_ead_notice_manager_delivery_truth.sql"),
  "utf8",
);
const hook = readFileSync(
  join(process.cwd(), "src/hooks/useERDSNotification.ts"),
  "utf8",
);
const rulesIntegration = readFileSync(
  join(process.cwd(), "src/lib/rules-engine/qtsp-integration.ts"),
  "utf8",
);
const qtspHook = readFileSync(
  join(process.cwd(), "src/hooks/useQTSPSign.ts"),
  "utf8",
);

describe("EAD messaging and e-archive truth boundary", () => {
  it("never presents an Evidence Manager create call as a message delivery", () => {
    expect(dispatcher).toMatch(/EAD_NOTICE_MANAGER_SEND_URL/);
    expect(dispatcher).not.toMatch(/fetch\(`\$\{EAD_TRUST_BASE\}\/evidences`/);
    expect(dispatcher).toMatch(/custody is not delivery/i);
    expect(webhook).not.toMatch(/evidence\.delivered/);
  });

  it("accepts only real REQUESTED or DELIVERED provider responses with timestamps", () => {
    expect(dispatcher).toMatch(/statusRaw !== 'REQUESTED' && statusRaw !== 'DELIVERED'/);
    expect(dispatcher).toMatch(/response missing requestId/);
    expect(dispatcher).toMatch(/canonicalProviderTimestamp\(raw\.requestedAt/);
    expect(dispatcher).toMatch(/canonicalProviderTimestamp\(raw\.deliveredAt/);
    expect(dispatcher).toMatch(/fn_recipient_mark_ead_notice_result/);
  });

  it("keeps an unconfigured provider fail-closed", () => {
    expect(dispatcher).toMatch(/EAD Trust Notice Manager not configured/);
    expect(dispatcher).not.toMatch(/ERDS-SANDBOX/);
    expect(hook).toMatch(/status: "BORRADOR"/);
    expect(hook).toMatch(/providerInteraction: false/);
    expect(hook).toMatch(/deliveryProven: false/);
    expect(hook).toMatch(/providerArchiveProven: false/);
    expect(hook).not.toMatch(/useProgramCommunication/);
    expect(qtspHook).toMatch(/const CONTROLLED_MESSAGE/);
    expect(qtspHook).toMatch(/mensajería genérica está retirada/i);
    expect(qtspHook).toMatch(/throw new Error\(CONTROLLED_MESSAGE\)/);
    expect(qtspHook).not.toMatch(/status: ['"]DELIVERED['"]/);
    expect(qtspHook).not.toMatch(/ERDS-SANDBOX/);
  });

  it("does not let the synchronous rules engine invent provider evidence", () => {
    expect(rulesIntegration).toMatch(/status: 'PENDING'/);
    expect(rulesIntegration).toMatch(/delivery_ref: null/);
    expect(rulesIntegration).toMatch(/delivered_at: null/);
    expect(rulesIntegration).toMatch(/evidence_hash: null/);
    expect(rulesIntegration).toMatch(/tsq_token: null/);
    expect(rulesIntegration).toMatch(/LOCAL-NONCRYPTO-/);
    expect(rulesIntegration).not.toMatch(/function generateDeliveryRef/);
    expect(rulesIntegration).not.toMatch(/function generateTSQToken/);
  });

  it("records provider ids, provider timestamps and archive facts in WORM events", () => {
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.fn_recipient_mark_ead_notice_result/);
    expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.fn_recipient_record_ead_notice_callback/);
    expect(migration).toMatch(/'provider_request_id'/);
    expect(migration).toMatch(/'provider_requested_at'/);
    expect(migration).toMatch(/'provider_delivered_at'/);
    expect(migration).toMatch(/'earchive_service', 'EAD_TRUST_EVIDENCE_MANAGER'/);
    expect(migration).toMatch(/communication_delivery_events/);
    expect(migration).toContain("SELECT cr.*\n    INTO v_recipient");
    expect(migration).not.toContain("SELECT cr, c.created_at");
    expect(migration).toMatch(/FROM PUBLIC, anon, authenticated/);
    expect(migration).toMatch(/TO service_role/);
  });

  it("mantiene ENTREGADO como estado terminal ante reintentos y callbacks tardíos", () => {
    expect(migration).toContain("v_recipient.estado_entrega = 'ENTREGADO'");
    expect(migration).toContain("a later request cannot reopen delivery");
    expect(migration).toContain("IF v_recipient_state = 'ENTREGADO' THEN");
    expect(migration).toContain("'terminal_delivery_preserved', v_recipient_state = 'ENTREGADO'");
  });

  it("requires an authenticated Notice Manager callback timestamp instead of inventing one", () => {
    expect(webhook).toMatch(/Notice Manager callback missing provider ids\/timestamps/);
    expect(webhook).toMatch(/fn_recipient_record_ead_notice_callback/);
    expect(webhook).not.toMatch(/deliveredAt \?\? new Date/);
    expect(webhook).not.toMatch(/communication_recipients'\)\.update/);
  });
});
