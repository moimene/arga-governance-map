# Estado funcional del motor de reglas de Secretaría Societaria

Fecha: 2026-05-20  
Ámbito: módulo Secretaría Societaria, prototipo TGMS para Grupo ARGA Seguros  
Audiencia: equipo legal y equipo de producto jurídico  
Estado: prototipo operativo avanzado, demo-ready, no cierre productivo definitivo

Nota posterior de revisión legal: este informe describe cómo queda explicado y navegable el motor para el usuario. No debe interpretarse como certificación de completitud jurídica del motor. La revisión legal recibida el 2026-05-20 identifica bloqueantes sustantivos en rule packs, formal gates, mayorías SL, versiones activas duplicadas y cobertura de plantillas. Ver `docs/superpowers/reviews/2026-05-20-informe-legal-motor-reglas-secretaria.md`.

---

## 1. Resumen ejecutivo

El motor de reglas de Secretaría Societaria queda configurado como una cadena funcional que transforma una **materia societaria** en una decisión operativa: si puede iniciarse un expediente, bajo qué órgano, con qué mayoría, con qué fuentes jurídicas y con qué documentos mínimos.

La lógica visible para el usuario queda articulada así:

```text
Materia → regla efectiva → fuentes jurídicas → plantillas vinculadas → preflight → expediente
```

La pantalla principal de comprensión y revisión es ahora **Materias y reglas**. Ya no debe leerse como un simple catálogo, sino como la consola funcional del motor. Desde una materia concreta, el usuario puede revisar:

- qué permite o exige la ley;
- qué órgano resulta competente;
- qué mayoría y quórum aplica;
- qué añaden estatutos, reglamento o pactos;
- qué plantillas documentales alimentan el flujo;
- si el preflight habilita, bloquea o exige revisión antes de abrir expediente.

El sistema no sustituye el juicio legal. Su función actual es **normalizar, explicar, advertir y bloquear cuando falta configuración mínima**, manteniendo trazabilidad del razonamiento operativo.

---

## 2. Qué entiende el sistema por motor de reglas

En el estado actual, el motor no es una única función aislada. Es un conjunto coordinado de catálogos, reglas, fuentes, plantillas y validaciones que se ejecutan antes y durante los flujos de Secretaría.

Funcionalmente, el motor responde seis preguntas:

1. **Qué materia se quiere tramitar.**  
   Ejemplo: cese de consejero, aumento de capital, formulación de cuentas, modificación estatutaria.

2. **Qué regla efectiva aplica a esa sociedad.**  
   El motor resuelve órgano competente, mayoría, quórum, documentos obligatorios, plazos y formalización.

3. **De dónde sale la regla.**  
   Distingue ley, estatutos, reglamento, pactos parasociales y overrides documentales.

4. **Qué documentos se necesitan.**  
   Vincula la materia con plantillas protegidas para modelo de acuerdo, acta, certificación y otras fases.

5. **Si el expediente puede empezar.**  
   Ejecuta un preflight documental y jurídico-operativo antes de permitir la apertura.

6. **Qué flujo operativo se activa.**  
   Dirige al tramitador, convocatoria, reunión, acuerdo sin sesión, co-aprobación, administrador solidario, generación documental o certificación.

---

## 3. Cadena funcional actual

### 3.1 Materia

La materia es la unidad funcional de entrada. Representa el tipo de asunto societario que se quiere adoptar, documentar o registrar.

Cada materia contiene o deriva:

- etiqueta jurídica visible;
- referencia legal;
- clase o complejidad;
- necesidad de escritura pública;
- necesidad de inscripción registral;
- necesidad de publicación;
- plazo registral si existe;
- grupo funcional.

Los grupos funcionales actuales son:

- gobierno corporativo y órganos;
- cuentas anuales, resultado y auditoría;
- capital y financiación;
- operaciones estructurales;
- estatutos y normativa interna;
- operaciones especiales y vinculadas;
- información, seguimiento y control.

La materia se conserva en la navegación mediante parámetro funcional `materia`, de forma que los flujos posteriores saben qué regla aplicar.

### 3.2 Regla efectiva

La regla efectiva es la decisión que el motor usa para una sociedad concreta.

Actualmente combina:

- materia seleccionada;
- forma social y jurisdicción de la sociedad;
- regla legal base;
- overrides normativos;
- pactos parasociales vigentes;
- configuración de plantillas;
- potenciales conflictos jurisdiccionales.

La regla efectiva muestra:

- órgano competente;
- mayoría requerida;
- quórum;
- documentos obligatorios;
- plazos;
- fuentes aplicadas.

