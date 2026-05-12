// src/test/schema/gate-pre-cloud-calibration.test.ts
import { describe, it, expect } from "vitest";
import { hasAdminClient, DEMO_TENANT } from "@/test/helpers/supabase-test-client";
import { validateTemplateForActivation } from "@/lib/secretaria/template-admin/gate-pre";
import { loadAllActiveTemplates } from "@/lib/secretaria/template-admin/cloud-helpers";
import { KNOWN_P0_TEMPLATE_IDS } from "@/lib/secretaria/template-admin/known-p0";

describe.skipIf(!hasAdminClient())("Gate PRE — calibración Cloud (D16)", () => {
  it("sobre las 41 ACTIVA produce exactamente 2 BLOCKING (FUSION + RATIFICACION)", async () => {
    const active = await loadAllActiveTemplates(DEMO_TENANT);
    const ctx = { tenantId: DEMO_TENANT, existingActiveTemplates: active };
    const blockingIds: string[] = [];
    let totalBlocking = 0;
    for (const t of active) {
      const result = validateTemplateForActivation(t, ctx);
      if (result.summary.blocking > 0) {
        blockingIds.push(t.id);
        totalBlocking += result.summary.blocking;
      }
    }
    expect(blockingIds.sort()).toEqual([...KNOWN_P0_TEMPLATE_IDS].sort());
    // El total de issues BLOCKING debe ser al menos 2 (una por plantilla P0). Puede ser más
    // si el motor detecta otras condiciones agregadas, pero esto debe documentarse aquí.
    expect(totalBlocking).toBeGreaterThanOrEqual(2);
  });
});
