# Plantilla legacy NOMBRAMIENTO_CONSEJERO (JUNTA) — revisión legal 2026-05-02

**UUID Cloud:** 10f90d59-39d3-4633-83ff-81140eff50d5
**tipo:** MODELO_ACUERDO
**materia:** NOMBRAMIENTO_CONSEJERO
**jurisdiccion:** ES
**organo_tipo actual:** JUNTA_GENERAL
**adoption_mode actual:** MEETING
**version actual:** 1.0.0
**estado:** ACTIVA
**aprobada_por:** **PENDIENTE FIRMA LEGAL**
**fecha_aprobacion:** **PENDIENTE FIRMA LEGAL**
**referencia_legal actual:** Arts. 214, 217-219 LSC; art. 94 RRM

## Capa 1 actual (texto inmutable)

```
PRIMERO.- Nombrar a {{nombre_candidato}}, con D.N.I./N.I.E. número {{dni_candidato}}, como {{cargo_denominacion}} del Consejo de Administración de {{nombre_entidad}}, con la categoría de consejero {{categoria_consejero}}, por el plazo estatutario de {{plazo_mandato}} años, con efectos desde la fecha del presente acuerdo.

SEGUNDO.- El Sr./Sra. {{nombre_candidato}} acepta el nombramiento, declara no estar incurso en ninguna causa de incompatibilidad o prohibición para el ejercicio del cargo, y manifiesta reunir los requisitos de idoneidad, honorabilidad y experiencia exigidos por la normativa aplicable.

TERCERO.- Facultar a cualquier miembro del Consejo de Administración para elevar el presente acuerdo a escritura pública e inscribirlo en el Registro Mercantil, subsanando cuantos defectos formales pudieran observarse.
```

## Capa 2 actual (variables)

| variable | fuente | condicion |
|---|---|---|
| nombre_entidad | entities.name | SIEMPRE |
| nombre_candidato | persons.nombre_completo | SIEMPRE |
| dni_candidato | persons.nif | SIEMPRE |
| cargo_denominacion | agreement.cargo_denominacion | SIEMPRE |
| categoria_consejero | agreement.categoria_consejero | SIEMPRE |
| plazo_mandato | entities.plazo_mandato_estatutos | SIEMPRE |

## Capa 3 actual (campos editables)

| campo | obligatoriedad | descripcion |
|---|---|---|
| nombre_candidato | OBLIGATORIO | Nombre y apellidos completos del candidato |
| dni_candidato | OBLIGATORIO | DNI, NIE o pasaporte del candidato |
| cargo_denominacion | OBLIGATORIO | Denominación del cargo |
| categoria_consejero | OBLIGATORIO | Categoría del consejero |
| plazo_mandato | OBLIGATORIO | Duración del mandato en años |

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

- **Duplicidad Capa 2 / Capa 3:** las 5 variables (`nombre_candidato`, `dni_candidato`, `cargo_denominacion`, `categoria_consejero`, `plazo_mandato`) figuran en ambas capas. Mismo patrón que las plantillas hermanas. Definir prioridad resolver vs. override manual.
- **Fuente `entities.plazo_mandato_estatutos`**: confirmar que el campo existe en la tabla `entities`. No aparece en el listado del CLAUDE.md como columna estándar, pero el patrón `entities.*` es legítimo. Validar en schema. Si no existe, la fuente está rota y silenciosamente no resuelve.
- **Riesgo art. 221.2 LSC** (plazo en SA cotizadas): para sociedades anónimas cotizadas el plazo de mandato no puede exceder de **4 años**. Para SA no cotizadas el límite estatutario es de 6 años (anterior redacción) y desde la reforma se permite hasta 4 años con prórroga. La plantilla no diferencia. Si los estatutos de la entidad fijan un plazo mayor del legal, el campo `entities.plazo_mandato_estatutos` puede generar acuerdo nulo. Considerar validación cruzada con la matriz legal.
- **Riesgo art. 219 LSC** (suplencia): si el nombramiento no incluye plazo expreso, se entiende prorrogado por igual período al estatutario. La plantilla forzosamente incluye plazo. OK.
- **Cláusula SEGUNDO declaración consejero**: misma observación que en la versión CONSEJO sobre idoneidad reforzada en sector financiero.
- **Cláusula TERCERO subsanación:** "subsanando cuantos defectos formales pudieran observarse" — fórmula amplia y aceptable; no ofrece riesgo material.
- Versión `1.0.0`: pendiente bump a `1.1.0` al firmar.
- Sin variables huérfanas: las 5 placeholders están todas declaradas en Capa 2 + Capa 3.
- Fuentes Capa 2 dentro del resolver canónico (`entities.*`, `persons.*`, `agreement.*`).
- **Mejora sugerida:** considerar campo Capa 3 opcional `tipo_designacion` (representación proporcional art. 243 LSC vs. designación directa) que permita al motor de reglas aplicar el rule pack apropiado. Hoy la plantilla genérica no captura esta distinción.
