import Link from 'next/link';
import { Logo } from '@/components/logo';

export function SiteFooter() {
  return (
    <footer className="mt-24 bg-mocha-panel text-heritage-sand">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="flex flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-3">
              <Logo className="h-10 w-10 flex-shrink-0 text-heritage-sand" coreClassName="text-heritage-sky" />
              <span className="font-display text-xl font-bold text-white">
                LegacyChain
              </span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-heritage-sand/90">
              A private vault for family heritage. AI makes the sources
              readable; provenance keeps every reading attached to the source
              it came from, in a record no one can quietly change.
            </p>
          </div>

          <nav className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm">
            {[
              { href: '/vault', label: 'Family Vault' },
              { href: '/add', label: 'Add Heritage' },
              { href: '/verify', label: 'Verify' },
              { href: '/provenance', label: 'Provenance' },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-heritage-sand/90 transition-colors hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-heritage-sand/15 pt-6 text-xs text-heritage-sand/90 sm:flex-row sm:items-center sm:justify-between">
          <p>SHA-256 · ML-DSA-44 (FIPS-204) · Ethereum</p>
          <p>Private content stays off-chain. Only proofs are published.</p>
        </div>
      </div>
    </footer>
  );
}
