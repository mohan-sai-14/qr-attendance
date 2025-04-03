import { createClient } from '@supabase/supabase-js';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { serialize, parse } from 'cookie';

// Supabase client initialization
const supabaseUrl = 'https://qwavakkbfpdgkvtctogx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3YXZha2tiZnBkZ2t2dGN0b2d4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI3MTE4MjYsImV4cCI6MjA1ODI4NzgyNn0.Kdwo9ICmcsHPhK_On6G73ccSPkcEqzAg2BtvblhD8co';
const supabase = createClient(supabaseUrl, supabaseKey);

// Session duration in milliseconds (30 minutes)
const SESSION_DURATION = 30 * 60 * 1000;

// Save session to Supabase
async function createSessionInDb(userId: string, userData: any, sessionId: string) {
  try {
    const { error } = await supabase
      .from('app_sessions')
      .insert({
        id: sessionId,
        user_id: userId,
        user_data: userData,
        expires_at: new Date(Date.now() + SESSION_DURATION).toISOString()
      });
    
    if (error) {
      console.error('Error saving session:', error);
    }
  } catch (error) {
    console.error('Error creating session in DB:', error);
  }
}

// Helper function to generate a session
async function generateSession(userId: string, userData: any) {
  const sessionId = Math.random().toString(36).substring(2, 15);
  const expiresAt = Date.now() + SESSION_DURATION;
  
  // Store in Supabase - fire and forget, don't wait
  createSessionInDb(userId, userData, sessionId);
  
  return { sessionId, expiresAt };
}

