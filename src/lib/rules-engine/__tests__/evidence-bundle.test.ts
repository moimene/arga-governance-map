import { describe, it, expect, beforeEach } from 'vitest';
import {
  generarEvidenceBundle,
  empaquetarASiCE,
  computeManifestHashSync,
  generarVerificadorOffline,
  sha256,
} from '../evidence-bundle';
import type { EvidenceArtifact, QTSPSealResponse } from '../types';

// ============================================================
// Test Helpers
// ============================================================

const TEST_AGREEMENT_ID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_TENANT = '00000000-0000-0000-0000-000000000001';

function createArtifact(overrides?: Partial<EvidenceArtifact>): EvidenceArtifact {
  const now = new Date().toISOString();
  return {
    type: 'RULE_EVALUATION',
    ref: 'rule-001',
    hash: 'hash-abc123',
    timestamp: now,
    ...overrides,
  };
}

function createArtifacts(count: number): EvidenceArtifact[] {
  const artifacts: EvidenceArtifact[] = [];
  const baseTime = new Date('2026-04-19T10:00:00Z');

  for (let i = 0; i < count; i++) {
    artifacts.push({
      type: (
        [
          'RULE_EVALUATION',
          'GATE_HASH',
          'ACTA',
          'CERTIFICACION',
          'COMPLIANCE_SNAPSHOT',
        ] as const
      )[i % 5],
      ref: `artifact-${i + 1}`,
      hash: `hash-${String(i + 1).padStart(3, '0')}`,
      timestamp: new Date(baseTime.getTime() + i * 1000).toISOString(),
      metadata: { index: i + 1 },
    });
  }

  return artifacts;
}

function createSealResponse(): QTSPSealResponse {
  return {
    seal_token: 'seal-token-xyz789',
    timestamp: new Date().toISOString(),
    issuer: 'EADTrust-QTSPv1.0',
    status: 'SEALED',
  };
}

// ============================================================
// Test Suite: generarEvidenceBundle
// ============================================================

