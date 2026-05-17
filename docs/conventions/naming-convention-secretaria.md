# Naming Convention — Módulo Secretaría Societaria TGMS

## 1. Principios generales

- La dot-notation es el contrato entre Capa 1 de plantillas, Capa 2 de variables, motor de reglas y frontend.
- Los namespaces de negocio usan snake_case minúscula: `meetings`, `entities`, `agreements`, `governing_bodies`, `persons`, `capital_holdings`, `rule_pack`.
- Los namespaces de infraestructura usan UPPER_CASE: `QTSP`, `SISTEMA`, `MOTOR`.
- Los subdominios usan snake_case: `meetings.junta.*`, `meetings.consejo.*`, `rule_pack.conflictos.*`.
- Los campos de referencia terminan en `_ref`; los descriptivos autogenerados, en `_resumen`; los identificadores, en `_id`.
- Los booleanos empiezan por `es_` o `hay_`.
- Una plantilla firmada no puede renombrar campos sin migración coordinada de plantilla, motor y frontend.

## 2. Catálogo de namespaces

### 2.1 `meetings.*`

- `meetings.junta.*`: juntas generales, incluidas juntas universales.
- `meetings.consejo.*`: consejo de administración.
- `meetings.comision.*`: comisiones delegadas.

### 2.2 `entities.*`

Datos de sociedad: `entities.name`, `entities.es_cotizada`, `entities.datos_registrales_resumen`.

### 2.3 `agreements.*`

Expedientes Acuerdo 360 y referencias a convocatoria cuando exista. En Junta Universal: `agreements.convocatoria = null`.

### 2.4 `governing_bodies.*`

Mesa, órgano y cargos: `governing_bodies.junta.presidente_nombre`, `governing_bodies.junta.secretario_nombre`.

### 2.5 `persons.*`

Personas físicas o jurídicas participantes.

### 2.6 `capital_holdings.*`

Libro vigente de socios/accionistas y derechos de voto.

### 2.7 `rule_pack.*`

- `rule_pack.junta.*`: quórum, capital concurrente y cálculo.
- `rule_pack.consejo.*`: reglas de consejo.
- `rule_pack.conflictos.*`: efecto de conflictos en denominadores.
- `rule_pack.pactos.*`: pactos parasociales y efecto contractual.

### 2.8 `QTSP.*`

Campos de firma y sellado cualificado: `QTSP.firma_secretario_ref`, `QTSP.firma_presidente_ref`, `QTSP.sello_tiempo_ref`.

### 2.9 `SISTEMA.*`

Metadatos operativos: `SISTEMA.lugar_emision`, `SISTEMA.fecha_emision`.

### 2.10 `MOTOR.*`

Salidas internas del motor no expuestas como dato legal final.

## 3. Campos protegidos

| Campo | breaking_change | Consumidores |
|---|---:|---|
| `rule_pack.junta.capital_concurrente_porcentaje` | true | motor, acta, compliance |
| `rule_pack.junta.capital_concurrente_importe` | true | motor, acta |
| `rule_pack.junta.calculo_capital_ref` | true | auditoría, acta |
| `rule_pack.conflictos.estado_resumen` | true | acta, compliance |
| `rule_pack.pactos.estado_resumen` | true | acta, compliance |
| `QTSP.firma_secretario_ref` | true | firma QES, actas, certificaciones |
| `QTSP.firma_presidente_ref` | true | firma QES, actas, certificaciones |
| `QTSP.sello_tiempo_ref` | true | QTSP, evidencias |
| `meetings.junta.puntos[].numero` | true | plantilla `ACTA_SESION` |
| `meetings.junta.puntos[].titulo` | true | plantilla `ACTA_SESION` |
| `meetings.junta.puntos[].texto_acuerdo` | true | plantilla `ACTA_SESION` |
| `meetings.junta.puntos[].votos_favor` | true | plantilla `ACTA_SESION`, motor |
| `meetings.junta.puntos[].agreement_id` | true | Acuerdo 360, certificaciones |

Procedimiento de cambio: PR con label `breaking-naming`, actualización simultánea de plantillas, motor, frontend y aprobación de ingeniería + legal.

## 4. Mapa maestro de campos por módulo

### 4.1 Flujo Junta Universal

