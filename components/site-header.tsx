'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Logo } from '@/components/logo';
import { cn } from '@/lib/utils';

const navLinks = [
  { href: '/vault', label: 'Family Vault' },
  { href: '/add', label: 'Add Heritage' },
  { href: '/verify', label: 'Verify' },
  { href: '/provenance', label: 'Provenance' },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="group flex items-center gap-3"
          onClick={() => setMobileOpen(false)}
        >
          <Logo className="h-10 w-10 flex-shrink-0 text-heritage-mocha transition-colors group-hover:text-heritage-mocha-deep" />
          <span className="flex flex-col leading-none">
            <span className="font-display text-xl font-bold tracking-tight text-foreground">
              LegacyChain
            </span>
            <span className="mt-0.5 text-[9px] font-medium tracking-label text-muted-foreground">
              Sovereign History Vault
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-medium transition-colors',
                isActive(pathname, link.href)
                  ? 'bg-heritage-mocha text-heritage-sand'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <button
          className="flex h-10 w-10 items-center justify-center rounded-2xl text-foreground md:hidden"
          onClick={() => setMobileOpen((open) => !open)}
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <nav className="border-t border-border/60 bg-background px-6 py-3 md:hidden">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'block rounded-2xl px-4 py-3 text-sm font-medium transition-colors',
                isActive(pathname, link.href)
                  ? 'bg-heritage-mocha text-heritage-sand'
                  : 'text-muted-foreground hover:bg-secondary'
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}

function isActive(pathname: string | null, href: string): boolean {
  return pathname === href || (href !== '/' && Boolean(pathname?.startsWith(href)));
}
