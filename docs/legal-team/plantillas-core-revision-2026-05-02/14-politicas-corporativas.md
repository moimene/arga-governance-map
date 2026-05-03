# Plantilla legacy POLITICAS_CORPORATIVAS — revisión legal 2026-05-02

**UUID Cloud:** b846bb03-9329-4470-840b-30d614adc613
**tipo:** MODELO_ACUERDO
**materia:** POLITICAS_CORPORATIVAS
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
PRIMERO.- Aprobar la {{nombre_politica}} de {{denominacion_social}}, en los términos recogidos en el documento presentado a este Consejo de Administración y que queda incorporado como Anexo I al acta de la presente sesión.

SEGUNDO.- La política aprobada será de obligado cumplimiento para todos los empleados, directivos y administradores de {{denominacion_social}} y, en su caso, para las sociedades integrantes de su grupo, con efectos desde {{fecha_entrada_vigor}}.

TERCERO.- Encomendar a {{area_responsable}} la comunicación interna y externa de la política aprobada, su implantación efectiva y el seguimiento continuado de su cumplimiento, así como la elaboración de los procedimientos de desarrollo que resulten necesarios.

CUARTO.- {{#if sustituye_politica_anterior}}La presente política sustituye y deja sin efecto a la {{nombre_politica_anterior}}, con efectos desde la fecha de entrada en vigor indicada en el apartado anterior.{{/if}}

QUINTO.- Establecer como periodicidad de revisión de la presente política {{periodicidad_revision}}, encargando a {{area_responsable}} la elaboración de la correspondiente propuesta de actualización que deberá presentar al Consejo en el plazo indicado.
```

## Capa 2 actual (variables)

| variable | fuente | condicion |
|---|---|---|
| denominacion_social | entities.name |  |

## Capa 3 actual (campos editables)

| campo | obligatoriedad | descripcion |
|---|---|---|
| nombre_politica | requerido=true | Nombre de la política (text) |
| fecha_entrada_vigor | requerido=true | Fecha de entrada en vigor (date) |
| area_responsable | requerido=true | Área responsable de implantación (text) |
| sustituye_politica_anterior | requerido=false | Sustituye a una política anterior (boolean) |
| nombre_politica_anterior | requerido=false | Nombre de la política anterior sustituida (text) |
| periodicidad_revision | requerido=false | Periodicidad de revisión (text) |

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

- **organo_tipo NULL**: completar con `CONSEJO_ADMIN`. La aprobación de políticas corporativas es competencia indelegable del Consejo (art. 529 ter.1 LSC para cotizadas; principio general para no cotizadas). El texto Capa 1 ya cita "este Consejo de Administración".
- **adoption_mode NULL**: completar con `MEETING`.
- **referencia_legal NULL**: bloque crítico. Sugerencia: "Art. 529 ter LSC (facultades indelegables del Consejo); art. 249 bis LSC; arts. 217-220 LSC (responsabilidad por culpa in vigilando)". Las políticas concretas tienen además su propia base normativa (Anticorrupción → Ley 10/2010 PBC/FT; Conflictos → arts. 228-229 LSC; Cumplimiento Penal → arts. 31 bis y 31 quater CP). Sugerir referencia genérica + recordatorio en runtime de que el motor de reglas debe enforcerar referencias específicas según `nombre_politica`.
- **version: `"1"`**: bumpear a `1.0.0` al firmar.
- **Plantilla excesivamente genérica:** cubre cualquier política corporativa (Anticorrupción, Conflictos de Interés, Privacidad, Sostenibilidad, etc.). Cada política tiene base normativa distinta y, en su caso, requisitos de publicación o registro. Considerar variantes especializadas para las políticas más críticas (PBC/FT, Penal, Privacidad, ESG).
- **Riesgo Handlebars cláusula CUARTO:** el bloque `{{#if sustituye_politica_anterior}}...{{/if}}` deja la cláusula CUARTA vacía si `sustituye_politica_anterior=false`. Resultado: el acta tendría enumeración PRIMERO/SEGUNDO/TERCERO/(salto)/QUINTO. Confirmar que el motor renombra cláusulas o que el texto resultante es legible. Mejor solución: incluir cláusula CUARTO alternativa sin contenido sustantivo o renumerar.
- **Cláusula QUINTO obliga a establecer periodicidad de revisión** pero `periodicidad_revision` está marcada como `requerido=false`. Inconsistencia. Cambiar a `requerido=true` o convertir cláusula QUINTO en condicional.
- Sin variables huérfanas: las 6 placeholders están todas declaradas.
- Fuente Capa 2 dentro del resolver canónico (`entities.name`).
- **Mejora:** considerar valores predefinidos para `area_responsable` (Cumplimiento, Riesgos, Privacidad, Auditoría Interna, etc.) en lugar de texto libre, para coherencia con el modelo organizativo demo ARGA.
