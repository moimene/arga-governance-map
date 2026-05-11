/**
 * Task 9 / D3 CRITICAL — `useActas.buildActaPuntosSequencial` debe preservar
 * orden cronológico del orden del día (RRM art. 99).
 *
 * Adversarial round 4 detectó: cualquier reagrupación por `kind` rompe
 * 1) el orden cronológico exigido por RRM art. 99,
 * 2) la plantilla ACTA_SESION canónica que usa `{{#each puntos}}` secuencial,
 * 3) la jurisprudencia mercantil sobre validez del acta.
 *
 * Ver: docs/superpowers/specs/2026-05-12-agenda-item-kind-spec.md §5 + §10.
 *
 * Función pura — sin renderHook, sin mocks de Supabase.
 */
import { describe, it, expect } from "vitest";
import {
  buildActaPuntosSequencial,
  type AgendaItemRow,
  type MeetingResolutionRow,
} from "../useActas";

describe("useActas D3 orden secuencial (RRM art. 99)", () => {
  it("preserva orden del orden del día con puntos mixtos (4 tipos)", () => {
    const input: AgendaItemRow[] = [
      {
        meeting_id: "m1",
        order_number: 1,
        title: "Informe Presidente",
        kind: "INFORMATIVO",
        id: "i1",
        description: null,
        tenant_id: "t1",
        created_at: null,
      },
      {
        meeting_id: "m1",
        order_number: 2,
        title: "Aprobación cuentas",
        kind: "DECISORIO",
        id: "i2",
        description: null,
        tenant_id: "t1",
        created_at: null,
      },
      {
        meeting_id: "m1",
        order_number: 3,
        title: "Seguimiento riesgos",
        kind: "DELIBERATIVO",
        id: "i3",
        description: null,
        tenant_id: "t1",
        created_at: null,
      },
      {
        meeting_id: "m1",
        order_number: 4,
        title: "Nombramiento consejero",
        kind: "DECISORIO",
        id: "i4",
        description: null,
        tenant_id: "t1",
        created_at: null,
      },
    ];
    const resolutions: MeetingResolutionRow[] = []; // empty for simplicity
    const result = buildActaPuntosSequencial(input, resolutions);

    // CRITICAL: order MUST be 1, 2, 3, 4 — NOT regrouped (info first, decis last, etc.)
    expect(result.map((p) => p.order_number)).toEqual([1, 2, 3, 4]);
    expect(result.map((p) => p.kind)).toEqual([
      "INFORMATIVO",
      "DECISORIO",
      "DELIBERATIVO",
      "DECISORIO",
    ]);
  });

  it("ordena por order_number cuando input viene desordenado", () => {
    const input: AgendaItemRow[] = [
      {
        meeting_id: "m1",
        order_number: 3,
        kind: "DELIBERATIVO",
        title: "Tres",
        id: "i3",
        description: null,
        tenant_id: "t1",
        created_at: null,
      },
      {
        meeting_id: "m1",
        order_number: 1,
        kind: "INFORMATIVO",
        title: "Uno",
        id: "i1",
        description: null,
        tenant_id: "t1",
        created_at: null,
      },
      {
        meeting_id: "m1",
        order_number: 2,
        kind: "DECISORIO",
        title: "Dos",
        id: "i2",
        description: null,
        tenant_id: "t1",
        created_at: null,
      },
    ];
    const result = buildActaPuntosSequencial(input, []);
    expect(result.map((p) => p.order_number)).toEqual([1, 2, 3]);
    expect(result.map((p) => p.title)).toEqual(["Uno", "Dos", "Tres"]);
  });

  it("merges kind_resolution from meeting_resolutions cuando existe", () => {
    const items: AgendaItemRow[] = [
      {
        meeting_id: "m1",
        order_number: 1,
        kind: "DECISORIO",
        title: "P1",
        id: "i1",
        description: null,
        tenant_id: "t1",
        created_at: null,
      },
    ];
    const resolutions: MeetingResolutionRow[] = [
      {
        meeting_id: "m1",
        agenda_item_index: 1,
        kind_resolution: "DECISION",
        status: "ADOPTED",
        resolution_text: "Aprobado",
      },
    ];
    const result = buildActaPuntosSequencial(items, resolutions);
    expect(result[0].kind_resolution).toBe("DECISION");
    expect(result[0].status).toBe("ADOPTED");
    expect(result[0].resolution_text).toBe("Aprobado");
  });

  it("graceful degradation: puntos sin resolución devuelven campos decisorios null", () => {
    // Plantilla legacy v1.2.0 (sin bloques condicionales) renderizará campos
    // null como cadena vacía — sin romper la generación del acta.
    const items: AgendaItemRow[] = [
      {
        meeting_id: "m1",
        order_number: 1,
        kind: "INFORMATIVO",
        title: "Solo informe, sin voto",
        id: "i1",
        description: null,
        tenant_id: "t1",
        created_at: null,
      },
      {
        meeting_id: "m1",
        order_number: 2,
        kind: "DELIBERATIVO",
        title: "Debate sin acuerdo",
        id: "i2",
        description: null,
        tenant_id: "t1",
        created_at: null,
      },
    ];
    const result = buildActaPuntosSequencial(items, []);
    expect(result[0].kind_resolution).toBeNull();
    expect(result[0].status).toBeNull();
    expect(result[0].resolution_text).toBeNull();
    expect(result[0].agreement_id).toBeNull();
    expect(result[1].kind_resolution).toBeNull();
    // El `kind` del agenda_item SÍ se preserva (es metadata cronológica).
    expect(result[0].kind).toBe("INFORMATIVO");
    expect(result[1].kind).toBe("DELIBERATIVO");
  });

  it("normaliza kinds inválidos al default DELIBERATIVO (consistente con agenda-kind.ts)", () => {
    const items: AgendaItemRow[] = [
      {
        meeting_id: "m1",
        order_number: 1,
        kind: "INVALID_KIND",
        title: "Punto basura",
        id: "i1",
        description: null,
        tenant_id: "t1",
        created_at: null,
      },
      {
        meeting_id: "m1",
        order_number: 2,
        kind: null,
        title: "Punto sin kind",
        id: "i2",
        description: null,
        tenant_id: "t1",
        created_at: null,
      },
    ];
    const result = buildActaPuntosSequencial(items, []);
    expect(result[0].kind).toBe("DELIBERATIVO");
    expect(result[1].kind).toBe("DELIBERATIVO");
  });

  it("ignora resoluciones huérfanas (agenda_item_index sin agenda_item correspondiente)", () => {
    const items: AgendaItemRow[] = [
      {
        meeting_id: "m1",
        order_number: 1,
        kind: "DECISORIO",
        title: "P1",
        id: "i1",
        description: null,
        tenant_id: "t1",
        created_at: null,
      },
    ];
    const resolutions: MeetingResolutionRow[] = [
      {
        meeting_id: "m1",
        agenda_item_index: 1,
        kind_resolution: "DECISION",
        status: "ADOPTED",
        resolution_text: "OK",
      },
      // Resolución huérfana: no hay agenda_item con order_number=99.
      {
        meeting_id: "m1",
        agenda_item_index: 99,
        kind_resolution: "DECISION",
        status: "ADOPTED",
        resolution_text: "Huérfana",
      },
    ];
    const result = buildActaPuntosSequencial(items, resolutions);
    expect(result).toHaveLength(1);
    expect(result[0].resolution_text).toBe("OK");
  });
});
