/**
 * MOI-137 — Prueba de arista (pantalla → librería), DashboardTab.
 *
 * Revisión adversarial (rev.findings[0], severidad P1): la versión anterior
 * buscaba el texto «Aprobada legalmente» en el DOM, pero DashboardTab jamás
 * lo pinta — su cola de incidencias (`LEGAL_INCIDENTS` en
 * template-governance-ux.ts) solo agrega 5 flags concretos (missingOwner,
 * missingReference, missingApproval, draftVersion, notesRequireReview);
 * `demoApprovalMarker` y `citedOriginApproval` NO están en esa lista y por
 * construcción no producen NUNCA una incidencia en esta pantalla mientras
 * `aprobada_por` tenga contenido (ambos flags exigen texto no vacío para
 * activarse, y con texto no vacío `missingApproval` ya es `false`). Por eso
 * el test anterior pasaba con o sin cualquiera de los tres guards de
 * MOI-137: no había ningún literal que pudiera dejar de aparecer.
 *
 * Corregido con la opción (b) del revisor, con dos niveles distintos porque
 * DashboardTab realmente consume estas señales de dos formas distintas:
 *
 *  1. El gate de tenant D-20 SÍ tiene efecto real en el DOM de esta pantalla:
 *     una plantilla sin aprobación (`aprobada_por`/`fecha_aprobacion` vacíos)
 *     de un tenant distinto de ARGA, con un tipo que el informe del Comité
 *     Legal aprobaría sin condiciones (CERTIFICACION), depende del gate de
 *     tenant para que `missingApproval` sea `true` y aparezca la incidencia
 *     «Aprobación formal pendiente» — se comprueba en el DOM real
 *     (`incident.title`, banner de salud).
 *  2. `demoApprovalMarker` y `citedOriginApproval` no llegan a ningún nodo
 *     del DOM hoy en esta pantalla (ver arriba). Se comprueba entonces lo
 *     que la página SÍ consume para construir ese DOM: se invoca
 *     `buildLegalTemplateReviewRows` — la misma función, SIN mockear, que
 *     `DashboardTab` llama internamente sobre las mismas filas que se le
 *     pasan al componente — y se asierta sobre su resultado. No es una
 *     repetición de `legal-template-review.test.ts` (que no monta la
 *     página): aquí se alimenta con el MISMO array de filas que ve el
 *     componente renderizado en este test, así que si algún día
 *     DashboardTab empezara a leer `flags.demoApprovalMarker` o
 *     `flags.citedOriginApproval` para pintar algo, seguiría cayendo. La
 *     cobertura DOM completa de los tres guards vive en
 *     Plantillas-aprobacion-demo-arista.test.tsx, donde el KPI "Revisión
 *     legal pendiente" sí reacciona a los tres.
 *
 * Verificado por mutación real: retirar cualquiera de los tres guards de
 * `legal-template-review.ts` / `legal-template-approval-plan.ts` pone en
 * rojo este fichero (ver commit de este cambio).
 */
import { afterAll as __afterAllRestore, mock as __bunMockRestore } from "bun:test";
import * as __realModule0 from "@tanstack/react-query";
import * as __realModule1 from "react-router-dom";
import * as __realModule2 from "@/context/TenantContext";
import * as __realModule3 from "@/hooks/usePlantillasProtegidas";
import * as __realModule4 from "@/hooks/secretaria/usePlantillaChangelog";
import * as __realModule5 from "../tab-guards";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { PlantillaProtegidaRow } from "@/hooks/usePlantillasProtegidas";
import { buildLegalTemplateReviewRows } from "@/lib/secretaria/legal-template-review";
import { DashboardTab } from "../DashboardTab";

if (typeof vi.hoisted !== "function") {
  (vi as { hoisted?: <T>(factory: () => T) => T }).hoisted = <T,>(factory: () => T) => factory();
}

const mockState = vi.hoisted(() => ({
  rows: [] as PlantillaProtegidaRow[],
}));

const __realModulesForRestore: Array<[string, Record<string, unknown>]> = [
  ["@tanstack/react-query", { ...__realModule0 }],
  ["react-router-dom", { ...__realModule1 }],
  ["@/context/TenantContext", { ...__realModule2 }],
  ["@/hooks/usePlantillasProtegidas", { ...__realModule3 }],
  ["@/hooks/secretaria/usePlantillaChangelog", { ...__realModule4 }],
  ["../tab-guards", { ...__realModule5 }],
];

__afterAllRestore(() => {
  for (const [__specifier, __exports] of __realModulesForRestore) {
    __bunMockRestore.module(__specifier, () => __exports);
  }
});

vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: string[] }) => ({
    data: queryKey[1] === "coverage" ? { covered: 14, gaps: [] } : 0,
    isError: false,
    isLoading: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));

vi.mock("@/context/TenantContext", () => ({
  useTenantContext: () => ({
    tenantId: "tenant-1",
    entityId: null,
    personId: null,
    roleCode: "ADMIN_TENANT",
    isLoading: false,
  }),
}));

