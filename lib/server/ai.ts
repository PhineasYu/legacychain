/**
 * AI enrichment for heritage items.
 *
 * THE RULE THIS MODULE EXISTS TO ENFORCE:
 *   AI discovers. Humans attest. Cryptography preserves.
 *
 * Everything returned here is a SUGGESTION. It is stored with
 * `status: 'pending'` and is never promoted to a historical fact until a
 * person accepts or edits it, and never touches the original file or its
 * fingerprint. When no API key is configured the heuristic fallback runs
 * instead, labelled `heuristic` so the UI can say where a claim came from.
 */

import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { generateHeuristicEnrichment } from '../services/ai-enrichment';
import type { AiEnrichment, HeritageType } from '../types';
import { ANTHROPIC_API_KEY, ANTHROPIC_MODEL, isAiConfigured } from './config';

/** Vision-capable media types accepted by the Anthropic image block. */
const VISION_MEDIA_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

/** Images above this size are described from metadata only, to stay fast. */
const MAX_VISION_BYTES = 4 * 1024 * 1024;

export interface EnrichmentInput {
  fileName: string;
  contentType: string;
  heritageType: HeritageType;
  title: string;
  year?: number;
  location?: string;
  story?: string;
  /** Raw file bytes — used for vision when the file is a supported image */
  bytes?: Uint8Array;
}

const NOTE =
  'A reading, not the record. Everything here stays attached to the original ' +
  'and is only what a person accepts.';

export async function enrichHeritage(input: EnrichmentInput): Promise<AiEnrichment> {
  if (!isAiConfigured()) {
    return withDefaults(generateHeuristicEnrichment(input), 'heuristic');
  }

  try {
    const suggestion = await callAnthropic(input);
    return withDefaults(suggestion, ANTHROPIC_MODEL);
  } catch {
    // A failed enrichment must never block preservation — the heritage
    // item and its proof matter, the description is decoration.
    const fallback = generateHeuristicEnrichment(input);
    return withDefaults(fallback, 'heuristic (AI unavailable)');
  }
}

async function callAnthropic(input: EnrichmentInput): Promise<{
  transcript?: string;
  estimatedEra: string;
  suggestedTags: string[];
  description: string;
}> {
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  const content: Anthropic.MessageParam['content'] = [];

  if (
    input.bytes &&
    VISION_MEDIA_TYPES.has(input.contentType) &&
    input.bytes.byteLength <= MAX_VISION_BYTES
  ) {
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: input.contentType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
        data: Buffer.from(input.bytes).toString('base64'),
      },
    });
  }

  content.push({ type: 'text', text: buildPrompt(input) });

  const response = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 1024,
    system:
      'You help families read heritage artifacts that are hard to read: faded ' +
      'handwriting, old scripts, damaged documents. Transcribe faithfully — keep ' +
      'the original wording, spelling and line breaks, and mark anything you ' +
      'cannot make out as [illegible] rather than guessing. Describe only what is ' +
      'observable, and never state identities, relationships or events as fact: ' +
      'those are for family members to confirm. Reply with JSON only.',
    messages: [{ role: 'user', content }],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n');

  return parseSuggestion(text);
}

function buildPrompt(input: EnrichmentInput): string {
  const facts = [
    `Heritage type: ${input.heritageType}`,
    `Title given by the family: ${input.title}`,
    input.year ? `Approximate year given by the family: ${input.year}` : null,
    input.location ? `Location given by the family: ${input.location}` : null,
    input.story ? `Story given by the family: ${input.story}` : null,
    `File name: ${input.fileName}`,
  ]
    .filter(Boolean)
    .join('\n');

  const wantsTranscript = ['Letter', 'Document'].includes(input.heritageType);

  return `${facts}

Help this family read and catalogue a heritage item.

${
    wantsTranscript
      ? `Transcribe any text you can see, faithfully: keep the original wording,
spelling and line breaks. Mark unreadable passages as [illegible] instead of
guessing at them. If there is no legible text, return an empty transcript.`
      : `If any text is visible in this item, transcribe it. Otherwise return an
empty transcript.`
  }

Then describe what is observable, and hedge anything you cannot verify. Do not
name people, and do not assert that an event happened — the family confirms
those separately.

Respond with JSON only, in exactly this shape:
{
  "transcript": "the text you can read, or an empty string",
  "estimatedEra": "a decade range, e.g. 1960s-1970s",
  "suggestedTags": ["3 to 5 short tags"],
  "description": "two or three sentences describing what is observable"
}`;
}

function parseSuggestion(text: string): {
  transcript?: string;
  estimatedEra: string;
  suggestedTags: string[];
  description: string;
} {
  // Models sometimes wrap JSON in prose or a fenced block.
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON object in model response');

  const parsed = JSON.parse(match[0]) as Record<string, unknown>;
  const tags = Array.isArray(parsed.suggestedTags)
    ? parsed.suggestedTags.map(String).slice(0, 5)
    : [];

  if (typeof parsed.description !== 'string' || parsed.description.length === 0) {
    throw new Error('Model response is missing a description');
  }

  const transcript =
    typeof parsed.transcript === 'string' && parsed.transcript.trim().length > 0
      ? parsed.transcript.trim()
      : undefined;

  return {
    transcript,
    estimatedEra: String(parsed.estimatedEra ?? 'Unknown era'),
    suggestedTags: tags,
    description: parsed.description,
  };
}

function withDefaults(
  suggestion: {
    transcript?: string;
    estimatedEra: string;
    suggestedTags: string[];
    description: string;
  },
  source: string
): AiEnrichment {
  return {
    ...suggestion,
    status: 'pending',
    note: NOTE,
    source,
  };
}
