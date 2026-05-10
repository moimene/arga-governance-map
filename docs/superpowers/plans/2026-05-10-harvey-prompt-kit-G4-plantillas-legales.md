# Harvey Prompt Kit — Cierre G4-G10 plantillas legales

**Destinatario:** Harvey AI (Garrigues), equipo legal externo virtual.
**Operador:** moises.menendez (cliente Garrigues).
**Objetivo:** producir todos los entregables jurídicos + técnicos necesarios
para cerrar el frente G4-G10 (17 plantillas sin firma + 3 críticas + 4 con
problemas técnicos) sin depender de iteración humana, en formato directamente
consumible por ingeniería (SQL ejecutable + JSON metadata).

**Por qué importa:** este informe ordena el cierre estructurado del backlog
operativo. Sin Harvey trabajando en bloques precisos, ingeniería queda
bloqueada en deudas legales que no puede tocar.

---

## Estrategia: 8 bloques secuenciales

Cada bloque es una sesión Harvey separada con input → output. El operador
ejecuta los bloques en orden, valida el output, y pasa al siguiente.

| # | Bloque | Naturaleza | Entregable consumible |
|---|---|---|---|
| **B0** | Pre-extracción (operador, no Harvey) | SQL Cloud | JSON con las 17 plantillas + 3 críticas + 4 técnicas |
| **B1** | Triage y clasificación de las 17 sin firma | Análisis legal | JSON triage por plantilla |
| **B2** | Redacción capa1 corregida y firmada | Redacción jurídica | SQL UPDATE plantillas_protegidas |
| **B3** | G5 — Split FUSION_ESCISION en 4 plantillas | Refactor estructural | SQL INSERT 3 plantillas nuevas + UPDATE original |
| **B4** | G6 — RATIFICACION_ACTOS con lista_actos[] | Capa 3 + plantilla Handlebars | SQL UPDATE + JSON spec Capa 3 |
| **B5** | G7 — SEGUROS_RESPONSABILIDAD dictamen conflicto | Dictamen + redacción | SQL UPDATE lifecycle + texto corregido |
| **B6** | G8/G9/G10 — Saneamiento técnico plantillas | Auditoría técnica | SQL UPDATE por plantilla afectada |
| **B7** | Migration consolidado + checklist | Empaquetado | Script SQL idempotente + JSON resumen |

---

## B0 — Pre-extracción (operador ejecuta antes de invocar Harvey)

**Operador:** ejecutar los siguientes queries vía MCP Supabase contra
`governance_OS` (proyecto `hzqwefkwsxopwrmtksbg`) y guardar el output como
`harvey-input-B0.json`. Esto da a Harvey el material de trabajo.

```sql
-- 17 plantillas ACTIVAS sin firma legal
SELECT
  id, tipo, materia, materia_acuerdo, version, jurisdiction,
  organo_tipo, lifecycle_status, estado,
  aprobada_por, fecha_aprobacion,
  capa1_inmutable, capa2_variables, capa3_editables,
  legal_reference, source_layers
FROM plantillas_protegidas
WHERE estado = 'ACTIVA'
  AND aprobada_por IS NULL
ORDER BY tipo, materia;

-- 3 plantillas CRÍTICAS (G5/G6/G7)
SELECT
  id, tipo, materia, version, jurisdiction,
  capa1_inmutable, capa2_variables, capa3_editables,
  lifecycle_status, aprobada_por
FROM plantillas_protegidas
WHERE materia IN ('FUSION_ESCISION', 'RATIFICACION_ACTOS', 'SEGUROS_RESPONSABILIDAD')
   OR tipo IN ('FUSION_ESCISION', 'RATIFICACION_ACTOS', 'SEGUROS_RESPONSABILIDAD');

-- Plantillas con fuente ENTIDAD no canónica (G8 — 5 candidatas)
SELECT id, tipo, materia, source_layers, capa2_variables
FROM plantillas_protegidas
WHERE source_layers::jsonb @> '["ENTIDAD"]'::jsonb
   OR capa2_variables::text ILIKE '%"fuente":"ENTIDAD"%';

-- Plantillas con potencial duplicidad Capa 2 / Capa 3 (G10)
SELECT id, tipo, materia, capa2_variables, capa3_editables
FROM plantillas_protegidas
WHERE materia IN ('CESE_CONSEJERO', 'NOMBRAMIENTO_CONSEJERO');

-- Rule packs vigentes (contexto legal para Harvey)
SELECT rp.materia, rp.organo_tipo, rp.descripcion,
       rpv.version, rpv.status, rpv.payload->'convocatoria'->>'antelacionMinima' AS antelacion
FROM rule_packs rp
LEFT JOIN rule_pack_versions rpv ON rpv.pack_id = rp.id AND rpv.status = 'ACTIVE'
ORDER BY rp.organo_tipo, rp.materia;
```

