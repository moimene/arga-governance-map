# Plantilla legacy AUMENTO_CAPITAL — revisión legal 2026-05-02

**UUID Cloud:** 2d814072-3fb0-4ffd-a181-875d9c4a5c0d
**tipo:** MODELO_ACUERDO
**materia:** AUMENTO_CAPITAL
**jurisdiccion:** ES
**organo_tipo actual:** JUNTA_GENERAL
**adoption_mode actual:** MEETING
**version actual:** 0.1.0
**estado:** ACTIVA
**aprobada_por:** **PENDIENTE FIRMA LEGAL**
**fecha_aprobacion:** **PENDIENTE FIRMA LEGAL**
**referencia_legal actual:** Arts. 295-310 LSC

## Capa 1 actual (texto inmutable)

```
PRIMERO.- Aumentar el capital social de {{denominacion_social}} en la cifra de {{importe_aumento}} euros, mediante {{modalidad_aumento}}, pasando el capital social de {{capital_anterior}} euros a {{capital_nuevo}} euros.

SEGUNDO.- El aumento de capital se realizará mediante {{descripcion_modalidad}}, con cargo a {{origen_fondos}}.

TERCERO.- Las nuevas {{tipo_titulo}} tendrán un valor nominal de {{valor_nominal}} euros cada una y se emitirán a un precio de {{precio_emision}} euros, correspondiendo {{prima_emision}} euros a prima de emisión o asunción, de conformidad con el artículo 299 de la Ley de Sociedades de Capital.

CUARTO.- Reconocer el derecho de suscripción o asunción preferente de los socios actuales en proporción a sus participaciones/acciones, por un plazo de {{plazo_suscripcion_dias}} días naturales desde la publicación o notificación de la oferta, conforme a los artículos 304 y siguientes de la Ley de Sociedades de Capital.

QUINTO.- Autorizar al Consejo de Administración para elevar a escritura pública el presente acuerdo, otorgar cuantos documentos fueren necesarios e inscribirlo en el Registro Mercantil.
```

## Capa 2 actual (variables)

| variable | fuente | condicion |
|---|---|---|
| denominacion_social | ENTIDAD | SIEMPRE |

## Capa 3 actual (campos editables)

| campo | obligatoriedad | descripcion |
|---|---|---|
| importe_aumento | obligatorio=true | Importe del aumento (€) (number) |
| modalidad_aumento | obligatorio=true | Modalidad (select: nuevas aportaciones dinerarias / compensación de créditos / aportaciones no dinerarias / con cargo a reservas) |
| capital_anterior | obligatorio=true | Capital social anterior (€) (number) |
| capital_nuevo | obligatorio=true | Capital social resultante (€) (number) |
| descripcion_modalidad | obligatorio=true | Descripción de la modalidad (text) |
| origen_fondos | obligatorio=true | Origen de los fondos / reserva (text) |
| tipo_titulo | obligatorio=true | Tipo de título (select: acciones / participaciones sociales) |
| valor_nominal | obligatorio=true | Valor nominal unitario (€) (number) |
| precio_emision | obligatorio=true | Precio de emisión unitario (€) (number) |
| prima_emision | obligatorio=true | Prima de emisión / asunción (€) (number) |
| plazo_suscripcion_dias | obligatorio=true | Plazo de suscripción preferente (días) (number) |

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

- **Fuente Capa 2 NO canónica:** `denominacion_social` declara fuente `ENTIDAD` (string suelto). El resolver canónico espera prefijos dotted como `entities.*` o tokens reservados (`LEY`, `ESTATUTOS`, etc.). El normalizador `H1a` mapea `entities.* → ENTIDAD`, pero la migración inversa (`ENTIDAD → entities.name`) puede fallar silenciosamente si el resolver no tiene fallback. Recomendado: cambiar fuente a `entities.name` para alinear con el patrón mayoritario del corpus.
- Plantilla en versión `0.1.0`: pendiente bump a `1.0.0` al firmar.
- Sin huérfanos: las 12 variables `{{denominacion_social}}` + 11 editables están todas declaradas correctamente.
- Validar coherencia aritmética en runtime: `capital_anterior + importe_aumento = capital_nuevo` no se valida en plantilla; revisar si el motor de reglas debe enforcerlo.
- Cláusula CUARTO sobre derecho de suscripción preferente: el texto fija "{{plazo_suscripcion_dias}} días naturales" pero el art. 305 LSC distingue plazos mínimos según anuncio en BORME; revisar si el formulario debe limitar el rango.
- Operación estructural ESTATUTARIA: confirmar que el motor de reglas exige mayoría reforzada (art. 201.2 LSC) y, en su caso, advertencia DL-2 para sociedades cotizadas.
- Referencias LSC vigentes y correctas (arts. 299, 304, 295-310): art. 299 sobre prima de emisión, art. 304 sobre suscripción preferente. Sin artículos derogados detectados.
