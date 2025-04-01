import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Switch, Route, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import StudentHeader from "@/components/student/header";
import StudentHome from "@/pages/student/home";
import StudentScanner from "@/pages/student/scanner";
import StudentAttendance from "@/pages/student/attendance";
import { Home, QrCode, ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export default function StudentDashboard() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [location] = useLocation();
  const [activeTab, setActiveTab] = useState("home");

  // Handle tab change based on location
  useEffect(() => {
    const path = location.split("/")[2] || "home";
    if (path !== activeTab) {
      setActiveTab(path);
    }
  }, [location, activeTab]);

  // Redirect based on user role
  useEffect(() => {
    if (!user) {
      setLocation("/");
    } else if (user.role !== "student") {
      setLocation("/admin");
    }
  }, [user, setLocation]);

  const handleTabChange = (value: string) => {
    if (value !== activeTab) {
      setActiveTab(value);
      setLocation(value === "home" ? "/student" : `/student/${value}`);
    }
  };

  if (!user || user.role !== "student") {
    return null;
  }

  const tabItems = [
    { id: "home", label: "Home", icon: <Home className="h-5 w-5" /> },
    { id: "scanner", label: "Scan QR", icon: <QrCode className="h-5 w-5" /> },
    { id: "attendance", label: "My Attendance", icon: <ClipboardCheck className="h-5 w-5" /> },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-background">
      {/* Header */}
      <StudentHeader user={user} onLogout={logout} />

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="h-full overflow-y-auto"
          >
            <Switch>
              <Route path="/student" component={StudentHome} />
              <Route path="/student/scanner">
                {/* Auto-start scanner without a button */}
                <StudentScanner autoStart={true} />
              </Route>
              <Route path="/student/attendance" component={StudentAttendance} />
              <Route path="/student/*">
                <StudentHome />
              </Route>
            </Switch>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <div className="sticky bottom-0 z-10 border-t border-border/20 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-3 h-16">
            {tabItems.map((item) => (
              <button
                key={item.id}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 text-sm relative",
                  activeTab === item.id 
                    ? "text-accent" 
                    : "text-foreground/60 hover:text-foreground/80"
                )}
                onClick={() => handleTabChange(item.id)}
              >
                <div className={cn(
                  "transition-all duration-200",
                  activeTab === item.id && "scale-110"
                )}>
                  {item.icon}
                </div>
                <span className="text-xs font-medium">{item.label}</span>
                
                {/* Active indicator */}
                {activeTab === item.id && (
                  <motion.div 
                    layoutId="activeTabIndicator"
                    className="absolute bottom-0 h-1 w-12 rounded-t-full bg-gradient-to-r from-neon-blue to-neon-purple"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
