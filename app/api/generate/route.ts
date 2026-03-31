import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { mulberry32, dateToSeed, seededShuffle } from '@/lib/seed';
import { supabase } from '@/lib/supabase';
import type { RoundData } from '@/lib/types';
import fs from 'fs';
import path from 'path';

// ── Server-side daily cache ───────────────────────────────────────────────────
const roundCache = new Map<string, RoundData[]>();

// ── Token bucket: 15 req/min, refill 1 token every 4 s ───────────────────────
const BUCKET_MAX = 15;
const REFILL_INTERVAL_MS = 4_000;
let bucketTokens = BUCKET_MAX;
let lastRefillTime = Date.now();

function consumeToken(): boolean {
  const now = Date.now();
  const refills = Math.floor((now - lastRefillTime) / REFILL_INTERVAL_MS);
  if (refills > 0) {
    bucketTokens = Math.min(BUCKET_MAX, bucketTokens + refills);
    lastRefillTime += refills * REFILL_INTERVAL_MS;
  }
  if (bucketTokens <= 0) return false;
  bucketTokens--;
  return true;
}

// ── Hardcoded fallback rounds (one per slot) ──────────────────────────────────
const FALLBACK_ROUNDS: RoundData[] = [
  {
    roundNumber: 1,
    theme: 'Antibiotic mechanism of action',
    categories: ['Cell Wall Synthesis Inhibitors', 'Protein Synthesis Inhibitors', 'DNA/Folate Inhibitors'],
    items: [
      { name: 'Bacitracin', category: 'Cell Wall Synthesis Inhibitors' },
      { name: 'Amoxicillin', category: 'Cell Wall Synthesis Inhibitors' },
      { name: 'Tobramycin', category: 'Protein Synthesis Inhibitors' },
      { name: 'Gentamicin', category: 'Protein Synthesis Inhibitors' },
      { name: 'Erythromycin', category: 'Protein Synthesis Inhibitors' },
      { name: 'Ciprofloxacin', category: 'DNA/Folate Inhibitors' },
      { name: 'Trimethoprim', category: 'DNA/Folate Inhibitors' },
    ],
    explanation: 'Bacitracin and Amoxicillin both inhibit cell wall synthesis, though at different steps. Tobramycin, Gentamicin, and Erythromycin inhibit protein synthesis at the 30S or 50S ribosomal subunit. The MOA triad — cell wall, protein synthesis, DNA/folate — is a foundational NBEO framework tested frequently.',
  },
  {
    roundNumber: 2,
    theme: 'Gram coverage spectrum',
    categories: ['Gram-Positive Only', 'Gram-Negative Only', 'Broad Spectrum'],
    items: [
      { name: 'Bacitracin', category: 'Gram-Positive Only' },
      { name: 'Dicloxacillin', category: 'Gram-Positive Only' },
      { name: 'Polymyxin B', category: 'Gram-Negative Only' },
      { name: 'Amoxicillin', category: 'Broad Spectrum' },
      { name: 'Gentamicin', category: 'Broad Spectrum' },
      { name: 'Ceftriaxone', category: 'Broad Spectrum' },
      { name: 'Ciprofloxacin', category: 'Broad Spectrum' },
    ],
    explanation: 'Bacitracin and Dicloxacillin are limited to gram-positive coverage; Polymyxin B targets gram-negatives exclusively. Broad-spectrum agents cover both, making them preferred for empiric therapy. Knowing gram coverage is essential for the NBEO when choosing treatment for ocular infections.',
  },
  {
    roundNumber: 3,
    theme: 'Adverse effect profiles',
    categories: ['Hypersensitivity Risk', 'GI Side Effects', 'Nephrotoxicity/Ototoxicity'],
    items: [
      { name: 'Penicillin', category: 'Hypersensitivity Risk' },
      { name: 'Cephalexin', category: 'Hypersensitivity Risk' },
      { name: 'Erythromycin', category: 'GI Side Effects' },
      { name: 'Amoxicillin', category: 'GI Side Effects' },
      { name: 'Tetracycline', category: 'GI Side Effects' },
      { name: 'Tobramycin', category: 'Nephrotoxicity/Ototoxicity' },
      { name: 'Gentamicin', category: 'Nephrotoxicity/Ototoxicity' },
    ],
    explanation: 'Beta-lactams carry the highest risk of IgE-mediated hypersensitivity including anaphylaxis. Macrolides and tetracyclines cause significant GI upset. Aminoglycosides like Tobramycin and Gentamicin are nephrotoxic and ototoxic — a high-yield adverse-effect pairing for the NBEO.',
  },
  {
    roundNumber: 4,
    theme: 'Ophthalmic drug combinations',
    categories: ['Contains Tobramycin', 'Contains Bacitracin', 'Contains Amoxicillin'],
    items: [
      { name: 'TobraDex', category: 'Contains Tobramycin' },
      { name: 'Tobrex', category: 'Contains Tobramycin' },
      { name: 'Polysporin', category: 'Contains Bacitracin' },
      { name: 'Neosporin', category: 'Contains Bacitracin' },
      { name: 'AK-Poly-Bac', category: 'Contains Bacitracin' },
      { name: 'Augmentin', category: 'Contains Amoxicillin' },
      { name: 'Amoxil', category: 'Contains Amoxicillin' },
    ],
    explanation: 'TobraDex and Tobrex are tobramycin-based ophthalmic preparations. Polysporin, Neosporin, and AK-Poly-Bac all contain Bacitracin combined with Polymyxin B. Knowing these combination products and their components is high-yield for ophthalmic pharmacology on the boards.',
  },
  {
    roundNumber: 5,
    theme: 'Cephalosporin generations',
    categories: ['1st Generation', '3rd Generation', 'Penicillin Class'],
    items: [
      { name: 'Cephalexin', category: '1st Generation' },
      { name: 'Cefazolin', category: '1st Generation' },
      { name: 'Ceftriaxone', category: '3rd Generation' },
      { name: 'Cefixime', category: '3rd Generation' },
      { name: 'Amoxicillin', category: 'Penicillin Class' },
      { name: 'Dicloxacillin', category: 'Penicillin Class' },
      { name: 'Augmentin', category: 'Penicillin Class' },
    ],
    explanation: '1st-generation cephalosporins primarily cover gram-positive organisms; 3rd-generation agents like Ceftriaxone extend to gram-negatives and are the drug of choice for orbital cellulitis and gonococcal conjunctivitis. All penicillins share the beta-lactam ring, conferring cross-sensitivity risk.',
  },
];

