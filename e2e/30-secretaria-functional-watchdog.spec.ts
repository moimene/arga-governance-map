import { expect, test } from './fixtures/base';
import type { Locator, Page, Route } from '@playwright/test';

const CRITICAL_ROUTES = [
  { path: '/secretaria', heading: 'Mesa de trabajo del secretario' },
  { path: '/secretaria/acuerdos-sin-sesion', heading: 'Acuerdos escritos sin sesión' },
  { path: '/secretaria/acuerdos-sin-sesion/nuevo', heading: 'Asistente de acuerdo escrito sin sesión' },
  { path: '/secretaria/acuerdos-sin-sesion/co-aprobacion', heading: 'Asistente de acuerdo por co-aprobación (k de n)' },
  { path: '/secretaria/acuerdos-sin-sesion/solidario', heading: 'Asistente de acuerdo por administrador solidario' },
  { path: '/secretaria/tramitador', heading: 'Tramitaciones registrales' },
  { path: '/secretaria/plantillas', heading: 'Plantillas documentales protegidas' },
] as const;

const FATAL_UI_PATTERNS = [
  /ha ocurrido un error/i,
  /cannot read properties/i,
  /undefined is not/i,
  /failed to fetch dynamically imported module/i,
  /error al cargar/i,
  /application error/i,
];

const TEMPLATE_PARAM_ID = '00000000-0000-0000-0000-000000000000';
const FAKE_RESOLUTION_ID = '10000000-0000-4000-8000-000000000030';
const FAKE_AGREEMENT_ID = '10000000-0000-4000-8000-000000000031';
const FAKE_CERTIFICATION_ID = '10000000-0000-4000-8000-000000000033';
const FAKE_ENTITY_ID = '00000000-0000-0000-0000-000000000010';
const FAKE_BODY_ID = '00000000-0000-0000-0000-000000000020';
const FAKE_HOLDING_ID = '10000000-0000-4000-8000-000000000034';
const FAKE_SELLER_PERSON_ID = '10000000-0000-4000-8000-000000000035';
const FAKE_BUYER_PERSON_ID = '10000000-0000-4000-8000-000000000036';
const FAKE_TEMPLATE_DRAFT_ID = '10000000-0000-4000-8000-000000000037';

interface Diagnostics {
  pageErrors: string[];
  consoleErrors: string[];
  failedRequests: string[];
  failedSupabaseResponses: string[];
}

function attachDiagnostics(page: Page): Diagnostics {
  const diagnostics: Diagnostics = {
    pageErrors: [],
    consoleErrors: [],
    failedRequests: [],
    failedSupabaseResponses: [],
  };

  page.on('pageerror', (error) => {
    diagnostics.pageErrors.push(error.message);
  });
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (/favicon/i.test(text)) return;
    diagnostics.consoleErrors.push(text);
  });
  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText ?? 'unknown';
    if (failure === 'net::ERR_ABORTED') return;
    diagnostics.failedRequests.push(`${request.method()} ${request.url()} :: ${failure}`);
  });
  page.on('response', (response) => {
    const status = response.status();
    const url = response.url();
    if (status >= 400 && url.includes('supabase.co')) {
      diagnostics.failedSupabaseResponses.push(`${status} ${url}`);
    }
  });

  return diagnostics;
}

async function expectNoFatalUi(page: Page) {
  for (const pattern of FATAL_UI_PATTERNS) {
    await expect(page.locator('main').getByText(pattern)).toHaveCount(0);
  }
}

async function assertRouteHealthy(page: Page, diagnostics: Diagnostics, heading: string) {
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('main').getByRole('heading', { name: heading, exact: true })).toBeVisible({
    timeout: 10_000,
  });
  await expectNoFatalUi(page);

  const interactiveCount = await page.locator('main button, main a, main select, main input, main textarea, main table').count();
  expect(interactiveCount, `${heading} debe exponer alguna superficie interactiva real`).toBeGreaterThan(0);

  await expect.poll(
    () => page.evaluate(() => new Promise<string>((resolve) => requestAnimationFrame(() => resolve(document.readyState)))),
    { message: `${heading} no responde al event loop del navegador` },
  ).toBe('complete');

  expect(diagnostics.pageErrors, `${heading} no debe lanzar pageerror`).toEqual([]);
  expect(diagnostics.consoleErrors, `${heading} no debe escribir console.error`).toEqual([]);
  expect(diagnostics.failedRequests, `${heading} no debe tener requestfailed`).toEqual([]);
  expect(diagnostics.failedSupabaseResponses, `${heading} no debe disparar Supabase 4xx/5xx`).toEqual([]);
}

async function selectOptionByText(select: Locator, preferred: RegExp) {
  await expect.poll(async () => select.locator('option').count()).toBeGreaterThan(1);
  const value = await select.evaluate((node, source) => {
    const regex = new RegExp(source, 'i');
    const options = Array.from((node as HTMLSelectElement).options);
    return (
      options.find((option) => option.value && regex.test(option.textContent ?? ''))?.value ??
      options.find((option) => option.value)?.value ??
      ''
    );
  }, preferred.source);
  expect(value).toBeTruthy();
  await select.selectOption(value);
}

