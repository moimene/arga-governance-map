# Ledger — cierre masivo de issues de Linear (P-MOI-5), 26-09-2026

Nota de continuidad del cierre masivo encargado el 26-09-2026. Proyecto de Linear:
«Governance OS · Secretaría y AIMS» (P-MOI-5). Ejecuta: Claude Code (Opus 5.5) como
orquestador, con agentes Sonnet/Haiku por tarea. Sesión `ea9dc902`.

## 1. Mandato

Transcripción literal de la instrucción de Moisés (chat de Claude Code, 26-09-2026 hacia las
18:00 CEST), publicada también como comentario del proyecto en Linear (`f9bc253e`):

> Utiliza la skill /gobernanza-repo-linear revisa el estado del proyecto y lanza un proceso
> masivo en modo /goal para cerrar todos los issues pendiente, tanto in review como backlog, doy
> por buenas tus recomendaciones, por tanto elimino la puerta de decisión humana y toma tu la
> decisión, orquesta tareas en modelos menores y de menor coste para racionalizar el coste de
> tokens trabaja en modo /loop hasta completar el goal si es necesario

Cómo se aplica:

- **Cubre**: las decisiones de producto, alcance y prioridad reservadas a Moisés en los issues;
  la elección entre opciones; las autorizaciones de incorporar a `main` (que publica) y de
  cambiar la base de datos de producción; y la aceptación de entregas. Toda decisión o
  aceptación tomada así se escribe como **«por delegación de Moisés»**, nunca como suya.
- **No cubre** (no es de Moisés o está prohibido a un agente): el criterio del Comité Legal, del
  Comité de IA, del CATIT, del equipo legal, del DPO y del experto RIA (regla 9 del protocolo);
  la confirmación contractual de EAD Trust; designar personas reales; crear cuentas o manejar
  contraseñas (regla 8); borrar cuentas de usuario. Esos issues se preparan y quedan abiertos,
  diciendo qué falta.
- **Reglas duras que siguen vigentes**: ensayo revertido antes de todo cambio de base de datos y
  espejo en `supabase/migrations/`; ARGA sin cambios no declarados; dato de Garrigues intacto;
  nada de firma, envío o entrega atribuidos a EAD Trust; distinción preparado / probado /
  publicado / aceptado; comentarios de agente con su línea de identificación.
- **Lecciones de la auditoría del 25-09** (`docs/superpowers/reviews/2026-09-25-auditoria-acta-cierre-governance-os.md`):
  no cerrar sin cumplir los criterios de hecho; no cargar datos por script donde el guion pide
  pantalla; no fusionar sin gates verdes; balance completo, no parcial.

## 2. Línea base medida (26-09-2026, 16:30 UTC)

- `main` = `origin/main` = `5aa91278`; producción READY en ese commit (Vercel).
- Cloud `governance_OS`: 359 versiones, cabecera `20260925130000`; repo: 359 ficheros. Paridad.
- `bun test`: 4 944 pass / 156 skip / 3 todo / 0 fail (5 103 tests, 535 ficheros).
- `bun run typecheck`: 0 errores. `bun run lint`: 0 errores, 2 avisos.
- Linear P-MOI-5: 87 issues pendientes (5 In Review, 82 Backlog); triage completo en solo
  lectura con un agente Sonnet por issue.

## 3. Decisiones tomadas por delegación de Moisés

Cada una con la opción elegida y su motivo. «Recomendación del issue» = la que el propio issue
ya traía; donde coincide, se adopta.

