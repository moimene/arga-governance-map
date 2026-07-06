# Plan técnico — Rediseño UX/copy del módulo Secretaría (P0→P3)

**Fecha:** 2026-06-20
**Ámbito:** módulo Secretaría Societaria (`/secretaria/*`)
**Insumos:**
- Informe legal: `docs/superpowers/reviews/2026-06-20-informe-ux-redesign-copy-legal.md`
- Auditoría de brechas: `docs/superpowers/reviews/2026-06-20-auditoria-brechas-ux-secretaria.md`
**Objetivo:** convertir el backlog priorizado de la auditoría en tareas ejecutables, con archivos concretos, enfoque, criterios de aceptación y dependencias, mapeadas a las fases UX-0…UX-7 del informe.

---

## 0. Convenciones

**Esfuerzo:** `copy` (string / clave de traducción) · `superficie` (UI sobre lógica existente) · `estructural` (rediseño de flujo) · `datos` (campo/RPC/RLS/lógica de dominio).

**Reglas no negociables al ejecutar (CLAUDE.md):**
- Tokens Garrigues: nada de colores Tailwind nativos ni hex; solo `var(--g-*)` / `var(--status-*)`.
- Antes de cualquier trabajo Supabase: `bun run db:check-target` y confirmar `governance_OS`.
- Gates: `bun test`, `bun run typecheck` (`tsc -b`), `bun run lint`, `bun run build`.
- Sin escrituras en `governance_module_*`; evidence/legal-hold `000049` sigue HOLD.

**Estados de avance:** ✅ hecho · ◻️ pendiente.

---

## 1. UX-0 — Lenguaje, estados y copy de riesgo (PRIMERO)

> Fase de menor riesgo y mayor retorno. Cierra el riesgo legal de copy sin tocar estructura.

### ✅ UX-0.A — Estados de evidencia + disclaimer (P0-1, P0-2) — IMPLEMENTADO 2026-06-20
- Archivos: `src/lib/secretaria/evidence-status-labels.ts` (nuevo), `src/components/secretaria/EvidenceStatusBadge.tsx` (nuevo).
- Hecho: descriptor con label/tono/disclaimer/`isQualified`; `DEMO_OPERATIVA`/`OPEN`/`SANDBOX` → "Entorno de validación funcional" + disclaimer "sin eficacia jurídica cualificada productiva"; fallback conservador (desconocido → no cualificada). Badge con tokens Garrigues. Cableado en `CertificacionesAutonomas.tsx` e `InformesPreceptivos.tsx`.
- Criterio: ✅ ninguna lista de Secretaría muestra `DEMO_OPERATIVA` crudo; el disclaimer es visible; la evidencia sandbox nunca se rotula como cualificada.

### ✅ UX-0.B — 11 claves de estado + efecto jurídico (P1-1) — IMPLEMENTADO 2026-06-20
- Archivo: `src/lib/secretaria/status-labels.ts`.
- Hecho: `SOURCE_LOCKED, GENERATED, IN_REVIEW, EMITTED, ARCHIVED, ATTACHED, SUPERSEDED, REVOKED, FAILED, WAIVED_WITH_OVERRIDE, VERIFIED` + `LEGAL_EFFECT_LABEL`/`legalEffectLabel()`.
- Criterio: ✅ `statusLabel()` traduce todos los estados del pipeline documental; efecto jurídico legible.

### ✅ UX-0.C — Routeo y limpieza de copy (P0-3, P0-4) — IMPLEMENTADO 2026-06-20
- `InformesPreceptivos.tsx` y `CertificacionesAutonomas.tsx`: `StatusChip` por `statusLabel()`; `legal_effect` por `legalEffectLabel()`; cabeceras "Hash/Hash fuente" → "Huella/Huella de fuente"; evidencia por `EvidenceStatusBadge`.
- `DocumentosPendientesRevision.tsx`: subcopy ya no dice "archivados como evidencia operativa".
- Tests: `status-labels.test.ts` (ampliado), `evidence-status-labels.test.ts` (nuevo), `mesa-control-ui-contract.test.ts` (actualizado P0-4).
- Criterio: ✅ typecheck verde, lint limpio, tests del dominio verdes.

### ◻️ UX-0.D — Renombrados de label de sidebar (P3-1)
- Archivo: `src/components/secretaria/shell/navigation.ts` (en **ambas** taxonomías `GRUPO_NAV_GROUPS` y `SOCIEDAD_NAV_GROUPS`).
- 9 copy-only: "Board Pack"→"Board pack"; "Certificaciones vinculadas"→"Certificaciones de acuerdos"; "Informes preceptivos"→"Informes y anexos"; "Documentos en revisión"→"Revisión documental"; "Presentaciones"→"Presentaciones registrales"; "Personas y cargos"→"Personas, cargos y representantes"; "Plantillas"→"Plantillas documentales"; "Gestor plantillas"→"Gobierno de plantillas"; ítem "Tramitador registral"→"Registro".
- Criterio: labels actualizados sin romper selectores E2E; H1 de página intacto.
- Dependencia: confirmar que ningún selector E2E usa el texto del label (usar `[data-sidebar-item]`).

