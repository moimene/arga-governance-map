import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import {
  LEGADO_A_VIGENTE,
  ROTULO_LEGADO,
  evaluacionAcredita,
  rotuloEvaluacion,
  rotuloSeccion,
  seccionAcredita,
  sistemasCubiertos,
  traducirLegado,
} from "../legado";
import { MONITOR_DE_CODIGO } from "../mapa-monitores";
import { buildAimsReadiness } from "../readiness";
import { sinComentarios } from "@/test/helpers/sin-comentarios";

/**
 * F1.T4 (GC-47, GC-55, GC-57) — sólo acredita lo congelado y revisado; de cada
 * sistema y marco manda la evaluación más reciente no borrador; el legado se
 * lee por regla (0 UPDATE sobre las filas de ARGA ni de Garrigues).
 */

const congeladaYRevisada = { frozen_at: "2026-09-18T10:00:00Z", reviewed_at: "2026-09-18T11:00:00Z" };

describe("acredita sólo lo congelado y revisado", () => {
  it("CONFORME sin congelar no acredita; congelada sin revisar, tampoco", () => {
    expect(evaluacionAcredita({ status: "CONFORME" })).toBe(false);
    expect(evaluacionAcredita({ status: "CONFORME", frozen_at: "2026-09-18" })).toBe(false);
  });

  it("control positivo: CONFORME congelada y revisada sí acredita; CON_GAPS congelada y revisada, no", () => {
    expect(evaluacionAcredita({ status: "CONFORME", ...congeladaYRevisada })).toBe(true);
    expect(evaluacionAcredita({ status: "Conforme", ...congeladaYRevisada })).toBe(true);
    expect(evaluacionAcredita({ status: "CON_GAPS", ...congeladaYRevisada })).toBe(false);
  });

  it("ARGA Score (APROBADO 72, sin congelar) deja de figurar como cubierto", () => {
    // Fila de ARGA leída en Cloud el 2026-09-19.
    const argaScore = { id: "3b160895", system_id: "1148370a", framework: "EU_AI_ACT", status: "APROBADO", score: 72, created_at: "2026-04-18T15:44:31Z", findings: [{ code: "ART_9", status: "CONFORME" }] };
    const r = buildAimsReadiness({ systems: [{ id: "1148370a", status: "ACTIVO", risk_level: "Alto" }], assessments: [argaScore], incidents: [] });
    expect(r.domains.find((d) => d.id === "ai-act-assessments")).toMatchObject({ metric: "0/1 alto riesgo", status: "gap" });
    // Control positivo: la misma fila congelada y revisada, sí.
    const firme = buildAimsReadiness({ systems: [{ id: "1148370a", status: "ACTIVO", risk_level: "Alto" }], assessments: [{ ...argaScore, ...congeladaYRevisada }], incidents: [] });
    expect(firme.domains.find((d) => d.id === "ai-act-assessments")?.metric).toBe("1/1 alto riesgo");
  });
});

describe("manda la más reciente no borrador", () => {
  const vieja = { id: "v", system_id: "s1", framework: "EU_AI_ACT", status: "CONFORME", created_at: "2026-09-01T10:00:00Z", ...congeladaYRevisada };

  it("una evaluación posterior con brechas desplaza a la acreditada anterior", () => {
    const nueva = { id: "n", system_id: "s1", framework: "EU_AI_ACT", status: "CON_GAPS", created_at: "2026-09-10T10:00:00Z" };
    expect(sistemasCubiertos([vieja, nueva]).has("s1")).toBe(false);
  });

  it("un borrador posterior NO desplaza a la acreditada anterior", () => {
    const borrador = { id: "b", system_id: "s1", framework: "EU_AI_ACT", status: "BORRADOR", created_at: "2026-09-10T10:00:00Z" };
    expect(sistemasCubiertos([vieja, borrador]).has("s1")).toBe(true);
  });
});