async function stubNoSessionCreation(page: Page, patch: Record<string, unknown> = {}) {
  await page.route(/\/rest\/v1\/no_session_resolutions.*/, async (route) => {
    const request = route.request();
    const url = request.url();
    const baseRow = {
      id: FAKE_RESOLUTION_ID,
      tenant_id: '00000000-0000-0000-0000-000000000001',
      body_id: FAKE_BODY_ID,
      entity_id: FAKE_ENTITY_ID,
      title: 'QA acuerdo sin sesión',
      status: 'VOTING_OPEN',
      proposal_text: 'Propuesta QA sin mutar Supabase.',
      matter_class: 'ORDINARIA',
      agreement_kind: 'APROBACION_CUENTAS',
      voting_deadline: '2026-05-10T10:00:00.000Z',
      votes_for: 0,
      votes_against: 0,
      abstentions: 0,
      requires_unanimity: false,
      total_members: 3,
      opened_at: '2026-05-04T10:00:00.000Z',
      closed_at: null,
      created_at: '2026-05-04T10:00:00.000Z',
      governing_bodies: {
        name: 'Consejo de Administración',
        body_type: 'CDA',
        entity_id: FAKE_ENTITY_ID,
        entities: {
          common_name: 'ARGA Seguros',
          jurisdiction: 'ES',
        },
      },
      ...patch,
    };

    if (request.method() === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: FAKE_RESOLUTION_ID }),
      });
      return;
    }

    if (request.method() === 'GET' && url.includes(`id=eq.${FAKE_RESOLUTION_ID}`)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(baseRow),
      });
      return;
    }

    await route.continue();
  });
}

async function stubLinkedNoSessionAgreement(page: Page, agreementId = FAKE_AGREEMENT_ID) {
  await page.route(/\/rest\/v1\/agreements.*/, async (route) => {
    const request = route.request();
    const url = request.url();
    if (request.method() === 'GET' && url.includes(`no_session_resolution_id=eq.${FAKE_RESOLUTION_ID}`)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: agreementId,
          status: 'ADOPTED',
          document_url: null,
          execution_mode: {
            mode: 'NO_SESSION',
            selected_template_id: TEMPLATE_PARAM_ID,
            agreement_360: {
              selected_template_id: TEMPLATE_PARAM_ID,
            },
          },
        }),
      });
      return;
    }

    await route.continue();
  });
}

async function stubAgreementCreation(page: Page, agreementId = FAKE_AGREEMENT_ID) {
  await page.route(/\/rest\/v1\/agreements.*/, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ id: agreementId }),
    });
  });
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

function demoEntity() {
  return {
    id: FAKE_ENTITY_ID,
    tenant_id: '00000000-0000-0000-0000-000000000001',
    slug: 'arga-seguros',
    legal_name: 'ARGA Seguros, S.A.',
    common_name: 'ARGA Seguros',
    jurisdiction: 'ES',
    legal_form: 'SA',
    tipo_social: 'SA',
    registration_number: 'A-00000000',
    entity_status: 'Active',
    materiality: 'Critical',
    forma_administracion: 'CONSEJO',
    tipo_organo_admin: 'CDA',
    es_unipersonal: false,
    es_cotizada: true,
    person_id: '10000000-0000-4000-8000-000000000038',
    parent_entity_id: null,
    ownership_percentage: null,
    created_at: '2026-05-04T10:00:00.000Z',
    parent: null,
    person: {
      id: '10000000-0000-4000-8000-000000000038',
      full_name: 'ARGA Seguros, S.A.',
      tax_id: 'A00000000',
      denomination: 'ARGA Seguros, S.A.',
      person_type: 'PJ',
    },
  };
}

function demoAgreement(adoptionMode = 'NO_SESSION') {
  return {
    id: FAKE_AGREEMENT_ID,
    tenant_id: '00000000-0000-0000-0000-000000000001',
    entity_id: FAKE_ENTITY_ID,
    body_id: FAKE_BODY_ID,
    agreement_kind: 'AUMENTO_CAPITAL',
    matter_class: 'ESTRUCTURAL',
    inscribable: true,
    adoption_mode: adoptionMode,
    required_quorum_code: null,
    required_majority_code: null,
    jurisdiction_rule_id: null,
    proposal_text: 'Aumento de capital QA no destructivo.',
    decision_text: 'Se aprueba el aumento de capital QA no destructivo.',
    decision_date: '2026-05-04',
    effective_date: null,
    status: 'ADOPTED',
    parent_meeting_id: null,
    unipersonal_decision_id: null,
    no_session_resolution_id: FAKE_RESOLUTION_ID,
    statutory_basis: 'LSC art. 295 y concordantes',
    compliance_snapshot: {
      ok: true,
      snapshot_hash: 'sha256-qa-watchdog',
      normative_framework_status: 'DEMO_OPERATIVA',
    },
    approval_workflow: null,
    execution_mode: {
      mode: adoptionMode,
      selected_template_id: TEMPLATE_PARAM_ID,
      agreement_360: {
        version: 'agreement-360.v1',
        origin: adoptionMode,
        selected_template_id: TEMPLATE_PARAM_ID,
      },
    },
    document_url: null,
    created_at: '2026-05-04T10:00:00.000Z',
    entities: {
      common_name: 'ARGA Seguros',
      legal_name: 'ARGA Seguros, S.A.',
      jurisdiction: 'ES',
      legal_form: 'SA',
    },
    governing_bodies: {
      name: 'Consejo de Administración',
      body_type: 'CDA',
    },
  };
}

