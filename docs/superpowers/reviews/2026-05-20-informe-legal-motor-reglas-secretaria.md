# Informe legal sobre el motor de reglas de Secretaría 360

Fecha de incorporación: 2026-05-20  
Origen: revisión legal funcional recibida para Secretaría 360  
Ámbito: motor de reglas, Matter Registry, MatterExecutionProfile, rule packs, plantillas y flujos de adopción  
Estado: input legal vinculante para priorización, no implementación automática

---

## 1. Lectura ejecutiva

La revisión legal confirma que el sistema ya tiene piezas operativas estables, pero también establece una distinción crítica:

```text
El sistema selecciona plantillas y explica la regla, pero todavía no evalúa de forma completa la validez formal de la adopción ni la tramitación posterior.
```

Por tanto, la UX actual de `Materias y reglas` puede considerarse correcta como **mesa de comprensión del motor**, pero el motor jurídico no debe darse por completo hasta cerrar las lagunas sustantivas descritas por Legal.

La conclusión operativa es:

- se puede mantener la UX de explicación del motor;
- no se debe ampliar funcionalmente el motor sin respuestas legales;
- no se deben conectar nuevos gates bloqueantes sin revisar rule packs y decisiones P1-P10;
- las únicas acciones ejecutables sin Legal son documentales o read-only.

---

## 2. Componentes reconocidos como estables

Legal identifica tres piezas principales ya implementadas y estables en `main`:

| Componente | Commit referido por Legal | Estado legal |
|---|---:|---|
| Matter Registry, selector documental | `4b4c866` | Estable, operativo |
| MatterExecutionProfile, módulo puro con 5 funciones y tests | `08eb9b6` | Implementado, tests pasan |
| Dossier de revisión legal expandido | `ac15b77` | Listo para envío a Garrigues |

El Matter Registry resuelve qué plantilla usar para una combinación de:

- materia;
- órgano;
- modo de adopción;
- tipo social;
- jurisdicción.

Pero Legal aclara que no modela por sí solo:

- cómo se adopta válidamente el acuerdo;
- si se cumplen todos los requisitos formales;
- qué sucede después de la adopción;
- si una tramitación registral posterior será aceptable.

---

## 3. Lagunas estructurales identificadas

### 3.1 Requisitos formales no evaluables

Legal identifica que la lógica de validez formal está dispersa y no conectada como regla ejecutable:

- El texto de plantilla contiene plazos y condiciones narrativas, pero el texto renderizado no es un gate evaluable.
- Los rule packs calculan elementos como capital concurrente, conflictos y pactos, pero esos resultados se incorporan como snapshot y no siempre como bloqueo previo.
- Los metadatos de plantilla (`organo_tipo`, `adoption_mode`, `referencia_legal`) clasifican documentos, pero no equivalen a requisitos formales ejecutables.

Implicación: no basta con que una plantilla exista o se seleccione. El sistema necesita evaluar si los hechos del expediente cumplen las condiciones formales de adopción.

### 3.2 Ciclo de vida de tramitación desconectado

Legal indica que el `TramitadorStepper` todavía no está plenamente conectado al Registry como workflow integral.

Falta cerrar la cadena:

```text
convocatoria → reunión o sin sesión → acuerdo → certificación → elevación → inscripción
```

El `adoption_mode` distingue seis vías:

- `MEETING`;
- `NO_SESSION`;
- `UNIPERSONAL_SOCIO`;
- `UNIPERSONAL_ADMIN`;
- `CO_APROBACION`;
- `SOLIDARIO`.

Pero actualmente el Matter Registry usa ese eje sobre todo para seleccionar plantilla, no para evaluar requisitos formales propios de cada vía.

### 3.3 Versiones duplicadas de rule packs

Legal detecta ocho contextos materia + órgano con dos versiones activas simultáneas. Esto genera indeterminismo.

Contextos destacados:

| Materia | Riesgo identificado |
|---|---|
| AUMENTO_CAPITAL | Una versión sin convocatoria y otra con convocatoria completa |
| REDUCCION_CAPITAL | Mismo patrón que aumento de capital |
| APROBACION_CUENTAS | Divergencia en plazo SA, 30 días frente a 15 días |
| DELEGACION_FACULTADES | La versión 1.1.0 añade verificación art. 249 LSC |
| NOMBRAMIENTO_AUDITOR | Dos versiones activas simultáneas |
| AUTORIZACION_GARANTIA | Versiones 1.1.0 y 1.0.0 activas |

