-- ============================================================
-- Demo data refresh — pre-presentación (2026-07-07)
-- Auditoría multiagente 2026-07-06: el riesgo dominante de la demo no era
-- código sino dato demo congelado en abril-junio (KPIs de Mesa a 0, 3 vistas
-- del Tramitador vacías, reunión CELEBRADA con fecha futura, plazos de libros
-- vencidos, personas fixture E2E huérfanas, decisiones unipersonales
-- triplicadas por campaña repetida, token DEMO_ crudo visible, sociedades
-- BR/MX/PT duplicadas). Solo DATA, forward-only, tenant demo.
-- Verificación previa: los 6 agreements DRAFT a borrar tienen 0 referencias en
-- las 17 tablas con FK a agreements (probe 2026-07-06).
-- ============================================================

-- ── A. Despertar KPIs de la Mesa ─────────────────────────────────────────────

-- A1. Convocatorias con fecha_1 pasada → próximas fechas (KPI "Convocatorias
--     próximas" usa gte(fecha_1, hoy) SIN filtrar estado). Se mueven BORRADOR:
--     las EMITIDA son estructuralmente inmutables por diseño
--     (fn_convocatoria_immutable_guard — verificado: la 1ª versión de este pase
--     intentó tocar EMITIDA y el guard abortó la transacción, correcto).
UPDATE convocatorias SET fecha_1 = '2026-07-09 09:00:00+00'
 WHERE id = '57573e04-f0db-4681-95e0-b2dfa9bee915' AND estado = 'BORRADOR';
UPDATE convocatorias SET fecha_1 = '2026-07-10 08:00:00+00'
 WHERE id = 'c43754dc-e496-4c17-8516-aac82b3ea9fd' AND estado = 'BORRADOR';
UPDATE convocatorias SET fecha_1 = '2026-07-14 12:00:00+00'
 WHERE id = '5d099bc6-ef09-4fe4-bb93-456cd44a6961' AND estado = 'BORRADOR';

-- A2. Reuniones CONVOCADA vencidas sin celebrar → ventana próxima (KPI
--     "Reuniones (7d)"). 65f7223b es la reunión de la convocatoria 759a7026
--     (fechas alineadas para coherencia convocatoria↔reunión).
UPDATE meetings SET scheduled_start = '2026-07-09 08:00:00+00'
 WHERE id = '65f7223b-5a04-43ce-8110-fdd38af1d2cb' AND status = 'CONVOCADA';
UPDATE meetings SET scheduled_start = '2026-07-08 09:00:00+00'
 WHERE id = '9f76aa9b-4181-4d88-af4d-2798b87ecc47' AND status = 'CONVOCADA';

-- A3. cda-17-12-2026 figuraba CELEBRADA con fecha futura y sin acta →
--     CONVOCADA (coherente con "Próximos hitos").
UPDATE meetings SET status = 'CONVOCADA'
 WHERE id = 'f1750699-ba1b-4ce5-8889-153005690e76' AND status = 'CELEBRADA';

-- A4. Tracker de unanimidad demostrable: reabrir una votación sin sesión con
--     deadline futuro (fn_cerrar_votaciones_vencidas no toca deadlines futuros).
--     De paso se normaliza el título (estaba en mayúsculas).
UPDATE no_session_resolutions
   SET status = 'VOTING_OPEN',
       voting_deadline = '2026-07-16 21:59:00+00',
       title = 'Nombramiento de Director Financiero'
 WHERE id = 'e2ddb2f9-8717-4ae1-a51b-046237320958';

-- A5. Libros con plazo de legalización vencido hace 2 meses → plazo próximo
--     (la alerta "Legalización próxima" vuelve a ser creíble).
--     legalization_deadline es columna de ciclo protegida por
--     fn_mandatory_books_lifecycle_guard; se usa su session-flag sancionado
--     (el mismo que emplean las RPCs fn_libro_*), transaction-local.
SELECT set_config('app.libro_lifecycle_rpc', '1', true);
UPDATE mandatory_books SET legalization_deadline = '2026-07-26'
 WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
   AND legalization_deadline = '2026-04-30';

-- ── B. Tramitador registral: poblar las 3 vistas vacías ──────────────────────

-- B1. PREPARADA (token interno DEMO_PREPARACION_REGISTRAL visible) → estados
--     reales del flujo. EN_TRAMITE aún sin número de asiento.
UPDATE registry_filings
   SET status = 'EN_TRAMITE', filing_via = 'ELECTRONICA', filing_number = NULL
 WHERE id = '0bf9409c-216e-508e-ae22-e62353d69fcc' AND status = 'PREPARADA';
UPDATE registry_filings
   SET status = 'PRESENTADA', filing_via = 'ELECTRONICA', filing_number = 'AP 2026/05417'
 WHERE id = 'cea0b139-46e6-5c81-b9ef-5b9159fa5c7f' AND status = 'PREPARADA';

-- B2. DENEGADA no aparece en ninguna de las 4 vistas de la lista → SUBSANACION
--     (hace visible el flujo de subsanación, conserva vía y número).
UPDATE registry_filings SET status = 'SUBSANACION'
 WHERE id = 'ad6718b1-fdea-40dd-87eb-345938f2060b' AND status = 'DENEGADA';

-- B3. Las 2 INSCRITA sin número de inscripción mostraban vacío.
UPDATE registry_filings SET filing_number = 'RM-2026-MAD-2847'
 WHERE id = '03a26f8e-885e-4e76-b27f-d1aa8d4cd47c' AND filing_number IS NULL;
UPDATE registry_filings SET filing_number = 'RM-2026-MAD-3110'
 WHERE id = '486b9f21-e76e-46fa-b0ff-5d600f49cf7e' AND filing_number IS NULL;

-- ── C. Higiene de datos visibles ─────────────────────────────────────────────

-- C1. Personas fixture E2E huérfanas ("… Arga Test", 0 condiciones, 0 holdings;
--     su entidad E2E fue purgada). data_class='TEST' las oculta en todos los
--     read-paths vía applyVisibleDataClass (patrón W3).
UPDATE persons SET data_class = 'TEST'
 WHERE id IN ('089df45d-2d08-42ad-88aa-343b89449711',
              'afdbd2e2-8bae-4fbc-986b-b11d78ae751e',
              '12e96943-ab96-436e-aab3-b1162b718cac');

-- C2. Decisiones unipersonales triplicadas (misma campaña ejecutada 3 veces el
--     2026-04-26 a las 11:19/11:24/11:27). Se conserva la tanda más reciente
--     (11:27) por sociedad y se eliminan las 6 anteriores + sus 6 agreements
--     DRAFT (0 referencias verificadas en las 17 tablas con FK a agreements).
DELETE FROM agreements
 WHERE status = 'DRAFT'
   AND id IN ('d1427b1a-9126-40e7-9279-7047aaca6e48',  -- BR 11:19
              '333e6c6d-2082-4da2-9fa8-54e6c2e66caf',  -- BR 11:24
              '969b7b6f-7a70-43fa-8a02-0b74c0fa32cf',  -- MX 11:20
              'c5bb62d9-b19c-4cb3-9804-40b891e32cc3',  -- MX 11:24
              '72b56e8c-d952-45eb-9aca-39df0930879d',  -- PT 11:20
              '92d4ec3c-7c4f-4561-8832-668c1971fccc'); -- PT 11:24

DELETE FROM unipersonal_decisions ud
 WHERE ud.status = 'BORRADOR'
   AND ud.id IN ('3be2a6fc-b03b-4514-b6fa-c4e37e73a0a6',
                 '453ad396-94e7-4de9-bfc2-50a1849700ad',
                 '6c3d3c43-c96d-4c90-b7c5-bf747a2aee31',
                 '7bce98d7-20f4-4861-8f99-fde72e30f38b',
                 '245eb3fa-05f1-4176-9687-bbbd3ca54aab',
                 'a350ecc3-1df6-4adb-a99e-8c0b93cf2f4b')
   AND NOT EXISTS (SELECT 1 FROM agreements a WHERE a.unipersonal_decision_id = ud.id);

-- C3. Sociedades BR/MX/PT duplicadas: se conserva la ficha rica (legacy
--     00000000-…-030/031/032: 2 órganos y 3 acuerdos cada una) y se ocultan
--     las fichas pobres creadas después (1 órgano, sin acuerdos) vía
--     data_class='TEST'. Reversible con un UPDATE si se prefiere la otra fila.
UPDATE entities SET data_class = 'TEST'
 WHERE id IN ('cfe95727-3d53-47c4-817f-47b02a55dc60',   -- ARGA Brasil (nueva)
              '4380ea0a-0a21-4d26-8c09-eaeb74dd5afc',   -- ARGA México (nueva)
              'b5954033-d3b2-41a7-9b5c-7999d96bbf52');  -- ARGA Portugal (nueva)
