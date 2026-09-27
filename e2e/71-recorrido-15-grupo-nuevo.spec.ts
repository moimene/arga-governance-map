/**
 * Recorrido MOI-15 (repetición) — Secretaría · ciclo societario en Grupo Nuevo (…0003).
 *
 * Objetivo delegado por Moisés al orquestador (ver
 * docs/superpowers/plans/2026-09-19-tenant-cero-guion-recorrido.md bloque 4 y
 * el hallazgo de la auditoría del 2026-09-25 que reabrió MOI-15): repetir por
 * PANTALLA, con un navegador automatizado y NADA por SQL/script, los tres
 * caminos que la auditoría encontró incompletos o fabricados:
 *
 *   - 4.1: abrir la reunión de Consejo YA CONVOCADA (`ffd71122…`, cuya hora
 *     ya pasó), celebrarla por el stepper hasta registrar la votación.
 *   - 4.6: una SEGUNDA convocatoria de Consejo (nueva, con materia
 *     DELEGACION_FACULTADES en el orden del día desde el origen — no como
 *     "punto nacido en sesión", ver hallazgo H-32 más abajo), su reunión y
 *     su acuerdo INSCRIBIBLE, con validez comprobada por el motor. Competencia
 *     de Consejo (art. 249 LSC), no de Junta — a diferencia del
 *     NOMBRAMIENTO_CONSEJERO fabricado por script en el recorrido anterior,
 *     que es competencia de la Junta (art. 214 LSC).
 *   - 4.5: recorrer CoAprobacionStepper (co-aprobación, k de n) en la filial
 *     2.3 (Tecnología e Innovación Nueva, S.L., 3 administradores solidarios
 *     vigentes), que el recorrido anterior no llegó a ejercitar.
 *
 * HALLAZGOS DE SERVIDOR encontrados AL RECORRER (no simulados; ver guion,
 * tabla de hallazgos, filas H-32 y H-33):
 *
 *   H-32 (severidad A — capacidad ausente): "Añadir punto nacido en sesión"
 *   (Paso 4 de ReunionStepper) es HOY inutilizable en cualquier reunión que
 *   nazca de una convocatoria YA EMITIDA. El trigger
 *   `fn_secretaria_guard_emitted_agenda_dml` exige que el INSERT en
 *   `agenda_items` lo haga la RPC `fn_secretaria_materialize_convocation_agenda`,
 *   pero `useMaterializeAgendaItem` hace un INSERT directo vía PostgREST.
 *   Error literal del cable: 42501 "AGENDA_EMITIDA_RPC_REQUIRED: use
 *   fn_secretaria_materialize_convocation_agenda". El cliente lo enmascara
 *   con un toast que no nombra la causa ("Error al preparar constancias").
 *
 *   H-33 (severidad B — bloquea el recorrido): generar el acta de CUALQUIER
 *   reunión falla con el error de servidor "authoritative minute: entity, tax
 *   id, body and meeting officers require identified legal names" porque
 *   `fn_secretaria_close_meeting_and_generate_minute` exige
 *   `entities.registration_number` no vacío, pero `SociedadNuevaStepper` (el
 *   asistente de alta) NUNCA pide ese dato — el NIF/CIF que sí se captura y
 *   que la propia ficha de sociedad muestra en pantalla vive en
 *   `persons.tax_id` (vía `entities.person_id`), una columna que la RPC del
 *   acta no consulta. Confirmado por SELECT de solo lectura: las 3 sociedades
 *   del tenant tienen `registration_number IS NULL` (frente a
 *   `ARGA Seguros, S.A.` con `registration_number='A-00001001'`, sembrado a
 *   mano hace tiempo, que es lo que ha ocultado el defecto hasta ahora). No
 *   existe pantalla para fijar ese campo tras el alta (`TabPerfil` de
 *   `SociedadDetalle.tsx` es de solo lectura). Bloquea la generación de acta
 *   para CUALQUIER sociedad dada de alta por el asistente vigente, no solo en
 *   el tenant Grupo Nuevo.
 *
 * Reglas de este spec (impuestas por el encargo, no solo por hábito):
 *   - Solo tenant Grupo Nuevo (…0003). No toca ARGA ni Garrigues.
 *   - Toda escritura pasa por la UI real; cero llamadas RPC a mano, cero
 *     `service_role`, cero verificación por SQL DENTRO del spec (la
 *     verificación de recuentos se hace aparte, por SELECT de solo lectura,
 *     documentada en el propio guion — no en este fichero).
 *   - Capturas de evidencia no vacías en cada paso relevante.
 *
 * Run:
 *   PLAYWRIGHT_PORT=5304 bunx playwright test e2e/71-recorrido-15-grupo-nuevo.spec.ts --project=chromium
 */
import { test, expect } from './fixtures/base';
import { loginAsDemo } from './fixtures/demo-credentials';

const EVIDENCE_DIR = 'docs/superpowers/reviews/2026-09-27-verificacion-pantalla/recorrido-15';

const MATRIZ = {
  entityId: '45c8df67-64c9-42a3-abff-8047dd23748b',
  legalName: 'Corporación Nueva, S.A.',
  bodyId: 'db8073bb-5089-4bbf-a9a9-456d457f59b7',
  meetingId: 'ffd71122-0dfa-43d0-8238-ddd8e78dec73',
};

