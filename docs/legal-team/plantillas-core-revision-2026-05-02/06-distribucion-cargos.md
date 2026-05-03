# Plantilla legacy DISTRIBUCION_CARGOS — revisión legal 2026-05-02

**UUID Cloud:** a09cc4bf-c927-470a-b392-43d2db424279
**tipo:** MODELO_ACUERDO
**materia:** DISTRIBUCION_CARGOS
**jurisdiccion:** ES
**organo_tipo actual:** **FALTA**
**adoption_mode actual:** **FALTA**
**version actual:** 1
**estado:** ACTIVA
**aprobada_por:** **PENDIENTE FIRMA LEGAL**
**fecha_aprobacion:** **PENDIENTE FIRMA LEGAL**
**referencia_legal actual:** **FALTA**

## Capa 1 actual (texto inmutable)

```
PRIMERO.- Proceder, en cumplimiento de lo previsto en el artículo 245.2 de la Ley de Sociedades de Capital y en los Estatutos Sociales de {{denominacion_social}}, a la distribución de los cargos entre los miembros del Consejo de Administración, con efectos desde esta fecha, en los siguientes términos:

{{distribucion_cargos_texto}}

SEGUNDO.- Los consejeros designados aceptan expresamente en este acto los cargos que les han sido atribuidos, manifestando no estar incursos en causa de incompatibilidad ni prohibición legal o estatutaria alguna para el ejercicio de los mismos.

TERCERO.- Dejar constancia de que la presente composición del Consejo de Administración cumple con los requisitos establecidos en los Estatutos Sociales, en el Reglamento del Consejo de Administración y con las recomendaciones del Código de Buen Gobierno de las Sociedades Cotizadas aplicables a {{denominacion_social}}.

CUARTO.- Ratificar el nombramiento de {{nombre_secretario_no_consejero}} como Secretario no Consejero del Consejo de Administración de {{denominacion_social}}, con todos los derechos y funciones que corresponden a dicho cargo conforme a los Estatutos Sociales y al Reglamento del Consejo.
```

## Capa 2 actual (variables)

| variable | fuente | condicion |
|---|---|---|
| denominacion_social | entities.name |  |

## Capa 3 actual (campos editables)

| campo | obligatoriedad | descripcion |
|---|---|---|
| distribucion_cargos_texto | requerido=true | Distribución de cargos (presidente, vicepresidentes, vocales, etc.) (textarea) |
| nombre_secretario_no_consejero | requerido=true | Nombre del Secretario no Consejero (text) |

## Lo que el equipo legal tiene que cerrar

- [ ] Validar texto Capa 1 (correcto, vigente, sin nombres reales de cliente).
- [ ] Validar fuentes Capa 2 (todas mapean al resolver actual: entities/agreement/meetings/governing_bodies/persons/capital_holdings/LEY/rule_pack/QTSP/SISTEMA).
- [ ] Validar Capa 3 (obligatoriedades coherentes; sin campos huérfanos respecto a Capa 1).
- [ ] Si organo_tipo actual está FALTA: completar con uno de JUNTA_GENERAL | CONSEJO | CONSEJO_ADMIN | SOCIO_UNICO | ADMIN_UNICO | ADMIN_CONJUNTA | ADMIN_SOLIDARIOS.
- [ ] Si adoption_mode actual está FALTA: completar con uno de MEETING | NO_SESSION | UNIPERSONAL_SOCIO | UNIPERSONAL_ADMIN | CO_APROBACION | SOLIDARIO.
- [ ] Si referencia_legal actual está FALTA: completar con artículos LSC/RRM aplicables.
- [ ] Bumpear version: `0.1.0` → `1.0.0`, `"1"` → `1.0.0`, `1.0.0` → `1.1.0` según corresponda.
- [ ] Firmar: poblar aprobada_por con nombre + colegio + número, fecha_aprobacion con YYYY-MM-DD.

## Riesgos jurídicos detectados

- **organo_tipo NULL**: completar con `CONSEJO_ADMIN`. La distribución de cargos del Consejo es competencia exclusiva del propio Consejo de Administración (art. 245.2 LSC, ya citado en Capa 1).
- **adoption_mode NULL**: completar con `MEETING`.
- **referencia_legal NULL**: el texto Capa 1 cita art. 245.2 LSC. Completar el campo `referencia_legal` con: "Art. 245.2 LSC; arts. 529 sexies–octies LSC (cargos del Consejo en cotizadas); art. 124 RRM (inscripción de cargos)".
- **version: `"1"`**: bumpear a `1.0.0` al firmar.
- **Riesgo redacción cláusula TERCERO:** afirma que la composición "cumple con las recomendaciones del Código de Buen Gobierno de las Sociedades Cotizadas". Esta declaración solo es válida si la entidad es **cotizada**. En sociedades no cotizadas, el texto debería omitir esta referencia o estar condicionado mediante Handlebars `{{#if entidad.cotizada}}`. Plantear desdoblamiento de la plantilla o introducción de bloque condicional.
- **Riesgo redacción cláusula CUARTO:** ratifica al Secretario no Consejero como un acuerdo embebido. Si la entidad tiene **Secretario Consejero** (caso ARGA Seguros donde el secretario suele ser miembro del Consejo, no externo), la cláusula CUARTO genera un acto inexistente o contradictorio. Revisar y, en su caso, hacer condicional con `{{#if existe_secretario_no_consejero}}`.
- Sin variables huérfanas: las 3 variables (`denominacion_social`, `distribucion_cargos_texto`, `nombre_secretario_no_consejero`) están todas declaradas.
- Fuente Capa 2 dentro del resolver canónico (`entities.name`).
- **Mejora sugerida:** considerar fuente automática `governing_bodies.composition` o `condiciones_persona` en vez de textarea libre `distribucion_cargos_texto`. Riesgo actual: el secretario tipea manualmente la composición y desincroniza con el modelo canónico (cap table / mandates).
