# Tenant Garrigues — espejo de gobierno corporativo, motor SLP y programa G0–G8

**Fecha:** 2026-08-02 · **Última revisión:** 2026-08-03 (revisión adversarial pre-G1 aplicada: H1–H12) · **Estado:** G0 ejecutada y mergeada a `origin/main` (`c3df611`); G1 pendiente de plan
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
- **Cláusula estatutaria de conversión (fuente: certificado del acta de la Junta de Socios de 6 de mayo de 2026, depósito de cuentas anuales consolidadas 2025, Registro Mercantil de Madrid):** el propio despacho ya tiene escrita en sus Estatutos Sociales la transición que esta demo anticipa. La Junta 2026 extendió el mandato de Fernando Vives como administrador único hasta el 30/06/2032 e incluyó una Disposición transitoria por la que, **si la estructura del órgano de administración cambia a Consejo de Administración, el mandato de Vives se convierte automáticamente en Presidente Ejecutivo del Consejo** por el tiempo que reste de mandato. Punto 1.2 del orden del día de la Junta. Valida directamente la premisa del programa (D1/D3).
- **…salvo EAD Trust** (European Agency of Digital Trust, S.L.; 51,001% vía Compañía Digital NewLaw, S.L.U.): **único consejo de administración colegiado** del perímetro operativo. Doble rol: entidad gobernada + QTSP del ecosistema (solo interposición, mensajería básica y custodia/e-archiving; sin QES/ERDS conforme a la política 2026-07-21). **Composición del CdA** (fuente interna aportada por el usuario, consejero de la entidad; contrastable en BORME vía Carril B): presidente **Julián Inza**; consejero delegado **Eduardo Inza**; consejeros **Eduardo Abad, Cristina Mesa y Moisés Menéndez** (junto a los dos Inza); secretario no consejero **Roberto Delgado**; vicesecretaria **Belén Aguayo**. La figura de consejero delegado implica delegación de facultades inscrita → contenido real para el módulo de Delegaciones.

### 3.2 Modelado (sin migración estructural: `governing_bodies.config` JSONB)

- `config.naturaleza: 'DECISORIO' | 'CONSULTIVO'`. Los consultivos **no aparecen** como órgano de adopción en ningún stepper; tienen ficha, composición, misión y dependencia.
- `config.depende_de: ('ADMINISTRADOR_UNICO' | 'SENIOR_PARTNER')[]` — array para la dependencia dual del Comité de IA.
- `config.informe_preceptivo_de: [{materia, organo_informante}]` → gate PRE cuando adopta la Junta (conecta con `InformesPreceptivos.tsx` existente). **Alcance resuelto (D-3):** todos los informes **legalmente preceptivos aplicables a una SLP** (enumeración exacta pendiente de revisión legal, patrón del repo) **más nombramientos**. Órgano informante según materia: Consejo de Socios (acuerdos de relevancia y preceptivos legales) y Comité de Nominaciones (candidaturas a socio / nombramientos).
- `config.mandato_anios: 4` en Consejo de Socios y Nominaciones → vencimientos visibles en calendario societario.
- Órganos decisorios: Junta de Socios (`body_type='JUNTA'`), administrador único (`body_type='CDA'`, `config.organo_tipo='ADMIN_UNICO'` — resolver existente lo mapea a `CONSEJO` y el flujo lo da `adoption_mode='UNIPERSONAL_ADMIN'`), CdA EAD Trust (`CDA` colegiado), juntas de socio único de filiales (`SOCIO_UNICO`).
- Senior partner: **cargo** en `condiciones_persona` (no `governing_body`), con ownership visible en PPD y PBC/FT.

### 3.3 Censo de la Junta — actualizado con dato real del acta 2026

