export interface Student {
  id: string;
  username: string;
  name: string;
  email: string;
  status?: string;
  password?: string;
  role?: string;
  attended?: number;
  missed?: number;
  percentage?: number;
}

export interface AttendanceRecord {
  id: string;
  name: string;
  date: string;
  time?: string;
  duration?: string;
  present?: number;
  absent?: number;
  percentage?: number;
  expires_at?: string;
  username?: string;
  user_id?: string;
  session_id?: string;
  check_in_time?: string;
  status?: string;
  session_name?: string;
  session?: any;
}

export interface ImportMetaEnv {
  MODE: string;
  DEV: boolean;
  PROD: boolean;
  SSR: boolean;
  BASE_URL: string;
  VITE_APP_TITLE: string;
  // Add your environment variables here
  [key: string]: any;
} 