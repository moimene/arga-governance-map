// src/test/schema/secretaria-plantillas-aprobacion-demo-scope.test.ts
/**
 * Test de arista y sonda viva · No-atribución de aprobación legal a plantillas con marcador demo (MOI-137).
 *
 * Vigila que en los tres entornos de Cloud (ARGA, Garrigues y Grupo Nuevo):
 *  1. NINGUNA plantilla con marcador de demostración en `aprobada_por` (demo, demo-operativo, seed)
 *     reciba la condición de `canClaimLegalApproval = true` ni el rótulo «Aprobada legalmente».
 *  2. Toda plantilla activa con dicho marcador reciba `label = "Vigente sin aprobación nominativa"`
 *     (o "Revisión legal" si acumula defectos jurídicos adicionales), con `status = "operational_unapproved"`
 *     o `"needs_review"`.
 *  3. Control positivo: verifica que se inspeccionan decenas de plantillas reales con marcador demo
 *     (evitando aprobación vacua).
 *  4. Integridad de la migración 20260925110000 en disco.
 */

import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEMO_TENANT,
  GARRIGUES_TENANT,
  NUEVO_TENANT,
  sesionDe,
} from "../helpers/supabase-test-client";
import type { PlantillaProtegidaRow } from "../../hooks/usePlantillasProtegidas";
import {
  buildLegalTemplateReviewRows,
  type LegalTemplateReviewRow,
} from "../../lib/secretaria/legal-template-review";
import { buildTemplateDocumentBindings } from "../../lib/secretaria/mesa-control-societaria";
import { hasDemoApprovalMarker } from "../../lib/secretaria/template-admin/patterns";

const MIGRATION_PATH = join(
  process.cwd(),
  "supabase/migrations/20260925110000_secretaria_template_transition_approval_guard.sql",
);

describe("Sonda viva · No-atribución de aprobación legal a plantillas con marcador demo (MOI-137)", () => {
  let argaClient: SupabaseClient;

  beforeAll(async () => {
    argaClient = await sesionDe("ARGA");
  });

  it("la migración de refuerzo server-side existe en disco con sus aserciones", () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true);
    const content = readFileSync(MIGRATION_PATH, "utf8");
    expect(content).toContain("fn_secretaria_transition_template_state");
    expect(content).toContain("btrim(p_aprobada_por) ~* '^(falta|pendiente)'");
    expect(content).toContain("MISSING_APPROVAL_DATA");
  });

  it("en ARGA (...0001), ninguna plantilla con marcador demo recibe 'Aprobada legalmente'", async () => {
    const { data, error } = await argaClient
      .from("plantillas_protegidas")
      .select("*")
      .eq("tenant_id", DEMO_TENANT)
      .eq("estado", "ACTIVA");

    expect(error).toBeNull();
    const rows = (data ?? []) as PlantillaProtegidaRow[];
    expect(rows.length).toBeGreaterThanOrEqual(60);

    const reviewRows = buildLegalTemplateReviewRows(rows);
    let countDemo = 0;

    for (const review of reviewRows) {
      const original = rows.find((r) => r.id === review.templateId);
      if (hasDemoApprovalMarker(original?.aprobada_por)) {
        countDemo++;
        expect(review.canClaimLegalApproval).toBe(false);
        expect(review.status).not.toBe("legally_approved");
        expect(review.label).not.toBe("Aprobada legalmente");
        expect(["operational_unapproved", "needs_review"]).toContain(review.status);
        if (review.status === "operational_unapproved") {
          expect(review.label).toBe("Vigente sin aprobación nominativa");
        }
      } else if (review.canClaimLegalApproval) {
        // Control nominativo estricto: toda plantilla con claim legal debe provenir de autoridad real
        expect(original?.aprobada_por).toMatch(/Garrigues \/ Comité Legal/i);
      }
    }

    // Mesa de control societaria: ninguna plantilla demo ostenta "aprobación formal registrada"
    const bindings = buildTemplateDocumentBindings(rows, {
      jurisdiction: "ES",
      materia: "CONVOCATORIA_PRE",
    });
    for (const b of bindings) {
      if (hasDemoApprovalMarker(b.template.aprobada_por)) {
        expect(b.statusLabel).not.toBe("Vigente · aprobación formal registrada");
        expect(b.statusLabel).toBe("Vigente · sin aprobación nominativa");
      }
    }

    // Control positivo en ARGA: al menos 50 plantillas llevan marcador demo
    expect(countDemo).toBeGreaterThanOrEqual(50);
  });

  it("en Garrigues (...0002), ninguna plantilla con marcador demo recibe 'Aprobada legalmente'", async () => {
    const garriguesClient = await sesionDe("GARRIGUES");
    const { data, error } = await garriguesClient
      .from("plantillas_protegidas")
      .select("*")
      .eq("tenant_id", GARRIGUES_TENANT)
      .eq("estado", "ACTIVA");

    expect(error).toBeNull();
    const rows = (data ?? []) as PlantillaProtegidaRow[];
    expect(rows.length).toBeGreaterThanOrEqual(5);

    const reviewRows = buildLegalTemplateReviewRows(rows);
    let countDemo = 0;

    for (const review of reviewRows) {
      const original = rows.find((r) => r.id === review.templateId);
      if (hasDemoApprovalMarker(original?.aprobada_por)) {
        countDemo++;
        expect(review.canClaimLegalApproval).toBe(false);
        expect(review.status).not.toBe("legally_approved");
        expect(review.label).not.toBe("Aprobada legalmente");
        if (review.status === "operational_unapproved") {
          expect(review.label).toBe("Vigente sin aprobación nominativa");
        }
      }
    }

    // Control positivo en Garrigues: las 6 plantillas de seed llevan marcador demo
    expect(countDemo).toBeGreaterThanOrEqual(5);
  });

  it("en Grupo Nuevo (...0003), ninguna plantilla clonada con marcador demo recibe 'Aprobada legalmente'", async () => {
    // Leído con service-role o cuenta autorizada del grupo nuevo
    const nuevoClient = await sesionDe("NUEVO");
    const { data, error } = await nuevoClient
      .from("plantillas_protegidas")
      .select("*")
      .eq("tenant_id", NUEVO_TENANT)
      .eq("estado", "ACTIVA");

    expect(error).toBeNull();
    const rows = (data ?? []) as PlantillaProtegidaRow[];
    expect(rows.length).toBeGreaterThanOrEqual(60);

    const reviewRows = buildLegalTemplateReviewRows(rows);
    let countDemo = 0;

    for (const review of reviewRows) {
      const original = rows.find((r) => r.id === review.templateId);
      if (hasDemoApprovalMarker(original?.aprobada_por)) {
        countDemo++;
        expect(review.canClaimLegalApproval).toBe(false);
        expect(review.status).not.toBe("legally_approved");
        expect(review.label).not.toBe("Aprobada legalmente");
        if (review.status === "operational_unapproved") {
          expect(review.label).toBe("Vigente sin aprobación nominativa");
        }
      }
    }

    // Control positivo en Grupo Nuevo: al menos 50 plantillas son clones con marcador demo
    expect(countDemo).toBeGreaterThanOrEqual(50);
  });
});
