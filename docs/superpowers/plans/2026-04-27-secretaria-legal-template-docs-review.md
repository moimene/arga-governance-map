# 2026-04-27 — Revision de documentos legales para cobertura de plantillas

## Proposito

Revisar los documentos entregados por el equipo legal y convertirlos en una lectura accionable para Secretaria Societaria, sin aplicar migraciones, sin crear schema, sin regenerar tipos y sin tocar RLS/RPC/storage.

## Fuentes revisadas

- `docs/legal-team/specs acuerdos/Plantillas y lógica ✅.md`
- `docs/legal-team/specs acuerdos/CUADRO DE PLANTILLAS EDITABLES EN WORD.md`
- `docs/legal-team/specs acuerdos/LSC_Rule_Engine_Expansion_Master_Reference (1).xlsx`
- `docs/legal-team/specs acuerdos/Especificacion_Tecnica_Motor_Reglas_LSC_v2_1.docx`

## Conclusiones ejecutivas

1. El equipo legal ha entregado una base suficiente para completar la cobertura funcional de plantillas, pero no debe cargarse directamente en Supabase durante el freeze.
2. Los documentos cubren tres capas distintas que debemos mantener separadas:
   - modelos Word base;
   - playbook juridico por materia;
   - matriz tecnica de reglas, variables y adoption modes.
3. La generacion documental actual esta bien encaminada: ya hay seleccion compatible de plantilla, preflight de variables, routing por proceso y generacion DOCX.
4. El principal gap no es el motor DOCX, sino la normalizacion del catalogo legal a un contrato canonico de variables y tipos de plantilla.
5. Hay una inconsistencia P0 de nombres de variables entre los documentos legales, el YAML local y el resolver actual.
6. La normalizacion de plantillas no cambia el eje canonico: `agreements.id` sigue siendo el identificador 360 del acto societario; materia, plantilla y documento son atributos/fases del acuerdo.
7. Bajo la regla vigente, lo que se puede hacer ahora es inventario, normalizacion docs/UI, tests puros y preparacion de fixtures; no carga de plantillas en BD ni migraciones.

## Lectura por documento

### 1. `Plantillas y logica`

Contenido util:

- Tabla estructurada de 20 acuerdos iniciales:
  - `J-01` a `J-10` para Junta;
  - `CA-01` a `CA-10` para Consejo.
- Cada acuerdo incluye:
  - organo;
  - texto de orden del dia;
  - texto estandar del acuerdo para acta;
  - variables que deben existir antes de convocatoria;
  - variables que se completan en acta.
- Incluye playbook completo con texto de convocatoria, texto de acta y reglas para:
  - cuentas;
  - nombramientos/ceses;
  - auditor;
  - aumento de capital;
  - dividendos;
  - delegacion de facultades;
  - operaciones estructurales;
  - activos esenciales;
  - remuneracion;
  - operaciones vinculadas;
  - formulacion de cuentas;
  - politicas;
  - financiacion/garantias;
  - poderes;
  - cargos del consejo;
  - informes de administradores;
  - operaciones relevantes;
  - comites;
  - D&O.

Valor para producto:

- Es la fuente de contenido juridico para `MODELO_ACUERDO`, `CONVOCATORIA`, `ACTA_SESION` y `CERTIFICACION`.
- Confirma que los puntos del orden del dia y los acuerdos son listas dinamicas, no campos fijos.
- Refuerza el criterio de Acuerdo 360: convocatoria -> reunion/acta -> certificacion.
- No sustituye `agreement_id`; cada texto dispositivo debe poder terminar vinculado al acuerdo canonico.

Gap:

- Los codigos `J-01/J-02...` no coinciden exactamente con el catalogo tecnico del Excel, que usa `J1/J2...` y `CA-01...`.
- Hay que crear una tabla de equivalencias antes de automatizar.

### 2. `CUADRO DE PLANTILLAS EDITABLES EN WORD`

Contenido util:

- Cinco modelos Word base:
  - Convocatoria Junta General de Socios.
  - Convocatoria Consejo de Administracion.
  - Acta de Junta General de Socios.
  - Acta de Consejo de Administracion.
  - Certificacion de acuerdos.
- Lista de campos variables editables en formato corchete:
  - `[Ciudad]`
  - `[Fecha de emision]`
  - `[NOMBRE DE LA SOCIEDAD]`
  - `[Lugar de celebracion]`
  - `[Punto X del orden del dia]`
  - `[Redaccion del acuerdo X]`
  - `[Transcripcion literal de los acuerdos]`
  - otros.

Valor para producto:

- Es el esqueleto de plantillas Word para el primer hito humano.
- Encaja bien con el modelo actual de tres capas:
  - capa 1: redaccion protegida;
  - capa 2: variables auto-resueltas;
  - capa 3: editables de usuario/legal.

Gap:

