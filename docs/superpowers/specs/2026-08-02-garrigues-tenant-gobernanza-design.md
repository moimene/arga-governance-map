# Tenant Garrigues — espejo de gobierno corporativo, motor SLP y programa G0–G8

**Fecha:** 2026-08-02 · **Estado:** diseño validado en brainstorming, pendiente de plan de implementación por fase
**Fuentes:** `version garrigues/Garr_politicas/` (inventario societario, sistema de gobierno corporativo, 30 políticas PI, Código Ético, PPD + mapas evaluados 2025, Manual PBC/FT v.10, PI-30, PI-31) + código y Cloud verificados en sesión.

---

## 1. Propósito y contexto

Demo de venta del producto de gobernanza a **Garrigues como cliente final**: que la secretaría societaria y el gobierno interno del despacho se vean **a sí mismos** dentro de la consola. Propuesta **desde dentro**: el autor es OF COUNSEL miembro del Comité de Innovación y Digitalización (CID); la audiencia natural es el CID / subcomité de Nuevos Negocios Digitales. Sin efecto jurídico, sin dato confidencial: solo fuentes publicadas por el propio titular o entregadas en la carpeta de políticas.

La audiencia son abogados mercantilistas mirando su propia casa: el listón no es de datos, es de **precisión jurídica**. Un pack de Junta sirviendo a un administrador único, una SLP tratada como SL o un comité consultivo presentado como órgano decisorio rompen la demo en la primera pantalla.

## 2. Decisiones cerradas

| # | Decisión | Elección |
|---|---|---|
| D1 | Propósito | Demo de venta a Garrigues (cliente final; propuesta desde dentro) |
| D2 | Aislamiento | **Tenant nuevo en `governance_OS`**, mismo repo, aislado por RLS. Sin fork, sin segundo Supabase |
| D3 | Perímetro | Las ~29 entidades del inventario completas; **motor jurídico solo España**; internacionales etiquetadas fuera de cobertura |
| D4 | Personas | Reales de fuente pública del titular (~120 con cargos en comités); donde no hay fuente, etiquetado "no verificado". Sin inventar nombres en pantallas críticas |
| D5 | Módulos | Los cuatro con profundidad: Secretaría + Sistema normativo + Penal/PBC + SII + AI Governance |
| D6 | Plazo | Sin fecha cerrada: programa por valor decreciente con línea de corte móvil |
| D7 | Identidad | **Tematizar todo como Garrigues** (shell incluido) vía theming por tenant. El shell no se quita: se conmuta la marca. ARGA conserva su perfil por defecto y su demo del 21/07 intacta |

## 3. Modelo de gobierno — la corrección estructural

### 3.1 Topología real (fuente: Sistema de gobierno corporativo)

- **Junta de Socios** — órgano soberano de la cabecera **J&A Garrigues, S.L.P.**; **+300 socios profesionales** (los socios lo son de la cabecera, no de las filiales).
- **Administrador único / presidente ejecutivo** — Fernando Vives. Cargo no remunerado. Máximo responsable de gestión, administración y representación. Adopta por `UNIPERSONAL_ADMIN`.
- **Senior partner** — Rosa Zarza. **Cargo de supervisión, no órgano de administración**: apoyo al administrador único, supervisión del PPD (con autonomía) y de PBC/FT, preside el Consejo de Socios.
- **~17 estructuras consultivas** (comités, comisiones, oficina DPO, OTS y Departamento de Compliance) — expresamente consultivas, **sin funciones ejecutivas**: no adoptan acuerdos, informan. Cuelgan del administrador único (Dirección, Nominaciones, CID, Pro Bono, Técnico Tributario, Igualdad, DPO, Editorial Global, ITP) o de la senior partner (Consejo de Socios, Práctica Profesional, Prevención de Delitos, CACI, Departamento de Compliance, Seguridad y Privacidad + OTS, Sostenibilidad, Comisión de Seguimiento). El **Comité de Gobernanza de la IA depende de ambos** (dependencia dual).
- **Consejo de Socios** — consultivo de 14: senior partner (preside) + administrador único + 12 socios designados por la Junta. **Informa preceptivamente a la Junta** antes de determinados acuerdos de relevancia → gate procedimental real.
- **Filiales españolas** — al ser los socios socios de la cabecera, las filiales tienen como socio a la matriz: juntas de **socio único/mayoritario** + **administración unipersonal**. Todo el grupo español es decisión unipersonal…
- **…salvo EAD Trust** (European Agency of Digital Trust, S.L.; 51,001% vía Compañía Digital NewLaw, S.L.U.): **único consejo de administración colegiado** del perímetro operativo. Doble rol: entidad gobernada + QTSP del ecosistema (solo interposición, mensajería básica y custodia/e-archiving; sin QES/ERDS conforme a la política 2026-07-21). **Composición del CdA** (fuente interna aportada por el usuario, consejero de la entidad; contrastable en BORME vía Carril B): presidente **Julián Inza**; consejero delegado **Eduardo Inza**; consejeros **Eduardo Abad, Cristina Mesa y Moisés Menéndez** (junto a los dos Inza); secretario no consejero **Roberto Delgado**; vicesecretaria **Belén Aguayo**. La figura de consejero delegado implica delegación de facultades inscrita → contenido real para el módulo de Delegaciones.

