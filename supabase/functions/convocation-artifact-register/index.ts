// Authoritative server renderer for the final convocatoria DOCX.
//
// The request contains only the convocatoria identity (and, optionally, the
// manifest hash the UI observed).  Legal content, Word bytes, binary hashes,
// private storage identity and the final attachment are all derived here from
// the immutable server manifest.  EAD interposition/custody is a separate
// service and this boundary makes no electronic-signing claim.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  DOCX_MIME,
  RENDERER_CONTRACT_VERSION,
  renderConvocationDocx,
} from './renderer.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const STORAGE_BUCKET = 'matter-documents';
const MAX_BYTES = 25 * 1024 * 1024;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RenderRequest {
  convocatoriaId?: unknown;
  expectedManifestHashSha512?: unknown;
}

interface ManifestRow {
  tenant_id: string;
  convocatoria_id: string;
  manifest_json: unknown;
  manifest_hash_sha512: string;
  data_class: string;
  legal_effect: string;
  immutable_at: string | null;
}

interface CanonicalSourceRow {
  manifest_canonical_json: string;
  manifest_hash_sha512: string;
}

interface ExistingAttachmentRow {
  id: string;
  file_name: string | null;
  file_url: string | null;
  file_hash: string | null;
  file_hash_sha512: string | null;
  agenda_item_index: number | null;
  artifact_verified_at: string | null;
  artifact_verified_by_service: boolean | null;
  artifact_verified_size_bytes: number | string | null;
  artifact_verified_mime_type: string | null;
  artifact_candidate_id: string | null;
  convocation_manifest_hash_sha512: string | null;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function exactArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function digestHex(algorithm: 'SHA-256' | 'SHA-512', bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest(algorithm, exactArrayBuffer(bytes));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const source = value as Record<string, unknown>;
  return `{${Object.keys(source).sort().map((key) => `${JSON.stringify(key)}:${stableJson(source[key])}`).join(',')}}`;
}

async function assertStoredBytesMatch(
  admin: ReturnType<typeof createClient>,
  storagePath: string,
  expectedSha256: string,
  expectedSha512: string,
  expectedSize: number,
  expectedMimeType: string,
): Promise<boolean> {
  const { data, error } = await admin.storage.from(STORAGE_BUCKET).download(storagePath);
  if (error || !data) return false;
  if (data.type !== expectedMimeType) {
    throw new Error('Private storage content type differs from the immutable convocatoria artifact');
  }
  const stored = new Uint8Array(await data.arrayBuffer());
  const [sha256, sha512] = await Promise.all([
    digestHex('SHA-256', stored),
    digestHex('SHA-512', stored),
  ]);
  if (
    stored.byteLength !== expectedSize
    || sha256 !== expectedSha256
    || sha512 !== expectedSha512
  ) {
    throw new Error('Private storage already contains a different immutable convocatoria binary');
  }
  return true;
}

function existingArtifactStoragePath(
  existing: ExistingAttachmentRow,
  convocatoriaId: string,
  storedManifestHash: string,
): string {
  const hashSha256 = nonEmptyString(existing.file_hash)?.toLowerCase() ?? '';
  const hashSha512 = nonEmptyString(existing.file_hash_sha512)?.toLowerCase() ?? '';
  const manifestHash = nonEmptyString(existing.convocation_manifest_hash_sha512)?.toLowerCase() ?? '';
  const sizeBytes = Number(existing.artifact_verified_size_bytes);
  const fileName = nonEmptyString(existing.file_name) ?? '';

  if (
    manifestHash !== storedManifestHash
    || !/^[0-9a-f]{64}$/.test(hashSha256)
    || !/^[0-9a-f]{128}$/.test(hashSha512)
    || !Number.isSafeInteger(sizeBytes)
    || sizeBytes <= 0
    || sizeBytes > MAX_BYTES
    || existing.agenda_item_index !== null
    || existing.artifact_candidate_id !== null
    || existing.artifact_verified_by_service !== true
    || !nonEmptyString(existing.artifact_verified_at)
    || existing.artifact_verified_mime_type !== DOCX_MIME
    || !/\.docx$/i.test(fileName)
    || fileName.includes('/')
    || fileName.includes('\\')
  ) {
    throw new Error('Existing immutable artifact metadata or manifest binding is inconsistent');
  }

  const storagePath = `convocatorias/${convocatoriaId}/authoritative/${storedManifestHash.slice(0, 20)}-${hashSha256.slice(0, 20)}.docx`;
  if (existing.file_url !== `evidence-bundle://${storagePath}`) {
    throw new Error('Existing immutable artifact storage URI is inconsistent');
  }
  return storagePath;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  const authorization = req.headers.get('authorization');
  if (!authorization) return jsonResponse({ error: 'Missing Authorization header' }, 401);
  const token = authorization.replace(/^Bearer\s+/i, '');
  const verifier = createClient(SUPABASE_URL, ANON_KEY);
  const { data: { user }, error: userError } = await verifier.auth.getUser(token);
  if (userError || !user) return jsonResponse({ error: 'Invalid user session' }, 401);

  let input: RenderRequest;
  try {
    input = await req.json() as RenderRequest;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return jsonResponse({ error: 'Request body must be an object' }, 400);
  }
  const unexpectedKeys = Object.keys(input as Record<string, unknown>)
    .filter((key) => !['convocatoriaId', 'expectedManifestHashSha512'].includes(key));
  if (unexpectedKeys.length > 0) {
    return jsonResponse({ error: `Unsupported request fields: ${unexpectedKeys.join(', ')}` }, 400);
  }
  const convocatoriaId = nonEmptyString(input.convocatoriaId);
  const expectedManifestHashSha512 = nonEmptyString(input.expectedManifestHashSha512)?.toLowerCase() ?? null;
  if (!convocatoriaId || !isUuid(convocatoriaId)) {
    return jsonResponse({ error: 'convocatoriaId must be a UUID' }, 400);
  }
  if (expectedManifestHashSha512 && !/^[0-9a-f]{128}$/.test(expectedManifestHashSha512)) {
    return jsonResponse({ error: 'expectedManifestHashSha512 is malformed' }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: profile, error: profileError } = await admin
    .from('user_profiles')
    .select('tenant_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (profileError || !profile?.tenant_id) return jsonResponse({ error: 'Tenant access denied' }, 403);
  const tenantId = String(profile.tenant_id);

  const { data: roles, error: rolesError } = await admin
    .from('rbac_user_roles')
    .select('is_active, expires_at, rbac_roles(role_code)')
    .eq('user_id', user.id)
    .eq('tenant_id', tenantId);
  if (rolesError) return jsonResponse({ error: 'Role resolution failed' }, 500);
  type RoleRow = {
    is_active: boolean | null;
    expires_at: string | null;
    rbac_roles: { role_code?: string } | null;
  };
  const now = Date.now();
  const isOperator = ((roles ?? []) as RoleRow[]).some((row) =>
    row.is_active === true
    && (!row.expires_at || Date.parse(row.expires_at) > now)
    && ['SECRETARIO', 'ADMIN_TENANT'].includes(row.rbac_roles?.role_code ?? '')
  );
  if (!isOperator) return jsonResponse({ error: 'SECRETARIO or ADMIN_TENANT required' }, 403);

  const { data: manifestData, error: manifestError } = await admin
    .from('convocation_manifests')
    .select('tenant_id, convocatoria_id, manifest_json, manifest_hash_sha512, data_class, legal_effect, immutable_at')
    .eq('convocatoria_id', convocatoriaId)
    .maybeSingle();
  const manifest = manifestData as ManifestRow | null;
  if (manifestError || !manifest) return jsonResponse({ error: 'Authoritative convocatoria manifest not found' }, 409);
  if (manifest.tenant_id !== tenantId || manifest.convocatoria_id !== convocatoriaId) {
    return jsonResponse({ error: 'Manifest tenant/convocatoria mismatch' }, 403);
  }
  if (!manifest.immutable_at) return jsonResponse({ error: 'Manifest is not immutable' }, 409);
  if (
    manifest.data_class !== 'DEMO'
    || manifest.legal_effect !== 'DEMO_SIMULATION_NO_LEGAL_EFFECT'
  ) {
    return jsonResponse({
      error: 'Non-DEMO rendering is blocked until its approved evidence pipeline is available',
    }, 409);
  }

  const { data: canonicalData, error: canonicalError } = await admin.rpc(
    'fn_get_convocation_manifest_canonical_source',
    { p_convocatoria_id: convocatoriaId },
  );
  const canonical = (Array.isArray(canonicalData) ? canonicalData[0] : canonicalData) as CanonicalSourceRow | null;
  if (canonicalError || !canonical?.manifest_canonical_json) {
    return jsonResponse({ error: canonicalError?.message ?? 'Canonical manifest source unavailable' }, 409);
  }
  let canonicalManifest: unknown;
  try {
    canonicalManifest = JSON.parse(canonical.manifest_canonical_json);
  } catch {
    return jsonResponse({ error: 'Canonical manifest JSON is invalid' }, 409);
  }
  if (stableJson(canonicalManifest) !== stableJson(manifest.manifest_json)) {
    return jsonResponse({ error: 'Canonical manifest source differs from the stored manifest' }, 409);
  }
  const recalculatedManifestHash = await digestHex(
    'SHA-512',
    new TextEncoder().encode(canonical.manifest_canonical_json),
  );
  const storedManifestHash = String(manifest.manifest_hash_sha512 ?? '').toLowerCase();
  if (
    !/^[0-9a-f]{128}$/.test(storedManifestHash)
    || canonical.manifest_hash_sha512?.toLowerCase() !== storedManifestHash
    || recalculatedManifestHash !== storedManifestHash
  ) {
    return jsonResponse({ error: 'Authoritative manifest SHA-512 verification failed' }, 409);
  }
  if (expectedManifestHashSha512 && expectedManifestHashSha512 !== storedManifestHash) {
    return jsonResponse({ error: 'Observed manifest hash is stale' }, 409);
  }

  const root = canonicalManifest as Record<string, unknown>;
  if (
    root.schema_version !== 'secretaria.convocation-manifest.v2'
    || root.convocatoria_id !== convocatoriaId
    || root.tenant_id !== tenantId
    || root.data_class !== manifest.data_class
    || root.legal_effect !== manifest.legal_effect
    || root.record_status !== 'DEMO_OPERATIONAL_DRAFT_RECORDED'
    || root.not_a_legal_convocation !== true
    || root.president_action_not_asserted !== true
  ) {
    return jsonResponse({ error: 'Manifest identity or legal posture is inconsistent' }, 409);
  }
  if (root.renderer_contract_version !== RENDERER_CONTRACT_VERSION) {
    return jsonResponse({
      error: `Manifest renderer contract must be ${RENDERER_CONTRACT_VERSION}; rectify the legacy convocatoria instead of reusing it as current`,
    }, 409);
  }
  const supportingDocuments = root.supporting_documents && typeof root.supporting_documents === 'object'
    ? root.supporting_documents as Record<string, unknown>
    : {};
  const supportingIntents = Array.isArray(supportingDocuments.intents)
    ? supportingDocuments.intents as Array<Record<string, unknown>>
    : null;
  if (
    supportingDocuments.schema_version !== 'secretaria.convocation-supporting-intents.v1'
    || supportingDocuments.completion_policy !== 'EXACT_SET_REQUIRED_BEFORE_FINAL'
    || !supportingIntents
    || supportingDocuments.expected_count !== supportingIntents.length
  ) {
    return jsonResponse({ error: 'Manifest supporting-document intent set is incomplete or legacy' }, 409);
  }
  const recipients = Array.isArray(root.recipients)
    ? root.recipients as Array<Record<string, unknown>>
    : [];
  const recipientSelection = root.recipient_selection && typeof root.recipient_selection === 'object'
    ? root.recipient_selection as Record<string, unknown>
    : {};
  if (
    recipients.length === 0
    || recipientSelection.schema_version !== 'secretaria.convocation-recipient-selection.v1'
    || recipientSelection.source !== 'condiciones_persona'
    || recipientSelection.selected_count !== recipients.length
    || typeof recipientSelection.effective_date !== 'string'
    || !Array.isArray(recipientSelection.excluded_person_ids)
  ) {
    return jsonResponse({ error: 'Manifest recipient snapshot is incomplete or inconsistent' }, 409);
  }
  const authorityPolicy = root.authority && typeof root.authority === 'object'
    ? root.authority as Record<string, unknown>
    : {};
  const publicationPolicy = root.publication && typeof root.publication === 'object'
    ? root.publication as Record<string, unknown>
    : {};
  const requestedChannels = Array.isArray(publicationPolicy.requested_channels)
    ? publicationPolicy.requested_channels
    : [];
  const sandboxChannels = Array.isArray(publicationPolicy.sandbox_channels)
    ? publicationPolicy.sandbox_channels
    : [];
  const publicationChannels = [
    ...requestedChannels,
    ...sandboxChannels,
    ...recipients.map((recipient) => recipient.channel),
  ];
  if (
    publicationChannels.length === 0
    || publicationChannels.some((channel) => (
      typeof channel !== 'string'
      || !/^(?:SANDBOX_)?(?:EAD_INTERPOSITION|EMAIL_SIMPLE)$/i.test(channel)
    ))
  ) {
    return jsonResponse({ error: 'Manifest contains a certified or unsupported publication channel' }, 409);
  }
  for (const policy of [authorityPolicy, publicationPolicy]) {
    if (
      policy.ead_signature_service_required !== false
      || policy.legal_signature_status !== 'NOT_ASSERTED'
      || policy.external_signature_requirements !== 'OUT_OF_SCOPE_FOR_THIS_DEMO_ARTIFACT'
    ) {
      return jsonResponse({ error: 'Manifest EAD/no-assertion policy is inconsistent' }, 409);
    }
  }
  if (
    authorityPolicy.actor_role_reference_only !== true
    || authorityPolicy.president_action_not_asserted !== true
    || authorityPolicy.legal_signature_status !== 'NOT_ASSERTED'
  ) {
    return jsonResponse({ error: 'Manifest authority reference/no-action policy is inconsistent' }, 409);
  }
  const reviewedDemoDraftText = typeof root.reviewed_demo_draft_text === 'string'
    ? root.reviewed_demo_draft_text
    : '';
  const reviewedDemoDraftTextHash = typeof root.reviewed_demo_draft_text_hash_sha256 === 'string'
    ? root.reviewed_demo_draft_text_hash_sha256.toLowerCase()
    : '';
  if (!reviewedDemoDraftText.trim() || !/^[0-9a-f]{64}$/.test(reviewedDemoDraftTextHash)) {
    return jsonResponse({ error: 'Manifest lacks the exact reviewed DEMO draft text/hash' }, 409);
  }
  const recalculatedReviewedDemoDraftTextHash = await digestHex(
    'SHA-256',
    new TextEncoder().encode(reviewedDemoDraftText),
  );
  if (recalculatedReviewedDemoDraftTextHash !== reviewedDemoDraftTextHash) {
    return jsonResponse({ error: 'Reviewed DEMO draft text SHA-256 verification failed' }, 409);
  }

  // An immutable final artifact is a historical binary, not a request to run
  // today's renderer again.  Reuse is allowed only after independently
  // revalidating its manifest binding, metadata and exact private-storage
  // bytes.  Any drift is terminal: this branch never renders, uploads or
  // attempts to repair the artifact in place.
  const { data: existingData, error: existingError } = await admin
    .from('attachments')
    .select([
      'id',
      'file_name',
      'file_url',
      'file_hash',
      'file_hash_sha512',
      'agenda_item_index',
      'artifact_verified_at',
      'artifact_verified_by_service',
      'artifact_verified_size_bytes',
      'artifact_verified_mime_type',
      'artifact_candidate_id',
      'convocation_manifest_hash_sha512',
    ].join(', '))
    .eq('tenant_id', tenantId)
    .eq('convocatoria_id', convocatoriaId)
    .eq('artifact_kind', 'CONVOCATORIA_FINAL')
    .limit(2);
  if (existingError) return jsonResponse({ error: existingError.message }, 409);
  const existingRows = (existingData ?? []) as ExistingAttachmentRow[];
  if (existingRows.length > 1) {
    return jsonResponse({
      error: 'Convocatoria has multiple immutable final artifacts; manual consistency repair required',
    }, 409);
  }
  const existing = existingRows[0] ?? null;
  if (existing) {
    let existingStoragePath: string;
    try {
      existingStoragePath = existingArtifactStoragePath(
        existing,
        convocatoriaId,
        storedManifestHash,
      );
      const storedBytesMatch = await assertStoredBytesMatch(
        admin,
        existingStoragePath,
        String(existing.file_hash).toLowerCase(),
        String(existing.file_hash_sha512).toLowerCase(),
        Number(existing.artifact_verified_size_bytes),
        DOCX_MIME,
      );
      if (!storedBytesMatch) {
        return jsonResponse({ error: 'Existing immutable artifact binary is missing from private custody' }, 409);
      }
    } catch (error) {
      return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 409);
    }

    const { data: signedDownload, error: signedDownloadError } = await admin.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(existingStoragePath, 120);
    if (signedDownloadError || !signedDownload?.signedUrl) {
      return jsonResponse({ error: signedDownloadError?.message ?? 'Private download URL unavailable' }, 500);
    }

    return jsonResponse({
      attachment: {
        id: existing.id,
        file_name: existing.file_name,
        file_url: existing.file_url,
        file_hash: String(existing.file_hash).toLowerCase(),
        file_hash_sha512: String(existing.file_hash_sha512).toLowerCase(),
        artifact_kind: 'CONVOCATORIA_FINAL',
        agenda_item_index: null,
        artifact_verified_at: existing.artifact_verified_at,
        artifact_verified_by_service: true,
        artifact_verified_size_bytes: Number(existing.artifact_verified_size_bytes),
        artifact_verified_mime_type: DOCX_MIME,
        manifest_hash_sha512: storedManifestHash,
      },
      download_url: signedDownload.signedUrl,
      reused: true,
    });
  }

  let rendered: ReturnType<typeof renderConvocationDocx>;
  try {
    rendered = renderConvocationDocx(canonicalManifest, storedManifestHash);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 409);
  }
  if (rendered.bytes.byteLength <= 0 || rendered.bytes.byteLength > MAX_BYTES) {
    return jsonResponse({ error: 'Rendered DOCX size is outside the allowed range' }, 422);
  }
  const [binaryHashSha256, binaryHashSha512] = await Promise.all([
    digestHex('SHA-256', rendered.bytes),
    digestHex('SHA-512', rendered.bytes),
  ]);
  const storagePath = `convocatorias/${convocatoriaId}/authoritative/${storedManifestHash.slice(0, 20)}-${binaryHashSha256.slice(0, 20)}.docx`;
  const storageUri = `evidence-bundle://${storagePath}`;

  let storageExists = false;
  try {
    storageExists = await assertStoredBytesMatch(
      admin,
      storagePath,
      binaryHashSha256,
      binaryHashSha512,
      rendered.bytes.byteLength,
      DOCX_MIME,
    );
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 409);
  }
  if (!storageExists) {
    const { error: uploadError } = await admin.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, exactArrayBuffer(rendered.bytes), {
        contentType: DOCX_MIME,
        upsert: false,
      });
    if (uploadError) {
      try {
        const appearedConcurrently = await assertStoredBytesMatch(
          admin,
          storagePath,
          binaryHashSha256,
          binaryHashSha512,
          rendered.bytes.byteLength,
          DOCX_MIME,
        );
        if (!appearedConcurrently) return jsonResponse({ error: uploadError.message }, 409);
      } catch (error) {
        return jsonResponse({ error: error instanceof Error ? error.message : String(error) }, 409);
      }
    }
  }

  const { data: attachmentId, error: registrationError } = await admin.rpc(
    'fn_register_server_rendered_convocation_attachment',
    {
      p_tenant_id: tenantId,
      p_convocatoria_id: convocatoriaId,
      p_manifest_hash_sha512: storedManifestHash,
      p_file_name: rendered.fileName,
      p_storage_uri: storageUri,
      p_hash_sha256: binaryHashSha256,
      p_hash_sha512: binaryHashSha512,
      p_size_bytes: rendered.bytes.byteLength,
      p_mime_type: DOCX_MIME,
    },
  );
  if (registrationError || !attachmentId) {
    return jsonResponse({ error: registrationError?.message ?? 'Authoritative registration failed' }, 409);
  }

  const { data: signedDownload, error: signedDownloadError } = await admin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storagePath, 120);
  if (signedDownloadError || !signedDownload?.signedUrl) {
    return jsonResponse({ error: signedDownloadError?.message ?? 'Private download URL unavailable' }, 500);
  }

  return jsonResponse({
    attachment: {
      id: attachmentId,
      file_name: rendered.fileName,
      file_url: storageUri,
      file_hash: binaryHashSha256,
      file_hash_sha512: binaryHashSha512,
      artifact_kind: 'CONVOCATORIA_FINAL',
      agenda_item_index: null,
      artifact_verified_at: new Date().toISOString(),
      artifact_verified_by_service: true,
      artifact_verified_size_bytes: rendered.bytes.byteLength,
      artifact_verified_mime_type: DOCX_MIME,
      manifest_hash_sha512: storedManifestHash,
    },
    download_url: signedDownload.signedUrl,
    reused: storageExists,
  });
});
