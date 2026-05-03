# Plantilla legacy CESE_CONSEJERO (CONSEJO) — revisión legal 2026-05-02

**UUID Cloud:** ba214d42-1933-497f-a2c0-0867c7c7a55f
**tipo:** MODELO_ACUERDO
**materia:** CESE_CONSEJERO
**jurisdiccion:** ES
**organo_tipo actual:** CONSEJO_ADMINISTRACION
**adoption_mode actual:** MEETING
**version actual:** 1.0.0
**estado:** ACTIVA
**aprobada_por:** **PENDIENTE FIRMA LEGAL**
**fecha_aprobacion:** **PENDIENTE FIRMA LEGAL**
**referencia_legal actual:** Arts. 223.1, 225 LSC; art. 94 RRM

## Capa 1 actual (texto inmutable)

```
PRIMERO.- Aceptar la renuncia presentada con fecha {{fecha_renuncia}} por {{nombre_consejero}}, con D.N.I./N.I.E. número {{dni_consejero}}, a su cargo de {{cargo_denominacion}} del Consejo de Administración de {{nombre_entidad}}, con efectos desde la fecha del presente acuerdo.

SEGUNDO.- Agradecer a {{nombre_consejero}} los servicios prestados durante su mandato como consejero de la Sociedad.

TERCERO.- Facultar a cualquier miembro del Consejo de Administración para elevar el presente acuerdo a escritura pública e inscribirlo en el Registro Mercantil.
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
| nombre_consejero | OBLIGATORIO | Nombre del consejero renunciante |
| dni_consejero | OBLIGATORIO | DNI/NIE |
| cargo_denominacion | OBLIGATORIO | Denominación del cargo |
| fecha_renuncia | OBLIGATORIO | Fecha en que se presentó la renuncia |

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

- **Duplicidad Capa 2 / Capa 3:** las variables `nombre_consejero`, `dni_consejero` y `cargo_denominacion` figuran tanto como Capa 2 (auto-resueltas) como Capa 3 (editables manualmente). Esto crea ambigüedad: si el motor las precarga desde `persons` y `mandate`, ¿permite override manual? Confirmar comportamiento esperado y, en su caso, eliminar de Capa 3 para evitar drift entre la BD canónica y el documento generado.
- **Variable Capa 1 sin declaración:** `{{fecha_renuncia}}` aparece en el texto pero NO está en Capa 2. Sí está en Capa 3 → bug menor; al ser MODELO_ACUERDO específico de renuncia, la fecha es input del usuario, OK.
- Plantilla específica de **renuncia** (Capa 1: "Aceptar la renuncia"). Cubre solo art. 223.1 LSC. Si se quiere cubrir cese ad nutum por el Consejo (art. 223 LSC), revisar si conviene desdoblar en dos plantillas distintas o ampliar el texto Capa 1 con condicional Handlebars.
- Versión `1.0.0`: pendiente bump a `1.1.0` al firmar.
- Fuentes Capa 2 dentro del resolver canónico (`entities.*`, `persons.*`, `mandate.*`).
- Cláusula TERCERO no cita art. 94 RRM en el texto inmutable; solo aparece en `referencia_legal`. OK — coherente con el patrón del corpus.
- Inscripción de cese en RM: art. 94.2 RRM exige acta firmada con cargo cesado, salvo renuncia notificada en escritura pública (art. 147 RRM). Confirmar si la plantilla cubre ambos escenarios.