### 3.2 Modelado (sin migración estructural: `governing_bodies.config` JSONB)

- `config.naturaleza: 'DECISORIO' | 'CONSULTIVO'`. Los consultivos **no aparecen** como órgano de adopción en ningún stepper; tienen ficha, composición, misión y dependencia.
- `config.depende_de: ('ADMINISTRADOR_UNICO' | 'SENIOR_PARTNER')[]` — array para la dependencia dual del Comité de IA.
- `config.informe_preceptivo_de: [{materia, organo_informante}]` → gate PRE cuando adopta la Junta (conecta con `InformesPreceptivos.tsx` existente). **Alcance resuelto (D-3):** todos los informes **legalmente preceptivos aplicables a una SLP** (enumeración exacta pendiente de revisión legal, patrón del repo) **más nombramientos**. Órgano informante según materia: Consejo de Socios (acuerdos de relevancia y preceptivos legales) y Comité de Nominaciones (candidaturas a socio / nombramientos).
- `config.mandato_anios: 4` en Consejo de Socios y Nominaciones → vencimientos visibles en calendario societario.
- Órganos decisorios: Junta de Socios (`body_type='JUNTA'`), administrador único (`body_type='CDA'`, `config.organo_tipo='ADMIN_UNICO'` — resolver existente lo mapea a `CONSEJO` y el flujo lo da `adoption_mode='UNIPERSONAL_ADMIN'`), CdA EAD Trust (`CDA` colegiado), juntas de socio único de filiales (`SOCIO_UNICO`).
- Senior partner: **cargo** en `condiciones_persona` (no `governing_body`), con ownership visible en PPD y PBC/FT.

### 3.3 Censo de la Junta (+300) — estrategia honesta

Cargar los socios reales nombrados en fuentes públicas (~80–90 SOCIO únicos tras dedupe de los 19 comités) como `condiciones_persona` + un registro agregado etiquetado **"Resto del censo (+300 socios — no identificados públicamente)"** con peso agregado. La UI declara "censo demo representativo"; los cálculos operan sobre el censo cargado y así se etiquetan. Mismo patrón de honestidad probatoria que `EvidenceStatusBadge` y los avisos de procedencia registral. **Descartado:** inventar ~200 nombres (rompe el espejo) o censo vacío (mata el motor).

### 3.4 Personas y categorías

~120 personas únicas de la web de gobierno corporativo, campos mínimos: nombre + categoría + cargos en comités. Sin datos de contacto ni nada no publicado. **Política de datos confirmada por el usuario:** toda la información de personas procede de fuentes públicas (web corporativa y Registro Mercantil/BORME); lo no publicado se **simula y se etiqueta** como tal. Vocabulario de categorías propio de despacho (nuevo respecto a ARGA): `SOCIO, OF COUNSEL, COUNSEL, DIRECTOR GENERAL, DIRECTOR, GERENTE, ASOCIADO PRINCIPAL, ASOCIADO SENIOR, SUPERVISOR, COMPLIANCE OFFICER, SUPPORT, SECRETARY, LEGAL SUPPORT, UTTAI`. Nota RGPD en seed y docs: datos personales de fuente pública del propio titular, finalidad demo, minimización aplicada.

### 3.5 Incidencias de dato (se cargan señaladas, no cuadradas)

1. Comité de Nominaciones: el texto dice "diez socios", la lista trae doce.
2. Comité de Gobernanza de la IA: duplicado en la fuente (aparece bajo ambas ramas — coherente con su dependencia dual, pero la composición se carga una vez).
3. Garrigues Chile: Manual dice SpA; DUNS y Diario Oficial dicen Limitada (transformación posterior).
4. G-Advisory Colombia: oficina confirmada, denominación social local no verificada.
5. BSVV: integración oficial sin vehículo societario final localizado.
6. Centro de Estudios: vinculada, no controlada (20% transmitido; marca + presidente).
7. EAD Trust: variación nominal en un contrato (51% vs 51,001%).
8. Garrigues México S.C. y Garrigues MX S.C.: dos vehículos coexistentes.