### ◻️ UX-0.E — Términos transversales restantes (P3-3)
- "artefacto/artefactos documentales" → "Documento" (`DocumentosPendientesRevision.tsx`, `InformesPreceptivos.tsx` subcopys); `RmStatusChip.tsx` "Pendiente RM" → "Pendiente de referencia registral. Puede limitar certificaciones frente a terceros".
- Esfuerzo: copy.

### ◻️ UX-0.F — GenerarDocumentoStepper: alinear copy de evidencia
- `GenerarDocumentoStepper.tsx` usa `evidenceStatusLabel` local y "Evidencia operativa"; migrar a `EvidenceStatusBadge`/disclaimer y revisar el contrato `mesa-control-ui-contract.test.ts:157-158`.
- Esfuerzo: copy + superficie menor. (Se dejó fuera de UX-0.A–C por no estar en las dos listas P0.)

---

## 2. UX-1 — Shell y navegación

### ◻️ UX-1.A — Decisión de marca: "Reuniones"→"Sesiones", "Procesos"→"Calendario societario" (P3-5)
- Requiere **validación legal** previa (informe §5.2) y reconciliar el ítem "Procesos" (label/icono/página) + selector E2E `[data-sidebar-item="Procesos"]`.
- Esfuerzo: copy + actualización de tests. **Bloqueado por decisión.**

### ◻️ UX-1.B — Área "Expedientes" (mayor brecha de IA, §5.1)
- `navigation.ts`: nueva sección + índice/listado de expedientes que la alimente (hoy el expediente solo es `/secretaria/acuerdos/:id`).
- Esfuerzo: estructural. **Requiere decisión de IA** (qué lista de expedientes y filtros).

### ◻️ UX-1.C — Header: jurisdicción/modo/fecha de corte en Mesa
- `SecretariaHeader.tsx` ya muestra sociedad/forma/jurisdicción/modo; falta "fecha de corte" donde el informe la pide (§6.1).
- Esfuerzo: superficie.

> Nota: "Registro y libros" como área única (§5.1) **choca con la decisión 2026-05-12** (dos secciones). Reabrir explícitamente antes de tocar.

---

## 3. UX-2 — Mesa de Secretaría

### ◻️ UX-2.A — Bloque "Documentos pendientes" + CTA "Revisar documentos" (P1-4)
- `Dashboard.tsx` (+ `useDashboardData.ts`): nueva sección que liste documentos en revisión (reusar la query de `DocumentosPendientesRevision`) y CTA a `/secretaria/documentos/pendientes-revision`.
- Criterio: la Mesa muestra la cola de documentos por revisar y un acceso directo; tarjeta M1 con campos mínimos (§6.11).
- Esfuerzo: estructural ligero.

### ◻️ UX-2.B — Empty states con patrón de 3 partes (P2-3) y H1/subcopy (P3-2)
- "Mesa de Secretaría" + subcopy §9.2; empties "qué pasa + por qué importa + qué puedo hacer".
- Esfuerzo: copy.

---

## 4. UX-3 — Documentación (Informes + Revisión + Registro)

### ◻️ UX-3.A — Informes y anexos: flujo por fuente canónica (P1-3, mayor brecha estructural)
- `InformesPreceptivos.tsx`: sustituir el campo libre `source_ref` por selector de fuente canónica (acuerdo/convocatoria/acta/certificación/libro/manual) + detección de requisitos documentales por materia + paso "enviar a revisión".
- Reutiliza: `document-requirements/` (ya existe), patrón de `useSearchParams`.
- Criterio: el informe nace de una fuente reconocible; el botón "Crear" explica el requisito faltante; empty state con acción.
- Esfuerzo: estructural.

### ◻️ UX-3.B — Revisión documental: toasts de trazabilidad + tooltip sustituir (P3-4)
- `DocumentosPendientesRevision.tsx`: textos diferenciados §9.5 ("Conservamos su huella y versión", etc.); tooltip de "Marcar como sustituido".
- Esfuerzo: copy.

### ◻️ UX-3.C — Tramitador: vista "Denegadas", CTAs de fase en lista, variante móvil (P2-7)
- `TramitadorLista.tsx`: filtro Denegadas; CTAs elevar/presentar/subsanar; tarjetas `lg:hidden` (patrón de `LibrosObligatorios.tsx`).
- Esfuerzo: superficie + estructural ligero.

---

## 5. UX-4 — Certificaciones autónomas (mayor valor estructural)

> Backend ~90 % listo (modelo de datos, hashing, autoridad fail-closed, auditoría WORM, gate sandbox). El trabajo es **construir la UI del wizard sobre piezas existentes**.

### ◻️ UX-4.A — Wizard guiado de 5 pasos (P1-2)
- `CertificacionesAutonomas.tsx`: convertir la pantalla única en stepper. Orquestar los RPCs ya segmentados (`fn_prepare…` / `fn_create…` / `fn_emit…`).
- Pasos: (1) tipo; (2) sociedad + **fecha de corte** (hook ya acepta `cutoffAt`); (3) **selector/buscador de fuente** que reemplace los 7 inputs de UUID; (4) **paso de fuente solo-lectura** renderizando `source_payload`/`source_summary` (ya devueltos por `fn_prepare`); (5) autoridad/Vº Bº (invocar `resolveCertificationAuthority` para mostrar bloqueos **antes** de emitir).
- Esfuerzo: estructural.