**Revisión al alza:** el certificado del acta de la Junta de Socios de 6 de mayo de 2026 (depósito de cuentas 2025, Registro Mercantil de Madrid, documento público) trae **346 socios exactos** (no una estimación "+300") y el listado nominal de los asistentes representados — varios cientos de nombres reales, en su inmensa mayoría distintos de los ~120 ya cargados desde la web de gobierno corporativo (esa web da cargos en comités; el acta da el censo societario completo). Mecánica real de la Junta, útil para modelar la convocatoria: 3 socios con presencia física (0,8875% de los derechos de voto) + 343 representados por delegación de voto (99,1125%), con **18 participaciones en autocartera (2,59% de los derechos de voto)** excluidas del cómputo. Rosa Zarza presidió como socia y senior partner (art. 29 Estatutos); Roberto Delgado actuó de Secretario, elegido por unanimidad de los asistentes.

**Estrategia:** cargar el censo real de 346 socios (nombre + condición SOCIO) desde el listado del acta como `condiciones_persona`, con `is_treasury`/peso agregado para las 18 participaciones en autocartera. Los ~120 con cargo en comité (§3.4) son un subconjunto identificado dentro de ese mismo censo — no dos poblaciones distintas. Fuente pública (depósito registral), consistente con D4. **Descartado:** el enfoque previo de "censo agregado no identificado" queda superado por este dato real y más rico.

**Contenido real de Estatutos útil para el motor** (mismo certificado): edad estatutaria de retiro ordinario de socios de cuota = **60 años** (art. 21.1.e, con adquisición de autocartera por la Sociedad); causa de exclusión de socio (art. 21.1.f, con excepción mientras se integre el Órgano de Administración); mecanismo de dividendo mixto (10% proporcional a capital social + resto según "baremo de unidades" entre Socios de Cuota, con retribución variable de la prestación accesoria — señalada en el acta como "EPU", sigla del propio documento sin expansión confirmada). Estas son materias candidatas naturales para el gate de informe preceptivo (D-3: nombramientos, exclusión/admisión de socio).

**Modelado de capital canónico (H5 — paridad con ARGA):** el motor no calcula sobre `condiciones_persona` a secas — vive en `entity_capital_profile` (una fila VIGENTE por entidad), `share_classes`, `capital_holdings` y `censo_snapshot`. Seed de la matriz: capital escriturado **11.040 miles €** (balance consolidado 2025, partida Capital); clase **A** de participaciones (citada en el punto 3.3 del orden del día); autocartera **18 participaciones = 2,59% de los derechos de voto** con `is_treasury = true` (regla canónica del repo: voting_weight 0 y denominator_weight 0); restricción agregada real adicional: los 3 socios presenciales (Vives, Zarza, Delgado) suman **0,8875%**. Los pesos individuales por socio **no son públicos** (el Anexo 2 del acta no está transcrito): se simulan verosímiles, etiquetados `INFERIDO`, respetando las restricciones agregadas reales. `censo_snapshot` tipo UNIVERSAL de la Junta 2026 como base del caso canónico (§3.6). Filiales: la matriz como socio único/mayoritario en `capital_holdings` con los % del IDC.

### 3.4 Personas y categorías

~120 personas únicas de la web de gobierno corporativo, campos mínimos: nombre + categoría + cargos en comités. Sin datos de contacto ni nada no publicado. **Política de datos confirmada por el usuario:** toda la información de personas procede de fuentes públicas (web corporativa y Registro Mercantil/BORME); lo no publicado se **simula y se etiqueta** como tal. Vocabulario de categorías propio de despacho (nuevo respecto a ARGA): `SOCIO, OF COUNSEL, COUNSEL, DIRECTOR GENERAL, DIRECTOR, GERENTE, ASOCIADO PRINCIPAL, ASOCIADO SENIOR, SUPERVISOR, COMPLIANCE OFFICER, SUPPORT, SECRETARY, LEGAL SUPPORT, UTTAI`. Nota RGPD en seed y docs: datos personales de fuente pública del propio titular, finalidad demo, minimización aplicada.

### 3.5 Incidencias de dato (se cargan señaladas, no cuadradas)

