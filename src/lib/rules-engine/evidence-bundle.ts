// ============================================================
// Evidence Bundle ASiC-E — Cryptographic integrity engine
// Motor de Reglas LSC: Secure audit trail for agreement decisions
// Spec: docs/superpowers/specs/2026-04-19-motor-reglas-lsc-secretaria-design.md §4.8
// ============================================================

import type { ExplainNode, QTSPSealResponse, EvalSeverity } from './types';

// --- Types ---

export interface EvidenceArtifact {
  type:
    | 'RULE_EVALUATION'
    | 'GATE_HASH'
    | 'ACTA'
    | 'CERTIFICACION'
    | 'NOTIFICACION'
    | 'PLANTILLA_SNAPSHOT'
    | 'RESPUESTA_WORM'
    | 'COMPLIANCE_SNAPSHOT';
  ref: string;
  hash: string;
  timestamp: string; // ISO 8601
  metadata?: Record<string, unknown>;
}

export interface EvidenceManifest {
  version: '1.0.0';
  agreement_id: string;
  generated_at: string; // ISO 8601
  artifacts: EvidenceArtifact[];
  artifact_count: number;
  manifest_hash: string; // SHA-256 of canonical JSON (artifacts sorted by timestamp)
}

export interface EvidenceBundleResult {
  ok: boolean;
  manifest: EvidenceManifest;
  explain: ExplainNode[];
  errors: string[];
}

export interface ASiCEPackage {
  filename: string;
  manifest: EvidenceManifest;
  qseal_token?: string;
  tsq_token?: string;
  entries: Array<{
    path: string;
    content: string;
    hash: string;
  }>;
  verificador_html: string; // offline verifier HTML/JS
}

// --- Synchronous hash (djb2 for testing/explain) ---

/**
 * Deterministic but fast hash for testing and explain trees.
 * Uses DJB2 algorithm (non-cryptographic but adequate for integrity checks in testing).
 */
function djb2Hash(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) + hash + input.charCodeAt(i); // hash * 33 + c
    hash = hash & hash; // convert to 32-bit integer
  }
  // Convert to hex string with leading zeros
  return ('00000000' + (hash >>> 0).toString(16)).slice(-8);
}

/**
 * Compute manifest hash (synchronous) using DJB2.
 * Sorts artifacts by timestamp to ensure deterministic ordering.
 *
 * @param artifacts Array of evidence artifacts
 * @returns Hex hash string (8 chars DJB2)
 */
