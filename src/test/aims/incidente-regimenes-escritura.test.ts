import { describe, it, expect } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { sinComentarios } from "../helpers/sin-comentarios";

/**
 * `aims_incident_regimes` tiene camino de escritura (2026-09-08).
 *
 * Hasta hoy la tabla no tenía ni un `.insert(` en `src/`: la ficha enumeraba
 * tres regímenes de referencia y declaraba en prosa que «la apertura no está
 * disponible desde esta consola». Ahora se abre, y eso mueve el riesgo de sitio:
 * ya no es «se afirma un registro que no existe» sino «se afirma un EFECTO que
 * la escritura no produce». Abrir un subexpediente registra que, a juicio de
 * quien lo abre, el régimen alcanza al caso. No notifica a nadie.
 *
 * Este gate vigila tres cosas y ninguna es un rótulo:
 *  (a) el CAMINO — insert con `tenant_id` explícito, pertenencia comprobada
 *      antes y resultado comprobado después;
 *  (b) el ORDEN — el éxito se anuncia DESPUÉS de que la escritura resuelva;
 *  (c) la POSTURA — ninguna superficie AIMS afirma envío, notificación a la
 *      autoridad o acuse de recibo, ni conserva el aviso ya falso.
 */
const HOOK = "src/hooks/useAimsMultiregime.ts";
const PANEL = "src/components/ai-governance/incidente/SubexpedientesRegimen.tsx";
const PAGINAS = [
  "src/pages/ai-governance/EvaluacionDetalle.tsx",
  "src/pages/ai-governance/IncidenteDetalle.tsx",
  "src/pages/ai-governance/IncidenteNuevo.tsx",
];

const leer = (f: string) => readFileSync(f, "utf8");
/** Se juzga lo que se ejecuta, no la prosa que lo explica. */
const codigo = (f: string) => sinComentarios(leer(f));

/** Toda la superficie de AI Governance, descubierta, no enumerada. */
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
  for (const f of readdirSync("src/hooks")) if (/^useAims.*\.ts$/.test(f)) out.push(`src/hooks/${f}`);
  return out;
}

/**
 * Componentes de la ficha de incidente y del informe de evaluación. Se
 * descubren: si mañana se extrae uno más, entra solo en el gate de tamaño.
 */
function componentesDescompuestos(): string[] {
  const out: string[] = [];
  for (const dir of [
    "src/components/ai-governance/incidente",
    "src/components/ai-governance/evaluacion-detalle",
  ]) {
    for (const f of readdirSync(dir)) if (f.endsWith(".tsx")) out.push(`${dir}/${f}`);
  }
  return out;
}

describe("control positivo del instrumento", () => {
  it("los ficheros que este gate juzga existen y tienen contenido", () => {
    // Casi todo lo de abajo es una aserción sobre un fuente concreto: un
    // fichero movido o vacío las pondría verdes sin mirar nada.
    for (const f of [HOOK, PANEL, ...PAGINAS]) {
      expect(existsSync(f), `${f} no existe`).toBe(true);
    }
    expect(leer(HOOK).split("\n").length, "el hook multirrégimen se ha quedado en nada")
      .toBeGreaterThan(80);
    expect(componentesDescompuestos().length, "no se encuentran los componentes extraídos")
      .toBeGreaterThanOrEqual(8);
    expect(superficieAims().length, "el barrido de la superficie AIMS se ha quedado corto")
      .toBeGreaterThanOrEqual(19);
  });
});

