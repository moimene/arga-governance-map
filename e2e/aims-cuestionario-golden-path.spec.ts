import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { test, expect } from './fixtures/base';
import { fillLogin } from './fixtures/demo-credentials';

/**
 * AIMS · recorrido de extremo a extremo del cuestionario guiado (MOI-214).
 *
 * REPLANTEADO por decisión D-24 (delegación de Moisés, 2026-09-27) respecto al
 * issue original. El issue pedía correrlo contra Garrigues con limpieza total
 * («0 filas PROBE-E2E al terminar»). MOI-210/D-12 (`20260926121000_aims_ai_
 * systems_fk_restrict.sql`) pasó las 4 FK con valor probatorio hacia
 * `ai_systems` (cuestionario, secciones, versiones, indicadores) de CASCADE a
 * RESTRICT: un sistema dado de alta por el cuestionario ya no se puede borrar
 * en cascada, así que «0 filas al terminar» dejó de ser alcanzable sin dejar
 * huérfanos o sin ensuciar el dato de Garrigues con un DELETE fallido a medias.
 *
 * D-24 sustituye el objetivo por: correr contra el GRUPO NUEVO (tenant
 * …0003, entorno de pruebas con dos cuentas demo enlazadas a personas
 * distintas — `scripts/tenants/tenant-spec.ts`), sin intentar limpiar, y con
 * un TOPE declarado: si ya hay 10 o más sistemas `PROBE-E2E-%` en el tenant,
 * la prueba falla en vez de seguir acumulando residuo sin límite. El residuo
 * que deja cada corrida (1 `ai_systems`, 2 `aims_classification_
 * questionnaires` —v1 superseded + v2 vigente—, 9 `aims_technical_file_
 * sections`, 1 `aims_monitoring_indicators`) queda declarado aquí, no oculto.
 *
 * Desactivada por defecto: sólo corre con `E2E_ESCRIBE_GRUPO_NUEVO=1`, porque
 * escribe contra `governance_OS` en producción (mismo criterio que el guard de
 * `e2e/31-secretaria-destructive-guard.spec.ts`).
 *
 * Cubre lo que ningún otro e2e de AIMS cubre (contexto del issue, medido
 * 2026-09-24): alta por cuestionario, ficha con clasificación vigente,
 * reclasificación con motivación art. 6.3, una sección del expediente técnico,
 * un indicador de vigilancia, y apertura en LECTURA de una evaluación y de un
 * incidente ya existentes (sin tocar sus regímenes: `useAbrirSubexpedienteRegimen`
 * no se invoca).
 *
 * Guard de red: sólo las escrituras exactas del recorrido pueden salir; se
 * ancla también el tenant en el cable (URL para PATCH, cuerpo para POST). GET
 * y HEAD nunca se interceptan.
 */

const GRUPO_NUEVO_TENANT = '00000000-0000-0000-0000-000000000003';
const ARGA_TENANT = '00000000-0000-0000-0000-000000000001';
const GARRIGUES_TENANT = '00000000-0000-0000-0000-000000000002';

const NUEVO_DEMO_EMAIL = 'demo@grupo-nuevo-demo.dev';
const ARGA_DEMO_EMAIL = process.env.E2E_DEMO_EMAIL ?? 'demo@arga-seguros.com';
const GARRIGUES_DEMO_EMAIL = 'demo@garrigues-demo.dev';

/** Residuo acotado y declarado (D-24): por encima de esto, la prueba falla en vez de seguir acumulando. */
const TOPE_PROBES = 10;

const MARCA = `PROBE-E2E-${randomUUID()}`;

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/** Escrituras exactas que este recorrido puede producir. Cualquier otra hace fallar la prueba. */
const ESCRITURAS_PERMITIDAS: Array<{ method: string; path: RegExp }> = [
  { method: 'POST', path: /\/rest\/v1\/rpc\/fn_aims_registrar_sistema$/ },
  { method: 'POST', path: /\/rest\/v1\/aims_classification_questionnaires$/ },
  { method: 'PATCH', path: /\/rest\/v1\/aims_classification_questionnaires$/ },
  { method: 'POST', path: /\/rest\/v1\/rpc\/fn_aims_completar_cuestionario$/ },
  { method: 'POST', path: /\/rest\/v1\/aims_technical_file_sections$/ },
  { method: 'PATCH', path: /\/rest\/v1\/aims_technical_file_sections$/ },
  { method: 'POST', path: /\/rest\/v1\/aims_monitoring_indicators$/ },
];

