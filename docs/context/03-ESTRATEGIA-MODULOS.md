# 03 · Estrategia de módulos y carve-out

> **Cabecera viva.** Última revisión: 2026-06-13. Fija la estrategia de los puntos 3 y 4: qué módulo se hace real, cuáles son prototipo, cómo se mantiene la consola única y cómo se prepara el carve-out futuro.
> Relacionados: `→ 01` north star, `→ 02` instrucciones, `→ 04` charter legal, `→ 05` producto/mercado. Ownership operativo detallado: `/CLAUDE.md` (tabla de carriles).

---

## Tesis de módulos (decisión asentada)

| Módulo | Rutas | Nivel objetivo | Qué significa hoy |
|---|---|---|---|
| **Secretaría Societaria** | `/secretaria/*` | **Funcional y real** | Prototipo operativo avanzado **en camino a producto real**. Es la punta de lanza: motor LSC, flujos golden-path operables, generación documental, pipeline QTSP, evidencia. Aquí se sube el listón de rigor y profundidad. |
| **GRC Compass** | `/grc/*` | **Prototipo** | Conectado y navegable (riesgos, controles, incidentes, DORA, ciber, auditoría, packs país, Penal/Anticorrupción como vista). No se invierte en profundidad productiva todavía. |
| **AI Governance (AIMS 360)** | `/ai-governance/*` | **Prototipo** | Conectado y navegable (sistemas IA, incidentes IA, posture de technical file, AI Act / ISO 42001). Altas owner-write puntuales; evaluaciones aún no activas por RLS. No se invierte en profundidad productiva todavía. |
| **TGMS Console** | `/`, `/entidades`, `/organos`, … | **Capa de composición** | Compone, enruta, busca y muestra readiness. No muta verdad de los módulos. Shell rojo `--t-*`. |
| **Evidence backbone** | transversal | **Soporte** | Referencias, bundles/stubs, auditoría WORM. No declarar evidencia final mientras esté en HOLD. |

**Lectura corta:** *Secretaría es el producto; GRC y AIMS son la prueba de que la arquitectura escala a un sistema completo de gobernanza; la consola es el pegamento.*

---

## Por qué esta asimetría es deliberada

- **Foco comercial.** Un producto que vende necesita un módulo que se defienda solo ante un cliente exigente. Secretaría —con motor jurídico y evidencia cualificada— es ese módulo (`→ 05`).
- **Prueba de arquitectura.** GRC y AIMS, aun como prototipos, demuestran que el sustrato (identidad corporativa canónica, consola de composición, hilo de evidencia, handoffs) **soporta múltiples dominios** sin reescritura. Eso es lo que convierte «un módulo» en «un sistema de gobernanza de grupo».
- **Economía de esfuerzo.** No tiene sentido productivizar tres módulos a la vez. Se profundiza donde hay tracción (Secretaría) y se mantiene lo demás conectado y honesto.

---

## La consola única: composición sin colapso

Todo vive en **una sola consola general de gobernanza**. El principio operativo:

- **Cada módulo es dueño de sus escrituras.** Secretaría no crea riesgos GRC; GRC no crea actos societarios; AIMS no crea riesgos ni actos. (Tabla completa de ownership en `/CLAUDE.md`.)
- **La consola compone:** readiness, búsqueda cross-module (Cmd+K), rutas a owners.
- **Los cruces son handoffs read-only por navegación**, no escrituras cruzadas. Ejemplos: gap de technical file AIMS → `/grc/risk-360?...`; incidente material → intake de reunión en Secretaría. No se escribe en `governance_module_events` ni `governance_module_links`.
- **Doble identidad visual intencional:** shell TGMS (rojo `--t-*`) para composición; módulos Garrigues (verde `--g-*`) para dominio. Un mismo módulo puede funcionar **dentro** del shell TGMS o **como producto Garrigues autónomo** para clientes más pequeños.

---

## Sustrato compartido (lo que hace posible el sistema)

Lo que permite añadir dominios sin rehacer todo:

- **Modelo canónico de identidad corporativa** (entidades, perfiles de capital, clases, condiciones de persona, holdings, representaciones, proyección de partes votantes, censo snapshot WORM). Es la base sobre la que el motor LSC y la evidencia operan.
- **Motor de reglas LSC** (`src/lib/rules-engine/`): jerarquía normativa, convocatoria, constitución, mayorías, sin sesión, documentación, bordes no computables, pactos parasociales, orquestador.
- **Pipeline de evidencia / QTSP** (firma QES, QSeal, ERDS, sellado, archivado SHA-512, audit WORM con hash encadenado).
- **RBAC + SoD** (roles, pares tóxicos, capability matrix) y **RLS** por tenant.

Un dominio nuevo de gobernanza «encaja» si reutiliza este sustrato en vez de inventar el suyo.

---

## Carve-out futuro (punto 4)

Es un proyecto **muy complejo** y, en algún momento, podrá hacerse **carve-out de módulos** como productos/repos independientes. Hoy **no es prioridad**: ambos modos (dentro del shell TGMS y como producto Garrigues autónomo) conviven en este repo.

**Estado actual:** segregación a repos independientes por módulo = **trabajo futuro, no prioridad**. No abrir infraestructura enterprise nueva sin paquete product-complete aprobado.

**Qué facilita un carve-out limpio el día que llegue (y por tanto qué cuidar ya):**

- **Límites de ownership nítidos** entre módulos (ya vigentes) → un módulo se puede extraer si no escribe en tablas de otro.
- **Cruces como handoffs read-only** (ya vigentes) → desacoplan módulos; un carve-out reemplaza la navegación interna por una integración entre productos.
- **Sustrato compartido identificado** (modelo canónico, motor, evidencia, RBAC) → decidir, llegado el caso, qué se replica por producto y qué queda como **servicio compartido** (p. ej. identidad/evidencia como plataforma común).
- **Doble identidad visual ya soportada** → un módulo Garrigues autónomo ya sabe vivir sin el shell rojo.

**Disparadores plausibles del carve-out:** tracción comercial de un módulo concreto (típicamente Secretaría) que justifique producto propio; clientes medianos/pequeños que solo quieren uno o varios módulos Garrigues sin shell TGMS; necesidad de aislamiento regulatorio o de escalado independiente.

**Regla de oro entretanto:** diseñar como si el carve-out fuera a ocurrir (límites limpios), pero **no pagar su coste hoy** (no duplicar, no segregar, no sobre-abstraer para un único caso).

---

## Modelo comercial (cómo se empaqueta)

- **Clientes grandes:** shell TGMS completo + todos los módulos (sistema de gobernanza de grupo).
- **Clientes medianos/pequeños:** uno o varios **módulos Garrigues** sin shell TGMS.

Esto refuerza por qué Secretaría debe poder valerse por sí misma: es el primer candidato a venderse suelto.

---

## Implicaciones para el día a día

- Invierte profundidad en **Secretaría**; mantén **GRC/AIMS** conectados y honestos, sin sobre-ingeniería.
- No muevas lógica de dominio a la consola ni entre módulos.
- Cuida los límites de ownership y los handoffs read-only: son, además de una regla operativa, la **opción de carve-out** que no queremos perder.
- Antes de añadir un dominio nuevo, pregúntate si reutiliza el sustrato compartido; si no, probablemente no encaja aún.