describe("«Controles» no llega a Listo con hallazgos de evaluaciones que no acreditan", () => {
  const cerrados = [{ code: "MG_RISK_01", status: "L5", evidenceCount: 1 }, { code: "MG_RISK_02", status: "L5", evidenceCount: 2 }];
  const sistema = [{ id: "s1", status: "ACTIVO" }];

  it("todo cerrado pero sin congelar ni revisar: vigilancia, y lo dice", () => {
    const r = buildAimsReadiness({ systems: sistema, assessments: [{ id: "a", system_id: "s1", status: "CONFORME", findings: cerrados }], incidents: [] });
    expect(r.domains.find((d) => d.id === "controls")).toMatchObject({ status: "watch", metric: "2/2 cerrados · 2 sin congelar y revisar" });
  });

  it("control positivo: la misma evaluación congelada y revisada sí llega a Listo", () => {
    const r = buildAimsReadiness({ systems: sistema, assessments: [{ id: "a", system_id: "s1", status: "CONFORME", findings: cerrados, ...congeladaYRevisada }], incidents: [] });
    expect(r.domains.find((d) => d.id === "controls")).toMatchObject({ status: "ready", metric: "2/2 cerrados" });
  });
});

describe("rótulos: el legado se dice, no se reescribe", () => {
  it("las cuatro APROBADO del Motor de triaje y ARGA Score: «legado demo, no acredita»", () => {
    const triaje = { status: "APROBADO", findings: [{ code: "VAL-01", status: "CONFORME" }] };
    expect(rotuloEvaluacion(triaje)).toBe(ROTULO_LEGADO);
    expect(ROTULO_LEGADO).toBe("Legado demo, no acredita");
  });

  it("Harvey: niveles L sin recuento de evidencia son anteriores al control del 2026-09-07 — legado", () => {
    const harvey = { status: "CON_GAPS", findings: [{ code: "MG_QUAL_01", status: "L5" }, { code: "MG_QUAL_02", status: "L2" }] };
    expect(rotuloEvaluacion(harvey)).toBe(ROTULO_LEGADO);
  });

  it("control positivo: una evaluación del producto actual sin congelar no es legado, pero tampoco acredita", () => {
    const actual = { status: "CONFORME", findings: [{ code: "MG_QUAL_01", status: "L5", evidenceCount: 1 }] };
    expect(rotuloEvaluacion(actual)).toBe("Sin congelar ni revisar, no acredita");
    expect(rotuloEvaluacion({ ...actual, frozen_at: "2026-09-18" })).toBe("Congelada, pendiente de revisión: no acredita");
    expect(rotuloEvaluacion({ ...actual, ...congeladaYRevisada })).toBeNull();
  });

  it("secciones AIV «Conforme» sin revisor (ARGA): «legado demo, no acredita»; con revisor, acreditan", () => {
    const aiv03 = { section_code: "AIV-03", status: "Conforme", reviewed_by_id: null, reviewed_at: "2026-04-24T00:00:00Z" };
    expect(seccionAcredita(aiv03)).toBe(false);
    expect(rotuloSeccion(aiv03)).toBe(ROTULO_LEGADO);
    expect(seccionAcredita({ ...aiv03, reviewed_by_id: "p-1" })).toBe(true);
    expect(rotuloSeccion({ ...aiv03, reviewed_by_id: "p-1" })).toBeNull();
    // Una pendiente no afirma nada: no lleva rótulo.
    expect(rotuloSeccion({ section_code: "AIV-01", status: "Pendiente", reviewed_by_id: null })).toBeNull();
  });
});

