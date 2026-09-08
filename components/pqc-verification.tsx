'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, KeyRound, Loader2, XCircle } from 'lucide-react';
import { verifyProvenance } from '@/lib/services/pqc';
import type { PqcSignature } from '@/lib/types';
import { cn } from '@/lib/utils';

type State = 'checking' | 'verified' | 'failed';

/**
 * Verifies the ML-DSA-44 signature in the visitor's own browser.
 *
 * The certificate does not simply assert that it is valid — it ships the
 * signature, the public key and the signed payload, and this component
 * re-runs the verification client-side. If the stored record were
 * tampered with, this would say so.
 */
export function PqcVerification({ signature }: { signature: PqcSignature }) {
  const [state, setState] = useState<State>('checking');

  useEffect(() => {
    if (
      !signature.signatureBase64 ||
      !signature.publicKeyBase64 ||
      !signature.signedData
    ) {
      setState('failed');
      return;
    }

    // ML-DSA verification is CPU-bound; defer it so the certificate paints
    // before the check runs.
    const timer = setTimeout(() => {
      const valid = verifyProvenance(
        signature.signedData!,
        signature.signatureBase64!,
        signature.publicKeyBase64!
      );
      setState(valid ? 'verified' : 'failed');
    }, 0);

    return () => clearTimeout(timer);
  }, [signature]);

  return (
    <section
      className={cn(
        'rounded-3xl px-6 py-5 ring-1',
        state === 'verified'
          ? 'bg-heritage-sky/12 ring-heritage-sky/35'
          : state === 'failed'
            ? 'bg-destructive/8 ring-destructive/25'
            : 'bg-card ring-border'
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl',
              state === 'verified'
                ? 'bg-heritage-sky/25 text-heritage-sky-deep'
                : state === 'failed'
                  ? 'bg-destructive/12 text-destructive'
                  : 'bg-muted text-muted-foreground'
            )}
          >
            <KeyRound className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[11px] font-semibold tracking-label text-muted-foreground">
              Post-Quantum Signature
            </p>
            <p className="mt-0.5 text-sm font-medium text-foreground">
              {signature.algorithm}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {state === 'checking'
                ? 'Verifying in your browser…'
                : state === 'verified'
                  ? 'Verified in your browser against the published public key.'
                  : 'This signature could not be verified.'}
            </p>
          </div>
        </div>

        <span
          className={cn(
            'inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1',
            state === 'verified'
              ? 'bg-heritage-sky/25 text-heritage-sky-deep ring-heritage-sky/45'
              : state === 'failed'
                ? 'bg-destructive/10 text-destructive ring-destructive/25'
                : 'bg-muted text-muted-foreground ring-border'
          )}
        >
          {state === 'checking' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {state === 'verified' && <CheckCircle2 className="h-3.5 w-3.5" />}
          {state === 'failed' && <XCircle className="h-3.5 w-3.5" />}
          {state === 'checking' ? 'Checking' : state === 'verified' ? 'Verified' : 'Unverified'}
        </span>
      </div>

      {signature.signaturePreview && (
        <p className="mt-4 break-all border-t border-border/50 pt-3 font-mono text-[11px] text-muted-foreground">
          sig {signature.signaturePreview}… · {signature.signatureBase64?.length ?? 0} base64 chars
        </p>
      )}
    </section>
  );
}
