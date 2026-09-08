import { describe, expect, it } from 'vitest';
import { deriveRecordId, toBytes32 } from '../lib/server/blockchain';

const DIGEST = '14b7e1c5d9b6299cca983160ab92a12651c9659ac502652d6ac1b3b02b6f5609';

describe('deriveRecordId', () => {
  it('is deterministic, so a later real anchor keeps the shown identity', () => {
    expect(deriveRecordId('prov-1', DIGEST)).toBe(deriveRecordId('prov-1', DIGEST));
  });

  it('is case-insensitive in the digest', () => {
    expect(deriveRecordId('prov-1', DIGEST.toUpperCase())).toBe(
      deriveRecordId('prov-1', DIGEST)
    );
  });

  it('distinguishes records that share a file', () => {
    expect(deriveRecordId('prov-1', DIGEST)).not.toBe(deriveRecordId('prov-2', DIGEST));
  });

  it('returns a bytes32 hex string', () => {
    expect(deriveRecordId('prov-1', DIGEST)).toMatch(/^0x[0-9a-f]{64}$/);
  });
});

describe('toBytes32', () => {
  it('passes a full SHA-256 digest through as bytes32', () => {
    expect(toBytes32(DIGEST)).toBe(`0x${DIGEST}`);
    expect(toBytes32(`0x${DIGEST}`)).toBe(`0x${DIGEST}`);
  });

  it('hashes anything that is not already 32 bytes', () => {
    const result = toBytes32('short-value');
    expect(result).toMatch(/^0x[0-9a-f]{64}$/);
    expect(result).not.toBe('0xshort-value');
  });
});
