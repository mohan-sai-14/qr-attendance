import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'https://qwavakkbfpdgkvtctogx.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3YXZha2tiZnBkZ2t2dGN0b2d4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI3MTE4MjYsImV4cCI6MjA1ODI4NzgyNn0.Kdwo9ICmcsHPhK_On6G73ccSPkcEqzAg2BtvblhD8co';
const supabase = createClient(supabaseUrl, supabaseKey);

const app = express();

// Middleware
app.use(cors({ 
  origin: true, 
  credentials: true 
}));
app.use(express.json());

// Authentication routes
app.post('/api/login', async (req, res) => {
  try {
    const { userId, password } = req.body;
    
    // Query the user table to check credentials
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', userId)
      .single();
      
    if (error || !data) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Simple password check (in production, use proper hashing)
    if (data.password !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Return user data without password
    const { password: _, ...userWithoutPassword } = data;
    return res.json(userWithoutPassword);
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Server error during login' });
  }
});

// Current user check
app.get('/api/me', async (req, res) => {
  // In production, use session tokens/cookies
  // For now, return a mock response
  return res.json({ username: 'admin', name: 'Administrator', role: 'admin' });
});

// Sessions endpoints
app.get('/api/sessions/active', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
      
    if (error) {
      return res.status(404).json({ error: 'No active session found' });
    }
    
    return res.json(data);
  } catch (error) {
    console.error('Error fetching active session:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Export for Vercel serverless functions
export default app; 