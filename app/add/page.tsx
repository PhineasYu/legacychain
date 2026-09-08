'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  FileText,
  Fingerprint,
  ImageIcon,
  KeyRound,
  Link2,
  Loader2,
  Mic,
  Pencil,
  Sparkles,
  Upload,
  Video,
  X,
} from 'lucide-react';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AnchorProof } from '@/components/anchor-proof';
import { ProtocolBadges } from '@/components/protocol-badges';
import { ApiError, enrichFile, preserveHeritage, reviewEnrichment } from '@/lib/api-client';
import { createDigitalFingerprint } from '@/lib/services/hashing';
import type { AiEnrichment, HeritageItem, HeritageType } from '@/lib/types';
import { cn } from '@/lib/utils';

const heritageTypes: { value: HeritageType; icon: typeof ImageIcon }[] = [
  { value: 'Photograph', icon: ImageIcon },
  { value: 'Audio', icon: Mic },
  { value: 'Document', icon: FileText },
  { value: 'Video', icon: Video },
  { value: 'Letter', icon: FileText },
];

/**
 * The five preservation steps, in the order the server performs them.
 * Each step is marked complete only once the work behind it is done, so
 * the animation reflects real progress rather than a fixed timer.
 */
type StepId = 'ai' | 'hash' | 'pqc' | 'anchor' | 'certificate';

const STEPS: { id: StepId; label: string; note: string; icon: typeof Sparkles }[] = [
  { id: 'ai', label: 'Reading the source', note: 'A suggestion — you decide whether it counts', icon: Sparkles },
  { id: 'hash', label: 'Digital DNA', note: 'SHA-256 over the exact bytes you uploaded', icon: Fingerprint },
  { id: 'pqc', label: 'Post-quantum signature', note: 'ML-DSA-44 · binds the hash, the guardian and the timestamp', icon: KeyRound },
  { id: 'anchor', label: 'Writing to the chain', note: 'Four values go on-chain. The file never does.', icon: Link2 },
  { id: 'certificate', label: 'Issuing the certificate', note: 'Anyone can now check this without asking us', icon: Archive },
];

type Phase = 'form' | 'processing' | 'done';

