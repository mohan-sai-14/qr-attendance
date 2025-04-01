-- Drop existing tables (if you want to start fresh)
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Create users table with updated schema
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL, -- keeping username instead of user_id for compatibility
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT DEFAULT 'student',
    status TEXT DEFAULT 'active'
);

-- Create sessions table with updated schema
CREATE TABLE sessions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    date DATE,
    time TEXT,
    duration INTEGER,
    qr_code VARCHAR,
    FOREIGN KEY (created_by) REFERENCES users(username)
);

-- Create attendance table with updated schema
CREATE TABLE attendance (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    check_in_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'present',
    FOREIGN KEY (user_id) REFERENCES users(username),
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Add indexes for better performance
CREATE INDEX idx_sessions_created_by ON sessions(created_by);
CREATE INDEX idx_sessions_is_active ON sessions(is_active);
CREATE INDEX idx_attendance_user_id ON attendance(user_id);
CREATE INDEX idx_attendance_session_id ON attendance(session_id);

-- Insert initial data
INSERT INTO users (username, password, name, email, role)
VALUES 
    ('admin', 'admin123', 'mohan', 'mohansaireddy22@gmail.com', 'admin'),
    ('S1001', 'student123', 'jhonsmith', 'mohansaireddy54@gmail.com', 'student')
ON CONFLICT (username) DO NOTHING; 