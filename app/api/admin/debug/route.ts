import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  const pw = req.headers.get('x-admin-password');
  if (pw !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const log: string[] = [];

  // 1. Env check
  log.push(`NEXT_PUBLIC_SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? '✓ set' : '✗ MISSING'}`);
  log.push(`SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓ set' : '✗ MISSING'}`);
  log.push(`GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? '✓ set' : '✗ MISSING'}`);
  log.push(`ADMIN_PASSWORD: ${process.env.ADMIN_PASSWORD ? '✓ set' : '✗ MISSING'}`);

  const db = getSupabaseServer();

  // 2. Test write to rxsordle_rounds
  const testDate = '__debug_test__';
  const { error: writeError } = await db
    .from('rxsordle_rounds')
    .upsert({ date: testDate, rounds: [] }, { onConflict: 'date' });

  if (writeError) {
    log.push(`rxsordle_rounds WRITE: ✗ ${writeError.message} (code: ${writeError.code})`);
  } else {
    log.push('rxsordle_rounds WRITE: ✓ success');

    // 3. Test read back
    const { data, error: readError } = await db
      .from('rxsordle_rounds')
      .select('date')
      .eq('date', testDate)
      .single();
    log.push(readError
      ? `rxsordle_rounds READ: ✗ ${readError.message}`
      : `rxsordle_rounds READ: ✓ found row date=${data?.date}`);

    // 4. Clean up test row
    await db.from('rxsordle_rounds').delete().eq('date', testDate);
    log.push('rxsordle_rounds CLEANUP: ✓ test row deleted');
  }

  // 5. Check today's cached rounds
  const todayET = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
    .toISOString().split('T')[0];

  const { data: todayData, error: todayError } = await db
    .from('rxsordle_rounds')
    .select('date, created_at')
    .eq('date', todayET)
    .single();

  if (todayError) {
    log.push(`Today's cache (${todayET}): ✗ ${todayError.message}`);
  } else {
    log.push(`Today's cache (${todayET}): ✓ exists, created_at=${todayData?.created_at}`);
  }

  // 6. Check rxsordle_scores connectivity
  const { count, error: scoresError } = await db
    .from('rxsordle_scores')
    .select('*', { count: 'exact', head: true })
    .eq('date', todayET);

  log.push(scoresError
    ? `rxsordle_scores READ: ✗ ${scoresError.message}`
    : `rxsordle_scores READ: ✓ ${count} score(s) today`);

  return NextResponse.json({ ok: true, diagnostics: log });
}
