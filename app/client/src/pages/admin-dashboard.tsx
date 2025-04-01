import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlusCircle, Menu, Bell, Search, User, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";
import Sidebar from "@/components/admin/sidebar";
import DashboardHome from "@/pages/admin/dashboard-home";
import QRGenerator from "@/pages/admin/qr-generator";
import Attendance from "@/pages/admin/attendance";
import Students from "@/pages/admin/students";
import Reports from "@/pages/admin/reports";
import QRTest from "@/pages/admin/qr-test";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/theme-toggle";

type Attendance = {id: number};

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("home");
  const [isCreateSessionOpen, setIsCreateSessionOpen] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const sidebarRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [showUserMenu, setShowUserMenu] = useState(false);

  const { data: sessions } = useQuery({
    queryKey: ['sessions'],
    queryFn: async () => {
      const response = await fetch('/api/sessions');
      return response.json();
    }
  });

  const { data: attendance } = useQuery({
    queryKey: ['attendance'],
    queryFn: async () => {
      const response = await fetch('/api/attendance');
      return response.json();
    }
  });

  const [sessionDate, setSessionDate] = useState('');
  const [sessionTime, setSessionTime] = useState('');

  const createSession = async () => {
    if (!sessionName || !sessionDate || !sessionTime) {
      alert('Please fill in all fields');
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('sessions')
        .insert([{ 
          name: sessionName,
          date: sessionDate,
          time: sessionTime,
          is_active: true
        }]);
      if (error) throw error;
      console.log("Session created:", data);
      setIsCreateSessionOpen(false);
      setSessionName('');
      setSessionDate('');
      setSessionTime('');
    } catch (error) {
      console.error("Error creating session:", error);
      alert('Failed to create session');
    }
  };

  const refetchSessions = () => {
    if (sessions && typeof sessions.refetch === 'function') {
      sessions.refetch();
    } else {
      console.warn("Cannot refetch sessions: sessions object is undefined or missing refetch method");
    }
  };

  const refetchAttendance = () => {
    if (attendance && typeof attendance.refetch === 'function') {
      attendance.refetch();
    } else {
      console.warn("Cannot refetch attendance: attendance object is undefined or missing refetch method");
    }
  };

  useEffect(() => {
    const subscription = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        if (payload.table === 'sessions') {
          refetchSessions();
        }
        if (payload.table === 'attendance') {
          refetchAttendance();
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setLocation("/");
    } else if (user.role !== "admin") {
      setLocation("/student");
    }
  }, [user, setLocation]);

  useEffect(() => {
    const path = location.split("/")[2] || "home";
    setActiveTab(path);
  }, [location]);

  // Close sidebar and dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sidebarOpen && 
          sidebarRef.current && 
          !sidebarRef.current.contains(event.target as Node) &&
          headerRef.current &&
          !headerRef.current.contains(event.target as Node)) {
        setSidebarOpen(false);
      }
      
      // Close notifications dropdown when clicking outside
      if (showNotifications && !(event.target as Element).closest('.notifications-dropdown')) {
        setShowNotifications(false);
      }
      
      // Close user menu dropdown when clicking outside
      if (showUserMenu && !(event.target as Element).closest('.user-menu-dropdown')) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [sidebarOpen, showNotifications, showUserMenu]);

  // Toggle function for sidebar
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
    console.log("Toggle sidebar clicked, new state:", !sidebarOpen);
  };

  if (!user) {
    return null;
  }

  const notifications = [
    { id: 1, title: "New student registered", time: "5 minutes ago" },
    { id: 2, title: "Session completed", time: "1 hour ago" },
    { id: 3, title: "System update available", time: "2 days ago" },
  ];

  return (
    <div className="flex h-screen bg-background">
      {/* Backdrop overlay for all screen sizes when sidebar is open */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 z-20 transition-opacity"
          />
        )}
      </AnimatePresence>

      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} activeTab={activeTab} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <header 
          ref={headerRef} 
          className="sticky top-0 z-30 w-full border-b border-border/20 bg-background/80 backdrop-blur-md"
        >
          <div className="container flex h-16 items-center justify-between mx-auto px-4 max-w-7xl">
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={toggleSidebar}
                aria-label="Toggle Menu"
                className="rounded-full hover:bg-foreground/5"
              >
                <Menu className="h-5 w-5 text-foreground/70" />
              </Button>
              <h1 className="text-xl font-display font-semibold hidden md:block">Robotics Club</h1>
            </div>
            
            <div className="flex-1 max-w-md mx-4 hidden md:block">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-foreground/50" />
                <Input 
                  type="text"
                  placeholder="Search..."
                  className="w-full pl-10 pr-4 h-10 rounded-full bg-foreground/5 border-0 focus-visible:ring-1 focus-visible:ring-neon-blue/40 transition-all"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                />
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Notifications Button */}
              <div className="relative notifications-dropdown">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="rounded-full hover:bg-foreground/5"
                  onClick={() => setShowNotifications(!showNotifications)}
                >
                  <Bell className="h-5 w-5 text-foreground/70" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-neon-purple rounded-full"></span>
                </Button>
                
                {/* Notifications Dropdown */}
                <AnimatePresence>
                  {showNotifications && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-72 rounded-lg shadow-lg bg-background border border-border/30 py-2 z-50"
                    >
                      <div className="px-4 py-2 border-b border-border/20">
                        <h3 className="font-medium">Notifications</h3>
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {notifications.map(notification => (
                          <div 
                            key={notification.id} 
                            className="px-4 py-2 hover:bg-foreground/5 transition-colors"
                          >
                            <p className="text-sm">{notification.title}</p>
                            <p className="text-xs text-foreground/50 mt-1">{notification.time}</p>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              
              {/* Theme Toggle */}
              <ThemeToggle />
              
              {/* Create Session Button */}
              <Dialog open={isCreateSessionOpen} onOpenChange={setIsCreateSessionOpen}>
                <DialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="hidden md:flex items-center gap-1 rounded-full bg-foreground/5 hover:bg-foreground/10 border-0 text-sm font-medium"
                  >
                    <PlusCircle className="h-4 w-4 mr-1" />
                    New Session
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md bg-background/90 backdrop-blur-md border border-border/30">
                  <DialogHeader>
                    <DialogTitle className="text-center text-xl font-display">Create New Session</DialogTitle>
                  </DialogHeader>
                  <motion.div 
                    className="grid gap-4 py-4"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    <div className="space-y-2">
                      <Label htmlFor="session-name" className="text-foreground/70">Session Name</Label>
                      <Input 
                        id="session-name" 
                        placeholder="Enter session name" 
                        value={sessionName} 
                        onChange={(e) => setSessionName(e.target.value)} 
                        className="input-glow bg-background/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="session-date" className="text-foreground/70">Date</Label>
                      <Input 
                        id="session-date" 
                        type="date" 
                        value={sessionDate} 
                        onChange={(e) => setSessionDate(e.target.value)} 
                        className="input-glow bg-background/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="session-time" className="text-foreground/70">Time</Label>
                      <Input 
                        id="session-time" 
                        type="time" 
                        value={sessionTime} 
                        onChange={(e) => setSessionTime(e.target.value)} 
                        className="input-glow bg-background/50"
                      />
                    </div>
                  </motion.div>
                  <Button 
                    onClick={createSession} 
                    className="w-full bg-gradient-to-r from-neon-blue to-neon-purple text-white hover:from-neon-purple hover:to-neon-blue transition-all duration-300"
                  >
                    Create Session
                  </Button>
                </DialogContent>
              </Dialog>
              
              {/* User Menu Button */}
              <div className="relative user-menu-dropdown">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="rounded-full hover:bg-foreground/5"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                >
                  <User className="h-5 w-5 text-foreground/70" />
                </Button>
                
                {/* User Menu Dropdown */}
                <AnimatePresence>
                  {showUserMenu && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-48 rounded-lg shadow-lg bg-background border border-border/30 py-2 z-50"
                    >
                      <div className="px-4 py-2 border-b border-border/20">
                        <p className="font-medium">Admin</p>
                        <p className="text-xs text-foreground/50">admin@example.com</p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="w-full justify-start px-4 py-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={logout}
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </header>
        
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
          {activeTab === "home" && <DashboardHome />}
          {activeTab === "qr-generator" && <QRGenerator />}
          {activeTab === "qr-test" && <QRTest />}
          {activeTab === "attendance" && <Attendance />}
          {activeTab === "students" && <Students />}
          {activeTab === "reports" && <Reports />}
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  );
}