'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2, MessageSquareQuote, PencilLine, TriangleAlert, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { addAttestation, ApiError } from '@/lib/api-client';
import type { Attestation, AttestationDecision } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * Family attestations.
 *
 * Cryptography answers "has this file changed?". It cannot answer "who is
 * this?" — that is what relatives are for. Attestations are additive: a
 * correction or a dispute is appended beside the record, never applied
 * over it, so disagreement is preserved as part of the history.
 */

const DECISIONS: {
  value: AttestationDecision;
  label: string;
  icon: typeof CheckCircle2;
  hint: string;
}[] = [
  { value: 'confirm', label: 'Confirm', icon: CheckCircle2, hint: 'I know this to be true' },
  { value: 'correct', label: 'Correct', icon: PencilLine, hint: 'Something here is wrong' },
  { value: 'dispute', label: 'Dispute', icon: TriangleAlert, hint: 'I remember it differently' },
];

export function AttestationPanel({
  heritageId,
  initialAttestations,
}: {
  heritageId: string;
  initialAttestations: Attestation[];
}) {
  const [attestations, setAttestations] = useState(initialAttestations);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [decision, setDecision] = useState<AttestationDecision>('confirm');
  const [statement, setStatement] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length > 0 && statement.trim().length > 0;

  async function handleSubmit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const created = await addAttestation({
        heritageId,
        attesterName: name.trim(),
        relationship: relationship.trim(),
        decision,
        statement: statement.trim(),
      });
      setAttestations((current) => [...current, created]);
      setName('');
      setRelationship('');
      setStatement('');
      setDecision('confirm');
      setOpen(false);
    } catch (submitError) {
      setError(
        submitError instanceof ApiError
          ? submitError.message
          : 'Could not record the attestation. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-3xl bg-card p-6 shadow-heritage sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-label text-muted-foreground">
            Human Layer
          </p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-foreground">
            Family Attestations
          </h2>
          <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
            AI discovers. Humans attest. Cryptography preserves. Nothing here
            overwrites the record — every statement is added beside it.
          </p>
        </div>
        <Button
          variant={open ? 'ghost' : 'default'}
          className="gap-2 rounded-full"
          onClick={() => setOpen((value) => !value)}
        >
          <Users className="h-4 w-4" />
          {open ? 'Cancel' : 'Add attestation'}
        </Button>
      </div>

      {open && (
        <div className="animate-fade-in-up mt-6 rounded-3xl bg-secondary/60 p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="attester-name" className="text-sm font-medium">
                Your name
              </Label>
              <Input
                id="attester-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Almaz Abdi"
                className="mt-2 rounded-xl"
              />
            </div>
            <div>
              <Label htmlFor="attester-relationship" className="text-sm font-medium">
                Relationship
              </Label>
              <Input
                id="attester-relationship"
                value={relationship}
                onChange={(event) => setRelationship(event.target.value)}
                placeholder="e.g. Grandmother"
                className="mt-2 rounded-xl"
              />
            </div>
          </div>

          <fieldset className="mt-5">
            <legend className="text-sm font-medium text-foreground">
              What are you attesting?
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {DECISIONS.map((option) => {
                const Icon = option.icon;
                const active = decision === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setDecision(option.value)}
                    title={option.hint}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors',
                      active
                        ? 'bg-heritage-mocha text-heritage-sand'
                        : 'bg-card text-muted-foreground ring-1 ring-border hover:text-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-5">
            <Label htmlFor="attester-statement" className="text-sm font-medium">
              Statement
            </Label>
            <Textarea
              id="attester-statement"
              value={statement}
              onChange={(event) => setStatement(event.target.value)}
              placeholder="e.g. This was our wedding in Addis Ababa, in the spring of 1968."
              className="mt-2 min-h-[96px] rounded-xl"
            />
          </div>

          {error && (
            <p className="mt-3 rounded-xl bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button
            className="mt-5 gap-2 rounded-full"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MessageSquareQuote className="h-4 w-4" />
            )}
            Record attestation
          </Button>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {attestations.length === 0 ? (
          <p className="rounded-2xl bg-muted/50 px-5 py-6 text-center text-sm text-muted-foreground">
            No one has attested to this record yet. A family member who
            recognises it can be the first.
          </p>
        ) : (
          attestations.map((attestation) => (
            <AttestationRow key={attestation.id} attestation={attestation} />
          ))
        )}
      </div>
    </section>
  );
}

function AttestationRow({ attestation }: { attestation: Attestation }) {
  const config = DECISIONS.find((option) => option.value === attestation.decision);
  const Icon = config?.icon ?? CheckCircle2;

  const tone =
    attestation.decision === 'confirm'
      ? 'bg-heritage-sky/22 text-heritage-sky-deep'
      : attestation.decision === 'correct'
        ? 'bg-heritage-sand/55 text-heritage-mocha'
        : 'bg-warning/15 text-warning';

  return (
    <div className="flex gap-4 rounded-2xl bg-secondary/45 px-5 py-4">
      <span
        className={cn(
          'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl',
          tone
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">
          {attestation.attesterName}
          {attestation.relationship && (
            <span className="font-normal text-muted-foreground">
              {' '}· {attestation.relationship}
            </span>
          )}
        </p>
        <p className="mt-1 font-serif-body text-sm italic leading-relaxed text-foreground/85">
          “{attestation.statement}”
        </p>
        <p className="mt-2 text-[11px] font-medium tracking-label text-muted-foreground">
          {config?.label ?? attestation.decision} · {formatDate(attestation.createdAt)}
        </p>
      </div>
    </div>
  );
}

/**
 * Formats a timestamp identically on the server and in the browser.
 * `toLocaleDateString` resolves against the host locale, which differs
 * between the two and breaks hydration.
 */
function formatDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}
