# Plantilla legacy REDUCCION_CAPITAL — revisión legal 2026-05-02

**UUID Cloud:** c06957aa-ce9d-4560-9d4e-501756ed5e4f
**tipo:** MODELO_ACUERDO
**materia:** REDUCCION_CAPITAL
**jurisdiccion:** ES
**organo_tipo actual:** JUNTA_GENERAL
**adoption_mode actual:** MEETING
**version actual:** 0.1.0
**estado:** ACTIVA
**aprobada_por:** **PENDIENTE FIRMA LEGAL**
**fecha_aprobacion:** **PENDIENTE FIRMA LEGAL**
**referencia_legal actual:** Arts. 317-342 LSC

## Capa 1 actual (texto inmutable)

```
PRIMERO.- Reducir el capital social de {{denominacion_social}} en la cifra de {{importe_reduccion}} euros ({{importe_reduccion_letras}}), mediante {{modalidad_reduccion}}, quedando el capital social fijado en la cifra de {{capital_resultante}} euros, representado por {{num_titulos_resultante}} acciones/participaciones de {{valor_nominal}} euros de valor nominal cada una, de conformidad con lo previsto en los artículos 317 y siguientes de la Ley de Sociedades de Capital.

SEGUNDO.- La reducción de capital tiene por finalidad {{finalidad_reduccion}}, de conformidad con lo dispuesto en el artículo {{articulo_lsc_aplicable}} de la Ley de Sociedades de Capital.

TERCERO.- {{#if requiere_proteccion_acreedores}}De conformidad con el artículo 334 LSC, la presente reducción de capital queda condicionada al transcurso del plazo de un mes sin que los acreedores de {{denominacion_social}} hayan ejercido su derecho de oposición, una vez publicado el acuerdo en el Boletín Oficial del Registro Mercantil.{{else}}Por tratarse de una reducción cuya finalidad es restablecer el equilibrio entre el capital y el patrimonio neto de la Sociedad, la presente reducción de capital no queda sujeta al derecho de oposición de los acreedores, de conformidad con el artículo 335 LSC.{{/if}}

CUARTO.- Modificar, en consecuencia, el artículo de los Estatutos Sociales relativo al capital social, que quedará redactado para reflejar el nuevo capital social de {{capital_resultante}} euros.

QUINTO.- Facultar al Consejero Delegado y al Secretario del Consejo para elevar a escritura pública el presente acuerdo, proceder a su inscripción en el Registro Mercantil y realizar cuantos actos sean precisos para la completa ejecución de los mismos.
```

## Capa 2 actual (variables)

| variable | fuente | condicion |
|---|---|---|
| denominacion_social | entities.name |  |
| tipo_social | entities.entity_type_detail |  |

## Capa 3 actual (campos editables)

| campo | obligatoriedad | descripcion |
|---|---|---|
| importe_reduccion | requerido=true | Importe de la reducción en cifra (euros) (text) |
| importe_reduccion_letras | requerido=true | Importe de la reducción en letras (text) |
| modalidad_reduccion | requerido=true | Modalidad de reducción (text) |
| capital_resultante | requerido=true | Capital social resultante (euros) (text) |
| num_titulos_resultante | requerido=true | Número de acciones/participaciones resultantes (text) |
| valor_nominal | requerido=true | Valor nominal por título (euros) (text) |
| finalidad_reduccion | requerido=true | Finalidad de la reducción (text) |
| articulo_lsc_aplicable | requerido=false | Artículo LSC aplicable (text) |
| requiere_proteccion_acreedores | requerido=true | Requiere protección de acreedores (arts. 334-337 LSC) (boolean) |

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

- **Variable Capa 2 huérfana:** `tipo_social` declarada con fuente `entities.entity_type_detail` pero **NO se usa en el texto Capa 1**. Variable sobrante. Eliminar de Capa 2 o usar para condicionalizar texto (p. ej. SA vs. SL exige distintos requisitos en reducción de capital con devolución de aportaciones, art. 331 LSC).
- Plantilla en versión `0.1.0`: bumpear a `1.0.0` al firmar.
- **Riesgo importes en formato `text`:** todos los campos numéricos (`importe_reduccion`, `capital_resultante`, `num_titulos_resultante`, `valor_nominal`) son `text`. Si el secretario introduce "1.000.000" con punto separador o "1,000,000" con coma, el motor de plantillas no valida el formato. Recomendable cambiar a `number` con formateador en runtime.
- **Riesgo aritmético no validado:** el sistema no valida que `capital_anterior - importe_reduccion = capital_resultante` ni que `num_titulos_resultante * valor_nominal = capital_resultante`. Bug latente: el secretario podría generar un acuerdo aritméticamente incorrecto que generaría calificación negativa en el RM.
- **Riesgo Handlebars cláusula TERCERO:** el bloque `{{#if requiere_proteccion_acreedores}}...{{else}}...{{/if}}` simplifica las modalidades en dos: (a) protección de acreedores (art. 334) o (b) restablecimiento equilibrio (art. 335). Sin embargo el art. 335 LSC contempla 3 supuestos sin oposición de acreedores: (1) restablecer equilibrio, (2) constituir o incrementar reserva legal o voluntaria, (3) reducción afectada a una finalidad distinta. La cláusula `{{else}}` solo cubre el primer supuesto. Si el booleano `requiere_proteccion_acreedores=false` por una de las otras causas, el texto de la cláusula `{{else}}` sería **jurídicamente incorrecto**. Solución: convertir en select de 4 opciones y usar `{{#switch finalidad_reduccion}}` con plantilla específica para cada supuesto.
- **Riesgo SLU**: si la sociedad es SL/SLU, el régimen de oposición de acreedores tiene matices distintos (arts. 332-333 LSC sobre garantía solidaria de socios devueltos en SL). La plantilla genérica no captura esto. Considerar variante específica por `tipo_social`.
- **Cláusula CUARTO**: la modificación de estatutos relativa al capital es **obligatoria** y el texto correctamente lo cita. Sin embargo, la cláusula no genera la nueva redacción literal del artículo de capital — solo declara la modificación. El secretario debe luego generar otro documento con la nueva redacción. Considerar fusionar con la plantilla MODIFICACION_ESTATUTOS o añadir campo `nueva_redaccion_articulo_capital`.
- **Riesgo cotizadas DL-2:** para sociedades cotizadas la reducción de capital con devolución de aportaciones puede activar warnings adicionales (LMV, prospecto si afecta significativamente). Validar con motor.
- Sin nombres reales de cliente.
- Fuentes Capa 2 dentro del resolver canónico (`entities.*`).
- Referencias LSC vigentes (arts. 317-342 LSC).
