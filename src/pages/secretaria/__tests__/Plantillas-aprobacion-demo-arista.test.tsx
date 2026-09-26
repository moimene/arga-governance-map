/**
 * MOI-137 — Prueba de arista (pantalla → librería), página Plantillas.
 *
 * Revisión adversarial (rev.findings[0], severidad P1): la versión anterior
 * de este test buscaba el texto «Aprobada legalmente» en el DOM, pero
 * Plantillas.tsx JAMÁS pinta ese literal (solo lee
 * `reviewByTemplateId.get(id)?.flags.draftVersion` para un aviso puntual) —
 * el test pasaba con o sin cualquiera de los tres guards de MOI-137 y por
 * tanto no podía ponerse en rojo nunca. Corregido con la opción (b): se
 * asierta sobre lo que la página SÍ consume y muestra de verdad — el KPI
 * «Revisión legal pendiente» del encabezado, que agrega
 * `reviewSummary.needsReview` (== filas con `requiresLegalReview`, es decir
 * `!canClaimLegalApproval`) sobre las plantillas vigentes reales
 * (`buildLegalTemplateReviewRows` SIN mockear).
 *
 * Se montan 4 plantillas ACTIVA, cada una diseñada para aislar UN guard:
 *  - A: marcador de demostración, con un tipo (CERTIFICACION) que el informe
 *    del Comité Legal aprueba sin condiciones adicionales — si se retira el
 *    veto `!hasDemoMarker` de `canClaimLegalApproval`, esta fila pasaría a
 *    "Aprobada legalmente" vía `committeeApproved`.
 *  - B: cita "aprobada en origen por" (D-20, clon), mismo tipo, mismo efecto
 *    si se retira `!hasCitedOrigin`.
 *  - C: tenant Grupo Nuevo (…0003), SIN marcador de demo ni cita de origen,
 *    pero con `referencia_legal` vacía (un motivo real de revisión) — si se
 *    retira el gate de tenant D-20 en `resolveLegalTemplateApprovalPlan`, el
 *    informe de ARGA "aprobaría" esta plantilla de otro tenant y su único
 *    motivo (falta de referencia) quedaría bypaseado por `committeeApproved`.
 *  - CTRL: aprobación nominativa real, sin ningún marcador — control
 *    positivo: si el test escondiera todo indiscriminadamente (p.ej. un KPI
 *    roto que siempre da 0), esta fila lo destaparía porque SÍ debe contar
 *    como aprobada y NO debe sumar al contador de revisión pendiente.
 *
 * Con los tres guards intactos, el recuento esperado de "revisión legal
 * pendiente" es exactamente 3 (A + B + C; CTRL no cuenta). Retirar
 * cualquiera de los tres guards baja ese número a 2 — la aserción por valor
 * exacto (no solo ">0") es lo que pone el test en rojo. Verificado por
 * mutación real: ver commit de este cambio.
 */
import { afterAll as __afterAllRestore, mock as __bunMockRestore } from "bun:test";
import * as __realModule0 from "react-router-dom";
import * as __realModule1 from "@/hooks/useNormativeGovernance";
import * as __realModule2 from "@/hooks/useMesaControlSocietaria";
import * as __realModule3 from "@/hooks/usePlantillasProtegidas";
import * as __realModule4 from "@/hooks/useCurrentUser";
import * as __realModule5 from "@/components/secretaria/shell";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PlantillaProtegidaRow } from "@/hooks/usePlantillasProtegidas";
import Plantillas from "../Plantillas";

if (typeof vi.hoisted !== "function") {
  (vi as { hoisted?: <T>(factory: () => T) => T }).hoisted = <T,>(factory: () => T) => factory();
}

const mockState = vi.hoisted(() => ({
  rows: [] as PlantillaProtegidaRow[],
}));

const __realModulesForRestore: Array<[string, Record<string, unknown>]> = [
  ["react-router-dom", { ...__realModule0 }],
  ["@/hooks/useNormativeGovernance", { ...__realModule1 }],
  ["@/hooks/useMesaControlSocietaria", { ...__realModule2 }],
  ["@/hooks/usePlantillasProtegidas", { ...__realModule3 }],
  ["@/hooks/useCurrentUser", { ...__realModule4 }],
  ["@/components/secretaria/shell", { ...__realModule5 }],
];

__afterAllRestore(() => {
  for (const [__specifier, __exports] of __realModulesForRestore) {
    __bunMockRestore.module(__specifier, () => __exports);
  }
});

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));

vi.mock("@/hooks/useNormativeGovernance", () => ({
  useTemplateBindings: () => ({ data: [] }),
  useAssignTemplateBinding: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/hooks/useMesaControlSocietaria", () => ({
  useMateriaCatalogoSocietario: () => ({ data: [] }),
}));

