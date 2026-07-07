# Runbook de demo — Secretaría Societaria (presentación 2026-07-07)

Guion operativo para el presentador. Basado en la auditoría multiagente del
2026-07-06 (28 agentes, verificación adversarial) + fixes aplicados esa noche
(commits `86aa463` código, `e6c0909` datos, `c44c822` QTSP proxy).

---

## 0. Arranque (antes de la demo)

- **Modo de servido recomendado: `bun run dev` local.** El simulador de firma
  QES (sandbox de alta fidelidad) solo se activa con `import.meta.env.DEV=true`
  o `VITE_QTSP_ALLOW_SANDBOX=true`. En un build de producción sin esa variable,
  "Firmar con QES" falla siempre (fail-closed intencional).
  - Si se decide servir un build/Vercel: exportar `VITE_QTSP_ALLOW_SANDBOX=true`
    **antes de compilar** y re-hacer el smoke de firma sobre la URL servida.
    Ojo: la prod de Vercel está estancada en 2026-06-13 (3 semanas atrás).
- Login: `demo@arga-seguros.com` (rol SECRETARIO).
- Smoke de 5 min antes de empezar: Mesa (KPIs > 0), Tramitador (4 vistas con
  filas), Acuerdos sin sesión (1 votación abierta), PR-008 → enlace a reunión.

## 1. Rutas seguras (verificadas contra Cloud)

| Flujo | Ruta segura | Nota |
|---|---|---|
| Mesa de Secretaría | `/secretaria` | KPIs vivos post-refresh: 3 convocatorias próximas, 2 reuniones (7d), 3 tramitaciones en curso. |
| Cross-module estrella | `/politicas` → PR-008 → "Adoptado en: CdA · 22/04/2026" | Fix aplicado: navega por UUID al stepper de reunión. |
| Órgano → alta de miembro | `/organos/:id` → Composición → "Añadir miembro" | Fix aplicado: abre DesignarAdminStepper con bodyId precargado. |
| **Certificación en vivo** | SOLO sobre las actas de las reuniones `df5b0fee` (CATIT 03/07) o `b934a7b0` (CdA 18/06) — minutes `c7975306` / `4c316443` | Son las únicas con point_snapshots. Las otras 6 actas (incluida la insignia CdA 22/04) muestran el botón deshabilitado con "Falta snapshot legal por punto" — **no intentar certificar desde ellas** salvo que se haga el backfill (Decisión 4). |
| Certificaciones autónomas | SIEMPRE por deep-link desde PersonaDetalle / Libros (`StandaloneCertificationActions` precarga los UUIDs) | **No teclear UUIDs a mano en pantalla** — la página pide UUIDs crudos (UX-4 wizard es post-demo). |
| Informes preceptivos | Entrar con `?agreement=` desde el expediente del acuerdo | El input libre "Referencia/hash fuente" es deuda UX-3.A (post-demo). |
| Generación documental + QES | Expediente acuerdo → "Generar documento" → firmar (sandbox) → archivar | El badge dice honestamente "Entorno de validación funcional — sin eficacia jurídica cualificada productiva". Con secretos EAD Trust provisionados, la firma pasa a ser REAL sin cambiar código. |
| Acuerdos sin sesión | `/secretaria/acuerdos-sin-sesion` | 1 votación abierta ("Nombramiento de Director Financiero", vence 16/07) para enseñar el tracker. |
| Tramitador | Item de sidebar **"Registro"** | 4 vistas pobladas: En trámite (1), Presentaciones (1), Subsanaciones (1), Inscripciones (2 con número RM). |
| Plantillas | `/secretaria/plantillas` | Nuevo: badge + filtro de **cohortes** (Activa·lista / sin regla / metadatos incompletos / preparación / histórico). |

## 2. Prohibiciones / encuadres (evitar en vivo)

1. **Comunicaciones**: presentar "Programar envío" como *programación de cola
   certificada*. **NO reabrir el detalle esperando "Entregado"** — el
   despachador (comms-dispatcher) no está desplegado; lo programado queda
   "Pendiente" (Decisión 3 lo cambia).
2. **Certificar desde el acta insignia CdA 22/04**: gate deshabilitado (sin
   point_snapshots). Usar las 2 actas buenas (§1).
3. **Las 16 plantillas LSC enriquecidas**: encuadrar como *"borrador técnico
   pendiente de validación del Comité Legal"* (fases 2-3 de coherencia; la vía
   de revisión es el workflow del gestor de plantillas).
4. **Evidencia/firma**: los disclaimers de UI ya lo dicen — "entorno de
   validación funcional, sin eficacia jurídica cualificada productiva". No
   prometer eficacia QES productiva salvo que se activen los secretos EAD Trust.
5. **UX-7.A (clasificación imperativa/dispositiva)**: si Legal pregunta,
   respuesta preparada: *"el motor ya resuelve jerarquía normativa
   LEY→ESTATUTOS→PACTO; el chip visual imperativa/dispositiva espera la matriz
   de criterio del Comité Legal para no fabricar criterio jurídico"*.
6. No pasear la lista completa de convocatorias antiguas (hay ~35 BORRADOR
   históricas de abril — Decisión 5 si se quieren podar).

## 3. Firma QES real — ✅ ACTIVA (verificada 2026-07-07)

La Edge Function `qtsp-proxy` v2 está desplegada y **configurada contra la EAD
Enterprise Suite** (`api-eadcustody.eadtrust.gocertius.io`, el mismo backend y
cuenta que la plataforma de contratación). Secretos `EAD_SUITE_*` provisionados
y verificados con probe en vivo (login de sesión OK + API viva).

- **"Firmar con QES" en GenerarDocumentoStepper ejecuta ahora una solicitud de
  firma REAL**: case-file → signature request → documento (DOCX se convierte a
  PDF) → firmante → activación. **El firmante recibe el enlace de firma por
  email de verdad** — usar SIEMPRE una persona cuyo email controle el
  presentador para el momento en vivo.
- Cada firma en vivo crea artefactos reales (case file + signature request) en
  la cuenta compartida de EAD Enterprise Suite que también usa la plataforma de
  contratación. Usar con mesura; se pueden limpiar después desde esa cuenta.
- Nota histórica: la 1ª versión del proxy apuntaba a la Digital Trust API de
  Factory (`api.int.gcloudfactory.com`, credenciales Okta de g-mcp-server) —
  verificado empíricamente que ese host es interno (VPN/allowlist) e
  inalcanzable desde Supabase Edge; por eso se migró a la Suite pública.
- Rollback a sandbox: `supabase secrets unset EAD_SUITE_AUTH_EMAIL
  EAD_SUITE_AUTH_PASSWORD --project-ref hzqwefkwsxopwrmtksbg` (el proxy vuelve
  a 503 y el front cae al sandbox en dev).

## 4. Estado de datos post-refresh (2026-07-06)

- Duplicados eliminados: 6 decisiones unipersonales + 6 agreements DRAFT
  (campaña triplicada del 26/04); quedan 5 BORRADOR coherentes.
- Sociedades BR/MX/PT: 1 ficha por país (la rica, con 2 órganos); las fichas
  pobres ocultas con `data_class='TEST'` (reversible con un UPDATE).
- Personas "Arga Test" ocultas (fixtures E2E huérfanas).
- Libros: plazos de legalización al 26/07 (alerta creíble, no vencida).
- `cda-17-12-2026` corregida a CONVOCADA (estaba CELEBRADA con fecha futura).
