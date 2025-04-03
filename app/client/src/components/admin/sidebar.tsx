import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { 
  LayoutDashboard, 
  QrCode, 
  ClipboardCheck, 
  Users, 
  FileText,
  X,
  TestTube,
  BookOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  activeTab: string;
}

interface ActiveSession {
  id: string;
  name: string;
  expires_at: string;
  is_active: boolean;
}

export default function Sidebar({ isOpen, setIsOpen, activeTab }: SidebarProps) {
  const [location] = useLocation();

  // Fetch active session data
  const { data: activeSession, isLoading } = useQuery<ActiveSession>({
    queryKey: ['activeSession'],
    queryFn: async () => {
      try {
        const response = await axios.get('/api/sessions/active');
        console.log('Active session data (sidebar):', response.data);
        return response.data;
      } catch (error) {
        console.error('Error fetching active session:', error);
        return null;
      }
    },
    refetchInterval: 60000, // Refetch every minute
  });

  // Calculate time remaining for active session
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  useEffect(() => {
    if (!activeSession?.expires_at) return;

    const calculateTimeRemaining = () => {
      const expiresAt = new Date(activeSession.expires_at);
      const now = new Date();
      const diffMs = expiresAt.getTime() - now.getTime();
      
      if (diffMs <= 0) return 'Ended';
      
      const diffMinutes = Math.floor(diffMs / 60000);
      if (diffMinutes < 60) {
        return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''}`;
      } else {
        const hours = Math.floor(diffMinutes / 60);
        const minutes = diffMinutes % 60;
        return `${hours} hour${hours !== 1 ? 's' : ''} ${minutes > 0 ? `${minutes} min` : ''}`;
      }
    };

    setTimeRemaining(calculateTimeRemaining());
    
    const interval = setInterval(() => {
      setTimeRemaining(calculateTimeRemaining());
    }, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, [activeSession]);

  // Log state changes for debugging
  useEffect(() => {
    console.log("Sidebar isOpen state changed:", isOpen);
  }, [isOpen]);

  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (isOpen && event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleEscKey);
    return () => {
      window.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, setIsOpen]);

  const isActive = (path: string) => {
    if (path === "/admin" && location === "/admin") {
      return true;
    }
    return location.startsWith(path) && path !== "/admin";
  };

  const navItems = [
    { path: "/admin", label: "Dashboard", icon: <LayoutDashboard className="h-5 w-5" /> },
    { path: "/admin/qr-generator", label: "QR Generator", icon: <QrCode className="h-5 w-5" /> },
    { path: "/admin/attendance", label: "Attendance", icon: <ClipboardCheck className="h-5 w-5" /> },
    { path: "/admin/students", label: "Students", icon: <Users className="h-5 w-5" /> },
    { path: "/admin/reports", label: "Reports", icon: <FileText className="h-5 w-5" /> },
  ];

  const sidebarVariants = {
    open: { 
      x: 0,
      transition: { 
        type: "spring", 
        stiffness: 300, 
        damping: 30,
        staggerChildren: 0.05,
        delayChildren: 0.1
      } 
    },
    closed: { 
      x: "-100%",
      transition: { 
        type: "spring", 
        stiffness: 300, 
        damping: 30,
        staggerChildren: 0.05,
        staggerDirection: -1
      }  
    }
  };

  const itemVariants = {
    open: { 
      x: 0, 
      opacity: 1,
      transition: { type: "spring", stiffness: 300, damping: 30 }
    },
    closed: { 
      x: -20, 
      opacity: 0,
      transition: { type: "spring", stiffness: 300, damping: 30 }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside 
          initial="closed"
          animate="open"
          exit="closed"
          variants={sidebarVariants}
          className={cn(
            "fixed left-0 top-0 bottom-0 z-40 w-[280px]",
            "border-r border-border/30 bg-background/95 backdrop-blur-md",
            "shadow-lg",
            "lg:w-64"
          )}
        >
          <div className="flex h-16 items-center justify-between border-b border-border/30 px-6">
            <motion.span 
              className="font-display text-xl bg-clip-text text-transparent bg-gradient-to-r from-neon-blue to-neon-purple"
              variants={itemVariants}
            >
              Robotics
            </motion.span>
            <motion.div variants={itemVariants}>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full hover:bg-foreground/5 transition-colors duration-200"
                onClick={() => setIsOpen(false)}
                aria-label="Close Sidebar"
              >
                <X className="h-5 w-5 text-foreground/70" />
              </Button>
            </motion.div>
          </div>
          
          <nav className="space-y-1 p-4">
            {navItems.map((item) => (
              <motion.div key={item.path} variants={itemVariants}>
                <Link 
                  href={item.path} 
                  onClick={() => {
                    if (window.innerWidth < 1024) {
                      setIsOpen(false);
                    }
                  }}
                >
                  <div
                    className={cn(
                      "relative group flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 cursor-pointer",
                      isActive(item.path) 
                        ? "bg-accent/10 text-accent font-medium" 
                        : "text-foreground/70 hover:bg-foreground/5"
                    )}
                  >
                    {/* Active indicator */}
                    {isActive(item.path) && (
                      <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-1 h-6 bg-gradient-to-b from-neon-blue to-neon-purple rounded-r-full" />
                    )}
                    
                    <div className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-md transition-colors",
                      isActive(item.path) 
                        ? "text-accent" 
                        : "text-foreground/50 group-hover:text-foreground/80"
                    )}>
                      {item.icon}
                    </div>
                    <span className="text-base">{item.label}</span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </nav>
          
          <motion.div 
            variants={itemVariants}
            className="absolute bottom-8 left-0 right-0 px-4"
          >
            <div className="p-4 rounded-lg bg-foreground/5 border border-border/30">
              <p className="text-xs text-foreground/50 mb-2">Active Session</p>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <p className="text-sm font-medium">{activeSession?.name || 'Loading...'}</p>
              </div>
              <p className="text-xs text-foreground/50 mt-2">Ends in {timeRemaining || 'Loading...'}</p>
            </div>
          </motion.div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
