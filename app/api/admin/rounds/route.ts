import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  const pw = req.headers.get('x-admin-password');
  if (pw !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const todayET = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
    .toISOString().split('T')[0];

  const { data, error } = await supabaseServer
    .from('rxsordle_rounds')
    .select('rounds, created_at')
    .eq('date', todayET)
    .single();

  if (error || !data) {
    return NextResponse.json({ rounds: null, date: todayET });
  }
  return NextResponse.json({ rounds: data.rounds, date: todayET, createdAt: data.created_at });
}