## 4. Programa G0–G8 (orden = valor decreciente)

Cada fase: plan propio (writing-plans) → implementación → gates (`db:check-target`, `bun test`, lint, typecheck, build) → verificación viva → review adversarial → commit. Esfuerzo S/M/L.

### Carril B — históricos BORME por sociedad (M, **diferido a las fases finales**)

Carril de adquisición de dato público, independiente del código de producto (scripts + dataset en este repo; sin worktree nuevo). **Decisión 2026-08-02: no se lanza aún** — G1/G2 no dependen de él (se alimentan del inventario y de la página de gobierno corporativo); se activa hacia el final del programa (típicamente junto a G8) para nutrir históricos. **Condición de diseño derivada:** los seeds de G1/G2 deben ser aditivos e idempotentes, de modo que los históricos BORME se inyecten después sin re-sembrar.

- **Fuente:** BORME vía datos abiertos del BOE (digital desde 2009). Por cada sociedad española del perímetro: constitución, nombramientos y ceses, ampliaciones, transformaciones, cambios de domicilio, declaraciones de unipersonalidad, delegaciones de facultades.
- **Pipeline:** búsqueda por denominación → parseo de actos → normalización al modelo (datos registrales de `entities`, mandatos históricos, `registry_filings`, expedientes históricos) → carga idempotente.
- **Procedencia dual obligatoria en cada registro:** `BORME_CITADO` (acto real, con referencia de boletín) vs `INFERIDO` (contenido documental simulado a partir del acto). Limitación honesta: el BORME publica el **extracto** del acto, no el documento; el contenido se infiere y se etiqueta siempre.
- **Rendimiento esperado:** historia real por sociedad que da profundidad al Tramitador, al timeline de expedientes y a las fichas de entidad — incluida la verificación de la composición del CdA de EAD Trust (§3.1).

### G0 — Fundación del tenant + theming total (M)
- Migración mínima: `tenants.branding jsonb` (paleta, nombre comercial, logo, jurisdicción por defecto). Fila tenant Garrigues; ARGA con branding = valores actuales (default intacto).
- `TenantBrandProvider`: inyecta tokens `--t-*` (y nombre/logo) en `:root` al resolver tenant. Sustituir hardcodes: `ShellLayout.tsx` ("TGMS PLATFORM", "Grupo ARGA"), `Login.tsx` (variante por parámetro `?tenant=`), `SiiLayout.tsx` ("Grupo ARGA Seguros").
- Usuarios demo del tenant: auth user + `user_profiles` + `rbac_user_roles` (un SECRETARIO para la demo, un ADMIN_TENANT para importar plantillas).
- **Sondas de aislamiento** (release-crítico): usuario Garrigues no ve dato ARGA y viceversa (RLS con 2 tenants reales por primera vez); barrido de hardcodes de tenant/entity fuera de tests; estrategia de datos SII (schema `sii.*` intocable → decidir UI-only vs datos); `document_templates` tenant-scoped confirmado.
- **Gate de salida:** aislamiento probado empíricamente en ambos sentidos.

### G1 — Espejo societario: las 29 entidades (M)
- `entities` del inventario completo: cadena de control **J&A Garrigues SLP → filiales SLP → Compañía Digital NewLaw SLU → EAD Trust (51,001%)**, internacionales, sucursales, oficina de representación, división g-digital (no sociedad), vinculadas no controladas (Fundación Garrigues, Centro de Estudios). `parent_entity_id`, `ownership_percentage`, `forma_administracion`, `es_unipersonal`, `group_role`.
- Internacionales: `jurisdiction` real + etiqueta expresa "fuera de cobertura normativa del motor (ES)" — la brecha como gancho de multi-jurisdicción, no como silencio.
- Mapa de gobernanza y ScopeSwitcher mostrando 29 entidades / 12 países / 32 oficinas.
- Incidencias §3.5 registradas en el dato (campo/nota visible).

### G2 — Gobierno de la matriz: topología + personas (L)
- La topología completa: Junta de Socios, administrador único, senior partner (cargo) y las ~17 estructuras consultivas con naturaleza/dependencia/misión/mandatos (§3.2), incluida la dependencia dual del Comité de IA.
- ~120 personas + categorías (§3.4) + composición real de cada comité; censo representativo de la Junta (§3.3).
- CdA EAD Trust: composición **pendiente de fuente** (decisión abierta D-2); si no la hay, cargos con titular "no verificado".
- Vencimientos de mandato (4 años) en calendario.

