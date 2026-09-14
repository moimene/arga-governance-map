import { describe, it, expect } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { sinComentarios } from "../helpers/sin-comentarios";
import { mensajeUsuario } from "@/lib/aims/errores-rpc";
import { etiqueta, chipClaseEstadoEvaluacion } from "@/lib/aims/vocabulario";

/**
 * Carril B (2026-09-14) — wizard e informe de la evaluación.
 *
 * Gates de ARISTA sobre el fuente sin comentarios: que la pantalla importe y
 * llame la hoja, no que pinte un rótulo. Cada bloque lleva su control
 * positivo para que un fichero vacío o renombrado no lo ponga verde.
 */
const WIZARD = "src/pages/ai-governance/EvaluacionNueva.tsx";
const DETALLE = "src/pages/ai-governance/EvaluacionDetalle.tsx";
const HOOK = "src/hooks/useAiAssessments.ts";
const CABECERA = "src/components/ai-governance/evaluacion-detalle/CabeceraInforme.tsx";
const CONTROLES = "src/components/ai-governance/evaluacion/ControlesDeMedida.tsx";
const EVIDENCIA = "src/components/ai-governance/EvidenciaDeMedida.tsx";
const PARAMETROS = "src/components/ai-governance/evaluacion/PasoParametros.tsx";
const CHECKLIST = "src/components/ai-governance/evaluacion-detalle/ChecklistMedidas.tsx";
const PERIMETRO = [WIZARD, DETALLE, CABECERA, CONTROLES, EVIDENCIA, PARAMETROS, CHECKLIST];

const read = (f: string) => sinComentarios(readFileSync(f, "utf8"));

describe("control positivo del instrumento", () => {
  it("los ficheros medidos existen", () => {
    for (const f of [...PERIMETRO, HOOK]) expect(existsSync(f), `${f} no existe`).toBe(true);
  });
});

