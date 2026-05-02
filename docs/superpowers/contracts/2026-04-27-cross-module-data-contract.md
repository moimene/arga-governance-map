# 2026-04-27 — Contrato de datos cross-module TGMS

## Proposito

Definir el contrato compartido entre TGMS Shell / ARGA Console, Secretaria Societaria, GRC Compass y AIMS 360. El objetivo es componer la plataforma como un ERP de gobernanza sin convertir los modulos en un supermodulo ni duplicar fuentes de verdad.

## Principio owner-first

Cada modulo conserva su modelo propietario. Los contratos compartidos solo sirven para identidad, enlace, eventos, evidencia, auditoria y navegacion.

| Dominio | Owner | Puede exponer | No debe absorber |
|---|---|---|---|
| Expedientes societarios, convocatorias, reuniones, actas, certificaciones | Secretaria | Estados, links, evidencia formal, snapshots legales | Riesgos GRC, sistemas IA, workflows AIMS |
| Riesgos, controles, hallazgos, remediacion, obligaciones, incidentes GRC | GRC Compass | Eventos materiales, evidencias, propuestas de escalado | Actas/certificaciones societarias, inventario IA |
| Sistemas IA, AI Act, ISO 42001, expediente tecnico, post-market | AIMS 360 | Eventos de gap/incidente, evidencias IA, controles relacionados | Ledger GRC, expediente societario |
| Vista ejecutiva, busqueda, navegacion, scope, board view | TGMS Shell / ARGA Console | Read models, routing, status agregados | Mutaciones propietarias de modulos |

## Fuente de verdad

- Cloud Supabase `governance_OS` es fuente de verdad para schema operativo.
- Migraciones locales son contrato reproducible solo si coinciden con Cloud o estan marcadas como pending/hold.
- Tipos generados son contrato de cliente, no prueba suficiente de existencia si Cloud no esta verificado.

## Contratos compartidos

### Identidad y scope

Tablas/contratos:

- `entities`
- `governing_bodies`
- `persons`
- `condiciones_persona`
- `tenants`
- contexto `tenant_id`
- scope de sociedad/grupo

Reglas:

- Todo objeto material debe poder resolverse a `tenant_id`.
- Siempre que sea posible debe incluir `entity_id`.
- Los modulos pueden leer identidad compartida, pero no cambiar ownership corporativo salvo flujo owner.

### Eventos cross-module

Tabla objetivo:

- `governance_module_events`

Uso:

- comunicar hechos materiales entre modulos;
- no sustituir el estado propietario;
- no ser evidencia final productiva por si solo.

Campos minimos esperados:

```ts
type GovernanceModuleEvent = {
  tenant_id: string;
  source_module: "SECRETARIA" | "GRC" | "AIMS" | "CORE";
  source_table: string;
  source_id: string;
  event_type: string;
  target_module?: "SECRETARIA" | "GRC" | "AIMS" | "CORE" | null;
  entity_id?: string | null;
  severity?: "INFO" | "WARNING" | "CRITICAL" | null;
  payload_version: string;
  payload: Record<string, unknown>;
};
```

Eventos canonicos iniciales:

| Evento | Source | Target | Mutacion permitida |
|---|---|---|---|
| `GRC_INCIDENT_MATERIAL` | GRC | Secretaria | Secretaria decide si crea propuesta/agenda |
| `AIMS_TECHNICAL_FILE_GAP` | AIMS | GRC | GRC decide si crea control/workflow |
| `AIMS_INCIDENT_MATERIAL` | AIMS | GRC/Secretaria | GRC gestiona riesgo; Secretaria decide escalado CdA |
| `SECRETARIA_CERTIFICATION_ISSUED` | Secretaria | GRC/AIMS/Core | Consumidores enlazan evidencia, no mutan certificacion |
| `SECRETARIA_AGREEMENT_ADOPTED` | Secretaria | Core/GRC/AIMS | Consumidores actualizan read model o crean workflow owner |