vi.mock("@/hooks/usePlantillasProtegidas", () => ({
  usePlantillasProtegidas: () => ({
    data: mockState.rows,
    isError: false,
    isLoading: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/hooks/secretaria/usePlantillaChangelog", () => ({
  usePlantillaChangelog: () => ({
    data: [],
    isError: false,
    isLoading: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("../tab-guards", () => ({
  useTabAccess: () => ({
    canAccess: () => true,
    visibleTabs: [],
    isLoading: false,
  }),
}));

const ARGA_TENANT_ID = "00000000-0000-0000-0000-000000000001";
const GRUPO_NUEVO_TENANT_ID = "00000000-0000-0000-0000-000000000003";

function baseCertificacion(overrides: Partial<PlantillaProtegidaRow>): PlantillaProtegidaRow {
  return {
    id: "tpl-base",
    tenant_id: ARGA_TENANT_ID,
    tipo: "CERTIFICACION",
    materia: null,
    jurisdiccion: "ES",
    version: "1.2.0",
    estado: "ACTIVA",
    aprobada_por: null,
    fecha_aprobacion: "2026-07-01",
    contenido_template: null,
    capa1_inmutable: "Texto jurídico vigente".padEnd(120, "."),
    capa2_variables: [],
    capa3_editables: [],
    referencia_legal: "Art. 253 LSC",
    notas_legal: null,
    variables: [],
    protecciones: {},
    snapshot_rule_pack_required: false,
    adoption_mode: null,
    organo_tipo: "CONSEJO_ADMIN",
    tipo_social: null,
    contrato_variables_version: null,
    created_at: "2026-07-01T00:00:00Z",
    materia_acuerdo: null,
    approval_checklist: null,
    version_history: null,
    ...overrides,
  } as PlantillaProtegidaRow;
}

// Nivel 1 (DOM real): aísla el gate de tenant D-20. Tenant distinto de ARGA,
// SIN aprobación (aprobada_por/fecha_aprobacion vacíos) y con un tipo
// (CERTIFICACION) que el informe del Comité Legal aprobaría sin condiciones
// para CUALQUIER tenant si no fuera por el gate. Con el gate: `missingApproval`
// es `true` (el informe no acredita nada fuera de ARGA) y aparece la
// incidencia «Aprobación formal pendiente». Sin el gate: `committeeApproved`
// sería `true` para este tenant también y la incidencia desaparecería.
const tenantGateTemplate = baseCertificacion({
  id: "tpl-tenant-gate",
  tenant_id: GRUPO_NUEVO_TENANT_ID,
  materia_acuerdo: "CERT_TENANT_GATE_DASHBOARD_TEST",
  aprobada_por: null,
  fecha_aprobacion: null,
});

// Nivel 2 (misma función real que usa la página, sin DOM porque la página no
// pinta esto hoy): marcador de demostración y cita de origen, aislados cada
// uno en su propia fila con el mismo tipo aprobado sin condiciones.
const demoMarkerTemplate = baseCertificacion({
  id: "tpl-demo-marker",
  materia_acuerdo: "CERT_DEMO_MARKER_DASHBOARD_TEST",
  aprobada_por: "Aprobado en sesión demo del Comité Legal",
});

const citedOriginTemplate = baseCertificacion({
  id: "tpl-cited-origin",
  materia_acuerdo: "CERT_CITED_ORIGIN_DASHBOARD_TEST",
  aprobada_por: "Pack base — clon de la plantilla de origen, aprobada en origen por «Comité Legal ARGA»",
});

describe("DashboardTab — MOI-137 arista pantalla→librería", () => {
  it("D-20: sin aprobación fuera de ARGA aparece «Aprobación formal pendiente» en la cola de incidencias", () => {
    mockState.rows = [tenantGateTemplate];

    render(<DashboardTab />);

    expect(screen.queryByText("Aprobada legalmente")).toBeNull();
    // Nota: con una sola plantilla en el fixture, `buildLegalTemplateCoverage`
    // añade además una incidencia ERROR de cobertura core (confound esperado
    // e inevitable con datos mínimos, no relacionado con MOI-137) — por eso
    // no se comprueba la etiqueta agregada de salud ("Con incidencias" vs
    // "Con advertencias"), solo la presencia del título concreto.
    expect(screen.getByText("Aprobación formal pendiente")).toBeInTheDocument();
  });

  it("marcador de demostración y cita de origen: la misma función real que usa la página sigue vetando la aprobación aunque hoy no se pinte en este tab", () => {
    mockState.rows = [demoMarkerTemplate, citedOriginTemplate];

    render(<DashboardTab />);

    // DashboardTab hoy no pinta ningún rótulo de aprobación (confirmado:
    // ni «Aprobada legalmente» ni un texto equivalente existe en su JSX),
    // así que esta aserción de DOM es una salvaguarda débil.
    expect(screen.queryByText("Aprobada legalmente")).toBeNull();

    // Aserción real: se llama a la MISMA función, sin mockear, con las
    // MISMAS filas que se le acaban de pasar al componente renderizado
    // arriba — si se retira el veto de `hasDemoMarker` o `hasCitedOrigin`
    // en legal-template-review.ts, esto cae.
    const rows = buildLegalTemplateReviewRows(mockState.rows);
    const demoRow = rows.find((row) => row.templateId === "tpl-demo-marker");
    const citedRow = rows.find((row) => row.templateId === "tpl-cited-origin");
    expect(demoRow?.canClaimLegalApproval).toBe(false);
    expect(demoRow?.label).not.toBe("Aprobada legalmente");
    expect(citedRow?.canClaimLegalApproval).toBe(false);
    expect(citedRow?.label).not.toBe("Aprobada legalmente");
  });
});
