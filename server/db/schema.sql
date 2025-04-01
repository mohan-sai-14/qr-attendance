-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL
);

-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    FOREIGN KEY (created_by) REFERENCES users(user_id)
);

-- Create attendance table
CREATE TABLE IF NOT EXISTS attendance (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_sessions_created_by ON sessions(created_by);
CREATE INDEX IF NOT EXISTS idx_sessions_is_active ON sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_session_id ON attendance(session_id);

-- Insert initial admin user
INSERT INTO users (user_id, password, name, email)
VALUES ('admin', 'admin123', 'mohan', 'mohansaireddy22@gmail.com')
ON CONFLICT (user_id) DO NOTHING;

-- Insert initial student user
INSERT INTO users (user_id, password, name, email)
VALUES ('S1001', 'student123', 'jhonsmith', 'mohansaireddy54@gmail.com')
ON CONFLICT (user_id) DO NOTHING; 