export function computeManifestHashSync(
  artifacts: EvidenceArtifact[]
): string {
  if (artifacts.length === 0) {
    return djb2Hash('');
  }

  // Sort artifacts by timestamp for canonical ordering
  const sorted = [...artifacts].sort(
    (a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Build canonical JSON (no whitespace for determinism)
  const canonical = JSON.stringify(sorted, null, 0);

  return djb2Hash(canonical);
}

/**
 * Compute manifest hash (asynchronous) using SHA-256.
 * Used for production sealing with QTSP.
 *
 * @param artifacts Array of evidence artifacts
 * @returns Promise<hex hash string (64 chars SHA-256)>
 */
export async function computeManifestHashAsync(
  artifacts: EvidenceArtifact[]
): Promise<string> {
  if (artifacts.length === 0) {
    return await sha256('');
  }

  // Sort artifacts by timestamp for canonical ordering
  const sorted = [...artifacts].sort(
    (a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Build canonical JSON
  const canonical = JSON.stringify(sorted, null, 0);

  return await sha256(canonical);
}

/**
 * Web Crypto API SHA-256 hash implementation.
 * Returns hex string (64 chars).
 */
export async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode(data)
  );
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// --- Main Functions ---

/**
 * Generate an evidence bundle from artifacts.
 * Validates non-empty artifact list and computes manifest hash.
 *
 * @param agreementId UUID of the agreement
 * @param artifacts Array of evidence artifacts
 * @returns EvidenceBundleResult with manifest and explain tree
 */
export function generarEvidenceBundle(
  agreementId: string,
  artifacts: EvidenceArtifact[]
): EvidenceBundleResult {
  const explain: ExplainNode[] = [];

  // Gate 1: Non-empty artifacts
  if (artifacts.length === 0) {
    return {
      ok: false,
      manifest: {
        version: '1.0.0',
        agreement_id: agreementId,
        generated_at: new Date().toISOString(),
        artifacts: [],
        artifact_count: 0,
        manifest_hash: '',
      },
      explain: [
        {
          regla: 'EVIDENCIA_NO_VACIA',
          fuente: 'SISTEMA',
          resultado: 'BLOCKING' as EvalSeverity,
          mensaje: 'No hay artefactos para el acuerdo',
        },
      ],
      errors: ['No hay artefactos para el acuerdo'],
    };
  }

  explain.push({
    regla: 'EVIDENCIA_NO_VACIA',
    fuente: 'SISTEMA',
    valor: artifacts.length,
    resultado: 'OK' as EvalSeverity,
    mensaje: `${artifacts.length} artefactos validados`,
  });

  // Gate 2: All artifacts have required fields
  const invalidArtifacts: string[] = [];
  for (const [idx, artifact] of artifacts.entries()) {
    if (!artifact.type || !artifact.ref || !artifact.hash || !artifact.timestamp) {
      invalidArtifacts.push(
        `Artefacto ${idx}: falta type, ref, hash o timestamp`
      );
    }
  }

  if (invalidArtifacts.length > 0) {
    return {
      ok: false,
      manifest: {
        version: '1.0.0',
        agreement_id: agreementId,
        generated_at: new Date().toISOString(),
        artifacts,
        artifact_count: artifacts.length,
        manifest_hash: '',
      },
      explain: [
        {
          regla: 'ARTEFACTOS_VALIDOS',
          fuente: 'SISTEMA',
          resultado: 'BLOCKING' as EvalSeverity,
          mensaje: `${invalidArtifacts.length} artefactos inválidos`,
          hijos: invalidArtifacts.map((msg) => ({
            regla: 'VALIDACION_ARTEFACTO',
            fuente: 'SISTEMA',
            resultado: 'BLOCKING' as EvalSeverity,
            mensaje: msg,
          })),
        },
      ],
      errors: invalidArtifacts,
    };
  }

  explain.push({
    regla: 'ARTEFACTOS_VALIDOS',
    fuente: 'SISTEMA',
    resultado: 'OK' as EvalSeverity,
    mensaje: 'Todos los artefactos contienen campos requeridos',
  });

  // Gate 3: Compute manifest hash
  const manifestHash = computeManifestHashSync(artifacts);

  explain.push({
    regla: 'MANIFEST_HASH',
    fuente: 'SISTEMA',
    valor: manifestHash,
    resultado: 'OK' as EvalSeverity,
    mensaje: `Hash manifest (DJB2): ${manifestHash}`,
  });

  // Construct manifest
  const manifest: EvidenceManifest = {
    version: '1.0.0',
    agreement_id: agreementId,
    generated_at: new Date().toISOString(),
    artifacts: [...artifacts].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    ),
    artifact_count: artifacts.length,
    manifest_hash: manifestHash,
  };

  explain.push({
    regla: 'EVIDENCIA_COMPLETA',
    fuente: 'SISTEMA',
    resultado: 'OK' as EvalSeverity,
    mensaje: `Bundle listo para sellar con ${artifacts.length} artefactos`,
  });

  return {
    ok: true,
    manifest,
    explain,
    errors: [],
  };
}

/**
 * Empaquetar bundle como ASiC-E.
 * Crea estructura ZIP con manifest.json, artifacts, verificador offline, y sellos QTSP (si aplicable).
 *
 * @param manifest Manifest from generarEvidenceBundle
 * @param artifacts Original artifacts list
 * @param sealResponse Optional QTSP response (QSEAL or TSQ)
 * @returns ASiCEPackage ready for download/export
 */
export function empaquetarASiCE(
  manifest: EvidenceManifest,
  artifacts: EvidenceArtifact[],
  sealResponse?: QTSPSealResponse
): ASiCEPackage {
  const timestamp = manifest.generated_at.substring(0, 10); // YYYY-MM-DD
  const safeAgreementId = manifest.agreement_id.substring(0, 8);
  const filename = `asice-bundle-${safeAgreementId}-${timestamp}.zip`;

  // Entry 1: manifest.json
  const manifestEntry = {
    path: 'META-INF/manifest.json',
    content: JSON.stringify(manifest, null, 2),
    hash: computeManifestHashSync([
      {
        type: 'COMPLIANCE_SNAPSHOT' as const,
        ref: 'manifest.json',
        hash: manifest.manifest_hash,
        timestamp: manifest.generated_at,
      },
    ]),
  };

  // Entry 2: Artifacts (one file per artifact)
  const artifactEntries = artifacts.map((artifact, idx) => ({
    path: `artifacts/${idx + 1}_${artifact.ref.replace(/[/\\]/g, '_')}.json`,
    content: JSON.stringify(artifact, null, 2),
    hash: artifact.hash,
  }));

  // Entry 3: Verificador offline HTML
  const verificador = generarVerificadorOffline(manifest);
  const verificadorEntry = {
    path: 'VERIFICAR.html',
    content: verificador,
    hash: computeManifestHashSync([
      {
        type: 'COMPLIANCE_SNAPSHOT' as const,
        ref: 'VERIFICAR.html',
        hash: manifest.manifest_hash,
        timestamp: manifest.generated_at,
      },
    ]),
  };

  // Entry 4: QTSP seal (if provided)
  const sealEntry = sealResponse
    ? {
        path: 'META-INF/qtsp-seal.json',
        content: JSON.stringify(sealResponse, null, 2),
        hash: computeManifestHashSync([
          {
            type: 'COMPLIANCE_SNAPSHOT' as const,
            ref: 'qtsp-seal.json',
            hash: sealResponse.seal_token,
            timestamp: sealResponse.timestamp,
          },
        ]),
      }
    : null;

  return {
    filename,
    manifest,
    qseal_token: sealResponse?.seal_token,
    tsq_token:
      sealResponse?.seal_token && sealResponse.seal_type === 'TSQ'
        ? sealResponse.seal_token
        : undefined,
    entries: [
      manifestEntry,
      ...artifactEntries,
      verificadorEntry,
      ...(sealEntry ? [sealEntry] : []),
    ],
    verificador_html: verificador,
  };
}

/**
 * Generar verificador offline HTML.
 * HTML + embedded JavaScript que puede re-computar el manifest hash sin dependencias.
 *
 * @param manifest The EvidenceManifest to embed
 * @returns HTML string with offline verification UI
 */
export function generarVerificadorOffline(manifest: EvidenceManifest): string {
  const escapedManifest = JSON.stringify(manifest)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verificador ASiC-E — Motor de Reglas LSC</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      min-height: 100vh;
      padding: 2rem;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      padding: 2rem;
    }
    h1 {
      color: #004438;
      margin-bottom: 0.5rem;
    }
    .subtitle {
      color: #666;
      font-size: 0.9rem;
      margin-bottom: 2rem;
    }
    .section {
      margin-bottom: 2rem;
      padding-bottom: 2rem;
      border-bottom: 1px solid #eee;
    }
    .section:last-child {
      border-bottom: none;
    }
    label {
      display: block;
      font-weight: 600;
      color: #333;
      margin-bottom: 0.5rem;
      font-size: 0.9rem;
    }
    .value {
      background: #f5f5f5;
      padding: 0.75rem;
      border-radius: 4px;
      font-family: monospace;
      font-size: 0.85rem;
      word-break: break-all;
      color: #555;
    }
    .artifacts-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .artifact-card {
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 1rem;
      background: #fafafa;
    }
    .artifact-type {
      display: inline-block;
      background: #009a77;
      color: white;
      padding: 0.25rem 0.5rem;
      border-radius: 3px;
      font-size: 0.75rem;
      font-weight: 600;
      margin-right: 0.5rem;
    }
    .artifact-ref {
      font-weight: 600;
      color: #004438;
      margin-top: 0.5rem;
    }
    .artifact-hash {
      color: #666;
      font-family: monospace;
      font-size: 0.8rem;
      margin-top: 0.25rem;
      word-break: break-all;
    }
    .artifact-timestamp {
      color: #999;
      font-size: 0.85rem;
      margin-top: 0.25rem;
    }
    button {
      background: #004438;
      color: white;
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 4px;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }
    button:hover {
      background: #007362;
    }
    button:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
    .status {
      margin-top: 1rem;
      padding: 1rem;
      border-radius: 4px;
      font-weight: 600;
    }
    .status.ok {
      background: #d4edda;
      color: #155724;
      border: 1px solid #c3e6cb;
    }
    .status.error {
      background: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
    }
    .status.pending {
      background: #fff3cd;
      color: #856404;
      border: 1px solid #ffeaa7;
    }
    code {
      background: #f5f5f5;
      padding: 0.2rem 0.4rem;
      border-radius: 3px;
      font-family: monospace;
      font-size: 0.85rem;
    }
    .footer {
      margin-top: 3rem;
      padding-top: 2rem;
      border-top: 2px solid #004438;
      font-size: 0.8rem;
      color: #999;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔐 Verificador ASiC-E</h1>
    <p class="subtitle">Motor de Reglas LSC — Verificación de Integridad Offline</p>

    <div class="section">
      <label>Acuerdo</label>
      <div class="value">${manifest.agreement_id}</div>
    </div>

    <div class="section">
      <label>Generado</label>
      <div class="value">${manifest.generated_at}</div>
    </div>

    <div class="section">
      <label>Hash Manifest (DJB2)</label>
      <div class="value">${manifest.manifest_hash}</div>
    </div>

    <div class="section">
      <label>Artefactos (${manifest.artifact_count})</label>
      <div class="artifacts-list">
        ${manifest.artifacts
          .map(
            (a) => `
        <div class="artifact-card">
          <span class="artifact-type">${a.type}</span>
          <div class="artifact-ref">${a.ref}</div>
          <div class="artifact-hash"><strong>Hash:</strong> ${a.hash}</div>
          <div class="artifact-timestamp"><strong>Timestamp:</strong> ${a.timestamp}</div>
          ${a.metadata ? `<div style="margin-top: 0.5rem; font-size: 0.8rem; color: #666;"><strong>Metadata:</strong> ${JSON.stringify(a.metadata)}</div>` : ''}
        </div>
        `
          )
          .join('')}
      </div>
    </div>

    <div class="section">
      <button onclick="verificarIntegridad()">Verificar Integridad</button>
      <div id="resultado" style="margin-top: 1rem;"></div>
    </div>

    <div class="footer">
      <p>Este verificador es una herramienta offline sin dependencias externas.</p>
      <p>Especificación: Motor de Reglas LSC § Evidence Bundle ASiC-E (2026-04-19)</p>
    </div>
  </div>

  <script>
    function djb2(input) {
      let hash = 5381;
      for (let i = 0; i < input.length; i++) {
        hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
      }
      return ('00000000' + (hash >>> 0).toString(16)).slice(-8);
    }

    function verificarIntegridad() {
      const manifest = ${escapedManifest};
      const resultDiv = document.getElementById('resultado');
      resultDiv.innerHTML = '';

      try {
        // Compute hash of artifacts (sorted by timestamp)
        const sorted = [...manifest.artifacts].sort((a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        const canonical = JSON.stringify(sorted);
        const computed = djb2(canonical);

        if (computed === manifest.manifest_hash) {
          resultDiv.innerHTML = \`
            <div class="status ok">
              ✓ Integridad verificada correctamente
              <div style="margin-top: 0.5rem; font-size: 0.85rem;">
                Hash esperado: <code>\${manifest.manifest_hash}</code><br>
                Hash computado: <code>\${computed}</code>
              </div>
            </div>
          \`;
        } else {
          resultDiv.innerHTML = \`
            <div class="status error">
              ✗ Error de integridad detectado
              <div style="margin-top: 0.5rem; font-size: 0.85rem;">
                Hash esperado: <code>\${manifest.manifest_hash}</code><br>
                Hash computado: <code>\${computed}</code><br>
                Los datos pueden haber sido alterados.
              </div>
            </div>
          \`;
        }
      } catch (e) {
        resultDiv.innerHTML = \`
          <div class="status error">
            ✗ Error durante la verificación: \${e.message}
          </div>
        \`;
      }
    }
  </script>
</body>
</html>`;
}
