import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { User, CalendarDays, BarChart, Check, Calendar, Info, AlertCircle, QrCode, Clock, Users, CheckCircle2, XCircle } from "lucide-react";
import { format, differenceInMinutes } from "date-fns";
import { getActiveSession } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { SimpleLink } from "@/components/ui/simple-link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink } from "lucide-react";
import { CalendarCheck } from "lucide-react";
import { supabase } from '@/lib/supabase';

// Type for the attendance record
interface AttendanceRecord {
  id: string;
  session_id: string;
  user_id: string;
  timestamp: string;
  status: string;
  session: {
    name: string;
    date: string;
    time: string;
  };
}

// Type for the active session
interface ActiveSession {
  id: string;
  name: string;
  date: string;
  time: string;
  duration: number;
  is_active: boolean;
}

export default function StudentHome() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [currentDate, setCurrentDate] = useState<string>("");
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCheckedIn, setHasCheckedIn] = useState(false);

  useEffect(() => {
    setCurrentDate(format(new Date(), "EEEE, MMMM d, yyyy"));
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        // Fetch active session
        const { data: sessionData, error: sessionError } = await supabase
          .from('sessions')
          .select('*')
          .eq('is_active', true)
          .single();

        if (sessionError && sessionError.code !== 'PGRST116') {
          throw new Error('Failed to fetch active session');
        }

        setActiveSession(sessionData);

        if (sessionData) {
          // Check if user has already checked in for this session
          const { data: attendanceData, error: attendanceError } = await supabase
            .from('attendance')
            .select('*')
            .eq('session_id', sessionData.id)
            .eq('user_id', user?.id)
            .single();

          if (attendanceError && attendanceError.code !== 'PGRST116') {
            throw new Error('Failed to check attendance status');
          }

          setHasCheckedIn(!!attendanceData);
        }

        // Fetch recent attendance records
        const { data: records, error: recordsError } = await supabase
          .from('attendance')
          .select(`
            *,
            session:sessions (
              name,
              date,
              time
            )
          `)
          .eq('user_id', user?.id)
          .order('timestamp', { ascending: false })
          .limit(5);

        if (recordsError) {
          throw new Error('Failed to fetch attendance records');
        }

        setAttendanceRecords(records || []);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      fetchData();
    }
  }, [user]);

  // Format date
  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  // Format time
  const formatTime = (timeString: string) => {
    // If timeString is already in HH:MM format, convert to 12-hour format
    if (timeString.match(/^\d{1,2}:\d{2}$/)) {
      const [hours, minutes] = timeString.split(':').map(Number);
      const period = hours >= 12 ? 'PM' : 'AM';
      const formattedHours = hours % 12 || 12;
      return `${formattedHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    }
    
    // If it's a full ISO date
    try {
      const date = new Date(timeString);
      return date.toLocaleTimeString(undefined, { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    } catch (e) {
      return timeString; // Return as is if parsing fails
    }
  };

  const calculateTimeRemaining = (session: ActiveSession) => {
    const sessionDateTime = new Date(`${session.date}T${session.time}`);
    const endTime = new Date(sessionDateTime.getTime() + session.duration * 60000);
    const now = new Date();
    
    if (now > endTime) return 'Session ended';
    
    const minutesRemaining = differenceInMinutes(endTime, now);
    const hours = Math.floor(minutesRemaining / 60);
    const minutes = minutesRemaining % 60;
    
    return hours > 0 
      ? `${hours}h ${minutes}m remaining`
      : `${minutes}m remaining`;
  };

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

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[200px] w-full" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-destructive">Error: {error}</div>
        </CardContent>
      </Card>
    );
  }

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
            <CardHeader>
              <CardTitle>Active Session</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 h-full">
              {activeSession ? (
                <div className="h-full flex flex-col">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-semibold">{activeSession.name}</h4>
                    <Badge variant={activeSession.is_active ? "default" : "secondary"}>
                      {activeSession.is_active ? "Active" : "Completed"}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2 text-sm text-foreground/70">
                      <Calendar className="h-4 w-4" />
                      <span>{formatDate(activeSession.date)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-foreground/70">
                      <Clock className="h-4 w-4" />
                      <span>{formatTime(activeSession.time)} ({activeSession.duration} mins)</span>
                    </div>
                  </div>
                  
                  {activeSession.is_active && (
                    <div className="mt-4 flex items-center justify-between">
                      <div className="text-sm">
                        <span className="font-medium">Time remaining:</span>{" "}
                        <span className="text-foreground/70">{calculateTimeRemaining(activeSession)}</span>
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">Attendance:</span>{" "}
                        <span className="text-foreground/70">{hasCheckedIn ? "Checked in" : "Not checked in"}</span>
                      </div>
                    </div>
                  )}
                  
                  {hasCheckedIn ? (
                    <div className="mt-4 rounded-md bg-green-500/10 border border-green-500/20 p-4 flex items-center text-green-500">
                      <Check className="h-5 w-5 mr-2" />
                      <div>
                        <p className="font-semibold">Attendance Recorded</p>
                        <p className="text-sm text-green-500">
                          {activeSession.is_active ? `Checked in at ${formatTime(activeSession.time)}` : "Successfully marked as present"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4">
                      <Button 
                        className="w-full bg-gradient-to-r from-neon-blue to-neon-purple hover:from-neon-purple hover:to-neon-blue text-white transition-all duration-300 transform hover:scale-[1.02]"
                        onClick={goToScanner}
                      >
                        <QrCode className="h-4 w-4 mr-2" />
                        Scan QR Code
                      </Button>
                    </div>
                  )}
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
            <CardHeader>
              <CardTitle>Attendance Summary</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 h-full">
              <div className="h-full flex flex-col">
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-foreground/5 rounded-md p-4 text-center">
                    <p className="text-3xl font-semibold text-foreground mb-1">
                      {loading ? <Skeleton className="h-8 w-12" /> : attendanceRecords.length}
                    </p>
                    <p className="text-sm text-foreground/60">Total Sessions</p>
                  </div>
                  <div className="bg-foreground/5 rounded-md p-4 text-center">
                    <p className="text-3xl font-semibold text-accent mb-1">
                      {loading ? <Skeleton className="h-8 w-12" /> : attendanceRecords.filter(r => r.status === "present").length}
                    </p>
                    <p className="text-sm text-foreground/60">Present</p>
                  </div>
                </div>
                
                <div className="space-y-4 flex-1">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Present</span>
                      <span className="text-sm font-medium text-foreground/70">{attendanceRecords.filter(r => r.status === "present").length} sessions</span>
                    </div>
                    <div className="w-full bg-foreground/10 rounded-full h-2.5 overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${attendanceRecords.filter(r => r.status === "present").length > 0 ? Math.round((attendanceRecords.filter(r => r.status === "present").length / attendanceRecords.length) * 100) : 0}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="bg-gradient-to-r from-neon-green to-neon-blue h-full rounded-full" 
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Absent</span>
                      <span className="text-sm font-medium text-foreground/70">{attendanceRecords.length - attendanceRecords.filter(r => r.status === "present").length} sessions</span>
                    </div>
                    <div className="w-full bg-foreground/10 rounded-full h-2.5 overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${attendanceRecords.length > 0 ? 100 - Math.round((attendanceRecords.filter(r => r.status === "present").length / attendanceRecords.length) * 100) : 0}%` }}
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
          <CardHeader>
            <CardTitle>Upcoming Sessions</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
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

      {/* Recent Attendance */}
      <motion.div variants={itemVariants}>
        <Card className="border-border/30">
          <CardHeader>
            <CardTitle>Recent Attendance</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-5 w-1/4" />
                  </div>
                ))}
              </div>
            ) : attendanceRecords.length > 0 ? (
              <div className="space-y-4">
                {attendanceRecords.map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div>
                      <div className="font-medium">{record.session.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(record.session.date), 'PPP')} at{' '}
                        {format(new Date(`${record.session.date}T${record.session.time}`), 'h:mm a')}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {record.status === 'present' ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                      <span className={record.status === 'present' ? 'text-green-700' : 'text-red-700'}>
                        {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                No attendance records found
              </div>
            )}
          </CardContent>
          
          {attendanceRecords.length > 3 && (
            <CardFooter className="border-t pt-4 flex justify-center">
              <SimpleLink to="/student/attendance">
                <Button variant="outline" size="sm">
                  View All Records
                </Button>
              </SimpleLink>
            </CardFooter>
          )}
        </Card>
      </motion.div>
    </motion.div>
  );
}
