import { useEffect, useState } from "react";
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
import StudentScanner from "@/pages/student/scanner";
import StudentAttendance from "@/pages/student/attendance";
import { Bot, Loader2 } from "lucide-react";

// Simple custom hook for hash-based routing
function useHashRouter() {
  // Store current route in state
  const [currentRoute, setCurrentRoute] = useState('/');
  
  // Update state when hash changes
  useEffect(() => {
    // Function to handle hash changes
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '') || '/';
      setCurrentRoute(hash);
    };
    
    // Set initial route based on hash
    handleHashChange();
    
    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);
  
  // Navigation function
  const navigate = (to: string) => {
    window.location.hash = to;
  };
  
  return { currentRoute, navigate };
}

function RouterContent() {
  const { user, isLoading } = useAuth();
  const { currentRoute, navigate } = useHashRouter();

  // Handle authentication redirects
  useEffect(() => {
    console.log("Auth state:", { user, isLoading, currentRoute });
    
    if (!isLoading) {
      // Cases where we need to stay on the login page, not redirect
      const isLoginPage = currentRoute === "/" || currentRoute === "/login" || currentRoute === "/register";
      
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
        (user && user.role === "admin" && currentRoute.startsWith("/student")) ||
        (user && user.role === "student" && currentRoute.startsWith("/admin"))
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
  }, [user, isLoading, currentRoute, navigate]);

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
  const isLoginPage = currentRoute === "/" || currentRoute === "/login" || currentRoute === "/register";
  
  // Special case for the root path (login page)
  if (isLoginPage) {
    return <Login />;
  }

  // For protected routes, enforce user authentication
  if (currentRoute.startsWith("/admin")) {
    return user && user.role === "admin" ? <AdminDashboard /> : <Login />;
  } else if (currentRoute.startsWith("/student/scan")) {
    return user && user.role === "student" ? <StudentScanner autoStart={true} /> : <Login />;
  } else if (currentRoute.startsWith("/student/attendance")) {
    return user && user.role === "student" ? <StudentAttendance /> : <Login />;
  } else if (currentRoute.startsWith("/student")) {
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
          <RouterContent />
          <Toaster />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
