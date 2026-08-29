import { describe, expect, it } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { buildAimsReadiness, buildAimsComplianceMonitors, filterSystemsByScope } from "../readiness";
import { scopes } from "@/data/scopes";

/**
 * A5 — Dos defectos de la misma familia.
 *
 * 1. `filterSystemsByScope` filtraba el inventario por vocabulario asegurador
 *    (`auto`, `siniestros`, `salud`, `fraude`, `motor`, `suscripción`,
 *    `patrimonial`). Hoy no muerde porque `branding.scopes` es NULL en los dos
 *    tenants y el único ámbito acaba en "(Global)", que cae en el passthrough:
 *    es una MINA LATENTE que se arma el día que alguien siembre un ámbito
 *    llamado "España".
 * 2. Cero datos se presentaba como conformidad: sin un solo incidente
 *    registrado, el dominio decía "Listo".
 */
const VACIO = { systems: [], assessments: [], incidents: [] };

describe("A5 — el ámbito no se adivina del nombre del sistema", () => {
  const DESPACHO = [
    { name: "Harvey", description: "asistencia jurídica documental" },
    { name: "Copilot", description: "ofimática corporativa" },
    { name: "Garrigues GA_IA", description: "plataforma interna" },
  ];

  it("NINGÚN ámbito reduce el inventario — invariante, no lista de casos", () => {
    // El test anterior enumeraba seis cadenas y dejaba fuera "Turquía",
    // "Asia-Pacífico" y "EE.UU.", que son ámbitos REALES de ARGA
    // (`src/data/scopes.ts`): reintroducir el filtro sólo para ésos lo dejaba
    // verde. Se asierta la propiedad sobre todos los ámbitos del producto y
    // sobre entradas arbitrarias.
    const arbitrarios = ["", "  ", "España ", "espana", "Zzz", "(Global)", "Ámbito inventado"];
    for (const scope of [...scopes, ...arbitrarios]) {
      expect(
        filterSystemsByScope(DESPACHO, scope),
        `el ámbito ${JSON.stringify(scope)} recorta el inventario`,
      ).toHaveLength(DESPACHO.length);
    }
  });

  it("un inventario asegurador tampoco se recorta por palabras", () => {
    const aseguradora = [
      { name: "Motor de triaje de siniestros auto", description: "Siniestros Auto" },
      { name: "Asistente de suscripción patrimonial", description: "Suscripción Empresas" },
    ];
    expect(filterSystemsByScope(aseguradora, "España")).toHaveLength(2);
    expect(filterSystemsByScope(aseguradora, "LATAM")).toHaveLength(2);
  });

  it("el ámbito global sigue devolviendo todo", () => {
    expect(filterSystemsByScope(DESPACHO, "Grupo (Global)")).toHaveLength(3);
  });
});

describe("A5 — cero datos no es conformidad", () => {
  it("sin un solo incidente registrado, el dominio no dice Listo", () => {
    const d = buildAimsReadiness(VACIO).domains.find((x) => x.id === "incidents");
    expect(d?.status).not.toBe("ready");
    expect(d?.metric).toMatch(/sin (datos|incidentes)/i);
  });

  it("con incidentes registrados y ninguno abierto, sí dice Listo", () => {
    const d = buildAimsReadiness({
      ...VACIO,
      incidents: [{ id: "i1", system_id: "s1", status: "CERRADO", severity: "MEDIO" }],
    }).domains.find((x) => x.id === "incidents");
    expect(d?.status).toBe("ready");
  });

  it("ningún dominio se declara Listo con el inventario vacío", () => {
    const listos = buildAimsReadiness(VACIO).domains.filter((d) => d.status === "ready");
    expect(listos.map((d) => d.id), "hay dominios en Listo sin un solo dato").toEqual([]);
  });

  it("ningún monitor se declara Listo con el inventario vacío", () => {
    const listos = buildAimsComplianceMonitors(VACIO).filter((m) => m.status === "ready");
    expect(listos.map((m) => m.id), "hay monitores en Listo sin un solo dato").toEqual([]);
  });

  it("con dato suficiente, los dominios SÍ alcanzan Listo", () => {
    // Contrapartida positiva: sin ella, poner "watch" a todo dejaba el gate
    // verde y mataba la señal entera.
    const conDato = buildAimsReadiness({
      systems: [{ id: "s1", status: "ACTIVO", risk_level: "Alto" }],
      assessments: [
        { id: "a1", system_id: "s1", status: "APROBADO", findings: [{ code: "F1", status: "CERRADO" }] },
      ],
      incidents: [
        {
          id: "i1", system_id: "s1", status: "CERRADO", severity: "MEDIO",
          root_cause: "causa", corrective_action: "acción",
        },
      ],
    });
    expect(
      conDato.domains.filter((d) => d.status === "ready").map((d) => d.id).length,
      "ningún dominio alcanza Listo ni con dato completo: la señal está muerta",
    ).toBeGreaterThan(0);
  });

  it("no se declara operable sobre dominios sin dato", () => {
    // `standaloneReady` trataba "watch" como aprobado, y "watch" es justo el
    // marcador de "no tengo dato": cuatro dominios diciéndolo se compactaban
    // en un tick verde de "Demo operable".
    expect(buildAimsReadiness(VACIO).standaloneReady).toBe(false);
  });

  it("ninguna métrica concluye sobre una población vacía", () => {
    // Se arregló el `status` y se dejó la `metric`: "0 materiales" con cero
    // incidentes es el mismo defecto un campo más allá — afirma haber mirado.
    //
    // Contar la POBLACIÓN sí es honesto: "0 sistemas" es el tamaño del
    // inventario, no una conclusión sobre él, y su dominio va en gap.
    const CONCLUSIONES = /^0 (materiales|inaceptables|abiertos|gaps|cerrados)/;
    for (const m of buildAimsComplianceMonitors(VACIO)) {
      expect(m.metric, `${m.id} concluye sobre cero registros: ${m.metric}`).not.toMatch(CONCLUSIONES);
    }
    for (const d of buildAimsReadiness(VACIO).domains) {
      expect(d.metric, `${d.id} concluye sobre cero registros: ${d.metric}`).not.toMatch(CONCLUSIONES);
    }
  });

  it("el dominio de migración no afirma un estado que no mide", () => {
    const d = buildAimsReadiness(VACIO).domains.find((x) => x.id === "migration");
    expect(d?.metric).not.toBe("Sin schema nuevo");
  });
});

describe("A5 — ningún estado vacío afirma que todo va bien", () => {
  /** Criterio transversal del programa: un estado vacío no acredita nada. */
  function superficie(): string[] {
    const out: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const full = `${dir}/${e.name}`;
        if (e.isDirectory()) { if (e.name !== "__tests__") walk(full); }
        else if (/\.tsx?$/.test(e.name)) out.push(full);
      }
    };
    for (const d of ["src/pages/ai-governance", "src/components/ai-governance", "src/lib/aims"]) walk(d);
    return out;
  }

  it.each([
    [/operando sin incidencias/i, "afirma operación sin incidencias con cero registros"],
    [/todo (correcto|en orden|conforme)/i, "afirma que todo está bien"],
    [/no hay (problemas|riesgos|brechas)/i, "afirma ausencia de problemas"],
    [/sin riesgos (detectados|identificados)/i, "afirma ausencia de riesgos"],
  ])("ninguna superficie %s", (re, motivo) => {
    for (const f of superficie()) {
      expect(re.test(readFileSync(f, "utf8")), `${f}: ${motivo}`).toBe(false);
    }
  });
});
