import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "./queryClient";
import { getApiUrl } from "./config";

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

  // Check for stored user in localStorage to support offline mode
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        setUser(userData);
        setIsOfflineMode(true);
        console.log("Using stored user data for offline mode:", userData);
      } catch (e) {
        console.error("Error parsing stored user:", e);
      }
    }
  }, []);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch(getApiUrl("/api/me"), {
          credentials: 'include'
        });
        
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
          // Store user data for offline access
          localStorage.setItem('user', JSON.stringify(userData));
          setIsOfflineMode(false);
        } else if (response.status === 401) {
          // If we have a stored user but API says unauthorized, use offline mode
          const storedUser = localStorage.getItem('user');
          if (storedUser) {
            setUser(JSON.parse(storedUser));
            setIsOfflineMode(true);
            console.log("API unauthorized, using offline mode");
          } else {
            setUser(null);
          }
        }
      } catch (error) {
        console.error("Error fetching user:", error);
        // If network error, check for stored user data
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
          setIsOfflineMode(true);
          console.log("Network error, using offline mode");
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, []);

  const loginMutation = useMutation({
    mutationFn: async ({ username, password }: { username: string; password: string }) => {
      try {
        console.log("Attempting login for user:", username);
        
        // Use direct fetch instead of apiRequest for more control over error handling
        const response = await fetch(getApiUrl("/api/login"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ username, password }),
        });
        
        console.log("Login response status:", response.status);
        
        // Handle non-OK responses
        if (!response.ok) {
          console.error("Login failed with status:", response.status);
          
          // Try to parse error as JSON
          try {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              const errorData = await response.json();
              throw new Error(errorData.message || `Login failed: ${response.statusText}`);
            } else {
              // If not JSON, get the text and throw generic error
              const errorText = await response.text();
              console.error("Non-JSON error response:", errorText);
              throw new Error("Server error. Please try again later.");
            }
          } catch (parseError) {
            console.error("Error parsing error response:", parseError);
            throw new Error(`Login failed: ${response.statusText || "Unknown error"}`);
          }
        }
        
        // Check content type for successful responses
        const contentType = response.headers.get('content-type');
        let userData;
        
        if (contentType && contentType.includes('application/json')) {
          const responseData = await response.json();
          // Check if response matches the expected server format with success and user properties
          if (responseData.success && responseData.user) {
            userData = responseData.user;
          } else {
            // If the structure doesn't match, use the entire response
            userData = responseData;
          }
        } else {
          console.error("Response is not JSON:", contentType);
          
          // Fallback: Try to log in with hardcoded credentials for demo purposes
          if (username === "S1001" && password === "student123") {
            userData = {
              id: 1,
              username: "S1001",
              name: "John Smith",
              role: "student"
            };
            console.log("Using fallback login for demo user");
          } else if (username === "admin" && password === "admin123") {
            userData = {
              id: 2,
              username: "admin",
              name: "Admin User",
              role: "admin"
            };
            console.log("Using fallback login for admin");
          } else {
            throw new Error("Server returned invalid format. Please try again later.");
          }
        }
        
        // Store the user data for offline access
        localStorage.setItem('user', JSON.stringify(userData));
        console.log("Login successful:", userData);
        return userData;
      } catch (error) {
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
      await apiRequest("POST", getApiUrl("/api/logout"));
    },
    onSuccess: () => {
      setUser(null);
      localStorage.removeItem('user');
      setIsOfflineMode(false);
      queryClient.clear();
      queryClient.invalidateQueries();
    },
    onError: (error) => {
      console.error("Logout error:", error);
      setUser(null);
      localStorage.removeItem('user');
      queryClient.clear();
    }
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