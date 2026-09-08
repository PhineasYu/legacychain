/**
 * Store factory.
 *
 * Chooses a driver from the environment, initialises it once per process,
 * and seeds the demo archive on first run so the vault is never empty.
 *
 * If a configured database cannot be reached the process falls back to
 * the local file store rather than failing to boot — a hackathon demo
 * should never die because a Neon branch was asleep.
 */

import 'server-only';
import { isDatabaseConfigured } from '../server/config';
import { LocalStore } from './local-store';
import { PostgresStore } from './postgres-store';
import { seedIfEmpty } from './seed';
import type { HeritageStore } from './store';

let storeInstance: HeritageStore | null = null;
let readyPromise: Promise<HeritageStore> | null = null;

/**
 * Why the configured database is not being used, if it was configured but
 * could not be reached. Surfaced by /api/health and in the UI banner —
 * otherwise adding DATABASE_URL and still seeing "demo mode" is a silent,
 * undiagnosable failure.
 */
let databaseError: string | null = null;

export function getDatabaseError(): string | null {
  return databaseError;
}

export async function getStore(): Promise<HeritageStore> {
  // Seeding runs inside initialise() and calls back into getStore();
  // returning the instance directly keeps that from deadlocking.
  if (storeInstance) return storeInstance;
  if (!readyPromise) readyPromise = initialise();
  return readyPromise;
}

async function initialise(): Promise<HeritageStore> {
  const store = await createStore();
  storeInstance = store;
  await seedIfEmpty(store);
  return store;
}

async function createStore(): Promise<HeritageStore> {
  if (isDatabaseConfigured()) {
    try {
      const postgres = new PostgresStore();
      await postgres.init();
      return postgres;
    } catch (error) {
      databaseError = error instanceof Error ? error.message : String(error);
      console.warn(
        `[legacychain] DATABASE_URL is set but unusable (${databaseError}) — ` +
          'falling back to the local store.'
      );
    }
  }

  const local = new LocalStore();
  await local.init();
  return local;
}

export type { HeritageStore } from './store';
