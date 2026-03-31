import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function reset() {
  console.log('Resetting rxsordle_scores...');
  const { data, error } = await supabase
    .from('rxsordle_scores')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // match all rows essentially
  
  if (error) {
    console.error('Error resetting scores:', error);
  } else {
    console.log('Scores reset successfully', data);
  }
}

reset();
