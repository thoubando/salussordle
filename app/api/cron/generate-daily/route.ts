import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get today's date in ET
  const todayET = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
    .toISOString().split('T')[0];

  // Check if already generated
  const { data: existing } = await supabaseServer
    .from('rxsordle_rounds')
    .select('date')
    .eq('date', todayET)
    .single();

  if (existing) {
    return NextResponse.json({ ok: true, message: 'Already generated', date: todayET });
  }

  // Trigger generation by calling /api/generate internally
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

  const res = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date: todayET }),
  });

  if (!res.ok) {
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, date: todayET });
}
