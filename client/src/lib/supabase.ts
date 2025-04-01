import { createClient } from '@supabase/supabase-js';
import { QueryClient } from '@tanstack/react-query';

const supabaseUrl = 'https://qwavakkbfpdgkvtctogx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3YXZha2tiZnBkZ2t2dGN0b2d4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI3MTE4MjYsImV4cCI6MjA1ODI4NzgyNn0.Kdwo9ICmcsHPhK_On6G7';

// Create a global QueryClient that can be accessed via supabase
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      staleTime: 0 // Always consider data stale
    }
  }
});

// Extend the supabase client with the QueryClient and force online mode
export const supabase = Object.assign(
  createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true
    },
    realtime: {
      params: {
        eventsPerSecond: 10
      }
    },
    global: {
      // Force online-only mode
      fetch: (...args) => {
        console.log("Supabase fetch call:", args[0]);
        return fetch(...args);
      }
    }
  }),
  { queryClient }
);