const SUPABASE_URL_NODE = process.env.VITE_SUPABASE_URL || 'https://hzqwefkwsxopwrmtksbg.supabase.co';
const ANON_KEY_NODE = process.env.VITE_SUPABASE_ANON_KEY || process.env.ANON_PUBLIC || '';

/** Cliente Node por cuenta, con sesión propia (nunca imprime la contraseña). */
async function loginNode(email: string, password: string): Promise<SupabaseClient> {
  const cliente = createClient(SUPABASE_URL_NODE, ANON_KEY_NODE, { auth: { persistSession: false } });
  const { error } = await cliente.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`login Node (${email}) falló: ${error.message}`);
  return cliente;
}

async function contarPorTenant(cliente: SupabaseClient, tabla: 'ai_systems' | 'ai_incidents', tenantId: string, like?: string) {
  let q = cliente.from(tabla).select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId);
  if (like) q = q.ilike('name', like);
  const { count, error } = await q;
  if (error) throw new Error(`no se pudo contar ${tabla} (tenant ${tenantId}): ${error.message}`);
  return count ?? 0;
}

/** `ai_risk_assessments` no tiene `tenant_id` propio: el aislamiento va por el join a `ai_systems`. */
async function contarEvaluaciones(cliente: SupabaseClient, tenantId: string) {
  const { count, error } = await cliente
    .from('ai_risk_assessments')
    .select('id, ai_systems!inner(tenant_id)', { count: 'exact', head: true })
    .eq('ai_systems.tenant_id', tenantId);
  if (error) throw new Error(`no se pudo contar ai_risk_assessments (tenant ${tenantId}): ${error.message}`);
  return count ?? 0;
}

interface Foto {
  sistemasNuevo: number;
  probesNuevo: number;
  evaluacionesNuevo: number;
  incidentesNuevo: number;
  argaSistemas: number;
  argaEvaluaciones: number;
  argaIncidentes: number;
  garriguesSistemas: number;
  garriguesEvaluaciones: number;
  garriguesIncidentes: number;
}

async function tomarFoto(nodeNuevo: SupabaseClient, nodeArga: SupabaseClient, nodeGarrigues: SupabaseClient): Promise<Foto> {
  return {
    sistemasNuevo: await contarPorTenant(nodeNuevo, 'ai_systems', GRUPO_NUEVO_TENANT),
    probesNuevo: await contarPorTenant(nodeNuevo, 'ai_systems', GRUPO_NUEVO_TENANT, 'PROBE-E2E-%'),
    evaluacionesNuevo: await contarEvaluaciones(nodeNuevo, GRUPO_NUEVO_TENANT),
    incidentesNuevo: await contarPorTenant(nodeNuevo, 'ai_incidents', GRUPO_NUEVO_TENANT),
    argaSistemas: await contarPorTenant(nodeArga, 'ai_systems', ARGA_TENANT),
    argaEvaluaciones: await contarEvaluaciones(nodeArga, ARGA_TENANT),
    argaIncidentes: await contarPorTenant(nodeArga, 'ai_incidents', ARGA_TENANT),
    garriguesSistemas: await contarPorTenant(nodeGarrigues, 'ai_systems', GARRIGUES_TENANT),
    garriguesEvaluaciones: await contarEvaluaciones(nodeGarrigues, GARRIGUES_TENANT),
    garriguesIncidentes: await contarPorTenant(nodeGarrigues, 'ai_incidents', GARRIGUES_TENANT),
  };
}

