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
//   2. La marca `firmeza` se reaplica desde el catálogo al leer el almacén.
//      Una fila ya escrita SIN la marca hacía desaparecer el badge «Simulado»
//      de la lista y de la ficha: la arista se rompía por el dato guardado, con
//      el rótulo bien puesto.
//   3. El asiento del Libro-registro se asigna en el ALTA (PI-31, Anexo §4: el
//      Instructor le da número de entrada y fecha de recepción dentro de los
//      siete días) y el cierre solo lo COMPLETA. Antes solo existía al cerrar,
//      y hasta entonces la tabla lo recalculaba en cada render.
//
// Desde 2026-09-07 el canal PERSISTE en Cloud (`sii.reports`). Aquí se
// ejercita contra el doble en memoria de esa tabla —los tests no salen a la
// red—, que es el mismo camino de código que en producción: no hay respaldo a
// `localStorage` ni rama por tenant.
import { afterAll, afterEach, beforeEach, describe, expect, it } from "bun:test";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { mockearModulos } from "../garrigues/_mock-restaurable";
import { mockearAlmacenSii, reiniciarAlmacen, sembrarFilas, filasDe } from "./_almacen-memoria";

const ARGA = "00000000-0000-0000-0000-000000000001";

const tenantActual: string | null = ARGA;
const restaurarAlmacen = await mockearAlmacenSii();
const restaurarMocks = await mockearModulos([
  ["@/context/TenantContext", () => ({ useTenantContext: () => ({ tenantId: tenantActual }) })],
]);
afterAll(() => {
  restaurarMocks();
  restaurarAlmacen();
});

const {
  getStoredReports,
  initialReportsFor,
  useCreateWhistleblowingReport,
  useEmitAcknowledgment,
  useCloseRootCase,
} = await import("@/hooks/useWhistleblowing");
type Expediente = ReturnType<typeof initialReportsFor>[number];

/** Monta el ESTADO DE PARTIDA de la tabla. El almacén solo se escribe desde las
 *  mutaciones, así que aquí se inserta directo. El `origen` se deduce igual que
 *  en producción: del catálogo lo que el catálogo declara, y ALTA el resto. */
const sembrar = (reports: Expediente[]) => {
  const delCatalogo = new Set(initialReportsFor(ARGA).map((r) => r.code));
  reiniciarAlmacen();
  sembrarFilas(
    reports.map((report, i) => ({
      tenant_id: ARGA,
      code: report.code,
      origen: delCatalogo.has(report.code) ? "CATALOGO" : "ALTA",
      orden: i,
      report,
    })),
  );
};

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

beforeEach(() => reiniciarAlmacen());
afterEach(() => reiniciarAlmacen());

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
    sembrar(viejos as typeof catalogo);
    expect(filasDe(ARGA)[0].report).not.toHaveProperty("firmeza");

    const leidos = await getStoredReports(ARGA);
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

    const releido = (await getStoredReports(ARGA)).find((r) => r.id === report.id);
    expect(releido).toBeTruthy();
    expect(releido!.firmeza).toBeUndefined();
    // Y los del catálogo, en el mismo bucket, siguen marcados.
    expect((await getStoredReports(ARGA)).filter((r) => !!r.firmeza).length).toBeGreaterThan(0);
  });
});

describe("SII — el alta persiste: correlativo, orden y aislamiento", () => {
  it("el correlativo sale del MÁXIMO usado, no de contar filas", async () => {
    // Contar filas repetía código en cuanto una serie tenía huecos —y con el
    // almacén compartido entre equipos los tiene—. El índice único
    // (tenant_id, code) convertiría la colisión en un error; el objetivo es no
    // provocarla.
    sembrar([
      { ...initialReportsFor(ARGA)[0], code: "SII-2026-08-007", id: "rep-previo" } as Expediente,
    ]);
    const { result } = renderHook(() => useCreateWhistleblowingReport(), { wrapper });
    const { code } = await result.current.mutateAsync(ALTA);
    expect(code, "el correlativo ha reutilizado un número ya usado").toBe("SII-2026-08-008");
  });

  it("el alta se coloca DELANTE y ahí sigue al releer", async () => {
    // El almacén anterior anteponía al array y el orden se perdía al recargar.
    // `orden` es lo que lo conserva entre sesiones.
    sembrar(initialReportsFor(ARGA));
    const { result } = renderHook(() => useCreateWhistleblowingReport(), { wrapper });
    const { code } = await result.current.mutateAsync(ALTA);

    const enPantalla = (await getStoredReports(ARGA)).map((r) => r.code);
    expect(enPantalla[0], "el expediente recién dado de alta no aparece el primero").toBe(code);
    // Y los del catálogo conservan su orden relativo detrás.
    expect(enPantalla.slice(1)).toEqual(initialReportsFor(ARGA).map((r) => r.code));
  });

  it("el alta queda ESCRITA en el almacén, no solo devuelta por la mutación", async () => {
    // Es la diferencia entre persistir y no persistir, y la que un test que
    // solo mire el valor de retorno no ve.
    const { result } = renderHook(() => useCreateWhistleblowingReport(), { wrapper });
    const { code } = await result.current.mutateAsync(ALTA);

    const fila = filasDe(ARGA).find((f) => f.code === code);
    expect(fila, "la mutación devolvió un expediente que no escribió").toBeDefined();
    expect(fila!.tenant_id, "el expediente se ha escrito sin tenant o con otro").toBe(ARGA);
    expect(fila!.origen, "un alta del usuario no es del catálogo").toBe("ALTA");
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
      (await getStoredReports(ARGA)).map((r) =>
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

    await waitFor(async () => {
      const releido = (await getStoredReports(ARGA)).find((r) => r.id === report.id);
      expect(releido?.closedAt).toBeTruthy();
    });
  });
});
