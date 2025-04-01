import { Express } from 'express';
import { Storage } from '../storage';

// Initialize storage
const storage = new Storage();

export function registerRoutes(app: Express) {
  // Active session route - no authentication required to help debugging
  app.get("/api/sessions/active", async (req, res) => {
    // Force content type to be JSON
    res.header('Content-Type', 'application/json');
    
    try {
      console.log("Active session request received");
      const session = await storage.getActiveSession();
      
      if (!session) {
        console.log("No active session found");
        return res.status(404).json({ 
          success: false,
          message: 'No active session found'
        });
      }

      // Check if session has expired
      const now = new Date();
      const expiryTime = new Date(session.expires_at);
      
      if (now > expiryTime) {
        console.log("Session expired:", session.id);
        // Deactivate the expired session
        await storage.expireSession(session.id);
        return res.status(404).json({ 
          success: false,
          message: 'Session has expired'
        });
      }

      console.log("Active session found:", session.id);
      return res.json({
        success: true,
        data: session
      });
    } catch (error) {
      console.error('Error getting active session:', error);
      return res.status(500).json({ 
        success: false,
        message: 'Internal server error'
      });
    }
  });

  // Create session route
  app.post("/api/sessions", async (req, res) => {
    // Force content type to be JSON
    res.header('Content-Type', 'application/json');
    
    try {
      console.log("Session creation request received:", req.body);
      
      const { name, expires_after } = req.body;
      
      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'Session name is required'
        });
      }
      
      // Default expiration: 20 minutes
      const expiresAfter = expires_after || 20 * 60 * 1000;
      
      // Calculate expiration time
      const expiresAt = new Date(Date.now() + expiresAfter);
      
      const session = await storage.createSession({
        name,
        created_by: req.session?.userId || 'system',
        expires_at: expiresAt.toISOString(),
        is_active: true
      });
      
      console.log("Session created successfully:", session.id);
      
      return res.status(201).json({
        success: true,
        data: session
      });
    } catch (error) {
      console.error('Error creating session:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create session'
      });
    }
  });
} 