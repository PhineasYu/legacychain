import Link from 'next/link';
import { MapPin, FileText, Mic, ImageIcon, Video, GitBranch, Users } from 'lucide-react';
import type { HeritageSummary, HeritageType } from '@/lib/types';
import { StatusBadge } from './status-badge';
import { ProtocolBadges } from './protocol-badges';
import { truncateDigest } from '@/lib/services/hashing';
import { cn } from '@/lib/utils';

const typeIconMap: Record<HeritageType, typeof ImageIcon> = {
  Photograph: ImageIcon,
  Audio: Mic,
  Document: FileText,
  Video: Video,
  Letter: FileText,
};

export function HeritageCard({
  item,
  href,
  className,
}: {
  item: HeritageSummary;
  href?: string;
  className?: string;
}) {
  const TypeIcon = typeIconMap[item.type] ?? ImageIcon;

  const card = (
    <article
      className={cn(
        'group h-full overflow-hidden rounded-3xl bg-card shadow-heritage transition-all duration-300 hover:-translate-y-1 hover:shadow-heritage-lg',
        className
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-heritage-sand/30">
        {/* Preserved originals are served from /api/files/<sha256>, so a
            plain <img> is used rather than next/image's optimiser. */}
        <img
          src={item.imageUrl}
          alt={item.title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-heritage-mocha-deep/55 via-transparent to-transparent" />

        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-background/92 px-3 py-1 text-xs font-medium text-foreground backdrop-blur-sm">
          <TypeIcon className="h-3.5 w-3.5 text-heritage-sky-deep" />
          {item.type}
        </span>

        <span className="absolute bottom-3 left-4 font-display text-4xl font-bold text-white drop-shadow">
          {item.year}
        </span>

        <ProtocolBadges
          protocols={item.protocols}
          variant="compact"
          className="absolute bottom-4 right-3"
        />
      </div>

      <div className="p-5">
        <h3 className="font-display text-xl font-semibold leading-tight text-foreground">
          {item.title}
        </h3>
        {item.location && (
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            {item.location}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <StatusBadge status={item.verificationStatus} />
          {item.derivedCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-heritage-sand/45 px-2.5 py-1 text-xs font-medium text-heritage-mocha">
              <GitBranch className="h-3 w-3" />
              {item.derivedCount} derived
            </span>
          )}
          {item.attestationCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
              <Users className="h-3 w-3" />
              {item.attestationCount}
            </span>
          )}
        </div>

        <p className="mt-4 border-t border-border/60 pt-3 font-mono text-[11px] text-muted-foreground/80">
          {truncateDigest(item.digitalDna, 10, 8)}
        </p>
      </div>
    </article>
  );

  return href ? (
    <Link href={href} className="block h-full">
      {card}
    </Link>
  ) : (
    card
  );
}
