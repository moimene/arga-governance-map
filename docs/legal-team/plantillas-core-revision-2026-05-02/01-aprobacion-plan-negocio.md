# Plantilla legacy APROBACION_PLAN_NEGOCIO — revisión legal 2026-05-02

**UUID Cloud:** 68da89bc-03cd-4820-80f1-8a549b0c7d78
**tipo:** MODELO_ACUERDO
**materia:** APROBACION_PLAN_NEGOCIO
**jurisdiccion:** ES
**organo_tipo actual:** CONSEJO_ADMINISTRACION
**adoption_mode actual:** MEETING
**version actual:** 0.1.0
**estado:** ACTIVA
**aprobada_por:** **PENDIENTE FIRMA LEGAL**
**fecha_aprobacion:** **PENDIENTE FIRMA LEGAL**
**referencia_legal actual:** Art. 225 LSC — deber de diligencia del Consejo

## Capa 1 actual (texto inmutable)

```
PRIMERO.- Aprobar el Plan de Negocio de {{denominacion_social}} para el ejercicio {{ejercicio}}, así como el presupuesto de ingresos y gastos, las inversiones previstas y los objetivos estratégicos recogidos en el documento presentado por la Dirección y que se incorpora como Anexo I al acta de la presente sesión.

SEGUNDO.- Encomendar a la dirección ejecutiva el desarrollo y ejecución del Plan de Negocio aprobado, con sujeción a los límites de autorización establecidos en las Instrucciones de la Dirección vigentes.

TERCERO.- Establecer como fecha de primera revisión del cumplimiento del Plan de Negocio el {{fecha_primera_revision}}, en la que la Dirección presentará al Consejo un informe de seguimiento de los principales indicadores de gestión.

CUARTO.- Facultar al Consejero Delegado para la adopción de las medidas necesarias para la ejecución del Plan aprobado dentro de sus facultades delegadas.
```

## Capa 2 actual (variables)

| variable | fuente | condicion |
|---|---|---|
| denominacion_social | entities.name |  |

## Capa 3 actual (campos editables)

| campo | obligatoriedad | descripcion |
|---|---|---|
| ejercicio | requerido=true | Ejercicio económico (text) |
| fecha_primera_revision | requerido=true | Fecha de primera revisión (date) |

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

- **organo_tipo en Cloud es `CONSEJO_ADMINISTRACION`**, valor que no figura literalmente en el catálogo del checklist legal (`JUNTA_GENERAL | CONSEJO | CONSEJO_ADMIN | SOCIO_UNICO | ADMIN_UNICO | ADMIN_CONJUNTA | ADMIN_SOLIDARIOS`). Confirmar si se mantiene `CONSEJO_ADMINISTRACION` (valor histórico de DB) o se normaliza a `CONSEJO_ADMIN`.
- Plantilla en versión `0.1.0`: pendiente bump a `1.0.0` al firmar.
- Capa 1 referencia "Instrucciones de la Dirección vigentes" — verificar si existe documento corporativo equivalente y, en su caso, ajustar terminología.
- Capa 1 referencia "Consejero Delegado" — coherencia con la estructura demo ARGA donde existe CDG; revisar si la facultad debe ampliarse a otros cargos delegados (Comité Ejecutivo).
- Sin huérfanos: las 3 variables `{{denominacion_social}}`, `{{ejercicio}}`, `{{fecha_primera_revision}}` están todas declaradas (1 en Capa 2, 2 en Capa 3).
- Fuentes Capa 2 dentro del resolver canónico (`entities.name`).