| Namespace | Campo | Tipo | Paso | Origen |
|---|---|---|---:|---|
| `meetings.junta` | `fecha` | date | 2 | input usuario |
| `meetings.junta` | `hora_inicio` | time | 2 | input usuario |
| `meetings.junta` | `hora_cierre` | time | 7 | input usuario |
| `meetings.junta` | `lugar` | text | 2 | input usuario |
| `meetings.junta` | `modalidad` | select | 2 | input usuario |
| `meetings.junta` | `es_universal` | boolean/string | 2 | auto `"SÍ"` |
| `meetings.junta` | `orden_del_dia_resumen` | text | 4 | auto |
| `meetings.junta` | `salvedades` | textarea | 7 | input usuario |
| `meetings.junta` | `modo_aprobacion_acta` | select | 7 | input usuario |
| `meetings.junta` | `puntos[]` | array | 4-6 | input/motor |
| `rule_pack.junta` | `capital_concurrente_porcentaje` | number | 3 | calculado |
| `rule_pack.junta` | `capital_concurrente_importe` | currency/number | 3 | calculado |
| `rule_pack.junta` | `calculo_capital_ref` | ref | 3 | auto |
| `rule_pack.conflictos` | `estado_resumen` | text | 5 | motor |
| `rule_pack.pactos` | `estado_resumen` | text | 5 | motor |
| `QTSP` | `firma_secretario_ref` | ref | 7 | firma digital |
| `QTSP` | `firma_presidente_ref` | ref | 7 | firma digital |
| `QTSP` | `sello_tiempo_ref` | ref | 7 | sellado |

Campos de convocatoria omitidos en Junta Universal: `meetings.junta.canal_convocatoria`, `meetings.junta.fecha_convocatoria`, `meetings.junta.publicacion_ref`, `meetings.junta.convocatoria_ordinal`, `meetings.junta.fecha_segunda_convocatoria`, `meetings.junta.hora_segunda_convocatoria`, `agreements.convocatoria.*`.

### 4.2 Flujo Junta con Convocatoria

Usa los mismos campos `meetings.junta.*` más el bloque de convocatoria y trazabilidad de publicación.

### 4.3 Flujo Consejo de Administración

Usa `meetings.consejo.*` y `rule_pack.consejo.*`.

### 4.4 Flujo Comisiones Delegadas

Usa `meetings.comision.*`; voto de calidad deshabilitado salvo pacto/reglamento expreso compatible.

### 4.5 Flujo Socio Único / Admin Único

Usa adoption modes unipersonales; no debe poblar `meetings.junta.puntos[]` salvo acta de socio único.

### 4.6 Flujo Acuerdo Sin Sesión

Usa `agreements.*` y no crea `meetings.*`.

### 4.7 Certificaciones

Consume `agreement_id`, snapshot, `QTSP.*` y evidencia.

### 4.8 Informes preceptivos

Consume `MOTOR.*`, `entities.*`, `agreements.*` y referencias documentales.

## 5. Campos deprecados y migraciones pendientes

| Campo viejo | Campo nuevo | Estado |
|---|---|---|
| `ENTIDAD` | `entities.name` | migrado por resolver |
| `ORGANO` | `governing_bodies.*` | migrado por resolver |
| `var(--g-status-*)` | `var(--status-*)` | deprecado |

## 6. Reglas de extensión

- Añadir campos nuevos solo bajo un namespace existente salvo que exista motivo transversal.
- No renombrar campos protegidos sin label `breaking-naming`.
- Todo campo nuevo usado por Capa 1 debe añadirse también a Capa 2 y al mapa maestro.
- Los campos `QTSP.*` son contrato de integración y no admiten alias locales.

## 7. Ejemplos de payload

### 7.1 Meeting creado tras paso 2