Empaquetar el output como JSON estructurado:

```json
{
  "scope": "G4-G10 plantillas legales TGMS Garrigues",
  "fecha_extraccion": "2026-05-10",
  "tenant": "ARGA Seguros (cliente demo)",
  "plantillas_sin_firma": [...17 rows...],
  "plantillas_criticas": [...3 rows G5/G6/G7...],
  "plantillas_fuente_entidad_no_canonica": [...5 rows...],
  "plantillas_capa2_capa3_duplicadas": [...4 rows...],
  "rule_packs_vigentes": [...catálogo motor V2...]
}
```

---

## B1 — PROMPT HARVEY: Triage y clasificación de las 17 plantillas sin firma

```
Eres Harvey, asistente legal de Garrigues trabajando en el frente del
módulo Secretaría Societaria de TGMS para el cliente ARGA Seguros (grupo
asegurador multinacional, ARGA es pseudónimo demo).

CONTEXTO DEL MODELO TGMS (no negociable):
TGMS gestiona documentos societarios con un modelo tri-capa:
  - CAPA 1 INMUTABLE: texto legal nuclear de la plantilla. Inmutable post-firma.
    Lo redactas tú (Garrigues) y queda fijo. Variables tipo {{nombre_var}}.
  - CAPA 2 VARIABLES: variables auto-resueltas desde fuentes canónicas
    (entities.legal_name, persons.full_name, capital_holdings.porcentaje, etc.)
    al renderizar el documento. NO requieren input usuario.
  - CAPA 3 EDITABLES: campos que el secretario rellena al generar el
    documento concreto (e.g., orden_dia_texto, importe, fecha específica).

Cada plantilla en `plantillas_protegidas` tiene:
  - capa1_inmutable: TEXT (Handlebars con {{var}})
  - capa2_variables: JSONB array [{nombre, fuente, ruta_dotted, tipo}, ...]
  - capa3_editables: JSONB array [{nombre, label, tipo, requerido, validacion}, ...]
  - aprobada_por: TEXT (Comité Legal — null = pendiente firma)
  - lifecycle_status: ACTIVE | LEGAL_REVIEW | UNDER_REVIEW | DEPRECATED

OBJETIVO DEL BLOQUE B1:
Triage de 17 plantillas ACTIVAS sin firma legal (aprobada_por IS NULL).
Clasificar cada una y producir veredicto de prioridad de firma.

INPUT: archivo harvey-input-B0.json (te lo paso adjunto).

ENTREGABLE B1 (JSON estructurado, sin prosa innecesaria):
{
  "triage": [
    {
      "id": "<plantilla_id>",
      "tipo": "<CONVOCATORIA | ACTA | CERTIFICACION | TRAMITACION | OTROS>",
      "materia": "<APROBACION_CUENTAS | etc.>",
      "estado_redaccion": "<APROBABLE_TAL_CUAL | REQUIERE_CORRECCIONES | DEFECTUOSA>",
      "issues_identificados": [
        "Cita LSC desactualizada (dice art. X, debería art. Y)",
        "Falta cláusula obligatoria art. Z LSC",
        "Variable {{X}} sin declaración Capa 2"
      ],
      "fundamento_legal_aplicable": [
        "art. 173 LSC para convocatoria SA",
        "art. 286 LSC para mod estatutos"
      ],
      "prioridad_firma": "<P0_BLOQUEANTE | P1_IMPORTANTE | P2_NORMAL>",
      "recomendacion": "<APROBAR_TRAS_CORRECCION_B2 | APROBAR_INMEDIATAMENTE | RECHAZAR_REDACTAR_DESDE_CERO>"
    }
    // ... 17 entries
  ],
  "resumen_ejecutivo": {
    "aprobables_inmediato": <count>,
    "requieren_correccion": <count>,
    "redactar_desde_cero": <count>,
    "comentario_general": "..."
  }
}

CONSTRAINTS:
- Trabaja exclusivamente con LSC vigente (RDL 1/2010 + modificaciones), RDL
  5/2023 para operaciones estructurales, RRM, RD 1784/1996.
- Para SA: arts. 159-204 LSC. Para SL: arts. 157-204 LSC.
- Multi-jurisdicción: foco principal ES; PT/BR/MX se marcan como
  "deferred_post_es" si la plantilla es multi-jurisdiccional.
- Sé adversarial: no aprueves redacciones que no cumplan estándar Garrigues.
- No produzcas prosa explicativa fuera del JSON.

Devuelve el JSON completo con el triage de las 17 plantillas.
```

