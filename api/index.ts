import { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'https://qwavakkbfpdgkvtctogx.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3YXZha2tiZnBkZ2t2dGN0b2d4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI3MTE4MjYsImV4cCI6MjA1ODI4NzgyNn0.Kdwo9ICmcsHPhK_On6G73ccSPkcEqzAg2BtvblhD8co';
const supabase = createClient(supabaseUrl, supabaseKey);

// Serverless function handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { method, url, body } = req;
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
  
  // Handle OPTIONS request
  if (method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Extract endpoint from URL
  const endpoint = url?.replace(/^\/api/, '') || '/';
  
  // Handle login endpoint
  if (method === 'POST' && endpoint === '/login') {
    try {
      const { userId, password } = body;
      
      // Query the user table to check credentials
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', userId)
        .single();
        
      if (error || !data) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      // Simple password check
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
  }
  
  // Handle me endpoint
  if (method === 'GET' && endpoint === '/me') {
    // In production, use session tokens/cookies
    // For now, return a mock response
    return res.json({ username: 'admin', name: 'Administrator', role: 'admin' });
  }
  
  // Handle active session endpoint
  if (method === 'GET' && endpoint === '/sessions/active') {
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
  }
  
  // Handle sessions endpoint
  if (method === 'GET' && endpoint === '/sessions') {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (error) {
        return res.status(500).json({ error: 'Error fetching sessions' });
      }
      
      return res.json(data);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      return res.status(500).json({ error: 'Server error' });
    }
  }
  
  // Default 404 response for unhandled endpoints
  return res.status(404).json({ error: 'Endpoint not found' });
}