function actaNoSessionTemplate() {
  return {
    id: TEMPLATE_PARAM_ID,
    tenant_id: '00000000-0000-0000-0000-000000000001',
    tipo: 'ACTA_ACUERDO_ESCRITO',
    materia: 'AUMENTO_CAPITAL',
    materia_acuerdo: 'AUMENTO_CAPITAL',
    jurisdiccion: 'ES',
    version: 'QA-1',
    estado: 'ACTIVA',
    aprobada_por: 'Legal QA',
    fecha_aprobacion: '2026-05-04',
    contenido_template: 'Acta acuerdo escrito QA',
    capa1_inmutable: [
      'ACTA DE ACUERDO ESCRITO SIN SESION',
      '',
      'Sociedad: ARGA Seguros, S.A.',
      `Expediente Acuerdo 360: ${FAKE_AGREEMENT_ID}`,
      'Materia: aumento de capital.',
      'El organo deja constancia de la propuesta, la votacion escrita y la decision adoptada.',
      'Este texto de prueba supera la longitud minima y conserva referencia visible al acuerdo.',
    ].join('\n'),
    capa2_variables: [],
    capa3_editables: [
      {
        campo: 'ciudad_emision',
        obligatoriedad: 'OPCIONAL',
        descripcion: 'Ciudad de emisión',
      },
    ],
    referencia_legal: 'LSC art. 248 y concordantes',
    notas_legal: null,
    variables: [],
    protecciones: {},
    snapshot_rule_pack_required: true,
    adoption_mode: 'NO_SESSION',
    organo_tipo: null,
    contrato_variables_version: '1.1',
    created_at: '2026-05-04T10:00:00.000Z',
    approval_checklist: null,
    version_history: null,
  };
}

function modeloAcuerdoTemplate() {
  return {
    ...actaNoSessionTemplate(),
    tipo: 'MODELO_ACUERDO',
    contenido_template: 'Modelo QA de aumento de capital',
    capa1_inmutable: [
      'MODELO DE ACUERDO DE AUMENTO DE CAPITAL',
      '',
      'La sociedad ARGA Seguros, S.A. acuerda aumentar capital en los terminos aprobados.',
      `Expediente Acuerdo 360: ${FAKE_AGREEMENT_ID}`,
      'El secretario verificara la elevacion a publico y la presentacion registral cuando proceda.',
    ].join('\n'),
    adoption_mode: null,
    referencia_legal: 'LSC arts. 295 a 316',
  };
}

async function stubDemoEntityReadModel(page: Page) {
  await page.route(/\/rest\/v1\/entities.*/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }

    const url = decodeURIComponent(route.request().url());
    const entity = demoEntity();
    if (url.includes(`id=eq.${FAKE_ENTITY_ID}`) || url.includes('slug=eq.arga-seguros')) {
      await fulfillJson(route, entity);
      return;
    }

    await fulfillJson(route, [entity]);
  });
}

async function stubAgreementReadModel(page: Page, adoptionMode = 'NO_SESSION') {
  await page.route(/\/rest\/v1\/agreements.*/, async (route) => {
    const request = route.request();
    if (request.method() !== 'GET') {
      await route.continue();
      return;
    }

    const url = decodeURIComponent(request.url());
    const agreement = demoAgreement(adoptionMode);
    if (url.includes(`id=eq.${FAKE_AGREEMENT_ID}`)) {
      await fulfillJson(route, agreement);
      return;
    }

    await fulfillJson(route, [agreement]);
  });
}

async function stubTemplatesReadModel(page: Page) {
  await page.route(/\/rest\/v1\/plantillas_protegidas.*/, async (route) => {
    const request = route.request();
    if (request.method() !== 'GET') {
      await route.continue();
      return;
    }

    const url = decodeURIComponent(request.url());
    if (url.includes(`id=eq.${TEMPLATE_PARAM_ID}`)) {
      await fulfillJson(route, actaNoSessionTemplate());
      return;
    }

    if (url.includes('tipo=eq.MODELO_ACUERDO')) {
      await fulfillJson(route, [modeloAcuerdoTemplate()]);
      return;
    }

    await fulfillJson(route, [actaNoSessionTemplate()]);
  });
}

async function stubNormativeReadModel(page: Page) {
  await page.route(/\/rest\/v1\/jurisdiction_rule_sets.*/, async (route) => fulfillJson(route, []));
  await page.route(/\/rest\/v1\/rule_pack_versions.*/, async (route) => fulfillJson(route, []));
  await page.route(/\/rest\/v1\/rule_param_overrides.*/, async (route) => fulfillJson(route, []));
  await page.route(/\/rest\/v1\/pactos_parasociales.*/, async (route) => fulfillJson(route, []));
}