Si no hay estatutos o reglamento modelados para una materia, el sistema lo explica y aplica la regla legal por defecto. Esto es importante para el equipo legal: la ausencia de modelado no se oculta, queda visible como una limitación de fuente.

### 3.3 Fuentes jurídicas

El motor presenta las fuentes como capas. Las capas funcionales actuales son:

- **Ley:** referencia legal base aplicable.
- **Estatutos:** reglas específicas de la sociedad cuando están modeladas.
- **Reglamento:** reglas internas del órgano si están modeladas.
- **Pacto parasocial:** obligación contractual o derecho especial registrado.
- **Override documental:** ajuste gobernado con referencia documental.

Cada fuente se muestra con estado de validación:

- validado;
- pendiente de revisión;
- inferido;
- incompleto.

El objetivo funcional es que el usuario legal vea no solo el resultado, sino también **por qué el motor llega a ese resultado**.

### 3.4 Plantillas vinculadas

Las plantillas son parte de la configuración del motor, no solo un repositorio documental.

El sistema agrupa las plantillas por fase:

- pre-acuerdo;
- convocatoria;
- modelo de acuerdo;
- acta;
- certificación;
- post-acuerdo.

El **Gate PRE documental** considera como mínimas para iniciar expediente:

- modelo de acuerdo;
- acta;
- certificación.

Para cada fase, la interfaz distingue:

- plantilla activa usada por el motor;
- plantilla candidata;
- plantilla pendiente de revisión;
- plantilla faltante.

Si falta una plantilla mínima, el expediente queda bloqueado. Si existe plantilla activa suficiente, el flujo puede continuar.

### 3.5 Preflight

El preflight es la simulación previa a abrir expediente. Resume el estado de la materia seleccionada y devuelve un resultado operativo.

Resultados actuales:

- **Expediente habilitado:** la configuración mínima está completa y no hay bloqueo.
- **Revisión requerida:** existe una advertencia relevante, por ejemplo conflicto de ley aplicable.
- **Bloqueado:** falta configuración mínima, normalmente plantilla documental obligatoria.

El preflight revisa:

- materia reconocida;
- regla efectiva resuelta;
- fuentes jurídicas;
- plantillas mínimas;
- formalización posterior.

Cuando bloquea, prepara trazabilidad para auditoría del bloqueo.

### 3.6 Expediente

Cuando el preflight queda habilitado, el sistema permite pasar al flujo operativo correspondiente, conservando la materia.

Actualmente la salida principal es:

```text
/secretaria/tramitador/nuevo?materia=<MATERIA>
```

Ese parámetro permite que el tramitador y los flujos documentales posteriores carguen la regla y las plantillas adecuadas.

---

## 4. Pantallas funcionales principales

### 4.1 Materias y reglas

Es la consola principal de comprensión del motor.

Para una materia seleccionada, muestra cinco vistas:

1. **Resumen**  
   Cadena completa de decisión: materia, regla efectiva, plantillas, preflight y expediente.

2. **Regla efectiva**  
   Órgano, mayoría, quórum, documentos, plazos y fuentes aplicadas.

3. **Plantillas**  
   Gate PRE documental, plantillas activas, candidatas y faltantes.

4. **Fuentes**  
   Ley, estatutos, reglamento, pactos y overrides.

5. **Simular**  
   Resultado del motor antes de iniciar expediente.

### 4.2 Plantillas

Sigue siendo la pantalla de administración documental avanzada.

Funcionalmente sirve para:

- revisar plantillas por tipo o materia;
- identificar plantillas activas;
- revisar estado de workflow;
- acceder a configuración de motor;
- preparar o asignar plantillas.

La navegación desde una materia puede abrir Plantillas filtrada por esa materia.

### 4.3 Gestor de plantillas

Es la pantalla de edición y gobierno avanzado de plantillas protegidas.

Funcionalmente sirve para:

- mantener contenido legal;
- revisar capas de plantilla;
- comprobar Gate PRE de la plantilla;
- probar fusión documental;
- gestionar cambios bajo workflow.

### 4.4 Tramitador y flujos operativos

El tramitador consume la materia y la regla efectiva para preparar el expediente. Los flujos operativos que pueden apoyarse en el motor incluyen:

- convocatorias;
- reuniones;
- acuerdos sin sesión;
- co-aprobación;
- administrador solidario;
- generación de documentos;
- actas;
- certificaciones.

---

## 5. Ejemplo funcional: cese de consejero

Para `CESE_CONSEJERO`, el sistema permite ver la cadena completa:

