import Link from 'next/link';
import { Archive, Fingerprint, GitBranch, Plus, Users } from 'lucide-react';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { HeritageCard } from '@/components/heritage-card';
import { Button } from '@/components/ui/button';
import { listHeritageSummaries } from '@/lib/server/heritage-service';
import { PersistenceNotice } from '@/components/persistence-notice';
import { getStore } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function VaultPage() {
  const items = await listHeritageSummaries();
  const { durable } = await getStore();

  const derivedCount = items.reduce((total, item) => total + item.derivedCount, 0);
  const attestationCount = items.reduce(
    (total, item) => total + item.attestationCount,
    0
  );
  const fullyProven = items.filter(
    (item) =>
      item.protocols.digitalDna &&
      item.protocols.pqcSignature &&
      item.protocols.blockchain
  ).length;

  return (
    <div className="min-h-screen bg-paper-grain">
      <SiteHeader />
      <PersistenceNotice durable={durable} />

      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-[11px] font-semibold tracking-label text-muted-foreground">
              Family Archive
            </p>
            <h1 className="mt-3 font-display text-5xl font-extrabold tracking-tight text-foreground">
              The Family Vault
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Original photographs, recordings, letters and documents —
              preserved privately, with proof anyone can check.
            </p>
          </div>
          <Link href="/add">
            <Button size="lg" className="gap-2 rounded-full">
              <Plus className="h-4 w-4" />
              Add heritage
            </Button>
          </Link>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard icon={Archive} label="Heritage items" value={items.length} />
          <StatCard icon={Fingerprint} label="Fully proven" value={fullyProven} />
          <StatCard icon={GitBranch} label="Derived versions" value={derivedCount} />
          <StatCard icon={Users} label="Attestations" value={attestationCount} />
        </div>

        {items.length === 0 ? (
          <EmptyVault />
        ) : (
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item, index) => (
              <div
                key={item.id}
                className="animate-fade-in-up"
                style={{ animationDelay: `${index * 70}ms` }}
              >
                <HeritageCard item={item} href={`/certificate/${item.id}`} />
              </div>
            ))}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Archive;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-3xl bg-card p-5 shadow-heritage">
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-heritage-sky/20 text-heritage-sky-deep">
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-4 font-display text-3xl font-bold text-foreground">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function EmptyVault() {
  return (
    <div className="mt-10 rounded-[1.75rem] bg-card px-8 py-16 text-center shadow-heritage">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-heritage-sky/20 text-heritage-sky-deep">
        <Archive className="h-6 w-6" />
      </span>
      <h2 className="mt-6 font-display text-2xl font-semibold text-foreground">
        The vault is empty
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Preserve the first memory and it will be fingerprinted, signed and
        anchored — the beginning of a record your family can keep.
      </p>
      <Link href="/add">
        <Button className="mt-6 gap-2 rounded-full">
          <Plus className="h-4 w-4" />
          Add the first item
        </Button>
      </Link>
    </div>
  );
}
