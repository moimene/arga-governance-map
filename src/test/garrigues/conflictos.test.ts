// Tarea 6 del carril C3 — conflictos de interés tipológicos, nunca nominales.
//
// CONJUNTO ABIERTO POR ARRIBA (2026-09-07). El tenant Garrigues se siembra de
// forma PROGRESIVA con dato simulado basado en la realidad, así que exigir
// igualdad exacta con el catálogo ponía en rojo la siembra misma y empujaba al
// siguiente a revertirla. Lo que se vigila ahora es lo contrario: que no se
// PIERDA lo que ya hay. «Al menos los del catálogo, y todos ellos» crece bien y
// encoge mal.
//
// La aserción que de verdad protege no es «hay filas»: es que **ninguna
// descripción contiene el nombre de una persona del censo**. El censo de
// Garrigues son 406 personas físicas con nombre y apellidos reales de fuente
// pública. Decir que una de ellas está en conflicto de intereses es una
// afirmación sobre una persona concreta que ninguna fuente sostiene, y es el
// único daño que esta tarea puede causar. Se comprueba contra el censo REAL
// traído de Cloud, no contra una lista escrita a mano.
import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sesionDe, GARRIGUES_TENANT, DEMO_TENANT } from "../helpers/supabase-test-client";
import {
  CATEGORIAS_PI02,
  CONFLICTOS_DEMO,
  CONFLICTOS_AVISO,
  CONFLICTOS_TENANT,
} from "../../../scripts/garrigues/conflictos/catalogo-conflictos";