---

## B2 — PROMPT HARVEY: Redacción capa1 corregida + firma legal

```
Continuamos del bloque B1 anterior. Ahora produces la redacción corregida
de cada plantilla y la firmas como Comité Legal Garrigues.

INPUT:
- harvey-input-B0.json (las 17 plantillas con su capa1 actual)
- harvey-output-B1.json (tu triage del bloque anterior)

OBJETIVO DEL BLOQUE B2:
Para cada plantilla con estado_redaccion ∈ {APROBABLE_TAL_CUAL,
REQUIERE_CORRECCIONES}:
  - Si APROBABLE_TAL_CUAL: dejar capa1 igual, solo firmar.
  - Si REQUIERE_CORRECCIONES: redactar versión corregida que cierre los
    issues_identificados.

Para plantillas con estado DEFECTUOSA: NO se firman en B2. Quedan para
redacción desde cero en bloque dedicado posterior.

ENTREGABLE B2 (SQL ejecutable + JSON metadata):

SQL block (un archivo .sql):
```sql
-- Plantilla 1: <id> — <materia>
UPDATE plantillas_protegidas
SET
  capa1_inmutable = $$
<TEXTO HANDLEBARS COMPLETO CORREGIDO>
$$,
  version = '<bumped_version>',
  aprobada_por = 'Comité Legal Garrigues — Harvey AI v2026.05',
  fecha_aprobacion = '2026-05-10',
  legal_reference = '<art. LSC + RDL aplicables>'
WHERE id = '<plantilla_id>';

-- Plantilla 2: ...
```

JSON metadata (harvey-output-B2.json):
{
  "plantillas_firmadas": [
    {
      "id": "<plantilla_id>",
      "version_anterior": "1.0.0",
      "version_nueva": "1.1.0",
      "cambios_aplicados": [
        "Actualizada cita art. 286 LSC a redacción RDL 5/2023",
        "Añadida cláusula notificación ERDS"
      ],
      "diff_summary": "+12 lines / -3 lines",
      "fundamento_firma": "Cumple art. X LSC vigente y estándar Garrigues plantillas societarias 2026"
    }
    // ...
  ],
  "plantillas_diferidas_a_redaccion_completa": [...]
}

REGLAS DE REDACCIÓN HANDLEBARS TGMS:
- Variables Capa 2: usar {{nombre_var}}. Lista esperada (no exhaustiva):
  {{denominacion_social}}, {{cif}}, {{domicilio_social}}, {{registro_mercantil}},
  {{organo_nombre}}, {{fecha}}, {{presidente}}, {{secretario}}, {{lugar}},
  {{ciudad_emision}}, {{fecha_emision}}, {{materia_acuerdo}}, {{texto_acuerdo}}.
- Variables Capa 3: declaradas explícitamente en cada plantilla. Ej:
  {{importe}}, {{beneficiario}}, {{fecha_efectos}}.
- Bloques condicionales: {{#if es_cotizada}}...{{/if}}.
- Loops: {{#each acuerdos}} {{titulo}} {{/each}}.
- Si añades una variable nueva, declárala en capa2_variables o capa3_editables
  según naturaleza (auto-resoluble vs input usuario).

VERSIONING:
- Bump minor (1.0.0 → 1.1.0) si correcciones menores.
- Bump major (1.x → 2.0.0) si cambias estructura del documento.

CONSTRAINTS LEGALES (no negociables):
- Cita LSC siempre actualizada a versión vigente 2026-05.
- Para operaciones estructurales (FUSION/ESCISION/TRANSFORMACION/DISOLUCION),
  citar RDL 5/2023 + arts. específicos LMESM.
- Para sociedades cotizadas, añadir referencias LMV cuando aplique.
- Para grupos de seguros, art. 14 LOSSEAR (operaciones intragrupo) cuando
  haya conflicto de interés.

Devuelve el SQL completo + JSON metadata de las plantillas firmadas.
```

---

## B3 — PROMPT HARVEY: G5 split FUSION_ESCISION en 4 plantillas

