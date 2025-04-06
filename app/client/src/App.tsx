import { useEffect } from "react";
import { Router, Route, useLocation } from "wouter";
import { motion } from "framer-motion";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { useAuth, AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/components/ui/theme-toggle";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import AdminDashboard from "@/pages/admin-dashboard";
import StudentDashboard from "@/pages/student-dashboard";
import { Bot, Loader2 } from "lucide-react";

// Create hash-based history for better compatibility with static hosting
const hashBase = (path: string) => {
  // We want to use hash routing, so all paths are prefixed with #
  if (typeof window !== 'undefined') {
    const hashPath = window.location.hash.replace('#', '') || '/';
    console.log("Current hash path:", hashPath, "vs path:", path);
    return hashPath === path;
  }
  return false;
};

// Custom hook for hash-based navigation
const useHashLocation = () => {
  const [location, setLocation] = useLocation();
  
  // Update the hash when location changes
  useEffect(() => {
    const updateHash = () => {
      const hash = window.location.hash.replace('#', '') || '/';
      if (hash !== location) {
        setLocation(hash);
      }
    };
    
    // Set initial hash
    if (location !== '/' || !window.location.hash) {
      window.location.hash = location;
    }
    
    // Listen for hash changes
    window.addEventListener('hashchange', updateHash);
    return () => window.removeEventListener('hashchange', updateHash);
  }, [location, setLocation]);
  
  // Custom navigation function that updates the hash
  const navigate = (to: string) => {
    window.location.hash = to;
  };
  
  return [location, navigate];
};

function RouterContent() {
  const { user, isLoading } = useAuth();
  const [location, navigate] = useHashLocation();

  // Handle authentication redirects
  useEffect(() => {
    console.log("Auth state:", { user, isLoading, location });
    
    if (!isLoading) {
      // Cases where we need to stay on the login page, not redirect
      const isLoginPage = location === "/" || location === "/login" || location === "/register";
      
      if (!user && !isLoginPage) {
        // If not logged in and not on login page, redirect to login
        console.log("User not authenticated, redirecting to login page");
        navigate("/");
      } else if (user && isLoginPage) {
        // If logged in and on login page, redirect to appropriate dashboard
        console.log("User authenticated, redirecting to dashboard");
        if (user.role === "admin") {
          navigate("/admin");
        } else {
          navigate("/student");
        }
      } else if (
        (user && user.role === "admin" && location.startsWith("/student")) ||
        (user && user.role === "student" && location.startsWith("/admin"))
      ) {
        // Prevent accessing wrong dashboard based on role
        console.log("User tried to access restricted dashboard");
        if (user.role === "admin") {
          navigate("/admin");
        } else {
          navigate("/student");
        }
      }
    }
  }, [user, isLoading, location, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background to-background/90 dark:from-background dark:to-slate-900">
        <div className="relative">
          <motion.div 
            className="rounded-full bg-gradient-to-br from-neon-blue to-neon-purple p-6 shadow-neon-sm"
            animate={{ 
              scale: [1, 1.1, 1],
              boxShadow: [
                "0 0 10px rgba(var(--primary-rgb), 0.7)",
                "0 0 20px rgba(var(--primary-rgb), 0.9)",
                "0 0 10px rgba(var(--primary-rgb), 0.7)"
              ]
            }}
            transition={{ 
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <Bot className="h-12 w-12 text-white" />
          </motion.div>
          <motion.div 
            className="absolute -inset-4 rounded-full border-t-2 border-l-2 border-neon-blue/30 border-r-2 border-b-2 border-transparent"
            animate={{ rotate: 360 }}
            transition={{ 
              duration: 3, 
              repeat: Infinity, 
              ease: "linear" 
            }}
          />
        </div>
        <motion.p 
          className="mt-8 text-lg font-medium text-foreground/70"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          Loading...
        </motion.p>
      </div>
    );
  }

  // Check for login-related paths
  const isLoginPage = location === "/" || location === "/login" || location === "/register";
  
  // Special case for the root path (login page)
  if (isLoginPage) {
    return <Login />;
  }

  // For protected routes, enforce user authentication
  if (location.startsWith("/admin")) {
    return user && user.role === "admin" ? <AdminDashboard /> : <Login />;
  } else if (location.startsWith("/student")) {
    return user && user.role === "student" ? <StudentDashboard /> : <Login />;
  } else {
    return <NotFound />;
  }
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark">
        <AuthProvider>
          <Router hook={useHashLocation}>
            <RouterContent />
          </Router>
          <Toaster />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