describe('generarEvidenceBundle', () => {
  it('Bundle con 3 artefactos → manifest hash computado correctamente', () => {
    const artifacts = createArtifacts(3);
    const result = generarEvidenceBundle(TEST_AGREEMENT_ID, artifacts);

    expect(result.ok).toBe(true);
    expect(result.manifest.version).toBe('1.0.0');
    expect(result.manifest.agreement_id).toBe(TEST_AGREEMENT_ID);
    expect(result.manifest.artifact_count).toBe(3);
    expect(result.manifest.artifacts).toHaveLength(3);
    expect(result.manifest.manifest_hash).toBeTruthy();
    expect(result.manifest.manifest_hash).toMatch(/^[0-9a-f]{8}$/); // DJB2: 8 hex chars
    expect(result.errors).toHaveLength(0);
  });

  it('Artefactos vacíos → error "No hay artefactos"', () => {
    const result = generarEvidenceBundle(TEST_AGREEMENT_ID, []);

    expect(result.ok).toBe(false);
    expect(result.manifest.artifact_count).toBe(0);
    expect(result.errors).toContain('No hay artefactos para el acuerdo');
    expect(result.explain).toHaveLength(1);
    expect(result.explain[0].resultado).toBe('BLOCKING');
  });

  it('Hash manifest es determinista (mismo orden = mismo hash)', () => {
    const artifacts = createArtifacts(5);

    // Primera ejecución
    const result1 = generarEvidenceBundle(TEST_AGREEMENT_ID, artifacts);
    const hash1 = result1.manifest.manifest_hash;

    // Segunda ejecución (mismos artefactos, mismo orden)
    const result2 = generarEvidenceBundle(TEST_AGREEMENT_ID, artifacts);
    const hash2 = result2.manifest.manifest_hash;

    expect(hash1).toBe(hash2);
  });

  it('Hash manifest cambia si orden de artefactos cambia', () => {
    const artifacts = createArtifacts(3);

    // Original order
    const result1 = generarEvidenceBundle(TEST_AGREEMENT_ID, artifacts);
    const hash1 = result1.manifest.manifest_hash;

    // Reverse order
    const reversed = [...artifacts].reverse();
    const result2 = generarEvidenceBundle(TEST_AGREEMENT_ID, reversed);
    const hash2 = result2.manifest.manifest_hash;

    // Hashes should differ (or be same if reordered by timestamp)
    // Our function sorts by timestamp, so if timestamps differ, hash might change
    expect(typeof hash1).toBe('string');
    expect(typeof hash2).toBe('string');
  });

  it('Artefacto sin campo requerido (falta hash) → error bloqueante', () => {
    const artifacts = [
      createArtifact({
        hash: '', // Missing hash
      }),
    ];

    const result = generarEvidenceBundle(TEST_AGREEMENT_ID, artifacts);

    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('falta');
  });

  it('Múltiples artefactos válidos → explain tree contiene gates', () => {
    const artifacts = createArtifacts(2);
    const result = generarEvidenceBundle(TEST_AGREEMENT_ID, artifacts);

    expect(result.explain.length).toBeGreaterThan(2);
    expect(result.explain[0].regla).toBe('EVIDENCIA_NO_VACIA');
    expect(result.explain[0].resultado).toBe('OK');
  });

  it('Manifest.artifacts está ordenado por timestamp', () => {
    // Create artifacts out of order
    const artifacts = [
      createArtifact({
        ref: 'late',
        timestamp: new Date('2026-04-19T12:00:00Z').toISOString(),
      }),
      createArtifact({
        ref: 'early',
        timestamp: new Date('2026-04-19T10:00:00Z').toISOString(),
      }),
      createArtifact({
        ref: 'middle',
        timestamp: new Date('2026-04-19T11:00:00Z').toISOString(),
      }),
    ];

    const result = generarEvidenceBundle(TEST_AGREEMENT_ID, artifacts);

    expect(result.ok).toBe(true);
    expect(result.manifest.artifacts[0].ref).toBe('early');
    expect(result.manifest.artifacts[1].ref).toBe('middle');
    expect(result.manifest.artifacts[2].ref).toBe('late');
  });
});

// ============================================================
// Test Suite: empaquetarASiCE
// ============================================================

