import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { SimpleLink } from "@/components/ui/simple-link";
import { Button } from "@/components/ui/button";
import { Home, QrCode, ClipboardCheck, BellRing, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import StudentHome from "./student/home";
import StudentAttendance from "./student/attendance";

export default function StudentDashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("home");

  // Detect current section from URL hash
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash.includes('/student/scan')) {
      setActiveTab('scanner');
    } else if (hash.includes('/student/attendance')) {
      setActiveTab('attendance');
    } else {
      setActiveTab('home');
    }

    // Set up hash change listener
    const handleHashChange = () => {
      const newHash = window.location.hash.replace('#', '');
      if (newHash.includes('/student/scan')) {
        setActiveTab('scanner');
      } else if (newHash.includes('/student/attendance')) {
        setActiveTab('attendance');
      } else if (newHash.includes('/student')) {
        setActiveTab('home');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Navigation items
  const navigationItems = [
    { id: "home", label: "Home", icon: <Home className="h-5 w-5" />, path: "/student" },
    { id: "scanner", label: "Scan QR", icon: <QrCode className="h-5 w-5" />, path: "/student/scan" },
    { id: "attendance", label: "My Attendance", icon: <ClipboardCheck className="h-5 w-5" />, path: "/student/attendance" },
  ];

  const handleLogout = async () => {
    try {
      await logout();
      window.location.hash = '/';
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white dark:bg-background border-b border-border/30">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center">
            <BellRing className="h-5 w-5 text-primary mr-2" />
            <h1 className="text-lg font-semibold">Robotics Club</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {user?.name || user?.username || "Student"}
            </span>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={handleLogout}
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="h-full overflow-y-auto pb-20"
          >
            {activeTab === "home" && <StudentHome />}
            {activeTab === "attendance" && <StudentAttendance />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-border/20 bg-background/80 backdrop-blur-md z-50">
        <div className="container mx-auto max-w-lg">
          <div className="grid grid-cols-3 h-16">
            {navigationItems.map((item) => (
              <SimpleLink to={item.path} key={item.id} className="flex flex-col items-center justify-center">
                <button
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 text-sm w-full h-full",
                    activeTab === item.id 
                      ? "text-primary" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
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
                      className="absolute bottom-0 h-1 w-12 rounded-t-full bg-primary"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                </button>
              </SimpleLink>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