```text
Cese de consejero → regla efectiva → plantillas mínimas → preflight → expediente
```

En ARGA Seguros, la pantalla muestra:

- materia: cese de consejero;
- referencia legal: art. 223 LSC;
- complejidad: ordinaria;
- órgano competente: Junta General;
- mayoría: mayoría simple;
- fuente: ley, salvo que existan estatutos, reglamento u otros overrides aplicables;
- formalización: inscripción registral cuando proceda;
- resultado del preflight: expediente habilitado si existen modelo de acuerdo, acta y certificación.

El usuario puede revisar las plantillas vinculadas antes de iniciar expediente. Si una plantilla mínima falta, el botón operativo queda bloqueado y se indica la causa.

---

## 6. Tratamiento de pactos parasociales

Los pactos parasociales se tratan como fuente diferenciada. El sistema puede mostrar que existe una obligación contractual o un derecho especial asociado a una materia.

El criterio funcional actual es:

- un pacto no invalida por sí solo un acuerdo societario;
- puede generar advertencia o bloqueo según la lógica configurada;
- debe quedar visible como fuente contractual separada de la ley y de los estatutos.

Para ARGA, el pacto demo de Fundación ARGA opera como referencia funcional para derechos de veto o mayorías reforzadas en operaciones estructurales, cuando la materia coincida.

---

## 7. Tratamiento de cotizadas

La decisión funcional vigente es que una sociedad cotizada no se bloquea automáticamente.

El motor debe:

- evaluar reglas LSC;
- añadir advertencias de régimen de cotizada o mercado cuando proceda;
- evitar bloquear por el mero hecho de ser cotizada;
- mantener visible la fuente y la razón de la advertencia.

Este criterio sigue la decisión legal ya resuelta para el prototipo.

---

## 8. Documentos y formalización

El motor no solo decide mayoría u órgano. También anticipa la vida documental del acuerdo.

Actualmente distingue:

- documento previo;
- convocatoria;
- modelo de acuerdo;
- acta;
- certificación;
- documento registral o post-acuerdo.

La formalización posterior se muestra como parte del preflight:

- archivo interno;
- certificación;
- elevación a público;
- inscripción registral;
- publicación cuando proceda.

El objetivo funcional es que el equipo legal vea desde el inicio si una materia terminará en simple archivo societario o si arrastra notaría, registro o publicación.

---

## 9. Certificación y QTSP

La integración QTSP del ecosistema se orienta a EAD Trust.

Funcionalmente, el pipeline de certificación contempla:

- generación de certificación;
- firma QES;
- sello o evidencia cualificada cuando proceda;
- timestamp;
- archivado probatorio;
- evidence bundle.

EAD Trust es el único proveedor QTSP del prototipo. No se contemplan proveedores competidores en la configuración funcional ni en la narrativa del producto.

---

## 10. Controles de gobierno y trazabilidad

El motor incorpora controles funcionales de gobierno:

- roles y permisos para acciones normativas;
- distinción entre consulta y edición;
- trazabilidad de bloqueos;
- eventos preparados para auditoría;
- separación de fuentes;
- visibilidad de configuración incompleta;
- bloqueo por falta de plantilla mínima.

Cuando una acción no está permitida para el rol, la interfaz presenta una alternativa de solicitud o revisión, en lugar de permitir la modificación directa.

---

## 11. Qué queda fuera o pendiente

El estado actual es suficientemente claro para demo y validación funcional, pero no debe interpretarse como cierre jurídico-productivo completo.

Pendientes relevantes:

- revisión legal exhaustiva de todos los rule packs prioritarios;
- validación por materia de jurisdicciones no españolas;
- cierre de equivalencias entre materias antiguas y nuevas;
- revisión de cobertura completa de plantillas por materia;
- consolidación de avisos específicos para cotizadas;
- endurecimiento de casos límite en pactos parasociales;
- comprobación destructiva en entorno aislado cuando el prototipo lo requiera.

---

## 12. Conclusión funcional

El motor de reglas queda en un estado comprensible para equipo legal como una **mesa de control normativa y documental**.

Su valor funcional actual es que permite responder, antes de iniciar un expediente:

- qué se quiere acordar;
- quién debe acordarlo;
- con qué mayoría;
- con qué fuentes;
- con qué documentos;
- qué falta;
- si se puede continuar.

La mejora principal del estado actual es que materias, reglas y plantillas ya no aparecen como catálogos separados. Se presentan como partes de una misma decisión del motor, con un preflight visible que convierte la configuración legal en una salida operativa: habilitar, advertir o bloquear.