### G3 — Motor jurídico Garrigues: SLP + unipersonal + gate preceptivo (L)
- `TipoSocial += 'SLP'` (`types.ts:16`) + barrido de `Record<TipoSocial, …>` exhaustivos (antelaciones, canales) hasta typecheck verde.
- **Rule packs del tenant Garrigues** (los 57 de ARGA no se heredan): materias núcleo con `organo_tipo` correcto — decisiones del administrador único (CONSEJO + `UNIPERSONAL_ADMIN`), Junta de Socios (JUNTA_GENERAL), socio único de filiales (SOCIO_UNICO), CdA EAD Trust (CONSEJO colegiado). Payload con la mayoría en clave de primer nivel legible por el extractor actual — **el gotcha del extractor de ARGA no se toca**.
- Overlay Ley 2/2007 como parámetros de pack (transmisión, separación/exclusión de socio profesional, mayoría de socios profesionales además de capital). Redacción de citas legales: **pendiente de revisión legal** (patrón del repo); la demo enseña estructura y gates, no dictamina.
- **Gate de informe preceptivo del Consejo de Socios**: requisito PRE para materias reservadas cuando adopta la Junta; lista de materias = decisión abierta D-3 (si no hay fuente interna, set demo etiquetado).
- Plantillas núcleo del tenant (vía TemplateImportWizard con el ADMIN_TENANT de G0 o seed service-role): decisión de administrador único + acta de consignación + convocatoria/acta de Junta + certificación. Inventario completo = post-demo.
- Con packs propios del tenant, el selector deja de caer en `FALLBACK_ORGANO_DISTINTO`: los avisos de procedencia quedan como red de seguridad, no como estado permanente.

### G4 — Sistema normativo interno navegable (M)
- Las 30 PI + Código Ético + PPD + Manual PBC/FT como catálogo en `/politicas` con metadatos y **ownership real por comité**: Práctica Profesional impulsa el sistema; Editorial Global ↔ PI-14; CACI + senior partner ↔ PBC/FT; Comité IA ↔ PI-30; SII ↔ PI-31.
- Documentos fuente como referencias de evidencia postura `reference` (no final; `000049` sigue HOLD).

### G5 — Penal/PBC con dato real puntuado (M)
- Los dos **mapas evaluados 2025** (áreas de negocio + departamentos internos) → `risks` con puntuaciones reales vía `/grc/risk-360` (owner-write; sin tocar columnas generadas). Catálogo de situaciones del PPD → catálogo de riesgo.
- Ownership: senior partner (supervisión PPD/PBC con autonomía) + Comité de Prevención de Delitos + CACI + Departamento de Compliance.

### G6 — SII por tenant (S)
- Rebrand UI por tenant (hardcode de `SiiLayout`), PI-31 como política rectora enlazada, casos demo neutros. Restricción: **no modificar tablas del schema `sii.*`**; si las vistas no son tenant-scoped (sonda G0), el dato es compartido-neutro y la marca va solo en UI.

### G7 — IA como sistema de gestión + riesgo tecnológico y seguridad (L)
- **Resuelto D-4: se activa como sistema de gestión y administración.** Migración RLS forward-only para `ai_risk_assessments` (alta de evaluaciones), con espejo en repo.
- Inventario real declarado por el usuario: **MS Copilot, Harvey, aplicaciones internas sobre infraestructura Ga-IA (soluciones open source)**, acuerdos enterprise con **OpenAI y Anthropic**; roadmap de **soluciones agénticas independientes** que van resolviendo procesos (etiquetado como plan, no como desplegado).
- Comité de Gobernanza de la IA como órgano rector (dependencia dual visible); PI-30 como política rectora.
- **Ampliación de alcance:** riesgos tecnológicos y de seguridad como área crítica orientada a **cumplimiento y certificación de sistemas** — módulo Cyber/GRC con riesgos tecnológicos del despacho; SGSI ISO 27001 real con sus owners (Comité de Seguridad y Privacidad + OTS + CISO); seguimiento de certificaciones: ISO 27001 (alcance real del certificado: matriz + Letrados de Soporte + IP + Sports & Entertainment + G-Advisory) y marco eIDAS de EAD Trust como QTSP **en cuanto objeto de cumplimiento gobernado** (sin afirmar capacidades de firma de la plataforma).

