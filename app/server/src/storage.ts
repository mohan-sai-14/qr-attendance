import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { User, Session, Attendance } from './types';
import fetch from 'node-fetch';

// Fix for fetch not being available in some Node environments
// @ts-ignore
if (!globalThis.fetch) {
  // @ts-ignore
  globalThis.fetch = fetch;
}

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export class SupabaseStorage {
  private supabase: SupabaseClient | null;
  private useSupabase: boolean;

  constructor() {
    this.useSupabase = !!(supabaseUrl && supabaseKey);
    
    console.log('Initializing Supabase storage:');
    console.log('- URL available:', !!supabaseUrl);
    console.log('- API key available:', !!supabaseKey);
    console.log('- URL:', supabaseUrl);
    // Only log the first few characters of the key for security
    console.log('- Key begins with:', supabaseKey?.substring(0, 10) + '...');
    
    if (this.useSupabase) {
      try {
        this.supabase = createClient(supabaseUrl!, supabaseKey!, {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        });
        console.log('Supabase client initialized successfully');
      } catch (error) {
        console.error('Error initializing Supabase client:', error);
        this.supabase = null;
        this.useSupabase = false;
      }
    } else {
      this.supabase = null;
      console.log('Using mock storage - Supabase credentials not found');
    }
  }

  async getUser(userId: string): Promise<User | null> {
    try {
      if (!this.useSupabase || !this.supabase) {
        // Mock user for development
        if (userId === 'S1001') {
          return {
            id: 1,
            username: 'S1001',
            password: 'student123',
            name: 'Student One',
            email: 'mohansaireddy54@gmail.com',
            role: 'student',
            status: 'active'
          };
        } else if (userId === 'admin') {
          return {
            id: 2,
            username: 'admin',
            password: 'admin123',
            name: 'mohan',
            email: 'mohansaireddy22@gmail.com',
            role: 'admin',
            status: 'active'
          };
        }
        return null;
      }

      const supabase = this.supabase;
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', userId)
        .single();

      if (error) {
        console.error('Error getting user:', error);
        return null;
      }

      return data as User;
    } catch (error) {
      console.error('Error in getUser:', error);
      return null;
    }
  }

  async validateUser(userId: string, password: string): Promise<boolean> {
    try {
      console.log('Validating user:', userId);
      
      if (!this.useSupabase || !this.supabase) {
        console.log('Using mock validation for user:', userId);
        const mockValid = (userId === 'S1001' && password === 'student123') || 
                         (userId === 'admin' && password === 'admin123');
        console.log('Mock validation result:', mockValid);
        return mockValid;
      }

      console.log('Querying Supabase for user:', userId);
      console.log('Query details:');
      console.log('- Table: users');
      console.log('- Condition: username =', userId);
      
      const supabase = this.supabase;
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', userId)
        .single();

      if (error) {
        console.error('Supabase error validating user:', error);
        console.log('Error details:', JSON.stringify(error));
        return false;
      }

      if (!data) {
        console.log('No user found with username:', userId);
        return false;
      }

      // For debugging
      console.log('Found user in database:', {
        username: data.username,
        hasPassword: !!data.password,
        passwordLength: data.password ? data.password.length : 0,
        providedPassword: password,
        providedPasswordLength: password.length,
        passwordsMatch: data.password === password
      });

      return data.password === password;
    } catch (error) {
      console.error('Error in validateUser:', error);
      return false;
    }
  }

  async getActiveSession(userId?: string): Promise<Session | null> {
    try {
      if (!this.useSupabase || !this.supabase) {
        return null;
      }

      const supabase = this.supabase;
      let query = supabase
        .from('sessions')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (userId) {
        query = query.eq('created_by', userId);
      }

      // Use .maybeSingle() instead of .single() to prevent errors when multiple rows exist
      const { data, error } = await query.maybeSingle();

      if (error) {
        console.error('Error getting active session:', error);
        return null;
      }

      return data as Session;
    } catch (error) {
      console.error('Error in getActiveSession:', error);
      return null;
    }
  }

  async getAllSessions(): Promise<Session[]> {
    try {
      if (!this.useSupabase || !this.supabase) {
        return [];
      }

      const supabase = this.supabase;
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error getting all sessions:', error);
        return [];
      }

      return data as Session[];
    } catch (error) {
      console.error('Error in getAllSessions:', error);
      return [];
    }
  }

  async createSession(sessionData: Partial<Session>): Promise<Session | null> {
    try {
      if (!this.useSupabase || !this.supabase) {
        return null;
      }

      const supabase = this.supabase;
      // First, deactivate any existing active sessions for this user
      if (sessionData.created_by) {
        await supabase
          .from('sessions')
          .update({ is_active: false })
          .eq('created_by', sessionData.created_by)
          .eq('is_active', true);
      }

      // Create new session
      const { data, error } = await supabase
        .from('sessions')
        .insert([{
          ...sessionData,
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          is_active: true
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creating session:', error);
        return null;
      }

      console.log('Session created successfully:', data);
      return data as Session;
    } catch (error) {
      console.error('Error in createSession:', error);
      return null;
    }
  }

  async expireSession(sessionId: string): Promise<boolean> {
    try {
      if (!this.useSupabase || !this.supabase) {
        return true;
      }

      const supabase = this.supabase;
      const { error } = await supabase
        .from('sessions')
        .update({ is_active: false })
        .eq('id', sessionId);

      if (error) {
        console.error('Error expiring session:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in expireSession:', error);
      return false;
    }
  }

  async getAllAttendance(): Promise<Attendance[]> {
    try {
      if (!this.useSupabase || !this.supabase) {
        return [];
      }

      const supabase = this.supabase;
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .order('check_in_time', { ascending: false });

      if (error) {
        console.error('Error getting all attendance:', error);
        return [];
      }

      return data as Attendance[];
    } catch (error) {
      console.error('Error in getAllAttendance:', error);
      return [];
    }
  }

  async getUserAttendance(username: string): Promise<Attendance[]> {
    try {
      if (!this.useSupabase || !this.supabase) {
        return [];
      }

      const supabase = this.supabase;
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', username)
        .order('check_in_time', { ascending: false });

      if (error) {
        console.error('Error getting user attendance:', error);
        return [];
      }

      return data as Attendance[];
    } catch (error) {
      console.error('Error in getUserAttendance:', error);
      return [];
    }
  }

  async recordAttendance(username: string, session_id: string): Promise<Attendance | null> {
    try {
      if (!this.useSupabase || !this.supabase) {
        return null;
      }

      const supabase = this.supabase;
      // Check if attendance already exists
      const { data: existing } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', username)
        .eq('session_id', session_id)
        .single();

      if (existing) {
        console.log('Attendance already recorded');
        return existing as Attendance;
      }

      // Record new attendance
      const { data, error } = await supabase
        .from('attendance')
        .insert([{
          user_id: username,
          session_id,
          check_in_time: new Date().toISOString(),
          status: 'present'
        }])
        .select()
        .single();

      if (error) {
        console.error('Error recording attendance:', error);
        return null;
      }

      return data as Attendance;
    } catch (error) {
      console.error('Error in recordAttendance:', error);
      return null;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.useSupabase || !this.supabase) {
        console.log('Cannot test connection - Supabase not initialized');
        return false;
      }
      
      console.log('Testing Supabase connection...');
      const supabase = this.supabase;
      
      // Try to query the users table
      const { data, error } = await supabase
        .from('users')
        .select('count(*)')
        .limit(1);
        
      if (error) {
        console.error('Connection test failed:', error);
        return false;
      }
      
      console.log('Connection test successful. Data:', data);
      return true;
    } catch (error) {
      console.error('Error testing connection:', error);
      return false;
    }
  }

  async getTableInfo(tableName: string): Promise<any> {
    try {
      if (!this.useSupabase || !this.supabase) {
        console.log(`Cannot get table info for ${tableName} - Supabase not initialized`);
        return null;
      }
      
      console.log(`Getting table info for ${tableName}...`);
      const supabase = this.supabase;
      
      // Try to get a single row to inspect columns
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);
        
      if (error) {
        console.error(`Error getting ${tableName} info:`, error);
        return null;
      }
      
      if (!data || data.length === 0) {
        console.log(`No data found in ${tableName}`);
        return { columns: [] };
      }
      
      // Extract column names from the first row
      const columns = Object.keys(data[0]).map(column => ({
        name: column,
        type: typeof data[0][column]
      }));
      
      console.log(`Table ${tableName} columns:`, columns);
      return { columns };
    } catch (error) {
      console.error(`Error getting ${tableName} info:`, error);
      return null;
    }
  }
}

export const storage = new SupabaseStorage(); 