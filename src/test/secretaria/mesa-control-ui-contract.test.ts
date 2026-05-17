import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("mesa de control jurídico-societaria — UI contract", () => {
  it("expone materias y reglas como entrada principal de mantenimiento", () => {
    const app = read("src/App.tsx");
    const navigation = read("src/components/secretaria/shell/navigation.ts");

    expect(app).toContain("/secretaria/catalogo-materias");
    expect(app).toContain("ReglasToCatalogoMateriasRedirect");
    expect(navigation).toContain("Materias y reglas");
    expect(navigation).not.toContain("to: \"/secretaria/reglas\"");
  });

  it("expone catálogo de órganos y wizard de activación normativa", () => {
    const app = read("src/App.tsx");
    const navigation = read("src/components/secretaria/shell/navigation.ts");
    const organos = read("src/pages/secretaria/CatalogoOrganos.tsx");
    const wizard = read("src/pages/secretaria/ActivarMarcoNormativo.tsx");

    expect(app).toContain("/secretaria/catalogo-organos");
    expect(app).toContain("/secretaria/sociedades/:id/marco-normativo/activar");
    expect(navigation).toContain("Catálogo de órganos");
    expect(organos).toContain("Órganos, competencias y reglamentos");
    expect(wizard).toContain("Wizard de activación normativa");
  });

  it("la ficha de materia habla de capas jurídicas y documentos", () => {
    const catalogo = read("src/pages/secretaria/CatalogoMaterias.tsx");

    expect(catalogo).toContain("Qué exige la ley");
    expect(catalogo).toContain("Qué añaden los estatutos");
    expect(catalogo).toContain("Pactos aplicables");
    expect(catalogo).toContain("Regla efectiva para esta sociedad");
    expect(catalogo).toContain("Documentos asociados");
    expect(catalogo).toContain("Formalización posterior");
    expect(catalogo).toContain("No se puede iniciar expediente porque falta plantilla");
    expect(catalogo).toContain("Asignar plantilla");
  });

  it("el perfil de sociedad contiene matriz materia × requisitos", () => {
    const sociedadDetalle = read("src/pages/secretaria/SociedadDetalle.tsx");

    expect(sociedadDetalle).toContain("Marco normativo");
    expect(sociedadDetalle).toContain("Matriz materia × requisitos");
    expect(sociedadDetalle).toContain("órgano competente");
  });

  it("el alta de sociedad configura fuentes y bloquea rebajas del mínimo legal", () => {
    const stepReglas = read("src/pages/secretaria/sociedad-nueva/StepReglas.tsx");
    const validation = read("src/lib/secretaria/sociedad-onboarding/validation.ts");
    const model = read("src/lib/secretaria/mesa-control-societaria.ts");

    expect(stepReglas).toContain("Suelo legal aplicable");
    expect(stepReglas).toContain("Estatutos modelados");
    expect(stepReglas).toContain("Pactos parasociales modelados");
    expect(model).toContain("Este requisito no puede rebajar el mínimo legal");
    expect(validation).toContain("validateNormativeOverrideDraft");
  });

  it("el expediente muestra una mesa de control con acciones, pendientes y bloqueos", () => {
    const expediente = read("src/pages/secretaria/ExpedienteAcuerdo.tsx");

    expect(expediente).toContain("Mesa de control del acuerdo");
    expect(expediente).toContain("Qué puedo hacer");
    expect(expediente).toContain("Qué falta");
    expect(expediente).toContain("Qué bloquea");
    expect(expediente).toContain("Próximos pasos");
  });

  it("corrige pre-votación, conflicto jurisdiccional y lenguaje operativo", () => {
    const ruleManager = read("src/pages/secretaria/RuleManagerPage.tsx");
    const model = read("src/lib/secretaria/mesa-control-societaria.ts");
    const navigation = read("src/components/secretaria/shell/navigation.ts");

    expect(navigation).toContain("Materias y reglas");
    expect(navigation).not.toContain("Regla efectiva");
    expect(ruleManager).toContain("Validación preliminar. No ejecutable");
    expect(ruleManager).toContain("Posible conflicto de ley aplicable");
    expect(ruleManager).toContain("Solicitar alta de materia");
    expect(model).toContain("conflict_of_laws_flag");
    expect(model).toContain("ff_ruleset_wizard");
  });

  it("expone gobierno operativo: permisos, historial, auditoría y rollout", () => {
    const ruleManager = read("src/pages/secretaria/RuleManagerPage.tsx");
    const wizard = read("src/pages/secretaria/ActivarMarcoNormativo.tsx");
    const catalogo = read("src/pages/secretaria/CatalogoMaterias.tsx");
    const model = read("src/lib/secretaria/mesa-control-societaria.ts");

    expect(ruleManager).toContain("Historial y trazabilidad");
    expect(ruleManager).toContain("Evento preparado");
    expect(wizard).toContain("Evento de auditoría preparado");
    expect(wizard).toContain("Rollout");
    expect(wizard).toContain("Solicitar edición");
    expect(catalogo).toContain("Solicitar edición");
    expect(model).toContain("canPerformNormativeAction");
    expect(model).toContain("buildNormativeAuditEvent");
    expect(model).toContain("buildNormativeRolloutPlan");
    expect(model).toContain("buildNormativeTelemetryEvent");
    expect(model).toContain("buildNormativeReadModelContracts");
    expect(wizard).toContain("Controles de despliegue");
    expect(wizard).toContain("Criterios de salida");
    expect(wizard).toContain("Backfill legacy");
    expect(wizard).toContain("Telemetría preparada para la publicación del marco");
    expect(ruleManager).toContain("Telemetría preparada para la consulta de regla efectiva");
  });

  it("no filtra metadatos demo en textos visibles de negocio", () => {
    const revision = read("src/pages/secretaria/DocumentosPendientesRevision.tsx");
    const generar = read("src/pages/secretaria/GenerarDocumentoStepper.tsx");
    const catalogo = read("src/pages/secretaria/CatalogoMaterias.tsx");

    expect(revision).not.toContain("archivados como DEMO_OPERATIVA");
    expect(revision).toContain("archivados como evidencia operativa");
    expect(generar).not.toContain("Evidencia demo operativa");
    expect(generar).toContain("Evidencia operativa");
    expect(catalogo).toContain("Trazabilidad preparada para el bloqueo del expediente");
  });

  it("oculta claves internas de adopción y reglas en flujos visibles de Secretaría", () => {
    const generar = read("src/pages/secretaria/GenerarDocumentoStepper.tsx");
    const tramitador = read("src/pages/secretaria/TramitadorStepper.tsx");
    const co = read("src/pages/secretaria/CoAprobacionStepper.tsx");
    const solidario = read("src/pages/secretaria/SolidarioStepper.tsx");
    const procesosGrupo = read("src/pages/secretaria/ProcesosGrupo.tsx");

    expect(generar).toContain("forma de adopción: {adoptionModeBusinessLabel");
    expect(generar).not.toContain("adopción: {agreement.adoption_mode}");
    expect(tramitador).toContain("Tipo de materia: {matterClassBusinessLabel");
    expect(tramitador).toContain("Forma de adopción: {adoptionModeBusinessLabel");
    expect(tramitador).not.toContain("fallback técnico");
    expect(co).not.toContain("adoption_mode = CO_APROBACION");
    expect(solidario).not.toContain("adoption_mode = SOLIDARIO");
    expect(procesosGrupo).toContain("forma de adopción y la regla legal aplicable");
    expect(procesosGrupo).not.toContain("AdoptionMode y el rule pack aplicable");
  });
});
