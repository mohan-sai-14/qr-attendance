export const API_BASE_URL = 'http://localhost:3001/api';

export async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      credentials: 'include',
      headers: {
        ...options.headers,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorJson.error || errorText;
      } catch {
        errorMessage = errorText || `${response.status}: ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    }
    return response.text();
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}

// Auth endpoints
export const login = async (credentials: { userId: string; password: string }) => {
  return fetchWithAuth('/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
};

export const logout = async () => {
  return fetchWithAuth('/logout', {
    method: 'POST',
  });
};

export const getCurrentUser = async () => {
  return fetchWithAuth('/me');
};

// Session endpoints
export const getActiveSession = async () => {
  return fetchWithAuth('/sessions/active');
};

export const getAllSessions = async () => {
  return fetchWithAuth('/sessions');
};

export const createSession = async (sessionData: any) => {
  return fetchWithAuth('/sessions', {
    method: 'POST',
    body: JSON.stringify(sessionData),
  });
};

// Attendance endpoints
export const getUserAttendance = async () => {
  return fetchWithAuth('/attendance/me');
};

export const recordAttendance = async (sessionId: string) => {
  return fetchWithAuth('/attendance', {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  });
}; 