async function stubTramitadorRulePack(page: Page) {
  await page.route(/\/rest\/v1\/rule_packs.*/, async (route) => {
    await fulfillJson(route, [
      {
        id: '10000000-0000-4000-8000-000000000039',
        tenant_id: '00000000-0000-0000-0000-000000000001',
        materia: 'AUMENTO_CAPITAL',
        organo_tipo: null,
        descripcion: 'Aumento de capital',
        created_at: '2026-05-04T10:00:00.000Z',
        rule_pack_versions: [
          {
            id: '10000000-0000-4000-8000-000000000040',
            pack_id: '10000000-0000-4000-8000-000000000039',
            version: '1',
            is_active: true,
            payload: {
              postAcuerdo: {
                inscribible: true,
                instrumentoRequerido: 'ESCRITURA',
                publicacionRequerida: true,
                canalesPublicacion: ['BORME'],
                plazoInscripcion: 30,
              },
            },
            created_at: '2026-05-04T10:00:00.000Z',
          },
        ],
      },
    ]);
  });
}

async function stubDocumentDraftPersistence(page: Page) {
  await page.route(/\/rest\/v1\/secretaria_document_drafts.*/, async (route) => {
    const request = route.request();
    if (request.method() === 'GET') {
      await fulfillJson(route, []);
      return;
    }

    const payload = (request.postDataJSON?.() ?? {}) as Record<string, unknown>;
    await fulfillJson(route, {
      id: FAKE_TEMPLATE_DRAFT_ID,
      tenant_id: payload.tenant_id ?? '00000000-0000-0000-0000-000000000001',
      document_request_id: payload.document_request_id ?? 'qa-document-request',
      draft_key_sha256: payload.draft_key_sha256 ?? 'sha256-draft-key',
      request_hash_sha256: payload.request_hash_sha256 ?? 'sha256-request',
      document_type: payload.document_type ?? 'ACUERDO_SIN_SESION',
      agreement_id: payload.agreement_id ?? FAKE_AGREEMENT_ID,
      template_id: payload.template_id ?? TEMPLATE_PARAM_ID,
      template_tipo: payload.template_tipo ?? 'ACTA_ACUERDO_ESCRITO',
      template_version: payload.template_version ?? 'QA-1',
      version: payload.version ?? 1,
      draft_state: payload.draft_state ?? 'EDITABLE_DRAFT',
      rendered_body_text: payload.rendered_body_text ?? actaNoSessionTemplate().capa1_inmutable,
      system_trace_text: payload.system_trace_text ?? '',
      capa3_values: payload.capa3_values ?? {},
      post_render_validation: payload.post_render_validation ?? { ok: true, issues: [] },
      content_hash_sha256: payload.content_hash_sha256 ?? null,
      configured_at: payload.configured_at ?? null,
      created_at: '2026-05-04T10:00:00.000Z',
      updated_at: '2026-05-04T10:00:00.000Z',
      metadata: payload.metadata ?? {},
    });
  });
}

async function stubCertificationDirectRpc(page: Page, calls: string[]) {
  await page.route(/\/rest\/v1\/capability_matrix.*/, async (route) => {
    await fulfillJson(route, [
      {
        id: 'cap-cert-secretario',
        role: 'SECRETARIO',
        action: 'CERTIFICATION',
        enabled: true,
        reason: 'QA watchdog',
        created_at: '2026-05-04T10:00:00.000Z',
      },
    ]);
  });

  await page.route(/\/rest\/v1\/authority_evidence.*/, async (route) => {
    await fulfillJson(route, {
      id: 'authority-president-qa',
      tenant_id: '00000000-0000-0000-0000-000000000001',
      entity_id: FAKE_ENTITY_ID,
      body_id: FAKE_BODY_ID,
      person_id: '10000000-0000-4000-8000-000000000041',
      cargo: 'PRESIDENTE',
      fecha_inicio: '2026-01-01',
      fecha_fin: null,
      fuente_designacion: 'BOOTSTRAP',
      inscripcion_rm_referencia: null,
      inscripcion_rm_fecha: null,
      estado: 'VIGENTE',
      metadata: {},
      created_at: '2026-05-04T10:00:00.000Z',
      updated_at: '2026-05-04T10:00:00.000Z',
      person: {
        id: '10000000-0000-4000-8000-000000000041',
        full_name: 'Presidencia QA',
        tax_id: null,
        person_type: 'PF',
      },
    });
  });

  await page.route(/\/rest\/v1\/rpc\/fn_generar_certificacion_acuerdo_sin_sesion/, async (route) => {
    calls.push('fn_generar_certificacion_acuerdo_sin_sesion');
    expect(route.request().postDataJSON()).toMatchObject({
      p_agreement_id: FAKE_AGREEMENT_ID,
      p_tipo: 'NO_SESSION',
      p_certificante_role: 'SECRETARIO',
    });
    await fulfillJson(route, FAKE_CERTIFICATION_ID);
  });
  await page.route(/\/rest\/v1\/rpc\/fn_firmar_certificacion/, async (route) => {
    calls.push('fn_firmar_certificacion');
    expect(route.request().postDataJSON()).toMatchObject({
      p_certification_id: FAKE_CERTIFICATION_ID,
    });
    await fulfillJson(route, null);
  });
  await page.route(/\/rest\/v1\/rpc\/fn_emitir_certificacion/, async (route) => {
    calls.push('fn_emitir_certificacion');
    expect(route.request().postDataJSON()).toMatchObject({
      p_certification_id: FAKE_CERTIFICATION_ID,
    });
    await fulfillJson(route, `evidence_bundle:${FAKE_CERTIFICATION_ID}@qa`);
  });
}

