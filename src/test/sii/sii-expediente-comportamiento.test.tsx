// src/test/sii/sii-expediente-comportamiento.test.tsx
//
// Lo que el expediente HACE, ejecutado. No lo que su fuente dice.
//
// Tres correcciones del canal quedaron aplicadas sin nada que las sujetara, y
// las tres viven dentro de mutaciones de TanStack Query — o sea, en código que
// un guard de texto no puede juzgar:
//
//   1. El acuse ramifica según el plazo REAL del art. 9.2.c. Antes anunciaba
//      «emitido en plazo legal» sin comparar con nada, y un acuse tardío se
//      celebraba igual que uno puntual.
//   2. La marca `firmeza` se reaplica desde el catálogo al leer localStorage.
//      Un navegador con la clave ya creada devolvía el JSON viejo SIN la marca
//      y el badge «Simulado» desaparecía de la lista y de la ficha: la arista se
//      rompía por CACHÉ, con el rótulo bien puesto.
//   3. El asiento del Libro-registro se asigna en el ALTA (PI-31, Anexo §4: el
//      Instructor le da número de entrada y fecha de recepción dentro de los
//      siete días) y el cierre solo lo COMPLETA. Antes solo existía al cerrar,
//      y hasta entonces la tabla lo recalculaba en cada render.
//
// El canal es DEMO LOCAL por decisión de producto: aquí no se escribe en
// Supabase, se ejercita el almacén de este navegador. Que es exactamente lo que
// el producto hace.
import { afterAll, afterEach, beforeEach, describe, expect, it } from "bun:test";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { mockearModulos } from "../garrigues/_mock-restaurable";

const ARGA = "00000000-0000-0000-0000-000000000001";

const tenantActual: string | null = ARGA;
const restaurarMocks = await mockearModulos([
  ["@/context/TenantContext", () => ({ useTenantContext: () => ({ tenantId: tenantActual }) })],
]);
afterAll(restaurarMocks);

const {
  getStoredReports,
  initialReportsFor,
  useCreateWhistleblowingReport,
  useEmitAcknowledgment,
  useCloseRootCase,
} = await import("@/hooks/useWhistleblowing");
const { siiStorageKey } = await import("@/lib/sii/tenant-scope");
type Expediente = ReturnType<typeof initialReportsFor>[number];

/** Escribe el bucket de este tenant. `saveStoredReports` no se exporta, y no se
 *  exporta a propósito: el almacén se escribe desde las mutaciones. Aquí se
 *  monta el ESTADO DE PARTIDA, que es lo que un navegador ya tendría. */
const sembrar = (reports: Expediente[]) =>
  localStorage.setItem(siiStorageKey(ARGA), JSON.stringify(reports));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

/** Alta mínima válida. El perímetro SÍ abre un subexpediente de cumplimiento
 *  general con estos datos —se comprobó—, así que el caso de cierre tiene que
 *  cerrarlo antes. */
const ALTA = {
  channel: "WEB_ANONIMO" as const,
  anonymityMode: "ANONIMO_ESTRICTO" as const,
  entityId: "ent-1",
  entityName: "ARGA Seguros S.A.",
  jurisdiction: "ES",
  category: "Otros",
  severity: "LEVE" as const,
  summary: "Incidencia menor de procedimiento",
  detailedDescription: "Se describe una incidencia de procedimiento sin indicios penales.",
};

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe("SII — el acuse distingue en plazo, fuera de plazo y exceptuado", () => {
  it("dentro de los 7 días naturales: enPlazo = true y el mensaje lo dice", async () => {
    const { result } = renderHook(() => useEmitAcknowledgment(), { wrapper });
    const [rep] = initialReportsFor(ARGA);
    // Recepción de hoy: el límite del art. 9.2.c cae dentro de siete días.
    sembrar([{ ...rep, intakeDate: new Date().toISOString(), acknowledgmentSentDate: null }]);

    const res = await result.current.mutateAsync({ reportId: rep.id });
    expect(res.enPlazo).toBe(true);
    expect(res.limiteAcuse).toBeInstanceOf(Date);
    const ultimo = res.report.messages[res.report.messages.length - 1];
    expect(ultimo.content).toContain("dentro de los siete días naturales");
    expect(ultimo.content).not.toContain("FUERA");
  });

  it("pasados los 7 días: enPlazo = false y el mensaje NO celebra el cumplimiento", async () => {
    // ESTE es el caso que el producto anunciaba como cumplido. El toast decía
    // «emitido en plazo legal» sin mirar la fecha de recepción.
    const { result } = renderHook(() => useEmitAcknowledgment(), { wrapper });
    const [rep] = initialReportsFor(ARGA);
    const hace30dias = new Date(Date.now() - 30 * 86_400_000).toISOString();
    sembrar([{ ...rep, intakeDate: hace30dias, acknowledgmentSentDate: null }]);

    const res = await result.current.mutateAsync({ reportId: rep.id });
    expect(res.enPlazo).toBe(false);
    const ultimo = res.report.messages[res.report.messages.length - 1];
    expect(ultimo.content).toContain("FUERA del plazo");
  });

  it("exceptuado: enPlazo = null — no hay plazo que juzgar, y no se finge que sí", async () => {
    // `null` y no `false`: el art. 9.2.c admite excepción, y llamarla
    // incumplimiento sería tan falso como llamarla cumplimiento.
    const { result } = renderHook(() => useEmitAcknowledgment(), { wrapper });
    const [rep] = initialReportsFor(ARGA);
    sembrar([{ ...rep, intakeDate: new Date().toISOString(), acknowledgmentSentDate: null }]);

    const res = await result.current.mutateAsync({ reportId: rep.id, isExempt: true });
    expect(res.enPlazo).toBeNull();
    expect(res.limiteAcuse).toBeNull();
    expect(res.report.acknowledgmentExemptReason).toBeTruthy();
    // Y no se marca como emitido: no se emitió.
    expect(res.report.acknowledgmentSentDate).toBeFalsy();
  });
});

