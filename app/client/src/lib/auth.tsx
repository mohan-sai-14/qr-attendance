import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "./queryClient";
import { getApiUrl } from "./config";
import { supabase } from "./supabase";

export interface User {
  id: number;
  username: string;
  name: string;
  role: string;
  email?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  isOfflineMode: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  // On component mount, check if session exists
  useEffect(() => {
    const checkSession = async () => {
      try {
        setIsLoading(true);
        console.log("Checking session at:", getApiUrl("/api/me"));
        
        // Check for session with API
        const response = await fetch(getApiUrl("/api/me"), {
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          }
        });
        
        console.log("Session check response status:", response.status);
        
        if (response.ok) {
          const userData = await response.json();
          console.log("User data from session:", userData);
          setUser(userData);
          localStorage.setItem('userData', JSON.stringify(userData));
          setIsOfflineMode(false);
        } else {
          // No valid session, clear any stored user data
          localStorage.removeItem('userData');
          setUser(null);
          console.log("No valid session found, user not authenticated");
        }
      } catch (error) {
        console.error("Error checking session:", error);
        setUser(null);
        localStorage.removeItem('userData');
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
  }, []);

  const loginMutation = useMutation({
    mutationFn: async ({ username, password }: { username: string; password: string }) => {
      try {
        console.log("Attempting login for user:", username);
        
        // Try to login through our API
        const response = await fetch(getApiUrl("/api/login"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          credentials: "include",
          body: JSON.stringify({ 
            username, 
            password
          }),
        });
        
        console.log("Login API response status:", response.status);
        
        if (!response.ok) {
          // Try to get error message from the response
          let errorMessage;
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || `Login failed: ${response.statusText || "Unknown error"}`;
          } catch (parseError) {
            errorMessage = `Login failed: ${response.statusText || "Unknown error"}`;
          }
          
          console.error("Login failed:", errorMessage);
          throw new Error(errorMessage);
        }
        
        // Parse user data
        const userData = await response.json();
        console.log("Login successful, user data:", userData);
        
        // Store userData in localStorage for offline reference, not for auth
        localStorage.setItem('userData', JSON.stringify(userData));
        
        return userData;
      } catch (error: any) {
        console.error("Login error:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      setUser(data);
      setIsOfflineMode(false);
      queryClient.invalidateQueries({ queryKey: [getApiUrl('/api/me')] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      try {
        console.log("Logging out...");
        // Log out through our API
        const response = await fetch(getApiUrl("/api/logout"), {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          }
        });
        
        if (!response.ok) {
          console.warn("Logout response not OK:", response.status);
        }
        
        // Always clear local data regardless of server response
        localStorage.removeItem('userData');
        setUser(null);
        
      } catch (error) {
        console.error("Logout error:", error);
        // Continue with local logout even if API fails
        localStorage.removeItem('userData');
        setUser(null);
      }
    },
    onSuccess: () => {
      setUser(null);
      setIsOfflineMode(false);
      queryClient.clear();
      queryClient.invalidateQueries();
    },
  });

  const login = async (username: string, password: string) => {
    return loginMutation.mutateAsync({ username, password });
  };

  const logout = async () => {
    await logoutMutation.mutateAsync();
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, isOfflineMode }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

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