async function stubCapitalTransmissionReadModel(page: Page) {
  await page.route(/\/rest\/v1\/capital_holdings.*/, async (route) => {
    if (route.request().method() !== 'GET') {
      await fulfillJson(route, { message: 'blocked by non-destructive e2e watchdog' }, 409);
      return;
    }

    await fulfillJson(route, [
      {
        id: FAKE_HOLDING_ID,
        tenant_id: '00000000-0000-0000-0000-000000000001',
        entity_id: FAKE_ENTITY_ID,
        holder_person_id: FAKE_SELLER_PERSON_ID,
        share_class_id: '10000000-0000-4000-8000-000000000042',
        numero_titulos: 100,
        porcentaje_capital: 10,
        voting_rights: true,
        is_treasury: false,
        effective_from: '2026-01-01',
        effective_to: null,
        metadata: {},
        created_at: '2026-05-04T10:00:00.000Z',
        holder: {
          id: FAKE_SELLER_PERSON_ID,
          full_name: 'Fundación ARGA',
          tax_id: 'G00000000',
          person_type: 'PJ',
          denomination: 'Fundación ARGA',
        },
        share_class: {
          id: '10000000-0000-4000-8000-000000000042',
          class_code: 'ORD',
          name: 'Acciones ordinarias',
          votes_per_title: 1,
          voting_rights: true,
        },
      },
    ]);
  });

  await page.route(/\/rest\/v1\/persons.*/, async (route) => {
    await fulfillJson(route, [
      {
        id: FAKE_SELLER_PERSON_ID,
        tenant_id: '00000000-0000-0000-0000-000000000001',
        full_name: 'Fundación ARGA',
        tax_id: 'G00000000',
        email: null,
        person_type: 'PJ',
        denomination: 'Fundación ARGA',
        representative_person_id: null,
        created_at: '2026-05-04T10:00:00.000Z',
      },
      {
        id: FAKE_BUYER_PERSON_ID,
        tenant_id: '00000000-0000-0000-0000-000000000001',
        full_name: 'Cartera ARGA S.L.U.',
        tax_id: 'B00000000',
        email: null,
        person_type: 'PJ',
        denomination: 'Cartera ARGA S.L.U.',
        representative_person_id: null,
        created_at: '2026-05-04T10:00:00.000Z',
      },
    ]);
  });
}

