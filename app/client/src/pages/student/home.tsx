import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { User, CalendarDays, BarChart, Check, Calendar, Info, AlertCircle, QrCode, Clock, Users, CheckCircle2, XCircle } from "lucide-react";
import { format, differenceInMinutes, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useNetwork } from '@/hooks/use-network';

// Type for the attendance record
interface AttendanceRecord {
  id: string;
  session_id: string;
  user_id: string;
  check_in_time: string;
  status: 'present' | 'absent';
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
  created_at: string;
}

interface AttendanceStats {
  totalSessions: number;
  attendedSessions: number;
  attendanceRate: number;
}

interface NetworkStatus {
  online: boolean;
  lastSync: Date | null;
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
  const [stats, setStats] = useState<AttendanceStats>({
    totalSessions: 0,
    attendedSessions: 0,
    attendanceRate: 0,
  });
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    online: navigator.onLine,
    lastSync: null
  });
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  // Network status hook
  const { online } = useNetwork();

  useEffect(() => {
    setCurrentDate(format(new Date(), "EEEE, MMMM d, yyyy"));
  }, []);

  useEffect(() => {
    if (!user) return;

    // Subscribe to active session changes
    const sessionSubscription = supabase
      .channel('active-session')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sessions',
          filter: 'is_active=eq.true'
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    // Subscribe to attendance changes
    const attendanceSubscription = supabase
      .channel('attendance-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    // Initial data fetch
    fetchData();

    return () => {
      sessionSubscription.unsubscribe();
      attendanceSubscription.unsubscribe();
    };
  }, [user]);

  // Memoized fetch function
  const fetchData = useCallback(async () => {
    if (!user) return;

    try {
      setError(null);
      
      // If offline, try to get data from localStorage
      if (!online) {
        const cachedData = localStorage.getItem('studentHomeData');
        if (cachedData) {
          const parsed = JSON.parse(cachedData);
          setActiveSession(parsed.activeSession);
          setAttendanceRecords(parsed.attendanceRecords);
          setStats(parsed.stats);
          setNetworkStatus(prev => ({ ...prev, online: false }));
          return;
        }
      }

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
          .eq('user_id', user.id)
          .single();

        if (attendanceError && attendanceError.code !== 'PGRST116') {
          throw new Error('Failed to check attendance status');
        }

        setHasCheckedIn(!!attendanceData);
      }

      // Fetch recent attendance records with retry logic
      const fetchAttendanceWithRetry = async (attempt = 0) => {
        try {
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
            .eq('user_id', user.id)
            .order('check_in_time', { ascending: false })
            .limit(5);

          if (recordsError) throw recordsError;
          return records;
        } catch (err) {
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
            return fetchAttendanceWithRetry(attempt + 1);
          }
          throw err;
        }
      };

      const records = await fetchAttendanceWithRetry();
      setAttendanceRecords(records || []);

      // Fetch and calculate stats
      const { data: statsData } = await supabase
        .from('sessions')
        .select('id, is_active')
        .eq('is_active', false);

      const totalSessions = statsData?.length || 0;

      const { data: attendedData } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'present');

      const attendedSessions = attendedData?.length || 0;
      const attendanceRate = totalSessions > 0 ? (attendedSessions / totalSessions) * 100 : 0;

      const newStats = {
        totalSessions,
        attendedSessions,
        attendanceRate,
      };

      setStats(newStats);

      // Cache the data
      const cacheData = {
        activeSession: sessionData,
        attendanceRecords: records,
        stats: newStats,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem('studentHomeData', JSON.stringify(cacheData));
      setNetworkStatus({ online: true, lastSync: new Date() });

    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      toast.error(err instanceof Error ? err.message : 'An error occurred');
      
      if (retryCount < maxRetries) {
        setRetryCount(prev => prev + 1);
        setTimeout(() => fetchData(), Math.pow(2, retryCount) * 1000);
      }
    } finally {
      setLoading(false);
    }
  }, [user, online, retryCount]);

  // Update network status
  useEffect(() => {
    setNetworkStatus(prev => ({ ...prev, online }));
  }, [online]);

  // Format date
  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'MMM d, yyyy');
    } catch {
      return dateString;
    }
  };

  // Format time
  const formatTime = (timeString: string) => {
    try {
      if (timeString.includes('T')) {
        return format(parseISO(timeString), 'h:mm a');
      }
      const [hours, minutes] = timeString.split(':').map(Number);
      const date = new Date();
      date.setHours(hours, minutes);
      return format(date, 'h:mm a');
    } catch {
      return timeString;
    }
  };

  const calculateTimeRemaining = (session: ActiveSession) => {
    try {
      const sessionDate = parseISO(session.date);
      const [hours, minutes] = session.time.split(':').map(Number);
      sessionDate.setHours(hours, minutes);
      
      const endTime = new Date(sessionDate.getTime() + session.duration * 60000);
      const now = new Date();
      
      if (now > endTime) return 'Session ended';
      
      const minutesRemaining = differenceInMinutes(endTime, now);
      const hoursRemaining = Math.floor(minutesRemaining / 60);
      const remainingMinutes = minutesRemaining % 60;
      
      if (hoursRemaining > 0) {
        return `${hoursRemaining}h ${remainingMinutes}m remaining`;
      }
      return `${remainingMinutes}m remaining`;
    } catch {
      return 'Time remaining unavailable';
    }
  };

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
      <div className="container mx-auto px-4 py-8 space-y-6">
        <Skeleton className="h-[200px] w-full" />
        <Skeleton className="h-[150px] w-full" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="container mx-auto px-4 py-8 space-y-6"
    >
      {/* Network Status */}
      {!networkStatus.online && (
        <Alert variant="warning" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Offline Mode</AlertTitle>
          <AlertDescription>
            You are currently offline. Some features may be limited.
            {networkStatus.lastSync && (
              <div className="text-sm mt-1">
                Last synced: {format(networkStatus.lastSync, 'MMM d, yyyy HH:mm')}
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Welcome Banner */}
      <motion.div variants={itemVariants}>
        <Card className="border-border/30 overflow-hidden relative">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-primary/10 p-3">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold">
                  Welcome, {user?.name}
                </h2>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <p>{currentDate}</p>
                  <Badge variant="outline" className="text-xs">
                    ID: {user?.username}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Active Session */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Active Session
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeSession ? (
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium">{activeSession.name || `Session ${activeSession.id}`}</h3>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(activeSession.date)} at {formatTime(activeSession.time)}
                    </p>
                    <p className="text-sm font-medium text-primary">
                      {calculateTimeRemaining(activeSession)}
                    </p>
                  </div>
                  <div>
                    {hasCheckedIn ? (
                      <Badge className="bg-green-100 text-green-800 border-green-200">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Present
                      </Badge>
                    ) : (
                      <Button onClick={goToScanner} className="gap-2">
                        <QrCode className="h-4 w-4" />
                        Scan QR Code
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <p>No active session at the moment</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Attendance Stats */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart className="h-5 w-5" />
              Attendance Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-semibold">{stats.totalSessions}</p>
                <p className="text-sm text-muted-foreground">Total Sessions</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-semibold">{stats.attendedSessions}</p>
                <p className="text-sm text-muted-foreground">Sessions Attended</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-semibold">{stats.attendanceRate.toFixed(1)}%</p>
                <p className="text-sm text-muted-foreground">Attendance Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Recent Attendance */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Recent Attendance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {attendanceRecords.length > 0 ? (
                attendanceRecords.map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div>
                      <p className="font-medium">
                        {record.session?.name || `Session ${record.session_id}`}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(record.check_in_time)} at {formatTime(record.check_in_time)}
                      </p>
                    </div>
                    <Badge
                      variant={record.status === 'present' ? 'default' : 'destructive'}
                      className="capitalize"
                    >
                      {record.status === 'present' ? (
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                      ) : (
                        <XCircle className="h-3 w-3 mr-1" />
                      )}
                      {record.status}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <p>No recent attendance records</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {error && (
        <motion.div variants={itemVariants}>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </motion.div>
      )}
    </motion.div>
  );
}
