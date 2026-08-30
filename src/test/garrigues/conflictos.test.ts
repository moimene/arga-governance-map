// Tarea 6 del carril C3 — conflictos de interés tipológicos, nunca nominales.
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

  it("hay filas para Garrigues y son las del catálogo", async () => {
    const { data, error } = await garr.from("conflicts_of_interest")
      .select("code, conflict_type, description, person_id, tenant_id")
      .eq("tenant_id", GARRIGUES_TENANT).order("code");
    expect(error).toBeNull();
    expect(data.map((c) => c.code)).toEqual(CONFLICTOS_DEMO.map((c) => c.code));
  });

  it("NINGUNA lleva persona: `person_id` es NULL en todas", async () => {
    const { data } = await garr.from("conflicts_of_interest")
      .select("code, person_id").eq("tenant_id", GARRIGUES_TENANT);
    expect(data.filter((c) => c.person_id !== null)).toEqual([]);
  });

  it("y `conflict_type` queda NULL en Cloud, a propósito", async () => {
    // El CHECK de la columna solo admite 'Permanente' | 'Situacional', que
    // clasifica por DURACIÓN. PI-02 clasifica por naturaleza —«sentido
    // estricto» vs «comercial o de negocio»—. Son ejes distintos: escribir uno
    // en la columna del otro sería inventar una correspondencia. Mismo criterio
    // que G5 aplicó a `findings.severity`.
    const { data } = await garr.from("conflicts_of_interest")
      .select("code, conflict_type").eq("tenant_id", GARRIGUES_TENANT);
    expect(data.filter((c) => c.conflict_type !== null)).toEqual([]);
  });

  it("y el `status` que sí viaja es del vocabulario que el CHECK admite", async () => {
    const ADMITIDOS = new Set(["Declarado", "Pendiente", "Resuelto"]);
    const { data } = await garr.from("conflicts_of_interest")
      .select("code, status").eq("tenant_id", GARRIGUES_TENANT);
    expect(data.filter((c) => !ADMITIDOS.has(c.status))).toEqual([]);
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
      .select("code, description").eq("tenant_id", GARRIGUES_TENANT);
    const texto = [
      ...filas.map((f) => f.description as string),
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
    expect(data.length).toBe(1);
    const codigos = new Set(CONFLICTOS_DEMO.map((c) => c.code));
    expect(data.filter((c) => codigos.has(c.code))).toEqual([]);
    // El catálogo declara su tenant y no es el de ARGA.
    expect(CONFLICTOS_TENANT).not.toBe(DEMO_TENANT);
  });
});
