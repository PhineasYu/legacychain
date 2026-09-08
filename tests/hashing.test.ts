import { describe, expect, it } from 'vitest';
import {
  compareFingerprints,
  createDigitalFingerprint,
  truncateDigest,
} from '../lib/services/hashing';

describe('createDigitalFingerprint', () => {
  it('is deterministic for identical content', async () => {
    const a = await createDigitalFingerprint('Alexandria');
    const b = await createDigitalFingerprint('Alexandria');

    expect(a.digest).toBe(b.digest);
    expect(a.algorithm).toBe('SHA-256');
    expect(a.digest).toHaveLength(64);
  });

  it('matches the known SHA-256 of the empty input', async () => {
    const { digest } = await createDigitalFingerprint('');
    expect(digest).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    );
  });

  it('produces the same digest for equivalent byte inputs', async () => {
    const bytes = new TextEncoder().encode('Alexandria');
    const fromString = await createDigitalFingerprint('Alexandria');
    const fromUint8 = await createDigitalFingerprint(bytes);
    const fromBuffer = await createDigitalFingerprint(
      bytes.buffer.slice(0) as ArrayBuffer
    );

    expect(fromUint8.digest).toBe(fromString.digest);
    expect(fromBuffer.digest).toBe(fromString.digest);
  });

  it('changes completely when a single character changes', async () => {
    const upper = await createDigitalFingerprint('Alexandria');
    const lower = await createDigitalFingerprint('alexandria');

    expect(upper.digest).not.toBe(lower.digest);
    // Avalanche: the two digests should share almost no leading characters.
    expect(upper.digest.slice(0, 8)).not.toBe(lower.digest.slice(0, 8));
  });
});

describe('compareFingerprints', () => {
  it('reports a full match for identical digests, ignoring case', () => {
    const result = compareFingerprints('ABCD1234', 'abcd1234');
    expect(result).toEqual({ isMatch: true, matchPercentage: 100 });
  });

  it('reports no partial credit for different digests', () => {
    const result = compareFingerprints('abcd1234', 'abcd1235');
    expect(result).toEqual({ isMatch: false, matchPercentage: 0 });
  });
});

describe('truncateDigest', () => {
  it('shortens a full digest and marks the elision', async () => {
    const { digest } = await createDigitalFingerprint('Alexandria');
    const truncated = truncateDigest(digest);

    expect(truncated).toContain('...');
    expect(truncated.length).toBeLessThan(digest.length);
  });

  it('leaves short values untouched', () => {
    expect(truncateDigest('abc')).toBe('abc');
  });
});
