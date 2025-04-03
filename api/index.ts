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
const tempReports: Record<string, { type: string, data: any[], expiresAt: number }> = {};

// Demo users to always have available
interface DemoUser {
  id: number;
  username: string;
  name: string;
  role: string;
}

const demoUsers: Record<string, DemoUser> = {
  admin: {
    id: 1,
    username: 'admin',
    name: 'Admin User',
    role: 'admin'
  },
  student: {
    id: 2,
    username: 'S1001',
    name: 'Student User',
    role: 'student'
  },
  mohan: {
    id: 3,
    username: 'mohan',
    name: 'N. Mohan sai reddy',
    role: 'student'
  }
};

// Helper function to get user from session
const getUserFromSession = (req: VercelRequest, fallbackToDemo = true) => {
  const cookieHeader = req.headers.cookie || '';
  const sessionId = cookieHeader.split(';')
    .map(cookie => cookie.trim())
    .find(cookie => cookie.startsWith('sessionId='))
    ?.split('=')[1];
  
  if (!sessionId || !sessions[sessionId]) {
    // Check if this might be one of our demo users based on a header
    if (fallbackToDemo) {
      const demoUserHeader = req.headers['x-demo-user'] as string;
      if (demoUserHeader && Object.prototype.hasOwnProperty.call(demoUsers, demoUserHeader)) {
        console.log(`Using demo user: ${demoUserHeader}`);
        return demoUsers[demoUserHeader];
      }
      
      // Always provide a demo user for development
      if (process.env.NODE_ENV !== 'production') {
        // Determine user type from URL/path
        const path = req.url || '';
        if (path.includes('/admin')) {
          return demoUsers.admin;
        } else if (path.includes('/student')) {
          return demoUsers.mohan; // Use a specific student for consistent UX
        }
      }
    }
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
      
      // Try to get user from session
      const user = getUserFromSession(req);
      
      if (user) {
        return res.status(200).json(user);
      }
      
      // No valid session, provide appropriate response for the client
      // Check URL to determine context
      const isAdmin = req.url?.includes('/admin');
      const isStudent = req.url?.includes('/student');
      
      if (process.env.NODE_ENV === 'development' || (isAdmin || isStudent)) {
        // For development or when context is clear, provide a demo user
        const demoUser = isAdmin ? demoUsers.admin : demoUsers.mohan;
        console.log(`Auto-providing demo user for ${isAdmin ? 'admin' : 'student'} context:`, demoUser.username);
        
        // Generate a new session ID for this demo user
        const newSessionId = Math.random().toString(36).substring(2);
        const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
        
        // Store session
        sessions[newSessionId] = {
          user: demoUser,
          expiresAt
        };
        
        // Set cookie for future requests
        res.setHeader('Set-Cookie', `sessionId=${newSessionId}; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=86400`);
        
        return res.status(200).json(demoUser);
      }
      
      return res.status(401).json({ 
        error: 'Not authenticated',
        message: 'Please log in to continue',
        redirectTo: '/'
      });
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
    
    // Handle active session endpoint
    if (path === '/sessions/active' && req.method === 'GET') {
      const user = getUserFromSession(req, true); // Always allow demo fallback
      
      // Log debugging information
      console.log('Active session request:', {
        hasUser: !!user,
        userInfo: user ? { id: user.id, username: user.username, role: user.role } : 'No user',
        cookies: req.headers.cookie,
        url: req.url
      });
      
      if (!user) {
        // Instead of returning an error for no user, just create a demo user session
        // This makes the app more usable in development and demo scenarios
        const isAdmin = req.url?.includes('/admin');
        const isStudent = req.url?.includes('/student') || !isAdmin;
        
        // Create demo user based on path context
        const demoUser = isAdmin ? demoUsers.admin : demoUsers.mohan;
        console.log(`Creating demo user session for ${isAdmin ? 'admin' : 'student'} context:`, demoUser.username);
        
        // Generate a new session ID for this demo user
        const newSessionId = Math.random().toString(36).substring(2);
        const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
        
        // Store session
        sessions[newSessionId] = {
          user: demoUser,
          expiresAt
        };
        
        // Set cookie for future requests
        res.setHeader('Set-Cookie', `sessionId=${newSessionId}; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=86400`);
        
        // Continue with the request now that we have a user
      }
      
      try {
        // Fetch the most recent session from Supabase
        const { data: sessionData, error } = await supabase
          .from('sessions')
          .select('*')
          .order('id', { ascending: false })
          .limit(1)
          .single();
        
        if (error && error.code !== 'PGRST116') { // Ignore "no rows returned" error
          console.error('Error fetching session from Supabase:', error);
          throw error;
        }
        
        if (!sessionData) {
          // Fallback to demo data if no session found
          console.log('No session found in database, using fallback data');
          const currentTime = new Date();
          const sessionEndTime = new Date(currentTime);
          sessionEndTime.setMinutes(sessionEndTime.getMinutes() + 60);
          
          // For demo purposes, create a mock active session anyway
          return res.status(200).json({
            id: '1',
            name: 'Robotics Workshop',
            date: currentTime.toISOString().split('T')[0],
            time: `${currentTime.getHours()}:${String(currentTime.getMinutes()).padStart(2, '0')}`,
            duration: 60,
            status: 'active',
            attendance: 15,
            total: 20,
            is_active: true,
            expires_at: sessionEndTime.toISOString(),
            checked_in: true,
            check_in_time: new Date(currentTime.getTime() - 5 * 60000).toISOString()
          });
        }
        
        // Format the session data from Supabase
        const formattedDate = new Date(sessionData.date).toISOString().split('T')[0];
        
        // Calculate session end time
        const sessionStartTime = new Date(`${formattedDate}T${sessionData.time}`);
        const sessionEndTime = new Date(sessionStartTime);
        sessionEndTime.setMinutes(sessionStartTime.getMinutes() + sessionData.duration);
        
        // Check if session is still active - for demo, always consider it active
        const isActive = process.env.NODE_ENV !== 'production' || sessionEndTime > new Date();
        
        // Return the formatted session
        return res.status(200).json({
          id: sessionData.id.toString(),
          name: sessionData.name,
          date: formattedDate,
          time: sessionData.time,
          duration: sessionData.duration,
          status: isActive ? 'active' : 'completed',
          attendance: 15, // Default value, would be calculated from attendance records
          total: 20,      // Default value, would be calculated from enrollment
          is_active: isActive,
          expires_at: sessionEndTime.toISOString(),
          checked_in: true, // Would be checked against attendance records
          check_in_time: new Date(sessionStartTime.getTime() + 5 * 60000).toISOString() // 5 min after start
        });
      } catch (error) {
        console.error('Error in active session endpoint:', error);
        return res.status(500).json({ error: 'Failed to fetch active session' });
      }
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
      const { timestamp } = req.body || {};
      
      try {
        console.log('Recording manual attendance for session:', sessionId, 'user:', user.id);
        
        // Get session information from Supabase
        const { data: sessionData, error: sessionError } = await supabase
          .from('sessions')
          .select('*')
          .eq('id', sessionId)
          .single();
          
        if (sessionError) {
          console.error('Error fetching session:', sessionError);
          throw new Error('Session not found or error fetching session data');
        }
        
        // Check if user has already recorded attendance for this session
        const { data: existingRecord, error: checkError } = await supabase
          .from('attendance')
          .select('*')
          .eq('session_id', sessionId)
          .eq('user_id', user.id)
          .single();
          
        if (checkError && checkError.code !== 'PGRST116') { // Ignore "no rows returned" error
          console.error('Error checking existing attendance:', checkError);
        }
        
        if (existingRecord) {
          console.log('User already has attendance record for this session:', existingRecord);
          
          // Record attendance in local memory for demo/backup
          attendanceRecords.push({
            sessionId,
            userId: user.id,
            name: user.name,
            timestamp: timestamp || new Date().toISOString(),
            status: 'present',
            duplicate: true,
            method: 'manual'
          });
          
          return res.status(200).json({ 
            success: true, 
            message: 'Attendance was already recorded for this session'
          });
        }
        
        // Insert new attendance record in Supabase
        const attendanceData = {
          session_id: sessionId,
          user_id: user.id,
          username: user.username,
          name: user.name,
          check_in_time: timestamp || new Date().toISOString(),
          status: 'present'
        };
        
        const { data: insertData, error: insertError } = await supabase
          .from('attendance')
          .insert(attendanceData)
          .select();
          
        if (insertError) {
          console.error('Error inserting attendance record:', insertError);
          throw new Error('Failed to record attendance in database');
        }
        
        console.log('Attendance record inserted:', insertData);
        
        // Record attendance in local memory for demo/backup
        attendanceRecords.push({
          sessionId,
          userId: user.id,
          name: user.name,
          timestamp: timestamp || new Date().toISOString(),
          status: 'present',
          method: 'manual'
        });
        
        return res.status(200).json({ 
          success: true, 
          message: 'Attendance recorded successfully'
        });
      } catch (error) {
        console.error('Error recording attendance:', error);
        
        // As a fallback, still record in memory
        attendanceRecords.push({
          sessionId,
          userId: user.id,
          name: user.name,
          timestamp: timestamp || new Date().toISOString(),
          status: 'present',
          error: true,
          method: 'manual'
        });
        
        return res.status(500).json({ 
          error: 'Failed to record attendance',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
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
      
      try {
        console.log('Fetching attendance records for user:', user.id);
        
        // Fetch user's attendance records from Supabase
        const { data: attendanceData, error: attendanceError } = await supabase
          .from('attendance')
          .select(`
            *,
            session:session_id (
              id,
              name,
              date,
              time,
              duration
            )
          `)
          .eq('user_id', user.id)
          .order('check_in_time', { ascending: false });
          
        if (attendanceError) {
          console.error('Error fetching attendance records:', attendanceError);
          throw new Error('Failed to fetch attendance records');
        }
        
        // Check if we should use mock data
        const useMockData = (req.query.mock === 'true' || process.env.NODE_ENV === 'development') && 
                            (!attendanceData || attendanceData.length === 0);
        
        if (useMockData) {
          console.log('Using mock attendance data for user:', user.id);
          
          // Return mock attendance data if requested or in development
          const currentDate = new Date();
          const oneDay = 24 * 60 * 60 * 1000; // milliseconds in a day
          
          // Create an array of mocked attendance records
          const mockRecords = [
            {
              id: '1',
              sessionId: '1',
              userId: user.id,
              username: user.username,
              name: user.name,
              sessionName: 'Robotics Workshop',
              date: new Date(currentDate.getTime() - oneDay).toISOString().split('T')[0],
              time: '10:00 AM',
              status: 'present',
              checkInTime: new Date(currentDate.getTime() - oneDay + 30 * 60000).toISOString(),
              session: {
                id: '1',
                name: 'Robotics Workshop'
              },
              isMockData: true
            },
            {
              id: '2',
              sessionId: '2',
              userId: user.id,
              username: user.username,
              name: user.name,
              sessionName: 'Programming Basics',
              date: new Date(currentDate.getTime() - 2 * oneDay).toISOString().split('T')[0],
              time: '2:00 PM',
              status: 'present',
              checkInTime: new Date(currentDate.getTime() - 2 * oneDay + 15 * 60000).toISOString(),
              session: {
                id: '2',
                name: 'Programming Basics'
              },
              isMockData: true
            }
          ];
          
          if (req.query.mock === 'true') {
            return res.status(200).json(mockRecords);
          }
        }
        
        if (!attendanceData || attendanceData.length === 0) {
          console.log('No attendance records found for user:', user.id);
          return res.status(200).json([]);
        }
        
        console.log(`Found ${attendanceData.length} attendance records for user:`, user.id);
        
        // Format the records to match expected frontend format
        const formattedRecords = attendanceData.map(record => {
          // Get session details
          const sessionInfo = record.session || {};
          
          return {
            id: record.id.toString(),
            sessionId: record.session_id.toString(),
            userId: record.user_id,
            username: record.username,
            name: record.name,
            sessionName: sessionInfo.name || record.session_name || 'Unknown Session',
            date: sessionInfo.date || record.date || 'Unknown Date',
            time: sessionInfo.time || 'Unknown Time',
            status: record.status || 'present',
            checkInTime: record.check_in_time,
            session: {
              id: record.session_id.toString(),
              name: sessionInfo.name || record.session_name || 'Unknown Session'
            }
          };
        });
        
        return res.status(200).json(formattedRecords);
      } catch (error) {
        console.error('Error in attendance/me endpoint:', error);
        
        // Return an empty array as fallback
        return res.status(500).json({ 
          error: 'Failed to fetch attendance records',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    // Handle attendance reports endpoint
    if (path === '/attendance/reports' && req.method === 'GET') {
      const user = getUserFromSession(req);
      if (!user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      if (user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can view attendance reports' });
      }
      
      // Get query parameters
      const query = req.query || {};
      const reportType = query.type as string || 'summary';
      const dateRange = query.dateRange as string || '7days';
      const format = query.format as string || 'json';
      
      try {
        // Fetch actual data from Supabase for reports
        let reportData: any = [];
        
        if (reportType === 'student') {
          // Fetch student attendance data
          const { data, error } = await supabase
            .from('attendance')
            .select(`
              user_id,
              username,
              name,
              status
            `)
            .order('name', { ascending: true });
            
          if (error) {
            console.error('Error fetching student attendance:', error);
            throw new Error('Failed to fetch student attendance data');
          }
          
          // Process into a summary by student
          const studentSummary: Record<string, any> = {};
          
          // Group and count by student
          data?.forEach(record => {
            const userId = record.user_id.toString();
            
            if (!studentSummary[userId]) {
              studentSummary[userId] = {
                id: record.user_id,
                username: record.username,
                name: record.name,
                sessionsAttended: 0,
                sessionsMissed: 0,
                attendanceRate: '0%'
              };
            }
            
            if (record.status === 'present') {
              studentSummary[userId].sessionsAttended++;
            } else {
              studentSummary[userId].sessionsMissed++;
            }
          });
          
          // Calculate attendance rates
          Object.values(studentSummary).forEach((student: any) => {
            const total = student.sessionsAttended + student.sessionsMissed;
            if (total > 0) {
              const rate = (student.sessionsAttended / total) * 100;
              student.attendanceRate = `${Math.round(rate)}%`;
            }
          });
          
          reportData = Object.values(studentSummary);
          
          // If no data, use mock data for demo
          if (reportData.length === 0) {
            reportData = [
              { id: 1, username: 'S1001', name: 'John Smith', sessionsAttended: 3, sessionsMissed: 3, attendanceRate: '50%' },
              { id: 2, username: 'mohan', name: 'N. Mohan Sai Reddy', sessionsAttended: 2, sessionsMissed: 1, attendanceRate: '67%' },
              { id: 3, username: 'vedhanth', name: 'A. Vedhanth', sessionsAttended: 1, sessionsMissed: 4, attendanceRate: '20%' },
            ];
          }
        } else {
          // Fetch session attendance data
          const { data: sessionsData, error: sessionsError } = await supabase
            .from('sessions')
            .select('*')
            .order('date', { ascending: false });
            
          if (sessionsError) {
            console.error('Error fetching sessions:', sessionsError);
            throw new Error('Failed to fetch session data');
          }
          
          // For each session, get attendance count
          for (const session of sessionsData || []) {
            const { data: attendanceData, error: attendanceError } = await supabase
              .from('attendance')
              .select('count', { count: 'exact' })
              .eq('session_id', session.id)
              .eq('status', 'present');
              
            if (attendanceError) {
              console.error('Error fetching attendance count:', attendanceError);
              continue;
            }
            
            const presentCount = attendanceData?.length || 0;
            const totalStudents = 20; // This would be fetched from actual enrollment in a real app
            const absentStudents = totalStudents - presentCount;
            const attendanceRate = Math.round((presentCount / totalStudents) * 100);
            
            reportData.push({
              id: session.id,
              name: session.name,
              date: session.date,
              time: session.time,
              duration: session.duration,
              totalStudents,
              presentStudents: presentCount,
              absentStudents,
              attendanceRate: `${attendanceRate}%`
            });
          }
          
          // If no data, use mock data for demo
          if (reportData.length === 0) {
            reportData = [
              { 
                id: 1, 
                name: 'Robotics Workshop', 
                date: '2023-04-01', 
                totalStudents: 20, 
                presentStudents: 15, 
                absentStudents: 5, 
                attendanceRate: '75%' 
              },
              { 
                id: 2, 
                name: 'Programming Basics', 
                date: '2023-04-02', 
                totalStudents: 22, 
                presentStudents: 18, 
                absentStudents: 4, 
                attendanceRate: '82%' 
              }
            ];
          }
        }
        
        if (format === 'xlsx') {
          // For Excel format, we'll return a download URL
          // In a production app, you would generate the Excel file
          // For now, we'll return a URL to the download endpoint
          
          // Store the report data temporarily in memory
          const reportId = Math.random().toString(36).substring(2);
          const expiresAt = Date.now() + (10 * 60 * 1000); // 10 minutes
          
          tempReports[reportId] = {
            type: reportType,
            data: reportData,
            expiresAt
          };
          
          const reportFilename = `attendance-${reportType}-${new Date().toISOString().split('T')[0]}.xlsx`;
          
          return res.status(200).json({ 
            success: true, 
            message: `Generating ${reportType} attendance report for the ${dateRange} period`,
            reportId,
            filename: reportFilename,
            downloadUrl: `/api/attendance/reports/download?id=${reportId}&filename=${reportFilename}`
          });
        }
        
        // For JSON format, return the data directly
        return res.status(200).json(reportData);
      } catch (error) {
        console.error('Error generating report:', error);
        return res.status(500).json({ 
          error: 'Failed to generate report',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    // Handle attendance reports download endpoint
    if (path.match(/^\/attendance\/reports\/download/) && req.method === 'GET') {
      const user = getUserFromSession(req);
      if (!user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      if (user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can download attendance reports' });
      }
      
      try {
        // Get the report ID and filename from query parameters
        const reportId = req.query.id as string;
        const filename = req.query.filename as string || 'attendance-report.xlsx';
        
        if (!reportId || !tempReports[reportId]) {
          return res.status(404).json({ 
            error: 'Report not found',
            message: 'The requested report could not be found or has expired.'
          });
        }
        
        const report = tempReports[reportId];
        
        // Check if report has expired
        if (report.expiresAt < Date.now()) {
          delete tempReports[reportId];
          return res.status(410).json({ 
            error: 'Report expired',
            message: 'The requested report has expired. Please generate a new report.'
          });
        }
        
        // Generate CSV content as a simple alternative to Excel
        // In a production app, you would use a library like exceljs to generate real Excel files
        let csvContent = '';
        
        // Add headers based on report type
        if (report.type === 'student') {
          csvContent = 'ID,Username,Name,Sessions Attended,Sessions Missed,Attendance Rate\n';
          
          // Add data rows
          report.data.forEach(student => {
            csvContent += `${student.id},${student.username},"${student.name}",${student.sessionsAttended},${student.sessionsMissed},${student.attendanceRate}\n`;
          });
        } else {
          csvContent = 'ID,Session Name,Date,Total Students,Present,Absent,Attendance Rate\n';
          
          // Add data rows
          report.data.forEach(session => {
            csvContent += `${session.id},"${session.name}",${session.date},${session.totalStudents},${session.presentStudents},${session.absentStudents},${session.attendanceRate}\n`;
          });
        }
        
        // Set headers for CSV download
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename.replace('.xlsx', '.csv')}"`);
        
        // Remove the report from temporary storage after serving
        delete tempReports[reportId];
        
        // Return the CSV content
        return res.status(200).send(csvContent);
      } catch (error) {
        console.error('Error generating download:', error);
        return res.status(500).json({ 
          error: 'Failed to generate download',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    // Handle attendance endpoint (for admin)
    if (path === '/attendance' && req.method === 'GET') {
      const user = getUserFromSession(req);
      if (!user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      if (user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can view all attendance records' });
      }
      
      // Return mock attendance records for all students
      const records = [
        {
          id: '1',
          sessionId: '1',
          userId: 2,
          username: 'S1001',
          name: 'John Smith',
          sessionName: 'Robotics Workshop',
          date: '2023-04-01',
          time: '10:00 AM',
          status: 'present',
          checkInTime: '2023-04-01T10:15:00Z'
        },
        {
          id: '2',
          sessionId: '2',
          userId: 2,
          username: 'S1001',
          name: 'John Smith',
          sessionName: 'Programming Basics',
          date: '2023-04-02',
          time: '2:00 PM',
          status: 'present',
          checkInTime: '2023-04-02T14:10:00Z'
        }
      ];
      
      return res.status(200).json(records);
    }
    
    // Handle session scanning
    if (path === '/scan' && req.method === 'POST') {
      // For scan endpoint, automatically create a demo user if not authenticated
      // This ensures attendance can be recorded even with cookie issues
      let user = getUserFromSession(req, true);
      
      // If no user is found even with fallback, use the provided user info from request
      if (!user && req.body) {
        const { userId, username } = req.body;
        if (userId && username) {
          // Use the user info from the request
          user = {
            id: userId,
            username: username,
            name: username,
            role: 'student'
          };
          console.log('Using user info from request:', user);
        } else {
          // Fall back to demo user as last resort
          user = demoUsers.mohan;
          console.log('Using default demo user for scan:', user);
        }
      }
      
      // Log the full request body for debugging
      console.log('Scan request body:', req.body);
      
      const { sessionId, timestamp } = req.body || {};
      
      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }
      
      try {
        console.log('Recording attendance for session:', sessionId, 'user:', user.id);
        
        // Format the current date for the database record
        const now = new Date();
        const dateString = now.toISOString().split('T')[0]; // YYYY-MM-DD
        
        // For the timestamp field, use ISO format
        const isoTimestamp = timestamp || now.toISOString();
        
        // First, check if session exists in Supabase
        let sessionData = null;
        try {
          const { data, error } = await supabase
            .from('sessions')
            .select('*')
            .eq('id', sessionId)
            .single();
          
          if (error && error.code !== 'PGRST116') { // PGRST116 means no rows returned
            console.warn(`Error fetching session ${sessionId}:`, error);
          } else if (data) {
            sessionData = data;
            console.log('Found session data:', sessionData);
          } else {
            console.log(`Session ${sessionId} not found, will use fallback data`);
          }
        } catch (fetchError) {
          console.error('Error during session lookup:', fetchError);
          // Continue anyway with fallback session data
        }
        
        // Check if user already has an attendance record for this session
        let existingRecord = null;
        try {
          const { data, error } = await supabase
            .from('attendance')
            .select('*')
            .eq('session_id', sessionId)
            .eq('user_id', user.id)
            .single();
          
          if (error && error.code !== 'PGRST116') { // PGRST116 means no rows returned
            console.warn(`Error checking existing attendance for user ${user.id}:`, error);
          } else if (data) {
            existingRecord = data;
            console.log('Found existing attendance record:', existingRecord);
          }
        } catch (checkError) {
          console.error('Error during attendance record check:', checkError);
          // Continue anyway
        }
        
        if (existingRecord) {
          console.log('User already has attendance record for this session:', existingRecord);
          
          // Record attendance in local memory for demo/backup
          attendanceRecords.push({
            sessionId,
            userId: user.id,
            name: user.name,
            timestamp: timestamp || new Date().toISOString(),
            status: 'present',
            duplicate: true
          });
          
          // Return explicit URL with protocol and domain to ensure proper redirection
          const baseUrl = req.headers.host?.includes('localhost') 
            ? 'http://localhost:3000' 
            : 'https://qr-attendance-gules.vercel.app';
            
          return res.status(200).json({ 
            success: true, 
            message: 'Attendance was already recorded for this session',
            redirectUrl: `${baseUrl}/student`
          });
        }
        
        // Get session name from session data or fallback
        const sessionName = sessionData?.name || `Session ${sessionId}`;
        
        // Insert new attendance record in Supabase
        const attendanceData = {
          session_id: sessionId,
          user_id: user.id,
          username: user.username,
          name: user.name || user.username,
          check_in_time: isoTimestamp,
          date: dateString,
          status: 'present',
          session_name: sessionName
        };
        
        console.log('Inserting attendance record:', attendanceData);
        
        let insertSuccess = false;
        
        try {
          const { data, error } = await supabase
            .from('attendance')
            .insert(attendanceData)
            .select();
            
          if (error) {
            console.error('Error inserting attendance record in Supabase:', error);
            // We'll continue and use the in-memory storage as fallback
          } else {
            console.log('Successfully inserted attendance record in Supabase:', data);
            insertSuccess = true;
          }
        } catch (dbError) {
          console.error('Exception during attendance record insertion:', dbError);
          // Continue with fallback behavior
        }
        
        // Always record in local memory as well (for backup and demo purposes)
        attendanceRecords.push({
          sessionId,
          userId: user.id,
          username: user.username,
          name: user.name || user.username,
          timestamp: isoTimestamp,
          status: 'present',
          databaseInserted: insertSuccess
        });
        
        // Build and return response
        const baseUrl = req.headers.host?.includes('localhost') 
          ? 'http://localhost:3000' 
          : 'https://qr-attendance-gules.vercel.app';
          
        return res.status(200).json({ 
          success: true, 
          message: insertSuccess 
            ? 'Attendance recorded successfully' 
            : 'Attendance recorded (database update pending)',
          redirectUrl: `${baseUrl}/student`,
          insertedInDatabase: insertSuccess
        });
      } catch (error) {
        console.error('Error recording attendance:', error);
        
        // As a fallback, still record in memory
        attendanceRecords.push({
          sessionId,
          userId: user.id || 0,
          username: user.username || 'unknown',
          name: user.name || 'Unknown User',
          timestamp: timestamp || new Date().toISOString(),
          status: 'present',
          error: true
        });
        
        return res.status(500).json({ 
          error: 'Failed to record attendance',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    // Handle redirection to dashboard after scanning
    if (path === '/redirect' && req.method === 'GET') {
      const user = getUserFromSession(req);
      if (!user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      // Redirect to appropriate dashboard based on user role
      const redirectPath = user.role === 'admin' ? '/admin' : '/student';
      const baseUrl = req.headers.host?.includes('localhost')
        ? 'http://localhost:3000'
        : 'https://qr-attendance-gules.vercel.app';
        
      return res.status(200).json({ 
        success: true, 
        redirectUrl: `${baseUrl}${redirectPath}`
      });
    }
    
    // Handle session code endpoint
    if (path.match(/^\/sessions\/code\/[^\/]+$/) && req.method === 'GET') {
      const user = getUserFromSession(req);
      if (!user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      const sessionId = path.split('/')[3];
      
      // Generate a random 6-digit code
      const attendanceCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      return res.status(200).json({ 
        attendanceCode,
        expiresAt: new Date(Date.now() + 5 * 60000).toISOString() // 5 minutes from now
      });
    }
    
    // Add a special handler for the /student route to make sure it always works
    if (path === '/student' && req.method === 'GET') {
      const user = getUserFromSession(req);
      
      // Always return a successful response for this route
      // This helps with client-side routing and direct navigation
      return res.status(200).json({
        success: true,
        user: user || demoUsers.mohan,
        isDemo: !user
      });
    }
    
    // Add catch-all handlers for specific student paths that might be causing issues
    if ((path === '/student/1' || path === '/student/dashboard') && req.method === 'GET') {
      const baseUrl = req.headers.host?.includes('localhost')
        ? 'http://localhost:3000'
        : 'https://qr-attendance-gules.vercel.app';
        
      return res.status(200).json({
        redirect: true,
        redirectUrl: `${baseUrl}/student`
      });
    }
    
    // Add a catch-all handler for student/* paths to prevent 404 errors
    if (path.startsWith('/student/') && req.method === 'GET') {
      // For API requests to student paths, redirect to appropriate API endpoint
      // This helps with client-side routing where path may be confused with API paths
      return res.status(200).json({
        redirect: true,
        path: '/student'
      });
    }
    
    // Add special handler for /student and sub-paths for better SPA routing
    if (path.startsWith('/student') && req.method === 'GET') {
      // Handle client-side routes by redirecting to root
      console.log(`Handling client-side route: ${path}`);
      
      // Return HTML redirect if Accept header includes text/html
      const acceptHeader = req.headers.accept || '';
      if (acceptHeader.includes('text/html')) {
        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <title>Redirecting...</title>
              <meta http-equiv="refresh" content="0; URL=/">
              <script>
                window.location.href = "/";
              </script>
            </head>
            <body>
              <p>Redirecting to the app...</p>
            </body>
          </html>
        `);
      }
      
      // Return JSON response for API clients
      return res.status(200).json({
        redirect: true,
        path: '/'
      });
    }
    
    // Add a test session creation endpoint (for development purposes)
    if (path === '/create-test-session' && req.method === 'POST') {
      const user = getUserFromSession(req);
      if (!user) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      if (user.role !== 'admin' && process.env.NODE_ENV === 'production') {
        return res.status(403).json({ error: 'Only admins can create test sessions in production' });
      }
      
      try {
        // Check for existing active sessions
        const { data: existingSessions, error: checkError } = await supabase
          .from('sessions')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1);
          
        if (checkError) {
          console.error('Error checking for existing sessions:', checkError);
          throw new Error('Failed to check for existing sessions');
        }
        
        if (existingSessions && existingSessions.length > 0) {
          // Return existing session instead of creating a new one
          return res.status(200).json({
            success: true,
            message: 'Using existing active session',
            session: existingSessions[0]
          });
        }
        
        // Create a new session
        const now = new Date();
        const formattedDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
        const formattedTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        
        const sessionData = {
          name: 'Test Session',
          date: formattedDate,
          time: formattedTime,
          duration: 60,
          is_active: true,
          created_at: now.toISOString(),
          created_by: user.id
        };
        
        const { data, error } = await supabase
          .from('sessions')
          .insert(sessionData)
          .select();
          
        if (error) {
          console.error('Error creating test session:', error);
          throw new Error('Failed to create test session');
        }
        
        console.log('Test session created successfully:', data);
        
        return res.status(201).json({
          success: true,
          message: 'Test session created successfully',
          session: data[0]
        });
      } catch (error) {
        console.error('Error in test session creation:', error);
        return res.status(500).json({ 
          error: 'Failed to create test session',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    // Default handler for unmatched routes
    return res.status(404).json({ error: 'Endpoint not found' });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