1. Comité de Nominaciones: el texto dice "diez socios", la lista trae doce.
2. Comité de Gobernanza de la IA: duplicado en la fuente (aparece bajo ambas ramas — coherente con su dependencia dual, pero la composición se carga una vez).
3. Garrigues Chile: Manual dice SpA; DUNS y Diario Oficial dicen Limitada (transformación posterior). **Matiz 2026-08-03:** las cuentas consolidadas 2025 depositadas aún la denominan **SpA** — coherente con la denominación al cierre 2025, pre-transformación; cargar señalado.
4. G-Advisory Colombia: oficina confirmada, denominación social local no verificada.
5. BSVV: integración oficial sin vehículo societario final localizado en el inventario original — **actualizado:** el punto 5 del orden del día de la Junta de Socios 2026 aprueba formalmente la integración de BSVV con Garrigues Chile Limitada, la admisión de los Socios de Cuota de BSVV y un aumento de capital social para su asunción — ya no es una integración informal de marca, es un acuerdo societario real y fechado (6 de mayo de 2026).
6. Centro de Estudios: vinculada, no controlada (20% transmitido; marca + presidente).
7. EAD Trust: variación nominal en un contrato (51% vs 51,001%).
8. Garrigues México S.C. y Garrigues MX S.C.: dos vehículos coexistentes.
9. Centro de Estudios, evolución 2026: el punto 4 del orden del día de la Junta 2026 aprueba una **"Operación de toma de participación"** en el Centro de Estudios, posterior a la transmisión del 20% comunicada en 2025 — dirección del movimiento sin reconciliar entre fuentes; cargar señalada.

### 3.6 Caso canónico Garrigues — la Junta de Socios real de 6 de mayo de 2026 (H3)

Paridad con el caso canónico de ARGA (Convocatoria integral UAT del 2026-07-21): el tenant Garrigues reproduce dentro de la plataforma su Junta ordinaria real, documentada íntegramente en el depósito del RM:

- **Convocatoria** (art. 27.3 Estatutos): comunicación personal individualizada por correo electrónico con acuse de recibo, enviada el 21/04/2026 para el 06/05/2026 — **15 días de antelación reales**. El texto literal de la carta ("Querido socio: …") sirve de capa 1 de la plantilla de convocatoria de Junta.
- **Censo y asistencia:** 346 socios = 100% de los derechos de voto; 3 presenciales (0,8875%) + 343 representados, todos por **Roberto Delgado**, que exhibió las cartas de delegación a la Presidenta; autocartera (18 participaciones, 2,59%) excluida del cómputo.
- **Mesa:** preside **Rosa Zarza** como socia y senior partner (art. 29 Estatutos); **Roberto Delgado**, Secretario elegido por unanimidad de los asistentes.
- **12 puntos del orden del día** como agreements (mandato/estatutos, exclusión-continuidad-admisión de socios, Centro de Estudios, integración BSVV con aumento sin derecho de preferencia, cuentas, sostenibilidad, gestión, auditor, retribución de prestaciones accesorias, delegación de facultades, acta). Los acuerdos no transcritos en el certificado (p. ej. exclusiones de socios concretos) se modelan **sin identificar personas** y con contenido `INFERIDO`.
- **Cierre documental con la cadena real de firmas:** acta redactada por el Secretario conforme al art. 97 RRM y aprobada al final de la reunión, **firmada por el Secretario con el VºBº de la Presidenta**; **certificación expedida por el administrador único** (Fernando Vives — patrón art. 109 RRM, sin VºBº); elevación a público con inscripción parcial (Tramitador) y **depósito de cuentas** con certificación de huella digital.
- Todos los artefactos generados se etiquetan como **reconstrucción demo sin efecto jurídico**: el expediente real ya existe en el RM; la plataforma lo reproduce, no lo sustituye.

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

