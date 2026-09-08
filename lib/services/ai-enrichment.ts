/**
 * Heuristic heritage enrichment.
 *
 * The offline fallback for lib/server/ai.ts. It derives an era and tags
 * from the metadata the family already supplied — it does not look at
 * the file, and it never claims to. Output is labelled `heuristic` so the
 * UI can distinguish it from a real model's suggestion.
 */

export interface HeuristicInput {
  fileName: string;
  heritageType: string;
  title: string;
  year?: number;
  location?: string;
}

export interface HeuristicResult {
  estimatedEra: string;
  suggestedTags: string[];
  description: string;
}

export function generateHeuristicEnrichment(input: HeuristicInput): HeuristicResult {
  const estimatedEra = guessEra(input.year);
  return {
    estimatedEra,
    suggestedTags: generateTags(input.heritageType, input.title, input.location),
    description: generateDescription(input.heritageType, input.title, estimatedEra),
  };
}

function guessEra(year?: number): string {
  if (!year || Number.isNaN(year)) return 'Unknown era';
  const decade = Math.floor(year / 10) * 10;
  return `${decade}s–${decade + 10}s`;
}

function generateTags(type: string, title: string, location?: string): string[] {
  const baseTags: Record<string, string[]> = {
    Photograph: ['Photograph', 'Family'],
    Audio: ['Voice Recording', 'Audio'],
    Document: ['Document', 'Personal'],
    Video: ['Video', 'Family'],
    Letter: ['Letter', 'Correspondence'],
  };

  const tags = [
    ...(baseTags[type] ?? ['Heritage', 'Family']),
    ...(location ? [location.split(',')[0].trim()] : []),
    ...titleKeywords(title),
  ];

  // Preserve order while removing duplicates and empties.
  return Array.from(new Set(tags.filter(Boolean))).slice(0, 5);
}

function titleKeywords(title: string): string[] {
  return title
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}'-]/gu, ''))
    .filter((word) => word.length > 3)
    .slice(0, 2);
}

function generateDescription(type: string, title: string, era: string): string {
  const typeLabels: Record<string, string> = {
    Photograph: 'A family photograph',
    Audio: 'An audio recording',
    Document: 'A document',
    Video: 'A video recording',
    Letter: 'A handwritten letter',
  };
  const label = typeLabels[type] ?? 'A heritage item';
  return `${label} catalogued as "${title}". Based on the year supplied by the family, it belongs to the ${era} period. No visual analysis was performed — this summary was generated from the metadata alone and is awaiting family review.`;
}
