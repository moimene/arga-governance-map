# Plantilla legacy SEGUROS_RESPONSABILIDAD — revisión legal 2026-05-02

**UUID Cloud:** df75cda9-e558-43c7-a6a9-902e2c06ee97
**tipo:** MODELO_ACUERDO
**materia:** SEGUROS_RESPONSABILIDAD
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
PRIMERO.- Autorizar la {{tipo_accion_seguro}} del seguro de responsabilidad civil de consejeros y directivos (Directors & Officers) de {{denominacion_social}} con {{aseguradora}}, con las siguientes condiciones principales:

- Modalidad de cobertura: {{modalidad_cobertura}}
- Límite de indemnización: {{limite_cobertura}} euros
- Prima total anual: {{prima_anual}} euros
- Período de cobertura: desde {{fecha_inicio_cobertura}} hasta {{fecha_fin_cobertura}}
- Retroactividad: {{retroactividad}}

SEGUNDO.- Autorizar asimismo, dentro de la póliza anterior, la cobertura Side A (protección individual de administradores) hasta el importe de {{limite_side_a}} euros, con objeto de garantizar la protección personal de los administradores ante reclamaciones en las que {{denominacion_social}} no pueda o no quiera indemnizarles.

TERCERO.- Declarar que la contratación del presente seguro se realiza en beneficio de la Sociedad y de sus administradores y directivos, y que la prima es proporcional a los riesgos cubiertos y no constituye remuneración encubierta a los efectos del artículo 217 de la Ley de Sociedades de Capital.

CUARTO.- Facultar a la Dirección Financiera y al Secretario del Consejo para la firma de la póliza y cuantos documentos sean precisos para su formalización, modificación o cancelación.
```

## Capa 2 actual (variables)

| variable | fuente | condicion |
|---|---|---|
| denominacion_social | entities.name |  |

## Capa 3 actual (campos editables)

| campo | obligatoriedad | descripcion |
|---|---|---|
| tipo_accion_seguro | requerido=true | Tipo de acción (contratación/renovación/modificación) (text) |
| aseguradora | requerido=true | Nombre de la aseguradora (text) |
| modalidad_cobertura | requerido=false | Modalidad de cobertura (text) |
| limite_cobertura | requerido=true | Límite de indemnización total (euros) (text) |
| prima_anual | requerido=true | Prima anual total (euros) (text) |
| fecha_inicio_cobertura | requerido=true | Inicio del período de cobertura (date) |
| fecha_fin_cobertura | requerido=true | Fin del período de cobertura (date) |
| retroactividad | requerido=false | Cláusula de retroactividad (text) |
| limite_side_a | requerido=false | Límite cobertura Side A (euros) (text) |

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

- **organo_tipo NULL**: completar con `CONSEJO_ADMIN`. La contratación de seguros D&O para consejeros y directivos es competencia del Consejo (gestión ordinaria asegurativa, art. 249 LSC y arts. 217-219 LSC sobre remuneración cuando se discute si es retribución encubierta).
- **adoption_mode NULL**: completar con `MEETING`.
- **referencia_legal NULL**: completar con: "Art. 217 LSC (no constituir retribución encubierta); arts. 1156-1175 CC (régimen contractual del seguro); Ley 50/1980 de Contrato de Seguro; arts. 236-241 LSC (responsabilidad de los administradores que el seguro cubre). Para sector seguros añadir art. 14 LOSSEAR sobre operaciones intra-grupo cuando la aseguradora pertenezca al grupo".
- **version: `"1"`**: bumpear a `1.0.0` al firmar.
- **Riesgo importes en formato `text`:** `limite_cobertura`, `prima_anual` y `limite_side_a` son `text`. Mismo problema que en otras plantillas del lote: el secretario podría introducir "20.000.000" o "20M€" sin validación. Recomendable cambiar a `number`.
- **Riesgo conflicto de interés intra-grupo (relevante para ARGA Seguros):** ARGA Seguros ES una aseguradora. Si la póliza D&O se contrata con una entidad **del propio grupo** (operación vinculada art. 529 ter.h LSC + arts. 14 LOSSEAR), aplica:
  - Aprobación reforzada: comisión de auditoría + Consejo + advertencia LMV si cotizada
  - Comunicación a CNMV (operaciones vinculadas trimestrales)
  - Posible declaración de Solvencia II
  La plantilla NO captura este escenario. Riesgo crítico para la entidad demo. Considerar campo Capa 3 obligatorio `aseguradora_intragrupo` (boolean) que active flujo distinto.
- **Cláusula TERCERO declaración art. 217 LSC**: la afirmación "la prima es proporcional a los riesgos cubiertos y no constituye remuneración encubierta" es una **declaración material** que vincula al órgano. Si la Inspección de Tributos o un accionista demanda calificándola como remuneración encubierta, esta declaración puede ser insuficiente sin un informe técnico-actuarial que lo respalde. Recomendable añadir campo Capa 3 opcional `informe_actuarial_anexo` para evidenciar el soporte de la declaración.
- **Cláusula PRIMERO opcional Side A vs. C**: la `modalidad_cobertura` está marcada como `requerido=false`. Esto es problemático: una D&O sin modalidad declarada puede dar lugar a reclamaciones por interpretación. Cambiar a `requerido=true` y restringir a un select con valores estándar del mercado: "Side A only", "Side A+B", "Side A+B+C".
- **Cláusula SEGUNDO Side A**: el texto inmutable hardcodea la existencia de cobertura Side A. Si la entidad contrata una D&O sin Side A (caso poco común pero existente), la cláusula SEGUNDO genera un acuerdo factualmente erróneo. Convertir cláusula SEGUNDO en condicional Handlebars `{{#if cobertura_side_a}}...{{/if}}`.
- Sin variables huérfanas: las 9 placeholders están todas declaradas en Capa 2 + Capa 3.
- Fuente Capa 2 dentro del resolver canónico (`entities.name`).
- Sin nombres reales de cliente. (Los placeholders del schema demo "AIG / Chubb / Liberty Mutual" son ejemplos de mercado, no clientes reales.)