### Links cross-module

Tabla objetivo:

- `governance_module_links`

Uso:

- relacion persistente entre records owner;
- trazabilidad de handoffs;
- navegacion contextual.

Campos minimos esperados:

```ts
type GovernanceModuleLink = {
  tenant_id: string;
  source_module: string;
  source_table: string;
  source_id: string;
  target_module: string;
  target_table: string;
  target_id: string;
  link_type: string;
  status: "ACTIVE" | "SUPERSEDED" | "CLOSED";
};
```

Reglas:

- El link no cambia el owner del target.
- Un link no acredita por si solo validez juridica ni cumplimiento.
- Si el link soporta evidencia, debe apuntar tambien a `evidence_bundles` o `audit_log`.

### Evidencia

Tablas/contratos:

- `evidence_bundles`
- `evidence_bundle_artifacts`
- `audit_log`
- `storage.objects`
- bucket `matter-documents`
- QTSP EAD Trust para QES/QSeal/ERDS/timestamp.

Evidencia final productiva requiere:

1. objeto almacenado o referencia externa verificable;
2. hash criptografico;
3. bundle o manifest;
4. audit trail;
5. owner record;
6. retention/legal hold posture cerrado o no aplicable;
7. politica probatoria aprobada;
8. aprobacion explicita de promocion;
9. si aplica, token o stub QTSP trazable.

El contrato puro de readiness vive en Secretaria como primer consumidor:

- `src/lib/secretaria/final-evidence-readiness-contract.ts`.

No es operativo por si mismo: no promociona, no persiste, no crea eventos cross-module y no convierte bundles demo en evidencia final productiva sin los gates anteriores.

No basta:

- un link UI;
- un JSON en payload;
- una URL sin hash;
- una fila de evento sin bundle;
- un documento generado pero no archivado.

### Auditoria

Tablas/funciones:

- `audit_log`
- `fn_verify_audit_chain`

Reglas:

- La auditoria no debe usarse como log generico de UI.
- Cambios materiales deben dejar suficiente delta para reconstruir el acto.
- Verificacion de cadena es control, no workflow de negocio.

## Limites de mutacion

| Actor | Permitido | Prohibido |
|---|---|---|
| Secretaria | Mutar expedientes, reuniones, actas, certificaciones, plantillas owner | Crear/editar riesgos GRC o sistemas AIMS directamente |
| GRC | Mutar riesgos, controles, incidentes, hallazgos, evidencias GRC owner | Cambiar acuerdos, actas o certificaciones |
| AIMS | Mutar sistemas IA, expedientes tecnicos y controles IA owner | Crear shadow controls GRC sin handoff |
| Shell/Console | Componer, buscar, enrutar, leer status, crear handoff si contrato existe | Mutar estados owner directamente |

## Runtime posture actual

| Area | Postura |
|---|---|
| Secretaria | Cloud/type parity saneada para lifecycle/trace/document bucket base; carril funcional principal |
| AIMS | Legacy `ai_*` y backbone `aims_*` coexisten; requiere mapeo por pantalla |
| GRC | Legacy operativo y `grc_*` coexisten; requiere mapeo por workflow |
| `governance_module_events/links` | Contrato definido; writes sujetos a probes y tests |
| Evidence/legal hold | Parcial; `000049` en HOLD |

## Reencuadre 2026-05-01 - Carriles paralelos AIMS/GRC

Se confirma que AIMS 360 y GRC Compass avanzan como carriles separados, no como un unico modulo AIMS-GRC. La arquitectura compartida se mantiene mediante contratos, eventos, links, evidencia y consola ejecutiva, no mediante duplicacion de modelos.

Documento rector del reencuadre:

- `docs/superpowers/plans/2026-05-01-aims-grc-parallel-lanes.md`

Regla operativa:

