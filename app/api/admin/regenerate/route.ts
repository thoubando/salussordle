import { NextRequest, NextResponse } from 'next/server';
import { generateRoundsForDate, setCachedRounds } from '@/lib/generation';

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const todayET = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
    .toISOString().split('T')[0];

  // Random salt so Gemini sees a genuinely different prompt each time
  const salt = (Math.random() * 100000) | 0;

  try {
    const rounds = await generateRoundsForDate(todayET, salt);
    // Overwrite today's Supabase cache so all users immediately get the new questions
    await setCachedRounds(todayET, rounds);
    return NextResponse.json({ rounds, date: todayET });
  } catch (err) {
    console.error('Regenerate failed:', err);
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 });
  }
}
