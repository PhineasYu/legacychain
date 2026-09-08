import { cn } from '@/lib/utils';

interface ProvenanceBadgeProps {
  kind: 'ORIGINAL' | 'DERIVED';
  className?: string;
}

export function ProvenanceBadge({ kind, className }: ProvenanceBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold tracking-label',
        kind === 'ORIGINAL'
          ? 'bg-heritage-sky/22 text-heritage-sky-deep ring-1 ring-heritage-sky/40'
          : 'bg-heritage-sand/50 text-heritage-mocha ring-1 ring-heritage-sand-deep/50',
        className
      )}
    >
      {kind}
    </span>
  );
}
