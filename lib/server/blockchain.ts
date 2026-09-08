/**
 * Blockchain anchoring for heritage provenance.
 *
 * WHAT GOES ON-CHAIN: a record id, the SHA-256 file fingerprint, a hash
 * of the post-quantum signature, and the parent record id. Nothing else.
 * The family's photographs, names, locations and stories never leave the
 * private vault.
 *
 * WHEN NOT CONFIGURED: anchoring falls back to `simulated` status. The
 * record id is still derived exactly as it would be on-chain, so the
 * demo is identical apart from the missing transaction — and the UI
 * labels it as simulated rather than claiming it was mined.
 */

import 'server-only';
import { Contract, JsonRpcProvider, Wallet, keccak256, toUtf8Bytes } from 'ethers';
import type { BlockchainAnchor, SignedProvenanceData } from '../types';
import {
  ETH_CHAIN_ID,
  ETH_EXPLORER_BASE,
  ETH_NETWORK_NAME,
  ETH_PRIVATE_KEY,
  ETH_RPC_URL,
  HERITAGE_REGISTRY_ADDRESS,
  isBlockchainConfigured,
} from './config';

/** Minimal ABI — only what this application calls. */
export const HERITAGE_REGISTRY_ABI = [
  'function register(bytes32 recordId, bytes32 fileHash, bytes32 pqcSignatureHash, bytes32 parentRecordId) external',
  'function attest(bytes32 recordId, bytes32 attestationHash) external',
  'function exists(bytes32 recordId) external view returns (bool)',
  'function verifyFileHash(bytes32 recordId, bytes32 fileHash) external view returns (bool)',
  'function recordCount() external view returns (uint256)',
] as const;

export interface AnchorRequest {
  provenanceId: string;
  signedData: SignedProvenanceData;
  /** Base64 ML-DSA signature; hashed before it is anchored */
  pqcSignatureBase64?: string;
  /** Provenance id of the parent record, for derived versions */
  parentProvenanceId?: string;
}

/**
 * Derives the on-chain record id.
 *
 * Deterministic and computed the same way in live and simulated mode, so
 * a record anchored later keeps the same identity it was shown with.
 */
export function deriveRecordId(provenanceId: string, fileHash: string): string {
  return keccak256(toUtf8Bytes(`${provenanceId}:${fileHash.toLowerCase()}`));
}

/** Converts a 64-char SHA-256 hex digest into a bytes32 value. */
export function toBytes32(hexDigest: string): string {
  const clean = hexDigest.replace(/^0x/, '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(clean)) {
    // Not a full 32-byte digest — hash it so the value is always bytes32.
    return keccak256(toUtf8Bytes(hexDigest));
  }
  return `0x${clean}`;
}

const ZERO_BYTES32 = `0x${'0'.repeat(64)}`;

/**
 * Anchors a provenance record on-chain, or produces a clearly-labelled
 * simulated anchor when no wallet is configured.
 *
 * Never throws: a failed anchor is returned as a `failed` anchor so the
 * heritage item is still preserved. The fingerprint and the PQC
 * signature are the durable proof; the chain is the public witness.
 */
export async function anchorRecord(
  request: AnchorRequest
): Promise<BlockchainAnchor> {
  const recordId = deriveRecordId(request.provenanceId, request.signedData.fileHash);
  const fileHash = toBytes32(request.signedData.fileHash);
  const base: BlockchainAnchor = {
    status: 'simulated',
    network: ETH_NETWORK_NAME,
    chainId: ETH_CHAIN_ID,
    recordId,
    fileHash,
    anchoredAt: new Date().toISOString(),
  };

  if (!isBlockchainConfigured()) {
    return {
      ...base,
      status: 'simulated',
      note: 'No RPC endpoint or signer configured — the record id was derived locally and has not been written to a public chain.',
    };
  }

  const pqcSignatureHash = request.pqcSignatureBase64
    ? keccak256(toUtf8Bytes(request.pqcSignatureBase64))
    : ZERO_BYTES32;
  const parentRecordId = request.parentProvenanceId
    ? deriveRecordId(
        request.parentProvenanceId,
        request.signedData.parentVersion ?? request.signedData.fileHash
      )
    : ZERO_BYTES32;

  try {
    const provider = new JsonRpcProvider(ETH_RPC_URL, ETH_CHAIN_ID);
    const wallet = new Wallet(ETH_PRIVATE_KEY, provider);
    const registry = new Contract(
      HERITAGE_REGISTRY_ADDRESS,
      HERITAGE_REGISTRY_ABI,
      wallet
    );

    const tx = await registry.register(
      recordId,
      fileHash,
      pqcSignatureHash,
      parentRecordId
    );
    const receipt = await tx.wait();

    return {
      ...base,
      status: 'anchored',
      contractAddress: HERITAGE_REGISTRY_ADDRESS,
      txHash: tx.hash,
      blockNumber: receipt?.blockNumber ?? undefined,
      explorerUrl: `${ETH_EXPLORER_BASE}/tx/${tx.hash}`,
      anchoredAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      ...base,
      status: 'failed',
      contractAddress: HERITAGE_REGISTRY_ADDRESS,
      note: `Anchoring failed: ${errorMessage(error)}. The fingerprint and post-quantum signature are still preserved.`,
    };
  }
}

/**
 * Reads back an anchor from the chain — the independent check that the
 * certificate is not just asserting its own validity.
 */
export async function readAnchor(
  recordId: string,
  fileHash: string
): Promise<{ onChain: boolean; matches: boolean; note?: string }> {
  if (!isBlockchainConfigured()) {
    return {
      onChain: false,
      matches: false,
      note: 'Blockchain is not configured — nothing to read back.',
    };
  }
  try {
    const provider = new JsonRpcProvider(ETH_RPC_URL, ETH_CHAIN_ID);
    const registry = new Contract(
      HERITAGE_REGISTRY_ADDRESS,
      HERITAGE_REGISTRY_ABI,
      provider
    );
    const onChain: boolean = await registry.exists(recordId);
    if (!onChain) return { onChain: false, matches: false };
    const matches: boolean = await registry.verifyFileHash(
      recordId,
      toBytes32(fileHash)
    );
    return { onChain, matches };
  } catch (error) {
    return { onChain: false, matches: false, note: errorMessage(error) };
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
