-- Run these commands in your Supabase SQL Editor
-- This creates a table to store session data for the app

-- Create sessions table
CREATE TABLE app_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Create indexes for better performance
CREATE INDEX idx_app_sessions_user_id ON app_sessions(user_id);
CREATE INDEX idx_app_sessions_expires_at ON app_sessions(expires_at);

-- Enable RLS (Row Level Security) for the table
ALTER TABLE app_sessions ENABLE ROW LEVEL SECURITY;

-- Create policy to allow service role to manage all sessions
CREATE POLICY "Service can manage all sessions" 
  ON app_sessions 
  USING (auth.role() = 'service_role') 
  WITH CHECK (auth.role() = 'service_role');

-- Create policy to allow users to read their own sessions
CREATE POLICY "Users can read their own sessions" 
  ON app_sessions 
  FOR SELECT 
  USING (auth.uid()::text = user_id); 