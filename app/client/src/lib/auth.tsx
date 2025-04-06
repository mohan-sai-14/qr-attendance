import React, { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';

interface User {
  id: number;
  username: string;
  name: string;
  role: 'admin' | 'student';
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<User | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if user is logged in on initial load
  useEffect(() => {
    const checkAuthStatus = async () => {
      setIsLoading(true);
      try {
        const response = await axios.get('/api/me', { 
          withCredentials: true,
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        
        if (response.data && response.data.id) {
          console.log('User authenticated:', response.data);
          setUser(response.data);
          
          // Store in localStorage as a backup
          localStorage.setItem('user', JSON.stringify(response.data));
        } else {
          console.log('No authenticated user found');
          setUser(null);
          localStorage.removeItem('user');
          // Redirect to login page if not authenticated
          redirectToLogin();
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
        
        // Clear user data from localStorage to prevent unauthorized access
        localStorage.removeItem('user');
        setUser(null);
        
        // Redirect to login page on auth error
        redirectToLogin();
      } finally {
        setIsLoading(false);
      }
    };

    // Helper function to redirect to login
    const redirectToLogin = () => {
      // Only redirect if we're not already on the login page
      if (!window.location.pathname.includes('/login') && 
          !window.location.pathname.includes('/register')) {
        console.log('Redirecting to login page');
        window.location.href = '/login';
      }
    };

    checkAuthStatus();
    
    // Also add event listener for page visibility changes
    // This helps catch when a user switches back to the app after it's been in background
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        checkAuthStatus();
      }
    });
    
    return () => {
      document.removeEventListener('visibilitychange', () => {});
    };
  }, []);

  const login = async (username: string, password: string): Promise<User> => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('Attempting login for:', username);
      const response = await axios.post('/api/login', { username, password }, { withCredentials: true });
      
      console.log('Login response:', response);
      
      if (response.data && response.data.id) {
        setUser(response.data);
        localStorage.setItem('user', JSON.stringify(response.data));
        return response.data;
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      const errorMessage = error.response?.data?.error || 'Failed to login. Please try again.';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await axios.post('/api/logout', {}, { withCredentials: true });
      setUser(null);
      localStorage.removeItem('user');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const refreshUser = async (): Promise<User | null> => {
    setIsLoading(true);
    try {
      const response = await axios.get('/api/me', { 
        withCredentials: true,
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (response.data && response.data.id) {
        setUser(response.data);
        localStorage.setItem('user', JSON.stringify(response.data));
        return response.data;
      }
      return null;
    } catch (error) {
      console.error('Error refreshing user:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, error, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn = ({ on401 }: { on401: UnauthorizedBehavior }) => 
  async ({ queryKey }: { queryKey: string[] }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (on401 === "returnNull" && res.status === 401) {
      return null;
    }

    if (!res.ok) {
      throw new Error(`Failed to fetch: ${res.status}`);
    }

    return res.json();
  };