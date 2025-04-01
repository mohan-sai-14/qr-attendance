import express from 'express';
import { storage } from './storage';
import { User, Session, Attendance } from './types';

// Add session type declaration
declare module 'express-session' {
  interface SessionData {
    user: User;
  }
}

export const router = express.Router();

// Middleware to check if user is authenticated
const isAuthenticated = (
  req: express.Request, 
  res: express.Response, 
  next: express.NextFunction
) => {
  if (req.session.user) {
    return next();
  }
  res.status(401).json({ error: 'Not authenticated' });
};

// Middleware to check if user is admin
const isAdmin = (
  req: express.Request, 
  res: express.Response, 
  next: express.NextFunction
) => {
  if (req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  res.status(403).json({ error: 'Not authorized' });
};

// Login endpoint
router.post('/login', (req: express.Request, res: express.Response) => {
  console.log('Login request received:');
  console.log('- Body:', JSON.stringify(req.body));
  console.log('- Headers:', JSON.stringify(req.headers));
  
  // Check if request body is empty or userId is missing
  if (!req.body || Object.keys(req.body).length === 0) {
    console.log('Empty request body received');
    return res.status(400).json({ error: 'Empty request body' });
  }
  
  // Try to extract userId using different possible field names
  const userId = req.body.userId || req.body.username || req.body.user_id;
  const password = req.body.password;
  
  console.log('Extracted credentials:');
  console.log('- userId:', userId);
  console.log('- password:', password ? '[REDACTED]' : 'undefined');
  
  if (!userId || !password) {
    console.log('Missing credentials');
    return res.status(400).json({ error: 'Missing credentials', details: 'Both userId and password are required' });
  }
  
  storage.validateUser(userId, password)
    .then(isValid => {
      if (!isValid) {
        res.status(401).json({ error: 'Invalid credentials' });
        return Promise.reject('Invalid credentials');
      }
      
      return storage.getUser(userId);
    })
    .then(user => {
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      
      req.session.user = user;
      res.json({ 
        success: true, 
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status
        } 
      });
    })
    .catch(error => {
      if (error !== 'Invalid credentials') {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });
});

// Logout endpoint
router.post('/logout', (req: express.Request, res: express.Response) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to logout' });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

// Get current user
router.get('/me', isAuthenticated, (req: express.Request, res: express.Response) => {
  const user = req.session.user as User;
  res.json({
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status
  });
});

// Get active session (public endpoint)
router.get('/sessions/active', (req: express.Request, res: express.Response) => {
  // Allow CORS for this endpoint
  res.header('Access-Control-Allow-Origin', req.headers.origin || 'http://localhost:5173');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  console.log("Active session request received");
  
  storage.getActiveSession()
    .then(session => {
      console.log("Session data: ", session);
      
      if (!session) {
        console.log("No active session found");
        res.status(404).json({
          success: false,
          message: 'No active session found'
        });
        return;
      }
      
      console.log("Active session found:", session.id);
      res.json({
        success: true,
        data: session
      });
    })
    .catch(error => {
      console.error('Error getting active session:', error);
      res.status(500).json({ 
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : String(error)
      });
    });
});

// Get active session for current user
router.get('/session', isAuthenticated, (req: express.Request, res: express.Response) => {
  const user = req.session.user as User;
  
  storage.getActiveSession(user.role === 'admin' ? undefined : user.username)
    .then(session => {
      if (!session) {
        res.status(404).json({
          error: 'No active session',
          details: 'No active session found for the current user'
        });
        return;
      }
      res.json(session);
    })
    .catch(error => {
      console.error('Get session error:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        details: 'Failed to fetch session information'
      });
    });
});

// Get all sessions (admin only)
router.get('/sessions', isAdmin, (req: express.Request, res: express.Response) => {
  storage.getAllSessions()
    .then(sessions => {
      res.json(sessions);
    })
    .catch(error => {
      console.error('Get all sessions error:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        details: 'Failed to fetch sessions'
      });
    });
});

// Create new session (admin only)
router.post('/sessions', isAdmin, (req: express.Request, res: express.Response) => {
  const user = req.session.user as User;
  
  storage.createSession({
    ...req.body,
    created_by: user.username
  })
  .then(session => {
    if (!session) {
      res.status(500).json({
        error: 'Session creation failed',
        details: 'Failed to create new session'
      });
      return;
    }
    res.json(session);
  })
  .catch(error => {
    console.error('Error in POST /sessions:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: 'Failed to create session'
    });
  });
});

// Expire session (admin only)
router.post('/sessions/:id/expire', isAdmin, (req: express.Request, res: express.Response) => {
  storage.expireSession(req.params.id)
    .then(success => {
      if (!success) {
        res.status(500).json({
          error: 'Session expiration failed',
          details: 'Failed to expire session'
        });
        return;
      }
      res.json({ message: 'Session expired successfully' });
    })
    .catch(error => {
      console.error('Error in POST /sessions/:id/expire:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        details: 'Failed to expire session'
      });
    });
});

// Get all attendance records (admin only)
router.get('/attendance', isAdmin, (req: express.Request, res: express.Response) => {
  storage.getAllAttendance()
    .then(attendance => {
      res.json(attendance);
    })
    .catch(error => {
      console.error('Error getting attendance:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        details: 'Failed to fetch attendance records'
      });
    });
});