```
Plantilla actual FUSION_ESCISION es genérica para 4 operaciones
estructurales distintas (fusión, escisión, transformación, disolución) con
cita LSC genérica en lugar de RDL 5/2023 vigente.

OBJETIVO DEL BLOQUE B3:
Producir 4 plantillas dedicadas con redacción específica:
  - FUSION (art. 22-67 LMESM / RDL 5/2023)
    * Distinguir fusión por absorción / fusión propiamente dicha
  - ESCISION (art. 68-80 LMESM)
    * Distinguir escisión total / escisión parcial / segregación
  - TRANSFORMACION (art. 4-21 LMESM)
    * Cambio de tipo social
  - DISOLUCION (art. 360-400 LSC)
    * Causas legales / estatutarias / por acuerdo JG

INPUT:
- harvey-input-B0.json sección plantillas_criticas → FUSION_ESCISION actual
- Catálogo materia_catalog (te indico las materias canónicas):
  FUSION, ESCISION, TRANSFORMACION, DISOLUCION, LIQUIDACION (esta última
  separada de DISOLUCION).

ENTREGABLE B3 (SQL + JSON):

SQL:
```sql
-- Marcar la plantilla FUSION_ESCISION genérica como DEPRECATED
UPDATE plantillas_protegidas
SET lifecycle_status = 'DEPRECATED',
    estado = 'DEPRECATED'
WHERE id = '<id_fusion_escision_generica>';

-- Insertar 4 plantillas nuevas (una por operación)
INSERT INTO plantillas_protegidas
  (id, tenant_id, tipo, materia, version, jurisdiction, organo_tipo,
   estado, lifecycle_status, capa1_inmutable, capa2_variables,
   capa3_editables, aprobada_por, fecha_aprobacion, legal_reference)
VALUES
  -- FUSION
  (gen_random_uuid(), '00000000-...-001', 'ACTA_ACUERDO', 'FUSION',
   '1.0.0', 'ES', 'JUNTA_GENERAL', 'ACTIVA', 'ACTIVE',
   $$<texto handlebars FUSION>$$,
   '[{...capa2 fusion}]'::jsonb,
   '[{...capa3 fusion}]'::jsonb,
   'Comité Legal Garrigues — Harvey AI v2026.05',
   '2026-05-10',
   'art. 22-67 LMESM (RDL 5/2023) + art. 30-44 LSC para SA'),
  -- ESCISION
  (...),
  -- TRANSFORMACION
  (...),
  -- DISOLUCION
  (...);

-- Insertar (si no existen) rule packs específicos
-- (verificar primero si seed ya tiene FUSION/ESCISION/etc. con organo_tipo='JUNTA_GENERAL')
```

JSON (harvey-output-B3.json):
{
  "operacion": "split_FUSION_ESCISION",
  "plantilla_origen_deprecated": "<id genérica>",
  "plantillas_nuevas": [
    {
      "operacion": "FUSION",
      "id": "<uuid>",
      "subtipos_cubiertos": ["fusion_por_absorcion", "fusion_propiamente_dicha"],
      "fundamento_legal": "RDL 5/2023 LMESM arts. 22-67 + LSC arts. 30-44",
      "capa3_distintiva": [
        {"nombre": "tipo_fusion", "tipo": "select", "options": ["ABSORCION","PROPIAMENTE_DICHA"]},
        {"nombre": "sociedades_absorbidas", "tipo": "array", "min": 1},
        {"nombre": "tipo_canje", "tipo": "select", "options": ["ACCIONES","DINERARIO_MIXTO"]}
      ]
    },
    // ESCISION, TRANSFORMACION, DISOLUCION...
  ],
  "rule_packs_requeridos": [
    {"materia": "FUSION", "organo_tipo": "JUNTA_GENERAL", "ya_existe": true},
    {"materia": "ESCISION", "organo_tipo": "JUNTA_GENERAL", "ya_existe": true},
    {"materia": "TRANSFORMACION", "organo_tipo": "JUNTA_GENERAL", "ya_existe": true},
    {"materia": "DISOLUCION", "organo_tipo": "JUNTA_GENERAL", "ya_existe": true}
  ],
  "migration_strategy": "Plantillas antiguas con materia=FUSION_ESCISION siguen
                        siendo legibles pero no se ofrecen para nuevos documentos.
                        Documentos ya generados pre-split conservan su versión."
}

Devuelve SQL + JSON.
```

---

## B4 — PROMPT HARVEY: G6 RATIFICACION_ACTOS con lista_actos[]

