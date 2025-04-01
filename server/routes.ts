// Active session route - no auth required for debugging
app.get("/api/sessions/active", async (req, res) => {
  // Force content type to be JSON
  res.type('application/json');
  
  try {
    console.log("Active session request received");
    const session = await storage.getActiveSession();
    
    if (!session) {
      console.log("No active session found");
      return res.status(200).json({ 
        success: false,
        message: 'No active session found'
      });
    }

    console.log("Returning active session:", session.id);
    return res.status(200).json({
      success: true,
      data: session
    });
  } catch (error) {
    console.error('Error getting active session:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Get all sessions route
app.get("/api/sessions", async (req, res) => {
  // Force content type to be JSON
  res.type('application/json');
  
  try {
    console.log("All sessions request received");
    const sessions = await storage.getAllSessions();
    
    return res.status(200).json({
      success: true,
      data: sessions || []
    });
  } catch (error) {
    console.error('Error getting all sessions:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}); 