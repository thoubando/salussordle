import { NextRequest, NextResponse } from 'next/server';
import { getCachedRounds, generateRoundsForDate, setCachedRounds } from '@/lib/generation';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const todayET = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
    .toISOString().split('T')[0];

  // Skip if already cached
  const existing = await getCachedRounds(todayET);
  if (existing) {
    return NextResponse.json({ ok: true, message: 'Already generated', date: todayET });
  }

  try {
    const rounds = await generateRoundsForDate(todayET);
    await setCachedRounds(todayET, rounds);
    return NextResponse.json({ ok: true, date: todayET, count: rounds.length });
  } catch (err) {
    console.error('Daily generation cron failed:', err);
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 });
  }
}