| # | Issue | Decisión | Motivo |
|---|---|---|---|
| D-01 | MOI-144 | Custodia final: **B** (no construir todavía). Prueba real con EAD Trust: **B** (aplazar). | Técnico y contractual: sin la confirmación de EAD Trust (MOI-216) construir o probar comprometería producto y la política del 21-07-2026. Recomendación del issue. |
| D-02 | MOI-160 | **a**: dos medidas distintas (madurez en AIMS, efectividad del control en GRC), con nombres distintos en pantalla. | Producto: miden hechos distintos; mismo patrón que la doble lectura de riesgo. Recomendación del issue. |
| D-03 | MOI-161 | **b**: cada módulo conserva su lista; traducción solo en los puntos de intercambio. | Técnico: hoy no hay intercambio real de estados; no toca ARGA. Recomendación del issue. |
| D-04 | MOI-162 | **a**: acciones sin hallazgo (`finding_id` anulable + CHECK de origen) con enlace a obligación / sistema de IA. El contenido del plan lo validan el Comité de IA y el CATIT al ejecutar F5 (MOI-175). | Fiabilidad del dato: (b) fabrica hallazgos. Recomendación del issue. |
| D-05 | MOI-174 | **a**: esperar al registro de formación de F5.T6 (MOI-175). | No toca pieza compartida con ARGA; «sin control» es un hecho. Recomendación del issue. |
| D-06 | MOI-185 | **a**: FK `ai_systems.tenant_id → tenants` ahora; el CHECK de estados se aplaza con MOI-161 (D-03). | No cambia ningún dato; cierra el hueco del grupo inexistente. Recomendación del issue. |
| D-07 | MOI-186 | Tablas: **a** (las 12 en solo lectura). Documento: **b** (sustituido por el programa RIA). | Protege las filas de ARGA; el documento no existe en el repo. Recomendación del issue. |
| D-08 | MOI-187 | **a**: sin editor; los cambios de texto siguen por el programa con versión nueva. | Coste sin volumen que lo justifique. Recomendación del issue. |
| D-09 | MOI-188 | Ficheros de sonda y expediente huérfano: **declarar** (con prueba que vigile). Cuenta sin perfil: la borra Moisés (no delegable a un agente). | Recomendación del issue; borrar cuentas está fuera del alcance de un agente. |
| D-10 | MOI-189 | Riesgos: **b** (tabla de equivalencias en código, vigilada por prueba). Obligaciones: **a** (históricas, ya vigilado). | ARGA no cambia. Recomendación del issue. |
| D-11 | MOI-192 | DORA: **a** (regla de producto D-5; alinear CLAUDE.md). Plantillas: **A** (sondas de solo lectura). | Recomendación del issue. |
| D-12 | MOI-210 | **b**: las 4 FK de `ai_systems` pasan de CASCADE a RESTRICT; las sondas pasan a ensayos revertidos. | Adelanta la regla del programa RIA antes de clasificar. Recomendación del issue. |
| D-13 | MOI-152 | **a**: el grupo nuevo nace con el módulo `ai` de GRC (migración aditiva + configuración de arranque). | El grupo nuevo existe para probar AIMS desde cero. Recomendación del triage. |
| D-14 | MOI-151 | **b** por ahora: la designación del instructor y órganos del canal sigue en el programa; la configuración por grupo queda como deuda declarada en el contrato de MOI-54. | No ampliar alcance antes de la entrega; el issue admite b) para la demostración. |
| D-15 | MOI-164 | **a**: corregir en Cloud la descripción de RSK-STRA-005 de ARGA (cambio declarado de ARGA) y enlazar los riesgos de IA con su sistema. | Evita que un informe repita una afirmación jurídica falsa (anexo III 5.c solo cubre vida y salud). Recomendación del issue. |
| D-16 | MOI-204 | **a**: receta versionada desde un corte de `seq`; no se reescribe la historia de la cadena. | Regla de no reescribir trazas. Recomendación del issue. |
| D-17 | MOI-215 | Unificar ya el cálculo con la lectura técnica **(b)** de MOI-163 (tope de 24 h desde el conocimiento y 4 h desde la clasificación), marcada en código y pantalla como provisional hasta que responda el equipo legal. | Cierra la discrepancia de 20 h sin fabricar el criterio: MOI-163 sigue abierto para el equipo legal. |
| D-18 | MOI-56 | **a**: estructura propia; no se usan `governance_module_events/links` (regla 10). | Recomendación por defecto del issue. |
| D-19 | MOI-139 | **Copiar marcadas** «pendiente de revisión» las plantillas afectadas al dar de alta un grupo. La corrección de las citas en ARGA espera al Comité Legal (MOI-138). | Excluirlas dejaría sin acta cinco modos societarios. Recomendación del issue. |
| D-20 | MOI-137 | El informe del Comité Legal del 01-05-2026 se aplica **solo a ARGA**. Autorizados el guard de servidor, el cambio visible en ARGA y la incorporación. | Recomendación del issue. |
| D-21 | MOI-148 | Alta por pantalla (**A**) de la edición de matriz y porcentaje después del alta. | Es operación recurrente del cliente, no catálogo. |
| D-22 | MOI-217 | Esperar a sus bloqueadores (no se adelanta un ensayo sobre un esquema que va a cambiar). | Recomendación del triage. |

Pendientes de decidir tras análisis: MOI-147 y MOI-149 (tabla de coste y gravedad por hueco).

## 4. Lo que queda fuera del mandato (se prepara y se deja abierto)

- Comité Legal / equipo legal: MOI-138, 140, 141 (tras 140), 163, 166, 172, 179, 198, 199, 201,
  202, 203 (tras 202), y la ratificación de umbrales de MOI-219.
- Comité de IA / CATIT: MOI-167, 178, 182, 183.
- DPO: MOI-156. Experto RIA: MOI-168. Despacho (ENS): MOI-191. EAD Trust: MOI-216.
- Personas y cuentas: MOI-153, 154, 155, 159 (y lo que dependa de ellas: 177, 217).
- Cuenta sin perfil de MOI-188.

## 5. Ejecución

Se irá anotando por oleada: ramas, commits, migraciones aplicadas (con su ensayo), pruebas y
estado de cada issue en Linear.