- Usa placeholders `[Campo]`, mientras el motor actual usa Handlebars `{{campo}}`.
- Debe normalizarse antes de entrar en el generador.

### 3. Excel `LSC_Rule_Engine_Expansion_Master_Reference`

Contenido util:

- Catalogo completo de materias:
  - 22 materias de Consejo (`CA-01` a `CA-22`);
  - 24 materias de Junta (`J1` a `J24`);
  - total: 46 materias operativas.
- 12 rule packs nuevos:
  - `CUENTAS_CONSOLIDADAS`
  - `INFORME_GESTION`
  - `COOPTACION`
  - `DELEGACION_FACULTADES`
  - `PODERES_APODERADOS`
  - `TRASLADO_DOMICILIO`
  - `DIVIDENDO_A_CUENTA`
  - `EJECUCION_AUMENTO_DELEGADO`
  - `WEB_CORPORATIVA`
  - `NOMBRAMIENTO_AUDITOR`
  - `AUTOCARTERA`
  - `DISOLUCION_LIQUIDADORES`
- Contrato de variables v1.1 con 49 variables.
- Expansion de adoption modes:
  - `MEETING`
  - `UNIVERSAL`
  - `NO_SESSION`
  - `UNIPERSONAL_SOCIO`
  - `UNIPERSONAL_ADMIN`
  - `CO_APROBACION`
  - `SOLIDARIO`
- Checklist go-live con bloqueantes de plantillas, snapshots, QES, pactos y evidence.

Valor para producto:

- Es la matriz de control que permite decir por materia:
  - que plantilla aplica;
  - que rule pack aplica;
  - que documentos son obligatorios;
  - que variables nuevas exige;
  - que post-acuerdo dispara;
  - si requiere escritura, instancia, publicacion o inscripcion.

Gap:

- El checklist incluye controles de schema/security/RLS/storage que quedan bloqueados por la regla vigente.
- Hay que separar "bloqueantes funcionales UI/docs" de "bloqueantes de infraestructura".

### 4. DOCX `Especificacion Tecnica Motor Reglas LSC v2.1`

Contenido util:

- Confirma el alcance tecnico de v2.1:
  - 28 rule packs totales;
  - adoption modes `CO_APROBACION` y `SOLIDARIO`;
  - pactos parasociales MVP;
  - contrato de variables v1.1;
  - tests requeridos para packs, co-aprobacion, solidario, pactos y variables.
- Define validaciones de:
  - co-aprobacion k de n;
  - administrador solidario;
  - pactos parasociales;
  - diferencia entre bloqueo societario y bloqueo/alerta contractual.

Valor para producto:

- Debe gobernar los steppers y la explicabilidad, no solo la generacion documental.
- Refuerza que no se puede aplanar convocatoria/reunion/votacion/certificacion.

Gap:

- Parte del documento propone tablas/migraciones ya historicas. Bajo el freeze solo puede usarse como referencia, no como instruccion de aplicar schema.

## Mapa funcional de cobertura

| Familia documental | Estado funcional actual | Lo que aportan los documentos legales | Gap principal |
|---|---|---|---|
| Convocatorias | Routing y generacion ya existen | Modelos JGA/Consejo + reglas de antelacion/documentacion | Normalizar variables y variantes SA/SL/SLU/Consejo |
| Actas | Generacion desde reunion/acta existe | Modelos Junta/Consejo + transcripcion de acuerdos | Conectar lista dinamica de puntos/acuerdos con snapshot por punto |
| Certificaciones | Generacion desde acta/certificacion existe | Modelo base de certificacion | Certificar uno o varios acuerdos 360 con transcripcion literal |
| Informes preceptivos | Tipo de plantilla previsto | Reglas por materia indican informes obligatorios | Catalogo de informes por materia y variables especificas |
| Informe documental PRE | Tipo previsto como PRE | Excel identifica documentacion obligatoria por pack | UI de checklist documental por materia sin schema nuevo |
| Modelos de acuerdo | `MODELO_ACUERDO` ya existe como tipo | Playbook J/CA por materia | Equivalencia `J-01` vs `J1`, variables y variantes |
| Documento registral/publicacion | `DOCUMENTO_REGISTRAL` y `SUBSANACION_REGISTRAL` existen en doc-gen | Matriz post-acuerdo indica instrumento/publicacion | Sin carga nueva; preparar docs y UI solo si no crea dependencia schema |

## Gap P0: contrato de variables

Hay que resolver una inconsistencia antes de implementar carga masiva de plantillas:

| Fuente | Nombres observados |
|---|---|
| Excel/DOCX v2.1 | `{{denominacion_social}}`, `{{cif}}`, `{{domicilio_social}}`, `{{registro_mercantil}}`, `{{forma_social}}`, `{{fecha}}`, `{{presidente}}`, `{{secretario}}` |
| YAML local `docs/contratos/variables-plantillas-v1.1.yaml` | `empresa_nombre`, `empresa_tipo_social`, `empresa_cif`, `empresa_domicilio`, `empresa_registro_mercantil`, etc. |
| Resolver actual `variable-resolver.ts` | devuelve `denominacion_social`, `cif`, `domicilio_social`, `registro_mercantil`, `tipo_social`, `presidente`, `secretario`, etc. |

