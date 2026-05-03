# Plantilla legacy COMITES_INTERNOS — revisión legal 2026-05-02

**UUID Cloud:** 313e7609-8b11-4ef5-a8fd-e9fdcf99d22c
**tipo:** MODELO_ACUERDO
**materia:** COMITES_INTERNOS
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
PRIMERO.- {{tipo_accion_comite}} del {{nombre_comite}} de {{denominacion_social}}, en cumplimiento de lo previsto en los artículos {{articulos_lsc_comite}} de la Ley de Sociedades de Capital y en el Reglamento del Consejo de Administración, con la siguiente composición:

{{composicion_comite}}

SEGUNDO.- Los consejeros designados aceptan expresamente en este acto los cargos que les han sido atribuidos en el {{nombre_comite}}, declarando no estar incursos en causa de incompatibilidad ni prohibición alguna para el ejercicio de los mismos.

TERCERO.- El {{nombre_comite}} ejercerá las funciones establecidas en el Reglamento del Consejo de Administración y, en su caso, en su propio Reglamento Interno. Los mandatos de sus miembros tendrán la misma duración que el de su cargo como consejero, sin perjuicio de su renovación o sustitución anticipada por acuerdo del Consejo.

CUARTO.- {{#if aprueba_reglamento}}Aprobar el Reglamento Interno del {{nombre_comite}} que se adjunta como Anexo I al acta de la presente sesión, con efectos desde esta fecha.{{else}}Confirmar la vigencia del Reglamento Interno del {{nombre_comite}} aprobado con fecha {{fecha_reglamento_vigente}}.{{/if}}
```

## Capa 2 actual (variables)

| variable | fuente | condicion |
|---|---|---|
| denominacion_social | entities.name |  |

## Capa 3 actual (campos editables)

| campo | obligatoriedad | descripcion |
|---|---|---|
| tipo_accion_comite | requerido=true | Tipo de acción (Constitución/Renovación/Modificación de composición) (text) |
| nombre_comite | requerido=true | Nombre del comité (text) |
| articulos_lsc_comite | requerido=false | Artículos LSC aplicables (text) |
| composicion_comite | requerido=true | Composición del comité (textarea) |
| aprueba_reglamento | requerido=false | Se aprueba nuevo Reglamento Interno del comité (boolean) |
| fecha_reglamento_vigente | requerido=false | Fecha del Reglamento Interno vigente (date) |

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

- **organo_tipo NULL**: bloquea selección automática de plantilla por el motor. Propuesta: `CONSEJO_ADMIN` (la constitución/renovación de comités delegados es competencia del Consejo, art. 529 terdecies LSC y siguientes).
- **adoption_mode NULL**: completar con `MEETING` (acuerdo del Consejo en sesión).
- **referencia_legal NULL**: bloque crítico para sociedades cotizadas. Sugerencia: arts. 529 terdecies–quaterdecies–quindecies LSC (Comisión de Auditoría y Comisión de Nombramientos y Retribuciones); art. 529 sexdecies LSC para Comité de Riesgos sectorial. Confirmar también referencias a arts. 21 y 22 RD 84/2015 si aplica al sector seguros (Solvencia II).
- **version: `"1"`** (string sin formato semver): bumpear a `1.0.0` al firmar.
- **Bug potencial Handlebars:** el bloque `{{#if aprueba_reglamento}}...{{else}}...{{fecha_reglamento_vigente}}...{{/if}}` requiere que el motor `template-renderer.ts` soporte sintaxis `{{#if}}` con `{{else}}`. Verificar que Handlebars renderiza correctamente y que `aprueba_reglamento=false/null` cae en el branch `{{else}}` sin error si `fecha_reglamento_vigente` es null.
- **Variable Capa 1 sin declaración Capa 2:** `articulos_lsc_comite` declarada solo en Capa 3 con `requerido=false`. El usuario puede dejarla vacía y Capa 1 quedaría con marca `{{articulos_lsc_comite}}` literal. Forzar `requerido=true` o pre-rellenar con un default (p.ej. "529 quaterdecies y 529 quindecies LSC" para comités cotizadas).
- Capa 1 cita "Reglamento del Consejo de Administración" — confirmar que existe en la entidad demo y que el motor de reglas no exige verificación previa de su vigencia.
- Sin nombres reales de cliente en Capa 1 (placeholder genérico).
- Fuente Capa 2 dentro del resolver canónico (`entities.name`).