### G8 — Vitrina EAD Trust + cierre demo-ready (M)
- Ciclo colegiado completo del CdA de EAD Trust con los packs de G3: convocatoria 8/8 → reunión → acta → certificación, con custodia por interposición EAD (sin claim de firma/QES/ERDS).
- La narrativa circular que cierra la venta: *el grupo gobierna su propia filial de confianza digital con la plataforma, y la plataforma custodia su evidencia en esa misma filial.* Refuerzo narrativo: el proponente es consejero de EAD Trust — la vitrina se demuestra sobre un órgano del que forma parte la propia audiencia interna.
- Runbook de demo (patrón `2026-07-06-demo-runbook.md`) orientado a audiencia CID/Nuevos Negocios Digitales.

## 5. Decisiones — estado (2026-08-02)

- **D-1 Login por tenant:** se adopta la variante `?tenant=garrigues` salvo indicación en contra.
- **D-2 Composición del CdA de EAD Trust: RESUELTA** — composición completa en §3.1, aportada por el usuario (consejero de la entidad); el Carril B la contrastará con BORME.
- **D-3 Informes preceptivos: RESUELTA** — todos los legalmente preceptivos aplicables a una SLP + nombramientos, con órgano informante por materia (§3.2).
- **D-4 Evaluaciones IA: RESUELTA** — se activa vía migración RLS; G7 ampliado a riesgo tecnológico/seguridad y certificación de sistemas.

## 6. Riesgos y salvaguardas

| Riesgo | Salvaguarda |
|---|---|
| RLS nunca probada con 2 tenants activos | Sonda bidireccional en G0 como gate de salida |
| Supuestos single-tenant ocultos en hooks/páginas | Barrido de hardcodes en G0 (grep ya limpio fuera de tests; verificar UI) |
| `Record<TipoSocial>` exhaustivos rompen al añadir SLP | Typecheck sweep en G3; es el objetivo, no un accidente |
| Plantillas: 73 ACTIVA son de ARGA | Núcleo mínimo definido en G3; inventario completo post-demo |
| Extractor de mayorías lee primer nivel (gotcha ARGA) | No se toca; los seeds Garrigues usan forma legible por el extractor actual |
| Datos personales reales | Fuente pública (web del titular + Registro Mercantil/BORME), minimización, nota RGPD, sin contacto |
| Inferencia BORME confundida con dato real | Procedencia dual obligatoria en todo registro histórico: `BORME_CITADO` vs `INFERIDO` |
| Discrepancias del inventario | Se cargan señaladas (§3.5), nunca cuadradas en silencio |
| Drift de migraciones (junio) | Canal establecido: MCP `execute_sql` / Management API + espejo en repo; **no `repair`** |
| Árbol git compartido (~370 ficheros tocados) | `git add` de rutas específicas, nunca `-A` |
| Claims de confianza digital | EAD solo interposición/mensajería/custodia; sin QES/ERDS/firma; sin proveedores competidores |
| SII schema intocable | UI-only salvo que la sonda G0 habilite datos tenant-scoped |

## 7. Fuera de alcance

Motor multi-jurisdicción (UK/US/MA/PL/CO/PE/MX/CL); segregación a repos por módulo; white-label para un tercer cliente (separar `--g-*` de "color del tenant" — YAGNI hasta que exista); firma electrónica/QES/ERDS; cualquier efecto jurídico real; SCIM/BYOK.

## 8. Criterios de éxito de la demo

1. Un socio entra y ve **su casa**: marca, 29 entidades en 12 países, sus 17 comités con su naturaleza correcta, sus nombres reales donde son públicos.
2. Una **decisión del administrador único** recorre el ciclo completo (adopción → consignación → certificación → custodia) sin que ningún aviso de procedencia delate un pack prestado.
3. El **gate de informe preceptivo** del Consejo de Socios detiene una emisión de la Junta hasta que el informe existe.
4. El **catálogo normativo** navega de política → comité responsable → personas, con las 30 PI reales.
5. Los **mapas penales 2025** aparecen con sus puntuaciones reales en Risk360.
6. El **CdA de EAD Trust** completa un ciclo colegiado y su evidencia queda custodiada por interposición del propio EAD.
7. En ningún punto la consola afirma algo que la fuente no soporta: censo representativo etiquetado, cargos no verificados etiquetados, internacionales fuera de cobertura etiquetadas.
8. El histórico por sociedad muestra actos reales del BORME con su cita de boletín, y todo contenido inferido va etiquetado como tal.
9. El área de riesgo tecnológico/seguridad enseña el SGSI ISO 27001 con su alcance real y el marco QTSP de EAD Trust como objeto de cumplimiento — sin que la plataforma se atribuya capacidades de firma.
