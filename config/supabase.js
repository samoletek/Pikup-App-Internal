import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { appConfig } from './appConfig';
import { logger } from '../services/logger';

const supabaseUrl = appConfig.supabase.url;
const supabaseAnonKey = appConfig.supabase.anonKey;

const fallbackSupabaseUrl = 'https://invalid.supabase.local';
const fallbackSupabaseAnonKey = 'invalid-anon-key';

if (!supabaseUrl || !supabaseAnonKey) {
  logger.error('SupabaseConfig', 'Missing Supabase URL or anon key. Check your .env configuration.');
}

export const supabase = createClient(supabaseUrl || fallbackSupabaseUrl, supabaseAnonKey || fallbackSupabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
