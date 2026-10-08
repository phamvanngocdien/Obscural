import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://vjjmbvhfgxctunxuwsew.supabase.co';

const supabaseKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqam1idmhmZ3hjdHVueHV3c2V3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTYzMjYyMCwiZXhwIjoyMTAxMjA4NjIwfQ.89lqX0SgovFzO4fAGT4yzeKzygJXrb4xaP0RCn9nagE';

export const supabase = createClient(supabaseUrl, supabaseKey);
export default supabase;