test.describe('Secretaría functional watchdog', () => {
  test('rutas críticas de Secretaría cargan, responden y no emiten errores de consola/red', async ({ page }) => {
    for (const route of CRITICAL_ROUTES) {
      const diagnostics = attachDiagnostics(page);
      await page.goto(route.path);
      await assertRouteHealthy(page, diagnostics, route.heading);
    }
  });

  test('routing de plantillas sin sesión conserva intención y abre el subflujo correcto', async ({ page }) => {
    await page.goto(`/secretaria/acuerdos-sin-sesion?plantilla=${TEMPLATE_PARAM_ID}&tipo=ACTA_ACUERDO_ESCRITO`);
    await expect(page).toHaveURL(/\/secretaria\/acuerdos-sin-sesion\/nuevo\?/);
    await expect(page.getByRole('heading', { name: 'Asistente de acuerdo escrito sin sesión' })).toBeVisible();
    await expect(page.getByText('Plantilla seleccionada:')).toBeVisible();

    await page.goto(`/secretaria/acuerdos-sin-sesion?plantilla=${TEMPLATE_PARAM_ID}&tipo=ACTA_DECISION_CONJUNTA`);
    await expect(page).toHaveURL(/\/secretaria\/acuerdos-sin-sesion\/co-aprobacion\?/);
    await expect(page.getByRole('heading', { name: 'Asistente de acuerdo por co-aprobación (k de n)' })).toBeVisible();
    await expect(page.getByText('Plantilla seleccionada:')).toBeVisible();

    await page.goto(`/secretaria/acuerdos-sin-sesion?plantilla=${TEMPLATE_PARAM_ID}&tipo=ACTA_ORGANO_ADMIN`);
    await expect(page).toHaveURL(/\/secretaria\/acuerdos-sin-sesion\/solidario\?/);
    await expect(page.getByRole('heading', { name: 'Asistente de acuerdo por administrador solidario' })).toBeVisible();
    await expect(page.getByText('Plantilla seleccionada:')).toBeVisible();
  });

  test('asistente real de acuerdo sin sesión permite completar preflight sin mutar Supabase', async ({ page }) => {
    await stubNoSessionCreation(page);
    await page.goto(`/secretaria/acuerdos-sin-sesion/nuevo?plantilla=${TEMPLATE_PARAM_ID}&tipo=ACTA_ACUERDO_ESCRITO`);

    await expect(page.getByRole('heading', { name: 'Asistente de acuerdo escrito sin sesión' })).toBeVisible();
    await expect(page.getByText('Plantilla seleccionada:')).toBeVisible();

    const selects = page.locator('main select');
    await selectOptionByText(selects.nth(0), /ARGA Seguros, S\.A\./);
    await selectOptionByText(selects.nth(1), /Consejo|Junta|Administraci/);
    await selectOptionByText(selects.nth(2), /Aprobación|Nombramiento|Distribución|Delegación/);

    await expect(page.getByRole('button', { name: /Siguiente/ })).toBeEnabled();
    await page.getByRole('button', { name: /Siguiente/ }).click();

    await page.locator('main input[type="text"]').fill('QA acuerdo sin sesión');
    await page.getByPlaceholder(/Redacta aquí el texto completo/i).fill('Propuesta QA sin mutar Supabase.');
    await page.getByRole('button', { name: /Siguiente/ }).click();

    await expect(page.getByText('Miembros con derecho a voto', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Iniciar votación/ })).toBeEnabled();
    await page.getByRole('button', { name: /Iniciar votación/ }).click();

    await expect(page.getByText('Paso 4. Votación')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /Ir a cierre/ }).click();
    await expect(page.getByText('Resultado: RECHAZADO')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Adoptar acuerdo' })).toBeDisabled();
  });

  test('co-aprobación queda cableada a sociedad, órgano, plantilla y registro no destructivo', async ({ page }) => {
    await stubAgreementCreation(page, FAKE_AGREEMENT_ID);
    await page.goto(`/secretaria/acuerdos-sin-sesion/co-aprobacion?plantilla=${TEMPLATE_PARAM_ID}&tipo=ACTA_DECISION_CONJUNTA`);

    await expect(page.getByRole('heading', { name: 'Asistente de acuerdo por co-aprobación (k de n)' })).toBeVisible();
    await expect(page.getByText('Plantilla seleccionada:')).toBeVisible();
    await expect(page.getByRole('button', { name: /Siguiente/ })).toBeDisabled();

    const selects = page.locator('main select');
    await selectOptionByText(selects.nth(0), /ARGA Seguros, S\.A\./);
    await selectOptionByText(selects.nth(1), /Consejo|Junta|Administraci/);
    await selectOptionByText(selects.nth(2), /Delegación|Aprobación|Otros/);
    await page.locator('#coaprobacion-texto').fill('Acuerdo QA de co-aprobación no destructivo.');
    await expect(page.getByRole('button', { name: /Siguiente/ })).toBeEnabled();
    await page.getByRole('button', { name: /Siguiente/ }).click();

    await page.locator('#coaprobacion-k').fill('1');
    await page.getByRole('button', { name: /Siguiente/ }).click();
    await page.getByLabel('Nombre del administrador firmante').fill('Administradora QA');
    await page.getByRole('button', { name: 'Añadir' }).click();
    await page.getByRole('button', { name: /Siguiente/ }).click();
    await expect(page.getByText(/Co-aprobación válida|Co-aprobación inválida/)).toBeVisible();
    await page.getByRole('button', { name: /Siguiente/ }).click();

    await page.getByRole('button', { name: 'Registrar acuerdo' }).click();
    await expect(page.getByText('Acuerdo registrado')).toBeVisible();
    await expect(page.getByRole('button', { name: /Generar documento/ })).toBeVisible();
  });

  test('administrador solidario queda cableado a sociedad, órgano, plantilla y registro no destructivo', async ({ page }) => {
    await stubAgreementCreation(page, '10000000-0000-4000-8000-000000000032');
    await page.goto(`/secretaria/acuerdos-sin-sesion/solidario?plantilla=${TEMPLATE_PARAM_ID}&tipo=ACTA_ORGANO_ADMIN`);

    await expect(page.getByRole('heading', { name: 'Asistente de acuerdo por administrador solidario' })).toBeVisible();
    await expect(page.getByText('Plantilla seleccionada:')).toBeVisible();
    await expect(page.getByRole('button', { name: /Siguiente/ })).toBeDisabled();

    const selects = page.locator('main select');
    await selectOptionByText(selects.nth(0), /ARGA Seguros, S\.A\./);
    await selectOptionByText(selects.nth(1), /Consejo|Junta|Administraci/);
    await selectOptionByText(selects.nth(2), /Delegación|Aprobación|Otros/);
    await page.locator('#solidario-texto').fill('Acuerdo QA de administrador solidario no destructivo.');
    await page.getByRole('button', { name: /Siguiente/ }).click();

    await page.locator('#solidario-admin-id').fill('admin-solidario-qa');
    await page.locator('#solidario-admin-nombre').fill('Administrador Solidario QA');
    await page.getByRole('button', { name: /Siguiente/ }).click();
    await expect(page.getByText(/Acuerdo solidario válido|Acuerdo solidario inválido/)).toBeVisible();
    await page.getByRole('button', { name: /Siguiente/ }).click();

    await page.getByRole('button', { name: 'Registrar acuerdo' }).click();
    await expect(page.getByText('Acuerdo registrado')).toBeVisible();
    await expect(page.getByRole('button', { name: /Generar documento/ })).toBeVisible();
  });

  test('detalle no-session materializado enlaza expediente y generador documental', async ({ page }) => {
    await stubNoSessionCreation(page, {
      status: 'APROBADO',
      votes_for: 3,
      total_members: 3,
      closed_at: '2026-05-04T12:00:00.000Z',
    });
    await stubLinkedNoSessionAgreement(page);

    await page.goto(`/secretaria/acuerdos-sin-sesion/${FAKE_RESOLUTION_ID}?plantilla=${TEMPLATE_PARAM_ID}`);
    await expect(page.getByRole('heading', { name: 'QA acuerdo sin sesión' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ver expediente' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Generar documento' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Acuerdo DOCX' })).toBeVisible();

    await page.getByRole('button', { name: 'Generar documento' }).click();
    await expect(page).toHaveURL(new RegExp(`/secretaria/acuerdos/${FAKE_AGREEMENT_ID}/generar\\?plantilla=${TEMPLATE_PARAM_ID}`));
  });

  test('detalle no-session bloquea voto vencido antes de mutar contadores', async ({ page }) => {
    await stubNoSessionCreation(page, {
      status: 'VOTING_OPEN',
      voting_deadline: '2026-05-04T00:00:00.000Z',
    });

    await page.goto(`/secretaria/acuerdos-sin-sesion/${FAKE_RESOLUTION_ID}`);
    await expect(page.getByRole('heading', { name: 'QA acuerdo sin sesión' })).toBeVisible();
    await page.getByRole('button', { name: 'Votar a favor' }).click();
    await expect(page.getByText('Plazo de votación vencido')).toBeVisible();
  });

  test('detalle no-session no permite cierre aprobado sin mayoría suficiente', async ({ page }) => {
    await stubNoSessionCreation(page, {
      status: 'VOTING_OPEN',
      votes_for: 1,
      votes_against: 1,
      abstentions: 0,
      total_members: 3,
      requires_unanimity: true,
      voting_deadline: '2026-05-05T12:00:00.000Z',
    });

    await page.goto(`/secretaria/acuerdos-sin-sesion/${FAKE_RESOLUTION_ID}`);
    await expect(page.getByRole('heading', { name: 'QA acuerdo sin sesión' })).toBeVisible();
    await expect(page.getByText(/Unanimidad requerida/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cerrar como Aprobado' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Cerrar como Rechazado' })).toBeEnabled();
  });

  test('detalle no-session emite certificación directa desde acuerdo con RPCs interceptados', async ({ page }) => {
    const rpcCalls: string[] = [];
    await stubNoSessionCreation(page, {
      status: 'APROBADO',
      votes_for: 3,
      total_members: 3,
      closed_at: '2026-05-04T12:00:00.000Z',
    });
    await stubLinkedNoSessionAgreement(page);
    await stubCertificationDirectRpc(page, rpcCalls);

    await page.goto(`/secretaria/acuerdos-sin-sesion/${FAKE_RESOLUTION_ID}?plantilla=${TEMPLATE_PARAM_ID}`);
    await expect(page.getByRole('heading', { name: 'QA acuerdo sin sesión' })).toBeVisible();

    const emitButton = page.getByRole('button', { name: 'Emitir certificación' });
    await expect(emitButton).toBeVisible({ timeout: 10_000 });
    await emitButton.click();

    await expect(page.getByText('Certificación emitida')).toBeVisible({ timeout: 10_000 });
    expect(rpcCalls).toEqual([
      'fn_generar_certificacion_acuerdo_sin_sesion',
      'fn_firmar_certificacion',
      'fn_emitir_certificacion',
    ]);
  });

  test('tramitador registral consume acuerdo y plantilla indicada sin ejecutar presentación', async ({ page }) => {
    await stubDemoEntityReadModel(page);
    await stubAgreementReadModel(page);
    await stubTramitadorRulePack(page);
    await stubTemplatesReadModel(page);

    await page.goto(
      `/secretaria/tramitador/nuevo?agreement=${FAKE_AGREEMENT_ID}&materia=AUMENTO_CAPITAL&plantilla=${TEMPLATE_PARAM_ID}&tipo=MODELO_ACUERDO`,
    );

    const main = page.locator('main');
    await expect(main.getByRole('heading', { name: 'Asistente de tramitación' })).toBeVisible();
    await expect(main.getByText('Entrada desde plantilla')).toBeVisible();
    await expect(main.getByText(/Envío a BORME|Enviar al Registro Mercantil|Presentado al Registro Mercantil/i)).toHaveCount(0);

    const next = main.getByRole('button', { name: /Siguiente/ });
    await expect(next).toBeEnabled({ timeout: 10_000 });
    await next.click();

    await expect(main.getByText('Análisis de inscribibilidad')).toBeVisible();
    await expect(main.getByText('Instrumento requerido:')).toBeVisible();
    await expect(main.getByText('ESCRITURA', { exact: true })).toBeVisible();
    await expect(main.getByText('Modelo de acuerdo (referencia)')).toBeVisible();
    await expect(main.getByText('Plantilla indicada')).toBeVisible();
    await expect(main.locator('textarea').first()).toHaveValue(/MODELO DE ACUERDO DE AUMENTO DE CAPITAL/);

    await next.click();
    await page.getByPlaceholder('Ej: Notaría López García, Madrid').fill('Notaría QA Madrid');
    await main.locator('input[type="date"]').fill('2026-05-04');
    await page.getByPlaceholder('Ej: 2026/5432').fill('2026/QA-30');

    await next.click();
    await selectOptionByText(main.locator('select').last(), /BORME/);
    await expect(main.getByText(/este entorno demo no realiza envío telemático al Registro/i)).toBeVisible();
    await expect(main.getByText(/Envío a BORME|Enviar al Registro Mercantil|Presentado al Registro Mercantil/i)).toHaveCount(0);

    await next.click();
    await expect(main.getByText('Pendiente de registrar escritura en expediente')).toBeVisible();
    await expect(main.getByRole('button', { name: 'Registrar escritura' })).toBeEnabled();
    await expect(main.getByRole('button', { name: 'Documento registral DOCX' })).toBeVisible();
  });

  test('generador documental auto-selecciona plantilla, crea borrador y configura DOCX sin archivar', async ({ page }) => {
    await stubDemoEntityReadModel(page);
    await stubAgreementReadModel(page);
    await stubTemplatesReadModel(page);
    await stubNormativeReadModel(page);
    await stubDocumentDraftPersistence(page);

    await page.goto(`/secretaria/acuerdos/${FAKE_AGREEMENT_ID}/generar?plantilla=${TEMPLATE_PARAM_ID}`);

    const main = page.locator('main');
    await expect(
      main.getByRole('heading', { name: 'Generar documento' })
        .or(page.getByRole('heading', { name: 'Ha ocurrido un error' })),
    ).toBeVisible({ timeout: 10_000 });
    const technicalDetails = page.getByText('Ver detalles técnicos');
    if (await technicalDetails.isVisible().catch(() => false)) {
      await technicalDetails.click();
      const errorText = await page.locator('pre').innerText();
      throw new Error(`Generador documental renderizó ErrorBoundary: ${errorText}`);
    }
    await expect(main.getByRole('heading', { name: 'Generar documento' })).toBeVisible();
    await expect(main.getByRole('heading', { name: 'Variables resueltas (Capa 2)' })).toBeVisible({
      timeout: 10_000,
    });

    await main.getByRole('button', { name: /Siguiente/ }).click();
    await expect(main.getByRole('heading', { name: 'Campos editables (Capa 3)' })).toBeVisible();
    await main.getByRole('button', { name: 'Crear borrador' }).click();

    await expect(main.getByRole('heading', { name: 'Borrador editable del documento' })).toBeVisible({
      timeout: 10_000,
    });
    await expect(main.getByLabel('Texto del borrador')).toHaveValue(/ACTA DE ACUERDO ESCRITO SIN SESION/);

    const configureDraft = main.getByRole('button', { name: /Configurar borrador/ });
    await expect(configureDraft).toBeEnabled({ timeout: 10_000 });
    await configureDraft.click();

    await expect(main.getByText('Borrador configurado correctamente')).toBeVisible({ timeout: 15_000 });
    await expect(main.getByText('Firma Cualificada (QES)')).toBeVisible();
    await expect(main.getByText(/QTSP EAD Trust/)).toBeVisible();
    await expect(main.getByRole('button', { name: 'Archivar documento' })).toBeVisible();
  });

  test('transmisión de capital valida origen, destino y confirmación sin registrar movimiento', async ({ page }) => {
    await stubDemoEntityReadModel(page);
    await stubCapitalTransmissionReadModel(page);

    await page.goto(`/secretaria/sociedades/${FAKE_ENTITY_ID}/transmision`);
    const main = page.locator('main');
    await expect(main.getByRole('heading', { name: /Transmisión de titularidad/i })).toBeVisible();

    await selectOptionByText(main.locator('select').first(), /Fundación ARGA/);
    await main.getByLabel(/Títulos a transmitir/).fill('200');
    await expect(main.getByText('Excede los títulos disponibles (100).')).toBeVisible();
    await expect(main.getByRole('button', { name: 'Siguiente' })).toBeDisabled();

    await main.getByLabel(/Títulos a transmitir/).fill('25');
    await main.getByLabel('Motivo').fill('Compraventa QA no destructiva');
    await expect(main.getByRole('button', { name: 'Siguiente' })).toBeEnabled();
    await main.getByRole('button', { name: 'Siguiente' }).click();

    await selectOptionByText(main.locator('select').first(), /Cartera ARGA/);
    await main.getByRole('button', { name: 'Siguiente' }).click();

    await expect(main.getByText('Origen', { exact: true })).toBeVisible();
    await expect(main.getByText('Fundación ARGA', { exact: true })).toBeVisible();
    await expect(main.getByText('Destino', { exact: true })).toBeVisible();
    await expect(main.getByText('Cartera ARGA S.L.U.', { exact: true })).toBeVisible();
    await expect(main.getByText('Remanente en origen', { exact: true })).toBeVisible();
    await expect(main.getByText('75', { exact: true })).toBeVisible();
    await expect(main.getByRole('button', { name: 'Registrar transmisión' })).toBeVisible();
  });
});
