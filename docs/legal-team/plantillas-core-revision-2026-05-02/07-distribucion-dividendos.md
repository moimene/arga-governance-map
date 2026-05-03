# Plantilla legacy DISTRIBUCION_DIVIDENDOS — revisión legal 2026-05-02

**UUID Cloud:** 395ca996-fdf0-4203-b7ae-f894d3012c8b
**tipo:** MODELO_ACUERDO
**materia:** DISTRIBUCION_DIVIDENDOS
**jurisdiccion:** ES
**organo_tipo actual:** JUNTA_GENERAL
**adoption_mode actual:** MEETING
**version actual:** 0.1.0
**estado:** ACTIVA
**aprobada_por:** **PENDIENTE FIRMA LEGAL**
**fecha_aprobacion:** **PENDIENTE FIRMA LEGAL**
**referencia_legal actual:** Arts. 273, 348 LSC

## Capa 1 actual (texto inmutable)

```
PRIMERO.- Aprobar la distribución de un dividendo con cargo a los resultados del ejercicio {{ejercicio}}, por importe de {{dividendo_por_titulo}} euros brutos por {{tipo_titulo}}, lo que supone un total de {{importe_total_dividendo}} euros, con cargo al beneficio neto de dicho ejercicio, de conformidad con el artículo 273 de la Ley de Sociedades de Capital.

SEGUNDO.- El dividendo se satisfará el día {{fecha_pago}}, siendo la fecha de corte para la determinación de los beneficiarios el {{fecha_corte}}. Los socios registrados en el Libro de Socios a dicha fecha tendrán derecho al cobro.

TERCERO.- Conforme al artículo 214 de la Ley de Sociedades de Capital, la aplicación del resultado se realiza de acuerdo con el siguiente desglose: resultado neto del ejercicio {{ejercicio}}: {{resultado_neto}} euros; dotación a reserva legal: {{dotacion_reserva_legal}} euros; distribución de dividendos: {{importe_total_dividendo}} euros; remanente: {{remanente}} euros.

CUARTO.- Autorizar al Consejo de Administración para realizar cuantos actos sean necesarios para la ejecución del presente acuerdo, incluyendo la presentación de las declaraciones fiscales pertinentes conforme a la normativa vigente.
```

## Capa 2 actual (variables)

| variable | fuente | condicion |
|---|---|---|
| denominacion_social | ENTIDAD | SIEMPRE |

## Capa 3 actual (campos editables)

| campo | obligatoriedad | descripcion |
|---|---|---|
| ejercicio | obligatorio=true | Ejercicio social (text) |
| tipo_titulo | obligatorio=true | Tipo de título (select: acción / participación social) |
| dividendo_por_titulo | obligatorio=true | Dividendo bruto por título (€) (number) |
| importe_total_dividendo | obligatorio=true | Importe total del dividendo (€) (number) |
| fecha_pago | obligatorio=true | Fecha de pago (date) |
| fecha_corte | obligatorio=true | Fecha de corte (record date) (date) |
| resultado_neto | obligatorio=true | Resultado neto del ejercicio (€) (number) |
| dotacion_reserva_legal | obligatorio=true | Dotación a reserva legal (€) (number) |
| remanente | obligatorio=true | Remanente (€) (number) |

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

- **Variable Capa 2 huérfana:** `denominacion_social` declarada con fuente `ENTIDAD` pero **NO se usa en el texto Capa 1**. Variable sobrante. Eliminar de Capa 2 o añadir a Capa 1 (p. ej. encabezado del acuerdo).
- **Fuente Capa 2 NO canónica:** `ENTIDAD` no figura en la lista del resolver canónico. Igual que en `AUMENTO_CAPITAL`: alinear con `entities.name`.
- Plantilla en versión `0.1.0`: bumpear a `1.0.0` al firmar.
- **Riesgo aritmético no validado:** la cláusula TERCERO desglosa: `resultado_neto = dotacion_reserva_legal + importe_total_dividendo + remanente`. La plantilla NO valida esta ecuación; el secretario podría introducir importes incoherentes. Considerar validación frontend en el stepper.
- **Riesgo art. 274 LSC** (reserva legal): el campo `dotacion_reserva_legal` debe respetar el mínimo del 10% del beneficio hasta alcanzar el 20% del capital. La plantilla no enforza este mínimo. Revisar.
- **Riesgo art. 273.2 LSC**: dividendo solo distribuible si el patrimonio neto, tras la distribución, no es inferior al capital social. La plantilla no captura el patrimonio neto post-distribución. Considerar campo opcional informativo.
- **Cláusula CUARTO** referencia "declaraciones fiscales pertinentes" — declaración genérica, sin referencia a obligación específica IRPF/IS retenciones. Aceptable como redacción amplia.
- Sin nombres reales de cliente. Sin variables huérfanas en Capa 1 (todas las `{{...}}` están en Capa 2 o Capa 3).
- Referencias LSC vigentes (arts. 273, 274, 348, 214). Sin artículos derogados.
- Plantilla orientada a sociedades no cotizadas. Para cotizadas considerar regla específica de distribución provisional ("a cuenta") art. 277 LSC: si aplica, desdoblar plantilla o añadir condicional.
