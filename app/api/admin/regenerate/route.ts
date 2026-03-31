import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const todayET = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
    .toISOString().split('T')[0];

  // Use a random salt so Gemini gets a genuinely different prompt
  const salt = (Math.random() * 100000) | 0;

  // Call /api/generate with forceNew=true and replaceCache=true so the new
  // rounds are written back to Supabase as today's global cache
  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

  const res = await fetch(`${base}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date: todayET, forceNew: true, salt, replaceCache: true }),
  });

  if (!res.ok) {
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 });
  }

  const data = await res.json();
  return NextResponse.json({ rounds: data.rounds, date: todayET });
}
