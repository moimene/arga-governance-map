# Plantilla legacy MODIFICACION_ESTATUTOS — revisión legal 2026-05-02

**UUID Cloud:** 29739424-5641-42bd-8b5a-58f81ee5c471
**tipo:** MODELO_ACUERDO
**materia:** MODIFICACION_ESTATUTOS
**jurisdiccion:** ES
**organo_tipo actual:** JUNTA_GENERAL
**adoption_mode actual:** MEETING
**version actual:** 0.1.0
**estado:** ACTIVA
**aprobada_por:** **PENDIENTE FIRMA LEGAL**
**fecha_aprobacion:** **PENDIENTE FIRMA LEGAL**
**referencia_legal actual:** Arts. 285-290 LSC

## Capa 1 actual (texto inmutable)

```
PRIMERO.- Modificar el artículo {{numero_articulo}} de los Estatutos Sociales de {{denominacion_social}}, cuya nueva redacción será la siguiente:

"Artículo {{numero_articulo}}.— {{titulo_articulo}}

{{nueva_redaccion}}"

SEGUNDO.- El texto del precepto hasta ahora vigente era el siguiente:

"Artículo {{numero_articulo}}.— {{titulo_articulo}}

{{redaccion_anterior}}"

TERCERO.- Autorizar al Consejo de Administración, con facultades de sustitución, para elevar a escritura pública el presente acuerdo, comparecer ante Notario y solicitar su inscripción en el Registro Mercantil.
```

## Capa 2 actual (variables)

| variable | fuente | condicion |
|---|---|---|
| denominacion_social | ENTIDAD | SIEMPRE |

## Capa 3 actual (campos editables)

| campo | obligatoriedad | descripcion |
|---|---|---|
| numero_articulo | obligatorio=true | Número del artículo a modificar (text) |
| titulo_articulo | obligatorio=true | Título del artículo (text) |
| nueva_redaccion | obligatorio=true | Nueva redacción del artículo (textarea) |
| redaccion_anterior | obligatorio=true | Redacción anterior del artículo (textarea) |

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

- **Fuente Capa 2 NO canónica:** `denominacion_social` con fuente `ENTIDAD`. Alinear con `entities.name`.
- **Variable Capa 2 huérfana:** `denominacion_social` declarada pero **NO se usa en Capa 1** (la cláusula PRIMERO menciona "los Estatutos Sociales de {{denominacion_social}}"). Sí se usa, OK — variable no huérfana. Releer: `de los Estatutos Sociales de {{denominacion_social}}` aparece en PRIMERO. Correcto.
- Plantilla en versión `0.1.0`: bumpear a `1.0.0` al firmar.
- **Plantilla limitada a 1 artículo por acuerdo:** la cláusula PRIMERO modifica el artículo `{{numero_articulo}}`. Si la junta acuerda modificar varios artículos en una sola sesión, será necesario generar múltiples acuerdos o ampliar la plantilla con loop Handlebars. Documentar.
- **Riesgo derecho de información (art. 287 LSC):** la modificación de estatutos exige que en la convocatoria se exprese con la debida claridad los extremos a modificar y poner a disposición de los socios el texto íntegro de la modificación y un informe del órgano de administración. La plantilla no captura ni hace referencia al cumplimiento de estos requisitos. Considerar añadir cláusula informativa o validar via motor de reglas.
- **Riesgo art. 290 LSC**: las modificaciones estatutarias deben publicarse en el BORME. La plantilla no menciona la publicación. Aceptable como acto separado, pero conviene cláusula CUARTA que faculte para "realizar las publicaciones en BORME que sean precisas".
- **Riesgo modificaciones cualificadas:** ciertos cambios estatutarios (objeto social, domicilio fuera del territorio nacional, transformación, fusión, escisión) tienen mayorías reforzadas y procedimientos especiales (RDL 5/2023). La plantilla genérica no diferencia. Riesgo de que el secretario use esta plantilla para una operación que requeriría plantilla de FUSION_ESCISION. Validar via motor (rule pack + materia).
- Referencias LSC vigentes (arts. 285-290). Sin artículos derogados.
- Sin nombres reales de cliente.
