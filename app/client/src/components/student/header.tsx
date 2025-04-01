import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, User, Bot, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { User as UserType } from "@/lib/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface HeaderProps {
  user: UserType;
  onLogout: () => Promise<void>;
}

export default function StudentHeader({ user, onLogout }: HeaderProps) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // Mock notifications for UI example
  const notifications = [
    { id: 1, title: "Attendance recorded", time: "5 minutes ago" },
    { id: 2, title: "New session scheduled", time: "2 hours ago" },
    { id: 3, title: "Reminder: Club meeting", time: "1 day ago" },
  ];

  return (
    <header className="sticky top-0 z-30 w-full border-b border-border/20 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center">
          <motion.div 
            whileHover={{ scale: 1.05 }} 
            whileTap={{ scale: 0.95 }}
            className="rounded-full bg-gradient-to-br from-neon-blue to-neon-purple p-2 mr-3 shadow-neon-sm"
          >
            <Bot className="h-5 w-5 text-white" />
          </motion.div>
          <h1 className="text-xl font-display font-semibold">Robotics Club</h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Notifications */}
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
                        className="px-4 py-3 hover:bg-foreground/5 transition-colors cursor-pointer border-b border-border/10 last:border-0"
                      >
                        <p className="text-sm font-medium">{notification.title}</p>
                        <p className="text-xs text-foreground/50 mt-1">{notification.time}</p>
                      </div>
                    ))}
                  </div>
                  <div className="px-4 py-2 border-t border-border/20">
                    <Button variant="ghost" size="sm" className="w-full text-xs">View all notifications</Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Theme Toggle */}
          <ThemeToggle />
          
          {/* User Menu */}
          <div className="relative user-menu-dropdown">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="rounded-full hover:bg-foreground/5 flex items-center gap-2"
            >
              <Avatar className="h-8 w-8 border border-border/50">
                <AvatarFallback className="bg-gradient-to-br from-neon-blue/20 to-neon-purple/20 text-foreground">
                  {user.name?.charAt(0) || "S"}
                </AvatarFallback>
              </Avatar>
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
                  <div className="px-4 py-3 border-b border-border/20">
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs text-foreground/50 mt-1">ID: {user.username}</p>
                  </div>
                  <div className="py-1">
                    <Button 
                      variant="ghost" 
                      className="w-full justify-start text-sm px-4 py-2 h-auto"
                      onClick={onLogout}
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Logout
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}