### G1 — Espejo societario: las 29+ entidades (M)
- `entities` del inventario completo: cadena de control **J&A Garrigues SLP → filiales SLP → Compañía Digital NewLaw SLU → EAD Trust**, internacionales, sucursales, oficina de representación, división g-digital (no sociedad), vinculadas no controladas (Fundación Garrigues, Centro de Estudios). `parent_entity_id`, `ownership_percentage`, `forma_administracion`, `es_unipersonal`, `group_role`.
- **Perímetro de consolidación oficial (fuente: cuentas anuales consolidadas 2025, formulario IDC2.1.1 depositado en el Registro Mercantil)** — confirma y refina el inventario original con `%` exacto de participación de J&A Garrigues SLP:
  - **100,00%** (alta confianza, cifra redonda y legible): Garrigues IP SLP · Garrigues Letrados de Soporte SLP · Garrigues Human Capital Services SLP · Garrigues Consultoría de Empresa Familiar SLP · Garrigues LLP (US) · Garrigues Maroc SARLAU · Garrigues-IP Unipessoal Lda (PT) · Compañía Digital NewLaw SLU.
  - **75,00%**: G-Advisory Consultoría Técnica, Económica y Estratégica SLP — **no 100%**, corrige un supuesto tácito del inventario original.
  - **Split directa/indirecta legible (sembrar como *a confirmar*, no como dato firme):** Garrigues Polska SpK 98,99% directa; J&A Garrigues Perú SCRL 0,01% directa + 98,99% indirecta; Garrigues México S.C. 0,01% + 98,98%; Garrigues Chile **SpA** 0,32% + 98,58%; Garrigues MX S.C. ~5,25% + 94,74%; G-Advisory México y G-Advisory Chile 75% indirecta.
  - **EAD Trust** — la tabla oficial registra **51,00% de participación indirecta** (participante directo ilegible en la celda); la cadena **vía Compañía Digital NewLaw SLU** procede del contrato interno citado en el inventario (51,001%), y ambas fuentes son coherentes entre sí. Titular directo y cifra exacta: a confirmar (BORME / Carril B).
  - **3 vehículos holding nuevos, no presentes en el inventario original** (relectura dirigida del IDC2.1.1, 2026-08-03): **Violet Inversiones 2010, S.L.** (100% indirecta) · **EWCH(?) Inversiones 20¿10?, S.L.** (100% indirecta; denominación parcialmente ilegible — confirmar antes de sembrar) · **Garben Inversiones 2013, S.L.U.** (~75%, no 100% — confirmar). **Corrección adversarial (H1):** una versión anterior de esta spec listaba un cuarto vehículo, "Xoo.com Digital, S.L.U.", que **no existe** en la tabla — error de lectura, retirado.
  - **Datos registrales reales para `entities` (fuente: certificación del RM del propio depósito):** matriz J&A Garrigues SLP — NIF `B81709081`, Hoja `M-190538`, Tomo `17456`, Folio `132`, Plaza de Colón 2 (28046 Madrid), inicio de operaciones 01/04/1997, duración indefinida y, **impreso por el propio Registro, "Estructura del órgano: Administrador único"** — el gobierno unipersonal es literalmente dato registral. El IDC aporta además NIF de las dependientes españolas (sembrar los legibles; el resto *a confirmar*).
  - Dato curioso de identidad cruzada: **Roberto Delgado Gil** (Secretario de la Junta de Socios, según el acta 2026) es el mismo nombre que figura como socio de la razón social de la vinculada polaca ("Garrigues Polska **i Roberto Delgado Gil**, Sp.K.") y como Secretario no consejero del CdA de EAD Trust (§3.1) — coherencia entre fuentes independientes, refuerza la fiabilidad del dato.
- Internacionales: `jurisdiction` real + etiqueta expresa "fuera de cobertura normativa del motor (ES)" — la brecha como gancho de multi-jurisdicción, no como silencio.
- Mapa de gobernanza y ScopeSwitcher mostrando 29+ entidades / 12 países / 32 oficinas.
- Incidencias §3.5 registradas en el dato (campo/nota visible), incluida la confirmación 2026 de BSVV (ver actualización del punto 3).