describe("SII — la marca `firmeza` la fija el catálogo, no el almacén", () => {
  it("un bucket viejo SIN la marca la recupera al leerlo", async () => {
    const catalogo = initialReportsFor(ARGA);
    // Control positivo: el catálogo SÍ marca estos expedientes. Sin esto,
    // «la marca vuelve» sería indistinguible de «no hay marca en ningún sitio».
    expect(catalogo.length).toBeGreaterThan(0);
    expect(catalogo.every((r) => !!r.firmeza)).toBe(true);

    // El bucket que dejó la versión anterior: mismos expedientes, sin `firmeza`.
    const viejos = catalogo.map(({ firmeza: _f, ...resto }) => resto);
    localStorage.setItem(siiStorageKey(ARGA), JSON.stringify(viejos));
    expect(JSON.parse(localStorage.getItem(siiStorageKey(ARGA))!)[0].firmeza).toBeUndefined();

    const leidos = getStoredReports(ARGA);
    for (const r of leidos) {
      expect(r.firmeza, `${r.code} vuelve a leerse sin marca de simulado`).toBe(
        catalogo.find((c) => c.code === r.code)!.firmeza,
      );
    }
  });

  it("un expediente dado de alta NO recibe marca: no es simulado", async () => {
    // La otra mitad, y la que impide «marcarlo todo» como atajo. Un expediente
    // que el usuario crea no está en el catálogo y no debe salir como simulado.
    const { result } = renderHook(() => useCreateWhistleblowingReport(), { wrapper });
    const { report } = await result.current.mutateAsync(ALTA);

    const releido = getStoredReports(ARGA).find((r) => r.id === report.id);
    expect(releido).toBeTruthy();
    expect(releido!.firmeza).toBeUndefined();
    // Y los del catálogo, en el mismo bucket, siguen marcados.
    expect(getStoredReports(ARGA).filter((r) => !!r.firmeza).length).toBeGreaterThan(0);
  });
});

describe("SII — el asiento del Libro-registro se asigna al dar de alta", () => {
  it("el alta deja número de entrada, fecha y momento de asignación", async () => {
    const { result } = renderHook(() => useCreateWhistleblowingReport(), { wrapper });
    const { report } = await result.current.mutateAsync(ALTA);

    const asiento = report.libroRegistroEntry;
    expect(asiento, "el alta no conserva asiento: la tabla lo recalcularía en cada render").toBeTruthy();
    expect(asiento!.recordNumber).toContain(report.code);
    expect(asiento!.numeroEntradaAsignadoAt, "número de entrada sin momento de asignación").toBeTruthy();
    // Todavía no está incorporado: eso solo ocurre al cerrar.
    expect(asiento!.incorporadoAlCierre).toBe(false);
  });

  it("el cierre COMPLETA el asiento sin cambiar su identidad", async () => {
    // Regenerarlo entero daba un asiento distinto del que se registró: otro
    // número de entrada y otra fecha para la misma comunicación. El art. 26
    // pide un registro, no una foto nueva en cada estado.
    const crear = renderHook(() => useCreateWhistleblowingReport(), { wrapper });
    const { report } = await crear.result.current.mutateAsync(ALTA);
    const alta = report.libroRegistroEntry!;

    // El guard de cierre exige acuse previo (o excepción motivada).
    const ack = renderHook(() => useEmitAcknowledgment(), { wrapper });
    await ack.result.current.mutateAsync({ reportId: report.id });

    // El perímetro abre un subexpediente de cumplimiento general, y el guard
    // anti-cierre-cruzado no deja cerrar la raíz con subexpedientes vivos. Se
    // cierran en el almacén: lo que se prueba aquí es la identidad del asiento,
    // no el circuito de subexpedientes, que tiene sus propios tests.
    sembrar(
      getStoredReports(ARGA).map((r) =>
        r.id === report.id
          ? { ...r, subcases: r.subcases.map((sub) => ({ ...sub, status: "CERRADO" as const })) }
          : r,
      ),
    );

    const cerrar = renderHook(() => useCloseRootCase(), { wrapper });
    const cerrado = await cerrar.result.current.mutateAsync({
      reportId: report.id,
      status: "ARCHIVADO_MOTIVADO",
      closingReason: "Sin indicios tras el análisis preliminar",
      actionsTaken: ["Revisión documental"],
    });

    const cierre = cerrado.libroRegistroEntry!;
    expect(cierre.recordNumber).toBe(alta.recordNumber);
    expect(cierre.entryDate).toBe(alta.entryDate);
    expect(cierre.referenciaAsiento).toBe(alta.referenciaAsiento);
    expect(cierre.numeroEntradaAsignadoAt).toBe(alta.numeroEntradaAsignadoAt);
    // Y lo que sí cambia: ahora está incorporado y lleva resultado.
    expect(cierre.incorporadoAlCierre).toBe(true);
    expect(cierre.resultOutcome).toContain("Sin indicios");

    await waitFor(() => {
      expect(getStoredReports(ARGA).find((r) => r.id === report.id)?.closedAt).toBeTruthy();
    });
  });
});