describe("el camino de escritura de aims_incident_regimes", () => {
  it("la apertura inserta con tenant_id explícito", () => {
    // La tabla NO tiene default de tenant, y varias del proyecto defaultean a
    // ARGA: un insert que lo omita aterriza en el tenant equivocado.
    const src = codigo(HOOK);
    expect(
      /from\("aims_incident_regimes"\)[\s\S]{0,400}?\.insert\(\{[\s\S]{0,400}?tenant_id: tenantId\b/.test(src),
      "el insert de subexpedientes no escribe tenant_id explícito",
    ).toBe(true);
  });

  it("comprueba que el incidente es del tenant ANTES de escribir", () => {
    // `incident_id` llega de la URL: sin esta comprobación se podría colgar un
    // subexpediente del incidente de otro tenant.
    const src = codigo(HOOK);
    const iPrueba = src.search(/from\("ai_incidents"\)[\s\S]{0,300}?\.eq\("tenant_id", tenantId!?\)/);
    const iInsert = src.search(/from\("aims_incident_regimes"\)[\s\S]{0,400}?\.insert\(/);
    expect(iPrueba, "no se prueba la pertenencia del incidente al tenant").toBeGreaterThan(-1);
    expect(iInsert, "no hay insert de subexpediente").toBeGreaterThan(-1);
    expect(iInsert, "la pertenencia se comprueba después de escribir").toBeGreaterThan(iPrueba);
  });

  it("una escritura que no devuelve fila no se da por buena", () => {
    // La RLS filtra a cero filas SIN error: sin esto, un guardado que no
    // ocurrió se anunciaría como hecho.
    const src = codigo(HOOK);
    expect((src.match(/if \(!data\) throw/g) ?? []).length,
      "alguna escritura del hook no comprueba que vuelva fila").toBeGreaterThanOrEqual(2);
  });

  it("el cierre sigue acotado al tenant en la misma cadena del update", () => {
    // El literal suelto en el fichero no vale: se exige PEGADO al `.update(`,
    // porque la consulta de lectura ya trae su propio filtro y satisfaría
    // cualquier recuento sin que la mutación llevara ninguno.
    const src = codigo(HOOK);
    expect(
      /\.update\(\{[\s\S]{0,300}?\}\)\s*\n\s*\.eq\("tenant_id", tenantId!?\)/.test(src),
      "el update de subexpedientes no lleva el filtro por tenant pegado a la mutación",
    ).toBe(true);
  });
});

describe("el panel llama al camino nuevo y anuncia el éxito después", () => {
  it("importa y llama el hook de apertura", () => {
    const src = codigo(PANEL);
    expect(/useAbrirSubexpedienteRegimen\b/.test(src), "el panel no importa el hook de apertura").toBe(true);
    expect(/useAbrirSubexpedienteRegimen\(/.test(src), "importa el hook de apertura y no lo llama").toBe(true);
  });

  it("el toast de apertura llega DESPUÉS de que la escritura resuelva", () => {
    // Mover el `toast.success` antes del `await` deja el panel afirmando el
    // éxito sin conocer el resultado: es el mismo defecto que ya se corrigió
    // en el cierre, y se comprueba igual, por orden.
    const src = codigo(PANEL);
    const fn = src.slice(src.indexOf("handleAbrirSubexpediente = async"));
    const cuerpo = fn.slice(0, fn.indexOf("\n  };"));
    expect(cuerpo.length, "no se encuentra el manejador de apertura").toBeGreaterThan(0);
    expect(/await[^;]*mutateAsync[\s\S]{0,400}toast\.success/.test(cuerpo),
      "la apertura anuncia el éxito antes de escribir").toBe(true);
  });

  it("la motivación de aplicabilidad se exige en cliente y en el hook", () => {
    // Abrir es afirmar que el régimen alcanza al caso. Sin motivo, la fila
    // sería una afirmación sin autor ni razón.
    expect(/applicabilityRationale/.test(codigo(HOOK)), "el hook no recibe la motivación").toBe(true);
    expect(/length < 20/.test(codigo(HOOK)), "el hook acepta una motivación vacía").toBe(true);
    expect(/MOTIVACION_MINIMA/.test(codigo(PANEL)), "el panel no exige mínimo de motivación").toBe(true);
  });
});

describe("la postura: se registra una afirmación, no se notifica a nadie", () => {
  it("ninguna superficie AIMS conserva el aviso ya falso de que no se puede abrir", () => {
    // Se juzga el fuente ENTERO, comentarios incluidos: la prosa que explicaba
    // la limitación engaña a quien lea el fichero aunque no se renderice.
    for (const f of superficieAims()) {
      const src = leer(f);
      expect(/apertura no está disponible/.test(src),
        `${f} conserva el aviso de que la apertura no está disponible`).toBe(false);
      expect(/un solo camino de escritura/.test(src),
        `${f} sigue diciendo que la tabla no tiene camino de escritura`).toBe(false);
    }
  });

  it("nadie afirma haber notificado a la autoridad ni acusado recibo", () => {
    for (const f of superficieAims()) {
      const src = codigo(f);
      expect(/notificad[oa]s?\s+(?:a\s+)?(?:la\s+)?autoridad/i.test(src),
        `${f} afirma haber notificado a la autoridad`).toBe(false);
      // «acuse de recibo» sólo cabe negado.
      for (const m of [...src.matchAll(/acuse de recibo/gi)]) {
        const antes = src.slice(Math.max(0, m.index! - 120), m.index!);
        expect(/\bno\b|\bni\b/i.test(antes),
          `${f}: «acuse de recibo» sin negación delante → …${antes.slice(-60)}`).toBe(true);
      }
    }
  });

  it("cada mención de notificar a la autoridad en el panel va negada", () => {
    // El panel es la única superficie que habla de la autoridad al escribir:
    // aquí la afirmación positiva sería el daño.
    const src = codigo(PANEL);
    const menciones = [...src.matchAll(/notifica\w*\s+a\s+(?:la\s+|ninguna\s+)*autoridad/gi)];
    expect(menciones.length, "el panel ya no dice nada sobre notificar a la autoridad")
      .toBeGreaterThan(0);
    for (const m of menciones) {
      const antes = src.slice(0, m.index!);
      const frase = antes.slice(antes.lastIndexOf("."), antes.length);
      expect(/\bNo\b/.test(frase),
        `el panel afirma notificación a la autoridad → …${frase.slice(-80)}${m[0]}`).toBe(true);
    }
  });
});

describe("las pantallas descompuestas caben en 400 líneas", () => {
  it("ninguna página ni componente de estas dos fichas supera el límite", () => {
    for (const f of [...PAGINAS, ...componentesDescompuestos()]) {
      const lineas = leer(f).split("\n").length;
      expect(lineas, `${f} tiene ${lineas} líneas`).toBeLessThanOrEqual(400);
    }
  });
});