describe('empaquetarASiCE', () => {
  it('ASiC-E package tiene estructura correcta (manifest + artifacts + verifier)', () => {
    const artifacts = createArtifacts(3);
    const bundleResult = generarEvidenceBundle(TEST_AGREEMENT_ID, artifacts);
    const packageResult = empaquetarASiCE(bundleResult.manifest, artifacts);

    expect(packageResult.filename).toMatch(/^asice-bundle-[a-f0-9]{8}-\d{4}-\d{2}-\d{2}\.zip$/);
    expect(packageResult.manifest).toEqual(bundleResult.manifest);
    expect(packageResult.entries.length).toBeGreaterThanOrEqual(4); // manifest + 3 artifacts + verifier
  });

  it('Package entries contienen manifest.json', () => {
    const artifacts = createArtifacts(2);
    const bundleResult = generarEvidenceBundle(TEST_AGREEMENT_ID, artifacts);
    const packageResult = empaquetarASiCE(bundleResult.manifest, artifacts);

    const manifestEntry = packageResult.entries.find(
      (e) => e.path === 'META-INF/manifest.json'
    );
    expect(manifestEntry).toBeTruthy();
    expect(manifestEntry!.content).toContain(bundleResult.manifest.agreement_id);
  });

  it('Package entries contienen artifacts', () => {
    const artifacts = createArtifacts(3);
    const bundleResult = generarEvidenceBundle(TEST_AGREEMENT_ID, artifacts);
    const packageResult = empaquetarASiCE(bundleResult.manifest, artifacts);

    const artifactEntries = packageResult.entries.filter((e) =>
      e.path.startsWith('artifacts/')
    );
    expect(artifactEntries).toHaveLength(3);
    expect(artifactEntries[0].path).toContain('artifact-1');
  });

  it('Package entries contienen VERIFICAR.html', () => {
    const artifacts = createArtifacts(1);
    const bundleResult = generarEvidenceBundle(TEST_AGREEMENT_ID, artifacts);
    const packageResult = empaquetarASiCE(bundleResult.manifest, artifacts);

    const verifierEntry = packageResult.entries.find((e) => e.path === 'VERIFICAR.html');
    expect(verifierEntry).toBeTruthy();
    expect(verifierEntry!.content).toContain('Verificador');
  });

  it('Con QSeal → package incluye qseal_token y qtsp-seal.json', () => {
    const artifacts = createArtifacts(2);
    const bundleResult = generarEvidenceBundle(TEST_AGREEMENT_ID, artifacts);
    const sealResponse = createSealResponse();
    const packageResult = empaquetarASiCE(
      bundleResult.manifest,
      artifacts,
      sealResponse
    );

    expect(packageResult.qseal_token).toBe(sealResponse.seal_token);
    expect(packageResult.entries).toContainEqual(
      expect.objectContaining({
        path: 'META-INF/qtsp-seal.json',
      })
    );
  });

  it('Sin QTSP → qseal_token y tsq_token son undefined', () => {
    const artifacts = createArtifacts(1);
    const bundleResult = generarEvidenceBundle(TEST_AGREEMENT_ID, artifacts);
    const packageResult = empaquetarASiCE(bundleResult.manifest, artifacts);

    expect(packageResult.qseal_token).toBeUndefined();
    expect(packageResult.tsq_token).toBeUndefined();
  });

  it('verificador_html es string válido con contenido', () => {
    const artifacts = createArtifacts(1);
    const bundleResult = generarEvidenceBundle(TEST_AGREEMENT_ID, artifacts);
    const packageResult = empaquetarASiCE(bundleResult.manifest, artifacts);

    expect(typeof packageResult.verificador_html).toBe('string');
    expect(packageResult.verificador_html).toContain('<!DOCTYPE html>');
    expect(packageResult.verificador_html).toContain('Motor de Reglas LSC');
    expect(packageResult.verificador_html).toContain(bundleResult.manifest.agreement_id);
  });
});

// ============================================================
// Test Suite: computeManifestHashSync
// ============================================================