describe("B1 — cambiar de sistema o de marco no reescribe el borrador del par anterior", () => {
  it("el UPDATE del borrador va acotado por id, sistema Y marco, y exige fila de vuelta", () => {
    const src = read(HOOK);
    const update = src.slice(src.indexOf(".update(payload)"), src.indexOf(".maybeSingle()", src.indexOf(".update(payload)")));
    // Control positivo: el tramo existe y ya llevaba las dos condiciones previas.
    expect(update.length, "no se encuentra el UPDATE del borrador").toBeGreaterThan(0);
    expect(update).toContain('.eq("id", id)');
    expect(update).toContain('.eq("system_id", systemId)');
    expect(update, "un cambio de marco con draftId vivo pisaría el borrador del otro marco").toContain(
      '.eq("framework", payload.framework)',
    );
    // Y la RLS filtra a cero filas SIN error: se sigue comprobando que vuelve fila.
    expect(src.slice(src.indexOf(".maybeSingle()"))).toMatch(/if \(!data\) \{\s*throw new Error/);
  });

  it("una respuesta de autoguardado en vuelo de otro par no reinstala su draftId", () => {
    const src = read(WIZARD);
    const callback = src.slice(src.indexOf("await guardarRef.current("), src.indexOf("setDraftId(guardada.id)"));
    expect(callback.length, "no se encuentra el callback del autoguardado").toBeGreaterThan(0);
    expect(callback, "tras el await hay que comparar el par capturado con el vigente antes de setDraftId").toContain(
      "if (parRef.current.systemId !== systemId || parRef.current.framework !== framework) return;",
    );
    expect(src).toContain("parRef.current = { systemId, framework };");
  });

  it("los dos onChange del paso 1 pasan por cambiarParametros, que reinicia draftId y el resto del par", () => {
    const src = read(WIZARD);
    const cuerpo = src.slice(src.indexOf("const cambiarParametros"), src.indexOf("const handleNextStep"));
    expect(cuerpo.length, "no existe cambiarParametros").toBeGreaterThan(0);
    for (const reset of [
      "sucioRef.current = false",
      "setDraftId(null)",
      "setBorradorCargado(null)",
      "setEvaluations({})",
      "setAdditionalMeasures([])",
      "setPlanEditado([])",
      'setNotes("")',
      'setAutoguardado("limpio")',
    ]) {
      expect(cuerpo, `cambiarParametros no reinicia: ${reset}`).toContain(reset);
    }
    expect(src).toMatch(/onSystemIdChange=\{\(id\) => cambiarParametros\(\(\) => setSystemId\(id\)\)\}/);
    expect(src).toMatch(/onFrameworkChange=\{\(f\) => cambiarParametros\(\(\) => setFramework\(f\)\)\}/);
    // Control positivo: los setters directos siguen existiendo, así que un
    // cableado `onSystemIdChange={setSystemId}` sería detectable.
    expect(src).not.toMatch(/onSystemIdChange=\{setSystemId\}|onFrameworkChange=\{setFramework\}/);
  });
});

describe("B2 — el paso 2 cuenta las medidas del catálogo aplicado", () => {
  it("PASOS se construye con allMeasures.length y el banner recibe el mismo número", () => {
    const src = read(WIZARD);
    expect(src).toMatch(/const PASOS = \[[^\]]*\$\{allMeasures\.length\}[^\]]*\]/);
    expect(src).toContain("totalMedidas={allMeasures.length}");
    expect(src, "vuelve el reduce por requisito en el banner").not.toMatch(/requirements\.reduce\(/);
  });

  it("ninguna superficie del perímetro renderiza «84 MG» ni un rótulo «(MG)»", () => {
    // Control positivo: el código de medida sigue empezando por MG_ en el catálogo.
    expect(readFileSync("src/lib/aims/catalog-aesia.ts", "utf8")).toMatch(/id:\s*"MG_/);
    for (const f of PERIMETRO) {
      const src = read(f);
      expect(/84 MG/.test(src), `${f}: renderiza «84 MG»`).toBe(false);
      expect(/\(MG\)/.test(src), `${f}: rótulo con «(MG)»`).toBe(false);
    }
    expect(read(WIZARD)).not.toContain("12 requisitos");
  });
});

describe("B3 — estado de evaluación y de sistema por la hoja de vocabulario", () => {
  it("la cabecera del informe pinta chip y etiqueta desde vocabulario", () => {
    const src = read(CABECERA);
    expect(src).toContain("chipClaseEstadoEvaluacion(assessment.status)");
    expect(src).toContain('etiqueta("estadoEvaluacion", assessment.status)');
    expect(src, "vuelve el literal crudo del estado").not.toMatch(/>\s*\{assessment\.status\}\s*</);
    expect(src).not.toContain("assessmentAcreditaConformidad(");
  });
  it("el paso 1 pinta el estado del sistema con etiqueta()", () => {
    expect(read(PARAMETROS)).toContain('etiqueta("estadoSistema", selectedSystem.status)');
  });
  it("control positivo: la hoja traduce y tiñe lo que estas pantallas le pasan", () => {
    expect(etiqueta("estadoEvaluacion", "CON_GAPS")).toBe("Con brechas");
    expect(chipClaseEstadoEvaluacion("CON_GAPS")).toContain("--status-warning");
    expect(etiqueta("estadoSistema", "EN_EVALUACION")).toBe("En evaluación");
  });
});

describe("B4 — evaluación anterior a la clasificación vigente", () => {
  it("la página llama evaluadaContraOtroCatalogo con el sistema embebido y la cabecera lo pinta", () => {
    const detalle = read(DETALLE);
    expect(detalle).toMatch(/import\s*\{[^}]*evaluadaContraOtroCatalogo[^}]*\}\s*from\s*"@\/lib\/aims\/perfil-aplicabilidad"/);
    expect(detalle).toContain("evaluadaContraOtroCatalogo(assessment.findings, assessment.ai_systems, AESIA_RIA_REQUIREMENTS)");
    expect(detalle).toContain("anteriorAClasificacion={anteriorAClasificacion}");
    const cabecera = read(CABECERA);
    expect(cabecera).toContain("{anteriorAClasificacion && (");
    expect(cabecera).toContain("Evaluación anterior a la clasificación vigente");
    expect(cabecera).toMatch(/ETIQUETA_ROL\[/);
    // El score no se recalcula: no hay computeAssessmentStats ni score= en la cabecera.
    expect(cabecera).not.toContain("computeAssessmentStats");
    expect(cabecera).toContain("Reevaluar contra su catálogo");
  });
  it("el hook trae regulatory_role y regulatory_profile del sistema (sin ellos la hoja falla abierto y nunca avisa)", () => {
    const src = read(HOOK);
    expect(src).toContain("ai_systems!inner(id, name, risk_level, system_type, tenant_id, regulatory_role, regulatory_profile)");
    expect(src).toContain("ai_systems!inner(name, risk_level, tenant_id, regulatory_role, regulatory_profile)");
  });
});