Decision recomendada:

- Para el hito humano, adoptar como canonico el set que ya resuelve el motor y coincide con Excel/DOCX: `denominacion_social`, `cif`, `domicilio_social`, etc.
- Mantener aliases para nombres `empresa_*` solo como compatibilidad documental si ya hay plantillas que los usan.
- Actualizar documentacion/contrato antes de tocar BD.

No requiere schema. Si se quisiera persistir aliases o versionar contrato en BD, se debe parar y pedir aprobacion.

## Acciones permitidas bajo freeze

Se puede avanzar en:

1. Crear matriz docs-only de cobertura:
   - materia;
   - organo;
   - tipo documento;
   - template tipo;
   - variables;
   - origen de variable;
   - stepper destino;
   - requiere schema: si/no.
2. Crear fixtures locales de texto legal en TypeScript/JSON para tests puros, siempre que no sustituyan a `plantillas_protegidas` como fuente runtime.
3. Mejorar UI existente para mostrar "cobertura pendiente" o "plantilla legal disponible" solo si se alimenta de constantes/docs o datos ya existentes.
4. Crear tests de normalizacion de placeholders `[Campo] -> {{campo}}`.
5. Crear tests de equivalencia de codigos `J-01 -> J1` y materias.
6. Actualizar documentacion de contrato de variables, sin regenerar tipos.

## Acciones bloqueadas por freeze

Detener y reportar si la tarea exige:

- insertar plantillas en `plantillas_protegidas`;
- crear nuevas columnas para catalogo de materias;
- ampliar constraints de `plantillas_protegidas.tipo`;
- cambiar `agreements.adoption_mode`;
- aplicar seeds/migraciones;
- tocar storage, RLS, RPC o evidence bundles;
- regenerar tipos Supabase.

## Proximo paso recomendado

Crear una `Template Coverage Matrix` docs-only para Secretaria con estos campos:

| Campo | Descripcion |
|---|---|
| `legal_code` | Codigo legal fuente: `J-01`, `CA-03`, etc. |
| `canonical_materia` | Materia tecnica: `APROBACION_CUENTAS`, `DELEGACION_FACULTADES`, etc. |
| `catalog_ref` | Referencia Excel: `J1`, `CA-08`, etc. |
| `organo` | Junta, Consejo, admin unico, mancomunados, solidarios, socio unico |
| `adoption_modes` | Modos permitidos |
| `document_family` | Convocatoria, acta, certificacion, informe PRE, registral |
| `template_tipo` | Tipo esperado en `plantillas_protegidas`, si existe |
| `variables_required` | Variables Handlebars normalizadas |
| `variables_manual` | Campos capa 3 |
| `documents_required` | Informes, cuentas, proyecto, contratos, etc. |
| `post_actions` | Inscripcion, escritura, publicacion, deposito |
| `schema_needed` | `none` o descripcion de bloqueo |

Esto permite avanzar sin Supabase y da al equipo legal una herramienta de validacion.

Estado de ejecucion:

- Matriz creada en `docs/superpowers/plans/2026-04-27-secretaria-template-coverage-matrix.md`.
- Incluye 46 materias operativas, tipos documentales, variables por materia, documentos requeridos, post-acciones, gaps y bloqueos de schema.

## Data contract de esta revision

- Flow: Secretaria / gestor documental / plantillas legales.
- Tables used: none at runtime. Referenciadas solo conceptualmente: `plantillas_protegidas`, `agreements`, `convocatorias`, `meetings`, `meeting_resolutions`, `minutes`, `certifications`, `attachments`, `evidence_bundles`, `audit_log`, `rule_packs`, `rule_pack_versions`, `rule_param_overrides`, `pactos_parasociales`.
- Source of truth: docs legales revisados + codigo local para contraste. Cloud Supabase no consultado.
- Owner records: none modified.
- Shared records: none modified.
- Migration required: no.
- Types affected: no.
- RLS/RPC/storage affected: no.
- Evidence level: none; revision documental.
- Cross-module contracts: none modified.
- Parity risk: medio; se detecta riesgo de desalineacion de variables y catalogos, pero no se introduce dependencia nueva de schema.

## Verification

- db:check-target: no ejecutado en esta revision; no se ha tocado Supabase.
- Typecheck: no ejecutado; cambio docs-only.
- Lint: no ejecutado; cambio docs-only.
- Tests: no ejecutados; cambio docs-only.
- Build: no ejecutado; cambio docs-only.
- e2e: no ejecutado; cambio docs-only.
