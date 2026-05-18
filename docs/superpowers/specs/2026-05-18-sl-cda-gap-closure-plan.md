# Cierre de Lagunas SL y Consejo de Administración

**Fecha:** 2026-05-18  
**Estado:** criterios técnicos aplicados en `MatterExecutionProfile`; rule packs pendientes de saneamiento Cloud controlado.

## Motivo

El perfil de ejecución estaba demasiado centrado en SA + Junta General. Para Secretaría Societaria, el caso operativo diario es con frecuencia SL/SLU y Consejo de Administración: filiales de grupo, sociedades familiares, sociedades profesionales y órganos de administración con acuerdos recurrentes.

La corrección urgente es doble:
- No heredar sin control mayorías SL incorrectas desde rule packs.
- Cubrir materias frecuentes de Consejo que ya existen en seeds o plantillas pero no tenían perfil formal suficiente.

## 1. Mayorías SL

El perfil pasa a tener baseline LSC propio para SL/SLU cuando el órgano es Junta General:

| Nivel | Fuente | Umbral aplicado | Materias iniciales |
|---|---|---:|---|
| Ordinaria | Art. 198 LSC | `> 1/3` capital social total con derecho de voto | cuentas, dividendos, nombramientos, ceses, auditor, ratificación |
| Reforzada legal | Art. 199.a LSC | `> 1/2` capital social total con derecho de voto | aumento/reducción capital, modificación estatutos, cambio denominación, traslado domicilio nacional si es modificación estatutaria |
| Reforzada cualificada | Art. 199.b LSC | `>= 2/3` capital social total con derecho de voto | fusión, escisión, transformación, cesión global, exclusión derecho suscripción, autorización competencia, exclusión socio |
| Estatutaria | Art. 200 LSC | Override superior a la legal | `rule_param_overrides.mayoria_estatutaria_sl` |

Si el rule pack informa una fórmula SL incoherente con el baseline, el perfil aplica la regla LSC y genera gap `SL_MAJORITY_RULE_PACK_MISMATCH` de severidad `INFO`. Esto evita proclamar acuerdos SL con una mayoría incorrecta mientras se sanea Cloud.

Si una materia SL no está clasificada en ninguno de estos tres niveles, el perfil no asume por defecto la mayoría ordinaria. Mantiene la fórmula del rule pack si existe, no activa threshold automático y genera `SL_MAJORITY_CLASSIFICATION_PENDING` (`WARNING`) para revisión legal.

## 2. Convocatoria SL

La forma de convocatoria de SL/SLU depende de estatutos conforme al art. 173 LSC.

Implementado:
- `rule_param_overrides.convocatoria_forma_sl` permite sustituir los canales del rule pack por la forma estatutaria.
- Si no existe override, el perfil usa el canal del rule pack y genera gap `SL_CONVOCATION_FORM_STATUTORY_SOURCE_NOT_MODELED` de severidad `INFO`.
- La segunda convocatoria SL sigue `false` por defecto salvo `rule_param_overrides.segunda_convocatoria_sl = true`.

## 3. Materias Frecuentes De Consejo

Se añade cobertura formal inicial para materias que ya existían en seeds o UI:

| Materia | Órgano | Perfil aplicado |
|---|---|---|
| `DIVIDENDO_A_CUENTA` | Consejo | Prerequisito `ESTADO_CONTABLE_LIQUIDEZ` documentado; fuente art. 277 LSC. |
| `EJECUCION_AUMENTO_DELEGADO` | Consejo | Prerequisito `ACUERDO_JUNTA_DELEGACION_AUMENTO` aprobado; fuente art. 297 LSC. |
| `TRASLADO_DOMICILIO_NACIONAL` | Consejo | Competencia del órgano de administración salvo reserva estatutaria; si `traslado_domicilio_reservado_junta = true`, gap `BLOCKING`. |
| `APROBACION_PLAN_NEGOCIO` / `APROBACION_PRESUPUESTO` | Consejo | Marcadas como potencialmente indelegables si se tramitan por comisión delegada. |
| `CONVOCATORIA_JUNTA` / `ACUERDO_CONVOCATORIA_JUNTA` | Consejo | Marcadas como materia indelegable art. 249 bis si se tramitan por órgano delegado. |

## 4. Gate Art. 249 Bis

El perfil genera `ARTICLE_249_BIS_INDELEGABLE_MATTER` cuando una materia potencialmente indelegable se intenta tramitar por `COMISION_DELEGADA` o `CONSEJERO_DELEGADO`.

Materias iniciales:
- `FORMULACION_CUENTAS`
- `CUENTAS_CONSOLIDADAS`
- `MODIFICACION_ESTATUTOS`
- `CONVOCATORIA_JUNTA`
- `POLITICA_REMUNERACION`
- `POLITICAS_CORPORATIVAS`
- `APROBACION_PLAN_NEGOCIO`
- `APROBACION_PRESUPUESTO`
- `DISTRIBUCION_CARGOS`
- `COMITES_INTERNOS`
- `DELEGACION_FACULTADES`
- `OPERACION_VINCULADA`

La severidad es `WARNING` con `risk_flag: IMPUGNABILIDAD`, porque puede existir una lectura estatutaria o de alcance material que deba validar el secretario, pero el sistema no debe asumir sin contexto que la comisión es competente.

## 5. Materias SL Pendientes

Quedan como backlog v0.2.0:

| Materia | Régimen | Trabajo pendiente |
|---|---|---|
| `TRANSMISION_PARTICIPACIONES` | Arts. 106-112 LSC | Materia nueva con adquisición preferente, plazos y libro registro socios. |
| `PRESTACIONES_ACCESORIAS` | Arts. 86 y 89 LSC | Materia nueva con consentimiento individual del socio afectado. |
| `EXCLUSION_SOCIO` | Arts. 350-352 LSC | Perfil SL específico con mayoría reforzada y resolución judicial si procede. |
| `CONTRATOS_SOCIO_UNICO` | Art. 16 LSC | Gate documental para SLU y libro-registro de contratos. |
| `INSCRIPCION_UNIPERSONALIDAD` | Arts. 12-17 LSC | Gate post-acuerdo con plazo y responsabilidad art. 14 LSC. |

## 6. Siguiente Paso Cloud

Antes de conectar el panel informativo al `TramitadorStepper`, Ingeniería debe revisar rule packs SL con la SQL de auditoría y corregir payloads que todavía codifican:
- SL ordinaria como `> 1/2` en vez de `> 1/3`.
- Materias reforzadas SL sin distinguir `> 1/2` y `>= 2/3`.
- Convocatoria SA con 15 días.
- Materias de Consejo que usan denominadores de Junta o viceversa.

Hasta que Cloud esté saneado, el `MatterExecutionProfile` aplica baseline LSC defensivo y deja gap de trazabilidad del rule pack.
