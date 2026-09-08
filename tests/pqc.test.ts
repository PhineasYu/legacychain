import { describe, expect, it } from 'vitest';
import {
  canonicalizeProvenanceData,
  createPublicKeyRef,
  generatePQCKeyPair,
  signProvenance,
  verifyProvenance,
  type ProvenanceData,
} from '../lib/services/pqc';

const SEED = new Uint8Array(32).fill(7);

function makeData(overrides: Partial<ProvenanceData> = {}): ProvenanceData {
  return {
    heritageId: 'heritage-001',
    fileHash: '14b7e1c5d9b6299cca983160ab92a12651c9659ac502652d6ac1b3b02b6f5609',
    timestamp: '2026-01-15T10:00:00.000Z',
    guardian: 'Sara Abdi',
    ...overrides,
  };
}

describe('signProvenance', () => {
  const keyPair = generatePQCKeyPair(SEED);
  const publicKey = createPublicKeyRef(keyPair).publicKeyBase64;
  const data = makeData();
  const signature = signProvenance(data, keyPair.secretKey);

  it('produces a verifiable ML-DSA-44 signature', () => {
    expect(signature.algorithm).toBe('ML-DSA-44 (FIPS-204)');
    expect(signature.signatureBase64.length).toBeGreaterThan(0);
    expect(signature.signaturePreview.length).toBeGreaterThan(0);
    expect(verifyProvenance(data, signature.signatureBase64, publicKey)).toBe(true);
  });

  // Each field of the provenance claim must be bound by the signature —
  // otherwise a record could be re-pointed at a different file or guardian.
  it.each([
    ['file hash', { fileHash: 'deadbeef' }],
    ['guardian', { guardian: 'Someone Else' }],
    ['timestamp', { timestamp: '2027-01-01T00:00:00.000Z' }],
    ['heritage id', { heritageId: 'heritage-999' }],
  ])('fails verification when the %s is changed', (_label, override) => {
    const tampered = makeData(override as Partial<ProvenanceData>);
    expect(verifyProvenance(tampered, signature.signatureBase64, publicKey)).toBe(false);
  });

  it('fails verification with a different key', () => {
    const otherKey = createPublicKeyRef(
      generatePQCKeyPair(new Uint8Array(32).fill(9))
    ).publicKeyBase64;
    expect(verifyProvenance(data, signature.signatureBase64, otherKey)).toBe(false);
  });

  it('fails verification when the signature itself is corrupted', () => {
    const corrupted =
      signature.signatureBase64.slice(0, 20) +
      (signature.signatureBase64[20] === 'A' ? 'B' : 'A') +
      signature.signatureBase64.slice(21);
    expect(verifyProvenance(data, corrupted, publicKey)).toBe(false);
  });

  it('binds the parent version of a derived record', () => {
    const derived = makeData({ parentVersion: 'prov-001' });
    const derivedSignature = signProvenance(derived, keyPair.secretKey);

    expect(
      verifyProvenance(derived, derivedSignature.signatureBase64, publicKey)
    ).toBe(true);
    // Dropping the parent must invalidate it, or a derived version could be
    // passed off as an original.
    expect(
      verifyProvenance(makeData(), derivedSignature.signatureBase64, publicKey)
    ).toBe(false);
  });
});

describe('key management', () => {
  it('is deterministic for a given seed', () => {
    const a = createPublicKeyRef(generatePQCKeyPair(SEED)).publicKeyBase64;
    const b = createPublicKeyRef(generatePQCKeyPair(SEED)).publicKeyBase64;
    expect(a).toBe(b);
  });

  it('produces different keys for different seeds', () => {
    const a = createPublicKeyRef(generatePQCKeyPair(SEED)).publicKeyBase64;
    const b = createPublicKeyRef(
      generatePQCKeyPair(new Uint8Array(32).fill(9))
    ).publicKeyBase64;
    expect(a).not.toBe(b);
  });

  it('never exposes the secret key in a public key reference', () => {
    const keyPair = generatePQCKeyPair(SEED);
    const ref = createPublicKeyRef(keyPair);

    expect(ref.algorithm).toBe('ML-DSA-44 (FIPS-204)');
    expect(ref.publicKeyBase64.length).toBeGreaterThan(0);
    expect(Object.keys(ref)).not.toContain('secretKey');
  });
});

describe('canonicalizeProvenanceData', () => {
  it('is deterministic regardless of key insertion order', () => {
    const a = canonicalizeProvenanceData(makeData());
    const b = canonicalizeProvenanceData({
      guardian: 'Sara Abdi',
      timestamp: '2026-01-15T10:00:00.000Z',
      fileHash:
        '14b7e1c5d9b6299cca983160ab92a12651c9659ac502652d6ac1b3b02b6f5609',
      heritageId: 'heritage-001',
    });
    expect(a).toEqual(b);
  });
});
