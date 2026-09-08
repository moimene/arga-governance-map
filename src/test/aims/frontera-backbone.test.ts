// src/test/aims/frontera-backbone.test.ts
//
// La frontera del backbone `aims_*`, ejecutada y vigilada.
//
// De las 25 tablas del backbone, 6 tienen un camino de escritura desde una
// pantalla —destino (a)— y 20 no tienen ninguno: ni lector, ni escritor, ni
// fila en ninguno de los dos tenants. Esas 20 son destino (b): esquema muerto
// declarado. Un hook que vuelva a leerlas devuelve una lista vacía que la
// pantalla presenta como «no hay», que es exactamente la falsedad que se
// retiró (la pestaña del art. 27 llevaba meses pintando una ausencia como si
// fuera un hecho comprobado).
//
// Las dos direcciones importan y por eso se vigilan las dos: que ninguna
// superficie vuelva a (b), y que cada (a) SIGA teniendo su escritura. Sin lo
// segundo, vaciar los tres formularios nuevos dejaría el gate verde.
//
// Todo se mide sobre el fuente SIN COMENTARIOS: el comentario que explica una
// retirada nombra la tabla retirada, y sin esto el gate se dispararía contra su
// propia justificación — la salida fácil sería borrar la explicación.
import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { sinComentarios } from "@/test/helpers/sin-comentarios";

/** La misma superficie que barre `no-fabricated-claims`, más los `useAi*.ts`. */
function superficieAims(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = `${dir}/${e.name}`;
      if (e.isDirectory()) { if (e.name !== "__tests__") walk(full); }
      else if (/\.tsx?$/.test(e.name)) out.push(full);
    }
  };
  for (const d of ["src/pages/ai-governance", "src/components/ai-governance", "src/lib/aims"]) walk(d);
  for (const f of readdirSync("src/hooks")) if (/^useAi(ms)?[A-Z].*\.ts$/.test(f)) out.push(`src/hooks/${f}`);
  return out;
}

const HOOKS = superficieAims().filter((f) => f.startsWith("src/hooks/"));
const fuente = (f: string) => sinComentarios(readFileSync(f, "utf8"));
const lineas = (f: string) => readFileSync(f, "utf8").split("\n").length;

/** Las 20 tablas de destino (b), enumeradas: la lista es la decisión. */
const MUERTAS = [
  "aims_change_requests",
  "aims_component_inventory",
  "aims_control_catalog",
  "aims_control_tests",
  "aims_dataset_registry",
  "aims_evidence_packs",
  "aims_fria_affected_groups",
  "aims_fria_assessments",
  "aims_fria_dpia_cross_references",
  "aims_fria_fundamental_rights_risks",
  "aims_fria_process_map",
  "aims_fria_remediation_governance",
  "aims_fria_use_profile",
  "aims_incident_evidence_packs",
  "aims_incident_reports",
  "aims_model_registry",
  "aims_post_market_plans",
  "aims_regulatory_clocks",
  "aims_requirement_catalog",
  "aims_requirement_checks",
];

/** Las 6 de destino (a): cada una tiene que conservar su camino de escritura. */
const VIVAS = [
  "aims_evidence_items",
  "aims_classification_questionnaires",
  "aims_technical_file_sections",
  "aims_system_versions",
  "aims_monitoring_indicators",
  "aims_incident_regimes",
];

const FICHA = "src/pages/ai-governance/SistemaDetalle.tsx";
const HOOK_EXPEDIENTE = "src/hooks/useAimsTechnicalFile.ts";
const DIR_SISTEMA = "src/components/ai-governance/sistema";

describe("frontera del backbone — control positivo del barrido", () => {
  it("ve la superficie que dice barrer", () => {
    const ficheros = superficieAims();
    expect(ficheros.length, "el barrido de la superficie AIMS se ha quedado corto")
      .toBeGreaterThanOrEqual(30);
    expect(ficheros, "el barrido no incluye la ficha del sistema").toContain(FICHA);
    expect(HOOKS, "el barrido no incluye el hook del expediente técnico").toContain(HOOK_EXPEDIENTE);
  });
});