### G2 — Gobierno de la matriz: topología + personas + censo real (L)
- La topología completa: Junta de Socios, administrador único, senior partner (cargo) y las ~17 estructuras consultivas con naturaleza/dependencia/misión/mandatos (§3.2), incluida la dependencia dual del Comité de IA.
- ~120 personas con cargos de comité (§3.4) como subconjunto identificado del **censo real de 346 socios** del acta 2026 (§3.3), con el modelo de capital canónico (perfil VIGENTE, clase A, autocartera `is_treasury`, pesos `INFERIDO` bajo restricciones agregadas reales).
- CdA EAD Trust: composición **resuelta** (D-2, §3.1) — seed directo de los 5 consejeros + secretario no consejero + vicesecretaria; contraste BORME diferido al Carril B.
- **Libros societarios** (H8 — paridad con el módulo Libros de ARGA): Libro registro de socios alimentado por el censo real de 346 y libro de actas arrancando con la Junta 2026 (§3.6) — dos de los espejos más potentes, y salen del mismo seed.
- **Delegaciones** (módulo shell `/delegaciones`): contenido real — la delegación de facultades del punto 11 de la Junta 2026 (a favor de Vives y apoderados, con facultades de elevación a público y subsanación) y la delegación inscrita del consejero delegado de EAD Trust (Eduardo Inza).
- Mandatos reales: administrador único **30/06/2026 → 30/06/2032** (el anterior vencía 31/01/2028; terminación anticipada + reelección por 6 años, art. 36 reformado); Consejo de Socios y Nominaciones a 4 años → vencimientos en calendario.

### G3 — Motor jurídico Garrigues: SLP + unipersonal + gate preceptivo (L)
- `TipoSocial += 'SLP'` (`types.ts:16`) + barrido de `Record<TipoSocial, …>` exhaustivos (antelaciones, canales) hasta typecheck verde.
- **Rule packs del tenant Garrigues** (los 57 de ARGA no se heredan): materias núcleo con `organo_tipo` correcto — decisiones del administrador único (CONSEJO + `UNIPERSONAL_ADMIN`), Junta de Socios (JUNTA_GENERAL), socio único de filiales (SOCIO_UNICO), CdA EAD Trust (CONSEJO colegiado). Payload con la mayoría en clave de primer nivel legible por el extractor actual — **el gotcha del extractor de ARGA no se toca**.
- Overlay Ley 2/2007 como parámetros de pack (transmisión, separación/exclusión de socio profesional, mayoría de socios profesionales además de capital). Redacción de citas legales: **pendiente de revisión legal** (patrón del repo); la demo enseña estructura y gates, no dictamina.
- **Cadena de certificación unipersonal (H4 — art. 109 RRM, visible en el certificado real):** el pipeline F9 (`fn_generar_certificacion` + `EmitirCertificacionButton` + `usePresidenteVigente`) nace del patrón ARGA (secretario certifica + VºBº del presidente). En la matriz: **acta** = Secretario de la Junta + VºBº de la Presidenta (senior partner); **certificación** = administrador único **sin VºBº**. En EAD Trust: secretario no consejero + VºBº del presidente. Sonda G3 obligatoria: verificar que el pipeline acepta certificante ADMIN_UNICO con `p_visto_bueno_persona_id` NULL — es la clase de error "pack de Junta servido a un admin único" aplicada a la certificación.
- **Materias SLP nuevas en el catálogo del tenant (H7)**, exigidas por los 12 puntos reales de la Junta 2026: admisión de socio de cuota, exclusión estatutaria (retiro a los 60, art. 21.1.e), continuidad post-60, retribución de prestaciones accesorias, integración de despacho (aumento sin derecho de preferencia). ⚠️ Los cambios de clasificación tocan todos los read-paths (routing de adopción, intakes `?materia=`, cobertura de plantillas): review adversarial por fase, como manda la experiencia del repo.
- **Parámetros reales de convocatoria de Junta (H11)** para los packs: antelación **15 días** (21-abr → 6-may), canal = comunicación individual por correo electrónico **con acuse de recibo** (art. 27.3 Estatutos); el texto literal de la carta real como capa 1 de plantilla (§3.6).
- **Gate de informe preceptivo del Consejo de Socios**: requisito PRE para materias reservadas cuando adopta la Junta; lista de materias = decisión abierta D-3 (si no hay fuente interna, set demo etiquetado).
- Plantillas núcleo del tenant (vía TemplateImportWizard con el ADMIN_TENANT de G0 o seed service-role): decisión de administrador único + acta de consignación + convocatoria/acta de Junta + certificación. Inventario completo = post-demo.
- Con packs propios del tenant, el selector deja de caer en `FALLBACK_ORGANO_DISTINTO`: los avisos de procedencia quedan como red de seguridad, no como estado permanente.

