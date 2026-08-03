// Verification boundary for user-selected supporting documents.  This is
// deliberately separate from the authoritative final convocatoria renderer.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const STORAGE_BUCKET = 'matter-documents';
const MAX_BYTES = 25 * 1024 * 1024;
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const ALLOWED_MIME = new Set(['application/pdf', DOCX_MIME]);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SupportingRequest {
  tenantId?: unknown;
  convocatoriaId?: unknown;
  agendaItemIndex?: unknown;
  fileName?: unknown;
  storageUri?: unknown;
  expectedHashSha256?: unknown;
  expectedHashSha512?: unknown;
  expectedMimeType?: unknown;
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

function hasPdfMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 5
    && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44
    && bytes[3] === 0x46 && bytes[4] === 0x2d;
}

function containsAscii(bytes: Uint8Array, needle: string): boolean {
  const encoded = new TextEncoder().encode(needle);
  outer: for (let offset = 0; offset <= bytes.length - encoded.length; offset += 1) {
    for (let index = 0; index < encoded.length; index += 1) {
      if (bytes[offset + index] !== encoded[index]) continue outer;
    }
    return true;
  }
  return false;
}

function hasDocxPackageMarkers(bytes: Uint8Array): boolean {
  return bytes.length >= 4
    && bytes[0] === 0x50 && bytes[1] === 0x4b
    && containsAscii(bytes, '[Content_Types].xml')
    && containsAscii(bytes, 'word/document.xml');
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

  let input: SupportingRequest;
  try {
    input = await req.json() as SupportingRequest;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return jsonResponse({ error: 'Request body must be an object' }, 400);
  }
  const unexpectedKeys = Object.keys(input as Record<string, unknown>).filter((key) => ![
    'tenantId',
    'convocatoriaId',
    'agendaItemIndex',
    'fileName',
    'storageUri',
    'expectedHashSha256',
    'expectedHashSha512',
    'expectedMimeType',
  ].includes(key));
  if (unexpectedKeys.length > 0) {
    return jsonResponse({ error: `Unsupported request fields: ${unexpectedKeys.join(', ')}` }, 400);
  }
  const tenantId = nonEmptyString(input.tenantId);
  const convocatoriaId = nonEmptyString(input.convocatoriaId);
  const fileName = nonEmptyString(input.fileName);
  const storageUri = nonEmptyString(input.storageUri);
  const expectedHashSha256 = nonEmptyString(input.expectedHashSha256)?.toLowerCase() ?? null;
  const expectedHashSha512 = nonEmptyString(input.expectedHashSha512)?.toLowerCase() ?? null;
  const expectedMimeType = nonEmptyString(input.expectedMimeType);
  const agendaItemIndex = Number.isInteger(input.agendaItemIndex)
    ? Number(input.agendaItemIndex)
    : null;
  if (!tenantId || !isUuid(tenantId) || !convocatoriaId || !isUuid(convocatoriaId)) {
    return jsonResponse({ error: 'tenantId and convocatoriaId must be UUIDs' }, 400);
  }
  if (!fileName || !storageUri || !expectedMimeType || !ALLOWED_MIME.has(expectedMimeType)) {
    return jsonResponse({ error: 'fileName, private storageUri and allowed MIME are required' }, 400);
  }
  if (!expectedHashSha256 || !/^[0-9a-f]{64}$/.test(expectedHashSha256)
      || !expectedHashSha512 || !/^[0-9a-f]{128}$/.test(expectedHashSha512)) {
    return jsonResponse({ error: 'Both expected hashes are required and must be valid' }, 400);
  }
  if (agendaItemIndex !== null && agendaItemIndex < 0) {
    return jsonResponse({ error: 'agendaItemIndex cannot be negative' }, 400);
  }
  if (
    (expectedMimeType === 'application/pdf' && !fileName.toLowerCase().endsWith('.pdf'))
    || (expectedMimeType === DOCX_MIME && !fileName.toLowerCase().endsWith('.docx'))
  ) {
    return jsonResponse({ error: 'fileName extension does not match declared MIME' }, 400);
  }
  const requiredPrefix = `evidence-bundle://convocatorias/${convocatoriaId}/`;
  if (!storageUri.startsWith(requiredPrefix)) {
    return jsonResponse({ error: 'Storage URI is outside the convocatoria prefix' }, 400);
  }
  const storagePath = storageUri.replace(/^evidence-bundle:\/\//, '');
  if (storagePath.includes('..') || storagePath.startsWith('/')) {
    return jsonResponse({ error: 'Storage path is invalid' }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const [{ data: profile, error: profileError }, { data: convocatoria, error: convocatoriaError }] = await Promise.all([
    admin.from('user_profiles').select('tenant_id').eq('user_id', user.id).maybeSingle(),
    admin.from('convocatorias').select('id, tenant_id').eq('id', convocatoriaId).maybeSingle(),
  ]);
  if (profileError || !profile?.tenant_id || profile.tenant_id !== tenantId) {
    return jsonResponse({ error: 'Tenant access denied' }, 403);
  }
  if (convocatoriaError || !convocatoria || convocatoria.tenant_id !== tenantId) {
    return jsonResponse({ error: 'Convocatoria/tenant mismatch' }, 403);
  }
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
  const authorizationTime = Date.now();
  const isOperator = ((roles ?? []) as RoleRow[]).some((row) =>
    row.is_active === true
    && (!row.expires_at || Date.parse(row.expires_at) > authorizationTime)
    && ['SECRETARIO', 'ADMIN_TENANT'].includes(row.rbac_roles?.role_code ?? '')
  );
  if (!isOperator) return jsonResponse({ error: 'SECRETARIO or ADMIN_TENANT required' }, 403);

  const { data: storedBinary, error: downloadError } = await admin.storage
    .from(STORAGE_BUCKET)
    .download(storagePath);
  if (downloadError || !storedBinary) {
    return jsonResponse({ error: `Private Storage object not found: ${downloadError?.message ?? 'empty object'}` }, 422);
  }
  if (storedBinary.size <= 0 || storedBinary.size > MAX_BYTES) {
    return jsonResponse({ error: `Stored binary size is outside 1..${MAX_BYTES} bytes` }, 422);
  }
  const bytes = new Uint8Array(await storedBinary.arrayBuffer());
  const magicMatches = expectedMimeType === 'application/pdf'
    ? hasPdfMagic(bytes)
    : hasDocxPackageMarkers(bytes);
  if (!magicMatches) return jsonResponse({ error: 'Stored binary magic does not match declared MIME' }, 422);
  const [actualHashSha256, actualHashSha512] = await Promise.all([
    digestHex('SHA-256', bytes),
    digestHex('SHA-512', bytes),
  ]);
  if (actualHashSha256 !== expectedHashSha256 || actualHashSha512 !== expectedHashSha512) {
    return jsonResponse({ error: 'Stored binary differs from the selected supporting document' }, 409);
  }

  const { data: attachmentId, error: registrationError } = await admin.rpc(
    'fn_register_verified_convocation_attachment',
    {
      p_tenant_id: tenantId,
      p_convocatoria_id: convocatoriaId,
      p_artifact_kind: 'SUPPORTING_DOCUMENT',
      p_agenda_item_index: agendaItemIndex,
      p_file_name: fileName,
      p_storage_uri: storageUri,
      p_hash_sha256: actualHashSha256,
      p_hash_sha512: actualHashSha512,
      p_size_bytes: bytes.byteLength,
      p_mime_type: expectedMimeType,
      p_storage_etag: null,
      p_candidate_id: null,
    },
  );
  if (registrationError || !attachmentId) {
    return jsonResponse({ error: registrationError?.message ?? 'Supporting document registration failed' }, 409);
  }
  return jsonResponse({
    attachment: {
      id: attachmentId,
      file_name: fileName,
      file_url: storageUri,
      file_hash: actualHashSha256,
      file_hash_sha512: actualHashSha512,
      artifact_kind: 'SUPPORTING_DOCUMENT',
      agenda_item_index: agendaItemIndex,
      artifact_verified_at: new Date().toISOString(),
      artifact_verified_by_service: true,
      artifact_verified_size_bytes: bytes.byteLength,
      artifact_verified_mime_type: expectedMimeType,
    },
  });
});
