import { Switch, Route, useLocation } from "wouter";
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
import { useEffect } from "react";
import { Bot, Loader2 } from "lucide-react";

function Router() {
  const { user, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  // First useEffect: Handle authentication redirects
  useEffect(() => {
    console.log("Auth state:", { user, isLoading, location });
    
    if (!isLoading) {
      // Cases where we need to stay on the login page, not redirect
      const isLoginPage = location === "/" || location === "/login" || location === "/register";
      
      if (!user && !isLoginPage) {
        // If not logged in and not on login page, redirect to login
        console.log("User not authenticated, redirecting to login page");
        window.location.href = "/";
      } else if (user && isLoginPage) {
        // If logged in and on login page, redirect to appropriate dashboard
        console.log("User authenticated, redirecting to dashboard");
        if (user.role === "admin") {
          window.location.href = "/admin";
        } else {
          window.location.href = "/student";
        }
      } else if (
        (user && user.role === "admin" && location.startsWith("/student")) ||
        (user && user.role === "student" && location.startsWith("/admin"))
      ) {
        // Prevent accessing wrong dashboard based on role
        console.log("User tried to access restricted dashboard");
        if (user.role === "admin") {
          window.location.href = "/admin";
        } else {
          window.location.href = "/student";
        }
      }
    }
  }, [user, isLoading, location]);

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
  return (
    <Switch>
      {/* Handle exact admin route */}
      <Route path="/admin">
        {(params) => user && user.role === "admin" ? <AdminDashboard /> : <Login />}
      </Route>
      {/* Handle admin subroutes like /admin/something */}
      <Route path="/admin/:tab">
        {(params) => user && user.role === "admin" ? <AdminDashboard /> : <Login />}
      </Route>
      {/* Handle exact student route */}
      <Route path="/student">
        {(params) => user && user.role === "student" ? <StudentDashboard /> : <Login />}
      </Route>
      {/* Handle student subroutes like /student/something */}
      <Route path="/student/:tab">
        {(params) => user && user.role === "student" ? <StudentDashboard /> : <Login />}
      </Route>
      <Route path="/:rest*">
        {(params) => <NotFound />}
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark">
        <AuthProvider>
          <Router />
          <Toaster />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