```
Plantilla actual RATIFICACION_ACTOS no captura el listado concreto de actos
a ratificar — riesgo de nulidad por indeterminación (art. 1261 CC + jurisp.
TS sobre concreción del consentimiento contractual).

OBJETIVO DEL BLOQUE B4:
Diseñar campo Capa 3 OBLIGATORIO `lista_actos[]` (array repeatable) +
plantilla actualizada con loop Handlebars.

ENTREGABLE B4 (SQL + JSON spec):

JSON spec del campo Capa 3:
{
  "campo": "lista_actos",
  "tipo": "array_repeatable",
  "min_items": 1,
  "max_items": null,
  "label": "Lista de actos a ratificar",
  "help_text": "Cada acto debe identificarse de forma concreta: fecha, descripción, contraparte, importe.",
  "item_schema": {
    "fecha_acto": {
      "tipo": "date",
      "requerido": true,
      "label": "Fecha del acto"
    },
    "descripcion": {
      "tipo": "textarea",
      "requerido": true,
      "min_length": 20,
      "label": "Descripción del acto",
      "help_text": "Naturaleza del contrato/decisión. Ej: 'Contrato arrendamiento oficina C/Mayor 5'"
    },
    "contraparte": {
      "tipo": "text",
      "requerido": true,
      "label": "Contraparte / beneficiario"
    },
    "importe": {
      "tipo": "currency",
      "requerido": false,
      "label": "Importe (si económicamente cuantificable)"
    },
    "fundamento_acto": {
      "tipo": "select",
      "requerido": true,
      "options": ["GESTION_ORDINARIA", "ACTO_NEGOCIO_NO_RATIFICADO_PREVIAMENTE", "ACTO_REPRESENTANTE_SIN_PODER"],
      "label": "Tipo de acto a ratificar"
    }
  }
}

SQL UPDATE:
UPDATE plantillas_protegidas
SET
  capa1_inmutable = $$
<TEXTO con loop:
  {{#each lista_actos}}
    {{@index_plus_one}}. Acto de fecha {{fecha_acto}}: {{descripcion}}
       Contraparte: {{contraparte}}
       {{#if importe}}Importe: {{importe}}.{{/if}}
       Fundamento: {{fundamento_acto_label}}.
  {{/each}}
>
$$,
  capa3_editables = jsonb_set(
    capa3_editables,
    '{lista_actos}',
    '<JSON spec arriba>'::jsonb
  ),
  version = '1.1.0',
  aprobada_por = 'Comité Legal Garrigues — Harvey AI v2026.05',
  fecha_aprobacion = '2026-05-10',
  legal_reference = 'art. 1261 CC + jurisprudencia TS Sala 1ª s. 12/03/2019'
WHERE materia = 'RATIFICACION_ACTOS';

VALIDACIÓN:
- Mínimo 1 acto en lista_actos.
- Cada acto debe tener fecha + descripción mínima 20 chars + contraparte + fundamento.
- Si fundamento_acto = 'ACTO_REPRESENTANTE_SIN_PODER', advertir que la
  ratificación tiene efectos retroactivos según art. 1259 CC.

Devuelve SQL + JSON.
```

---

## B5 — PROMPT HARVEY: G7 SEGUROS_RESPONSABILIDAD dictamen conflicto intra-grupo

