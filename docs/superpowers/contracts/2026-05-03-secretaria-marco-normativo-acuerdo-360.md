# Secretaría — Marco normativo societario como ancla de Acuerdo 360

Fecha: 2026-05-03
Estado: implementado sin migración Cloud nueva

## Objetivo

Cada sociedad debe tener un perfil normativo proyectable y cada acuerdo debe
congelar un snapshot de ese perfil cuando se documenta, revisa, firma, archiva o
promueve al expediente.

## Fuentes

El perfil se compone desde fuentes Cloud existentes:

- `entities`: jurisdicción, tipo social, cotizada, unipersonalidad y forma de administración.
- `jurisdiction_rule_sets`: fuente legal base por jurisdicción y forma social.
- `rule_pack_versions`: rule packs operativos del motor LSC.
- `rule_param_overrides`: overrides estatutarios o de configuración por sociedad.
- `pactos_parasociales`: control contractual paralelo.

No se crea tabla nueva para estatutos/reglamentos en este corte. Si faltan como
repositorio estructurado, el perfil los muestra como fuente esperada y no
bloquea la generación documental.

## Jerarquía semántica

El contrato distingue plano y prioridad:

- `LEY`: plano societario, regla imperativa/dispositiva de base.
- `REGISTRO`: plano registral y formalización.
- `ESTATUTOS`: plano societario interno de la sociedad.
- `PACTO_PARASOCIAL`: plano contractual paralelo; puede generar warnings o
  acciones contractuales, pero no invalida automáticamente el acuerdo societario.
- `REGLAMENTO`: plano operativo del órgano.
- `POLITICA`: rule packs/parametrización del motor.
- `SISTEMA`: trazabilidad técnica de Acuerdo 360 y motor de plantillas.

## Contrato técnico

Módulo puro:

- `src/lib/secretaria/normative-framework.ts`

Tipos principales:

- `EntityNormativeProfile`
- `AgreementNormativeSnapshot`
- `NormativeSource`
- `FormalizationRequirement`

Hook de proyección:

- `src/hooks/useNormativeFramework.ts`
- `useEntityNormativeProfile(entityId)`
- `useAgreementNormativeSnapshot(agreement)`

Acuerdo 360:

- `src/lib/secretaria/agreement-360.ts` conserva proyección normativa en:
  - `agreements.compliance_snapshot.normative_profile`
  - `agreements.compliance_snapshot.normative_snapshot_id`
  - `agreements.compliance_explain.normative_snapshot`
  - `agreements.execution_mode.agreement_360.normative_snapshot_id`

Motor de plantillas:

- `ComposeDocumentOptions.normativeSnapshot`
- `ResolverContext.complianceSnapshot.normative_profile`
- bloque post-render `MARCO NORMATIVO SOCIETARIO`
- metadatos de evidence bundle:
  - `normativeSnapshotId`
  - `normativeProfileId`
  - `normativeProfileHash`
  - `normativeFrameworkStatus`
  - `normativeSourceLayers`
  - `formalizationRequirements`

## UX

- `SociedadDetalle` incorpora tab `Marco normativo` y resumen de ancla normativa.
- `ExpedienteAcuerdo` muestra el snapshot normativo del acuerdo.
- `GenerarDocumentoStepper` pasa el snapshot al composer y al archivado.

## Schema posture

Sin migración obligatoria. El sistema reutiliza JSON existente:

- `agreements.compliance_snapshot`
- `agreements.compliance_explain`
- `agreements.execution_mode`
- `evidence_bundles.manifest.metadata`

Deuda funcional futura si se decide modelar fuente formal:

- Tabla versionada de estatutos por sociedad.
- Tabla versionada de reglamentos de órgano.
- Relación explícita `agreement_normative_snapshots` si se requiere consulta
  SQL directa por snapshot en lugar de JSON.

Mientras no exista ese schema, la UI no escribe columnas inexistentes y el
contrato documental opera con proyección no destructiva.