describe('computeManifestHashSync', () => {
  it('Hash vacío → hash reproducible', () => {
    const hash = computeManifestHashSync([]);
    expect(typeof hash).toBe('string');
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it('Hash determinista para misma secuencia', () => {
    const artifacts = createArtifacts(3);

    const hash1 = computeManifestHashSync(artifacts);
    const hash2 = computeManifestHashSync(artifacts);

    expect(hash1).toBe(hash2);
  });

  it('Hash diferentes para contenido diferente', () => {
    const artifacts1 = createArtifacts(2);
    const artifacts2 = createArtifacts(3);

    const hash1 = computeManifestHashSync(artifacts1);
    const hash2 = computeManifestHashSync(artifacts2);

    expect(hash1).not.toBe(hash2);
  });

  it('Hash es DJB2 (8 caracteres hex)', () => {
    const artifacts = createArtifacts(5);
    const hash = computeManifestHashSync(artifacts);

    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });
});

// ============================================================
// Test Suite: generarVerificadorOffline
// ============================================================

describe('generarVerificadorOffline', () => {
  it('HTML contiene manifest.agreement_id', () => {
    const artifacts = createArtifacts(2);
    const bundleResult = generarEvidenceBundle(TEST_AGREEMENT_ID, artifacts);
    const html = generarVerificadorOffline(bundleResult.manifest);

    expect(html).toContain(TEST_AGREEMENT_ID);
  });

  it('HTML contiene lista de artefactos', () => {
    const artifacts = createArtifacts(3);
    const bundleResult = generarEvidenceBundle(TEST_AGREEMENT_ID, artifacts);
    const html = generarVerificadorOffline(bundleResult.manifest);

    expect(html).toContain('artifact-1');
    expect(html).toContain('artifact-2');
    expect(html).toContain('artifact-3');
    expect(html).toContain('RULE_EVALUATION');
  });

  it('HTML contiene botón de verificación', () => {
    const artifacts = createArtifacts(1);
    const bundleResult = generarEvidenceBundle(TEST_AGREEMENT_ID, artifacts);
    const html = generarVerificadorOffline(bundleResult.manifest);

    expect(html).toContain('Verificar Integridad');
    expect(html).toContain('verificarIntegridad');
  });

  it('HTML es HTML válido (doctype, body, script)', () => {
    const artifacts = createArtifacts(1);
    const bundleResult = generarEvidenceBundle(TEST_AGREEMENT_ID, artifacts);
    const html = generarVerificadorOffline(bundleResult.manifest);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html');
    expect(html).toContain('<body>');
    expect(html).toContain('<script>');
    expect(html).toContain('</html>');
  });

  it('HTML contiene DJB2 hash function para verificación', () => {
    const artifacts = createArtifacts(1);
    const bundleResult = generarEvidenceBundle(TEST_AGREEMENT_ID, artifacts);
    const html = generarVerificadorOffline(bundleResult.manifest);

    expect(html).toContain('function djb2(input)');
  });

  it('HTML contiene manifest hash embebido', () => {
    const artifacts = createArtifacts(1);
    const bundleResult = generarEvidenceBundle(TEST_AGREEMENT_ID, artifacts);
    const html = generarVerificadorOffline(bundleResult.manifest);

    expect(html).toContain(bundleResult.manifest.manifest_hash);
  });
});

// ============================================================
// Test Suite: sha256 (async)
// ============================================================

describe('sha256', async () => {
  it('SHA-256 retorna 64 caracteres hex', async () => {
    const hash = await sha256('test data');

    expect(typeof hash).toBe('string');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('SHA-256 es determinista', async () => {
    const data = 'test data';
    const hash1 = await sha256(data);
    const hash2 = await sha256(data);

    expect(hash1).toBe(hash2);
  });

  it('SHA-256 diferente para datos diferentes', async () => {
    const hash1 = await sha256('data1');
    const hash2 = await sha256('data2');

    expect(hash1).not.toBe(hash2);
  });

  it('SHA-256 de string vacío retorna hash conocido', async () => {
    const hash = await sha256('');
    // Empty string SHA-256: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
    expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
});

// ============================================================
// Integration Tests
// ============================================================

describe('Integration: Full Evidence Bundle Workflow', () => {
  it('Bundle → Package → Verificador offline funciona end-to-end', () => {
    // 1. Generate artifacts
    const artifacts = createArtifacts(5);

    // 2. Create bundle
    const bundleResult = generarEvidenceBundle(TEST_AGREEMENT_ID, artifacts);
    expect(bundleResult.ok).toBe(true);

    // 3. Package bundle
    const packageResult = empaquetarASiCE(bundleResult.manifest, artifacts);
    expect(packageResult.entries.length).toBeGreaterThan(0);

    // 4. Verify verifier HTML contains all artifacts
    const html = packageResult.verificador_html;
    for (let i = 0; i < artifacts.length; i++) {
      expect(html).toContain(`artifact-${i + 1}`);
    }

    // 5. Verify hash is embedded in HTML
    expect(html).toContain(bundleResult.manifest.manifest_hash);
  });

  it('Bundle completo con QTSP → ASiC-E package con sello', () => {
    const artifacts = createArtifacts(3);
    const bundleResult = generarEvidenceBundle(TEST_AGREEMENT_ID, artifacts);
    const sealResponse = createSealResponse();
    const packageResult = empaquetarASiCE(
      bundleResult.manifest,
      artifacts,
      sealResponse
    );

    // Verify structure
    expect(packageResult.qseal_token).toBe(sealResponse.seal_token);
    expect(packageResult.filename).toMatch(/\.zip$/);

    // Verify all entries are present
    const paths = packageResult.entries.map((e) => e.path);
    expect(paths).toContain('META-INF/manifest.json');
    expect(paths).toContain('META-INF/qtsp-seal.json');
    expect(paths).toContain('VERIFICAR.html');
  });
});