Implicación: antes de endurecer gates o conectar flujos, hay que eliminar ambigüedad sobre qué rule pack está vigente.

### 3.4 Error sustantivo en mayorías SL

Legal identifica como laguna urgente la diferenciación de mayorías en sociedades limitadas.

Ejemplo de riesgo: un aumento de capital en SL proclamado aprobado con 40% de votos cuando la LSC exige más del 50% conforme al art. 199 LSC puede ser impugnable.

Implicación: esta corrección debe priorizarse antes de conectar paneles informativos a decisiones bloqueantes.

### 3.5 Validaciones específicas ausentes

Legal identifica carencias concretas:

- Cooptación: la plantilla de nombramiento por cooptación, art. 244 LSC, debe restringirse a SA.
- Nombramiento de auditor: debe validarse duración de 3 a 9 años, art. 264 LSC.
- Reducción de capital: existe variable `tipo_social`, pero no se usa suficientemente.
- Modificación de estatutos: no se captura derecho de información del art. 287 LSC ni publicación BORME.

---

## 4. Mejoras propuestas por Legal

### 4.1 Evaluación dinámica con `evaluateFormalGate`

Legal propone añadir un paso dinámico que cruce el perfil estático con el estado real del expediente.

Preguntas que debería responder:

- ¿se convocó con plazo suficiente?
- ¿se alcanzó quórum?
- ¿se alcanzó mayoría?
- ¿existe formulación previa cuando es requisito?
- ¿se han cumplido prerequisitos documentales?

El stepper debe alimentar evidencias al evaluador.

### 4.2 Estatutos como repositorio versionado

Los overrides estatutarios actuales entran por `rule_param_overrides` como JSON plano.

Legal propone una tabla dedicada para que el sistema conozca reglas estatutarias permanentes de la sociedad sin que el secretario deba declararlas expediente por expediente.

### 4.3 Conexión `TramitadorStepper` → `MatterExecutionProfile`

El stepper debe consumir el perfil como contexto propositivo.

Funcionalmente, debería mostrar gates y advertencias en cada checkpoint, en lugar de esperar al final del expediente.

La ruta rápida de duplicar último expediente debería usar campos refrescables para minimizar recaptura manual.

### 4.4 Validación cruzada por gate y tipo social

Legal recomienda no validar por materia completa ni por muestreo.

Estrategia propuesta:

1. Extraer valores de quórum y mayoría de todos los rule packs vigentes.
2. Cruzar con tabla LSC, especialmente arts. 194, 199 y 201.
3. Clasificar divergencias como override estatutario legítimo, error de rule pack o error de clasificación del perfil.
4. Priorizar materias inscribibles o sujetas a calificación registral.

### 4.5 Sistema de `risk_flags` con regla de absorción

Legal propone jerarquía:

| Riesgo | Regla funcional |
|---|---|
| NULIDAD | Absorbe todo |
| IMPUGNABILIDAD | Absorbe CALIFICACION_REGISTRAL |
| CALIFICACION_REGISTRAL | Absorbe TRAZABILIDAD_PARCIAL |
| TRAZABILIDAD_PARCIAL | No absorbe nada |

---

## 5. Ampliación de cobertura propuesta

### 5.1 Gaps sustantivos con rule pack pero sin plantilla operativa

Materias señaladas:

| Materia | Órgano | Gates críticos |
|---|---|---|
| APLICACION_RESULTADO | Junta General | Prerequisito APROBACION_CUENTAS |
| EXCLUSION_DERECHO_SUSCRIPCION_PREFERENTE | Junta General | Quórum reforzado art. 194; informe administradores art. 308 LSC; inscripción |
| NOMBRAMIENTO_CONSEJERO | Junta General | Subtipos ORDINARIO, COOPTACION, RENOVACION; documentación; inscripción |
| CESE_CONSEJERO | Junta General | Subtipos AD_NUTUM, RENUNCIA, CESE_AUTOMATICO |

### 5.2 Trece materias SL / Consejo nuevas

Primera tanda, tramitación mensual:

- ACUERDO_CONVOCATORIA_JUNTA;
- DIVIDENDO_A_CUENTA;
- TRASLADO_DOMICILIO_NACIONAL;
- EJECUCION_AUMENTO_DELEGADO;
- AUTORIZACION_GARANTIA_CONSEJO;
- PODER_REPRESENTACION.

Segunda tanda, menor frecuencia:

