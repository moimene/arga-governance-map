# G6 — prompt de arranque para conversación paralela

Copiar tal cual en una conversación nueva de Claude Code, en
`/Users/moisesmenendez/Dropbox/DESARROLLO/arga-governance-map`.

---

Vamos con **G6 del programa del tenant Garrigues**: riesgo TIC, ciberseguridad, NIS2 y
certificaciones.

El diseño ya está escrito y verificado. **Léelo entero antes de nada:**
`docs/superpowers/specs/2026-08-20-g6-ciberseguridad-nis2-garrigues-design.md`

Sale de un workflow de 9 agentes con verificación adversarial sobre fuente primaria
(texto oficial del DOUE cotejado por hash, Anexo de la Directiva CER, texto íntegro del
anteproyecto español obtenido de la base TRIS de la Comisión, y consultas en vivo al BOE
con control discriminante). No lo rehagas: si algo te chirría, verifícalo contra la fuente
que el documento cita, no contra tu memoria.

## Lo que tienes que retener del diseño

**El sujeto obligado por NIS2 en este perímetro NO es el despacho.** Los servicios
jurídicos tienen cero ocurrencias en los Anexos I y II de la Directiva (UE) 2022/2555, y el
chapeau del art. 2.2 cierra las excepciones. El sujeto es **EAD Trust, S.L.**, la filial
QTSP (Anexo I sector 8; por ser cualificada, entidad **esencial** con independencia del
tamaño, art. 3.1.b). Y ni siquiera hoy: **España no ha transpuesto** —el marco vigente es
NIS1, RDL 12/2018, que además **excluye expresamente** a los prestadores de servicios de
confianza no designados operadores críticos—. Cualquier afirmación basada en el anteproyecto
es **prospectiva** y así hay que etiquetarla.

Ninguna superficie puede presentar una obligación NIS2 como deber de cumplimiento del
despacho. Ni por sector, ni por ser proveedor de una entidad esencial: el art. 21.2.d obliga
**al cliente**, y llega al despacho por contrato.

## Estado del repo — importante

- Rama actual de trabajo del programa: **G5 (núcleo penal) está en ejecución** en
  `feature/g5-nucleo-penal-garrigues`, en **este mismo worktree**.
- G5 va a modificar `src/hooks/useRisks.ts`, `src/pages/grc/Risk360.tsx`,
  `src/pages/grc/RiskEditor.tsx`, `src/test/schema/tenant-isolation.test.ts` y añadir
  migraciones. **G6 tocaría varios de esos ficheros.**
- **Por eso G6 se queda por ahora en diseño y plan: no escribas código, no toques Cloud, no
  ejecutes seeds ni migraciones.** Cuando G5 haga merge a `main`, se levanta la restricción.
- `CLAUDE.md` prohíbe abrir worktrees nuevos para carriles paralelos sin autorización
  expresa del usuario. No abras ninguno; si crees que hace falta, pídelo.

## Método (el mismo de G0–G5)

1. Lee el diseño y **plantea al usuario las preguntas abiertas de su §5** antes de planificar.
   Son cinco y la nº 5 —el alcance de la fase— ordena todo lo demás.
2. Con las respuestas, invoca la skill `writing-plans` y escribe el plan en
   `docs/superpowers/plans/`.
3. La ejecución será **subagent-driven**: subagente fresco por tarea, review adversarial
   entre tareas, y review adversarial de rama antes del merge **con modelo medio como suelo**
   (una re-review en haiku devolvió en G4 un informe con cero llamadas a herramientas).

## Restricciones innegociables

- **Cero cambio para ARGA** (`00000000-0000-0000-0000-000000000001`). Toda columna nueva es
  nullable; toda rama de UI nueva se activa por **forma del dato**, nunca por `tenant_id`.
  Tenant Garrigues: `00000000-0000-0000-0000-000000000002`.
- **Prohibido inventar.** Si la fuente no lo dice, va en NULL y la procedencia lo declara.
  No se afirma que el despacho tenga una certificación que su corpus no nombra: **cero**
  ISO 9001, 14001, 45001, 27701, 37001, 42001, UNE 19601, UNE 19602 y SOC 2 en todo el corpus.
  Lo único que consta es ISO/IEC 27001 y el ENS.
