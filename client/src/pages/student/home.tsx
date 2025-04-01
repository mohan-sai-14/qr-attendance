import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { User, CalendarDays, BarChart, Check, Calendar, Info, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

interface ActiveSession {
  id: number;
  name: string;
  date?: string;
  time?: string;
  duration?: number;
  created_at: string;
  expires_at: string;
  is_active: boolean;
}

export default function StudentHome() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState<string>("");
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  
  // State for direct session management
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  useEffect(() => {
    setCurrentDate(format(new Date(), "EEEE, MMMM d, yyyy"));
  }, []);

  // Direct fetch function for active session
  const fetchActiveSession = async () => {
    try {
      console.log('Student Home: Directly fetching active session using Supabase...');
      setLoading(true);

      // Get the active session directly from Supabase
      const { data: session, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Student Home: Supabase error:', error);
        setActiveSession(null);
        return;
      }

      console.log('Student Home: Supabase active session result:', session);

      if (session) {
        // Check if session has expired
        const expiryTime = new Date(session.expires_at).getTime();
        const now = new Date().getTime();
        
        if (now > expiryTime) {
          console.log('Student Home: Session expired');
          setActiveSession(null);
          
          // Deactivate expired session
          await supabase
            .from('sessions')
            .update({ is_active: false })
            .eq('id', session.id);
            
          return;
        }
        
        console.log('Student Home: Active session found with ID:', session.id);
        
        // Force immediate update to state
        setActiveSession({
          ...session,
          // Ensure these properties exist with fallbacks
          date: session.date || format(new Date(session.created_at), 'yyyy-MM-dd'),
          time: session.time || format(new Date(session.created_at), 'HH:mm')
        });

        // Force React Query to update as well
        queryClient.setQueryData(['/api/sessions/active'], {
          success: true,
          data: session
        });
        
        // Store in localStorage for cross-tab communication
        localStorage.setItem('latest_active_session', JSON.stringify({
          id: session.id,
          timestamp: Date.now()
        }));
      } else {
        console.log('Student Home: No active session found');
        setActiveSession(null);
        queryClient.setQueryData(['/api/sessions/active'], null);
      }
    } catch (error) {
      console.error('Student Home: Error fetching active session:', error);
      setActiveSession(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Initial fetch and polling
  useEffect(() => {
    fetchActiveSession();
    
    const intervalId = setInterval(() => {
      fetchActiveSession();
    }, 5000); // Poll every 5 seconds
    
    return () => clearInterval(intervalId);
  }, []);

  // Set up Supabase realtime subscription for sessions table
  useEffect(() => {
    console.log("Student Home: Setting up Supabase subscription");
    
    const subscription = supabase
      .channel('student-session-updates')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'sessions' }, 
        (payload) => {
          console.log('Student Home: Supabase realtime update received:', payload);
          // Immediately fetch the updated active session
          fetchActiveSession();
        }
      )
      .subscribe((status) => {
        console.log('Student Home: Supabase subscription status:', status);
      });
    
    // Clean up subscription on component unmount
    return () => {
      console.log("Student Home: Cleaning up Supabase subscription");
      supabase.removeChannel(subscription);
    };
  }, []);

  // Debugging log for active session
  useEffect(() => {
    console.log('Student Home: Current active session state:', activeSession);
  }, [activeSession]);

  // Handle manual refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchActiveSession();
  };
  
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

  // Add window focus event to refresh on tab switch
  useEffect(() => {
    // Function to handle window focus events
    const handleWindowFocus = () => {
      console.log('Student Home: Window focused, refreshing active session');
      fetchActiveSession();
    };

    // Listen for the custom event from QR generator
    const handleSessionCreated = (event: any) => {
      console.log('Student Home: Received session-created event:', event.detail);
      fetchActiveSession();
    };

    // Set up event listeners
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('session-created', handleSessionCreated);

    // Clean up
    return () => {
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('session-created', handleSessionCreated);
    };
  }, []);

  // Add localStorage event listener for cross-tab communication
  useEffect(() => {
    // Function to handle localStorage changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'latest_active_session') {
        console.log('Student Home: Detected cross-tab update via localStorage');
        fetchActiveSession();
      }
    };

    // Listen for storage events (cross-tab communication)
    window.addEventListener('storage', handleStorageChange);
    
    // Set up a polling interval to check localStorage directly
    // This helps in some browsers where the storage event might not fire reliably
    const checkInterval = setInterval(() => {
      try {
        const storedSession = localStorage.getItem('latest_active_session');
        if (storedSession) {
          const sessionData = JSON.parse(storedSession);
          const currentTimestamp = sessionData.timestamp || 0;
          
          // Store the last checked timestamp in a ref to avoid unnecessary refreshes
          if (!window.__lastCheckedTimestamp || window.__lastCheckedTimestamp < currentTimestamp) {
            console.log('Student Home: Detected new session data in localStorage polling');
            window.__lastCheckedTimestamp = currentTimestamp;
            fetchActiveSession();
          }
        }
      } catch (e) {
        console.warn('Student Home: Error checking localStorage:', e);
      }
    }, 2000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(checkInterval);
    };
  }, []);

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Welcome Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center space-x-4">
            <div className="rounded-full bg-primary-100 dark:bg-primary-900 p-4">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Welcome, {user?.name}</h2>
              <p className="text-muted-foreground">Student ID: {user?.username}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Active Session */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold flex items-center">
                <CalendarDays className="mr-2 h-5 w-5 text-primary" />
                Active Session
              </h3>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleRefresh} 
                disabled={refreshing}
                className="h-8 w-8 p-0"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="sr-only">Refresh</span>
              </Button>
            </div>
            {loading ? (
              <div className="flex justify-center items-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : activeSession ? (
              <div>
                {isCheckedIn ? (
                  <div className="bg-green-50 dark:bg-green-900 p-4 rounded-md mb-4 flex items-start">
                    <Check className="h-5 w-5 mr-2 text-green-500" />
                    <div>
                      <p className="font-medium text-green-800 dark:text-green-200">You are checked in!</p>
                      <p className="text-sm text-green-700 dark:text-green-300">
                        {activeSession.name} • {activeSession.time || format(new Date(activeSession.created_at), 'HH:mm')}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-yellow-50 dark:bg-yellow-900 p-4 rounded-md mb-4 flex items-start">
                    <Info className="h-5 w-5 mr-2 text-yellow-500" />
                    <div>
                      <p className="font-medium text-yellow-800 dark:text-yellow-200">You need to check in!</p>
                      <p className="text-sm text-yellow-700 dark:text-yellow-300">
                        Go to the Scan QR tab to mark your attendance.
                      </p>
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Session Details:</p>
                  <p className="font-medium">{activeSession.name}</p>
                  <p className="text-sm">
                    {activeSession.date || format(new Date(activeSession.created_at), 'yyyy-MM-dd')} • 
                    {activeSession.time || format(new Date(activeSession.created_at), 'HH:mm')} • 
                    {activeSession.duration ? `${activeSession.duration} min` : 'Duration not specified'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Session ID: {activeSession.id} • Expires: {format(new Date(activeSession.expires_at), 'HH:mm:ss')}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <Calendar className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No active sessions at the moment</p>
                <p className="text-sm text-muted-foreground">Check back later or scan a QR code</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Attendance Summary */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <BarChart className="mr-2 h-5 w-5 text-primary" />
              Attendance Summary
            </h3>
            <div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                  <p className="text-sm text-muted-foreground">Total Sessions</p>
                  <p className="text-xl font-semibold">{totalSessions}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                  <p className="text-sm text-muted-foreground">Attendance Rate</p>
                  <p className="text-xl font-semibold text-green-500">{attendanceRate}%</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Present</span>
                  <span className="text-sm font-medium">{presentSessions}</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full" 
                    style={{width: `${attendanceRate}%`}}
                  ></div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Absent</span>
                  <span className="text-sm font-medium">{totalSessions - presentSessions}</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-red-500 h-2 rounded-full" 
                    style={{width: `${totalSessions > 0 ? 100 - attendanceRate : 0}%`}}
                  ></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Sessions */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Calendar className="mr-2 h-5 w-5 text-primary" />
            Upcoming Sessions
          </h3>
          {upcomingSessions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Session</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Time</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingSessions.map((session: any) => (
                    <tr key={session.id} className="border-b border-border">
                      <td className="px-4 py-3 text-sm">{session.name}</td>
                      <td className="px-4 py-3 text-sm">{session.date}</td>
                      <td className="px-4 py-3 text-sm">{session.time}</td>
                      <td className="px-4 py-3 text-sm">{session.duration} min</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">
              No upcoming sessions scheduled at the moment.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
