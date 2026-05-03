# Índice del paquete de entrega — Comité Legal Garrigues

**Cliente:** Demo ARGA (pseudónimo)
**Estado de evidencia:** demo / operativa
**Fecha de paquete:** 2026-05-02

Este documento es el punto de entrada al paquete de trabajo entregado al Comité Legal Garrigues — Secretaría Societaria. Léelo primero. Después abre los archivos referenciados en el orden indicado.

---

## 1. Documento principal — el encargo formal

Abre primero:

**`2026-05-02-encargo-comite-legal-garrigues.md`**

Es el documento que define qué se le pide al Comité, en qué plazo, con qué constraints, y cómo entregar. Lee las 12 secciones antes de tocar las plantillas individuales.

---

## 2. Recursos para Bloque A — las 17 plantillas legacy

### 2.1. Fichas individuales (una por plantilla)

Directorio: **`plantillas-core-revision-2026-05-02/`**

| Archivo | Materia | Prioridad |
|---|---|---|
| `01-aprobacion-plan-negocio.md` | APROBACION_PLAN_NEGOCIO | Media |
| `02-aumento-capital.md` | AUMENTO_CAPITAL | Alta |
| `03-cese-consejero-consejo.md` | CESE_CONSEJERO (Consejo) | Media |
| `04-cese-consejero-junta.md` | CESE_CONSEJERO (Junta) | Media |
| `05-comites-internos.md` | COMITES_INTERNOS | Alta — completar metadatos null |
| `06-distribucion-cargos.md` | DISTRIBUCION_CARGOS | Alta — completar metadatos null |
| `07-distribucion-dividendos.md` | DISTRIBUCION_DIVIDENDOS | Media |
| `08-fusion-escision.md` | **FUSION_ESCISION** | **CRÍTICA — RDL 5/2023** |
| `09-modificacion-estatutos.md` | MODIFICACION_ESTATUTOS | Alta |
| `10-nombramiento-auditor.md` | NOMBRAMIENTO_AUDITOR | Media |
| `11-nombramiento-consejero-consejo.md` | NOMBRAMIENTO_CONSEJERO (Consejo) | Media |
| `12-nombramiento-consejero-junta.md` | NOMBRAMIENTO_CONSEJERO (Junta) | Media |
| `13-politica-remuneracion.md` | POLITICA_REMUNERACION | Alta — completar metadatos null |
| `14-politicas-corporativas.md` | POLITICAS_CORPORATIVAS | Alta — completar metadatos null |
| `15-ratificacion-actos.md` | **RATIFICACION_ACTOS** | **CRÍTICA — riesgo nulidad** |
| `16-reduccion-capital.md` | REDUCCION_CAPITAL | Alta |
| `17-seguros-responsabilidad.md` | **SEGUROS_RESPONSABILIDAD** | **CRÍTICA — conflicto intra-grupo** |

Cada ficha trae el contenido actual Cloud + checklist específico + área para tu firma.

### 2.2. Mapping consolidado UUID → cierre

**`2026-05-02-plantillas-mapping-uuid-cierre.md`**

Tabla maestra: las 37 plantillas ACTIVAS Cloud con sus UUIDs, versiones, aprobador actual y cobertura por carril (Path A / Path B / núcleo estable). Útil como referencia rápida.

---

## 3. Recursos para Bloque B — revisión del paquete de mejoras

### 3.1. Documento de revisión legal (LEER ESTE) — castellano

**`2026-05-02-bloque-B-revision-castellano.md`**

**Este es el documento que el Comité Legal debe abrir y firmar para Bloque B.** Contiene las 16 plantillas categorizadas en:
- 3 plantillas con texto Capa 1 NUEVO (texto íntegro presentado para validación)
- 13 plantillas con commit formal sin cambio sustantivo (ratificación del Comité sobre el estado actual)

Trae la pregunta jurídica explícita, las opciones de decisión y el formato de respuesta esperado.

### 3.2. Anexo técnico — paquete SQL (NO leer si no eres ingeniería)

**`sql-drafts/2026-05-02-plantillas-core-v2-mejoras.sql`**