- **No reutilices los datos demo de ARGA como si fueran del corpus Garrigues.** Las
  apariciones de ISO 37001, UNE 19601, ISO 45001, ISO 42001 y ENS en `src/` y en migraciones
  son seeds de ARGA — `grc_core_seed.sql:16` siembra un módulo `cyber` de ARGA con
  `'["NIS2","ISO 27001","ENS"]'` y owner `'CISO ARGA'`. Es la contaminación que G4 tuvo que
  limpiar tres veces.
- **Los PDF de `version garrigues/Garr_politicas/` no se commitean jamás.** Están en
  `.gitignore`. Solo lectura. Para extraer texto, `pdftotext -layout` (sin `-layout` destroza
  los índices en columnas).
- **`git add` solo con rutas específicas.** El árbol tiene ficheros ajenos sin seguimiento
  (`docs/context/*`, `pkcs11.txt`, `version garrigues/`). Nunca `git add -A`.
- Nunca el nombre real del cliente asegurador: ARGA es el seudónimo. Garrigues sí es real y
  es correcto usarlo.

## Trampas técnicas ya identificadas — no las redescubras

- **`grc_modules` de Garrigues son 3** (`aml`, `ethics`, `risk`) y **no incluye `cyber`**.
  `fn_sync_obligation_to_backbone` mapea `OBL-NIS2-%` y `OBL-ISO%` al módulo `cyber`; como no
  existe, el fallback lo manda a `risk` = «Riesgos penales». **No revienta: archiva
  ciberseguridad bajo riesgos penales en silencio.** Siembra `grc_modules.cyber` antes que
  cualquier obligación con esos prefijos.
- **No existe ninguna tabla `cyber_incidents` ni `dora_*`.** Ciber y DORA son un discriminador
  de texto `incidents.incident_type` sobre una única tabla `incidents`, más `vulnerabilities`.
- **El carril ciber NO está gateado por D-5 para Garrigues**: lo único oculto es `/grc/packs`,
  `/grc/packs/:cc` y `/grc/m/dora`. `cyber`, `gdpr` y `audit` son accesibles hoy, sin item
  propio de sidebar.
- **`grc_module_nav` alimenta el sidebar modular y no tiene ningún seed en el repo**: un
  módulo ciber sin esas filas sería código sin navegación.
- `incidents.code`, `exceptions.code` y `findings.code` tienen **UNIQUE global sin tenant**.
- Los CHECK usan castellano con tildes: `incidents.severity IN ('Crítico','Alto','Medio','Bajo')`,
  `incidents.status IN ('Abierto','En contención','En investigación','Resuelto','Cerrado')`.
- **Canal Cloud** (cuando llegue el momento, no ahora): `supabase db query -f <fichero> --linked`.
  **Jamás** `"$(cat …)"` —bash expandiría `$assert$`—, jamás `db push`, jamás `repair`
  (drift de junio). `bun run db:check-target` antes de nada, y tiene que decir `governance_OS`.
- Toda sonda con más de un cliente Supabase necesita `{ auth: { persistSession: false } }`:
  el preload de `bun test` monta JSDOM con `localStorage` y el último login pisa a los
  anteriores. Igual con dos pestañas del navegador: **comprueba el email del token en la
  misma llamada que mide**.
- `tenantId` en la `queryKey` no basta sin `enabled: !!tenantId`: `TenantProvider` arranca en
  `null` y el primer render de todos los tenants comparte la clave.
- Verificar un **rótulo** en pantalla **no prueba una arista**: para una relación, la prueba
  es el enlace o un test que falle si deja de leerse. Es el P0 nº1 de G4.

## Deudas ajenas que vas a encontrarte — anótalas, no las arregles de paso

- `action_plans.tenant_id` tiene `DEFAULT '…0001'` (ARGA): un INSERT sin tenant explícito
  aterriza en ARGA.
- Las pantallas de `audit` consultan **sin `tenant_id` y sin `tenantId` en la `queryKey`**.
- El botón «Cerrar sesión» no tiene handler y no hay ninguna llamada a `AuthContext.logout`
  en `src/`. Es lo que mantiene latentes las fugas de caché entre tenants.
- Tres defectos residuales del catálogo congelado de G4 que **sí** afectan a este alcance y
  están en §2.6 del diseño: el `content_outline` de PI-24 acaba en una cabecera corrida, los
  de PI-24/PI-28/PI-29 se detienen en «Anexos» —así que falta el §5 «Seguridad de la
  información» del Código ético de proveedores, que es materia central aquí—, y PI-22/PI-31
  tienen `edicion: null` pese a llevar versión en el PDF.

Empieza leyendo el diseño y preguntándome lo de su §5.