describe("B5/B6 — la custodia lee la fila y el uid de sesión", () => {
  it("el botón de revisar se deshabilita para la cuenta que congeló", () => {
    const src = read(CABECERA);
    expect(src).toMatch(/const \{ user \} = useAuth\(\)/);
    expect(src).toContain("assessment.frozen_by_id === user.id");
    expect(src).toContain("disabled={revisando || mismaCuenta}");
    expect((src.match(/entra con otra cuenta/g) ?? []).length, "title + aviso bajo el botón").toBeGreaterThanOrEqual(2);
  });
  it("pinta quién congeló y quién revisó desde frozen_by_id / reviewed_by_id, sin consultar perfiles ajenos", () => {
    const src = read(CABECERA);
    expect(src).toContain("autor(assessment.frozen_by_id)");
    expect(src).toContain("autor(assessment.reviewed_by_id)");
    expect(src).toContain("sin autor registrado");
    expect(src).toContain("(esta cuenta)");
    expect(src).not.toContain("user_profiles");
  });
});

describe("B7 — labels visibles y aria-describedby", () => {
  it("ControlesDeMedida: cada control tiene label con htmlFor y el error L8 se describe", () => {
    const src = read(CONTROLES);
    expect(src).toMatch(/const id = useId\(\)/);
    for (const c of ["madurez", "dificultad", "justificacion"]) {
      expect(src).toContain(`htmlFor={\`\${id}-${c}\`}`);
      expect(src).toContain(`id={\`\${id}-${c}\`}`);
    }
    expect(src).toContain("aria-describedby={l8SinMotivo ? `${id}-justificacion-error` : undefined}");
    expect(src).toContain("<p id={`${id}-justificacion-error`}");
  });
  it("EvidenciaDeMedida: título, tipo, fichero y referencia llevan <label> visible", () => {
    const src = read(EVIDENCIA);
    for (const t of ["Título de la evidencia", "Tipo de evidencia", "Fichero de la evidencia", "Referencia documental externa"]) {
      expect(new RegExp(`<label[^>]*>\\s*${t}`).test(src), `falta el label visible «${t}»`).toBe(true);
    }
  });
});

describe("B8 — todo error de RPC pasa por mensajeUsuario", () => {
  it("los catch de congelar/revisar/evidencia/wizard no pintan err.message a mano", () => {
    for (const f of [DETALLE, EVIDENCIA, WIZARD]) {
      const src = read(f);
      expect(src, `${f}: no importa mensajeUsuario`).toMatch(/import \{ mensajeUsuario \} from "@\/lib\/aims\/errores-rpc"/);
      expect(src, `${f}: importa y no llama`).toMatch(/mensajeUsuario\(err\)/);
      expect(src, `${f}: queda un err.message a mano`).not.toMatch(/err instanceof Error \? err\.message/);
    }
  });
  it("control positivo: la hoja quita el código y lo traduce", () => {
    expect(mensajeUsuario(new Error("MISMO_EVALUADOR: no puede revisar quien congeló"))).toBe("no puede revisar quien congeló");
    expect(mensajeUsuario(new Error("MISMO_EVALUADOR"))).toBe("La revisión la firma una persona distinta de quien congeló.");
  });
});
