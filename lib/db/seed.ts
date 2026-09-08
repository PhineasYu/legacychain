/**
 * Demo archive seeding.
 *
 * Runs once, when the vault is empty, so the app is never a blank page.
 *
 * The seeded items are put through the *real* pipeline — real bytes are
 * generated, really hashed, really signed and really anchored — rather
 * than being hard-coded fixtures with invented hashes. That means the
 * demo works end to end: download a seeded original from the vault,
 * re-upload it on the Verify page, and it genuinely verifies.
 *
 * The generated images are clearly-labelled archival plates, not
 * photographs. Real family material is what the user uploads.
 */

import 'server-only';
import { preserveHeritage } from '../server/heritage-service';
import { generateHeuristicEnrichment } from '../services/ai-enrichment';
import type { HeritageType } from '../types';
import type { HeritageStore } from './store';

interface SeedItem {
  title: string;
  year: number;
  type: HeritageType;
  location: string;
  story: string;
  palette: { ink: string; paper: string; accent: string };
}

const SEED_ITEMS: SeedItem[] = [
  {
    title: "Grandparents' Wedding",
    year: 1968,
    type: 'Photograph',
    location: 'Addis Ababa, Ethiopia',
    story:
      'My grandparents on their wedding day, surrounded by family. This photograph has been kept in our family album for over five decades.',
    palette: { ink: '#4a3527', paper: '#f4ead8', accent: '#b08542' },
  },
  {
    title: "Grandmother's Voice",
    year: 1975,
    type: 'Audio',
    location: 'Dire Dawa, Ethiopia',
    story:
      'A recording of my grandmother singing a traditional lullaby, transferred from a cassette tape.',
    palette: { ink: '#2f3b45', paper: '#e9eef2', accent: '#6b8fa3' },
  },
  {
    title: 'Family Letter',
    year: 1982,
    type: 'Letter',
    location: 'Addis Ababa, Ethiopia',
    story:
      'A letter written by my grandfather to my grandmother during a period of separation, speaking of patience and hope.',
    palette: { ink: '#3d3226', paper: '#f6efe0', accent: '#8a6f4a' },
  },
  {
    title: 'Three Generations',
    year: 1992,
    type: 'Photograph',
    location: 'Harar, Ethiopia',
    story:
      'A family gathering during the holidays. Three generations together in one photograph, taken by a visiting relative.',
    palette: { ink: '#41352c', paper: '#f2e9dc', accent: '#a8763f' },
  },
];

export async function seedIfEmpty(store: HeritageStore): Promise<void> {
  const existing = await store.listHeritage();
  if (existing.length > 0) return;

  for (const seed of SEED_ITEMS) {
    const svg = archivalPlate(seed);
    const id = slug(seed.title);
    const enrichment = generateHeuristicEnrichment({
      fileName: `${id}.svg`,
      heritageType: seed.type,
      title: seed.title,
      year: seed.year,
      location: seed.location,
    });

    await preserveHeritage({
      // Deterministic ids and timestamp: the demo archive must look
      // identical on every server instance, so a certificate link shared
      // with a teammate resolves wherever their request lands.
      id: `heritage-${id}`,
      provenanceId: `prov-${id}-original`,
      createdAt: seedTimestamp(seed.year),
      title: seed.title,
      year: seed.year,
      type: seed.type,
      location: seed.location,
      story: seed.story,
      contributor: {
        name: 'Sara Abdi',
        identityStatus: 'Verified Identity',
        relationship: 'Granddaughter',
      },
      aiEnrichment: {
        ...enrichment,
        status: 'accepted',
        note: 'AI suggestions are never automatically treated as historical facts.',
        source: 'heuristic (seed data)',
      },
      file: {
        bytes: new TextEncoder().encode(svg),
        contentType: 'image/svg+xml',
        originalName: `${id}.svg`,
      },
    });
  }
}

/**
 * Builds a deterministic archival plate for a seed item.
 *
 * Deterministic matters: the same seed item always produces the same
 * bytes, so its fingerprint is stable across a re-seed.
 */
function archivalPlate(seed: SeedItem): string {
  const { ink, paper, accent } = seed.palette;
  const id = slug(seed.title);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600" role="img" aria-label="${escapeXml(
    seed.title
  )}, ${seed.year}">
  <defs>
    <linearGradient id="g-${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${paper}"/>
      <stop offset="100%" stop-color="${shade(paper)}"/>
    </linearGradient>
    <radialGradient id="v-${id}" cx="50%" cy="45%" r="72%">
      <stop offset="55%" stop-color="${ink}" stop-opacity="0"/>
      <stop offset="100%" stop-color="${ink}" stop-opacity="0.34"/>
    </radialGradient>
  </defs>
  <rect width="800" height="600" fill="url(#g-${id})"/>
  <rect x="34" y="34" width="732" height="532" fill="none" stroke="${accent}" stroke-opacity="0.55" stroke-width="2"/>
  <rect x="46" y="46" width="708" height="508" fill="none" stroke="${accent}" stroke-opacity="0.28" stroke-width="1"/>
  <text x="400" y="150" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="20" letter-spacing="7" fill="${accent}">LEGACYCHAIN ARCHIVE</text>
  <text x="400" y="286" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="52" fill="${ink}">${escapeXml(
    seed.title
  )}</text>
  <text x="400" y="368" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="86" font-weight="bold" fill="${accent}" fill-opacity="0.82">${seed.year}</text>
  <text x="400" y="430" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="22" fill="${ink}" fill-opacity="0.75">${escapeXml(
    seed.location
  )}</text>
  <line x1="300" y1="466" x2="500" y2="466" stroke="${accent}" stroke-opacity="0.5" stroke-width="1"/>
  <text x="400" y="506" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="15" letter-spacing="3" fill="${ink}" fill-opacity="0.55">${escapeXml(
    seed.type.toUpperCase()
  )} · DEMONSTRATION PLATE</text>
  <rect width="800" height="600" fill="url(#v-${id})"/>
</svg>
`;
}

/**
 * A fixed creation timestamp per seed item, increasing with the item's year,
 * so the vault sorts newest-first everywhere and PQC signatures over these
 * records are reproducible across instances.
 */
function seedTimestamp(year: number): string {
  // Minutes overflow into hours, which keeps the mapping monotonic.
  return new Date(Date.UTC(2026, 0, 15, 0, year - 1900, 0)).toISOString();
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function shade(hex: string): string {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map((offset) =>
    Math.max(0, parseInt(value.slice(offset, offset + 2), 16) - 22)
  );
  return `#${channels.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