// ── Shared Gemini model factory ───────────────────────────────────────────────
function getModel(temperature: number) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  return genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    generationConfig: { temperature, responseMimeType: 'application/json' },
  });
}

// ── Gemini call with exponential backoff on 429 ───────────────────────────────
async function callWithRetry(prompt: string, temperature: number): Promise<string> {
  const model = getModel(temperature);
  const MAX_RETRIES = 3;
  let delay = 2_000;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err: unknown) {
      const isRateLimit =
        err instanceof Error &&
        (err.message.includes('429') || err.message.toLowerCase().includes('quota'));
      if (isRateLimit && attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, delay));
        delay *= 2;
        continue;
      }
      throw err;
    }
  }
  throw new Error('Max retries exceeded');
}

// ── Step 1: Generate 5 distinct themes in one lightweight call ────────────────
async function generateThemes(entropy: number): Promise<string[]> {
  const prompt = `Generate exactly 5 distinct NBEO optometry pharmacology sorting themes for a single game session. They must all be different — no overlap in drug classes or concepts. Cover a mix of: antibiotics, ophthalmic drugs, glaucoma, systemic drugs with ocular side effects, and allergy/inflammation. Each theme must be specific enough to produce clean, non-overlapping drug groupings (e.g. "30S vs 50S ribosomal inhibitors", "prostaglandin analogs vs beta-blockers for glaucoma", "drugs causing pseudotumor cerebri") — NOT vague themes like "antibiotics" or "eye drops". Return ONLY a JSON array of exactly 5 short theme strings, no explanation. Entropy value to ensure uniqueness: ${entropy}`;

  try {
    const text = await callWithRetry(prompt, 0.9);
    const parsed = JSON.parse(text);
    const themes: string[] = Array.isArray(parsed) ? parsed : parsed.themes ?? [];
    if (themes.length === 5) return themes;
  } catch (err) {
    console.error('Theme generation failed, using fallback themes:', err);
  }

  // Fallback themes if the call fails
  return FALLBACK_ROUNDS.map((r) => r.theme);
}

