import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = 'https://qwavakkbfpdgkvtctogx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3YXZha2tiZnBkZ2t2dGN0b2d4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI3MTE4MjYsImV4cCI6MjA1ODI4NzgyNn0.Kdwo9ICmcsHPhK_On6G73ccSPkcEqzAg2BtvblhD8co';
const supabase = createClient(supabaseUrl, supabaseKey);

// Simple in-memory storage (will be reset on function restart)
const sessions: Record<string, { user: any, expiresAt: number }> = {};

// Fake data storage for demo
const activeClassSessions: any[] = [];
const attendanceRecords: any[] = [];

// Helper function to get user from session
const getUserFromSession = (req: VercelRequest) => {
  const cookieHeader = req.headers.cookie || '';
  const sessionId = cookieHeader.split(';')
    .map(cookie => cookie.trim())
    .find(cookie => cookie.startsWith('sessionId='))
    ?.split('=')[1];
  
  if (!sessionId || !sessions[sessionId]) {
    return null;
  }
  
  const session = sessions[sessionId];
  
  // Check if session is expired
  if (session.expiresAt < Date.now()) {
    delete sessions[sessionId];
    return null;
  }
  
  return session.user;
};

// Serverless function handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
  
  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  console.log(`API request: ${req.method} ${req.url}`);
  
  try {
    // Get path from URL
    const path = req.url?.split('/api')[1] || '/';
    
    // Status endpoint for checking API health
    if (path === '/status') {
      return res.status(200).json({ 
        status: 'ok', 
        timestamp: new Date().toISOString()
      });
    }
    
    // Handle login endpoint
    if (path === '/login' && req.method === 'POST') {
      const { username, password } = req.body || {};
      console.log('Login request for:', username);
      
      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
      }
      
      // Hard-coded credentials for demo
      if ((username === 'admin' && password === 'admin123') || 
          (username === 'S1001' && password === 'student123')) {
        
        const userData = {
          id: username === 'admin' ? 1 : 2,
          username,
          name: username === 'admin' ? 'Admin User' : 'Student User',
          role: username === 'admin' ? 'admin' : 'student'
        };
        
        // Generate session ID
        const sessionId = Math.random().toString(36).substring(2);
        const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
        
        // Store session
        sessions[sessionId] = {
          user: userData,
          expiresAt
        };
        
        // Set cookie
        res.setHeader('Set-Cookie', `sessionId=${sessionId}; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=86400`);
        
        return res.status(200).json(userData);
      }
      
      // If credentials don't match hard-coded values, check Supabase
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('username', username)
          .single();
          
        if (error || !data) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Generate session ID
        const sessionId = Math.random().toString(36).substring(2);
        const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
        
        // Store session
        sessions[sessionId] = {
          user: data,
          expiresAt
        };
        
        // Set cookie
        res.setHeader('Set-Cookie', `sessionId=${sessionId}; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=86400`);
        
        return res.status(200).json(data);
      } catch (error) {
        console.error('Database error:', error);
        return res.status(500).json({ error: 'Internal server error' });
      }
    }
    
    // Handle /me endpoint to check current user
    if (path === '/me' && req.method === 'GET') {
      // Get session ID from cookie
      const cookieHeader = req.headers.cookie || '';
      const sessionId = cookieHeader.split(';')
        .map(cookie => cookie.trim())
        .find(cookie => cookie.startsWith('sessionId='))
        ?.split('=')[1];
      
      if (!sessionId || !sessions[sessionId]) {
        // For demo purposes, return admin user if no session
        // This allows bypassing login during development
        if (process.env.NODE_ENV === 'development') {
          return res.status(200).json({
            id: 1,
            username: 'admin',
            name: 'Admin User (Dev Mode)',
            role: 'admin'
          });
        }
        
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      const session = sessions[sessionId];
      
      // Check if session is expired
      if (session.expiresAt < Date.now()) {
        delete sessions[sessionId];
        return res.status(401).json({ error: 'Session expired' });
      }
      
      return res.status(200).json(session.user);
    }
    
    // Handle logout endpoint
    if (path === '/logout' && req.method === 'POST') {
      // Get session ID from cookie
      const cookieHeader = req.headers.cookie || '';
      const sessionId = cookieHeader.split(';')
        .map(cookie => cookie.trim())
        .find(cookie => cookie.startsWith('sessionId='))
        ?.split('=')[1];
      
      if (sessionId && sessions[sessionId]) {
        delete sessions[sessionId];
      }
      
      // Clear cookie
      res.setHeader('Set-Cookie', 'sessionId=; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=0');
      
      return res.status(200).json({ success: true });
    }

    // Handle sessions endpoints
    if (path === '/sessions' && req.method === 'GET') {
      const user = getUserFromSession(req);
      if (!user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      // For demo, return a list of mock sessions
      return res.status(200).json([
        {
          id: '1',
          name: 'Robotics Workshop',
          date: new Date().toISOString().split('T')[0],
          time: '10:00 AM',
          duration: 60,
          status: 'active',
          attendance: 15,
          total: 20
        },
        {
          id: '2',
          name: 'Programming Basics',
          date: new Date(Date.now() - 86400000).toISOString().split('T')[0], // Yesterday
          time: '2:00 PM',
          duration: 90,
          status: 'completed',
          attendance: 18,
          total: 22
        }
      ]);
    }
    
    // Handle creating a new session
    if (path === '/sessions' && req.method === 'POST') {
      const user = getUserFromSession(req);
      if (!user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      if (user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can create sessions' });
      }
      
      const { name, date, time, duration } = req.body || {};
      
      if (!name || !date || !time || !duration) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      
      // Create new session
      const sessionId = Date.now().toString();
      const expirationTime = new Date();
      expirationTime.setMinutes(expirationTime.getMinutes() + parseInt(duration));
      
      const newSession = {
        id: sessionId,
        name,
        date,
        time,
        duration: parseInt(duration),
        status: 'active',
        createdAt: new Date().toISOString(),
        expiresAt: expirationTime.toISOString(),
        qrCode: `https://qr-attendance-gules.vercel.app/student/scan?session=${sessionId}`
      };
      
      activeClassSessions.push(newSession);
      
      return res.status(201).json(newSession);
    }
    
    // Handle specific session
    if (path.match(/^\/sessions\/[^\/]+$/) && req.method === 'GET') {
      const user = getUserFromSession(req);
      if (!user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      const sessionId = path.split('/')[2];
      const session = activeClassSessions.find(s => s.id === sessionId);
      
      if (!session) {
        // Return dummy session for demo
        return res.status(200).json({
          id: sessionId,
          name: 'Demo Session',
          date: new Date().toISOString().split('T')[0],
          time: '11:00 AM',
          duration: 60,
          status: 'active',
          attendance: 12,
          total: 25
        });
      }
      
      return res.status(200).json(session);
    }
    
    // Handle session attendance endpoint
    if (path.match(/^\/sessions\/[^\/]+\/attendance$/) && req.method === 'POST') {
      const user = getUserFromSession(req);
      if (!user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      const sessionId = path.split('/')[2];
      
      // Record attendance
      attendanceRecords.push({
        sessionId,
        userId: user.id,
        timestamp: new Date().toISOString()
      });
      
      return res.status(200).json({ 
        success: true, 
        message: 'Attendance recorded successfully' 
      });
    }
    
    // Handle students endpoint
    if (path === '/students' && req.method === 'GET') {
      const user = getUserFromSession(req);
      if (!user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      if (user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can view student list' });
      }
      
      // Return mock student list
      return res.status(200).json([
        { id: 2, username: 'S1001', name: 'Student User', role: 'student' },
        { id: 3, username: 'S1002', name: 'Jane Doe', role: 'student' },
        { id: 4, username: 'S1003', name: 'John Smith', role: 'student' }
      ]);
    }
    
    // Handle student attendance endpoint
    if (path === '/attendance/me' && req.method === 'GET') {
      const user = getUserFromSession(req);
      if (!user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      if (user.role !== 'student') {
        return res.status(403).json({ error: 'Only students can view their attendance' });
      }
      
      // Return mock attendance data
      return res.status(200).json({
        total: 15,
        attended: 12,
        percentage: 80,
        sessions: [
          {
            id: '1',
            name: 'Robotics Workshop',
            date: '2023-03-28',
            attended: true
          },
          {
            id: '2',
            name: 'Programming Basics',
            date: '2023-03-27',
            attended: true
          }
        ]
      });
    }
    
    // Handle session scanning
    if (path === '/scan' && req.method === 'POST') {
      const user = getUserFromSession(req);
      if (!user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      const { sessionId } = req.body || {};
      
      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }
      
      // Record attendance
      attendanceRecords.push({
        sessionId,
        userId: user.id,
        name: user.name,
        timestamp: new Date().toISOString()
      });
      
      return res.status(200).json({ 
        success: true, 
        message: 'Attendance recorded successfully',
        redirectUrl: '/student'
      });
    }
    
    // Handle redirection to dashboard after scanning
    if (path === '/redirect' && req.method === 'GET') {
      const user = getUserFromSession(req);
      if (!user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      // Redirect to appropriate dashboard based on user role
      const redirectUrl = user.role === 'admin' ? '/admin' : '/student';
      
      return res.status(200).json({ 
        success: true, 
        redirectUrl 
      });
    }
    
    // Default handler for unmatched routes
    return res.status(404).json({ error: 'Endpoint not found' });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