// Get attendance for current user
router.get('/attendance/me', isAuthenticated, (req: express.Request, res: express.Response) => {
  const user = req.session.user as User;
  
  storage.getUserAttendance(user.username)
    .then(attendance => {
      res.json(attendance);
    })
    .catch(error => {
      console.error('Error getting user attendance:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        details: 'Failed to fetch user attendance records'
      });
    });
});

// Record attendance
router.post('/attendance', isAuthenticated, (req: express.Request, res: express.Response) => {
  const user = req.session.user as User;
  const { sessionId } = req.body;

  if (!sessionId) {
    res.status(400).json({
      error: 'Missing session ID',
      details: 'Session ID is required'
    });
    return;
  }

  storage.recordAttendance(user.username, sessionId)
    .then(record => {
      if (!record) {
        res.status(500).json({
          error: 'Failed to record attendance',
          details: 'Unable to save attendance record'
        });
        return;
      }

      res.json({ message: 'Attendance recorded successfully', record });
    })
    .catch(error => {
      console.error('Error recording attendance:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        details: 'Failed to record attendance'
      });
    });
});

// Check if student is checked in for current active session
router.get('/attendance/active-session', isAuthenticated, (req: express.Request, res: express.Response) => {
  // Allow CORS for this endpoint
  res.header('Access-Control-Allow-Origin', req.headers.origin || 'http://localhost:5173');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Get the active session first
  storage.getActiveSession()
    .then(activeSession => {
      if (!activeSession) {
        res.status(404).json({
          error: 'Not found',
          details: 'No active session found'
        });
        return Promise.reject('No active session');
      }
      
      const user = req.session.user as User;
      
      // Get all attendance records for this user
      return storage.getUserAttendance(user.username)
        .then(userAttendance => {
          // Check if user has an attendance record for the active session
          const isCheckedIn = userAttendance.some(record => record.session_id === activeSession.id);
          
          res.json({
            activeSession,
            isCheckedIn,
            user_id: user.username
          });
        });
    })
    .catch(error => {
      if (error !== 'No active session') {
        console.error('Error checking attendance for active session:', error);
        res.status(500).json({
          error: 'Internal server error',
          details: 'Failed to check attendance status'
        });
      }
    });
});

// Default route for API endpoints that don't exist
router.get('/', (req: express.Request, res: express.Response) => {
  res.json({
    message: 'Robotics Club Attendance API',
    endpoints: {
      auth: ['/api/login', '/api/logout', '/api/me'],
      sessions: ['/api/sessions', '/api/sessions/active', '/api/session'],
      attendance: ['/api/attendance', '/api/attendance/me', '/api/attendance/active-session']
    }
  });
});

// Catch-all route for unknown API endpoints
router.all('*', (req: express.Request, res: express.Response) => {
  res.status(404).json({
    error: 'Not found',
    message: `API endpoint ${req.path} does not exist`,
    availableEndpoints: [
      '/api/login', 
      '/api/logout', 
      '/api/me',
      '/api/sessions', 
      '/api/sessions/active', 
      '/api/session',
      '/api/attendance', 
      '/api/attendance/me', 
      '/api/attendance/active-session'
    ]
  });
});

// Debugging route to test database connection
router.get('/debug/test-db', (req: express.Request, res: express.Response) => {
  console.log('Testing database connection...');
  
  storage.testConnection()
    .then(isConnected => {
      if (isConnected) {
        res.json({
          success: true,
          message: 'Successfully connected to Supabase'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to connect to Supabase'
        });
      }
    })
    .catch(error => {
      console.error('Error testing connection:', error);
      res.status(500).json({
        success: false,
        message: 'Error testing connection',
        error: error.message
      });
    });
});

// Debug endpoint to check table schema
router.get('/debug/schema/:table', (req: express.Request, res: express.Response) => {
  const tableName = req.params.table;
  console.log(`Checking schema for table ${tableName}...`);
  
  storage.getTableInfo(tableName)
    .then(result => {
      if (result) {
        res.json(result);
      } else {
        res.status(500).json({
          success: false,
          message: `Failed to get schema for table ${tableName}`
        });
      }
    })
    .catch(error => {
      console.error(`Error getting schema for ${tableName}:`, error);
      res.status(500).json({
        success: false,
        message: `Error getting schema for ${tableName}`,
        error: error.message
      });
    });
});

// Append this at the very end of the file
router.get('/debug/login-test', (req: express.Request, res: express.Response) => {
  console.log('Testing login with hardcoded credentials');
  
  const testUserId = 'admin'; // Use one of your actual user IDs
  const testPassword = 'admin123'; // Use the correct password
  
  console.log(`Attempting login with userId: ${testUserId}`);
  
  storage.validateUser(testUserId, testPassword)
    .then(isValid => {
      console.log(`Validation result: ${isValid}`);
      
      if (!isValid) {
        return res.status(401).json({
          success: false,
          message: 'Login failed with test credentials',
          details: 'User validation returned false'
        });
      }
      
      return storage.getUser(testUserId)
        .then(user => {
          if (!user) {
            return res.status(404).json({
              success: false,
              message: 'User validation succeeded but getUser failed',
              details: 'User is null'
            });
          }
          
          console.log('User found:', {
            id: user.id,
            username: user.username,
            role: user.role
          });
          
          return res.json({
            success: true,
            message: 'Login test succeeded',
            user: {
              id: user.id,
              username: user.username,
              name: user.name,
              role: user.role
            }
          });
        });
    })
    .catch(error => {
      console.error('Error in test login:', error);
      return res.status(500).json({
        success: false,
        message: 'Error during login test',
        error: error.message
      });
    });
}); 