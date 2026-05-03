# Plantilla legacy POLITICA_REMUNERACION — revisión legal 2026-05-02

**UUID Cloud:** ee72efde-299b-42fc-86ba-57e29a187a7c
**tipo:** MODELO_ACUERDO
**materia:** POLITICA_REMUNERACION
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
PRIMERO.- Aprobar la Política de Remuneraciones de los Consejeros de {{denominacion_social}} para el período {{periodo_aplicacion}}, cuyo texto íntegro se adjunta como Anexo I al acta de la presente sesión, de conformidad con lo previsto en el artículo 529 novodecies de la Ley de Sociedades de Capital y las recomendaciones del Código de Buen Gobierno de las Sociedades Cotizadas.

SEGUNDO.- La Política de Remuneraciones aprobada establece los siguientes elementos retributivos para los consejeros en su condición de tales: {{elementos_retributivos}}.

TERCERO.- La remuneración máxima anual del conjunto de los administradores en su condición de tales, que deberá ser aprobada por la Junta General de Accionistas, asciende a {{retribucion_maxima_total}} euros.

CUARTO.- La presente Política de Remuneraciones será de aplicación a los acuerdos de remuneración adoptados durante su período de vigencia y sustituye a la Política de Remuneraciones anteriormente vigente.

QUINTO.- Facultar al Consejo de Administración para aplicar la presente Política, adoptando en su seno los acuerdos individuales de remuneración que correspondan a cada consejero en los términos de la misma.
```

## Capa 2 actual (variables)

| variable | fuente | condicion |
|---|---|---|
| denominacion_social | entities.name |  |

## Capa 3 actual (campos editables)

| campo | obligatoriedad | descripcion |
|---|---|---|
| periodo_aplicacion | requerido=true | Período de aplicación de la política (text) |
| elementos_retributivos | requerido=true | Elementos retributivos (asignación fija, variable, dietas, etc.) (textarea) |
| retribucion_maxima_total | requerido=true | Remuneración máxima total anual (euros) (text) |

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

- **organo_tipo NULL**: completar con `JUNTA_GENERAL`. La aprobación de la Política de Remuneraciones de Consejeros en sociedades cotizadas es competencia exclusiva de la Junta (art. 529 novodecies LSC, citado en Capa 1). Para sociedades no cotizadas, la materia podría ser `CONSEJO_ADMIN` con acuerdo posterior de la Junta sobre el importe máximo (art. 217.3 LSC).
- **adoption_mode NULL**: completar con `MEETING`.
- **referencia_legal NULL**: bloque crítico. Sugerencia: "Art. 217 LSC (remuneración general); art. 218 LSC (participación en beneficios); art. 219 LSC (entrega de acciones); arts. 529 sexdecies–novodecies LSC (remuneración consejeros cotizadas); Código de Buen Gobierno CNMV (Recomendaciones 53-65)". Para sector seguros añadir Solvencia II Pilar 3 sobre remuneración variable.
- **Plantilla restringida a sociedades cotizadas:** la cláusula PRIMERO cita expresamente "art. 529 novodecies LSC" (aplicable solo a cotizadas) y "Código de Buen Gobierno de las Sociedades Cotizadas". Si la entidad NO es cotizada, el acuerdo es jurídicamente correcto pero el texto inmutable contiene referencias inadecuadas. Solución: desdoblar plantilla en (a) cotizadas y (b) no cotizadas, o hacer condicional Handlebars.
- **version: `"1"`**: bumpear a `1.0.0` al firmar.
- **Riesgo cláusula CUARTO:** afirma que la nueva política "sustituye a la Política de Remuneraciones anteriormente vigente". Si la entidad NO tenía política anterior (primera aprobación), la cláusula es incorrecta. Considerar bloque condicional Handlebars.
- **Cláusula QUINTO** delega en el Consejo la aplicación individual. Esto es coherente con art. 529 octodecies LSC (Comisión de Nombramientos y Retribuciones). Pero el texto debería referirse explícitamente a la **CNyR** o, en el caso de ARGA Seguros, al Comité de Retribuciones, en lugar de "el Consejo de Administración". Considerar mejora.
- **Riesgo importes en formato `text`:** `retribucion_maxima_total` es `text` cuando debería ser `number`. El secretario podría introducir "4 millones" en vez de `4000000`, generando ambigüedad. Cambiar a `number`.
- Sin variables huérfanas: las 4 placeholders están todas declaradas.
- Fuente Capa 2 dentro del resolver canónico (`entities.name`).
- **Recordatorio Sprint demo ARGA:** los valores demo (techo JGA 4M€, ILP 2026-2028, etc.) están documentados en `docs/superpowers/specs/2026-04-19-decisiones-legales-motor-lsc-resueltas.md` (DL-6). Verificar que la plantilla puede acomodar esos parámetros del demo en runtime.
