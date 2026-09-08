// src/test/aims/dashboard-sin-posturas.test.ts
//
// El Dashboard de AI Governance ya no lleva dentro un catálogo de posturas.
//
// `aimsScreenPostures` era una descripción EN PROSA de lo que hacen las diez
// pantallas del módulo, mantenida aparte de las pantallas: derivaba en cuanto
// alguien tocaba una, y llegó a afirmar por las diez filas lo que sólo valía
// para ocho. Se retira entera (D-10). Lo que sobrevive es el DATO de
// navegación —los cuatro handoffs—, que se muda a la hoja `@/lib/aims/handoffs`.
//
// Todo se mide sobre el fuente SIN COMENTARIOS: el comentario que explica una
// retirada cita por fuerza lo retirado, y sin esto el gate se dispara contra su
// propia justificación.
import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { sinComentarios } from "@/test/helpers/sin-comentarios";

const DASHBOARD = "src/pages/ai-governance/Dashboard.tsx";
const READINESS = "src/lib/aims/readiness.ts";
const HANDOFFS = "src/lib/aims/handoffs.ts";
const DIR = "src/components/ai-governance/dashboard";

const read = (f: string) => readFileSync(f, "utf8");
const lineas = (f: string) => read(f).split("\n").length;

/** Todos los `.ts`/`.tsx` bajo `src/`, para que el barrido no sea una lista. */
function fuentes(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(e.name)) out.push(full);
    }
  };
  for (const d of ["src/pages", "src/components", "src/lib", "src/hooks", "src/test"]) walk(d);
  return out;
}

describe("control positivo del instrumento", () => {
  it("las dos superficies existen y tienen cuerpo", () => {
    // Las aserciones de ausencia de abajo pasarían por vacuidad si el fichero
    // hubiera desaparecido o se hubiera quedado en un cascarón.
    expect(existsSync(DASHBOARD), `${DASHBOARD} no existe`).toBe(true);
    expect(lineas(DASHBOARD)).toBeGreaterThan(100);
    expect(existsSync(READINESS), `${READINESS} no existe`).toBe(true);
    expect(lineas(READINESS)).toBeGreaterThan(300);
  });

  it("el barrido de `src/` ve el árbol entero, no un subconjunto mudo", () => {
    const ficheros = fuentes();
    expect(ficheros.length, "el barrido de src/ se ha quedado corto").toBeGreaterThan(200);
    for (const esperado of [DASHBOARD, READINESS, HANDOFFS]) {
      expect(ficheros, `${esperado} no entra en el barrido`).toContain(esperado);
    }
  });
});

describe("el catálogo de posturas de pantalla está retirado", () => {
  it("`readiness.ts` ya no exporta ni las posturas ni los handoffs", () => {
    const src = sinComentarios(read(READINESS));
    expect(/export const aimsScreenPostures/.test(src)).toBe(false);
    expect(/export const aimsReadOnlyHandoffs/.test(src)).toBe(false);
    expect(/export interface AimsScreenPosture/.test(src)).toBe(false);
    // Y no se ha vaciado el módulo por el camino: el criterio sigue ahí.
    expect(src).toContain("export function buildAimsReadiness");
    expect(src).toContain("export function buildAimsComplianceMonitors");
  });

  it("no queda una sola aparición de `aimsScreenPostures` en `src/`", () => {
    // Este fichero se excluye: nombra lo prohibido para poder prohibirlo, igual
    // que `sinComentarios` protege a la prosa que explica una retirada.
    const YO = "src/test/aims/dashboard-sin-posturas.test.ts";
    const conRastro = fuentes()
      .filter((f) => f !== YO)
      .filter((f) => sinComentarios(read(f)).includes("aimsScreenPostures"));
    expect(conRastro, `el catálogo de posturas sigue vivo en: ${conRastro.join(", ")}`).toEqual([]);
  });

  it("el Dashboard cabe en 400 líneas", () => {
    expect(lineas(DASHBOARD)).toBeLessThanOrEqual(400);
  });

  it("ningún componente del dashboard pasa de 400 líneas", () => {
    const ficheros = readdirSync(DIR).filter((f) => f.endsWith(".tsx"));
    expect(ficheros.length, "el directorio de componentes del dashboard está vacío").toBeGreaterThan(3);
    for (const f of ficheros) {
      expect({ f, cabe: lineas(`${DIR}/${f}`) <= 400 }).toEqual({ f, cabe: true });
    }
  });
});

