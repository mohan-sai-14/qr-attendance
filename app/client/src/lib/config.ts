/**
 * Configuration utilities for the application
 */

/**
 * Returns the base API URL for the current environment
 */
export function getApiUrl(path: string): string {
  // In development, use the local server
  if (import.meta.env.DEV) {
    return `http://localhost:3001${path}`;
  }
  
  // For production, ensure we have the /api prefix
  // This ensures that the API request goes to the correct serverless function
  if (!path.startsWith('/api')) {
    return `/api${path}`;
  }
  
  // Already has the correct prefix
  return path;
}

/**
 * Determines if the app is offline by checking network status
 */
export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && !navigator.onLine;
}

/**
 * Configuration for attendance
 */
export const attendanceConfig = {
  // How often to check for active sessions (ms)
  sessionRefreshInterval: 10000,
  
  // Time to keep local data valid in offline mode (ms)
  offlineCacheValidity: 24 * 60 * 60 * 1000, // 24 hours
  
  // Default QR code scan settings
  qrCode: {
    fps: 10,
    qrbox: 250,
  }
};

export const config = {
  // API endpoint configuration
  api: {
    baseUrl: import.meta.env.VITE_API_URL || '',
    timeout: 10000,
  },

  // Authentication configuration
  auth: {
    tokenKey: 'auth_token',
    refreshTokenKey: 'refresh_token',
  },

  // Session configuration
  session: {
    expirationTime: 20 * 60 * 1000, // 20 minutes in milliseconds
    checkInterval: 60 * 1000, // Check every minute
  },

  // QR code scan settings
  qrCode: {
    fps: 10,
    qrbox: 250,
    aspectRatio: 1.0,
  },

  // Attendance settings
  attendance: {
    codeLength: 6,
    codeExpiry: 20 * 60, // 20 minutes
  },
}; 