```
La plantilla SEGUROS_RESPONSABILIDAD tiene conflicto intra-grupo ARGA sin
resolver. Como cliente de seguros, ARGA está sometido a:
  - art. 14 LOSSEAR (operaciones intragrupo en aseguradoras)
  - Reglamento Solvencia II
  - Directrices DGSFP (Dirección General de Seguros y Fondos de Pensiones)

OBJETIVO DEL BLOQUE B5:
Producir:
  1. Dictamen jurídico Garrigues sobre el conflicto.
  2. Decisión: marcar la plantilla actual como UNDER_REVIEW.
  3. Si es viable, redacción correctiva con cláusula intra-grupo (declaración
     conflicto + autorización formal CdA + reporting DGSFP).

INPUT:
- harvey-input-B0.json sección plantillas_criticas → SEGUROS_RESPONSABILIDAD
- Estructura grupo ARGA Seguros: Fundación → Cartera ARGA SLU (100%) →
  ARGA Seguros SA (69.69%, free float 30.31%). Más detalles en CLAUDE.md.

ENTREGABLE B5 (Dictamen + SQL):

DICTAMEN (max 2 páginas, formato legal Garrigues):
- Marco normativo aplicable
- Identificación del conflicto en la plantilla actual
- Riesgo regulatorio (DGSFP) + civil (impugnación contrato seguro)
- Opciones: (a) DEPRECATE definitivo (b) REDACCIÓN CORREGIDA con safeguards
- Recomendación motivada

SQL (depende de la opción elegida):

Opción A — DEPRECATE:
UPDATE plantillas_protegidas
SET lifecycle_status = 'UNDER_REVIEW',
    estado = 'INACTIVA',
    aprobada_por = NULL,  -- explícito: no firmada
    legal_reference = 'Pendiente revisión por conflicto art. 14 LOSSEAR'
WHERE materia = 'SEGUROS_RESPONSABILIDAD';

Opción B — REDACCIÓN CORREGIDA:
UPDATE plantillas_protegidas
SET capa1_inmutable = $$
<TEXTO con cláusula intra-grupo:
  - Declaración conflicto art. 14 LOSSEAR
  - Autorización CdA con quórum reforzado
  - Indicación reporting DGSFP en plazo (días específicos)
  - Cláusula precio de mercado independiente (third-party valuation)
>
$$,
  version = '1.1.0',
  aprobada_por = 'Comité Legal Garrigues — Harvey AI v2026.05 (con safeguards intragrupo)',
  fecha_aprobacion = '2026-05-10',
  legal_reference = 'art. 14 LOSSEAR + Solvencia II RD 1060/2015'
WHERE materia = 'SEGUROS_RESPONSABILIDAD';

JSON (harvey-output-B5.json):
{
  "decision": "<DEPRECATE | REDACCION_CORREGIDA>",
  "fundamento": "<resumen ejecutivo>",
  "dictamen_completo": "<2 páginas formato Garrigues>",
  "salvaguardas_aplicadas": [
    "Declaración conflicto",
    "Autorización CdA quórum reforzado",
    "Reporting DGSFP",
    "Valuation independiente"
  ],
  "siguiente_paso_legal": "<reportar a DGSFP en X días | ninguno>"
}

Devuelve dictamen completo + SQL + JSON.
```

---

## B6 — PROMPT HARVEY: G8/G9/G10 saneamiento técnico plantillas

```
3 categorías de problemas técnicos detectados en la auditoría TGMS:

  G8 — 5 plantillas con fuente `ENTIDAD` no canónica:
    AUMENTO_CAPITAL, DISTRIBUCION_DIVIDENDOS, MODIFICACION_ESTATUTOS,
    NOMBRAMIENTO_AUDITOR, + 1 (ver harvey-input-B0.json sección
    plantillas_fuente_entidad_no_canonica).
    → La fuente declarada es 'ENTIDAD' literal en lugar de dotted paths
    canónicos como 'entities.legal_name', 'entities.cif', etc.

  G9 — 2 plantillas con variables Capa 2 declaradas sin uso en Capa 1:
    DISTRIBUCION_DIVIDENDOS (denominacion_social) y REDUCCION_CAPITAL
    (tipo_social).
    → Ruido en el composer, campos vacíos sin propósito.

  G10 — 4 plantillas con duplicidad Capa 2/Capa 3 (CESE_CONSEJERO ×2,
    NOMBRAMIENTO_CONSEJERO ×2):
    → La misma variable declarada en auto-resolver Capa 2 y como input
    Capa 3. Comportamiento de precedencia indefinido.

OBJETIVO DEL BLOQUE B6:
Saneamiento por plantilla con SQL específico.

ENTREGABLES:

G8 — Reescritura de fuentes:
SQL UPDATE por plantilla:
UPDATE plantillas_protegidas
SET capa2_variables = $$
[
  {"nombre": "denominacion_social", "fuente": "entities.legal_name", "tipo": "string"},
  {"nombre": "cif", "fuente": "entities.cif", "tipo": "string"},
  ...
]
$$::jsonb
WHERE id = '<id>';

G9 — Eliminación de variables huérfanas o referenciación en Capa 1:
Decisión por plantilla:
  - Si la variable NO se usa: eliminarla de capa2_variables
  - Si debería usarse: añadirla al texto de capa1_inmutable

JSON ranking:
{
  "plantilla_id": "<id>",
  "variable_huerfana": "denominacion_social",
  "decision": "<ELIMINAR | REFERENCIAR_EN_CAPA1>",
  "patch_sql": "<UPDATE específico>"
}

G10 — Contrato de precedencia:
Decidir contractualmente (recomendación: Capa 3 SIEMPRE gana cuando ambas
declaradas — input usuario explícito > auto-resolver).

JSON spec del contrato:
{
  "regla_precedencia": "Si una variable está declarada en BOTH capa2_variables Y
                        capa3_editables, prevalece el valor introducido por el
                        usuario en Capa 3. El resolver Capa 2 sigue computando
                        el valor canónico pero queda como sugerencia/default.",
  "implementacion_motor_plantillas": "src/lib/motor-plantillas/composer.ts línea
                                       ~mergedVariables debe priorizar capa3Values
                                       sobre capa2 resolved.",
  "plantillas_afectadas_a_limpiar": [
    {"id": "<>", "variables_duplicadas": ["nombre_consejero","cargo"]},
    ...
  ],
  "patch_sql_consolidado": "<UPDATE para eliminar duplicados según contrato>"
}

Devuelve SQL consolidado + JSON ranking + JSON contrato.
```

