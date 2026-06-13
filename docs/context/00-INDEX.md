# Contexto del proyecto — Índice y bootstrap de continuidad

> **Propósito de esta carpeta.** `docs/context/` es la **capa de contexto estratégico y memoria** del proyecto: documentos cortos, estables y de alto nivel que permiten **arrancar una conversación nueva y fresca** sobre TGMS / arga-governance-map sin releer el historial granular de sprints. No sustituye a `CLAUDE.md` ni a `AGENTS.md` (que son la verdad operativa de ingeniería); se sitúa **por encima**, para fijar visión, estrategia, disciplina legal y dimensión de producto/mercado.

> **Fecha de creación:** 2026-06-13. **Idioma:** español (idioma del proyecto). **Mantener vivo:** cuando una decisión estratégica cambie, actualizar el documento correspondiente y la fecha de su cabecera.

---

## Cómo usar estas herramientas de contexto

**Si retomas el proyecto en una conversación nueva, lee en este orden:**

1. **`00-INDEX.md`** (este documento) — mapa y reglas de arranque.
2. **`01-NORTH-STAR.md`** — qué estamos construyendo y por qué: el sistema completo de gobernanza de un grupo/compañía.
3. **`02-INSTRUCCIONES-TRABAJO.md`** — cómo trabajar: principios, guardrails, qué tocar y qué no.
4. **`03-ESTRATEGIA-MODULOS.md`** — Secretaría real vs. AIMS/GRC prototipo, consola unificada, ownership y carve-out futuro.
5. **`04-CHARTER-LEGAL-NORMATIVO.md`** — rigor legal no negociable + registro normativo (norma → módulo → obligación → evidencia).
6. **`05-PRODUCTO-Y-MERCADO.md`** — posicionamiento, ICP, modelo comercial, marco competitivo y escaneo de mercado.

**Después**, y solo cuando vayas a tocar código o datos, pasa a la verdad operativa:

- **`/CLAUDE.md`** — instrucciones operativas exhaustivas (entorno Supabase, guardrails, ownership de carriles, historial de sprints, reglas UX Garrigues).
- **`/AGENTS.md`** — guía equivalente para agentes/desarrolladores.
- **`/PRODUCT.md`**, **`/DESIGN.md`** — registro de producto y sistema de diseño.
- **`docs/superpowers/specs/`** y **`docs/superpowers/plans/`** — specs y planes consolidados.

---

## Las seis decisiones que fija este contexto

Esta suite existe para dejar grabadas, de forma duradera, seis ideas que el proyecto da por asentadas:

1. **Instrucciones de trabajo claras** para cualquier conversación nueva → `02`.
2. **Documentos de contexto** que dan continuidad → toda la carpeta `docs/context/`.
3. **Estrategia de módulos:** Secretaría Societaria se hace **funcional y real**; **AIMS 360 y GRC Compass son prototipos**; todo vive en la **consola general de gobernanza (TGMS Console)**; el objetivo es la **arquitectura de un sistema completo de gobernanza** de un grupo o compañía → `03`.
4. **Carve-out futuro:** es un proyecto muy complejo; en algún momento podrá segregarse módulos a productos/repos independientes → `03`.
5. **Máximo rigor legal y normativo:** es una herramienta de **procesos corporativos críticos y, sobre todo, legales** → `04`.
6. **Es un producto** y caben **análisis de mercado** → `05`.

---

## Identidad mínima del proyecto (resumen de un vistazo)

- **Nombre interno / repo:** TGMS Platform — `arga-governance-map`.
- **Qué es:** plataforma/prototipo operativo avanzado de **gobernanza corporativa** para grupos (origen: grupo asegurador multinacional).
- **Cliente demo (pseudónimo):** **Grupo ARGA Seguros** — nombre ficticio; nunca usar el nombre real del cliente en código, datos, seeds, docs ni commits.
- **Promotor / autoría legal:** módulos **Garrigues** (identidad verde `#004438`), con **EAD Trust (g-digital)** como QTSP del ecosistema (firma cualificada eIDAS2).
- **Stack:** React 18 + TypeScript + Vite + Tailwind + shadcn/ui; Supabase (`governance_OS`, `hzqwefkwsxopwrmtksbg`, eu-central-1) + TanStack Query.
- **Fase actual:** prototipo demo-ready; `governance_OS` es entorno activo y fuente de verdad hasta estabilidad pre-release.

---

## Relación con la memoria de continuidad

Conforme a la instrucción global del usuario («generar documentos de memoria .md que permitan la continuidad de conversaciones nuevas y frescas sobre el mismo asunto»), **esta carpeta es el punto de entrada de memoria**. Cuando se cierre una conversación relevante, dejar el rastro aquí (actualizando el doc adecuado) en lugar de dispersarlo.

Enlaces cruzados: cada documento referencia a los demás con su número (`→ 03`, `→ 04`). Si añades documentos nuevos, numéralos y enlázalos desde este índice.
