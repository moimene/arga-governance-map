import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEMO_TENANT, GARRIGUES_TENANT, sesionDe } from "../helpers/supabase-test-client";
import { AISLAMIENTO_DECLARADO } from "../garrigues/aislamiento-declarado";

/**
 * Aislamiento cross-tenant REAL de las superficies P0 de Secretaría.
 *
 * QUÉ HABÍA AQUÍ ANTES. Este era el único fichero del carril con
 * «tenant-isolation» en el nombre y no comprobaba ningún aislamiento: hacía
 * `readFileSync` de `scripts/secretaria-p0-cloud-smoke.ts` y sus 25 aserciones
 * eran `toMatch` de cadenas sobre ese texto. Ese script no lo ejecuta nada de
 * la suite (solo `scripts/secretaria-p0-preflight.sh`, que se lanza a mano), de
 * modo que el gate se ponía verde comprobando que un fichero MENCIONA el
 * aislamiento, no que el aislamiento exista. Un test que no puede fallar por el
 * hecho que dice cubrir es peor que no tenerlo.
 *
 * QUÉ COMPRUEBA AHORA. Con dos sesiones reales (ARGA y Garrigues), que cada
 * tenant NO ve las filas del otro en las tablas propias del carril, y que la
 * escritura directa está cortada a nivel de privilegio.
 *
 * ANTI-VACUIDAD. Cada aserción de aislamiento va precedida de la comprobación
 * de que el tenant que la hace SÍ ve filas suyas: sin eso, una consulta que
 * devuelve vacío por cualquier motivo (RLS mal configurada, sesión perdida)
 * pasaría como «aislamiento correcto».
 *
 * GOTCHA de este repo: un WRITE cross-tenant filtrado por RLS devuelve 0 filas
 * SIN error, no `42501`. El `42501` solo aparece cuando el privilegio de tabla
 * está revocado. Este fichero cubre la LECTURA; la escritura cross-tenant la
 * cubre `tenant-isolation.test.ts`.
 */

/**
 * Tablas del carril Secretaría.
 *
 * 2026-09-07 — CÓMO ENTRAN LAS QUE FALTABAN.
 *
 * Aquí decía que `minutes` (12/0) y `certifications` (9/0) quedaban fuera
 * porque Garrigues no ha cerrado ninguna sesión, y que «entrarán solas el día
 * que la tenga». No era verdad: esta lista es literal y nada la deriva del
 * dato, así que no entrarían solas y nadie avisaría. Y la salida fácil para el
 * que sí se acordara —añadirlas y ver el gate rojo— empujaba a volver a
 * quitarlas.
 *
 * Ahora entran YA, y lo que se adapta al dato es el CONTROL POSITIVO. La mitad
 * que hoy se puede probar de verdad se prueba —«Garrigues no ve las 13 actas de
 * ARGA» tiene sujeto y es la dirección de riesgo—; la mitad sin sujeto queda
 * bajo el techo de vacuidad de `aislamiento-declarado.ts`. El día que Garrigues
 * cierre un acta, las dos mitades pasan a asertar sin que nadie edite nada.
 */
const TABLAS_SECRETARIA = [
  "registry_filings",
  "plantillas_protegidas",
  "agreements",
  "governing_bodies",
  "rule_packs",
  // El corazón del carril: una reunión es el objeto del que cuelgan actas,
  // acuerdos y certificaciones.
  "meetings",
  // Pendientes de siembra en Garrigues, asertadas en la dirección que sí tiene
  // sujeto (ver arriba).
  "minutes",
  "certifications",
] as const;

/**
 * Tabla de respaldo para el control positivo cuando el tenant aún no tiene
 * filas en la que se está midiendo.
 *
 * El control positivo existe para descartar CEGUERA —sesión caída, RLS que tapa
 * todo—, no para probar que la tabla concreta esté poblada. Si el tenant ve sus
 * `agreements`, su sesión funciona y su RLS deja pasar lo suyo; que la aserción
 * de aislamiento de otra tabla salga vacía es entonces información sobre la
 * siembra, no sobre la sesión. Y si `agreements` se vaciara para un tenant,
 * esto se pone rojo, que es lo correcto: sería pérdida de dato.
 */
const CONTROL_DE_SESION = "agreements";

