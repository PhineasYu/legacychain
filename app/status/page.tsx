import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  KeyRound,
  Link2,
  Sparkles,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { getStore } from '@/lib/db';
import { getRuntimeMode } from '@/lib/server/config';
import { getSeedError, isUsingDevSeed } from '@/lib/server/pqc-server';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * Plain-language deployment status.
 *
 * /api/health carries the same facts as JSON, which is the wrong shape for
 * deciding "is this ready to demo?". Each row says what works, what does not,
 * and what to do about it — including whether a gap actually blocks a demo.
 */
export default async function StatusPage() {
  const mode = getRuntimeMode();
  const store = await getStore();
  const items = await store.listHeritage();
  const usingDevSeed = isUsingDevSeed();
  const seedError = getSeedError();

  const checks: Check[] = [
    {
      icon: Database,
      title: 'Storage',
      ok: store.durable,
      good: `Saving to ${store.driver}. Uploads survive restarts and everyone sees the same vault.`,
      bad: 'Running in memory. Anything uploaded disappears, and teammates each see a different vault.',
      fix: 'Add a Neon database in Vercel → Storage → Create Database.',
      blocksDemo: true,
    },
    {
      icon: UserCheck,
      title: 'Guardian identity',
      ok: mode.identity === 'live',
      good: 'Certificates show a Legal Identity read back live from its Neuron.',
      bad: 'Certificates show the guardian as Unverified, which is honest but weaker.',
      fix: 'Run npm run neuro:provision and set the four NEURO_* variables.',
      blocksDemo: false,
    },
    {
      icon: KeyRound,
      title: 'Post-quantum signing key',
      ok: !usingDevSeed,
      good: 'Signing with your own private key.',
      bad: seedError
        ? `The configured seed is malformed, so signing fell back to the public development key. ${seedError}`
        : 'Signing with the development key published in the public repository — anyone reading the source can forge these signatures.',
      fix: 'Set PQC_GUARDIAN_SEED to 32 bytes of hex (64 characters).',
      blocksDemo: false,
    },
    {
      icon: Link2,
      title: 'Blockchain anchoring',
      ok: mode.blockchain === 'live',
      good: 'Records are written to a public chain with a real transaction.',
      bad: 'Anchors are computed locally and labelled "Simulated". Record ids are real and will not change once anchoring is enabled — but nothing is on a public chain yet.',
      fix: 'Set ETH_RPC_URL, ETH_PRIVATE_KEY and HERITAGE_REGISTRY_ADDRESS, then deploy the contract with npm run contract:deploy.',
      blocksDemo: false,
    },
    {
      icon: Sparkles,
      title: 'AI enrichment',
      ok: mode.ai === 'live',
      good: 'Suggestions come from a vision model reading the uploaded file.',
      bad: 'Suggestions are generated from the metadata alone, and are labelled "heuristic" wherever they appear.',
      fix: 'Set ANTHROPIC_API_KEY.',
      blocksDemo: false,
    },
  ];

  const blocking = checks.filter((check) => !check.ok && check.blocksDemo);

  return (
    <div className="min-h-screen bg-paper-grain">
      <SiteHeader />

      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-[11px] font-semibold tracking-label text-muted-foreground">
          Deployment status
        </p>
        <h1 className="mt-3 font-display text-5xl font-extrabold tracking-tight text-foreground">
          What is switched on
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          Every part of LegacyChain works without configuration and says so when
          it is running in a reduced mode. This page is that report in plain
          language.
        </p>

        <div
          className={cn(
            'mt-8 rounded-3xl px-6 py-5 ring-1',
            blocking.length === 0
              ? 'bg-heritage-sky/12 ring-heritage-sky/35'
              : 'bg-destructive/10 ring-destructive/25'
          )}
        >
          <div className="flex items-start gap-3">
            {blocking.length === 0 ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-heritage-sky-deep" />
            ) : (
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />
            )}
            <div>
              <p className="font-display text-lg font-semibold text-foreground">
                {blocking.length === 0
                  ? 'Ready to demo'
                  : 'Not ready to demo yet'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {blocking.length === 0
                  ? `${items.length} items preserved. Uploading, verifying, deriving a version and attesting all work end to end.`
                  : `${blocking.length} thing${blocking.length > 1 ? 's' : ''} below will break a live demo.`}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {checks.map((check) => (
            <CheckRow key={check.title} check={check} />
          ))}
        </div>

        <p className="mt-8 text-sm text-muted-foreground">
          The same facts as JSON:{' '}
          <Link href="/api/health" className="font-medium text-heritage-sky-deep hover:underline">
            /api/health
          </Link>
        </p>
      </main>

      <SiteFooter />
    </div>
  );
}

interface Check {
  icon: typeof Database;
  title: string;
  ok: boolean;
  good: string;
  bad: string;
  fix: string;
  /** True when a live demo actually fails without this */
  blocksDemo: boolean;
}

function CheckRow({ check }: { check: Check }) {
  const Icon = check.icon;

  return (
    <section
      className={cn(
        'rounded-3xl px-6 py-5 ring-1',
        check.ok
          ? 'bg-heritage-sky/10 ring-heritage-sky/30'
          : check.blocksDemo
            ? 'bg-destructive/8 ring-destructive/25'
            : 'bg-card ring-border'
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl',
            check.ok
              ? 'bg-heritage-sky/25 text-heritage-sky-deep'
              : check.blocksDemo
                ? 'bg-destructive/12 text-destructive'
                : 'bg-heritage-sand/50 text-heritage-mocha'
          )}
        >
          <Icon className="h-5 w-5" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="font-display text-lg font-semibold text-foreground">
              {check.title}
            </h2>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-label ring-1',
                check.ok
                  ? 'bg-heritage-sky/25 text-heritage-sky-deep ring-heritage-sky/45'
                  : check.blocksDemo
                    ? 'bg-destructive/10 text-destructive ring-destructive/25'
                    : 'bg-muted text-muted-foreground ring-border'
              )}
            >
              {check.ok ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <XCircle className="h-3 w-3" />
              )}
              {check.ok ? 'On' : check.blocksDemo ? 'Blocks demo' : 'Reduced'}
            </span>
          </div>

          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {check.ok ? check.good : check.bad}
          </p>

          {!check.ok && (
            <p className="mt-3 rounded-xl bg-secondary/70 px-4 py-2.5 text-xs leading-relaxed text-foreground/80">
              <span className="font-semibold">To switch it on: </span>
              {check.fix}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
