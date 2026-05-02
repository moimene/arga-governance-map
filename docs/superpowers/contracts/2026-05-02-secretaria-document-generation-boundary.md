# 2026-05-02 — Secretaria / Document Assembly boundary

## Proposito

Separar Secretaria Societaria del futuro carril independiente de generacion documental.

Secretaria no debe convertirse en un generador libre de documentos. Su responsabilidad es conservar los actos societarios, sus fuentes canonicas, reglas, snapshots, acuerdos, actas, certificaciones y traza demo/operativa. El carril documental externo podra componer DOCX/PDF a partir de un modelo documental validado, pero no sera fuente de verdad juridica.

## Decision

El contrato entre Secretaria y el futuro `Document Assembly Pipeline` es una solicitud canonica, no un DOCX:

```ts
type SecretariaDocumentGenerationRequest = {
  source_module: "secretaria";
  document_type:
    | "CONVOCATORIA"
    | "ACTA"
    | "CERTIFICACION"
    | "INFORME_PRECEPTIVO"
    | "INFORME_DOCUMENTAL_PRE"
    | "ACUERDO_SIN_SESION"
    | "DECISION_UNIPERSONAL"
    | "DOCUMENTO_REGISTRAL"
    | "SUBSANACION_REGISTRAL";
  tenant_id: string;
  entity_id: string | null;
  agreement_ids: string[];
  convocatoria_id?: string | null;
  meeting_id?: string | null;
  minute_id?: string | null;
  certification_id?: string | null;
  tramitador_id?: string | null;
  template_profile_id?: string | null;
  template_id?: string | null;
  evidence_status: "DEMO_OPERATIVA";
  generation_lane: "DOCUMENT_ASSEMBLY_PIPELINE";
  requested_at: string;
};
```

Implementacion local del contrato:

- `src/lib/secretaria/document-generation-boundary.ts`
- `src/lib/secretaria/__tests__/document-generation-boundary.test.ts`

## Idempotencia y trazabilidad

`request_hash_sha256` identifica unicamente la **solicitud** (fingerprint del contenido), no el estado canonico en Cloud en el momento del render. Dos solicitudes con el mismo `request_hash_sha256` pueden producir DOCX distintos si los datos canonicos (acuerdos, asistentes, votaciones, snapshots) cambiaron entre invocaciones. La deduplicacion que aporta el hash es de **solicitudes**, no de **artefactos inmutables**.

Reglas operativas:

- `request_hash_sha256` se calcula sobre el contenido canonico del request, excluyendo `requested_at`, `request_id` y `requested_by_user_id` (metadatos de trazabilidad).
- `request_id` y `requested_by_user_id` son trazas de auditoria: identifican quien y cuando, pero no participan en el fingerprint.
- Dos invocaciones de `buildSecretariaDocumentGenerationRequest` con el mismo contenido producen el mismo `request_hash_sha256` aunque cambien los metadatos.
- El carril documental no debe renderizar si ya existe un artefacto demo-operativo archivado para el mismo `request_hash_sha256`, salvo `force_regenerate` explicito y justificado.

## Reglas de frontera

- `agreements.id` es el identificador canonico para documentos derivados de actos ya existentes.
- Convocatoria e informes PRE pueden existir antes del acuerdo, pero deben referenciar `convocatoria_id` o expediente equivalente.
- Acta, certificacion, acuerdo sin sesion, decision unipersonal, documento registral y subsanacion deben converger en `agreement_ids`.
- `evidence_status` solo puede ser `DEMO_OPERATIVA`.
- Nada en este contrato declara evidencia final productiva.
- El carril documental puede renderizar DOCX/PDF, pero no modificar quorum, asistentes, acuerdos, votaciones, pactos, conflictos, fechas, organo, sociedad ni identificadores.

## Responsabilidades

| Responsabilidad | Owner |
|---|---|
| Fuente de verdad de actos societarios | Secretaria |
| `agreement_ids`, acta, certificacion, tramitador | Secretaria |
| Plantilla/perfil usado | Secretaria como consumidor; carril documental como ensamblador |
| `document_model` intermedio | Carril documental |
| Render DOCX/PDF | Carril documental |
| Validacion contra DB/snapshots | Carril documental + Secretaria como fuente canonica |
| Evidencia demo/operativa | Secretaria/doc-gen actual |
| Evidencia final productiva | Fuera de este corte; requiere storage/hash/bundle/audit/retention/legal hold/QTSP y aprobacion explicita |

## Politica IA

El futuro carril documental puede usar IA solo como reescritura controlada de campos narrativos no criticos, bajo schema estricto y validacion posterior.

Campos permitidos de forma inicial:

- `narrativa.introduccion`
- `narrativa.deliberaciones`
- `narrativa.incidencias_no_criticas`

Campos prohibidos:

- sociedad;
- organo;
- asistentes;
- quorum;
- capital;
- derechos de voto;
- votaciones;
- texto de acuerdos;
- pactos;
- conflictos;
- fechas;
- lugar;
- `agreement_ids`;
- evidencias, hashes o snapshots.

## No-Schema posture

Este contrato no requiere migracion. Si en una fase posterior se decide persistir `document_models`, debe abrirse un paquete separado:

```md
Migration packet:
- Type: approved_gap
- Owner lane: document_assembly
- Tables/RPC/RLS/storage affected:
- Probe before:
- SQL/change proposed:
- Idempotency:
- Rollback concept:
- Probe after:
- UI/test unblocked:
```

## Bridge legacy de variables Capa 2

Mientras el `Document Assembly Pipeline` no exista como carril propio, el doc-gen actual sigue actuando como bridge demo/operativo. Ese bridge no debe inventar contenido ni convertir fixtures en fuente de verdad, pero si debe resolver de forma determinista las fuentes Capa 2 ya existentes en Cloud y migraciones legacy.

Reglas aplicadas en `src/lib/doc-gen/variable-resolver.ts`:

- Fuentes singulares y plurales equivalentes se normalizan al mismo dominio canonico: `agreement.*`/`agreements.*`, `meeting.*`/`meetings.*`, `mandate.*`/`body_mandates.*`, `persons.*`, `LEY`, `rule_pack.*`, `QTSP.*`.
- Si la plantilla declara una variable con nombre distinto al campo de origen, el resolver puede leer el campo de la fuente declarada sin cambiar el nombre juridico de salida. Ejemplo: `organo_certificado` con fuente `agreement.adoption_mode`.
- Las expresiones booleanas simples del tipo `meeting.status == 'APROBADA'` se evalúan como dato estructurado, no como texto libre.
- `LEY`, `ESTATUTOS`, `PACTO_PARASOCIAL`, `REGLAMENTO`, `rule_pack.*`, `evaluar*` y `calcular*` se resuelven desde el snapshot del motor, preservando trazabilidad juridica.
- Si una fuente sigue sin resolverse, queda en `unresolved`; el bridge no debe rellenarla con narrativa ni valores inventados.

## Criterios de aceptacion del carril Secretaria

- Secretaria puede construir una solicitud canonica para el carril documental.
- Los documentos derivados de actos existentes incluyen `agreement_ids`.
- La solicitud queda bloqueada si intenta usar evidencia final productiva.
- El workflow actual puede seguir generando documentos demo/operativos mientras el carril independiente no exista.
- El futuro carril documental queda desacoplado de reglas societarias, Acuerdo 360 y evidencia final.
