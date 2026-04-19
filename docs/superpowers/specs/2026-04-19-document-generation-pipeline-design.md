# Spec: Pipeline de Generación Documental + Cobertura ES 100%

**Fecha:** 2026-04-19
**Módulo:** Secretaría Societaria
**Estado:** DRAFT → Implementación inmediata

---

## 1. Objetivo

Completar la cobertura 100% de jurisdicción española (ES) con 2 plantillas nuevas, y construir el pipeline end-to-end de generación documental: desde un acuerdo ADOPTED hasta un DOCX firmado con QES y archivado.

## 2. Cobertura ES: de 95% a 100%

### 2.1 Plantilla 8: ACTA_SESION — COMISION_DELEGADA

La LSC permite comisiones delegadas del Consejo (art. 249 LSC). Actualmente tenemos actas para JUNTA_GENERAL y CONSEJO pero no para comisiones delegadas, que tienen particularidades:
- Delegación de facultades específicas (no todas)
- Composición reducida (subset del Consejo)
- Información al Consejo pleno obligatoria
- adoption_mode: MEETING, organo_tipo: COMISION_DELEGADA

### 2.2 Plantilla 9: CONVOCATORIA_SL_NOTIFICACION

La convocatoria para SL se hace por comunicación individual (art. 173.2 LSC), no por anuncio público como en SA. Es una notificación fehaciente individual, no un edicto. Diferencias:
- Destinatario individual (cada socio)
- Canal: burofax, correo certificado, email con acuse
- Sin publicación en BORME/prensa
- adoption_mode: MEETING (se usa para convocar reuniones)

### 2.3 Actualización Gate PRE

Añadir 2 rules a GO_LIVE_CONFIG:
- `rule_acta_sesion_comision` → ACTA_SESION, MEETING, organo_tipos: ['COMISION_DELEGADA'], STRICT
- `rule_convocatoria_sl` → CONVOCATORIA_SL_NOTIFICACION, MEETING, STRICT

## 3. Pipeline de Generación Documental

### 3.1 Arquitectura

```
Agreement (ADOPTED)
    ↓
[1] Gate PRE → valida plantilla disponible
    ↓
[2] Variable Resolution → capa2 sources → real data
    ↓
[3] Capa3 Form → Secretario completa campos editables
    ↓
[4] Handlebars Render → capa1 + variables → texto final
    ↓
[5] DOCX Generation → texto → documento profesional
    ↓
[6] Hash + QTSP Sign → SHA-256 + QES (opcional)
    ↓
[7] Archive → Supabase Storage + evidence_events
```

### 3.2 Componentes nuevos

| Componente | Ruta | Descripción |
|---|---|---|
| `template-renderer.ts` | `src/lib/doc-gen/template-renderer.ts` | Handlebars compile + render con helpers ES |
| `variable-resolver.ts` | `src/lib/doc-gen/variable-resolver.ts` | Mapeo fuente→dato real (Supabase queries) |
| `docx-generator.ts` | `src/lib/doc-gen/docx-generator.ts` | Texto renderizado → DOCX con branding Garrigues |
| `Capa3Form.tsx` | `src/components/secretaria/Capa3Form.tsx` | Form dinámico desde capa3_editables JSONB |
| `GenerarDocumentoStepper.tsx` | `src/pages/secretaria/GenerarDocumentoStepper.tsx` | Wizard 5 pasos |

### 3.3 Dependencias npm

- `handlebars` — template engine (capa1 ya usa sintaxis `{{}}`)
- `docx` — DOCX generation (pure JS, no server needed)

### 3.4 Variable Resolution (capa2)

Cada variable en capa2 tiene un campo `fuente` que indica de dónde obtener el valor:

| Fuente | Origen de datos | Hook existente |
|---|---|---|
| `MOTOR` | Motor de reglas LSC (compliance snapshot) | `useAgreementCompliance` |
| `ENTIDAD` | Tabla entities | `useEntities` |
| `ORGANO` | Tabla governing_bodies + members | `useBodies` |
| `REUNION` | Tabla meetings + participants | `useMeetingParticipants` |
| `EXPEDIENTE` | Tabla agreements (el propio acuerdo) | `useAgreements` |
| `SISTEMA` | Fecha/hora, usuario, tenant | Runtime |
| `USUARIO` | Capa3 (input manual del Secretario) | Capa3Form |

### 3.5 DOCX Structure

```
[Header: Logo Garrigues + fecha]
[Título: tipo de documento]
[Cuerpo: texto renderizado de capa1]
[Firma: Secretario + cargo]
[Footer: referencia + hash]
```

### 3.6 Stepper UX (5 pasos)

1. **Seleccionar plantilla** — Gate PRE filtra, muestra compatibles
2. **Variables resueltas** — Tabla read-only con valores de capa2
3. **Campos editables** — Capa3Form dinámico
4. **Vista previa** — Texto renderizado (HTML preview)
5. **Generar y firmar** — Botón DOCX + opción QES

## 4. Ruta

`/secretaria/acuerdos/:id/generar` — lazy loaded, dentro de SecretariaLayout.

## 5. NO en este scope

- Jurisdicciones fuera de ES (BR, MX, PT)
- Almacenamiento en Supabase Storage (placeholder)
- Firma QES real (se integra con hook existente `useQTSPSign`)
- Edición inline de capa1 (inmutable por diseño)