vi.mock("@/hooks/usePlantillasProtegidas", () => ({
  usePlantillasProtegidas: () => ({
    data: mockState.rows,
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
  useUpdateEstadoPlantilla: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  extractTransitionResult: () => null,
}));

vi.mock("@/hooks/useCurrentUser", () => ({
  useCurrentUserRole: () => ({
    primaryRole: "ADMIN_TENANT",
    user: { id: "u1", email: "demo@arga-seguros.com" },
    displayName: "Demo",
  }),
}));

vi.mock("@/components/secretaria/shell", () => ({
  // El KPI "Revisión legal pendiente" solo se pinta en modo sociedad con una
  // entidad seleccionada (Plantillas.tsx:1241) — sin esto, la sección entera
  // no se monta y no hay nada verificable en el DOM.
  useSecretariaScope: () => ({
    mode: "sociedad",
    selectedEntity: {
      id: "entidad-test",
      name: "Entidad Test",
      legalName: "Entidad Test S.A.",
      legalForm: "SA",
      jurisdiction: "ES",
      tipoSocial: null,
      status: "ACTIVA",
    },
    isLoadingEntities: false,
  }),
}));

// jsdom (vía JSDOM directo en src/test/setup.ts) no implementa rAF en `window`
// (solo se polyfilla en `globalThis`, que aquí es un objeto distinto).
if (typeof window !== "undefined" && typeof window.requestAnimationFrame !== "function") {
  window.requestAnimationFrame = ((cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0)) as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = ((id: number) => clearTimeout(id)) as typeof window.cancelAnimationFrame;
}

function renderPlantillas() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Plantillas />
    </QueryClientProvider>,
  );
}

const ARGA_TENANT_ID = "00000000-0000-0000-0000-000000000001";
const GARRIGUES_TENANT_ID = "00000000-0000-0000-0000-000000000002";
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

// A — aísla el veto del marcador de demostración: el informe del Comité
// Legal aprueba cualquier CERTIFICACION sin condiciones (matcher `{ tipo:
// "CERTIFICACION" }`), así que sin el guard `!hasDemoMarker` esta fila
// pasaría a "Aprobada legalmente" por `committeeApproved`.
const demoMarkerTemplate = baseCertificacion({
  id: "tpl-demo-marker",
  materia_acuerdo: "CERT_DEMO_MARKER_TEST",
  aprobada_por: "Aprobado en sesión demo del Comité Legal",
});

// B — aísla el veto de citedOriginApproval (D-20): mismo tipo aprobado sin
// condiciones, pero el texto cita la aprobación de OTRA plantilla ("origen"
// del clon), nunca de esta copia.
const citedOriginTemplate = baseCertificacion({
  id: "tpl-cited-origin",
  materia_acuerdo: "CERT_CITED_ORIGIN_TEST",
  aprobada_por: "Pack base — clon de la plantilla de origen, aprobada en origen por «Comité Legal ARGA»",
});

// C — aísla el gate de tenant D-20: tenant distinto de ARGA, sin marcador de
// demo ni cita de origen, pero con un motivo real de revisión (falta de
// referencia legal). Si el informe de ARGA "aprobase" cualquier
// CERTIFICACION también fuera de ARGA, `committeeApproved` bypasearía ese
// motivo y la fila pasaría a "Aprobada legalmente".
const tenantGateTemplate = baseCertificacion({
  id: "tpl-tenant-gate",
  tenant_id: GRUPO_NUEVO_TENANT_ID,
  materia_acuerdo: "CERT_TENANT_GATE_TEST",
  referencia_legal: null,
  aprobada_por: "Ratificado por el consejo interno del Grupo Nuevo",
});

// CTRL — control positivo: aprobación nominativa real, sin ningún marcador.
// Debe seguir contando como aprobada y NO sumar al contador de revisión
// pendiente; sin este control, un KPI roto que siempre marcase "0" pasaría
// el test igualmente.
const nominativeApprovalTemplate = baseCertificacion({
  id: "tpl-control-positivo",
  tenant_id: GARRIGUES_TENANT_ID,
  materia_acuerdo: "CERT_CONTROL_POSITIVO",
  aprobada_por: "Alejandro Padín Vidal, Secretario del Consejo de Administración",
});

describe("Plantillas (página) — MOI-137 arista pantalla→librería", () => {
  it("cuenta exactamente 3 plantillas con revisión legal pendiente (una por guard) y ninguna aprobación real se pierde", () => {
    mockState.rows = [
      demoMarkerTemplate,
      citedOriginTemplate,
      tenantGateTemplate,
      nominativeApprovalTemplate,
    ];

    renderPlantillas();

    // Salvaguarda débil (el rótulo calculado no se pinta hoy en esta
    // página): se conserva para que, si algún día empieza a pintarse sin
    // pasar por el veto, este test también lo detecte.
    expect(screen.queryAllByText("Aprobada legalmente")).toHaveLength(0);

    // Aserción real: el KPI "Revisión legal pendiente" del encabezado agrega
    // `requiresLegalReview` sobre las 4 filas vigentes. El valor exacto (3,
    // no ">0") es lo que cae si se retira cualquiera de los tres guards,
    // porque cada uno gobierna a UNA sola de las 4 filas.
    expect(
      screen.getByText(
        "Biblioteca operativa con advertencias: 4 plantillas vigentes, 0 archivadas y 3 con revisión legal pendiente.",
      ),
    ).toBeInTheDocument();
  });
});
