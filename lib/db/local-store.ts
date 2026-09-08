/**
 * Zero-config JSON-file store.
 *
 * Used when DATABASE_URL is not set so that `npm run dev` works with no
 * setup at all. Data lives in `<LOCAL_DATA_DIR>/vault.json` and survives
 * restarts, which is what makes the demo reproducible.
 *
 * Writes are serialised through a promise chain because Next.js may
 * handle several requests concurrently and the whole file is rewritten
 * on every mutation.
 */

import 'server-only';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { LOCAL_DATA_DIR } from '../server/config';
import type { Attestation, HeritageItem, ProvenanceRecord } from '../types';
import type { HeritageStore } from './store';

interface VaultFile {
  heritage: HeritageItem[];
  attestations: Attestation[];
}

const EMPTY: VaultFile = { heritage: [], attestations: [] };

export class LocalStore implements HeritageStore {
  readonly driver = 'local-json';

  private readonly filePath = path.join(process.cwd(), LOCAL_DATA_DIR, 'vault.json');
  private cache: VaultFile | null = null;
  private writeQueue: Promise<unknown> = Promise.resolve();

  async init(): Promise<void> {
    await this.read();
  }

  async listHeritage(): Promise<HeritageItem[]> {
    const data = await this.read();
    return [...data.heritage].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
  }

  async getHeritage(id: string): Promise<HeritageItem | null> {
    const data = await this.read();
    const item = data.heritage.find((h) => h.id === id);
    if (!item) return null;
    return {
      ...item,
      attestations: data.attestations.filter((a) => a.heritageId === id),
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
    const data = await this.read();
    const needle = digitalDna.toLowerCase();
    for (const item of data.heritage) {
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

  async listAttestations(heritageId: string): Promise<Attestation[]> {
    const data = await this.read();
    return data.attestations
      .filter((a) => a.heritageId === heritageId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  // -------------------------------------------------------------------------
  // File IO
  // -------------------------------------------------------------------------

  private async read(): Promise<VaultFile> {
    if (this.cache) return this.cache;
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<VaultFile>;
      this.cache = {
        heritage: parsed.heritage ?? [],
        attestations: parsed.attestations ?? [],
      };
    } catch {
      this.cache = structuredClone(EMPTY);
    }
    return this.cache;
  }

  /**
   * Applies `fn` to the in-memory data and persists the result.
   * Mutations are queued so concurrent requests cannot interleave writes.
   */
  private mutate<T>(fn: (data: VaultFile) => T): Promise<T> {
    const next = this.writeQueue.then(async () => {
      const data = await this.read();
      const result = fn(data);
      await this.flush(data);
      return result;
    });
    // Keep the queue alive even if this mutation rejects.
    this.writeQueue = next.catch(() => undefined);
    return next;
  }

  private async flush(data: VaultFile): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf8');
  }
}