---

## B7 — PROMPT HARVEY: Migration consolidado + checklist final

```
Bloque final: empaquetar todos los SQL de B2-B6 en un script único
idempotente y producir checklist de validación post-migration.

INPUT:
- harvey-output-B2.json + B3.json + B4.json + B5.json + B6.json

ENTREGABLE B7 (Script SQL maestro + JSON checklist):

Script SQL:
```sql
-- ============================================================
-- Harvey Migration G4-G10 — plantillas legales
-- Fecha: 2026-05-10
-- Origen: Cierre estructurado del frente legal Garrigues
-- Operador: moises.menendez
-- ============================================================

BEGIN;

-- =============== B2: 17 plantillas firmadas ===============
-- (auto-generado desde harvey-output-B2.json)
UPDATE plantillas_protegidas SET ...
WHERE id = '<>'  AND aprobada_por IS NULL;
-- ... 17 updates

-- =============== B3: G5 split FUSION_ESCISION ===============
UPDATE plantillas_protegidas SET lifecycle_status = 'DEPRECATED', estado = 'DEPRECATED'
WHERE id = '<id_fusion_escision_generica>';

INSERT INTO plantillas_protegidas (...) VALUES
  (..., 'FUSION', ...),
  (..., 'ESCISION', ...),
  (..., 'TRANSFORMACION', ...),
  (..., 'DISOLUCION', ...);

-- =============== B4: G6 RATIFICACION_ACTOS lista_actos ===============
UPDATE plantillas_protegidas SET ...
WHERE materia = 'RATIFICACION_ACTOS';

-- =============== B5: G7 SEGUROS_RESPONSABILIDAD ===============
UPDATE plantillas_protegidas SET ...
WHERE materia = 'SEGUROS_RESPONSABILIDAD';

-- =============== B6: G8 fuentes ENTIDAD canónicas ===============
UPDATE plantillas_protegidas SET capa2_variables = ...
WHERE id IN ('<id_1>', '<id_2>', '<id_3>', '<id_4>', '<id_5>');

-- =============== B6: G9 variables Capa 2 huérfanas ===============
UPDATE plantillas_protegidas SET capa2_variables = ...
WHERE id IN ('<id_distribucion_dividendos>', '<id_reduccion_capital>');

-- =============== B6: G10 limpieza duplicidad Capa 2/3 ===============
UPDATE plantillas_protegidas SET capa2_variables = ..., capa3_editables = ...
WHERE id IN ('<cese_1>', '<cese_2>', '<nombramiento_1>', '<nombramiento_2>');