describe("frontera del backbone — destino (b): ninguna superficie las toca", () => {
  it("ninguna fuente lee ni escribe una de las 20 tablas muertas", () => {
    const encontradas: string[] = [];
    for (const f of superficieAims()) {
      const src = fuente(f);
      for (const t of MUERTAS) if (src.includes(`from("${t}")`)) encontradas.push(`${f} → ${t}`);
    }
    expect(encontradas, "una superficie AIMS vuelve a una tabla de esquema muerto").toEqual([]);
  });

  it("nadie llama a la RPC de cierre del expediente", () => {
    // El cierre no existe como capacidad: la custodia sólo admite registros
    // abiertos y sin firmar. Ofrecerlo era ofrecer lo que el servidor deniega.
    const llamantes = superficieAims().filter((f) =>
      fuente(f).includes('rpc("fn_aims_close_technical_file"'),
    );
    expect(llamantes, "vuelve a ofrecerse el cierre del expediente técnico").toEqual([]);
  });

  it("el hook de la FRIA no existe y la ficha no la nombra", () => {
    expect(existsSync("src/hooks/useAimsFria.ts"), "useAimsFria.ts ha vuelto").toBe(false);
    const ficha = fuente(FICHA);
    expect(ficha.includes("FRIA"), "la ficha vuelve a pintar la pestaña de la FRIA").toBe(false);
    expect(
      ficha.includes("Modelos & Datasets"),
      "la ficha vuelve a pintar la pestaña de modelos y datasets",
    ).toBe(false);
  });
});

describe("frontera del backbone — destino (a): cada tabla conserva su escritura", () => {
  it("las seis tablas vivas tienen un hook que escribe en ellas", () => {
    const sinEscritura: string[] = [];
    for (const t of VIVAS) {
      const escribe = HOOKS.some((f) =>
        new RegExp(`from\\("${t}"\\)[\\s\\S]{0,400}?\\.(insert|update)\\(`).test(fuente(f)),
      );
      if (!escribe) sinEscritura.push(t);
    }
    expect(
      sinEscritura,
      "tabla de destino (a) sin camino de escritura: o se cablea, o pasa a esquema muerto",
    ).toEqual([]);
  });
});

describe("frontera del backbone — las escrituras nuevas llevan el tenant", () => {
  it("toda alta del expediente escribe el tenant del contexto", () => {
    const src = fuente(HOOK_EXPEDIENTE);
    const altas = (src.match(/\.insert\(/g) ?? []).length;
    expect(altas, "el hook del expediente ya no da de alta nada: revisa este invariante").toBeGreaterThan(0);
    expect(
      (src.match(/\.insert\([\s\S]{0,200}?tenant_id: tenantId!/g) ?? []).length,
      `${altas} altas y menos payloads con tenant_id del contexto`,
    ).toBeGreaterThanOrEqual(altas);
  });

  it("la actualización de una sección va acotada por tenant y comprueba que vuelve fila", () => {
    // La RLS filtra un UPDATE ajeno a CERO FILAS SIN ERROR: sin la
    // comprobación, una edición que no se guardó se anuncia como guardada.
    const src = fuente(HOOK_EXPEDIENTE);
    const updates = (src.match(/\.update\(/g) ?? []).length;
    expect(updates, "el hook del expediente ya no actualiza nada").toBeGreaterThan(0);
    expect(
      (src.match(/\.update\([\s\S]{0,200}?\.eq\("tenant_id", tenantId!\)/g) ?? []).length,
      `${updates} actualizaciones y menos acotaciones por tenant pegadas a ellas`,
    ).toBeGreaterThanOrEqual(updates);
    expect(
      (src.match(/\.update\([\s\S]{0,400}?if \(!data\)/g) ?? []).length,
      `${updates} actualizaciones y menos comprobaciones de que volvió fila`,
    ).toBeGreaterThanOrEqual(updates);
  });
});

describe("frontera del backbone — la ficha cabe", () => {
  it("la página y sus bloques se quedan en 400 líneas", () => {
    const ficheros = [FICHA, ...readdirSync(DIR_SISTEMA).map((f) => `${DIR_SISTEMA}/${f}`)];
    expect(ficheros.length, "el barrido de los bloques de la ficha no encuentra nada").toBeGreaterThan(4);
    expect(
      ficheros.filter((f) => lineas(f) > 400).map((f) => `${f} (${lineas(f)})`),
      "un fichero de la ficha del sistema pasa de 400 líneas",
    ).toEqual([]);
  });
});
