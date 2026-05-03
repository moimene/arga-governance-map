# Plantilla legacy NOMBRAMIENTO_AUDITOR — revisión legal 2026-05-02

**UUID Cloud:** e64ce755-9e76-4b57-8fb7-750afb94857c
**tipo:** MODELO_ACUERDO
**materia:** NOMBRAMIENTO_AUDITOR
**jurisdiccion:** ES
**organo_tipo actual:** JUNTA_GENERAL
**adoption_mode actual:** MEETING
**version actual:** 0.1.0
**estado:** ACTIVA
**aprobada_por:** **PENDIENTE FIRMA LEGAL**
**fecha_aprobacion:** **PENDIENTE FIRMA LEGAL**
**referencia_legal actual:** Arts. 263-271 LSC; LAC

## Capa 1 actual (texto inmutable)

```
PRIMERO.- Nombrar auditor de cuentas de {{denominacion_social}} para el ejercicio {{ejercicio}}, y sucesivos en caso de prórroga, a la firma {{nombre_auditora}}, con N.I.F. número {{nif_auditora}}, inscrita en el Registro Oficial de Auditores de Cuentas (ROAC) con el número {{numero_roac}}.

SEGUNDO.- Fijar los honorarios de la auditoría en la cantidad de {{honorarios_auditoria}} euros anuales más el Impuesto sobre el Valor Añadido que resulte de aplicación, conforme a las condiciones recogidas en la propuesta de servicios profesionales de fecha {{fecha_propuesta}}.

TERCERO.- El presente nombramiento se realiza al amparo de lo establecido en el artículo 264 de la Ley de Sociedades de Capital y en la Ley 22/2015, de 20 de julio, de Auditoría de Cuentas, por un período inicial de {{duracion_anos}} años, sin perjuicio de la posibilidad de prórroga en los términos previstos en la citada normativa.

CUARTO.- Autorizar al Secretario del Consejo de Administración para notificar al auditor designado el presente acuerdo, gestionar su inscripción en el Registro Mercantil y adoptar cuantas medidas sean necesarias para su ejecución.
```

## Capa 2 actual (variables)

| variable | fuente | condicion |
|---|---|---|
| denominacion_social | ENTIDAD | SIEMPRE |

## Capa 3 actual (campos editables)

| campo | obligatoriedad | descripcion |
|---|---|---|
| ejercicio | obligatorio=true | Ejercicio(s) a auditar (text) |
| nombre_auditora | obligatorio=true | Nombre de la firma auditora (text) |
| nif_auditora | obligatorio=true | NIF de la firma auditora (text) |
| numero_roac | obligatorio=true | Número ROAC (text) |
| honorarios_auditoria | obligatorio=true | Honorarios anuales (€, sin IVA) (number) |
| fecha_propuesta | obligatorio=true | Fecha de la propuesta de servicios (date) |
| duracion_anos | obligatorio=true | Duración inicial (años) (number) |

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
- Plantilla en versión `0.1.0`: bumpear a `1.0.0` al firmar.
- **Riesgo art. 264 LSC** (período mínimo y máximo): el art. 264.1 LSC establece nombramiento por período inicial mínimo de 3 años y máximo de 9, con posibilidad de prórroga anual hasta máximo 9 años adicionales. La plantilla NO valida el rango: el secretario podría introducir `duracion_anos = 1` o `duracion_anos = 12`, ambos inválidos. Considerar validación frontend: `min=3, max=9`.
- **Riesgo Reglamento UE 537/2014** (entidades de interés público): para sociedades cotizadas y otras EIP, el período máximo total de auditoría es de **10 años con prórroga hasta 24 años bajo ciertas condiciones de licitación / co-auditoría**. La plantilla no diferencia entre EIP y no-EIP. Para ARGA Seguros (cotizada, sector seguros) aplican reglas más restrictivas. Considerar alerta DL-2 (cotizada) o desdoblamiento de plantilla.
- **Riesgo art. 265 LSC** (nombramiento por el RM): si la junta no nombra auditor en plazo, el RM lo designa. La plantilla no aplica a ese supuesto. OK — caso fuera del scope normal.
- **Riesgo cláusula CUARTO inscripción RM:** el nombramiento de auditor se inscribe en el RM cuando: (a) es nombramiento por debajo de 3 años (excepcional), (b) cambio de auditor antes del fin del mandato, (c) sociedades cotizadas. En el caso normal de nombramiento dentro del período legal, la inscripción NO siempre es exigible. Revisar redacción para no inducir al secretario a una inscripción innecesaria.
- **Riesgo cláusula SEGUNDO IVA:** el texto fija "más el IVA que resulte de aplicación". Esto es correcto para servicios prestados por auditora con sede en España. Si la auditora es internacional con sede en otra jurisdicción, podría aplicar inversión del sujeto pasivo y el texto sería técnicamente incorrecto. Aceptable para uso doméstico.
- Referencias LSC y LAC vigentes (Ley 22/2015, art. 264 LSC). Sin artículos derogados.
- Sin nombres reales de cliente. Sin variables huérfanas.