describe("Secretaría P0 — aislamiento cross-tenant real", () => {
  let arga: SupabaseClient;
  let garrigues: SupabaseClient;

  beforeAll(async () => {
    // `sesionDe` LANZA si no autentica: sin sesión no hay nada que verificar y
    // el fichero debe ponerse rojo, no saltarse.
    arga = await sesionDe("ARGA");
    garrigues = await sesionDe("GARRIGUES");
  }, 60_000);

  /**
   * «`quien` no ve las filas de `elOtro` en `tabla`», con su control positivo.
   *
   * Escrito una vez para las dos direcciones: eran dos bloques con la misma
   * lógica y el fallback habría acabado en uno solo de ellos.
   */
  async function noVeLoAjeno(
    cliente: SupabaseClient,
    tabla: string,
    propio: string,
    ajeno: string,
    quien: string,
  ) {
    const propias = await cliente.from(tabla).select("tenant_id").eq("tenant_id", propio).limit(5);
    expect(propias.error, `${tabla}: la consulta propia falló, la medición no es válida`).toBeNull();

    if ((propias.data ?? []).length === 0) {
      // Sin filas propias EN ESTA TABLA no hay control positivo aquí. Se hace
      // contra `agreements`, donde el tenant sí tiene dato, para descartar que
      // el vacío venga de una sesión ciega.
      const control = await cliente
        .from(CONTROL_DE_SESION).select("id").eq("tenant_id", propio).limit(1);
      expect(control.error, `${tabla}: el control de sesión falló`).toBeNull();
      expect(
        (control.data ?? []).length,
        `${quien}: no ve NI sus ${CONTROL_DE_SESION}. La sesión está ciega y ninguna aserción ` +
          "de aislamiento de este fichero vale.",
      ).toBeGreaterThan(0);

      // Y la ausencia en esta tabla tiene que estar DECLARADA. Si no lo está,
      // es pérdida de dato: alguien vació una tabla que estaba sembrada.
      const declarada = AISLAMIENTO_DECLARADO.find((t) => t.tabla === tabla);
      const presencia = propio === GARRIGUES_TENANT ? declarada?.garrigues : declarada?.arga;
      expect(
        ["PENDIENTE", "NINGUNA"],
        `${tabla}: ${quien} no tiene NI UNA fila propia y eso no está declarado ` +
          `(declaración actual: ${presencia ?? "la tabla no aparece en aislamiento-declarado.ts"}). ` +
          "O se ha perdido dato sembrado —recupéralo— o hay que declararlo allí.",
      ).toContain(presencia);
    }

    const ajenas = await cliente.from(tabla).select("tenant_id").eq("tenant_id", ajeno);
    expect(ajenas.error).toBeNull();
    expect(ajenas.data ?? []).toEqual([]);
  }

  it.each(TABLAS_SECRETARIA)("%s — ARGA no ve filas de Garrigues", async (tabla) => {
    await noVeLoAjeno(arga, tabla, DEMO_TENANT, GARRIGUES_TENANT, "ARGA");
  }, 30_000);

  it.each(TABLAS_SECRETARIA)("%s — Garrigues no ve filas de ARGA", async (tabla) => {
    await noVeLoAjeno(garrigues, tabla, GARRIGUES_TENANT, DEMO_TENANT, "Garrigues");
  }, 30_000);

  it("y la dirección de riesgo de actas y certificaciones NO es vacua", async () => {
    // Control del INSTRUMENTO para las dos tablas recién incorporadas. Su
    // aserción «Garrigues no ve las de ARGA» solo significa algo si ARGA TIENE
    // filas que esconder; sin esto, las dos entradas de arriba podrían pasar
    // por conjunto vacío en los DOS lados y parecer cobertura nueva sin serlo.
    for (const tabla of ["minutes", "certifications"] as const) {
      const { data, error } = await arga.from(tabla).select("id").eq("tenant_id", DEMO_TENANT);
      expect(error, `${tabla}`).toBeNull();
      expect(
        (data ?? []).length,
        `${tabla}: ARGA tampoco tiene filas, así que meter esta tabla en el gate no añade ` +
          "cobertura — las dos direcciones serían vacuas.",
      ).toBeGreaterThan(0);
    }
  }, 30_000);

  it("un SELECT sin filtro solo devuelve filas del propio tenant", async () => {
    for (const [nombre, cliente, propio] of [
      ["ARGA", arga, DEMO_TENANT],
      ["Garrigues", garrigues, GARRIGUES_TENANT],
    ] as const) {
      const { data, error } = await cliente.from("agreements").select("tenant_id").limit(200);
      expect(error, `${nombre}: consulta fallida`).toBeNull();
      expect((data ?? []).length, `${nombre}: sin filas, la aserción sería vacua`).toBeGreaterThan(0);
      expect(
        (data ?? []).map((row) => (row as { tenant_id: string }).tenant_id).filter((t) => t !== propio),
      ).toEqual([]);
    }
  }, 30_000);
});