// ── Step 2: Generate one round for an assigned theme ─────────────────────────
async function generateOneRound(
  roundNumber: number,
  entropy: number,
  theme: string,
  otherThemes: string[],
  cardText: string,
): Promise<RoundData> {
  const exclusionNote =
    otherThemes.length > 0
      ? `\nDo NOT use any of these themes (already used in other rounds): ${otherThemes.map((t) => `"${t}"`).join(', ')}.`
      : '';

  const prompt = `You are creating a pharmacology sorting game for optometry students studying for the NBEO exam.
Entropy token: ${entropy}

Your assigned theme for this round is: "${theme}"${exclusionNote}

Here are study cards to draw from:
${cardText}

Create one sorting game round for the assigned theme above.

Rules:
- 2 or 3 categories — whichever produces the cleanest, most distinct groupings for this theme
- Exactly 7 items (drug names or short pharmacology terms — NOT full sentences)
- Each category gets at least 2 items
- Items must unambiguously belong to exactly one category
- Include a 2-3 sentence "explanation" covering: what the correct groupings are, why each drug belongs there (MOA or drug class), and the NBEO boards relevance

Return ONLY valid JSON in this exact shape, no extra text:
{
  "theme": "${theme}",
  "categories": ["Cat A", "Cat B"],
  "items": [
    {"name": "Drug1", "category": "Cat A"},
    {"name": "Drug2", "category": "Cat A"},
    {"name": "Drug3", "category": "Cat A"},
    {"name": "Drug4", "category": "Cat B"},
    {"name": "Drug5", "category": "Cat B"},
    {"name": "Drug6", "category": "Cat B"},
    {"name": "Drug7", "category": "Cat B"}
  ],
  "explanation": "2-3 sentence boards-focused explanation here."
}`;

  try {
    const text = await callWithRetry(prompt, 0.9);
    const parsed = JSON.parse(text);
    const rng = mulberry32(entropy);
    return {
      roundNumber,
      theme: parsed.theme ?? theme,
      categories: parsed.categories,
      items: seededShuffle(parsed.items, rng),
      explanation: parsed.explanation ?? '',
    };
  } catch (err) {
    console.error(`Round ${roundNumber} ("${theme}") failed:`, err);
    return { ...FALLBACK_ROUNDS[roundNumber - 1], roundNumber };
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { date, forceNew, salt } = await req.json();

  // Serve from daily cache (skip on forceNew)
  if (!forceNew && roundCache.has(date)) {
    return NextResponse.json({ rounds: roundCache.get(date) });
  }

  // Rate limit
  if (!consumeToken()) {
    const retryAfter = Math.ceil(REFILL_INTERVAL_MS / 1000);
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    );
  }

  const baseSeed = dateToSeed(date) + (salt ?? 0);

  // Load study cards, pick 40 seeded by baseSeed
  const dataPath = path.join(process.cwd(), 'public', 'rxsordle_data.json');
  const cardsData = JSON.parse(fs.readFileSync(dataPath, 'utf-8')) as {
    cards: { t: string; d: string }[];
  };
  const rng = mulberry32(baseSeed);
  const cardText = seededShuffle(cardsData.cards, rng)
    .slice(0, 40)
    .map((c) => `Q: ${c.t}\nA: ${c.d}`)
    .join('\n\n');

  // Step 1: Get 5 distinct themes in one call
  const themes = await generateThemes(baseSeed);

  // Step 2: Generate all 5 rounds in parallel, each with its assigned theme
  // and the other 4 themes passed as an exclusion list
  const rounds = await Promise.all(
    [1, 2, 3, 4, 5].map((n) =>
      generateOneRound(
        n,
        baseSeed + n * 7919,
        themes[n - 1],
        themes.filter((_, i) => i !== n - 1),
        cardText,
      ),
    ),
  );

  // Cache daily result (skip for forceNew so daily slot stays clean)
  if (!forceNew) {
    roundCache.set(date, rounds);
    // Garbage collection: Reset leaderboard by removing old scores
    // Since this endpoint triggers new daily generation, it's a perfect place to clean up.
    try {
      await supabase
        .from('rxsordle_scores')
        .delete()
        .neq('date', date);
    } catch (err) {
      console.error('Failed to clear old scores:', err);
    }
  }

  return NextResponse.json({ rounds });
}