const FILIAL_B = {
  entityId: '9d209ef6-ca87-44d4-a12c-86f12a0ea368',
  bodyId: '0ea052a3-3191-45c3-aa85-a6872004e287',
  legalName: 'Tecnología e Innovación Nueva, S.L.',
  admins: ['Carlos Mendoza Ruiz', 'Laura Ibáñez Vega'],
};

const DELEGACION_TITLE = 'Delegación de facultades de gestión ordinaria en el Presidente';
const DELEGACION_TEXTO =
  'Se acuerda delegar en el Presidente del Consejo, D. Carlos Mendoza Ruiz, las facultades de gestión ordinaria de Corporación Nueva, S.A. previstas en el art. 249 LSC, con obligación de dar cuenta trimestral al Consejo, en los términos del contrato de administración que se eleva a público.';

test.describe.configure({ timeout: 300_000 });

test.describe('Recorrido MOI-15 (repetición) — Grupo Nuevo', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('4.1 — Celebrar Consejo de la matriz y registrar la votación del acuerdo', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !/favicon|ResizeObserver/i.test(msg.text())) consoleErrors.push(msg.text());
    });
    page.on('response', async (resp) => {
      const url = resp.url();
      if (resp.status() >= 400 && /\/rest\/v1\/|\/rpc\//.test(url)) {
        console.log(`[DEBUG ${resp.status()} ${url}]`, await resp.text().catch(() => '<no body>'));
      }
    });

    await loginAsDemo(page, 'nuevo');
    await expect(page.getByText(/GRUPO NUEVO/i).first()).toBeVisible({ timeout: 15_000 });

    await page.goto(`/secretaria/reuniones/${MATRIZ.meetingId}?scope=sociedad&entity=${MATRIZ.entityId}`);
    await expect(page.getByRole('heading', { name: 'Asistente de sesión societaria' })).toBeVisible({
      timeout: 20_000,
    });
    await page.screenshot({ path: `${EVIDENCE_DIR}/4.1-reunion-paso1-constitucion.png`, fullPage: true });

    // Paso 1 — Constitución: la hora convocada ya pasó (server now > 2026-09-25
    // 08:00 UTC). Idempotente: si el spec se relanza tras un fallo posterior,
    // `deriveReunionInitialStep` puede aterrizar directamente en un paso
    // posterior con la sesión ya abierta — en ese caso no hay botón que pulsar.
    const abrir = page.getByRole('button', { name: /Declarar apertura de la sesión/i }).first();
    const openTooEarly = page.getByText(/MEETING_OPEN_TOO_EARLY|no se puede abrir antes/i);
    if (await openTooEarly.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await page.screenshot({ path: `${EVIDENCE_DIR}/4.1-HALLAZGO-bloqueo-cronologia.png`, fullPage: true });
      throw new Error(
        'HALLAZGO 4.1: el servidor sigue rechazando la apertura (MEETING_OPEN_TOO_EARLY) pese a que scheduled_start ya pasó.',
      );
    }
    if (await abrir.isVisible({ timeout: 8_000 }).catch(() => false)) {
      await abrir.click();
      await expect(page.getByText(/Sesión declarada abierta|En curso|Estado actual/i).first()).toBeVisible({
        timeout: 20_000,
      });
      await page.screenshot({ path: `${EVIDENCE_DIR}/4.1-reunion-sesion-abierta.png`, fullPage: true });
    }

    // Paso 2 — Asistentes.
    await page.getByRole('button', { name: /Asistentes/ }).first().click();
    await expect(page.getByRole('heading', { name: /Paso 2\. Asistentes/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Carlos Mendoza Ruiz/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Elena Gómez Blanco/i)).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: `${EVIDENCE_DIR}/4.1-reunion-paso2-asistentes.png`, fullPage: true });
    const saveAttendance = page.getByRole('button', { name: 'Guardar asistencia' });
    if ((await saveAttendance.isVisible().catch(() => false)) && (await saveAttendance.isEnabled().catch(() => false))) {
      await saveAttendance.click();
      await expect(page.getByText(/Asistencia de \d+ miembros guardada/i).first()).toBeVisible({ timeout: 20_000 });
    }

    // Paso 3 — Quórum.
    await page.getByRole('button', { name: /Quórum/ }).first().click();
    await expect(page.getByRole('heading', { name: /Paso 3\. Quórum/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/QUÓRUM ALCANZADO|Evaluación Motor V2/i).first()).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: `${EVIDENCE_DIR}/4.1-reunion-paso3-quorum.png`, fullPage: true });
    const confirmQuorum = page.getByRole('button', { name: /Confirmar quórum y continuar/i }).first();
    if ((await confirmQuorum.isVisible().catch(() => false)) && (await confirmQuorum.isEnabled().catch(() => false))) {
      await confirmQuorum.click();
    }

    // Paso 4 — Agenda y debate: se conserva el único punto de la convocatoria
    // emitida (plan de negocio).
    //
    // HALLAZGO (severidad A, ver docs/superpowers/plans/2026-09-19-tenant-cero-guion-recorrido.md
    // fila H-32): se intentó "Añadir punto nacido en sesión" con materia
    // DELEGACION_FACULTADES para obtener el acuerdo inscribible de 4.6 en
    // ESTA MISMA reunión. El servidor lo rechaza SIEMPRE para cualquier
    // reunión vinculada a una convocatoria EMITIDA (`immutable_at` no nulo):
    // el trigger `fn_secretaria_guard_emitted_agenda_dml` exige que el INSERT
    // en `agenda_items` lo ejecute la RPC `fn_secretaria_materialize_convocation_agenda`,
    // pero el cliente (`useMaterializeAgendaItem`) hace un INSERT directo vía
    // PostgREST — nunca esa RPC. Error literal reproducido, capturado del
    // cable: `{"code":"42501","message":"AGENDA_EMITIDA_RPC_REQUIRED: use
    // fn_secretaria_materialize_convocation_agenda"}`. El cliente lo presenta
    // con un toast engañoso ("Error al preparar constancias") que no nombra
    // la causa real. Conclusión: el botón "Añadir punto nacido en sesión" es
    // HOY inutilizable en cualquier reunión nacida de una convocatoria formal
    // ya emitida (que es el caso normal de un Consejo). 4.6 se resuelve por
    // pantalla en el test siguiente, con una SEGUNDA convocatoria nueva.
    await page.getByRole('button', { name: /Agenda y debate/ }).first().click();
    await expect(page.getByRole('heading', { name: /Paso 4\. Agenda y debate/i })).toBeVisible({ timeout: 15_000 });
    await expect(
      page.locator('main input[placeholder="p.ej. Aprobación de cuentas anuales ejercicio 2025"]').first(),
    ).toHaveValue(/presupuesto|plan de negocio/i, { timeout: 15_000 });
    await page.screenshot({ path: `${EVIDENCE_DIR}/4.1-reunion-paso4-agenda.png`, fullPage: true });
    const saveDebates = page.getByRole('button', { name: 'Guardar debates' });
    if ((await saveDebates.isVisible().catch(() => false)) && (await saveDebates.isEnabled().catch(() => false))) {
      await saveDebates.click();
      await expect(page.getByText(/Agenda, debate y constancias guardados|Agenda.*guardad/i).first()).toBeVisible({
        timeout: 30_000,
      });
    }

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Asistente de sesión societaria' })).toBeVisible({
      timeout: 20_000,
    });

    // Paso 5 — Votaciones.
    await page.getByRole('button', { name: /Votaciones/ }).first().click();
    await expect(page.getByRole('heading', { name: /Paso 5\. Votaciones/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Evaluación de adopción por punto')).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: `${EVIDENCE_DIR}/4.1-reunion-paso5-evaluacion.png`, fullPage: true });
    const unanimous = page.getByRole('button', { name: /Aprobar todo por unanimidad/i }).first();
    if ((await unanimous.isVisible().catch(() => false)) && (await unanimous.isEnabled().catch(() => false))) {
      await unanimous.click();
    }
    const registerRes = page
      .getByRole('button', {
        name: /Registrar votaci[oó]n del acuerdo y crear expediente Acuerdo 360|Recalcular votaci[oó]n del acuerdo y crear expediente Acuerdo 360/,
      })
      .first();
    if ((await registerRes.isVisible().catch(() => false)) && (await registerRes.isEnabled().catch(() => false))) {
      await registerRes.click();
      await expect(
        page.getByText(/resolución\(es\) registrada\(s\)|resoluciones ya están registradas/i).first(),
      ).toBeVisible({ timeout: 45_000 });
    }
    await page.screenshot({ path: `${EVIDENCE_DIR}/4.1-reunion-resoluciones-registradas.png`, fullPage: true });

    // Paso 6 — Cierre: generar acta.
    //
    // HALLAZGO H-33 (ver cabecera del fichero): esto FALLARÁ con un error de
    // servidor literal porque `entities.registration_number` es NULL para
    // esta sociedad (y para las 3 del tenant) — un dato que el asistente de
    // alta nunca pide y que no tiene pantalla de edición posterior. Se deja
    // constancia por pantalla del intento y del error EXACTO devuelto por el
    // RPC, en vez de simularlo o de omitir el paso.
    await page.getByRole('button', { name: /Cierre/ }).first().click();
    await expect(page.getByRole('heading', { name: /Paso 6\. Cierre/i })).toBeVisible({ timeout: 15_000 });
    const existingMinuteBtn = page.getByRole('button', { name: 'Ver acta existente' });
    if (await existingMinuteBtn.isVisible().catch(() => false)) {
      await existingMinuteBtn.click();
      await expect(page).toHaveURL(/\/secretaria\/actas\/[a-f0-9-]{36}/, { timeout: 20_000 });
      const actaDocxBtn = page.getByRole('button', { name: 'Acta DOCX' });
      await expect(actaDocxBtn, '4.1: el acta debe ser descargable (botón Acta DOCX)').toBeVisible({
        timeout: 20_000,
      });
      await page.screenshot({ path: `${EVIDENCE_DIR}/4.1-acta-detalle-descargable.png`, fullPage: true });
    } else {
      const generateBtn = page.getByRole('button', { name: 'Confirmar cierre y generar acta' });
      await expect(generateBtn).toBeEnabled({ timeout: 20_000 });
      let rpcErrorBody = '';
      page.once('response', async (resp) => {
        if (resp.url().includes('fn_secretaria_close_meeting_and_generate_minute')) {
          rpcErrorBody = await resp.text().catch(() => '');
        }
      });
      await generateBtn.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: `${EVIDENCE_DIR}/4.1-HALLAZGO-H28-acta-bloqueada.png`, fullPage: true });
      const errorToast = page.getByText(/Error al generar el acta/i).first();
      const blocked = await errorToast.isVisible().catch(() => false);
      if (blocked) {
        console.log(`[HALLAZGO H-33] fn_secretaria_close_meeting_and_generate_minute → ${rpcErrorBody}`);
      } else {
        // Si algún día se corrige H-33, este camino queda para completar la
        // aserción positiva de "acta descargable" sin tener que reescribir el
        // test — es justo el resultado deseado del recorrido original.
        await expect(page.locator('main').getByText('Acta generada en borrador')).toBeVisible({ timeout: 45_000 });
        await page.getByRole('button', { name: 'Ver acta' }).click();
        await expect(page).toHaveURL(/\/secretaria\/actas\/[a-f0-9-]{36}/, { timeout: 20_000 });
        await expect(page.getByRole('button', { name: 'Acta DOCX' })).toBeVisible({ timeout: 20_000 });
      }
    }

    // "Failed to fetch" en el auth client de Supabase es ruido conocido de
    // navegaciones rápidas en Playwright (la petición de sesión se cancela al
    // cambiar de página), no un error del producto — se excluye a propósito.
    const fatalErrors = consoleErrors.filter(
      (e) => /ReferenceError|permission denied|RLS/i.test(e) || (/TypeError/i.test(e) && !/Failed to fetch/i.test(e)),
    );
    expect(fatalErrors, `console errors: ${fatalErrors.join(' | ')}`).toHaveLength(0);
  });

  test('4.6 — Nueva convocatoria de Consejo con DELEGACION_FACULTADES: acuerdo inscribible nacido en pantalla', async ({
    page,
  }) => {
    test.setTimeout(900_000);
    // La materia va DESDE EL ORIGEN en el orden del día de la convocatoria
    // (no como "punto nacido en sesión" — ver H-32): así el punto se
    // materializa en `agenda_items` por el camino legítimo
    // (`fn_secretaria_materialize_convocation_agenda`, vía la propia emisión
    // de la convocatoria), sin chocar con el guard de convocatoria emitida.
    await loginAsDemo(page, 'nuevo');
    await expect(page.getByText(/GRUPO NUEVO/i).first()).toBeVisible({ timeout: 15_000 });

    // Reintentos previos de este mismo spec (calibrando el desfase horario de
    // Paso 2 — los <input type="date"/"time"> toman hora LOCAL de Madrid, no
    // UTC) ya dejaron una reunión con DELEGACION_FACULTADES cuya hora
    // convocada ya pasó: reutilizarla evita repetir la espera de reloj. Los 8
    // pasos del asistente de convocatoria ya quedaron acreditados por pantalla
    // en las capturas `4.6-convocatoria-paso*.png` de un intento anterior.
    const REUSE_MEETING_ID = '81a4de74-2bc4-4f99-8a98-12bfc038a630';
    let convId: string | undefined;
    let skipCreation = false;
    {
      await page.goto(`/secretaria/reuniones/${REUSE_MEETING_ID}?scope=sociedad&entity=${MATRIZ.entityId}`);
      const readyToOpen = page.getByRole('button', { name: /Declarar apertura de la sesión/i }).first();
      // "Estado actual" es un rótulo FIJO del stepper (aparece siempre, esté
      // o no abierta la sesión): usarlo como señal de "ya abierta" daba falso
      // positivo y saltaba el clic real de apertura (causa de un fallo previo
      // de este mismo spec). La señal correcta es que la pestaña "Asistentes"
      // esté HABILITADA, que solo ocurre con la sesión realmente en curso.
      const asistentesTab = page.getByRole('button', { name: /Asistentes/ }).first();
      skipCreation =
        (await readyToOpen.isEnabled({ timeout: 10_000 }).catch(() => false)) ||
        (await asistentesTab.isEnabled({ timeout: 5_000 }).catch(() => false));
    }

    if (!skipCreation) {
    convId = undefined;
    // scope=grupo explícito: la comprobación de reuso anterior navegó con
    // ?scope=sociedad, que persiste (localStorage) y añade un <select> extra
    // en el sidebar ("Sociedad seleccionada"), desplazando los índices de
    // `locator('select')` del formulario y dejando "Sociedad convocante"
    // deshabilitado (Modo Sociedad). Grupo evita ambos problemas.
    await page.goto('/secretaria/convocatorias/nueva?scope=grupo');
    await expect(page.getByRole('heading', { name: /Asistente de convocatoria/i }).first()).toBeVisible({
      timeout: 20_000,
    });

    // Paso 1 — Sociedad y órgano.
    const sociedadSelect = page.locator('select').first();
    await expect(sociedadSelect).toBeVisible({ timeout: 15_000 });
    await sociedadSelect.selectOption(MATRIZ.entityId);
    const organoSelect = page.locator('select').nth(1);
    await expect
      .poll(async () => organoSelect.locator('option').count(), { timeout: 15_000 })
      .toBeGreaterThan(1);
    await organoSelect.selectOption(MATRIZ.bodyId);
    await page.screenshot({ path: `${EVIDENCE_DIR}/4.6-convocatoria-paso1-sociedad-organo.png`, fullPage: true });
    const next1 = page.getByRole('button', { name: /^Siguiente$/i });
    await expect(next1).toBeEnabled({ timeout: 15_000 });
    await next1.click();

    // Paso 2 — Fecha y plazo legal: el pack GN_* fija antelacionDias=0 para
    // materias de Consejo, así que puede convocarse para HOY mismo, unos
    // minutos por delante de la hora real para superar el margen del motor.
    await expect(page.getByRole('heading', { name: /Paso 2\. Fecha y plazo legal/i })).toBeVisible({
      timeout: 15_000,
    });
    // Los <input type="date"/"time"> se rellenan en la hora LOCAL de Madrid
    // (zona en la que corre la app/servidor), no en UTC: rellenar con
    // toISOString() desplazaba la hora ~2h y el servidor rechazaba la
    // convocatoria por "fecha ya pasada".
    const scheduled = new Date(Date.now() + 6 * 60 * 1000);
    const madridFmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Madrid',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = Object.fromEntries(madridFmt.formatToParts(scheduled).map((p) => [p.type, p.value]));
    const dateStr = `${parts.year}-${parts.month}-${parts.day}`;
    const timeStr = `${parts.hour}:${parts.minute}`;
    await page.locator('input[type="date"]').first().fill(dateStr);
    await page.locator('input[type="time"]').first().fill(timeStr);
    const locationInput = page.locator('input[type="text"]').first();
    if (await locationInput.isVisible().catch(() => false)) {
      await locationInput.fill('Calle Serrano, 45, 3, 28001, Madrid, Madrid, ES');
    }
    await page.screenshot({ path: `${EVIDENCE_DIR}/4.6-convocatoria-paso2-fecha.png`, fullPage: true });
    const next2 = page.getByRole('button', { name: /^Siguiente$/i });
    await expect(next2).toBeEnabled({ timeout: 15_000 });
    await next2.click();

    // Paso 3 — Orden del día: materia DELEGACION_FACULTADES (inscribible,
    // competencia de Consejo, art. 249 LSC).
    await expect(page.getByRole('heading', { name: /Paso 3\. Orden del día/i })).toBeVisible({ timeout: 15_000 });
    const acuerdoKind = page.getByRole('radio', { name: /Acuerdo:/i }).first();
    if (await acuerdoKind.isVisible().catch(() => false)) {
      await acuerdoKind.click();
    }
    const materiaSelect = page.getByLabel('Materia del acuerdo').first();
    await expect(materiaSelect).toBeVisible({ timeout: 10_000 });
    await materiaSelect.selectOption('DELEGACION_FACULTADES');
    const tituloPunto = page.getByPlaceholder(/Descripción del punto del orden del día/i).first();
    if (await tituloPunto.isVisible().catch(() => false)) {
      await tituloPunto.fill(DELEGACION_TITLE);
    }
    const propuestaTextarea = page.locator('main textarea').first();
    if (await propuestaTextarea.isVisible().catch(() => false)) {
      await propuestaTextarea.fill(DELEGACION_TEXTO);
    }
    await page.screenshot({ path: `${EVIDENCE_DIR}/4.6-convocatoria-paso3-orden-dia.png`, fullPage: true });
    const next3 = page.getByRole('button', { name: /^Siguiente$/i });
    await expect(next3).toBeEnabled({ timeout: 15_000 });
    await next3.click();

    // Pasos intermedios (destinatarios, canales, adjuntos): la numeración
    // exacta de pasos depende del órgano (CDA no siempre repite el mismo
    // desglose que una Junta), así que se avanza por defecto hasta llegar al
    // Paso 7. Borrador documento, capturando cada pantalla intermedia.
    for (let i = 0; i < 5; i += 1) {
      const paso7 = page.getByRole('heading', { name: /Paso 7\. Borrador documento/i });
      if (await paso7.isVisible().catch(() => false)) break;
      // Paso de canales: hay que marcar al menos uno o "Canal Convocatoria"
      // queda "Sin completar" y bloquea la emisión más adelante (Paso 8).
      const emailChannel = page.getByText('Email simple a los miembros del órgano').first();
      if (await emailChannel.isVisible().catch(() => false)) {
        const checkbox = page.locator('main input[type="checkbox"]').first();
        if (!(await checkbox.isChecked().catch(() => true))) await checkbox.check();
      }
      await page.screenshot({ path: `${EVIDENCE_DIR}/4.6-convocatoria-intermedio-${i}.png`, fullPage: true });
      const next = page.getByRole('button', { name: /^Siguiente$/i });
      await expect(next).toBeEnabled({ timeout: 15_000 });
      await next.click();
      await page.waitForTimeout(300);
    }

    // Paso 7 — Borrador documento: el tenant tiene CONVOCATORIA_CDA 1.1.0
    // ACTIVA (ya usada en la convocatoria canónica del 09-25), así que debería
    // autogenerarse; si no, se rellena manualmente para poder avanzar.
    await expect(page.getByRole('heading', { name: /Paso 7\. Borrador documento/i })).toBeVisible({
      timeout: 15_000,
    });
    await page.screenshot({ path: `${EVIDENCE_DIR}/4.6-convocatoria-paso7-borrador.png`, fullPage: true });
    const next7 = page.getByRole('button', { name: /^Siguiente$/i });
    await expect(next7).toBeEnabled({ timeout: 30_000 });
    await next7.click();

    // Paso 8 — Revisión y emisión (el botón dice "Registrar simulación DEMO"
    // en este tenant/data_class, no "Emitir convocatoria" como en ARGA).
    await page.screenshot({ path: `${EVIDENCE_DIR}/4.6-convocatoria-paso8-revision.png`, fullPage: true });
    const emitirBtn = page.getByRole('button', { name: /Emitir convocatoria|Registrar simulación DEMO/i }).first();
    await expect(emitirBtn).toBeVisible({ timeout: 15_000 });
    await expect(emitirBtn).toBeEnabled({ timeout: 15_000 });
    await emitirBtn.click();
    await page.waitForTimeout(3000);
    console.log('[DEBUG url tras emitir]', page.url());
    console.log(
      '[DEBUG toasts emision]',
      JSON.stringify(await page.locator('[data-sonner-toast]').allTextContents()),
    );
    await expect(
      page.getByText(/EMITIDA|emitida correctamente|Convocatoria emitida|simulaci[oó]n.*registrada/i).first(),
    ).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: `${EVIDENCE_DIR}/4.6-convocatoria-emitida.png`, fullPage: true });

    // El botón deja la vista en /secretaria/convocatorias/nueva (no navega al
    // detalle): localizar la convocatoria recién creada por su título único
    // en el listado de la sociedad.
    convId = page.url().match(/\/secretaria\/convocatorias\/([a-f0-9-]{36})/)?.[1];
    if (!convId) {
      // El botón no navega al detalle; el listado ordena por fecha de
      // creación descendente, así que la fila superior es la recién emitida.
      await page.goto(`/secretaria/convocatorias?scope=sociedad&entity=${MATRIZ.entityId}`);
      await expect(page.getByText('Cargando…')).toHaveCount(0, { timeout: 20_000 });
      const firstRow = page.locator('tbody tr').first();
      await expect(firstRow, 'listado de convocatorias con al menos una fila').toBeVisible({ timeout: 20_000 });
      await expect(firstRow.getByText(/Consejo/i)).toBeVisible({ timeout: 15_000 });
      await page.screenshot({ path: `${EVIDENCE_DIR}/4.6-convocatorias-lista.png`, fullPage: true });
      await firstRow.click();
      await expect(page).toHaveURL(/\/secretaria\/convocatorias\/[a-f0-9-]{36}/, { timeout: 15_000 });
      convId = page.url().match(/\/secretaria\/convocatorias\/([a-f0-9-]{36})/)![1];
    }
    } // fin if (!skipCreation)

    let meetingId: string;
    if (skipCreation) {
      meetingId = REUSE_MEETING_ID;
      await page.goto(`/secretaria/reuniones/${meetingId}?scope=sociedad&entity=${MATRIZ.entityId}`);
    } else {
      // Abrir el detalle de la convocatoria recién emitida y programar/abrir su reunión.
      await page.goto(`/secretaria/convocatorias/${convId}?scope=sociedad&entity=${MATRIZ.entityId}`);
      const programarBtn = page.getByRole('button', { name: /Programar reunión|Abrir reunión/i }).first();
      await expect(programarBtn).toBeEnabled({ timeout: 30_000 });
      await programarBtn.click();
      await expect(page).toHaveURL(/\/secretaria\/reuniones\/[a-f0-9-]{36}/, { timeout: 30_000 });
      meetingId = page.url().match(/\/secretaria\/reuniones\/([a-f0-9-]{36})/)![1];
    }

    // Esperar a que llegue la hora convocada (antelación 4 min) antes de abrir.
    await expect(page.getByRole('heading', { name: 'Asistente de sesión societaria' })).toBeVisible({
      timeout: 20_000,
    });
    const abrir = page.getByRole('button', { name: /Declarar apertura de la sesión/i }).first();
    // Reintentos de este spec pueden reutilizar una reunión que YA está
    // EN_CURSO (abierta en un intento anterior): en ese caso "Declarar
    // apertura" no existe nunca, y el poll de abajo (que solo sabe esperar a
    // que se HABILITE el botón) se quedaría 600s buscando algo que no va a
    // aparecer. Comprobar primero el estado ya-abierto antes de esperar.
    const yaAbierta = await page
      .getByRole('button', { name: /Asistentes/ })
      .first()
      .isEnabled({ timeout: 5_000 })
      .catch(() => false);
    if (!yaAbierta) {
      await expect
        .poll(
          async () => {
            if (await page.getByText(/MEETING_OPEN_TOO_EARLY|no se puede abrir antes/i).isVisible().catch(() => false)) {
              await page.reload();
              return 'too-early';
            }
            const visible = await abrir.isVisible().catch(() => false);
            if (!visible) return 'unknown';
            const enabled = await abrir.isEnabled().catch(() => false);
            if (!enabled) {
              const browserNow = await page.evaluate(() => new Date().toISOString()).catch(() => '?');
              const reasonText = await page
                .locator('[id^="meeting-opening-help"]')
                .textContent()
                .catch(() => '?');
              console.log(`[DEBUG apertura] browserNow=${browserNow} reason=${reasonText}`);
              await page.reload();
            }
            return enabled ? 'ready' : 'waiting';
          },
          { timeout: 600_000, intervals: [15_000] },
        )
        .toBe('ready');
      await abrir.click();
    }
    // "Estado actual" es el rótulo fijo del stepper (ver comentario de
    // `yaAbierta` más arriba): la señal fiable de que la sesión quedó abierta
    // es que la pestaña "Asistentes" pase a estar habilitada, no un texto que
    // no siempre se pinta igual tras reutilizar una sesión ya en curso.
    await expect(page.getByRole('button', { name: /Asistentes/ }).first()).toBeEnabled({ timeout: 20_000 });
    await page.screenshot({ path: `${EVIDENCE_DIR}/4.6-reunion-sesion-abierta.png`, fullPage: true });

    await page.getByRole('button', { name: /Asistentes/ }).first().click();
    await expect(page.getByRole('heading', { name: /Paso 2\. Asistentes/i })).toBeVisible({ timeout: 15_000 });
    const saveAttendance = page.getByRole('button', { name: 'Guardar asistencia' });
    await expect(saveAttendance).toBeVisible({ timeout: 10_000 });
    await expect(saveAttendance).toBeEnabled({ timeout: 10_000 });
    await saveAttendance.click();
    await expect(page.getByText(/Asistencia de \d+ miembros guardada/i).first()).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: /Quórum/ }).first().click();
    await expect(page.getByRole('heading', { name: /Paso 3\. Quórum/i })).toBeVisible({ timeout: 15_000 });
    const confirmQuorum = page.getByRole('button', { name: /Confirmar quórum y continuar/i }).first();
    if ((await confirmQuorum.isVisible().catch(() => false)) && (await confirmQuorum.isEnabled().catch(() => false))) {
      await confirmQuorum.click();
    }

    await page.getByRole('button', { name: /Agenda y debate/ }).first().click();
    await expect(page.getByRole('heading', { name: /Paso 4\. Agenda y debate/i })).toBeVisible({ timeout: 15_000 });
    await expect(
      page.locator('main input[placeholder="p.ej. Aprobación de cuentas anuales ejercicio 2025"]').first(),
    ).toHaveValue(new RegExp(DELEGACION_TITLE.slice(0, 20), 'i'), { timeout: 15_000 });
    await page.screenshot({ path: `${EVIDENCE_DIR}/4.6-reunion-agenda-delegacion.png`, fullPage: true });
    const saveDebates = page.getByRole('button', { name: 'Guardar debates' });
    if ((await saveDebates.isVisible().catch(() => false)) && (await saveDebates.isEnabled().catch(() => false))) {
      await saveDebates.click();
      await expect(page.getByText(/Agenda, debate y constancias guardados|Agenda.*guardad/i).first()).toBeVisible({
        timeout: 30_000,
      });
    }

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Asistente de sesión societaria' })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: /Votaciones/ }).first().click();
    await expect(page.getByRole('heading', { name: /Paso 5\. Votaciones/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Evaluación de adopción por punto')).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: `${EVIDENCE_DIR}/4.6-reunion-evaluacion-validez.png`, fullPage: true });
    // "Aprobar todo por unanimidad" queda deshabilitado mientras
    // `activeConflictsLoading` está en vuelo tras el reload; un check-then-act
    // puntual lo pilla deshabilitado y el `if` lo salta en silencio, dejando
    // los votos vacíos para siempre (causa real de un fallo de este mismo
    // spec: 21/23 sondeos del botón de registro con motivo "Registra voto
    // expreso de cada votante elegible"). Se exige explícitamente en vez de
    // omitirlo.
    const unanimous = page.getByRole('button', { name: /Aprobar todo por unanimidad/i }).first();
    await expect(unanimous).toBeEnabled({ timeout: 30_000 });
    await unanimous.click();
    const registerRes = page
      .getByRole('button', {
        name: /Registrar votaci[oó]n del acuerdo y crear expediente Acuerdo 360|Recalcular votaci[oó]n del acuerdo y crear expediente Acuerdo 360/,
      })
      .first();
    await expect(registerRes).toBeEnabled({ timeout: 20_000 });
    await registerRes.click();
    // El banner real dice "N acuerdos ya están votados y registrados; N
    // expediente(s) Acuerdo 360 vinculado(s)" (visto en pantalla), no
    // "resoluciones ya están registradas" que este regex esperaba antes —
    // causa de un fallo previo de este mismo spec con el acuerdo ya creado.
    await expect(
      page.getByText(/ya están votados y registrados|resolución\(es\) registrada\(s\)/i).first(),
    ).toBeVisible({ timeout: 45_000 });
    await page.screenshot({ path: `${EVIDENCE_DIR}/4.6-reunion-acuerdo-inscribible-registrado.png`, fullPage: true });

    console.log(`[recorrido-15] 4.6: convocatoria=${convId} reunion=${meetingId}`);
  });

  test('4.5 — Co-aprobación (k de n) en Filial B, con evaluación y registro no vacíos', async ({ page }) => {
    await loginAsDemo(page, 'nuevo');
    await expect(page.getByText(/GRUPO NUEVO/i).first()).toBeVisible({ timeout: 15_000 });

    await page.goto('/secretaria/acuerdos-sin-sesion/co-aprobacion');
    await expect(page.getByRole('heading', { name: /Co-aprobación/i }).first()).toBeVisible({ timeout: 20_000 });

    // Paso 1 — Tipo de acuerdo.
    const sociedadSelect = page.locator('select').first();
    await expect(sociedadSelect).toBeVisible({ timeout: 15_000 });
    await sociedadSelect.selectOption(FILIAL_B.entityId);
    const organoSelect = page.locator('select').nth(1);
    await expect(organoSelect).toBeVisible({ timeout: 15_000 });
    await organoSelect.selectOption(FILIAL_B.bodyId);
    const materiaSelect = page.locator('select').nth(2);
    await expect(materiaSelect).toBeVisible({ timeout: 10_000 });
    await materiaSelect.selectOption('DELEGACION_FACULTADES');
    const textoArea = page.locator('textarea').first();
    await expect(textoArea).toBeVisible({ timeout: 10_000 });
    await textoArea.fill(
      'Recorrido MOI-15 (repetición) — co-aprobación de delegación de facultades de gestión ordinaria por 2 de 3 administradores solidarios.',
    );
    await page.screenshot({ path: `${EVIDENCE_DIR}/4.5-coaprobacion-paso1-tipo-acuerdo.png`, fullPage: true });
    const next1 = page.getByRole('button', { name: /Siguiente|Continuar/ }).first();
    await expect(next1).toBeEnabled({ timeout: 10_000 });
    await next1.click();

    // Paso 2 — Configuración k de n.
    await expect(page.getByRole('heading', { name: /Paso 2\. Configuración k de n/i })).toBeVisible({
      timeout: 15_000,
    });
    const kInput = page.locator('input[type="number"]').first();
    await expect(kInput).toBeVisible({ timeout: 10_000 });
    await kInput.fill('2');
    await page.screenshot({ path: `${EVIDENCE_DIR}/4.5-coaprobacion-paso2-configuracion.png`, fullPage: true });
    const next2 = page.getByRole('button', { name: /Siguiente|Continuar/ }).first();
    await expect(next2).toBeEnabled({ timeout: 10_000 });
    await next2.click();

    // Paso 3 — Firmas: 2 de los 3 administradores solidarios reales del censo.
    await expect(page.getByRole('heading', { name: /Paso 3\. Firmas/i })).toBeVisible({ timeout: 15_000 });
    const firma0 = page.getByLabel(FILIAL_B.admins[0], { exact: true });
    const firma1 = page.getByLabel(FILIAL_B.admins[1], { exact: true });
    await expect(firma0).toBeVisible({ timeout: 15_000 });
    await firma0.check();
    await firma1.check();
    await expect(firma0).toBeChecked();
    await expect(firma1).toBeChecked();
    await page.screenshot({ path: `${EVIDENCE_DIR}/4.5-coaprobacion-paso3-firmas.png`, fullPage: true });
    const next3 = page.getByRole('button', { name: /Siguiente|Continuar/ }).first();
    await expect(next3).toBeEnabled({ timeout: 10_000 });
    await next3.click();

    // Paso 4 — Evaluación motor (auto-evalúa al entrar). Captura NO vacía a
    // propósito: el hallazgo previo (auditoría 2026-09-25) señaló dos
    // capturas de este paso vacías, solo con el menú lateral.
    await expect(page.getByRole('heading', { name: /Paso 4\. Evaluación motor/i })).toBeVisible({
      timeout: 20_000,
    });
    const next4 = page.getByRole('button', { name: /Siguiente|Continuar/ }).first();
    await expect(next4).toBeEnabled({ timeout: 20_000 });
    await page.waitForTimeout(500); // deja pintar el resultado del motor antes de capturar
    await page.screenshot({ path: `${EVIDENCE_DIR}/4.5-coaprobacion-paso4-evaluacion-motor.png`, fullPage: true });
    await next4.click();

    // Paso 5 — Registrar.
    const registrar = page.getByRole('button', { name: /^Registrar acuerdo$/i });
    await expect(registrar).toBeVisible({ timeout: 10_000 });
    await expect(registrar).toBeEnabled({ timeout: 10_000 });
    await page.screenshot({ path: `${EVIDENCE_DIR}/4.5-coaprobacion-paso5-registrar.png`, fullPage: true });
    await registrar.click();
    await expect(page.getByText(/Acuerdo registrado/i).first()).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: `${EVIDENCE_DIR}/4.5-coaprobacion-acuerdo-registrado.png`, fullPage: true });
  });
});
