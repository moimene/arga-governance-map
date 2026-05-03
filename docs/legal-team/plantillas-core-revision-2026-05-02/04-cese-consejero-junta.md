# Plantilla legacy CESE_CONSEJERO (JUNTA) — revisión legal 2026-05-02

**UUID Cloud:** 433da411-ba65-410c-8375-24db637f7e75
**tipo:** MODELO_ACUERDO
**materia:** CESE_CONSEJERO
**jurisdiccion:** ES
**organo_tipo actual:** JUNTA_GENERAL
**adoption_mode actual:** MEETING
**version actual:** 1.0.0
**estado:** ACTIVA
**aprobada_por:** **PENDIENTE FIRMA LEGAL**
**fecha_aprobacion:** **PENDIENTE FIRMA LEGAL**
**referencia_legal actual:** Arts. 223, 225 LSC; art. 94 RRM

## Capa 1 actual (texto inmutable)

```
PRIMERO.- Cesar a {{nombre_consejero}}, con D.N.I./N.I.E. número {{dni_consejero}}, como {{cargo_denominacion}} del Consejo de Administración de {{nombre_entidad}}, con efectos desde la fecha del presente acuerdo, {{motivo_cese}}.

SEGUNDO.- Agradecer a {{nombre_consejero}} los servicios prestados durante su mandato como consejero de la Sociedad.

TERCERO.- Facultar a cualquier miembro del Consejo de Administración para elevar el presente acuerdo a escritura pública e inscribirlo en el Registro Mercantil, cancelando la inscripción del cargo del cesado.
```

## Capa 2 actual (variables)

| variable | fuente | condicion |
|---|---|---|
| nombre_entidad | entities.name | SIEMPRE |
| nombre_consejero | persons.nombre_completo | SIEMPRE |
| dni_consejero | persons.nif | SIEMPRE |
| cargo_denominacion | mandate.cargo_denominacion | SIEMPRE |

## Capa 3 actual (campos editables)

| campo | obligatoriedad | descripcion |
|---|---|---|
| nombre_consejero | OBLIGATORIO | Nombre y apellidos completos del consejero que cesa |
| dni_consejero | OBLIGATORIO | DNI/NIE del consejero |
| cargo_denominacion | OBLIGATORIO | Denominación del cargo |
| motivo_cese | OBLIGATORIO | Motivo del cese |

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

- **Duplicidad Capa 2 / Capa 3:** mismas tres variables (`nombre_consejero`, `dni_consejero`, `cargo_denominacion`) declaradas en ambas capas. Mismo comentario que en la plantilla de cese por Consejo: definir prioridad resolver vs. override manual o eliminar de Capa 3.
- **Cláusula TERCERO inconsistente con organo_tipo:** la plantilla está destinada a JUNTA_GENERAL, pero el TERCERO faculta "a cualquier miembro del Consejo de Administración" para elevar a público. En la práctica habitual sería el Secretario del Consejo o un consejero, lo que es válido, pero conviene precisar quién eleva tras un acuerdo de la Junta (art. 107 RRM: presidente y secretario de la junta o personas designadas en la propia escritura). Revisar redacción.
- Plantilla cubre cese **ad nutum** por la Junta (art. 223.1 LSC: separación libre). No incluye el supuesto de cese por causa legal (art. 224 LSC); si se quiere cubrir, ampliar Capa 3 con campo opcional `causa_legal`.
- Versión `1.0.0`: pendiente bump a `1.1.0` al firmar.
- Fuentes Capa 2 dentro del resolver canónico (`entities.*`, `persons.*`, `mandate.*`).
- Sin huérfanos: las 5 variables `{{...}}` están todas declaradas. `{{motivo_cese}}` solo en Capa 3 (input usuario), correcto.
- `{{cargo_denominacion}}` se usa en cláusula PRIMERO refiriéndose a la persona cesada; verificar que la fuente `mandate.cargo_denominacion` retorna el cargo activo en el momento del cese y no histórico.
