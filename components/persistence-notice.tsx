import { TriangleAlert } from 'lucide-react';

/**
 * Shown when the vault is running in memory because no database is
 * configured and the filesystem is read-only — the usual state of a
 * fresh serverless deploy.
 *
 * A heritage vault that quietly forgets what it was given would be worse
 * than one that refuses it, so this says so plainly on every page.
 */
export function PersistenceNotice({ durable }: { durable: boolean }) {
  if (durable) return null;

  return (
    <div className="border-b border-warning/25 bg-warning/12">
      <div className="mx-auto flex max-w-6xl items-start gap-3 px-6 py-3">
        <TriangleAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" />
        <p className="text-sm text-foreground/85">
          <span className="font-semibold">Demo mode — nothing is being saved.</span>{' '}
          This instance has no database, so anything preserved here disappears
          when the server restarts. Set <code className="font-mono text-xs">DATABASE_URL</code>{' '}
          to a Neon connection string to keep it.
        </p>
      </div>
    </div>
  );
}