// Helper to get a valid session from Supabase
async function getSession(sessionId: string) {
  try {
    const { data, error } = await supabase
      .from('app_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    // Check if session has expired
    if (new Date(data.expires_at) < new Date()) {
      // Session expired, delete it
      await supabase
        .from('app_sessions')
        .delete()
        .eq('id', sessionId);
      return null;
    }
    
    // Update the expiration time to extend the session
    await supabase
      .from('app_sessions')
      .update({ 
        expires_at: new Date(Date.now() + SESSION_DURATION).toISOString() 
      })
      .eq('id', sessionId);
    
    return {
      userId: data.user_id,
      userData: data.user_data,
      expiresAt: new Date(data.expires_at).getTime(),
    };
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
}

// Route handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('API Request:', req.url, req.method);
  
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Get the path from the URL
  const path = req.url?.split('/api')[1] || '/';
  console.log('Extracted path:', path);

  // Handle routes
  try {
    // Status endpoint for checking API connectivity
    if (path === '/status' || path === '/api/status') {
      console.log('Status check requested');
      return res.status(200).json({ 
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
      });
    }
    
    // Login endpoint
    if (path.startsWith('/login') && req.method === 'POST') {
      const { username, password } = req.body || {};
      console.log('Login attempt:', username);
      
      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
      }
      
      try {
        // Fallback for demo login first for fast response
        if ((username === 'admin' && password === 'admin123') || 
            (username === 'S1001' && password === 'student123')) {
          
          const role = username === 'admin' ? 'admin' : 'student';
          const name = username === 'admin' ? 'Admin User' : 'John Smith';
          const id = username === 'admin' ? 2 : 1;
          
          const userData = {
            id,
            username,
            name, 
            role
          };
          
          // Create session
          const { sessionId, expiresAt } = await generateSession(id.toString(), userData);
          
          // Set session cookie
          res.setHeader('Set-Cookie', 
            serialize('sessionId', sessionId, {
              path: '/',
              httpOnly: true,
              sameSite: 'none',
              secure: true,
              expires: new Date(expiresAt)
            })
          );
          
          console.log('Login successful for demo user:', username);
          return res.status(200).json(userData);
        }
        
        // If not demo login, try Supabase auth
        // First, find the user in Supabase
        console.log('Checking user in Supabase');
        const { data: userProfiles, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('username', username)
          .single();
        
        if (userError || !userProfiles) {
          console.log('User not found or error:', userError);
          return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Validate password with Supabase Auth
        console.log('Validating with Supabase Auth');
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: userProfiles.email || `${username}@example.com`,
          password,
        });
        
        if (authError || !authData.user) {
          console.log('Auth failed:', authError);
          return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Create user data object
        const userData = {
          id: userProfiles.id,
          username: userProfiles.username,
          name: userProfiles.name || userProfiles.username,
          role: userProfiles.role || 'student',
          email: userProfiles.email,
        };
        
        // Create session
        const { sessionId, expiresAt } = await generateSession(userProfiles.id.toString(), userData);
        
        // Set session cookie
        res.setHeader('Set-Cookie', 
          serialize('sessionId', sessionId, {
            path: '/',
            httpOnly: true,
            sameSite: 'none',
            secure: true,
            expires: new Date(expiresAt)
          })
        );
        
        console.log('Login successful for Supabase user:', username);
        return res.status(200).json(userData);
        
      } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ error: 'Authentication failed' });
      }
    }
    
    // Logout endpoint
    else if (path.startsWith('/logout') && req.method === 'POST') {
      console.log('Logout request');
      const cookies = parse(req.headers.cookie || '');
      const sessionId = cookies.sessionId;
      
      // Clear the session
      if (sessionId) {
        try {
          await supabase
            .from('app_sessions')
            .delete()
            .eq('id', sessionId);
        } catch (error) {
          console.error('Error deleting session:', error);
        }
      }
      
      // Clear the cookie
      res.setHeader('Set-Cookie', 
        serialize('sessionId', '', {
          path: '/',
          httpOnly: true,
          sameSite: 'none',
          secure: true,
          maxAge: 0
        })
      );
      
      console.log('Logout successful');
      return res.status(200).json({ success: true });
    }
    
    // Session verification endpoint
    else if (path.startsWith('/me') && req.method === 'GET') {
      console.log('Session verification request');
      const cookies = parse(req.headers.cookie || '');
      const sessionId = cookies.sessionId;
      
      if (!sessionId) {
        console.log('No session ID found');
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      const session = await getSession(sessionId);
      
      if (!session) {
        console.log('Invalid or expired session');
        // Clear invalid session cookie
        res.setHeader('Set-Cookie', 
          serialize('sessionId', '', {
            path: '/',
            httpOnly: true,
            sameSite: 'none',
            secure: true,
            maxAge: 0
          })
        );
        return res.status(401).json({ error: 'Session expired' });
      }
      
      console.log('Valid session found for user:', session.userData.username);
      // Return the user data
      return res.status(200).json(session.userData);
    }
    
    // Sessions endpoint
    else if (path.startsWith('/sessions') && req.method === 'GET') {
      console.log('Sessions list request');
      const cookies = parse(req.headers.cookie || '');
      const sessionId = cookies.sessionId;
      
      if (!sessionId) {
        console.log('No session ID found');
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      const session = await getSession(sessionId);
      
      if (!session || session.userData.role !== 'admin') {
        console.log('Not authorized - requires admin role');
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      // Get sessions from Supabase
      const { data: sessions, error } = await supabase
        .from('sessions')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching sessions:', error);
        return res.status(500).json({ error: 'Failed to fetch sessions' });
      }
      
      console.log('Returning sessions list');
      return res.status(200).json(sessions || []);
    }
    
    // Attendance endpoint
    else if (path.startsWith('/attendance') && req.method === 'GET') {
      console.log('Attendance data request');
      const cookies = parse(req.headers.cookie || '');
      const sessionId = cookies.sessionId;
      
      if (!sessionId) {
        console.log('No session ID found');
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      const session = await getSession(sessionId);
      
      if (!session) {
        console.log('Invalid or expired session');
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      // Get attendance based on role
      if (session.userData.role === 'admin') {
        console.log('Fetching all attendance records for admin');
        // Admin sees all attendance
        const { data: attendance, error } = await supabase
          .from('attendance')
          .select('*, sessions(*), users(*)')
          .order('created_at', { ascending: false });
        
        if (error) {
          console.error('Error fetching attendance:', error);
          return res.status(500).json({ error: 'Failed to fetch attendance' });
        }
        
        return res.status(200).json(attendance || []);
      } else {
        console.log('Fetching user-specific attendance records');
        // Students see only their attendance
        const { data: attendance, error } = await supabase
          .from('attendance')
          .select('*, sessions(*)')
          .eq('user_id', session.userData.id)
          .order('created_at', { ascending: false });
        
        if (error) {
          console.error('Error fetching attendance:', error);
          return res.status(500).json({ error: 'Failed to fetch attendance' });
        }
        
        return res.status(200).json(attendance || []);
      }
    }
    
    // Default response for unhandled routes
    else {
      console.log('Route not found:', path);
      res.status(404).json({ error: 'Not found' });
    }
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
} 