### G4 — Sistema normativo interno navegable (M)
- Las 30 PI + Código Ético + PPD + Manual PBC/FT como catálogo en `/politicas` con metadatos y **ownership real por comité**: Práctica Profesional impulsa el sistema; Editorial Global ↔ PI-14; CACI + senior partner ↔ PBC/FT; Comité IA ↔ PI-30; SII ↔ PI-31.
- Documentos fuente como referencias de evidencia postura `reference` (no final; `000049` sigue HOLD).
- **Obligaciones y controles (H12 — paridad con `/obligaciones` de ARGA):** obligaciones PBC/FT de la Ley 10/2010 (formación, examen especial, comunicaciones) y controles del PPD mapeados al módulo de obligaciones/controles con ownership real: CACI, Comité de Prevención de Delitos y Departamento de Compliance.

### G5 — Penal/PBC + ESG + hallazgos con dato real puntuado (M→L, ampliada 2026-08-03)
- Los dos **mapas evaluados 2025** (áreas de negocio + departamentos internos) → `risks` con puntuaciones reales vía `/grc/risk-360` (owner-write; sin tocar columnas generadas). Catálogo de situaciones del PPD → catálogo de riesgo.
- Ownership: senior partner (supervisión PPD/PBC con autonomía) + Comité de Prevención de Delitos + CACI + Departamento de Compliance.
- **ESG** (módulo shell `/esg`): contenido desde el **Informe de Sostenibilidad 2025** real (fuente disponible: PDF de 90 páginas + los 84 del depósito; lectura dirigida en esta fase) — Plan de Sostenibilidad 2023-2025, Comité de Sostenibilidad y Comisión de Seguimiento como owners.
- **Hallazgos y planes de acción** (`/hallazgos`): sembrados desde la lógica de autoevaluación del PPD, etiquetados como simulados-verosímiles (la fuente da el marco, no hallazgos concretos).
- **Conflictos** (`/conflictos`): declaraciones de conflicto de interés de socios simuladas y etiquetadas — ningún conflicto real se afirma; el módulo no puede quedar vacío en una demo de gobernanza integral de un despacho.

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
- **D-5 Aplicabilidad de módulos por tenant (ABIERTA, 2026-08-03):** DORA, los country packs aseguradores y el Board Pack de cotizada no aplican al perfil de un despacho. Opciones: (a) **visibilidad de módulos por tenant** vía `tenants.branding.modules` filtrando sidebar/rutas (recomendada: honesta, barata, reversible; ARGA sin cambio); (b) mostrarlos con badge "No aplicable al perfil"; (c) dejarlos visibles tal cual (diluye el espejo). Afecta a G4/G5/G7; no bloquea G1-G3.
- **Cobertura integral de la consola (2026-08-03):** verificado que todas las superficies tienen fase asignada — shell/branding G0; entidades/mapa/scopes/saludo G1 (incl. Task 8: hardcodes `src/data/scopes.ts` y saludo del Dashboard descubiertos bajo Garrigues); órganos/personas/libros/delegaciones/calendario G2; Secretaría+motor G3; políticas+obligaciones G4; GRC penal+ESG+hallazgos+conflictos G5; SII G6; IA+cyber+certificaciones G7; vitrina y runbook integral G8; módulos no aplicables D-5.

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
7. En ningún punto la consola afirma algo que la fuente no soporta: el censo de 346 es real pero los **pesos individuales van etiquetados como simulados**, cargos no verificados etiquetados, internacionales fuera de cobertura etiquetadas, y porcentajes de participación dudosos marcados *a confirmar*.
8. El histórico por sociedad muestra actos reales del BORME con su cita de boletín, y todo contenido inferido va etiquetado como tal.
9. El área de riesgo tecnológico/seguridad enseña el SGSI ISO 27001 con su alcance real y el marco QTSP de EAD Trust como objeto de cumplimiento — sin que la plataforma se atribuya capacidades de firma.
10. **La Junta real de 6 de mayo de 2026 está reproducida end-to-end como caso canónico** (§3.6): convocatoria art. 27.3 → censo 346 → acta con VºBº de la Presidenta → certificación del administrador único → depósito, con todos los artefactos etiquetados como reconstrucción demo.