### ◻️ UX-4.B — Plantilla de 3 capas + previsualización + confirmación reforzada
- Cablear `Capa3Form.tsx` (ya existe) en lugar del único input "Destinatario".
- Preview de solo-lectura del DOCX compuesto antes de generar.
- Confirmación final no colapsable (fuente, fecha corte, huella, certificante, Vº Bº, ref. registral, efecto, evidencia, disclaimers).
- Esfuerzo: superficie + estructural.

### ◻️ UX-4.C — Acciones y avisos
- Botón "Marcar como sustituida" (`useSupersedeStandaloneCertification` ya existe) + estado `SUPERSEDED` accesible.
- Avisos §6.4.1/§6.4.2 (autónoma vs acta; efecto interno/registral; Vº Bº requerido/no; ref. registral presente/ausente).
- Confirmación de dos pasos para emitir (M2, P2-1).
- Esfuerzo: superficie.

### ◻️ UX-4.D — Backend menor
- Decidir si se formaliza RLS de lectura nombrada para AUDITOR/COMPLIANCE (hoy tenant-scoped genérica; no-emisión ya garantizada por capacidad de escritura).
- Detección de fuente incompleta/duplicada/discrepante-legacy (hoy solo se bloquea fuente vacía).
- Esfuerzo: datos. Requiere `db:check-target` + migración forward-only.

---

## 6. UX-5 — Expediente societario

### ◻️ UX-5.A — Empty states de secciones (P2-3) + layout móvil M1 (P2-2)
- `ExpedienteAcuerdo.tsx`: mostrar empty states (§9.6) en Documentos y Certificaciones en vez de ocultarlas; tarjetas móviles para header/siguiente-acción/bloqueos.
- Relegar tecnicismos (`profile_hash`, `snapshot_id`, `agreement_kind`) a "detalle avanzado".
- Esfuerzo: superficie + copy.

---

## 7. UX-6 — Sociedades, personas y autoridad

### ◻️ UX-6.A — Avisos faltantes (P2-6)
- "Censo pendiente"; "Participación registrada sin derechos de voto computables".
- CTA nominal "Revisar autoridad certificante".
- Esfuerzo: superficie + copy.

---

## 8. UX-7 — Configuración, reglas y plantillas

### ◻️ UX-7.A — Jerarquía normativa: chip imperativa/dispositiva + "¿Por qué esta regla?" + aviso de snapshot desfasado (P1-5)
- `normative-framework.ts`: añadir campo de imperatividad a `NormativeSource` (**dato nuevo**).
- UI: chip imperativa/dispositiva en la capa LEY; componente "¿Por qué esta regla?" sobre las fuentes ya computadas; comparar `profile_hash` congelado vs vigente en `ExpedienteAcuerdo.tsx` para el aviso de desfase.
- Esfuerzo: datos + superficie. Es el punto más señalado por Legal (criterios de aceptación 12 y 19).

### ◻️ UX-7.B — Plantillas: cohortes + "activa con metadatos incompletos" + filtros (P2-5)
- `Plantillas.tsx`: estados de cohorte (pendiente upgrade / pendiente firma); badge/aviso "activa con metadatos incompletos" (datos ya presentes); filtros por cohorte/metadatos.
- Esfuerzo: superficie.

### ◻️ UX-7.C — Avisos de gobierno (P2-6)
- "Plantilla sin regla"; "decisión legal pendiente antes de activar bloqueo"; sub-área nominal "Parámetros normativos".
- Esfuerzo: superficie + copy.

---

## 9. Secuencia recomendada

1. **UX-0** completa (A–C ✅; falta D, E, F) — copy/riesgo, sin estructura.
2. **UX-7.A** (jerarquía normativa) — alto valor legal, mayormente superficie sobre motor existente.
3. **UX-4** (wizard certificaciones) — mayor valor estructural, reutiliza backend.
4. **UX-3.A** (informes por fuente) + **UX-2.A** (bloque documentos en Mesa).
5. **UX-5 / UX-6 / UX-7.B-C** — superficie y empties.
6. **UX-1.B** (área Expedientes) y decisiones de marca (UX-1.A) — requieren acuerdo previo.

## 10. Decisiones a reabrir antes de ejecutar

- "Registro y libros" como área única vs. dos secciones (decisión 2026-05-12).
- "Reuniones"→"Sesiones" y "Procesos"→"Calendario societario" (validación legal).
- Formalizar o no RLS de lectura nombrada AUDITOR/COMPLIANCE en certificaciones autónomas.
- Acta de aprobación legal del glosario (informe §2.1) antes de congelar alcance.

---

*Este plan acompaña a la auditoría de brechas 2026-06-20. UX-0.A–C quedó implementado y verificado (typecheck/lint/tests del dominio en verde) en el mismo ciclo.*
