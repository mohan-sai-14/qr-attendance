import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = 'https://qwavakkbfpdgkvtctogx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3YXZha2tiZnBkZ2t2dGN0b2d4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI3MTE4MjYsImV4cCI6MjA1ODI4NzgyNn0.Kdwo9ICmcsHPhK_On6G7';
const supabase = createClient(supabaseUrl, supabaseKey);

// Define session interface
export interface Session {
  id: number;
  name: string;
  created_by: string;
  created_at: string;
  expires_at: string;
  is_active: boolean;
  [key: string]: any; // Allow for additional properties
}

export class Storage {
  async getActiveSession(): Promise<Session | undefined> {
    try {
      console.log("Getting active session from database");
      
      const { data: session, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error("Error in getActiveSession:", error);
        throw error;
      }

      if (!session) {
        console.log("No active session found");
        return undefined;
      }

      // Check if session has expired
      const expiryTime = new Date(session.expires_at).getTime();
      const currentTime = Date.now();
      
      if (currentTime > expiryTime) {
        console.log("Active session found but expired, deactivating:", session.id);
        // Automatically deactivate expired sessions
        await this.expireSession(session.id);
        return undefined;
      }
      
      console.log("Active session found:", session.id);
      return session;
    } catch (error) {
      console.error("Error in getActiveSession:", error);
      throw error;
    }
  }

  async getAllSessions(): Promise<Session[]> {
    try {
      console.log("Getting all sessions from database");
      
      const { data: sessions, error } = await supabase
        .from('sessions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Error in getAllSessions:", error);
        throw error;
      }

      console.log(`Retrieved ${sessions?.length || 0} sessions`);
      return sessions || [];
    } catch (error) {
      console.error("Error in getAllSessions:", error);
      throw error;
    }
  }

  async createSession(sessionData: Partial<Session>): Promise<Session> {
    try {
      console.log("Creating new session in database", sessionData);

      // First deactivate all existing active sessions
      const { error: deactivateError } = await supabase
        .from('sessions')
        .update({ is_active: false })
        .eq('is_active', true);

      if (deactivateError) {
        console.error("Error deactivating existing sessions:", deactivateError);
        throw deactivateError;
      }

      // Insert new session
      const { data, error } = await supabase
        .from('sessions')
        .insert([sessionData])
        .select()
        .single();

      if (error) {
        console.error("Error creating session:", error);
        throw error;
      }

      console.log("Session created successfully:", data.id);
      return data as Session;
    } catch (error) {
      console.error("Error in createSession:", error);
      throw error;
    }
  }

  async expireSession(sessionId: number): Promise<void> {
    try {
      console.log("Deactivating session:", sessionId);

      const { error } = await supabase
        .from('sessions')
        .update({ is_active: false })
        .eq('id', sessionId);

      if (error) {
        console.error("Error deactivating session:", error);
        throw error;
      }

      console.log("Session deactivated successfully:", sessionId);
    } catch (error) {
      console.error("Error in expireSession:", error);
      throw error;
    }
  }
} 