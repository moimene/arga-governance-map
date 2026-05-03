# Plantilla legacy RATIFICACION_ACTOS — revisión legal 2026-05-02

**UUID Cloud:** edd5c389-0187-476c-9592-c020058fdc69
**tipo:** MODELO_ACUERDO
**materia:** RATIFICACION_ACTOS
**jurisdiccion:** ES
**organo_tipo actual:** CONSEJO_ADMINISTRACION
**adoption_mode actual:** MEETING
**version actual:** 0.1.0
**estado:** ACTIVA
**aprobada_por:** **PENDIENTE FIRMA LEGAL**
**fecha_aprobacion:** **PENDIENTE FIRMA LEGAL**
**referencia_legal actual:** Arts. 234-235 LSC

## Capa 1 actual (texto inmutable)

```
PRIMERO.- Ratificar los actos y contratos celebrados en nombre y por cuenta de {{denominacion_social}} por {{nombre_actuante}}, en su condición de {{cargo_actuante}}, durante el período comprendido entre {{fecha_inicio}} y {{fecha_fin}}, que se relacionan en el Anexo I incorporado a la presente acta, declarando la plena validez y eficacia de todos y cada uno de ellos.

SEGUNDO.- Asumir expresamente como propias de {{denominacion_social}} todas las obligaciones y responsabilidades derivadas de los actos ratificados, sin reserva ni limitación alguna.

TERCERO.- Autorizar a {{nombre_actuante}} a continuar ejerciendo las facultades habituales de gestión ordinaria de la Sociedad hasta que se proceda al otorgamiento del correspondiente apoderamiento notarial, el cual se instruye a formalizar con la mayor brevedad posible.
```

## Capa 2 actual (variables)

| variable | fuente | condicion |
|---|---|---|
| denominacion_social | entities.name |  |

## Capa 3 actual (campos editables)

| campo | obligatoriedad | descripcion |
|---|---|---|
| nombre_actuante | requerido=true | Nombre de la persona cuya actuación se ratifica (text) |
| cargo_actuante | requerido=true | Cargo o condición del actuante (text) |
| fecha_inicio | requerido=true | Inicio del período a ratificar (date) |
| fecha_fin | requerido=true | Fin del período a ratificar (date) |

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

- Plantilla en versión `0.1.0`: bumpear a `1.0.0` al firmar.
- **Cláusula PRIMERO**: ratifica "actos y contratos relacionados en el Anexo I". El secretario debe adjuntar el listado real al acta. La plantilla NO captura la lista (no hay campo `lista_actos` ni textarea). Riesgo de ratificación general sin enumeración → posible nulidad por indeterminación. Considerar:
  - (a) Campo Capa 3 textarea `enumeracion_actos` (recomendado), o
  - (b) Confirmar que el motor exige adjunto `Anexo_I_Lista.pdf` antes de finalizar.
- **Riesgo cláusula PRIMERO** "declarando la plena validez y eficacia de todos y cada uno de ellos": este lenguaje implica una ratificación **general y absoluta**, lo que puede generar responsabilidad solidaria del órgano que ratifica si en el listado hay actos contrarios al interés social, ultra vires o con conflicto de interés. Considerar texto más cauto: "ratificar los actos legítimamente celebrados", o exigir un informe previo de cumplimiento.
- **Riesgo cláusula TERCERO**: autoriza a `{{nombre_actuante}}` a continuar gestionando "hasta el apoderamiento notarial". Esto puede ser interpretado como un **mandato verbal indefinido**. Es práctica común pero riesgosa en términos de seguridad jurídica frente a terceros (un tercero podría exigir apoderamiento expreso). Considerar fijar plazo máximo (p. ej. 30 días) en el texto.
- **Sin organo_tipo restrictivo:** el organo_tipo es CONSEJO_ADMINISTRACION pero la materia "ratificación de actos" puede también corresponder a la Junta cuando los actos exceden las facultades del órgano de administración (art. 234.2 LSC). Considerar variante JUNTA_GENERAL.
- **Riesgo art. 234 LSC** (vinculación frente a terceros): los actos del administrador vinculan a la sociedad incluso fuera del objeto social, salvo que el tercero conozca de mala fe el exceso. La ratificación posterior es un acto de gobierno interno, no afecta a la validez frente a terceros. La plantilla no hace esta distinción explícita. Aceptable.
- Sin variables huérfanas: las 5 placeholders están todas declaradas.
- Fuente Capa 2 dentro del resolver canónico (`entities.name`).
- Sin nombres reales de cliente.
