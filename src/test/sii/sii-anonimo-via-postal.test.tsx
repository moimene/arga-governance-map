// src/test/sii/sii-anonimo-via-postal.test.tsx
//
// La comunicación ANÓNIMA del Canal Interno de Garrigues se presenta por
// correo postal. No es una preferencia de diseño: PI-31, Anexo §3.c lo dice
// con todas las letras —«Las comunicaciones podrán realizarse de forma anónima
// mediante el envío de una comunicación postal conforme a lo indicado en el
// apartado a) (ii) anterior, sin identificación del remitente»— y el apartado
// a) reserva el formulario web a la otra vía.
//
// El portal ofrecía el formulario web para el anónimo estricto y los tres
// casos demo se sembraban así, con lo que el Libro-registro y la columna
// «Canal / Modalidad» del listado enseñaban una vía que la política del
// despacho no da para esa modalidad.
//
// SE JUZGA EL DATO ESCRITO, no el rótulo: el caso decisivo captura lo que la
// pantalla ENVÍA a la mutación. Leer «Correo Postal» resaltado no probaría que
// el expediente se registre con ese canal.
import { afterAll, afterEach, describe, expect, it } from "bun:test";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockearModulos } from "../garrigues/_mock-restaurable";
import { mockearAlmacenSii, reiniciarAlmacen, sembrarFilas } from "./_almacen-memoria";
import { SII_TENANT } from "../../../scripts/garrigues/sii/canal-interno";
import { CASOS_DEMO_GARRIGUES } from "../../../scripts/garrigues/sii/casos-demo";

const ARGA = "00000000-0000-0000-0000-000000000001";

if (typeof globalThis.getComputedStyle === "undefined" && typeof window !== "undefined") {
  globalThis.getComputedStyle = window.getComputedStyle.bind(window);
}
// La mutación resuelve DESPUÉS del clic y su `setStep(4)` cae fuera de act():
// sin declararlo, la salida se llena de avisos que taparían un fallo real.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let tenantActual: string | null = SII_TENANT;
let altaRecibida: Record<string, unknown> | null = null;

const restaurarAlmacen = await mockearAlmacenSii();
const restaurarMocks = await mockearModulos([
  ["@/context/TenantContext", () => ({ useTenantContext: () => ({ tenantId: tenantActual }) })],
  [
    "@/hooks/useEntities",
    () => ({
      useEntitiesList: () => ({
        data: [{ id: "ent-1", common_name: "J&A Garrigues", legal_name: "J&A Garrigues, S.L.P.", jurisdiction: "ES" }],
        isLoading: false,
      }),
    }),
  ],
  [
    "@/hooks/useWhistleblowing",
    () => ({
      useCreateWhistleblowingReport: () => ({
        mutateAsync: async (args: Record<string, unknown>) => {
          altaRecibida = args;
          return { code: "SII-TEST-001", trackingToken: "SEC-TEST-0001" };
        },
        isPending: false,
      }),
    }),
  ],
]);
afterAll(() => {
  restaurarMocks();
  restaurarAlmacen();
});

/** Estado de partida de `sii.reports` para el tenant del despacho. `origen`
 *  distingue lo que el catálogo posee de lo que dio de alta el usuario: es lo
 *  único que autoriza a `reaplicarCamposDelCatalogo` a reescribir una fila. */
const sembrarFilasGarrigues = (
  reports: Array<Record<string, unknown> & { code: string }>,
  origen: "CATALOGO" | "ALTA" = "CATALOGO",
) => {
  sembrarFilas(
    reports.map((report, i) => ({
      tenant_id: SII_TENANT,
      code: report.code,
      origen,
      orden: i,
      report,
    })),
  );
};
afterEach(() => {
  cleanup();
  altaRecibida = null;
});

async function montar(tenant: string | null) {
  tenantActual = tenant;
  const { default: SiiPortalIntake } = await import("@/pages/sii/SiiPortalIntake");
  render(
    <MemoryRouter>
      <SiiPortalIntake />
    </MemoryRouter>,
  );
}