describe("los handoffs son dato de navegación en un módulo hoja", () => {
  it("`handoffs.ts` no importa nada", () => {
    // Hoja de verdad: si importara de `@/` o de un hermano volvería a poder
    // participar en un ciclo, que es lo que ya tumbó `/secretaria` una vez.
    const src = sinComentarios(read(HANDOFFS));
    expect([...src.matchAll(/^\s*import\s.+$/gm)].map((m) => m[0].trim())).toEqual([]);
  });

  it("los cuatro handoffs siguen siendo rutas de solo lectura", async () => {
    const { AIMS_HANDOFFS } = await import("@/lib/aims/handoffs");
    expect(AIMS_HANDOFFS.length).toBe(4);
    for (const handoff of AIMS_HANDOFFS) {
      expect(handoff.mutation, `${handoff.id}: deja de declararse read-only`).toBe(
        "read-only route handoff",
      );
      expect(handoff.targetRoute).not.toContain("governance_module_events");
      expect(handoff.targetRoute).not.toContain("governance_module_links");
    }
  });
});

describe("la clasificación guiada se cuenta del dato, y el órgano sigue enlazado", () => {
  it("el Dashboard importa y monta la tarjeta de clasificación guiada", () => {
    const src = sinComentarios(read(DASHBOARD));
    expect(src).toContain("dashboard/ClasificacionGuiadaCard");
    expect(/<ClasificacionGuiadaCard\s/.test(src), "la tarjeta se importa pero no se monta").toBe(true);
  });

  it("la tarjeta lee los cuestionarios vigentes y etiqueta el perfil con la hoja", () => {
    const src = sinComentarios(read(`${DIR}/ClasificacionGuiadaCard.tsx`));
    expect(src).toContain("useCuestionariosVigentesDelTenant");
    expect(src).toContain("ETIQUETA_PERFIL");
    // El recuento se cruza con el inventario que la pantalla enseña, no con el
    // total de la tabla: un cuestionario de un sistema fuera de ámbito no
    // clasifica nada de lo que se está viendo.
    expect(/enInventario\.has\(/.test(src), "la tarjeta cuenta sin cruzar con el inventario").toBe(true);
  });

  it("la arista del órgano rector sobrevive a la descomposición", () => {
    // La página resuelve el órgano por tenant —`useBodyBySlug` filtra además
    // por `tenant_id`— y sólo monta el componente si la consulta devuelve fila.
    // El componente pinta el enlace. Las dos mitades se comprueban juntas: sin
    // esto, quitar el `<Link` dejaría un rótulo muerto y nadie lo notaría.
    const page = sinComentarios(read(DASHBOARD));
    expect(
      /useBodyBySlug\(\s*aiGovernanceBodySlug\(/.test(page),
      "el slug resuelto por tenant ya no alimenta la consulta del órgano",
    ).toBe(true);
    expect(/\{aiBody && <OrganoRector\s/.test(page), "el panel del órgano se monta sin condición").toBe(true);

    const comp = sinComentarios(read(`${DIR}/OrganoRector.tsx`));
    expect(/<Link\b/.test(comp), "OrganoRector ya no enlaza: sólo rotula").toBe(true);
    expect(/to=\{`\/organos\/\$\{slug\}`\}/.test(comp), "el enlace del órgano no apunta a su ficha").toBe(true);
  });
});
