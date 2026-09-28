import '../config/env.js';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://vjjmbvhfgxctunxuwsew.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder_service_role_key';

const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;
