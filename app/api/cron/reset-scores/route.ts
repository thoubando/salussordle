import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Vercel Cron calls this route with the CRON_SECRET in the Authorization header.
// Schedule: 04:01 UTC = 12:01 AM EDT (UTC-4 in summer)
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  // Today's date in ET — keep today's scores, delete everything older
  const todayET = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }),
  )
    .toISOString()
    .split('T')[0];

  const { error, count } = await supabase
    .from('rxsordle_scores')
    .delete({ count: 'exact' })
    .neq('date', todayET);

  if (error) {
    console.error('Cron reset-scores failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log(`Cron reset-scores: deleted ${count} old score(s) at ${new Date().toISOString()}`);
  return NextResponse.json({ ok: true, deleted: count, keptDate: todayET });
}