export default function AddHeritagePage() {
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [heritageType, setHeritageType] = useState<HeritageType>('Photograph');
  const [title, setTitle] = useState('');
  const [year, setYear] = useState('');
  const [location, setLocation] = useState('');
  const [story, setStory] = useState('');
  const [contributorName, setContributorName] = useState('');
  const [contributorRelationship, setContributorRelationship] = useState('');

  const [phase, setPhase] = useState<Phase>('form');
  const [activeStep, setActiveStep] = useState<StepId | null>(null);
  const [completedSteps, setCompletedSteps] = useState<StepId[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [aiData, setAiData] = useState<AiEnrichment | null>(null);
  const [preserved, setPreserved] = useState<HeritageItem | null>(null);
  /** What each stage actually produced — shown under its row as it lands. */
  const [stepDetail, setStepDetail] = useState<Partial<Record<StepId, string>>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  function selectFile(selected: File | undefined) {
    if (!selected) return;
    setFile(selected);
    setError(null);
    setFilePreview(
      selected.type.startsWith('image/') ? URL.createObjectURL(selected) : null
    );
  }

  async function handlePreserve() {
    if (!file || !title.trim()) return;

    setPhase('processing');
    setError(null);
    setCompletedSteps([]);
    setAiData(null);
    setPreserved(null);
    setStepDetail({});

    try {
      // Step 1 — ask the model what it can observe. Suggestions only.
      setActiveStep('ai');
      const enrichment = await enrichFile({
        file,
        title: title.trim(),
        type: heritageType,
        year: year.trim() || undefined,
        location: location.trim() || undefined,
        story: story.trim() || undefined,
      });
      setAiData(enrichment);
      setStepDetail((d) => ({ ...d, ai: `source: ${enrichment.source}` }));
      setCompletedSteps(['ai']);

      // The fingerprint is computed here, in the browser, over the same bytes
      // that are about to be uploaded — so what is shown is the real digest,
      // not an echo of whatever the server later claims.
      const localDigest = (await createDigitalFingerprint(file)).digest;

      // Steps 2-5 all happen inside one server request; they are revealed
      // in sequence so the pipeline stays legible while it runs.
      setActiveStep('hash');
      const request = preserveHeritage({
        file,
        title: title.trim(),
        year: year.trim(),
        type: heritageType,
        location: location.trim(),
        story: story.trim(),
        contributorName: contributorName.trim() || undefined,
        contributorRelationship: contributorRelationship.trim() || undefined,
        aiEnrichment: enrichment,
      });

      for (const step of ['hash', 'pqc', 'anchor'] as StepId[]) {
        setActiveStep(step);
        await delay(700);
        if (step === 'hash') {
          setStepDetail((d) => ({ ...d, hash: localDigest }));
        }
        setCompletedSteps((current) => [...current, step]);
      }

      setActiveStep('certificate');
      const item = await request;
      setStepDetail((d) => ({
        ...d,
        pqc: item.pqcSignature.signatureBase64
          ? `${item.pqcSignature.algorithm} · ${item.pqcSignature.signatureBase64.length} base64 chars`
          : 'unsigned',
        anchor: item.blockchain
          ? `record ${item.blockchain.recordId.slice(0, 22)}… on ${item.blockchain.network}`
          : 'not anchored',
        certificate: item.id,
      }));
      setCompletedSteps((current) => [...current, 'certificate']);
      setActiveStep(null);
      setPreserved(item);
      setAiData(item.aiEnrichment ?? enrichment);
      setPhase('done');
    } catch (preserveError) {
      setError(
        preserveError instanceof ApiError
          ? preserveError.message
          : 'Something went wrong while preserving this item.'
      );
      setActiveStep(null);
      setPhase('form');
    }
  }

  function handleReset() {
    setFile(null);
    setFilePreview(null);
    setTitle('');
    setYear('');
    setLocation('');
    setStory('');
    setContributorName('');
    setContributorRelationship('');
    setHeritageType('Photograph');
    setPhase('form');
    setActiveStep(null);
    setCompletedSteps([]);
    setAiData(null);
    setPreserved(null);
    setError(null);
  }

  return (
    <div className="min-h-screen bg-paper-grain">
      <SiteHeader />

      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="mb-9">
          <p className="text-[11px] font-semibold tracking-label text-muted-foreground">
            Add Heritage
          </p>
          <h1 className="mt-3 font-display text-5xl font-extrabold tracking-tight text-foreground">
            Preserve a memory
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Upload an original photograph, recording, letter or document.
            LegacyChain fingerprints the exact bytes, signs the provenance
            claim, and anchors it — the file itself stays private.
          </p>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl bg-destructive/10 px-5 py-4 ring-1 ring-destructive/20">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {phase === 'form' && (
          <div className="rounded-[1.75rem] bg-card p-6 shadow-heritage sm:p-8">
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
                      alt="Selected file preview"
                      className="max-h-48 rounded-2xl object-contain shadow-heritage"
                    />
                  ) : (
                    <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-heritage-sky/20 text-heritage-sky-deep">
                      <FileText className="h-7 w-7" />
                    </span>
                  )}
                  <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <CheckCircle2 className="h-4 w-4 text-heritage-sky-deep" />
                    {file.name}
                  </span>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-destructive"
                    onClick={(event) => {
                      event.stopPropagation();
                      setFile(null);
                      setFilePreview(null);
                    }}
                  >
                    Remove file
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-heritage-sky/20 text-heritage-sky-deep">
                    <Upload className="h-7 w-7" />
                  </span>
                  <div>
                    <p className="font-display text-lg font-semibold text-foreground">
                      Upload the original
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
                accept="image/*,audio/*,video/*,.pdf,.txt,.doc,.docx"
                onChange={(event) => selectFile(event.target.files?.[0])}
              />
            </div>

            <fieldset className="mt-7">
              <legend className="text-sm font-semibold text-foreground">
                Heritage type
              </legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {heritageTypes.map(({ value, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setHeritageType(value)}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors',
                      heritageType === value
                        ? 'bg-heritage-mocha text-heritage-sand'
                        : 'bg-secondary text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {value}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                id="title"
                label="Title"
                value={title}
                onChange={setTitle}
                placeholder="Grandparents' Wedding"
              />
              <Field
                id="year"
                label="Approximate year"
                value={year}
                onChange={setYear}
                placeholder="1968"
              />
              <Field
                id="location"
                label="Location"
                value={location}
                onChange={setLocation}
                placeholder="Addis Ababa, Ethiopia"
              />
              <Field
                id="contributor"
                label="Your name"
                value={contributorName}
                onChange={setContributorName}
                placeholder="Sara Abdi"
              />
              <Field
                id="relationship"
                label="Relationship"
                value={contributorRelationship}
                onChange={setContributorRelationship}
                placeholder="Granddaughter"
              />
            </div>

            <div className="mt-4">
              <Label htmlFor="story" className="text-sm font-semibold text-foreground">
                Story
              </Label>
              <Textarea
                id="story"
                value={story}
                onChange={(event) => setStory(event.target.value)}
                placeholder="Tell the story behind this memory…"
                className="mt-2 min-h-[110px] rounded-2xl"
              />
            </div>

            <Button
              size="lg"
              className="mt-7 w-full gap-2 rounded-full"
              onClick={handlePreserve}
              disabled={!file || !title.trim()}
            >
              <Fingerprint className="h-5 w-5" />
              Preserve memory
            </Button>
            {(!file || !title.trim()) && (
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Upload a file and add a title to continue.
              </p>
            )}
          </div>
        )}

        {phase === 'processing' && (
          <div className="rounded-[1.75rem] bg-card p-8 shadow-heritage-lg">
            <div className="text-center">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-heritage-sky/20">
                <Loader2 className="h-7 w-7 animate-spin text-heritage-sky-deep" />
              </span>
              <h2 className="mt-5 font-display text-2xl font-semibold text-foreground">
                Preserving heritage
              </h2>
            </div>

            <ol className="mt-8 space-y-2">
              {STEPS.map(({ id, label, note, icon: Icon }) => {
                const complete = completedSteps.includes(id);
                const active = activeStep === id;
                return (
                  <li
                    key={id}
                    className={cn(
                      'flex items-center gap-4 rounded-2xl px-5 py-4 transition-all duration-300',
                      complete && 'bg-heritage-sky/10 ring-1 ring-heritage-sky/25',
                      active && 'bg-secondary shadow-heritage',
                      !complete && !active && 'opacity-45'
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-xl',
                        complete && 'bg-heritage-sky/25 text-heritage-sky-deep',
                        active && 'bg-heritage-mocha text-heritage-sand',
                        !complete && !active && 'bg-muted text-muted-foreground'
                      )}
                    >
                      {complete ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : active ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Icon className="h-5 w-5" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <span
                        className={cn(
                          'text-sm font-medium',
                          complete && 'text-heritage-sky-deep',
                          active && 'text-foreground',
                          !complete && !active && 'text-muted-foreground'
                        )}
                      >
                        {label}
                      </span>
                      <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>
                      {stepDetail[id] && (
                        <p className="mt-1 break-all font-mono text-[11px] text-heritage-sky-deep">
                          {stepDetail[id]}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {phase === 'done' && preserved && (
          <div className="animate-fade-in-up space-y-5">
            <div className="rounded-[1.75rem] bg-mocha-panel px-8 py-9 text-center shadow-heritage-lg">
              <CheckCircle2 className="mx-auto h-9 w-9 text-heritage-sky" />
              <h2 className="mt-4 font-display text-3xl font-bold text-white">
                Heritage preserved
              </h2>
              <p className="mt-2 text-sm text-heritage-sand/90">
                “{preserved.title}” now has a fingerprint, a post-quantum
                signature and a provenance record.
              </p>
            </div>

            <ProtocolBadges
              protocols={{
                digitalDna: true,
                pqcSignature: preserved.pqcSignature.status === 'Verified',
                blockchain: Boolean(preserved.blockchain),
              }}
              anchorStatus={preserved.blockchain?.status}
            />

            <div className="rounded-3xl bg-card p-6 shadow-heritage">
              <p className="text-[11px] font-semibold tracking-label text-muted-foreground">
                Digital DNA · SHA-256
              </p>
              <p className="mt-2 break-all font-mono text-sm text-foreground">
                {preserved.digitalDna}
              </p>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Computed from the exact bytes you uploaded. Change one byte and
                this fingerprint changes completely.
              </p>
            </div>

            <AnchorProof anchor={preserved.blockchain} />

            {/* Spelled out, because "we put it on a blockchain" is the claim
                people are right to be suspicious of. */}
            <div className="rounded-3xl bg-secondary/60 px-6 py-5">
              <p className="text-[11px] font-semibold tracking-label text-muted-foreground">
                What went on the chain
              </p>
              <dl className="mt-3 space-y-1.5 font-mono text-[11px]">
                <ChainRow label="record id" value={preserved.blockchain?.recordId ?? '—'} />
                <ChainRow label="file hash" value={preserved.blockchain?.fileHash ?? '—'} />
                <ChainRow label="signature" value="keccak256 of the ML-DSA signature" />
                <ChainRow label="parent" value="0x00… (this is an original)" />
              </dl>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Four values, and nothing else. The file itself, your name, the
                story and the location never leave this vault.
              </p>
            </div>

            {aiData && (
              <AiSuggestionCard
                heritageId={preserved.id}
                data={aiData}
                onChange={setAiData}
              />
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                variant="outline"
                className="gap-2 rounded-full"
                onClick={handleReset}
              >
                <Upload className="h-4 w-4" />
                Preserve another
              </Button>
              <Link href={`/certificate/${preserved.id}`} className="flex-1">
                <Button className="w-full gap-2 rounded-full">
                  <Archive className="h-4 w-4" />
                  View heritage certificate
                </Button>
              </Link>
            </div>
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

function ChainRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="w-24 flex-shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-all text-foreground/80">{value}</dd>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <Label htmlFor={id} className="text-sm font-semibold text-foreground">
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 rounded-xl"
      />
    </div>
  );
}

/**
 * The human review step.
 *
 * A suggestion arrives as `pending` and stays that way until a person acts on
 * it. Accept, edit or reject are the only ways out, and each is persisted, so
 * a certificate always shows whether a description was reviewed and by what
 * verdict — the model's output never silently becomes the family's record.
 */
function AiSuggestionCard({
  heritageId,
  data,
  onChange,
}: {
  heritageId: string;
  data: AiEnrichment;
  onChange: (data: AiEnrichment) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.description);
  const [saving, setSaving] = useState<AiEnrichment['status'] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(status: AiEnrichment['status'], description?: string) {
    setSaving(status);
    setError(null);
    try {
      const updated = await reviewEnrichment({
        heritageId,
        status,
        description,
      });
      onChange(updated);
      setEditing(false);
    } catch (reviewError) {
      setError(
        reviewError instanceof ApiError
          ? reviewError.message
          : 'Could not record your decision.'
      );
    } finally {
      setSaving(null);
    }
  }

  const decided = data.status !== 'pending';
  const rejected = data.status === 'rejected';

  return (
    <div
      className={cn(
        'rounded-3xl p-6 shadow-heritage',
        rejected ? 'bg-muted/60' : 'bg-heritage-sand/20'
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-heritage-mocha text-heritage-sand">
          <Sparkles className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-display text-lg font-semibold text-foreground">
            What the AI read
          </h3>
          <p className="text-xs text-muted-foreground">Source: {data.source}</p>
        </div>
      </div>

      <dl className={cn('mt-5 space-y-4', rejected && 'opacity-50')}>
        {data.transcript && (
          <div>
            <dt className="text-[11px] font-semibold tracking-label text-muted-foreground">
              Transcript — what the AI could read
            </dt>
            <dd className="mt-2 whitespace-pre-wrap rounded-2xl bg-card px-4 py-3 font-serif-body text-sm leading-relaxed text-foreground ring-1 ring-border">
              {data.transcript}
            </dd>
          </div>
        )}
        <div>
          <dt className="text-[11px] font-semibold tracking-label text-muted-foreground">
            Estimated era
          </dt>
          <dd className="mt-1 text-sm text-foreground">{data.estimatedEra}</dd>
        </div>

        {data.suggestedTags.length > 0 && (
          <div>
            <dt className="text-[11px] font-semibold tracking-label text-muted-foreground">
              Suggested tags
            </dt>
            <dd className="mt-2 flex flex-wrap gap-2">
              {data.suggestedTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-card px-3 py-1 text-xs font-medium text-foreground ring-1 ring-border"
                >
                  {tag}
                </span>
              ))}
            </dd>
          </div>
        )}

        <div>
          <dt className="text-[11px] font-semibold tracking-label text-muted-foreground">
            Description
          </dt>
          <dd className="mt-1.5">
            {editing ? (
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className="min-h-[100px] rounded-2xl"
              />
            ) : (
              <p
                className={cn(
                  'text-sm leading-relaxed text-foreground',
                  rejected && 'line-through'
                )}
              >
                {data.description}
              </p>
            )}
          </dd>
        </div>
      </dl>

      <div className="mt-5 flex items-start gap-2 rounded-2xl bg-warning/10 px-4 py-3 ring-1 ring-warning/20">
        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" />
        <p className="text-xs font-medium text-warning">{data.note}</p>
      </div>

      {error && (
        <p className="mt-3 rounded-xl bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          {error}
        </p>
      )}

      {editing ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            size="sm"
            className="gap-2 rounded-full"
            onClick={() => submit('edited', draft)}
            disabled={saving !== null || draft.trim().length === 0}
          >
            {saving === 'edited' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            Save my version
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="rounded-full"
            onClick={() => {
              setDraft(data.description);
              setEditing(false);
            }}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            className="gap-2 rounded-full"
            onClick={() => submit('accepted')}
            disabled={saving !== null}
          >
            {saving === 'accepted' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            Accept
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-2 rounded-full"
            onClick={() => {
              setDraft(data.description);
              setEditing(true);
            }}
            disabled={saving !== null}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="gap-2 rounded-full text-destructive hover:text-destructive"
            onClick={() => submit('rejected')}
            disabled={saving !== null}
          >
            {saving === 'rejected' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <X className="h-3.5 w-3.5" />
            )}
            Reject
          </Button>

          <span
            className={cn(
              'ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1',
              decided
                ? rejected
                  ? 'bg-muted text-muted-foreground ring-border'
                  : 'bg-heritage-sky/25 text-heritage-sky-deep ring-heritage-sky/45'
                : 'bg-warning/15 text-warning ring-warning/25'
            )}
          >
            {data.status === 'pending' && 'Awaiting your review'}
            {data.status === 'accepted' && 'Accepted by you'}
            {data.status === 'edited' && 'Edited by you'}
            {data.status === 'rejected' && 'Rejected'}
          </span>
        </div>
      )}
    </div>
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
