export interface User {
  id: number;
  username: string;
  password: string;
  name: string;
  email: string;
  role: string;
  status: string;
}

export interface Session {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  expires_at: string;
  is_active: boolean;
  date?: string;
  time?: string;
  duration?: number;
  qr_code?: string;
}

export interface Attendance {
  id: string;
  user_id: string;
  session_id: string;
  check_in_time: string;
  status: string;
} 