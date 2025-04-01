import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { User, CalendarDays, BarChart, Check, Calendar, Info, AlertCircle, QrCode } from "lucide-react";
import { format } from "date-fns";
import { getActiveSession } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function StudentHome() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [currentDate, setCurrentDate] = useState<string>("");
  const [activeSession, setActiveSession] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCurrentDate(format(new Date(), "EEEE, MMMM d, yyyy"));
  }, []);

  // Direct fetch for active session
  useEffect(() => {
    const fetchActiveSession = async () => {
      setLoading(true);
      try {
        const data = await getActiveSession();
        console.log("Active session fetched:", data);
        
        // Process and format the session data
        if (data) {
          // Format the data for display
          const formattedSession = {
            ...data,
            time: data.time || (data.created_at ? new Date(data.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''),
            date: data.date || (data.created_at ? new Date(data.created_at).toLocaleDateString() : ''),
            duration: data.duration || '60'
          };
          setActiveSession(formattedSession);
        } else {
          setActiveSession(null);
        }
        
        setError(null);
      } catch (err: any) {
        console.error("Error fetching active session:", err);
        setError(err.message || "Failed to fetch active session");
        setActiveSession(null);
      } finally {
        setLoading(false);
      }
    };

    fetchActiveSession();
    
    // Set up polling for active session every 30 seconds
    const intervalId = setInterval(fetchActiveSession, 30000);
    
    return () => clearInterval(intervalId);
  }, []);

  // Fetch student's attendance records
  const { data: attendanceRecords } = useQuery({
    queryKey: ['/api/attendance/me'],
  });

  // Calculate attendance rate
  const totalSessions = attendanceRecords?.length || 0;
  const presentSessions = attendanceRecords?.filter((record: any) => record.status === "present")?.length || 0;
  const attendanceRate = totalSessions > 0 ? Math.round((presentSessions / totalSessions) * 100) : 0;

  // Check if student is checked in for the active session
  const isCheckedIn = attendanceRecords?.some(
    (record: any) => record.sessionId === activeSession?.id
  );

  // Get upcoming sessions (using next 3 sessions from the sessions list)
  const { data: allSessions } = useQuery({
    queryKey: ['/api/sessions'],
  });

  // In a real app, we would filter for future sessions
  // For this demo, we'll just use the first few sessions
  const upcomingSessions = allSessions?.slice(0, 3) || [];

  const goToScanner = () => {
    setLocation("/student/scanner");
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1,
      transition: { type: "spring", stiffness: 300, damping: 30 }
    }
  };

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="container mx-auto px-4 py-8 space-y-6"
    >
      {/* Welcome Banner */}
      <motion.div variants={itemVariants}>
        <Card className="glass-card border-border/30 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-neon-blue/20 to-neon-purple/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 z-0"></div>
          <CardContent className="pt-6 pb-6 relative z-10">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-gradient-to-br from-neon-blue/20 to-neon-purple/20 p-4 shrink-0">
                <User className="h-6 w-6 text-accent" />
              </div>
              <div>
                <h2 className="text-2xl font-display font-semibold bg-clip-text text-transparent bg-gradient-to-r from-neon-blue to-neon-purple mb-1">
                  Welcome, {user?.name}
                </h2>
                <div className="flex items-center gap-4">
                  <p className="text-foreground/70">{currentDate}</p>
                  <Badge variant="outline" className="bg-background/50 text-xs font-normal">
                    ID: {user?.username}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Active Session */}
        <motion.div variants={itemVariants}>
          <Card className="border-border/30 h-full overflow-hidden relative">
            <CardContent className="pt-6 h-full">
              <h3 className="text-lg font-display font-semibold mb-4 flex items-center text-foreground/90">
                <CalendarDays className="mr-2 h-5 w-5 text-accent" />
                Active Session
              </h3>
              {activeSession ? (
                <div className="h-full flex flex-col">
                  {isCheckedIn ? (
                    <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-md mb-4 flex items-start">
                      <Check className="h-5 w-5 mr-2 text-green-500" />
                      <div>
                        <p className="font-medium text-green-500">You are checked in!</p>
                        <p className="text-sm text-foreground/70">
                          {activeSession.name} • {activeSession.time}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-accent/10 border border-accent/20 p-4 rounded-md mb-4">
                      <div className="flex items-start mb-3">
                        <AlertCircle className="h-5 w-5 mr-2 text-accent" />
                        <div>
                          <p className="font-medium text-accent">Attendance needed!</p>
                          <p className="text-sm text-foreground/70">
                            Mark your attendance for the active session.
                          </p>
                        </div>
                      </div>
                      <Button 
                        className="w-full bg-gradient-to-r from-neon-blue to-neon-purple hover:from-neon-purple hover:to-neon-blue text-white transition-all duration-300 transform hover:scale-[1.02]"
                        onClick={goToScanner}
                      >
                        <QrCode className="h-4 w-4 mr-2" />
                        Scan QR Code
                      </Button>
                    </div>
                  )}
                  <div className="p-4 rounded-md bg-background/50 border border-border/30">
                    <p className="font-medium text-lg">{activeSession.name}</p>
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      <div className="text-center p-2 rounded-md bg-background/80">
                        <p className="text-xs text-foreground/50">Date</p>
                        <p className="text-sm font-medium">{activeSession.date}</p>
                      </div>
                      <div className="text-center p-2 rounded-md bg-background/80">
                        <p className="text-xs text-foreground/50">Time</p>
                        <p className="text-sm font-medium">{activeSession.time}</p>
                      </div>
                      <div className="text-center p-2 rounded-md bg-background/80">
                        <p className="text-xs text-foreground/50">Duration</p>
                        <p className="text-sm font-medium">{activeSession.duration} min</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center py-8 px-4 text-center">
                  <div className="w-16 h-16 rounded-full bg-foreground/5 flex items-center justify-center mb-4">
                    <Calendar className="h-8 w-8 text-foreground/30" />
                  </div>
                  <p className="text-lg font-medium text-foreground/70 mb-1">
                    {error || "No active sessions"}
                  </p>
                  <p className="text-foreground/50 max-w-xs mx-auto">
                    {!error && "There are no active sessions at the moment. Check back later."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Attendance Summary */}
        <motion.div variants={itemVariants}>
          <Card className="border-border/30 h-full">
            <CardContent className="pt-6 h-full">
              <h3 className="text-lg font-display font-semibold mb-4 flex items-center text-foreground/90">
                <BarChart className="mr-2 h-5 w-5 text-accent" />
                Attendance Summary
              </h3>
              <div className="h-full flex flex-col">
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-foreground/5 rounded-md p-4 text-center">
                    <p className="text-3xl font-semibold text-foreground mb-1">
                      {totalSessions}
                    </p>
                    <p className="text-sm text-foreground/60">Total Sessions</p>
                  </div>
                  <div className="bg-foreground/5 rounded-md p-4 text-center">
                    <p className="text-3xl font-semibold text-accent mb-1">
                      {attendanceRate}%
                    </p>
                    <p className="text-sm text-foreground/60">Attendance Rate</p>
                  </div>
                </div>
                
                <div className="space-y-4 flex-1">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Present</span>
                      <span className="text-sm font-medium text-foreground/70">{presentSessions} sessions</span>
                    </div>
                    <div className="w-full bg-foreground/10 rounded-full h-2.5 overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${attendanceRate}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="bg-gradient-to-r from-neon-green to-neon-blue h-full rounded-full" 
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Absent</span>
                      <span className="text-sm font-medium text-foreground/70">{totalSessions - presentSessions} sessions</span>
                    </div>
                    <div className="w-full bg-foreground/10 rounded-full h-2.5 overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${totalSessions > 0 ? 100 - attendanceRate : 0}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="bg-gradient-to-r from-neon-pink to-red-500 h-full rounded-full" 
                      />
                    </div>
                  </div>
                  
                  <div className="mt-6 p-4 rounded-md bg-background/50 border border-border/30">
                    <h4 className="text-sm font-medium mb-3">Quick Stats</h4>
                    <div className="flex items-center gap-4 justify-between">
                      <div>
                        <p className="text-xs text-foreground/50">Last Attendance</p>
                        <p className="text-sm font-medium">March 28, 2023</p>
                      </div>
                      <div>
                        <p className="text-xs text-foreground/50">Weekly Average</p>
                        <p className="text-sm font-medium">92%</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Upcoming Sessions */}
      <motion.div variants={itemVariants}>
        <Card className="border-border/30">
          <CardContent className="pt-6">
            <h3 className="text-lg font-display font-semibold mb-4 flex items-center text-foreground/90">
              <Calendar className="mr-2 h-5 w-5 text-accent" />
              Upcoming Sessions
            </h3>
            {upcomingSessions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left py-3 px-4 text-xs font-medium text-foreground/50 border-b border-border/30">Session</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-foreground/50 border-b border-border/30">Date</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-foreground/50 border-b border-border/30">Time</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-foreground/50 border-b border-border/30">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcomingSessions.map((session: any, index: number) => (
                      <tr key={session.id} className={index !== upcomingSessions.length - 1 ? "border-b border-border/10" : ""}>
                        <td className="py-3 px-4 text-sm font-medium">
                          {session.name}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {session.date}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {session.time}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          <Badge variant="outline" className="font-normal">
                            {session.duration} min
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 mx-auto text-foreground/20 mb-3" />
                <p className="text-lg font-medium text-foreground/70 mb-1">
                  No upcoming sessions
                </p>
                <p className="text-foreground/50 max-w-xs mx-auto">
                  No sessions are scheduled at the moment. Check back later.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
