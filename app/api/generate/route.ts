import { NextRequest, NextResponse } from 'next/server';
import { getCachedRounds, setCachedRounds, generateRoundsForDate } from '@/lib/generation';

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

export async function POST(req: NextRequest) {
  const { date, forceNew, salt, replaceCache } = await req.json();

  // Serve from Supabase cache unless forceNew or replaceCache is requested
  if (!forceNew) {
    const cached = await getCachedRounds(date);
    if (cached) return NextResponse.json({ rounds: cached });
  }

  // Rate limit
  if (!consumeToken()) {
    const retryAfter = Math.ceil(REFILL_INTERVAL_MS / 1000);
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    );
  }

  const rounds = await generateRoundsForDate(date, salt ?? 0);

  // Write to Supabase: normal loads + admin replaceCache
  if (!forceNew || replaceCache) {
    await setCachedRounds(date, rounds);
  }

  return NextResponse.json({ rounds });
}