test.describe('AIMS · cuestionario guiado — recorrido de extremo a extremo (grupo nuevo)', () => {
  test.skip(process.env.E2E_ESCRIBE_GRUPO_NUEVO !== '1', 'Escribe contra producción (grupo nuevo): opt-in con E2E_ESCRIBE_GRUPO_NUEVO=1');
  test.use({ storageState: { cookies: [], origins: [] } });

  let antes: Foto;
  let nodeNuevo: SupabaseClient;
  let nodeArga: SupabaseClient;
  let nodeGarrigues: SupabaseClient;

  test.beforeAll(async () => {
    const passNuevo = process.env.DEMO_PASSWORD_NUEVO;
    const passArga = process.env.DEMO_PASSWORD_ARGA;
    const passGarrigues = process.env.DEMO_PASSWORD_GARRIGUES;
    if (!passNuevo || !passArga || !passGarrigues) {
      throw new Error('Faltan DEMO_PASSWORD_NUEVO / DEMO_PASSWORD_ARGA / DEMO_PASSWORD_GARRIGUES en .env');
    }
    nodeNuevo = await loginNode(NUEVO_DEMO_EMAIL, passNuevo);
    nodeArga = await loginNode(ARGA_DEMO_EMAIL, passArga);
    nodeGarrigues = await loginNode(GARRIGUES_DEMO_EMAIL, passGarrigues);

    antes = await tomarFoto(nodeNuevo, nodeArga, nodeGarrigues);
    expect(
      antes.probesNuevo,
      `ya hay ${antes.probesNuevo} sistemas PROBE-E2E-% en el grupo nuevo: tope de ${TOPE_PROBES} alcanzado, no se ejecuta la prueba para no seguir acumulando residuo sin límite`,
    ).toBeLessThan(TOPE_PROBES);
  }, 60_000);

  test('alta por cuestionario, reclasificación art. 6.3, expediente, vigilancia y lectura de evaluación e incidente', async ({ page }) => {
    const escriturasNoPermitidas: string[] = [];
    const filtrosLeidos: Array<{ tabla: string; valor: string | null }> = [];

    await page.route('**/rest/v1/**', async (route) => {
      const req = route.request();
      const method = req.method();
      const url = new URL(req.url());

      if (!MUTATING_METHODS.has(method)) {
        await route.fallback();
        return;
      }

      const permitido = ESCRITURAS_PERMITIDAS.find((w) => w.method === method && w.path.test(url.pathname));
      if (!permitido) {
        escriturasNoPermitidas.push(`${method} ${url.pathname}${url.search} (fuera de la lista blanca)`);
        await route.abort();
        return;
      }

      if (method === 'PATCH') {
        if (url.searchParams.get('tenant_id') !== `eq.${GRUPO_NUEVO_TENANT}`) {
          escriturasNoPermitidas.push(`PATCH sin tenant del grupo nuevo en el cable: ${url.pathname}${url.search}`);
          await route.abort();
          return;
        }
      } else if (method === 'POST' && !url.pathname.includes('/rpc/')) {
        let cuerpo: unknown;
        try {
          cuerpo = JSON.parse(req.postData() || 'null');
        } catch {
          cuerpo = null;
        }
        const filas = Array.isArray(cuerpo) ? cuerpo : [cuerpo];
        const malas = filas.filter((f) => !f || (f as Record<string, unknown>).tenant_id !== GRUPO_NUEVO_TENANT);
        if (filas.length === 0 || malas.length > 0) {
          escriturasNoPermitidas.push(`POST sin tenant del grupo nuevo en el cuerpo: ${url.pathname}`);
          await route.abort();
          return;
        }
      }

      await route.fallback();
    });

    page.on('request', (req) => {
      const url = new URL(req.url());
      if (url.pathname === '/rest/v1/ai_systems') {
        filtrosLeidos.push({ tabla: 'ai_systems', valor: url.searchParams.get('tenant_id') });
      } else if (url.pathname === '/rest/v1/ai_incidents') {
        filtrosLeidos.push({ tabla: 'ai_incidents', valor: url.searchParams.get('tenant_id') });
      } else if (url.pathname === '/rest/v1/ai_risk_assessments') {
        filtrosLeidos.push({ tabla: 'ai_risk_assessments', valor: url.searchParams.get('ai_systems.tenant_id') });
      }
    });

    await fillLogin(page, 'nuevo', NUEVO_DEMO_EMAIL, process.env.DEMO_PASSWORD_NUEVO!);
    await page.waitForURL('/', { timeout: 20_000 });

    // --- 1. Alta por cuestionario: responsable del despliegue · riesgo limitado ---
    await page.goto('/ai-governance/sistemas/nuevo');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'Nuevo sistema IA' })).toBeVisible({ timeout: 15_000 });

    await page.getByLabel(/Nombre del sistema/).fill(MARCA);

    const responder = (indice: number, valor: boolean) =>
      page.getByRole('button', { name: valor ? 'Sí' : 'No', exact: true }).nth(indice).click();
    const continuar = () => page.getByRole('button', { name: 'Continuar', exact: true }).click();

    // Fase 1 (rol): Q1_1..Q1_3 = No (no crea, no modifica sustancialmente, no comercializa
    // con su marca) => RESPONSABLE_DESPLIEGUE. Q1_4 no determina el rol (complementaria).
    await responder(0, false); // Q1_1
    await responder(1, false); // Q1_2
    await responder(2, false); // Q1_3
    await responder(3, true); // Q1_4
    await continuar();

    // Fase 2 (riesgo): sin práctica prohibida, fuera del anexo III, interactúa con
    // personas (art. 50) => nivel Limitado, sin exigir todavía el art. 6.3.
    await responder(0, false); // Q2_1 — sin práctica prohibida
    await responder(1, false); // Q2_2 — fuera del anexo III
    await responder(2, true); // Q2_4 — interactúa con personas / genera contenido
    await responder(3, false); // Q2_5 — sin dependencia GPAI
    await continuar();

    // Fase 3 (marcos derivados): sólo lectura.
    await continuar();

    // Fase 4 (confirmación).
    await expect(page.getByText('Responsable del despliegue', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Limitado', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar clasificación', exact: true }).click();

    await expect(page.getByRole('button', { name: 'Registrar sistema' })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Registrar sistema' }).click();

    await expect(page).toHaveURL(/\/ai-governance\/sistemas\/[0-9a-f-]{36}$/, { timeout: 15_000 });
    const systemId = page.url().split('/').pop()!;
    await expect(page.getByRole('heading', { name: MARCA })).toBeVisible({ timeout: 10_000 });

    // --- 2. Ficha con la clasificación vigente ---
    await expect(page.getByText('Responsable del despliegue', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Limitado', { exact: true }).first()).toBeVisible();

    // --- 3. Reclasificación con motivación art. 6.3 ---
    await page.getByRole('button', { name: 'Nueva clasificación' }).click();
    // El wizard reabre en la fase 1, vacío (el DRAFT nace sin respuestas): se
    // espera a que las preguntas de la fase 1 estén listas antes de responder.
    await expect(page.getByRole('button', { name: 'No', exact: true }).first()).toBeVisible({ timeout: 10_000 });

    await responder(0, false); // Q1_1
    await responder(1, false); // Q1_2
    await responder(2, false); // Q1_3
    await responder(3, true); // Q1_4
    await continuar();

    await responder(0, false); // Q2_1 — sin práctica prohibida
    await responder(1, true); // Q2_2 — SÍ está en el anexo III (candidato a alto riesgo)
    await responder(2, true); // Q2_3 — invoca la excepción del art. 6.3
    await responder(3, true); // Q2_4 — interactúa con personas / genera contenido
    await responder(4, false); // Q2_5 — sin dependencia GPAI
    await continuar();
    await continuar(); // fase 3, sólo lectura

    await page
      .getByLabel(/Motivación de la evaluación/)
      .fill(
        'El sistema no elabora perfiles de personas físicas: apoya con información objetiva una revisión que siempre hace un profesional, sin producir por sí solo una decisión sobre la persona afectada (art. 6.3 RIA).',
      );
    await page.getByRole('button', { name: 'Confirmar nueva clasificación', exact: true }).click();

    await expect(page.getByText('Clasificación v2 registrada')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /Historial \(2\)/ })).toBeVisible();

    // --- 4. Una sección del expediente técnico ---
    await expect(page.getByRole('heading', { name: 'Estructura del Expediente Técnico (Anexo IV Reglamento UE)' })).toBeVisible();
    await page.getByRole('button', { name: 'Iniciar expediente técnico (anexo IV)' }).click();
    await expect(page.getByText('Esqueleto del anexo IV registrado: 9 secciones pendientes.')).toBeVisible({ timeout: 10_000 });

    // Exacto: "Editar Ficha" (cabecera del sistema) también empieza por "Editar".
    await page.getByRole('button', { name: 'Editar', exact: true }).first().click();
    await page
      .getByLabel('Contenido de la sección')
      .fill('Descripción funcional registrada por la prueba automática MOI-214 (grupo nuevo).');
    await page.getByRole('button', { name: 'Guardar sección' }).click();
    await expect(page.getByText('Sección actualizada.')).toBeVisible({ timeout: 10_000 });

    // --- 5. Un indicador de vigilancia poscomercialización ---
    await page.getByRole('button', { name: /Vigilancia Poscomercialización/ }).click();
    await page.getByRole('button', { name: 'Registrar indicador' }).click();
    await page.getByLabel(/Nombre del indicador/).fill('Precisión observada — prueba MOI-214');
    await page.getByRole('button', { name: 'Registrar', exact: true }).click();
    await expect(page.getByText('Indicador registrado.')).toBeVisible({ timeout: 10_000 });

    // --- 6. Apertura en lectura de una evaluación existente ---
    await page.goto('/ai-governance/evaluaciones');
    await expect(page.getByRole('heading', { name: 'Autodiagnóstico de madurez' })).toBeVisible({ timeout: 15_000 });
    const filaEvaluacion = page.locator('tbody tr').first();
    await expect(filaEvaluacion).toBeVisible({ timeout: 15_000 });
    await filaEvaluacion.click();
    await expect(page).toHaveURL(/\/ai-governance\/evaluaciones\/[0-9a-f-]{36}$/, { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: 'Informe de autodiagnóstico de madurez' })).toBeVisible({ timeout: 10_000 });

    // --- 7. Apertura en lectura de un incidente existente (sin tocar sus regímenes) ---
    await page.goto('/ai-governance/incidentes');
    await expect(page.getByRole('heading', { name: 'Incidentes IA' })).toBeVisible({ timeout: 15_000 });
    const filaIncidente = page.locator('tbody tr').first();
    await expect(filaIncidente).toBeVisible({ timeout: 15_000 });
    await filaIncidente.click();
    await expect(page).toHaveURL(/\/ai-governance\/incidentes\/[0-9a-f-]{36}$/, { timeout: 10_000 });
    await expect(page.getByText('Regímenes potencialmente aplicables')).toBeVisible({ timeout: 10_000 });
    // Deliberadamente NO se pulsa «Abrir subexpediente»: la lectura no crea régimen.

    // --- Guard de red: ninguna escritura fuera de la lista blanca ---
    expect(escriturasNoPermitidas, 'este recorrido ha intentado una escritura fuera de la lista blanca declarada').toEqual([]);
    expect(filtrosLeidos.length, 'ninguna pantalla leyó ai_systems/ai_incidents/ai_risk_assessments: la aserción de tenant sería vacua').toBeGreaterThan(0);
    for (const f of filtrosLeidos) {
      expect(f.valor, `${f.tabla} se leyó sin el filtro de tenant del grupo nuevo en el cable`).toBe(`eq.${GRUPO_NUEVO_TENANT}`);
    }

    // --- Verificación final por SELECT: sólo cambia el grupo nuevo, y sólo lo declarado ---
    const despues = await tomarFoto(nodeNuevo, nodeArga, nodeGarrigues);
    expect(despues.sistemasNuevo - antes.sistemasNuevo, 'debía crearse exactamente 1 ai_systems en el grupo nuevo').toBe(1);
    expect(despues.probesNuevo - antes.probesNuevo).toBe(1);
    expect(despues.evaluacionesNuevo, 'no debía crearse ninguna evaluación nueva (sólo se abrió una existente en lectura)').toBe(antes.evaluacionesNuevo);
    expect(despues.incidentesNuevo, 'no debía crearse ningún incidente nuevo (sólo se abrió uno existente en lectura)').toBe(antes.incidentesNuevo);
    expect(despues.argaSistemas, 'ARGA no debía cambiar').toBe(antes.argaSistemas);
    expect(despues.argaEvaluaciones, 'ARGA no debía cambiar').toBe(antes.argaEvaluaciones);
    expect(despues.argaIncidentes, 'ARGA no debía cambiar').toBe(antes.argaIncidentes);
    expect(despues.garriguesSistemas, 'Garrigues no debía cambiar').toBe(antes.garriguesSistemas);
    expect(despues.garriguesEvaluaciones, 'Garrigues no debía cambiar').toBe(antes.garriguesEvaluaciones);
    expect(despues.garriguesIncidentes, 'Garrigues no debía cambiar').toBe(antes.garriguesIncidentes);
    expect(despues.probesNuevo, `residuo PROBE-E2E-% del grupo nuevo por encima del tope de ${TOPE_PROBES} (declarado, D-24; sin limpieza posible por MOI-210/D-12)`).toBeLessThan(TOPE_PROBES + 1);

    console.log(
      `[MOI-214] sistema=${systemId} marca=${MARCA} probes_grupo_nuevo=${despues.probesNuevo}/${TOPE_PROBES}`,
    );
  });
});