```json
{
  "id": "a1b2c3d4-5678-90ab-cdef-111111111111",
  "entity_id": "arga-seguros-sa-uuid",
  "organo_tipo": "JUNTA_GENERAL",
  "adoption_mode": "MEETING",
  "meetings": {
    "junta": {
      "fecha": "2026-06-15",
      "hora_inicio": "10:00",
      "hora_cierre": null,
      "lugar": "Domicilio social, Calle Demo 1, Madrid",
      "modalidad": "PRESENCIAL",
      "es_universal": "SÍ",
      "canal_convocatoria": null,
      "fecha_convocatoria": null,
      "publicacion_ref": null,
      "convocatoria_ordinal": null,
      "fecha_segunda_convocatoria": null,
      "hora_segunda_convocatoria": null,
      "orden_del_dia_resumen": null,
      "salvedades": null,
      "modo_aprobacion_acta": null,
      "puntos": []
    }
  },
  "agreements": {
    "convocatoria": null
  },
  "normative_snapshot_id": "snap-2026-06-15-arga-sa",
  "estado": "BORRADOR",
  "created_at": "2026-06-15T09:45:00Z"
}
```

### 7.2 Punto del array tras votación

```json
{
  "numero": 1,
  "titulo": "Aprobación de las cuentas anuales del ejercicio 2025",
  "materia": "APROBACION_CUENTAS",
  "texto_acuerdo": "Aprobar las cuentas anuales de ARGA Seguros, S.A. correspondientes al ejercicio cerrado a 31 de diciembre de 2025.",
  "votos_favor": 850000,
  "votos_contra": 0,
  "abstenciones": 0,
  "votos_nulos": 0,
  "mayoria_descripcion": "Mayoría ordinaria (art. 198 LSC): más de la mitad de los votos válidamente emitidos.",
  "rule_pack_ref": "rp-junta-ordinaria-2026-v3",
  "agreement_id": "agr-2026-06-15-punto-1-uuid",
  "proclamacion": "APROBADO"
}
```

### 7.3 Meeting completo pre-render del acta

```json
{
  "id": "a1b2c3d4-5678-90ab-cdef-111111111111",
  "entity_id": "arga-seguros-sa-uuid",
  "organo_tipo": "JUNTA_GENERAL",
  "adoption_mode": "MEETING",
  "meetings": {
    "junta": {
      "fecha": "2026-06-15",
      "hora_inicio": "10:00",
      "hora_cierre": "12:30",
      "lugar": "Domicilio social, Calle Demo 1, Madrid",
      "modalidad": "PRESENCIAL",
      "es_universal": "SÍ",
      "canal_convocatoria": null,
      "fecha_convocatoria": null,
      "publicacion_ref": null,
      "convocatoria_ordinal": null,
      "orden_del_dia_resumen": "1. Aprobación de las cuentas anuales del ejercicio 2025.",
      "salvedades": null,
      "modo_aprobacion_acta": "AL_FINAL_SESION",
      "puntos": [
        {
          "numero": 1,
          "titulo": "Aprobación de las cuentas anuales del ejercicio 2025",
          "materia": "APROBACION_CUENTAS",
          "texto_acuerdo": "Aprobar las cuentas anuales...",
          "votos_favor": 850000,
          "votos_contra": 0,
          "abstenciones": 0,
          "votos_nulos": 0,
          "mayoria_descripcion": "Mayoría ordinaria (art. 198 LSC)",
          "rule_pack_ref": "rp-junta-ordinaria-2026-v3",
          "agreement_id": "agr-2026-06-15-punto-1-uuid",
          "proclamacion": "APROBADO"
        }
      ]
    }
  },
  "rule_pack": {
    "junta": {
      "capital_concurrente_porcentaje": 100,
      "capital_concurrente_importe": 8500000,
      "calculo_capital_ref": "calc-2026-06-15-uuid"
    },
    "conflictos": {
      "estado_resumen": "Sin conflictos declarados"
    },
    "pactos": {
      "estado_resumen": "Sin pactos parasociales relevantes identificados"
    }
  },
  "agreements": {
    "convocatoria": null
  },
  "aceptacion_unanime_orden_dia": {
    "confirmada": true,
    "timestamp": "2026-06-15T10:05:00Z",
    "capital_presente_porcentaje": 100,
    "texto_legal": "Todos los asistentes aceptan por unanimidad la celebración de la Junta y el orden del día propuesto, conforme al artículo 178 de la Ley de Sociedades de Capital."
  },
  "normative_snapshot_id": "snap-2026-06-15-arga-sa",
  "estado": "CERRADO_PENDIENTE_FIRMA",
  "created_at": "2026-06-15T09:45:00Z",
  "closed_at": "2026-06-15T12:30:00Z"
}
```
