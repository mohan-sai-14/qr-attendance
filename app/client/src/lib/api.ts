import { supabase } from './supabase';
import { toast } from 'sonner';

// Types
export type User = {
  id: string;
  email: string;
  username: string;
  role: 'admin' | 'student';
  name?: string;
  profile_pic?: string;
};

export type Session = {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  location?: string;
  status: 'upcoming' | 'active' | 'completed';
  created_by: string;
  created_at: string;
  attendees_count?: number;
  is_attendance_marked?: boolean;
};

export type Attendance = {
  id: string;
  session_id: string;
  user_id: string;
  timestamp: string;
  status: 'present' | 'absent' | 'late';
  session?: Session;
  user?: User;
};

// Error handling helper
const handleError = (error: any, customMessage?: string) => {
  console.error('API Error:', error);
  const message = customMessage || error?.message || 'An unexpected error occurred';
  toast.error(message);
  return { error: message };
};

// ==================
// Session endpoints
// ==================

export const getSessions = async () => {
  try {
    const { data, error } = await supabase
      .from('sessions')
      .select('*, users:created_by(username)')
      .order('start_time', { ascending: false });

    if (error) throw error;
    return { data };
  } catch (error) {
    return handleError(error, 'Failed to fetch sessions');
  }
};

export const getActiveSession = async () => {
  try {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('status', 'active')
      .order('start_time', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 is no rows returned

    return { data };
  } catch (error) {
    // Don't show toast for no active session
    if (error?.code === 'PGRST116') {
      return { data: null };
    }
    return handleError(error, 'Failed to fetch active session');
  }
};

export const getSessionById = async (id: string) => {
  try {
    const { data, error } = await supabase
      .from('sessions')
      .select('*, users:created_by(username)')
      .eq('id', id)
      .single();

    if (error) throw error;
    return { data };
  } catch (error) {
    return handleError(error, 'Failed to fetch session details');
  }
};

export const createSession = async (session: Omit<Session, 'id' | 'created_at' | 'created_by'>) => {
  try {
    const { data, error } = await supabase
      .from('sessions')
      .insert([session])
      .select()
      .single();

    if (error) throw error;
    toast.success('Session created successfully');
    return { data };
  } catch (error) {
    return handleError(error, 'Failed to create session');
  }
};

export const updateSession = async (id: string, session: Partial<Session>) => {
  try {
    const { data, error } = await supabase
      .from('sessions')
      .update(session)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    toast.success('Session updated successfully');
    return { data };
  } catch (error) {
    return handleError(error, 'Failed to update session');
  }
};

export const deleteSession = async (id: string) => {
  try {
    const { error } = await supabase
      .from('sessions')
      .delete()
      .eq('id', id);

    if (error) throw error;
    toast.success('Session deleted successfully');
    return { success: true };
  } catch (error) {
    return handleError(error, 'Failed to delete session');
  }
};

// ==================
// Attendance endpoints
// ==================

export const getAttendance = async (sessionId: string) => {
  try {
    const { data, error } = await supabase
      .from('attendance')
      .select('*, users:user_id(username, name, email, profile_pic)')
      .eq('session_id', sessionId);

    if (error) throw error;
    return { data };
  } catch (error) {
    return handleError(error, 'Failed to fetch attendance records');
  }
};

export const getUserAttendance = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('attendance')
      .select('*, sessions:session_id(*)')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false });

    if (error) throw error;
    return { data };
  } catch (error) {
    return handleError(error, 'Failed to fetch your attendance records');
  }
};

export const markAttendance = async (attendance: Omit<Attendance, 'id'>) => {
  try {
    // Check if attendance already exists for this user and session
    const { data: existingAttendance, error: checkError } = await supabase
      .from('attendance')
      .select('*')
      .eq('session_id', attendance.session_id)
      .eq('user_id', attendance.user_id)
      .maybeSingle();
    
    if (checkError) throw checkError;
    
    // If attendance already exists, update it instead of creating a new record
    if (existingAttendance) {
      const { data, error } = await supabase
        .from('attendance')
        .update({ 
          status: attendance.status,
          timestamp: attendance.timestamp 
        })
        .eq('id', existingAttendance.id)
        .select()
        .single();
      
      if (error) throw error;
      return { data, message: 'Attendance updated successfully' };
    } else {
      // Otherwise create a new attendance record
      const { data, error } = await supabase
        .from('attendance')
        .insert([attendance])
        .select()
        .single();
      
      if (error) throw error;
      return { data, message: 'Attendance recorded successfully' };
    }
  } catch (error) {
    return handleError(error, 'Failed to record attendance');
  }
};

export const scanQRCode = async (sessionId: string, userId: string) => {
  try {
    if (!sessionId || !userId) {
      throw new Error('Session ID and User ID are required');
    }
    
    // First, check if the session exists and is active
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle();
    
    if (sessionError) throw sessionError;
    
    if (!session) {
      throw new Error('Session not found');
    }
    
    if (session.status !== 'active') {
      throw new Error('This session is not active. Attendance can only be marked for active sessions.');
    }
    
    // Mark the attendance
    const attendanceData = {
      session_id: sessionId,
      user_id: userId,
      timestamp: new Date().toISOString(),
      status: 'present' as const
    };
    
    const result = await markAttendance(attendanceData);
    
    return result;
  } catch (error) {
    return handleError(error, 'Failed to process QR code');
  }
};

// ==================
// User endpoints
// ==================

export const getUsers = async () => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('username');

    if (error) throw error;
    return { data };
  } catch (error) {
    return handleError(error, 'Failed to fetch users');
  }
};

export const getUserById = async (id: string) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return { data };
  } catch (error) {
    return handleError(error, 'Failed to fetch user details');
  }
};

export const updateUserProfile = async (id: string, profile: Partial<User>) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .update(profile)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    toast.success('Profile updated successfully');
    return { data };
  } catch (error) {
    return handleError(error, 'Failed to update profile');
  }
};

// Determine the correct API base URL based on environment
export const API_BASE_URL = import.meta.env.PROD 
  ? '/api' // In production, use relative path which will be handled by Vercel
  : 'http://localhost:3001/api'; // In development, use localhost

export async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      credentials: 'include',
      headers: {
        ...options.headers,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorJson.error || errorText;
      } catch {
        errorMessage = errorText || `${response.status}: ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    }
    return response.text();
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}

// Auth endpoints
export const login = async (credentials: { userId: string; password: string }) => {
  return fetchWithAuth('/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
};

export const logout = async () => {
  return fetchWithAuth('/logout', {
    method: 'POST',
  });
};

export const getCurrentUser = async () => {
  return fetchWithAuth('/me');
};

export const getAllSessions = async () => {
  return fetchWithAuth('/sessions');
};

export const createSession = async (sessionData: any) => {
  return fetchWithAuth('/sessions', {
    method: 'POST',
    body: JSON.stringify(sessionData),
  });
};

// Attendance endpoints
export const getUserAttendance = async () => {
  return fetchWithAuth('/attendance/me');
};

export const recordAttendance = async (sessionId: string) => {
  return fetchWithAuth('/attendance', {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  });
}; 