describe("C3 Tarea 6 — conflictos declarados y etiquetados", () => {
  let garr: SupabaseClient;
  let arga: SupabaseClient;

  beforeAll(async () => {
    [garr, arga] = await Promise.all([sesionDe("GARRIGUES"), sesionDe("ARGA")]);
  }, 30_000);

  it("las filas del catálogo están TODAS en Cloud; puede haber más, no menos", async () => {
    const { data, error } = await garr.from("conflicts_of_interest")
      .select("code, conflict_type, description, person_id, tenant_id")
      .eq("tenant_id", GARRIGUES_TENANT).order("code");
    expect(error).toBeNull();
    const enCloud = new Set((data ?? []).map((c) => c.code));
    // Encoge mal: si desaparece una del catálogo, aquí sale nombrada.
    expect(CONFLICTOS_DEMO.filter((c) => !enCloud.has(c.code)).map((c) => c.code)).toEqual([]);
    // Y el catálogo no puede quedarse vacío, o lo de arriba no compara nada.
    expect(CONFLICTOS_DEMO.length).toBeGreaterThan(0);
  });

  it("las del catálogo NO llevan persona: `person_id` sigue NULL en las cinco", async () => {
    // ACOTADO AL CATÁLOGO (2026-09-07). Antes se exigía a TODA fila del tenant,
    // lo que prohibía justo lo que la siembra progresiva puede querer: un
    // conflicto simulado atado a alguien. Lo que no se relaja es el guard de
    // abajo —una fila que NO declara persona no puede nombrar a ninguna—, que
    // es donde estaba el daño de verdad.
    const { data } = await garr.from("conflicts_of_interest")
      .select("code, person_id").eq("tenant_id", GARRIGUES_TENANT);
    const codigos = new Set(CONFLICTOS_DEMO.map((c) => c.code));
    const delCatalogo = (data ?? []).filter((c) => codigos.has(c.code));
    // Sin esto la aserción es VACUA: con el seed borrado, filtrar un conjunto
    // vacío da vacío y el test pasa sin haber mirado ninguna fila. Probado
    // apuntando a un tenant inexistente: 9 pass / 0 fail.
    expect(delCatalogo.length).toBe(CONFLICTOS_DEMO.length);
    expect(delCatalogo.filter((c) => c.person_id !== null)).toEqual([]);
  });

  it("y `conflict_type` queda NULL en las del catálogo; la naturaleza de PI-02 no entra ahí nunca", async () => {
    // El CHECK de la columna solo admite 'Permanente' | 'Situacional', que
    // clasifica por DURACIÓN. PI-02 clasifica por naturaleza —«sentido
    // estricto» vs «comercial o de negocio»—. Son ejes distintos: escribir uno
    // en la columna del otro sería inventar una correspondencia. Mismo criterio
    // que G5 aplicó a `findings.severity`.
    const { data } = await garr.from("conflicts_of_interest")
      .select("code, conflict_type").eq("tenant_id", GARRIGUES_TENANT);
    const codigos = new Set(CONFLICTOS_DEMO.map((c) => c.code));
    const delCatalogo = (data ?? []).filter((c) => codigos.has(c.code));
    expect(delCatalogo.length).toBe(CONFLICTOS_DEMO.length);
    expect(delCatalogo.filter((c) => c.conflict_type !== null)).toEqual([]);
    // Y esto sí vale para TODA fila, también las que siembre alguien mañana:
    // la naturaleza de PI-02 nunca entra en la columna de la duración. Es la
    // invariante de MODELO, y no se afloja porque el tenant crezca.
    const naturalezas = new Set<string>(CATEGORIAS_PI02.map((c) => String(c.conflict_type)));
    expect((data ?? []).filter((c) => c.conflict_type && naturalezas.has(String(c.conflict_type))))
      .toEqual([]);
  });

  it("y el `status` que sí viaja es del vocabulario que el CHECK admite", async () => {
    const ADMITIDOS = new Set(["Declarado", "Pendiente", "Resuelto"]);
    const { data } = await garr.from("conflicts_of_interest")
      .select("code, status").eq("tenant_id", GARRIGUES_TENANT);
    const codigos = new Set(CONFLICTOS_DEMO.map((c) => c.code));
    // Anti-vacuidad: las del catálogo tienen que seguir estando…
    expect((data ?? []).filter((c) => codigos.has(c.code)).length).toBe(CONFLICTOS_DEMO.length);
    // …y el vocabulario lo cumple TODA fila, incluidas las que se siembren.
    expect((data ?? []).filter((c) => !ADMITIDOS.has(c.status))).toEqual([]);
    // Y el término de la fuente —«en chequeo»— se conserva aparte, sin
    // pretender que la BD lo entiende.
    expect(CONFLICTOS_DEMO.some((c) => c.estadoTexto === "En chequeo")).toBe(true);
    expect(CONFLICTOS_DEMO.every((c) => ADMITIDOS.has(c.status))).toBe(true);
  });

  it("y NINGUNA descripción nombra a nadie del censo real", async () => {
    // La prueba de verdad. Se trae el censo de Cloud y se busca cada nombre
    // —y cada apellido compuesto— dentro de las descripciones.
    const { data: personas, error: eP } = await garr.from("persons")
      .select("full_name, person_type").eq("tenant_id", GARRIGUES_TENANT).limit(1000);
    expect(eP).toBeNull();
    // Si el censo viniera vacío, este test pasaría sin comprobar nada.
    expect(personas.length).toBeGreaterThan(100);

    // Las DOS fuentes. Comprobar solo Cloud dejaba un hueco real: el nombre
    // entra por el CATÁLOGO, y hasta que alguien no ejecutara el seed el guard
    // no lo veía. Verificado mutando: con solo Cloud, meter «Fernando Vives
    // Ruiz» en una descripción del catálogo NO hacía caer el test.
    const { data: filas } = await garr.from("conflicts_of_interest")
      .select("code, description, person_id").eq("tenant_id", GARRIGUES_TENANT);
    // Se juzgan las filas que NO declaran persona. Una fila que sí la declara
    // habla de alguien a propósito y nombrarlo no es una fuga; el daño es la
    // fila tipológica que se cuela nombrando a un socio del censo.
    const sinPersona = (filas ?? []).filter((f) => f.person_id === null);
    // Anti-vacuidad: al menos las cinco del catálogo son de este tipo.
    expect(sinPersona.length).toBeGreaterThanOrEqual(CONFLICTOS_DEMO.length);
    const texto = [
      ...sinPersona.map((f) => f.description as string),
      ...CONFLICTOS_DEMO.map((c) => c.descripcion),
    ].join(" \n ").toLowerCase();

    const encontrados = personas
      .map((p) => p.full_name as string)
      .filter(Boolean)
      .filter((nombre) => texto.includes(nombre.toLowerCase()));
    expect(encontrados).toEqual([]);

    // Por apellidos solo de personas FÍSICAS. No es debilitar el test: la regla
    // protege a personas identificadas, y los nombres de personas JURÍDICAS
    // contienen palabras comunes —«Sociedad», «Servicios»— que aparecen en
    // cualquier descripción de un conflicto societario. Sin este filtro el test
    // caía por «Sociedad», que es un falso positivo, no una fuga.
    const fisicas = personas.filter((p) => p.person_type === "PF");
    expect(fisicas.length).toBeGreaterThan(100);
    const apellidos = fisicas
      .map((p) => (p.full_name as string) ?? "")
      .flatMap((n) => n.split(/\s+/).slice(1))
      .filter((a) => a.length >= 5);
    // Escapado obligatorio: hay nombres del censo con metacaracteres —el
    // primer intento reventó con «Invalid regular expression»— y un `catch`
    // silencioso aquí convertiría la comprobación en un pase gratis.
    const escapar = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const porApellido = [...new Set(apellidos)]
      .filter((a) => new RegExp(`\\b${escapar(a.toLowerCase())}\\b`).test(texto));
    expect(porApellido).toEqual([]);
  });

  it("las categorías son las de PI-02 y llevan su apartado", () => {
    // Lo firme se cita; lo simulado se etiqueta. Son cosas distintas y no se
    // mezclan en la misma marca.
    expect(CATEGORIAS_PI02.map((c) => c.conflict_type))
      .toEqual(["SENTIDO_ESTRICTO", "COMERCIAL_O_NEGOCIO"]);
    expect(CATEGORIAS_PI02.every((c) => c.firmeza === "FIRME")).toBe(true);
    expect(CATEGORIAS_PI02.every((c) => /^PI-02 §2\.\d$/.test(c.apartado))).toBe(true);
  });

  it("y TODAS las situaciones están etiquetadas como simuladas", () => {
    expect(CONFLICTOS_DEMO.length).toBeGreaterThan(0);
    expect(CONFLICTOS_DEMO.every((c) => c.firmeza === "DEMO_PILOTO")).toBe(true);
    // Aserción inversa: si alguien añade una afirmándola como real, cae.
    expect(CONFLICTOS_DEMO.filter((c) => c.firmeza !== "DEMO_PILOTO")).toEqual([]);
    // Y cada tipo declarado tiene que ser uno de los dos de PI-02.
    const tipos = new Set(CATEGORIAS_PI02.map((c) => c.conflict_type));
    expect(CONFLICTOS_DEMO.filter((c) => !tipos.has(c.conflict_type))).toEqual([]);
  });

  it("el aviso de pantalla distingue lo firme de lo simulado", () => {
    expect(CONFLICTOS_AVISO.texto).toContain("no publica un registro");
    expect(CONFLICTOS_AVISO.texto).toContain("rol");
    expect(CONFLICTOS_AVISO.fuente).toContain("PI-02");
  });

  it("ARGA no cambia: su única fila sigue siendo suya y no ve las de Garrigues", async () => {
    const { data, error } = await arga.from("conflicts_of_interest")
      .select("code, tenant_id").eq("tenant_id", DEMO_TENANT);
    expect(error).toBeNull();
    // EXACTO A PROPÓSITO: esto no es un conteo cerrado de los que estorban a la
    // siembra, es el contrato cero-cambio de ARGA. Si sube o baja, alguien tocó
    // el tenant que nadie puede tocar.
    expect(data.length).toBe(1);
    const codigos = new Set(CONFLICTOS_DEMO.map((c) => c.code));
    expect(data.filter((c) => codigos.has(c.code))).toEqual([]);
    // El catálogo declara su tenant y no es el de ARGA.
    expect(CONFLICTOS_TENANT).not.toBe(DEMO_TENANT);
  });
});