describe("LEGADO_A_VIGENTE — códigos de legado leídos como vigentes, sólo lectura", () => {
  // Los 22 códigos distintos de `ai_compliance_checks` de los dos tenants que no
  // son del catálogo, medidos en Cloud el 2026-09-19 (49 filas de ARGA).
  const MEDIDOS = [
    "AIA-09", "AIA-10", "AIA-11", "AIA-13", "AIA-14",
    "EU_AI_ACT_ART_9", "EU_AI_ACT_ART_10", "EU_AI_ACT_ART_13",
    "ISO-05", "ISO-06", "ISO-07", "ISO-08", "ISO-09", "ISO-10", "ISO42001_6.1",
    "VAL-01", "VAL-02", "VAL-03", "VAL-04", "VAL-05", "VAL-06", "VAL-07",
  ];

  it("cubre exactamente los códigos de legado medidos, y ninguno es del catálogo vigente", () => {
    expect(Object.keys(LEGADO_A_VIGENTE).sort()).toEqual([...MEDIDOS].sort());
    for (const code of MEDIDOS) expect(code in MONITOR_DE_CODIGO, code).toBe(false);
  });

  it("todo destino es un código del catálogo vigente (o `null`, sin equivalente declarado)", () => {
    for (const [code, vigente] of Object.entries(LEGADO_A_VIGENTE)) {
      if (vigente !== null) expect(vigente in MONITOR_DE_CODIGO, `${code} → ${vigente}`).toBe(true);
    }
    expect(Object.values(LEGADO_A_VIGENTE).filter((v) => v === null).length).toBe(3);
  });

  it("traducir no pisa la fila: devuelve una copia y conserva el código original", () => {
    const fila = { id: "c", requirement_code: "AIA-09", status: "Conforme" };
    const t = traducirLegado(fila);
    expect(t).toMatchObject({ requirement_code: "RISK_MGMT", codigo_legado: "AIA-09" });
    expect(fila.requirement_code).toBe("AIA-09");
    // Un código vigente pasa tal cual.
    expect(traducirLegado({ id: "d", requirement_code: "RISK_MGMT" })).toEqual({ id: "d", requirement_code: "RISK_MGMT" });
  });

  it("en el monitor, el legado se cuenta pero no acredita: nunca Listo por comprobaciones de legado", () => {
    const sistema = "1148370a";
    const r = buildAimsReadiness({
      systems: [{ id: sistema, status: "ACTIVO", risk_level: "Alto" }],
      assessments: [],
      incidents: [],
      complianceChecks: [
        { id: "a", system_id: sistema, requirement_code: "EU_AI_ACT_ART_9", status: "CONFORME", created_at: "2026-04-18T15:00:00Z" },
        { id: "b", system_id: sistema, requirement_code: "AIA-09", status: "Conforme", created_at: "2026-04-19T15:00:00Z" },
      ],
    });
    const alto = r.complianceMonitors.find((m) => m.id === "high-risk-obligations")!;
    expect(alto.source).toBe("ai_compliance_checks");
    expect(alto.status).not.toBe("ready");
    // Las dos filas son el mismo requisito (art. 9): manda la más reciente.
    expect(alto.metric).toBe("0/1 conformes · 1 de legado, no acredita");
  });
});

describe("G-ARISTA — readiness, informe y Dashboard importan `legado.ts` y no lo reimplementan", () => {
  const SUPERFICIES = [
    "src/lib/aims/readiness.ts",
    "src/pages/ai-governance/Dashboard.tsx",
    "src/components/ai-governance/evaluacion-detalle/CabeceraInforme.tsx",
    "src/pages/ai-governance/Evaluaciones.tsx",
    "src/components/ai-governance/sistema/TabEvaluaciones.tsx",
  ];

  it("cada superficie importa la hoja y llama a su criterio", () => {
    for (const f of SUPERFICIES) {
      const src = sinComentarios(readFileSync(f, "utf8"));
      expect(src, `${f} no importa legado`).toMatch(/from "(\.\/|@\/lib\/aims\/)legado"/);
      expect(/\b(evaluacionAcredita|sistemasCubiertos|rotuloEvaluacion|seccionAcredita|traducirLegado)\(/.test(src), `${f} importa y no llama`).toBe(true);
    }
  });

  it("ninguna superficie decide la acreditación por el estado a secas", () => {
    // Control positivo del detector sobre el patrón retirado.
    const detector = /assessmentAcreditaConformidad\(\s*\w+\.status\s*\)/;
    expect(detector.test("assessments.filter((a) => assessmentAcreditaConformidad(a.status))")).toBe(true);
    for (const f of SUPERFICIES) {
      expect(detector.test(sinComentarios(readFileSync(f, "utf8"))), f).toBe(false);
    }
  });

  it("la hoja no importa nada que pueda cerrar un ciclo", () => {
    const src = sinComentarios(readFileSync("src/lib/aims/legado.ts", "utf8"));
    const imports = [...src.matchAll(/^\s*import\s.+from\s+"([^"]+)"/gm)].map((m) => m[1]);
    expect(imports.every((i) => ["./vocabulario", "./checks-vigentes", "./expediente-tecnico"].includes(i)), imports.join(", ")).toBe(true);
  });
});
