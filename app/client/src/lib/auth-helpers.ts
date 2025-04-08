import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabase as supabaseClient } from './supabase';

// Create a server-side supabase client using cookies
export function createServerSupabaseClient() {
  const cookieStore = cookies();
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value;
        },
        set(name, value, options) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name, options) {
          cookieStore.delete({ name, ...options });
        },
      },
    }
  );
  
  return supabase;
}

// Get current user from server-side request
export async function getUser() {
  try {
    // Try to use the server-side client if in a server component
    let supabase;
    try {
      supabase = createServerSupabaseClient();
    } catch (error) {
      // Fall back to client-side supabase if not in a server component
      supabase = supabaseClient;
    }
    
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return null;
    }
    
    // Get user profile from the database
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      return null;
    }
    
    return profile;
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
} 