- AIMS puede ser standalone sobre su modelo owner.
- GRC puede ser standalone sobre su modelo owner.
- En TGMS completo, ambos se conectan con Secretaria y la consola por handoffs owner-first.
- Secretaria formaliza decisiones societarias; GRC gestiona riesgo/cumplimiento; AIMS gestiona sistemas IA; la consola compone y enruta.

## Slice 1 GRC 2026-05-02 - Handoffs route-only

Se incorpora el contrato pantalla por pantalla de GRC:

- `docs/superpowers/contracts/2026-05-02-grc-screen-posture-contract.md`

Handoffs habilitados en UI sin persistencia compartida:

| Source owner | Target owner | Ruta | Evento futuro | Mutacion actual |
|---|---|---|---|---|
| GRC | Secretaria | `/secretaria/reuniones/nueva?source=grc&event=GRC_INCIDENT_MATERIAL` | `GRC_INCIDENT_MATERIAL` | Route-only |
| GRC | Secretaria | `/secretaria/reuniones/nueva?source=grc&event=GRC_FINDING_BOARD_ESCALATION` | `GRC_FINDING_BOARD_ESCALATION` | Route-only |
| AIMS | GRC | `/grc/risk-360?source=aims&handoff=AIMS_TECHNICAL_FILE_GAP` | `AIMS_TECHNICAL_FILE_GAP` | Route-only |
| AIMS | GRC | `/grc/incidentes?source=aims&handoff=AIMS_INCIDENT_MATERIAL` | `AIMS_INCIDENT_MATERIAL` | Route-only |

Estas rutas no insertan en `governance_module_events`, no insertan en `governance_module_links` y no cambian estado owner. Cualquier write probe futuro requiere paquete de contrato, Cloud/type parity, tests y aprobacion explicita.

## Slice 1 AIMS 2026-05-02 - Handoffs route-only

Se incorpora el mapa pantalla por pantalla de AIMS en `src/lib/aims/readiness.ts` y en `/ai-governance`. Todas las pantallas conectadas actuales quedan declaradas como `legacy_read` sobre `ai_*`; `aims_*` sigue siendo backbone candidato por pantalla o workflow futuro.

Handoffs habilitados en UI sin persistencia compartida:

| Source owner | Target owner | Ruta | Evento futuro | Evidencia | Mutacion actual |
|---|---|---|---|---|---|
| AIMS | GRC | `/grc/risk-360?source=aims&handoff=AIMS_TECHNICAL_FILE_GAP` | `AIMS_TECHNICAL_FILE_GAP` | `NOT_EVIDENCE` | Route-only |
| AIMS | GRC | `/grc/incidentes?source=aims&handoff=AIMS_INCIDENT_MATERIAL` | `AIMS_INCIDENT_MATERIAL` | `NOT_EVIDENCE` | Route-only |
| AIMS | Secretaria | `/secretaria/reuniones/nueva?source=aims&handoff=AIMS_INCIDENT_MATERIAL` | `AIMS_INCIDENT_MATERIAL` | `NOT_EVIDENCE` | Route-only; no crea reunion/acuerdo/acta |
| Secretaria | AIMS | `/secretaria/actas?source=aims&handoff=SECRETARIA_CERTIFICATION_REFERENCE&evidence=REFERENCE` | `SECRETARIA_CERTIFICATION_ISSUED` | `REFERENCE` explicito | Route-only/reference-only |

La referencia Secretaria -> AIMS solo es admisible cuando la postura probatoria esta visible. En Slice 1 se limita a `REFERENCE`; no se presenta como evidencia final, legal hold ni bundle probatorio completo. Estas rutas no insertan en `governance_module_events`, no insertan en `governance_module_links` y no cambian estado owner.

## Plantilla de cierre

```md
Cross-module data contract:
- Source owner:
- Target consumer:
- Event/link required:
- Evidence required:
- Tables:
- Mutation owner:
- Read-only consumers:
- Failure mode:
- Tests/probes:
```
