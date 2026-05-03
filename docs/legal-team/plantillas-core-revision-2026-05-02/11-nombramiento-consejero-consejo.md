# Plantilla legacy NOMBRAMIENTO_CONSEJERO (CONSEJO) — revisión legal 2026-05-02

**UUID Cloud:** 27be9063-8977-44c7-b72c-eb26ecb3c49b
**tipo:** MODELO_ACUERDO
**materia:** NOMBRAMIENTO_CONSEJERO
**jurisdiccion:** ES
**organo_tipo actual:** CONSEJO_ADMINISTRACION
**adoption_mode actual:** MEETING
**version actual:** 1.0.0
**estado:** ACTIVA
**aprobada_por:** **PENDIENTE FIRMA LEGAL**
**fecha_aprobacion:** **PENDIENTE FIRMA LEGAL**
**referencia_legal actual:** Art. 244 LSC; art. 94 RRM

## Capa 1 actual (texto inmutable)

```
PRIMERO.- Al amparo de lo previsto en el artículo 244 de la Ley de Sociedades de Capital y el artículo {{articulo_estatutos}} de los Estatutos Sociales, designar por cooptación a {{nombre_candidato}}, con D.N.I./N.I.E. número {{dni_candidato}}, como {{cargo_denominacion}} del Consejo de Administración de {{nombre_entidad}}, con la categoría de consejero {{categoria_consejero}}, para cubrir la vacante producida por {{motivo_vacante}}, hasta que la primera Junta General de Accionistas ratifique o revoque el nombramiento.

SEGUNDO.- El Sr./Sra. {{nombre_candidato}} acepta el nombramiento, declara no estar incurso en ninguna causa de incompatibilidad o prohibición para el ejercicio del cargo, y manifiesta reunir los requisitos de idoneidad, honorabilidad y experiencia exigidos por la normativa aplicable.

TERCERO.- Facultar a cualquier miembro del Consejo de Administración para elevar el presente acuerdo a escritura pública e inscribirlo en el Registro Mercantil.
```

## Capa 2 actual (variables)

| variable | fuente | condicion |
|---|---|---|
| nombre_entidad | entities.name | SIEMPRE |
| nombre_candidato | persons.nombre_completo | SIEMPRE |
| dni_candidato | persons.nif | SIEMPRE |
| cargo_denominacion | agreement.cargo_denominacion | SIEMPRE |
| categoria_consejero | agreement.categoria_consejero | SIEMPRE |

## Capa 3 actual (campos editables)

| campo | obligatoriedad | descripcion |
|---|---|---|
| nombre_candidato | OBLIGATORIO | Nombre del candidato |
| dni_candidato | OBLIGATORIO | DNI/NIE |
| cargo_denominacion | OBLIGATORIO | Denominación del cargo |
| categoria_consejero | OBLIGATORIO | Categoría del consejero |
| articulo_estatutos | OBLIGATORIO | Artículo de los estatutos que regula la cooptación |
| motivo_vacante | OBLIGATORIO | Causa de la vacante |

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

- **Duplicidad Capa 2 / Capa 3:** las variables `nombre_candidato`, `dni_candidato`, `cargo_denominacion` y `categoria_consejero` figuran tanto en Capa 2 (auto-resueltas) como en Capa 3 (editables manualmente). Mismo comentario que en CESE_CONSEJERO: definir prioridad resolver vs. override manual o eliminar de Capa 3 para evitar drift.
- **Cooptación (art. 244 LSC):** la cooptación es competencia exclusiva del Consejo de Administración cuando se produce vacante anticipada en sociedades anónimas (no aplica a sociedades de responsabilidad limitada salvo previsión estatutaria). Verificar que el motor de reglas restringe esta plantilla a `entity_type_detail = SA` (o variantes SAU). Si la sociedad es SL/SLU, esta plantilla no debería seleccionarse.
- **Riesgo art. 244 LSC** (cobertura por accionistas): la cooptación exige que el cooptado sea **accionista** (en SA con sistema antiguo) o miembro del propio sector profesional (variantes estatutarias). La plantilla no captura este requisito ni lo documenta. Considerar campo opcional `condicion_accionista_cumplida` (boolean) o eliminar este requisito si los estatutos de la entidad lo dispensan.
- Versión `1.0.0`: pendiente bump a `1.1.0` al firmar.
- **Cláusula SEGUNDO declaración del consejero:** en sociedades cotizadas y sector financiero (banca, seguros) los requisitos de idoneidad y honorabilidad son **obligaciones reforzadas** (Solvencia II, Reglamento UE 575/2013 — CRR). La plantilla genérica menciona "los requisitos exigidos por la normativa aplicable" pero no detalla. Aceptable como redacción estándar; el due diligence del idoneidad debe quedar evidenciado en otro paso del pipeline (motor de reglas + capability_matrix).
- Fuentes Capa 2 dentro del resolver canónico (`entities.*`, `persons.*`, `agreement.*`).
- Sin variables huérfanas: las 6 placeholders (`articulo_estatutos`, `nombre_candidato`, `dni_candidato`, `cargo_denominacion`, `nombre_entidad`, `categoria_consejero`, `motivo_vacante`) están todas declaradas.
- Cláusula TERCERO inscripción RM: art. 215 LSC + art. 94 RRM exigen inscripción del nombramiento. Correcta.
