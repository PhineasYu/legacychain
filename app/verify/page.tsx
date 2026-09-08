'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Fingerprint,
  GitBranch,
  HelpCircle,
  Loader2,
  RotateCcw,
  Search,
  Upload,
} from 'lucide-react';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  ApiError,
  listHeritage,
  registerDerived,
  verifyFile,
} from '@/lib/api-client';
import type {
  HeritageSummary,
  ProvenanceRecord,
  VerificationResult,
} from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * What was done to produce this version. Most are AI *reading* the source —
 * a transcript, a translation, a cleaned-up scan — which is the point of AI
 * here. Each one becomes its own record pointing back at what it was made
 * from, so a convenient reading can never quietly replace the source.
 */
const TRANSFORM_TYPES = [
  'AI Transcription',
  'AI Translation',
  'AI Restoration',
  'AI Colorization',
  'Manual Retouch',
  'Format Conversion',
];

export default function VerifyPage() {
  const [items, setItems] = useState<HeritageSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [derivedTitle, setDerivedTitle] = useState('AI Restored Version');
  const [transformType, setTransformType] = useState(TRANSFORM_TYPES[0]);
  const [derivedDescription, setDerivedDescription] = useState('');
  const [registering, setRegistering] = useState(false);
  const [registered, setRegistered] = useState<ProvenanceRecord | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listHeritage()
      .then((loaded) => {
        setItems(loaded);
        if (loaded.length > 0) setSelectedId(loaded[0].id);
      })
      .catch(() => setError('Could not load the vault.'));
  }, []);

  function selectFile(selected: File | undefined) {
    if (!selected) return;
    setFile(selected);
    setFilePreview(
      selected.type.startsWith('image/') ? URL.createObjectURL(selected) : null
    );
    setResult(null);
    setRegistered(null);
    setError(null);
  }

  async function handleVerify() {
    if (!file) return;
    setVerifying(true);
    setError(null);
    setRegistered(null);

    try {
      const verification = await verifyFile({
        file,
        heritageId: selectedId || undefined,
      });
      setResult(verification);

      // Pre-fill the derived form with something sensible to submit.
      if (verification.status === 'different' && verification.candidateOriginal) {
        setDerivedTitle(`AI Restored — ${verification.candidateOriginal.heritageTitle}`);
      }
    } catch (verifyError) {
      setError(
        verifyError instanceof ApiError
          ? verifyError.message
          : 'Verification failed.'
      );
    } finally {
      setVerifying(false);
    }
  }

  async function handleRegisterDerived() {
    if (!file || !result?.candidateOriginal || registering) return;
    setRegistering(true);
    setError(null);

    try {
      const { record } = await registerDerived({
        heritageId: result.candidateOriginal.heritageId,
        parentProvenanceId: result.candidateOriginal.provenanceId,
        file,
        title: derivedTitle.trim() || 'Derived Version',
        transformType,
        description: derivedDescription.trim() || undefined,
      });
      setRegistered(record);
    } catch (registerError) {
      setError(
        registerError instanceof ApiError
          ? registerError.message
          : 'Could not register the derived version.'
      );
    } finally {
      setRegistering(false);
    }
  }

  function handleReset() {
    setFile(null);
    setFilePreview(null);
    setResult(null);
    setRegistered(null);
    setError(null);
    setDerivedDescription('');
  }

  return (
    <div className="min-h-screen bg-paper-grain">
      <SiteHeader />

      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="mb-9">
          <p className="text-[11px] font-semibold tracking-label text-muted-foreground">
            Verify
          </p>
          <h1 className="mt-3 font-display text-5xl font-extrabold tracking-tight text-foreground">
            Is this the original?
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Upload a file and LegacyChain re-computes its fingerprint, then
            looks for it across every record in the vault. A file that does not
            match is not a failure — it is a version, and it can be preserved
            as one.
          </p>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl bg-destructive/10 px-5 py-4 ring-1 ring-destructive/20">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <div className="rounded-[1.75rem] bg-card p-6 shadow-heritage sm:p-8">
          {items.length > 0 && (
            <div className="mb-6">
              <Label htmlFor="heritage-select" className="text-sm font-semibold">
                Compare against
              </Label>
              <select
                id="heritage-select"
                value={selectedId}
                onChange={(event) => setSelectedId(event.target.value)}
                className="mt-2 w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Any record in the vault</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title} ({item.year})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div
            role="button"
            tabIndex={0}
            className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-border bg-secondary/40 px-6 py-12 text-center transition-colors hover:border-heritage-sky hover:bg-heritage-sky/5"
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                fileInputRef.current?.click();
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              selectFile(event.dataTransfer.files?.[0]);
            }}
            onDragOver={(event) => event.preventDefault()}
          >
            {file ? (
              <div className="flex flex-col items-center gap-3">
                {filePreview ? (
                  <img
                    src={filePreview}
                    alt="File to verify"
                    className="max-h-48 rounded-2xl object-contain shadow-heritage"
                  />
                ) : (
                  <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-heritage-sky/20 text-heritage-sky-deep">
                    <Fingerprint className="h-7 w-7" />
                  </span>
                )}
                <span className="text-sm font-medium text-foreground">{file.name}</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-heritage-sky/20 text-heritage-sky-deep">
                  <Upload className="h-7 w-7" />
                </span>
                <div>
                  <p className="font-display text-lg font-semibold text-foreground">
                    Upload a file to check
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Drag and drop, or click to browse
                  </p>
                </div>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(event) => selectFile(event.target.files?.[0])}
            />
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button
              size="lg"
              className="flex-1 gap-2 rounded-full"
              onClick={handleVerify}
              disabled={!file || verifying}
            >
              {verifying ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Search className="h-5 w-5" />
              )}
              Verify file
            </Button>
            {(file || result) && (
              <Button
                variant="outline"
                size="lg"
                className="gap-2 rounded-full"
                onClick={handleReset}
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
            )}
          </div>
        </div>

        {result && (
          <div className="animate-fade-in-up mt-6 space-y-5">
            <VerdictCard result={result} />

            <FingerprintComparison result={result} />

            {result.status === 'different' && result.candidateOriginal && !registered && (
              <div className="rounded-[1.75rem] bg-card p-6 shadow-heritage sm:p-8">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-heritage-sand/60 text-heritage-mocha">
                    <GitBranch className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="font-display text-xl font-semibold text-foreground">
                      Register as a derived version
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      This adds the transformed file to the chain of “
                      {result.candidateOriginal.heritageTitle}”. The original
                      record is not modified — it never can be.
                    </p>
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  <div>
                    <Label htmlFor="derived-title" className="text-sm font-semibold">
                      Version title
                    </Label>
                    <Input
                      id="derived-title"
                      value={derivedTitle}
                      onChange={(event) => setDerivedTitle(event.target.value)}
                      className="mt-2 rounded-xl"
                    />
                  </div>

                  <fieldset>
                    <legend className="text-sm font-semibold text-foreground">
                      Transform type
                    </legend>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {TRANSFORM_TYPES.map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setTransformType(type)}
                          className={cn(
                            'rounded-full px-4 py-2 text-sm font-medium transition-colors',
                            transformType === type
                              ? 'bg-heritage-mocha text-heritage-sand'
                              : 'bg-secondary text-muted-foreground hover:text-foreground'
                          )}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  <div>
                    <Label htmlFor="derived-description" className="text-sm font-semibold">
                      What changed?
                    </Label>
                    <Textarea
                      id="derived-description"
                      value={derivedDescription}
                      onChange={(event) => setDerivedDescription(event.target.value)}
                      placeholder="e.g. Creases repaired and fading corrected with an AI restoration model in 2026."
                      className="mt-2 min-h-[90px] rounded-2xl"
                    />
                  </div>
                </div>

                <Button
                  size="lg"
                  className="mt-6 w-full gap-2 rounded-full"
                  onClick={handleRegisterDerived}
                  disabled={registering}
                >
                  {registering ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <GitBranch className="h-5 w-5" />
                  )}
                  Register derived version
                </Button>
              </div>
            )}

            {registered && result.candidateOriginal && (
              <div className="animate-fade-in-up rounded-[1.75rem] bg-mocha-panel px-8 py-9 text-center shadow-heritage-lg">
                <CheckCircle2 className="mx-auto h-9 w-9 text-heritage-sky" />
                <h2 className="mt-4 font-display text-2xl font-bold text-white">
                  Derived version registered
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-heritage-sand/80">
                  “{registered.title}” is now part of the chain, with its own
                  fingerprint and signature, linked back to the original.
                </p>
                <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                  <Link href={`/provenance/${result.candidateOriginal.heritageId}`}>
                    <Button className="gap-2 rounded-full bg-heritage-sky text-heritage-mocha-deep hover:bg-heritage-sky/90">
                      View provenance
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href={`/certificate/${result.candidateOriginal.heritageId}`}>
                    <Button
                      variant="outline"
                      className="gap-2 rounded-full border-heritage-sand/35 bg-transparent text-heritage-sand hover:bg-heritage-sand/10 hover:text-white"
                    >
                      Open certificate
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

function VerdictCard({ result }: { result: VerificationResult }) {
  const config = {
    authentic: {
      icon: CheckCircle2,
      title: 'Authentic original',
      panel: 'bg-heritage-sky/15 ring-heritage-sky/40',
      badge: 'bg-heritage-sky/30 text-heritage-sky-deep',
    },
    different: {
      icon: GitBranch,
      title: 'Different version',
      panel: 'bg-heritage-sand/35 ring-heritage-sand-deep/45',
      badge: 'bg-heritage-sand/70 text-heritage-mocha',
    },
    unknown: {
      icon: HelpCircle,
      title: 'Not in this vault',
      panel: 'bg-muted/70 ring-border',
      badge: 'bg-background text-muted-foreground',
    },
  }[result.status];

  const Icon = config.icon;

  return (
    <div className={cn('rounded-[1.75rem] px-8 py-8 ring-1', config.panel)}>
      <div className="flex flex-col items-center text-center">
        <span
          className={cn(
            'flex h-14 w-14 items-center justify-center rounded-3xl',
            config.badge
          )}
        >
          <Icon className="h-7 w-7" />
        </span>
        <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground">
          {config.title}
        </h2>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
          {result.message}
        </p>

        {result.match && (
          <Link
            href={`/certificate/${result.match.heritageId}`}
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-heritage-sky-deep hover:underline"
          >
            {result.match.heritageTitle} · {result.match.provenanceTitle}
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </div>
  );
}

function FingerprintComparison({ result }: { result: VerificationResult }) {
  return (
    <div className="rounded-3xl bg-card p-6 shadow-heritage">
      <p className="text-[11px] font-semibold tracking-label text-muted-foreground">
        Fingerprint comparison
      </p>

      <dl className="mt-4 space-y-4">
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Uploaded file</dt>
          <dd className="mt-1 break-all font-mono text-sm text-foreground">
            {result.uploadedDna}
          </dd>
        </div>
        {result.registeredDna && (
          <div>
            <dt className="text-xs font-medium text-muted-foreground">
              Registered record
            </dt>
            <dd
              className={cn(
                'mt-1 break-all font-mono text-sm',
                result.status === 'authentic'
                  ? 'text-heritage-sky-deep'
                  : 'text-heritage-mocha'
              )}
            >
              {result.registeredDna}
            </dd>
          </div>
        )}
      </dl>

      <p className="mt-5 border-t border-border/60 pt-4 text-xs leading-relaxed text-muted-foreground">
        SHA-256 is all-or-nothing: two files match only if every byte matches.
        A {result.matchPercentage}% match means{' '}
        {result.matchPercentage === 100
          ? 'these are byte-for-byte the same file.'
          : 'the contents differ — even a single changed pixel produces a completely different fingerprint.'}
      </p>
    </div>
  );
}