- TRANSMISION_PARTICIPACIONES;
- EXCLUSION_SOCIO;
- SEPARACION_SOCIO;
- PRESTACIONES_ACCESORIAS;
- CONTRATOS_SOCIO_UNICO;
- APROBACION_PRESUPUESTO;
- CUENTAS_CONSOLIDADAS.

### 5.3 Materias de prioridad absoluta

Legal prioriza materias inscribibles con calificación registral:

| Materia | Gates críticos | Motivo |
|---|---|---|
| MODIFICACION_ESTATUTOS | Quórum, mayoría, documentación | Inscribible, régimen reforzado |
| AUMENTO_CAPITAL | Quórum, mayoría, documentación | Inscribible, régimen reforzado |
| REDUCCION_CAPITAL | Quórum, mayoría, documentación, acreedores | Inscribible, oposición de acreedores |
| FUSION_ESCISION | Quórum, mayoría, documentación | Inscribible, RDL 5/2023 |
| NOMBRAMIENTO_CONSEJERO | Mayoría, documentación, subtipo | Inscribible, cooptación solo SA |
| DELEGACION_FACULTADES | Mayoría especial, documentación | Inscribible, art. 249 LSC |
| NOMBRAMIENTO_AUDITOR | Duración 3-9 años, documentación | Inscribible, calificación registral |

---

## 6. Bloqueantes inmediatos

Legal declara bloqueado el desarrollo adicional hasta recibir respuesta de Garrigues a las preguntas P1-P10 del dossier.

Las decisiones jurídicas pendientes incluyen:

- plazo de CdA;
- segunda convocatoria en SL;
- severidad de prerequisitos;
- cooptación en SL;
- operaciones vinculadas en no cotizadas;
- comunicación regulatoria.

No debe escribirse nuevo código funcional ni modificarse UX sustantiva del motor para cubrir estas materias hasta cerrar esos criterios.

---

## 7. Acciones permitidas sin esperar a Legal

Según la revisión, solo son ejecutables sin nueva decisión legal:

1. Separar los tres archivos del draft a `docs/superpowers/specs/`.
2. Ejecutar SQL read-only de extracción de rule packs.
3. Preparar y enviar el paquete completo a Garrigues.

Acciones expresamente no recomendadas sin Legal:

- endurecer gates bloqueantes;
- añadir nuevas materias ejecutables;
- conectar paneles informativos como decisiones formales;
- resolver por código las preguntas P1-P10;
- ampliar la UX como si las decisiones legales estuvieran cerradas.

---

## 8. Impacto sobre la UX ya implementada

La UX actual de `Materias y reglas` sigue siendo útil porque explica la cadena del motor.

Sin embargo, debe presentarse como:

- consola de comprensión;
- mesa de control;
- preflight preliminar;
- soporte a revisión legal.

No debe presentarse como:

- certificación de validez jurídica completa;
- sustituto de revisión legal;
- motor definitivo de adopción formal;
- cobertura cerrada de todos los requisitos registrales.

La etiqueta "Expediente habilitado" debe entenderse en el estado actual como habilitación funcional por configuración mínima, no como dictamen jurídico final.

---

## 9. Decisión operativa recomendada

Hasta recibir respuesta legal:

1. Congelar ampliaciones funcionales del motor.
2. Mantener la UX actual como herramienta de explicación y revisión.
3. Priorizar limpieza documental, extracción read-only y envío del dossier.
4. No convertir findings informativos en bloqueos automáticos nuevos.
5. Cuando Legal responda, abrir sprint específico para:
   - deduplicar rule packs activos;
   - corregir mayorías SL;
   - implementar `evaluateFormalGate`;
   - conectar `TramitadorStepper` con `MatterExecutionProfile`;
   - añadir `risk_flags` con jerarquía de absorción.

El plan operativo de cierre de gaps queda consolidado en `docs/superpowers/plans/2026-05-20-cierre-gaps-motor-reglas-secretaria.md`.

---

## 10. Conclusión

El informe legal no contradice la mejora UX del motor, pero rebaja su alcance jurídico.

El estado correcto a comunicar es:

```text
La plataforma ya explica y organiza el motor de reglas, pero la validación formal completa de adopción y tramitación está pendiente de decisiones legales y saneamiento de rule packs.
```

La prioridad inmediata no es construir más UI, sino cerrar criterios legales, extraer evidencia read-only y preparar el paquete de revisión para Garrigues.
