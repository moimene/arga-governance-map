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
    expect(organos).toContain("Crear órgano");
    expect(organos).toContain("Fuente documental obligatoria");
    expect(organos).toContain("No se permite publicar órgano competente sin fuente documental");
    expect(organos).toContain("useUpsertOrganProfile");
    expect(wizard).toContain("Wizard de activación normativa");
    expect(wizard).toContain("useRecordNormativeMaintenanceEvent");
    expect(wizard).toContain("handleDiagnosticAction");
    expect(wizard).toContain("Publicar estatutos exige documento real");
    expect(wizard).toContain('startsWith("secretaria://estatutos/version-demo")');
    expect(wizard).toContain('startsWith("demo-")');
    expect(wizard).not.toContain('documentUri: "secretaria://estatutos/version-demo"');
    expect(wizard).not.toContain("documentHash: `demo-");
    expect(wizard).not.toContain("sin escritura Cloud");
  });

  it("la ficha de materia funciona como workspace del motor de reglas", () => {
    const catalogo = read("src/pages/secretaria/CatalogoMaterias.tsx");

    expect(catalogo).toContain("Workspace de configuración del motor");
    expect(catalogo).toContain("Cadena de decisión del motor");
    expect(catalogo).toContain("Materia");
    expect(catalogo).toContain("Regla efectiva");
    expect(catalogo).toContain("Plantillas vinculadas");
    expect(catalogo).toContain("Preflight");
    expect(catalogo).toContain("Resultado del motor");
    expect(catalogo).toContain("Qué exige la ley");
    expect(catalogo).toContain("Qué añaden los estatutos");
    expect(catalogo).toContain("Pactos aplicables");
    expect(catalogo).toContain("Regla efectiva para esta sociedad");
    expect(catalogo).toContain("Configuración del motor de reglas");
    expect(catalogo).toContain("Ver plantillas vinculadas");
    expect(catalogo).toContain("Plantillas vinculadas al motor");
    expect(catalogo).toContain("Simular preflight del motor");
    expect(catalogo).toContain("Iniciar expediente bloqueado");
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
    expect(ruleManager).toContain("usePublishNormativeOverride");
    expect(ruleManager).toContain("Publicar override");
    expect(ruleManager).toContain("Completa valor, fuente documental y justificación");
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

  it("conecta bindings de plantillas a la regla efectiva", () => {
    const plantillas = read("src/pages/secretaria/Plantillas.tsx");

    expect(plantillas).toContain("useAssignTemplateBinding");
    expect(plantillas).toContain("useSearchParams");
    expect(plantillas).toContain("(p.materia_acuerdo ?? p.materia) === filterMateria");
    expect(plantillas).toContain("templateEngineSort");
    expect(plantillas).toContain("Configuración del motor");
    expect(plantillas).toContain("Vincular como plantilla activa");
    expect(plantillas).toContain("templateSelectionReason");
    expect(plantillas).toContain("Plantilla vinculada a la regla efectiva");
  });

  it("no filtra metadatos demo en textos visibles de negocio", () => {
    const revision = read("src/pages/secretaria/DocumentosPendientesRevision.tsx");
    const generar = read("src/pages/secretaria/GenerarDocumentoStepper.tsx");
    const catalogo = read("src/pages/secretaria/CatalogoMaterias.tsx");
    const evidenceLabels = read("src/lib/secretaria/evidence-status-labels.ts");

    expect(revision).not.toContain("archivados como DEMO_OPERATIVA");
    // P0-4 (auditoría UX 2026-06-20): el subcopy ya no presenta la evidencia de entorno
    // demo como "evidencia operativa". El disclaimer de entorno de validación funcional
    // vive ahora en EvidenceStatusBadge, no en el encabezado de la bandeja.
    expect(revision).not.toContain("evidencia operativa");
    expect(revision).toContain("Revisa documentos generados o anexados antes de aprobarlos");
    // UX-0.F (informe legal §7.3): el stepper rotula la evidencia con el copy aprobado
    // vía EvidenceStatusBadge/evidenceStatusDescriptor ("Entorno de validación funcional"),
    // nunca con la etiqueta ambigua "Evidencia operativa" ni presentando la evidencia demo
    // como cualificada. La aserción negativa se conserva y se refuerza (case-insensitive).
    expect(generar).not.toMatch(/evidencia demo operativa/i);
    expect(generar).not.toContain("Evidencia operativa");
    expect(generar).toContain("EvidenceStatusBadge");
    // El copy aprobado §7.3 que ve el usuario vive en el descriptor compartido que
    // consume EvidenceStatusBadge: se verifica aquí que la cadena llega al copy real.
    expect(evidenceLabels).toContain("Entorno de validación funcional");
    expect(evidenceLabels).toContain("sin eficacia jurídica cualificada productiva");
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