COMMIT;
```

Checklist post-migration (JSON):
{
  "verifications": [
    {
      "step": "Plantillas firmadas",
      "query": "SELECT COUNT(*) FROM plantillas_protegidas WHERE estado='ACTIVA' AND aprobada_por IS NULL;",
      "expected": 0,
      "explicacion": "0 plantillas ACTIVAS sin firma post-migration"
    },
    {
      "step": "Split FUSION_ESCISION",
      "query": "SELECT materia, COUNT(*) FROM plantillas_protegidas WHERE materia IN ('FUSION','ESCISION','TRANSFORMACION','DISOLUCION') AND estado='ACTIVA' GROUP BY materia;",
      "expected": "4 rows con count >= 1",
      "explicacion": "Las 4 plantillas dedicadas existen y están activas"
    },
    {
      "step": "RATIFICACION_ACTOS lista_actos",
      "query": "SELECT capa3_editables->'lista_actos' FROM plantillas_protegidas WHERE materia='RATIFICACION_ACTOS' AND estado='ACTIVA';",
      "expected": "JSONB no null con tipo='array_repeatable' min_items=1",
      "explicacion": "Campo Capa 3 lista_actos correctamente declarado"
    },
    {
      "step": "SEGUROS_RESPONSABILIDAD UNDER_REVIEW",
      "query": "SELECT lifecycle_status FROM plantillas_protegidas WHERE materia='SEGUROS_RESPONSABILIDAD';",
      "expected": "'UNDER_REVIEW' o 'ACTIVE' con redaccion corregida",
      "explicacion": "Decisión B5 reflejada"
    },
    {
      "step": "Fuentes ENTIDAD canónicas",
      "query": "SELECT COUNT(*) FROM plantillas_protegidas WHERE capa2_variables::text ILIKE '%\"fuente\":\"ENTIDAD\"%';",
      "expected": 0,
      "explicacion": "Ninguna fuente literal 'ENTIDAD' — todas dotted paths"
    }
  ],
  "rollback_plan": {
    "estrategia": "Backup pre-migration de plantillas_protegidas + audit_log entries",
    "sql_backup": "CREATE TABLE plantillas_protegidas_backup_20260510 AS SELECT * FROM plantillas_protegidas;",
    "sql_rollback": "TRUNCATE plantillas_protegidas; INSERT INTO plantillas_protegidas SELECT * FROM plantillas_protegidas_backup_20260510;",
    "irreversible_si": "Documentos generados post-migration con nuevos hashes"
  },
  "siguiente_paso_ingenieria": [
    "1. Aplicar migration vía MCP Supabase",
    "2. Ejecutar 5 verifications del checklist",
    "3. Si todas OK → marcar G4-G10 como cerrado en docs/superpowers/plans/",
    "4. UI marker 'Pendiente firma' deja de ser visible (todas firmadas)",
    "5. AcuerdosSinSesion catálogo se beneficia de las 4 plantillas split B3"
  ]
}

Devuelve script SQL completo + checklist JSON.
```

---

## Operador — flujo final post-Harvey

1. Ejecutar B0 (extracción SQL Cloud, generar `harvey-input-B0.json`).
2. Pasar `harvey-input-B0.json` + prompt B1 a Harvey → recibir `harvey-output-B1.json`.
3. Pasar B1+B2 prompts → recibir SQL B2 + JSON.
4. Iterar B3, B4, B5, B6 secuencialmente.
5. Pasar todos los outputs B2-B6 al prompt B7 → recibir migration consolidado + checklist.
6. Validar SQL en sandbox antes de aplicar a Cloud.
7. Aplicar migration consolidada con backup previo (`plantillas_protegidas_backup_20260510`).
8. Ejecutar las 5 verifications.
9. Si OK → ingeniería avanza con UI marker "Pendiente firma" que deja de aplicar.

## Restricciones operativas (recordatorios para Harvey)

- **No prosa innecesaria fuera del JSON / SQL pedido.**
- **Versionado semántico**: minor para correcciones, major para cambios estructurales.
- **Idempotencia**: el SQL debe poder ejecutarse 2 veces sin error (usar `WHERE
  aprobada_por IS NULL` o INSERTs con `ON CONFLICT DO NOTHING`).
- **Citación legal**: siempre actualizada (LSC vigente, RDL 5/2023 LMESM,
  RD 1060/2015 Solvencia II, etc.).
- **Trazabilidad**: cada UPDATE debe incluir bump de versión + nuevo
  `fecha_aprobacion` + `aprobada_por='Comité Legal Garrigues — Harvey AI v2026.05'`.
- **Multi-jurisdicción**: foco ES; PT/BR/MX se difieren marcando
  `pending_jurisdictions=['PT','BR','MX']` en metadata.

## Glosario rápido para Harvey

| Término TGMS | Significado |
|---|---|
| **Capa 1 inmutable** | Texto Handlebars firmado por el Comité Legal. No se modifica post-firma. |
| **Capa 2 variables** | Variables auto-resueltas desde DB (entities, persons, etc.). |
| **Capa 3 editables** | Inputs del secretario al generar el documento. |
| **plantillas_protegidas** | Tabla DB con plantillas tri-capa. |
| **rule_packs** | Catálogo de reglas LSC del motor V2 por materia + órgano. |
| **TGMS** | The Governance Management Suite (plataforma TGMS Garrigues). |
| **ARGA Seguros** | Pseudónimo demo del cliente real (no usar nombre real). |
| **G4-G10** | IDs internos de los hallazgos legales identificados en auditoría. |