94.5 KB. Contiene 16 INSERT en una transacción `BEGIN..COMMIT`. **Es la versión técnica del Bloque B para uso de ingeniería tras la decisión legal.** El Comité Legal NO tiene que abrirlo — su trabajo se cierra en el documento castellano (sección 3.1).

Estado: PROPUESTO, no aplicado. Ingeniería lo ejecuta con credencial admin solo tras la autorización del Comité.

### 3.3. Entregable bruto previo (referencia histórica)

**`2026-05-02-paquete-17-plantillas-entregable-legal.md`**

Es el material original que envió el equipo legal antes de descubrir el mismatch del criterio. Sirve como referencia: las 17 plantillas que se diseñaron entonces, y la nota explícita de que solo POLITICA_REMUNERACION coincide con la lista real legacy.

---

## 4. Prompts para Harvey Assistant

Directorio: **`prompts/`**

| Archivo | Función | Cuándo ejecutar |
|---|---|---|
| `01-version-bump-validator.md` | Valida que cada fila de la Review Table tenga un version bump conforme a regla | A demanda durante el cierre, las veces necesarias |
| `02-pre-export-probe.md` | Bloquea la exportación si hay incumplimientos de los criterios de aceptación | Justo antes del snapshot final, bloqueante hasta verde |

Ambos prompts se archivan en el Space como recursos auditables. Su ejecución queda en el Activity log.

---

## 5. Plan operativo de la revisión

**`../superpowers/plans/2026-05-02-plantillas-core-multiagent-cierre.md`** (un nivel arriba)

Plan maestro de cierre con 13 secciones: contexto, decisión Path A + Path B, ejecución multiagente, hallazgos jurídicos, riesgos, próximos pasos. Lectura de soporte para entender el porqué del paquete.

---

## 6. Brief técnico complementario (opcional)

**`2026-05-02-brief-corregido-17-plantillas-legacy.md`**

Versión técnica del encargo con detalles operativos. Útil si quieres profundizar en glosario de fuentes Capa 2, cómo entregar, criterios de aceptación detallados.

---

## 7. Orden de lectura recomendado

1. **Este índice** — orienta el resto.
2. **Encargo formal** (`2026-05-02-encargo-comite-legal-garrigues.md`) — define la tarea.
3. **Mapping UUID** (`2026-05-02-plantillas-mapping-uuid-cierre.md`) — vista global rápida.
4. **Las 3 fichas críticas primero**: 08, 15, 17.
5. **El SQL packet** (Bloque B) — revisión paralela.
6. **El resto de fichas** según prioridad declarada en cada una.

---

## 8. Workspace operativo

El trabajo se centraliza en un Harvey Shared Space:

**Space:** "TGMS — Cierre Núcleo Plantillas 2026-05"
**Owner:** TGMS (workspace TGMS, residencia de datos en TGMS)
**Acceso para Comité:** colaborador con permisos elevados sobre la Review Table
**Knowledge Sources activadas:** Regional España (BOE, LSC, RRM, RDL 5/2023)
**Web Search:** desactivado

La URL del Space la entregará ingeniería tras ejecutar `View As Collaborator` para validar exposición de recursos.

---

## 9. Plazo y entrega

- **Plazo orientativo:** 3 semanas desde la apertura del Space.
- **Prioridad sugerida:** las 3 críticas en semana 1; metadatos null en semana 2; cierre rutinario en semana 3.
- **Entrega final:** ZIP empaquetado con:
   - Review Table exportada (xlsx) con comentarios incluidos.
   - Activity log per-cell (csv).
   - Vault File Log (csv).
   - Markdown firmado de revisión SQL packet (Bloque B).
   - CSV/JSON de firmas profesionales.

Ingeniería convierte el ZIP a SQL UPDATE y aplica con credencial admin previa `db:check-target`.

---

## 10. Contacto

Cualquier duda jurídica, conflicto entre plantillas, ambigüedad de fuente, o necesidad de coordinación: levantar a equipo de ingeniería TGMS antes de firmar. Es preferible **16 plantillas correctamente cerradas y 1 bloqueada** que 17 cerradas con drift jurídico.
