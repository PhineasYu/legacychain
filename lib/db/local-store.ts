/**
 * Zero-config store for running without a database.
 *
 * Writes to `<LOCAL_DATA_DIR>/vault.json` plus a directory of preserved
 * originals, so `npm run dev` works with no setup and data survives a
 * restart.
 *
 * On a read-only filesystem — every serverless platform — the first failed
 * write flips the store into memory-only mode instead of throwing. The app
 * keeps working and `durable` becomes false, which the UI surfaces as a
 * warning rather than pretending the upload was preserved.
 *
 * Mutations are serialised through a promise chain because Next.js may
 * handle several requests at once and the whole file is rewritten each time.
 */

import 'server-only';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { LOCAL_DATA_DIR } from '../server/config';
import type { Attestation, HeritageItem, ProvenanceRecord } from '../types';
import type { HeritageStore, StoredBlob } from './store';

interface VaultFile {
  heritage: HeritageItem[];
  attestations: Attestation[];
}

export class LocalStore implements HeritageStore {
  readonly driver = 'local-json';

  private readonly dataDir = path.join(process.cwd(), LOCAL_DATA_DIR);
  private readonly filePath = path.join(this.dataDir, 'vault.json');
  private readonly blobDir = path.join(this.dataDir, 'originals');

  private cache: VaultFile = { heritage: [], attestations: [] };
  private blobs = new Map<string, StoredBlob>();
  private writeQueue: Promise<unknown> = Promise.resolve();
  private diskWritable = true;

  /** False once a write has failed and the store fell back to memory. */
  get durable(): boolean {
    return this.diskWritable;
  }

  async init(): Promise<void> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<VaultFile>;
      this.cache = {
        heritage: parsed.heritage ?? [],
        attestations: parsed.attestations ?? [],
      };
    } catch {
      // No vault yet, or it is unreadable — start empty and let seeding run.
    }

    // Probe once at startup so `durable` is accurate before the first write.
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      await fs.access(this.dataDir, (await import('node:fs')).constants.W_OK);
    } catch {
      this.diskWritable = false;
      console.warn(
        '[legacychain] Filesystem is not writable — running in memory. ' +
          'Set DATABASE_URL to preserve heritage across restarts.'
      );
    }
  }

  async listHeritage(): Promise<HeritageItem[]> {
    return [...this.cache.heritage].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
  }

  async getHeritage(id: string): Promise<HeritageItem | null> {
    const item = this.cache.heritage.find((h) => h.id === id);
    if (!item) return null;
    return {
      ...item,
      attestations: this.cache.attestations.filter((a) => a.heritageId === id),
    };
  }

  async createHeritage(item: HeritageItem): Promise<HeritageItem> {
    return this.mutate((data) => {
      data.heritage.push(item);
      return item;
    });
  }

  async updateHeritage(
    id: string,
    patch: Partial<HeritageItem>
  ): Promise<HeritageItem | null> {
    return this.mutate((data) => {
      const index = data.heritage.findIndex((h) => h.id === id);
      if (index === -1) return null;
      const updated = { ...data.heritage[index], ...patch, id };
      data.heritage[index] = updated;
      return updated;
    });
  }

  async deleteHeritage(id: string): Promise<boolean> {
    return this.mutate((data) => {
      const before = data.heritage.length;
      data.heritage = data.heritage.filter((h) => h.id !== id);
      data.attestations = data.attestations.filter((a) => a.heritageId !== id);
      return data.heritage.length < before;
    });
  }

  async addProvenanceRecord(record: ProvenanceRecord): Promise<ProvenanceRecord> {
    return this.mutate((data) => {
      const item = data.heritage.find((h) => h.id === record.heritageId);
      if (!item) {
        throw new Error(`Heritage item not found: ${record.heritageId}`);
      }
      item.provenance = [...(item.provenance ?? []), record];
      return record;
    });
  }

  async findProvenanceByDna(digitalDna: string): Promise<ProvenanceRecord | null> {
    const needle = digitalDna.toLowerCase();
    for (const item of this.cache.heritage) {
      const hit = (item.provenance ?? []).find(
        (record) => record.digitalDna.toLowerCase() === needle
      );
      if (hit) return hit;
    }
    return null;
  }

  async addAttestation(attestation: Attestation): Promise<Attestation> {
    return this.mutate((data) => {
      data.attestations.push(attestation);
      return attestation;
    });
  }

  async deleteAttestation(id: string): Promise<boolean> {
    return this.mutate((data) => {
      const before = data.attestations.length;
      data.attestations = data.attestations.filter((a) => a.id !== id);
      return data.attestations.length < before;
    });
  }

  async listAttestations(heritageId: string): Promise<Attestation[]> {
    return this.cache.attestations
      .filter((a) => a.heritageId === heritageId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  // -------------------------------------------------------------------------
  // Preserved originals
  // -------------------------------------------------------------------------

  async putBlob(blob: StoredBlob): Promise<void> {
    this.blobs.set(blob.id, blob);
    if (!this.diskWritable) return;

    try {
      await fs.mkdir(this.blobDir, { recursive: true });
      const blobPath = path.join(this.blobDir, blob.id);
      await fs.writeFile(blobPath, blob.bytes);
      await fs.writeFile(
        `${blobPath}.json`,
        JSON.stringify({
          id: blob.id,
          contentType: blob.contentType,
          originalName: blob.originalName,
          size: blob.size,
        }),
        'utf8'
      );
    } catch {
      this.fallBackToMemory();
    }
  }

  async getBlob(id: string): Promise<StoredBlob | null> {
    const cached = this.blobs.get(id);
    if (cached) return cached;
    if (!this.diskWritable) return null;

    const blobPath = path.join(this.blobDir, id);
    try {
      const bytes = new Uint8Array(await fs.readFile(blobPath));
      let contentType = 'application/octet-stream';
      let originalName = id;
      try {
        const meta = JSON.parse(await fs.readFile(`${blobPath}.json`, 'utf8'));
        contentType = meta.contentType ?? contentType;
        originalName = meta.originalName ?? originalName;
      } catch {
        // Metadata is optional — fall back to the generic content type.
      }
      const blob: StoredBlob = {
        id,
        contentType,
        originalName,
        size: bytes.byteLength,
        bytes,
      };
      this.blobs.set(id, blob);
      return blob;
    } catch {
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------

  /**
   * Applies `fn` to the in-memory data, then persists it.
   * The in-memory result stands even if the write fails.
   */
  private mutate<T>(fn: (data: VaultFile) => T): Promise<T> {
    const next = this.writeQueue.then(async () => {
      const result = fn(this.cache);
      await this.flush();
      return result;
    });
    // Keep the queue alive even if this mutation rejects.
    this.writeQueue = next.catch(() => undefined);
    return next;
  }

  private async flush(): Promise<void> {
    if (!this.diskWritable) return;
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      await fs.writeFile(this.filePath, JSON.stringify(this.cache, null, 2), 'utf8');
    } catch {
      this.fallBackToMemory();
    }
  }

  private fallBackToMemory(): void {
    if (!this.diskWritable) return;
    this.diskWritable = false;
    console.warn(
      '[legacychain] Filesystem write failed — continuing in memory. ' +
        'Set DATABASE_URL to preserve heritage across restarts.'
    );
  }
}
