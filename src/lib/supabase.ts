import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://hpcgukplcjhlkcbccfji.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_iCu4rP5EV1KOC35tuv3CuQ_8trNjHQ-';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