/** Paso 1 → paso 2. El selector de canal vive en el paso 2. */
const irACanal = () => fireEvent.click(screen.getByText(/Continuar a Hechos y Canal/));

const boton = (label: RegExp) =>
  screen.getByText(label).closest("button") as HTMLButtonElement;

describe("SII Garrigues — el anónimo entra por la vía que prevé PI-31 Anexo §3.c", () => {
  it("la pantalla no ofrece el formulario web para el anónimo estricto, y cita el apartado", async () => {
    await montar(SII_TENANT);
    irACanal();
    expect(boton(/Formulario Web Seguro/).disabled).toBe(true);
    expect(boton(/Correo Postal/).disabled).toBe(false);
    expect(screen.getByText(/PI-31, Anexo §3\.c/)).toBeTruthy();
  });

  it("y el expediente se REGISTRA con canal postal: lo que se escribe, no lo que se pinta", async () => {
    await montar(SII_TENANT);
    irACanal();
    fireEvent.change(screen.getByDisplayValue("— Seleccione la entidad —").closest("select")!, {
      target: { value: "ent-1" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Presunta irregularidad/), {
      target: { value: "Hechos comunicados de forma anónima." },
    });
    fireEvent.change(screen.getByPlaceholderText(/Describa los hechos|Detalle/i), {
      target: { value: "Descripción de los hechos sin datos identificativos innecesarios." },
    });
    fireEvent.click(screen.getByText(/Continuar a Evidencias/));
    await act(async () => {
      fireEvent.click(screen.getByText(/^Registrar comunicación$/));
    });

    expect(altaRecibida).not.toBeNull();
    expect(altaRecibida!.anonymityMode).toBe("ANONIMO_ESTRICTO");
    expect(altaRecibida!.channel).toBe("POSTAL");
  });

  it("CONTROL: en modalidad confidencial el formulario web sigue disponible", async () => {
    // Sin esto, deshabilitar el web SIEMPRE pasaría el caso de arriba. El
    // §3.a (i) sí prevé la aplicación web: lo que la política reconduce al
    // postal es el anónimo, no toda comunicación.
    await montar(SII_TENANT);
    fireEvent.click(screen.getByText(/Confidencial con Identificación/));
    irACanal();
    expect(boton(/Formulario Web Seguro/).disabled).toBe(false);
    expect(screen.queryByText(/PI-31, Anexo §3\.c/)).toBeNull();
  });

  it("CONTROL ARGA: PI-31 no es su política y su portal no cambia", async () => {
    await montar(ARGA);
    irACanal();
    expect(boton(/Formulario Web Seguro/).disabled).toBe(false);
    expect(boton(/Correo Postal/).disabled).toBe(false);
    expect(screen.queryByText(/PI-31/)).toBeNull();
  });
});

describe("SII Garrigues — los casos demo se siembran por la vía que les corresponde", () => {
  it("todo caso anónimo estricto entra por POSTAL", () => {
    const anonimos = CASOS_DEMO_GARRIGUES.filter((c) => c.anonymityMode === "ANONIMO_ESTRICTO");
    expect(anonimos.length).toBeGreaterThan(0);
    for (const c of anonimos) expect(c.channel).toBe("POSTAL");
  });

  it("CONTROL: y los que NO son anónimos conservan el formulario web", () => {
    // Poner los tres en POSTAL satisfaría el caso anterior sin decir nada.
    const identificados = CASOS_DEMO_GARRIGUES.filter(
      (c) => c.anonymityMode !== "ANONIMO_ESTRICTO",
    );
    expect(identificados.length).toBeGreaterThan(0);
    expect(identificados.every((c) => c.channel === "WEB_ANONIMO")).toBe(true);
  });
});

describe("SII Garrigues — el canal corregido atraviesa las filas ya escritas", () => {
  // ESTE es el bloque que faltaba, y lo señaló la review adversarial de rama.
  // Los dos de arriba comprueban el CATÁLOGO y el formulario de alta; ninguno
  // toca `getStoredReports`, que solo siembra cuando la clave NO existe. Un
  // navegador que ya hubiera abierto /sii —el de la demo, sin ir más lejos—
  // seguía devolviendo `WEB_ANONIMO` desde localStorage, y ese canal viciado
  // se pinta en el listado, en la ficha y en el asiento del Libro-registro.
  // Es el mismo patrón de arista rota por CACHÉ que ya ocurrió con `firmeza`.
  const sembrarFilasViejas = () =>
    sembrarFilasGarrigues(CASOS_DEMO_GARRIGUES.map((c) => ({ ...c, channel: "WEB_ANONIMO" })));

  afterEach(() => reiniciarAlmacen());

  it("con las filas YA escritas, los anónimos se leen como POSTAL", async () => {
    sembrarFilasViejas();
    const { getStoredReports } = await import("@/hooks/useWhistleblowing");
    const leidos = await getStoredReports(SII_TENANT);

    const anonimos = leidos.filter((r) => r.anonymityMode === "ANONIMO_ESTRICTO");
    expect(anonimos.length, "sin anónimos la aserción sería vacua").toBeGreaterThan(0);
    for (const r of anonimos) expect(r.channel, `${r.code} sigue viniendo del almacén`).toBe("POSTAL");
  });

  it("CONTROL: la reaplicación no arrasa los expedientes dados de alta", async () => {
    // Sin esto, «reaplicar el catálogo entero» pasaría el caso anterior
    // borrando lo que el usuario haya registrado.
    const propio = { ...CASOS_DEMO_GARRIGUES[0], code: "SII-ALTA-PROPIA", channel: "WEB_ANONIMO" };
    sembrarFilasGarrigues([...CASOS_DEMO_GARRIGUES]);
    sembrarFilasGarrigues([propio], "ALTA");
    const { getStoredReports } = await import("@/hooks/useWhistleblowing");
    const propioLeido = (await getStoredReports(SII_TENANT)).find((r) => r.code === "SII-ALTA-PROPIA");
    expect(propioLeido, "el expediente de alta desapareció").toBeDefined();
    expect(propioLeido!.channel, "no está en el catálogo: nadie decide su canal").toBe("WEB_ANONIMO");
  });

  it("CONTROL DISCRIMINANTE: un alta que COMPARTE código con el catálogo tampoco se pisa", async () => {
    // El caso anterior pasaría igual sin la columna `origen`, porque
    // "SII-ALTA-PROPIA" no está en el catálogo y el `Map` no lo encuentra. Aquí
    // el código SÍ coincide, que es la única forma de que la reaplicación
    // llegue a tocar la fila. Con el almacén compartido entre equipos, que los
    // códigos de alta lleven el mes 08 y los del catálogo no dejó de ser
    // garantía de nada: lo que separa las dos cosas es el `origen`.
    const codigoDelCatalogo = CASOS_DEMO_GARRIGUES[0].code;
    sembrarFilasGarrigues(
      [{ ...CASOS_DEMO_GARRIGUES[0], channel: "WEB_ANONIMO", summary: "Redactado por el instructor" }],
      "ALTA",
    );
    const { getStoredReports } = await import("@/hooks/useWhistleblowing");
    const leido = (await getStoredReports(SII_TENANT)).find((r) => r.code === codigoDelCatalogo);

    expect(leido, "la fila desapareció").toBeDefined();
    expect(leido!.channel, "el catálogo pisó una fila que no es suya").toBe("WEB_ANONIMO");
    expect(leido!.summary, "el catálogo pisó el texto del instructor").toBe("Redactado por el instructor");

    // Y la contraprueba, en la MISMA aserción de comportamiento: marcada como
    // del catálogo, la misma fila sí se corrige. Sin esto, «no se pisa» sería
    // indistinguible de «la reaplicación no funciona».
    reiniciarAlmacen();
    sembrarFilasGarrigues([
      { ...CASOS_DEMO_GARRIGUES[0], channel: "WEB_ANONIMO", summary: "Redactado por el instructor" },
    ]);
    const corregido = (await getStoredReports(SII_TENANT)).find((r) => r.code === codigoDelCatalogo);
    expect(corregido!.channel, "la reaplicación del catálogo dejó de funcionar").toBe(
      CASOS_DEMO_GARRIGUES[0].channel,
    );
  });
});


describe("SII Garrigues — qué reaplica el catálogo sobre lo ya escrito y qué NO", () => {
  // n=1086. El catálogo ya está corregido y tipado, pero la corrección viajaba
  // solo para `firmeza` y `channel`: `CAMPOS_DEL_CATALOGO` era una lista de dos.
  // Un navegador que ya hubiera abierto /sii —el de la demo— seguía sirviendo
  // el estado y la modalidad viejos, y `SiiDashboard` pinta el estado CRUDO
  // (`{r.status.replace(/_/g, " ")}`), así que `ADMITIDA` —que nunca estuvo en
  // `WhistleblowingStatus`— se leía como un estado real del expediente.
  //
  // La lista explícita es el diseño: hace visible el hueco. Lo que decide el
  // catálogo se reaplica; lo que decide el instructor, no. El tercer caso es el
  // que separa las dos cosas y el que se pondría rojo si alguien "arreglara"
  // esto metiendo `status` en la lista.
  const sembrarClave = (reports: Array<Record<string, unknown> & { code: string }>) =>
    sembrarFilasGarrigues(reports);
  const catalogo = async () => {
    const { casosDemoGarrigues } = await import("../../../scripts/garrigues/sii/casos-demo");
    return casosDemoGarrigues("J&A Garrigues, S.L.P.");
  };

  afterEach(() => reiniciarAlmacen());

  it("un estado que el motor NO tiene no sobrevive al almacén", async () => {
    const { WHISTLEBLOWING_STATUSES } = await import("@/lib/sii/whistleblowing-engine");
    sembrarClave((await catalogo()).map((r) => ({ ...r, status: "ADMITIDA" })));

    const { getStoredReports } = await import("@/hooks/useWhistleblowing");
    const leidos = await getStoredReports(SII_TENANT);

    expect(leidos.length, "sin expedientes la aserción sería vacua").toBeGreaterThan(0);
    for (const r of leidos) {
      expect(WHISTLEBLOWING_STATUSES as readonly string[], `${r.code} sirve un estado inventado`)
        .toContain(r.status);
    }
  });

  it("la modalidad de anonimato la decide el catálogo, no el almacén", async () => {
    const delCatalogo = await catalogo();
    const identificados = delCatalogo.filter((r) => r.anonymityMode === "CONFIDENCIAL_IDENTIFICADO");
    expect(identificados.length, "sin identificados no habría nada que corregir").toBeGreaterThan(0);
    // El caché de la demo los tenía todos como anónimos estrictos, que es lo
    // que arrastraba el canal web al Libro-registro.
    sembrarClave(delCatalogo.map((r) => ({ ...r, anonymityMode: "ANONIMO_ESTRICTO" })));

    const { getStoredReports } = await import("@/hooks/useWhistleblowing");
    const leidos = await getStoredReports(SII_TENANT);
    for (const esperado of identificados) {
      const leido = leidos.find((r) => r.code === esperado.code);
      expect(leido?.anonymityMode, `${esperado.code} sigue viniendo del almacén`)
        .toBe("CONFIDENCIAL_IDENTIFICADO");
    }
  });

  it("CONTROL: un estado LEGÍTIMO puesto por el instructor no se revierte", async () => {
    // `useCloseRootCase` escribe ARCHIVADO_MOTIVADO sobre estos mismos códigos.
    // Si `status` entrara en `CAMPOS_DEL_CATALOGO`, abrir la pantalla
    // devolvería el expediente a EN_INVESTIGACION: se perdería el cierre.
    sembrarClave((await catalogo()).map((r) => ({ ...r, status: "ARCHIVADO_MOTIVADO" })));

    const { getStoredReports } = await import("@/hooks/useWhistleblowing");
    const leidos = await getStoredReports(SII_TENANT);
    expect(leidos.length).toBeGreaterThan(0);
    for (const r of leidos) {
      expect(r.status, `${r.code} perdió el cierre del instructor`).toBe("ARCHIVADO_MOTIVADO");
    }
  });
});
